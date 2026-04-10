import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Observable, Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

interface ReportType { id: string; title: string; description: string; icon: string; color: string; }
interface AlertItem {
    tool_code: string; tool_name: string; serial_number: string;
    category: string; warehouse: string; calibration_expiry: string;
    days_remaining: number; urgency: string; is_jack: boolean;
}

@Component({
    selector: 'app-reportes-alertas',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatIconModule,
        MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule
    ],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] font-sans overflow-hidden relative">

        <!-- SPINNER OVERLAY -->
        @if (isGenerating) {
            <div class="spinner-overlay z-[100]">
                <div class="neo-card-base p-6 flex flex-col items-center gap-3 bg-white dark:bg-slate-800">
                    <mat-spinner diameter="40"></mat-spinner>
                    <span class="font-black text-sm uppercase tracking-wider text-black dark:text-white">Generando reporte...</span>
                </div>
            </div>
        }

        <!-- DECORATIVE -->
        <div class="fixed top-16 right-10 w-48 h-48 bg-[#FFC501] rounded-full border-4 border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-28 h-28 bg-[#e94125] rotate-12 border-4 border-black opacity-5 pointer-events-none"></div>

        <!-- MAIN -->
        <div class="flex-1 flex flex-col p-2 gap-2 overflow-hidden h-full relative z-10">

            <!-- HEADER -->
            <div class="flex items-center justify-between gap-2 shrink-0">
                <div class="flex items-center gap-2">
                    <mat-icon class="text-black dark:text-white !text-base">
                        {{ mode === 'reportes' ? 'bar_chart' : 'notifications_active' }}
                    </mat-icon>
                    <h1 class="text-base font-black text-black dark:text-white uppercase tracking-tight leading-none">
                        {{ mode === 'reportes' ? 'Reportes MGH' : 'Alertas de Vencimiento' }}
                    </h1>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-sm border border-black uppercase"
                          [ngClass]="mode === 'reportes' ? 'bg-[#FFC501] text-black' : 'bg-[#e94125] text-white'">
                        {{ mode === 'reportes' ? 'CALIBRACIÓN' : 'VENCIMIENTO' }}
                    </span>
                </div>
            </div>

            <!-- BODY: 2 COLUMNAS -->
            <div class="flex flex-row gap-2 flex-1 overflow-hidden min-h-0">

                <!-- ============================================================ -->
                <!-- PANEL IZQUIERDO                                               -->
                <!-- ============================================================ -->
                <div class="w-[270px] shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar">

                    <!-- Mode toggle -->
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="bg-[#0F172AFF] px-3 py-1.5 border-b-2 border-black">
                            <span class="font-black text-xs uppercase text-white">Vista</span>
                        </div>
                        <div class="p-1.5 flex flex-col gap-1">
                            <button type="button" (click)="setMode('reportes')"
                                    class="flex items-center gap-2 px-3 py-2 rounded-lg border-2 font-black text-xs uppercase transition-all w-full text-left"
                                    [ngClass]="mode === 'reportes'
                                        ? 'bg-[#FFC501] border-black text-black shadow-[2px_2px_0px_0px_#000]'
                                        : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500 text-gray-500 dark:text-gray-300 hover:border-yellow-400'">
                                <mat-icon class="!text-base shrink-0">bar_chart</mat-icon>
                                <div class="leading-tight">
                                    <div>Reportes MGH</div>
                                    <div class="text-[9px] font-bold opacity-70 normal-case">102 · 103 · 104</div>
                                </div>
                            </button>
                            <button type="button" (click)="setMode('alertas')"
                                    class="flex items-center gap-2 px-3 py-2 rounded-lg border-2 font-black text-xs uppercase transition-all w-full text-left"
                                    [ngClass]="mode === 'alertas'
                                        ? 'bg-[#e94125] border-black text-white shadow-[2px_2px_0px_0px_#000]'
                                        : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500 text-gray-500 dark:text-gray-300 hover:border-red-400'">
                                <mat-icon class="!text-base shrink-0">notifications_active</mat-icon>
                                <div class="leading-tight">
                                    <div>Alertas Vencimiento</div>
                                    <div class="text-[9px] font-bold opacity-70 normal-case">Próximas y vencidas</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    <!-- ── REPORTES: selector de tipo ── -->
                    @if (mode === 'reportes') {
                        <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                            <div class="bg-[#FFC501] px-3 py-1.5 border-b-2 border-black">
                                <span class="font-black text-xs uppercase text-black">Tipo de Reporte</span>
                            </div>
                            <div class="p-1.5 flex flex-col gap-1">
                                @for (r of reportTypes; track r.id) {
                                    <button type="button" (click)="selectReport(r)"
                                            class="flex items-start gap-2 px-2 py-2 rounded-lg border-2 transition-all w-full text-left"
                                            [ngClass]="selectedReport?.id === r.id
                                                ? 'border-black bg-[#FFC501] shadow-[2px_2px_0px_0px_#000]'
                                                : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-yellow-400'">
                                        <div class="w-7 h-7 flex items-center justify-center border-2 border-black rounded bg-white shrink-0 shadow-[1px_1px_0px_0px_#000]">
                                            <mat-icon class="!text-sm text-black">{{ r.icon }}</mat-icon>
                                        </div>
                                        <div class="leading-tight min-w-0">
                                            <p class="font-black text-xs text-black dark:text-white">{{ r.title }}</p>
                                            <p class="text-[9px] font-bold text-gray-500 dark:text-gray-400 truncate">{{ r.description }}</p>
                                        </div>
                                    </button>
                                }
                            </div>
                        </div>

                        <!-- Config panel -->
                        @if (selectedReport) {
                            <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                                <div class="px-3 py-1.5 border-b-2 border-black bg-[#111A43] flex items-center justify-between">
                                    <span class="font-black text-xs uppercase text-white">{{ selectedReport.title }} — Config.</span>
                                    <button (click)="selectedReport = null; reportGenerated = false"
                                            class="w-5 h-5 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded border border-white/30 transition-all">
                                        <mat-icon class="text-white !text-xs">close</mat-icon>
                                    </button>
                                </div>
                                <div class="p-2 flex flex-col gap-1.5">

                                    @if (selectedReport.id === 'mgh102') {
                                        <div class="form-group">
                                            <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Almacén</label>
                                            <select [(ngModel)]="reportConfig.warehouse"
                                                    class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                                <option value="all">Todos</option>
                                                <option value="CBB">Cochabamba</option>
                                                <option value="VVI">Santa Cruz</option>
                                                <option value="LPB">La Paz</option>
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Categoría</label>
                                            <select [(ngModel)]="reportConfig.category"
                                                    class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                                <option value="all">Todas</option>
                                                <option value="TORQUIMETROS">Torquimetros</option>
                                                <option value="MEDICION">Medición</option>
                                                <option value="GATAS">Gatas</option>
                                                <option value="MANOMETROS">Manómetros</option>
                                                <option value="TEMPERATURA">Temperatura</option>
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Estado</label>
                                            <select [(ngModel)]="reportConfig.status"
                                                    class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                                <option value="all">Todos</option>
                                                <option value="vigente">Vigente</option>
                                                <option value="por_vencer">Por Vencer</option>
                                                <option value="vencida">Vencida</option>
                                            </select>
                                        </div>
                                    }

                                    @if (selectedReport.id === 'mgh103') {
                                        <div class="grid grid-cols-2 gap-1.5">
                                            <div class="form-group">
                                                <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Fecha inicio</label>
                                                <input type="date" [(ngModel)]="reportConfig.startDateStr"
                                                       class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                            </div>
                                            <div class="form-group">
                                                <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Fecha fin</label>
                                                <input type="date" [(ngModel)]="reportConfig.endDateStr"
                                                       class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                            </div>
                                        </div>
                                    }

                                    @if (selectedReport.id === 'mgh104') {
                                        <div class="grid grid-cols-2 gap-1.5">
                                            <div class="form-group">
                                                <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Horizonte</label>
                                                <select [(ngModel)]="reportConfig.days"
                                                        class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                                    <option [value]="7">7 días</option>
                                                    <option [value]="15">15 días</option>
                                                    <option [value]="30">30 días</option>
                                                    <option [value]="60">60 días</option>
                                                    <option [value]="90">90 días</option>
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Almacén</label>
                                                <select [(ngModel)]="reportConfig.warehouse"
                                                        class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                                    <option value="all">Todos</option>
                                                    <option value="CBB">Cochabamba</option>
                                                    <option value="VVI">Santa Cruz</option>
                                                    <option value="LPB">La Paz</option>
                                                </select>
                                            </div>
                                        </div>
                                    }

                                    <!-- Acciones -->
                                    <div class="flex flex-col gap-1 pt-1 border-t border-gray-200 dark:border-slate-600">
                                        <button type="button" (click)="generateReport()" [disabled]="isGenerating"
                                                class="w-full py-1.5 bg-[#1A3EDCFF] text-white font-black text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center justify-center gap-1 disabled:opacity-50">
                                            <mat-icon class="!text-sm !h-4">play_arrow</mat-icon>
                                            Generar Reporte
                                        </button>
                                        @if (reportGenerated) {
                                            <div class="flex gap-1">
                                                <button type="button" (click)="exportToExcel()"
                                                        class="flex-1 py-1.5 bg-[#1AAA1FFF] text-white font-black text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center justify-center gap-1">
                                                    <mat-icon class="!text-sm !h-4">download</mat-icon>
                                                    Excel
                                                </button>
                                                <button type="button" (click)="exportToPDF()"
                                                        class="flex-1 py-1.5 bg-[#e94125] text-white font-black text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center justify-center gap-1">
                                                    <mat-icon class="!text-sm !h-4">picture_as_pdf</mat-icon>
                                                    PDF
                                                </button>
                                            </div>
                                        }
                                    </div>
                                </div>
                            </div>
                        }
                    }

                    <!-- ── ALERTAS: filtros + resumen ── -->
                    @if (mode === 'alertas') {
                        <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                            <div class="bg-[#e94125] px-3 py-1.5 border-b-2 border-black flex items-center justify-between">
                                <span class="font-black text-xs uppercase text-white">Filtrar urgencia</span>
                                <button (click)="loadAlerts()" [disabled]="isLoadingAlerts"
                                        class="w-6 h-6 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded border border-white/30 transition-all disabled:opacity-50">
                                    <mat-icon class="text-white !text-sm">refresh</mat-icon>
                                </button>
                            </div>
                            <div class="p-2 flex flex-col gap-1.5">
                                <select [(ngModel)]="selectedUrgency" (ngModelChange)="loadAlerts()"
                                        class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                    <option value="all">Todas las urgencias</option>
                                    <option value="EXPIRED">Vencidas</option>
                                    <option value="CRITICAL_7D">Críticas (7d)</option>
                                    <option value="URGENT_15D">Urgentes (15d)</option>
                                    <option value="UPCOMING_30D">Próximas (30d)</option>
                                    <option value="IN_LAB">En laboratorio</option>
                                </select>

                                <!-- Mini summary cards 2x2 -->
                                <div class="grid grid-cols-2 gap-1 mt-0.5">
                                    <div class="rounded-lg border-2 border-black p-1.5 bg-red-100 shadow-[2px_2px_0px_0px_#000]">
                                        <p class="text-xl font-black text-red-800 leading-none">{{ countByUrgency('EXPIRED') }}</p>
                                        <p class="text-[9px] font-black uppercase text-red-600 leading-tight mt-0.5">Vencidas</p>
                                    </div>
                                    <div class="rounded-lg border-2 border-black p-1.5 bg-orange-100 shadow-[2px_2px_0px_0px_#000]">
                                        <p class="text-xl font-black text-orange-800 leading-none">{{ countByUrgency('CRITICAL_7D') }}</p>
                                        <p class="text-[9px] font-black uppercase text-orange-600 leading-tight mt-0.5">Críticas 7d</p>
                                    </div>
                                    <div class="rounded-lg border-2 border-black p-1.5 bg-yellow-100 shadow-[2px_2px_0px_0px_#000]">
                                        <p class="text-xl font-black text-yellow-800 leading-none">{{ countByUrgency('URGENT_15D') }}</p>
                                        <p class="text-[9px] font-black uppercase text-yellow-600 leading-tight mt-0.5">Urgentes 15d</p>
                                    </div>
                                    <div class="rounded-lg border-2 border-black p-1.5 bg-blue-100 shadow-[2px_2px_0px_0px_#000]">
                                        <p class="text-xl font-black text-blue-800 leading-none">{{ countByUrgency('UPCOMING_30D') }}</p>
                                        <p class="text-[9px] font-black uppercase text-blue-600 leading-tight mt-0.5">Próximas 30d</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }

                </div>

                <!-- ============================================================ -->
                <!-- PANEL DERECHO: contenido                                      -->
                <!-- ============================================================ -->
                <div class="flex-1 flex flex-col overflow-hidden h-full">

                    <!-- ── REPORTES: preview ── -->
                    @if (mode === 'reportes') {
                        <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-full">
                            <div class="bg-[#0F172AFF] px-3 py-1.5 border-b-2 border-black flex items-center justify-between shrink-0 h-10">
                                <div class="flex items-center gap-2">
                                    <mat-icon class="text-white !text-xl">description</mat-icon>
                                    <span class="font-black text-xs md:text-sm uppercase text-white">
                                        {{ reportGenerated ? (selectedReport?.title + ' — Vista Previa') : 'Seleccione un reporte y configure los parámetros' }}
                                    </span>
                                </div>
                                @if (reportGenerated) {
                                    <span class="bg-white text-black px-2 py-0.5 rounded text-xs font-black border border-black shadow-[2px_2px_0px_0px_#000]">
                                        {{ reportData.length }} registros
                                    </span>
                                }
                            </div>

                            @if (!reportGenerated) {
                                <div class="flex flex-col items-center justify-center flex-1 opacity-40">
                                    <mat-icon class="!text-6xl text-black dark:text-gray-500">bar_chart</mat-icon>
                                    <p class="text-sm font-black mt-2 uppercase text-black dark:text-gray-500 text-center">
                                        {{ selectedReport ? 'Configure los parámetros y presione "Generar Reporte"' : 'Seleccione un tipo de reporte' }}
                                    </p>
                                </div>
                            }

                            @if (reportGenerated) {
                                <!-- Cabecera fija de tabla -->
                                <div class="grid gap-0 shrink-0 border-b-2 border-black bg-white dark:bg-[#111A43]"
                                     [style.gridTemplateColumns]="'repeat(' + reportColumns.length + ', 1fr)'">
                                    @for (col of reportColumns; track col.key) {
                                        <div class="px-2 py-1.5 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">{{ col.label }}</div>
                                    }
                                </div>
                                <!-- Filas scrollables -->
                                <div class="overflow-y-auto flex-1 custom-scrollbar bg-[#f8f9fc] dark:bg-slate-900/50">
                                    @for (row of reportData; track $index) {
                                        <div class="grid gap-0 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0F172AFF] hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                                             [style.gridTemplateColumns]="'repeat(' + reportColumns.length + ', 1fr)'">
                                            @for (col of reportColumns; track col.key) {
                                                <div class="px-2 py-2 text-xs text-black dark:text-white font-bold truncate">
                                                    {{ row[col.key] ?? '—' }}
                                                </div>
                                            }
                                        </div>
                                    }
                                </div>
                            }
                        </div>
                    }

                    <!-- ── ALERTAS: tabla ── -->
                    @if (mode === 'alertas') {
                        <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-full">
                            <div class="bg-[#0F172AFF] px-3 py-1.5 border-b-2 border-black flex items-center justify-between shrink-0 h-10">
                                <div class="flex items-center gap-2">
                                    <mat-icon class="text-white !text-xl">notifications_active</mat-icon>
                                    <span class="font-black text-xs md:text-sm uppercase text-white">Registro de Alertas</span>
                                </div>
                                <span class="bg-white text-black px-2 py-0.5 rounded text-xs font-black border border-black shadow-[2px_2px_0px_0px_#000]">
                                    Total: {{ alerts.length }}
                                </span>
                            </div>

                            @if (isLoadingAlerts) {
                                <div class="flex flex-col items-center justify-center flex-1">
                                    <mat-spinner diameter="40"></mat-spinner>
                                    <p class="text-xs font-bold mt-3 uppercase animate-pulse text-black dark:text-white">Cargando alertas...</p>
                                </div>
                            }

                            @if (!isLoadingAlerts) {
                                <!-- Cabecera fija -->
                                <div class="grid grid-cols-12 gap-2 px-3 py-1.5 bg-white dark:bg-[#111A43] border-b-2 border-black shrink-0">
                                    <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Urgencia</div>
                                    <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Código</div>
                                    <div class="col-span-3 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Herramienta</div>
                                    <div class="col-span-1 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">S/N</div>
                                    <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Vencimiento</div>
                                    <div class="col-span-1 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 text-center">Días</div>
                                    <div class="col-span-1 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Almacén</div>
                                </div>

                                <div class="overflow-y-auto flex-1 custom-scrollbar bg-[#f8f9fc] dark:bg-slate-900/50">
                                    @if (alerts.length === 0) {
                                        <div class="flex flex-col items-center justify-center h-full opacity-50">
                                            <mat-icon class="!text-6xl text-black dark:text-gray-500">check_circle</mat-icon>
                                            <p class="text-sm font-black mt-2 uppercase text-black dark:text-gray-500">No hay alertas activas</p>
                                        </div>
                                    }
                                    @for (el of alerts; track el.tool_code) {
                                        <div class="grid grid-cols-12 gap-2 px-3 py-2 items-center border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0F172AFF] hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">

                                            <div class="col-span-2">
                                                <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-black border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,0.4)] uppercase"
                                                      [ngClass]="getUrgencyClass(el.urgency)">
                                                    {{ getUrgencyLabel(el.urgency) }}
                                                </span>
                                            </div>

                                            <div class="col-span-2">
                                                <span class="font-mono font-black text-xs text-black dark:text-white">{{ el.tool_code }}</span>
                                                @if (el.is_jack) {
                                                    <mat-icon class="!text-xs text-orange-500 ml-0.5" matTooltip="Gata/Jack">build</mat-icon>
                                                }
                                            </div>

                                            <div class="col-span-3">
                                                <span class="font-bold text-xs text-black dark:text-white truncate block">{{ el.tool_name }}</span>
                                            </div>

                                            <div class="col-span-1">
                                                <span class="font-mono text-xs text-gray-500 dark:text-gray-400 truncate block">{{ el.serial_number || '—' }}</span>
                                            </div>

                                            <div class="col-span-2">
                                                <span class="font-mono font-bold text-xs text-black dark:text-white">{{ el.calibration_expiry }}</span>
                                            </div>

                                            <div class="col-span-1 text-center">
                                                <span class="font-black text-xs"
                                                      [ngClass]="el.days_remaining <= 0 ? 'text-red-600' : el.days_remaining <= 7 ? 'text-orange-600' : 'text-yellow-600'">
                                                    {{ el.days_remaining <= 0 ? 'VENC.' : el.days_remaining + 'd' }}
                                                </span>
                                            </div>

                                            <div class="col-span-1">
                                                <span class="font-bold text-xs text-black dark:text-white">{{ el.warehouse }}</span>
                                            </div>

                                        </div>
                                    }
                                </div>
                            }
                        </div>
                    }

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

        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.85);
            backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class ReportesAlertasComponent implements OnInit, OnDestroy {
    private calibrationService = inject(CalibrationService);
    private snackBar           = inject(MatSnackBar);
    private _unsubscribeAll    = new Subject<void>();

    mode: 'reportes' | 'alertas' = 'reportes';

    // ── Reportes ─────────────────────────────────────────────────────────────
    isGenerating    = false;
    reportGenerated = false;
    selectedReport: ReportType | null = null;
    reportData:    any[] = [];
    reportColumns: { key: string; label: string }[] = [];

    reportConfig: any = {
        warehouse: 'all', category: 'all', status: 'all',
        days: 30,
        startDateStr: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        endDateStr:   new Date().toISOString().split('T')[0]
    };

    reportTypes: ReportType[] = [
        { id: 'mgh102', title: 'MGH-102', description: 'Listado herramientas sujetas a calibración', icon: 'list_alt', color: 'bg-blue-100' },
        { id: 'mgh103', title: 'MGH-103', description: 'Reporte mensual de calibraciones realizadas', icon: 'calendar_month', color: 'bg-green-100' },
        { id: 'mgh104', title: 'MGH-104', description: 'Herramientas próximas a vencer calibración', icon: 'notification_important', color: 'bg-orange-100' }
    ];

    // ── Alertas ──────────────────────────────────────────────────────────────
    isLoadingAlerts = false;
    alerts: AlertItem[] = [];
    selectedUrgency = 'all';

    ngOnInit(): void {
        this.loadAlerts();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    setMode(m: 'reportes' | 'alertas'): void {
        this.mode = m;
        if (m === 'alertas' && this.alerts.length === 0) this.loadAlerts();
    }

    // ── Reportes methods ──────────────────────────────────────────────────────

    selectReport(report: ReportType): void {
        this.selectedReport  = report;
        this.reportGenerated = false;
        this.reportData      = [];
    }

    generateReport(): void {
        if (!this.selectedReport) return;
        this.isGenerating    = true;
        this.reportGenerated = false;

        const reportMap: Record<string, { call$: Observable<any[]>; columns: any[] }> = {
            mgh102: {
                call$: this.calibrationService.getReportMGH102(),
                columns: [
                    { key: 'code', label: 'Código' }, { key: 'name', label: 'Herramienta' },
                    { key: 'serial', label: 'S/N' }, { key: 'category', label: 'Categoría' },
                    { key: 'last_cal', label: 'Últ. Cal.' }, { key: 'next_cal', label: 'Próx. Cal.' },
                    { key: 'status', label: 'Estado' }, { key: 'lab', label: 'Laboratorio' }
                ]
            },
            mgh103: {
                call$: this.calibrationService.getReportMGH103(),
                columns: [
                    { key: 'month', label: 'Mes' }, { key: 'sent', label: 'Enviadas' },
                    { key: 'returned', label: 'Retornadas' }, { key: 'approved', label: 'Aprobadas' },
                    { key: 'rejected', label: 'Rechazadas' }, { key: 'cost', label: 'Costo (Bs)' },
                    { key: 'avg_days', label: 'Días Prom.' }
                ]
            },
            mgh104: {
                call$: this.calibrationService.getReportMGH104(),
                columns: [
                    { key: 'code', label: 'Código' }, { key: 'name', label: 'Herramienta' },
                    { key: 'expiry', label: 'Vencimiento' }, { key: 'days', label: 'Días Rest.' },
                    { key: 'urgency', label: 'Urgencia' }, { key: 'warehouse', label: 'Almacén' }
                ]
            }
        };

        const config = reportMap[this.selectedReport.id];
        if (!config) {
            this.isGenerating = false;
            return;
        }

        this.reportColumns = config.columns;

        config.call$.subscribe({
            next: (data: any[]) => {
                this.reportData      = data;
                this.reportGenerated = true;
                this.isGenerating    = false;
            },
            error: () => {
                this.isGenerating = false;
            }
        });
    }

    exportToExcel(): void {
        this.snackBar.open('Exportando a Excel...', 'Cerrar', { duration: 2000, horizontalPosition: 'end', verticalPosition: 'top' });
        this.calibrationService.exportReportToExcel(this.selectedReport!.id, this.reportConfig).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (blob: any) => {
                if (blob instanceof Blob) {
                    const url = window.URL.createObjectURL(blob);
                    const a   = document.createElement('a');
                    a.href     = url;
                    a.download = `${this.selectedReport!.title}_${new Date().toISOString().split('T')[0]}.xlsx`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                }
                this.snackBar.open('Reporte Excel generado', 'Cerrar', { duration: 3000, panelClass: ['snackbar-success'] });
            },
            error: () => { this.snackBar.open('Error al exportar reporte', 'Cerrar', { duration: 3000, panelClass: ['snackbar-error'] }); }
        });
    }

    exportToPDF(): void {
        if (!this.selectedReport || !this.reportGenerated || this.reportData.length === 0) {
            this.snackBar.open('Genere el reporte primero', 'Cerrar', { duration: 3000 });
            return;
        }
        const w = window.open('', '_blank');
        if (!w) { this.snackBar.open('Permita ventanas emergentes para imprimir', 'Cerrar', { duration: 3000 }); return; }
        let html = '';
        switch (this.selectedReport.id) {
            case 'mgh102': html = this.buildMGH102Html(); break;
            case 'mgh103': html = this.buildMGH103Html(); break;
            case 'mgh104': html = this.buildMGH104Html(); break;
            default:       html = this.buildGenericReportHtml(); break;
        }
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 600);
        this.snackBar.open('Reporte PDF abierto para impresión', 'Cerrar', { duration: 2000, panelClass: ['snackbar-success'] });
    }

    // ── Alertas methods ───────────────────────────────────────────────────────

    loadAlerts(): void {
        this.isLoadingAlerts = true;
        this.calibrationService.getCalibrationAlertsPxp({ start: 0, limit: 100 }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoadingAlerts = false)
        ).subscribe({
            next: (res: any) => {
                const raw: any[] = Array.isArray(res) ? res : (res?.datos || []);
                const data: AlertItem[] = raw.map((item: any) => ({
                    tool_code:          item.tool_code || item.codigo,
                    tool_name:          item.tool_name || item.nombre,
                    serial_number:      item.serial_number || item.serie,
                    category:           item.category || '',
                    warehouse:          item.warehouse || item.almacen || '',
                    calibration_expiry: this.formatDate(item.next_calibration_date || item.calibration_expiry),
                    days_remaining:     item.days_remaining ?? 0,
                    urgency:            item.urgency || 'UPCOMING_30D',
                    is_jack:            item.is_jack || false
                }));
                this.alerts = this.selectedUrgency !== 'all'
                    ? data.filter(a => a.urgency === this.selectedUrgency)
                    : data;
            },
            error: () => {
                this.alerts = [];
                this.snackBar.open('Error al cargar alertas', 'Cerrar', { duration: 3000, panelClass: ['snackbar-error'] });
            }
        });
    }

    countByUrgency(urgency: string): number {
        return this.alerts.filter(a => a.urgency === urgency).length;
    }

    getUrgencyClass(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED':     return 'bg-red-500 text-white';
            case 'CRITICAL_7D': return 'bg-orange-500 text-white';
            case 'URGENT_15D':  return 'bg-yellow-400 text-black';
            case 'UPCOMING_30D':return 'bg-blue-400 text-white';
            case 'IN_LAB':      return 'bg-purple-500 text-white';
            default:            return 'bg-gray-200 text-black';
        }
    }

    getUrgencyLabel(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED':     return 'VENCIDA';
            case 'CRITICAL_7D': return 'CRIT. 7D';
            case 'URGENT_15D':  return 'URG. 15D';
            case 'UPCOMING_30D':return 'PRÓX. 30D';
            case 'IN_LAB':      return 'EN LAB';
            default: return urgency;
        }
    }

    private formatDate(date: string): string {
        if (!date) return '—';
        try { return new Date(date).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
        catch { return date; }
    }

    // ── PDF builders (preserved from original) ─────────────────────────────

    private pdfBaseStyles(): string {
        return `<style>
@page { size: A4 landscape; margin: 12mm 10mm; }
* { box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
.top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
.code-box { border: 2px solid #000; padding: 3px 10px; font-weight: 900; font-size: 13px; display: inline-block; }
h1 { text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase;
     background: #111A43; color: white; padding: 7px 10px; margin: 0 0 6px; border: 1px solid #000; }
.meta { display: flex; gap: 20px; margin-bottom: 6px; font-size: 9px; border: 1px solid #000; padding: 4px 8px; background: #f8fafc; }
.meta span { font-weight: 700; }
table { width: 100%; border-collapse: collapse; border: 1px solid #000; }
th { background: #111A43; color: white; padding: 5px 4px; font-size: 8.5px; font-weight: 900;
     text-transform: uppercase; border: 1px solid #000; text-align: center; }
td { padding: 4px; border: 1px solid #ddd; font-size: 9px; vertical-align: middle; }
tr:nth-child(even) td { background: #f9f9f9; }
.badge-vencida { background: #ef4444; color: white; padding: 2px 6px; border: 1px solid #000; font-weight: 700; font-size: 8px; }
.badge-critica  { background: #f97316; color: white; padding: 2px 6px; border: 1px solid #000; font-weight: 700; font-size: 8px; }
.badge-urgente  { background: #eab308; color: black;  padding: 2px 6px; border: 1px solid #000; font-weight: 700; font-size: 8px; }
.badge-proxima  { background: #3b82f6; color: white;  padding: 2px 6px; border: 1px solid #000; font-weight: 700; font-size: 8px; }
.badge-vigente  { background: #22c55e; color: white;  padding: 2px 6px; border: 1px solid #000; font-weight: 700; font-size: 8px; }
.footer { text-align: center; margin-top: 10px; font-size: 7.5px; color: #888; border-top: 1px dotted #ccc; padding-top: 4px; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>`;
    }

    private buildMGH102Html(): string {
        const now  = new Date().toLocaleString('es-BO');
        const rows = this.reportData.map((item, i) => {
            const cls = item.status?.includes('VENCIDA') ? 'badge-vencida' : item.status?.includes('CRITICA') ? 'badge-critica'
                : item.status?.includes('URGENTE') ? 'badge-urgente' : item.status?.includes('PROXIMA') ? 'badge-proxima' : 'badge-vigente';
            return `<tr><td style="text-align:center">${i + 1}</td><td style="font-weight:700">${item.code || '-'}</td>
<td>${item.name || '-'}</td><td></td><td>${item.serial || '-'}</td><td>${item.category || '-'}</td>
<td></td><td style="text-align:center">1</td><td style="text-align:center">${item.next_cal || '-'}</td>
<td style="text-align:center">&nbsp;</td><td><span class="${cls}">${item.status || '-'}</span></td></tr>`;
        }).join('');
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MGH-102</title>${this.pdfBaseStyles()}</head><body>
<div class="top"><div style="font-weight:900;font-size:11px">BoAMM &nbsp; OMA145 &nbsp; N-014</div>
<div style="text-align:center;font-size:13px;font-weight:900">LISTADO DE HERRAMIENTAS SUJETAS A CALIBRACIÓN</div>
<div style="text-align:right"><div class="code-box">MGH-102</div><br><span style="font-size:9px">REV. 0 &nbsp; 2016-10-25</span></div></div>
<div class="meta"><div>Generado por: <span>SISTEMA DE HERRAMIENTAS BOA</span></div>
<div>BASE: <span>${this.reportConfig.warehouse !== 'all' ? this.reportConfig.warehouse : 'TODAS'}</span></div>
<div>Fecha: <span>${now}</span></div><div>Total: <span>${this.reportData.length} herramientas</span></div></div>
<table><thead><tr><th>NRO</th><th>CÓDIGO</th><th>NOMBRE</th><th>MODELO/P/N</th><th>S/N</th>
<th>UBICACIÓN</th><th>LISTA CONTENIDO</th><th>CANT.</th><th>FECHA VENC. CALIBRACIÓN</th><th>DÍAS REM.</th><th>OBSERVACIONES</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div></body></html>`;
    }

    private buildMGH103Html(): string {
        const now  = new Date().toLocaleString('es-BO');
        const rows = this.reportData.map(item =>
            `<tr><td style="font-weight:700">${item.month || '-'}</td>
<td style="text-align:center">${item.sent ?? '-'}</td><td style="text-align:center">${item.returned ?? '-'}</td>
<td style="text-align:center">${item.approved ?? '-'}</td><td style="text-align:center">${item.rejected ?? '-'}</td>
<td style="text-align:right">${item.cost || '-'} Bs</td><td style="text-align:center">${item.avg_days ?? '-'} días</td></tr>`
        ).join('');
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MGH-103</title>${this.pdfBaseStyles()}</head><body>
<div class="top"><div style="font-weight:900;font-size:11px">BoAMM &nbsp; OMA145 &nbsp; N-014</div>
<div style="text-align:center;font-size:13px;font-weight:900">REPORTE MENSUAL DE HERRAMIENTAS SUJETAS A CALIBRACIÓN</div>
<div style="text-align:right"><div class="code-box">MGH-103</div><br><span style="font-size:9px">REV. 0</span></div></div>
<div class="meta"><div>Período: <span>${this.reportConfig.startDateStr} — ${this.reportConfig.endDateStr}</span></div>
<div>Fecha: <span>${now}</span></div></div>
<table><thead><tr><th>MES</th><th>ENVIADAS</th><th>RETORNADAS</th><th>APROBADAS</th>
<th>RECHAZADAS</th><th>COSTO TOTAL (Bs)</th><th>DÍAS PROMEDIO</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div></body></html>`;
    }

    private buildMGH104Html(): string {
        const now  = new Date().toLocaleString('es-BO');
        const rows = this.reportData.map((item, i) => {
            const cls = !item.days || item.days <= 0 ? 'badge-vencida' : item.days <= 7 ? 'badge-critica'
                : item.days <= 15 ? 'badge-urgente' : 'badge-proxima';
            return `<tr><td style="text-align:center">${i + 1}</td><td style="font-weight:700">${item.code || '-'}</td>
<td>${item.name || '-'}</td><td style="text-align:center">${item.expiry || '-'}</td>
<td style="text-align:center;font-weight:700;color:${item.days <= 0 ? '#dc2626' : item.days <= 7 ? '#ea580c' : '#ca8a04'}">
${item.days <= 0 ? 'VENCIDA' : (item.days + ' días')}</td>
<td style="text-align:center"><span class="${cls}">${item.urgency || '-'}</span></td>
<td style="text-align:center">${item.warehouse || '-'}</td></tr>`;
        }).join('');
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MGH-104</title>${this.pdfBaseStyles()}</head><body>
<div class="top"><div style="font-weight:900;font-size:11px">BoAMM &nbsp; OMA145 &nbsp; N-014</div>
<div style="text-align:center;font-size:13px;font-weight:900">REPORTE DE HERRAMIENTAS Y EQUIPOS PRÓXIMOS A VENCER</div>
<div style="text-align:right"><div class="code-box">MGH-104</div><br><span style="font-size:9px">REV. 0</span></div></div>
<div class="meta"><div>Días horizonte: <span>${this.reportConfig.days || 30} días</span></div>
<div>Base: <span>${this.reportConfig.warehouse !== 'all' ? this.reportConfig.warehouse : 'TODAS'}</span></div>
<div>Fecha: <span>${now}</span></div><div>Total: <span>${this.reportData.length} herramientas</span></div></div>
<table><thead><tr><th>NRO</th><th>CÓDIGO</th><th>HERRAMIENTA</th>
<th>FECHA VENCIMIENTO</th><th>DÍAS RESTANTES</th><th>URGENCIA</th><th>ALMACÉN</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div></body></html>`;
    }

    private buildGenericReportHtml(): string {
        const now     = new Date().toLocaleString('es-BO');
        const headers = this.reportColumns.map(c => `<th>${c.label.toUpperCase()}</th>`).join('');
        const rows    = this.reportData.map(item =>
            `<tr>${this.reportColumns.map(c => `<td>${item[c.key] ?? '-'}</td>`).join('')}</tr>`
        ).join('');
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${this.selectedReport?.title}</title>${this.pdfBaseStyles()}</head><body>
<h1>${this.selectedReport?.title} — ${this.selectedReport?.description}</h1>
<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div></body></html>`;
    }
}
