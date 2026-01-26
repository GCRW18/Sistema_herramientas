import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';

export type ActivityType = 'entrada' | 'salida' | 'calibracion' | 'cuarentena' | 'retorno';

export interface Activity {
    id: string;
    type: ActivityType;
    title: string;
    description: string;
    user: string;
    time: string;
}

@Component({
    selector: 'app-recent-activity',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatBadgeModule],
    template: `
        <div class="rounded-xl border-2 border-black dark:border-white bg-white dark:bg-gray-800 p-6 shadow-lg">
            <div class="mb-4">
                <h3 class="text-lg font-bold text-black dark:text-white">Actividad Reciente</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Últimos movimientos del sistema</p>
            </div>

            <div class="space-y-4">
                <div
                    *ngFor="let activity of activities(); let i = index"
                    class="flex items-start gap-4 animate-fade-in"
                    [style.animation-delay]="(i * 100) + 'ms'"
                >
                    <div
                        [ngClass]="getActivityBgClass(activity.type)"
                        class="rounded-lg p-2 flex-shrink-0"
                    >
                        <mat-icon
                            [svgIcon]="getActivityIcon(activity.type)"
                            [ngClass]="getActivityColorClass(activity.type)"
                            class="h-4 w-4"
                        ></mat-icon>
                    </div>

                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <p class="font-medium text-gray-900 dark:text-white">{{ activity.title }}</p>
                            <span
                                [ngClass]="getBadgeClass(activity.type)"
                                class="px-2 py-0.5 text-xs font-semibold rounded-full"
                            >
                                {{ getActivityLabel(activity.type) }}
                            </span>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-400 truncate">{{ activity.description }}</p>
                        <div class="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                            <span>{{ activity.user }}</span>
                            <span>•</span>
                            <span>{{ activity.time }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class RecentActivityComponent {
    @Input() activities = signal<Activity[]>([]);

    getActivityIcon(type: ActivityType): string {
        const icons: Record<ActivityType, string> = {
            'entrada': 'heroicons_outline:arrow-down-left',
            'salida': 'heroicons_outline:arrow-up-right',
            'calibracion': 'heroicons_outline:wrench',
            'cuarentena': 'heroicons_outline:exclamation-triangle',
            'retorno': 'heroicons_outline:check-circle'
        };
        return icons[type] || 'heroicons_outline:document';
    }

    getActivityBgClass(type: ActivityType): string {
        const classes: Record<ActivityType, string> = {
            'entrada': 'bg-green-100 dark:bg-green-900/30',
            'salida': 'bg-blue-100 dark:bg-blue-900/30',
            'calibracion': 'bg-orange-100 dark:bg-orange-900/30',
            'cuarentena': 'bg-yellow-100 dark:bg-yellow-900/30',
            'retorno': 'bg-green-100 dark:bg-green-900/30'
        };
        return classes[type] || 'bg-gray-100 dark:bg-gray-900/30';
    }

    getActivityColorClass(type: ActivityType): string {
        const classes: Record<ActivityType, string> = {
            'entrada': 'text-green-600 dark:text-green-400',
            'salida': 'text-blue-600 dark:text-blue-400',
            'calibracion': 'text-orange-600 dark:text-orange-400',
            'cuarentena': 'text-yellow-600 dark:text-yellow-400',
            'retorno': 'text-green-600 dark:text-green-400'
        };
        return classes[type] || 'text-gray-600 dark:text-gray-400';
    }

    getBadgeClass(type: ActivityType): string {
        const classes: Record<ActivityType, string> = {
            'entrada': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            'salida': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            'calibracion': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
            'cuarentena': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            'retorno': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
        };
        return classes[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }

    getActivityLabel(type: ActivityType): string {
        const labels: Record<ActivityType, string> = {
            'entrada': 'Entrada',
            'salida': 'Salida',
            'calibracion': 'Calibración',
            'cuarentena': 'Cuarentena',
            'retorno': 'Retorno'
        };
        return labels[type] || type;
    }
}
