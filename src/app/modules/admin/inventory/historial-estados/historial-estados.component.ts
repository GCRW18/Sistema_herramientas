import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { StateHistoryService } from '../../../../core/services/state-history.service';
import { StateHistoryRecord } from '../../../../core/models';

@Component({
    selector: 'app-historial-estados',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatIconModule, MatButtonModule,
        MatTableModule, MatPaginatorModule, MatProgressSpinnerModule,
        MatTooltipModule, MatSnackBarModule, MatSelectModule,
        MatFormFieldModule, MatInputModule, MatChipsModule
    ],
    template: `
        <div class="flex flex-col gap-4 p-2">

            <!-- Header -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl md:text-3xl font-black text-black dark:text-white uppercase tracking-tight">
                        Historial de Estados
                    </h2>
                    <p class="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1">
                        Auditoria de cambios de status de herramientas (Bitacora)
                    </p>
                </div>
                <button (click)="loadHistory()"
                        class="px-4 py-2 bg-[#FF6A00FF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2 self-start">
                    <mat-icon class="text-white !h-5 !text-lg">refresh</mat-icon>
                    Actualizar
                </button>
            </div>

            <!-- Filters -->
            <div class="flex flex-wrap gap-3">
                <mat-form-field appearance="outline" class="flex-1 min-w-48" subscriptSizing="dynamic">
                    <mat-label>Buscar herramienta</mat-label>
                    <input matInput [(ngModel)]="searchTerm" (keyup.enter)="loadHistory()" placeholder="Codigo o nombre...">
                    <mat-icon matPrefix>search</mat-icon>
                </mat-form-field>
                <mat-form-field appearance="outline" class="w-48" subscriptSizing="dynamic">
                    <mat-label>Estado anterior</mat-label>
                    <mat-select [(value)]="filterPrevStatus" (selectionChange)="loadHistory()">
                        <mat-option value="">Todos</mat-option>
                        @for (status of statusOptions; track status.value) {
                            <mat-option [value]="status.value">{{ status.label }}</mat-option>
                        }
                    </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="w-48" subscriptSizing="dynamic">
                    <mat-label>Estado nuevo</mat-label>
                    <mat-select [(value)]="filterNewStatus" (selectionChange)="loadHistory()">
                        <mat-option value="">Todos</mat-option>
                        @for (status of statusOptions; track status.value) {
                            <mat-option [value]="status.value">{{ status.label }}</mat-option>
                        }
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
            @if (!isLoadingData() && historyList().length > 0) {
                <div class="overflow-x-auto border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] bg-white dark:bg-gray-900">
                    <table mat-table [dataSource]="historyList()" class="w-full">

                        <ng-container matColumnDef="change_date">
                            <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Fecha</th>
                            <td mat-cell *matCellDef="let row" class="!text-sm">{{ formatDate(row.change_date) }}</td>
                        </ng-container>

                        <ng-container matColumnDef="tool_code">
                            <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Herramienta</th>
                            <td mat-cell *matCellDef="let row">
                                <div class="flex flex-col">
                                    <span class="font-bold text-sm">{{ row.tool_code }}</span>
                                    <span class="text-xs text-gray-500">{{ row.tool_name }}</span>
                                </div>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="transition">
                            <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Transicion</th>
                            <td mat-cell *matCellDef="let row">
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-0.5 text-xs font-bold rounded-full border border-black"
                                          [style.background-color]="stateHistoryService.getStatusColor(row.previous_status) + '30'"
                                          [style.color]="stateHistoryService.getStatusColor(row.previous_status)">
                                        {{ stateHistoryService.getStatusLabel(row.previous_status) }}
                                    </span>
                                    <mat-icon class="!text-sm text-gray-400">arrow_forward</mat-icon>
                                    <span class="px-2 py-0.5 text-xs font-bold rounded-full border border-black"
                                          [style.background-color]="stateHistoryService.getStatusColor(row.new_status) + '30'"
                                          [style.color]="stateHistoryService.getStatusColor(row.new_status)">
                                        {{ stateHistoryService.getStatusLabel(row.new_status) }}
                                    </span>
                                </div>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="reason">
                            <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Motivo</th>
                            <td mat-cell *matCellDef="let row" class="!text-sm max-w-xs truncate" [matTooltip]="row.reason">
                                {{ row.reason }}
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="responsible_name">
                            <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Responsable</th>
                            <td mat-cell *matCellDef="let row" class="!text-sm">{{ row.responsible_name || row.usr_reg || '-' }}</td>
                        </ng-container>

                        <ng-container matColumnDef="reference_document">
                            <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Documento Ref.</th>
                            <td mat-cell *matCellDef="let row" class="!text-sm">{{ row.reference_document || '-' }}</td>
                        </ng-container>

                        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                        <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                            class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"></tr>
                    </table>
                </div>

                <mat-paginator [length]="totalRecords"
                               [pageSize]="pageSize"
                               [pageSizeOptions]="[10, 25, 50, 100]"
                               (page)="onPageChange($event)"
                               showFirstLastButtons>
                </mat-paginator>
            }

            <!-- Empty State -->
            @if (!isLoadingData() && historyList().length === 0) {
                <div class="flex flex-col items-center justify-center py-12 border-3 border-dashed border-gray-300 rounded-xl">
                    <mat-icon class="!text-6xl text-gray-300 mb-3">history</mat-icon>
                    <p class="text-lg font-bold text-gray-400">No hay registros de historial</p>
                    <p class="text-sm text-gray-400 mt-1">Los cambios de estado se registran automaticamente</p>
                </div>
            }

        </div>
    `,
    styles: [`
        :host { display: block; }
        .border-3 { border-width: 3px; }
    `]
})
export class HistorialEstadosComponent implements OnInit, OnDestroy {
    public stateHistoryService = inject(StateHistoryService);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    // Signals
    historyList = signal<StateHistoryRecord[]>([]);
    isLoadingData = signal(false);

    // State
    searchTerm = '';
    filterPrevStatus = '';
    filterNewStatus = '';
    displayedColumns = ['change_date', 'tool_code', 'transition', 'reason', 'responsible_name', 'reference_document'];
    totalRecords = 0;
    pageSize = 25;
    pageIndex = 0;

    statusOptions = [
        { value: 'available', label: 'Disponible' },
        { value: 'in_use', label: 'En Uso' },
        { value: 'in_calibration', label: 'En Calibracion' },
        { value: 'in_maintenance', label: 'En Mantenimiento' },
        { value: 'quarantine', label: 'Cuarentena' },
        { value: 'decommissioned', label: 'Dado de Baja' },
        { value: 'lost', label: 'Perdido' }
    ];

    ngOnInit(): void {
        this.loadHistory();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadHistory(): void {
        this.isLoadingData.set(true);
        const filters: any = {
            start: this.pageIndex * this.pageSize,
            limit: this.pageSize
        };

        this.stateHistoryService.getStateHistory(filters).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoadingData.set(false))
        ).subscribe({
            next: (data) => {
                this.historyList.set(data);
                this.totalRecords = data.length;
            },
            error: () => this.showMessage('Error al cargar el historial', 'error')
        });
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadHistory();
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-BO', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
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
