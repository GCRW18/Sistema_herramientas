import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Router } from '@angular/router';
import { ToolService, WarehouseService } from 'app/core/services';
import { Tool, Warehouse } from 'app/core/models';

@Component({
    selector: 'app-inventory-view',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatChipsModule,
        MatSelectModule,
        MatFormFieldModule,
    ],
    templateUrl: './inventory-view.component.html',
    styleUrl: './inventory-view.component.scss'
})
export default class InventoryViewComponent implements OnInit {
    private _router = inject(Router);
    private _toolService = inject(ToolService);
    private _warehouseService = inject(WarehouseService);

    tools: Tool[] = [];
    warehouses: Warehouse[] = [];
    selectedWarehouse: string = '';
    loading = false;

    // Statistics
    totalTools = 0;
    availableTools = 0;
    inUseTools = 0;
    inCalibrationTools = 0;
    inMaintenanceTools = 0;

    ngOnInit(): void {
        this.loadWarehouses();
        this.loadInventory();
    }

    loadWarehouses(): void {
        this._warehouseService.getWarehouses().subscribe({
            next: (warehouses) => {
                this.warehouses = warehouses;
            },
        });
    }

    loadInventory(): void {
        this.loading = true;
        const filters = this.selectedWarehouse ? { warehouseId: this.selectedWarehouse } : {};

        this._toolService.getTools(filters).subscribe({
            next: (tools) => {
                this.tools = tools;
                this.calculateStatistics();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    calculateStatistics(): void {
        this.totalTools = this.tools.length;
        this.availableTools = this.tools.filter(t => t.status === 'available').length;
        this.inUseTools = this.tools.filter(t => t.status === 'in_use').length;
        this.inCalibrationTools = this.tools.filter(t => t.status === 'in_calibration').length;
        this.inMaintenanceTools = this.tools.filter(t => t.status === 'in_maintenance').length;
    }

    onWarehouseChange(): void {
        this.loadInventory();
    }

    viewTool(id: string): void {
        this._router.navigate(['/inventory/tools', id]);
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            available: 'Disponible',
            in_use: 'En Uso',
            in_calibration: 'En Calibración',
            in_maintenance: 'En Mantenimiento',
            quarantine: 'Cuarentena',
            decommissioned: 'Dado de Baja',
        };
        return labels[status] || status;
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            available: 'primary',
            in_use: 'accent',
            in_calibration: 'accent',
            in_maintenance: 'warn',
            quarantine: 'warn',
            decommissioned: '',
        };
        return colors[status] || '';
    }
}
