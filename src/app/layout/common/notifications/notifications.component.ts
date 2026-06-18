import { Component, OnInit, signal, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { ToolService } from 'app/core/services/tool.service';
import { QuarantineService } from 'app/core/services/quarantine.service';
import { MiscelaneosService } from 'app/core/services/miscelaneos.service';

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
    private router            = inject(Router);
    private dialog            = inject(MatDialog);
    private toolService       = inject(ToolService);
    private quarantineService = inject(QuarantineService);
    private miscelaneosService = inject(MiscelaneosService);

    @ViewChild('dialogTemplate') dialogTemplate!: TemplateRef<any>;

    alerts        = signal<ToolAlert[]>([]);
    unreadCount   = signal(0);
    criticalCount = signal(0);
    loading       = signal(false);

    ngOnInit(): void {
        this.loadAlerts();
    }

    loadAlerts(): void {
        this.loading.set(true);

        forkJoin({
            tools:       this.toolService.getToolsRequiringCalibration().pipe(catchError(() => of([]))),
            quarantine:  this.quarantineService.getActiveQuarantines().pipe(catchError(() => of([]))),
            miscelaneos: this.miscelaneosService.getMiscelaneos().pipe(catchError(() => of([]))),
        }).pipe(
            finalize(() => this.loading.set(false))
        ).subscribe(({ tools, quarantine, miscelaneos }) => {

            const data: ToolAlert[] = [];

            // El backend retorna todas las herramientas con requires_calibration=true.
            // days_to_calibration_expiry llega como string desde pxp.
            const expired  = tools.filter((t: any) => parseInt(t.days_to_calibration_expiry, 10) < 0);
            const upcoming = tools.filter((t: any) => {
                const d = parseInt(t.days_to_calibration_expiry, 10);
                return !isNaN(d) && d >= 0 && d <= 60;
            });

            if (expired.length > 0) {
                data.push({
                    id:          'cal-expired',
                    priority:    'critical',
                    title:       'CALIBRACIONES VENCIDAS',
                    description: `${expired.length} herramienta${expired.length > 1 ? 's' : ''} con calibración vencida.`,
                    count:       expired.length,
                    time:        'Urgente',
                    link:        '/calibraciones',
                    icon:        'heroicons_outline:wrench-screwdriver',
                });
            }

            if (upcoming.length > 0) {
                data.push({
                    id:          'cal-upcoming',
                    priority:    'high',
                    title:       'CALIBRACIONES PRÓXIMAS',
                    description: `${upcoming.length} herramienta${upcoming.length > 1 ? 's' : ''} vencen en menos de 60 días.`,
                    count:       upcoming.length,
                    time:        'Próximas',
                    link:        '/calibraciones',
                    icon:        'heroicons_outline:clock',
                });
            }

            // Solo cuarentenas no resueltas/cerradas
            const activeQ = quarantine.filter(
                (q: any) => q.status !== 'resolved' && q.status !== 'closed'
            );
            if (activeQ.length > 0) {
                data.push({
                    id:          'quarantine',
                    priority:    'medium',
                    title:       'EN CUARENTENA',
                    description: `${activeQ.length} herramienta${activeQ.length > 1 ? 's' : ''} en revisión de cuarentena.`,
                    count:       activeQ.length,
                    time:        'Activo',
                    link:        '/inventario',
                    icon:        'heroicons_outline:exclamation-triangle',
                });
            }

            const lowStock = miscelaneos.filter((m: any) => m.stockMin > 0 && m.stock <= m.stockMin);
            if (lowStock.length > 0) {
                data.push({
                    id:          'stock-low',
                    priority:    'low',
                    title:       'STOCK BAJO',
                    description: `${lowStock.length} misceláneo${lowStock.length > 1 ? 's' : ''} por debajo del mínimo.`,
                    count:       lowStock.length,
                    time:        'Hoy',
                    link:        '/miscelaneos',
                    icon:        'heroicons_outline:archive-box',
                });
            }

            this.updateData(data);
        });
    }

    updateData(data: ToolAlert[]): void {
        this.alerts.set(data);
        this.unreadCount.set(data.length);
        this.criticalCount.set(data.filter(x => x.priority === 'critical' || x.priority === 'high').length);
    }

    openDialog(): void {
        this.loadAlerts();
        this.dialog.open(this.dialogTemplate, {
            panelClass: 'no-padding-dialog',
            hasBackdrop: true,
            autoFocus:  false,
            width:      '480px',
            maxWidth:   '95vw',
        });
    }

    closeDialog(): void {
        this.dialog.closeAll();
    }

    navigateToAlert(alert: ToolAlert): void {
        this.closeDialog();
        if (alert.link) this.router.navigate([alert.link]);
    }

    dismissAlert(event: Event, id: string): void {
        event.stopPropagation();
        const current = this.alerts().filter(x => x.id !== id);
        this.updateData(current);
    }

    markAllAsRead(): void {
        this.unreadCount.set(0);
    }

    goToNotificationCenter(): void {
        this.closeDialog();
        this.router.navigate(['/dashboard']);
    }

    getPriorityClass(priority: string): string {
        return `priority-${priority}`;
    }

    getPriorityLabel(priority: string): string {
        const map: Record<string, string> = { critical: 'CRÍTICO', high: 'ALTO', medium: 'MEDIO', low: 'BAJO' };
        return map[priority] || 'INFO';
    }
}
