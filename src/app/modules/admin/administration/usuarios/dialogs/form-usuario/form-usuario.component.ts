import { Component, OnInit, inject, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { RoleService } from '../../../../../../core/services/role.service';

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
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        MatSnackBarModule,
        DragDropModule
    ],
    templateUrl: './form-usuario.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .neo-input {
            width: 100%; height: 40px; padding: 0 12px;
            background-color: #f9fafb; border: 2px solid #000;
            border-radius: 8px; font-weight: 900; font-size: 12px;
            color: #1f2937; transition: all 0.15s; appearance: auto;
            text-transform: uppercase;
        }
        .neo-input::placeholder { font-weight: 700; text-transform: none; color: #9ca3af; }
        .neo-input:focus { outline: none; box-shadow: 3px 3px 0px 0px #000; transform: translateY(-1px); border-color: #000; }
        :host-context(.dark) .neo-input { background-color: #1e293b; color: white; border-color: #475569; }
        :host-context(.dark) .neo-input::placeholder { color: #64748b; }
        :host-context(.dark) .neo-input:focus { border-color: #475569; }
        .field-label { display: block; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; margin-left: 2px; letter-spacing: 0.05em; }
        :host-context(.dark) .field-label { color: #94a3b8; }
    `]
})
export class FormUsuarioComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<FormUsuarioComponent>, { optional: true });
    usuarioForm!: FormGroup;
    isEditMode = false;
    hidePassword = true;
    hideConfirmPassword = true;

    rolesList: { id: number; nombre: string }[] = [];

    private roleService = inject(RoleService);
    private snackBar    = inject(MatSnackBar);

    constructor(
        private fb: FormBuilder,
        private router: Router,
        @Optional() @Inject(MAT_DIALOG_DATA) public data: FormUsuarioData
    ) {}

    ngOnInit(): void {
        if (this.data?.rolesList?.length) {
            this.rolesList = this.data.rolesList.map((r: any) => ({
                id: r.id_role,
                nombre: r.name
            }));
        } else {
            // Carga directa si el padre no pasó roles (race condition o primer acceso)
            this.roleService.getRoles().subscribe({
                next: (roles: any[]) => {
                    this.rolesList = roles.map((r: any) => ({
                        id: r.id_role,
                        nombre: r.name
                    }));
                }
            });
        }
        if (this.data?.usuario && this.data?.mode === 'edit') {
            this.isEditMode = true;
        }
        this.initForm();
        if (this.isEditMode) {
            this.loadUsuarioData(this.data.usuario);
        }
    }

    departamentos = [
        'Sistemas', 'Operaciones', 'Mantenimiento', 'Calidad',
        'Almacén', 'Compras', 'Administración', 'Gerencia'
    ];

    private initForm(): void {
        this.usuarioForm = this.fb.group({
            username:     ['', [Validators.required, Validators.minLength(4)]],
            nombres:      ['', Validators.required],
            apellidos:    ['', Validators.required],
            ci:           ['', Validators.required],
            telefono:     [''],
            email:        ['', Validators.required],
            departamento: [''],
            password:     ['', this.isEditMode ? [] : [Validators.required]],
            confirm_password: ['', this.isEditMode ? [] : [Validators.required]],
            role_id:      ['', Validators.required],
            active:       [true]
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
            username:     usuario.username,
            nombres:      usuario.nombres,
            apellidos:    usuario.apellidos,
            ci:           usuario.ci,
            telefono:     usuario.telefono,
            email:        usuario.email,
            departamento: usuario.departamento || '',
            role_id:      usuario.role_id,
            active:       usuario.active !== undefined ? usuario.active : true
            // Password se deja vacío intencionalmente
        });

        // Password opcional en edición — ya gestionado por initForm() con isEditMode=true
    }

    onSubmit(): void {
        if (this.usuarioForm.valid) {
            const { confirm_password, ...formData } = this.usuarioForm.value;
            this.closeOrNavigate(formData);
        } else {
            this.usuarioForm.markAllAsTouched();
            const camposInvalidos = Object.keys(this.usuarioForm.controls)
                .filter(k => this.usuarioForm.get(k)?.invalid)
                .join(', ');
            const mismatch = this.usuarioForm.hasError('mismatch');
            const msg = mismatch
                ? 'Las contraseñas no coinciden'
                : `Campos incompletos: ${camposInvalidos}`;
            this.snackBar.open(msg, 'OK', { duration: 5000, verticalPosition: 'top' });
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
