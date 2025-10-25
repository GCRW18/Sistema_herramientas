import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WarehouseService, ToolService } from 'app/core/services';
import { ErpConfirmationService } from '@erp/services/confirmation';
import { NotificationService } from 'app/core/services/notification.service';
import { Warehouse, Location, Tool } from 'app/core/models';

@Component({
    selector: 'app-warehouse-detail',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTabsModule,
        MatTableModule,
        MatChipsModule,
        MatCardModule,
        MatDividerModule,
        MatTooltipModule,
    ],
    templateUrl: './warehouse-detail.component.html',
    styleUrl: './warehouse-detail.component.scss'
})
export class WarehouseDetailComponent implements OnInit {
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _warehouseService = inject(WarehouseService);
    private _toolService = inject(ToolService);
    private _confirmationService = inject(ErpConfirmationService);
    private _notificationService = inject(NotificationService);

    warehouse: Warehouse | null = null;
    locations: Location[] = [];
    tools: Tool[] = [];
    loading = true;

    // Location table
    locationColumns = ['code', 'name', 'type', 'capacity', 'currentCapacity', 'status', 'actions'];
    locationDataSource = new MatTableDataSource<Location>();

    // Tools table
    toolColumns = ['code', 'name', 'category', 'location', 'status'];
    toolDataSource = new MatTableDataSource<Tool>();

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('id');
        if (id) {
            this.loadWarehouse(id);
            this.loadLocations(id);
            this.loadTools(id);
        }
    }

    loadWarehouse(id: string): void {
        this.loading = true;
        this._warehouseService.getWarehouseById(id).subscribe({
            next: (warehouse) => {
                this.warehouse = warehouse;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this._router.navigate(['/inventory/warehouses']);
            },
        });
    }

    loadLocations(warehouseId: string): void {
        this._warehouseService.getLocations(warehouseId).subscribe({
            next: (locations) => {
                this.locations = locations;
                this.locationDataSource.data = locations;
            },
        });
    }

    loadTools(warehouseId: string): void {
        this._toolService.getTools({ warehouseId }).subscribe({
            next: (tools) => {
                this.tools = tools;
                this.toolDataSource.data = tools;
            },
        });
    }

    back(): void {
        this._router.navigate(['/inventory/warehouses']);
    }

    edit(): void {
        if (this.warehouse) {
            this._router.navigate(['/inventory/warehouses', this.warehouse.id, 'edit']);
        }
    }

    addLocation(): void {
        if (this.warehouse) {
            this._router.navigate(['/inventory/warehouses', this.warehouse.id, 'locations', 'new']);
        }
    }

    editLocation(location: Location): void {
        if (this.warehouse) {
            this._router.navigate(['/inventory/warehouses', this.warehouse.id, 'locations', location.id, 'edit']);
        }
    }

    deleteLocation(location: Location): void {
        const confirmation = this._confirmationService.open({
            title: 'Eliminar Ubicación',
            message: `¿Está seguro de eliminar la ubicación <strong>${location.name}</strong>? Esta acción no se puede deshacer.`,
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
                this._warehouseService.deleteLocation(location.id).subscribe({
                    next: () => {
                        this._notificationService.success(`Ubicación ${location.name} eliminada correctamente`);
                        if (this.warehouse) {
                            this.loadLocations(this.warehouse.id);
                        }
                    },
                    error: (error) => {
                        this._notificationService.error('Error al eliminar la ubicación');
                        console.error('Error deleting location:', error);
                    },
                });
            }
        });
    }

    getLocationTypeLabel(type: string): string {
        const types: Record<string, string> = {
            shelf: 'Estante',
            rack: 'Rack',
            bin: 'Bin',
            drawer: 'Cajón',
            cabinet: 'Gabinete',
            area: 'Área',
            other: 'Otro',
        };
        return types[type] || type;
    }

    getStatusColor(status: string): string {
        return status === 'active' ? 'primary' : 'warn';
    }
}
