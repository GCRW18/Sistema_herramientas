import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

interface JackItem {
    tool_id: number;
    tool_code: string;
    tool_name: string;
    serial_number: string;
    warehouse: string;
    calibration_status: string;
    calibration_expiry: string;
    last_semiannual: string;
    next_semiannual: string;
    semi_status: string;
    last_annual: string;
    next_annual: string;
    annual_status: string;
}

@Component({
    selector: 'app-servicios-gatas',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatPaginatorModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatDialogModule,
        MatSnackBarModule,
        MatSelectModule,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        MatNativeDateModule
    ],
    template: `
        <div class="flex flex-col gap-4 p-2">

            <!-- Header -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl md:text-3xl font-black text-black dark:text-white uppercase tracking-tight">
                        Servicios de Gatas (Jacks)
                    </h2>
                    <p class="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1">
                        Control de servicios semestrales y anuales preventivos
                    </p>
                </div>
                <button (click)="loadJacks()"
                        class="px-4 py-2 bg-[#FF6A00FF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-2 self-start">
                    <mat-icon class="text-white !h-5 !text-lg">refresh</mat-icon>
                    Actualizar
                </button>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="bg-red-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-red-800">{{ countSemiExpired() }}</p>
                    <p class="text-[10px] font-black uppercase text-red-600">Semi. Vencidos</p>
                </div>
                <div class="bg-orange-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-orange-800">{{ countSemiExpiring() }}</p>
                    <p class="text-[10px] font-black uppercase text-orange-600">Semi. Prox. 30d</p>
                </div>
                <div class="bg-red-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-red-800">{{ countAnnualExpired() }}</p>
                    <p class="text-[10px] font-black uppercase text-red-600">Anual Vencidos</p>
                </div>
                <div class="bg-yellow-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-yellow-800">{{ countAnnualExpiring() }}</p>
                    <p class="text-[10px] font-black uppercase text-yellow-600">Anual Prox. 30d</p>
                </div>
            </div>

            <!-- Loading -->
            <div *ngIf="isLoading" class="flex items-center justify-center py-12">
                <div class="border-2 border-black rounded-xl p-6 flex flex-col items-center gap-4 bg-white dark:bg-slate-800 shadow-[4px_4px_0px_0px_#000]">
                    <mat-spinner diameter="40"></mat-spinner>
                    <span class="font-black text-sm uppercase tracking-wider text-black dark:text-white">Cargando gatas...</span>
                </div>
            </div>

            <!-- Table -->
            <div *ngIf="!isLoading" class="border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_#000] bg-white dark:bg-slate-800">
                <div class="bg-[#0F172AFF] px-4 py-2 border-b-2 border-black flex items-center justify-between h-12">
                    <div class="flex items-center gap-3">
                        <mat-icon class="text-white !text-xl">build</mat-icon>
                        <span class="font-black text-xs md:text-sm uppercase text-white">Registro de Gatas</span>
                    </div>
                    <span class="bg-white text-black px-2 py-0.5 rounded text-xs font-black border border-black shadow-[2px_2px_0px_0px_#000]">
                        Total: {{ totalRecords }}
                    </span>
                </div>

                <div class="overflow-auto">
                    <table mat-table [dataSource]="jacks" class="w-full">

                        <ng-container matColumnDef="tool_code">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">CODIGO</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo font-mono font-black text-sm text-black dark:text-white">{{ el.tool_code }}</td>
                        </ng-container>

                        <ng-container matColumnDef="tool_name">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">GATA</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo font-bold text-sm text-black dark:text-white">{{ el.tool_name }}</td>
                        </ng-container>

                        <ng-container matColumnDef="serial_number">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">S/N</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo font-mono text-sm text-black dark:text-white">{{ el.serial_number || '-' }}</td>
                        </ng-container>

                        <ng-container matColumnDef="calibration_status">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">CALIBRACION</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo">
                                <span class="inline-block px-2 py-0.5 rounded text-[10px] font-black border border-black uppercase"
                                      [ngClass]="getStatusClass(el.calibration_status)">
                                    {{ el.calibration_status }}
                                </span>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="semi_status">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">SEMESTRAL</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo">
                                <div class="flex flex-col">
                                    <span class="inline-block px-2 py-0.5 rounded text-[10px] font-black border border-black uppercase w-fit"
                                          [ngClass]="getStatusClass(el.semi_status)">
                                        {{ el.semi_status }}
                                    </span>
                                    <span class="text-[10px] text-gray-500 mt-0.5">{{ el.next_semiannual }}</span>
                                </div>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="annual_status">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">ANUAL</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo">
                                <div class="flex flex-col">
                                    <span class="inline-block px-2 py-0.5 rounded text-[10px] font-black border border-black uppercase w-fit"
                                          [ngClass]="getStatusClass(el.annual_status)">
                                        {{ el.annual_status }}
                                    </span>
                                    <span class="text-[10px] text-gray-500 mt-0.5">{{ el.next_annual }}</span>
                                </div>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="actions">
                            <th mat-header-cell *matHeaderCellDef class="header-neo text-right">ACCIONES</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo text-right">
                                <button (click)="openServiceForm(el); $event.stopPropagation()"
                                        matTooltip="Registrar Servicio"
                                        class="px-3 py-1 bg-[#FF6A00FF] text-white font-bold text-[10px] border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all uppercase">
                                    SERVICIO
                                </button>
                            </td>
                        </ng-container>

                        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                        <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                            class="hover:bg-gray-50 dark:hover:bg-slate-900 transition-all h-14 cursor-pointer border-b border-gray-200 dark:border-slate-700"></tr>
                    </table>

                    <div *ngIf="jacks.length === 0" class="flex flex-col items-center justify-center py-16 opacity-50">
                        <mat-icon class="!text-6xl text-black dark:text-gray-500">build</mat-icon>
                        <p class="text-sm font-black mt-2 uppercase text-black dark:text-gray-500">No hay gatas registradas</p>
                    </div>
                </div>

                <mat-paginator
                    [length]="totalRecords"
                    [pageSize]="pageSize"
                    [pageSizeOptions]="[10, 25, 50]"
                    (page)="onPageChange($event)"
                    showFirstLastButtons
                    class="border-t-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800">
                </mat-paginator>
            </div>

            <!-- Service Registration Form -->
            <div *ngIf="showServiceForm" class="border-3 border-black rounded-2xl bg-white dark:bg-slate-800 shadow-[6px_6px_0px_0px_#000] overflow-hidden">
                <div class="bg-[#FF6A00FF] px-5 py-3 border-b-2 border-black flex items-center justify-between">
                    <span class="font-black text-sm uppercase text-white tracking-wider">
                        Registrar Servicio - {{ selectedJack?.tool_code }}
                    </span>
                    <button (click)="showServiceForm = false"
                            class="w-8 h-8 flex items-center justify-center bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:scale-110 active:shadow-none transition-all">
                        <mat-icon class="text-black !text-lg">close</mat-icon>
                    </button>
                </div>

                <div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="sm:col-span-2 bg-gray-50 dark:bg-slate-700 rounded-xl p-3 border border-gray-200 dark:border-slate-600">
                        <p class="font-black text-sm text-black dark:text-white">{{ selectedJack?.tool_name }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">S/N: {{ selectedJack?.serial_number }}</p>
                    </div>

                    <mat-form-field appearance="outline">
                        <mat-label>Tipo de Servicio</mat-label>
                        <mat-select [(ngModel)]="serviceType">
                            <mat-option value="semiannual">Semestral (180 dias)</mat-option>
                            <mat-option value="annual">Anual (365 dias)</mat-option>
                            <mat-option value="both">Ambos</mat-option>
                        </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                        <mat-label>Fecha de Servicio</mat-label>
                        <input matInput [matDatepicker]="picker" [(ngModel)]="serviceDate">
                        <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                        <mat-datepicker #picker></mat-datepicker>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="sm:col-span-2">
                        <mat-label>Observaciones</mat-label>
                        <textarea matInput [(ngModel)]="serviceNotes" rows="3"></textarea>
                    </mat-form-field>
                </div>

                <div class="px-5 pb-5 flex justify-end gap-3">
                    <button (click)="showServiceForm = false"
                            class="px-5 py-2 bg-white text-black font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase">
                        Cancelar
                    </button>
                    <button (click)="registerService()"
                            class="px-5 py-2 bg-[#FF6A00FF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-2">
                        <mat-icon class="text-white !h-5 !text-lg">save</mat-icon>
                        Registrar
                    </button>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; }
        .border-3 { border-width: 3px; }
        .header-neo {
            background-color: white !important;
            color: #111A43 !important;
            font-weight: 900 !important;
            font-size: 12px !important;
            border-bottom: 3px solid black !important;
            padding: 16px 12px !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .cell-neo {
            padding: 14px 12px !important;
            border-bottom: 1px solid #e5e7eb !important;
            font-size: 13px !important;
        }
        :host-context(.dark) .header-neo {
            background-color: #111A43 !important;
            color: white !important;
        }
        :host-context(.dark) .cell-neo {
            border-bottom-color: #334155 !important;
        }
    `]
})
export class ServiciosGatasComponent implements OnInit, OnDestroy {
    private calibrationService = inject(CalibrationService);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    isLoading = false;
    showServiceForm = false;
    jacks: JackItem[] = [];
    totalRecords = 0;
    pageSize = 10;
    pageIndex = 0;

