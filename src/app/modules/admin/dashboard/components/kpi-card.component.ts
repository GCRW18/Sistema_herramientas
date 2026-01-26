import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type KPIVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface KPITrend {
    value: number;
    isPositive: boolean;
}

@Component({
    selector: 'app-kpi-card',
    standalone: true,
    imports: [CommonModule, MatIconModule],
    template: `
        <div
            [ngClass]="getCardClasses()"
            class="rounded-xl border-2 border-black dark:border-white bg-white dark:bg-gray-800 p-6 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer group animate-fade-in"
        >
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <p class="text-sm font-bold text-gray-700 dark:text-gray-300">{{ title }}</p>
                    <p class="mt-2 text-3xl font-bold text-black dark:text-white">{{ value }}</p>
                    <p *ngIf="subtitle" class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ subtitle }}</p>

                    <div *ngIf="trend" class="mt-2 flex items-center gap-1">
                        <span
                            class="text-sm font-bold"
                            [ngClass]="trend.isPositive ? 'text-green-600' : 'text-red-600'"
                        >
                            {{ trend.isPositive ? '↑' : '↓' }} {{ Math.abs(trend.value) }}%
                        </span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">vs mes anterior</span>
                    </div>
                </div>

                <div class="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 transition-transform group-hover:scale-110">
                    <mat-icon
                        [svgIcon]="icon"
                        class="!text-black dark:!text-white !h-8 !w-8 !text-3xl"
                    ></mat-icon>
                </div>
            </div>
        </div>
    `
})
export class KpiCardComponent {
    @Input() title: string = '';
    @Input() value: string | number = '';
    @Input() subtitle?: string;
    @Input() icon: string = 'heroicons_outline:chart-bar';
    @Input() trend?: KPITrend;
    @Input() variant: KPIVariant = 'default';

    Math = Math;

    getCardClasses(): string {
        const classes: Record<KPIVariant, string> = {
            'default': 'hover:border-gray-300 dark:hover:border-gray-600',
            'success': 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10',
            'warning': 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10',
            'danger': 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10',
            'info': 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10'
        };
        return classes[this.variant] || classes['default'];
    }

    getValueClasses(): string {
        const classes: Record<KPIVariant, string> = {
            'default': 'text-gray-900 dark:text-white',
            'success': 'text-green-600 dark:text-green-400',
            'warning': 'text-yellow-600 dark:text-yellow-400',
            'danger': 'text-red-600 dark:text-red-400',
            'info': 'text-blue-600 dark:text-blue-400'
        };
        return classes[this.variant] || classes['default'];
    }

    getIconBgClasses(): string {
        const classes: Record<KPIVariant, string> = {
            'default': 'bg-gray-100 dark:bg-gray-700',
            'success': 'bg-green-100 dark:bg-green-900/30',
            'warning': 'bg-yellow-100 dark:bg-yellow-900/30',
            'danger': 'bg-red-100 dark:bg-red-900/30',
            'info': 'bg-blue-100 dark:bg-blue-900/30'
        };
        return classes[this.variant] || classes['default'];
    }

    getIconClasses(): string {
        const classes: Record<KPIVariant, string> = {
            'default': 'text-gray-600 dark:text-gray-300',
            'success': 'text-green-600 dark:text-green-400',
            'warning': 'text-yellow-600 dark:text-yellow-400',
            'danger': 'text-red-600 dark:text-red-400',
            'info': 'text-blue-600 dark:text-blue-400'
        };
        return classes[this.variant] || classes['default'];
    }
}
