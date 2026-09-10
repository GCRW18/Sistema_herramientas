import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Chart, registerables } from 'chart.js';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
    queryParams?: Record<string, string>;
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
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('movementsChart') movementsCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('topToolsChart') topToolsCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('calibrationChart') calibrationCanvas!: ElementRef<HTMLCanvasElement>;

    private router            = inject(Router);
    private toolService       = inject(ToolService);
    private movService        = inject(MovementService);
    private calibrationService = inject(CalibrationService);
    private _dialog           = inject(MatDialog);

    isLoading = signal(true);

    private movementsChartInstance?: Chart;
    private topToolsChartInstance?: Chart;
    private calibrationChartInstance?: Chart;

    // Datos calculados desde el backend
    private allTools: any[]     = [];
    private recentMovements: any[] = [];
    private calibAlerts: any[]  = [];
    private loanItems: any[]    = [];

    kpiCardsData    = signal<KPI[]>([]);
    alertsData      = signal<Alert[]>([]);
    activitiesData  = signal<Activity[]>([]);
    quickActionsData = signal<QuickAction[]>([]);

    ngOnInit(): void {
        this.quickActionsData.set([
            { icon: 'heroicons_outline:arrow-path',      label: 'Movimientos',   description: 'Entradas/Salidas', variant: 'success', route: '/movimientos' },
            { icon: 'heroicons_outline:wrench',          label: 'Calibraciones', description: 'Gestionar',        variant: 'warning', route: '/calibraciones' },
            { icon: 'heroicons_outline:archive-box',     label: 'Inventario',    description: 'Ver stock',        variant: 'info',     route: '/inventario' },
            { icon: 'heroicons_outline:document-text',   label: 'Reportes',      description: 'Ver',              variant: 'default',  route: '/inventario', queryParams: { tab: 'reportes' } }
        ]);

        forkJoin({
            tools:      this.toolService.getTools().pipe(catchError(() => of([] as any[]))),
            // 2000 en vez de 500: con 500 el grafico de Entradas/Salidas de los ultimos 6
            // meses se quedaba corto en operaciones con volumen alto, subrrepresentando
            // los meses mas viejos de la ventana.
            movements:  this.movService.getMovements({ limit: 2000 }).pipe(catchError(() => of([] as any[]))),
            calibAlerts: this.calibrationService.getCalibrationAlertsPxp({ limit: 100 }).pipe(catchError(() => of([] as any[]))),
            loanItems:  this.movService.getActiveLoanItems().pipe(catchError(() => of([] as any[])))
        }).subscribe({
            next: ({ tools, movements, calibAlerts, loanItems }) => {
                const alertsArr: any[] = Array.isArray(calibAlerts) ? calibAlerts : (calibAlerts as any)?.data || [];
                this.allTools        = tools;
                this.recentMovements = movements;
                this.calibAlerts     = alertsArr;
                this.loanItems       = Array.isArray(loanItems) ? loanItems : [];
                this.buildKPIs(alertsArr);
                this.buildActivities(alertsArr);
                this.isLoading.set(false);
                setTimeout(() => this.initCharts(), 100);
                setTimeout(() => this.checkCalibrationAlerts(), 1200);
            },
            error: () => {
                this.buildKPIs([]);
                this.buildActivities([]);
                this.isLoading.set(false);
            }
        });
    }

    ngAfterViewInit(): void {}

    ngOnDestroy(): void {
        this.movementsChartInstance?.destroy();
        this.topToolsChartInstance?.destroy();
        this.calibrationChartInstance?.destroy();
    }

    // ── KPIs ────────────────────────────────────────────────────────────────────
    private buildKPIs(calibAlerts: any[] = []): void {
        const tools      = this.allTools;
        const total      = tools.filter((t: any) => t.status !== 'decommissioned').length;
        const available  = tools.filter((t: any) => t.status === 'available').length;
        const inUse      = tools.filter((t: any) => t.status === 'in_use').length;
        const inCalib    = tools.filter((t: any) => t.status === 'in_calibration').length;
        const quarantine = tools.filter((t: any) => t.status === 'quarantine').length;
        const decomm     = tools.filter((t: any) => t.status === 'decommissioned').length;
        const pct        = total ? Math.round(available / total * 100) : 0;
        const expired    = calibAlerts.filter(a => a.alert_type === 'EXPIRED').length;
        const critical   = calibAlerts.filter(a => ['EXPIRED', 'CRITICAL_7D', 'URGENT_15D'].includes(a.alert_type)).length;

        this.kpiCardsData.set([
            { title: 'Total Herramientas', value: total.toLocaleString(),     subtitle: 'INVENTARIO', icon: 'heroicons_outline:wrench-screwdriver', variant: 'info' },
            { title: 'Disponibles',         value: available.toLocaleString(), subtitle: `${pct}% TOTAL`, icon: 'heroicons_outline:check-circle',       variant: 'success', trend: { value: pct, isPositive: true } },
            { title: 'Alertas Críticas',    value: critical,                   subtitle: 'ATENCIÓN',   icon: 'heroicons_outline:exclamation-triangle', variant: 'danger' },
            { title: 'En Calibración',      value: inCalib,                    subtitle: 'EXTERNO',    icon: 'heroicons_outline:wrench',               variant: 'warning' },
            { title: 'Calib. Vencida',      value: expired,                    subtitle: 'BLOQUEADAS', icon: 'heroicons_outline:clock',                variant: 'danger' },
            { title: 'En Cuarentena',       value: quarantine,                 subtitle: 'REVISIÓN',   icon: 'heroicons_outline:shield-exclamation',   variant: 'warning' },
            { title: 'En Uso',              value: inUse.toLocaleString(),     subtitle: 'PRÉSTAMOS',  icon: 'heroicons_outline:arrow-path',           variant: 'info' },
            { title: 'Dados de Baja',       value: decomm.toLocaleString(),    subtitle: 'HISTÓRICO',  icon: 'heroicons_outline:trash',                variant: 'default' }
        ]);
    }

    // ── Actividades recientes + Alertas panel ────────────────────────────────────
    private buildActivities(calibAlerts: any[] = []): void {
        // Valores reales de he.tmovements.type (chk_tmovements_type) — mayusculas salvo
        // 'adjustment'/'purchase', legacy. Antes este mapa comparaba en minuscula y nunca
        // matcheaba nada, asi que el titulo siempre caia al tipo crudo sin traducir.
        const TYPE_LABELS: Record<string, string> = {
            ENTRADA: 'Entrada', SALIDA: 'Salida',
            PRESTAMO: 'Préstamo', PRESTAMO_INTERNO: 'Préstamo', PRESTAMO_EXTERNO: 'Préstamo Externo', PRESTAMO_TERCERO: 'Préstamo a Tercero',
            DEVOLUCION: 'Devolución', DEVOLUCION_PRESTAMO_INTERNO: 'Devolución', DEVOLUCION_PRESTAMO_EXTERNO: 'Devolución Externa', DEVOLUCION_TERCERO: 'Devolución de Tercero',
            TRASPASO: 'Traspaso', RETORNO_TRASPASO: 'Retorno de Traspaso',
            ENVIO_BASE: 'Envío a Base', RETORNO_BASE: 'Retorno de Base',
            ENVIO_CALIBRACION: 'Envío a Calibración', RETORNO_CALIBRACION: 'Retorno de Calibración',
            BAJA: 'Baja', CUARENTENA: 'Cuarentena', MAINTENANCE: 'Mantenimiento',
            AJUSTE_INGRESO: 'Ajuste', ADJUSTMENT: 'Ajuste', PURCHASE: 'Compra', COMPRA: 'Compra',
            COMAT: 'COMAT', ENTRADA_MISC: 'Entrada Misceláneo', MANUAL: 'Ajuste Manual'
        };
        const items = this.recentMovements.slice(0, 8).map((m: any, i: number) => {
            const rawType = m.type || m.movement_type || '';
            return {
                id:          String(m.id_movement || i),
                type:        rawType,
                title:       TYPE_LABELS[rawType.toUpperCase()] || rawType || 'Movimiento',
                description: m.notes || m.movement_number || '',
                user:        m.requested_by_name || m.created_by || 'Sistema',
                time:        m.date ? new Date(m.date).toLocaleDateString('es-BO') : (m.fecha_reg ? new Date(m.fecha_reg).toLocaleDateString('es-BO') : '')
            };
        });
        this.activitiesData.set(items);

        // Poblar panel de alertas con calibraciones críticas
        const alertItems: Alert[] = calibAlerts
            .filter(a => ['EXPIRED', 'CRITICAL_7D', 'URGENT_15D'].includes(a.alert_type))
            .slice(0, 6)
            .map((a, i) => ({
                id:          String(a.id_calibration || i),
                type:        a.alert_type === 'EXPIRED' ? 'error' : 'warning' as any,
                title:       a.tool_name || a.tool_code || 'Herramienta',
                description: a.alert_type === 'EXPIRED'
                    ? 'Calibración VENCIDA'
                    : `Vence en ${a.days_until_calibration ?? a.days_remaining ?? '?'} días`,
                time:        a.next_calibration_date || a.calibration_expiry || '',
                icon:        a.alert_type === 'EXPIRED'
                    ? 'heroicons_outline:exclamation-circle'
                    : 'heroicons_outline:clock'
            }));
        this.alertsData.set(alertItems);
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
                const md = new Date(m.date || m.fecha || m.fecha_reg || '');
                return md.getMonth() === mes && md.getFullYear() === anio;
            });
            // entry_reason/exit_reason son mutuamente excluyentes por diseño (chk_tmovements_*):
            // un movimiento con entry_reason es entrada, con exit_reason es salida. El tipo
            // (ENTRADA/SALIDA en mayúsculas) queda solo como respaldo si algún registro viejo
            // no tuviera el reason poblado.
            const isEntrada = (m: any) => m.entry_reason != null || (m.type || m.movement_type || '').toUpperCase() === 'ENTRADA';
            const isSalida  = (m: any) => m.exit_reason  != null || (m.type || m.movement_type || '').toUpperCase() === 'SALIDA';
            entradas.push(movMes.filter(isEntrada).length);
            salidas.push(movMes.filter(isSalida).length);
        }

        this.movementsChartInstance?.destroy();
        this.movementsChartInstance = new Chart(ctx, {
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

        // Contar préstamos por herramienta desde he.tloan_items (getActiveLoanItems sin
        // filtro trae todo el historial). Se agrupa por tool_id, no por nombre: dos
        // herramientas distintas pueden compartir el mismo nombre genérico (ej. "Llave 10mm").
        const counts: Record<string, { label: string; count: number }> = {};
        this.loanItems.forEach((li: any) => {
            const id = String(li.tool_id ?? '');
            if (!id) return;
            const label = li.code || li.name || `#${id}`;
            if (!counts[id]) counts[id] = { label, count: 0 };
            counts[id].count++;
        });

        const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 8);
        const labels = sorted.map(s => s.label);
        const data   = sorted.map(s => s.count);
        const colors = ['#111A43','#fbae05','#fd0f02','#27C93F','#3B82F6','#8b5cf6','#ec4899','#06b6d4'];

        this.topToolsChartInstance?.destroy();
        this.topToolsChartInstance = new Chart(ctx, {
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

        // he.ft_calibrations_sel (HE_CLS_ALERTS_SEL) solo mira herramientas con
        // requires_calibration = true — "Disponible"/"En Calibración" deben quedar acotados
        // igual, si no se mezclan herramientas que ni siquiera entran al programa de
        // calibración. "Disponible" además excluye a las que ya están en alertas (vencida/por
        // vencer), porque el status no cambia solo por vencer la fecha: sin este filtro una
        // misma herramienta podía contarse dos veces (disponible Y vencida a la vez).
        const isCalibratable = (t: any) => t.requires_calibration === true || t.requires_calibration === 't';
        const alertedIds = new Set(this.calibAlerts.map(a => String(a.tool_id ?? '')));

        const tools     = this.allTools.filter(isCalibratable);
        const vigente   = tools.filter(t => t.status === 'available' && !alertedIds.has(String(t.id_tool ?? t.id ?? ''))).length;
        const enCalib   = tools.filter(t => t.status === 'in_calibration').length;
        const vencida   = this.calibAlerts.filter(a => a.alert_type === 'EXPIRED').length;
        const porVencer = this.calibAlerts.filter(a => ['CRITICAL_7D', 'URGENT_15D'].includes(a.alert_type)).length;

        this.calibrationChartInstance?.destroy();
        this.calibrationChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Disponible', 'En Calibración', 'Vencida', 'Por Vencer'],
                datasets: [{ data: [vigente, enCalib, vencida, porVencer], backgroundColor: ['#01f825','#111A43','#f61206','#f8ab04'], borderColor: '#000', borderWidth: 2 }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // ── Alertas de calibración al login ─────────────────────────────────────────
    // Reutiliza this.calibAlerts (ya cargado en el forkJoin de ngOnInit), sin segunda llamada a la API.
    private checkCalibrationAlerts(): void {
        const all = this.calibAlerts;
        const critical = all.filter(a =>
            ['EXPIRED', 'CRITICAL_7D', 'URGENT_15D'].includes(a.alert_type)
        );
        if (critical.length === 0) return;

        const data: CalibrationAlertDialogData = {
            alerts: critical.slice(0, 10).map(a => ({
                tool_code:          a.tool_code   || a.codigo  || '',
                tool_name:          a.tool_name   || a.nombre  || '',
                calibration_expiry: this.formatAlertDate(a.next_calibration_date || a.calibration_expiry),
                days_remaining:     a.days_until_calibration ?? a.days_remaining ?? 0,
                urgency:            a.alert_type || '',
                warehouse:          a.warehouse   || a.almacen || 'CBB'
            })),
            expiredCount:    all.filter(a => a.alert_type === 'EXPIRED').length,
            critical7dCount: all.filter(a => a.alert_type === 'CRITICAL_7D').length,
            urgent15dCount:  all.filter(a => a.alert_type === 'URGENT_15D').length
        };

        this._dialog.open(CalibrationAlertDialogComponent, {
            data,
            panelClass: 'neo-dialog-calibration',
            maxWidth:   '580px',
            width:      '95vw'
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

    navigateTo(action: QuickAction) {
        this.router.navigate([action.route], { queryParams: action.queryParams });
    }
}
