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
        CommonModule, NgComponentOutlet, MatCardModule, MatIconModule, MatButtonModule,
        MatTableModule, MatPaginatorModule, MatDialogModule, MatSnackBarModule,
        MatProgressSpinnerModule, MatTooltipModule, DragDropModule
    ],
    templateUrl: './entries.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #fff; }

        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center; z-index: 9999;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(15, 23, 42, 0.8); }

        .row-selected { background-color: #fef3c7 !important; }
        :host-context(.dark) .row-selected { background-color: rgba(251, 191, 36, 0.2) !important; }
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
            'technician_return':  'DEVOLUCIÓN PRÉSTAMO',
            'third_party_return': 'DEVOLUCIÓN TERCEROS',
            'base_return':        'RETORNO DE BASE',
            'transfer_return':    'RETORNO TRASPASO',
            'calibration_return': 'RETORNO CALIBRACIÓN',
            'purchase':           'NUEVA HERRAMIENTA',
            'adjustment':         'AJUSTE INGRESO',
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
            case 'COMPLETADO': return 'bg-green-100 text-green-800 border-green-400';
            case 'PENDIENTE':  return 'bg-yellow-100 text-yellow-800 border-yellow-400';
            case 'REVISION':   return 'bg-blue-100 text-blue-800 border-blue-400';
            case 'CANCELADO':  return 'bg-red-100 text-red-800 border-red-400';
            default:           return 'bg-gray-100 text-gray-800 border-gray-400';
        }
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`]
        });
    }

    openEntradasRecientes(): void {
        this.selectedEntry = null;
        this.loadRecentEntries();
        this.dialog.open(this.entradasRecientesDialog, {
            width: '900px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog-transparent',
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
