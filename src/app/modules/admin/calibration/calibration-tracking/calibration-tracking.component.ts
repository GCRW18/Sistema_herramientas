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
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CalibrationService } from 'app/core/services';
import { CalibrationRecord } from 'app/core/models';

@Component({
    selector: 'app-calibration-tracking',
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
    ],
    templateUrl: './calibration-tracking.component.html',
    styleUrl: './calibration-tracking.component.scss'
})
export default class CalibrationTrackingComponent implements OnInit {
    private _router = inject(Router);
    private _calibrationService = inject(CalibrationService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['toolCode', 'toolName', 'provider', 'sendDate', 'estimatedReturn', 'status', 'actions'];
    dataSource = new MatTableDataSource<CalibrationRecord>();
    loading = false;

    ngOnInit(): void {
        this.loadCalibrations();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadCalibrations(): void {
        this.loading = true;
        this._calibrationService.getActiveCalibrations().subscribe({
            next: (calibrations) => {
                this.dataSource.data = calibrations;
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

    sendCalibration(): void {
        this._router.navigate(['/calibration/send']);
    }

    receiveCalibration(id: string): void {
        this._router.navigate(['/calibration/receive', id]);
    }

    viewDetail(id: string): void {
        this._router.navigate(['/calibration', id]);
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            sent: 'accent',
            in_process: 'warn',
            completed: 'primary',
            delayed: '',
        };
        return colors[status] || '';
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            sent: 'Enviado',
            in_process: 'En Proceso',
            completed: 'Completado',
            delayed: 'Retrasado',
        };
        return labels[status] || status;
    }
}
