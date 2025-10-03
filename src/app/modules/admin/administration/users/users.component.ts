import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService, NotificationService } from 'app/core/services';
import { User } from 'app/core/models';
import { ErpConfirmationService } from '@erp/services/confirmation';

@Component({
    selector: 'app-users',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatFormFieldModule,
        MatInputModule,
        MatChipsModule,
        MatTooltipModule,
    ],
    templateUrl: './users.component.html',
    styleUrl: './users.component.scss'
})
export default class UsersComponent implements OnInit {
    private _router = inject(Router);
    private _adminService = inject(AdminService);
    private _confirmationService = inject(ErpConfirmationService);
    private _notificationService = inject(NotificationService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['name', 'email', 'role', 'department', 'status', 'actions'];
    dataSource = new MatTableDataSource<User>();
    loading = false;

    ngOnInit(): void {
        this.loadUsers();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadUsers(): void {
        this.loading = true;
        this._adminService.getUsers().subscribe({
            next: (users) => {
                this.dataSource.data = users;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    applyFilter(event: Event): void {
        const filterValue = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }

    createUser(): void {
        this._router.navigate(['/administration/users/new']);
    }

    viewUser(id: string): void {
        this._router.navigate(['/administration/users', id]);
    }

    editUser(id: string): void {
        this._router.navigate(['/administration/users', id, 'edit']);
    }

    deleteUser(user: User): void {
        const confirmation = this._confirmationService.open({
            title: 'Eliminar Usuario',
            message: `¿Está seguro de eliminar al usuario <strong>${user.name}</strong> (${user.email})? Esta acción no se puede deshacer.`,
            icon: {
                show: true,
                name: 'heroicons_outline:exclamation-triangle',
                color: 'warn',
            },
            actions: {
                confirm: {
                    show: true,
                    label: 'Eliminar',
                    color: 'warn',
                },
                cancel: {
                    show: true,
                    label: 'Cancelar',
                },
            },
            dismissible: true,
        });

        confirmation.afterClosed().subscribe((result) => {
            if (result === 'confirmed') {
                this._adminService.deleteUser(user.id).subscribe({
                    next: () => {
                        this._notificationService.success(`Usuario ${user.name} eliminado correctamente`);
                        this.loadUsers();
                    },
                    error: (error) => {
                        this._notificationService.error('Error al eliminar el usuario');
                        console.error('Error deleting user:', error);
                    },
                });
            }
        });
    }

    getRoleLabel(role: string): string {
        const labels: Record<string, string> = {
            admin: 'Administrador',
            warehouse_manager: 'Encargado de Almacén',
            technician: 'Técnico',
            viewer: 'Visualizador',
        };
        return labels[role] || role;
    }
}
