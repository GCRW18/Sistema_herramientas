import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef, signal, Type, Injector } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { DomSanitizer } from '@angular/platform-browser';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { takeUntil, finalize } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { CalibrationService } from '../../../core/services/calibration.service';
import { MovementService } from '../../../core/services/movement.service';

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
    templateUrl: './calibraciones.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

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

        .neo-card-base-cal {
            border: 2px solid black !important;
            box-shadow: 4px 4px 0px 0px rgba(0,0,0,1) !important;
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base-cal {
            background-color: #1e293b !important;
        }

        .spinner-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
        }

        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }

        .custom-scrollbar-cal::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-cal::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-cal::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar-cal::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class CalibracionesComponent implements OnInit, OnDestroy {
    private dialog             = inject(MatDialog);
    private snackBar           = inject(MatSnackBar);
    private calibrationService = inject(CalibrationService);
    private movementService    = inject(MovementService);
    private injector           = inject(Injector);
    private iconRegistry       = inject(MatIconRegistry);
    private sanitizer          = inject(DomSanitizer);

    private _unsubscribeAll = new Subject<void>();

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild('calibracionesRecientesDialog') calibracionesRecientesDialog!: TemplateRef<any>;

    // Formulario activo inline
    activeFormComponent = signal<Type<any> | null>(null);
    activeFormTab       = signal<number | null>(null);
    formInjector: Injector | null = null;

    alertCount = 0;
    isLoading  = false;

    totalRecords    = 0;
    pageSize        = 10;
    pageIndex       = 0;
    pageSizeOptions = [5, 10, 25, 50];

    displayedColumns: string[] = ['fecha', 'tipo', 'nroComprobante', 'estado', 'responsable', 'acciones'];
    recentCalibrations: CalibrationRecord[] = [];

    constructor() {
        this.registerIcons();
    }

    ngOnInit(): void {
        this.loadAlertCount();
        this.loadRecentCalibrations();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // ── Inline form helpers ──────────────────────────────────────────────────

    private createFormInjector(): Injector {
        const self = this;
        const fakeRef = {
            close:            (result?: any) => { self.closeActiveForm(); },
            afterClosed:      () => of(null),
            beforeClosed:     () => of(null),
            backdropClick:    () => of(null),
            keydownEvents:    () => of(null),
            updatePosition:   () => {},
            updateSize:       () => {},
            addPanelClass:    () => {},
            removePanelClass: () => {},
            disableClose: false,
            id: 'inline-form',
            componentInstance: null,
        };
        return Injector.create({
            providers: [{ provide: MatDialogRef, useValue: fakeRef }],
            parent: this.injector
        });
    }

    closeActiveForm(): void {
        this.activeFormComponent.set(null);
        this.activeFormTab.set(null);
        this.formInjector = null;
        this.loadRecentCalibrations();
    }

    // ── Form openers (inline) ────────────────────────────────────────────────

    async openEnvioCalibracion(): Promise<void> {
        const { EnvioCalibracionComponent } = await import('./envio-calibracion/envio-calibracion.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(EnvioCalibracionComponent);
        this.activeFormTab.set(1);
    }

    async openRetornoCalibracion(): Promise<void> {
        const { RetornoCalibracionComponent } = await import('./retorno-calibracion/retorno-calibracion.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(RetornoCalibracionComponent);
        this.activeFormTab.set(2);
    }

    async openLaboratorios(): Promise<void> {
        const { LaboratoriosComponent } = await import('./laboratorios/laboratorios.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(LaboratoriosComponent);
        this.activeFormTab.set(3);
    }

    async openServiciosGatas(): Promise<void> {
        const { ServiciosGatasComponent } = await import('./servicios-gatas/servicios-gatas.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(ServiciosGatasComponent);
        this.activeFormTab.set(4);
    }

    async openReportes(): Promise<void> {
        const { ReportesCalibracionComponent } = await import('./reportes/reportes-calibracion.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(ReportesCalibracionComponent);
        this.activeFormTab.set(5);
    }

    async openAlertas(): Promise<void> {
        const { CalibracionesAlertasComponent } = await import('./alertas/calibraciones-alertas.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(CalibracionesAlertasComponent);
        this.activeFormTab.set(6);
    }

    async openLotesCalibracion(): Promise<void> {
        const { LotesCalibracionComponent } = await import('./lotes-calibracion/lotes-calibracion.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(LotesCalibracionComponent);
        this.activeFormTab.set(7);
    }

    // ── Calibraciones recientes (sigue como dialog) ──────────────────────────

    openCalibracionesRecientes(): void {
        this.loadRecentCalibrations();
        this.dialog.open(this.calibracionesRecientesDialog, {
            width: '1100px',
            maxWidth: '95vw',
            height: '85vh',
            maxHeight: '90vh',
            panelClass: 'neo-dialog-calibraciones',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });
    }

    // ── Datos ─────────────────────────────────────────────────────────────────

    private loadAlertCount(): void {
        this.calibrationService.getCalibrationAlertsPxp({ start: 0, limit: 1 }).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (res: any) => { this.alertCount = res?.total || res?.length || 0; },
            error: ()        => { this.alertCount = 0; }
        });
    }

    loadRecentCalibrations(): void {
        this.isLoading = true;
        this.movementService.getHistorialMovimientos({
            movement_type: 'calibration',
            page: this.pageIndex + 1,
            limit: this.pageSize
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (response) => {
                if (response.data && response.data.length > 0) {
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
                    this.loadMockData();
                }
            },
            error: () => this.loadMockData()
        });
    }

    private loadMockData(): void {
        this.recentCalibrations = [
            { id: '1', fecha: '10/02/2026', tipo: 'ENVIO A CALIBRACION',  estado: 'EN LABORATORIO', responsable: 'GABRIEL CRUZ',    nroComprobante: 'EC-0012/2026' },
            { id: '2', fecha: '08/02/2026', tipo: 'RETORNO CALIBRACION',  estado: 'COMPLETADO',     responsable: 'MARIA LOPEZ',      nroComprobante: 'EC-0011/2026' },
            { id: '3', fecha: '05/02/2026', tipo: 'ENVIO LOTE',           estado: 'ENVIADO',        responsable: 'CARLOS RODRIGUEZ', nroComprobante: 'LC-0004/2026' },
            { id: '4', fecha: '01/02/2026', tipo: 'RETORNO CALIBRACION',  estado: 'COMPLETADO',     responsable: 'ANA MARTINEZ',     nroComprobante: 'EC-0010/2026' },
            { id: '5', fecha: '28/01/2026', tipo: 'SERVICIO GATA',        estado: 'COMPLETADO',     responsable: 'PEDRO SANCHEZ',    nroComprobante: 'SG-0003/2026' }
        ];
        this.totalRecords = 25;
    }

    private formatDate(date: string): string {
        if (!date) return '-';
        try { return new Date(date).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
        catch { return date; }
    }

    private mapCalType(type: string): string {
        const map: Record<string, string> = {
            send: 'ENVIO A CALIBRACION', return: 'RETORNO CALIBRACION',
            batch: 'ENVIO LOTE', jack_service: 'SERVICIO GATA'
        };
        return map[type] || type?.toUpperCase() || 'N/A';
    }

    private mapStatus(status: string): string {
        const map: Record<string, string> = {
            sent: 'EN LABORATORIO', completed: 'COMPLETADO', returned: 'RETORNADO',
            pending: 'PENDIENTE', rejected: 'RECHAZADO', cancelled: 'CANCELADO'
        };
        return map[status] || status?.toUpperCase() || 'N/A';
    }

    getStatusClass(estado: string): string {
        switch (estado) {
            case 'COMPLETADO': case 'RETORNADO':   return 'bg-[#177f0f] text-black';
            case 'PENDIENTE':                       return 'bg-[#F8B400FF] text-black';
            case 'EN LABORATORIO': case 'ENVIADO':  return 'bg-[#1A3EDCFF] text-white';
            case 'RECHAZADO': case 'CANCELADO':     return 'bg-red-800 text-white';
            default:                                return 'bg-gray-100 text-gray-800';
        }
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize  = event.pageSize;
        this.loadRecentCalibrations();
    }

    verDetalle(record: CalibrationRecord): void   { this.showMessage(`Ver detalle: ${record.nroComprobante}`, 'info'); }
    editarRegistro(record: CalibrationRecord): void { this.showMessage(`Editar: ${record.nroComprobante}`, 'info'); }

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
            'heroicons_outline:send':              `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>`,
            'heroicons_outline:arrow-uturn-left':  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>`,
            'heroicons_outline:building-office':   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>`,
            'heroicons_outline:cog-6-tooth':       `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`,
            'heroicons_outline:document-chart-bar':`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>`,
            'heroicons_outline:bell-alert':        `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" /></svg>`,
            'heroicons_outline:inbox-stack':       `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m7.875 14.25 1.214 1.942a2.25 2.25 0 0 0 1.908 1.058h2.006c.776 0 1.497-.4 1.908-1.058l1.214-1.942M2.41 9h4.636a2.25 2.25 0 0 1 1.872 1.002l.164.246a2.25 2.25 0 0 0 1.872 1.002h2.092a2.25 2.25 0 0 0 1.872-1.002l.164-.246A2.25 2.25 0 0 1 16.954 9h4.636M2.41 9a2.25 2.25 0 0 0-.16.832V12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 12V9.832c0-.287-.055-.57-.16-.832M2.41 9a2.25 2.25 0 0 1 .382-.632l3.285-3.832a2.25 2.25 0 0 1 1.708-.786h8.43c.657 0 1.281.287 1.709.786l3.284 3.832c.163.19.291.404.382.632M4.5 20.25h15A2.25 2.25 0 0 0 21.75 18v-2.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125V18a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>`,
        };
        Object.entries(icons).forEach(([name, svg]) => {
            this.iconRegistry.addSvgIconLiteral(name, this.sanitizer.bypassSecurityTrustHtml(svg));
        });
    }
}
