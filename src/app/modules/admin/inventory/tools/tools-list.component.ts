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
    displayedColumns = ['code', 'name', 'category', 'warehouse', 'aircraft', 'department', 'status', 'condition', 'actions'];

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
        // FIX: Asegurar que el ID es válido
        const toolId = (tool as any).id_tool || tool.id;

        if (!toolId) {
            this._notificationService.error('Error: ID de herramienta no válido');
            console.error('Tool ID is undefined:', tool);
            return;
        }

        const confirmation = this._confirmationService.open({
            title: 'Eliminar Herramienta',
            message: `¿Está seguro de eliminar la herramienta <strong>${tool.code} - ${tool.name}</strong>?<br><br>
                <strong>ADVERTENCIA:</strong> Esta acción eliminará también:<br>
                - Todas las calibraciones asociadas<br>
                - Todos los mantenimientos registrados<br>
                - Todo el historial de movimientos<br>
                - Todas las asignaciones a empleados<br><br>
                <strong>Esta acción no se puede deshacer.</strong>`,
            icon: {
                show: true,
                name: 'heroicons_outline:exclamation-triangle',
                color: 'warn',
            },
            actions: {
                confirm: {
                    show: true,
                    label: 'Eliminar Todo',
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
                this._toolService.deleteTool(toolId.toString()).subscribe({
                    next: () => {
                        this._notificationService.success(`Herramienta ${tool.code} eliminada correctamente`);
                        this.loadData();
                    },
                    error: (error) => {
                        console.error('Error deleting tool:', error);

                        // Extraer mensaje de error específico del backend
                        let errorMessage = 'Error al eliminar la herramienta';

                        if (error?.error?.ROOT?.detalle?.mensaje) {
                            const backendMessage = error.error.ROOT.detalle.mensaje;

                            // Si el backend tiene un mensaje descriptivo, usarlo
                            if (backendMessage.includes('No se puede eliminar')) {
                                errorMessage = backendMessage;
                            }
                            // Detectar error de calibraciones
                            else if (backendMessage.includes('calibrations_tool_id_fkey') ||
                                     backendMessage.includes('calibración(es)')) {
                                errorMessage = 'No se puede eliminar: la herramienta tiene calibraciones registradas. Elimine primero las calibraciones.';
                            }
                            // Detectar error de mantenimientos
                            else if (backendMessage.includes('maintenances_tool_id_fkey') ||
                                     backendMessage.includes('mantenimiento(s)')) {
                                errorMessage = 'No se puede eliminar: la herramienta tiene mantenimientos registrados. Elimine primero los mantenimientos.';
                            }
                            // Detectar error de movimientos
                            else if (backendMessage.includes('tool_movements') ||
                                     backendMessage.includes('movimiento(s)')) {
                                errorMessage = 'No se puede eliminar: la herramienta tiene movimientos registrados. Elimine primero el historial.';
                            }
                            // Detectar error de asignaciones
                            else if (backendMessage.includes('tool_assignments') ||
                                     backendMessage.includes('asignación(es)')) {
                                errorMessage = 'No se puede eliminar: la herramienta está asignada a empleados. Finalice las asignaciones primero.';
                            }
                            // Detectar otros errores de FK
                            else if (backendMessage.includes('violates foreign key constraint')) {
                                errorMessage = 'No se puede eliminar: la herramienta tiene registros asociados. Elimine las dependencias primero.';
                            }
                        }

                        this._notificationService.error(errorMessage);
                    },
                });
            }
        });
    }
}
