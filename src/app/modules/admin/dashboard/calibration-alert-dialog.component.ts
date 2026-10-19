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
import { MatTooltipModule } from '@angular/material/tooltip';

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
    imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
    template: `

    <div class="flex flex-col overflow-hidden max-h-[90dvh]">

        <!-- ── CABECERA ─────────────────────────────────────────────────── -->
        <div class="bg-[#0F172A] px-5 py-4 flex items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 flex items-center justify-center bg-[#FF1414] border-2 border-black rounded-lg shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <mat-icon class="text-white !text-xl">warning</mat-icon>
                </div>
                <div>
                    <p class="text-[9px] text-amber-400 font-black uppercase tracking-[0.18em] leading-none mb-1">Calibración</p>
                    <h2 class="text-sm text-white font-black uppercase tracking-tight leading-none">Alertas de Calibración</h2>
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button (click)="viewAll()" matTooltip="Ver Calibraciones"
                        class="h-8 px-3 flex items-center gap-1.5 border-2 border-black rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-[10px] font-black uppercase transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-px hover:translate-y-px">
                    <mat-icon class="!text-base">open_in_new</mat-icon>
                    Ver
                </button>
                <button (click)="close()"
                        class="w-8 h-8 flex items-center justify-center border-2 border-white/30 rounded-lg hover:bg-white/10 hover:border-white/60 transition-colors shrink-0">
                    <mat-icon class="text-white !text-lg">close</mat-icon>
                </button>
            </div>
        </div>

        <!-- ── CHIPS KPI ──────────────────────────────────────────────────── -->
        <div class="bg-stone-100 dark:bg-slate-900 px-4 py-3 border-b-2 border-black shrink-0">
            <div class="grid grid-cols-3 gap-2.5">

                <div class="flex flex-col items-center bg-white dark:bg-slate-700 rounded-lg px-3 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <span class="text-2xl font-black text-[#FF1414] leading-none">{{ data.expiredCount }}</span>
                    <span class="text-[9px] font-black text-stone-400 dark:text-slate-400 uppercase tracking-wider mt-1">Vencidas</span>
                </div>

                <div class="flex flex-col items-center bg-white dark:bg-slate-700 rounded-lg px-3 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <span class="text-2xl font-black text-orange-500 leading-none">{{ data.critical7dCount }}</span>
                    <span class="text-[9px] font-black text-stone-400 dark:text-slate-400 uppercase tracking-wider mt-1">Críticas 7d</span>
                </div>

                <div class="flex flex-col items-center bg-white dark:bg-slate-700 rounded-lg px-3 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <span class="text-2xl font-black text-amber-500 leading-none">{{ data.urgent15dCount }}</span>
                    <span class="text-[9px] font-black text-stone-400 dark:text-slate-400 uppercase tracking-wider mt-1">Urgentes 15d</span>
                </div>

            </div>
        </div>

        <!-- ── LISTA ───────────────────────────────────────────────────────── -->
        <div class="flex-1 min-h-0 overflow-y-auto bg-stone-100 dark:bg-slate-900" style="max-height: 320px;">
            <div class="px-4 py-3 flex flex-col gap-2.5">

                <div *ngFor="let alert of data.alerts"
                     class="flex items-center gap-3 bg-white dark:bg-slate-700 rounded-lg px-3 py-2.5 border-2 border-l-[6px] border-black hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)] transition-all"
                     [ngClass]="alert.days_remaining <= 0 ? 'border-l-red-600' : alert.days_remaining <= 7 ? 'border-l-orange-500' : 'border-l-amber-400'">

                    <!-- Datos herramienta -->
                    <div class="flex-1 min-w-0">
                        <div class="text-xs font-black uppercase text-black dark:text-white leading-tight truncate">{{ alert.tool_name }}</div>
                        <div class="text-[10px] text-stone-400 dark:text-slate-400 font-mono font-bold mt-0.5">{{ alert.tool_code }} · {{ alert.warehouse }}</div>
                    </div>

                    <!-- Insignia urgencia + días -->
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-black"
                              [ngClass]="getUrgencyClass(alert.urgency)">
                            {{ getUrgencyLabel(alert.urgency) }}
                        </span>
                        <div class="text-right">
                            <div class="text-xs font-black leading-tight"
                                 [ngClass]="alert.days_remaining <= 0 ? 'text-[#FF1414]' : alert.days_remaining <= 7 ? 'text-orange-500' : 'text-amber-500'">
                                {{ alert.days_remaining <= 0 ? 'VENCIDA' : alert.days_remaining + 'd' }}
                            </div>
                            <div class="text-[10px] text-stone-400 dark:text-slate-400 font-mono font-bold">{{ alert.calibration_expiry }}</div>
                        </div>
                    </div>

                </div>

                <!-- Estado vacío -->
                <div *ngIf="data.alerts.length === 0" class="py-10 flex flex-col items-center gap-2">
                    <div class="w-12 h-12 rounded-full border-2 border-black bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <mat-icon class="!text-2xl text-green-600 dark:text-green-400">check_circle</mat-icon>
                    </div>
                    <p class="text-xs font-black uppercase text-stone-500 dark:text-slate-400">Sin alertas críticas</p>
                </div>

            </div>
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
            case 'EXPIRED':     return 'bg-red-600 text-white';
            case 'CRITICAL_7D': return 'bg-orange-500 text-white';
            case 'URGENT_15D':  return 'bg-amber-400 text-black';
            default:            return 'bg-stone-200 text-stone-700';
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
        this.router.navigate(['/calibraciones'], { queryParams: { tab: 'alertas' } });
    }

    close(): void {
        this.dialogRef.close();
    }
}
