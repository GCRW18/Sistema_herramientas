import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
    MatDialogRef,
    MAT_DIALOG_DATA,
    MatDialogModule
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface CalibrationAlertDialogData {
    alerts: {
        tool_code: string;
        tool_name: string;
        calibration_expiry: string;
        days_remaining: number;
        urgency: string;
        warehouse: string;
    }[];
    expiredCount: number;
    critical7dCount: number;
    urgent15dCount: number;
}

@Component({
    selector: 'app-calibration-alert-dialog',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
    template: `
        <!-- Header -->
        <div style="
            background: #111A43;
            padding: 18px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid black;
        ">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="
                    background: #ff6b00;
                    border: 2px solid rgba(255,255,255,0.4);
                    border-radius: 50%;
                    width: 40px; height: 40px;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                ">
                    <mat-icon style="color: white; font-size: 22px; width:22px; height:22px; line-height:22px;">warning</mat-icon>
                </div>
                <div>
                    <h2 style="color: white; font-weight: 900; font-size: 17px; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.2;">
                        Alertas de Calibración
                    </h2>
                    <p style="color: #94a3b8; font-size: 12px; margin: 2px 0 0; font-weight: 700;">
                        Herramientas con calibración próxima a vencer o vencida
                    </p>
                </div>
            </div>
            <button (click)="close()" style="
                background: rgba(255,255,255,0.08);
                border: 2px solid rgba(255,255,255,0.25);
                border-radius: 8px;
                color: white;
                width: 36px; height: 36px;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
            ">
                <mat-icon style="font-size: 20px; width:20px; height:20px; line-height:20px;">close</mat-icon>
            </button>
        </div>

        <!-- Summary Cards -->
        <div style="
            padding: 14px 24px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            background: #f8fafc;
            border-bottom: 2px solid black;
        ">
            <div style="background: #fef2f2; border: 2px solid black; border-radius: 10px; padding: 10px 12px; text-align: center; box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);">
                <div style="font-size: 26px; font-weight: 900; color: #dc2626; line-height: 1;">{{ data.expiredCount }}</div>
                <div style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #ef4444; margin-top: 2px; letter-spacing: 0.05em;">VENCIDAS</div>
            </div>
            <div style="background: #fff7ed; border: 2px solid black; border-radius: 10px; padding: 10px 12px; text-align: center; box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);">
                <div style="font-size: 26px; font-weight: 900; color: #ea580c; line-height: 1;">{{ data.critical7dCount }}</div>
                <div style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #f97316; margin-top: 2px; letter-spacing: 0.05em;">CRÍTICAS 7D</div>
            </div>
            <div style="background: #fefce8; border: 2px solid black; border-radius: 10px; padding: 10px 12px; text-align: center; box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);">
                <div style="font-size: 26px; font-weight: 900; color: #ca8a04; line-height: 1;">{{ data.urgent15dCount }}</div>
                <div style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #eab308; margin-top: 2px; letter-spacing: 0.05em;">URGENTES 15D</div>
            </div>
        </div>

        <!-- Alerts List -->
        <div style="max-height: 300px; overflow-y: auto; background: white;">
            <div *ngFor="let alert of data.alerts; let last = last" style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 11px 24px;
            " [style.border-bottom]="last ? 'none' : '1px solid #e5e7eb'">

                <span style="
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 5px;
                    font-size: 9px;
                    font-weight: 900;
                    border: 1.5px solid black;
                    text-transform: uppercase;
                    white-space: nowrap;
                    min-width: 72px;
                    text-align: center;
                    letter-spacing: 0.03em;
                " [ngStyle]="getUrgencyStyle(alert.urgency)">
                    {{ getUrgencyLabel(alert.urgency) }}
                </span>

                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 900; font-size: 13px; color: black; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">
                        {{ alert.tool_name }}
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: #6b7280; font-family: monospace; margin-top: 1px;">
                        {{ alert.tool_code }}&nbsp;·&nbsp;{{ alert.warehouse }}
                    </div>
                </div>

                <div style="text-align: right; flex-shrink: 0;">
                    <div style="font-size: 12px; font-weight: 900; font-family: monospace; line-height: 1.3;"
                         [style.color]="alert.days_remaining <= 0 ? '#dc2626' : alert.days_remaining <= 7 ? '#ea580c' : '#ca8a04'">
                        {{ alert.days_remaining <= 0 ? 'VENCIDA' : alert.days_remaining + 'días' }}
                    </div>
                    <div style="font-size: 10px; color: #9ca3af; font-family: monospace; margin-top: 1px;">
                        {{ alert.calibration_expiry }}
                    </div>
                </div>
            </div>

            <div *ngIf="data.alerts.length === 0" style="padding: 32px; text-align: center; color: #9ca3af;">
                <mat-icon style="font-size: 40px; width:40px; height:40px; line-height:40px; opacity: 0.4; color: #22c55e;">check_circle</mat-icon>
                <p style="font-weight: 900; font-size: 12px; text-transform: uppercase; margin-top: 8px;">Sin alertas críticas</p>
            </div>
        </div>

        <!-- Footer Actions -->
        <div style="
            padding: 14px 24px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            border-top: 2px solid black;
            background: #f8fafc;
        ">
            <button (click)="close()" style="
                padding: 9px 18px;
                background: white;
                border: 2px solid black;
                border-radius: 8px;
                font-weight: 900;
                font-size: 12px;
                cursor: pointer;
                box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                transition: all 0.15s;
            " onmousedown="this.style.boxShadow='1px 1px 0px 0px rgba(0,0,0,1)'; this.style.transform='translate(2px,2px)'"
               onmouseup="this.style.boxShadow='3px 3px 0px 0px rgba(0,0,0,1)'; this.style.transform=''"
               onmouseleave="this.style.boxShadow='3px 3px 0px 0px rgba(0,0,0,1)'; this.style.transform=''">
                Cerrar
            </button>
            <button (click)="viewAll()" style="
                padding: 9px 18px;
                background: #111A43;
                color: white;
                border: 2px solid black;
                border-radius: 8px;
                font-weight: 900;
                font-size: 12px;
                cursor: pointer;
                box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                transition: all 0.15s;
                display: flex;
                align-items: center;
                gap: 6px;
            " onmousedown="this.style.boxShadow='1px 1px 0px 0px rgba(0,0,0,1)'; this.style.transform='translate(2px,2px)'"
               onmouseup="this.style.boxShadow='3px 3px 0px 0px rgba(0,0,0,1)'; this.style.transform=''"
               onmouseleave="this.style.boxShadow='3px 3px 0px 0px rgba(0,0,0,1)'; this.style.transform=''">
                <mat-icon style="font-size: 16px; width:16px; height:16px; line-height:16px;">open_in_new</mat-icon>
                Ver todas las alertas
            </button>
        </div>
    `
})
export class CalibrationAlertDialogComponent {

    constructor(
        public dialogRef: MatDialogRef<CalibrationAlertDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: CalibrationAlertDialogData,
        private router: Router
    ) {}

    getUrgencyStyle(urgency: string): Record<string, string> {
        switch (urgency) {
            case 'EXPIRED':     return { background: '#ef4444', color: 'white' };
            case 'CRITICAL_7D': return { background: '#f97316', color: 'white' };
            case 'URGENT_15D':  return { background: '#eab308', color: 'black' };
            default:            return { background: '#e5e7eb', color: 'black' };
        }
    }

    getUrgencyLabel(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED':     return 'VENCIDA';
            case 'CRITICAL_7D': return 'CRÍTICA 7D';
            case 'URGENT_15D':  return 'URGENTE 15D';
            default:            return urgency;
        }
    }

    viewAll(): void {
        this.dialogRef.close();
        this.router.navigate(['/calibraciones/alertas']);
    }

    close(): void {
        this.dialogRef.close();
    }
}
