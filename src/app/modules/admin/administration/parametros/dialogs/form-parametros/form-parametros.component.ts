import { Component, OnInit, inject, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ParametrosConfig } from '../../../../../../core/services/parametros.service';

export type ParamSection = 'calibracion' | 'prestamos' | 'inventario';

export interface FormParametrosData {
    section: ParamSection;
    values: ParametrosConfig;
}

const SECTION_META: Record<ParamSection, { label: string; icon: string; color: string; textColor: string }> = {
    calibracion: { label: 'Calibración',  icon: 'build_circle', color: '#F59E0B', textColor: '#000' },
    prestamos:   { label: 'Préstamos',    icon: 'swap_horiz',   color: '#1A3EDC', textColor: '#fff' },
    inventario:  { label: 'Inventario',   icon: 'inventory_2',  color: '#16A34A', textColor: '#fff' },
};

@Component({
    selector: 'app-form-parametros',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        DragDropModule,
    ],
    templateUrl: './form-parametros.component.html',
    styles: [`:host { display: flex; flex-direction: column; }`]
})
export class FormParametrosComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<FormParametrosComponent>, { optional: true });
    private fb = inject(FormBuilder);

    form!: FormGroup;
    meta = SECTION_META.calibracion;

    constructor(@Optional() @Inject(MAT_DIALOG_DATA) public data: FormParametrosData) {}

    ngOnInit(): void {
        this.meta = SECTION_META[this.data.section];
        const v = this.data.values;

        if (this.data.section === 'calibracion') {
            this.form = this.fb.group({
                dias_alerta_calibracion:      [v.dias_alerta_calibracion,      [Validators.required, Validators.min(1)]],
                intervalo_calibracion_defecto: [v.intervalo_calibracion_defecto, [Validators.required, Validators.min(1)]],
            });
        } else if (this.data.section === 'prestamos') {
            this.form = this.fb.group({
                dias_max_prestamo:           [v.dias_max_prestamo,           [Validators.required, Validators.min(1)]],
                dias_alerta_vencimiento:     [v.dias_alerta_vencimiento,     [Validators.required, Validators.min(1)]],
                requiere_aprobacion_externo: [v.requiere_aprobacion_externo],
            });
        } else {
            this.form = this.fb.group({
                stock_minimo_defecto:         [v.stock_minimo_defecto,         [Validators.required, Validators.min(0)]],
                permitir_stock_negativo:      [v.permitir_stock_negativo],
                validar_calibracion_prestamo: [v.validar_calibracion_prestamo],
            });
        }
    }

    onSubmit(): void {
        if (this.form.valid) {
            this.dialogRef?.close(this.form.value);
        } else {
            this.form.markAllAsTouched();
        }
    }

    onCancel(): void { this.dialogRef?.close(); }
}
