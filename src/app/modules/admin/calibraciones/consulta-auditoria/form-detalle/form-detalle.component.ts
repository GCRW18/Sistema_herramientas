import { Component, Inject, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MaintenanceService } from '../../../../../core/services/maintenance.service';
import { AuditRow } from '../consulta-auditoria.component';

@Component({
    selector: 'app-form-detalle',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatTooltipModule,
        DragDropModule,
    ],
    templateUrl: './form-detalle.component.html',
})
export class FormDetalleComponent {

    private calibrationService = inject(CalibrationService);
    private maintenanceService = inject(MaintenanceService);
    private snackBar = inject(MatSnackBar);
    public dialogRef = inject(MatDialogRef<FormDetalleComponent>);

    // Usar inject para los datos también
    private data = inject<{ row: AuditRow }>(MAT_DIALOG_DATA);

    row: AuditRow;
    isPrinting = signal(false);

    constructor() {
        this.row = this.data.row;
    }

    getStatusClass(status: string): string {
        const classes: Record<string, string> = {
            'completed': 'bg-green-100 text-green-800 border-green-200',
            'returned': 'bg-green-100 text-green-800 border-green-200',
            'sent': 'bg-blue-100 text-blue-800 border-blue-200',
            'in_process': 'bg-amber-100 text-amber-800 border-amber-200',
            'rejected': 'bg-red-100 text-red-800 border-red-200',
            'cancelled': 'bg-gray-100 text-gray-800 border-gray-200'
        };
        return classes[status] ?? 'bg-gray-100 text-gray-700 border-gray-200';
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            'sent': 'ENVIADO',
            'in_process': 'EN PROCESO',
            'completed': 'COMPLETADO',
            'returned': 'RETORNADO',
            'rejected': 'RECHAZADO',
            'cancelled': 'CANCELADO'
        };
        return labels[status] ?? status.toUpperCase();
    }

    getTipoLabel(tipo: string): string {
        return tipo === 'calibracion' ? 'CALIBRACIÓN' : 'MANTENIMIENTO';
    }

    formatDate(dateStr: string): string {
        if (!dateStr || dateStr === '—') return '—';
        try {
            return new Date(dateStr).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return dateStr; }
    }

    get currentUser(): string {
        try { const a = JSON.parse(localStorage.getItem('aut') || '{}'); return a.nombre_usuario || 'BOA'; } catch { return 'BOA'; }
    }

    // ===================================================================
    // MÉTODOS DE IMPRESIÓN CON PDF DEL BACKEND
    // ===================================================================

    /**
     * Imprime el detalle usando PDF del backend cuando sea posible
     * Prioriza PDF del backend, si no usa fallback HTML
     */
    imprimirDetalle(): void {
        if (!this.row.id || this.row.id === 0) {
            this.imprimirDetalleFallback();
            return;
        }

        this.isPrinting.set(true);

        if (this.row.tipo_registro === 'calibracion') {
            // Para calibración, usar PDF del backend
            this.calibrationService.generarYVerPdfEnvio(this.row.id);
            setTimeout(() => {
                this.isPrinting.set(false);
            }, 1500);
        } else if (this.row.tipo_registro === 'mantenimiento') {
            this.maintenanceService.generarYVerPdfEnvioMantenimiento(this.row.id);
            setTimeout(() => {
                this.isPrinting.set(false);
            }, 1500);
        } else {
            this.imprimirDetalleFallback();
            this.isPrinting.set(false);
        }
    }

    /**
     * Imprime el certificado de calibración (si está disponible)
     */
    imprimirCertificado(): void {
        if (!this.row.id || this.row.id === 0) {
            this.snackBar.open('No se puede imprimir el certificado', 'Cerrar', { duration: 3000 });
            return;
        }

        if (this.row.tipo_registro !== 'calibracion') {
            this.snackBar.open('Solo calibraciones tienen certificado', 'Cerrar', { duration: 3000 });
            return;
        }

        if (!this.row.certificate_number) {
            this.snackBar.open('Esta calibración no tiene certificado registrado', 'warning', { duration: 3000 });
            return;
        }

        this.isPrinting.set(true);
        this.calibrationService.generarYVerPdfRetorno(this.row.id);

        setTimeout(() => {
            this.isPrinting.set(false);
        }, 1500);
    }

    /**
     * Fallback: Imprime el detalle usando HTML (cuando el backend no está listo o no hay ID)
     */
    imprimirDetalleFallback(): void {
        this.isPrinting.set(true);

        const today = new Date().toLocaleDateString('es-BO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const color = this.row.tipo_registro === 'calibracion' ? '#0F172AFF' : '#ea580c';
        const tipoLabel = this.getTipoLabel(this.row.tipo_registro);

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Detalle ${this.row.record_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border:3px solid black;padding:12px;margin-bottom:14px;border-radius:6px}
.title{font-size:16px;font-weight:900;text-transform:uppercase;color:${color}}
.record{font-size:20px;font-weight:900;color:${color};border:2px solid ${color};padding:5px 12px;border-radius:6px}
.section{border:2px solid #e2e8f0;border-radius:6px;margin-bottom:12px;overflow:hidden}
.section-head{background:#0F172AFF;color:white;padding:6px 10px;font-size:9px;font-weight:900;text-transform:uppercase}
.section-body{padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.field .label{font-size:8px;font-weight:900;text-transform:uppercase;color:#666;display:block;margin-bottom:2px}
.field .value{font-size:12px;font-weight:900}
.cert{font-size:14px;color:#16a34a;font-weight:900}
.barcode{font-family:monospace;font-size:20px;letter-spacing:3px;text-align:center;padding:6px;border:1px dashed #ccc;border-radius:3px;margin-top:10px}
.footer{display:flex;justify-content:space-between;margin-top:16px;padding-top:12px;border-top:2px solid black}
.sign-line{border-top:2px solid black;margin-top:28px;padding-top:4px;text-align:center;font-size:9px;color:#555;font-weight:700;width:180px}
.meta{margin-top:12px;font-size:8px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between}
</style></head><body>
<div class="header">
    <div>
        <div class="title">FICHA DE ${tipoLabel}</div>
        <div style="font-size:9px;color:#555;margin-top:3px">BOA — Boliviana de Aviación | Sistema de Gestión Técnica</div>
        <div style="font-size:9px;color:#888;margin-top:2px">Emitido: ${today}</div>
    </div>
    <div class="record">${this.row.record_number}</div>
</div>
<div class="section">
    <div class="section-head">Datos de la Herramienta</div>
    <div class="section-body">
        <div class="field"><span class="label">Código BOA</span><span class="value">${this.row.tool_code}</span></div>
        <div class="field"><span class="label">N° Serie</span><span class="value">${this.row.tool_serial || '—'}</span></div>
        <div class="field" style="grid-column:1/-1"><span class="label">Descripción</span><span class="value" style="font-size:11px">${this.row.tool_name}</span></div>
        <div class="field"><span class="label">Empresa / Laboratorio</span><span class="value">${this.row.provider}</span></div>
    </div>
</div>
<div class="section">
    <div class="section-head">Datos del Servicio</div>
    <div class="section-body">
        <div class="field"><span class="label">Fecha Envío</span><span class="value">${this.formatDate(this.row.send_date)}</span></div>
        <div class="field"><span class="label">Fecha Retorno</span><span class="value">${this.row.return_date ? this.formatDate(this.row.return_date) : '—'}</span></div>
        <div class="field"><span class="label">Tipo de Servicio</span><span class="value">${this.row.type || '—'}</span></div>
        <div class="field"><span class="label">Estado</span><span class="value" style="color:${this.row.status === 'completed' || this.row.status === 'returned' ? '#16a34a' : '#d97706'}">${this.getStatusLabel(this.row.status)}</span></div>
        ${this.row.certificate_number ? `<div class="field"><span class="label">N° Certificado</span><span class="value cert">${this.row.certificate_number}</span></div>` : ''}
        ${this.row.next_calibration_date ? `<div class="field"><span class="label">Próxima Calibración</span><span class="value">${this.formatDate(this.row.next_calibration_date)}</span></div>` : ''}
        ${this.row.cost > 0 ? `<div class="field"><span class="label">Costo</span><span class="value">$${this.row.cost.toFixed(2)}</span></div>` : ''}
    </div>
    ${this.row.notes ? `<div class="section-body" style="grid-column:1/-1;border-top:1px solid #e2e8f0;margin-top:4px;padding-top:8px"><div class="field"><span class="label">Observaciones</span><div class="value" style="font-size:10px;font-weight:normal">${this.row.notes}</div></div></div>` : ''}
    ${this.row.result ? `<div class="section-body"><div class="field" style="grid-column:1/-1"><span class="label">Resultado</span><div class="value" style="font-size:10px;font-weight:normal">${this.row.result}</div></div></div>` : ''}
</div>
<div class="barcode">||||| ||| ||||| ||| |||||</div>
<div style="text-align:center;font-size:9px;color:#666;margin-top:2px;font-weight:900">* BOA-${this.row.tool_code} *</div>
<div class="footer">
    <div class="sign-line">Responsable de Herramientas</div>
    <div class="sign-line">Jefe de Mantenimiento</div>
</div>
<div class="meta">
    <span>📄 Generado por: ${this.currentUser}</span>
    <span>✍️ Firma y sello: ____________________</span>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`;

        const w = window.open('', '_blank', 'width=820,height=700');
        if (w) {
            w.document.write(html);
            w.document.close();
            setTimeout(() => this.isPrinting.set(false), 1000);
        } else {
            this.snackBar.open('No se pudo abrir la ventana de impresión', 'Cerrar', { duration: 3000 });
            this.isPrinting.set(false);
        }
    }

    cerrar(): void {
        this.dialogRef.close();
    }
}
