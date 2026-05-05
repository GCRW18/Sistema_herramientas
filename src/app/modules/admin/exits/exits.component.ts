import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef, Type, Injector, TrackByFunction } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer } from '@angular/platform-browser';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { takeUntil, finalize } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { MovementService } from '../../../core/services/movement.service';

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

interface ExitRecord {
    id: string;
    fecha: string;
    tipo: string;
    estado: string;
    responsable: string;
    nroComprobante?: string;
    items?: number;
    raw?: any;
}

@Component({
    selector: 'app-exits',
    standalone: true,
    imports: [
        CommonModule,
        NgComponentOutlet,
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
    templateUrl: './exits.component.html',
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
        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }

        .row-selected { background-color: #fef3c7 !important; }
        :host-context(.dark) .row-selected { background-color: rgba(251, 191, 36, 0.2) !important; }
    `]
})
export class ExitsComponent implements OnInit, OnDestroy {
    private dialog     = inject(MatDialog);
    private snackBar   = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private injector   = inject(Injector);
    private iconRegistry = inject(MatIconRegistry);
    private sanitizer    = inject(DomSanitizer);

    private _unsubscribeAll = new Subject<void>();

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild('salidasRecientesDialog') salidasRecientesDialog!: TemplateRef<any>;

    selectedEntry: ExitRecord | null = null;

    // ── Tab system ───────────────────────────────────────────────────────────
    openTabs: OpenTab[] = [];
    activeTabId: number | null = null;
    showBandeja = false;
    private tabCounter = 0;

    private readonly MODULE_DEFS: ModuleDef[] = [
        {
            type: 1, label: 'ENVÍO A', sublabel: 'OTRAS BASES',
            color: '#ff1414', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:building-office',
            loader: async () => (await import('./envio-otras-bases/envio-otras-bases.component')).EnvioOtrasBasesComponent
        },
        {
            type: 2, label: 'TRASPASO', sublabel: 'OTRA ÁREA',
            color: '#ff1414', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:arrow-path',
            loader: async () => (await import('./traspaso-otra-area/traspaso-otra-area.component')).TraspasoOtraAreaComponent
        },
        {
            type: 3, label: 'PRÉSTAMO', sublabel: 'TÉC./OTROS',
            color: '#ff1414', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:building-storefront',
            loader: async () => (await import('./prestamo-terceros/prestamo-terceros.component')).PrestamoTercerosComponent
        },
        {
            type: 4, label: 'CUARENTENA', sublabel: 'DE ACTIVO',
            color: '#ff1414', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:exclamation-triangle',
            loader: async () => (await import('./poner-cuarentena/poner-cuarentena.component')).PonerCuarentenaComponent
        },
        {
            type: 5, label: 'BAJA', sublabel: 'DE ACTIVO',
            color: '#ff1414', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:trash',
            loader: async () => (await import('./baja/baja.component')).BajaComponent
        },
    ];

    isLoading = false;

    // Paginación
    totalRecords  = 0;
    pageSize      = 10;
    pageIndex     = 0;
    pageSizeOptions = [5, 10, 25, 50];

    displayedColumns: string[] = ['fecha', 'tipo', 'nroComprobante', 'estado', 'responsable', 'acciones'];
    recentExits: ExitRecord[] = [];

    constructor() {
        this.registerIcons();
    }

    ngOnInit(): void {
        this.loadRecentExits();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // ── Tab system methods ───────────────────────────────────────────────────

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

    // ── Salidas recientes (Dialogo Compacto Neo-Brutalista) ──────────────────

    openSalidasRecientes(): void {
        this.selectedEntry = null;
        this.loadRecentExits();
        this.dialog.open(this.salidasRecientesDialog, {
            width: '900px', // Modal reducido
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog-transparent',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });
    }

    // ── Datos recientes ──────────────────────────────────────────────────────

    loadRecentExits(): void {
        this.isLoading = true;
        this.movementService.getHistorialMovimientos({
            movement_type: 'exit',
            page: this.pageIndex + 1,
            limit: this.pageSize
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (response) => {
                if (response.data && response.data.length > 0) {
                    this.recentExits = response.data.map((item: any) => ({
                        id: item.id || item.id_movement,
                        fecha: this.formatDate(item.date || item.fecha),
                        tipo: this.mapExitType(item.exitReason || item.exit_reason || item.tipo),
                        estado: this.mapStatus(item.status || item.estado),
                        responsable: item.requestedBy?.fullName || item.requested_by_name || item.responsable || 'N/A',
                        nroComprobante: item.movementNumber || item.movement_number || item.nroComprobante || '-',
                        items: item.items?.length || 0,
                        raw: item
                    }));
                    this.totalRecords = response.total || this.recentExits.length;
                } else {
                    this.loadMockData();
                }
            },
            error: () => this.loadMockData()
        });
    }

    private loadMockData(): void {
        this.recentExits = [
            { id: '1', fecha: '28/01/2026', tipo: 'ENVÍO A BASE',          estado: 'COMPLETADO', responsable: 'GABRIEL CRUZ',     nroComprobante: 'SAL-2026-001', items: 3 },
            { id: '2', fecha: '27/01/2026', tipo: 'ENVÍO A CALIBRACIÓN',   estado: 'COMPLETADO', responsable: 'MARIA LOPEZ',       nroComprobante: 'SAL-2026-002', items: 5 },
            { id: '3', fecha: '26/01/2026', tipo: 'PRÉSTAMO A TERCEROS',   estado: 'PENDIENTE',  responsable: 'CARLOS RODRIGUEZ',  nroComprobante: 'SAL-2026-003', items: 2 },
            { id: '4', fecha: '25/01/2026', tipo: 'TRASPASO A OTRA ÁREA',  estado: 'REVISIÓN',   responsable: 'ANA MARTINEZ',      nroComprobante: 'SAL-2026-004', items: 1 },
            { id: '5', fecha: '24/01/2026', tipo: 'BAJA DE ACTIVO',        estado: 'COMPLETADO', responsable: 'PEDRO SANCHEZ',     nroComprobante: 'SAL-2026-005', items: 4 }
        ];
        this.totalRecords = 25;
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize  = event.pageSize;
        this.loadRecentExits();
    }

    verDetalle(exit: ExitRecord): void  {
        this.selectedEntry = exit;
    }

    cerrarDetalle(): void {
        this.selectedEntry = null;
    }

    getStatusClass(estado: string): string {
        switch (estado) {
            case 'COMPLETADO': return 'bg-green-100 text-green-800 border-green-400';
            case 'PENDIENTE':  return 'bg-yellow-100 text-yellow-800 border-yellow-400';
            case 'REVISIÓN':   return 'bg-blue-100 text-blue-800 border-blue-400';
            case 'CANCELADO':  return 'bg-red-100 text-red-800 border-red-400';
            default:           return 'bg-gray-100 text-gray-800 border-gray-400';
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private formatDate(date: string): string {
        if (!date) return '-';
        try {
            return new Date(date).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return date; }
    }

    private mapExitType(type: string): string {
        const map: Record<string, string> = {
            send_to_base: 'ENVÍO A BASE', send_to_calibration: 'ENVÍO A CALIBRACIÓN',
            transfer: 'TRASPASO A OTRA ÁREA', loan: 'PRÉSTAMO A TERCEROS',
            quarantine: 'CUARENTENA', decommission: 'BAJA DE ACTIVO'
        };
        return map[type] || type?.toUpperCase() || 'N/A';
    }

    private mapStatus(status: string): string {
        const map: Record<string, string> = {
            pending: 'PENDIENTE', approved: 'APROBADO', completed: 'COMPLETADO',
            cancelled: 'CANCELADO', review: 'REVISIÓN'
        };
        return map[status] || status?.toUpperCase() || 'N/A';
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }

    private registerIcons(): void {
        const icons: Record<string, string> = {
            'heroicons_outline:building-office':    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>`,
            'heroicons_outline:arrow-path':         `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>`,
            'heroicons_outline:building-storefront':`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016 2.993 2.993 0 0 0 2.25-1.016 3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" /></svg>`,
            'heroicons_outline:exclamation-triangle':`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`,
            'heroicons_outline:trash':              `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`,
        };
        Object.entries(icons).forEach(([name, svg]) => {
            this.iconRegistry.addSvgIconLiteral(name, this.sanitizer.bypassSecurityTrustHtml(svg));
        });
    }
}
