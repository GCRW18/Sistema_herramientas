import { Component, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ErpConfirmationService } from '@erp/services/confirmation';
import { RoleService } from 'app/core/services';
import { Role } from 'app/core/models';
import { RoleDialogComponent, RoleDialogData } from './role-dialog/role-dialog.component';

@Component({
    selector: 'app-roles',
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
        MatDialogModule,
    ],
    templateUrl: './roles.component.html',
    styleUrl: './roles.component.scss'
})
export default class RolesComponent implements OnInit, AfterViewInit {
    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    private _roleService = inject(RoleService);
    private _dialog = inject(MatDialog);
    private _confirmationService = inject(ErpConfirmationService);

    displayedColumns: string[] = ['name', 'description', 'permissions', 'userCount', 'active', 'actions'];
    dataSource = new MatTableDataSource<Role>();
    loading = false;

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    ngOnInit(): void {
        this.loadRoles();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Load roles
     */
    loadRoles(): void {
        this.loading = true;
        this._roleService.getRoles().subscribe({
            next: (roles) => {
                this.dataSource.data = roles;
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading roles:', error);
                this.loading = false;
            }
        });
    }

    /**
     * Apply filter to table
     */
    applyFilter(event: Event): void {
        const filterValue = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }

    /**
     * Create new role
     */
    createRole(): void {
        const dialogData: RoleDialogData = {
            mode: 'create'
        };

        const dialogRef = this._dialog.open(RoleDialogComponent, {
            width: '800px',
            maxHeight: '90vh',
            data: dialogData,
            disableClose: true
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                this._roleService.createRole(result).subscribe({
                    next: () => {
                        this.loadRoles();
                    },
                    error: (error) => {
                        console.error('Error creating role:', error);
                    }
                });
            }
        });
    }

    /**
     * Edit role
     */
    editRole(id: string): void {
        this._roleService.getRoleById(id).subscribe({
            next: (role) => {
                const dialogData: RoleDialogData = {
                    role,
                    mode: 'edit'
                };

                const dialogRef = this._dialog.open(RoleDialogComponent, {
                    width: '800px',
                    maxHeight: '90vh',
                    data: dialogData,
                    disableClose: true
                });

                dialogRef.afterClosed().subscribe((result) => {
                    if (result) {
                        this._roleService.updateRole(id, result).subscribe({
                            next: () => {
                                this.loadRoles();
                            },
                            error: (error) => {
                                console.error('Error updating role:', error);
                            }
                        });
                    }
                });
            },
            error: (error) => {
                console.error('Error loading role:', error);
            }
        });
    }

    /**
     * Delete role
     */
    deleteRole(id: string): void {
        const confirmation = this._confirmationService.open({
            title: 'Eliminar Rol',
            message: '¿Está seguro de que desea eliminar este rol? Esta acción no se puede deshacer.',
            actions: {
                confirm: {
                    label: 'Eliminar',
                    color: 'warn'
                },
                cancel: {
                    label: 'Cancelar'
                }
            }
        });

        confirmation.afterClosed().subscribe((result) => {
            if (result === 'confirmed') {
                this._roleService.deleteRole(id).subscribe({
                    next: () => {
                        this.loadRoles();
                    },
                    error: (error) => {
                        console.error('Error deleting role:', error);
                    }
                });
            }
        });
    }

    /**
     * View permissions dialog
     */
    viewPermissions(role: Role): void {
        const dialogData: RoleDialogData = {
            role,
            mode: 'edit'
        };

        this._dialog.open(RoleDialogComponent, {
            width: '800px',
            maxHeight: '90vh',
            data: dialogData,
            disableClose: true
        });
    }
}
