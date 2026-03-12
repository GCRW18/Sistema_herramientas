import { Component, AfterViewInit, ViewChild, ElementRef, Input, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    Chart,
    ChartConfiguration,
    registerables
} from 'chart.js';

Chart.register(...registerables);

export interface MovementData {
    name: string;
    entradas: number;
    salidas: number;
}

@Component({
    selector: 'app-movements-chart',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="rounded-xl border-2 border-black dark:border-white bg-white dark:bg-gray-800 p-6 shadow-lg">
            <div class="mb-6">
                <h3 class="text-lg font-bold text-black dark:text-white">Movimientos Mensuales</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Entradas vs Salidas - Últimos 6 meses</p>
            </div>

            <div class="h-[300px]">
                <canvas #chartCanvas></canvas>
            </div>

            <div class="mt-4 flex items-center justify-center gap-6">
                <div class="flex items-center gap-2">
                    <div class="h-3 w-3 rounded-full bg-green-500"></div>
                    <span class="text-sm text-gray-600 dark:text-gray-400">Entradas</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="h-3 w-3 rounded-full bg-blue-500"></div>
                    <span class="text-sm text-gray-600 dark:text-gray-400">Salidas</span>
                </div>
            </div>
        </div>
    `
})
export class MovementsChartComponent implements AfterViewInit {
    @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
    @Input() data = signal<MovementData[]>([]);

    private chart?: Chart;

    constructor() {
        effect(() => {
            if (this.chart) {
                this.updateChart();
            }
        });
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            this.createChart();
        }, 0);
    }

    private createChart(): void {
        const ctx = this.chartCanvas.nativeElement.getContext('2d');
        if (!ctx) return;

        const chartData = this.data();
        const labels = chartData.map(d => d.name);
        const entradas = chartData.map(d => d.entradas);
        const salidas = chartData.map(d => d.salidas);

        const config: ChartConfiguration = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Entradas',
                        data: entradas,
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2
                    },
                    {
                        label: 'Salidas',
                        data: salidas,
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        padding: 12,
                        borderColor: 'rgba(75, 85, 99, 0.5)',
                        borderWidth: 1,
                        titleColor: 'rgb(243, 244, 246)',
                        bodyColor: 'rgb(243, 244, 246)',
                        cornerRadius: 8
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(107, 114, 128, 0.1)',
                            drawTicks: false
                        },
                        ticks: {
                            color: 'rgb(107, 114, 128)',
                            font: {
                                size: 12
                            },
                            padding: 8
                        },
                        border: {
                            display: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: 'rgb(107, 114, 128)',
                            font: {
                                size: 12
                            },
                            padding: 8
                        },
                        border: {
                            display: false
                        }
                    }
                }
            }
        };

        this.chart = new Chart(ctx, config);
    }

    private updateChart(): void {
        if (!this.chart) return;

        const chartData = this.data();
        const labels = chartData.map(d => d.name);
        const entradas = chartData.map(d => d.entradas);
        const salidas = chartData.map(d => d.salidas);

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = entradas;
        this.chart.data.datasets[1].data = salidas;
        this.chart.update();
    }
}
