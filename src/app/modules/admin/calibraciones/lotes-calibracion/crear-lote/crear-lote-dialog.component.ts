import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CalibrationBatchService } from '../../../../../core/services/calibration-batch.service';
import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MovementService } from '../../../../../core/services/movement.service';

@Component({
    selector: 'app-crear-lote-dialog',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatIconModule, MatButtonModule,
        MatDialogModule, MatSnackBarModule, MatFormFieldModule,
        MatInputModule, MatSelectModule, MatDatepickerModule,
        MatNativeDateModule, MatProgressSpinnerModule
    ],
    template: `
        <div class="flex flex-col h-full bg-white dark:bg-[#0F172AFF] font-sans">

            <!-- Header -->
            <div class="flex items-center justify-between p-5 border-b-3 border-black">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-[#FF6A00FF] border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_#000] flex items-center justify-center">
                        <mat-icon class="text-white !text-xl">add_circle</mat-icon>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-black dark:text-white uppercase tracking-tight">
                            Nuevo Lote de Calibracion
                        </h2>
                        <p class="text-xs font-bold text-gray-500">El numero de lote se genera automaticamente</p>
                    </div>
                </div>
                <button mat-dialog-close
                        class="w-9 h-9 bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:bg-gray-100 flex items-center justify-center transition-all active:shadow-none active:translate-x-[1px] active:translate-y-[1px]">
                    <mat-icon class="!text-lg">close</mat-icon>
                </button>
            </div>

            <!-- Form -->
            <div class="flex-1 overflow-y-auto p-5">
                <div class="flex flex-col gap-4 max-w-lg mx-auto">

                    <!-- Laboratorio -->
                    <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                        <mat-label>Laboratorio</mat-label>
                        <mat-select [(value)]="selectedLabId" (selectionChange)="onLabChange($event.value)" required>
                            @for (lab of laboratories; track lab.id_laboratory) {
                                <mat-option [value]="lab.id_laboratory">{{ lab.name }}</mat-option>
                            }
                        </mat-select>
                        <mat-icon matPrefix>science</mat-icon>
                    </mat-form-field>

                    <!-- Fecha Envio -->
                    <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                        <mat-label>Fecha de Envio</mat-label>
                        <input matInput [matDatepicker]="sendPicker" [(ngModel)]="sendDate" required>
                        <mat-datepicker-toggle matSuffix [for]="sendPicker"></mat-datepicker-toggle>
                        <mat-datepicker #sendPicker></mat-datepicker>
                    </mat-form-field>

                    <!-- Fecha Retorno Esperada -->
                    <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                        <mat-label>Fecha Retorno Esperada</mat-label>
                        <input matInput [matDatepicker]="returnPicker" [(ngModel)]="expectedReturnDate">
                        <mat-datepicker-toggle matSuffix [for]="returnPicker"></mat-datepicker-toggle>
                        <mat-datepicker #returnPicker></mat-datepicker>
                    </mat-form-field>

                    <!-- Base -->
                    <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                        <mat-label>Base</mat-label>
                        <mat-select [(value)]="selectedBaseId" (selectionChange)="onBaseChange($event.value)" required>
                            @for (base of bases; track base.id) {
                                <mat-option [value]="base.id">{{ base.nombre }}</mat-option>
                            }
                        </mat-select>
                        <mat-icon matPrefix>location_on</mat-icon>
                    </mat-form-field>

                    <!-- Orden de Servicio -->
                    <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                        <mat-label>Orden de Servicio</mat-label>
                        <input matInput [(ngModel)]="serviceOrder" placeholder="Ej: OS-2026-001">
                        <mat-icon matPrefix>receipt</mat-icon>
                    </mat-form-field>

                    <!-- Notas -->
                    <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                        <mat-label>Notas</mat-label>
                        <textarea matInput [(ngModel)]="notes" rows="2" placeholder="Notas del lote..."></textarea>
                        <mat-icon matPrefix>notes</mat-icon>
                    </mat-form-field>

                    <!-- Observaciones -->
                    <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                        <mat-label>Observaciones</mat-label>
                        <textarea matInput [(ngModel)]="observations" rows="2" placeholder="Observaciones adicionales..."></textarea>
                        <mat-icon matPrefix>comment</mat-icon>
                    </mat-form-field>

                    <!-- Info -->
                    <div class="bg-blue-50 border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#000]">
                        <div class="flex items-start gap-2">
                            <mat-icon class="text-blue-600 !text-lg mt-0.5">info</mat-icon>
                            <div class="text-xs text-blue-800">
                                <p class="font-bold">Flujo del lote:</p>
                                <p class="mt-1">1. Crear lote → 2. Escanear herramientas → 3. Confirmar y enviar</p>
                                <p class="mt-1">Las herramientas se agregan desde el detalle del lote.</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end gap-3 p-5 border-t-3 border-black">
                <button mat-dialog-close
                        class="px-4 py-2 bg-gray-200 text-black font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase">
                    Cancelar
                </button>
                <button (click)="createBatch()"
                        [disabled]="isSaving || !selectedLabId || !sendDate"
                        class="px-5 py-2 bg-[#FF6A00FF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    @if (isSaving) {
                        <mat-spinner [diameter]="18" class="!text-white"></mat-spinner>
                    } @else {
                        <mat-icon class="text-white !h-5 !text-lg">save</mat-icon>
                    }
                    Crear Lote
                </button>
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; }
        .border-3 { border-width: 3px; }
    `]
})
export class CrearLoteDialogComponent implements OnInit, OnDestroy {
    private batchService = inject(CalibrationBatchService);
    private calibrationService = inject(CalibrationService);
    private movementService = inject(MovementService);
    private dialogRef = inject(MatDialogRef<CrearLoteDialogComponent>);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    laboratories: any[] = [];
    bases: any[] = [];
    selectedLabId: number | null = null;
    selectedLabName = '';
    selectedBaseId: number | null = null;
    selectedBaseName = '';
    sendDate: Date | null = new Date();
    expectedReturnDate: Date | null = null;
    serviceOrder = '';
    notes = '';
    observations = '';
    isSaving = false;

    ngOnInit(): void {
        this.loadLaboratories();
        this.loadBases();
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

    loadBases(): void {
        this.movementService.getBases().pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (bases) => this.bases = bases,
            error: () => this.showMessage('Error al cargar bases', 'error')
        });
    }

    onLabChange(labId: number): void {
        const lab = this.laboratories.find(l => l.id_laboratory === labId);
        this.selectedLabName = lab?.name || '';
    }

    onBaseChange(baseId: number): void {
        const base = this.bases.find(b => b.id === baseId);
        this.selectedBaseName = base?.nombre || '';
    }

    createBatch(): void {
        if (!this.selectedLabId || !this.sendDate) return;

        this.isSaving = true;
        const params: any = {
            laboratory_id: this.selectedLabId,
            laboratory_name: this.selectedLabName,
            send_date: this.formatDate(this.sendDate),
            expected_return_date: this.expectedReturnDate ? this.formatDate(this.expectedReturnDate) : '',
            notes: this.notes || ''
        };

        this.batchService.createBatch(params).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (result) => {
                this.isSaving = false;
                this.showMessage('Lote creado exitosamente', 'success');
                this.dialogRef.close({ success: true, data: result });
            },
            error: () => {
                this.isSaving = false;
                this.showMessage('Error al crear el lote', 'error');
            }
        });
    }

    private formatDate(date: Date | string | null | undefined): string {
        const d = date instanceof Date ? date : new Date(date as string);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
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
