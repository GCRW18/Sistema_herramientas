import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationBatchService } from '../../../../../core/services/calibration-batch.service';
import { CalibrationBatch, CalibrationBatchItem } from '../../../../../core/models';

interface ReturnItem extends CalibrationBatchItem {
    return_result: 'approved' | 'conditional' | 'rejected';
    return_certificate: string;
    return_next_date: string;
    return_cost: number | null;
}

@Component({
    selector: 'app-retorno-lote-dialog',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatIconModule, MatButtonModule,
        MatDialogModule, MatSnackBarModule, MatFormFieldModule,
        MatInputModule, MatSelectModule, MatDatepickerModule,
        MatNativeDateModule, MatProgressSpinnerModule,
        MatTooltipModule
    ],
    templateUrl: './retorno-lote-dialog.component.html',
})
export class RetornoLoteDialogComponent implements OnInit, OnDestroy {
    private batchService = inject(CalibrationBatchService);
    private dialogRef = inject(MatDialogRef<RetornoLoteDialogComponent>);
    private snackBar = inject(MatSnackBar);
    public batch: CalibrationBatch = inject(MAT_DIALOG_DATA);
    private _unsubscribeAll = new Subject<void>();

    // Signals
    isLoading = signal(false);
    isProcessing = signal(false);

    // Computed counts
    jackCount = computed(() => this.returnItems.filter(i => i.is_jack || i.tool_is_jack).length);
    approvedCount = computed(() => this.returnItems.filter(i => i.return_result === 'approved').length);
    conditionalCount = computed(() => this.returnItems.filter(i => i.return_result === 'conditional').length);
    rejectedCount = computed(() => this.returnItems.filter(i => i.return_result === 'rejected').length);

    // State
    returnItems: ReturnItem[] = [];
    expandedItems: Record<number, boolean> = {};

    globalResult: 'approved' | 'conditional' | 'rejected' = 'approved';
    globalCertificate = '';
    returnDate: Date | null = new Date();
    totalCost: number | null = null;
    currency = 'BOB';
    observations = '';

