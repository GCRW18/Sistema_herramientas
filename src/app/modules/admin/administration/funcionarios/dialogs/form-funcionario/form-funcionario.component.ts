import { Component, OnInit, inject, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DragDropModule } from '@angular/cdk/drag-drop';

export interface FormFuncionarioData {
    empleado?: any;
    mode?: 'create' | 'edit';
}

@Component({
    selector: 'app-form-funcionario',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatDialogModule,
        MatSlideToggleModule,
        DragDropModule
    ],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] font-sans overflow-hidden relative"
         cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragBoundary=".cdk-overlay-container">

        <!-- Header -->
        <div class="flex items-center justify-between p-5 bg-[#111A43] border-b-[3px] border-black flex-shrink-0 cursor-move" cdkDragHandle>
            <div class="flex items-center gap-3">
                <mat-icon class="text-white !text-2xl">badge</mat-icon>
                <h2 class="text-xl font-black text-white uppercase tracking-tight">
                    {{ isEditMode ? 'Editar Funcionario' : 'Nuevo Funcionario' }}
                </h2>
            </div>
            <button (click)="onCancel()" class="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors" (mousedown)="$event.stopPropagation()">
                <mat-icon class="text-white">close</mat-icon>
            </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-5">
            <form [formGroup]="form" class="space-y-4">

                <!-- Fila 1: Licencia + Sello -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="field-label">Nro. Licencia *</label>
                        <input formControlName="license_number" type="text" class="neo-input" placeholder="LIC-0001">
                        <p *ngIf="form.get('license_number')?.invalid && form.get('license_number')?.touched" class="text-red-600 text-xs mt-1 font-bold">Requerido</p>
                    </div>
                    <div>
                        <label class="field-label">Nro. Sello</label>
                        <input formControlName="seal_number" type="text" class="neo-input" placeholder="SELLO-0001">
                    </div>
                </div>

                <!-- Fila 2: Nombres -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label class="field-label">Nombres *</label>
                        <input formControlName="first_name" type="text" class="neo-input" placeholder="Juan">
                        <p *ngIf="form.get('first_name')?.invalid && form.get('first_name')?.touched" class="text-red-600 text-xs mt-1 font-bold">Requerido</p>
                    </div>
                    <div>
                        <label class="field-label">Ap. Paterno *</label>
                        <input formControlName="paternal_last_name" type="text" class="neo-input" placeholder="Pérez">
                        <p *ngIf="form.get('paternal_last_name')?.invalid && form.get('paternal_last_name')?.touched" class="text-red-600 text-xs mt-1 font-bold">Requerido</p>
                    </div>
                    <div>
                        <label class="field-label">Ap. Materno</label>
                        <input formControlName="maternal_last_name" type="text" class="neo-input" placeholder="López">
                    </div>
                </div>

                <!-- Fila 3: CI + Cargo -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="field-label">CI (Cédula)</label>
                        <input formControlName="ci" type="text" class="neo-input" placeholder="12345678">
                    </div>
                    <div>
                        <label class="field-label">Cargo</label>
                        <input formControlName="cargo" type="text" class="neo-input" placeholder="Técnico MM I">
                    </div>
                </div>

                <!-- Fila 4: Tipo + Área + Base -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label class="field-label">Tipo *</label>
                        <select formControlName="employee_type" class="neo-input">
                            <option value="">Seleccionar...</option>
                            <option *ngFor="let t of tipos" [value]="t">{{ t }}</option>
                        </select>
                        <p *ngIf="form.get('employee_type')?.invalid && form.get('employee_type')?.touched" class="text-red-600 text-xs mt-1 font-bold">Requerido</p>
                    </div>
                    <div>
                        <label class="field-label">Área *</label>
                        <select formControlName="area" class="neo-input">
                            <option value="">Seleccionar...</option>
                            <option *ngFor="let a of areas" [value]="a">{{ a }}</option>
                        </select>
                        <p *ngIf="form.get('area')?.invalid && form.get('area')?.touched" class="text-red-600 text-xs mt-1 font-bold">Requerido</p>
                    </div>
                    <div>
                        <label class="field-label">Base *</label>
                        <select formControlName="id_base" class="neo-input">
                            <option value="">Seleccionar...</option>
                            <option *ngFor="let b of bases" [value]="b.value">{{ b.label }}</option>
                        </select>
                        <p *ngIf="form.get('id_base')?.invalid && form.get('id_base')?.touched" class="text-red-600 text-xs mt-1 font-bold">Requerido</p>
                    </div>
                </div>

                <!-- Fila 5: Email + Teléfono -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="field-label">Email</label>
                        <input formControlName="email" type="email" class="neo-input" placeholder="juan@boa.bo">
                    </div>
                    <div>
                        <label class="field-label">Teléfono</label>
                        <input formControlName="phone" type="text" class="neo-input" placeholder="70000000">
                    </div>
                </div>

                <!-- Estado -->
                <div class="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border-2 border-black rounded-xl">
                    <mat-slide-toggle formControlName="active" color="primary"></mat-slide-toggle>
                    <div>
                        <p class="font-black text-sm uppercase text-black dark:text-white">Estado Activo</p>
                        <p class="text-xs text-gray-500">El funcionario podrá ser asignado en movimientos</p>
                    </div>
                </div>

            </form>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 p-5 border-t-[3px] border-black bg-gray-50 dark:bg-slate-900 flex-shrink-0">
            <button (click)="onCancel()"
                    class="h-12 px-6 bg-white dark:bg-slate-700 text-black dark:text-white font-black border-[3px] border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_#000] transition-all uppercase">
                Cancelar
            </button>
            <button (click)="onSubmit()"
                    class="h-12 px-8 bg-[#111A43] hover:bg-[#1a2660] text-white font-black border-[3px] border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_#000] transition-all uppercase flex items-center gap-2">
                <mat-icon>{{ isEditMode ? 'save' : 'person_add' }}</mat-icon>
                {{ isEditMode ? 'Guardar Cambios' : 'Registrar' }}
            </button>
        </div>
    </div>
    `,
    styles: [`
        :host { display: block; height: 100%; }
        .neo-input {
            width: 100%; height: 48px; padding: 0 16px;
            background-color: #f9fafb; border: 3px solid #000;
            border-radius: 12px; font-weight: 700; font-size: 14px;
            color: #1f2937; transition: all 0.2s; appearance: auto;
        }
        .neo-input:focus { outline: none; box-shadow: 4px 4px 0px 0px #3B82F6; transform: translateY(-2px); }
        :host-context(.dark) .neo-input { background-color: #334155; color: white; border-color: #94a3b8; }
        .field-label { display: block; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; margin-left: 4px; }
        :host-context(.dark) .field-label { color: #cbd5e1; }
    `]
})
export class FormFuncionarioComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<FormFuncionarioComponent>, { optional: true });
    private fb = inject(FormBuilder);

    form!: FormGroup;
    isEditMode = false;

    tipos = ['Tecnico MM I', 'Tecnico MM II', 'Inspector', 'Supervisor', 'Jefe de Linea', 'Jefe de Mantenimiento'];
    areas = ['LINEA', 'MANTENIMIENTO', 'CENTRO CONTROL', 'AVIONICOS', 'ESTRUCTURAS', 'MOTORES'];
    bases = [
        { value: 'TJA', label: 'TJA - Tarija' },
        { value: 'SRZ', label: 'SRZ - Santa Cruz' },
        { value: 'CBB', label: 'CBB - Cochabamba' },
        { value: 'LPB', label: 'LPB - La Paz' },
        { value: 'SCL', label: 'SCL - Sucre' }
    ];

    constructor(@Optional() @Inject(MAT_DIALOG_DATA) public data: FormFuncionarioData) {}

    ngOnInit(): void {
        this.form = this.fb.group({
            license_number:     ['', Validators.required],
            seal_number:        [''],
            first_name:         ['', Validators.required],
            paternal_last_name: ['', Validators.required],
            maternal_last_name: [''],
            ci:                 [''],
            cargo:              [''],
            employee_type:      ['', Validators.required],
            area:               ['', Validators.required],
            id_base:            ['', Validators.required],
            email:              ['', Validators.email],
            phone:              [''],
            active:             [true]
        });

        if (this.data?.empleado && this.data?.mode === 'edit') {
            this.isEditMode = true;
            this.form.patchValue(this.data.empleado);
        }
    }

    onSubmit(): void {
        if (this.form.valid) {
            const val = this.form.value;
            val.full_name = `${val.first_name} ${val.paternal_last_name} ${val.maternal_last_name || ''}`.trim();
            this.dialogRef?.close(val);
        } else {
            this.form.markAllAsTouched();
        }
    }

    onCancel(): void {
        this.dialogRef?.close();
    }
}
