import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AVAILABLE_PERMISSIONS, Permission } from '../../../../../../core/models/role.types';

@Component({
    selector: 'app-detalle-rol',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './detalle-rol.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }
    `]
})
export class DetalleRolComponent {
    private dialogRef = inject(MatDialogRef<DetalleRolComponent>);
    private dialog = inject(MatDialog);
    groupedPermissions: Map<string, Permission[]> = new Map();

    constructor(@Inject(MAT_DIALOG_DATA) public data: { rol: any, permissions: Permission[] }) {
        this.groupPermissionsByModule();
    }

    private groupPermissionsByModule(): void {
        const permisos = this.data.permissions || AVAILABLE_PERMISSIONS;
        const rolPermissions = this.data.rol.permissions || [];

        permisos.forEach(perm => {
            if (rolPermissions.includes(perm.id)) {
                if (!this.groupedPermissions.has(perm.module)) {
                    this.groupedPermissions.set(perm.module, []);
                }
                this.groupedPermissions.get(perm.module)!.push(perm);
            }
        });
    }

    async editarRol(): Promise<void> {
        if (this.data.rol.es_sistema) {
            alert('No se puede editar un rol del sistema');
            return;
        }

        this.dialogRef.close();
        const { FormRolComponent } = await import('../form-rol/form-rol.component');
        this.dialog.open(FormRolComponent, {
            width: '1000px',
            maxWidth: '95vw',
            height: '80vh',
            panelClass: 'neo-dialog',
            data: { rol: this.data.rol, mode: 'edit' }
        });
    }

    cerrar(): void {
        this.dialogRef.close();
    }
}
