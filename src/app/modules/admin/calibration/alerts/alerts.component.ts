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
import { CalibrationAlert } from 'app/core/models';

@Component({
    selector: 'app-alerts',
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
    templateUrl: './alerts.component.html',
    styleUrl: './alerts.component.scss'
})
export default class AlertsComponent implements OnInit {
    private _router = inject(Router);
    private _calibrationService = inject(CalibrationService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['toolCode', 'toolName', 'nextDate', 'daysUntil', 'severity', 'actions'];
    dataSource = new MatTableDataSource<CalibrationAlert>();
    loading = false;

    ngOnInit(): void {
        this.loadAlerts();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadAlerts(): void {
        this.loading = true;
        this._calibrationService.getCalibrationAlerts().subscribe({
            next: (alerts) => {
                this.dataSource.data = alerts;
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

    sendToCalibration(toolId: string): void {
        this._router.navigate(['/calibration/send'], { queryParams: { toolId } });
    }

    viewTool(toolId: string): void {
        this._router.navigate(['/inventory/tools', toolId]);
    }

    getAlertColor(severity: string): string {
        const colors: Record<string, string> = {
            critical: '',
            warning: 'warn',
            info: 'accent',
        };
        return colors[severity] || '';
    }

    getAlertLabel(severity: string): string {
        const labels: Record<string, string> = {
            critical: 'Crítico',
            warning: 'Advertencia',
            info: 'Información',
        };
        return labels[severity] || severity;
    }
}
