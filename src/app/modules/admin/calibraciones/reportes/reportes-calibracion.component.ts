import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

interface ReportType {
    id: string;
    title: string;
    description: string;
    icon: string;
    color: string;
}

@Component({
    selector: 'app-reportes-calibracion',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatSnackBarModule,
        MatTableModule
    ],
    template: `
        <div class="flex flex-col gap-6 p-2">

            <!-- Header -->
            <div>
                <h2 class="text-2xl md:text-3xl font-black text-black dark:text-white uppercase tracking-tight">
                    Reportes de Calibracion
                </h2>
                <p class="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1">
                    Generacion de reportes MGH para control y auditoria
                </p>
            </div>

            <!-- Report Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div *ngFor="let report of reportTypes"
                     (click)="selectReport(report)"
                     class="border-3 border-black rounded-2xl p-5 cursor-pointer transition-all hover:translate-y-[-3px] shadow-[4px_4px_0px_0px_#000] hover:shadow-[7px_7px_0px_0px_#000] active:shadow-[2px_2px_0px_0px_#000] active:translate-y-0"
                     [ngClass]="selectedReport?.id === report.id ? report.color + ' ring-4 ring-black' : 'bg-white dark:bg-slate-800'">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 flex items-center justify-center bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
                            <mat-icon class="text-black !text-2xl">{{ report.icon }}</mat-icon>
                        </div>
                        <div class="flex-1">
                            <p class="font-black text-sm uppercase text-black dark:text-white tracking-wide">{{ report.title }}</p>
                            <p class="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">{{ report.description }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Report Config Panel -->
            <div *ngIf="selectedReport" class="border-3 border-black rounded-2xl bg-white dark:bg-slate-800 shadow-[6px_6px_0px_0px_#000] overflow-hidden">
                <div class="px-5 py-3 border-b-2 border-black flex items-center justify-between"
                     [ngClass]="selectedReport.color">
                    <span class="font-black text-sm uppercase text-black tracking-wider">
                        {{ selectedReport.title }}
                    </span>
                    <button (click)="selectedReport = null"
                            class="w-8 h-8 flex items-center justify-center bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:scale-110 active:shadow-none transition-all">
                        <mat-icon class="text-black !text-lg">close</mat-icon>
                    </button>
                </div>

                <div class="p-5">
                    <!-- MGH-102 Config -->
                    <div *ngIf="selectedReport.id === 'mgh102'" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <mat-form-field appearance="outline">
                            <mat-label>Almacen</mat-label>
                            <mat-select [(ngModel)]="reportConfig.warehouse">
                                <mat-option value="all">Todos</mat-option>
                                <mat-option value="CBB">Cochabamba</mat-option>
                                <mat-option value="VVI">Santa Cruz</mat-option>
                                <mat-option value="LPB">La Paz</mat-option>
                            </mat-select>
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                            <mat-label>Categoria</mat-label>
                            <mat-select [(ngModel)]="reportConfig.category">
                                <mat-option value="all">Todas</mat-option>
                                <mat-option value="TORQUIMETROS">Torquimetros</mat-option>
                                <mat-option value="MEDICION">Medicion</mat-option>
                                <mat-option value="GATAS">Gatas</mat-option>
                                <mat-option value="MANOMETROS">Manometros</mat-option>
                                <mat-option value="TEMPERATURA">Temperatura</mat-option>
                            </mat-select>
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                            <mat-label>Estado</mat-label>
                            <mat-select [(ngModel)]="reportConfig.status">
                                <mat-option value="all">Todos</mat-option>
                                <mat-option value="vigente">Vigente</mat-option>
                                <mat-option value="por_vencer">Por Vencer</mat-option>
                                <mat-option value="vencida">Vencida</mat-option>
                            </mat-select>
                        </mat-form-field>
                    </div>

                    <!-- MGH-103 Config -->
                    <div *ngIf="selectedReport.id === 'mgh103'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <mat-form-field appearance="outline">
                            <mat-label>Mes Inicio</mat-label>
                            <input matInput [matDatepicker]="startPicker" [(ngModel)]="reportConfig.startDate">
                            <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
                            <mat-datepicker #startPicker startView="year"></mat-datepicker>
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                            <mat-label>Mes Fin</mat-label>
                            <input matInput [matDatepicker]="endPicker" [(ngModel)]="reportConfig.endDate">
                            <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
                            <mat-datepicker #endPicker startView="year"></mat-datepicker>
                        </mat-form-field>
                    </div>

                    <!-- MGH-104 Config -->
                    <div *ngIf="selectedReport.id === 'mgh104'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <mat-form-field appearance="outline">
                            <mat-label>Dias de anticipacion</mat-label>
                            <mat-select [(ngModel)]="reportConfig.days">
                                <mat-option [value]="7">7 dias</mat-option>
                                <mat-option [value]="15">15 dias</mat-option>
                                <mat-option [value]="30">30 dias</mat-option>
                                <mat-option [value]="60">60 dias</mat-option>
                                <mat-option [value]="90">90 dias</mat-option>
                            </mat-select>
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                            <mat-label>Almacen</mat-label>
                            <mat-select [(ngModel)]="reportConfig.warehouse">
                                <mat-option value="all">Todos</mat-option>
                                <mat-option value="CBB">Cochabamba</mat-option>
                                <mat-option value="VVI">Santa Cruz</mat-option>
                                <mat-option value="LPB">La Paz</mat-option>
                            </mat-select>
                        </mat-form-field>
                    </div>

                    <!-- Actions -->
                    <div class="flex flex-wrap gap-3 mt-4">
                        <button (click)="generateReport()"
                                [disabled]="isGenerating"
                                class="px-5 py-2 bg-[#1A3EDCFF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-2 disabled:opacity-50">
                            <mat-icon class="text-white !h-5 !text-lg" *ngIf="!isGenerating">play_arrow</mat-icon>
                            <mat-spinner *ngIf="isGenerating" diameter="18" class="mr-1"></mat-spinner>
                            {{ isGenerating ? 'Generando...' : 'Generar Reporte' }}
                        </button>
                        <button (click)="exportToExcel()"
                                *ngIf="reportGenerated"
                                class="px-5 py-2 bg-[#1AAA1FFF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-2">
                            <mat-icon class="text-white !h-5 !text-lg">download</mat-icon>
                            Excel
                        </button>
                        <button (click)="exportToPDF()"
                                *ngIf="reportGenerated"
                                class="px-5 py-2 bg-[#e94125] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-2">
                            <mat-icon class="text-white !h-5 !text-lg">picture_as_pdf</mat-icon>
                            PDF
                        </button>
                    </div>
                </div>
            </div>

            <!-- Report Preview -->
            <div *ngIf="reportGenerated" class="border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_#000] bg-white dark:bg-slate-800">
                <div class="bg-[#0F172AFF] px-4 py-2 border-b-2 border-black flex items-center justify-between h-12">
                    <div class="flex items-center gap-3">
                        <mat-icon class="text-white !text-xl">description</mat-icon>
                        <span class="font-black text-xs md:text-sm uppercase text-white">Vista Previa</span>
                    </div>
                    <span class="bg-white text-black px-2 py-0.5 rounded text-xs font-black border border-black shadow-[2px_2px_0px_0px_#000]">
                        {{ reportData.length }} registros
                    </span>
                </div>

                <div class="overflow-auto max-h-[400px]">
                    <table mat-table [dataSource]="reportData" class="w-full">
                        <ng-container *ngFor="let col of reportColumns" [matColumnDef]="col.key">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">{{ col.label }}</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo text-sm text-black dark:text-white">{{ el[col.key] }}</td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="reportColumnKeys"></tr>
                        <tr mat-row *matRowDef="let row; columns: reportColumnKeys;"
                            class="hover:bg-gray-50 dark:hover:bg-slate-900 transition-all h-12 border-b border-gray-200 dark:border-slate-700"></tr>
                    </table>
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
            font-size: 11px !important;
            border-bottom: 3px solid black !important;
            padding: 14px 10px !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .cell-neo {
            padding: 12px 10px !important;
            border-bottom: 1px solid #e5e7eb !important;
            font-size: 12px !important;
        }
        :host-context(.dark) .header-neo { background-color: #111A43 !important; color: white !important; }
        :host-context(.dark) .cell-neo { border-bottom-color: #334155 !important; }
    `]
})
export class ReportesCalibracionComponent implements OnInit, OnDestroy {
    private calibrationService = inject(CalibrationService);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    isGenerating = false;
    reportGenerated = false;
    selectedReport: ReportType | null = null;
    reportData: any[] = [];
    reportColumns: { key: string; label: string }[] = [];
    reportColumnKeys: string[] = [];

