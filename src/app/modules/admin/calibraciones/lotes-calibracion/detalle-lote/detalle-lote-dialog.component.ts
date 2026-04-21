import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationBatchService } from '../../../../../core/services/calibration-batch.service';
import { BarcodeScannerService } from '../../../../../core/services/barcode-scanner.service';
import { CalibrationBatch, CalibrationBatchItem } from '../../../../../core/models';

@Component({
    selector: 'app-detalle-lote-dialog',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatIconModule, MatButtonModule,
        MatDialogModule, MatSnackBarModule, MatFormFieldModule,
        MatInputModule, MatTableModule, MatProgressSpinnerModule,
        MatTooltipModule, MatChipsModule
    ],
    templateUrl: './detalle-lote-dialog.component.html',
})
export class DetalleLoteDialogComponent implements OnInit, OnDestroy {
    private batchService = inject(CalibrationBatchService);
    private barcodeScannerService = inject(BarcodeScannerService);
    private dialogRef = inject(MatDialogRef<DetalleLoteDialogComponent>);
    private snackBar = inject(MatSnackBar);
    public batch: CalibrationBatch = inject(MAT_DIALOG_DATA);
    private _unsubscribeAll = new Subject<void>();

    // Signals
    items = signal<CalibrationBatchItem[]>([]);
    isLoadingItems = signal(false);
    isAdding = signal(false);
    isConfirming = signal(false);
    lastScanWasJack = signal(false);
    scannerActive = signal(false);

    jackCount = computed(() => this.items().filter(i => i.is_jack).length);

    // State
    scanInput = '';
    expandedItems: Record<number, boolean> = {};

    ngOnInit(): void {
        this.loadItems();

        // Activate barcode scanner
        this.barcodeScannerService.enable();
        this.barcodeScannerService.isActive$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(active => this.scannerActive.set(active));

        this.barcodeScannerService.scanned$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(code => {
            if (this.batch.status === 'open') {
                this.scanInput = code;
                this.addTool();
            }
        });
    }

