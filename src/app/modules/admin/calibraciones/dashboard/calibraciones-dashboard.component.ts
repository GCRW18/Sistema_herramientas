import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

interface DashboardMetric {
    label: string;
    value: number;
    icon: string;
    color: string;
    bgColor: string;
    darkBgColor: string;
}

@Component({
    selector: 'app-calibraciones-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatDialogModule,
        DragDropModule
    ],
    template: `
        <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] transition-colors duration-300 font-sans overflow-hidden relative"
             cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragBoundary=".cdk-overlay-container">

            <!-- Spinner Overlay -->
            <div *ngIf="isLoading" class="spinner-overlay z-[100]">
                <div class="neo-card-base p-6 flex flex-col items-center gap-4 bg-white dark:bg-slate-800">
                    <mat-spinner diameter="50"></mat-spinner>
                    <span class="font-black text-black dark:text-white uppercase tracking-wider">Cargando metricas...</span>
                </div>
            </div>

            <!-- Decorative shapes -->
            <div class="fixed top-20 right-10 w-64 h-64 bg-[#111A43] rounded-full border-4 border-black opacity-5 pointer-events-none"></div>
            <div class="fixed bottom-10 left-10 w-32 h-32 bg-red-600 rotate-12 border-4 border-black opacity-5 pointer-events-none"></div>

            <div class="flex-1 flex flex-col p-4 md:p-6 relative h-full overflow-hidden gap-4">

                <!-- Header -->
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 relative z-10">
                    <div class="flex items-center gap-4">
                        <button (click)="goBack()"
                                class="w-12 h-12 bg-white dark:bg-slate-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 hover:bg-white hover:scale-105 transition-all flex items-center justify-center rounded-lg cursor-pointer"
                                (mousedown)="$event.stopPropagation()">
                            <mat-icon class="!text-2xl text-black dark:text-white">arrow_back</mat-icon>
                        </button>
                        <div>
                            <h1 class="text-2xl md:text-3xl font-black text-black dark:text-white uppercase tracking-tight leading-none">
                                Dashboard Calibraciones
                            </h1>
                            <div class="flex items-center gap-2 mt-1">
                                <p class="text-xs font-bold bg-[#1A3EDCFF] text-white px-2 py-0.5 rounded-sm border border-black">
                                    METRICAS EN TIEMPO REAL
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-3 justify-end">
                        <button (click)="loadDashboard()"
                                class="px-4 py-2 bg-[#1A3EDCFF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-2"
                                (mousedown)="$event.stopPropagation()">
                            <mat-icon class="text-white !h-5 !text-lg">refresh</mat-icon>
                            Actualizar
                        </button>
                    </div>
                </div>

                <!-- Scrollable Body -->
                <div class="flex-1 overflow-y-auto custom-scrollbar pb-6 space-y-4 relative z-10">

                    <!-- Calibration Metrics Section -->
                    <div *ngIf="!isLoading" class="neo-card-base p-5 relative z-10 bg-white dark:bg-slate-800">
                        <div class="flex items-center gap-2 mb-4 pb-2 border-b-2 border-black dark:border-gray-600">
                            <mat-icon class="text-black dark:text-white !text-xl">analytics</mat-icon>
                            <h3 class="font-black text-base uppercase text-black dark:text-white">Estado de Calibraciones</h3>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            <div *ngFor="let m of calibrationMetrics"
                                 class="border-2 border-black rounded-xl p-4 transition-all hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#000] shadow-[3px_3px_0px_0px_#000] cursor-default"
                                 [ngClass]="m.bgColor">
                                <div class="flex items-center gap-2 mb-2">
                                    <mat-icon [ngClass]="m.color" class="!text-xl">{{ m.icon }}</mat-icon>
                                </div>
                                <p class="text-3xl font-black text-black leading-none">{{ m.value }}</p>
                                <p class="text-[10px] font-black uppercase tracking-wider text-black/70 mt-1">{{ m.label }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Jack Services Metrics Section -->
                    <div *ngIf="!isLoading" class="neo-card-base p-5 relative z-10 bg-white dark:bg-slate-800">
                        <div class="flex items-center gap-2 mb-4 pb-2 border-b-2 border-black dark:border-gray-600">
                            <mat-icon class="text-black dark:text-white !text-xl">build</mat-icon>
                            <h3 class="font-black text-base uppercase text-black dark:text-white">Estado Servicios Gatas</h3>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            <div *ngFor="let m of jackMetrics"
                                 class="border-2 border-black rounded-xl p-4 transition-all hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#000] shadow-[3px_3px_0px_0px_#000] cursor-default"
                                 [ngClass]="m.bgColor">
                                <div class="flex items-center gap-2 mb-2">
                                    <mat-icon [ngClass]="m.color" class="!text-xl">{{ m.icon }}</mat-icon>
                                </div>
                                <p class="text-3xl font-black text-black leading-none">{{ m.value }}</p>
                                <p class="text-[10px] font-black uppercase tracking-wider text-black/70 mt-1">{{ m.label }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Quick Actions Section -->
                    <div *ngIf="!isLoading" class="neo-card-base p-5 relative z-10 bg-white dark:bg-slate-800">
                        <div class="flex items-center gap-2 mb-4 pb-2 border-b-2 border-black dark:border-gray-600">
                            <mat-icon class="text-black dark:text-white !text-xl">flash_on</mat-icon>
                            <h3 class="font-black text-base uppercase text-black dark:text-white">Acciones Rapidas</h3>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <button routerLink="/calibraciones/alertas"
                                    class="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#000] active:shadow-none transition-all text-left"
                                    (mousedown)="$event.stopPropagation()">
                                <mat-icon class="text-[#e94125] !text-2xl">notifications_active</mat-icon>
                                <div>
                                    <p class="font-black text-sm text-black dark:text-white uppercase">Ver Alertas</p>
                                    <p class="text-[10px] font-bold text-gray-500">Herramientas por vencer</p>
                                </div>
                            </button>
                            <button routerLink="/calibraciones/laboratorios"
                                    class="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#000] active:shadow-none transition-all text-left"
                                    (mousedown)="$event.stopPropagation()">
                                <mat-icon class="text-[#7113CFFF] !text-2xl">business</mat-icon>
                                <div>
                                    <p class="font-black text-sm text-black dark:text-white uppercase">Laboratorios</p>
                                    <p class="text-[10px] font-bold text-gray-500">Gestionar proveedores</p>
                                </div>
                            </button>
                            <button routerLink="/calibraciones/servicios-gatas"
                                    class="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#000] active:shadow-none transition-all text-left"
                                    (mousedown)="$event.stopPropagation()">
                                <mat-icon class="text-[#FF6A00FF] !text-2xl">build</mat-icon>
                                <div>
                                    <p class="font-black text-sm text-black dark:text-white uppercase">Servicios Gatas</p>
                                    <p class="text-[10px] font-bold text-gray-500">Control semestrales/anuales</p>
                                </div>
                            </button>
                            <button routerLink="/calibraciones/reportes"
                                    class="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#000] active:shadow-none transition-all text-left"
                                    (mousedown)="$event.stopPropagation()">
                                <mat-icon class="text-[#1AAA1FFF] !text-2xl">description</mat-icon>
                                <div>
                                    <p class="font-black text-sm text-black dark:text-white uppercase">Reportes MGH</p>
                                    <p class="text-[10px] font-bold text-gray-500">Generar informes</p>
                                </div>
                            </button>
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

        :host-context(.dark) {
            color-scheme: dark;
        }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base {
            background-color: #1e293b !important;
        }

        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
        }
        :host-context(.dark) .spinner-overlay {
            background: rgba(0,0,0,0.7);
        }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
    `]
})
export class CalibracionesDashboardComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<CalibracionesDashboardComponent>, { optional: true });
    private calibrationService = inject(CalibrationService);
    private _unsubscribeAll = new Subject<void>();

    isLoading = false;
    calibrationMetrics: DashboardMetric[] = [];
    jackMetrics: DashboardMetric[] = [];

    ngOnInit(): void {
        this.loadDashboard();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    goBack(): void {
        this.dialogRef ? this.dialogRef.close() : null;
    }

    loadDashboard(): void {
        this.isLoading = true;

        this.calibrationService.getCalibrationDashboardPxp().pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (data: any) => {
                this.calibrationMetrics = [
                    { label: 'Vigentes', value: data?.valid || 0, icon: 'check_circle', color: 'text-green-600', bgColor: 'bg-green-100', darkBgColor: 'dark:bg-green-900/30' },
                    { label: 'Vencen 30d', value: data?.expiring_30d || 0, icon: 'schedule', color: 'text-yellow-600', bgColor: 'bg-yellow-100', darkBgColor: 'dark:bg-yellow-900/30' },
                    { label: 'Vencen 7d', value: data?.expiring_7d || 0, icon: 'warning', color: 'text-orange-600', bgColor: 'bg-orange-100', darkBgColor: 'dark:bg-orange-900/30' },
                    { label: 'Vencidas', value: data?.expired || 0, icon: 'error', color: 'text-red-600', bgColor: 'bg-red-100', darkBgColor: 'dark:bg-red-900/30' },
                    { label: 'En laboratorio', value: data?.in_lab || 0, icon: 'science', color: 'text-blue-600', bgColor: 'bg-blue-100', darkBgColor: 'dark:bg-blue-900/30' },
                    { label: 'Lotes abiertos', value: data?.open_batches || 0, icon: 'inventory_2', color: 'text-purple-600', bgColor: 'bg-purple-100', darkBgColor: 'dark:bg-purple-900/30' }
                ];

                this.jackMetrics = [
                    { label: 'Semi. Vencidos', value: data?.semi_expired || 0, icon: 'error', color: 'text-red-600', bgColor: 'bg-red-100', darkBgColor: 'dark:bg-red-900/30' },
                    { label: 'Semi. Prox. 30d', value: data?.semi_expiring_30d || 0, icon: 'schedule', color: 'text-orange-600', bgColor: 'bg-orange-100', darkBgColor: 'dark:bg-orange-900/30' },
                    { label: 'Anual Vencidos', value: data?.annual_expired || 0, icon: 'error_outline', color: 'text-red-600', bgColor: 'bg-red-100', darkBgColor: 'dark:bg-red-900/30' },
                    { label: 'Anual Prox. 30d', value: data?.annual_expiring_30d || 0, icon: 'access_time', color: 'text-yellow-600', bgColor: 'bg-yellow-100', darkBgColor: 'dark:bg-yellow-900/30' },
                    { label: 'Total Gatas', value: data?.total_jacks || 0, icon: 'build', color: 'text-slate-600', bgColor: 'bg-slate-100', darkBgColor: 'dark:bg-slate-900/30' }
                ];
            },
            error: () => {
                this.loadMockData();
            }
        });
    }

    private loadMockData(): void {
        this.calibrationMetrics = [
            { label: 'Vigentes',       value: 0, icon: 'check_circle',  color: 'text-green-600',  bgColor: 'bg-green-100',  darkBgColor: '' },
            { label: 'Vencen 30d',     value: 0, icon: 'schedule',      color: 'text-yellow-600', bgColor: 'bg-yellow-100', darkBgColor: '' },
            { label: 'Vencen 7d',      value: 0, icon: 'warning',       color: 'text-orange-600', bgColor: 'bg-orange-100', darkBgColor: '' },
            { label: 'Vencidas',       value: 0, icon: 'error',         color: 'text-red-600',    bgColor: 'bg-red-100',    darkBgColor: '' },
            { label: 'En laboratorio', value: 0, icon: 'science',       color: 'text-blue-600',   bgColor: 'bg-blue-100',   darkBgColor: '' },
            { label: 'Lotes abiertos', value: 0, icon: 'inventory_2',   color: 'text-purple-600', bgColor: 'bg-purple-100', darkBgColor: '' }
        ];

        this.jackMetrics = [
            { label: 'Semi. Vencidos',  value: 0, icon: 'error',        color: 'text-red-600',    bgColor: 'bg-red-100',    darkBgColor: '' },
            { label: 'Semi. Prox. 30d', value: 0, icon: 'schedule',     color: 'text-orange-600', bgColor: 'bg-orange-100', darkBgColor: '' },
            { label: 'Anual Vencidos',  value: 0, icon: 'error_outline', color: 'text-red-600',   bgColor: 'bg-red-100',    darkBgColor: '' },
            { label: 'Anual Prox. 30d', value: 0, icon: 'access_time',  color: 'text-yellow-600', bgColor: 'bg-yellow-100', darkBgColor: '' },
            { label: 'Total Gatas',     value: 0, icon: 'build',        color: 'text-slate-600',  bgColor: 'bg-slate-100',  darkBgColor: '' }
        ];
    }
}
