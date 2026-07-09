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
    `]
})
export class FormEstanteComponent {
    dialogRef = inject(MatDialogRef<FormEstanteComponent>);
    private fb       = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private data     = inject<{ mode: Mode; warehouse: Warehouse; rack?: Rack; racksExistentes?: Rack[] }>(MAT_DIALOG_DATA);

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
            // Siguiente número libre a partir de los códigos existentes (no del conteo:
            // el catálogo migrado tiene numeración física con huecos, ej. CBB llega a
            // EST-39 con 34 estantes — count+1 sugeriría EST-35, que ya existe).
            const usados = (this.data.racksExistentes ?? [])
                .map(r => { const m = /(\d+)\s*$/.exec(r.codigo ?? ''); return m ? parseInt(m[1], 10) : 0; });
            const next = Math.max(this.warehouse?.estantesCount ?? 0, 0, ...usados) + 1;
            const pad  = String(next).padStart(2, '0');
            const codigoSugerido = `${this.warehouse.codigo}-EST-${pad}`.slice(0, 40);
            this.form.patchValue({
                codigo: codigoSugerido,
                nombre: `Estante ${pad}`,
            });
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
