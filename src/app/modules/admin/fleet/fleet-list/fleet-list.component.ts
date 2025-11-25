import { Component, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
import { FleetService, NotificationService } from 'app/core/services';
import { Aircraft, AircraftFilters } from 'app/core/models';
import { ErpConfirmationService } from '@erp/services/confirmation';

@Component({
    selector: 'app-fleet-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
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
    ],
    templateUrl: './fleet-list.component.html',
    styleUrl: './fleet-list.component.scss'
})
export default class FleetListComponent implements OnInit, AfterViewInit {
    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    private _router = inject(Router);
    private _fleetService = inject(FleetService);
    private _confirmationService = inject(ErpConfirmationService);
    private _notificationService = inject(NotificationService);

    dataSource = new MatTableDataSource<Aircraft>();
    displayedColumns = ['registration', 'manufacturer', 'model', 'type', 'status', 'baseLocation', 'actions'];

    filters: AircraftFilters = {
        search: '',
        status: undefined,
        type: undefined,
    };

    loading = true;

    statusLabels = {
        active: { label: 'Activa', color: 'bg-green-500' },
        maintenance: { label: 'En Mantenimiento', color: 'bg-orange-500' },
        grounded: { label: 'En Tierra', color: 'bg-yellow-500' },
        decommissioned: { label: 'Fuera de Servicio', color: 'bg-gray-500' },
    };

    typeLabels = {
        passenger: 'Pasajeros',
        cargo: 'Carga',
        mixed: 'Mixto',
    };

    ngOnInit(): void {
        this.loadData();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadData(): void {
        this.loading = true;
        this._fleetService.getAircraft(this.filters).subscribe({
            next: (aircraft) => {
                this.dataSource.data = aircraft;
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading aircraft:', error);
                this.loading = false;
            },
        });
    }

    applyFilters(): void {
        this.loadData();
    }

    clearFilters(): void {
        this.filters = {
            search: '',
            status: undefined,
            type: undefined,
        };
        this.loadData();
    }

    getStatusInfo(status: string): any {
        return this.statusLabels[status as keyof typeof this.statusLabels] || { label: status, color: 'bg-gray-500' };
    }

    getTypeLabel(type: string): string {
        return this.typeLabels[type as keyof typeof this.typeLabels] || type;
    }

    getAircraftCountByStatus(status: string): number {
        return this.dataSource.data.filter(aircraft => aircraft.status === status).length;
    }

    createAircraft(): void {
        this._router.navigate(['/fleet/new']);
    }

    deleteAircraft(aircraft: Aircraft): void {
        const confirmation = this._confirmationService.open({
            title: 'Eliminar Aeronave',
            message: `¿Está seguro de eliminar la aeronave <strong>${aircraft.registration}</strong>? Esta acción no se puede deshacer.`,
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
                this._fleetService.deleteAircraft(aircraft.id).subscribe({
                    next: () => {
                        this._notificationService.success(`Aeronave ${aircraft.registration} eliminada correctamente`);
                        this.loadData();
                    },
                    error: (error) => {
                        this._notificationService.error('Error al eliminar la aeronave');
                        console.error('Error deleting aircraft:', error);
                    },
                });
            }
        });
    }
}
