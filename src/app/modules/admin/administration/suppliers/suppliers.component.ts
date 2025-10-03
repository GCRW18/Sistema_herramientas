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
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService, NotificationService } from 'app/core/services';
import { Supplier } from 'app/core/models';
import { ErpConfirmationService } from '@erp/services/confirmation';

@Component({
    selector: 'app-suppliers',
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
        MatTooltipModule,
    ],
    templateUrl: './suppliers.component.html',
    styleUrl: './suppliers.component.scss'
})
export default class SuppliersComponent implements OnInit {
    private _router = inject(Router);
    private _adminService = inject(AdminService);
    private _confirmationService = inject(ErpConfirmationService);
    private _notificationService = inject(NotificationService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['name', 'contact', 'email', 'phone', 'active', 'actions'];
    dataSource = new MatTableDataSource<Supplier>();
    loading = false;

    ngOnInit(): void {
        this.loadSuppliers();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadSuppliers(): void {
        this.loading = true;
        this._adminService.getSuppliers().subscribe({
            next: (suppliers) => {
                this.dataSource.data = suppliers;
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

    createSupplier(): void {
        this._router.navigate(['/administration/suppliers/new']);
    }

    editSupplier(id: string): void {
        this._router.navigate(['/administration/suppliers', id, 'edit']);
    }

    deleteSupplier(supplier: Supplier): void {
        const confirmation = this._confirmationService.open({
            title: 'Eliminar Proveedor',
            message: `¿Está seguro de eliminar el proveedor <strong>${supplier.name}</strong>? Esta acción no se puede deshacer.`,
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
                this._adminService.deleteSupplier(supplier.id).subscribe({
                    next: () => {
                        this._notificationService.success(`Proveedor ${supplier.name} eliminado correctamente`);
                        this.loadSuppliers();
                    },
                    error: (error) => {
                        this._notificationService.error('Error al eliminar el proveedor');
                        console.error('Error deleting supplier:', error);
                    },
                });
            }
        });
    }
}
