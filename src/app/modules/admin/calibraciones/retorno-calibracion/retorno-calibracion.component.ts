import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

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

@Component({
    selector: 'app-retorno-calibracion',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
        MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
        MatNativeDateModule, MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule
    ],
    template: `
        <div class="flex flex-col h-full bg-white dark:bg-[#0F172AFF] font-sans">

            <!-- Header -->
            <div class="flex items-center justify-between p-5 border-b-3 border-black">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-600 border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_#000] flex items-center justify-center">
                        <mat-icon class="text-white !text-xl">assignment_return</mat-icon>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-black dark:text-white uppercase tracking-tight">
                            Retorno de Calibración
                        </h2>
                        <p class="text-xs font-bold text-gray-500">Registro de retorno individual</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    @if (selectedCalibration() && !isProcessing()) {
                        <button (click)="printNotaRetorno()"
                                matTooltip="Imprimir Nota de Retorno"
                                class="w-9 h-9 bg-indigo-600 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:bg-indigo-700 flex items-center justify-center transition-all active:shadow-none active:translate-x-[1px] active:translate-y-[1px]">
                            <mat-icon class="text-white !text-lg">print</mat-icon>
                        </button>
                    }
                    <button mat-dialog-close
                            class="w-9 h-9 bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:bg-gray-100 flex items-center justify-center transition-all active:shadow-none active:translate-x-[1px] active:translate-y-[1px]">
                        <mat-icon class="!text-lg">close</mat-icon>
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <div class="flex flex-col gap-5 max-w-2xl mx-auto">

                    <!-- PASO 1: Seleccionar calibración activa -->
                    <div class="border-3 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] overflow-hidden">
                        <div class="flex items-center justify-between px-4 py-2 bg-black text-white">
                            <div class="flex items-center gap-2">
                                <mat-icon class="!text-base">list_alt</mat-icon>
                                <span class="text-xs font-black uppercase tracking-wider">Paso 1 — Seleccionar Calibración</span>
                            </div>
                            @if (!isLoadingList()) {
                                <span class="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                                    {{ activeCalibrations().length }} enviadas
                                </span>
                            }
                        </div>
                        <div class="p-4">
                            @if (isLoadingList()) {
                                <div class="flex items-center justify-center py-8">
                                    <mat-spinner [diameter]="32"></mat-spinner>
                                </div>
                            } @else if (activeCalibrations().length === 0) {
                                <div class="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-300 rounded-xl">
                                    <mat-icon class="!text-5xl text-gray-300 mb-2">inventory_2</mat-icon>
                                    <p class="text-sm font-bold text-gray-400">No hay calibraciones enviadas</p>
                                    <p class="text-xs text-gray-400 mt-1">No se encontraron herramientas en estado "Enviado" o "En Proceso"</p>
                                    <button (click)="loadActiveCalibrations()"
                                            class="mt-3 px-4 py-1.5 bg-gray-100 border-2 border-black rounded-full text-xs font-bold shadow-[2px_2px_0px_0px_#000] hover:bg-gray-200 transition-all flex items-center gap-1">
                                        <mat-icon class="!text-sm">refresh</mat-icon> Recargar
                                    </button>
                                </div>
                            } @else {
                                <div class="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                                    @for (cal of activeCalibrations(); track cal.id_calibration) {
                                        <div (click)="selectCalibration(cal)"
                                             class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                                             [ngClass]="selectedCalibration()?.id_calibration === cal.id_calibration
                                                 ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-[3px_3px_0px_0px_#2563eb]'
                                                 : 'border-black bg-white dark:bg-gray-900 hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-y-px'">
                                            <!-- Select indicator -->
                                            <div class="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center flex-shrink-0"
                                                 [ngClass]="selectedCalibration()?.id_calibration === cal.id_calibration
                                                     ? 'bg-blue-600 text-white' : 'bg-gray-100'">
                                                @if (selectedCalibration()?.id_calibration === cal.id_calibration) {
                                                    <mat-icon class="!text-base text-white">check</mat-icon>
                                                } @else {
                                                    <mat-icon class="!text-sm text-gray-400">radio_button_unchecked</mat-icon>
                                                }
                                            </div>
                                            <!-- Info -->
                                            <div class="flex-1 min-w-0">
                                                <div class="flex items-center gap-2 flex-wrap">
                                                    <span class="font-black text-sm text-black dark:text-white">{{ cal.tool_code }}</span>
                                                    <span class="px-1.5 py-0.5 text-[9px] font-black bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600">
                                                        {{ cal.record_number }}
                                                    </span>
                                                    @if (cal.is_jack) {
                                                        <span class="px-1.5 py-0.5 text-[9px] font-black bg-purple-200 text-purple-900 rounded border border-purple-500">
                                                            GATA
                                                        </span>
                                                    }
                                                    <span class="px-2 py-0.5 text-[9px] font-black rounded-full border"
                                                          [ngClass]="getStatusChipClass(cal.status)">
                                                        {{ getStatusLabel(cal.status) }}
                                                    </span>
                                                </div>
                                                <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{{ cal.tool_name }}</p>
                                                <p class="text-[10px] text-gray-400 mt-0.5">
                                                    <span class="font-bold">Lab:</span> {{ cal.supplier_name || 'Sin laboratorio' }}
                                                    &nbsp;·&nbsp;
                                                    <span class="font-bold">Envío:</span> {{ cal.send_date || '—' }}
                                                    @if (cal.expected_return_date) {
                                                        &nbsp;·&nbsp;
                                                        <span class="font-bold">Retorno esp.:</span>
                                                        <span [class.text-red-600]="isExpected(cal.expected_return_date)">
                                                            {{ cal.expected_return_date }}
                                                        </span>
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    }
                                </div>
                            }
                        </div>
                    </div>

                    <!-- PASO 2: Datos del retorno -->
                    @if (selectedCalibration()) {
                        <div class="border-3 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] overflow-hidden">
                            <div class="flex items-center gap-2 px-4 py-2 bg-black text-white">
                                <mat-icon class="!text-base">fact_check</mat-icon>
                                <span class="text-xs font-black uppercase tracking-wider">Paso 2 — Resultado del Retorno</span>
                            </div>
                            <div class="p-4 flex flex-col gap-4">

                                <!-- Herramienta seleccionada (resumen) -->
                                <div class="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-3">
                                    <div class="w-9 h-9 bg-blue-600 rounded-lg border-2 border-black flex items-center justify-center flex-shrink-0">
                                        <mat-icon class="text-white !text-base">{{ selectedCalibration()!.is_jack ? 'precision_manufacturing' : 'build' }}</mat-icon>
                                    </div>
                                    <div class="min-w-0">
                                        <p class="font-black text-sm text-black dark:text-white">
                                            {{ selectedCalibration()!.tool_code }}
                                            <span class="ml-2 text-[10px] font-bold text-gray-500">{{ selectedCalibration()!.record_number }}</span>
                                        </p>
                                        <p class="text-xs text-gray-500 truncate">{{ selectedCalibration()!.tool_name }}</p>
                                        <p class="text-[10px] text-blue-700 dark:text-blue-400 font-bold">
                                            Lab: {{ selectedCalibration()!.supplier_name || '—' }}
                                        </p>
                                    </div>
                                </div>

                                <!-- Resultado + Condición física -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Resultado de calibración *</mat-label>
                                        <mat-select [(value)]="result" required>
                                            <mat-option value="approved">
                                                <span class="text-green-700 font-bold">✓ Aprobado</span>
                                            </mat-option>
                                            <mat-option value="conditional">
                                                <span class="text-amber-700 font-bold">⚠ Condicional</span>
                                            </mat-option>
                                            <mat-option value="rejected">
                                                <span class="text-red-700 font-bold">✗ Rechazado</span>
                                            </mat-option>
                                        </mat-select>
                                        <mat-icon matPrefix>grading</mat-icon>
                                    </mat-form-field>
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Condición física</mat-label>
                                        <mat-select [(value)]="physicalCondition">
                                            <mat-option value="S">S — Serviciable</mat-option>
                                            <mat-option value="R">R — Reparable</mat-option>
                                            <mat-option value="M">M — Malo</mat-option>
                                        </mat-select>
                                        <mat-icon matPrefix>health_and_safety</mat-icon>
                                    </mat-form-field>
                                </div>

                                <!-- Certificado -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Número de certificado</mat-label>
                                        <input matInput [(ngModel)]="certificateNumber" placeholder="Ej: CERT-2026-001">
                                        <mat-icon matPrefix>verified</mat-icon>
                                    </mat-form-field>
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Fecha del certificado</mat-label>
                                        <input matInput [matDatepicker]="certPicker" [(ngModel)]="certificateDate">
                                        <mat-datepicker-toggle matSuffix [for]="certPicker"></mat-datepicker-toggle>
                                        <mat-datepicker #certPicker></mat-datepicker>
                                        <mat-icon matPrefix>calendar_month</mat-icon>
                                    </mat-form-field>
                                </div>

                                <!-- Fechas de calibración -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Fecha de calibración realizada</mat-label>
                                        <input matInput [matDatepicker]="calDatePicker" [(ngModel)]="calibrationDate">
                                        <mat-datepicker-toggle matSuffix [for]="calDatePicker"></mat-datepicker-toggle>
                                        <mat-datepicker #calDatePicker></mat-datepicker>
                                        <mat-icon matPrefix>event_note</mat-icon>
                                    </mat-form-field>
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Próxima calibración</mat-label>
                                        <input matInput [matDatepicker]="nextCalPicker" [(ngModel)]="nextCalibrationDate">
                                        <mat-datepicker-toggle matSuffix [for]="nextCalPicker"></mat-datepicker-toggle>
                                        <mat-datepicker #nextCalPicker></mat-datepicker>
                                        <mat-icon matPrefix>event_available</mat-icon>
                                    </mat-form-field>
                                </div>

                                <!-- Panel especial para Gatas -->
                                @if (selectedCalibration()!.is_jack) {
                                    <div class="bg-purple-50 dark:bg-purple-900/20 border-3 border-purple-500 rounded-xl p-4 shadow-[3px_3px_0px_0px_#7e22ce]">
                                        <div class="flex items-center gap-2 mb-3">
                                            <mat-icon class="text-purple-700 !text-lg">precision_manufacturing</mat-icon>
                                            <p class="text-xs font-black text-purple-800 dark:text-purple-300 uppercase">
                                                Gata Hidráulica — Fechas de Servicio Técnico
                                            </p>
                                        </div>
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                                <mat-label>Próx. Servicio Semestral</mat-label>
                                                <input matInput [matDatepicker]="semiPicker" [(ngModel)]="jackSemiannualDate">
                                                <mat-datepicker-toggle matSuffix [for]="semiPicker"></mat-datepicker-toggle>
                                                <mat-datepicker #semiPicker></mat-datepicker>
                                                <mat-icon matPrefix>update</mat-icon>
                                                <mat-hint>Actual: {{ selectedCalibration()!.next_calibration_date || 'Sin fecha' }}</mat-hint>
                                            </mat-form-field>
                                            <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                                <mat-label>Próx. Servicio Anual</mat-label>
                                                <input matInput [matDatepicker]="annualPicker" [(ngModel)]="jackAnnualDate">
                                                <mat-datepicker-toggle matSuffix [for]="annualPicker"></mat-datepicker-toggle>
                                                <mat-datepicker #annualPicker></mat-datepicker>
                                                <mat-icon matPrefix>date_range</mat-icon>
                                            </mat-form-field>
                                        </div>
                                        <p class="mt-2 text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                                            Si no se especifican, el backend recalcula automáticamente +6 y +12 meses.
                                        </p>
                                    </div>
                                }

                                <!-- Costo + Moneda -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Costo de calibración</mat-label>
                                        <input matInput type="number" [(ngModel)]="cost" placeholder="0.00" min="0">
                                        <span matPrefix class="text-sm font-bold text-gray-500 ml-2 mr-1">{{ currency }}&nbsp;</span>
                                    </mat-form-field>
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Moneda</mat-label>
                                        <mat-select [(value)]="currency">
                                            <mat-option value="BOB">BOB — Bolivianos</mat-option>
                                            <mat-option value="USD">USD — Dólares</mat-option>
                                        </mat-select>
                                        <mat-icon matPrefix>payments</mat-icon>
                                    </mat-form-field>
                                </div>

                                <!-- Observaciones -->
                                <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                                    <mat-label>Observaciones</mat-label>
                                    <textarea matInput [(ngModel)]="observations" rows="3"
                                              placeholder="Observaciones del retorno, condición de entrega..."></textarea>
                                    <mat-icon matPrefix>notes</mat-icon>
                                </mat-form-field>

                                <!-- Resumen resultado -->
                                <div class="border-3 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#000]"
                                     [ngClass]="result === 'approved' ? 'bg-green-50' : result === 'conditional' ? 'bg-amber-50' : 'bg-red-50'">
                                    <p class="text-[10px] font-black uppercase mb-2 tracking-wider"
                                       [ngClass]="result === 'approved' ? 'text-green-800' : result === 'conditional' ? 'text-amber-800' : 'text-red-800'">
                                        <mat-icon class="!text-xs align-middle mr-1">info</mat-icon>Resumen del retorno
                                    </p>
                                    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                        <div>
                                            <span class="text-gray-500 font-bold">Herramienta:</span>
                                            <span class="ml-1 font-black text-black">{{ selectedCalibration()!.tool_code }}</span>
                                        </div>
                                        <div>
                                            <span class="text-gray-500 font-bold">Resultado:</span>
                                            <span class="ml-1 font-black"
                                                  [ngClass]="result === 'approved' ? 'text-green-700' : result === 'conditional' ? 'text-amber-700' : 'text-red-700'">
                                                {{ result === 'approved' ? 'APROBADO' : result === 'conditional' ? 'CONDICIONAL' : 'RECHAZADO' }}
                                            </span>
                                        </div>
                                        <div>
                                            <span class="text-gray-500 font-bold">Certificado:</span>
                                            <span class="ml-1 font-black text-black">{{ certificateNumber || '—' }}</span>
                                        </div>
                                        <div>
                                            <span class="text-gray-500 font-bold">Prox. calibración:</span>
                                            <span class="ml-1 font-black text-black">{{ formatDateDisplay(nextCalibrationDate) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }

                </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end gap-3 p-5 border-t-3 border-black">
                <button mat-dialog-close
                        class="px-4 py-2 bg-gray-200 text-black font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase">
                    Cancelar
                </button>
                <button (click)="processReturn()"
                        [disabled]="isProcessing() || !canSubmit()"
                        class="px-5 py-2 bg-blue-600 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    @if (isProcessing()) {
                        <mat-spinner [diameter]="18"></mat-spinner>
                    } @else {
                        <mat-icon class="text-white !h-5 !text-lg">check_circle</mat-icon>
                    }
                    Procesar Retorno
                </button>
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; height: 100%; }
        .border-3 { border-width: 3px; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class RetornoCalibracionComponent implements OnInit, OnDestroy {
    private calibrationService = inject(CalibrationService);
    private dialogRef = inject(MatDialogRef<RetornoCalibracionComponent>);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    // Signals
    isLoadingList = signal(false);
    isProcessing = signal(false);
    activeCalibrations = signal<ActiveCalibration[]>([]);
    selectedCalibration = signal<ActiveCalibration | null>(null);

    // Form fields
    result: 'approved' | 'conditional' | 'rejected' = 'approved';
    physicalCondition: 'S' | 'R' | 'M' = 'S';
    certificateNumber = '';
    certificateDate: Date | null = null;
    calibrationDate: Date | null = null;
    nextCalibrationDate: Date | null = null;
    jackSemiannualDate: Date | null = null;
    jackAnnualDate: Date | null = null;
    cost: number | null = null;
    currency = 'BOB';
    observations = '';

    ngOnInit(): void {
        this.loadActiveCalibrations();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadActiveCalibrations(): void {
        this.isLoadingList.set(true);
        this.calibrationService.getCalibrations({ status: 'sent', limit: 100 }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoadingList.set(false))
        ).subscribe({
            next: (records: any[]) => {
                const mapped: ActiveCalibration[] = records.map(r => ({
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
                }));
                this.activeCalibrations.set(mapped);
            },
            error: () => {
                this.showMessage('Error al cargar calibraciones activas', 'error');
            }
        });
    }

    selectCalibration(cal: ActiveCalibration): void {
        this.selectedCalibration.set(cal);
        // Reset form
        this.result = 'approved';
        this.physicalCondition = 'S';
        this.certificateNumber = '';
        this.certificateDate = null;
        this.calibrationDate = null;
        this.nextCalibrationDate = null;
        this.jackSemiannualDate = null;
        this.jackAnnualDate = null;
        this.cost = null;
        this.observations = '';
    }

    canSubmit(): boolean {
        return !!(this.selectedCalibration() && this.result);
    }

    processReturn(): void {
        if (!this.canSubmit()) return;

        const cal = this.selectedCalibration()!;
        this.isProcessing.set(true);

        const params: any = {
            id_calibration: cal.id_calibration,
            result: this.result,
            physical_condition: this.physicalCondition,
            calibration_performed: true,
            observations: this.observations || ''
        };

        if (this.certificateNumber) params.certificate_number = this.certificateNumber;
        if (this.certificateDate) params.certificate_date = this.formatDate(this.certificateDate);
        if (this.calibrationDate) params.calibration_date = this.formatDate(this.calibrationDate);
        if (this.nextCalibrationDate) params.next_calibration_date = this.formatDate(this.nextCalibrationDate);
        if (cal.is_jack && this.jackSemiannualDate) params.jack_semiannual_date = this.formatDate(this.jackSemiannualDate);
        if (cal.is_jack && this.jackAnnualDate) params.jack_annual_date = this.formatDate(this.jackAnnualDate);

        this.calibrationService.processCalibrationReturnPxp(params).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isProcessing.set(false))
        ).subscribe({
            next: (res) => {
                const msg = res?.mensaje || res?.message || 'Retorno procesado exitosamente';
                this.showMessage(msg, 'success');
                this.dialogRef.close({ success: true, action: 'returned' });
            },
            error: () => {
                this.showMessage('Error al procesar el retorno', 'error');
            }
        });
    }

    printNotaRetorno(): void {
        const cal = this.selectedCalibration();
        if (!cal) return;
        const today = new Date().toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const resultLabel = { approved: 'APROBADO', conditional: 'CONDICIONAL', rejected: 'RECHAZADO' }[this.result];
        const resultColor = { approved: '#16a34a', conditional: '#d97706', rejected: '#dc2626' }[this.result];
        const resultBg = { approved: '#f0fdf4', conditional: '#fffbeb', rejected: '#fef2f2' }[this.result];

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Nota Retorno ${cal.record_number}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; line-height: 1.4; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
.logo { font-size: 28px; font-weight: 900; color: #2563eb; }
.logo-sub { font-size: 10px; color: #666; font-weight: 700; }
.doc-code { font-size: 14px; font-weight: 900; background: #2563eb; color: white; padding: 8px 16px; border: 3px solid #000; box-shadow: 4px 4px 0 #000; text-align: center; }
h1 { text-align: center; font-size: 16px; margin: 15px 0; text-transform: uppercase; background: #eff6ff; padding: 10px; border: 3px solid #000; box-shadow: 4px 4px 0 #000; font-weight: 900; }
.result-strip { text-align: center; margin-bottom: 15px; }
.result-badge { display: inline-block; padding: 6px 20px; border: 3px solid ${resultColor}; color: ${resultColor}; background: ${resultBg}; font-weight: 900; font-size: 16px; letter-spacing: 1px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
.box { border: 3px solid #000; padding: 12px; background: white; box-shadow: 3px 3px 0 #000; }
.box h3 { margin: -12px -12px 10px; font-size: 11px; background: #1e293b; color: #fff; padding: 6px 10px; font-weight: 900; text-transform: uppercase; }
.row { display: flex; margin-bottom: 4px; font-size: 11px; }
.lbl { font-weight: 800; min-width: 140px; color: #444; }
.val { flex: 1; font-weight: 600; }
.sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 50px; padding-top: 15px; border-top: 3px solid #000; }
.sig { text-align: center; }
.sig-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 6px; font-weight: 700; font-size: 11px; }
.footer { text-align: center; margin-top: 25px; font-size: 9px; color: #999; border-top: 1px dashed #ccc; padding-top: 8px; }
@media print { body { margin: 15px; } }
</style></head><body>
<div class="header">
    <div><div class="logo">BOA</div><div class="logo-sub">Boliviana de Aviacion - Sistema de Herramientas</div><div class="logo-sub">Almacen - Retorno de Calibracion Individual</div></div>
    <div style="text-align:right"><div class="doc-code">{{ ${cal.record_number} }}</div><div style="font-size:10px;color:#555;margin-top:4px">Generado: ${today}</div></div>
</div>
<h1>Nota de Retorno de Calibración</h1>
<div class="result-strip"><div class="result-badge">Resultado: ${resultLabel}</div></div>
<div class="grid-2">
    <div class="box"><h3>Datos de la Herramienta</h3>
        <div class="row"><span class="lbl">Código:</span><span class="val"><strong>${cal.tool_code}</strong></span></div>
        <div class="row"><span class="lbl">Descripción:</span><span class="val">${cal.tool_name}</span></div>
        <div class="row"><span class="lbl">N° Serie:</span><span class="val">${cal.tool_serial || '—'}</span></div>
        <div class="row"><span class="lbl">Tipo:</span><span class="val">${cal.is_jack ? 'GATA HIDRÁULICA' : 'Herramienta estándar'}</span></div>
        <div class="row"><span class="lbl">Condición física:</span><span class="val">${this.physicalCondition === 'S' ? 'Serviciable' : this.physicalCondition === 'R' ? 'Reparable' : 'Malo'}</span></div>
    </div>
    <div class="box"><h3>Datos del Retorno</h3>
        <div class="row"><span class="lbl">Nro. Registro:</span><span class="val"><strong>${cal.record_number}</strong></span></div>
        <div class="row"><span class="lbl">Laboratorio:</span><span class="val">${cal.supplier_name}</span></div>
        <div class="row"><span class="lbl">Fecha de envío:</span><span class="val">${cal.send_date}</span></div>
        <div class="row"><span class="lbl">Resultado:</span><span class="val"><strong style="color:${resultColor}">${resultLabel}</strong></span></div>
        <div class="row"><span class="lbl">Nro. Certificado:</span><span class="val">${this.certificateNumber || '—'}</span></div>
        <div class="row"><span class="lbl">Próx. Calibración:</span><span class="val"><strong>${this.nextCalibrationDate ? this.formatDate(this.nextCalibrationDate) : '—'}</strong></span></div>
        ${this.cost ? `<div class="row"><span class="lbl">Costo:</span><span class="val">${this.cost.toFixed(2)} ${this.currency}</span></div>` : ''}
    </div>
</div>
${this.observations ? `<div class="box" style="margin-bottom:15px"><strong>Observaciones:</strong> ${this.observations}</div>` : ''}
<div class="sigs">
    <div class="sig"><div class="sig-line">Recibido por (Almacén)<br><span style="font-weight:400;font-size:10px">Responsable de Herramientas</span></div></div>
    <div class="sig"><div class="sig-line">Verificado por (Calidad)<br><span style="font-weight:400;font-size:10px">Control de Calidad</span></div></div>
    <div class="sig"><div class="sig-line">Aprobado por (Jefatura)<br><span style="font-weight:400;font-size:10px">&nbsp;</span></div></div>
</div>
<div class="footer">Documento generado por el Sistema de Gestión de Herramientas - BOA | ${today}</div>
</body></html>`;

        const win = window.open('', '_blank');
        if (!win) { this.showMessage('No se pudo abrir la ventana de impresión', 'error'); return; }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
    }

    getStatusLabel(status: string): string {
        const map: Record<string, string> = {
            sent: 'ENVIADO', in_process: 'EN PROCESO', in_transit: 'EN TRÁNSITO',
            pending: 'PENDIENTE', completed: 'COMPLETADO', returned: 'RETORNADO'
        };
        return map[status] || status?.toUpperCase() || '—';
    }

    getStatusChipClass(status: string): string {
        switch (status) {
            case 'sent': return 'bg-blue-100 text-blue-800 border-blue-400';
            case 'in_process': return 'bg-amber-100 text-amber-800 border-amber-400';
            case 'in_transit': return 'bg-indigo-100 text-indigo-800 border-indigo-400';
            default: return 'bg-gray-100 text-gray-700 border-gray-300';
        }
    }

    isExpected(date: string | null): boolean {
        if (!date) return false;
        return new Date(date) < new Date();
    }

    formatDateDisplay(date: Date | null): string {
        if (!date) return '—';
        return date.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    private formatDate(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }

    close(): void { this.dialogRef.close(); }
}
