import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MaintenanceService } from 'app/core/services/maintenance.service';
import { Maintenance } from 'app/core/models/maintenance.types';
import { MaintenanceDialogComponent, MaintenanceDialogData } from './maintenance-dialog/maintenance-dialog.component';

@Component({
    selector: 'app-maintenance',
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
        MatSelectModule,
        MatChipsModule,
        MatTooltipModule,
    ],
    templateUrl: './maintenance.component.html',
    styleUrl: './maintenance.component.scss'
})
export default class MaintenanceComponent implements OnInit {
    private _router = inject(Router);
    private _maintenanceService = inject(MaintenanceService);
    private _dialog = inject(MatDialog);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['toolCode', 'toolName', 'type', 'scheduledDate', 'status', 'technician', 'actions'];
    dataSource = new MatTableDataSource<Maintenance>();
    loading = false;

    filterStatus = '';
    filterType = '';

    statusOptions = [
        { value: '', label: 'Todos' },
        { value: 'scheduled', label: 'Programado' },
        { value: 'in_progress', label: 'En Progreso' },
        { value: 'completed', label: 'Completado' },
        { value: 'cancelled', label: 'Cancelado' },
    ];

    typeOptions = [
        { value: '', label: 'Todos' },
        { value: 'preventive', label: 'Preventivo' },
        { value: 'corrective', label: 'Correctivo' },
        { value: 'predictive', label: 'Predictivo' },
    ];

    ngOnInit(): void {
        this.loadMaintenance();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadMaintenance(): void {
        this.loading = true;
        this._maintenanceService.getMaintenances().subscribe({
            next: (maintenances) => {
                this.dataSource.data = maintenances;
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading maintenance records:', error);
                this.loading = false;
            }
        });
    }

    applyFilter(event: Event): void {
        const filterValue = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }

    applyStatusFilter(): void {
        this.applyFilters();
    }

    applyTypeFilter(): void {
        this.applyFilters();
    }

    applyFilters(): void {
        this.dataSource.filterPredicate = (data: Maintenance, filter: string) => {
            const matchesStatus = !this.filterStatus || data.status === this.filterStatus;
            const matchesType = !this.filterType || data.type === this.filterType;
            const matchesSearch = !filter ||
                data.toolCode.toLowerCase().includes(filter) ||
                data.toolName.toLowerCase().includes(filter) ||
                (data.technician && data.technician.toLowerCase().includes(filter));

            return matchesStatus && matchesType && matchesSearch;
        };
        this.dataSource.filter = Math.random().toString(); // Trigger filter
    }

    viewDetail(id: string): void {
        this._maintenanceService.getMaintenanceById(id).subscribe({
            next: (maintenance) => {
                const dialogRef = this._dialog.open(MaintenanceDialogComponent, {
                    width: '800px',
                    maxHeight: '90vh',
                    data: { maintenance, mode: 'edit' } as MaintenanceDialogData,
                    disableClose: true
                });

                dialogRef.afterClosed().subscribe(result => {
                    if (result) {
                        this._maintenanceService.updateMaintenance(id, result).subscribe({
                            next: () => this.loadMaintenance(),
                            error: (error) => console.error('Error updating maintenance:', error)
                        });
                    }
                });
            },
            error: (error) => console.error('Error loading maintenance:', error)
        });
    }

    newMaintenance(): void {
        const dialogRef = this._dialog.open(MaintenanceDialogComponent, {
            width: '800px',
            maxHeight: '90vh',
            data: { mode: 'create' } as MaintenanceDialogData,
            disableClose: true
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this._maintenanceService.createMaintenance(result).subscribe({
                    next: () => this.loadMaintenance(),
                    error: (error) => console.error('Error creating maintenance:', error)
                });
            }
        });
    }

    getTypeLabel(type: string): string {
        const labels: Record<string, string> = {
            preventive: 'Preventivo',
            corrective: 'Correctivo',
            predictive: 'Predictivo',
        };
        return labels[type] || type;
    }

    getTypeColor(type: string): string {
        const colors: Record<string, string> = {
            preventive: 'primary',
            corrective: 'warn',
            predictive: 'accent',
        };
        return colors[type] || '';
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            scheduled: 'Programado',
            in_progress: 'En Progreso',
            completed: 'Completado',
            cancelled: 'Cancelado',
        };
        return labels[status] || status;
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            scheduled: 'accent',
            in_progress: 'primary',
            completed: 'primary',
            cancelled: '',
        };
        return colors[status] || '';
    }

    deleteMaintenance(id: string): void {
        if (confirm('¿Está seguro de eliminar este mantenimiento?')) {
            this._maintenanceService.deleteMaintenance(id).subscribe({
                next: () => {
                    console.log('Mantenimiento eliminado exitosamente');
                    this.loadMaintenance();
                },
                error: (error) => console.error('Error deleting maintenance:', error)
            });
        }
    }
}
