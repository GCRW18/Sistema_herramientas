import { Component, Inject, Optional, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';
import { GestionUbicacionesService } from '../../inventory/gestion-ubicaciones/gestion-ubicaciones.service';

export interface FormAeronaveData {
    aeronave?: any;
    mode?: 'create' | 'edit';
}

const TIPOS_AERONAVE = [
    { value: 'passenger', label: 'Pasajeros' },
    { value: 'cargo',     label: 'Carga' },
    { value: 'mixed',     label: 'Mixto' },
];

const ESTADOS_AERONAVE = [
    { value: 'active',         label: 'Activa' },
    { value: 'maintenance',    label: 'En Mantenimiento' },
    { value: 'grounded',       label: 'En Tierra' },
    { value: 'decommissioned', label: 'Fuera de Servicio' },
];

/**
 * Alta/edición de una aeronave (he.taircraft) — catálogo que alimenta el campo
 * "Aeronave" de Préstamo Técnico (FleetService.getAircraft()).
 */
@Component({
    selector: 'app-form-aeronave-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatDialogModule],
    templateUrl: './form-aeronave-dialog.component.html',
    styles: [`
        .neo-input, .neo-select {
            width: 100%; height: 38px; padding: 0 10px;
            background-color: #f9fafb; border: 2px solid #000;
            border-radius: 8px; font-weight: 800; font-size: 12px;
            color: #1f2937; transition: all 0.15s;
        }
        .neo-select { cursor: pointer; appearance: none; }
        textarea.neo-input { height: auto; padding: 8px 10px; min-height: 64px; }
        .neo-input::placeholder { font-weight: 600; color: #9ca3af; }
        .neo-input:focus, .neo-select:focus { outline: none; box-shadow: 3px 3px 0px 0px #000; transform: translateY(-1px); }
        :host-context(.dark) .neo-input, :host-context(.dark) .neo-select { background-color: #1e293b; color: white; border-color: #475569; }
        .field-label { display: block; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #6b7280; margin-bottom: 3px; margin-left: 2px; letter-spacing: 0.04em; }
        :host-context(.dark) .field-label { color: #94a3b8; }
    `]
})
export class FormAeronaveDialogComponent implements OnInit {
    dialogRef = inject(MatDialogRef<FormAeronaveDialogComponent>, { optional: true });
    private fb = inject(FormBuilder);
    private ubicacionesSvc = inject(GestionUbicacionesService);

    form!: FormGroup;
    isEdit = false;
    tipos = TIPOS_AERONAVE;
    estados = ESTADOS_AERONAVE;

    /** Mismo catálogo de Bases Aeronáuticas (param.tlugar) que usa Almacenes y Ubicaciones. */
    bases: { id_lugar: number; codigo: string; nombre: string }[] = [];
    loadingBases = false;

    constructor(@Optional() @Inject(MAT_DIALOG_DATA) public data: FormAeronaveData) {}

    ngOnInit(): void {
        this.form = this.fb.group({
            registration:  ['', [Validators.required, Validators.maxLength(20)]],
            manufacturer:  ['', Validators.required],
            model:         ['', Validators.required],
            serial_number: [''],
            type:          ['passenger'],
            status:        ['active'],
            base_location: [''],
            fleet_name:    [''],
            notes:         [''],
        });
        this._cargarBases();
        if (this.data?.aeronave && this.data?.mode === 'edit') {
            this.isEdit = true;
            this.form.patchValue(this.data.aeronave);
            this.form.get('registration')?.disable();
        }
    }

    private _cargarBases(): void {
        this.loadingBases = true;
        this.ubicacionesSvc.getBasesAeronauticas().pipe(
            catchError(() => of({ datos: [] }))
        ).subscribe((resp: any) => {
            const rows = resp?.datos || resp?.data || [];
            this.bases = rows.map((b: any) => ({
                id_lugar: b.id_lugar ?? b.id,
                codigo:   b.codigo ?? b.code ?? '',
                nombre:   b.nombre ?? b.name ?? ''
            }));
            this.loadingBases = false;
        });
    }

    hasError(field: string, error: string): boolean {
        const c = this.form.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    guardar(): void {
        if (this.form.invalid) { this.form.markAllAsTouched(); return; }
        this.dialogRef?.close(this.form.getRawValue());
    }

    cancelar(): void { this.dialogRef?.close(null); }
}
