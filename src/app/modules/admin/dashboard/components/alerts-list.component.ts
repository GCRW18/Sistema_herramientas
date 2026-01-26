import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { Router } from '@angular/router';

export type AlertType = 'critical' | 'warning' | 'error' | 'info';
export type AlertPriority = 'high' | 'medium' | 'low';

export interface Alert {
    id: string;
    type: AlertType;
    title: string;
    description: string;
    time: string;
    priority: AlertPriority;
    icon: string;
    route?: string;
}

@Component({
    selector: 'app-alerts-list',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatButtonModule, MatBadgeModule],
    template: `
        <div class="rounded-xl border-2 border-black dark:border-white bg-white dark:bg-gray-800 p-6 shadow-lg">
            <div class="mb-4 flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-bold text-black dark:text-white">Alertas Críticas</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Requieren atención inmediata</p>
                </div>
                <span
                    class="px-3 py-1 text-xs font-semibold rounded-full bg-white text-red-800 dark:bg-red-900/30 dark:text-red-400 animate-pulse"
                >
                    {{ urgentCount() }} urgentes
                </span>
            </div>

            <div class="space-y-3">
                <div
                    *ngFor="let alert of alerts(); let i = index"
                    class="group flex items-start gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-4 transition-all hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 cursor-pointer animate-fade-in"
                    [style.animation-delay]="(i * 100) + 'ms'"
                    (click)="navigateToAlert(alert)"
                >
                    <div
                        [ngClass]="getAlertIconBgClass(alert.type)"
                        class="rounded-lg p-2 flex-shrink-0"
                    >
                        <mat-icon
                            [svgIcon]="alert.icon"
                            [ngClass]="getAlertIconColorClass(alert.type)"
                            class="h-5 w-5"
                        ></mat-icon>
                    </div>

                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <p class="font-medium text-gray-900 dark:text-white truncate">{{ alert.title }}</p>
                            <span
                                [ngClass]="getPriorityClass(alert.priority)"
                                class="px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0"
                            >
                                {{ getPriorityLabel(alert.priority) }}
                            </span>
                        </div>
                        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ alert.description }}</p>
                        <p class="mt-1 text-xs text-gray-500 dark:text-gray-500">{{ alert.time }}</p>
                    </div>

                    <button
                        mat-icon-button
                        class="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        (click)="navigateToAlert(alert); $event.stopPropagation()"
                    >
                        <mat-icon class="h-4 w-4">arrow_forward</mat-icon>
                    </button>
                </div>
            </div>

            <button
                mat-stroked-button
                class="mt-4 w-full"
                (click)="viewAllAlerts()"
            >
                Ver todas las alertas
            </button>
        </div>
    `
})
export class AlertsListComponent implements OnInit {
    @Input() alerts = signal<Alert[]>([]);

    urgentCount = signal(0);

    constructor(private router: Router) {}

    ngOnInit(): void {
        this.updateUrgentCount();
    }

    private updateUrgentCount(): void {
        this.urgentCount.set(this.alerts().filter(a => a.priority === 'high').length);
    }

    getAlertIconBgClass(type: AlertType): string {
        const classes: Record<AlertType, string> = {
            'critical': 'bg-red-100 dark:bg-red-900/30',
            'warning': 'bg-yellow-100 dark:bg-yellow-900/30',
            'error': 'bg-orange-100 dark:bg-orange-900/30',
            'info': 'bg-blue-100 dark:bg-blue-900/30'
        };
        return classes[type] || classes['info'];
    }

    getAlertIconColorClass(type: AlertType): string {
        const classes: Record<AlertType, string> = {
            'critical': 'text-red-600 dark:text-red-400',
            'warning': 'text-yellow-600 dark:text-yellow-400',
            'error': 'text-orange-600 dark:text-orange-400',
            'info': 'text-blue-600 dark:text-blue-400'
        };
        return classes[type] || classes['info'];
    }

    getPriorityClass(priority: AlertPriority): string {
        const classes: Record<AlertPriority, string> = {
            'high': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
            'medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            'low': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
        };
        return classes[priority] || classes['low'];
    }

    getPriorityLabel(priority: AlertPriority): string {
        const labels: Record<AlertPriority, string> = {
            'high': 'Urgente',
            'medium': 'Media',
            'low': 'Baja'
        };
        return labels[priority] || labels['low'];
    }

    navigateToAlert(alert: Alert): void {
        if (alert.route) {
            this.router.navigate([alert.route]);
        }
    }

    viewAllAlerts(): void {
        this.router.navigate(['/dashboard']);
    }
}
