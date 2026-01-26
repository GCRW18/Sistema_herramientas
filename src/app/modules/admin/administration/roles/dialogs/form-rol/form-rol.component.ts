import { Component, OnInit, inject, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AVAILABLE_PERMISSIONS, Permission } from '../../../../../../core/models/role.types';

export interface FormRolData {
    rol?: any;
    mode?: 'create' | 'edit';
}

@Component({
    selector: 'app-form-rol',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './form-rol.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        /* Animación suave para la expansión del acordeón */
        .animate-fadeIn {
            animation: fadeIn 0.3s ease-out forwards;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `]
})
export class FormRolComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<FormRolComponent>, { optional: true });
    rolForm!: FormGroup;
    isEditMode = false;
    groupedPermissions: Map<string, Permission[]> = new Map();
    expandedModules: Set<string> = new Set();

    constructor(
        private fb: FormBuilder,
        private router: Router,
        @Optional() @Inject(MAT_DIALOG_DATA) public data: FormRolData
    ) {}

    ngOnInit(): void {
        this.initForm();
        this.groupedPermissions = this.groupPermissionsByModule(AVAILABLE_PERMISSIONS);
        // Expandir todos los módulos por defecto para mejor visualización inicial
        this.groupedPermissions.forEach((_, key) => this.expandedModules.add(key));

        if (this.data?.rol && this.data?.mode === 'edit') {
            this.isEditMode = true;
            this.loadRolData(this.data.rol);
        }
    }

    private initForm(): void {
        this.rolForm = this.fb.group({
            nombre: ['', [Validators.required, Validators.minLength(3)]],
            descripcion: [''],
            permissions: [[], Validators.required],
            active: [true]
        });
    }

    private groupPermissionsByModule(permissions: Permission[]): Map<string, Permission[]> {
        const grouped = new Map<string, Permission[]>();
        permissions.forEach(perm => {
            if (!grouped.has(perm.module)) {
                grouped.set(perm.module, []);
            }
            grouped.get(perm.module)!.push(perm);
        });
        return grouped;
    }

    private loadRolData(rol: any): void {
        this.rolForm.patchValue({
            nombre: rol.nombre || rol.name,
            descripcion: rol.descripcion || rol.description,
            permissions: rol.permissions || [],
            active: rol.active !== undefined ? rol.active : true
        });
    }

    isPermissionSelected(permId: string): boolean {
        return this.rolForm.get('permissions')?.value?.includes(permId) || false;
    }

    togglePermission(permId: string): void {
        const current = this.rolForm.get('permissions')?.value || [];
        if (current.includes(permId)) {
            this.rolForm.patchValue({
                permissions: current.filter((id: string) => id !== permId)
            });
        } else {
            this.rolForm.patchValue({
                permissions: [...current, permId]
            });
        }
        this.rolForm.markAsDirty();
    }

    toggleModulePermissions(module: string): void {
        const modulePerms = this.groupedPermissions.get(module) || [];
        const modulePermIds = modulePerms.map(p => p.id);
        const current = this.rolForm.get('permissions')?.value || [];

        const allSelected = modulePermIds.every(id => current.includes(id));

        if (allSelected) {
            // Deseleccionar todos
            this.rolForm.patchValue({
                permissions: current.filter((id: string) => !modulePermIds.includes(id))
            });
        } else {
            // Seleccionar todos (manteniendo únicos)
            const newPerms = [...new Set([...current, ...modulePermIds])];
            this.rolForm.patchValue({ permissions: newPerms });
        }
        this.rolForm.markAsDirty();
    }

    isModuleFullySelected(module: string): boolean {
        const modulePerms = this.groupedPermissions.get(module) || [];
        const modulePermIds = modulePerms.map(p => p.id);
        const current = this.rolForm.get('permissions')?.value || [];
        return modulePermIds.length > 0 && modulePermIds.every(id => current.includes(id));
    }

    getSelectedCountInModule(module: string): number {
        const modulePerms = this.groupedPermissions.get(module) || [];
        const modulePermIds = modulePerms.map(p => p.id);
        const current = this.rolForm.get('permissions')?.value || [];
        return modulePermIds.filter(id => current.includes(id)).length;
    }

    toggleModuleExpanded(module: string): void {
        if (this.expandedModules.has(module)) {
            this.expandedModules.delete(module);
        } else {
            this.expandedModules.add(module);
        }
    }

    isModuleExpanded(module: string): boolean {
        return this.expandedModules.has(module);
    }

    onSubmit(): void {
        if (this.rolForm.valid) {
            this.closeOrNavigate(this.rolForm.value);
        } else {
            this.rolForm.markAllAsTouched();
        }
    }

    onCancel(): void {
        this.closeOrNavigate();
    }

    private closeOrNavigate(result?: any): void {
        if (this.dialogRef) {
            this.dialogRef.close(result);
        } else {
            this.router.navigate(['/administration/roles']);
        }
    }
}
