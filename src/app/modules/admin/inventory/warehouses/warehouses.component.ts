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
import { WarehouseService, NotificationService } from 'app/core/services';
import { Warehouse } from 'app/core/models';
import { ErpConfirmationService } from '@erp/services/confirmation';

/**
 * WarehousesComponent
 * Componente para listar almacenes
 * CORREGIDO: 13-11-2025 - Referencias correctas a id_warehouse
 */
@Component({
    selector: 'app-warehouses',
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
    templateUrl: './warehouses.component.html',
    styleUrl: './warehouses.component.scss'
})
export class WarehousesComponent implements OnInit {
    private _router = inject(Router);
    private _warehouseService = inject(WarehouseService);
    private _confirmationService = inject(ErpConfirmationService);
    private _notificationService = inject(NotificationService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['code', 'name', 'description', 'responsible', 'active', 'actions'];
    dataSource = new MatTableDataSource<Warehouse>();
    loading = false;

    ngOnInit(): void {
        this.loadWarehouses();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadWarehouses(): void {
        this.loading = true;
        this._warehouseService.getWarehouses().subscribe({
            next: (warehouses) => {
                this.dataSource.data = warehouses;
                this.loading = false;
            },
            error: (error) => {
                this._notificationService.error('Error al cargar almacenes');
                console.error('Error loading warehouses:', error);
                this.loading = false;
            },
        });
    }

    applyFilter(event: Event): void {
        const filterValue = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }

    createWarehouse(): void {
        this._router.navigate(['/inventory/warehouses/new']);
    }

    viewWarehouse(id_warehouse: number): void {
        this._router.navigate(['/inventory/warehouses', id_warehouse]);
    }

    editWarehouse(id_warehouse: number): void {
        this._router.navigate(['/inventory/warehouses', id_warehouse, 'edit']);
    }

    deleteWarehouse(warehouse: Warehouse): void {
        const confirmation = this._confirmationService.open({
            title: 'Eliminar Almacén',
            message: `¿Está seguro de eliminar el almacén <strong>${warehouse.code} - ${warehouse.name}</strong>? Esta acción no se puede deshacer.`,
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
                this._warehouseService.deleteWarehouse(warehouse.id_warehouse.toString()).subscribe({
                    next: () => {
                        this._notificationService.success(`Almacén ${warehouse.code} eliminado correctamente`);
                        this.loadWarehouses();
                    },
                    error: (error) => {
                        this._notificationService.error('Error al eliminar el almacén');
                        console.error('Error deleting warehouse:', error);
                    },
                });
            }
        });
    }

    getActiveWarehouseCount(): number {
        return this.dataSource.data.filter(w => w.active).length;
    }
}
