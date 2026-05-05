import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef, Type, Injector, TrackByFunction, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { DomSanitizer } from '@angular/platform-browser';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { takeUntil, finalize } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { CalibrationService } from '../../../core/services/calibration.service';
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

interface CalibrationRecord {
    id: string;
    fecha: string;
    tipo: string;
    estado: string;
    responsable: string;
    nroComprobante?: string;
    items?: number;
}

@Component({
    selector: 'app-calibraciones',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        NgComponentOutlet,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatTableModule,
        MatPaginatorModule,
        DragDropModule
    ],
    templateUrl: './calibraciones.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        .custom-scrollbar-cal::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-cal::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-cal::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar-cal::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
            animation: spin-slow 3s linear infinite;
        }
    `]
})
export class CalibracionesComponent implements OnInit, OnDestroy, AfterViewInit {
    private dialog             = inject(MatDialog);
    private snackBar           = inject(MatSnackBar);
    private calibrationService = inject(CalibrationService);
    private movementService    = inject(MovementService);
    private injector           = inject(Injector);
    private iconRegistry       = inject(MatIconRegistry);
    private sanitizer          = inject(DomSanitizer);
    private cdr                = inject(ChangeDetectorRef);

    private _unsubscribeAll = new Subject<void>();

    @ViewChild('calibracionesRecientesDialog') calibracionesRecientesDialog!: TemplateRef<any>;

    // ── Tab system ───────────────────────────────────────────────────────────
    openTabs: OpenTab[] = [];
    activeTabId: number | null = null;
    showBandeja = false;
    private tabCounter = 0;

    readonly MODULE_DEFS: ModuleDef[] = [
        {
            type: 1, label: 'ENVÍO', sublabel: 'CALIBRACIÓN',
            color: '#FF6A00', textColor: '#fff',
            svgIcon: 'heroicons_outline:paper-airplane',
            loader: async () => (await import('./envio-calibracion/envio-calibracion.component')).EnvioCalibracionComponent
        },
        {
            type: 2, label: 'RETORNO', sublabel: 'CALIBRACIÓN',
            color: '#1A3EDC', textColor: '#fff',
            svgIcon: 'heroicons_outline:arrow-uturn-left',
            loader: async () => (await import('./retorno-calibracion/retorno-calibracion.component')).RetornoCalibracionComponent
        },
        {
            type: 3, label: 'EMPRESAS', sublabel: 'DE SERVICIO',
            color: '#7113CF', textColor: '#fff',
            svgIcon: 'heroicons_outline:building-office',
            loader: async () => (await import('./laboratorios/laboratorios.component')).LaboratoriosComponent
        },
        {
            type: 8, label: 'CONSULTA', sublabel: 'Y AUDITORÍA',
            color: '#0f766e', textColor: '#fff',
            svgIcon: 'heroicons_outline:magnifying-glass',
            loader: async () => (await import('./consulta-auditoria/consulta-auditoria.component')).ConsultaAuditoriaComponent
        },
        {
            type: 6, label: 'SERVICIOS', sublabel: 'MANTENIMIENTO',
            color: '#d97706', textColor: '#fff',
            svgIcon: 'heroicons_outline:wrench-screwdriver',
            loader: async () => (await import('./servicios-mantenimiento/servicios-mantenimiento.component')).ServiciosMantenimientoComponent
        },
        {
            type: 5, label: 'CENTRO DE', sublabel: 'CONTROL',
            color: '#e94125', textColor: '#fff',
            svgIcon: 'heroicons_outline:bell-alert',
            loader: async () => (await import('./dashboard-alertas/dashboard-alertas.component')).DashboardAlertasComponent
        },
        {
            type: 9, label: 'TRANSCRIPCIÓN', sublabel: 'HISTÓRICO',
            color: '#7c3aed', textColor: '#fff',
            svgIcon: 'heroicons_outline:pencil-square',
            loader: async () => (await import('./transcripcion-manual/transcripcion-manual.component')).TranscripcionManualComponent
        },
    ];

    alertCount = 0;
    isLoading  = false;

    displayedColumns = ['fecha', 'tipo', 'nroComprobante', 'estado', 'responsable', 'acciones'];
    selectedEntry: CalibrationRecord | null = null;

    // ── Paginación ────────────────────────────────────────────────────────────
    totalRecords    = 0;
    pageSize        = 10;
    pageIndex       = 0;
    pageSizeOptions = [5, 10, 25, 50];
    recentCalibrations: CalibrationRecord[] = [];

    constructor() {
        this.registerIcons();
    }

    ngOnInit(): void {
        this.loadAlertCount();
        this.loadRecentCalibrations();
    }

    ngAfterViewInit(): void {
        setTimeout(() => this.cdr.detectChanges());
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // ── Tab system methods ───────────────────────────────────────────────────
    toggleBandeja(): void {
        this.showBandeja = !this.showBandeja;
        this.cdr.detectChanges();
    }

    closeBandeja(): void {
        this.showBandeja = false;
        this.cdr.detectChanges();
    }

    isTabOpen(type: number): boolean {
        return this.openTabs.some(t => t.type === type);
    }

    async openModule(type: number): Promise<void> {
        this.showBandeja = false;

        const existing = this.openTabs.find(t => t.type === type);
        if (existing) {
            this.activeTabId = existing.id;
            this.cdr.detectChanges();
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

        this.openTabs.push({
            id, type,
            label: def.label, sublabel: def.sublabel,
            color: def.color, textColor: def.textColor,
            svgIcon: def.svgIcon, component, injector: tabInjector
        });
        this.activeTabId = id;
        this.cdr.detectChanges();
    }

    setActiveTab(id: number): void {
        this.activeTabId = id;
        this.cdr.detectChanges();
    }

    closeTab(id: number): void {
        const idx = this.openTabs.findIndex(t => t.id === id);
        if (idx === -1) return;
        this.openTabs.splice(idx, 1);
        if (this.activeTabId === id) {
            this.activeTabId = this.openTabs.length > 0 ? this.openTabs[Math.max(0, idx - 1)].id : null;
        }
        this.cdr.detectChanges();
    }

    trackByTabId: TrackByFunction<OpenTab> = (_index, tab) => tab.id;

    // ── Dialog ───────────────────────────────────────────────────────────────
    openCalibracionesRecientes(): void {
        this.pageIndex = 0;
        this.loadRecentCalibrations();
        this.dialog.open(this.calibracionesRecientesDialog, {
            width: '1100px',
            maxWidth: '95vw',
            height: '85vh',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });
    }

    // ── Datos ────────────────────────────────────────────────────────────────
    private loadAlertCount(): void {
        this.calibrationService.getCalibrationAlertsPxp({ start: 0, limit: 1 }).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (res: any) => {
                let count = 0;
                if (Array.isArray(res)) count = res.length;
                else if (res?.total) count = res.total;
                else if (res?.datos?.length) count = res.datos.length;
                else if (typeof res === 'number') count = res;

                setTimeout(() => {
                    this.alertCount = count;
                    this.cdr.detectChanges();
                });
            },
            error: () => setTimeout(() => { this.alertCount = 0; this.cdr.detectChanges(); })
        });
    }

    loadRecentCalibrations(): void {
        this.isLoading = true;
        this.cdr.detectChanges();

        this.movementService.getHistorialMovimientos({
            movement_type: 'calibration',
            page: this.pageIndex + 1,
            limit: this.pageSize
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => setTimeout(() => { this.isLoading = false; this.cdr.detectChanges(); }))
        ).subscribe({
            next: (response) => {
                setTimeout(() => {
                    if (response && response.data && response.data.length > 0) {
                        this.recentCalibrations = response.data.map((item: any) => ({
                            id: item.id || item.id_calibration,
                            fecha: this.formatDate(item.date || item.fecha),
                            tipo: this.mapCalType(item.tipo || item.type),
                            estado: this.mapStatus(item.status || item.estado),
                            responsable: item.requestedBy?.fullName || item.responsable || 'N/A',
                            nroComprobante: item.record_number || item.nroComprobante || '-',
                            items: item.items?.length || 0
                        }));
                        this.totalRecords = response.total || this.recentCalibrations.length;
                    } else {
                        this.recentCalibrations = [];
                        this.totalRecords = 0;
                    }
                    this.cdr.detectChanges();
                });
            },
            error: () => setTimeout(() => { this.recentCalibrations = []; this.totalRecords = 0; this.cdr.detectChanges(); })
        });
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize  = event.pageSize;
        this.loadRecentCalibrations();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private formatDate(date: string): string {
        if (!date) return '-';
        try { return new Date(date).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
        catch { return date; }
    }

    private mapCalType(type: string): string {
        const map: Record<string, string> = { send: 'ENVÍO', return: 'RETORNO', batch: 'ENVÍO LOTE', jack_service: 'SERVICIO GATA' };
        return map[type] || type?.toUpperCase() || 'N/A';
    }

    private mapStatus(status: string): string {
        const map: Record<string, string> = { sent: 'EN LABORATORIO', completed: 'COMPLETADO', returned: 'RETORNADO', pending: 'PENDIENTE', rejected: 'RECHAZADO', cancelled: 'CANCELADO' };
        return map[status] || status?.toUpperCase() || 'N/A';
    }

    getStatusClass(estado: string): string {
        switch (estado) {
            case 'COMPLETADO': case 'RETORNADO': return 'bg-green-500 text-white';
            case 'PENDIENTE': return 'bg-yellow-400 text-black';
            case 'EN LABORATORIO': case 'ENVIADO': return 'bg-indigo-500 text-white';
            case 'RECHAZADO': case 'CANCELADO': return 'bg-red-500 text-white';
            default: return 'bg-gray-200 text-black';
        }
    }

    verDetalle(record: CalibrationRecord): void {
        this.selectedEntry = record;
    }

    cerrarDetalle(): void {
        this.selectedEntry = null;
    }

    editarRegistro(record: CalibrationRecord): void {
        this.showMessage(`Editar: ${record.nroComprobante}`, 'info');
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }

    private registerIcons(): void {
        const icons: Record<string, string> = {
            'heroicons_outline:paper-airplane':    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>`,
            'heroicons_outline:send':              `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>`,
            'heroicons_outline:arrow-uturn-left':  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>`,
            'heroicons_outline:building-office':   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>`,
            'heroicons_outline:bell-alert':        `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" /></svg>`,
            'heroicons_outline:wrench-screwdriver':`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.654-4.654m5.292-9.645a3.75 3.75 0 1 1-1.992 7.052l-.055-.02-.008-.003a3.75 3.75 0 0 1 2.055-7.03Z" /></svg>`,
            'heroicons_outline:magnifying-glass':  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>`,
            'heroicons_outline:pencil-square':     `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>`,
            'heroicons_outline:shield-check':      `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>`,
        };
        Object.entries(icons).forEach(([name, svg]) => this.iconRegistry.addSvgIconLiteral(name, this.sanitizer.bypassSecurityTrustHtml(svg)));
    }
}
