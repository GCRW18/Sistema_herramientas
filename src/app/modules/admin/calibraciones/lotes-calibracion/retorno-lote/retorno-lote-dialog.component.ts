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
    template: `
        <div class="flex flex-col h-full bg-white dark:bg-[#0F172AFF] font-sans">

            <!-- Header -->
            <div class="flex items-center justify-between p-5 border-b-3 border-black">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-600 border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_#000] flex items-center justify-center">
                        <mat-icon class="text-white !text-xl">assignment_return</mat-icon>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-black dark:text-white uppercase tracking-tight">
                            Retorno Lote {{ batch.batch_number }}
                        </h2>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="px-2 py-0.5 text-[10px] font-black bg-amber-200 text-amber-800 rounded-full border border-black uppercase">
                                {{ batch.status === 'sent' ? 'Enviado' : batch.status === 'in_process' ? 'En Proceso' : batch.status }}
                            </span>
                            <span class="text-xs font-bold text-gray-500">{{ batch.laboratory_name }}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    @if (returnItems.length > 0) {
                        <button (click)="exportToPdf()"
                                matTooltip="Guardar como PDF"
                                class="w-9 h-9 bg-red-500 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:bg-red-600 flex items-center justify-center transition-all active:shadow-none active:translate-x-[1px] active:translate-y-[1px]">
                            <mat-icon class="text-white !text-lg">picture_as_pdf</mat-icon>
                        </button>
                        <button (click)="printNotaRetorno()"
                                matTooltip="Imprimir Nota de Retorno"
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

            <!-- Global Return Fields -->
            <div class="px-5 pt-4">
                <div class="bg-blue-50 dark:bg-gray-800 border-3 border-black rounded-xl p-4 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-xs font-black uppercase text-blue-800 dark:text-blue-300 mb-3">
                        <mat-icon class="!text-sm align-middle mr-1">tune</mat-icon>
                        Datos generales del retorno
                    </p>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                            <mat-label>Resultado Global</mat-label>
                            <mat-select [(value)]="globalResult" (selectionChange)="applyGlobalResult()">
                                <mat-option value="approved">Aprobado</mat-option>
                                <mat-option value="conditional">Condicional</mat-option>
                                <mat-option value="rejected">Rechazado</mat-option>
                            </mat-select>
                        </mat-form-field>
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                            <mat-label>Nro. Certificado Global</mat-label>
                            <input matInput [(ngModel)]="globalCertificate" (blur)="applyGlobalCertificate()">
                        </mat-form-field>
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                            <mat-label>Fecha Retorno</mat-label>
                            <input matInput [matDatepicker]="returnDatePicker" [(ngModel)]="returnDate">
                            <mat-datepicker-toggle matSuffix [for]="returnDatePicker"></mat-datepicker-toggle>
                            <mat-datepicker #returnDatePicker></mat-datepicker>
                        </mat-form-field>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                            <mat-label>Costo Total</mat-label>
                            <input matInput type="number" [(ngModel)]="totalCost" placeholder="0.00">
                            <span matPrefix class="text-sm font-bold text-gray-500 ml-2">BOB&nbsp;</span>
                        </mat-form-field>
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                            <mat-label>Moneda</mat-label>
                            <mat-select [(value)]="currency">
                                <mat-option value="BOB">BOB - Bolivianos</mat-option>
                                <mat-option value="USD">USD - Dolares</mat-option>
                            </mat-select>
                        </mat-form-field>
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                            <mat-label>Observaciones</mat-label>
                            <input matInput [(ngModel)]="observations" placeholder="Observaciones generales...">
                        </mat-form-field>
                    </div>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="px-5 pt-4">
                <div class="grid grid-cols-4 gap-3">
                    <div class="bg-blue-50 border-2 border-black rounded-lg p-2 text-center shadow-[2px_2px_0px_0px_#000]">
                        <p class="text-xl font-black text-blue-800">{{ returnItems.length }}</p>
                        <p class="text-[10px] font-bold text-blue-600 uppercase">Total</p>
                    </div>
                    <div class="bg-green-50 border-2 border-black rounded-lg p-2 text-center shadow-[2px_2px_0px_0px_#000]">
                        <p class="text-xl font-black text-green-800">{{ approvedCount() }}</p>
                        <p class="text-[10px] font-bold text-green-600 uppercase">Aprobados</p>
                    </div>
                    <div class="bg-amber-50 border-2 border-black rounded-lg p-2 text-center shadow-[2px_2px_0px_0px_#000]">
                        <p class="text-xl font-black text-amber-800">{{ conditionalCount() }}</p>
                        <p class="text-[10px] font-bold text-amber-600 uppercase">Condicional</p>
                    </div>
                    <div class="bg-purple-50 border-2 border-black rounded-lg p-2 text-center shadow-[2px_2px_0px_0px_#000]">
                        <p class="text-xl font-black text-purple-800">{{ jackCount() }}</p>
                        <p class="text-[10px] font-bold text-purple-600 uppercase">Gatas</p>
                    </div>
                </div>
            </div>

            <!-- Jack Recalculation Notice -->
            @if (jackCount() > 0) {
                <div class="px-5 pt-3">
                    <div class="bg-purple-100 dark:bg-purple-900/30 border-3 border-purple-600 rounded-xl p-3 shadow-[3px_3px_0px_0px_#7e22ce]">
                        <div class="flex items-center gap-2">
                            <mat-icon class="text-purple-700 !text-xl">precision_manufacturing</mat-icon>
                            <div>
                                <p class="text-sm font-black text-purple-800 uppercase">{{ jackCount() }} Gata(s) en este Lote</p>
                                <p class="text-xs text-purple-700">
                                    Al procesar el retorno, se recalcularan automaticamente las <strong>3 fechas de vencimiento</strong>:
                                    Calibracion, Servicio Semestral (+6 meses) y Servicio Anual (+12 meses).
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            }

            <!-- Items List (Card-based) -->
            <div class="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                @if (isLoading()) {
                    <div class="flex justify-center py-8">
                        <mat-spinner [diameter]="40"></mat-spinner>
                    </div>
                }

                @if (!isLoading() && returnItems.length > 0) {
                    <p class="text-xs font-black uppercase text-gray-600 mb-2">
                        Resultado individual por herramienta ({{ returnItems.length }} items)
                    </p>
                    <div class="flex flex-col gap-2">
                        @for (item of returnItems; track item.id_batch_item; let i = $index) {
                            <div class="border-3 rounded-xl shadow-[3px_3px_0px_0px_#000] overflow-hidden transition-all"
                                 [ngClass]="{
                                     'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10': item.is_jack || item.tool_is_jack,
                                     'border-black bg-white dark:bg-gray-900': !(item.is_jack || item.tool_is_jack),
                                     'ring-2 ring-red-500': item.return_result === 'rejected',
                                     'ring-2 ring-amber-500': item.return_result === 'conditional'
                                 }">
                                <!-- Item Header Row -->
                                <div class="flex items-center gap-3 p-3 cursor-pointer"
                                     (click)="toggleExpand(item)">
                                    <!-- Order Number -->
                                    <div class="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-black text-sm font-black"
                                         [ngClass]="{
                                             'bg-green-200 text-green-800': item.return_result === 'approved',
                                             'bg-amber-200 text-amber-800': item.return_result === 'conditional',
                                             'bg-red-200 text-red-800': item.return_result === 'rejected'
                                         }">
                                        {{ i + 1 }}
                                    </div>

                                    <!-- Tool Info -->
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2">
                                            <span class="font-black text-sm text-black dark:text-white">{{ item.tool_code }}</span>
                                            @if (item.is_jack || item.tool_is_jack) {
                                                <span class="px-1.5 py-0.5 text-[9px] font-black bg-purple-300 text-purple-900 rounded border-2 border-purple-600 shadow-[1px_1px_0px_0px_#7e22ce]">
                                                    GATA
                                                </span>
                                            }
                                        </div>
                                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ item.tool_name }}</p>
                                    </div>

                                    <!-- Inline Result Select -->
                                    <div class="flex items-center gap-2">
                                        <mat-form-field appearance="outline" class="!w-36" subscriptSizing="dynamic"
                                                        (click)="$event.stopPropagation()">
                                            <mat-select [(value)]="returnItems[i].return_result">
                                                <mat-option value="approved">
                                                    <span class="text-green-700 font-bold">Aprobado</span>
                                                </mat-option>
                                                <mat-option value="conditional">
                                                    <span class="text-amber-700 font-bold">Condicional</span>
                                                </mat-option>
                                                <mat-option value="rejected">
                                                    <span class="text-red-700 font-bold">Rechazado</span>
                                                </mat-option>
                                            </mat-select>
                                        </mat-form-field>
                                    </div>

                                    <!-- Expand Arrow -->
                                    <mat-icon class="!text-lg text-gray-400 transition-transform"
                                              [class.rotate-180]="expandedItems[item.id_batch_item]">
                                        expand_more
                                    </mat-icon>
                                </div>

                                <!-- Expanded Details -->
                                @if (expandedItems[item.id_batch_item]) {
                                    <div class="border-t-2 border-black p-3 bg-gray-50 dark:bg-gray-800/50 animate-fadeIn">
                                        <!-- Return Fields -->
                                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                            <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                                <mat-label>Nro. Certificado</mat-label>
                                                <input matInput [(ngModel)]="returnItems[i].return_certificate" placeholder="Cert. individual">
                                            </mat-form-field>
                                            <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                                <mat-label>Prox. Calibracion</mat-label>
                                                <input matInput type="date" [(ngModel)]="returnItems[i].return_next_date">
                                            </mat-form-field>
                                            <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                                <mat-label>Costo Individual</mat-label>
                                                <input matInput type="number" [(ngModel)]="returnItems[i].return_cost" placeholder="0.00">
                                            </mat-form-field>
                                        </div>

                                        <!-- Tool Details -->
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
                                                <p class="font-black text-gray-500 uppercase text-[10px]">Categoria</p>
                                                <p class="font-bold text-black dark:text-white">{{ item.category_name || '-' }}</p>
                                            </div>
                                            <div>
                                                <p class="font-black text-gray-500 uppercase text-[10px]">Estado Previo</p>
                                                <p class="font-bold text-black dark:text-white">{{ item.tool_status_snapshot || '-' }}</p>
                                            </div>
                                        </div>

                                        <!-- JACK SERVICE PANEL -->
                                        @if (item.is_jack || item.tool_is_jack) {
                                            <div class="mt-3 bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500 rounded-lg p-3 shadow-[2px_2px_0px_0px_#7e22ce]">
                                                <div class="flex items-center gap-2 mb-2">
                                                    <mat-icon class="text-purple-700 !text-lg">precision_manufacturing</mat-icon>
                                                    <p class="text-xs font-black text-purple-800 dark:text-purple-300 uppercase">
                                                        Servicios Tecnicos de Gata - Recalculo Automatico
                                                    </p>
                                                </div>
                                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <!-- Calibracion -->
                                                    <div class="bg-white dark:bg-gray-800 rounded-lg p-2 border border-purple-300">
                                                        <p class="text-[10px] font-black text-blue-600 uppercase mb-1">
                                                            <mat-icon class="!text-xs align-middle">event</mat-icon> Calibracion
                                                        </p>
                                                        <p class="text-xs font-bold text-black dark:text-white">
                                                            Actual: {{ item.next_calibration_date || item.next_calibration_snapshot || 'Pendiente' }}
                                                        </p>
                                                        <p class="text-[10px] text-green-600 font-bold mt-1">
                                                            Se recalculara al procesar retorno
                                                        </p>
                                                    </div>
                                                    <!-- Servicio Semestral -->
                                                    <div class="bg-white dark:bg-gray-800 rounded-lg p-2 border border-purple-300">
                                                        <p class="text-[10px] font-black text-amber-600 uppercase mb-1">
                                                            <mat-icon class="!text-xs align-middle">update</mat-icon> Servicio Semestral
                                                        </p>
                                                        <p class="text-xs font-bold text-black dark:text-white">
                                                            Actual: {{ item.next_semiannual_service || 'Sin fecha' }}
                                                        </p>
                                                        <p class="text-[10px] text-green-600 font-bold mt-1">
                                                            Nuevo: +6 meses desde hoy
                                                        </p>
                                                    </div>
                                                    <!-- Servicio Anual -->
                                                    <div class="bg-white dark:bg-gray-800 rounded-lg p-2 border border-purple-300">
                                                        <p class="text-[10px] font-black text-green-600 uppercase mb-1">
                                                            <mat-icon class="!text-xs align-middle">date_range</mat-icon> Servicio Anual
                                                        </p>
                                                        <p class="text-xs font-bold text-black dark:text-white">
                                                            Actual: {{ item.next_annual_service || 'Sin fecha' }}
                                                        </p>
                                                        <p class="text-[10px] text-green-600 font-bold mt-1">
                                                            Nuevo: +12 meses (si >300 dias)
                                                        </p>
                                                    </div>
                                                </div>
                                                <p class="text-[10px] text-purple-600 dark:text-purple-400 mt-2 font-bold">
                                                    Las 3 fechas se recalculan automaticamente en el backend (HE_CBT_RET) al confirmar el retorno.
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

                @if (!isLoading() && returnItems.length === 0) {
                    <div class="flex flex-col items-center justify-center py-12 border-3 border-dashed border-gray-300 rounded-xl">
                        <mat-icon class="!text-6xl text-gray-300 mb-3">inventory_2</mat-icon>
                        <p class="text-lg font-bold text-gray-400">No hay items en el lote</p>
                        <p class="text-sm text-gray-400 mt-1">Este lote no tiene herramientas para procesar</p>
                    </div>
                }
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between gap-3 p-5 border-t-3 border-black">
                <div class="text-xs text-gray-500">
                    <span class="font-bold">Lab:</span> {{ batch.laboratory_name }}
                    @if (batch.send_date) {
                        <span class="ml-3"><span class="font-bold">Envio:</span> {{ batch.send_date }}</span>
                    }
                </div>
                <div class="flex gap-2">
                    @if (returnItems.length > 0) {
                        <button (click)="exportToPdf()"
                                class="px-4 py-2 bg-red-500 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2">
                            <mat-icon class="text-white !h-5 !text-lg">picture_as_pdf</mat-icon>
                            PDF
                        </button>
                        <button (click)="printNotaRetorno()"
                                class="px-4 py-2 bg-indigo-600 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2">
                            <mat-icon class="text-white !h-5 !text-lg">print</mat-icon>
                            Imprimir
                        </button>
                    }
                    <button mat-dialog-close
                            class="px-4 py-2 bg-gray-200 text-black font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase">
                        Cancelar
                    </button>
                    <button (click)="processReturn()"
                            [disabled]="isProcessing() || returnItems.length === 0"
                            class="px-5 py-2 bg-blue-600 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2 disabled:opacity-50">
                        @if (isProcessing()) {
                            <mat-spinner [diameter]="18"></mat-spinner>
                        } @else {
                            <mat-icon class="text-white !h-5 !text-lg">check_circle</mat-icon>
                        }
                        Procesar Retorno
                    </button>
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
                // Auto-expand Jack items so the user sees the service panel
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
            error: () => this.showMessage('Error al procesar retorno', 'error')
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

    <!-- Result Summary Strip -->
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

    <!-- Statistics -->
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
