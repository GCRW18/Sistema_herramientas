import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

interface KPICard {
    title: string;
    value: number | string;
    subtitle?: string;
    icon: string;
    variant?: string; // Propiedad para el color de la etiqueta
    trend?: {
        value: number;
        isPositive: boolean;
    };
}

interface ChartData {
    label: string;
    value: number;
    color: string;
}

interface RecentExit {
    type: string;
    date: Date;
    destination: string;
    recipient: string;
    totalItems: number;
}

@Component({
    selector: 'app-exits-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './exits-dashboard.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        /* --- CLASE MAESTRA NEO-BRUTALISTA --- */
        .neo-card-base {
            background-color: white;
            border: 3px solid black;
            border-radius: 12px;
            box-shadow: 6px 6px 0px 0px rgba(0, 0, 0, 1);
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
            position: relative;
        }

        .neo-card-base:hover {
            transform: translate(-2px, -2px);
            box-shadow: 8px 8px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .neo-card-base:hover {
            box-shadow: 8px 8px 0px 0px rgb(9, 16, 55);
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; border: 1px solid white; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
    `]
})
export class ExitsDashboardComponent implements OnInit, AfterViewInit {
    @ViewChild('distributionChart', { static: false }) distributionCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('trendChart', { static: false }) trendCanvas!: ElementRef<HTMLCanvasElement>;

    isLoading = signal(false);

    private distributionChartInstance?: Chart;
    private trendChartInstance?: Chart;

    // Paleta Neo-Brutalista Variada
    private colors = {
        navy: '#111A43',
        blue: '#3B82F6',
        cyan: '#06b6d4',
        teal: '#14b8a6',
        green: '#05f629',
        yellow: '#fbad03',
        orange: '#FF4500',
        red: '#f61104',
        purple: '#8b5cf6',
        pink: '#ec4899',
        black: '#000000',
        white: '#ffffff'
    };

    // Datos simulados con Variantes de Color
    kpiCards = signal<KPICard[]>([
        {
            title: 'Salidas Mes',
            value: 52,
            subtitle: 'TOTAL',
            icon: 'heroicons_outline:arrow-up-tray',
            variant: 'navy',
            trend: { value: 15, isPositive: true }
        },
        {
            title: 'A Técnicos',
            value: 28,
            subtitle: 'PRÉSTAMOS',
            icon: 'heroicons_outline:user-group',
            variant: 'blue',
            trend: { value: 10, isPositive: true }
        },
        {
            title: 'A Calibración',
            value: 10,
            subtitle: 'EXTERNOS',
            icon: 'heroicons_outline:wrench-screwdriver',
            variant: 'yellow'
        },
        {
            title: 'Pendientes',
            value: 42,
            subtitle: 'POR RETORNAR',
            icon: 'heroicons_outline:clock',
            variant: 'red', // Rojo crítico
            trend: { value: 5, isPositive: false }
        },
        {
            title: 'A Otras Bases',
            value: 8,
            subtitle: 'ENVÍOS',
            icon: 'heroicons_outline:paper-airplane',
            variant: 'purple'
        },
        {
            title: 'Traspasos',
            value: 2,
            subtitle: 'INTERNOS',
            icon: 'heroicons_outline:arrows-right-left',
            variant: 'orange'
        },
        {
            title: 'A Terceros',
            value: 4,
            subtitle: 'PRÉSTAMOS',
            icon: 'heroicons_outline:briefcase',
            variant: 'teal'
        },
        {
            title: 'Items Totales',
            value: 186,
            subtitle: 'UNIDADES',
            icon: 'heroicons_outline:cube',
            variant: 'black'
        }
    ]);

    // Distribución con colores variados
    exitDistribution = signal<ChartData[]>([
        { label: 'Técnicos', value: 28, color: this.colors.blue },
        { label: 'Calibración', value: 10, color: this.colors.yellow },
        { label: 'Bases', value: 8, color: this.colors.purple },
        { label: 'Terceros', value: 4, color: this.colors.teal },
        { label: 'Traspasos', value: 2, color: this.colors.orange }
    ]);

    totalExits = computed(() => this.exitDistribution().reduce((sum, item) => sum + item.value, 0));

    recentExits = signal<RecentExit[]>([
        { type: 'Préstamo a Técnico', date: new Date('2026-01-18'), destination: 'Hangar', recipient: 'Juan Pérez', totalItems: 5 },
        { type: 'Envío a Calibración', date: new Date('2026-01-17'), destination: 'Lab Externo', recipient: 'María García', totalItems: 3 },
        { type: 'Envío a Base', date: new Date('2026-01-17'), destination: 'Base VVI', recipient: 'Carlos López', totalItems: 8 },
        { type: 'Préstamo a Terceros', date: new Date('2026-01-16'), destination: 'SABSA', recipient: 'Ana Martínez', totalItems: 2 },
        { type: 'Traspaso', date: new Date('2026-01-16'), destination: 'Almacén B', recipient: 'Pedro Sánchez', totalItems: 4 }
    ]);

    ngOnInit(): void {
        this.isLoading.set(true);
        setTimeout(() => this.isLoading.set(false), 800);
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            if (!this.isLoading()) {
                this.createDistributionChart();
                this.createTrendChart();
            }
        }, 900);
    }

    formatDate(date: Date): string {
        return new Date(date).toLocaleDateString('es-BO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    // Helper para los estilos de las etiquetas de los KPIs
    getVariantStyles(variant: string | undefined): string {
        const styles: { [key: string]: string } = {
            'navy': 'bg-[#111A43] text-white',
            'blue': 'bg-[#3B82F6] text-black',
            'cyan': 'bg-[#06b6d4] text-black',
            'teal': 'bg-[#14b8a6] text-black',
            'green': 'bg-[#05f629] text-black',
            'yellow': 'bg-[#fbad03] text-black',
            'orange': 'bg-[#FF4500] text-white',
            'red': 'bg-[#f61104] text-white',
            'purple': 'bg-[#8b5cf6] text-white',
            'pink': 'bg-[#ec4899] text-black',
            'black': 'bg-[#000000] text-white',
        };
        return styles[variant || 'navy'];
    }

    // Helper para los badges de la tabla
    getExitTypeClasses(type: string): string {
        const classes: { [key: string]: string } = {
            'Préstamo a Técnico': 'bg-blue-100 text-blue-900 border-blue-900 dark:bg-blue-900 dark:text-blue-100',
            'Envío a Calibración': 'bg-yellow-100 text-yellow-900 border-yellow-900 dark:bg-yellow-900 dark:text-yellow-100',
            'Envío a Base': 'bg-purple-100 text-purple-900 border-purple-900 dark:bg-purple-900 dark:text-purple-100',
            'Préstamo a Terceros': 'bg-teal-100 text-teal-900 border-teal-900 dark:bg-teal-900 dark:text-teal-100',
            'Traspaso': 'bg-orange-100 text-orange-900 border-orange-900 dark:bg-orange-900 dark:text-orange-100',
        };
        return classes[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }

    private createDistributionChart(): void {
        const ctx = this.distributionCanvas.nativeElement.getContext('2d');
        if (!ctx) return;

        const data = this.exitDistribution();
        const config: ChartConfiguration<'doughnut'> = {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.label),
                datasets: [{
                    data: data.map(d => d.value),
                    backgroundColor: data.map(d => d.color),
                    borderWidth: 2,
                    borderColor: '#000000',
                    hoverBorderWidth: 3,
                    hoverOffset: 4,
                    spacing: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '65%',
                plugins: { legend: { display: false } }
            }
        };

        this.distributionChartInstance = new Chart(ctx, config);
    }

    private createTrendChart(): void {
        const ctx = this.trendCanvas.nativeElement.getContext('2d');
        if (!ctx) return;

        const config: ChartConfiguration<'line'> = {
            type: 'line',
            data: {
                labels: ['JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
                datasets: [{
                    label: 'SALIDAS',
                    data: [38, 45, 42, 48, 44, 52],
                    borderColor: '#000000',
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                        // Gradiente ROJO/NARANJA para diferenciar Salidas
                        gradient.addColorStop(0, 'rgba(255, 69, 0, 0.5)'); // OrangeRed
                        gradient.addColorStop(1, 'rgba(255, 69, 0, 0.0)');
                        return gradient;
                    },
                    borderWidth: 3,
                    fill: true,
                    tension: 0,
                    pointBackgroundColor: '#FF4500', // Puntos Naranja
                    pointBorderColor: '#000',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { display: false }, ticks: { color: '#000', font: { weight: 'bold', family: 'monospace' } }, border: { display: false } },
                    x: { grid: { display: false }, ticks: { color: '#000', font: { weight: 'bold', family: 'sans-serif' } } }
                }
            }
        };

        this.trendChartInstance = new Chart(ctx, config);
    }
}
