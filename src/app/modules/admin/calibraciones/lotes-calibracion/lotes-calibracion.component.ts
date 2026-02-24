import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationBatchService } from '../../../../core/services/calibration-batch.service';
import { CalibrationBatch, CalibrationBatchItem } from '../../../../core/models';

@Component({
    selector: 'app-lotes-calibracion',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatIconModule, MatButtonModule,
        MatTableModule, MatPaginatorModule, MatProgressSpinnerModule,
        MatTooltipModule, MatDialogModule, MatSnackBarModule,
        MatSelectModule, MatFormFieldModule, MatInputModule,
        MatChipsModule, MatBadgeModule
    ],
    template: `
        <div class="flex flex-col gap-4 p-2">

            <!-- Header -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl md:text-3xl font-black text-black dark:text-white uppercase tracking-tight">
                        Lotes de Calibracion
                    </h2>
                    <p class="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1">
                        Modo Supermercado - Gestion de envios masivos a laboratorio
                    </p>
                </div>
                <div class="flex gap-2">
                    <button (click)="loadBatches()"
                            class="px-4 py-2 bg-gray-700 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2">
                        <mat-icon class="text-white !h-5 !text-lg">refresh</mat-icon>
                        Actualizar
                    </button>
                    <button (click)="openCreateBatchDialog()"
                            class="px-4 py-2 bg-[#FF6A00FF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2">
                        <mat-icon class="text-white !h-5 !text-lg">add_circle</mat-icon>
                        Nuevo Lote
                    </button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="bg-blue-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-blue-800">{{ openBatchCount() }}</p>
                    <p class="text-xs font-bold text-blue-600 uppercase">Abiertos</p>
                </div>
                <div class="bg-amber-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-amber-800">{{ sentBatchCount() }}</p>
                    <p class="text-xs font-bold text-amber-600 uppercase">Enviados</p>
                </div>
                <div class="bg-green-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-green-800">{{ completedBatchCount() }}</p>
                    <p class="text-xs font-bold text-green-600 uppercase">Completados</p>
                </div>
                <div class="bg-red-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-red-800">{{ overdueBatchCount() }}</p>
                    <p class="text-xs font-bold text-red-600 uppercase">Atrasados</p>
                </div>
            </div>

            <!-- Filter -->
            <div class="flex gap-3 items-center">
                <mat-form-field appearance="outline" class="flex-1" subscriptSizing="dynamic">
                    <mat-label>Filtrar por estado</mat-label>
                    <mat-select [(value)]="statusFilter" (selectionChange)="loadBatches()">
                        <mat-option value="">Todos</mat-option>
                        <mat-option value="open">Abiertos</mat-option>
                        <mat-option value="sent">Enviados</mat-option>
                        <mat-option value="completed">Completados</mat-option>
                    </mat-select>
                </mat-form-field>
            </div>

            <!-- Loading -->
            @if (isLoadingData()) {
                <div class="flex justify-center py-8">
                    <mat-spinner [diameter]="40"></mat-spinner>
                </div>
            }

            <!-- Table -->
            @if (!isLoadingData() && batchesList().length > 0) {
                <div class="overflow-x-auto border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] bg-white dark:bg-gray-900">
                    <table mat-table [dataSource]="batchesList()" class="w-full">

                        <ng-container matColumnDef="batch_number">
                            <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Nro. Lote</th>
                            <td mat-cell *matCellDef="let row" class="!font-bold">{{ row.batch_number }}</td>
                        </ng-container>

                        <ng-container matColumnDef="status">
                            <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Estado</th>
                            <td mat-cell *matCellDef="let row">
                                <span class="px-2 py-1 text-xs font-black rounded-full border-2 border-black"
                                      [ngClass]="{
                                          'bg-blue-200 text-blue-800': row.status === 'open',
                                          'bg-amber-200 text-amber-800': row.status === 'sent',
                                          'bg-green-200 text-green-800': row.status === 'completed',
                                          'bg-red-200 text-red-800': row.status === 'cancelled'
                                      }">
                                    {{ getStatusLabel(row.status) }}
                                </span>
                                @if (row.is_overdue) {
                                    <mat-icon class="text-red-500 !text-sm ml-1" matTooltip="Retorno atrasado">warning</mat-icon>
                                }
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="laboratory_name">
                            <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Laboratorio</th>
                            <td mat-cell *matCellDef="let row">{{ row.laboratory_name || '-' }}</td>
                        </ng-container>

                        <ng-container matColumnDef="total_items">
                            <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Items</th>
                            <td mat-cell *matCellDef="let row" class="!font-bold">
                                {{ row.total_items }}
                                @if (row.jack_items_count > 0) {
                                    <span class="ml-1 text-xs text-purple-600 font-bold">({{ row.jack_items_count }} gatas)</span>
                                }
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="send_date">
                            <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Fecha Envio</th>
                            <td mat-cell *matCellDef="let row">{{ row.send_date || '-' }}</td>
                        </ng-container>

                        <ng-container matColumnDef="acciones">
                            <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800 !text-center">Acciones</th>
                            <td mat-cell *matCellDef="let row" class="!text-center">
                                <div class="flex gap-1 justify-center">
                                    <button mat-icon-button matTooltip="Ver detalle" (click)="viewBatchDetail(row)">
                                        <mat-icon class="!text-lg">visibility</mat-icon>
                                    </button>
                                    @if (row.status === 'open') {
                                        <button mat-icon-button matTooltip="Confirmar y enviar" (click)="confirmBatch(row)"
                                                class="!text-green-600">
                                            <mat-icon class="!text-lg">send</mat-icon>
                                        </button>
                                        <button mat-icon-button matTooltip="Eliminar lote" (click)="deleteBatch(row)"
                                                class="!text-red-600">
                                            <mat-icon class="!text-lg">delete</mat-icon>
                                        </button>
                                    }
                                    @if (row.status === 'sent') {
                                        <button mat-icon-button matTooltip="Procesar retorno" (click)="processReturn(row)"
                                                class="!text-blue-600">
                                            <mat-icon class="!text-lg">assignment_return</mat-icon>
                                        </button>
                                    }
                                </div>
                            </td>
                        </ng-container>

                        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                        <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                            class="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"></tr>
                    </table>
                </div>

                <mat-paginator [length]="totalRecords"
                               [pageSize]="pageSize"
                               [pageSizeOptions]="[10, 25, 50]"
                               (page)="onPageChange($event)"
                               showFirstLastButtons>
                </mat-paginator>
            }

            <!-- Empty State -->
            @if (!isLoadingData() && batchesList().length === 0) {
                <div class="flex flex-col items-center justify-center py-12 border-3 border-dashed border-gray-300 rounded-xl">
                    <mat-icon class="!text-6xl text-gray-300 mb-3">inventory_2</mat-icon>
                    <p class="text-lg font-bold text-gray-400">No hay lotes de calibracion</p>
                    <p class="text-sm text-gray-400 mt-1">Cree un nuevo lote para comenzar a escanear herramientas</p>
                </div>
            }

        </div>
    `,
    styles: [`
        :host { display: block; }
        .border-3 { border-width: 3px; }
    `]
})
export class LotesCalibracionComponent implements OnInit, OnDestroy {
    private batchService = inject(CalibrationBatchService);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    // Signals
    batchesList = signal<CalibrationBatch[]>([]);
    isLoadingData = signal(false);

