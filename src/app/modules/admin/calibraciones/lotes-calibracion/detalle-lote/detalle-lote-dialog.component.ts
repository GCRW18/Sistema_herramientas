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
    template: `
        <div class="flex flex-col h-full bg-white dark:bg-[#0F172AFF] font-sans">

            <!-- Header -->
            <div class="flex items-center justify-between p-5 border-b-3 border-black">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_#000] flex items-center justify-center"
                         [ngClass]="{
                             'bg-blue-500': batch.status === 'open',
                             'bg-amber-500': batch.status === 'sent',
                             'bg-green-500': batch.status === 'completed',
                             'bg-red-500': batch.status === 'cancelled'
                         }">
                        <mat-icon class="text-white !text-xl">inventory_2</mat-icon>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-black dark:text-white uppercase tracking-tight">
                            Lote {{ batch.batch_number }}
                        </h2>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="px-2 py-0.5 text-[10px] font-black rounded-full border border-black uppercase"
                                  [ngClass]="{
                                      'bg-blue-200 text-blue-800': batch.status === 'open',
                                      'bg-amber-200 text-amber-800': batch.status === 'sent',
                                      'bg-green-200 text-green-800': batch.status === 'completed',
                                      'bg-red-200 text-red-800': batch.status === 'cancelled'
                                  }">
                                {{ getStatusLabel(batch.status) }}
                            </span>
                            <span class="text-xs font-bold text-gray-500">{{ batch.laboratory_name || 'Sin laboratorio' }}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <!-- PDF & Print Buttons -->
                    @if (items().length > 0) {
                        <button (click)="exportToPdf()"
                                matTooltip="Guardar como PDF"
                                class="w-9 h-9 bg-red-500 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:bg-red-600 flex items-center justify-center transition-all active:shadow-none active:translate-x-[1px] active:translate-y-[1px]">
                            <mat-icon class="text-white !text-lg">picture_as_pdf</mat-icon>
                        </button>
                        <button (click)="printNotaEnvio()"
                                matTooltip="Imprimir Nota de Envio"
                                class="w-9 h-9 bg-blue-600 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:bg-blue-700 flex items-center justify-center transition-all active:shadow-none active:translate-x-[1px] active:translate-y-[1px]">
                            <mat-icon class="text-white !text-lg">print</mat-icon>
                        </button>
                    }
                    <button mat-dialog-close
                            class="w-9 h-9 bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:bg-gray-100 flex items-center justify-center transition-all active:shadow-none active:translate-x-[1px] active:translate-y-[1px]">
                        <mat-icon class="!text-lg">close</mat-icon>
                    </button>
                </div>
            </div>

            <!-- Scanner (only for open batches) -->
            @if (batch.status === 'open') {
                <div class="px-5 pt-4">
                    <div class="bg-gray-50 dark:bg-gray-800 border-3 border-black rounded-xl p-4 shadow-[3px_3px_0px_0px_#000]">
                        <div class="flex items-center justify-between mb-2">
                            <p class="text-xs font-black uppercase text-gray-600 dark:text-gray-300">
                                <mat-icon class="!text-sm align-middle mr-1">qr_code_scanner</mat-icon>
                                Modo Supermercado - Escaneo Masivo
                            </p>
                            @if (scannerActive()) {
                                <span class="px-2 py-0.5 text-[9px] font-black bg-green-200 text-green-800 rounded-full border border-black animate-pulse">
                                    SCANNER ACTIVO
                                </span>
                            }
                        </div>
                        <div class="flex gap-2">
                            <mat-form-field appearance="outline" class="flex-1" subscriptSizing="dynamic">
                                <input matInput [(ngModel)]="scanInput"
                                       (keyup.enter)="addTool()"
                                       placeholder="Escanee codigo de barras o ingrese codigo de herramienta..."
                                       #scanField>
                                <mat-icon matPrefix>search</mat-icon>
                            </mat-form-field>
                            <button (click)="addTool()"
                                    [disabled]="!scanInput || isAdding()"
                                    class="px-4 py-2 bg-[#FF6A00FF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed h-[56px]">
                                @if (isAdding()) {
                                    <mat-spinner [diameter]="18"></mat-spinner>
                                } @else {
                                    <mat-icon class="text-white !h-5 !text-lg">add</mat-icon>
                                }
                                Agregar
                            </button>
                        </div>

                        <!-- Jack Detection Alert -->
                        @if (lastScanWasJack()) {
                            <div class="mt-3 bg-purple-100 border-2 border-purple-600 rounded-lg p-3 shadow-[2px_2px_0px_0px_#000] animate-fadeIn">
                                <div class="flex items-center gap-2">
                                    <mat-icon class="text-purple-700 !text-xl">precision_manufacturing</mat-icon>
                                    <div>
                                        <p class="text-sm font-black text-purple-800 uppercase">Gata (Jack) Detectada</p>
                                        <p class="text-xs text-purple-700">
                                            Se habilitaron automaticamente los servicios <strong>Semestral</strong> y <strong>Anual</strong>.
                                            Las 3 fechas de vencimiento se recalcularan al confirmar el retorno.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        }
                    </div>
                </div>
            }

            <!-- Summary -->
            <div class="px-5 pt-4">
                <div class="grid grid-cols-3 gap-3">
                    <div class="bg-blue-50 border-2 border-black rounded-lg p-2 text-center shadow-[2px_2px_0px_0px_#000]">
                        <p class="text-xl font-black text-blue-800">{{ items().length }}</p>
                        <p class="text-[10px] font-bold text-blue-600 uppercase">Total Items</p>
                    </div>
                    <div class="bg-purple-50 border-2 border-black rounded-lg p-2 text-center shadow-[2px_2px_0px_0px_#000]">
                        <p class="text-xl font-black text-purple-800">{{ jackCount() }}</p>
                        <p class="text-[10px] font-bold text-purple-600 uppercase">Gatas</p>
                    </div>
                    <div class="bg-green-50 border-2 border-black rounded-lg p-2 text-center shadow-[2px_2px_0px_0px_#000]">
                        <p class="text-xl font-black text-green-800">{{ items().length - jackCount() }}</p>
                        <p class="text-[10px] font-bold text-green-600 uppercase">Estandar</p>
                    </div>
                </div>
            </div>

            <!-- Items List -->
            <div class="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                @if (isLoadingItems()) {
                    <div class="flex justify-center py-8">
                        <mat-spinner [diameter]="40"></mat-spinner>
                    </div>
                }

                @if (!isLoadingItems() && items().length > 0) {
                    <div class="flex flex-col gap-2">
                        @for (item of items(); track item.id_batch_item; let i = $index) {
                            <div class="border-3 rounded-xl shadow-[3px_3px_0px_0px_#000] overflow-hidden transition-all"
                                 [ngClass]="{
                                     'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10': item.is_jack,
                                     'border-black bg-white dark:bg-gray-900': !item.is_jack
                                 }">
                                <!-- Item Row -->
                                <div class="flex items-center gap-3 p-3 cursor-pointer"
                                     (click)="toggleExpand(item)">
                                    <div class="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-black text-sm font-black bg-gray-100 dark:bg-gray-800">
                                        {{ item.scan_order }}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2">
                                            <span class="font-black text-sm text-black dark:text-white">{{ item.tool_code }}</span>
                                            @if (item.is_jack) {
                                                <span class="px-1.5 py-0.5 text-[9px] font-black bg-purple-300 text-purple-900 rounded border-2 border-purple-600 shadow-[1px_1px_0px_0px_#7e22ce]">
                                                    GATA
                                                </span>
                                            }
                                            @if (item.scanned_by_barcode) {
                                                <mat-icon class="!text-sm text-green-500" matTooltip="Escaneado por codigo de barras">qr_code</mat-icon>
                                            }
                                        </div>
                                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ item.tool_name }}</p>
                                    </div>
                                    <div class="text-right text-xs">
                                        <p class="font-bold text-gray-600 dark:text-gray-300">{{ item.tool_serial || '-' }}</p>
                                        <p class="text-gray-400">{{ item.category_name || '-' }}</p>
                                    </div>
                                    <mat-icon class="!text-lg text-gray-400 transition-transform"
                                              [class.rotate-180]="expandedItems[item.id_batch_item]">
                                        expand_more
                                    </mat-icon>
                                    @if (batch.status === 'open') {
                                        <button mat-icon-button matTooltip="Quitar del lote"
                                                (click)="removeItem(item); $event.stopPropagation()"
                                                class="!text-red-600 !w-8 !h-8">
                                            <mat-icon class="!text-lg">remove_circle</mat-icon>
                                        </button>
                                    }
                                </div>

                                <!-- Expanded Details -->
                                @if (expandedItems[item.id_batch_item]) {
                                    <div class="border-t-2 border-black p-3 bg-gray-50 dark:bg-gray-800/50 animate-fadeIn">
                                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                            <div>
                                                <p class="font-black text-gray-500 uppercase text-[10px]">Part Number</p>
                                                <p class="font-bold text-black dark:text-white">{{ item.tool_part_number || '-' }}</p>
                                            </div>
                                            <div>
                                                <p class="font-black text-gray-500 uppercase text-[10px]">Serial</p>
                                                <p class="font-bold text-black dark:text-white">{{ item.tool_serial || '-' }}</p>
                                            </div>
                                            <div>
                                                <p class="font-black text-gray-500 uppercase text-[10px]">Estado Previo</p>
                                                <p class="font-bold text-black dark:text-white">{{ item.tool_status_snapshot || '-' }}</p>
                                            </div>
                                            <div>
                                                <p class="font-black text-gray-500 uppercase text-[10px]">Escaneado</p>
                                                <p class="font-bold text-black dark:text-white">{{ item.scan_timestamp ? formatTime(item.scan_timestamp) : '-' }}</p>
                                            </div>
                                        </div>

                                        <!-- JACK SERVICE PANEL -->
                                        @if (item.is_jack) {
                                            <div class="mt-3 bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500 rounded-lg p-3 shadow-[2px_2px_0px_0px_#7e22ce]">
                                                <div class="flex items-center gap-2 mb-2">
                                                    <mat-icon class="text-purple-700 !text-lg">precision_manufacturing</mat-icon>
                                                    <p class="text-xs font-black text-purple-800 dark:text-purple-300 uppercase">
                                                        Servicios Tecnico de Gata (Obligatorios)
                                                    </p>
                                                </div>
                                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <!-- Calibracion -->
                                                    <div class="bg-white dark:bg-gray-800 rounded-lg p-2 border border-purple-300">
                                                        <p class="text-[10px] font-black text-blue-600 uppercase mb-1">Calibracion</p>
                                                        <p class="text-xs font-bold text-black dark:text-white">
                                                            {{ item.next_calibration_date || item.next_calibration_snapshot || 'Pendiente' }}
                                                        </p>
                                                        <p class="text-[10px] text-gray-500">Intervalo segun herramienta</p>
                                                    </div>
                                                    <!-- Servicio Semestral -->
                                                    <div class="bg-white dark:bg-gray-800 rounded-lg p-2 border border-purple-300">
                                                        <p class="text-[10px] font-black text-amber-600 uppercase mb-1">Servicio Semestral</p>
                                                        <p class="text-xs font-bold text-black dark:text-white">
                                                            {{ item.next_semiannual_service || 'Pendiente' }}
                                                        </p>
                                                        <p class="text-[10px] text-gray-500">Cada 6 meses (180 dias)</p>
                                                    </div>
                                                    <!-- Servicio Anual -->
                                                    <div class="bg-white dark:bg-gray-800 rounded-lg p-2 border border-purple-300">
                                                        <p class="text-[10px] font-black text-green-600 uppercase mb-1">Servicio Anual</p>
                                                        <p class="text-xs font-bold text-black dark:text-white">
                                                            {{ item.next_annual_service || 'Pendiente' }}
                                                        </p>
                                                        <p class="text-[10px] text-gray-500">Cada 12 meses (365 dias)</p>
                                                    </div>
                                                </div>
                                                <p class="text-[10px] text-purple-600 dark:text-purple-400 mt-2 font-bold">
                                                    Las 3 fechas se recalcularan automaticamente al procesar el retorno del lote.
                                                </p>
                                            </div>
                                        }

                                        @if (item.notes) {
                                            <div class="mt-2 text-xs">
                                                <p class="font-black text-gray-500 uppercase text-[10px]">Notas</p>
                                                <p class="text-gray-700 dark:text-gray-300">{{ item.notes }}</p>
                                            </div>
                                        }
                                    </div>
                                }
                            </div>
                        }
                    </div>
                }

                @if (!isLoadingItems() && items().length === 0) {
                    <div class="flex flex-col items-center justify-center py-12 border-3 border-dashed border-gray-300 rounded-xl">
                        <mat-icon class="!text-6xl text-gray-300 mb-3">qr_code_scanner</mat-icon>
                        <p class="text-lg font-bold text-gray-400">Sin herramientas en el lote</p>
                        <p class="text-sm text-gray-400 mt-1">Escanee codigos de barras para agregar herramientas</p>
                    </div>
                }
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between gap-3 p-5 border-t-3 border-black">
                <div class="text-xs font-bold text-gray-500">
                    @if (batch.send_date) {
                        <span>Envio: {{ batch.send_date }}</span>
                    }
                    @if (batch.expected_return_date) {
                        <span class="ml-3">Retorno esp.: {{ batch.expected_return_date }}</span>
                    }
                </div>
                <div class="flex gap-2">
                    @if (items().length > 0) {
                        <button (click)="exportToPdf()"
                                class="px-4 py-2 bg-red-500 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2">
                            <mat-icon class="text-white !h-5 !text-lg">picture_as_pdf</mat-icon>
                            PDF
                        </button>
                        <button (click)="printNotaEnvio()"
                                class="px-4 py-2 bg-blue-600 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2">
                            <mat-icon class="text-white !h-5 !text-lg">print</mat-icon>
                            Imprimir
                        </button>
                    }
                    <button mat-dialog-close
                            class="px-4 py-2 bg-gray-200 text-black font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase">
                        Cerrar
                    </button>
                    @if (batch.status === 'open' && items().length > 0) {
                        <button (click)="confirmBatch()"
                                [disabled]="isConfirming()"
                                class="px-5 py-2 bg-green-600 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2 disabled:opacity-50">
                            @if (isConfirming()) {
                                <mat-spinner [diameter]="18"></mat-spinner>
                            } @else {
                                <mat-icon class="text-white !h-5 !text-lg">send</mat-icon>
                            }
                            Confirmar y Enviar
                        </button>
                    }
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; height: 100%; }
        .border-3 { border-width: 3px; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.25s ease-out forwards; }
    `]
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
                const msg = err?.error?.mensaje || 'Error al agregar herramienta';
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
            error: () => this.showMessage('Error al remover herramienta', 'error')
        });
    }

    toggleExpand(item: CalibrationBatchItem): void {
        this.expandedItems[item.id_batch_item] = !this.expandedItems[item.id_batch_item];
    }

    confirmBatch(): void {
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
            error: () => this.showMessage('Error al confirmar el lote', 'error')
        });
    }

    // =========================================================================
    // PDF & PRINT - Nota de Envio a Laboratorio
    // =========================================================================

    exportToPdf(): void {
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
