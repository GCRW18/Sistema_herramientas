import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { Salida, DialogMode } from '../interfaces';

@Component({
    selector: 'app-form-salida',
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
    templateUrl: './form-salida.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ea580c; border-radius: 3px; }
    `]
})
export class FormSalidaComponent implements OnInit {
    dialogRef = inject(MatDialogRef<FormSalidaComponent>);
    private fb       = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private data     = inject<{ mode: DialogMode; salida?: Salida }>(MAT_DIALOG_DATA);

    mode: DialogMode = this.data?.mode ?? 'new';

    unidades = ['UND', 'LT', 'KG', 'MTS', 'GAL', 'CAJA', 'ROLLO', 'JUEGO'];

    form: FormGroup = this.fb.group({
        nroNota:          ['', Validators.required],
        fecha:            [new Date().toISOString().split('T')[0], Validators.required],
        hora:             [new Date().toTimeString().slice(0, 5)],
        // Solicitante
        nroLicencia:      [''],
        nro:              [''],
        apellidoPaterno:  ['', Validators.required],
        apellidoMaterno:  [''],
        nombre:           ['', Validators.required],
        area:             ['', Validators.required],
        despachadoPor:    ['', Validators.required],
        // Material
        codigoNombre:     ['', Validators.required],
        producto:         ['', Validators.required],
        unidad:           ['UND', Validators.required],
        cantidad:         [1,  [Validators.required, Validators.min(1)]],
        stock:            [''],
        ordenTrabajo:     [''],
        buscadorAeronave: [''],
        buscadorAutorizado:[''],
        observaciones:    [''],
    });

    ngOnInit(): void {
        if (this.data?.salida) {
            this.form.patchValue(this.data.salida);
        }
        if (this.readOnly) {
            this.form.disable();
        }
    }

    get titulo(): string {
        return this.mode === 'new' ? 'Nueva Salida de Material' : 'Detalle de Salida';
    }

    get subtitulo(): string {
        return this.mode === 'new' ? 'Registro de despacho del almacén' : 'Información de solo lectura';
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
        const out: Partial<Salida> = {
            ...(this.data.salida ?? {}),
            nroNota:           v.nroNota.trim(),
            fecha:             v.fecha,
            hora:              v.hora,
            nroLicencia:       v.nroLicencia?.trim()       || '',
            nro:               v.nro?.trim()               || '',
            apellidoPaterno:   v.apellidoPaterno.trim(),
            apellidoMaterno:   v.apellidoMaterno?.trim()   || '',
            nombre:            v.nombre.trim(),
            area:              v.area.trim(),
            despachadoPor:     v.despachadoPor.trim(),
            codigoNombre:      v.codigoNombre.trim(),
            producto:          v.producto.trim(),
            unidad:            v.unidad,
            cantidad:          Number(v.cantidad),
            stock:             v.stock?.trim()             || undefined,
            ordenTrabajo:      v.ordenTrabajo?.trim()      || undefined,
            buscadorAeronave:  v.buscadorAeronave?.trim()  || undefined,
            buscadorAutorizado:v.buscadorAutorizado?.trim()|| undefined,
            observaciones:     v.observaciones?.trim()     || undefined,
        };
        this.dialogRef.close(out);
    }
}