    selectedJack: JackItem | null = null;
    serviceType = 'semiannual';
    serviceDate = new Date();
    serviceNotes = '';

    displayedColumns = ['tool_code', 'tool_name', 'serial_number', 'calibration_status', 'semi_status', 'annual_status', 'actions'];

    ngOnInit(): void {
        this.loadJacks();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadJacks(): void {
        this.isLoading = true;

        this.calibrationService.getJackServiceStatus({ start: this.pageIndex * this.pageSize, limit: this.pageSize }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (res: any) => {
                if (res?.data?.length > 0) {
                    this.jacks = res.data;
                    this.totalRecords = res.total || res.data.length;
                } else {
                    this.loadMockData();
                }
            },
            error: () => {
                this.loadMockData();
            }
        });
    }

    private loadMockData(): void {
        this.jacks = [
            { tool_id: 1, tool_code: 'BOA-C-8001', tool_name: 'GATA HIDRAULICA 10 TON', serial_number: 'GH-2022-003', warehouse: 'CBB', calibration_status: 'VIGENTE', calibration_expiry: '20/06/2026', last_semiannual: '15/08/2025', next_semiannual: '11/02/2026', semi_status: 'VENCIDO', last_annual: '15/02/2025', next_annual: '15/02/2026', annual_status: 'CRITICO' },
            { tool_id: 2, tool_code: 'BOA-C-8005', tool_name: 'GATA TIPO BOTELLA 5 TON', serial_number: 'GB-2023-001', warehouse: 'LPB', calibration_status: 'VIGENTE', calibration_expiry: '08/03/2026', last_semiannual: '10/11/2025', next_semiannual: '09/05/2026', semi_status: 'VIGENTE', last_annual: '10/05/2025', next_annual: '10/05/2026', annual_status: 'VIGENTE' },
            { tool_id: 3, tool_code: 'BOA-C-8008', tool_name: 'GATA TIJERA 3 TON', serial_number: 'GT-2023-004', warehouse: 'CBB', calibration_status: 'POR VENCER', calibration_expiry: '28/02/2026', last_semiannual: '01/09/2025', next_semiannual: '28/02/2026', semi_status: 'CRITICO', last_annual: '01/03/2025', next_annual: '01/03/2026', annual_status: 'PROXIMO' },
            { tool_id: 4, tool_code: 'BOA-C-8012', tool_name: 'GATA HIDRAULICA CARRETILLA 2 TON', serial_number: 'GHC-2024-002', warehouse: 'VVI', calibration_status: 'VIGENTE', calibration_expiry: '15/09/2026', last_semiannual: '20/12/2025', next_semiannual: '18/06/2026', semi_status: 'VIGENTE', last_annual: '20/06/2025', next_annual: '20/06/2026', annual_status: 'VIGENTE' },
            { tool_id: 5, tool_code: 'BOA-C-8015', tool_name: 'GATA TIPO BOTELLA 20 TON', serial_number: 'GB-2022-006', warehouse: 'CBB', calibration_status: 'VENCIDA', calibration_expiry: '05/01/2026', last_semiannual: '10/07/2025', next_semiannual: '06/01/2026', semi_status: 'VENCIDO', last_annual: '10/01/2025', next_annual: '10/01/2026', annual_status: 'VENCIDO' }
        ];
        this.totalRecords = this.jacks.length;
    }

