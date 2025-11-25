import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { CalibrationService } from 'app/core/services';
import { Calibration } from 'app/core/models';

@Component({
    selector: 'app-calibration-detail',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatChipsModule,
        MatTabsModule,
        MatDividerModule,
    ],
    templateUrl: './calibration-detail.component.html',
    styleUrl: './calibration-detail.component.scss'
})
export default class CalibrationDetailComponent implements OnInit {
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _calibrationService = inject(CalibrationService);

    calibration: Calibration | null = null;
    loading = false;

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('id');
        if (id) {
            this.loadCalibration(id);
        }
    }

    loadCalibration(id: string): void {
        this.loading = true;
        this._calibrationService.getCalibrationById(id).subscribe({
            next: (calibration) => {
                this.calibration = calibration;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this._router.navigate(['/calibration']);
            },
        });
    }

    goBack(): void {
        this._router.navigate(['/calibration/tracking']);
    }

    downloadCertificate(): void {
        if (this.calibration?.certificateFile) {
            window.open(this.calibration.certificateFile, '_blank');
        }
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            scheduled: 'Programada',
            in_progress: 'En Progreso',
            completed: 'Completada',
            failed: 'Fallida',
            cancelled: 'Cancelada',
        };
        return labels[status] || status;
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            scheduled: 'accent',
            in_progress: 'primary',
            completed: 'primary',
            failed: 'warn',
            cancelled: '',
        };
        return colors[status] || '';
    }

    getResultLabel(result?: string): string {
        if (!result) return '-';
        const labels: Record<string, string> = {
            passed: 'Aprobado',
            failed: 'Rechazado',
            conditional: 'Condicional',
        };
        return labels[result] || result;
    }

    getResultColor(result?: string): string {
        if (!result) return '';
        const colors: Record<string, string> = {
            passed: 'primary',
            failed: 'warn',
            conditional: 'accent',
        };
        return colors[result] || '';
    }
}