    ngOnInit(): void {
        this.loadBatchItems();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadBatchItems(): void {
        this.isLoading.set(true);
        this.batchService.getBatchItems(this.batch.id_batch).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading.set(false))
        ).subscribe({
            next: (items) => {
                this.returnItems = items.map(item => ({
                    ...item,
                    return_result: 'approved' as const,
                    return_certificate: '',
                    return_next_date: '',
                    return_cost: null
                }));
                // Auto-expand Jack items
                items.forEach(item => {
                    if (item.is_jack || item.tool_is_jack) {
                        this.expandedItems[item.id_batch_item] = true;
                    }
                });
            },
            error: () => this.showMessage('Error al cargar items del lote', 'error')
        });
    }

    toggleExpand(item: ReturnItem): void {
        this.expandedItems[item.id_batch_item] = !this.expandedItems[item.id_batch_item];
    }

    applyGlobalResult(): void {
        this.returnItems.forEach(item => {
            item.return_result = this.globalResult;
        });
    }

    applyGlobalCertificate(): void {
        if (!this.globalCertificate) return;
        this.returnItems.forEach(item => {
            if (!item.return_certificate) {
                item.return_certificate = this.globalCertificate;
            }
        });
    }

    processReturn(): void {
        if (this.returnItems.length === 0) {
            this.showMessage('No hay items para procesar', 'warning');
            return;
        }

        this.isProcessing.set(true);

        const params: any = {
            batch_id: this.batch.id_batch,
            result: this.globalResult,
            observations: this.observations || ''
        };

        if (this.returnDate) {
            params.actual_return_date = this.formatDate(this.returnDate);
        }
        if (this.globalCertificate) {
            params.certificate_number = this.globalCertificate;
        }
        if (this.totalCost) {
            params.cost = this.totalCost;
            params.currency = this.currency;
        }

        this.batchService.processReturnBatch(params).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isProcessing.set(false))
        ).subscribe({
            next: (res) => {
                this.showMessage(res?.mensaje || 'Retorno procesado exitosamente', 'success');
                this.dialogRef.close({ success: true, action: 'returned' });
            },
            error: (err) => {
                const msg = err?.error?.mensaje || err?.message || 'Error al procesar retorno';
                this.showMessage(msg, 'error');
            }
        });
    }

    // =========================================================================
    // PDF & PRINT - Nota de Retorno de Calibracion
    // =========================================================================

    exportToPdf(): void {
        const htmlContent = this.generateNotaRetornoHTML();
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            this.showMessage('No se pudo abrir la ventana. Verifique el bloqueador de popups.', 'error');
            return;
        }
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        this.showMessage('Nota de Retorno generada. Use Ctrl+S o "Guardar como PDF" en el dialogo de impresion.', 'info');
    }

    printNotaRetorno(): void {
        const htmlContent = this.generateNotaRetornoHTML();
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            this.showMessage('No se pudo abrir la ventana de impresion', 'error');
            return;
        }
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    }

    private generateNotaRetornoHTML(): string {
        const items = this.returnItems;
        const jacks = items.filter(i => i.is_jack || i.tool_is_jack);
        const approved = items.filter(i => i.return_result === 'approved');
        const conditional = items.filter(i => i.return_result === 'conditional');
        const rejected = items.filter(i => i.return_result === 'rejected');
        const today = new Date().toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const returnDateStr = this.returnDate ? this.formatDate(this.returnDate) : today;

        const getResultLabel = (r: string) => {
            const map: Record<string, string> = { 'approved': 'APROBADO', 'conditional': 'CONDICIONAL', 'rejected': 'RECHAZADO' };
            return map[r] || r;
        };
        const getResultColor = (r: string) => {
            const map: Record<string, string> = { 'approved': '#16a34a', 'conditional': '#d97706', 'rejected': '#dc2626' };
            return map[r] || '#000';
        };
        const getResultBg = (r: string) => {
            const map: Record<string, string> = { 'approved': '#f0fdf4', 'conditional': '#fffbeb', 'rejected': '#fef2f2' };
            return map[r] || '#fff';
        };

        const rows = items.map((item, idx) => `
            <tr style="background: ${item.is_jack || item.tool_is_jack ? '#f3e8ff' : getResultBg(item.return_result)};">
                <td style="border: 2px solid #000; padding: 6px; text-align: center; font-weight: 900; font-size: 11px;">${idx + 1}</td>
                <td style="border: 2px solid #000; padding: 6px; font-weight: 900; font-size: 11px;">${item.tool_code}</td>
                <td style="border: 2px solid #000; padding: 6px; font-size: 10px;">${item.tool_name}</td>
                <td style="border: 2px solid #000; padding: 6px; text-align: center; font-size: 10px;">${item.tool_part_number || '-'}</td>
                <td style="border: 2px solid #000; padding: 6px; text-align: center; font-size: 10px;">${item.tool_serial || '-'}</td>
                <td style="border: 2px solid #000; padding: 6px; text-align: center;">
                    <strong style="color: ${getResultColor(item.return_result)}; font-size: 10px;">
                        ${getResultLabel(item.return_result)}
                    </strong>
                </td>
                <td style="border: 2px solid #000; padding: 6px; text-align: center; font-size: 10px;">${item.return_certificate || this.globalCertificate || '-'}</td>
                <td style="border: 2px solid #000; padding: 6px; text-align: center; font-size: 10px;">${item.return_next_date || '-'}</td>
                <td style="border: 2px solid #000; padding: 6px; text-align: center; font-size: 10px;">
                    ${(item.is_jack || item.tool_is_jack) ? '<strong style="color: #7e22ce;">GATA</strong>' : 'Estandar'}
                </td>
            </tr>
        `).join('');

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Nota de Retorno - ${this.batch.batch_number}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; margin: 20px; font-size: 11px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
        .logo { font-size: 32px; font-weight: 900; color: #2563eb; letter-spacing: -1px; }
        .logo-sub { font-size: 11px; color: #666; font-weight: 700; }
        .doc-code { font-size: 16px; font-weight: 900; background: #2563eb; color: white; padding: 10px 20px; border: 3px solid #000; box-shadow: 4px 4px 0px 0px #000; text-align: center; }
        .doc-date { font-size: 10px; color: #555; margin-top: 5px; text-align: right; }
        h1 { text-align: center; font-size: 18px; margin: 20px 0; text-transform: uppercase; background: #eff6ff; padding: 12px; border: 3px solid #000; box-shadow: 4px 4px 0px 0px #000; font-weight: 900; letter-spacing: 1px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px; }
        .info-box { border: 3px solid #000; padding: 12px; background: white; box-shadow: 3px 3px 0px 0px #000; }
        .info-box h3 { margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; background: #1e293b; color: #fff; padding: 6px 10px; margin: -12px -12px 12px -12px; font-weight: 900; letter-spacing: 0.5px; }
        .info-row { display: flex; margin-bottom: 4px; font-size: 11px; }
        .info-label { font-weight: 800; min-width: 130px; color: #444; }
        .info-value { flex: 1; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #1e293b; color: white; padding: 8px 6px; border: 2px solid #000; font-size: 10px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.5px; }
        .result-box { display: inline-block; padding: 4px 12px; border: 2px solid #000; font-weight: 900; font-size: 14px; text-transform: uppercase; margin-right: 5px; }
        .jack-box { background: #f3e8ff; border: 3px solid #7e22ce; padding: 12px; margin-bottom: 15px; box-shadow: 3px 3px 0px 0px #7e22ce; }
        .jack-box h3 { color: #7e22ce; font-weight: 900; font-size: 13px; margin-bottom: 8px; text-transform: uppercase; }
        .summary-box { background: #f8fafc; border: 3px solid #000; padding: 12px; box-shadow: 3px 3px 0px 0px #000; margin-bottom: 15px; }
        .stat-card { border: 2px solid #000; padding: 10px; text-align: center; box-shadow: 2px 2px 0px 0px #000; }
        .stat-number { font-size: 22px; font-weight: 900; }
        .stat-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 50px; padding-top: 20px; border-top: 3px solid #000; }
        .sig-block { text-align: center; }
        .sig-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 8px; font-weight: 700; font-size: 11px; }
        @media print {
            body { margin: 15px; }
            .info-box, .jack-box, .summary-box { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="logo">BOA</div>
            <div class="logo-sub">Boliviana de Aviacion - Sistema de Herramientas</div>
            <div class="logo-sub">Almacen de Herramientas - Retorno de Calibracion</div>
        </div>
        <div style="text-align: right;">
            <div class="doc-code">LOTE: ${this.batch.batch_number}</div>
            <div class="doc-date">Generado: ${today}</div>
        </div>
    </div>

    <h1>Nota de Retorno de Calibracion</h1>

    <div style="text-align: center; margin-bottom: 15px;">
        <span class="result-box" style="background: ${getResultBg(this.globalResult)}; color: ${getResultColor(this.globalResult)}; border-color: ${getResultColor(this.globalResult)};">
            Resultado Global: ${getResultLabel(this.globalResult)}
        </span>
    </div>

    <div class="grid-2">
        <div class="info-box">
            <h3>Datos del Retorno</h3>
            <div class="info-row"><span class="info-label">Nro. Lote:</span> <span class="info-value"><strong>${this.batch.batch_number}</strong></span></div>
            <div class="info-row"><span class="info-label">Fecha Retorno:</span> <span class="info-value"><strong>${returnDateStr}</strong></span></div>
            <div class="info-row"><span class="info-label">Fecha Envio:</span> <span class="info-value">${this.batch.send_date || '-'}</span></div>
            <div class="info-row"><span class="info-label">Retorno Esperado:</span> <span class="info-value">${this.batch.expected_return_date || 'No especificada'}</span></div>
            <div class="info-row"><span class="info-label">Orden Servicio:</span> <span class="info-value">${this.batch.service_order || '-'}</span></div>
            <div class="info-row"><span class="info-label">Certificado Global:</span> <span class="info-value">${this.globalCertificate || '-'}</span></div>
        </div>
        <div class="info-box">
            <h3>Laboratorio / Costos</h3>
            <div class="info-row"><span class="info-label">Laboratorio:</span> <span class="info-value"><strong>${this.batch.laboratory_name || '-'}</strong></span></div>
            <div class="info-row"><span class="info-label">Base Origen:</span> <span class="info-value">${this.batch.base_name || '-'}</span></div>
            <div class="info-row"><span class="info-label">Costo Total:</span> <span class="info-value"><strong>${this.totalCost ? this.totalCost.toFixed(2) + ' ' + this.currency : 'N/A'}</strong></span></div>
            <div class="info-row"><span class="info-label">Total Items:</span> <span class="info-value"><strong>${items.length}</strong></span></div>
            <div class="info-row"><span class="info-label">Creado por:</span> <span class="info-value">${this.batch.created_by_name || '-'}</span></div>
        </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 15px;">
        <div class="stat-card" style="background: #eff6ff;">
            <div class="stat-number" style="color: #2563eb;">${items.length}</div>
            <div class="stat-label" style="color: #2563eb;">Total</div>
        </div>
        <div class="stat-card" style="background: #f0fdf4;">
            <div class="stat-number" style="color: #16a34a;">${approved.length}</div>
            <div class="stat-label" style="color: #16a34a;">Aprobados</div>
        </div>
        <div class="stat-card" style="background: #fffbeb;">
            <div class="stat-number" style="color: #d97706;">${conditional.length}</div>
            <div class="stat-label" style="color: #d97706;">Condicional</div>
        </div>
        <div class="stat-card" style="background: #fef2f2;">
            <div class="stat-number" style="color: #dc2626;">${rejected.length}</div>
            <div class="stat-label" style="color: #dc2626;">Rechazados</div>
        </div>
        <div class="stat-card" style="background: #f3e8ff;">
            <div class="stat-number" style="color: #7e22ce;">${jacks.length}</div>
            <div class="stat-label" style="color: #7e22ce;">Gatas</div>
        </div>
    </div>

    ${jacks.length > 0 ? `
    <div class="jack-box">
        <h3>Recalculo Automatico - ${jacks.length} Gata(s)</h3>
        <p style="font-size: 11px; color: #581c87; margin-bottom: 8px;">
            Al procesar este retorno, el sistema recalcula automaticamente las <strong>3 fechas de vencimiento</strong> para cada gata:
        </p>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div style="background: white; border: 2px solid #7e22ce; padding: 8px; border-radius: 4px; text-align: center;">
                <strong style="color: #2563eb; font-size: 10px; text-transform: uppercase;">Calibracion</strong><br>
                <span style="font-size: 10px;">Segun intervalo de herramienta</span>
            </div>
            <div style="background: white; border: 2px solid #7e22ce; padding: 8px; border-radius: 4px; text-align: center;">
                <strong style="color: #d97706; font-size: 10px; text-transform: uppercase;">Serv. Semestral</strong><br>
                <span style="font-size: 10px;">+6 meses (180 dias)</span>
            </div>
            <div style="background: white; border: 2px solid #7e22ce; padding: 8px; border-radius: 4px; text-align: center;">
                <strong style="color: #16a34a; font-size: 10px; text-transform: uppercase;">Serv. Anual</strong><br>
                <span style="font-size: 10px;">+12 meses (si >300 dias)</span>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(${Math.min(jacks.length, 3)}, 1fr); gap: 8px;">
            ${jacks.map(j => `
                <div style="background: white; border: 2px solid #7e22ce; padding: 6px; border-radius: 4px;">
                    <strong style="font-size: 11px;">${j.tool_code}</strong>
                    <span style="font-size: 10px; color: #666;"> - ${j.tool_name}</span><br>
                    <span style="font-size: 9px; color: #7e22ce;">Semi: ${j.next_semiannual_service || 'Pendiente'} | Anual: ${j.next_annual_service || 'Pendiente'}</span>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}

    <table>
        <thead>
            <tr>
                <th style="width: 30px;">#</th>
                <th style="width: 90px;">Codigo</th>
                <th>Descripcion</th>
                <th style="width: 70px;">P/N</th>
                <th style="width: 70px;">S/N</th>
                <th style="width: 80px;">Resultado</th>
                <th style="width: 80px;">Certificado</th>
                <th style="width: 80px;">Prox. Calib.</th>
                <th style="width: 55px;">Tipo</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>

    ${this.observations ? `
    <div class="summary-box" style="margin-top: 15px;">
        <strong>Observaciones:</strong> ${this.observations}
    </div>
    ` : ''}

    <div class="signatures">
        <div class="sig-block">
            <div class="sig-line">
                Recibido por (Almacen)<br>
                <span style="font-weight: 400; font-size: 10px;">Responsable de Herramientas</span>
            </div>
        </div>
        <div class="sig-block">
            <div class="sig-line">
                Verificado por (Calidad)<br>
                <span style="font-weight: 400; font-size: 10px;">Control de Calidad</span>
            </div>
        </div>
        <div class="sig-block">
            <div class="sig-line">
                Aprobado por (Jefatura)<br>
                <span style="font-weight: 400; font-size: 10px;">${this.batch.approved_by_name || ''}</span>
            </div>
        </div>
    </div>

    <div style="text-align: center; margin-top: 30px; font-size: 9px; color: #999; border-top: 1px dashed #ccc; padding-top: 10px;">
        Documento generado automaticamente por el Sistema de Gestion de Herramientas - BOA | ${today}
    </div>
</body>
</html>`;
    }

    private formatDate(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
