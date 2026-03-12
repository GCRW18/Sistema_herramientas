import { Component, AfterViewInit, ViewChild, ElementRef, Input, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import {
    Chart,
    ChartConfiguration,
    registerables
} from 'chart.js';

Chart.register(...registerables);

export interface CalibrationDataItem {
    name: string;
    value: number;
    color: string;
}

interface StatusItem {
    icon: string;
    label: string;
    value: number;
    color: string;
    bg: string;
}

@Component({
    selector: 'app-calibration-status',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatDividerModule],
    template: `
        <div class="rounded-xl border-2 border-black dark:border-white bg-white dark:bg-gray-800 p-6 shadow-lg">
            <div class="mb-4">
                <h3 class="text-lg font-bold text-black dark:text-white">Estado de Calibración</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Distribución actual</p>
            </div>

            <div class="flex items-center gap-6">
                <div class="relative h-[180px] w-[180px] flex-shrink-0">
                    <canvas #chartCanvas></canvas>
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ total() }}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">Total</span>
                    </div>
                </div>

                <div class="flex-1 space-y-3">
                    <div
                        *ngFor="let item of statusItems(); let i = index"
                        class="flex items-center gap-3 animate-fade-in"
                        [style.animation-delay]="(i * 100) + 'ms'"
                    >
                        <div [ngClass]="item.bg" class="rounded-lg p-2 flex-shrink-0">
                            <mat-icon
                                [svgIcon]="item.icon"
                                [ngClass]="item.color"
                                class="h-4 w-4"
                            ></mat-icon>
                        </div>
                        <div class="flex-1">
                            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ item.label }}</p>
                        </div>
                        <span class="font-mono text-lg font-semibold text-gray-900 dark:text-white flex-shrink-0">{{ item.value }}</span>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class CalibrationStatusComponent implements AfterViewInit {
    @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
    @Input() data = signal<CalibrationDataItem[]>([]);

    total = computed(() => this.data().reduce((sum, item) => sum + item.value, 0));

    statusItems = computed((): StatusItem[] => {
        const data = this.data();
        return [
            {
                icon: 'heroicons_outline:check-circle',
                label: 'Vigente',
                value: data[0]?.value || 0,
                color: 'text-green-600 dark:text-green-400',
                bg: 'bg-green-100 dark:bg-green-900/30'
            },
            {
                icon: 'heroicons_outline:clock',
                label: 'Por vencer',
                value: data[1]?.value || 0,
                color: 'text-yellow-600 dark:text-yellow-400',
                bg: 'bg-yellow-100 dark:bg-yellow-900/30'
            },
            {
                icon: 'heroicons_outline:exclamation-triangle',
                label: 'Vencida',
                value: data[2]?.value || 0,
                color: 'text-red-600 dark:text-red-400',
                bg: 'bg-red-100 dark:bg-red-900/30'
            },
            {
                icon: 'heroicons_outline:wrench',
                label: 'En calibración',
                value: data[3]?.value || 0,
                color: 'text-purple-600 dark:text-purple-400',
                bg: 'bg-purple-100 dark:bg-purple-900/30'
            }
        ];
    });

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
        const values = chartData.map(d => d.value);
        const colors = chartData.map(d => d.color);

        const config: ChartConfiguration<'doughnut'> = {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [
                    {
                        data: values,
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: 'rgb(255, 255, 255)',
                        spacing: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '65%' as any,
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
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                return `${label}: ${value} unidades`;
                            }
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
        const values = chartData.map(d => d.value);
        const colors = chartData.map(d => d.color);

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = values;
        this.chart.data.datasets[0].backgroundColor = colors;
        this.chart.update();
    }
}
