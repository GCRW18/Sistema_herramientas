import { Component, OnInit, inject, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

export interface FormUsuarioData {
    usuario?: any;
    mode?: 'create' | 'edit';
    rolesList?: any[];
}

@Component({
    selector: 'app-form-usuario',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './form-usuario.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        /* Clases de utilidad para inputs Neo-Brutalistas */
        .neo-input {
            width: 100%;
            height: 48px;
            padding: 0 16px;
            background-color: #f9fafb;
            border: 3px solid #000;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            color: #1f2937;
            transition: all 0.2s;
        }

        .neo-input:focus {
            outline: none;
            box-shadow: 4px 4px 0px 0px #2563EB; /* Blue shadow */
            transform: translateY(-2px);
            border-color: #000;
        }

        /* Dark mode overrides for inputs */
        :host-context(.dark) .neo-input {
            background-color: #334155;
            color: white;
            border-color: #94a3b8;
        }

        :host-context(.dark) .neo-input:focus {
            border-color: #60a5fa;
            box-shadow: 4px 4px 0px 0px #60a5fa;
        }

        /* Labels */
        .field-label {
            display: block;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 6px;
            margin-left: 4px;
        }

        :host-context(.dark) .field-label {
            color: #cbd5e1;
        }

        /* Estilos específicos para mat-select dentro del diseño neo */
        :host ::ng-deep .neo-select .mat-mdc-text-field-wrapper {
            background-color: transparent !important;
            padding: 0 !important;
        }

        :host ::ng-deep .neo-select .mat-mdc-form-field-flex {
            background-color: #f9fafb;
            border: 3px solid #000;
            border-radius: 12px;
            height: 48px;
            align-items: center;
            padding: 0 12px;
            transition: all 0.2s;
        }

        :host ::ng-deep .neo-select .mat-mdc-form-field-flex:hover {
            background-color: #f3f4f6;
        }

        :host-context(.dark) ::ng-deep .neo-select .mat-mdc-form-field-flex {
            background-color: #334155;
            border-color: #94a3b8;
        }

        :host ::ng-deep .neo-select.mat-focused .mat-mdc-form-field-flex {
            box-shadow: 4px 4px 0px 0px #2563EB;
            transform: translateY(-2px);
        }

        /* Ocultar underline default de material */
        :host ::ng-deep .mat-mdc-line-ripple { display: none; }
        :host ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    `]
})
export class FormUsuarioComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<FormUsuarioComponent>, { optional: true });
    usuarioForm!: FormGroup;
    isEditMode = false;
    hidePassword = true;
    hideConfirmPassword = true;

    rolesList: { id: number; nombre: string }[] = [];

    constructor(
        private fb: FormBuilder,
        private router: Router,
        @Optional() @Inject(MAT_DIALOG_DATA) public data: FormUsuarioData
    ) {}

    ngOnInit(): void {
        // Cargar roles desde data (vienen del backend via RoleService)
        if (this.data?.rolesList?.length) {
            this.rolesList = this.data.rolesList.map((r: any) => ({
                id: r.id_role,
                nombre: r.name
            }));
        }
        this.initForm();
        if (this.data?.usuario && this.data?.mode === 'edit') {
            this.isEditMode = true;
            this.loadUsuarioData(this.data.usuario);
        }
    }

    private initForm(): void {
        this.usuarioForm = this.fb.group({
            username: ['', [Validators.required, Validators.minLength(4)]],
            nombres: ['', Validators.required],
            apellidos: ['', Validators.required],
            ci: ['', Validators.required],
            telefono: [''],
            email: ['', [Validators.required, Validators.email]],
            password: ['', this.isEditMode ? [] : [Validators.required, Validators.minLength(6)]],
            confirm_password: ['', this.isEditMode ? [] : [Validators.required]],
            role_id: ['', Validators.required],
            active: [true]
        }, { validators: this.passwordMatchValidator });
    }

    // Validador personalizado para contraseñas
    private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
        const password = control.get('password')?.value;
        const confirm = control.get('confirm_password')?.value;

        // Si estamos editando y ambos están vacíos, es válido (no se cambia pass)
        // Pero si uno tiene valor, el otro también debe tenerlo y coincidir
        if (!password && !confirm) return null;

        return password === confirm ? null : { mismatch: true };
    }

    private loadUsuarioData(usuario: any): void {
        this.usuarioForm.patchValue({
            username: usuario.username,
            nombres: usuario.nombres,
            apellidos: usuario.apellidos,
            ci: usuario.ci,
            telefono: usuario.telefono,
            email: usuario.email,
            role_id: usuario.role_id,
            active: usuario.active !== undefined ? usuario.active : true
            // Password se deja vacío intencionalmente
        });

        // Actualizar validadores para modo edición (password opcional)
        this.usuarioForm.get('password')?.removeValidators(Validators.required);
        this.usuarioForm.get('confirm_password')?.removeValidators(Validators.required);
        this.usuarioForm.get('password')?.updateValueAndValidity();
        this.usuarioForm.get('confirm_password')?.updateValueAndValidity();
    }

    onSubmit(): void {
        if (this.usuarioForm.valid) {
            // Eliminar confirm_password del objeto final antes de enviar
            const { confirm_password, ...formData } = this.usuarioForm.value;
            this.closeOrNavigate(formData);
        } else {
            this.usuarioForm.markAllAsTouched();
        }
    }

    onCancel(): void {
        this.closeOrNavigate();
    }

    private closeOrNavigate(result?: any): void {
        if (this.dialogRef) {
            this.dialogRef.close(result);
        } else {
            this.router.navigate(['/administration/usuarios']);
        }
    }
}
