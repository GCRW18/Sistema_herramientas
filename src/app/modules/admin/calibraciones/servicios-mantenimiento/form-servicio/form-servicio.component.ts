import { Component, OnInit, OnDestroy, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MaintenanceService } from '../../../../../core/services/maintenance.service';

interface MaintenanceData {
    id_maintenance: number;
    tool_id: number;
    record_number: string;
    tool_code: string;
    tool_name: string;
    tool_serial?: string;
    provider: string;
    type: string;
    status: string;
    send_date: string;
    expected_return_date: string | null;
    base: string;
    cost: number;
    notes: string;
}

interface Proveedor {
    id_laboratory: number;
    name: string;
    contact_person?: string;
}

type Mode = 'envio' | 'retorno';

@Component({
    selector: 'app-form-servicio',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    ],
    templateUrl: './form-servicio.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }

        .spinner-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }

        .invert-spinner ::ng-deep circle { stroke: white !important; }
        .neo-card-base { border: 2px solid black; border-radius: 8px; box-shadow: 3px 3px 0px 0px rgba(0,0,0,0.2); }
    `]
})
export class FormServicioComponent implements OnInit, OnDestroy {

    private calibrationService = inject(CalibrationService);
    private maintenanceService = inject(MaintenanceService);
    public dialogRef = inject(MatDialogRef<FormServicioComponent>);
    private snackBar = inject(MatSnackBar);
    private _destroy$ = new Subject<void>();
    private _toolSearch$ = new Subject<string>();

    constructor(@Inject(MAT_DIALOG_DATA) public data: { mode: Mode; maintenance?: MaintenanceData }) {
        const today = this.getTodayStr();
        this.requestDateStr = today;
        this.sendDateStr = today;
        this.expectedReturnDateStr = this.formatDate(this.addDays(new Date(), 7));
        this.actualReturnDateStr = today;

        if (data) {
            this.mode = data.mode;
            if (data.maintenance) {
                this.maintenance = data.maintenance;
            }
        }
    }

    mode: Mode = 'envio';
    maintenance: MaintenanceData | null = null;

    isSaving = signal(false);
    isScanning = signal(false);
    scannedTool: any = null;
    generatedNota = signal<string | null>(null);
    providers: Proveedor[] = [];

    // Búsqueda de herramienta
    barcodeValue     = 'BOA-H-';
    toolSuggestions: any[]  = [];
    showToolDropdown         = false;
    toolSearchLoading        = false;

    // Tipos de mantenimiento — valores en inglés para coincidir con el constraint tmaintenances_type_check
    tiposMantenimiento = [
        { value: 'preventive', label: 'Preventivo' },
        { value: 'corrective', label: 'Correctivo' },
        { value: 'predictive', label: 'Predictivo' },
        { value: 'emergency',  label: 'Emergencia' },
    ];

    private getTodayStr(): string {
        return new Date().toISOString().split('T')[0];
    }

    private addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    // ============================================
    // ENVÍO FIELDS
    // ============================================
    selectedProviderId: number | null = null;
    selectedProviderName = '';
    // FIX: valor por defecto en inglés para coincidir con tmaintenances_type_check
    maintenanceType = 'preventive';
    problem = '';
    requestDateStr: string;
    sendDateStr: string;
    expectedReturnDateStr: string;
    sendNotes = '';

    // ============================================
    // RETORNO FIELDS
    // ============================================
    actualReturnDateStr: string;
    // FIX: valor vacío; el usuario elige del selector con valores en inglés
    tipoMantenimientoRealizado = '';
    descripcionTrabajo = '';
    pruebaFuncionamiento = false;
    nextMaintenanceDateStr = '';
    tipoProxMantenimiento = 'preventive';
    observacionesRetorno = '';
    showDescError = false;

    get currentUser(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || 'BOA';
        } catch { return 'BOA'; }
    }

    // ============================================
    // COMPUTED
    // ============================================
    canSubmit(): boolean {
        if (this.mode === 'envio') {
            return !!(
                this.scannedTool &&
                this.sendDateStr &&
                this.selectedProviderId
            );
        } else {
            return !!(
                this.maintenance &&
                this.actualReturnDateStr &&
                this.tipoMantenimientoRealizado &&
                this.descripcionTrabajo.trim()
            );
        }
    }

    // ============================================
    // LIFECYCLE
    // ============================================
    ngOnInit(): void {
        this.loadProviders();
        this._setupToolSearch();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    // ============================================
    // DATA LOADING
    // ============================================
    loadProviders(): void {
        this.calibrationService.getActiveLaboratoriesPxp('mantenimiento').pipe(
            takeUntil(this._destroy$)
        ).subscribe({
            next: (labs) => this.providers = labs,
            error: () => this.showMessage('Error al cargar empresas', 'error')
        });
    }

    // ============================================
    // BÚSQUEDA DE HERRAMIENTA
    // ============================================
    private _setupToolSearch(): void {
        this._toolSearch$.pipe(
            debounceTime(350), distinctUntilChanged(),
            switchMap(term => {
                if (term.length < 2) { this.toolSuggestions = []; this.showToolDropdown = false; return of([]); }
                this.toolSearchLoading = true;
                return this.calibrationService.searchToolsAutocomplete(term).pipe(
                    finalize(() => this.toolSearchLoading = false)
                );
            }),
            takeUntil(this._destroy$)
        ).subscribe(results => {
            this.toolSuggestions = results || [];
            this.showToolDropdown = this.toolSuggestions.length > 0;
        });
    }

    onToolInput(value: string): void { this._toolSearch$.next(value.trim()); }

    selectToolSuggestion(tool: any): void {
        this.barcodeValue = tool.code ?? tool.tool_code;
        this.showToolDropdown = false;
        this.toolSuggestions = [];
        setTimeout(() => this.scanTool(), 50);
    }

    hideToolDropdown(): void { setTimeout(() => this.showToolDropdown = false, 180); }

    scanTool(): void {
        const barcode = this.barcodeValue.trim();
        if (!barcode) {
            this.showMessage('Ingrese un código de barras o código BOA', 'warning');
            return;
        }
        this.isScanning.set(true);
        this.scannedTool = null;
        this.generatedNota.set(null);
        this.calibrationService.scanToolForCalibration(barcode).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isScanning.set(false))
        ).subscribe({
            next: (result) => {
                if (!result) {
                    this.showMessage('Herramienta no encontrada', 'error');
                    return;
                }
                this.scannedTool = result;
            },
            error: () => this.showMessage('Error al buscar la herramienta', 'error')
        });
    }

    clearScan(): void {
        this.scannedTool = null;
        this.barcodeValue = 'BOA-H-';
        this.generatedNota.set(null);
    }

    // ============================================
    // ENVÍO METHODS
    // ============================================
    onProviderChange(id: number): void {
        const p = this.providers.find(p => p.id_laboratory === id);
        this.selectedProviderName = p?.name || '';
    }

    submitEnvio(): void {
        if (!this.canSubmit()) {
            this.showMessage('Complete todos los campos requeridos', 'error');
            return;
        }
        this.isSaving.set(true);

        const params: any = {
            tool_id:              this.scannedTool.id_tool,
            type:                 this.maintenanceType,          // ya en inglés: 'preventive' | 'corrective' | ...
            request_date:         this.requestDateStr,
            send_date:            this.sendDateStr,
            expected_return_date: this.expectedReturnDateStr,
            description:          this.problem || '',
            notes:                this.sendNotes || '',
            requested_by_name:    this.currentUser,
        };
        if (this.selectedProviderId) {
            const p = this.providers.find(p => p.id_laboratory === this.selectedProviderId);
            params.provider         = p?.name            || '';
            params.provider_contact = p?.contact_person  || '';
        }

        this.maintenanceService.sendMaintenancePxp(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: (result) => {
                const recordNum = result?.record_number ?? result?.[0]?.record_number;
                const idMaint   = result?.id_maintenance ?? result?.[0]?.id_maintenance;
                this.generatedNota.set(recordNum || null);
                this.showMessage(`Envío registrado — ${recordNum || 'OK'}`, 'success');
                if (idMaint) {
                    this.maintenanceService.generarPdfEnvioMantenimiento(idMaint).pipe(
                        takeUntil(this._destroy$)
                    ).subscribe({
                        next: (pdf) => this._abrirPdf(pdf.pdf_base64, pdf.nombre_archivo),
                        error: () => {}
                    });
                }
                setTimeout(() => this.dialogRef.close(true), 1800);
            },
            error: (err) => this.showMessage(err?.message || 'Error al registrar el envío', 'error')
        });
    }

    // ============================================
    // RETORNO METHODS
    // ============================================
    onTipoMantChange(): void {
        if (!this.actualReturnDateStr) return;
        const base = new Date(this.actualReturnDateStr + 'T00:00:00');

        // FIX: comparar con valores en inglés (tmaintenances_type_check)
        switch (this.tipoMantenimientoRealizado) {
            case 'preventive':
            case 'predictive':
                base.setMonth(base.getMonth() + 6);
                this.nextMaintenanceDateStr = base.toISOString().split('T')[0];
                this.tipoProxMantenimiento  = 'preventive';
                break;
            case 'corrective':
                this.nextMaintenanceDateStr = '';
                this.tipoProxMantenimiento  = 'corrective';
                break;
            case 'emergency':
                this.nextMaintenanceDateStr = '';
                this.tipoProxMantenimiento  = 'emergency';
                break;
            default:
                this.nextMaintenanceDateStr = '';
        }
    }

    onRetornoFechaChange(): void {
        if (this.tipoMantenimientoRealizado) this.onTipoMantChange();
    }

    submitRetorno(): void {
        if (!this.canSubmit()) {
            if (!this.descripcionTrabajo.trim()) {
                this.showDescError = true;
                this.showMessage('La descripción del trabajo es obligatoria', 'error');
            }
            return;
        }
        this.isSaving.set(true);

        const params: any = {
            id_maintenance:    this.maintenance!.id_maintenance,
            tool_id:           this.maintenance!.tool_id,
            result:            this.tipoMantenimientoRealizado,  // en inglés
            actual_return_date: this.actualReturnDateStr,
            completion_date:   this.actualReturnDateStr,
            solution:          this.descripcionTrabajo.trim(),
            recommendations:   this.pruebaFuncionamiento
                ? 'Prueba de funcionamiento: REALIZADA - OK'
                : 'Prueba de funcionamiento: NO REALIZADA',
            received_by_name:  this.currentUser,
            notes:             this.observacionesRetorno || ''
        };
        if (this.nextMaintenanceDateStr) params.next_maintenance_date = this.nextMaintenanceDateStr;

        this.maintenanceService.returnMaintenancePxp(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: () => {
                this.showMessage('Retorno de mantenimiento procesado exitosamente', 'success');
                setTimeout(() => this.dialogRef.close(true), 500);
            },
            error: (err) => this.showMessage(err?.message || 'Error al procesar el retorno', 'error')
        });
    }

    // ============================================
    // MESSAGE
    // ============================================
    private showMessage(message: string, type: 'success' | 'error' | 'warning'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 4000, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }

    // ===================================================================
    // MÉTODOS DE PDF PARA MANTENIMIENTO
    // ===================================================================

    printNota(maintenanceData?: MaintenanceData): void {
        const mnt = maintenanceData || this.maintenance;
        if (!mnt || !mnt.id_maintenance) {
            this.showMessage('No se puede imprimir: ID de mantenimiento no válido', 'error');
            return;
        }
        this.isSaving.set(true);
        this.maintenanceService.generarPdfEnvioMantenimiento(mnt.id_maintenance).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: (result) => this._abrirPdf(result.pdf_base64, result.nombre_archivo),
            error: () => this.showMessage('Error al generar la nota de envío', 'error')
        });
    }

    printCertificado(maintenanceData?: MaintenanceData): void {
        const mnt = maintenanceData || this.maintenance;
        if (!mnt || !mnt.id_maintenance) {
            this.showMessage('No se puede imprimir: ID de mantenimiento no válido', 'error');
            return;
        }
        if (mnt.status !== 'returned' && this.mode !== 'retorno') {
            this.showMessage('Este mantenimiento aún no ha sido completado', 'warning');
            return;
        }
        this.isSaving.set(true);
        this.maintenanceService.generarPdfRetornoMantenimiento(mnt.id_maintenance).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: (result) => this._abrirPdf(result.pdf_base64, result.nombre_archivo),
            error: () => this.showMessage('Error al generar el certificado de retorno', 'error')
        });
    }

    descargarNotaPdf(maintenanceData?: MaintenanceData): void {
        const mnt = maintenanceData || this.maintenance;
        if (!mnt || !mnt.id_maintenance) {
            this.showMessage('ID de mantenimiento no válido', 'error');
            return;
        }
        this.isSaving.set(true);
        this.maintenanceService.descargarPdfEnvioMantenimiento(mnt.id_maintenance).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            error: () => this.showMessage('Error al descargar la nota de envío', 'error')
        });
    }

    descargarCertificadoPdf(maintenanceData?: MaintenanceData): void {
        const mnt = maintenanceData || this.maintenance;
        if (!mnt || !mnt.id_maintenance) {
            this.showMessage('ID de mantenimiento no válido', 'error');
            return;
        }
        if (mnt.status !== 'returned' && this.mode !== 'retorno') {
            this.showMessage('Este mantenimiento aún no ha sido completado', 'warning');
            return;
        }
        this.isSaving.set(true);
        this.maintenanceService.descargarPdfRetornoMantenimiento(mnt.id_maintenance).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            error: () => this.showMessage('Error al descargar el certificado de retorno', 'error')
        });
    }

    private _abrirPdf(base64OrHtml: string, filename?: string): void {
        if (!base64OrHtml) return;

        // Si es HTML crudo, abrirlo directamente
        const trimmed = base64OrHtml.trimStart();
        if (trimmed.startsWith('<')) {
            const blob = new Blob([base64OrHtml], { type: 'text/html; charset=utf-8' });
            const url  = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => window.URL.revokeObjectURL(url), 100);
            return;
        }

        // Es base64 — decodificar con guard
        let decoded: string;
        try {
            decoded = atob(base64OrHtml);
        } catch {
            const blob = new Blob([base64OrHtml], { type: 'text/plain; charset=utf-8' });
            const url  = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => window.URL.revokeObjectURL(url), 100);
            return;
        }

        const mimeType = decoded.trimStart().startsWith('<')
            ? 'text/html; charset=utf-8'
            : 'application/pdf';

        const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
        const blob  = new Blob([bytes], { type: mimeType });
        const url   = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
    }
}
