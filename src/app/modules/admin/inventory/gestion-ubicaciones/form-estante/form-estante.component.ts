import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { Warehouse, Rack } from '../interfaces';

type Mode = 'new' | 'edit';

@Component({
    selector: 'app-form-estante',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule, MatSnackBarModule, DragDropModule],
    templateUrl: './form-estante.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
    `]
})
export class FormEstanteComponent {
    dialogRef = inject(MatDialogRef<FormEstanteComponent>);
    private fb       = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private data     = inject<{ mode: Mode; warehouse: Warehouse; rack?: Rack }>(MAT_DIALOG_DATA);

    mode: Mode = this.data.mode;
    warehouse  = this.data.warehouse;

    form: FormGroup = this.fb.group({
        codigo:      ['', [Validators.required, Validators.maxLength(40)]],
        nombre:      ['', [Validators.required, Validators.maxLength(120)]],
        descripcion: [''],
        activo:      [true],
    });

    constructor() {
        if (this.mode === 'new') {
            const next = (this.warehouse?.estantesCount ?? 0) + 1;
            const codigoSugerido = `${this.warehouse.codigo}-EST-${String(next).padStart(2, '0')}`;
            this.form.patchValue({ codigo: codigoSugerido });
        } else if (this.data.rack) {
            this.form.patchValue(this.data.rack);
        }
    }

    get titulo(): string    { return this.mode === 'new' ? 'Nuevo Estante' : 'Editar Estante'; }
    get subtitulo(): string { return this.mode === 'new' ? 'Registro en el almacén' : 'Modificación de datos'; }

    hasError(field: string, error: string): boolean {
        const c = this.form.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    save() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.snackBar.open('Complete los campos requeridos', 'Cerrar', { duration: 2500 });
            return;
        }
        const v = this.form.value;
        const out: Rack = {
            id:          this.data.rack?.id ?? 0,
            warehouseId: this.warehouse.id,
            codigo:      v.codigo.trim(),
            nombre:      v.nombre.trim(),
            descripcion: v.descripcion?.trim() || undefined,
            activo:      !!v.activo,
            niveles:     this.data.rack?.niveles ?? [],
        };
        this.dialogRef.close(out);
    }
}
