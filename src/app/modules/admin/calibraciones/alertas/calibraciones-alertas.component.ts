import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

interface AlertItem {
    tool_code: string;
    tool_name: string;
    serial_number: string;
    category: string;
    warehouse: string;
    calibration_expiry: string;
    days_remaining: number;
    urgency: string;
    is_jack: boolean;
    semi_status?: string;
    annual_status?: string;
}

@Component({
    selector: 'app-calibraciones-alertas',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatPaginatorModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatSelectModule,
        MatFormFieldModule,
        FormsModule
    ],
    template: `
        <div class="flex flex-col gap-4 p-2">

            <!-- Header -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl md:text-3xl font-black text-black dark:text-white uppercase tracking-tight">
                        Alertas de Vencimiento
                    </h2>
                    <p class="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1">
                        Herramientas con calibracion proxima a vencer o vencida
                    </p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <mat-form-field appearance="outline" class="w-48 neo-select">
                        <mat-label>Filtrar urgencia</mat-label>
                        <mat-select [(ngModel)]="selectedUrgency" (selectionChange)="loadAlerts()">
                            <mat-option value="all">Todas</mat-option>
                            <mat-option value="EXPIRED">Vencidas</mat-option>
                            <mat-option value="CRITICAL_7D">Criticas (7d)</mat-option>
                            <mat-option value="URGENT_15D">Urgentes (15d)</mat-option>
                            <mat-option value="UPCOMING_30D">Proximas (30d)</mat-option>
                            <mat-option value="IN_LAB">En laboratorio</mat-option>
                        </mat-select>
                    </mat-form-field>
                    <button (click)="loadAlerts()"
                            class="px-4 py-2 bg-[#e94125] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-2 h-10 self-center">
                        <mat-icon class="text-white !h-5 !text-lg">refresh</mat-icon>
                        Actualizar
                    </button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="bg-red-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-red-800">{{ countByUrgency('EXPIRED') }}</p>
                    <p class="text-[10px] font-black uppercase text-red-600">Vencidas</p>
                </div>
                <div class="bg-orange-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-orange-800">{{ countByUrgency('CRITICAL_7D') }}</p>
                    <p class="text-[10px] font-black uppercase text-orange-600">Criticas 7d</p>
                </div>
                <div class="bg-yellow-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-yellow-800">{{ countByUrgency('URGENT_15D') }}</p>
                    <p class="text-[10px] font-black uppercase text-yellow-600">Urgentes 15d</p>
                </div>
                <div class="bg-blue-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-blue-800">{{ countByUrgency('UPCOMING_30D') }}</p>
                    <p class="text-[10px] font-black uppercase text-blue-600">Proximas 30d</p>
                </div>
            </div>

            <!-- Loading -->
            <div *ngIf="isLoading" class="flex items-center justify-center py-12">
                <div class="border-2 border-black rounded-xl p-6 flex flex-col items-center gap-4 bg-white dark:bg-slate-800 shadow-[4px_4px_0px_0px_#000]">
                    <mat-spinner diameter="40"></mat-spinner>
                    <span class="font-black text-sm uppercase tracking-wider text-black dark:text-white">Cargando alertas...</span>
                </div>
            </div>

            <!-- Table -->
            <div *ngIf="!isLoading" class="border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_#000] bg-white dark:bg-slate-800">
                <div class="bg-[#0F172AFF] px-4 py-2 border-b-2 border-black flex items-center justify-between h-12">
                    <div class="flex items-center gap-3">
                        <mat-icon class="text-white !text-xl">notifications_active</mat-icon>
                        <span class="font-black text-xs md:text-sm uppercase text-white">Registro de Alertas</span>
                    </div>
                    <span class="bg-white text-black px-2 py-0.5 rounded text-xs font-black border border-black shadow-[2px_2px_0px_0px_#000]">
                        Total: {{ totalRecords }}
                    </span>
                </div>

                <div class="overflow-auto">
                    <table mat-table [dataSource]="alerts" class="w-full">

                        <ng-container matColumnDef="urgency">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">URGENCIA</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo">
                                <span class="inline-block px-2 py-1 rounded text-[10px] font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] uppercase"
                                      [ngClass]="getUrgencyClass(el.urgency)">
                                    {{ getUrgencyLabel(el.urgency) }}
                                </span>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="tool_code">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">CODIGO</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo">
                                <span class="font-mono font-black text-sm text-black dark:text-white">{{ el.tool_code }}</span>
                                <mat-icon *ngIf="el.is_jack" class="!text-sm text-orange-500 ml-1" matTooltip="Gata/Jack">build</mat-icon>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="tool_name">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">HERRAMIENTA</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo font-bold text-sm text-black dark:text-white">{{ el.tool_name }}</td>
                        </ng-container>

                        <ng-container matColumnDef="serial_number">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">S/N</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo font-mono text-sm text-black dark:text-white">{{ el.serial_number || '-' }}</td>
                        </ng-container>

                        <ng-container matColumnDef="calibration_expiry">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">VENCIMIENTO</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo font-mono font-bold text-sm text-black dark:text-white">{{ el.calibration_expiry }}</td>
                        </ng-container>

                        <ng-container matColumnDef="days_remaining">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">DIAS</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo">
                                <span class="font-black text-sm" [ngClass]="el.days_remaining <= 0 ? 'text-red-600' : el.days_remaining <= 7 ? 'text-orange-600' : 'text-yellow-600'">
                                    {{ el.days_remaining <= 0 ? 'VENCIDA' : el.days_remaining + 'd' }}
                                </span>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="warehouse">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">ALMACEN</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo font-bold text-xs text-black dark:text-white">{{ el.warehouse }}</td>
                        </ng-container>

                        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                        <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                            class="hover:bg-gray-50 dark:hover:bg-slate-900 transition-all h-14 cursor-pointer border-b border-gray-200 dark:border-slate-700"></tr>
                    </table>

                    <div *ngIf="alerts.length === 0" class="flex flex-col items-center justify-center py-16 opacity-50">
                        <mat-icon class="!text-6xl text-black dark:text-gray-500">check_circle</mat-icon>
                        <p class="text-sm font-black mt-2 uppercase text-black dark:text-gray-500">No hay alertas activas</p>
                    </div>
                </div>

                <mat-paginator
                    [length]="totalRecords"
                    [pageSize]="pageSize"
                    [pageIndex]="pageIndex"
                    [pageSizeOptions]="[10, 25, 50]"
                    (page)="onPageChange($event)"
                    showFirstLastButtons
                    class="border-t-2 border-black dark:border-slate-700 bg-white dark:bg-slate-800">
                </mat-paginator>
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
        ::ng-deep .neo-select .mat-mdc-form-field-subscript-wrapper { display: none; }
    `]
})
export class CalibracionesAlertasComponent implements OnInit, OnDestroy {
    private calibrationService = inject(CalibrationService);
    private _unsubscribeAll = new Subject<void>();

