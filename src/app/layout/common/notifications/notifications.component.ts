import { Component, OnInit, signal, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface ToolAlert {
    id: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    count?: number;
    time: string;
    link?: string;
    icon: string;
}

@Component({
    selector: 'notifications',
    standalone: true,
    imports: [
        CommonModule,
        NgClass,
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        MatBadgeModule,
        MatTooltipModule,
    ],
    templateUrl: './notifications.component.html',
    styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
    private router = inject(Router);
    private dialog = inject(MatDialog);

    @ViewChild('dialogTemplate') dialogTemplate!: TemplateRef<any>;

    alerts = signal<ToolAlert[]>([]);
    unreadCount = signal(0);
    criticalCount = signal(0);

    ngOnInit() {
        const data: ToolAlert[] = [
            { id: '1', priority: 'critical', title: 'CALIBRACIONES VENCIDAS', description: '12 herramientas requieren calibración.', count: 12, time: '2h', link: '/inventario', icon: 'heroicons_outline:wrench-screwdriver' },
            { id: '2', priority: 'high', title: 'PRÉSTAMOS VENCIDOS', description: '5 préstamos fuera de fecha.', count: 5, time: '4h', link: '/salidas', icon: 'heroicons_outline:clock' },
            { id: '3', priority: 'medium', title: 'EN CUARENTENA', description: '8 herramientas en revisión.', count: 8, time: 'Ayer', link: '/inventario', icon: 'heroicons_outline:exclamation-triangle' },
            { id: '4', priority: 'low', title: 'STOCK BAJO', description: '3 consumibles bajos.', count: 3, time: '1d', link: '/inventario', icon: 'heroicons_outline:archive-box' }
        ];
        this.updateData(data);
    }

    updateData(data: ToolAlert[]) {
        this.alerts.set(data);
        this.unreadCount.set(data.length);
        this.criticalCount.set(data.filter(x => x.priority === 'critical' || x.priority === 'high').length);
    }

    openDialog() {
        this.dialog.open(this.dialogTemplate, {
            panelClass: 'neo-dialog-container',
            hasBackdrop: true,
            autoFocus: false,
            // IMPORTANTE: maxWidth y width se controlan por CSS para responsividad
            maxWidth: '100vw',
            width: 'auto'
        });
    }

    closeDialog() {
        this.dialog.closeAll();
    }

    navigateToAlert(alert: ToolAlert) {
        this.closeDialog();
        if (alert.link) this.router.navigate([alert.link]);
    }

    dismissAlert(event: Event, id: string) {
        event.stopPropagation();
        const current = this.alerts().filter(x => x.id !== id);
        this.updateData(current);
    }

    markAllAsRead() {
        this.unreadCount.set(0);
    }

    goToNotificationCenter() {
        this.closeDialog();
        this.router.navigate(['/dashboard']);
    }

    getPriorityClass(priority: string) {
        return `priority-${priority}`;
    }

    getPriorityLabel(priority: string) {
        const map: Record<string, string> = { critical: 'CRÍTICO', high: 'ALTO', medium: 'MEDIO', low: 'BAJO' };
        return map[priority] || 'INFO';
    }
}
