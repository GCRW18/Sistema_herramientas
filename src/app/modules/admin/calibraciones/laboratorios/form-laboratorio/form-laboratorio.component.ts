import { Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
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
        DragDropModule,
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
        this.calibrationService.saveLaboratory(this.buildPayload()).pipe(
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
     * Arma el payload que se manda al backend. Los campos vacíos viajan como '' (el SQL
     * los interpreta como NULL) y los numéricos sin valor se omiten para no romper el cast.
     */
    private buildPayload(): any {
        const l = this.laboratory;
        const s = (v: any) => (v ?? '').toString().trim();

        const payload: any = {
            code:                 s(l.code),
            name:                 s(l.name),
            tipo_servicio:        l.tipo_servicio ?? '',
            rut_nit:              s(l.rut_nit),
            address:              s(l.address),
            city:                 s(l.city),
            country:              s(l.country),
            contact_person:       s(l.contact_person),
            phone:                s(l.phone),
            email:                s(l.email),
            website:              s(l.website),
            is_certified:         !!l.is_certified,
            certification_number: l.is_certified ? s(l.certification_number) : '',
            certification_types:  l.is_certified ? s(l.certification_types) : '',
            active:               !!l.active,
            observaciones:        s(l.observaciones),
        };

        if (l.id_laboratory != null) payload.id_laboratory = l.id_laboratory;

        const rating = this.clampNumber(l.rating, 0, 5);
        if (rating !== null) payload.rating = rating;

        const dias = this.clampNumber(l.average_delivery_days, 1, 3650);
        if (dias !== null) payload.average_delivery_days = dias;

        return payload;
    }

    private clampNumber(value: any, min: number, max: number): number | null {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        if (isNaN(n)) return null;
        return Math.min(max, Math.max(min, n));
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
