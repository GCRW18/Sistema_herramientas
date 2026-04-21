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
        <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] transition-colors duration-300 font-sans overflow-hidden">

            <div class="fixed top-20 right-10 w-40 h-40 bg-[#0F172AFF] rounded-full border-[3px] border-black opacity-5 pointer-events-none"></div>
            <div class="fixed bottom-10 left-10 w-24 h-24 bg-[#0891b2] rotate-12 border-[3px] border-black opacity-5 pointer-events-none"></div>

            <div class="flex-1 flex flex-col p-4 gap-3 overflow-hidden relative z-10">

                <div class="flex items-center justify-between gap-4 shrink-0 flex-wrap">

                    <div class="flex items-center gap-4">
                        <div class="flex items-center justify-center w-10 h-10 bg-white dark:bg-[#0F172AFF] border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-xl shrink-0">
                            <mat-icon class="text-black dark:text-[#0891b2] !text-base">inventory_2</mat-icon>
                        </div>
                        <div>
                            <h1 class="text-xl font-black text-black dark:text-white uppercase tracking-tighter leading-none">
                                LOTES DE CALIBRACIÓN
                            </h1>
                            <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                                <p class="text-[10px] font-bold bg-[#0891b2] text-white px-2 py-0.5 inline-block border border-black uppercase">
                                    Supermercado · Gestión de Lotes
                                </p>
                                <span *ngIf="overdueBatchCount() > 0"
                                      class="text-[10px] font-bold px-2 py-0.5 border-[2px] border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 rounded-lg animate-pulse">
                                ⚠ {{ overdueBatchCount() }} Lote{{ overdueBatchCount() !== 1 ? 's' : '' }} Atrasado{{ overdueBatchCount() !== 1 ? 's' : '' }}
                            </span>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 flex-wrap">

                        <select [(ngModel)]="statusFilter" (ngModelChange)="loadBatches()"
                                class="h-9 px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white
                                   border-[2px] border-black rounded-xl font-bold text-sm
                                   focus:outline-none focus:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all uppercase">
                            <option value="">Todos los Estados</option>
                            <option value="open">Abiertos</option>
                            <option value="sent">Enviados</option>
                            <option value="completed">Completados</option>
                            <option value="cancelled">Cancelados</option>
                        </select>

                        <button (click)="openCreateBatchDialog()"
                                class="px-4 py-2 bg-[#0891b2] text-white font-black text-sm
                                   border-[2px] border-black rounded-full
                                   shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px]
                                   hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none
                                   transition-all uppercase flex items-center gap-2">
                            <mat-icon class="!text-base text-white">add</mat-icon> Nuevo Lote
                        </button>
                    </div>
                </div>

                <div class="flex-1 flex flex-col overflow-hidden border-[3px] border-black bg-white dark:bg-[#0F172AFF] rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">

                    <div class="px-4 py-2.5 bg-[#0F172AFF] border-b-[3px] border-black flex items-center justify-between shrink-0 flex-wrap gap-2">
                        <h2 class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <mat-icon class="!text-base text-[#0891b2]">inbox_stack</mat-icon>
                            LOTES REGISTRADOS ({{ batchesList().length }})
                        </h2>

                        <div class="flex items-center gap-4">

                            <div class="flex items-center gap-2 bg-blue-500/30 rounded-lg px-3 py-1.5 border border-blue-400">
                                <div class="w-5 h-5 bg-blue-500 border border-white rounded flex items-center justify-center">
                                    <mat-icon class="!text-xs text-white">inbox</mat-icon>
                                </div>
                                <div>
                                    <div class="text-[8px] font-black uppercase text-blue-200 leading-none">Abiertos</div>
                                    <div class="text-sm font-black text-white leading-none">{{ openBatchCount() }}</div>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 bg-amber-500/30 rounded-lg px-3 py-1.5 border border-amber-400">
                                <div class="w-5 h-5 bg-amber-500 border border-white rounded flex items-center justify-center">
                                    <mat-icon class="!text-xs text-black">local_shipping</mat-icon>
                                </div>
                                <div>
                                    <div class="text-[8px] font-black uppercase text-amber-200 leading-none">Enviados</div>
                                    <div class="text-sm font-black text-white leading-none">{{ sentBatchCount() }}</div>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 bg-green-600/30 rounded-lg px-3 py-1.5 border border-green-400">
                                <div class="w-5 h-5 bg-green-600 border border-white rounded flex items-center justify-center">
                                    <mat-icon class="!text-xs text-white">check_circle</mat-icon>
                                </div>
                                <div>
                                    <div class="text-[8px] font-black uppercase text-green-200 leading-none">Completados</div>
                                    <div class="text-sm font-black text-green-200 leading-none">{{ completedBatchCount() }}</div>
                                </div>
                            </div>

                            <button (click)="loadBatches()"
                                    [disabled]="isLoadingData()"
                                    matTooltip="Recargar lista"
                                    class="w-7 h-7 flex items-center justify-center rounded-lg border border-white/30
                                       text-white hover:bg-white/20 transition-all disabled:opacity-40 ml-1">
                                <mat-icon class="!text-base" [ngClass]="isLoadingData() ? 'animate-spin-slow text-[#0891b2]' : 'text-[#0891b2]'">refresh</mat-icon>
                            </button>
                        </div>
                    </div>

                    <div *ngIf="isLoadingData()" class="flex-1 flex items-center justify-center bg-white dark:bg-[#0F172AFF]">
                        <div class="flex flex-col items-center gap-3">
                            <mat-spinner diameter="36"></mat-spinner>
                            <p class="text-xs font-bold uppercase animate-pulse text-gray-500 dark:text-gray-400">
                                Cargando lotes...
                            </p>
                        </div>
                    </div>

                    <div *ngIf="!isLoadingData()" class="overflow-y-auto flex-1 custom-scrollbar">
                        <table class="w-full">
                            <thead class="sticky top-0 z-10">
                            <tr class="border-b-[2px] border-black bg-gray-100 dark:bg-[#0F172AFF]">
                                <th class="text-left px-3 py-2 font-black text-xs uppercase text-black dark:text-white w-32">NRO. LOTE</th>
                                <th class="text-left px-3 py-2 font-black text-xs uppercase text-black dark:text-white w-36">LABORATORIO</th>
                                <th class="text-center px-3 py-2 font-black text-xs uppercase text-black dark:text-white w-24">ESTADO</th>
                                <th class="text-center px-3 py-2 font-black text-xs uppercase text-black dark:text-white w-20">CANTIDAD</th>
                                <th class="text-left px-3 py-2 font-black text-xs uppercase text-black dark:text-white w-32">FECHA ENVÍO</th>
                                <th class="text-center px-3 py-2 font-black text-xs uppercase text-black dark:text-white w-32">ACCIONES</th>
                            </tr>
                            </thead>
                            <tbody class="bg-white dark:bg-[#0F172AFF]">

                            <tr *ngFor="let batch of batchesList(); let last = last"
                                (click)="viewBatchDetail(batch)"
                                [class.border-b]="!last"
                                [class.bg-red-50]="batch.is_overdue"
                                [class.dark:bg-red-900]="batch.is_overdue"
                                class="border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group">

                                <td class="px-3 py-2">
                                <span class="font-black text-sm font-mono text-black dark:text-white group-hover:text-[#0891b2] transition-colors">
                                    {{ batch.batch_number }}
                                </span>
                                </td>

                                <td class="px-3 py-2">
                                <span class="font-bold text-gray-900 dark:text-white text-sm line-clamp-2">
                                    {{ batch.laboratory_name || 'Sin Laboratorio' }}
                                </span>
                                </td>

                                <td class="px-3 py-2 text-center">
                                    <div class="flex items-center justify-center gap-1">
                                    <span class="inline-block px-2 py-0.5 border-[2px] border-black rounded-lg text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000]"
                                          [ngClass]="getStatusClass(batch.status)">
                                        {{ getStatusLabel(batch.status) }}
                                    </span>
                                        <mat-icon *ngIf="batch.is_overdue" class="text-red-500 !text-[16px] animate-pulse" matTooltip="Retorno Atrasado">warning</mat-icon>
                                    </div>
                                </td>

                                <td class="px-3 py-2 text-center">
                                    <div class="flex flex-col items-center leading-tight">
                                        <span class="font-black text-sm text-black dark:text-white">{{ batch.total_items }} u.</span>
                                        <span *ngIf="batch.jack_items_count > 0" class="text-[9px] font-bold text-amber-600 uppercase border border-amber-400 bg-amber-50 px-1 rounded mt-0.5">
                                        {{ batch.jack_items_count }} Gatas
                                    </span>
                                    </div>
                                </td>

                                <td class="px-3 py-2">
                                <span class="font-mono font-semibold text-gray-600 dark:text-gray-400 text-xs">
                                    {{ batch.send_date || 'No Registrado' }}
                                </span>
                                </td>

                                <td class="px-3 py-2">
                                    <div class="flex gap-1.5 justify-center" (click)="$event.stopPropagation()">

                                        <button (click)="viewBatchDetail(batch)" matTooltip="Ver detalles"
                                                class="w-8 h-8 flex items-center justify-center border-[2px] border-black bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg shadow-[2px_2px_0px_0px_#000] active:translate-y-[1px] active:shadow-none transition-all">
                                            <mat-icon class="text-blue-600 dark:text-blue-400 !text-base">visibility</mat-icon>
                                        </button>

                                        <button *ngIf="batch.status === 'open'" (click)="confirmBatch(batch)" matTooltip="Confirmar Lote"
                                                class="w-8 h-8 flex items-center justify-center border-[2px] border-black bg-green-400 hover:bg-green-500 rounded-lg shadow-[2px_2px_0px_0px_#000] active:translate-y-[1px] active:shadow-none transition-all">
                                            <mat-icon class="text-black !text-base">send</mat-icon>
                                        </button>

                                        <button *ngIf="batch.status === 'sent'" (click)="processReturn(batch)" matTooltip="Procesar Retorno"
                                                class="w-8 h-8 flex items-center justify-center border-[2px] border-black bg-indigo-300 hover:bg-indigo-400 rounded-lg shadow-[2px_2px_0px_0px_#000] active:translate-y-[1px] active:shadow-none transition-all">
                                            <mat-icon class="text-black !text-base">assignment_return</mat-icon>
                                        </button>

                                        <button *ngIf="batch.status === 'open'" (click)="deleteBatch(batch)" matTooltip="Eliminar Lote"
                                                class="w-8 h-8 flex items-center justify-center border-[2px] border-black bg-red-400 hover:bg-red-500 rounded-lg shadow-[2px_2px_0px_0px_#000] active:translate-y-[1px] active:shadow-none transition-all">
                                            <mat-icon class="text-black !text-base">delete</mat-icon>
                                        </button>

                                    </div>
                                </td>
                            </tr>

                            <tr *ngIf="batchesList().length === 0">
                                <td colspan="6" class="p-10 text-center bg-white dark:bg-[#0F172AFF]">
                                    <mat-icon class="!text-5xl text-gray-300 dark:text-gray-600 mb-2">inbox_stack</mat-icon>
                                    <p class="text-gray-500 dark:text-gray-400 font-bold uppercase text-sm">
                                        {{ statusFilter ? 'No hay lotes con este estado' : 'No existen lotes de calibración registrados' }}
                                    </p>
                                    <button *ngIf="!statusFilter" (click)="openCreateBatchDialog()"
                                            class="mt-4 px-4 py-2 bg-[#0891b2] text-white font-black text-sm border-[2px] border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase inline-flex items-center gap-2">
                                        <mat-icon class="!text-base">add</mat-icon> Crear Primer Lote
                                    </button>
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    `,
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #0F172AFF; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #1e293b; }
        .dark .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #0891b2; }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }

        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
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

        this.batchService.getBatches({ ...filters, start: 0, limit: 1000 }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoadingData.set(false))
        ).subscribe({
            next: (data) => this.batchesList.set(data),
            error: () => this.showMessage('Error al cargar los lotes', 'error')
        });
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            open: 'ABIERTO', sent: 'ENVIADO', in_process: 'PROCESO',
            completed: 'COMPLETADO', cancelled: 'CANCELADO'
        };
        return labels[status] || status.toUpperCase();
    }

    // Chips Neo-Brutalistas
    getStatusClass(status: string): string {
        switch (status) {
            case 'open':      return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300';
            case 'sent':      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300';
            case 'completed': return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300';
            case 'cancelled': return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300';
            default:          return 'bg-gray-100 text-gray-700 border-gray-300';
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
