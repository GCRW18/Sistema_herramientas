import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { Rack, Level } from '../interfaces';

type Mode = 'new' | 'edit';

@Component({
    selector: 'app-form-nivel',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule, MatSnackBarModule, DragDropModule],
    templateUrl: './form-nivel.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
    `]
})
export class FormNivelComponent {
    dialogRef = inject(MatDialogRef<FormNivelComponent>);
    private fb       = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private data     = inject<{ mode: Mode; rack: Rack; level?: Level; suggestedNumero?: number }>(MAT_DIALOG_DATA);

    mode: Mode = this.data.mode;
    rack       = this.data.rack;

    /** true cuando el estante ya tiene un nivel suelo registrado */
    get yaExisteSuelo(): boolean {
        return this.rack.niveles.some(n => n.isFloor);
    }

    form: FormGroup = this.fb.group({
        isFloor:     [false],
        numero:      [0, [Validators.required, Validators.min(0)]],
        codigo:      ['', [Validators.required, Validators.maxLength(40)]],
        nombre:      ['', [Validators.required, Validators.maxLength(120)]],
        descripcion: [''],
        activo:      [true],
    });

    constructor() {
        if (this.mode === 'new') {
            const regularLevels = this.rack.niveles.filter(n => !n.isFloor);
            const num = this.data.suggestedNumero ?? regularLevels.length;
            this.form.patchValue({
                numero: num,
                codigo: `${this.rack.codigo}-N${num}`,
                nombre: `Nivel ${num}`,
            });
        } else if (this.data.level) {
            const l = this.data.level;
            this.form.patchValue({
                isFloor:     l.isFloor,
                numero:      l.isFloor ? null : l.numero,
                codigo:      l.codigo,
                nombre:      l.nombre,
                descripcion: l.descripcion ?? '',
                activo:      l.activo,
            });
            if (l.isFloor) this._bloquearCamposNivel();
        }

        // Cuando se activa isFloor: fijar valores y deshabilitar campos numéricos
        this.form.get('isFloor')?.valueChanges.subscribe((esSuelo: boolean) => {
            if (esSuelo) {
                this.form.patchValue({ numero: null, codigo: 'SUELO', nombre: 'Nivel Suelo' });
                this._bloquearCamposNivel();
            } else {
                this._desbloquearCamposNivel();
                const regularLevels = this.rack.niveles.filter(n => !n.isFloor);
                const num = regularLevels.length;
                this.form.patchValue({
                    numero: num,
                    codigo: `${this.rack.codigo}-N${num}`,
                    nombre: `Nivel ${num}`,
                });
            }
        });

        // Re-sugerir código cuando cambia el número (solo en new y no suelo)
        if (this.mode === 'new') {
            this.form.get('numero')?.valueChanges.subscribe(n => {
                if (n !== null && n !== undefined && !this.form.value.isFloor) {
                    this.form.patchValue({
                        codigo: `${this.rack.codigo}-N${n}`,
                        nombre: this.form.value.nombre?.startsWith('Nivel ') ? `Nivel ${n}` : this.form.value.nombre,
                    }, { emitEvent: false });
                }
            });
        }
    }

    private _bloquearCamposNivel(): void {
        this.form.get('numero')?.clearValidators();
        this.form.get('numero')?.disable();
        this.form.get('codigo')?.disable();
        this.form.get('nombre')?.disable();
        this.form.get('numero')?.updateValueAndValidity();
    }

    private _desbloquearCamposNivel(): void {
        this.form.get('numero')?.setValidators([Validators.required, Validators.min(1)]);
        this.form.get('numero')?.enable();
        this.form.get('codigo')?.enable();
        this.form.get('nombre')?.enable();
        this.form.get('numero')?.updateValueAndValidity();
    }

    get titulo(): string    { return this.mode === 'new' ? 'Nuevo Nivel' : 'Editar Nivel'; }
    get subtitulo(): string { return this.mode === 'new' ? 'Registro en el estante' : 'Modificación de datos'; }

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
        const v = this.form.getRawValue();
        const esSuelo = !!v.isFloor;
        const out: Level = {
            id:          this.data.level?.id ?? 0,
            rackId:      this.rack.id,
            numero:      esSuelo ? null : Number(v.numero),
            codigo:      esSuelo ? 'SUELO' : v.codigo.trim(),
            nombre:      esSuelo ? 'Nivel Suelo' : v.nombre.trim(),
            descripcion: v.descripcion?.trim() || undefined,
            activo:      !!v.activo,
            isFloor:     esSuelo,
        };
        this.dialogRef.close(out);
    }
}