    ngOnDestroy(): void {
        this.barcodeScannerService.disable();
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadItems(): void {
        this.isLoadingItems.set(true);
        this.batchService.getBatchItems(this.batch.id_batch).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoadingItems.set(false))
        ).subscribe({
            next: (data) => {
                this.items.set(data);
            },
            error: () => this.showMessage('Error al cargar items del lote', 'error')
        });
    }

    addTool(): void {
        if (!this.scanInput.trim()) return;

        this.isAdding.set(true);
        this.lastScanWasJack.set(false);

        this.batchService.addToolToBatch({
            batch_id: this.batch.id_batch,
            barcode_scan: this.scanInput.trim()
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isAdding.set(false))
        ).subscribe({
            next: (res) => {
                const isJack = res?.is_jack === 'true' || res?.is_jack === true;
                this.lastScanWasJack.set(isJack);
                this.showMessage(res?.mensaje || 'Herramienta agregada al lote', 'success');
                this.scanInput = '';
                this.loadItems();
            },
            error: (err) => {
                const msg = err?.error?.mensaje || err?.message || 'Error al agregar herramienta';
                this.showMessage(msg, 'error');
            }
        });
    }

    removeItem(item: CalibrationBatchItem): void {
        this.batchService.removeFromBatch(item.id_batch_item, this.batch.id_batch).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: () => {
                this.showMessage('Herramienta removida del lote', 'success');
                this.loadItems();
            },
            error: (err) => {
                const msg = err?.error?.mensaje || err?.message || 'Error al remover herramienta';
                this.showMessage(msg, 'error');
            }
        });
    }

    toggleExpand(item: CalibrationBatchItem): void {
        this.expandedItems[item.id_batch_item] = !this.expandedItems[item.id_batch_item];
    }

    confirmBatch(): void {
        if (this.items().length === 0) {
            this.showMessage('No hay herramientas en el lote para confirmar', 'warning');
            return;
        }

        this.isConfirming.set(true);
        this.batchService.confirmBatch({
            batch_id: this.batch.id_batch,
            approved_by_id: 0,
            approved_by_name: ''
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isConfirming.set(false))
        ).subscribe({
            next: (res) => {
                this.showMessage(res?.mensaje || 'Lote confirmado y enviado exitosamente', 'success');
                this.dialogRef.close({ success: true, action: 'confirmed' });
            },
            error: (err) => {
                const msg = err?.error?.mensaje || err?.message || 'Error al confirmar el lote';
                this.showMessage(msg, 'error');
            }
        });
    }

    // =========================================================================
    // PDF & PRINT - Nota de Envio a Laboratorio
    // =========================================================================

    exportToPdf(): void {
        if (this.items().length === 0) {
            this.showMessage('No hay items para exportar a PDF', 'warning');
            return;
        }
        const htmlContent = this.generateNotaEnvioHTML();
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            this.showMessage('No se pudo abrir la ventana. Verifique el bloqueador de popups.', 'error');
            return;
        }
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        this.showMessage('Nota de Envio generada. Use Ctrl+S o "Guardar como PDF" en el dialogo de impresion.', 'info');
    }

    printNotaEnvio(): void {
        if (this.items().length === 0) {
            this.showMessage('No hay items para imprimir', 'warning');
            return;
        }
        const htmlContent = this.generateNotaEnvioHTML();
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

    private generateNotaEnvioHTML(): string {
        const itemList = this.items();
        const jacks = itemList.filter(i => i.is_jack);
        const standard = itemList.filter(i => !i.is_jack);
        const today = new Date().toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const rows = itemList.map((item, idx) => `
            <tr style="${item.is_jack ? 'background: #f3e8ff;' : ''}">
                <td style="border: 2px solid #000; padding: 6px; text-align: center; font-weight: 900; font-size: 11px;">${idx + 1}</td>
                <td style="border: 2px solid #000; padding: 6px; font-weight: 900; font-size: 11px;">${item.tool_code}</td>
                <td style="border: 2px solid #000; padding: 6px; font-size: 10px;">${item.tool_name}</td>
                <td style="border: 2px solid #000; padding: 6px; text-align: center; font-size: 10px;">${item.tool_part_number || '-'}</td>
                <td style="border: 2px solid #000; padding: 6px; text-align: center; font-size: 10px;">${item.tool_serial || '-'}</td>
                <td style="border: 2px solid #000; padding: 6px; text-align: center; font-size: 10px;">${item.category_name || '-'}</td>
                <td style="border: 2px solid #000; padding: 6px; text-align: center; font-size: 10px;">
                    ${item.is_jack ? '<strong style="color: #7e22ce;">GATA</strong>' : 'Estandar'}
                </td>
                <td style="border: 2px solid #000; padding: 6px; font-size: 9px;">${item.notes || '-'}</td>
            </tr>
        `).join('');

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Nota de Envio a Laboratorio - ${this.batch.batch_number}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; margin: 20px; font-size: 11px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
        .logo { font-size: 32px; font-weight: 900; color: #ea580c; letter-spacing: -1px; }
        .logo-sub { font-size: 11px; color: #666; font-weight: 700; }
        .doc-code { font-size: 16px; font-weight: 900; background: #ea580c; color: white; padding: 10px 20px; border: 3px solid #000; box-shadow: 4px 4px 0px 0px #000; text-align: center; }
        .doc-date { font-size: 10px; color: #555; margin-top: 5px; text-align: right; }
        h1 { text-align: center; font-size: 18px; margin: 20px 0; text-transform: uppercase; background: #fff7ed; padding: 12px; border: 3px solid #000; box-shadow: 4px 4px 0px 0px #000; font-weight: 900; letter-spacing: 1px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px; }
        .info-box { border: 3px solid #000; padding: 12px; background: white; box-shadow: 3px 3px 0px 0px #000; }
        .info-box h3 { margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; background: #1e293b; color: #fff; padding: 6px 10px; margin: -12px -12px 12px -12px; font-weight: 900; letter-spacing: 0.5px; }
        .info-row { display: flex; margin-bottom: 4px; font-size: 11px; }
        .info-label { font-weight: 800; min-width: 120px; color: #444; }
        .info-value { flex: 1; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #1e293b; color: white; padding: 8px 6px; border: 2px solid #000; font-size: 10px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.5px; }
        .jack-box { background: #f3e8ff; border: 3px solid #7e22ce; padding: 12px; margin-bottom: 15px; box-shadow: 3px 3px 0px 0px #7e22ce; }
        .jack-box h3 { color: #7e22ce; font-weight: 900; font-size: 13px; margin-bottom: 8px; text-transform: uppercase; }
        .summary-box { background: #f8fafc; border: 3px solid #000; padding: 12px; box-shadow: 3px 3px 0px 0px #000; margin-bottom: 15px; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; padding-top: 20px; border-top: 3px solid #000; }
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
            <div class="logo-sub">Almacen de Herramientas</div>
        </div>
        <div style="text-align: right;">
            <div class="doc-code">LOTE: ${this.batch.batch_number}</div>
            <div class="doc-date">Generado: ${today}</div>
        </div>
    </div>

    <h1>Nota de Envio a Laboratorio de Calibracion</h1>

    <div class="grid-2">
        <div class="info-box">
            <h3>Datos del Lote</h3>
            <div class="info-row"><span class="info-label">Nro. Lote:</span> <span class="info-value"><strong>${this.batch.batch_number}</strong></span></div>
            <div class="info-row"><span class="info-label">Fecha Envio:</span> <span class="info-value">${this.batch.send_date || '-'}</span></div>
            <div class="info-row"><span class="info-label">Retorno Est.:</span> <span class="info-value">${this.batch.expected_return_date || 'No especificada'}</span></div>
            <div class="info-row"><span class="info-label">Orden Servicio:</span> <span class="info-value">${this.batch.service_order || '-'}</span></div>
            <div class="info-row"><span class="info-label">Total Items:</span> <span class="info-value"><strong>${itemList.length}</strong> (${jacks.length} gatas, ${standard.length} estandar)</span></div>
        </div>
        <div class="info-box">
            <h3>Laboratorio Destino</h3>
            <div class="info-row"><span class="info-label">Laboratorio:</span> <span class="info-value"><strong>${this.batch.laboratory_name || '-'}</strong></span></div>
            <div class="info-row"><span class="info-label">Base Origen:</span> <span class="info-value">${this.batch.base_name || '-'}</span></div>
            <div class="info-row"><span class="info-label">Creado por:</span> <span class="info-value">${this.batch.created_by_name || '-'}</span></div>
            <div class="info-row"><span class="info-label">Estado:</span> <span class="info-value">${this.getStatusLabel(this.batch.status)}</span></div>
        </div>
    </div>

    ${jacks.length > 0 ? `
    <div class="jack-box">
        <h3>Atencion: ${jacks.length} Gata(s) en este Lote</h3>
        <p style="font-size: 11px; color: #581c87;">
            Las gatas (Jacks) requieren servicios obligatorios adicionales: <strong>Servicio Semestral</strong> (cada 6 meses)
            y <strong>Servicio Anual</strong> (cada 12 meses). Al confirmar el retorno, las 3 fechas de vencimiento
            (calibracion, semestral, anual) se recalcularan automaticamente.
        </p>
        <div style="margin-top: 8px; display: grid; grid-template-columns: repeat(${Math.min(jacks.length, 3)}, 1fr); gap: 8px;">
            ${jacks.map(j => `
                <div style="background: white; border: 2px solid #7e22ce; padding: 6px; border-radius: 4px;">
                    <strong style="font-size: 11px;">${j.tool_code}</strong>
                    <span style="font-size: 10px; color: #666;"> - ${j.tool_name}</span>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}

    <table>
        <thead>
            <tr>
                <th style="width: 30px;">#</th>
                <th style="width: 100px;">Codigo</th>
                <th>Descripcion</th>
                <th style="width: 80px;">P/N</th>
                <th style="width: 80px;">S/N</th>
                <th style="width: 80px;">Categoria</th>
                <th style="width: 60px;">Tipo</th>
                <th style="width: 100px;">Notas</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>

    ${this.batch.notes ? `
    <div class="summary-box" style="margin-top: 15px;">
        <strong>Notas:</strong> ${this.batch.notes}
    </div>
    ` : ''}

    ${this.batch.observations ? `
    <div class="summary-box">
        <strong>Observaciones:</strong> ${this.batch.observations}
    </div>
    ` : ''}

    <div class="signatures">
        <div class="sig-block">
            <div class="sig-line">
                Responsable del Envio<br>
                <span style="font-weight: 400; font-size: 10px;">${this.batch.created_by_name || ''}</span>
            </div>
        </div>
        <div class="sig-block">
            <div class="sig-line">
                Recibido por (Laboratorio)<br>
                <span style="font-weight: 400; font-size: 10px;">${this.batch.laboratory_name || ''}</span>
            </div>
        </div>
    </div>

    <div style="text-align: center; margin-top: 30px; font-size: 9px; color: #999; border-top: 1px dashed #ccc; padding-top: 10px;">
        Documento generado automaticamente por el Sistema de Gestion de Herramientas - BOA | ${today}
    </div>
</body>
</html>`;
    }

    formatTime(dateStr: string): string {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            'open': 'Abierto', 'sent': 'Enviado', 'in_process': 'En Proceso',
            'completed': 'Completado', 'cancelled': 'Cancelado'
        };
        return labels[status] || status;
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
