import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

// Interfaces (Igual que antes)
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
        MatProgressSpinnerModule
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
            transform: translate(-2px, -2px); /* Se mueve arriba/izquierda */
            box-shadow: 8px 8px 0px 0px rgba(0, 0, 0, 1); /* Sombra crece */
        }

        :host-context(.dark) .neo-card-base:hover {
            box-shadow: 8px 8px 0px 0px rgb(9, 16, 55);
        }

        .neo-card-base:active {
            transform: translate(2px, 2px);
            box-shadow: 2px 2px 0px 0px rgba(0, 0, 0, 1);
        }

        /* Efecto Active en modo oscuro */
        :host-context(.dark) .neo-card-base:active {
            box-shadow: 2px 2px 0px 0px rgb(0, 0, 0);
        }

        /* Variantes de colores para subtítulos/etiquetas */
        .variant-info {
            background-color: #203f77;
            color: #fffefe;
        }

        .variant-success {
            background-color: #05f65d;
            color: black;
        }

        .variant-warning {
            background-color: #ffcc00;
            color: black;
        }

        .variant-danger {
            background-color: #ff0000;
            color: #fbf7f7;
        }

        .variant-default {
            background-color: #0069ff;
            color: #f4efef;
        }

        /* Ajuste de Iconos */
        mat-icon {
            vertical-align: middle;
        }

        /* Scroll personalizado para listas */
        .overflow-y-auto::-webkit-scrollbar {
            width: 8px;
        }

        .overflow-y-auto::-webkit-scrollbar-track {
            background: #000000;
        }

        :host-context(.dark) .overflow-y-auto::-webkit-scrollbar-track {
            background: #000000;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb {
            background: #000;
            border-radius: 4px;
        }

        :host-context(.dark) .overflow-y-auto::-webkit-scrollbar-thumb {
            background: #000000;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
            background: #000000;
        }

        :host-context(.dark) .overflow-y-auto::-webkit-scrollbar-thumb:hover {
            background: #000000;
        }
    `]
})
export class DashboardComponent implements OnInit, AfterViewInit {
    @ViewChild('movementsChart') movementsCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('topToolsChart') topToolsCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('calibrationChart') calibrationCanvas!: ElementRef<HTMLCanvasElement>;

    private router = inject(Router);
    isLoading = signal(false);

    // Instances
    private movementsChartInstance?: Chart;
    private topToolsChartInstance?: Chart;
    private calibrationChartInstance?: Chart;

    // Signals
    kpiCardsData = signal<KPI[]>([]);
    alertsData = signal<Alert[]>([]);
    activitiesData = signal<Activity[]>([]);
    quickActionsData = signal<QuickAction[]>([]);

    ngOnInit(): void {
        this.isLoading.set(true);
        // Simular carga rápida para ver el spinner
        setTimeout(() => {
            this.loadData();
            this.isLoading.set(false);
        }, 500);
    }

    ngAfterViewInit(): void {
        // Inicializar gráficos después de renderizar
        setTimeout(() => {
            if (!this.isLoading()) {
                this.initCharts();
            }
        }, 600);
    }

    private loadData() {
        // 1. KPI Cards
        this.kpiCardsData.set([
            { title: 'Total Herramientas', value: '1,247', subtitle: 'INVENTARIO', icon: 'heroicons_outline:wrench-screwdriver', variant: 'info' },
            { title: 'Disponibles', value: '892', subtitle: '71.5% TOTAL', icon: 'heroicons_outline:check-circle', variant: 'success', trend: { value: 5.2, isPositive: true } },
            { title: 'Alertas Críticas', value: '15', subtitle: 'ATENCIÓN', icon: 'heroicons_outline:exclamation-triangle', variant: 'danger' },
            { title: 'En Calibración', value: '12', subtitle: 'EXTERNO', icon: 'heroicons_outline:wrench', variant: 'warning' },
            { title: 'Calib. Vencida', value: '8', subtitle: 'BLOQUEADAS', icon: 'heroicons_outline:clock', variant: 'danger' },
            { title: 'En Cuarentena', value: '5', subtitle: 'REVISIÓN', icon: 'heroicons_outline:shield-exclamation', variant: 'warning' },
            { title: 'En Uso', value: '243', subtitle: 'PRÉSTAMOS', icon: 'heroicons_outline:arrow-path', variant: 'info' },
            { title: 'Dados de Baja', value: '87', subtitle: 'HISTÓRICO', icon: 'heroicons_outline:trash', variant: 'default' }
        ]);

        // 2. Alerts
        this.alertsData.set([
            { id: '1', type: 'critical', title: 'Torquímetro Vencido', description: 'Calibración expiró hace 5 días', time: 'Hace 2h', icon: 'heroicons_outline:exclamation-circle' },
            { id: '2', type: 'warning', title: 'Stock Bajo: Llaves', description: 'Solo quedan 2 unidades', time: 'Hace 4h', icon: 'heroicons_outline:arrow-trending-down' },
            { id: '3', type: 'error', title: 'Préstamo Vencido', description: 'Técnico J. Rodríguez (3 días)', time: 'Hace 1d', icon: 'heroicons_outline:clock' }
        ]);

        // 3. Quick Actions
        this.quickActionsData.set([
            { icon: 'heroicons_outline:arrow-down-tray', label: 'Entrada', description: 'Nueva', variant: 'success', route: '/entradas' },
            { icon: 'heroicons_outline:arrow-up-tray', label: 'Salida', description: 'Préstamo', variant: 'info', route: '/salidas' },
            { icon: 'heroicons_outline:wrench', label: 'Calibrar', description: 'Enviar', variant: 'warning', route: '/salidas' },
            { icon: 'heroicons_outline:document-text', label: 'Reportes', description: 'Ver', variant: 'default', route: '/reportes' }
        ]);

        // 4. Activities
        this.activitiesData.set([
            { id: '1', type: 'salida', title: 'Préstamo a Técnico', description: 'Kit B737 - J. Pérez', user: 'Admin', time: '15 min' },
            { id: '2', type: 'entrada', title: 'Retorno Calibración', description: 'Torquímetro LAB-01', user: 'Sistema', time: '45 min' },
            { id: '3', type: 'cuarentena', title: 'Ingreso Cuarentena', description: 'Taladro con falla', user: 'M. López', time: '2 hrs' },
            { id: '4', type: 'salida', title: 'Envío a Base', description: 'Base VVI - Carga', user: 'Admin', time: '4 hrs' }
        ]);
    }

    private initCharts() {
        this.createMovementsChart();
        this.createTopToolsChart();
        this.createCalibrationChart();
    }

    // ... (Métodos de gráficos se mantienen igual que en tu código anterior)
    private createMovementsChart() {
        const ctx = this.movementsCanvas?.nativeElement?.getContext('2d');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
                datasets: [
                    { label: 'Entradas', data: [45, 52, 48, 61, 55, 67], borderColor: '#04f608', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderWidth: 3, tension: 0, fill: true },
                    { label: 'Salidas', data: [38, 45, 42, 55, 48, 58], borderColor: '#f40404', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 3, tension: 0, fill: true }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    private createTopToolsChart() {
        const ctx = this.topToolsCanvas?.nativeElement?.getContext('2d');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Kit B737', 'Torq. TQ-200', 'Fluke 87V', 'Kit Insp.', 'Calibrador'],
                datasets: [{ label: 'Préstamos', data: [45, 38, 32, 28, 24], backgroundColor: ['#111A43', '#fbae05', '#fd0f02', '#27C93F', '#3B82F6'], borderWidth: 2, borderColor: '#000' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    private createCalibrationChart() {
        const ctx = this.calibrationCanvas?.nativeElement?.getContext('2d');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Vigente', 'Por Vencer', 'Vencida', 'En Proceso'],
                datasets: [{ data: [156, 23, 8, 12], backgroundColor: ['#01f825', '#f8ab04', '#f61206', '#111A43'], borderColor: '#000', borderWidth: 2 }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    getVariantColor(variant: string): string {
        const colors: any = {
            'info': 'variant-info',
            'success': 'variant-success',
            'warning': 'variant-warning',
            'danger': 'variant-danger',
            'default': 'variant-default'
        };
        return colors[variant] || 'variant-default';
    }

    getAlertIconColor(type: string): string {
        const colors: any = {
            'critical': 'text-red-600',
            'warning': 'text-yellow-500',
            'error': 'text-orange-500',
            'info': 'text-blue-500'
        };
        return colors[type] || 'text-gray-500';
    }

    navigateTo(route: string) {
        this.router.navigate([route]);
    }
}
