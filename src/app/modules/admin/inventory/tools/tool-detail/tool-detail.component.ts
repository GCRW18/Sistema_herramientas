import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { ToolService, MovementService, CalibrationService } from 'app/core/services';
import { Tool, Movement, CalibrationRecord } from 'app/core/models';

@Component({
    selector: 'app-tool-detail',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTabsModule,
        MatTableModule,
        MatChipsModule,
    ],
    templateUrl: './tool-detail.component.html',
    styleUrl: './tool-detail.component.scss'
})
export default class ToolDetailComponent implements OnInit {
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _toolService = inject(ToolService);
    private _movementService = inject(MovementService);
    private _calibrationService = inject(CalibrationService);

    tool: Tool | null = null;
    movements: Movement[] = [];
    calibrations: CalibrationRecord[] = [];
    loading = false;

    movementColumns: string[] = ['date', 'type', 'responsiblePerson', 'notes'];
    calibrationColumns: string[] = ['date', 'type', 'provider', 'nextDate', 'certificate'];

    ngOnInit(): void {
        const toolId = this._route.snapshot.paramMap.get('id');
        if (toolId) {
            this.loadTool(toolId);
            this.loadMovements(toolId);
            this.loadCalibrations(toolId);
        }
    }

    loadTool(id: string): void {
        this.loading = true;
        this._toolService.getToolById(id).subscribe({
            next: (tool) => {
                this.tool = tool;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this._router.navigate(['/inventory/tools']);
            },
        });
    }

    loadMovements(toolId: string): void {
        this._movementService.getMovementsByTool(toolId).subscribe({
            next: (movements) => {
                this.movements = movements;
            },
        });
    }

    loadCalibrations(toolId: string): void {
        this._calibrationService.getToolCalibrationHistory(toolId).subscribe({
            next: (calibrations) => {
                this.calibrations = calibrations;
            },
        });
    }

    edit(): void {
        if (this.tool) {
            this._router.navigate(['/inventory/tools/edit', this.tool.id]);
        }
    }

    back(): void {
        this._router.navigate(['/inventory/tools']);
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            available: 'primary',
            in_use: 'accent',
            in_calibration: 'warn',
            in_maintenance: 'warn',
            quarantine: '',
            decommissioned: '',
        };
        return colors[status] || '';
    }

    getConditionColor(condition: string): string {
        const colors: Record<string, string> = {
            new: 'primary',
            excellent: 'primary',
            good: 'accent',
            fair: 'warn',
            poor: 'warn',
            damaged: '',
        };
        return colors[condition] || '';
    }

    getMovementTypeLabel(type: string): string {
        const labels: Record<string, string> = {
            entry_purchase: 'Entrada por Compra',
            entry_return: 'Entrada por Devolución',
            entry_adjustment: 'Ajuste de Entrada',
            exit_loan: 'Salida por Préstamo',
            exit_sale: 'Salida por Venta',
            exit_calibration: 'Envío a Calibración',
            exit_maintenance: 'Envío a Mantenimiento',
            transfer: 'Traspaso',
        };
        return labels[type] || type;
    }
}
