import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef, Type, Injector, TrackByFunction, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
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
            svgIcon: 'heroicons_outline:send',
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
            type: 4, label: 'SERVICIOS', sublabel: 'GATAS (JACKS)',
            color: '#FF6A00', textColor: '#fff',
            svgIcon: 'heroicons_outline:cog-6-tooth',
            loader: async () => (await import('./servicios-gatas/servicios-gatas.component')).ServiciosGatasComponent
        },
        {
            type: 5, label: 'CENTRO DE', sublabel: 'CONTROL',
            color: '#e94125', textColor: '#fff',
            svgIcon: 'heroicons_outline:chart-bell',
            loader: async () => (await import('./dashboard-alertas/dashboard-alertas.component')).DashboardAlertasComponent
        },
        {
            type: 7, label: 'LOTES DE', sublabel: 'CALIBRACIÓN',
            color: '#0891b2', textColor: '#fff',
            svgIcon: 'heroicons_outline:inbox-stack',
            loader: async () => (await import('./lotes-calibracion/lotes-calibracion.component')).LotesCalibracionComponent
        },
    ];

    alertCount = 0;
    isLoading  = false;

    // ── Paginación Manual ─────────────────────────────────────────────────────
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

    // ── Lógica de Paginación Nativa ───────────────────────────────────────────
    get totalPages(): number { return Math.ceil(this.totalRecords / this.pageSize) || 1; }
    get startIndex(): number { return this.totalRecords === 0 ? 0 : (this.pageIndex * this.pageSize) + 1; }
    get endIndex(): number { return Math.min((this.pageIndex + 1) * this.pageSize, this.totalRecords); }

    nextPage(): void {
        if (this.pageIndex < this.totalPages - 1) {
            this.pageIndex++;
            this.loadRecentCalibrations();
        }
    }

    prevPage(): void {
        if (this.pageIndex > 0) {
            this.pageIndex--;
            this.loadRecentCalibrations();
        }
    }

    onPageSizeChange(): void {
        this.pageIndex = 0;
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
        this.showMessage(`Ver detalle: ${record.nroComprobante}`, 'info');
    }

    editarRegistro(record: CalibrationRecord): void {
        this.showMessage(`Editar: ${record.nroComprobante}`, 'info');
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }

    private registerIcons(): void {
        const icons: Record<string, string> = {
            'heroicons_outline:send':              `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>`,
            'heroicons_outline:arrow-uturn-left':  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>`,
            'heroicons_outline:building-office':   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>`,
            'heroicons_outline:cog-6-tooth':       `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`,
            'heroicons_outline:bell-alert':        `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" /></svg>`,
            'heroicons_outline:chart-bell':        `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v4.5" /><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.375A4.125 4.125 0 0 1 21 10.125v.375a6.75 6.75 0 0 1-1.734 4.516c1.3.48 2.67.815 4.234.983m-5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>`,
            'heroicons_outline:inbox-stack':       `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m7.875 14.25 1.214 1.942a2.25 2.25 0 0 0 1.908 1.058h2.006c.776 0 1.497-.4 1.908-1.058l1.214-1.942M2.41 9h4.636a2.25 2.25 0 0 1 1.872 1.002l.164.246a2.25 2.25 0 0 0 1.872 1.002h2.092a2.25 2.25 0 0 0 1.872-1.002l.164-.246A2.25 2.25 0 0 1 16.954 9h4.636M2.41 9a2.25 2.25 0 0 0-.16.832V12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 12V9.832c0-.287-.055-.57-.16-.832M2.41 9a2.25 2.25 0 0 1 .382-.632l3.285-3.832a2.25 2.25 0 0 1 1.708-.786h8.43c.657 0 1.281.287 1.709.786l3.284 3.832c.163.19.291.404.382.632M4.5 20.25h15A2.25 2.25 0 0 0 21.75 18v-2.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125V18a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>`,
            'heroicons_outline:wrench-screwdriver':`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.654-4.654m5.292-9.645a3.75 3.75 0 1 1-1.992 7.052l-.055-.02-.008-.003a3.75 3.75 0 0 1 2.055-7.03Z" /></svg>`,
            'heroicons_outline:magnifying-glass':  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>`,
        };
        Object.entries(icons).forEach(([name, svg]) => this.iconRegistry.addSvgIconLiteral(name, this.sanitizer.bypassSecurityTrustHtml(svg)));
    }
}
