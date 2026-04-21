import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { forkJoin } from 'rxjs';
import { ToolService } from 'app/core/services/tool.service';
import { MovementService } from 'app/core/services/movement.service';
import { CalibrationService } from 'app/core/services/calibration.service';
import {
    CalibrationAlertDialogComponent,
    CalibrationAlertDialogData
} from './calibration-alert-dialog.component';

Chart.register(...registerables);

interface KPI {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
    variant: 'info' | 'success' | 'warning' | 'danger' | 'default';
    trend?: { value: number, isPositive: boolean };
}

interface Alert {
    id: string;
    type: 'critical' | 'warning' | 'error' | 'info';
    title: string;
    description: string;
    time: string;
    icon: string;
    route?: string;
}

interface Activity {
    id: string;
    type: string;
    title: string;
    description: string;
    user: string;
    time: string;
}

interface QuickAction {
    icon: string;
    label: string;
    description: string;
    variant: string;
    route: string;
}

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatDialogModule
    ],
    templateUrl: './dashboard.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        .neo-card-base {
            background-color: white;
            border: 3px solid black;
            border-radius: 12px;
            box-shadow: 6px 6px 0px 0px rgba(0, 0, 0, 1);
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
            position: relative;
            overflow: hidden;
        }

        .neo-card-base:hover {
            transform: translate(-2px, -2px);
            box-shadow: 8px 8px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .neo-card-base:hover {
            box-shadow: 8px 8px 0px 0px rgb(9, 16, 55);
        }

        .neo-card-base:active {
            transform: translate(2px, 2px);
            box-shadow: 2px 2px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .neo-card-base:active {
            box-shadow: 2px 2px 0px 0px rgb(0, 0, 0);
        }

        .variant-info    { background-color: #203f77; color: #fffefe; }
        .variant-success { background-color: #05f65d; color: black; }
        .variant-warning { background-color: #ffcc00; color: black; }
        .variant-danger  { background-color: #ff0000; color: #fbf7f7; }
        .variant-default { background-color: #0069ff; color: #f4efef; }

        mat-icon { vertical-align: middle; }

        .overflow-y-auto::-webkit-scrollbar       { width: 8px; }
        .overflow-y-auto::-webkit-scrollbar-track  { background: #000000; }
        :host-context(.dark) .overflow-y-auto::-webkit-scrollbar-track { background: #000000; }
        .overflow-y-auto::-webkit-scrollbar-thumb  { background: #000; border-radius: 4px; }
        :host-context(.dark) .overflow-y-auto::-webkit-scrollbar-thumb { background: #000000; }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #000000; }
    `]
})
export class DashboardComponent implements OnInit, AfterViewInit {
    @ViewChild('movementsChart') movementsCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('topToolsChart') topToolsCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('calibrationChart') calibrationCanvas!: ElementRef<HTMLCanvasElement>;

    private router            = inject(Router);
    private toolService       = inject(ToolService);
    private movService        = inject(MovementService);
    private calibrationService = inject(CalibrationService);
    private _dialog           = inject(MatDialog);

    isLoading     = signal(true);
    currentPanel  = signal(0);

    readonly panelLabels = ['Indicadores', 'Gráficas', 'Actividad'];
    readonly TOTAL_PANELS = 3;

    prevPanel(): void {
        this.currentPanel.update(p => (p - 1 + this.TOTAL_PANELS) % this.TOTAL_PANELS);
    }

    nextPanel(): void {
        this.currentPanel.update(p => (p + 1) % this.TOTAL_PANELS);
    }

    goToPanel(index: number): void {
        this.currentPanel.set(index);
    }

    private movementsChartInstance?: Chart;
    private topToolsChartInstance?: Chart;
    private calibrationChartInstance?: Chart;

    // Datos calculados desde el backend
    private allTools: any[]     = [];
    private recentMovements: any[] = [];

    kpiCardsData    = signal<KPI[]>([]);
    alertsData      = signal<Alert[]>([]);
    activitiesData  = signal<Activity[]>([]);
    quickActionsData = signal<QuickAction[]>([]);

    ngOnInit(): void {
        this.quickActionsData.set([
            { icon: 'heroicons_outline:arrow-down-tray', label: 'Entrada',   description: 'Nueva',    variant: 'success', route: '/entradas' },
            { icon: 'heroicons_outline:arrow-up-tray',   label: 'Salida',    description: 'Préstamo', variant: 'info',    route: '/salidas' },
            { icon: 'heroicons_outline:wrench',           label: 'Calibrar',  description: 'Enviar',   variant: 'warning', route: '/salidas' },
            { icon: 'heroicons_outline:document-text',   label: 'Reportes',  description: 'Ver',      variant: 'default', route: '/reportes' }
        ]);

        // Revisar dashboard-alertas de calibración al cargar (una sola vez por sesión)
        setTimeout(() => this.checkCalibrationAlerts(), 1200);

        forkJoin({
            tools:     this.toolService.getTools(),
            movements: this.movService.getMovements({ limit: 500 })
        }).subscribe({
            next: ({ tools, movements }) => {
                this.allTools        = tools;
                this.recentMovements = movements;
                this.buildKPIs();
                this.buildActivities();
                this.isLoading.set(false);
                setTimeout(() => this.initCharts(), 100);
            },
            error: () => {
                this.buildKPIs();
                this.isLoading.set(false);
            }
        });
    }

    ngAfterViewInit(): void {}

    // ── KPIs ────────────────────────────────────────────────────────────────────
    private buildKPIs(): void {
        const tools      = this.allTools;
        const total      = tools.length;
        const available  = tools.filter(t => t.status === 'available').length;
        const inUse      = tools.filter(t => t.status === 'in_use').length;
        const inCalib    = tools.filter(t => t.status === 'in_calibration').length;
        const quarantine = tools.filter(t => t.status === 'quarantine').length;
        const decomm     = tools.filter(t => t.status === 'decommissioned').length;
        const pct        = total ? Math.round(available / total * 100) : 0;

        this.kpiCardsData.set([
            { title: 'Total Herramientas', value: total.toLocaleString(),     subtitle: 'INVENTARIO', icon: 'heroicons_outline:wrench-screwdriver', variant: 'info' },
            { title: 'Disponibles',         value: available.toLocaleString(), subtitle: `${pct}% TOTAL`, icon: 'heroicons_outline:check-circle',       variant: 'success', trend: { value: pct, isPositive: true } },
            { title: 'Alertas Críticas',    value: inCalib + quarantine,       subtitle: 'ATENCIÓN',   icon: 'heroicons_outline:exclamation-triangle', variant: 'danger' },
            { title: 'En Calibración',      value: inCalib,                    subtitle: 'EXTERNO',    icon: 'heroicons_outline:wrench',               variant: 'warning' },
            { title: 'Calib. Vencida',      value: 0,                          subtitle: 'BLOQUEADAS', icon: 'heroicons_outline:clock',                variant: 'danger' },
            { title: 'En Cuarentena',       value: quarantine,                 subtitle: 'REVISIÓN',   icon: 'heroicons_outline:shield-exclamation',   variant: 'warning' },
            { title: 'En Uso',              value: inUse.toLocaleString(),     subtitle: 'PRÉSTAMOS',  icon: 'heroicons_outline:arrow-path',           variant: 'info' },
            { title: 'Dados de Baja',       value: decomm.toLocaleString(),    subtitle: 'HISTÓRICO',  icon: 'heroicons_outline:trash',                variant: 'default' }
        ]);
    }

    // ── Actividades recientes ────────────────────────────────────────────────────
    private buildActivities(): void {
        const items = this.recentMovements.slice(0, 5).map((m: any, i: number) => ({
            id:          String(m.id_movement || i),
            type:        m.movement_type || m.type || 'movimiento',
            title:       m.movement_type_label || m.type || 'Movimiento',
            description: m.notes || m.description || m.tool_name || '',
            user:        m.created_by || m.user_name || 'Sistema',
            time:        m.date ? new Date(m.date).toLocaleDateString('es-BO') : ''
        }));
        this.activitiesData.set(items);
        this.alertsData.set([]);
    }

    // ── Gráficas ─────────────────────────────────────────────────────────────────
    private initCharts(): void {
        this.createMovementsChart();
        this.createTopToolsChart();
        this.createCalibrationChart();
    }

    private createMovementsChart(): void {
        const ctx = this.movementsCanvas?.nativeElement?.getContext('2d');
        if (!ctx) return;

        // Agrupar movimientos por mes (últimos 6)
        const now      = new Date();
        const labels   = [] as string[];
        const entradas = [] as number[];
        const salidas  = [] as number[];

        const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            labels.push(months[d.getMonth()]);
            const mes = d.getMonth();
            const anio = d.getFullYear();
            const movMes = this.recentMovements.filter((m: any) => {
                const md = new Date(m.date || m.created_at || '');
                return md.getMonth() === mes && md.getFullYear() === anio;
            });
            entradas.push(movMes.filter((m: any) => m.movement_type === 'entry' || m.type === 'entry').length);
            salidas.push(movMes.filter((m: any) => m.movement_type === 'exit' || m.type === 'exit' || m.movement_type === 'loan' || m.type === 'loan').length);
        }

        new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Entradas', data: entradas, borderColor: '#04f608', backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 3, tension: 0, fill: true },
                    { label: 'Salidas',  data: salidas,  borderColor: '#f40404', backgroundColor: 'rgba(239,68,68,0.1)',  borderWidth: 3, tension: 0, fill: true }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    private createTopToolsChart(): void {
        const ctx = this.topToolsCanvas?.nativeElement?.getContext('2d');
        if (!ctx) return;

        // Contar préstamos por herramienta desde movimientos reales
        const counts: Record<string, number> = {};
        this.recentMovements
            .filter((m: any) => m.movement_type === 'loan' || m.type === 'loan')
            .forEach((m: any) => {
                const name = m.tool_name || m.tool_code || String(m.tool_id || 'Sin nombre');
                counts[name] = (counts[name] || 0) + 1;
            });

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const labels = sorted.map(([n]) => n);
        const data   = sorted.map(([, v]) => v);
        const colors = ['#111A43','#fbae05','#fd0f02','#27C93F','#3B82F6','#8b5cf6','#ec4899','#06b6d4'];

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['Sin datos'],
                datasets: [{ label: 'Préstamos', data: data.length ? data : [0], backgroundColor: colors, borderWidth: 2, borderColor: '#000' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    private createCalibrationChart(): void {
        const ctx = this.calibrationCanvas?.nativeElement?.getContext('2d');
        if (!ctx) return;

        const tools     = this.allTools;
        const vigente   = tools.filter(t => t.status === 'available').length;
        const enCalib   = tools.filter(t => t.status === 'in_calibration').length;
        const vencida   = 0; // requiere campo calibration_expiry_date
        const porVencer = 0;

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Disponible', 'En Calibración', 'Vencida', 'Por Vencer'],
                datasets: [{ data: [vigente, enCalib, vencida, porVencer], backgroundColor: ['#01f825','#111A43','#f61206','#f8ab04'], borderColor: '#000', borderWidth: 2 }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // ── Alertas de calibración al login ──────────────────────────────────────────
    private checkCalibrationAlerts(): void {
        // Mostrar solo una vez por sesión de navegador
        if (sessionStorage.getItem('calib_alert_shown')) return;

        this.calibrationService.getCalibrationAlertsPxp({ limit: 100 }).subscribe({
            next: (alerts: any) => {
                const all: any[] = Array.isArray(alerts) ? alerts : (alerts?.data || []);
                const critical = all.filter(a =>
                    ['EXPIRED', 'CRITICAL_7D', 'URGENT_15D'].includes(a.urgency)
                );
                if (critical.length === 0) return;

                sessionStorage.setItem('calib_alert_shown', '1');

                const data: CalibrationAlertDialogData = {
                    alerts: critical.slice(0, 10).map(a => ({
                        tool_code:          a.tool_code   || a.codigo  || '',
                        tool_name:          a.tool_name   || a.nombre  || '',
                        calibration_expiry: this.formatAlertDate(a.next_calibration_date || a.calibration_expiry),
                        days_remaining:     a.days_remaining ?? 0,
                        urgency:            a.urgency || '',
                        warehouse:          a.warehouse   || a.almacen || 'CBB'
                    })),
                    expiredCount:    all.filter(a => a.urgency === 'EXPIRED').length,
                    critical7dCount: all.filter(a => a.urgency === 'CRITICAL_7D').length,
                    urgent15dCount:  all.filter(a => a.urgency === 'URGENT_15D').length
                };

                this._dialog.open(CalibrationAlertDialogComponent, {
                    data,
                    panelClass: 'neo-dialog',
                    maxWidth:   '660px',
                    width:      '95vw'
                });
            },
            error: () => { /* silent — no molesta si la API falla */ }
        });
    }

    private formatAlertDate(date: string): string {
        if (!date) return '-';
        try {
            return new Date(date).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return date; }
    }

    getVariantColor(variant: string): string {
        const colors: any = { 'info': 'variant-info', 'success': 'variant-success', 'warning': 'variant-warning', 'danger': 'variant-danger', 'default': 'variant-default' };
        return colors[variant] || 'variant-default';
    }

    getAlertIconColor(type: string): string {
        const colors: any = { 'critical': 'text-red-600', 'warning': 'text-yellow-500', 'error': 'text-orange-500', 'info': 'text-blue-500' };
        return colors[type] || 'text-gray-500';
    }

    navigateTo(route: string) {
        this.router.navigate([route]);
    }
}