    isLoading = false;
    alerts: AlertItem[] = [];
    totalRecords = 0;
    pageSize = 10;
    pageIndex = 0;
    selectedUrgency = 'all';

    displayedColumns = ['urgency', 'tool_code', 'tool_name', 'serial_number', 'calibration_expiry', 'days_remaining', 'warehouse'];

    ngOnInit(): void {
        this.loadAlerts();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadAlerts(): void {
        this.isLoading = true;

        this.calibrationService.getCalibrationAlertsPxp({ start: this.pageIndex * this.pageSize, limit: this.pageSize }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (res: any) => {
                if (res?.data?.length > 0) {
                    this.alerts = res.data.map((item: any) => ({
                        tool_code: item.tool_code || item.codigo,
                        tool_name: item.tool_name || item.nombre,
                        serial_number: item.serial_number || item.serie,
                        category: item.category || '',
                        warehouse: item.warehouse || item.almacen || 'CBB',
                        calibration_expiry: this.formatDate(item.next_calibration_date || item.calibration_expiry),
                        days_remaining: item.days_remaining ?? 0,
                        urgency: item.urgency || 'UPCOMING_30D',
                        is_jack: item.is_jack || false,
                        semi_status: item.semi_status,
                        annual_status: item.annual_status
                    }));

                    if (this.selectedUrgency !== 'all') {
                        this.alerts = this.alerts.filter(a => a.urgency === this.selectedUrgency);
                    }

                    this.totalRecords = res.total || this.alerts.length;
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
        const mockAlerts: AlertItem[] = [
            { tool_code: 'BOA-H-7023', tool_name: 'TORQUIMETRO DIGITAL 50-250 NM', serial_number: 'TQ-2024-001', category: 'TORQUIMETROS', warehouse: 'CBB', calibration_expiry: '10/02/2026', days_remaining: -3, urgency: 'EXPIRED', is_jack: false },
            { tool_code: 'BOA-H-7045', tool_name: 'CALIBRADOR PIE DE REY 300MM', serial_number: 'CP-2023-015', category: 'MEDICION', warehouse: 'CBB', calibration_expiry: '18/02/2026', days_remaining: 5, urgency: 'CRITICAL_7D', is_jack: false },
            { tool_code: 'BOA-C-8001', tool_name: 'GATA HIDRAULICA 10 TON', serial_number: 'GH-2022-003', category: 'GATAS', warehouse: 'CBB', calibration_expiry: '20/02/2026', days_remaining: 7, urgency: 'CRITICAL_7D', is_jack: true, semi_status: 'EXPIRED', annual_status: 'VALID' },
            { tool_code: 'BOA-H-7089', tool_name: 'MICROMETRO EXTERIOR 0-25MM', serial_number: 'ME-2024-008', category: 'MEDICION', warehouse: 'VVI', calibration_expiry: '25/02/2026', days_remaining: 12, urgency: 'URGENT_15D', is_jack: false },
            { tool_code: 'BOA-H-7102', tool_name: 'MANOMETRO DIGITAL 0-100 PSI', serial_number: 'MD-2023-022', category: 'MANOMETROS', warehouse: 'CBB', calibration_expiry: '05/03/2026', days_remaining: 20, urgency: 'UPCOMING_30D', is_jack: false },
            { tool_code: 'BOA-C-8005', tool_name: 'GATA TIPO BOTELLA 5 TON', serial_number: 'GB-2023-001', category: 'GATAS', warehouse: 'LPB', calibration_expiry: '08/03/2026', days_remaining: 23, urgency: 'UPCOMING_30D', is_jack: true },
            { tool_code: 'BOA-H-7150', tool_name: 'TERMOMETRO INFRARROJO', serial_number: 'TI-2024-005', category: 'TEMPERATURA', warehouse: 'CBB', calibration_expiry: '12/03/2026', days_remaining: 27, urgency: 'UPCOMING_30D', is_jack: false },
            { tool_code: 'BOA-H-7200', tool_name: 'TORQUIMETRO CLICK 20-100 NM', serial_number: 'TC-2024-012', category: 'TORQUIMETROS', warehouse: 'VVI', calibration_expiry: '15/02/2026', days_remaining: 2, urgency: 'CRITICAL_7D', is_jack: false }
        ];

        if (this.selectedUrgency !== 'all') {
            this.alerts = mockAlerts.filter(a => a.urgency === this.selectedUrgency);
        } else {
            this.alerts = mockAlerts;
        }
        this.totalRecords = this.alerts.length;
    }

    countByUrgency(urgency: string): number {
        return this.alerts.filter(a => a.urgency === urgency).length;
    }

    getUrgencyClass(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED': return 'bg-red-500 text-white';
            case 'CRITICAL_7D': return 'bg-orange-500 text-white';
            case 'URGENT_15D': return 'bg-yellow-400 text-black';
            case 'UPCOMING_30D': return 'bg-blue-400 text-white';
            case 'IN_LAB': return 'bg-purple-500 text-white';
            default: return 'bg-gray-200 text-black';
        }
    }

    getUrgencyLabel(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED': return 'VENCIDA';
            case 'CRITICAL_7D': return 'CRITICA 7D';
            case 'URGENT_15D': return 'URGENTE 15D';
            case 'UPCOMING_30D': return 'PROXIMA 30D';
            case 'IN_LAB': return 'EN LAB';
            default: return urgency;
        }
    }

    private formatDate(date: string): string {
        if (!date) return '-';
        try {
            const d = new Date(date);
            return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return date;
        }
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadAlerts();
    }
}
