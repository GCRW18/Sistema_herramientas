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
    variant?: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
}

interface KPISection {
    label: string;
    cards: KPICard[];
}

interface ChartData {
    label: string;
    value: number;
    color: string;
}

interface UnifiedActivity {
    type: string;
    date: string;
    user: string;
    items: number;
    origin: string;
}

@Component({
    selector: 'app-unified-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './unified-dashboard.component.html',
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
        }

        .neo-card-base:hover {
            transform: translate(-2px, -2px);
            box-shadow: 8px 8px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .neo-card-base:hover {
            box-shadow: 8px 8px 0px 0px rgb(9, 16, 55);
        }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; border: 1px solid white; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
    `]
})
export class UnifiedDashboardComponent implements OnInit, AfterViewInit {
    @ViewChild('categoryChart', { static: false }) categoryCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('valueChart', { static: false }) valueCanvas!: ElementRef<HTMLCanvasElement>;

    isLoading = signal(false);

    private categoryChartInstance?: Chart;
    private valueChartInstance?: Chart;

    inventoryKpiCards = signal<KPICard[]>([
        { title: 'Stock Total', value: 1245, subtitle: 'HERRAMIENTAS', icon: 'heroicons_outline:cube', variant: 'navy', trend: { value: 5, isPositive: true } },
        { title: 'Valor Inventario', value: 'Bs 2.5M', subtitle: 'ESTIMADO', icon: 'heroicons_outline:currency-dollar', variant: 'green', trend: { value: 8, isPositive: true } },
        { title: 'Disponibles', value: 892, subtitle: 'EN ALMACÉN', icon: 'heroicons_outline:check-circle', variant: 'teal' },
        { title: 'En Préstamo', value: 245, subtitle: 'ASIGNADOS', icon: 'heroicons_outline:user-circle', variant: 'blue' },
        { title: 'En Calibración', value: 68, subtitle: 'EXTERNO', icon: 'heroicons_outline:cog-6-tooth', variant: 'yellow' },
        { title: 'Bajo Stock', value: 15, subtitle: 'REPONER', icon: 'heroicons_outline:exclamation-triangle', variant: 'red', trend: { value: 3, isPositive: false } },
        { title: 'Categorías', value: 24, subtitle: 'FAMILIAS', icon: 'heroicons_outline:folder', variant: 'purple' },
        { title: 'Eficiencia', value: '85%', subtitle: 'ROTACIÓN', icon: 'heroicons_outline:arrow-path', variant: 'orange', trend: { value: 12, isPositive: true } }
    ]);

    kitsKpiCards = signal<KPICard[]>([
        { title: 'Total de Kits', value: 45, subtitle: 'Registrados', icon: 'heroicons_outline:cube', variant: 'cyan' },
        { title: 'Kits Completos', value: 32, subtitle: '100% Items', icon: 'heroicons_outline:check-circle', variant: 'green' },
        { title: 'Kits Incompletos', value: 8, subtitle: 'Atención Req.', icon: 'heroicons_outline:exclamation-triangle', variant: 'yellow' },
        { title: 'Kits en Uso', value: 5, subtitle: 'Prestados', icon: 'heroicons_outline:arrow-right-circle', variant: 'purple' },
        { title: 'Componentes', value: 380, subtitle: 'Total Items', icon: 'heroicons_outline:squares-plus', variant: 'navy' },
        { title: 'Faltantes', value: 12, subtitle: 'Reponer', icon: 'heroicons_outline:x-circle', variant: 'red' },
        { title: 'Calibración', value: 6, subtitle: 'Vencidos/Prox', icon: 'heroicons_outline:wrench-screwdriver', variant: 'orange' },
        { title: 'Fuera Servicio', value: 0, subtitle: 'Bajas', icon: 'heroicons_outline:no-symbol', variant: 'black' }
    ]);

    categoryDistribution = signal<ChartData[]>([
        { label: 'Manuales', value: 385, color: '#111A43' },
        { label: 'Eléctricas', value: 295, color: '#fbad03' },
        { label: 'Medición', value: 245, color: '#f61104' },
        { label: 'Calibración', value: 180, color: '#27C93F' },
        { label: 'Otros', value: 140, color: '#8b5cf6' }
    ]);

    totalItems = computed(() => this.categoryDistribution().reduce((sum, item) => sum + item.value, 0));

    recentActivities = signal<UnifiedActivity[]>([
        { type: 'Ajuste de Stock', date: '29/12/2024', user: 'Gabriel Cruz', items: 8, origin: 'INVENTARIO' },
        { type: 'Entrada Compra', date: '28/12/2024', user: 'María López', items: 25, origin: 'INVENTARIO' },
        { type: 'Préstamo Kit', date: '28/12/2024', user: 'Juan Pérez', items: 1, origin: 'KITS' },
        { type: 'Salida Préstamo', date: '27/12/2024', user: 'Carlos Rojas', items: 12, origin: 'INVENTARIO' },
        { type: 'Devolución Kit', date: '27/12/2024', user: 'María González', items: 1, origin: 'KITS' },
        { type: 'Retorno Calibración', date: '26/12/2024', user: 'Ana Méndez', items: 5, origin: 'INVENTARIO' }
    ]);

    ngOnInit(): void {
        this.isLoading.set(true);
        setTimeout(() => this.isLoading.set(false), 800);
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            if (!this.isLoading()) {
                this.createCategoryChart();
                this.createValueChart();
            }
        }, 900);
    }

    getVariantStyles(variant: string | undefined): string {
        const styles: { [key: string]: string } = {
            'navy': 'bg-[#111A43] text-white',
            'blue': 'bg-[#3B82F6] text-black',
            'cyan': 'bg-[#06b6d4] text-black',
            'teal': 'bg-[#14b8a6] text-black',
            'green': 'bg-[#27C93F] text-black',
            'yellow': 'bg-[#fbad03] text-black',
            'orange': 'bg-[#FF4500] text-white',
            'red': 'bg-[#f61104] text-white',
            'purple': 'bg-[#8b5cf6] text-white',
            'pink': 'bg-[#ec4899] text-black',
            'black': 'bg-[#000000] text-white',
        };
        return styles[variant || 'navy'];
    }

    getActivityTypeClasses(type: string): string {
        const classes: { [key: string]: string } = {
            'Ajuste de Stock': 'bg-pink-100 text-pink-900 border-pink-900 dark:bg-pink-900 dark:text-pink-100',
            'Entrada Compra': 'bg-green-100 text-green-900 border-green-900 dark:bg-green-900 dark:text-green-100',
            'Préstamo Kit': 'bg-cyan-100 text-cyan-900 border-cyan-900 dark:bg-cyan-900 dark:text-cyan-100',
            'Salida Préstamo': 'bg-blue-100 text-blue-900 border-blue-900 dark:bg-blue-900 dark:text-blue-100',
            'Devolución Kit': 'bg-purple-100 text-purple-900 border-purple-900 dark:bg-purple-900 dark:text-purple-100',
            'Retorno Calibración': 'bg-yellow-100 text-yellow-900 border-yellow-900 dark:bg-yellow-900 dark:text-yellow-100',
        };
        return classes[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }

    private createCategoryChart(): void {
        const ctx = this.categoryCanvas.nativeElement.getContext('2d');
        if (!ctx) return;
        const data = this.categoryDistribution();
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
        this.categoryChartInstance = new Chart(ctx, config);
    }

    private createValueChart(): void {
        const ctx = this.valueCanvas.nativeElement.getContext('2d');
        if (!ctx) return;
        const config: ChartConfiguration<'line'> = {
            type: 'line',
            data: {
                labels: ['JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
                datasets: [{
                    label: 'VALOR INVENTARIO',
                    data: [2100, 2250, 2300, 2400, 2450, 2500],
                    borderColor: '#000000',
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                        gradient.addColorStop(0, 'rgba(39, 201, 63, 0.5)');
                        gradient.addColorStop(1, 'rgba(39, 201, 63, 0.0)');
                        return gradient;
                    },
                    borderWidth: 3,
                    fill: true,
                    tension: 0,
                    pointBackgroundColor: '#27C93F',
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
                    y: {
                        beginAtZero: false,
                        grid: { display: false },
                        ticks: { color: '#000', font: { weight: 'bold', family: 'monospace' }, callback: (val) => `${val}` },
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#000', font: { weight: 'bold', family: 'sans-serif' } }
                    }
                }
            }
        };
        this.valueChartInstance = new Chart(ctx, config);
    }
}
