import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, startWith } from 'rxjs/operators';
import { RoleService } from '../../../../core/services/role.service';
import { Role, AVAILABLE_PERMISSIONS } from '../../../../core/models/role.types';

interface RoleDisplay {
    id: string;
    nombre: string;
    descripcion: string;
    permissions: string[];
    userCount: number;
    active: boolean;
    es_sistema: boolean;
}

@Component({
    selector: 'app-roles',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSnackBarModule,
        ReactiveFormsModule
    ],
    templateUrl: './roles.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }
    `]
})
export class RolesComponent implements OnInit {
    private router = inject(Router);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private roleService = inject(RoleService);

    searchControl = new FormControl('');
    displayedColumns: string[] = ['nombre', 'descripcion', 'permisos', 'usuarios', 'estado', 'acciones'];

    roles: RoleDisplay[] = [];
    filteredRoles: RoleDisplay[] = [];
    availablePermissions = AVAILABLE_PERMISSIONS;

    ngOnInit(): void {
        this.loadRoles();
        this.setupSearch();
    }

    loadRoles(): void {
        this.roleService.getRoles().subscribe({
            next: (data) => {
                this.roles = this.mapToDisplay(data);
                this.applyFilters();
            },
            error: (err) => this.handleError(err)
        });
    }

    private mapToDisplay(roles: Role[]): RoleDisplay[] {
        return roles.map(r => ({
            id: r.id,
            nombre: r.name,
            descripcion: r.description || '',
            permissions: r.permissions || [],
            userCount: r.userCount || 0,
            active: r.active,
            es_sistema: false // Asumir false si no viene del backend
        }));
    }

    setupSearch(): void {
        this.searchControl.valueChanges.pipe(
            startWith(''),
            debounceTime(300)
        ).subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        const searchTerm = this.searchControl.value?.toLowerCase() || '';
        if (searchTerm) {
            this.filteredRoles = this.roles.filter(r =>
                r.nombre.toLowerCase().includes(searchTerm) ||
                r.descripcion?.toLowerCase().includes(searchTerm)
            );
        } else {
            this.filteredRoles = [...this.roles];
        }
    }

    async nuevoRol(): Promise<void> {
        const { FormRolComponent } = await import('./dialogs/form-rol/form-rol.component');
        const dialogRef = this.dialog.open(FormRolComponent, {
            width: '1000px',
            maxWidth: '95vw',
            height: '80vh',
            panelClass: 'neo-dialog',
            disableClose: false
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.createRol(result);
            }
        });
    }

    async editarRol(rol: RoleDisplay): Promise<void> {
        if (rol.es_sistema) {
            this.showWarning('No se puede editar un rol del sistema');
            return;
        }

        const { FormRolComponent } = await import('./dialogs/form-rol/form-rol.component');
        const dialogRef = this.dialog.open(FormRolComponent, {
            width: '1000px',
            maxWidth: '95vw',
            height: '80vh',
            data: { rol, mode: 'edit' },
            panelClass: 'neo-dialog'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.updateRol(rol.id, result);
            }
        });
    }

    async verDetalles(rol: RoleDisplay): Promise<void> {
        const { DetalleRolComponent } = await import('./dialogs/detalle-rol/detalle-rol.component');
        this.dialog.open(DetalleRolComponent, {
            width: '800px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            data: { rol, permissions: this.availablePermissions },
            panelClass: 'neo-dialog'
        });
    }

    async eliminarRol(rol: RoleDisplay): Promise<void> {
        if (rol.es_sistema) {
            this.showWarning('No se puede eliminar un rol del sistema');
            return;
        }

        if (rol.userCount > 0) {
            this.showWarning(`No se puede eliminar el rol porque tiene ${rol.userCount} usuarios asignados`);
            return;
        }

        if (confirm(`¿Está seguro de eliminar el rol "${rol.nombre}"?`)) {
            this.roleService.deleteRole(rol.id).subscribe({
                next: () => {
                    this.showSuccess('Rol eliminado exitosamente');
                    this.loadRoles();
                },
                error: (err) => this.handleError(err)
            });
        }
    }

    async toggleEstado(rol: RoleDisplay): Promise<void> {
        if (rol.es_sistema) {
            this.showWarning('No se puede cambiar el estado de un rol del sistema');
            return;
        }

        const nuevoEstado = !rol.active;
        this.roleService.toggleRoleStatus(rol.id, nuevoEstado).subscribe({
            next: () => {
                this.showSuccess(`Rol ${nuevoEstado ? 'activado' : 'desactivado'} exitosamente`);
                this.loadRoles();
            },
            error: (err) => this.handleError(err)
        });
    }

    createRol(data: any): void {
        this.roleService.createRole(data).subscribe({
            next: () => {
                this.showSuccess('Rol creado exitosamente');
                this.loadRoles();
            },
            error: (err) => this.handleError(err)
        });
    }

    updateRol(id: string, data: any): void {
        this.roleService.updateRole(id, data).subscribe({
            next: () => {
                this.showSuccess('Rol actualizado exitosamente');
                this.loadRoles();
            },
            error: (err) => this.handleError(err)
        });
    }

    volver(): void {
        this.router.navigate(['/administration']);
    }

    getRolesActivos(): number {
        return this.roles.filter(r => r.active).length;
    }

    getRolesInactivos(): number {
        return this.roles.filter(r => !r.active).length;
    }

    getRolesSistema(): number {
        return this.roles.filter(r => r.es_sistema).length;
    }

    getRolesPersonalizados(): number {
        return this.roles.filter(r => !r.es_sistema).length;
    }

    private showSuccess(message: string): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-success']
        });
    }

    private showWarning(message: string): void {
        this.snackBar.open(message, 'Entendido', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-warning']
        });
    }

    private handleError(error: any): void {
        let message = 'Ocurrió un error inesperado';

        if (error.error?.message) {
            message = error.error.message;
        } else if (error.status === 404) {
            message = 'El recurso no fue encontrado';
        } else if (error.status === 403) {
            message = 'No tiene permisos para realizar esta acción';
        } else if (error.status === 500) {
            message = 'Error en el servidor. Intente nuevamente';
        }

        this.snackBar.open(message, 'Cerrar', {
            duration: 5000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-error']
        });
    }
}
