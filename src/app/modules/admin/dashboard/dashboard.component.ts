import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, inject } from '@angular/core';
import { PermissionsService } from '../../../core/services/permissions.service';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Chart, registerables } from 'chart.js';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToolService } from 'app/core/services/tool.service';
import { MovementService } from 'app/core/services/movement.service';
import { CalibrationService } from 'app/core/services/calibration.service';
import { KitsService } from 'app/core/services/kits.service';
import { formatDateDMY, parseLocalDate } from 'app/core/utils/date.utils';
import { esActivo } from 'app/core/utils/bool.utils';
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
    variant: 'info' | 'success' | 'warning' | 'danger' | 'default' | 'purple' | 'orange' | 'slate';
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
    badge: string;
}

interface Activity {
    id: string;
    type: string;
    title: string;
    description: string;
    user: string;
    time: string;
    route?: string;
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
        MatTooltipModule,
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
        .variant-purple  { background-color: #7c3aed; color: #ffffff; }
        .variant-orange  { background-color: #ff7a00; color: black; }
        .variant-slate   { background-color: #475569; color: #ffffff; }

        @keyframes cardIn {
            from { opacity: 0; transform: translateY(14px) scale(0.98); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-card-in { animation: cardIn 0.5s cubic-bezier(0.25, 0.8, 0.25, 1) both; }

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
    private kitsService       = inject(KitsService);
    private _dialog           = inject(MatDialog);
    private _permissionsSvc   = inject(PermissionsService);

    isLoading = signal(true);

    private movementsChartInstance?: Chart;
    private topToolsChartInstance?: Chart;
    private calibrationChartInstance?: Chart;

    // Datos calculados desde el backend
    private allTools: any[]     = [];
    private recentMovements: any[] = [];
    private calibAlerts: any[]  = [];
    private loanItems: any[]    = [];
    private allKits: any[]      = [];

    kpiCardsData    = signal<KPI[]>([]);
    alertsData      = signal<Alert[]>([]);
    // Total real de alertas críticas de calibración (sin recortar): alertsData() se limita a
    // las primeras 6 para no desbordar la card, pero el badge/footer deben reflejar el total.
    alertsTotalCount = signal<number>(0);
    activitiesData  = signal<Activity[]>([]);
    // Total real de movimientos recientes (sin recortar) — mismo criterio que alertsTotalCount.
    recentMovementsTotalCount = signal<number>(0);
    // Datos para la card ampliada de Estado Calibración (% central + leyenda con conteos).
    calibTotalTools    = signal<number>(0);
    calibAvailablePct  = signal<number>(0);
    calibStats         = signal<{ label: string; value: number; color: string }[]>([]);
    quickActionsData = signal<QuickAction[]>([]);

    ngOnInit(): void {
        // Accesos rápidos solo a los módulos que el rol del usuario puede abrir.
        forkJoin({
            mov: this._permissionsSvc.canAccessArea('movimientos'),
            cal: this._permissionsSvc.canAccessArea('calibraciones'),
            inv: this._permissionsSvc.allowedTabs('inventario'),
        }).subscribe(({ mov, cal, inv }) => {
            this.quickActionsData.set([
                { icon: 'heroicons_outline:arrow-path',      label: 'Movimientos',   description: 'Entradas/Salidas', variant: 'success', route: '/movimientos', ok: mov },
                { icon: 'heroicons_outline:wrench',          label: 'Calibraciones', description: 'Gestionar',        variant: 'warning', route: '/calibraciones', ok: cal },
                { icon: 'heroicons_outline:archive-box',     label: 'Inventario',    description: 'Ver stock',        variant: 'info',     route: '/inventario', ok: inv.size > 0 },
                { icon: 'heroicons_outline:document-text',   label: 'Reportes',      description: 'Ver',              variant: 'default',  route: '/inventario', queryParams: { tab: 'reportes' }, ok: inv.has(8) }
            ].filter(a => a.ok).map(({ ok, ...a }) => a as QuickAction));
        });

        forkJoin({
            tools:      this.toolService.getTools().pipe(catchError(() => of([] as any[]))),
            // 2000 en vez de 500: con 500 el grafico de Entradas/Salidas de los ultimos 6
            // meses se quedaba corto en operaciones con volumen alto, subrrepresentando
            // los meses mas viejos de la ventana.
            movements:  this.movService.getMovements({ limit: 2000 }).pipe(catchError(() => of([] as any[]))),
            calibAlerts: this.calibrationService.getCalibrationAlertsPxp().pipe(catchError(() => of([] as any[]))),
            // desc: con más de 8000 ítems históricos se descartaban los más nuevos.
            loanItems:  this.movService.getActiveLoanItems({ dir: 'desc' }).pipe(catchError(() => of([] as any[]))),
            kits:       this.kitsService.getKits({ limit: 5000 }).pipe(catchError(() => of([] as any[])))
        }).subscribe({
            next: ({ tools, movements, calibAlerts, loanItems, kits }) => {
                // Las que ya están en el laboratorio no son alertas por atender (y el gráfico
                // las contaba dos veces: "En Calibración" y "Vencida").
                const alertsArr: any[] = (Array.isArray(calibAlerts) ? calibAlerts : (calibAlerts as any)?.data || [])
                    .filter((a: any) => !['in_calibration', 'CALIBRACION'].includes(a.status) && a.id_calibration == null);
                this.allTools        = tools;
                this.recentMovements = movements;
                this.calibAlerts     = alertsArr;
                this.loanItems       = Array.isArray(loanItems) ? loanItems : [];
                this.allKits         = Array.isArray(kits) ? kits : [];
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
        // Solo activas; estados en español de registros viejos se normalizan (antes no contaban).
        const tools      = this.allTools.filter((t: any) => esActivo(t.active));
        const st         = (t: any) => this._status(t);
        const total      = tools.filter((t: any) => !['decommissioned', 'lost'].includes(st(t))).length;
        const available  = tools.filter((t: any) => st(t) === 'available').length;
        const inUse      = tools.filter((t: any) => st(t) === 'in_use').length;
        const inCalib    = tools.filter((t: any) => st(t) === 'in_calibration').length;
        const quarantine = tools.filter((t: any) => st(t) === 'quarantine').length;
        const decomm     = this.allTools.filter((t: any) => st(t) === 'decommissioned').length;
        const pct        = total ? Math.round(available / total * 100) : 0;
        const expired    = calibAlerts.filter(a => a.alert_type === 'EXPIRED').length;
        // Kits activos que no están dados de baja; el subtítulo muestra cuántos están prestados.
        const kits       = this.allKits.filter((k: any) => esActivo(k.active) && k.status !== 'decommissioned');
        const kitsInUse  = kits.filter((k: any) => k.status === 'in_use').length;

        this.kpiCardsData.set([
            { title: 'Total Herramientas', value: total.toLocaleString(),     subtitle: 'INVENTARIO', icon: 'heroicons_outline:wrench-screwdriver', variant: 'info' },
            { title: 'Disponibles',         value: available.toLocaleString(), subtitle: `${pct}% TOTAL`, icon: 'heroicons_outline:check-circle',       variant: 'success', trend: { value: pct, isPositive: true } },
            { title: 'Kits',                value: kits.length.toLocaleString(), subtitle: `${kitsInUse} EN USO`, icon: 'heroicons_outline:briefcase',  variant: 'purple' },
            { title: 'En Calibración',      value: inCalib,                    subtitle: 'EXTERNO',    icon: 'heroicons_outline:wrench',               variant: 'warning' },
            { title: 'Calib. Vencida',      value: expired,                    subtitle: 'BLOQUEADAS', icon: 'heroicons_outline:clock',                variant: 'danger' },
            { title: 'En Cuarentena',       value: quarantine,                 subtitle: 'REVISIÓN',   icon: 'heroicons_outline:shield-exclamation',   variant: 'orange' },
            { title: 'En Uso',              value: inUse.toLocaleString(),     subtitle: 'PRÉSTAMOS',  icon: 'heroicons_outline:arrow-path',           variant: 'default' },
            { title: 'Dados de Baja',       value: decomm.toLocaleString(),    subtitle: 'HISTÓRICO',  icon: 'heroicons_outline:trash',                variant: 'slate' }
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
        // El badge mostraba cuántos movimientos se cargaron (hasta 2000), no algo útil: ahora son los de hoy.
        const vigentes = this.recentMovements.filter((m: any) => m.status !== 'cancelled');
        const hoy = new Date().toDateString();
        this.recentMovementsTotalCount.set(vigentes.filter((m: any) => parseLocalDate(m.date || m.fecha_reg)?.toDateString() === hoy).length);
        const items: Activity[] = vigentes.slice(0, 8).map((m: any, i: number) => {
            const rawType = m.type || m.movement_type || '';
            return {
                id:          String(m.id_movement || i),
                type:        rawType,
                title:       TYPE_LABELS[rawType.toUpperCase()] || rawType || 'Movimiento',
                description: m.notes || m.movement_number || '',
                user:        m.requested_by_name || m.created_by || 'Sistema',
                time:        formatDateDMY(m.date || m.fecha_reg || ''),
                route:       '/movimientos'
            };
        });
        this.activitiesData.set(items);

        // Poblar panel de alertas con calibraciones críticas. La lista visible se recorta a 6
        // para no desbordar la card, pero el total real (para el badge y "ver todas") no.
        const criticalAlerts = calibAlerts.filter(a => ['EXPIRED', 'CRITICAL_7D', 'URGENT_15D'].includes(a.alert_type));
        this.alertsTotalCount.set(criticalAlerts.length);

        const alertItems: Alert[] = criticalAlerts.slice(0, 6).map((a, i) => {
            const isExpired = a.alert_type === 'EXPIRED';
            const days = a.days_until_calibration ?? a.days_remaining ?? null;
            return {
                id:          String(a.id_calibration || i),
                // VENCIDA es el caso más grave: type 'critical' (rojo), no 'error' (naranja) —
                // antes ambos niveles de alerta se veían con la misma intensidad visual.
                type:        (isExpired ? 'critical' : 'warning') as Alert['type'],
                title:       a.tool_name || a.tool_code || 'Herramienta',
                description: (a.tool_code && a.tool_name) ? a.tool_code : '',
                time:        this.formatAlertDate(a.next_calibration_date || a.calibration_expiry),
                icon:        isExpired ? 'heroicons_outline:exclamation-circle' : 'heroicons_outline:clock',
                badge:       isExpired ? 'VENCIDA' : (days == null ? 'PRÓXIMA' : days === 0 ? 'HOY' : `${days} DÍA${days === 1 ? '' : 'S'}`),
                route:       '/calibraciones'
            };
        });
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
                if (m.status === 'cancelled') return false;
                const md = parseLocalDate(m.date || m.fecha || m.fecha_reg);
                return !!md && md.getMonth() === mes && md.getFullYear() === anio;
            });
            entradas.push(movMes.filter(m => this._sentido(m) === 'entrada').length);
            salidas.push(movMes.filter(m => this._sentido(m) === 'salida').length);
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
        // Solo se descuentan de "Disponible" las alertas que la dona cuenta (vencida / ≤15 días):
        // las de 16-90 días quedaban fuera de todos los segmentos.
        const contadas   = ['EXPIRED', 'CRITICAL_7D', 'URGENT_15D'];
        const alertedIds = new Set(this.calibAlerts.filter(a => contadas.includes(a.alert_type)).map(a => String(a.tool_id ?? '')));

        const tools     = this.allTools.filter(t => isCalibratable(t) && esActivo(t.active));
        const vigente   = tools.filter(t => this._status(t) === 'available' && !alertedIds.has(String(t.id_tool ?? t.id ?? ''))).length;
        const enCalib   = tools.filter(t => this._status(t) === 'in_calibration').length;
        const vencida   = this.calibAlerts.filter(a => a.alert_type === 'EXPIRED').length;
        const porVencer = this.calibAlerts.filter(a => ['CRITICAL_7D', 'URGENT_15D'].includes(a.alert_type)).length;
        const total     = vigente + enCalib + vencida + porVencer;

        // Para la card ampliada: % en el centro de la dona + leyenda propia con conteos
        // reales (el legend nativo de Chart.js solo muestra colores, sin cifras).
        this.calibTotalTools.set(total);
        this.calibAvailablePct.set(total ? Math.round((vigente / total) * 100) : 0);
        this.calibStats.set([
            { label: 'Disponible',     value: vigente,   color: '#01f825' },
            { label: 'En Calibración', value: enCalib,   color: '#111A43' },
            { label: 'Vencida',        value: vencida,   color: '#f61206' },
            { label: 'Por Vencer',     value: porVencer, color: '#f8ab04' },
        ]);

        this.calibrationChartInstance?.destroy();
        this.calibrationChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Disponible', 'En Calibración', 'Vencida', 'Por Vencer'],
                datasets: [{ data: [vigente, enCalib, vencida, porVencer], backgroundColor: ['#01f825','#111A43','#f61206','#f8ab04'], borderColor: '#000', borderWidth: 2 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                animation: { animateRotate: true, animateScale: true, duration: 900, easing: 'easeOutQuart' },
                plugins: { legend: { display: false } }
            }
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

    // Sin pasar por Date: 'YYYY-MM-DD' leído como UTC mostraba el vencimiento un día antes.
    private formatAlertDate(date: string): string {
        return formatDateDMY(date) || '-';
    }

    // Compra, préstamo, ajuste y retorno de base no graban entry/exit_reason: sin motivo se
    // decide por el tipo (antes solo contaban ENTRADA/SALIDA y la gráfica salía casi vacía).
    private static readonly TIPOS_ENTRADA = new Set([
        'ENTRADA', 'COMPRA', 'PURCHASE', 'AJUSTE_INGRESO', 'ENTRADA_MISC',
        'DEVOLUCION', 'DEVOLUCION_PRESTAMO_INTERNO', 'DEVOLUCION_PRESTAMO_EXTERNO', 'DEVOLUCION_TERCERO',
        'RETORNO_CALIBRACION', 'RETORNO_BASE', 'RETORNO_TRASPASO',
    ]);
    private static readonly TIPOS_SALIDA = new Set([
        'SALIDA', 'PRESTAMO', 'PRESTAMO_INTERNO', 'PRESTAMO_EXTERNO', 'PRESTAMO_TERCERO',
        'TRASPASO', 'ENVIO_BASE', 'ENVIO_CALIBRACION', 'BAJA',
    ]);

    private _sentido(m: any): 'entrada' | 'salida' | null {
        if (m.entry_reason) return 'entrada';
        if (m.exit_reason)  return 'salida';
        const tipo = String(m.type || m.movement_type || '').toUpperCase();
        if (DashboardComponent.TIPOS_ENTRADA.has(tipo)) return 'entrada';
        if (DashboardComponent.TIPOS_SALIDA.has(tipo))  return 'salida';
        return null;
    }

    /** Estado de la herramienta en inglés (registros viejos traen DISPONIBLE/CUARENTENA/...). */
    private _status(t: any): string {
        const legacy: Record<string, string> = {
            DISPONIBLE: 'available', CUARENTENA: 'quarantine', BAJA: 'decommissioned', CALIBRACION: 'in_calibration',
        };
        const s = String(t?.status ?? '');
        return legacy[s] ?? s;
    }

    getVariantColor(variant: string): string {
        const colors: any = { 'info': 'variant-info', 'success': 'variant-success', 'warning': 'variant-warning', 'danger': 'variant-danger', 'default': 'variant-default', 'purple': 'variant-purple', 'orange': 'variant-orange', 'slate': 'variant-slate' };
        return colors[variant] || 'variant-default';
    }

    getAlertIconColor(type: string): string {
        const colors: any = { 'critical': 'text-red-600', 'warning': 'text-yellow-500', 'error': 'text-orange-500', 'info': 'text-blue-500' };
        return colors[type] || 'text-gray-500';
    }

    navigateTo(action: QuickAction) {
        this.router.navigate([action.route], { queryParams: action.queryParams });
    }

    navigateToAlert(alert: Alert): void {
        if (alert.route) this.verTodasAlertas();
    }

    verTodasAlertas(): void {
        this.router.navigate(['/calibraciones'], { queryParams: { tab: 'alertas' } });
    }

    navigateToActivity(activity: Activity): void {
        if (activity.route) this.router.navigate([activity.route]);
    }

    verTodosMovimientos(): void {
        this.router.navigate(['/movimientos']);
    }
}
