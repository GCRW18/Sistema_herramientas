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

    <div class="flex flex-col overflow-hidden">

        <!-- ── HEADER ─────────────────────────────────────────────────────── -->
        <div class="bg-[#0F172A] px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded bg-[#FF1414] flex items-center justify-center shrink-0">
                    <mat-icon class="text-white !text-xl">warning</mat-icon>
                </div>
                <div>
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-[0.18em] leading-none mb-0.5">Calibración</p>
                    <h2 class="text-sm text-white font-black uppercase tracking-tight leading-none">Alertas de Calibración</h2>
                </div>
            </div>
            <button (click)="close()"
                    class="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors shrink-0">
                <mat-icon class="text-white !text-xl">close</mat-icon>
            </button>
        </div>

        <!-- ── KPI CHIPS ───────────────────────────────────────────────────── -->
        <div class="bg-stone-100 px-4 py-3 border-b border-stone-300 shrink-0">
            <div class="grid grid-cols-3 gap-2">

                <div class="flex flex-col items-center bg-white rounded-lg px-3 py-2.5 border border-stone-200">
                    <span class="text-2xl font-black text-[#FF1414] leading-none">{{ data.expiredCount }}</span>
                    <span class="text-[9px] font-bold text-stone-400 uppercase tracking-wider mt-1">Vencidas</span>
                </div>

                <div class="flex flex-col items-center bg-white rounded-lg px-3 py-2.5 border border-stone-200">
                    <span class="text-2xl font-black text-orange-500 leading-none">{{ data.critical7dCount }}</span>
                    <span class="text-[9px] font-bold text-stone-400 uppercase tracking-wider mt-1">Críticas 7d</span>
                </div>

                <div class="flex flex-col items-center bg-white rounded-lg px-3 py-2.5 border border-stone-200">
                    <span class="text-2xl font-black text-amber-500 leading-none">{{ data.urgent15dCount }}</span>
                    <span class="text-[9px] font-bold text-stone-400 uppercase tracking-wider mt-1">Urgentes 15d</span>
                </div>

            </div>
        </div>

        <!-- ── LISTA ───────────────────────────────────────────────────────── -->
        <div class="overflow-y-auto bg-stone-100" style="max-height: 320px;">
            <div class="px-4 py-3 flex flex-col gap-2">

                <div *ngFor="let alert of data.alerts"
                     class="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border border-stone-200 hover:border-stone-300 transition-colors">

                    <!-- Dot urgencia -->
                    <div class="w-2 h-2 rounded-full shrink-0"
                         [ngClass]="alert.days_remaining <= 0 ? 'bg-[#FF1414]' : alert.days_remaining <= 7 ? 'bg-orange-500' : 'bg-amber-400'">
                    </div>

                    <!-- Datos herramienta -->
                    <div class="flex-1 min-w-0">
                        <div class="text-xs font-bold text-stone-800 leading-tight truncate">{{ alert.tool_name }}</div>
                        <div class="text-[10px] text-stone-400 font-mono mt-0.5">{{ alert.tool_code }} · {{ alert.warehouse }}</div>
                    </div>

                    <!-- Badge urgencia + días -->
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded"
                              [ngClass]="getUrgencyClass(alert.urgency)">
                            {{ getUrgencyLabel(alert.urgency) }}
                        </span>
                        <div class="text-right">
                            <div class="text-xs font-black leading-tight"
                                 [ngClass]="alert.days_remaining <= 0 ? 'text-[#FF1414]' : alert.days_remaining <= 7 ? 'text-orange-500' : 'text-amber-500'">
                                {{ alert.days_remaining <= 0 ? 'VENCIDA' : alert.days_remaining + 'd' }}
                            </div>
                            <div class="text-[10px] text-stone-400 font-mono">{{ alert.calibration_expiry }}</div>
                        </div>
                    </div>

                </div>

                <!-- Empty state -->
                <div *ngIf="data.alerts.length === 0" class="py-10 flex flex-col items-center gap-2">
                    <mat-icon class="!text-4xl text-stone-300">check_circle</mat-icon>
                    <p class="text-sm font-bold text-stone-400">Sin alertas críticas</p>
                </div>

            </div>
        </div>

        <!-- ── FOOTER ──────────────────────────────────────────────────────── -->
        <div class="border-t border-stone-300 bg-stone-100 px-4 py-3 flex items-center justify-between gap-3 shrink-0">

            <button (click)="close()"
                    class="h-8 px-4 rounded text-sm font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-200 transition-all">
                Cerrar
            </button>

            <button (click)="viewAll()"
                    class="h-8 px-4 bg-[#0F172A] text-white rounded text-sm font-semibold hover:bg-slate-700 transition-colors flex items-center gap-1.5">
                <mat-icon class="!text-sm">open_in_new</mat-icon>
                Ver calibraciones
            </button>

        </div>

    </div>
    `,
    styles: [`
        :host { display: flex; flex-direction: column; overflow: hidden; }
    `]
})
export class CalibrationAlertDialogComponent {

    constructor(
        public dialogRef: MatDialogRef<CalibrationAlertDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: CalibrationAlertDialogData,
        private router: Router
    ) {}

    getUrgencyClass(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED':     return 'bg-red-50 text-[#FF1414]';
            case 'CRITICAL_7D': return 'bg-orange-50 text-orange-600';
            case 'URGENT_15D':  return 'bg-amber-50 text-amber-600';
            default:            return 'bg-stone-100 text-stone-500';
        }
    }

    getUrgencyLabel(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED':     return 'Vencida';
            case 'CRITICAL_7D': return '7 días';
            case 'URGENT_15D':  return '15 días';
            default:            return urgency;
        }
    }

    viewAll(): void {
        this.dialogRef.close();
        this.router.navigate(['/calibraciones']);
    }

    close(): void {
        this.dialogRef.close();
    }
}
