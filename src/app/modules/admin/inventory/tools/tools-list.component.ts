import { Component, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink } from '@angular/router';
import { ToolService, CategoryService, WarehouseService, NotificationService } from 'app/core/services';
import { Tool, Category, Warehouse, ToolFilters, ToolStatus } from 'app/core/models';
import { ErpConfirmationService } from '@erp/services/confirmation';

@Component({
    selector: 'app-tools-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatSelectModule,
        MatSortModule,
        MatTableModule,
        MatTooltipModule,
        MatChipsModule,
        RouterLink,
    ],
    templateUrl: './tools-list.component.html',
    styleUrls: ['./tools-list.component.scss'],
})
export class ToolsListComponent implements OnInit, AfterViewInit {
    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    private _toolService = inject(ToolService);
    private _categoryService = inject(CategoryService);
    private _warehouseService = inject(WarehouseService);
    private _confirmationService = inject(ErpConfirmationService);
    private _notificationService = inject(NotificationService);

    dataSource = new MatTableDataSource<Tool>();
    displayedColumns = ['code', 'name', 'category', 'warehouse', 'status', 'condition', 'actions'];

    categories: Category[] = [];
    warehouses: Warehouse[] = [];

    filters: ToolFilters = {
        search: '',
        categoryId: '',
        warehouseId: '',
        status: undefined,
    };

    loading = true;

    statusLabels = {
        available: { label: 'Disponible', color: 'bg-green-500' },
        in_use: { label: 'En Uso', color: 'bg-blue-500' },
        in_calibration: { label: 'En Calibración', color: 'bg-orange-500' },
        in_maintenance: { label: 'En Mantenimiento', color: 'bg-yellow-500' },
        quarantine: { label: 'Cuarentena', color: 'bg-red-500' },
        decommissioned: { label: 'Dado de Baja', color: 'bg-gray-500' },
        lost: { label: 'Perdido', color: 'bg-gray-700' },
    };

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    ngOnInit(): void {
        this.loadData();
        this.loadFilters();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Load tools data
     */
    loadData(): void {
        this.loading = true;
        this._toolService.getTools(this.filters).subscribe({
            next: (tools) => {
                this.dataSource.data = tools;
                this.loading = false;
            },
            error: (error) => { console.error("Error loading tools:", error);
                this.loading = false;
            },
        });
    }

    /**
     * Load filter options
     */
    loadFilters(): void {
        this._categoryService.getCategories().subscribe({
            next: (categories) => {
                this.categories = categories;
            },
        });

        this._warehouseService.getWarehouses().subscribe({
            next: (warehouses) => {
                this.warehouses = warehouses;
            },
        });
    }

    /**
     * Apply filters
     */
    applyFilters(): void {
        this.loadData();
    }

    /**
     * Clear filters
     */
    clearFilters(): void {
        this.filters = {
            search: '',
            categoryId: '',
            warehouseId: '',
            status: undefined,
        };
        this.loadData();
    }

    /**
     * Get status label and color
     */
    getStatusInfo(status: string): any {
        return this.statusLabels[status as keyof typeof this.statusLabels] || { label: status, color: 'bg-gray-500' };
    }

    /**
     * Get count of tools by status
     */
    getToolCountByStatus(status: string): number {
        return this.dataSource.data.filter(tool => tool.status === status).length;
    }

    /**
     * Delete tool
     */
    deleteTool(tool: Tool): void {
        const confirmation = this._confirmationService.open({
            title: 'Eliminar Herramienta',
            message: `¿Está seguro de eliminar la herramienta <strong>${tool.code} - ${tool.name}</strong>? Esta acción no se puede deshacer.`,
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
                this._toolService.deleteTool(tool.id).subscribe({
                    next: () => {
                        this._notificationService.success(`Herramienta ${tool.code} eliminada correctamente`);
                        this.loadData();
                    },
                    error: (error) => {
                        this._notificationService.error('Error al eliminar la herramienta');
                        console.error('Error deleting tool:', error);
                    },
                });
            }
        });
    }
}
