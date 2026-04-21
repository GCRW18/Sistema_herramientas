import { Component, OnInit, OnDestroy, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil, finalize, catchError } from 'rxjs/operators';
import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MaintenanceService } from '../../../../../core/services/maintenance.service';

interface MaintenanceData {
    id_maintenance: number;
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

    // Datos recibidos del modal - usando @Inject en el constructor
    constructor(@Inject(MAT_DIALOG_DATA) public data: { mode: Mode; maintenance?: MaintenanceData }) {
        // Inicializar fechas
        const today = this.getTodayStr();
        this.requestDateStr = today;
        this.sendDateStr = today;
        this.expectedReturnDateStr = this.formatDate(this.addDays(new Date(), 7));
        this.actualReturnDateStr = today;

        // Establecer modo y mantenimiento desde los datos inyectados
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
    isGeneratingNota = signal(false);
    scannedTool: any = null;
    generatedNota = signal<string | null>(null);
    providers: Proveedor[] = [];

    // Búsqueda
    barcodeValue = '';
    searchMethod: 'manual' | 'scan' = 'manual';

    // Helper functions
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
    maintenanceType = 'PREVENTIVO';
    problem = '';
    base = '';
    cantidad = 1;
    requestDateStr: string;
    sendDateStr: string;
    expectedReturnDateStr: string;
    sendCost: number | null = null;
    sendNotes = '';

    // ============================================
    // RETORNO FIELDS
    // ============================================
    actualReturnDateStr: string;
    tipoMantenimientoRealizado = '';
    descripcionTrabajo = '';
    pruebaFuncionamiento = false;
    nextMaintenanceDateStr = '';
    tipoProxMantenimiento = 'SEMESTRAL';
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
                this.generatedNota() &&
                this.selectedProviderId &&
                this.cantidad >= 1
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
    scanTool(): void {
        const barcode = this.barcodeValue.trim();
        if (!barcode) {
            this.showMessage('Ingrese un código de barras o código BOA', 'warning');
            return;
        }
        this.isScanning.set(true);
        this.scannedTool = null;
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
        this.barcodeValue = '';
        this.generatedNota.set(null);
    }

    // ============================================
    // ENVÍO METHODS
    // ============================================
    onProviderChange(id: number): void {
        const p = this.providers.find(p => p.id_laboratory === id);
        this.selectedProviderName = p?.name || '';
    }

    generarNota(): void {
        if (!this.scannedTool) {
            this.showMessage('Identifique una herramienta primero', 'warning');
            return;
        }
        this.isGeneratingNota.set(true);
        this.calibrationService.getNextRecordNumber('EM').pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isGeneratingNota.set(false)),
        ).subscribe({
            next: (nota) => {
                this.generatedNota.set(nota);
                this.showMessage(`N° de Nota generado: ${nota}`, 'success');
            },
            error: () => this.showMessage('Error al generar el número de nota', 'error'),
        });
    }

    submitEnvio(): void {
        if (!this.canSubmit()) {
            this.showMessage('Complete todos los campos requeridos', 'error');
            return;
        }
        this.isSaving.set(true);

        const params: any = {
            tool_id: this.scannedTool.id_tool,
            type: this.maintenanceType,
            record_number: this.generatedNota(),
            request_date: this.requestDateStr,
            send_date: this.sendDateStr,
            expected_return_date: this.expectedReturnDateStr,
            problem: this.problem || '',
            notes: this.sendNotes || '',
            cantidad: this.cantidad
        };
        if (this.selectedProviderId) {
            const p = this.providers.find(p => p.id_laboratory === this.selectedProviderId);
            params.provider = p?.name || '';
            params.provider_contact = p?.contact_person || '';
        }
        if (this.sendCost) params.cost = this.sendCost;
        if (this.base) params.base = this.base;

        this.maintenanceService.sendMaintenancePxp(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: (result) => {
                this.showMessage('Envío registrado exitosamente', 'success');
                setTimeout(() => {
                    this.dialogRef.close(true);
                }, 500);
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
        switch (this.tipoMantenimientoRealizado) {
            case 'SEMESTRAL':
            case 'PREVENTIVO':
                base.setMonth(base.getMonth() + 6);
                this.nextMaintenanceDateStr = base.toISOString().split('T')[0];
                this.tipoProxMantenimiento = 'SEMESTRAL';
                break;
            case 'ANUAL':
                base.setFullYear(base.getFullYear() + 1);
                this.nextMaintenanceDateStr = base.toISOString().split('T')[0];
                this.tipoProxMantenimiento = 'ANUAL';
                break;
            case 'CORRECTIVO':
                this.nextMaintenanceDateStr = '';
                break;
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
            id_maintenance: this.maintenance!.id_maintenance,
            tool_id: this.maintenance!.tool_code,
            actual_return_date: this.actualReturnDateStr,
            tipo_mantenimiento_realizado: this.tipoMantenimientoRealizado,
            descripcion_trabajo: this.descripcionTrabajo.trim(),
            prueba_funcionamiento: this.pruebaFuncionamiento,
            observaciones: this.observacionesRetorno || ''
        };
        if (this.nextMaintenanceDateStr) params.next_maintenance_date = this.nextMaintenanceDateStr;
        if (this.tipoProxMantenimiento) params.tipo_proximo_mantenimiento = this.tipoProxMantenimiento;

        this.maintenanceService.returnMaintenancePxp(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: () => {
                this.showMessage('Retorno de mantenimiento procesado exitosamente', 'success');
                setTimeout(() => {
                    this.dialogRef.close(true);
                }, 500);
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

    /**
     * Imprime la Nota de Envío a Mantenimiento
     * @param maintenanceData - Datos del mantenimiento (opcional, si no usa el actual)
     */
    printNota(maintenanceData?: MaintenanceData): void {
        const mnt = maintenanceData || this.maintenance;
        if (!mnt || !mnt.id_maintenance) {
            this.showMessage('No se puede imprimir: ID de mantenimiento no válido', 'error');
            return;
        }

        // Mostrar loading
        this.isSaving.set(true);

        // TODO: Cuando el backend tenga el método para mantenimiento
        // this.maintenanceService.generarYVerPdfEnvioMantenimiento(mnt.id_maintenance);

        // Por ahora, usar fallback HTML
        this.printNotaFallback(mnt);

        setTimeout(() => {
            this.isSaving.set(false);
        }, 1500);
    }

    /**
     * Imprime el Certificado de Retorno de Mantenimiento
     */
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

        // TODO: Cuando el backend tenga el método para mantenimiento
        // this.maintenanceService.generarYVerPdfRetornoMantenimiento(mnt.id_maintenance);

        // Por ahora, usar fallback HTML
        this.printCertificadoFallback(mnt);

        setTimeout(() => {
            this.isSaving.set(false);
        }, 1500);
    }

    /**
     * Descarga la Nota de Envío a Mantenimiento como PDF
     */
    descargarNotaPdf(maintenanceData?: MaintenanceData): void {
        const mnt = maintenanceData || this.maintenance;
        if (!mnt || !mnt.id_maintenance) {
            this.showMessage('ID de mantenimiento no válido', 'error');
            return;
        }

        this.isSaving.set(true);

        // TODO: Implementar cuando el backend tenga el endpoint
        this.showMessage('Funcionalidad en desarrollo - Próximamente disponible', 'warning');

        setTimeout(() => {
            this.isSaving.set(false);
        }, 1500);
    }

    /**
     * Descarga el Certificado de Retorno de Mantenimiento como PDF
     */
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

        // TODO: Implementar cuando el backend tenga el endpoint
        this.showMessage('Funcionalidad en desarrollo - Próximamente disponible', 'warning');

        setTimeout(() => {
            this.isSaving.set(false);
        }, 1500);
    }

    /**
     * Fallback: Imprime nota usando HTML (cuando el backend no está listo)
     */
    private printNotaFallback(mnt: MaintenanceData): void {
        const today = new Date().toLocaleDateString('es-BO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });

        const html = this.generatePrintHtml(mnt, today);
        const w = window.open('', '_blank', 'width=900,height=750');
        if (w) {
            w.document.write(html);
            w.document.close();
        } else {
            this.showMessage('No se pudo abrir la ventana de impresión', 'warning');
        }
    }

    /**
     * Fallback: Imprime certificado usando HTML
     */
    private printCertificadoFallback(mnt: MaintenanceData): void {
        const today = new Date().toLocaleDateString('es-BO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });

        const html = this.generateCertificadoHtml(mnt, today);
        const w = window.open('', '_blank', 'width=900,height=750');
        if (w) {
            w.document.write(html);
            w.document.close();
        } else {
            this.showMessage('No se pudo abrir la ventana de impresión', 'warning');
        }
    }

    /**
     * Genera HTML para la nota de envío a mantenimiento
     */
    private generatePrintHtml(mnt: MaintenanceData, today: string): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Nota de Envío ${mnt.record_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#1e293b}
.header{border:3px solid #0f172a;padding:14px;margin-bottom:16px;background:#0f172a;color:#fff;display:flex;justify-content:space-between}
.title{font-size:16px;font-weight:900;text-transform:uppercase}
.nota{font-size:26px;font-weight:900;color:#f97316;font-family:monospace;margin:6px 0}
.subtitle{font-size:10px;opacity:.7;margin-top:4px}
.section{border:2px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:12px}
.section-title{font-size:10px;font-weight:900;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.field{margin-bottom:4px}
.label{font-weight:700;color:#64748b;font-size:9px;text-transform:uppercase}
.value{font-weight:900;font-size:12px}
.dates{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f8fafc;padding:10px;margin-top:10px;border-radius:6px}
.date-card{text-align:center}
.date-label{font-size:8px;font-weight:700;text-transform:uppercase;color:#94a3b8}
.date-val{font-size:12px;font-weight:900}
.footer{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:16px;padding-top:14px;border-top:2px solid #e2e8f0}
.sign-line{border-top:1px solid #94a3b8;margin-top:30px;padding-top:5px;text-align:center;font-size:9px}
.meta{margin-top:12px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between}
</style></head><body>
<div class="header">
    <div><div class="title">NOTA DE ENVÍO A MANTENIMIENTO</div><div class="nota">${mnt.record_number}</div><div class="subtitle">Sistema de Gestión Técnica · BOA</div></div>
    <div style="text-align:right"><div>${today}</div><div style="font-size:14px;font-weight:900;margin-top:4px">${mnt.tool_code}</div></div>
</div>
<div class="section">
    <div class="section-title">Datos de la Herramienta</div>
    <div class="grid">
        <div><div class="label">Código BOA</div><div class="value">${mnt.tool_code}</div></div>
        <div><div class="label">N° Serie</div><div class="value">${mnt.tool_serial || '—'}</div></div>
        <div style="grid-column:1/-1"><div class="label">Nombre</div><div class="value">${mnt.tool_name}</div></div>
    </div>
</div>
<div class="section">
    <div class="section-title">Datos del Envío</div>
    <div class="grid">
        <div><div class="label">Empresa / Taller</div><div class="value">${mnt.provider}</div></div>
        <div><div class="label">Tipo Servicio</div><div class="value">${mnt.type || this.maintenanceType}</div></div>
        <div><div class="label">Base Origen</div><div class="value">${mnt.base || this.base || '—'}</div></div>
        <div><div class="label">Costo Estimado</div><div class="value">$${(mnt.cost || this.sendCost || 0).toFixed(2)}</div></div>
    </div>
    <div class="dates">
        <div class="date-card"><div class="date-label">Envío</div><div class="date-val">${mnt.send_date || this.sendDateStr}</div></div>
        <div class="date-card"><div class="date-label">Retorno Est.</div><div class="date-val">${mnt.expected_return_date || this.expectedReturnDateStr || '—'}</div></div>
        <div class="date-card"><div class="date-label">Estado</div><div class="date-val">${mnt.status === 'returned' ? 'COMPLETADO' : 'EN TALLER'}</div></div>
    </div>
    ${(mnt.notes || this.problem) ? `<div style="margin-top:8px"><div class="label">Problema / Notas</div><div class="value">${mnt.notes || this.problem}</div></div>` : ''}
</div>
<div class="footer">
    <div><div class="sign-line">Técnico emisor</div></div>
    <div><div class="sign-line">Jefe de almacén</div></div>
    <div><div class="sign-line">Recibido por taller</div></div>
</div>
<div class="meta"><span>BOA — MGH-109 · ${mnt.record_number}</span><span>${today}</span></div>
<script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
</body></html>`;
    }

    /**
     * Genera HTML para el certificado de retorno de mantenimiento
     */
    private generateCertificadoHtml(mnt: MaintenanceData, today: string): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Certificado Retorno ${mnt.record_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#1e293b}
.header{border:3px solid #0f172a;padding:14px;margin-bottom:16px;background:#0f172a;color:#fff;display:flex;justify-content:space-between}
.title{font-size:16px;font-weight:900;text-transform:uppercase}
.nota{font-size:26px;font-weight:900;color:#f97316;font-family:monospace;margin:6px 0}
.section{border:2px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:12px}
.section-title{font-size:10px;font-weight:900;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.field{margin-bottom:4px}
.label{font-weight:700;color:#64748b;font-size:9px;text-transform:uppercase}
.value{font-weight:900;font-size:12px}
.result-box{text-align:center;padding:15px;background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;margin:12px 0}
.result-approved{font-size:18px;font-weight:900;color:#16a34a}
.result-conditional{font-size:18px;font-weight:900;color:#f59e0b}
.result-rejected{font-size:18px;font-weight:900;color:#dc2626}
.footer{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:16px;padding-top:14px;border-top:2px solid #e2e8f0}
.sign-line{border-top:1px solid #94a3b8;margin-top:30px;padding-top:5px;text-align:center;font-size:9px}
.meta{margin-top:12px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between}
</style></head><body>
<div class="header">
    <div><div class="title">CERTIFICADO DE RETORNO - MANTENIMIENTO</div><div class="nota">${mnt.record_number}</div></div>
    <div style="text-align:right"><div>${today}</div><div style="font-size:14px;font-weight:900;margin-top:4px">${mnt.tool_code}</div></div>
</div>
<div class="result-box">
    <div class="result-approved">✅ TRABAJO COMPLETADO</div>
    <div style="margin-top:5px">Tipo: ${this.tipoMantenimientoRealizado || mnt.type || '—'}</div>
</div>
<div class="section">
    <div class="section-title">Datos de la Herramienta</div>
    <div class="grid">
        <div><div class="label">Código BOA</div><div class="value">${mnt.tool_code}</div></div>
        <div><div class="label">N° Serie</div><div class="value">${mnt.tool_serial || '—'}</div></div>
        <div style="grid-column:1/-1"><div class="label">Nombre</div><div class="value">${mnt.tool_name}</div></div>
    </div>
</div>
<div class="section">
    <div class="section-title">Datos del Servicio</div>
    <div class="grid">
        <div><div class="label">Taller / Empresa</div><div class="value">${mnt.provider}</div></div>
        <div><div class="label">Tipo Servicio Realizado</div><div class="value">${this.tipoMantenimientoRealizado || mnt.type || '—'}</div></div>
        <div><div class="label">Fecha Envío</div><div class="value">${mnt.send_date}</div></div>
        <div><div class="label">Fecha Retorno</div><div class="value">${this.actualReturnDateStr || mnt.expected_return_date || today}</div></div>
    </div>
    <div style="margin-top:10px">
        <div class="label">Descripción del Trabajo Realizado</div>
        <div class="value" style="margin-top:5px;padding:8px;background:#f8fafc;border-radius:4px">${this.descripcionTrabajo || '—'}</div>
    </div>
    ${this.nextMaintenanceDateStr ? `<div style="margin-top:10px"><div class="label">Próximo Mantenimiento Sugerido</div><div class="value" style="color:#f97316">${this.nextMaintenanceDateStr} (${this.tipoProxMantenimiento})</div></div>` : ''}
    ${this.observacionesRetorno ? `<div style="margin-top:10px"><div class="label">Observaciones</div><div class="value">${this.observacionesRetorno}</div></div>` : ''}
    ${this.pruebaFuncionamiento ? `<div style="margin-top:10px"><div class="label">Prueba de Funcionamiento</div><div class="value" style="color:#16a34a">✅ REALIZADA - OK</div></div>` : '<div style="margin-top:10px"><div class="label">Prueba de Funcionamiento</div><div class="value" style="color:#dc2626">❌ NO REALIZADA</div></div>'}
</div>
<div class="footer">
    <div><div class="sign-line">Técnico receptor</div></div>
    <div><div class="sign-line">Jefe de mantenimiento</div></div>
    <div><div class="sign-line">Sello del taller</div></div>
</div>
<div class="meta"><span>BOA — MGH-109 · ${mnt.record_number}</span><span>${today}</span></div>
<script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
</body></html>`;
    }
}
