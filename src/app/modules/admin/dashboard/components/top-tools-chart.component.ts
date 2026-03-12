import { Component, AfterViewInit, ViewChild, ElementRef, Input, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    Chart,
    ChartConfiguration,
    registerables
} from 'chart.js';

Chart.register(...registerables);

export interface TopToolData {
    name: string;
    prestamos: number;
}

@Component({
    selector: 'app-top-tools-chart',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="rounded-xl border-2 border-black dark:border-white bg-white dark:bg-gray-800 p-6 shadow-lg">
            <div class="mb-6">
                <h3 class="text-lg font-bold text-black dark:text-white">Top 10 Herramientas</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Más prestadas este mes</p>
            </div>

            <div class="h-[300px]">
                <canvas #chartCanvas></canvas>
            </div>
        </div>
    `
})
export class TopToolsChartComponent implements AfterViewInit {
    @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
    @Input() data = signal<TopToolData[]>([]);

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
        const prestamos = chartData.map(d => d.prestamos);

        const colors = [
            'rgb(59, 130, 246)',
            'rgb(59, 130, 246, 0.95)',
            'rgb(59, 130, 246, 0.90)',
            'rgb(59, 130, 246, 0.85)',
            'rgb(59, 130, 246, 0.80)',
            'rgb(59, 130, 246, 0.75)',
            'rgb(59, 130, 246, 0.70)',
            'rgb(59, 130, 246, 0.65)'
        ];

        const config: ChartConfiguration = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Préstamos',
                        data: prestamos,
                        backgroundColor: colors,
                        borderRadius: 6,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                indexAxis: 'y',
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
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                return `${context.parsed.x} préstamos`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
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
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: 'rgb(107, 114, 128)',
                            font: {
                                size: 11
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
        const prestamos = chartData.map(d => d.prestamos);

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = prestamos;
        this.chart.update();
    }
}