    reportConfig: any = {
        warehouse: 'all',
        category: 'all',
        status: 'all',
        days: 30,
        startDate: new Date(new Date().getFullYear(), 0, 1),
        endDate: new Date()
    };

    reportTypes: ReportType[] = [
        {
            id: 'mgh102',
            title: 'MGH-102',
            description: 'Listado de herramientas sujetas a calibracion con estado actual, fechas y laboratorio',
            icon: 'list_alt',
            color: 'bg-blue-100'
        },
        {
            id: 'mgh103',
            title: 'MGH-103',
            description: 'Reporte mensual de calibraciones realizadas, costos y tiempos de respuesta',
            icon: 'calendar_month',
            color: 'bg-green-100'
        },
        {
            id: 'mgh104',
            title: 'MGH-104',
            description: 'Herramientas proximas a vencer calibracion con dias restantes y urgencia',
            icon: 'notification_important',
            color: 'bg-orange-100'
        }
    ];

    ngOnInit(): void {}

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    selectReport(report: ReportType): void {
        this.selectedReport = report;
        this.reportGenerated = false;
        this.reportData = [];
    }

    generateReport(): void {
        if (!this.selectedReport) return;

        this.isGenerating = true;
        this.reportGenerated = false;

        const mockTimeout = setTimeout(() => {
            switch (this.selectedReport!.id) {
                case 'mgh102':
                    this.reportColumns = [
                        { key: 'code', label: 'Codigo' },
                        { key: 'name', label: 'Herramienta' },
                        { key: 'serial', label: 'S/N' },
                        { key: 'category', label: 'Categoria' },
                        { key: 'last_cal', label: 'Ult. Calibracion' },
                        { key: 'next_cal', label: 'Prox. Calibracion' },
                        { key: 'status', label: 'Estado' },
                        { key: 'lab', label: 'Laboratorio' }
                    ];
                    this.reportData = [
                        { code: 'BOA-H-7023', name: 'TORQUIMETRO DIGITAL 50-250 NM', serial: 'TQ-2024-001', category: 'TORQUIMETROS', last_cal: '10/02/2025', next_cal: '10/02/2026', status: 'VENCIDA', lab: 'METROTEST' },
                        { code: 'BOA-H-7045', name: 'CALIBRADOR PIE DE REY 300MM', serial: 'CP-2023-015', category: 'MEDICION', last_cal: '18/02/2025', next_cal: '18/02/2026', status: 'CRITICA', lab: 'METROTEST' },
                        { code: 'BOA-C-8001', name: 'GATA HIDRAULICA 10 TON', serial: 'GH-2022-003', category: 'GATAS', last_cal: '20/06/2025', next_cal: '20/06/2026', status: 'VIGENTE', lab: 'METROLOGIA IND.' },
                        { code: 'BOA-H-7089', name: 'MICROMETRO EXTERIOR 0-25MM', serial: 'ME-2024-008', category: 'MEDICION', last_cal: '25/08/2025', next_cal: '25/02/2026', status: 'URGENTE', lab: 'METROTEST' },
                        { code: 'BOA-H-7102', name: 'MANOMETRO DIGITAL 0-100 PSI', serial: 'MD-2023-022', category: 'MANOMETROS', last_cal: '05/03/2025', next_cal: '05/03/2026', status: 'PROXIMA', lab: 'CALIBRA TECH' }
                    ];
                    break;

                case 'mgh103':
                    this.reportColumns = [
                        { key: 'month', label: 'Mes' },
                        { key: 'sent', label: 'Enviadas' },
                        { key: 'returned', label: 'Retornadas' },
                        { key: 'approved', label: 'Aprobadas' },
                        { key: 'rejected', label: 'Rechazadas' },
                        { key: 'cost', label: 'Costo Total (Bs)' },
                        { key: 'avg_days', label: 'Dias Prom.' }
                    ];
                    this.reportData = [
                        { month: 'ENE 2026', sent: 12, returned: 10, approved: 9, rejected: 1, cost: '15,400', avg_days: 18 },
                        { month: 'FEB 2026', sent: 8, returned: 6, approved: 6, rejected: 0, cost: '9,200', avg_days: 15 }
                    ];
                    break;

                case 'mgh104':
                    this.reportColumns = [
                        { key: 'code', label: 'Codigo' },
                        { key: 'name', label: 'Herramienta' },
                        { key: 'expiry', label: 'Vencimiento' },
                        { key: 'days', label: 'Dias Rest.' },
                        { key: 'urgency', label: 'Urgencia' },
                        { key: 'warehouse', label: 'Almacen' }
                    ];
                    this.reportData = [
                        { code: 'BOA-H-7023', name: 'TORQUIMETRO DIGITAL 50-250 NM', expiry: '10/02/2026', days: -3, urgency: 'VENCIDA', warehouse: 'CBB' },
                        { code: 'BOA-H-7045', name: 'CALIBRADOR PIE DE REY 300MM', expiry: '18/02/2026', days: 5, urgency: 'CRITICA 7D', warehouse: 'CBB' },
                        { code: 'BOA-H-7089', name: 'MICROMETRO EXTERIOR 0-25MM', expiry: '25/02/2026', days: 12, urgency: 'URGENTE 15D', warehouse: 'VVI' },
                        { code: 'BOA-H-7102', name: 'MANOMETRO DIGITAL 0-100 PSI', expiry: '05/03/2026', days: 20, urgency: 'PROXIMA 30D', warehouse: 'CBB' },
                        { code: 'BOA-H-7150', name: 'TERMOMETRO INFRARROJO', expiry: '12/03/2026', days: 27, urgency: 'PROXIMA 30D', warehouse: 'CBB' }
                    ];
                    break;
            }

            this.reportColumnKeys = this.reportColumns.map(c => c.key);
            this.reportGenerated = true;
            this.isGenerating = false;
        }, 1200);
    }

