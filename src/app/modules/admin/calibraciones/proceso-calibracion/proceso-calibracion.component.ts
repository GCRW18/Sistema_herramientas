import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';
import { ScanToolResult } from '../../../../core/models';

interface ActiveCalibration {
    id_calibration: number;
    record_number: string;
    tool_id: number;
    tool_code: string;
    tool_name: string;
    tool_serial: string;
    supplier_name: string;
    send_date: string;
    expected_return_date: string | null;
    status: string;
    is_jack: boolean;
    last_calibration_date: string | null;
    next_calibration_date: string | null;
}

type Mode = 'envio' | 'retorno';

@Component({
    selector: 'app-proceso-calibracion',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule
    ],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] transition-colors duration-300 font-sans overflow-hidden relative">

        <!-- SPINNER OVERLAY -->
        <div *ngIf="isSaving() || isProcessing()" class="spinner-overlay z-[100]">
            <div class="neo-card-base p-6 flex flex-col items-center gap-4 bg-white dark:bg-slate-800">
                <mat-spinner diameter="50"></mat-spinner>
                <span class="font-black text-black dark:text-white uppercase tracking-wider">
                    {{ isSaving() ? 'Registrando Envío...' : 'Procesando Retorno...' }}
                </span>
            </div>
        </div>

        <!-- DECORATIVE -->
        <div class="fixed top-16 right-10 w-64 h-64 bg-[#1A3EDC] rounded-full border-4 border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-32 h-32 bg-[#FF6A00] rotate-12 border-4 border-black opacity-5 pointer-events-none"></div>

        <!-- MAIN CONTENT -->
        <div class="flex-1 flex flex-col p-2 relative h-full overflow-hidden gap-2">

            <!-- HEADER -->
            <div class="flex flex-row items-center justify-between gap-2 shrink-0 relative z-10">
                <div class="flex items-center gap-3">
                    <div class="font-black text-xs uppercase flex items-center gap-2">
                        <mat-icon class="text-black dark:text-white !text-base">science</mat-icon>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <h1 class="text-base font-black text-black dark:text-white uppercase tracking-tight leading-none">
                            Proceso de Calibración
                        </h1>
                        <p class="text-[10px] font-bold px-2 py-0.5 rounded-sm border border-black"
                           [ngClass]="mode === 'envio' ? 'bg-[#FF6A00] text-white' : 'bg-blue-600 text-white'">
                            {{ mode === 'envio' ? 'MODO ENVÍO' : 'MODO RETORNO' }}
                        </p>
                        @if (activeCalibrations().length > 0) {
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-sm border border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700">
                                {{ activeCalibrations().length }} en laboratorio
                            </span>
                        }
                    </div>
                </div>

                <div class="flex gap-2 shrink-0">
                    @if (mode === 'retorno' && selectedCalibration() && !isProcessing()) {
                        <button (click)="printNotaRetorno()"
                                matTooltip="Imprimir Nota de Retorno"
                                class="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-1">
                            <mat-icon class="!w-4 !h-4 !text-sm">print</mat-icon>
                            <span class="hidden sm:inline">Imprimir</span>
                        </button>
                    }
                    @if (mode === 'envio') {
                        <button (click)="submitEnvio()"
                                [disabled]="isSaving() || !canSubmitEnvio()"
                                class="px-3 py-1.5 bg-[#FF6A00FF] text-white font-black text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                            <mat-icon class="!w-4 !h-4 !text-sm">send</mat-icon>
                            Registrar Envío
                        </button>
                    }
                    @if (mode === 'retorno') {
                        <button (click)="processReturn()"
                                [disabled]="isProcessing() || !canSubmitRetorno()"
                                class="px-3 py-1.5 bg-blue-600 text-white font-black text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                            <mat-icon class="!w-4 !h-4 !text-sm">check_circle</mat-icon>
                            Procesar Retorno
                        </button>
                    }
                </div>
            </div>

            <!-- BODY: 3 COLUMNAS -->
            <div class="flex flex-row gap-2 flex-1 overflow-hidden min-h-0">

                <!-- ============================================================ -->
                <!-- COL 1: Modo + Identificar herramienta / Filtros               -->
                <!-- ============================================================ -->
                <div class="w-[190px] xl:w-[205px] shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar">

                    <!-- MODO DE OPERACIÓN -->
                    <div class="neo-card-base p-3 bg-white dark:bg-slate-800">
                        <div class="flex items-center gap-1 mb-1.5 pb-1.5 border-b-2 border-black dark:border-gray-600">
                            <mat-icon class="text-black dark:text-white !text-base">swap_horiz</mat-icon>
                            <h3 class="font-black text-xs uppercase text-black dark:text-white">Tipo de Proceso</h3>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <button type="button" (click)="setMode('envio')"
                                    class="p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1"
                                    [ngClass]="mode === 'envio'
                                        ? 'bg-[#FF6A00] border-black text-white shadow-[2px_2px_0px_0px_#000]'
                                        : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-black dark:text-white hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'">
                                <mat-icon class="!text-base">send</mat-icon>
                                <span class="text-[9px] font-black uppercase leading-tight text-center">Envío</span>
                            </button>
                            <button type="button" (click)="setMode('retorno')"
                                    class="p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1"
                                    [ngClass]="mode === 'retorno'
                                        ? 'bg-blue-600 border-black text-white shadow-[2px_2px_0px_0px_#000]'
                                        : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-black dark:text-white hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'">
                                <mat-icon class="!text-base">assignment_return</mat-icon>
                                <span class="text-[9px] font-black uppercase leading-tight text-center">Retorno</span>
                            </button>
                        </div>
                    </div>

                    <!-- ENVÍO MODE: Identificar herramienta -->
                    @if (mode === 'envio') {
                        <div class="neo-card-base p-2 bg-white dark:bg-slate-800">
                            <div class="flex items-center gap-1 mb-1.5 pb-1.5 border-b-2 border-black dark:border-gray-600">
                                <mat-icon class="text-black dark:text-white !text-base">qr_code_scanner</mat-icon>
                                <h3 class="font-black text-xs uppercase text-black dark:text-white">Identificar</h3>
                            </div>
                            <div class="flex flex-col gap-1.5">
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Código Herramienta
                                    </label>
                                    <div class="relative">
                                        <input #barcodeInput type="text"
                                               [(ngModel)]="barcodeValue"
                                               (keydown.enter)="scanTool()"
                                               placeholder="Escanear o escribir..."
                                               [disabled]="isScanning()"
                                               class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-8 pr-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 !text-base">barcode_reader</mat-icon>
                                    </div>
                                </div>
                                <button type="button" (click)="scanTool()"
                                        [disabled]="isScanning() || !barcodeValue.trim()"
                                        class="w-full py-2 bg-[#0F172AFF] text-white font-black text-xs border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none transition-all uppercase flex justify-center items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <mat-spinner *ngIf="isScanning()" diameter="16" class="invert-spinner"></mat-spinner>
                                    <mat-icon *ngIf="!isScanning()" class="!text-base">search</mat-icon>
                                    <span *ngIf="!isScanning()">Buscar</span>
                                </button>
                            </div>

                            <!-- Resultado del scan -->
                            @if (scannedTool()) {
                                <div class="mt-3 border-2 rounded-lg overflow-hidden"
                                     [ngClass]="scannedTool()!.is_jack ? 'border-purple-500' : 'border-black'">
                                    <div class="flex items-center gap-1.5 px-2 py-1.5"
                                         [ngClass]="scannedTool()!.is_jack ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-green-50 dark:bg-green-900/20'">
                                        <mat-icon class="!text-sm"
                                                  [ngClass]="scannedTool()!.is_jack ? 'text-purple-700' : 'text-green-700'">
                                            {{ scannedTool()!.is_jack ? 'precision_manufacturing' : 'check_circle' }}
                                        </mat-icon>
                                        <span class="text-[9px] font-black uppercase"
                                              [ngClass]="scannedTool()!.is_jack ? 'text-purple-800' : 'text-green-800'">
                                            {{ scannedTool()!.is_jack ? 'Gata Hidráulica' : 'Encontrada' }}
                                        </span>
                                    </div>
                                    <div class="p-2 bg-white dark:bg-gray-900 flex flex-col gap-0.5">
                                        <p class="font-black text-sm text-black dark:text-white">{{ scannedTool()!.code }}</p>
                                        <p class="text-[10px] font-bold text-gray-500 line-clamp-2">{{ scannedTool()!.name }}</p>
                                        @if (scannedTool()!.serial_number) {
                                            <p class="text-[10px] font-mono text-gray-500">S/N: {{ scannedTool()!.serial_number }}</p>
                                        }
                                        @if (isCalibrationOverdue()) {
                                            <div class="flex items-center gap-1 mt-1 bg-red-50 border border-red-300 rounded px-1.5 py-0.5">
                                                <mat-icon class="text-red-600 !text-xs">warning</mat-icon>
                                                <span class="text-[9px] text-red-700 font-black">VENCIDA</span>
                                            </div>
                                        }
                                        <button (click)="clearScan()"
                                                class="mt-1 text-[9px] font-bold text-gray-400 hover:text-red-600 transition-colors flex items-center gap-0.5">
                                            <mat-icon class="!text-xs">close</mat-icon> Cambiar
                                        </button>
                                    </div>
                                </div>
                            }

                            @if (!scannedTool() && !isScanning()) {
                                <div class="mt-2 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-2">
                                    <mat-icon class="text-blue-400 !text-xs shrink-0">info</mat-icon>
                                    <p class="text-[9px] text-blue-700 dark:text-blue-300 font-bold leading-tight">
                                        Escanee o escriba el código y presione Buscar.
                                    </p>
                                </div>
                            }
                        </div>
                    }

                    <!-- RETORNO MODE: Filtro + resumen -->
                    @if (mode === 'retorno') {
                        <div class="neo-card-base p-2 bg-white dark:bg-slate-800">
                            <div class="flex items-center gap-1 mb-1.5 pb-1.5 border-b-2 border-black dark:border-gray-600">
                                <mat-icon class="text-black dark:text-white !text-base">tune</mat-icon>
                                <h3 class="font-black text-xs uppercase text-black dark:text-white">Filtrar Lista</h3>
                            </div>
                            <div class="flex flex-col gap-1.5">
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Buscar herramienta
                                    </label>
                                    <div class="relative">
                                        <input type="text"
                                               [(ngModel)]="searchQuery"
                                               placeholder="Código o nombre..."
                                               class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-8 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 !text-base">search</mat-icon>
                                        <button *ngIf="searchQuery" type="button" (click)="searchQuery = ''"
                                                class="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black p-0.5 rounded">
                                            <mat-icon class="!text-base">close</mat-icon>
                                        </button>
                                    </div>
                                </div>
                                <button type="button" (click)="loadActiveCalibrations()"
                                        [disabled]="isLoadingList()"
                                        class="w-full py-2 bg-[#0F172AFF] text-white font-black text-xs border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none transition-all uppercase flex justify-center items-center gap-1 disabled:opacity-50">
                                    <mat-spinner *ngIf="isLoadingList()" diameter="16" class="invert-spinner"></mat-spinner>
                                    <mat-icon *ngIf="!isLoadingList()" class="!text-base">refresh</mat-icon>
                                    <span *ngIf="!isLoadingList()">Recargar</span>
                                </button>
                            </div>
                        </div>

                        <!-- Mini summary cards -->
                        @if (activeCalibrations().length > 0) {
                            <div class="grid grid-cols-2 gap-2">
                                <div class="neo-card-base bg-blue-50 dark:bg-blue-900/30 p-2 flex items-center gap-1.5 border-2 border-blue-500">
                                    <mat-icon class="text-blue-600 !text-base shrink-0">science</mat-icon>
                                    <div>
                                        <span class="text-base font-black text-blue-700 dark:text-blue-300 leading-none block">{{ activeCalibrations().length }}</span>
                                        <span class="text-[9px] font-bold text-blue-600 uppercase">En Lab.</span>
                                    </div>
                                </div>
                                <div class="neo-card-base bg-red-50 dark:bg-red-900/30 p-2 flex items-center gap-1.5 border-2 border-red-400">
                                    <mat-icon class="text-red-600 !text-base shrink-0">schedule</mat-icon>
                                    <div>
                                        <span class="text-base font-black text-red-700 dark:text-red-300 leading-none block">{{ getVencidasCount() }}</span>
                                        <span class="text-[9px] font-bold text-red-600 uppercase">Venc.</span>
                                    </div>
                                </div>
                            </div>
                        }

                        <!-- Calibración seleccionada (resumen compacto) -->
                        @if (selectedCalibration()) {
                            <div class="neo-card-base p-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-600">
                                <div class="flex items-center gap-1.5 mb-1">
                                    <mat-icon class="text-blue-700 !text-sm">check_circle</mat-icon>
                                    <span class="text-[9px] font-black uppercase text-blue-700 dark:text-blue-300">Seleccionada</span>
                                    <button (click)="clearRetorno()" class="ml-auto text-gray-400 hover:text-red-600 transition-colors">
                                        <mat-icon class="!text-sm">close</mat-icon>
                                    </button>
                                </div>
                                <p class="font-black text-sm text-black dark:text-white">{{ selectedCalibration()!.tool_code }}</p>
                                <p class="text-[10px] font-bold text-gray-500 truncate">{{ selectedCalibration()!.tool_name }}</p>
                                <p class="text-[9px] font-mono text-gray-400 mt-0.5">{{ selectedCalibration()!.record_number }}</p>
                                <p class="text-[10px] text-blue-700 dark:text-blue-400 font-bold mt-0.5">{{ selectedCalibration()!.supplier_name }}</p>
                            </div>
                        }
                    }

                </div>

                <!-- ============================================================ -->
                <!-- COL 2: Formulario (cambia según modo)                         -->
                <!-- ============================================================ -->
                <div class="w-[210px] xl:w-[235px] shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar">

                    <!-- ── ENVÍO: Datos del envío ── -->
                    @if (mode === 'envio') {
                        <div class="neo-card-base bg-white dark:bg-slate-800" [ngClass]="!scannedTool() ? 'opacity-50 pointer-events-none' : ''">
                            <div class="bg-[#FF6A00FF] px-3 py-1.5 border-b-2 border-black flex items-center gap-2">
                                <mat-icon class="text-white !text-base">assignment</mat-icon>
                                <span class="font-black text-xs uppercase text-white">Datos del Envío</span>
                                @if (!scannedTool()) {
                                    <span class="ml-auto text-[9px] font-bold text-white/70">Identifique primero</span>
                                }
                            </div>
                            <div class="p-2 flex flex-col gap-1.5">

                                <!-- Laboratorio -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Laboratorio / Proveedor *
                                    </label>
                                    <div class="relative">
                                        <select [(ngModel)]="selectedLabId" (ngModelChange)="onLabChange($event)"
                                                class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-7 pr-4 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none appearance-none cursor-pointer">
                                            <option [ngValue]="null">-- Seleccionar --</option>
                                            <option *ngFor="let lab of laboratories" [ngValue]="lab.id_laboratory">
                                                {{ lab.name }}
                                            </option>
                                        </select>
                                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 !text-base">science</mat-icon>
                                        <mat-icon class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 !text-base pointer-events-none">expand_more</mat-icon>
                                    </div>
                                </div>

                                <!-- Tipo calibración -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Tipo
                                    </label>
                                    <div class="relative">
                                        <select [(ngModel)]="calibrationType"
                                                class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-7 pr-4 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none appearance-none cursor-pointer">
                                            <option value="calibration">Calibración</option>
                                            <option value="verification">Verificación</option>
                                            <option value="repair">Reparación</option>
                                        </select>
                                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 !text-base">build_circle</mat-icon>
                                        <mat-icon class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 !text-base pointer-events-none">expand_more</mat-icon>
                                    </div>
                                </div>

                                <!-- Orden de servicio -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Orden de servicio
                                    </label>
                                    <input type="text" [(ngModel)]="serviceOrder" placeholder="OS-2026-001"
                                           class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                </div>

                                <!-- Fecha envío -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Fecha de envío *
                                    </label>
                                    <input type="date" [(ngModel)]="sendDateStr"
                                           class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none">
                                </div>

                                <!-- Fecha retorno esperado -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Retorno esperado
                                    </label>
                                    <input type="date" [(ngModel)]="expectedReturnDateStr"
                                           class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none">
                                </div>

                                <!-- Costo + Moneda -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Costo estimado
                                    </label>
                                    <div class="flex gap-1">
                                        <div class="relative">
                                            <select [(ngModel)]="sendCurrency"
                                                    class="h-9 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-2 pr-6 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none appearance-none cursor-pointer w-[70px]">
                                                <option value="BOB">BOB</option>
                                                <option value="USD">USD</option>
                                            </select>
                                            <mat-icon class="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 !text-xs pointer-events-none">expand_more</mat-icon>
                                        </div>
                                        <input type="number" [(ngModel)]="sendCost" placeholder="0.00" min="0"
                                               class="flex-1 h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                    </div>
                                </div>

                                <!-- Notas -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Observaciones
                                    </label>
                                    <textarea [(ngModel)]="sendNotes" rows="1" placeholder="Observaciones del envío..."
                                              class="w-full text-xs font-medium border-2 border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400 resize-none"></textarea>
                                </div>

                            </div>
                        </div>

                        <!-- Resumen del envío (solo si hay herramienta y lab) -->
                        @if (scannedTool() && selectedLabId) {
                            <div class="neo-card-base bg-orange-50 dark:bg-orange-900/20 border-2 border-[#FF6A00]">
                                <div class="bg-[#FF6A00FF] px-2 py-1 border-b-2 border-black flex items-center gap-2">
                                    <mat-icon class="text-white !text-sm">info</mat-icon>
                                    <span class="font-black text-[10px] uppercase text-white">Resumen</span>
                                </div>
                                <div class="p-2 flex flex-col gap-0.5 text-[10px]">
                                    <div class="flex justify-between">
                                        <span class="text-gray-500 font-bold">Herramienta:</span>
                                        <span class="font-black text-black dark:text-white">{{ scannedTool()!.code }}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-500 font-bold">Laboratorio:</span>
                                        <span class="font-black text-black dark:text-white text-right ml-2">{{ selectedLabName || '—' }}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-500 font-bold">Tipo:</span>
                                        <span class="font-black text-black dark:text-white">{{ calibrationTypeLabel }}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-500 font-bold">Fecha:</span>
                                        <span class="font-black text-black dark:text-white">{{ sendDateStr || '—' }}</span>
                                    </div>
                                    <p class="mt-1 text-orange-700 dark:text-orange-400 font-bold text-[9px] border-t border-orange-200 pt-1">
                                        Se generará N° EC-XXXX/YYYY automáticamente.
                                    </p>
                                </div>
                            </div>
                        }
                    }

                    <!-- ── RETORNO: Datos del retorno ── -->
                    @if (mode === 'retorno') {
                        <div class="neo-card-base bg-white dark:bg-slate-800" [ngClass]="!selectedCalibration() ? 'opacity-50 pointer-events-none' : ''">
                            <div class="bg-blue-600 px-3 py-1.5 border-b-2 border-black flex items-center gap-2">
                                <mat-icon class="text-white !text-base">fact_check</mat-icon>
                                <span class="font-black text-xs uppercase text-white">Datos del Retorno</span>
                                @if (!selectedCalibration()) {
                                    <span class="ml-auto text-[9px] font-bold text-white/70">Seleccione herramienta</span>
                                }
                            </div>
                            <div class="p-2 flex flex-col gap-1.5">

                                <!-- Resultado -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Resultado *
                                    </label>
                                    <div class="relative">
                                        <select [(ngModel)]="retornoResult"
                                                class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-7 pr-4 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none appearance-none cursor-pointer">
                                            <option value="approved">✓ Aprobado</option>
                                            <option value="conditional">⚠ Condicional</option>
                                            <option value="rejected">✗ Rechazado</option>
                                        </select>
                                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 !text-base">grading</mat-icon>
                                        <mat-icon class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 !text-base pointer-events-none">expand_more</mat-icon>
                                    </div>
                                </div>

                                <!-- Condición física -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Condición física
                                    </label>
                                    <div class="relative">
                                        <select [(ngModel)]="physicalCondition"
                                                class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg pl-8 pr-4 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none appearance-none cursor-pointer">
                                            <option value="S">S — Serviciable</option>
                                            <option value="R">R — Reparable</option>
                                            <option value="M">M — Malo</option>
                                        </select>
                                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 !text-base">health_and_safety</mat-icon>
                                        <mat-icon class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 !text-base pointer-events-none">expand_more</mat-icon>
                                    </div>
                                </div>

                                <!-- N° Certificado -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        N° Certificado
                                    </label>
                                    <input type="text" [(ngModel)]="certificateNumber" placeholder="CERT-2026-001"
                                           class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                </div>

                                <!-- Fecha certificado -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Fecha certificado
                                    </label>
                                    <input type="date" [(ngModel)]="certificateDateStr"
                                           class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none">
                                </div>

                                <!-- Fecha calibración realizada -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Fecha calibración
                                    </label>
                                    <input type="date" [(ngModel)]="calibrationDateStr"
                                           class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none">
                                </div>

                                <!-- Próxima calibración -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Próxima calibración
                                    </label>
                                    <input type="date" [(ngModel)]="nextCalibrationDateStr"
                                           class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none">
                                </div>

                                <!-- Panel Gatas (condicional) -->
                                @if (selectedCalibration()?.is_jack) {
                                    <div class="border-2 border-purple-500 rounded-lg p-2 bg-purple-50 dark:bg-purple-900/20">
                                        <div class="flex items-center gap-1 mb-2">
                                            <mat-icon class="text-purple-700 !text-sm">precision_manufacturing</mat-icon>
                                            <p class="text-[9px] font-black text-purple-800 dark:text-purple-300 uppercase">Gata — Serv. Técnico</p>
                                        </div>
                                        <div class="form-group mb-2">
                                            <label class="text-[10px] font-black uppercase text-purple-700 dark:text-purple-300 mb-0.5 block">Próx. Semestral</label>
                                            <input type="date" [(ngModel)]="jackSemiannualDateStr"
                                                   class="w-full h-7 text-xs font-bold border-2 border-purple-400 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none focus:shadow-[2px_2px_0px_0px_#9333ea] transition-shadow">
                                        </div>
                                        <div class="form-group">
                                            <label class="text-[10px] font-black uppercase text-purple-700 dark:text-purple-300 mb-0.5 block">Próx. Anual</label>
                                            <input type="date" [(ngModel)]="jackAnnualDateStr"
                                                   class="w-full h-7 text-xs font-bold border-2 border-purple-400 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none focus:shadow-[2px_2px_0px_0px_#9333ea] transition-shadow">
                                        </div>
                                        <p class="mt-1 text-[9px] text-purple-600 font-bold">Si no se llenan, el backend calcula +6 y +12 meses.</p>
                                    </div>
                                }

                                <!-- Costo retorno -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Costo calibración
                                    </label>
                                    <div class="flex gap-1">
                                        <div class="relative">
                                            <select [(ngModel)]="retornoCurrency"
                                                    class="h-9 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-2 pr-6 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none appearance-none cursor-pointer w-[70px]">
                                                <option value="BOB">BOB</option>
                                                <option value="USD">USD</option>
                                            </select>
                                            <mat-icon class="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 !text-xs pointer-events-none">expand_more</mat-icon>
                                        </div>
                                        <input type="number" [(ngModel)]="retornoCost" placeholder="0.00" min="0"
                                               class="flex-1 h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                    </div>
                                </div>

                                <!-- Observaciones -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">
                                        Observaciones
                                    </label>
                                    <textarea [(ngModel)]="observations" rows="1" placeholder="Observaciones del retorno..."
                                              class="w-full text-xs font-medium border-2 border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400 resize-none"></textarea>
                                </div>

                            </div>
                        </div>

                        <!-- Resumen del retorno -->
                        @if (selectedCalibration() && retornoResult) {
                            <div class="neo-card-base border-2"
                                 [ngClass]="retornoResult === 'approved' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : retornoResult === 'conditional' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'">
                                <div class="px-3 py-1.5 border-b-2 border-black flex items-center gap-2"
                                     [ngClass]="retornoResult === 'approved' ? 'bg-green-600' : retornoResult === 'conditional' ? 'bg-amber-500' : 'bg-red-600'">
                                    <mat-icon class="text-white !text-sm">info</mat-icon>
                                    <span class="font-black text-[10px] uppercase text-white">Resumen Retorno</span>
                                </div>
                                <div class="p-2 flex flex-col gap-0.5 text-[10px]">
                                    <div class="flex justify-between">
                                        <span class="text-gray-500 font-bold">Resultado:</span>
                                        <span class="font-black"
                                              [ngClass]="retornoResult === 'approved' ? 'text-green-700' : retornoResult === 'conditional' ? 'text-amber-700' : 'text-red-700'">
                                            {{ retornoResult === 'approved' ? 'APROBADO' : retornoResult === 'conditional' ? 'CONDICIONAL' : 'RECHAZADO' }}
                                        </span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-500 font-bold">Condición:</span>
                                        <span class="font-black text-black dark:text-white">{{ physicalCondition === 'S' ? 'Serviciable' : physicalCondition === 'R' ? 'Reparable' : 'Malo' }}</span>
                                    </div>
                                    @if (certificateNumber) {
                                        <div class="flex justify-between">
                                            <span class="text-gray-500 font-bold">Certificado:</span>
                                            <span class="font-black text-black dark:text-white">{{ certificateNumber }}</span>
                                        </div>
                                    }
                                    @if (nextCalibrationDateStr) {
                                        <div class="flex justify-between">
                                            <span class="text-gray-500 font-bold">Próx. cal.:</span>
                                            <span class="font-black text-black dark:text-white">{{ nextCalibrationDateStr }}</span>
                                        </div>
                                    }
                                </div>
                            </div>
                        }
                    }

                </div>

                <!-- ============================================================ -->
                <!-- COL 3: Lista de calibraciones activas                         -->
                <!-- ============================================================ -->
                <div class="flex-1 flex flex-col gap-3 overflow-hidden h-full">

                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-full relative z-10 border-2 border-black dark:border-gray-600">

                        <!-- Header de la lista -->
                        <div class="bg-[#0F172AFF] px-3 py-1.5 border-b-2 border-black flex items-center justify-between shrink-0 h-10">
                            <div class="flex items-center gap-3">
                                <mat-icon class="text-white !text-xl">science</mat-icon>
                                <span class="font-black text-xs md:text-sm uppercase text-white">
                                    Herramientas en Laboratorio
                                </span>
                            </div>
                            <div class="flex items-center gap-2">
                                @if (mode === 'retorno') {
                                    <span class="text-[10px] font-bold text-white/70">Click para seleccionar</span>
                                }
                                <span class="bg-white text-black px-2 py-0.5 rounded text-xs font-black border border-black shadow-[2px_2px_0px_0px_#000]">
                                    {{ filteredCalibrations().length }} / {{ activeCalibrations().length }}
                                </span>
                            </div>
                        </div>

                        <!-- Lista de ítems -->
                        <div class="overflow-y-auto flex-1 p-2 space-y-1.5 custom-scrollbar bg-[#f8f9fc] dark:bg-slate-900/50">

                            <!-- Empty state -->
                            @if (!isLoadingList() && activeCalibrations().length === 0) {
                                <div class="flex flex-col items-center justify-center h-full py-10 opacity-50">
                                    <mat-icon class="!text-6xl text-black dark:text-gray-500">inventory_2</mat-icon>
                                    <p class="text-sm font-black mt-2 uppercase text-black dark:text-gray-500">Sin calibraciones activas</p>
                                    <p class="text-xs text-gray-500 mt-1">
                                        @if (mode === 'envio') { Registre un envío para ver herramientas aquí }
                                        @else { No hay herramientas en laboratorio }
                                    </p>
                                </div>
                            }

                            <!-- Loading state -->
                            @if (isLoadingList()) {
                                <div class="flex flex-col items-center justify-center h-full py-10">
                                    <mat-spinner diameter="40"></mat-spinner>
                                    <p class="text-xs font-bold mt-3 uppercase animate-pulse text-black dark:text-white">Cargando...</p>
                                </div>
                            }

                            <!-- No match state -->
                            @if (!isLoadingList() && activeCalibrations().length > 0 && filteredCalibrations().length === 0) {
                                <div class="flex flex-col items-center justify-center py-8 opacity-50">
                                    <mat-icon class="!text-4xl text-black dark:text-gray-500">search_off</mat-icon>
                                    <p class="text-xs font-black mt-1 uppercase text-black dark:text-gray-500">Sin coincidencias</p>
                                </div>
                            }

                            <!-- Items -->
                            @for (cal of filteredCalibrations(); track cal.id_calibration) {
                                <div class="border-2 rounded-lg overflow-hidden transition-all duration-150 bg-white dark:bg-[#0F172AFF]"
                                     [ngClass]="getRowClass(cal)"
                                     (click)="mode === 'retorno' ? selectCalibration(cal) : null"
                                     [class.cursor-pointer]="mode === 'retorno'"
                                     [class.cursor-default]="mode === 'envio'">

                                    <div class="grid grid-cols-12 gap-2 p-2 items-center min-h-[44px]"
                                         [ngClass]="mode === 'retorno' ? 'hover-retorno' : ''">

                                        <!-- Select indicator (retorno mode) -->
                                        @if (mode === 'retorno') {
                                            <div class="col-span-1 flex justify-center">
                                                <div class="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center"
                                                     [ngClass]="selectedCalibration()?.id_calibration === cal.id_calibration ? 'bg-blue-600' : 'bg-white'">
                                                    @if (selectedCalibration()?.id_calibration === cal.id_calibration) {
                                                        <mat-icon class="!text-xs text-white">check</mat-icon>
                                                    }
                                                </div>
                                            </div>
                                        }

                                        <!-- Código + número de registro -->
                                        <div [ngClass]="mode === 'retorno' ? 'col-span-3' : 'col-span-4'" class="flex flex-col leading-tight">
                                            <span class="font-black text-sm text-black dark:text-white">{{ cal.tool_code }}</span>
                                            <span class="text-[10px] font-mono text-gray-500 dark:text-gray-400">{{ cal.record_number }}</span>
                                            @if (cal.is_jack) {
                                                <span class="text-[9px] font-black text-purple-700 uppercase">GATA</span>
                                            }
                                        </div>

                                        <!-- Nombre herramienta -->
                                        <div class="col-span-3 hidden md:flex flex-col justify-center">
                                            <span class="text-xs font-bold text-black dark:text-white leading-tight line-clamp-2">{{ cal.tool_name }}</span>
                                        </div>

                                        <!-- Laboratorio + fechas -->
                                        <div class="col-span-3 flex flex-col gap-0.5">
                                            <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 truncate">{{ cal.supplier_name }}</span>
                                            <span class="text-[10px] text-gray-400">Env: {{ cal.send_date }}</span>
                                            @if (cal.expected_return_date) {
                                                <span class="text-[10px] font-bold"
                                                      [class.text-red-600]="isExpected(cal.expected_return_date)"
                                                      [class.text-gray-400]="!isExpected(cal.expected_return_date)">
                                                    Ret: {{ cal.expected_return_date }}
                                                    @if (isExpected(cal.expected_return_date)) {
                                                        <mat-icon class="!text-xs align-middle">warning</mat-icon>
                                                    }
                                                </span>
                                            }
                                        </div>

                                        <!-- Status badge -->
                                        <div class="col-span-2 flex justify-end">
                                            <span class="px-2 py-0.5 rounded text-[9px] font-black border"
                                                  [ngClass]="getStatusChipClass(cal.status)">
                                                {{ getStatusLabel(cal.status) }}
                                            </span>
                                        </div>

                                    </div>
                                </div>
                            }

                        </div>
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

        ::ng-deep .invert-spinner circle { stroke: white !important; }

        .hover-retorno:hover { background-color: #eff6ff; }
        :host-context(.dark) .hover-retorno:hover { background-color: rgba(37, 99, 235, 0.08); }
    `]
})
export class ProcesoCalibracionComponent implements OnInit, OnDestroy {
    private calibrationService = inject(CalibrationService);
    private dialogRef = inject(MatDialogRef<ProcesoCalibracionComponent>);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    @ViewChild('barcodeInput') barcodeInput!: ElementRef<HTMLInputElement>;

    // ── Mode ────────────────────────────────────────────────────────────────
    mode: Mode = 'envio';

    // ── ENVÍO signals & fields ──────────────────────────────────────────────
    isScanning = signal(false);
    isSaving = signal(false);
    scannedTool = signal<ScanToolResult | null>(null);

    barcodeValue = '';
    laboratories: any[] = [];
    selectedLabId: number | null = null;
    selectedLabName = '';
    calibrationType: 'calibration' | 'verification' | 'repair' = 'calibration';
    serviceOrder = '';
    sendDateStr = this.todayStr();
    expectedReturnDateStr = '';
    sendCost: number | null = null;
    sendCurrency = 'BOB';
    sendNotes = '';

    // ── RETORNO signals & fields ────────────────────────────────────────────
    isLoadingList = signal(false);
    isProcessing = signal(false);
    activeCalibrations = signal<ActiveCalibration[]>([]);
    selectedCalibration = signal<ActiveCalibration | null>(null);

    searchQuery = '';
    retornoResult: 'approved' | 'conditional' | 'rejected' = 'approved';
    physicalCondition: 'S' | 'R' | 'M' = 'S';
    certificateNumber = '';
    certificateDateStr = '';
    calibrationDateStr = '';
    nextCalibrationDateStr = '';
    jackSemiannualDateStr = '';
    jackAnnualDateStr = '';
    retornoCost: number | null = null;
    retornoCurrency = 'BOB';
    observations = '';

    // ── Computed ────────────────────────────────────────────────────────────
    filteredCalibrations(): ActiveCalibration[] {
        const q = this.searchQuery.toLowerCase().trim();
        if (!q) return this.activeCalibrations();
        return this.activeCalibrations().filter(c =>
            c.tool_code.toLowerCase().includes(q) ||
            c.tool_name.toLowerCase().includes(q) ||
            c.record_number.toLowerCase().includes(q) ||
            (c.supplier_name || '').toLowerCase().includes(q)
        );
    }

    getVencidasCount(): number {
        return this.activeCalibrations().filter(c =>
            c.expected_return_date && this.isExpected(c.expected_return_date)
        ).length;
    }

    get calibrationTypeLabel(): string {
        return { calibration: 'Calibración', verification: 'Verificación', repair: 'Reparación' }[this.calibrationType] || '';
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────
    ngOnInit(): void {
        this.loadLaboratories();
        this.loadActiveCalibrations();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // ── Mode ─────────────────────────────────────────────────────────────────
    setMode(m: Mode): void {
        this.mode = m;
    }

    // ── ENVÍO methods ────────────────────────────────────────────────────────
    loadLaboratories(): void {
        this.calibrationService.getLaboratories().pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (labs) => this.laboratories = labs,
            error: () => this.showMessage('Error al cargar laboratorios', 'error')
        });
    }

    scanTool(): void {
        const barcode = this.barcodeValue.trim();
        if (!barcode) return;

        this.isScanning.set(true);
        this.scannedTool.set(null);

        this.calibrationService.scanToolForCalibration(barcode).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isScanning.set(false))
        ).subscribe({
            next: (result) => {
                if (!result) { this.showMessage('Herramienta no encontrada. Verifique el código.', 'error'); return; }
                this.scannedTool.set(result);
                if (result.scan_warning) this.showMessage(result.scan_warning, 'warning');
            },
            error: () => this.showMessage('Error al buscar la herramienta', 'error')
        });
    }

    clearScan(): void {
        this.scannedTool.set(null);
        this.barcodeValue = '';
        setTimeout(() => this.barcodeInput?.nativeElement?.focus(), 100);
    }

    onLabChange(labId: number): void {
        const lab = this.laboratories.find(l => l.id_laboratory === labId);
        this.selectedLabName = lab?.name || '';
    }

    canSubmitEnvio(): boolean {
        return !!(this.scannedTool() && this.selectedLabId && this.sendDateStr);
    }

    isCalibrationOverdue(): boolean {
        const tool = this.scannedTool();
        if (!tool?.next_calibration_date) return false;
        return new Date(tool.next_calibration_date) < new Date();
    }

    submitEnvio(): void {
        if (!this.canSubmitEnvio()) return;

        const tool = this.scannedTool()!;
        this.isSaving.set(true);

        const params: any = {
            tool_id: tool.id_tool,
            calibration_type: this.calibrationType,
            supplier_id: this.selectedLabId,
            supplier_name: this.selectedLabName,
            send_date: this.sendDateStr,
            notes: this.sendNotes || ''
        };

        if (this.serviceOrder) params.service_order = this.serviceOrder;
        if (this.expectedReturnDateStr) params.expected_return_date = this.expectedReturnDateStr;
        if (this.sendCost) { params.cost = this.sendCost; params.currency = this.sendCurrency; }

        this.calibrationService.sendToCalibrationPxp(params).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: (result) => {
                const recordNum = result?.record_number || result?.datos?.[0]?.record_number || '';
                this.showMessage(recordNum ? `Envío registrado: ${recordNum}` : 'Envío a calibración registrado', 'success');
                this.resetEnvioForm();
                this.loadActiveCalibrations();
            },
            error: () => this.showMessage('Error al registrar el envío', 'error')
        });
    }

    private resetEnvioForm(): void {
        this.clearScan();
        this.selectedLabId = null;
        this.selectedLabName = '';
        this.serviceOrder = '';
        this.sendDateStr = this.todayStr();
        this.expectedReturnDateStr = '';
        this.sendCost = null;
        this.sendNotes = '';
    }

    // ── RETORNO methods ──────────────────────────────────────────────────────
    loadActiveCalibrations(): void {
        this.isLoadingList.set(true);
        this.calibrationService.getCalibrations({ status: 'sent', limit: 100 }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoadingList.set(false))
        ).subscribe({
            next: (records: any[]) => {
                this.activeCalibrations.set(records.map(r => ({
                    id_calibration: r.id_calibration || r.id || 0,
                    record_number: r.record_number || r.recordNumber || '—',
                    tool_id: r.tool_id || r.toolId || 0,
                    tool_code: r.tool_code || r.code || '—',
                    tool_name: r.tool_name || r.name || '—',
                    tool_serial: r.tool_serial || r.serial_number || '—',
                    supplier_name: r.supplier_name || r.laboratory_name || '—',
                    send_date: r.send_date || r.sentDate || '—',
                    expected_return_date: r.expected_return_date || r.expectedReturnDate || null,
                    status: r.status || 'sent',
                    is_jack: r.is_jack || false,
                    last_calibration_date: r.last_calibration_date || null,
                    next_calibration_date: r.next_calibration_date || null
                })));
            },
            error: () => this.showMessage('Error al cargar calibraciones activas', 'error')
        });
    }

    selectCalibration(cal: ActiveCalibration): void {
        this.selectedCalibration.set(cal);
        this.retornoResult = 'approved';
        this.physicalCondition = 'S';
        this.certificateNumber = '';
        this.certificateDateStr = '';
        this.calibrationDateStr = '';
        this.nextCalibrationDateStr = '';
        this.jackSemiannualDateStr = '';
        this.jackAnnualDateStr = '';
        this.retornoCost = null;
        this.retornoCurrency = 'BOB';
        this.observations = '';
    }

    clearRetorno(): void {
        this.selectedCalibration.set(null);
    }

    canSubmitRetorno(): boolean {
        return !!(this.selectedCalibration() && this.retornoResult);
    }

    isExpected(dateStr: string | null): boolean {
        if (!dateStr) return false;
        try { return new Date(dateStr) < new Date(); } catch { return false; }
    }

    getRowClass(cal: ActiveCalibration): string {
        if (this.mode === 'retorno' && this.selectedCalibration()?.id_calibration === cal.id_calibration) {
            return 'border-blue-600 shadow-[3px_3px_0px_0px_#2563eb] bg-blue-50 dark:bg-blue-900/20';
        }
        if (cal.expected_return_date && this.isExpected(cal.expected_return_date)) {
            return 'border-red-400';
        }
        return 'border-black dark:border-gray-600';
    }

    getStatusChipClass(status: string): string {
        switch (status) {
            case 'sent':       return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'in_process': return 'bg-amber-100 text-amber-800 border-amber-300';
            case 'returned':   return 'bg-green-100 text-green-800 border-green-300';
            default:           return 'bg-gray-100 text-gray-700 border-gray-300';
        }
    }

    getStatusLabel(status: string): string {
        return { sent: 'ENVIADO', in_process: 'EN PROCESO', returned: 'RETORNADO' }[status] || status.toUpperCase();
    }

    processReturn(): void {
        if (!this.canSubmitRetorno()) return;

        const cal = this.selectedCalibration()!;
        this.isProcessing.set(true);

        const params: any = {
            id_calibration: cal.id_calibration,
            result: this.retornoResult,
            physical_condition: this.physicalCondition,
            calibration_performed: true,
            observations: this.observations || ''
        };

        if (this.certificateNumber) params.certificate_number = this.certificateNumber;
        if (this.certificateDateStr) params.certificate_date = this.certificateDateStr;
        if (this.calibrationDateStr) params.calibration_date = this.calibrationDateStr;
        if (this.nextCalibrationDateStr) params.next_calibration_date = this.nextCalibrationDateStr;
        if (cal.is_jack && this.jackSemiannualDateStr) params.jack_semiannual_date = this.jackSemiannualDateStr;
        if (cal.is_jack && this.jackAnnualDateStr) params.jack_annual_date = this.jackAnnualDateStr;
        if (this.retornoCost) { params.cost = this.retornoCost; params.currency = this.retornoCurrency; }

        this.calibrationService.processCalibrationReturnPxp(params).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isProcessing.set(false))
        ).subscribe({
            next: (res) => {
                this.showMessage(res?.mensaje || res?.message || 'Retorno procesado exitosamente', 'success');
                this.selectedCalibration.set(null);
                this.loadActiveCalibrations();
            },
            error: () => this.showMessage('Error al procesar el retorno', 'error')
        });
    }

    printNotaRetorno(): void {
        const cal = this.selectedCalibration();
        if (!cal) return;

        const today = new Date().toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const resultLabel = { approved: 'APROBADO', conditional: 'CONDICIONAL', rejected: 'RECHAZADO' }[this.retornoResult];
        const resultColor = { approved: '#16a34a', conditional: '#d97706', rejected: '#dc2626' }[this.retornoResult];

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Nota Retorno ${cal.record_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
.header{border:3px solid black;padding:12px;margin-bottom:16px}.title{font-size:18px;font-weight:900;text-transform:uppercase}
.record-num{font-size:22px;font-weight:900;color:#1d4ed8;margin:8px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
.section{border:2px solid black;padding:10px;border-radius:6px}.section-title{font-size:10px;font-weight:900;text-transform:uppercase;color:#555;margin-bottom:6px}
.field{margin-bottom:4px}.label{font-weight:700;color:#555}.value{font-weight:900}
.result-badge{display:inline-block;padding:4px 14px;font-weight:900;font-size:14px;border:2px solid black;border-radius:20px;color:white;background:${resultColor}}
.footer{border-top:2px solid black;padding-top:12px;margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:30px}
.sign-line{border-top:2px solid black;margin-top:30px;padding-top:4px;text-align:center;font-size:10px;color:#555}
</style></head><body>
<div class="header"><div class="title">NOTA DE RETORNO DE CALIBRACIÓN</div>
<div class="record-num">${cal.record_number}</div>
<div style="font-size:10px;color:#555">Emisión: ${today}</div></div>
<div class="grid">
<div class="section"><div class="section-title">Herramienta</div>
<div class="field"><span class="label">Código:</span> <span class="value">${cal.tool_code}</span></div>
<div class="field"><span class="label">Nombre:</span> <span class="value">${cal.tool_name}</span></div>
<div class="field"><span class="label">N° Serie:</span> <span class="value">${cal.tool_serial || '—'}</span></div></div>
<div class="section"><div class="section-title">Laboratorio</div>
<div class="field"><span class="label">Proveedor:</span> <span class="value">${cal.supplier_name || '—'}</span></div>
<div class="field"><span class="label">Fecha envío:</span> <span class="value">${cal.send_date}</span></div>
<div class="field"><span class="label">N° Certificado:</span> <span class="value">${this.certificateNumber || '—'}</span></div></div></div>
<div class="section" style="margin-bottom:16px"><div class="section-title">Resultado</div>
<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
<span class="result-badge">${resultLabel}</span>
<div>
<div class="field"><span class="label">Condición:</span> <span class="value">${{ S: 'Serviciable', R: 'Reparable', M: 'Malo' }[this.physicalCondition]}</span></div>
${this.nextCalibrationDateStr ? `<div class="field"><span class="label">Próx. calibración:</span> <span class="value">${this.nextCalibrationDateStr}</span></div>` : ''}
</div></div>
${this.observations ? `<div style="margin-top:8px;padding:8px;background:#f8f8f8;border-radius:4px"><span class="label">Observaciones:</span> ${this.observations}</div>` : ''}
</div>
<div class="footer">
<div><div class="sign-line">Responsable de Herramientas</div></div>
<div><div class="sign-line">Jefe de Mantenimiento</div></div></div>
<script>window.onload=()=>window.print();</script></body></html>`;

        const w = window.open('', '_blank', 'width=800,height=700');
        if (w) { w.document.write(html); w.document.close(); }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    private todayStr(): string {
        return new Date().toISOString().split('T')[0];
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
