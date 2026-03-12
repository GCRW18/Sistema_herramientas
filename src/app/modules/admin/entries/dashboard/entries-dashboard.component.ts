import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MovementService } from 'app/core/services/movement.service';
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
    variant?: string; // Propiedad para el color
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

interface RecentEntry {
    type: string;
    date: string;
    user: string;
    items: number;
}

@Component({
    selector: 'app-entries-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './entries-dashboard.component.html',
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

        /* Ajustes scrollbar */
        .overflow-y-auto::-webkit-scrollbar { width: 8px; }
        .overflow-y-auto::-webkit-scrollbar-track { background: #000; }
        .overflow-y-auto::-webkit-scrollbar-thumb { background: #333; border: 1px solid white; border-radius: 4px; }
    `]
})
export class EntriesDashboardComponent implements OnInit, AfterViewInit {
    @ViewChild('distributionChart', { static: false }) distributionCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('trendChart', { static: false }) trendCanvas!: ElementRef<HTMLCanvasElement>;

    private movService = inject(MovementService);

    isLoading = signal(true);
    Math = Math;

    private distributionChartInstance?: Chart;
    private trendChartInstance?: Chart;

    // Paleta Neo-Brutalista Variada
    private colors = {
        navy: '#111A43',
        blue: '#3B82F6',
        cyan: '#06b6d4',
        teal: '#14b8a6',
        green: '#04f428',
        yellow: '#fbad03',
        orange: '#FF4500',
        red: '#f61104',
        purple: '#8b5cf6',
        pink: '#ec4899',
        black: '#000000',
        white: '#ffffff'
    };

    kpiCards = signal<KPICard[]>([
        { title: 'Entradas Mes',    value: 0, subtitle: 'TOTAL',    icon: 'heroicons_outline:arrow-down-tray',       variant: 'navy' },
        { title: 'Compras',         value: 0, subtitle: 'NUEVAS',   icon: 'heroicons_outline:shopping-cart',         variant: 'blue' },
        { title: 'Ret. Calibración',value: 0, subtitle: 'TALLER',   icon: 'heroicons_outline:cog-6-tooth',           variant: 'yellow' },
        { title: 'Dev. Préstamo',   value: 0, subtitle: 'TÉCNICOS', icon: 'heroicons_outline:user-circle',           variant: 'purple' },
        { title: 'Ret. Base',       value: 0, subtitle: 'TRANSFER', icon: 'heroicons_outline:building-office',       variant: 'cyan' },
        { title: 'Valor Ingresos',  value: '-',subtitle: 'MONTO',   icon: 'heroicons_outline:currency-dollar',       variant: 'green' },
        { title: 'Ajustes Inv.',    value: 0, subtitle: 'AUDITORÍA',icon: 'heroicons_outline:adjustments-horizontal',variant: 'pink' },
        { title: 'Total Items',     value: 0, subtitle: 'STOCK',    icon: 'heroicons_outline:cube',                  variant: 'black' }
    ]);

    entryDistribution = signal<ChartData[]>([]);

    totalEntries = computed(() => this.entryDistribution().reduce((sum, item) => sum + item.value, 0));

    recentEntries = signal<RecentEntry[]>([]);

    ngOnInit(): void {
        this.movService.getMovements({ limit: 500, sort: 'date', dir: 'desc' }).subscribe({
            next: (movements: any[]) => {
                const entries = movements.filter(m => m.movement_type === 'entry' || m.type === 'entry' || m.movement_type === 'return' || m.type === 'return');
                const compras      = entries.filter(m => m.reason === 'purchase'           || m.entry_reason === 'purchase').length;
                const retCalib     = entries.filter(m => m.reason === 'calibration_return' || m.entry_reason === 'calibration_return').length;
                const devPrestamo  = entries.filter(m => m.reason === 'return'             || m.entry_reason === 'return').length;
                const retBase      = entries.filter(m => m.reason === 'base_return'        || m.entry_reason === 'base_return').length;
                const totalItems   = entries.reduce((s: number, m: any) => s + (parseInt(m.quantity) || 1), 0);

                this.kpiCards.set([
                    { title: 'Entradas Mes',    value: entries.length, subtitle: 'TOTAL',    icon: 'heroicons_outline:arrow-down-tray',        variant: 'navy' },
                    { title: 'Compras',         value: compras,        subtitle: 'NUEVAS',   icon: 'heroicons_outline:shopping-cart',          variant: 'blue' },
                    { title: 'Ret. Calibración',value: retCalib,       subtitle: 'TALLER',   icon: 'heroicons_outline:cog-6-tooth',            variant: 'yellow' },
                    { title: 'Dev. Préstamo',   value: devPrestamo,    subtitle: 'TÉCNICOS', icon: 'heroicons_outline:user-circle',            variant: 'purple' },
                    { title: 'Ret. Base',       value: retBase,        subtitle: 'TRANSFER', icon: 'heroicons_outline:building-office',        variant: 'cyan' },
                    { title: 'Valor Ingresos',  value: '-',            subtitle: 'MONTO',    icon: 'heroicons_outline:currency-dollar',        variant: 'green' },
                    { title: 'Ajustes Inv.',    value: 0,              subtitle: 'AUDITORÍA',icon: 'heroicons_outline:adjustments-horizontal', variant: 'pink' },
                    { title: 'Total Items',     value: totalItems,     subtitle: 'STOCK',    icon: 'heroicons_outline:cube',                  variant: 'black' }
                ]);

                this.entryDistribution.set([
                    { label: 'Compras',     value: compras,     color: this.colors.blue },
                    { label: 'Calibración', value: retCalib,    color: this.colors.yellow },
                    { label: 'Devolución',  value: devPrestamo, color: this.colors.purple },
                    { label: 'Base',        value: retBase,     color: this.colors.cyan }
                ]);

                this.recentEntries.set(
                    entries.slice(0, 10).map((m: any) => ({
                        type:  m.entry_reason_label || m.reason || m.movement_type || 'Entrada',
                        date:  m.date ? new Date(m.date).toLocaleDateString('es-BO') : '-',
                        user:  m.created_by || m.user_name || 'Sistema',
                        items: parseInt(m.quantity) || 1
                    }))
                );

                this.isLoading.set(false);
            },
            error: () => this.isLoading.set(false)
        });
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            if (!this.isLoading()) {
                this.createDistributionChart();
                this.createTrendChart();
            }
        }, 900);
    }

    // Helper para los estilos de las etiquetas de los KPIs
    getVariantStyles(variant: string | undefined): string {
        const styles: { [key: string]: string } = {
            'navy': 'bg-[#111A43] text-white',
            'blue': 'bg-[#3B82F6] text-black',
            'cyan': 'bg-[#06b6d4] text-black',
            'teal': 'bg-[#14b8a6] text-black',
            'green': 'bg-[#04f428] text-black',
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
    getEntryTypeClasses(type: string): string {
        const classes: { [key: string]: string } = {
            'Compra': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            'Retorno Calibración': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            'Retorno Base': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
            'Devolución Préstamo': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        };
        // Por defecto
        return classes[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }

    private createDistributionChart(): void {
        const ctx = this.distributionCanvas.nativeElement.getContext('2d');
        if (!ctx) return;

        const data = this.entryDistribution();
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
                    label: 'ENTRADAS',
                    data: [32, 38, 42, 45, 44, 48],
                    borderColor: '#000000', // Línea negra
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                        // Gradiente Verde/Teal para Entradas
                        gradient.addColorStop(0, 'rgba(4, 244, 40, 0.4)');
                        gradient.addColorStop(1, 'rgba(4, 244, 40, 0.0)');
                        return gradient;
                    },
                    borderWidth: 3,
                    fill: true,
                    tension: 0,
                    pointBackgroundColor: '#04f428', // Puntos Verdes
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
                    y: { grid: { display: false }, ticks: { color: '#000', font: { weight: 'bold', family: 'monospace' }, callback: (val) => val }, border: { display: false } },
                    x: { grid: { display: false }, ticks: { color: '#000', font: { weight: 'bold', family: 'sans-serif' } } }
                }
            }
        };

        this.trendChartInstance = new Chart(ctx, config);
    }
}
