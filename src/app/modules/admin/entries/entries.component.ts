import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef, Type, Injector, TrackByFunction } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { takeUntil, finalize } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { MovementService } from '../../../core/services/movement.service';

interface EntryRecord {
    id: string;
    fecha: string;
    tipo: string;
    estado: string;
    responsable: string;
    nroComprobante?: string;
    items?: number;
    raw?: any;
}

interface OpenTab {
    id: number;
    type: number;
    label: string;
    sublabel: string;
    color: string;
    textColor: string;
    svgIcon: string;
    component: Type<any>;
    injector: Injector;
}

interface ModuleDef {
    type: number;
    label: string;
    sublabel: string;
    color: string;
    textColor: string;
    svgIcon: string;
    loader: () => Promise<Type<any>>;
}

@Component({
    selector: 'app-entries',
    standalone: true,
    imports: [
        CommonModule,
        NgComponentOutlet,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatPaginatorModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        DragDropModule
    ],
    templateUrl: './entries.component.html',

    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 3px solid #1a1a1a;
            --neo-shadow: 4px 4px 0px 0px rgba(0, 0, 0, 1);
        }

        /* ===== ENTRY CARDS ===== */
        .neo-card-entry {
            border: var(--neo-border);
            box-shadow: var(--neo-shadow);
            border-radius: 20px;
            background-color: #ffffff;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .neo-card-entry:hover {
            transform: translate(-3px, -3px);
            box-shadow: 8px 8px 0px 0px rgba(0, 0, 0, 1);
        }

        .neo-card-entry:active {
            transform: translate(0px, 0px);
            box-shadow: 2px 2px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .neo-card-entry {
            background-color: #203f77;
            border-color: #000000;
            box-shadow: 4px 4px 0px 0px rgb(0, 0, 0);
        }

        :host-context(.dark) .neo-card-entry:hover {
            box-shadow: 8px 8px 0px 0px rgb(0, 0, 0);
        }

        :host-context(.dark) .neo-card-entry:active {
            box-shadow: 2px 2px 0px 0px rgba(30, 41, 59, 1);
        }

        /* ===== CARD NUMBERS ===== */
        .entry-number {
            font-size: 4rem;
            font-weight: 900;
            line-height: 1;
            color: #1a1a1a;
            letter-spacing: -0.03em;
        }

        .entry-number-sm {
            font-size: 2.5rem;
        }

        :host-context(.dark) .entry-number {
            color: #fff6f6;
        }

        /* ===== CARD LABELS ===== */
        .entry-label {
            font-size: 0.95rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.01em;
            line-height: 1.25;
            color: #1a1a1a;
        }

        .entry-label-lg {
            font-size: 1.35rem;
        }

        .entry-label-sm {
            font-size: 0.85rem;
        }

        :host-context(.dark) .entry-label {
            color: #c2cee6;
        }

        /* ===== CARD ICONS ===== */
        .entry-icon-lg {
            width: 70px !important;
            height: 70px !important;
            font-size: 70px !important;
            color: #1a1a1a;
        }

        .entry-icon-md {
            width: 48px !important;
            height: 48px !important;
            font-size: 48px !important;
            color: #1a1a1a;
        }

        .entry-icon-xl {
            width: 130px !important;
            height: 130px !important;
            font-size: 130px !important;
            color: #1a1a1a;
        }

        :host-context(.dark) .entry-icon-lg,
        :host-context(.dark) .entry-icon-md,
        :host-context(.dark) .entry-icon-xl {
            color: #ffffff;
        }

        /* ===== SIDEBAR BUTTONS ===== */
        .entry-sidebar-btn {
            width: 100%;
            padding: 14px 20px;
            font-weight: 900;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            background-color: #ffffff;
            color: #1a1a1a;
            border: 3px solid #1a1a1a;
            border-radius: 14px;
            box-shadow: 3px 3px 0px 0px rgba(0, 0, 0, 1);
            cursor: pointer;
            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .entry-sidebar-btn:hover {
            transform: translate(-2px, -2px);
            box-shadow: 5px 5px 0px 0px rgba(0, 0, 0, 1);
            color: #ffffff;
        }

        .entry-sidebar-btn:active {
            transform: translate(0, 0);
            box-shadow: 1px 1px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .entry-sidebar-btn {
            background-color: #203f77;
            color: #ffffff;
            border-color: #000000;
            box-shadow: 3px 3px 0px 0px rgb(30, 41, 59);
        }

        /* ===== TABLE STYLES ===== */
        .header-neo {
            background-color: white !important;
            color: #111A43 !important;
            font-weight: 900 !important;
            font-size: 14px !important;
            border-bottom: 3px solid black !important;
            padding: 20px !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .cell-neo {
            padding: 18px 20px !important;
            border-bottom: 1px solid #000000 !important;
            font-size: 14px !important;
            color: black;
        }

        :host-context(.dark) .header-neo {
            background-color: #111A43 !important;
            color: white !important;
        }

        :host-context(.dark) .cell-neo {
            color: white;
            border-bottom-color: #333;
        }

        /* ===== DIALOG: Neo Card Base ===== */
        .neo-card-base-entry {
            border: 2px solid black !important;
            box-shadow: 4px 4px 0px 0px rgba(0,0,0,1) !important;
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base-entry {
            background-color: #1e293b !important;
        }

        /* ===== DIALOG: Spinner Overlay ===== */
        .spinner-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
        }

        :host-context(.dark) .spinner-overlay {
            background: rgba(0,0,0,0.7);
        }

        /* ===== DIALOG: Custom Scrollbar ===== */
        .custom-scrollbar-entry::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-entry::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-entry::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar-entry::-webkit-scrollbar-thumb { background: #cbd5e1; }

    `]
})
export class EntriesComponent implements OnInit, OnDestroy {
    private router          = inject(Router);
    private dialog          = inject(MatDialog);
    private snackBar        = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private injector        = inject(Injector);

    private _unsubscribeAll = new Subject<void>();

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild('entradasRecientesDialog') entradasRecientesDialog!: TemplateRef<any>;

    selectedEntry: EntryRecord | null = null;

    // ── Tab system ───────────────────────────────────────────────────────────
    openTabs: OpenTab[] = [];
    activeTabId: number | null = null;
    showBandeja = false;
    private tabCounter = 0;

    private readonly MODULE_DEFS: ModuleDef[] = [
        {
            type: 1, label: 'RETORNO', sublabel: 'BASE/TRASPASO',
            color: '#2563eb', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:building-office-2',
            loader: async () => (await import('./retorno-traspaso/retorno-traspaso.component')).RetornoTraspasoComponent
        },
        {
            type: 2, label: 'NUEVA', sublabel: 'HERRAMIENTA',
            color: '#2563eb', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:wrench-screwdriver',
            loader: async () => (await import('./nueva-herramienta/nueva-herramienta.component')).NuevaHerramientaComponent
        },
        {
            type: 3, label: 'DEVOLUCIÓN', sublabel: 'PRÉSTAMO TÉC.',
            color: '#2563eb', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:arrow-uturn-left',
            loader: async () => (await import('./devolucion-herramienta/devolucion-herramienta.component')).DevolucionHerramientaComponent
        },
        {
            type: 4, label: 'AJUSTE', sublabel: 'POR INGRESO',
            color: '#2563eb', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:adjustments-horizontal',
            loader: async () => (await import('./ajuste-ingreso/ajuste-ingreso.component')).AjusteIngresoComponent
        },
        {
            type: 5, label: 'DEVOLUCIÓN', sublabel: 'TERCEROS',
            color: '#2563eb', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:user-circle',
            loader: async () => (await import('./devolucion-terceros/devolucion-terceros.component')).DevolucionTercerosComponent
        },
    ];

    isLoading = false;

    // Paginacion
    totalRecords = 0;
    pageSize = 10;
    pageIndex = 0;
    pageSizeOptions = [5, 10, 25, 50];

    displayedColumns: string[] = ['fecha', 'tipo', 'nroComprobante', 'estado', 'responsable', 'acciones'];
    recentEntries: EntryRecord[] = [];

    ngOnInit(): void {
        this.loadRecentEntries();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadRecentEntries(): void {
        this.isLoading = true;

        this.movementService.getHistorialMovimientos({
            movement_type: 'entry',
            page: this.pageIndex + 1,
            limit: this.pageSize
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (response) => {
                if (response.data && response.data.length > 0) {
                    this.recentEntries = response.data.map((item: any) => ({
                        id: item.id_movement || item.id,
                        fecha: this.formatDate(item.date || item.fecha),
                        tipo: this.mapEntryType(item.entry_reason || item.type || item.entryReason || item.tipo),
                        estado: this.mapStatus(item.status || item.estado),
                        responsable: item.requested_by_name || item.requestedBy?.fullName || item.responsable || 'N/A',
                        nroComprobante: item.movement_number || item.movementNumber || item.nroComprobante || '-',
                        items: item.items?.length || 0,
                        raw: item
                    }));
                    this.totalRecords = response.total || this.recentEntries.length;
                } else {
                    this.loadMockData();
                }
            },
            error: () => {
                this.loadMockData();
            }
        });
    }

    private loadMockData(): void {
        this.recentEntries = [
            { id: '1', fecha: '28/01/2026', tipo: 'RETORNO CALIBRACION', estado: 'COMPLETADO', responsable: 'GABRIEL CRUZ', nroComprobante: 'ENT-2026-001', items: 3 },
            { id: '2', fecha: '27/01/2026', tipo: 'NUEVA HERRAMIENTA', estado: 'COMPLETADO', responsable: 'MARIA LOPEZ', nroComprobante: 'ENT-2026-002', items: 5 },
            { id: '3', fecha: '26/01/2026', tipo: 'DEVOLUCION', estado: 'PENDIENTE', responsable: 'CARLOS RODRIGUEZ', nroComprobante: 'ENT-2026-003', items: 2 },
            { id: '4', fecha: '25/01/2026', tipo: 'AJUSTE INGRESO', estado: 'REVISION', responsable: 'ANA MARTINEZ', nroComprobante: 'ENT-2026-004', items: 1 },
            { id: '5', fecha: '24/01/2026', tipo: 'RETORNO TRASPASO', estado: 'COMPLETADO', responsable: 'PEDRO SANCHEZ', nroComprobante: 'ENT-2026-005', items: 4 }
        ];
        this.totalRecords = 25;
    }

    private formatDate(date: string): string {
        if (!date) return '-';
        try {
            const d = new Date(date);
            return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return date;
        }
    }

    private mapEntryType(type: string): string {
        const typeMap: Record<string, string> = {
            // entry_reason (devoluciones / retornos) — coincide con los submodulos
            'technician_return':  'DEVOLUCIÓN PRÉSTAMO TÉC.',
            'third_party_return': 'DEVOLUCIÓN TERCEROS',
            'base_return':        'RETORNO DE BASE',
            'transfer_return':    'RETORNO TRASPASO',
            'calibration_return': 'RETORNO CALIBRACIÓN',
            // type (nueva herramienta / ajuste) — sin entry_reason
            'purchase':           'NUEVA HERRAMIENTA',
            'adjustment':         'AJUSTE POR INGRESO',
        };
        return typeMap[type] || type?.toUpperCase() || 'N/A';
    }

    private mapStatus(status: string): string {
        const statusMap: Record<string, string> = {
            'pending': 'PENDIENTE',
            'approved': 'APROBADO',
            'completed': 'COMPLETADO',
            'cancelled': 'CANCELADO',
            'review': 'REVISION'
        };
        return statusMap[status] || status?.toUpperCase() || 'N/A';
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadRecentEntries();
    }

    verDetalle(entry: EntryRecord): void {
        this.selectedEntry = entry;
    }

    cerrarDetalle(): void {
        this.selectedEntry = null;
    }

    getStatusClass(estado: string): string {
        switch (estado) {
            case 'COMPLETADO':
                return 'bg-[#177f0f] text-black';
            case 'PENDIENTE':
                return 'bg-[#F8B400FF] text-black';
            case 'REVISION':
                return 'bg-[#203F77FF] text-white';
            case 'CANCELADO':
                return 'bg-red-800 text-white';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }

    openEntradasRecientes(): void {
        this.selectedEntry = null;
        this.loadRecentEntries();
        this.dialog.open(this.entradasRecientesDialog, {
            width: '1100px',
            maxWidth: '95vw',
            height: '85vh',
            maxHeight: '90vh',
            panelClass: 'neo-dialog-entradas',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });
    }

    // ── Tab system ───────────────────────────────────────────────────────────

    toggleBandeja(): void {
        this.showBandeja = !this.showBandeja;
    }

    closeBandeja(): void {
        this.showBandeja = false;
    }

    isTabOpen(type: number): boolean {
        return this.openTabs.some(t => t.type === type);
    }

    async openModule(type: number): Promise<void> {
        this.showBandeja = false;

        // Si ya está abierto, solo enfocar
        const existing = this.openTabs.find(t => t.type === type);
        if (existing) {
            this.activeTabId = existing.id;
            return;
        }

        const def = this.MODULE_DEFS.find(d => d.type === type)!;
        const component = await def.loader();
        const id = ++this.tabCounter;

        const self = this;
        const fakeRef = {
            close:            () => self.closeTab(id),
            afterClosed:      () => of(null),
            beforeClosed:     () => of(null),
            backdropClick:    () => of(null),
            keydownEvents:    () => of(null),
            updatePosition:   () => {},
            updateSize:       () => {},
            addPanelClass:    () => {},
            removePanelClass: () => {},
            disableClose: false,
            id: `tab-${id}`,
            componentInstance: null,
        };
        const tabInjector = Injector.create({
            providers: [{ provide: MatDialogRef, useValue: fakeRef }],
            parent: this.injector
        });

        this.openTabs.push({ id, type, label: def.label, sublabel: def.sublabel, color: def.color, textColor: def.textColor, svgIcon: def.svgIcon, component, injector: tabInjector });
        this.activeTabId = id;
    }

    setActiveTab(id: number): void {
        this.activeTabId = id;
    }

    closeTab(id: number): void {
        const idx = this.openTabs.findIndex(t => t.id === id);
        if (idx === -1) return;
        this.openTabs.splice(idx, 1);
        if (this.activeTabId === id) {
            this.activeTabId = this.openTabs.length > 0
                ? this.openTabs[Math.max(0, idx - 1)].id
                : null;
        }
    }

    trackByTabId: TrackByFunction<OpenTab> = (_index, tab) => tab.id;
}
