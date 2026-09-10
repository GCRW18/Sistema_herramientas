import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
    part_number: string;
    category: string;
    warehouse: string;
    ubicacion: string;
    calibration_expiry: string;
    days_remaining: number;
    urgency: string;
}

type RangeKey = 'all' | 'expired' | '4d' | '7d' | '15d' | '30d' | '90d';

@Component({
    selector: 'app-dashboard-alertas',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule
    ],
    templateUrl: './dashboard-alertas.component.html',
    styles: [`
        :host { display: block; height: 100%; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }

        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
    `]
})
export class DashboardAlertasComponent implements OnInit, OnDestroy {
    private calibrationService = inject(CalibrationService);
    private _unsubscribeAll = new Subject<void>();

    isLoading = false;

    allAlerts: AlertItem[] = [];
    filteredAlerts: AlertItem[] = [];
    selectedRange: RangeKey = 'all';

    pageSize = 10;
    pageIndex = 0;

    ngOnInit(): void {
        this.loadAlerts();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // ── Carga de alertas ────────────────────────────────────────────────────────
    loadAlerts(): void {
        this.isLoading = true;
        this.pageIndex = 0;

        this.calibrationService.getCalibrationAlertsPxp({ start: 0, limit: 1000 }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (alertsRes: any) => {
                const rawAlerts: any[] = Array.isArray(alertsRes)
                    ? alertsRes
                    : (alertsRes?.datos || alertsRes?.data || []);

                this.allAlerts = rawAlerts.map((item: any) => {
                    const rack  = item.rack_code  || '';
                    const level = item.level_code || '';
                    return {
                        tool_code:          item.tool_code  || '—',
                        tool_name:          item.tool_name  || '—',
                        serial_number:      item.serial_number || '—',
                        part_number:        item.part_number  || '—',
                        category:           item.category_name || item.category || '',
                        warehouse:          item.warehouse     || '—',
                        ubicacion:          rack && level ? `${rack} - ${level}` : rack || level || '—',
                        calibration_expiry: this.formatDate(item.next_calibration_date),
                        days_remaining:     item.days_until_calibration ?? 0,
                        urgency:            item.alert_type || 'UPCOMING_30D',
                    };
                });
                this.applyRangeFilter();
            },
            error: (err) => {
                console.error('Error cargando alertas:', err);
                this.allAlerts = [];
                this.filteredAlerts = [];
            }
        });
    }

    // ── Filtro por rango de días ────────────────────────────────────────────────
    applyRangeFilter(): void {
        this.pageIndex = 0;
        const a = this.allAlerts;
        switch (this.selectedRange) {
            case 'expired':
                this.filteredAlerts = a.filter(x => x.days_remaining <= 0);
                break;
            case '4d':
                this.filteredAlerts = a.filter(x => x.days_remaining >= 1 && x.days_remaining <= 4);
                break;
            case '7d':
                this.filteredAlerts = a.filter(x => x.days_remaining >= 1 && x.days_remaining <= 7);
                break;
            case '15d':
                this.filteredAlerts = a.filter(x => x.days_remaining >= 1 && x.days_remaining <= 15);
                break;
            case '30d':
                this.filteredAlerts = a.filter(x => x.days_remaining >= 1 && x.days_remaining <= 30);
                break;
            case '90d':
                this.filteredAlerts = a.filter(x => x.days_remaining >= 1 && x.days_remaining <= 90);
                break;
            default:
                this.filteredAlerts = [...a];
        }
    }

    // ── Paginación ──────────────────────────────────────────────────────────────
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

    // ── KPI Conteos ─────────────────────────────────────────────────────────────
    countRange(range: RangeKey): number {
        switch (range) {
            case 'expired': return this.allAlerts.filter(x => x.days_remaining <= 0).length;
            case '4d':      return this.allAlerts.filter(x => x.days_remaining >= 1 && x.days_remaining <= 4).length;
            case '7d':      return this.allAlerts.filter(x => x.days_remaining >= 1 && x.days_remaining <= 7).length;
            case '15d':     return this.allAlerts.filter(x => x.days_remaining >= 1 && x.days_remaining <= 15).length;
            case '30d':     return this.allAlerts.filter(x => x.days_remaining >= 1 && x.days_remaining <= 30).length;
            case '90d':     return this.allAlerts.filter(x => x.days_remaining >= 1 && x.days_remaining <= 90).length;
            default:        return 0;
        }
    }

    // ── Impresión ───────────────────────────────────────────────────────────────
    // MGH-102 — Listado de herramientas sujetas a calibración (PDF real vía backend),
    // respetando el rango de días seleccionado en pantalla.
    printAlerts(): void {
        this.isLoading = true;
        this.calibrationService.generarPdfAlertasCalibracion(this.selectedRange).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false),
        ).subscribe({
            next: (r) => this.calibrationService.abrirPdf(r.pdf_base64, r.nombre_archivo),
            error: (e) => console.error('Error al generar el listado de alertas:', e),
        });
    }

    // MGH-104 — Próximas a vencer por días de holgura (PDF real vía backend).
    printVencerHolgura(): void {
        this.isLoading = true;
        this.calibrationService.generarPdfVencerHolgura(60).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false),
        ).subscribe({
            next: (r) => this.calibrationService.abrirPdf(r.pdf_base64, r.nombre_archivo),
            error: (e) => console.error('Error al generar MGH-104:', e),
        });
    }

    // MGH-123 — Reporte mensual de próximas a vencer (PDF real vía backend).
    printVencerMensual(): void {
        this.isLoading = true;
        this.calibrationService.generarPdfVencerMensual(30).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false),
        ).subscribe({
            next: (r) => this.calibrationService.abrirPdf(r.pdf_base64, r.nombre_archivo),
            error: (e) => console.error('Error al generar MGH-123:', e),
        });
    }

    // ── Estilos Visuales ────────────────────────────────────────────────────────
    getUrgencyClass(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED':       return 'bg-red-100 text-red-800 border-red-200';
            case 'CRITICAL_7D':   return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'URGENT_15D':    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'UPCOMING_30D':  return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'UPCOMING_90D':  return 'bg-sky-100 text-sky-800 border-sky-200';
            default:              return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    }

    getUrgencyLabel(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED':       return 'VENCIDA';
            case 'CRITICAL_7D':   return 'CRÍTICA 7D';
            case 'URGENT_15D':    return 'URGENTE 15D';
            case 'UPCOMING_30D':  return 'PRÓXIMA 30D';
            case 'UPCOMING_90D':  return 'PRÓXIMA 90D';
            default:              return urgency;
        }
    }

    getDaysColor(days: number): string {
        if (days <= 4) return 'bg-red-100 text-red-800 border-red-200';
        if (days <= 7) return 'bg-orange-100 text-orange-800 border-orange-200';
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }

    private formatDate(date: string): string {
        if (!date) return '—';
        // Texto puro (YYYY-MM-DD → DD/MM/YYYY), no new Date(): una fecha "solo fecha" se
        // interpreta como medianoche UTC, que en Bolivia (UTC-4) muestra el día anterior.
        const parts = String(date).split('T')[0].split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
    }
}