    exportToExcel(): void {
        this.snackBar.open('Exportando a Excel...', 'Cerrar', { duration: 2000, horizontalPosition: 'end', verticalPosition: 'top' });

        this.calibrationService.exportReportToExcel(this.selectedReport!.id, this.reportConfig).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (blob: any) => {
                if (blob instanceof Blob) {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${this.selectedReport!.title}_${new Date().toISOString().split('T')[0]}.xlsx`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                }
                this.snackBar.open('Reporte Excel generado', 'Cerrar', { duration: 3000, panelClass: ['snackbar-success'] });
            },
            error: () => {
                this.snackBar.open('Exportacion no disponible en modo offline', 'Cerrar', { duration: 3000 });
            }
        });
    }

    exportToPDF(): void {
        this.snackBar.open('Exportando a PDF...', 'Cerrar', { duration: 2000, horizontalPosition: 'end', verticalPosition: 'top' });

        this.calibrationService.exportReportToPDF(this.selectedReport!.id, this.reportConfig).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (blob: any) => {
                if (blob instanceof Blob) {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${this.selectedReport!.title}_${new Date().toISOString().split('T')[0]}.pdf`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                }
                this.snackBar.open('Reporte PDF generado', 'Cerrar', { duration: 3000, panelClass: ['snackbar-success'] });
            },
            error: () => {
                this.snackBar.open('Exportacion no disponible en modo offline', 'Cerrar', { duration: 3000 });
            }
        });
    }
}
