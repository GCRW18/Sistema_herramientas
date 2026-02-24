import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef } from '@angular/core';
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
import { ScanToolResult } from '../../../../core/models';

@Component({
    selector: 'app-envio-calibracion',
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
                    <div class="w-10 h-10 bg-[#FF6A00FF] border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_#000] flex items-center justify-center">
                        <mat-icon class="text-white !text-xl">send</mat-icon>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-black dark:text-white uppercase tracking-tight">
                            Envío a Calibración
                        </h2>
                        <p class="text-xs font-bold text-gray-500">Registro individual de herramienta</p>
                    </div>
                </div>
                <button mat-dialog-close
                        class="w-9 h-9 bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:bg-gray-100 flex items-center justify-center transition-all active:shadow-none active:translate-x-[1px] active:translate-y-[1px]">
                    <mat-icon class="!text-lg">close</mat-icon>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <div class="flex flex-col gap-5 max-w-2xl mx-auto">

                    <!-- PASO 1: Escanear herramienta -->
                    <div class="border-3 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] overflow-hidden">
                        <div class="flex items-center gap-2 px-4 py-2 bg-black text-white">
                            <mat-icon class="!text-base">qr_code_scanner</mat-icon>
                            <span class="text-xs font-black uppercase tracking-wider">Paso 1 — Identificar Herramienta</span>
                        </div>
                        <div class="p-4">
                            <div class="flex gap-2">
                                <mat-form-field appearance="outline" class="flex-1" subscriptSizing="dynamic">
                                    <mat-label>Código de barras / Código herramienta</mat-label>
                                    <input #barcodeInput matInput
                                           [(ngModel)]="barcodeValue"
                                           (keydown.enter)="scanTool()"
                                           placeholder="Escanear o escribir código..."
                                           [disabled]="isScanning()">
                                    <mat-icon matPrefix>barcode_reader</mat-icon>
                                </mat-form-field>
                                <button (click)="scanTool()"
                                        [disabled]="isScanning() || !barcodeValue.trim()"
                                        class="px-4 py-2 bg-[#FF6A00FF] text-white font-black text-sm border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed self-start mt-1">
                                    @if (isScanning()) {
                                        <mat-spinner [diameter]="18" class="!text-white"></mat-spinner>
                                    } @else {
                                        <mat-icon class="!text-lg !h-5">search</mat-icon>
                                    }
                                    Buscar
                                </button>
                            </div>

                            <!-- Resultado del escaneo -->
                            @if (scannedTool()) {
                                <div class="mt-3 border-3 rounded-xl overflow-hidden shadow-[3px_3px_0px_0px_#000]"
                                     [ngClass]="scannedTool()!.is_jack ? 'border-purple-500' : 'border-black'">
                                    <div class="flex items-center gap-2 px-3 py-2"
                                         [ngClass]="scannedTool()!.is_jack ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-green-50 dark:bg-green-900/20'">
                                        <mat-icon class="!text-base"
                                                  [ngClass]="scannedTool()!.is_jack ? 'text-purple-700' : 'text-green-700'">
                                            {{ scannedTool()!.is_jack ? 'precision_manufacturing' : 'check_circle' }}
                                        </mat-icon>
                                        <span class="text-xs font-black uppercase"
                                              [ngClass]="scannedTool()!.is_jack ? 'text-purple-800' : 'text-green-800'">
                                            {{ scannedTool()!.is_jack ? 'Gata Hidráulica detectada' : 'Herramienta encontrada' }}
                                        </span>
                                        @if (scannedTool()!.scan_warning) {
                                            <span class="ml-auto px-2 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-black rounded-full border border-amber-400">
                                                ADVERTENCIA
                                            </span>
                                        }
                                    </div>
                                    <div class="p-3 bg-white dark:bg-gray-900">
                                        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                            <div>
                                                <span class="font-black text-gray-500 uppercase text-[10px]">Código</span>
                                                <p class="font-black text-black dark:text-white text-sm">{{ scannedTool()!.code }}</p>
                                            </div>
                                            <div>
                                                <span class="font-black text-gray-500 uppercase text-[10px]">Serie</span>
                                                <p class="font-bold text-black dark:text-white">{{ scannedTool()!.serial_number || '-' }}</p>
                                            </div>
                                            <div class="col-span-2">
                                                <span class="font-black text-gray-500 uppercase text-[10px]">Nombre</span>
                                                <p class="font-bold text-black dark:text-white">{{ scannedTool()!.name }}</p>
                                            </div>
                                            <div>
                                                <span class="font-black text-gray-500 uppercase text-[10px]">Última calibración</span>
                                                <p class="font-bold text-black dark:text-white">{{ scannedTool()!.last_calibration_date || 'Sin registro' }}</p>
                                            </div>
                                            <div>
                                                <span class="font-black text-gray-500 uppercase text-[10px]">Próxima calibración</span>
                                                <p class="font-bold"
                                                   [ngClass]="isCalibrationOverdue() ? 'text-red-700 font-black' : 'text-black dark:text-white'">
                                                    {{ scannedTool()!.next_calibration_date || 'Sin fecha' }}
                                                    @if (isCalibrationOverdue()) { <mat-icon class="!text-sm align-middle text-red-600">warning</mat-icon> }
                                                </p>
                                            </div>
                                            @if (scannedTool()!.is_jack) {
                                                <div>
                                                    <span class="font-black text-gray-500 uppercase text-[10px]">Serv. Semestral</span>
                                                    <p class="font-bold text-purple-800">{{ scannedTool()!.next_semiannual_service || 'Sin fecha' }}</p>
                                                </div>
                                                <div>
                                                    <span class="font-black text-gray-500 uppercase text-[10px]">Serv. Anual</span>
                                                    <p class="font-bold text-purple-800">{{ scannedTool()!.next_annual_service || 'Sin fecha' }}</p>
                                                </div>
                                            }
                                        </div>
                                        @if (scannedTool()!.scan_warning) {
                                            <div class="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg p-2">
                                                <mat-icon class="text-amber-600 !text-sm mt-0.5">warning</mat-icon>
                                                <p class="text-[11px] text-amber-800 font-bold">{{ scannedTool()!.scan_warning }}</p>
                                            </div>
                                        }
                                        <button (click)="clearScan()"
                                                class="mt-2 text-[11px] font-bold text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1">
                                            <mat-icon class="!text-sm">close</mat-icon> Cambiar herramienta
                                        </button>
                                    </div>
                                </div>
                            }

                            @if (!scannedTool() && !isScanning()) {
                                <div class="mt-3 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-3">
                                    <mat-icon class="text-blue-500 !text-sm">info</mat-icon>
                                    <p class="text-xs text-blue-700 dark:text-blue-300 font-bold">
                                        Escanee o escriba el código de la herramienta y presione Buscar o Enter.
                                    </p>
                                </div>
                            }
                        </div>
                    </div>

                    <!-- PASO 2: Datos del envío (solo si hay herramienta) -->
                    @if (scannedTool()) {
                        <div class="border-3 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] overflow-hidden">
                            <div class="flex items-center gap-2 px-4 py-2 bg-black text-white">
                                <mat-icon class="!text-base">assignment</mat-icon>
                                <span class="text-xs font-black uppercase tracking-wider">Paso 2 — Datos del Envío</span>
                            </div>
                            <div class="p-4 flex flex-col gap-4">

                                <!-- Laboratorio -->
                                <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                                    <mat-label>Laboratorio / Proveedor *</mat-label>
                                    <mat-select [(value)]="selectedLabId" (selectionChange)="onLabChange($event.value)" required>
                                        @for (lab of laboratories; track lab.id_laboratory) {
                                            <mat-option [value]="lab.id_laboratory">{{ lab.name }}</mat-option>
                                        }
                                    </mat-select>
                                    <mat-icon matPrefix>science</mat-icon>
                                    @if (laboratories.length === 0) {
                                        <mat-hint>Cargando laboratorios...</mat-hint>
                                    }
                                </mat-form-field>

                                <!-- Tipo de calibración + Orden de servicio -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Tipo de calibración</mat-label>
                                        <mat-select [(value)]="calibrationType">
                                            <mat-option value="calibration">Calibración</mat-option>
                                            <mat-option value="verification">Verificación</mat-option>
                                            <mat-option value="repair">Reparación</mat-option>
                                        </mat-select>
                                        <mat-icon matPrefix>build_circle</mat-icon>
                                    </mat-form-field>
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Orden de servicio</mat-label>
                                        <input matInput [(ngModel)]="serviceOrder" placeholder="Ej: OS-2026-001">
                                        <mat-icon matPrefix>receipt_long</mat-icon>
                                    </mat-form-field>
                                </div>

                                <!-- Fechas -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Fecha de envío *</mat-label>
                                        <input matInput [matDatepicker]="sendPicker" [(ngModel)]="sendDate" required>
                                        <mat-datepicker-toggle matSuffix [for]="sendPicker"></mat-datepicker-toggle>
                                        <mat-datepicker #sendPicker></mat-datepicker>
                                        <mat-icon matPrefix>event</mat-icon>
                                    </mat-form-field>
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Fecha retorno esperada</mat-label>
                                        <input matInput [matDatepicker]="returnPicker" [(ngModel)]="expectedReturnDate">
                                        <mat-datepicker-toggle matSuffix [for]="returnPicker"></mat-datepicker-toggle>
                                        <mat-datepicker #returnPicker></mat-datepicker>
                                        <mat-icon matPrefix>event_available</mat-icon>
                                    </mat-form-field>
                                </div>

                                <!-- Costo + Moneda -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                                        <mat-label>Costo estimado</mat-label>
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

                                <!-- Notas -->
                                <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                                    <mat-label>Notas / Observaciones</mat-label>
                                    <textarea matInput [(ngModel)]="notes" rows="3"
                                              placeholder="Observaciones del envío, condición de la herramienta..."></textarea>
                                    <mat-icon matPrefix>notes</mat-icon>
                                </mat-form-field>

                                <!-- Resumen del envío -->
                                <div class="bg-orange-50 dark:bg-orange-900/20 border-3 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#000]">
                                    <p class="text-[10px] font-black uppercase text-orange-800 dark:text-orange-300 mb-2 tracking-wider">
                                        <mat-icon class="!text-xs align-middle mr-1">info</mat-icon>Resumen del registro
                                    </p>
                                    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                        <div>
                                            <span class="text-gray-500 font-bold">Herramienta:</span>
                                            <span class="ml-1 font-black text-black dark:text-white">{{ scannedTool()!.code }}</span>
                                        </div>
                                        <div>
                                            <span class="text-gray-500 font-bold">Laboratorio:</span>
                                            <span class="ml-1 font-black text-black dark:text-white">{{ selectedLabName || '—' }}</span>
                                        </div>
                                        <div>
                                            <span class="text-gray-500 font-bold">Tipo:</span>
                                            <span class="ml-1 font-black text-black dark:text-white">{{ calibrationTypeLabel }}</span>
                                        </div>
                                        <div>
                                            <span class="text-gray-500 font-bold">Fecha envío:</span>
                                            <span class="ml-1 font-black text-black dark:text-white">{{ formatDateDisplay(sendDate) }}</span>
                                        </div>
                                    </div>
                                    <p class="mt-2 text-[10px] text-orange-700 dark:text-orange-400 font-bold">
                                        Se generará número de registro EC-XXXX/YYYY automáticamente.
                                    </p>
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
                <button (click)="submitEnvio()"
                        [disabled]="isSaving() || !canSubmit()"
                        class="px-5 py-2 bg-[#FF6A00FF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    @if (isSaving()) {
                        <mat-spinner [diameter]="18" class="!text-white"></mat-spinner>
                    } @else {
                        <mat-icon class="text-white !h-5 !text-lg">send</mat-icon>
                    }
                    Registrar Envío
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
export class EnvioCalibracionComponent implements OnInit, OnDestroy {
    private calibrationService = inject(CalibrationService);
    private dialogRef = inject(MatDialogRef<EnvioCalibracionComponent>);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    @ViewChild('barcodeInput') barcodeInput!: ElementRef<HTMLInputElement>;

    // Signals
    isScanning = signal(false);
    isSaving = signal(false);
    scannedTool = signal<ScanToolResult | null>(null);

    // Scan
    barcodeValue = '';

    // Form fields
    laboratories: any[] = [];
    selectedLabId: number | null = null;
    selectedLabName = '';
    calibrationType: 'calibration' | 'verification' | 'repair' = 'calibration';
    serviceOrder = '';
    sendDate: Date | null = new Date();
    expectedReturnDate: Date | null = null;
    cost: number | null = null;
    currency = 'BOB';
    notes = '';

    get calibrationTypeLabel(): string {
        const map: Record<string, string> = {
            calibration: 'Calibración',
            verification: 'Verificación',
            repair: 'Reparación'
        };
        return map[this.calibrationType] || this.calibrationType;
    }

    ngOnInit(): void {
        this.loadLaboratories();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

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
                if (!result) {
                    this.showMessage('Herramienta no encontrada. Verifique el código.', 'error');
                    return;
                }
                this.scannedTool.set(result);
                if (result.scan_warning) {
                    this.showMessage(result.scan_warning, 'warning');
                }
            },
            error: () => {
                this.showMessage('Error al buscar la herramienta', 'error');
            }
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

    canSubmit(): boolean {
        return !!(this.scannedTool() && this.selectedLabId && this.sendDate);
    }

    isCalibrationOverdue(): boolean {
        const tool = this.scannedTool();
        if (!tool?.next_calibration_date) return false;
        return new Date(tool.next_calibration_date) < new Date();
    }

    submitEnvio(): void {
        if (!this.canSubmit()) return;

        const tool = this.scannedTool()!;
        this.isSaving.set(true);

        const params: any = {
            tool_id: tool.id_tool,
            calibration_type: this.calibrationType,
            supplier_id: this.selectedLabId,
            supplier_name: this.selectedLabName,
            send_date: this.formatDate(this.sendDate!),
            notes: this.notes || ''
        };

        if (this.serviceOrder) params.service_order = this.serviceOrder;
        if (this.expectedReturnDate) params.expected_return_date = this.formatDate(this.expectedReturnDate);
        if (this.cost) { params.cost = this.cost; params.currency = this.currency; }

        this.calibrationService.sendToCalibrationPxp(params).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: (result) => {
                const recordNum = result?.record_number || result?.datos?.[0]?.record_number || '';
                this.showMessage(
                    recordNum
                        ? `Envío registrado: ${recordNum}`
                        : 'Envío a calibración registrado exitosamente',
                    'success'
                );
                this.dialogRef.close({ success: true, data: result });
            },
            error: () => {
                this.showMessage('Error al registrar el envío', 'error');
            }
        });
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
