import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

export type ActionVariant = 'default' | 'success' | 'warning' | 'info';

export interface QuickAction {
    icon: string;
    label: string;
    description: string;
    variant: ActionVariant;
    route: string;
}

@Component({
    selector: 'app-quick-actions',
    standalone: true,
    imports: [CommonModule, MatIconModule],
    template: `
        <div class="rounded-xl border-2 border-black dark:border-white bg-white dark:bg-gray-800 p-6 shadow-lg">
            <div class="mb-4">
                <h3 class="text-lg font-bold text-black dark:text-white">Acciones Rápidas</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Operaciones frecuentes</p>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <button
                    *ngFor="let action of actions(); let i = index"
                    [ngClass]="getActionClasses(action.variant)"
                    class="flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all duration-200 animate-fade-in hover:shadow-md"
                    [style.animation-delay]="(i * 50) + 'ms'"
                    (click)="executeAction(action)"
                >
                    <mat-icon
                        [svgIcon]="action.icon"
                        [ngClass]="getIconColorClass(action.variant)"
                        class="h-5 w-5"
                    ></mat-icon>
                    <div>
                        <p class="font-medium text-gray-900 dark:text-white text-sm">{{ action.label }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ action.description }}</p>
                    </div>
                </button>
            </div>
        </div>
    `
})
export class QuickActionsComponent {
    @Input() actions = signal<QuickAction[]>([]);

    constructor(private router: Router) {}

    getActionClasses(variant: ActionVariant): string {
        const classes: Record<ActionVariant, string> = {
            'default': 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10',
            'success': 'border-green-200 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10 hover:border-green-300 dark:hover:border-green-600 hover:bg-green-100/50 dark:hover:bg-green-900/20',
            'warning': 'border-yellow-200 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10 hover:border-yellow-300 dark:hover:border-yellow-600 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20',
            'info': 'border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-100/50 dark:hover:bg-blue-900/20'
        };
        return classes[variant] || classes['default'];
    }

    getIconColorClass(variant: ActionVariant): string {
        const classes: Record<ActionVariant, string> = {
            'default': 'text-gray-600 dark:text-gray-300',
            'success': 'text-green-600 dark:text-green-400',
            'warning': 'text-yellow-600 dark:text-yellow-400',
            'info': 'text-blue-600 dark:text-blue-400'
        };
        return classes[variant] || classes['default'];
    }

    executeAction(action: QuickAction): void {
        if (action.route) {
            this.router.navigate([action.route]);
        }
    }
}
