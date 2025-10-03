import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserService, NotificationService } from 'app/core/services';

@Component({
    selector: 'app-user-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        MatTooltipModule,
    ],
    templateUrl: './user-form.component.html',
    styleUrl: './user-form.component.scss'
})
export default class UserFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _route = inject(ActivatedRoute);
    private _userService = inject(UserService);
    private _notificationService = inject(NotificationService);

    form!: FormGroup;
    isEditMode = false;
    userId: string | null = null;
    loading = false;

    roles = [
        { value: 'admin', label: 'Administrador' },
        { value: 'warehouse_manager', label: 'Jefe de Almacén' },
        { value: 'technician', label: 'Técnico' },
        { value: 'viewer', label: 'Solo Visualización' },
    ];

    ngOnInit(): void {
        this.initForm();
        this.checkEditMode();
    }

    initForm(): void {
        this.form = this._fb.group({
            username: ['', Validators.required],
            firstName: ['', Validators.required],
            lastName: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            password: [''],
            role: ['', Validators.required],
            phone: [''],
            active: [true],
        });
    }

    checkEditMode(): void {
        this.userId = this._route.snapshot.paramMap.get('id');
        if (this.userId) {
            this.isEditMode = true;
            this.form.get('password')?.clearValidators();
            this.loadUser();
        } else {
            this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
        }
        this.form.get('password')?.updateValueAndValidity();
    }

    loadUser(): void {
        if (!this.userId) return;

        this.loading = true;
        this._userService.getUserById(this.userId).subscribe({
            next: (user) => {
                this.form.patchValue({
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    role: user.role,
                    phone: user.phone,
                    active: user.active,
                });
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    save(): void {
        if (this.form.invalid) {
            this._notificationService.warning('Por favor complete todos los campos requeridos');
            return;
        }

        this.loading = true;
        const userData = this.form.value;

        const operation = this.isEditMode && this.userId
            ? this._userService.updateUser(this.userId, userData)
            : this._userService.createUser(userData);

        operation.subscribe({
            next: () => {
                const message = this.isEditMode
                    ? `Usuario ${userData.name} actualizado correctamente`
                    : `Usuario ${userData.name} creado correctamente`;
                this._notificationService.success(message);
                this._router.navigate(['/administration/users']);
            },
            error: (error) => {
                this.loading = false;
                const message = this.isEditMode
                    ? 'Error al actualizar el usuario'
                    : 'Error al crear el usuario';
                this._notificationService.error(message);
                console.error('Error saving user:', error);
            },
        });
    }

    cancel(): void {
        this._router.navigate(['/administration/users']);
    }
}
