import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { ToolService, CalibrationService, QuarantineService } from 'app/core/services';
import { forkJoin } from 'rxjs';
import { DashboardService } from './dashboard.service';

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
    private _dashboardService = inject(DashboardService);

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
        toolsRequireCalibration: 0
    };

    loading = true;

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    ngOnInit(): void {
        // Ejemplo: Obtener lista de herramientas
        this._dashboardService.getTools().subscribe((data: any) => {
            console.log('Lista de herramientas:', data);
        });

        this.loadDashboardData();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Load dashboard data - ACTUALIZADO
     */
    loadDashboardData(): void {
        this.loading = true;

        forkJoin({
            // Usamos los métodos del DashboardService para las funciones de herramientas
            inventorySummary: this._dashboardService.getInventorySummary(),
            toolsExpiredCalibration: this._dashboardService.getToolsExpiredCalibration(),
            toolsRequireCalibration: this._dashboardService.getToolsRequireCalibration(),
            // Mantenemos los otros servicios para sus funciones específicas
            alerts: this._calibrationService.getCriticalAlerts(),
            quarantines: this._quarantineService.getActiveQuarantines()
        }).subscribe({
            next: ({
                       inventorySummary,
                       toolsExpiredCalibration,
                       toolsRequireCalibration,
                       alerts,
                       quarantines
                   }) => {
                // Asignamos los datos del resumen de inventario
                this.stats.totalTools = inventorySummary?.total || 0;
                this.stats.availableTools = inventorySummary?.available || 0;
                this.stats.toolsInUse = inventorySummary?.inUse || 0;
                this.stats.toolsInCalibration = inventorySummary?.inCalibration || 0;
                this.stats.decommissionedTools = inventorySummary?.decommissioned || 0;

                // Asignamos datos específicos de calibración
                this.stats.calibrationExpired = toolsExpiredCalibration?.length || 0;
                this.stats.toolsRequireCalibration = toolsRequireCalibration?.length || 0;

                // Mantenemos los datos de otros servicios
                this.stats.criticalAlerts = alerts?.length || 0;
                this.stats.toolsInQuarantine = quarantines?.length || 0;

                this.loading = false;

                console.log('Dashboard data loaded successfully:', this.stats);
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

    /**
     * Search tools by text
     */
    searchTools(searchText: string): void {
        if (searchText && searchText.length >= 2) {
            this._dashboardService.searchToolsByText(searchText).subscribe({
                next: (tools) => {
                    console.log('Herramientas encontradas:', tools);
                    // Aquí puedes manejar los resultados de búsqueda
                    // Por ejemplo, mostrarlos en una lista o modal
                },
                error: (error) => {
                    console.error('Error searching tools:', error);
                }
            });
        }
    }

    /**
     * Get tool by code
     */
    getToolByCode(code: string): void {
        if (code) {
            this._dashboardService.getToolByCode(code).subscribe({
                next: (tool) => {
                    console.log('Herramienta encontrada:', tool);
                    // Aquí puedes manejar la herramienta encontrada
                },
                error: (error) => {
                    console.error('Error getting tool by code:', error);
                }
            });
        }
    }
}
