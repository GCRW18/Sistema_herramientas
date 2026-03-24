import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationBatchService } from '../../../../core/services/calibration-batch.service';
import { CalibrationBatch } from '../../../../core/models';

@Component({
    selector: 'app-lotes-calibracion',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatIconModule,
        MatProgressSpinnerModule, MatTooltipModule,
        MatDialogModule, MatSnackBarModule
    ],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] font-sans overflow-hidden relative">

        <!-- DECORATIVE -->
        <div class="fixed top-16 right-10 w-48 h-48 bg-[#0891b2] rounded-full border-4 border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-28 h-28 bg-[#0891b2] rotate-12 border-4 border-black opacity-5 pointer-events-none"></div>

        <!-- MAIN -->
        <div class="flex-1 flex flex-col p-2 gap-2 overflow-hidden h-full relative z-10">

            <!-- HEADER -->
            <div class="flex items-center justify-between gap-2 shrink-0">
                <div class="flex items-center gap-2">
                    <mat-icon class="text-black dark:text-white !text-base">inventory_2</mat-icon>
                    <h1 class="text-base font-black text-black dark:text-white uppercase tracking-tight leading-none">
                        Lotes de Calibración
                    </h1>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-sm border border-black bg-[#0891b2] text-white uppercase">
                        SUPERMERCADO
                    </span>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button (click)="loadBatches()" [disabled]="isLoadingData()"
                            class="px-3 py-1.5 bg-slate-600 text-white font-bold text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-1 disabled:opacity-50">
                        <mat-icon class="!w-4 !h-4 !text-sm">refresh</mat-icon>
                        <span class="hidden sm:inline">Actualizar</span>
                    </button>
                    <button (click)="openCreateBatchDialog()"
                            class="px-3 py-1.5 bg-[#0891b2] text-white font-black text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-1">
                        <mat-icon class="!w-4 !h-4 !text-sm">add_circle</mat-icon>
                        Nuevo Lote
                    </button>
                </div>
            </div>

            <!-- BODY: 2 COLUMNAS -->
            <div class="flex flex-row gap-2 flex-1 overflow-hidden min-h-0">

                <!-- ============================================================ -->
                <!-- PANEL IZQUIERDO                                               -->
                <!-- ============================================================ -->
                <div class="w-[220px] shrink-0 flex flex-col gap-2">

                    <!-- Resumen 2x2 -->
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="bg-[#0891b2] px-3 py-1.5 border-b-2 border-black">
                            <span class="font-black text-xs uppercase text-white">Resumen</span>
                        </div>
                        <div class="p-1.5 grid grid-cols-2 gap-1.5">
                            <div class="rounded-lg border-2 border-black p-1.5 bg-blue-100 shadow-[2px_2px_0px_0px_#000]">
                                <p class="text-xl font-black text-blue-800 leading-none">{{ openBatchCount() }}</p>
                                <p class="text-[9px] font-black uppercase text-blue-600 leading-tight mt-0.5">Abiertos</p>
                            </div>
                            <div class="rounded-lg border-2 border-black p-1.5 bg-amber-100 shadow-[2px_2px_0px_0px_#000]">
                                <p class="text-xl font-black text-amber-800 leading-none">{{ sentBatchCount() }}</p>
                                <p class="text-[9px] font-black uppercase text-amber-600 leading-tight mt-0.5">Enviados</p>
                            </div>
                            <div class="rounded-lg border-2 border-black p-1.5 bg-green-100 shadow-[2px_2px_0px_0px_#000]">
                                <p class="text-xl font-black text-green-800 leading-none">{{ completedBatchCount() }}</p>
                                <p class="text-[9px] font-black uppercase text-green-600 leading-tight mt-0.5">Completados</p>
                            </div>
                            <div class="rounded-lg border-2 border-black p-1.5 bg-red-100 shadow-[2px_2px_0px_0px_#000]">
                                <p class="text-xl font-black text-red-800 leading-none">{{ overdueBatchCount() }}</p>
                                <p class="text-[9px] font-black uppercase text-red-600 leading-tight mt-0.5">Atrasados</p>
                            </div>
                        </div>
                    </div>

                    <!-- Filtro -->
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="bg-[#0F172AFF] px-3 py-1.5 border-b-2 border-black">
                            <span class="font-black text-xs uppercase text-white">Filtrar</span>
                        </div>
                        <div class="p-2">
                            <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Estado</label>
                            <select [(ngModel)]="statusFilter" (ngModelChange)="loadBatches()"
                                    class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                <option value="">Todos</option>
                                <option value="open">Abiertos</option>
                                <option value="sent">Enviados</option>
                                <option value="completed">Completados</option>
                                <option value="cancelled">Cancelados</option>
                            </select>
                        </div>
                    </div>

                </div>

                <!-- ============================================================ -->
                <!-- PANEL DERECHO: Tabla de lotes                                 -->
                <!-- ============================================================ -->
                <div class="flex-1 flex flex-col overflow-hidden h-full">
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-full">

                        <!-- Header tabla -->
                        <div class="bg-[#0F172AFF] px-3 py-1.5 border-b-2 border-black flex items-center justify-between shrink-0 h-10">
                            <div class="flex items-center gap-2">
                                <mat-icon class="text-white !text-xl">inventory_2</mat-icon>
                                <span class="font-black text-xs md:text-sm uppercase text-white">Lotes Registrados</span>
                            </div>
                            <span class="bg-white text-black px-2 py-0.5 rounded text-xs font-black border border-black shadow-[2px_2px_0px_0px_#000]">
                                Total: {{ batchesList().length }}
                            </span>
                        </div>

                        @if (isLoadingData()) {
                            <div class="flex flex-col items-center justify-center flex-1">
                                <mat-spinner diameter="40"></mat-spinner>
                                <p class="text-xs font-bold mt-3 uppercase animate-pulse text-black dark:text-white">Cargando lotes...</p>
                            </div>
                        }

                        @if (!isLoadingData()) {
                            <!-- Cabecera fija -->
                            <div class="grid grid-cols-12 gap-1 px-3 py-1.5 bg-white dark:bg-[#111A43] border-b-2 border-black shrink-0">
                                <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Nro. Lote</div>
                                <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Estado</div>
                                <div class="col-span-3 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Laboratorio</div>
                                <div class="col-span-1 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 text-center">Items</div>
                                <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Fecha Envío</div>
                                <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 text-right">Acciones</div>
                            </div>

                            <div class="overflow-y-auto flex-1 custom-scrollbar bg-[#f8f9fc] dark:bg-slate-900/50">

                                @if (batchesList().length === 0) {
                                    <div class="flex flex-col items-center justify-center h-full opacity-50">
                                        <mat-icon class="!text-6xl text-black dark:text-gray-500">inventory_2</mat-icon>
                                        <p class="text-sm font-black mt-2 uppercase text-black dark:text-gray-500">No hay lotes de calibración</p>
                                        <p class="text-xs font-bold mt-1 text-gray-400 dark:text-gray-500">Cree un nuevo lote para comenzar</p>
                                    </div>
                                }

                                @for (batch of batchesList(); track batch.id_batch) {
                                    <div class="grid grid-cols-12 gap-1 px-3 py-2 items-center border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0F172AFF] hover:bg-gray-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                         (click)="viewBatchDetail(batch)">

                                        <!-- Nro. Lote -->
                                        <div class="col-span-2">
                                            <span class="font-mono font-black text-xs text-black dark:text-white">{{ batch.batch_number }}</span>
                                        </div>

                                        <!-- Estado -->
                                        <div class="col-span-2 flex items-center gap-1">
                                            <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-black border border-black uppercase"
                                                  [ngClass]="getStatusClass(batch.status)">
                                                {{ getStatusLabel(batch.status) }}
                                            </span>
                                            @if (batch.is_overdue) {
                                                <mat-icon class="text-red-500 !text-sm" matTooltip="Retorno atrasado">warning</mat-icon>
                                            }
                                        </div>

                                        <!-- Laboratorio -->
                                        <div class="col-span-3">
                                            <span class="font-bold text-xs text-black dark:text-white truncate block">{{ batch.laboratory_name || '—' }}</span>
                                        </div>

                                        <!-- Items -->
                                        <div class="col-span-1 text-center">
                                            <span class="font-black text-xs text-black dark:text-white">{{ batch.total_items }}</span>
                                            @if (batch.jack_items_count > 0) {
                                                <span class="block text-[9px] text-purple-600 font-bold">{{ batch.jack_items_count }}g</span>
                                            }
                                        </div>

                                        <!-- Fecha envío -->
                                        <div class="col-span-2">
                                            <span class="font-mono text-xs text-black dark:text-white">{{ batch.send_date || '—' }}</span>
                                        </div>

                                        <!-- Acciones -->
                                        <div class="col-span-2 flex items-center justify-end gap-1" (click)="$event.stopPropagation()">

                                            <button (click)="viewBatchDetail(batch)"
                                                    matTooltip="Ver detalle"
                                                    class="w-6 h-6 flex items-center justify-center border-2 border-black bg-white dark:bg-slate-700 hover:bg-gray-100 rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all">
                                                <mat-icon class="text-black dark:text-white !text-xs">visibility</mat-icon>
                                            </button>

                                            @if (batch.status === 'open') {
                                                <button (click)="confirmBatch(batch)"
                                                        matTooltip="Confirmar y enviar"
                                                        class="w-6 h-6 flex items-center justify-center border-2 border-black bg-green-500 hover:bg-green-400 rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all">
                                                    <mat-icon class="text-white !text-xs">send</mat-icon>
                                                </button>
                                                <button (click)="deleteBatch(batch)"
                                                        matTooltip="Eliminar lote"
                                                        class="w-6 h-6 flex items-center justify-center border-2 border-black bg-red-500 hover:bg-red-400 rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all">
                                                    <mat-icon class="text-white !text-xs">delete</mat-icon>
                                                </button>
                                            }

                                            @if (batch.status === 'sent') {
                                                <button (click)="processReturn(batch)"
                                                        matTooltip="Procesar retorno"
                                                        class="w-6 h-6 flex items-center justify-center border-2 border-black bg-blue-500 hover:bg-blue-400 rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all">
                                                    <mat-icon class="text-white !text-xs">assignment_return</mat-icon>
                                                </button>
                                            }

                                        </div>

                                    </div>
                                }
                            </div>
                        }
                    </div>
                </div>

            </div>
        </div>
    </div>
    `,
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 2px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
        }
        :host-context(.dark) { color-scheme: dark; }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 8px !important;
            background-color: white;
        }
        :host-context(.dark) .neo-card-base { background-color: #1e293b !important; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class LotesCalibracionComponent implements OnInit, OnDestroy {
    private batchService = inject(CalibrationBatchService);
    private dialog       = inject(MatDialog);
    private snackBar     = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    batchesList   = signal<CalibrationBatch[]>([]);
    isLoadingData = signal(false);

    openBatchCount      = computed(() => this.batchesList().filter(b => b.status === 'open').length);
    sentBatchCount      = computed(() => this.batchesList().filter(b => b.status === 'sent').length);
    completedBatchCount = computed(() => this.batchesList().filter(b => b.status === 'completed').length);
    overdueBatchCount   = computed(() => this.batchesList().filter(b => b.is_overdue).length);

    statusFilter = '';

    ngOnInit(): void { this.loadBatches(); }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadBatches(): void {
        this.isLoadingData.set(true);
        const filters: any = {};
        if (this.statusFilter) filters.status = this.statusFilter;

        this.batchService.getBatches({ ...filters, start: 0, limit: 100 }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoadingData.set(false))
        ).subscribe({
            next: (data) => this.batchesList.set(data),
            error: () => this.showMessage('Error al cargar los lotes', 'error')
        });
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            open: 'Abierto', sent: 'Enviado', in_process: 'En Proceso',
            completed: 'Completado', cancelled: 'Cancelado'
        };
        return labels[status] || status;
    }

    getStatusClass(status: string): string {
        switch (status) {
            case 'open':      return 'bg-blue-500 text-white';
            case 'sent':      return 'bg-amber-500 text-white';
            case 'completed': return 'bg-green-500 text-white';
            case 'cancelled': return 'bg-red-500 text-white';
            default:          return 'bg-gray-200 text-black';
        }
    }

    async openCreateBatchDialog(): Promise<void> {
        const { CrearLoteDialogComponent } = await import('./crear-lote/crear-lote-dialog.component');
        const ref = this.dialog.open(CrearLoteDialogComponent, {
            width: '600px', maxWidth: '95vw', height: 'auto', maxHeight: '90vh',
            panelClass: 'neo-dialog', hasBackdrop: true, disableClose: false, autoFocus: false
        });
        ref.afterClosed().subscribe(result => { if (result?.success) this.loadBatches(); });
    }

    async viewBatchDetail(batch: CalibrationBatch): Promise<void> {
        const { DetalleLoteDialogComponent } = await import('./detalle-lote/detalle-lote-dialog.component');
        const ref = this.dialog.open(DetalleLoteDialogComponent, {
            width: '1000px', maxWidth: '95vw', height: '85vh', maxHeight: '90vh',
            panelClass: 'neo-dialog', hasBackdrop: true, disableClose: false, autoFocus: false, data: batch
        });
        ref.afterClosed().subscribe(result => { if (result?.success) this.loadBatches(); });
    }

    confirmBatch(batch: CalibrationBatch): void {
        if (batch.total_items === 0) {
            this.showMessage('El lote no tiene herramientas. Escanee al menos una antes de confirmar.', 'warning');
            return;
        }
        this.batchService.confirmBatch({ batch_id: batch.id_batch, approved_by_id: 0, approved_by_name: '' })
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res) => { this.showMessage(res?.mensaje || 'Lote confirmado exitosamente', 'success'); this.loadBatches(); },
                error: () => this.showMessage('Error al confirmar el lote', 'error')
            });
    }

    deleteBatch(batch: CalibrationBatch): void {
        if (!confirm(`¿Eliminar lote "${batch.batch_number}"?`)) return;
        this.batchService.deleteBatch(batch.id_batch)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: () => { this.showMessage('Lote eliminado exitosamente', 'success'); this.loadBatches(); },
                error: () => this.showMessage('Error al eliminar el lote', 'error')
            });
    }

    async processReturn(batch: CalibrationBatch): Promise<void> {
        const { RetornoLoteDialogComponent } = await import('./retorno-lote/retorno-lote-dialog.component');
        const ref = this.dialog.open(RetornoLoteDialogComponent, {
            width: '1000px', maxWidth: '95vw', height: '85vh', maxHeight: '90vh',
            panelClass: 'neo-dialog', hasBackdrop: true, disableClose: false, autoFocus: false, data: batch
        });
        ref.afterClosed().subscribe(result => { if (result?.success) this.loadBatches(); });
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
