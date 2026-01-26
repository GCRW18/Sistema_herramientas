import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MinimizedDialogsService } from '../../../core/services/minimized-dialogs.service';

@Component({
    selector: 'app-minimized-dialogs-bar',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule
    ],
    template: `
        <div class="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-start gap-2 p-4 pointer-events-none">
            @for (dialog of minimizedDialogs(); track dialog.id) {
                <div class="pointer-events-auto bg-[#F5E6D3] dark:bg-gray-900 rounded-t-2xl border-4 border-b-0 border-black shadow-[0_-8px_0px_0px_rgba(0,0,0,1)] w-80 overflow-hidden animate-slide-up">
                    <!-- Minimized Header -->
                    <div class="relative bg-[#5B4B8A] p-3 cursor-pointer" (click)="restoreDialog(dialog.id)">
                        <!-- Browser dots -->
                        <div class="flex items-center gap-2 mb-2">
                            <div class="w-2 h-2 rounded-full bg-red-500"></div>
                            <div class="w-2 h-2 rounded-full bg-yellow-400"></div>
                            <div class="w-2 h-2 rounded-full bg-green-500"></div>
                        </div>

                        <!-- Title and Status -->
                        <div class="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                            <div class="flex items-center gap-2 flex-1 min-w-0">
                                <mat-icon class="text-gray-600 !text-base">{{ dialog.icon }}</mat-icon>
                                <span class="text-sm font-bold text-black truncate flex-1">{{ dialog.title }}</span>

                                <!-- Status Badge -->
                                <span [ngClass]="getStatusClass(dialog.status)"
                                      class="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {{ getStatusLabel(dialog.status) }}
                                </span>
                            </div>

                            <!-- Close Button -->
                            <button mat-icon-button
                                    (click)="closeDialog($event, dialog.id)"
                                    class="!w-5 !h-5 !min-w-0 -mr-1"
                                    matTooltip="Cerrar">
                                <mat-icon class="!text-base text-gray-600 hover:text-red-600">close</mat-icon>
                            </button>
                        </div>
                    </div>
                </div>
            }
        </div>
    `,
    styles: [`
        :host {
            display: block;
        }

        @keyframes slide-up {
            from {
                transform: translateY(100%);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }

        .animate-slide-up {
            animation: slide-up 0.3s ease-out;
        }
    `]
})
export class MinimizedDialogsBarComponent {
    private minimizedDialogsService = inject(MinimizedDialogsService);

    minimizedDialogs = this.minimizedDialogsService.getMinimizedDialogs();

    restoreDialog(dialogId: string): void {
        this.minimizedDialogsService.restoreDialog(dialogId);
    }

    closeDialog(event: Event, dialogId: string): void {
        event.stopPropagation();
        this.minimizedDialogsService.removeDialog(dialogId);
    }

    getStatusClass(status: string): string {
        const classes: { [key: string]: string } = {
            'draft': 'bg-gray-300 text-black border-2 border-black',
            'in-progress': 'bg-yellow-300 text-black border-2 border-black',
            'completed': 'bg-green-400 text-black border-2 border-black'
        };
        return classes[status] || 'bg-gray-300 text-black';
    }

    getStatusLabel(status: string): string {
        const labels: { [key: string]: string } = {
            'draft': 'BORRADOR',
            'in-progress': 'EN PROCESO',
            'completed': 'COMPLETADO'
        };
        return labels[status] || status.toUpperCase();
    }
}
