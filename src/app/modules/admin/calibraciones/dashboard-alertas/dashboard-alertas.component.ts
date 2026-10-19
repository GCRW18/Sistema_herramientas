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
    en_laboratorio: boolean;
}

type RangeKey = 'all' | 'expired' | '4d' | '7d' | '15d' | '30d' | '90d' | 'in_lab';

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

    // Parámetros de los PDF MGH-104 (días de holgura) y MGH-123 (mes YYYY-MM).
    diasHolgura = 60;
    periodoMensual = this._mesActual();

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

        this.calibrationService.getCalibrationAlertsPxp().pipe(
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
                        days_remaining:     Number(item.days_until_calibration ?? 0),
                        urgency:            item.alert_type || 'UPCOMING_30D',
                        // Ya está en el laboratorio: no es una alerta por atender.
                        en_laboratorio:     ['in_calibration', 'CALIBRACION'].includes(item.status) || item.id_calibration != null,
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
    // Mismas reglas que ACTreportes::generarPDFAlertasCalibracion: vencida = días < 0 (el
    // candado de calibración la da por válida hasta el día de vencimiento inclusive).
    private _enRango(x: AlertItem, range: RangeKey): boolean {
        const d = x.days_remaining;
        const tope: Record<string, number> = { '4d': 4, '7d': 7, '15d': 15, '30d': 30, '90d': 90 };
        switch (range) {
            case 'all':     return true;
            case 'in_lab':  return x.en_laboratorio;
            case 'expired': return !x.en_laboratorio && d < 0;
            default:        return !x.en_laboratorio && d >= 0 && d <= tope[range];
        }
    }

    applyRangeFilter(): void {
        this.pageIndex = 0;
        this.filteredAlerts = this.allAlerts.filter(x => this._enRango(x, this.selectedRange));
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
        return range === 'all' ? 0 : this.allAlerts.filter(x => this._enRango(x, range)).length;
    }

    // ── Impresión ───────────────────────────────────────────────────────────────
    // La pestaña se reserva dentro del click; si no, el bloqueador corta el PDF que llega
    // después del request.
    private _imprimir(obs: any, etiqueta: string): void {
        const win = this.calibrationService.preAbrirVentanaPdf();
        this.isLoading = true;
        obs.pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false),
        ).subscribe({
            next: (r: any) => this.calibrationService.abrirPdf(r.pdf_base64, r.nombre_archivo, win),
            error: (e: any) => {
                try { win?.close(); } catch { /* noop */ }
                console.error(`Error al generar ${etiqueta}:`, e);
            },
        });
    }

    // MGH-102 — Listado de herramientas sujetas a calibración con el rango de la pantalla.
    printAlerts(): void {
        this._imprimir(this.calibrationService.generarPdfAlertasCalibracion(this.selectedRange, this._currentUser()), 'MGH-102');
    }

    // MGH-104 — Próximas a vencer por días de holgura.
    printVencerHolgura(): void {
        const dias = Math.trunc(Number(this.diasHolgura));
        this.diasHolgura = dias > 0 ? Math.min(dias, 3650) : 60;
        this._imprimir(this.calibrationService.generarPdfVencerHolgura(this.diasHolgura, this._currentUser()), 'MGH-104');
    }

    // MGH-123 — Reporte mensual de próximas a vencer (vencen en el mes + ya vencidas).
    printVencerMensual(): void {
        if (!/^\d{4}-\d{2}$/.test(this.periodoMensual || '')) this.periodoMensual = this._mesActual();
        this._imprimir(this.calibrationService.generarPdfVencerMensual(this.periodoMensual, this._currentUser()), 'MGH-123');
    }

    private _currentUser(): string {
        try { return JSON.parse(localStorage.getItem('aut') || '{}')?.nombre_usuario || ''; } catch { return ''; }
    }

    private _mesActual(): string {
        const h = new Date();
        return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
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
