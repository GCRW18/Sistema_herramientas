import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { Entrada, DialogMode } from '../interfaces';

@Component({
    selector: 'app-form-entrada',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatIconModule,
        MatSnackBarModule,
        MatTooltipModule,
        DragDropModule,
    ],
    templateUrl: './form-entrada.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #16a34a; border-radius: 3px; }
    `]
})
export class FormEntradaComponent implements OnInit {
    dialogRef = inject(MatDialogRef<FormEntradaComponent>);
    private fb       = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private data     = inject<{ mode: DialogMode; entrada?: Entrada }>(MAT_DIALOG_DATA);

    mode: DialogMode = this.data?.mode ?? 'new';

    unidades = ['UND', 'LT', 'KG', 'MTS', 'GAL', 'CAJA', 'ROLLO', 'JUEGO'];

    form: FormGroup = this.fb.group({
        nroNota:     ['', Validators.required],
        fecha:       [new Date().toISOString().split('T')[0], Validators.required],
        hora:        [new Date().toTimeString().slice(0, 5)],
        recibidoPor: ['', Validators.required],
        codigoNombre:['', Validators.required],
        producto:    ['', Validators.required],
        cantidad:    [1,  [Validators.required, Validators.min(1)]],
        unidad:      ['UND', Validators.required],
        pn:          [''],
        stock:       [''],
        marca:       [''],
        factura:     [''],
        observacion: [''],
    });

    ngOnInit(): void {
        if (this.data?.entrada) {
            this.form.patchValue(this.data.entrada);
        }
        if (this.readOnly) {
            this.form.disable();
        }
    }

    get titulo(): string {
        return this.mode === 'new' ? 'Nueva Entrada de Material' : 'Detalle de Entrada';
    }

    get subtitulo(): string {
        return this.mode === 'new' ? 'Registro de ingreso al almacén' : 'Información de solo lectura';
    }

    get readOnly(): boolean { return this.mode === 'view'; }

    hasError(field: string, error: string): boolean {
        const c = this.form.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    save(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.snackBar.open('Complete los campos requeridos', 'Cerrar', { duration: 2500 });
            return;
        }
        const v = this.form.getRawValue();
        const out: Partial<Entrada> = {
            ...(this.data.entrada ?? {}),
            nroNota:     v.nroNota.trim(),
            fecha:       v.fecha,
            hora:        v.hora,
            recibidoPor: v.recibidoPor.trim(),
            codigoNombre:v.codigoNombre.trim(),
            producto:    v.producto.trim(),
            cantidad:    Number(v.cantidad),
            unidad:      v.unidad,
            pn:          v.pn?.trim()      || undefined,
            stock:       v.stock?.trim()   || undefined,
            marca:       v.marca?.trim()   || undefined,
            factura:     v.factura?.trim() || undefined,
            observacion: v.observacion?.trim() || undefined,
        };
        this.dialogRef.close(out);
    }
}
