import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FleetService, NotificationService } from 'app/core/services';
import { Aircraft } from 'app/core/models';

@Component({
    selector: 'app-fleet-detail',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTabsModule,
        MatTooltipModule,
        MatTableModule,
        MatChipsModule,
        MatDialogModule,
    ],
    templateUrl: './fleet-detail.component.html',
    styleUrl: './fleet-detail.component.scss'
})
export default class FleetDetailComponent implements OnInit {
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _fleetService = inject(FleetService);
    private _notificationService = inject(NotificationService);
    private _dialog = inject(MatDialog);

    aircraft: Aircraft | null = null;
    loading = false;
    selectedTabIndex = 0;

    // Maintenance history data
    maintenanceHistory: any[] = [];
    maintenanceColumns = ['date', 'type', 'description', 'technician', 'status'];
    loadingMaintenance = false;

    // Assigned tools data
    assignedTools: any[] = [];
    toolsColumns = ['code', 'name', 'category', 'assignedDate', 'status'];
    loadingTools = false;

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('id');
        if (id) {
            this.loadAircraft(id);
        }
    }

    loadAircraft(id: string): void {
        this.loading = true;
        this._fleetService.getAircraftById(id).subscribe({
            next: (aircraft) => {
                this.aircraft = aircraft;
                this.loading = false;
            },
            error: (error) => {
                this._notificationService.error('Error al cargar la aeronave');
                console.error('Error loading aircraft:', error);
                this.loading = false;
                this._router.navigate(['/fleet']);
            },
        });
    }

    onTabChange(index: number): void {
        this.selectedTabIndex = index;

        if (index === 1 && this.maintenanceHistory.length === 0) {
            this.loadMaintenanceHistory();
        } else if (index === 2 && this.assignedTools.length === 0) {
            this.loadAssignedTools();
        }
    }

    loadMaintenanceHistory(): void {
        if (!this.aircraft?.id) return;

        this.loadingMaintenance = true;
        this._fleetService.getMaintenanceHistory(this.aircraft.id).subscribe({
            next: (history) => {
                this.maintenanceHistory = history;
                this.loadingMaintenance = false;
            },
            error: () => {
                this.loadingMaintenance = false;
            },
        });
    }

    loadAssignedTools(): void {
        if (!this.aircraft?.id) return;

        this.loadingTools = true;
        this._fleetService.getAssignedTools(this.aircraft.id).subscribe({
            next: (tools) => {
                this.assignedTools = tools;
                this.loadingTools = false;
            },
            error: () => {
                this.loadingTools = false;
            },
        });
    }

    editAircraft(): void {
        if (this.aircraft?.id) {
            this._router.navigate(['/fleet', this.aircraft.id, 'edit']);
        }
    }

    deleteAircraft(): void {
        if (!this.aircraft) return;

        // TODO: Implement confirm dialog
        if (confirm(`¿Está seguro que desea eliminar la aeronave ${this.aircraft.registration}?`)) {
            this._fleetService.deleteAircraft(this.aircraft.id).subscribe({
                next: () => {
                    this._notificationService.success(
                        `Aeronave ${this.aircraft?.registration} eliminada correctamente`
                    );
                    this._router.navigate(['/fleet']);
                },
                error: () => {
                    this._notificationService.error('Error al eliminar la aeronave');
                },
            });
        }
    }

    goBack(): void {
        this._router.navigate(['/fleet']);
    }

    getStatusInfo(status: string): { label: string; color: string } {
        const statusMap: Record<string, { label: string; color: string }> = {
            active: { label: 'Activa', color: 'bg-green-600' },
            maintenance: { label: 'En Mantenimiento', color: 'bg-orange-600' },
            grounded: { label: 'En Tierra', color: 'bg-yellow-600' },
            decommissioned: { label: 'Fuera de Servicio', color: 'bg-red-600' },
        };
        return statusMap[status] || { label: status, color: 'bg-gray-600' };
    }

    getTypeLabel(type: string): string {
        const typeMap: Record<string, string> = {
            passenger: 'Pasajeros',
            cargo: 'Carga',
            mixed: 'Mixto',
        };
        return typeMap[type] || type;
    }

    formatDate(date: any): string {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('es-BO');
    }
}
