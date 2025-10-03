import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { Role, Permission, AVAILABLE_PERMISSIONS } from 'app/core/models';

export interface RoleDialogData {
    role?: Role;
    mode: 'create' | 'edit';
}

@Component({
    selector: 'app-role-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        MatIconModule,
        MatDividerModule,
    ],
    templateUrl: './role-dialog.component.html',
    styleUrl: './role-dialog.component.scss'
})
export class RoleDialogComponent implements OnInit {
    private _formBuilder = inject(FormBuilder);
    private _dialogRef = inject(MatDialogRef<RoleDialogComponent>);

    roleForm!: FormGroup;
    availablePermissions: Permission[] = AVAILABLE_PERMISSIONS;
    groupedPermissions: { [key: string]: Permission[] } = {};
    selectedPermissions: Set<string> = new Set();

    constructor(@Inject(MAT_DIALOG_DATA) public data: RoleDialogData) {}

    ngOnInit(): void {
        this._initForm();
        this._groupPermissions();

        if (this.data.role) {
            this._populateForm();
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    private _initForm(): void {
        this.roleForm = this._formBuilder.group({
            name: ['', [Validators.required, Validators.minLength(3)]],
            description: [''],
            active: [true],
        });
    }

    private _populateForm(): void {
        if (this.data.role) {
            this.roleForm.patchValue({
                name: this.data.role.name,
                description: this.data.role.description,
                active: this.data.role.active,
            });

            // Set selected permissions
            this.data.role.permissions.forEach(permId => {
                this.selectedPermissions.add(permId);
            });
        }
    }

    private _groupPermissions(): void {
        this.availablePermissions.forEach(permission => {
            if (!this.groupedPermissions[permission.module]) {
                this.groupedPermissions[permission.module] = [];
            }
            this.groupedPermissions[permission.module].push(permission);
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Toggle permission selection
     */
    togglePermission(permissionId: string): void {
        if (this.selectedPermissions.has(permissionId)) {
            this.selectedPermissions.delete(permissionId);
        } else {
            this.selectedPermissions.add(permissionId);
        }
    }

    /**
     * Check if permission is selected
     */
    isPermissionSelected(permissionId: string): boolean {
        return this.selectedPermissions.has(permissionId);
    }

    /**
     * Select all permissions in a module
     */
    toggleModulePermissions(module: string): void {
        const modulePermissions = this.groupedPermissions[module];
        const allSelected = modulePermissions.every(p => this.selectedPermissions.has(p.id));

        if (allSelected) {
            // Deselect all
            modulePermissions.forEach(p => this.selectedPermissions.delete(p.id));
        } else {
            // Select all
            modulePermissions.forEach(p => this.selectedPermissions.add(p.id));
        }
    }

    /**
     * Check if all permissions in a module are selected
     */
    isModuleSelected(module: string): boolean {
        const modulePermissions = this.groupedPermissions[module];
        return modulePermissions.every(p => this.selectedPermissions.has(p.id));
    }

    /**
     * Check if some (but not all) permissions in a module are selected
     */
    isModuleIndeterminate(module: string): boolean {
        const modulePermissions = this.groupedPermissions[module];
        const selectedCount = modulePermissions.filter(p => this.selectedPermissions.has(p.id)).length;
        return selectedCount > 0 && selectedCount < modulePermissions.length;
    }

    /**
     * Get module keys
     */
    getModuleKeys(): string[] {
        return Object.keys(this.groupedPermissions);
    }

    /**
     * Save role
     */
    save(): void {
        if (this.roleForm.invalid) {
            this.roleForm.markAllAsTouched();
            return;
        }

        if (this.selectedPermissions.size === 0) {
            return;
        }

        const formValue = this.roleForm.value;
        const result = {
            ...formValue,
            permissions: Array.from(this.selectedPermissions),
        };

        this._dialogRef.close(result);
    }

    /**
     * Cancel
     */
    cancel(): void {
        this._dialogRef.close();
    }

    /**
     * Get form error message
     */
    getErrorMessage(field: string): string {
        const control = this.roleForm.get(field);
        if (control?.hasError('required')) {
            return 'Este campo es requerido';
        }
        if (control?.hasError('minlength')) {
            return `Mínimo ${control.errors?.['minlength'].requiredLength} caracteres`;
        }
        return '';
    }
}