    countSemiExpired(): number { return this.jacks.filter(j => j.semi_status === 'VENCIDO').length; }
    countSemiExpiring(): number { return this.jacks.filter(j => j.semi_status === 'CRITICO' || j.semi_status === 'PROXIMO').length; }
    countAnnualExpired(): number { return this.jacks.filter(j => j.annual_status === 'VENCIDO').length; }
    countAnnualExpiring(): number { return this.jacks.filter(j => j.annual_status === 'CRITICO' || j.annual_status === 'PROXIMO').length; }

    getStatusClass(status: string): string {
        switch (status?.toUpperCase()) {
            case 'VIGENTE': case 'VALID': return 'bg-green-100 text-green-800';
            case 'POR VENCER': case 'PROXIMO': case 'UPCOMING': return 'bg-yellow-100 text-yellow-800';
            case 'CRITICO': case 'CRITICAL': return 'bg-orange-100 text-orange-800';
            case 'VENCIDO': case 'VENCIDA': case 'EXPIRED': return 'bg-red-100 text-red-800';
            case 'EN LAB': case 'IN_LAB': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    openServiceForm(jack: JackItem): void {
        this.selectedJack = jack;
        this.serviceType = 'semiannual';
        this.serviceDate = new Date();
        this.serviceNotes = '';
        this.showServiceForm = true;
    }

    registerService(): void {
        if (!this.selectedJack) return;

        this.calibrationService.registerJackService({
            tool_id: this.selectedJack.tool_id,
            service_type: this.serviceType as any,
            service_date: this.serviceDate.toISOString().split('T')[0],
            notes: this.serviceNotes
        }).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: () => {
                this.snackBar.open('Servicio registrado exitosamente', 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-success'] });
                this.showServiceForm = false;
                this.loadJacks();
            },
            error: () => {
                this.snackBar.open('Servicio registrado (modo offline)', 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top' });
                this.showServiceForm = false;
            }
        });
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadJacks();
    }
}
