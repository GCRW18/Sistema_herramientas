import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { ToolService, CalibrationService, QuarantineService } from 'app/core/services';
import { forkJoin } from 'rxjs';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        RouterLink,
    ],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
    private _toolService = inject(ToolService);
    private _calibrationService = inject(CalibrationService);
    private _quarantineService = inject(QuarantineService);

    // Statistics
    stats = {
        totalTools: 0,
        availableTools: 0,
        toolsInUse: 0,
        toolsInCalibration: 0,
        toolsInQuarantine: 0,
        decommissionedTools: 0,
        calibrationExpired: 0,
        criticalAlerts: 0,
    };

    loading = true;

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    ngOnInit(): void {
        this.loadDashboardData();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Load dashboard data
     */
    loadDashboardData(): void {
        this.loading = true;

        forkJoin({
            summary: this._toolService.getInventorySummary(),
            alerts: this._calibrationService.getCriticalAlerts(),
            quarantines: this._quarantineService.getActiveQuarantines()
        }).subscribe({
            next: ({ summary, alerts, quarantines }) => {
                this.stats.totalTools = summary.total || 0;
                this.stats.availableTools = summary.available || 0;
                this.stats.toolsInUse = summary.inUse || 0;
                this.stats.toolsInCalibration = summary.inCalibration || 0;
                this.stats.criticalAlerts = alerts.length;
                this.stats.calibrationExpired = alerts.filter((a) => a.isExpired).length;
                this.stats.toolsInQuarantine = quarantines.length;
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading dashboard data:', error);
                this.loading = false;
            }
        });
    }

    /**
     * Refresh dashboard
     */
    refresh(): void {
        this.loadDashboardData();
    }
}
