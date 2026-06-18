import { Component, OnInit, inject, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
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
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './form-rol.component.html',
    styles: [':host { display: block; }']
})
export class FormRolComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<FormRolComponent>, { optional: true });
    private dialog = inject(MatDialog);

    rolForm!: FormGroup;
    isEditMode = false;
    readonly totalPermissions = AVAILABLE_PERMISSIONS.length;

    private groupedPermissions: Map<string, Permission[]> = new Map();

    constructor(
        private fb: FormBuilder,
        private router: Router,
        @Optional() @Inject(MAT_DIALOG_DATA) public data: FormRolData
    ) {}

    ngOnInit(): void {
        this.initForm();
        AVAILABLE_PERMISSIONS.forEach(p => {
            if (!this.groupedPermissions.has(p.module)) this.groupedPermissions.set(p.module, []);
            this.groupedPermissions.get(p.module)!.push(p);
        });

        if (this.data?.rol && this.data?.mode === 'edit') {
            this.isEditMode = true;
            this.loadRolData(this.data.rol);
        }
    }

    private initForm(): void {
        this.rolForm = this.fb.group({
            nombre:      ['', [Validators.required, Validators.minLength(3)]],
            descripcion: [''],
            permissions: [[]],
            active:      [true]
        });
    }

    private loadRolData(rol: any): void {
        this.rolForm.patchValue({
            nombre:      rol.nombre || rol.name,
            descripcion: rol.descripcion || rol.description,
            permissions: rol.permissions || [],
            active:      rol.active !== undefined ? rol.active : true
        });
    }

    getSelectedModulesSummary(): { name: string; count: number }[] {
        const current: string[] = this.rolForm.get('permissions')?.value || [];
        const result: { name: string; count: number }[] = [];
        this.groupedPermissions.forEach((perms, module) => {
            const count = perms.filter(p => current.includes(p.id)).length;
            if (count > 0) result.push({ name: module, count });
        });
        return result;
    }

    async openPermisosDialog(): Promise<void> {
        const { PermisosDialogComponent } = await import('./permisos-dialog.component');
        const current: string[] = this.rolForm.get('permissions')?.value || [];
        const ref = this.dialog.open(PermisosDialogComponent, {
            width: '660px',
            maxWidth: '95vw',
            maxHeight: '85vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            backdropClass: 'bg-black/30',
            data: { permissions: current }
        });
        ref.afterClosed().subscribe((result: string[] | null) => {
            if (result !== null && result !== undefined) {
                this.rolForm.patchValue({ permissions: result });
                this.rolForm.markAsDirty();
            }
        });
    }

    onSubmit(): void {
        if (this.rolForm.valid) {
            this.closeOrNavigate(this.rolForm.value);
        } else {
            this.rolForm.markAllAsTouched();
        }
    }

    onCancel(): void { this.closeOrNavigate(); }

    private closeOrNavigate(result?: any): void {
        if (this.dialogRef) {
            this.dialogRef.close(result);
        } else {
            this.router.navigate(['/administration/roles']);
        }
    }
}
