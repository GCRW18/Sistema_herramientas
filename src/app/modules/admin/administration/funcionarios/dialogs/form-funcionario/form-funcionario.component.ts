import { Component, OnInit, inject, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { EmployeeService } from '../../../../../../core/services/employee.service';

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
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './form-funcionario.component.html',
    styles: [`:host { display: flex; flex-direction: column; }`]
})
export class FormFuncionarioComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<FormFuncionarioComponent>, { optional: true });
    private fb = inject(FormBuilder);
    private empService = inject(EmployeeService);

    form!: FormGroup;
    isEditMode = false;
    basesLoading = false;

    tipos = ['Tecnico MM I', 'Tecnico MM II', 'Inspector', 'Supervisor', 'Jefe de Linea', 'Jefe de Mantenimiento', 'Almacenero'];
    areas = ['LINEA', 'MANTENIMIENTO', 'CENTRO CONTROL', 'AVIONICOS', 'ESTRUCTURAS', 'MOTORES', 'ALMACEN'];
    bases: { value: number; label: string }[] = [];

    constructor(@Optional() @Inject(MAT_DIALOG_DATA) public data: FormFuncionarioData) {}

    ngOnInit(): void {
        this.form = this.fb.group({
            id_usuario:         [null],
            license_number:     ['', Validators.required],
            seal_number:        [''],
            first_name:         [''],
            paternal_last_name: [''],
            maternal_last_name: [''],
            full_name:          [''],
            ci:                 [''],
            cargo:              [''],
            employee_type:      ['', Validators.required],
            area:               ['', Validators.required],
            id_base:            [null, Validators.required],
            email:              ['', Validators.email],
            phone:              [''],
            active:             [true]
        });

        this.loadBases();

        if (this.data?.empleado) {
            const emp = this.data.empleado;
            this.isEditMode = this.data.mode === 'edit';
            this.form.patchValue({
                id_usuario:         emp.id_usuario         ?? null,
                license_number:     emp.license_number     || '',
                seal_number:        emp.seal_number        || '',
                first_name:         emp.first_name         || emp.nombre || '',
                paternal_last_name: emp.paternal_last_name || emp.apellido_paterno || '',
                maternal_last_name: emp.maternal_last_name || emp.apellido_materno || '',
                full_name:          emp.full_name          || '',
                ci:                 emp.ci                 || '',
                cargo:              emp.cargo              || '',
                employee_type:      emp.employee_type      || '',
                area:               emp.area               || '',
                id_base:            emp.id_base            ?? null,
                email:              emp.email              || '',
                phone:              emp.phone              || '',
                active:             emp.active !== false
            });
        }
    }

    private loadBases(): void {
        this.basesLoading = true;
        this.empService.getBases().subscribe({
            next: (data) => {
                this.bases = data.map(b => ({
                    value: b.id_base,
                    label: `${b.code} - ${b.name}`
                }));
                this.basesLoading = false;
            },
            error: () => { this.basesLoading = false; }
        });
    }

    onSubmit(): void {
        if (this.form.valid) {
            const val = this.form.value;
            if (!val.full_name) {
                val.full_name = `${val.first_name} ${val.paternal_last_name} ${val.maternal_last_name || ''}`.trim();
            }
            this.dialogRef?.close(val);
        } else {
            this.form.markAllAsTouched();
        }
    }

    onCancel(): void {
        this.dialogRef?.close();
    }
}
