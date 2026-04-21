import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
        CommonModule,
        FormsModule,
        MatIconModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './crear-lote-dialog.component.html',
    styles: [`
        /* Transiciones suaves para hover y active */
        .transition-all {
            transition-property: all;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            transition-duration: 150ms;
        }
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

    // Inicializar con la fecha actual en formato YYYY-MM-DD para el input type="date"
    sendDateStr: string = new Date().toISOString().split('T')[0];
    expectedReturnDateStr: string = '';

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

    onLabChange(): void {
        const lab = this.laboratories.find(l => String(l.id_laboratory) === String(this.selectedLabId));
        this.selectedLabName = lab?.name || '';
    }

    onBaseChange(): void {
        const base = this.bases.find(b => String(b.id) === String(this.selectedBaseId));
        this.selectedBaseName = base?.nombre || '';
    }

    createBatch(): void {
        if (!this.selectedLabId || !this.sendDateStr) {
            this.showMessage('Debe seleccionar un laboratorio y la fecha de envío.', 'warning');
            return;
        }

        this.isSaving = true;
        const params: any = {
            laboratory_id: this.selectedLabId,
            laboratory_name: this.selectedLabName,
            send_date: this.sendDateStr,
            expected_return_date: this.expectedReturnDateStr || '',
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

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
