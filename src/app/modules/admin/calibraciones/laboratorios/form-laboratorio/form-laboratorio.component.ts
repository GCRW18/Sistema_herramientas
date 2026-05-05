import { Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../../core/services/calibration.service';

export interface Laboratory {
    id_laboratory: string | null;
    code: string;
    name: string;
    rut_nit: string;
    tipo_servicio: string;
    address: string;
    city: string;
    country: string;
    contact_person: string;
    phone: string;
    email: string;
    website: string;
    is_certified: boolean;
    certification_number: string;
    certification_types: string; // 🚀 FIX: Agregado al modelo
    rating: number;
    average_delivery_days: number;
    active: boolean;
    observaciones: string;
}

export type DialogMode = 'new' | 'edit' | 'view';

@Component({
    selector: 'app-form-laboratorio',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    ],
    templateUrl: './form-laboratorio.component.html',
})
export class FormLaboratorioComponent implements OnDestroy {

    private calibrationService = inject(CalibrationService);
    public dialogRef = inject(MatDialogRef<FormLaboratorioComponent>);
    private snackBar = inject(MatSnackBar);
    private data = inject<{ mode: DialogMode; laboratory?: Laboratory }>(MAT_DIALOG_DATA);
    private _destroy$ = new Subject<void>();

    // Signals
    isSaving = signal(false);

    // Modo del diálogo
    mode: DialogMode;

    // Datos del laboratorio
    laboratory: Laboratory;

    // Opciones para tipo de servicio
    tiposServicio = [
        { value: 'calibracion', label: 'Calibración' },
        { value: 'mantenimiento', label: 'Mantenimiento' },
        { value: 'ambos', label: 'Ambos' },
    ];

    constructor() {
        // Inicializar modo
        this.mode = this.data?.mode || 'new';

        // Inicializar laboratorio
        if (this.data?.laboratory) {
            this.laboratory = { ...this.data.laboratory };
            // Asegurar que el campo exista al editar si venía nulo
            if (!this.laboratory.certification_types) {
                this.laboratory.certification_types = '';
            }
        } else {
            this.laboratory = this.getEmptyLaboratory();
        }
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    /**
     * Retorna un objeto Laboratory vacío
     */
    private getEmptyLaboratory(): Laboratory {
        return {
            id_laboratory: null,
            code: '',
            name: '',
            rut_nit: '',
            tipo_servicio: '',
            address: '',
            city: '',
            country: 'Bolivia',
            contact_person: '',
            phone: '',
            email: '',
            website: '',
            is_certified: false,
            certification_number: '',
            certification_types: '', // 🚀 FIX: Inicializado para que viaje en el JSON
            rating: 0,
            average_delivery_days: 30,
            active: true,
            observaciones: '',
        };
    }

    /**
     * Verifica si el formulario puede ser enviado
     */
    canSubmit(): boolean {
        if (!this.laboratory) return false;
        return !!(
            this.laboratory.code?.trim() &&
            this.laboratory.name?.trim() &&
            this.laboratory.tipo_servicio
        );
    }

    /**
     * Guarda la empresa (crear o actualizar)
     */
    save(): void {
        if (!this.canSubmit()) {
            this.showMessage('Complete los campos requeridos', 'warning');
            return;
        }

        this.isSaving.set(true);
        this.calibrationService.saveLaboratory(this.laboratory).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: () => {
                this.showMessage('Empresa guardada exitosamente', 'success');
                this.dialogRef.close(true);
            },
            error: (err) => {
                console.error('Error al guardar:', err);
                this.showMessage(err?.message || 'Error al guardar la empresa', 'error');
            }
        });
    }

    /**
     * Cierra el diálogo sin guardar
     */
    close(): void {
        this.dialogRef.close(false);
    }

    /**
     * Muestra mensaje en snackbar
     */
    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: type === 'error' ? 5000 : 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`],
        });
    }
}
