import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

export interface AlertItem {
    tool_code: string;
    tool_name: string;
    serial_number: string;
    category: string;
    warehouse: string;
    calibration_expiry: string;
    days_remaining: number;
    urgency: string;
    is_jack: boolean;
}

@Component({
    selector: 'app-dashboard-alertas',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule
    ],
    templateUrl: './dashboard-alertas.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #0F172AFF; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #1e293b; }
        .dark .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #e94125; }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .animate-pulse-fast { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    `]
})
export class DashboardAlertasComponent implements OnInit, OnDestroy {
    private router = inject(Router);
    private calibrationService = inject(CalibrationService);
    private _unsubscribeAll = new Subject<void>();

    isLoading = false;

    // ── Alertas Data & Paginación ───────────────────────────────────────────────
    allAlerts: AlertItem[] = [];
    filteredAlerts: AlertItem[] = [];
    selectedUrgency = 'all';

    // 5 líneas máximo para no requerir scroll vertical
    pageSize = 5;
    pageIndex = 0;

    ngOnInit(): void {
        this.loadAlerts();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    goBack(): void {
        this.router.navigate(['/']);
    }

    // ── Lógica de Carga ─────────────────────────────────────────────────────────
    loadAlerts(): void {
        this.isLoading = true;
        this.pageIndex = 0;

        this.calibrationService.getCalibrationAlertsPxp({ start: 0, limit: 1000 }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (res: any) => {
                const rawAlerts: any[] = Array.isArray(res) ? res : (res?.datos || res?.data || []);

                this.allAlerts = rawAlerts.map((item: any) => ({
                    tool_code: item.tool_code || item.codigo,
                    tool_name: item.tool_name || item.nombre,
                    serial_number: item.serial_number || item.serie,
                    category: item.category || '',
                    warehouse: item.warehouse || item.almacen || '—',
                    calibration_expiry: this.formatDate(item.next_calibration_date || item.calibration_expiry),
                    days_remaining: item.days_until_calibration ?? item.days_remaining ?? 0,
                    urgency: item.alert_type || item.urgency || 'UPCOMING_30D',
                    is_jack: item.is_jack || false
                }));
                this.applyUrgencyFilter();
            },
            error: (err) => {
                console.error('Error sincronizando alertas:', err);
                this.allAlerts = [];
                this.filteredAlerts = [];
            }
        });
    }

    applyUrgencyFilter(): void {
        this.pageIndex = 0;
        this.filteredAlerts = this.selectedUrgency !== 'all'
            ? this.allAlerts.filter(a => a.urgency === this.selectedUrgency)
            : [...this.allAlerts];
    }

    // ── Paginación Helpers ──────────────────────────────────────────────────────
    get totalRecords(): number { return this.filteredAlerts.length; }
    get totalPages(): number { return Math.ceil(this.totalRecords / this.pageSize) || 1; }
    get startIndex(): number { return this.totalRecords === 0 ? 0 : (this.pageIndex * this.pageSize) + 1; }
    get endIndex(): number { return Math.min((this.pageIndex + 1) * this.pageSize, this.totalRecords); }

    get paginatedAlerts(): AlertItem[] {
        const start = this.pageIndex * this.pageSize;
        return this.filteredAlerts.slice(start, start + this.pageSize);
    }

    nextPage(): void { if (this.pageIndex < this.totalPages - 1) this.pageIndex++; }
    prevPage(): void { if (this.pageIndex > 0) this.pageIndex--; }


    // ── Conteo para KPIs en Header ──────────────────────────────────────────────
    countUrgency(urgency: string): number {
        return this.allAlerts.filter(a => a.urgency === urgency).length;
    }

    // ── Estilos Visuales (Neo-Brutalism) ────────────────────────────────────────
    getUrgencyClass(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED': return 'bg-red-100 text-red-800 border-red-200';
            case 'CRITICAL_7D': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'URGENT_15D': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'UPCOMING_30D': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'IN_LAB': return 'bg-purple-100 text-purple-800 border-purple-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    }

    getUrgencyLabel(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED': return 'VENCIDA';
            case 'CRITICAL_7D': return 'CRÍTICA 7D';
            case 'URGENT_15D': return 'URGENTE 15D';
            case 'UPCOMING_30D': return 'PRÓXIMA 30D';
            case 'IN_LAB': return 'EN LAB';
            default: return urgency;
        }
    }

    getDaysColor(days: number): string {
        if (days <= 0) return 'text-red-600 dark:text-red-400';
        if (days <= 7) return 'text-orange-600 dark:text-orange-400';
        return 'text-amber-600 dark:text-amber-400';
    }

    private formatDate(date: string): string {
        if (!date) return '—';
        try { return new Date(date).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
        catch { return date; }
    }
}