    // Computed
    openBatchCount = computed(() => this.batchesList().filter(b => b.status === 'open').length);
    sentBatchCount = computed(() => this.batchesList().filter(b => b.status === 'sent').length);
    completedBatchCount = computed(() => this.batchesList().filter(b => b.status === 'completed').length);
    overdueBatchCount = computed(() => this.batchesList().filter(b => b.is_overdue).length);

    // State
    statusFilter = '';
    displayedColumns = ['batch_number', 'status', 'laboratory_name', 'total_items', 'send_date', 'acciones'];
    totalRecords = 0;
    pageSize = 10;
    pageIndex = 0;

    ngOnInit(): void {
        this.loadBatches();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadBatches(): void {
        this.isLoadingData.set(true);
        const filters: any = {};
        if (this.statusFilter) {
            filters.status = this.statusFilter;
        }

        this.batchService.getBatches({
            ...filters,
            start: this.pageIndex * this.pageSize,
            limit: this.pageSize
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoadingData.set(false))
        ).subscribe({
            next: (data) => {
                this.batchesList.set(data);
                this.totalRecords = data.length;
            },
            error: () => this.showMessage('Error al cargar los lotes', 'error')
        });
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadBatches();
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            'open': 'Abierto', 'sent': 'Enviado', 'in_process': 'En Proceso',
            'completed': 'Completado', 'cancelled': 'Cancelado'
        };
        return labels[status] || status;
    }

    async openCreateBatchDialog(): Promise<void> {
        const { CrearLoteDialogComponent } = await import('./crear-lote/crear-lote-dialog.component');
        const dialogRef = this.dialog.open(CrearLoteDialogComponent, {
            width: '600px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.success) {
                this.loadBatches();
            }
        });
    }

    async viewBatchDetail(batch: CalibrationBatch): Promise<void> {
        const { DetalleLoteDialogComponent } = await import('./detalle-lote/detalle-lote-dialog.component');
        const dialogRef = this.dialog.open(DetalleLoteDialogComponent, {
            width: '1000px',
            maxWidth: '95vw',
            height: '85vh',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false,
            data: batch
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.success) {
                this.loadBatches();
            }
        });
    }

    confirmBatch(batch: CalibrationBatch): void {
        if (batch.total_items === 0) {
            this.showMessage('El lote no tiene herramientas. Escanee al menos una antes de confirmar.', 'warning');
            return;
        }
        this.batchService.confirmBatch({
            batch_id: batch.id_batch,
            approved_by_id: 0,
            approved_by_name: ''
        }).pipe(takeUntil(this._unsubscribeAll)).subscribe({
            next: (res) => {
                this.showMessage(res?.mensaje || 'Lote confirmado exitosamente', 'success');
                this.loadBatches();
            },
            error: () => this.showMessage('Error al confirmar el lote', 'error')
        });
    }

    deleteBatch(batch: CalibrationBatch): void {
        this.batchService.deleteBatch(batch.id_batch)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: () => {
                    this.showMessage('Lote eliminado exitosamente', 'success');
                    this.loadBatches();
                },
                error: () => this.showMessage('Error al eliminar el lote', 'error')
            });
    }

    async processReturn(batch: CalibrationBatch): Promise<void> {
        const { RetornoLoteDialogComponent } = await import('./retorno-lote/retorno-lote-dialog.component');
        const dialogRef = this.dialog.open(RetornoLoteDialogComponent, {
            width: '1000px',
            maxWidth: '95vw',
            height: '85vh',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false,
            data: batch
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.success) {
                this.loadBatches();
            }
        });
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
