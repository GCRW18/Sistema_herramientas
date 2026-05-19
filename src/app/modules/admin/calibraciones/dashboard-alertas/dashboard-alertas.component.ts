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
            case 'in_lab':
                this.filteredAlerts = a.filter(x => x.urgency === 'IN_LAB');
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
            case 'in_lab':  return this.allAlerts.filter(x => x.urgency === 'IN_LAB').length;
            default:        return 0;
        }
    }

    // ── Impresión ───────────────────────────────────────────────────────────────
    printAlerts(): void {
        const now = new Date().toLocaleDateString('es-BO', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const rangeLabel = this.getRangeLabel(this.selectedRange);

        const rows = this.filteredAlerts.map((a, i) => `
            <tr class="${a.days_remaining <= 0 ? 'row-expired' : a.days_remaining <= 4 ? 'row-critical' : ''}">
                <td class="text-center">${i + 1}</td>
                <td><span class="badge badge-${this.getUrgencyBadgeKey(a.urgency)}">${this.getUrgencyLabel(a.urgency)}</span></td>
                <td class="mono">${a.tool_code || '—'}</td>
                <td class="mono">${a.part_number || '—'}</td>
                <td>${a.tool_name || '—'}</td>
                <td class="mono">${a.serial_number || '—'}</td>
                <td>${a.warehouse || '—'}</td>
                <td>${a.ubicacion || '—'}</td>
                <td class="text-center mono">${a.calibration_expiry}</td>
                <td class="text-center font-bold ${a.days_remaining <= 0 ? 'text-expired' : a.days_remaining <= 4 ? 'text-critical' : ''}">
                    ${a.days_remaining <= 0 ? 'VENCIDO' : a.days_remaining + ' días'}
                </td>
            </tr>
        `).join('');

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Alertas de Calibración — ${rangeLabel}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 9px; color: #000; background: #fff; padding: 16px; }
  .header { border: 3px solid #000; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left h1 { font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; }
  .header-left p { font-size: 8px; margin-top: 2px; color: #555; }
  .header-right { text-align: right; }
  .header-right .label { font-size: 7px; font-weight: 700; text-transform: uppercase; color: #888; }
  .header-right .value { font-size: 10px; font-weight: 900; }
  .filter-bar { background: #000; color: #fff; padding: 5px 10px; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; display: flex; justify-content: space-between; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #000; color: #fff; }
  thead th { padding: 5px 6px; font-size: 8px; font-weight: 900; text-transform: uppercase; text-align: left; }
  tbody tr { border-bottom: 1px solid #ddd; }
  tbody tr:nth-child(even) { background: #f9f9f9; }
  tbody tr.row-expired { background: #fef2f2 !important; }
  tbody tr.row-critical { background: #fff7ed !important; }
  td { padding: 4px 6px; font-size: 8.5px; vertical-align: middle; }
  .text-center { text-align: center; }
  .mono { font-family: monospace; }
  .font-bold { font-weight: 700; }
  .text-expired { color: #dc2626; }
  .text-critical { color: #ea580c; }
  .badge { padding: 1px 5px; border: 1.5px solid currentColor; border-radius: 3px; font-size: 7px; font-weight: 900; text-transform: uppercase; display: inline-block; }
  .badge-expired { color: #dc2626; }
  .badge-critical { color: #ea580c; }
  .badge-urgent { color: #ca8a04; }
  .badge-upcoming { color: #2563eb; }
  .badge-inlab { color: #7c3aed; }
  .badge-default { color: #374151; }
  .footer { margin-top: 12px; font-size: 7px; color: #888; text-align: right; border-top: 1px solid #ddd; padding-top: 5px; }
  @media print { body { padding: 8px; } @page { margin: 12mm; size: landscape; } }
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <h1>Alertas de Calibración</h1>
    <p>Sistema de Gestión de Herramientas · MGH-109</p>
  </div>
  <div class="header-right">
    <div class="label">Filtro aplicado</div>
    <div class="value">${rangeLabel}</div>
    <div class="label" style="margin-top:4px">Generado</div>
    <div class="value" style="font-size:8px">${now}</div>
  </div>
</div>
<div class="filter-bar">
  <span>Total registros: ${this.filteredAlerts.length}</span>
  <span>Vencidas: ${this.countRange('expired')} &nbsp;·&nbsp; Próx. 4D: ${this.countRange('4d')} &nbsp;·&nbsp; Próx. 30D: ${this.countRange('30d')} &nbsp;·&nbsp; Próx. 90D: ${this.countRange('90d')}</span>
</div>
<table>
  <thead>
    <tr>
      <th style="width:24px">#</th>
      <th style="width:70px">Estado</th>
      <th style="width:80px">Código</th>
      <th style="width:90px">P/N</th>
      <th>Herramienta</th>
      <th style="width:80px">S/N</th>
      <th style="width:90px">Almacén</th>
      <th style="width:80px">Ubicación</th>
      <th style="width:70px;text-align:center">Vence</th>
      <th style="width:52px;text-align:center">Días</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
<div class="footer">Documento generado el ${now} · Sistema Herramientas</div>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=1050,height=750');
        if (win) {
            win.document.write(html);
            win.document.close();
            setTimeout(() => win.print(), 500);
        }
    }

    private getRangeLabel(range: RangeKey): string {
        const map: Record<RangeKey, string> = {
            all:    'Todas las alertas',
            expired:'Vencidas',
            '4d':   'Próximas 4 días',
            '7d':   'Próximas 7 días',
            '15d':  'Próximas 15 días',
            '30d':  'Próximas 30 días',
            '90d':  'Próximas 90 días',
            in_lab: 'En laboratorio',
        };
        return map[range] ?? 'Todas las alertas';
    }

    // ── Estilos Visuales ────────────────────────────────────────────────────────
    getUrgencyClass(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED':       return 'bg-red-600 text-gray-100 border-black';
            case 'CRITICAL_7D':   return 'bg-orange-500 text-black border-black';
            case 'URGENT_15D':    return 'bg-yellow-400 text-black border-black';
            case 'UPCOMING_30D':  return 'bg-blue-700 text-gray-100 border-black';
            case 'UPCOMING_90D':  return 'bg-sky-600 text-white border-black';
            case 'IN_LAB':        return 'bg-purple-700 text-white border-black';
            default:              return 'bg-gray-100 text-gray-700 border-gray-500';
        }
    }

    getUrgencyLabel(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED':       return 'VENCIDA';
            case 'CRITICAL_7D':   return 'CRÍTICA 7D';
            case 'URGENT_15D':    return 'URGENTE 15D';
            case 'UPCOMING_30D':  return 'PRÓXIMA 30D';
            case 'UPCOMING_90D':  return 'PRÓXIMA 90D';
            case 'IN_LAB':        return 'EN LAB';
            default:              return urgency;
        }
    }

    getUrgencyBadgeKey(urgency: string): string {
        switch (urgency) {
            case 'EXPIRED':       return 'expired';
            case 'CRITICAL_7D':   return 'critical';
            case 'URGENT_15D':    return 'urgent';
            case 'UPCOMING_30D':  return 'upcoming';
            case 'UPCOMING_90D':  return 'upcoming';
            case 'IN_LAB':        return 'inlab';
            default:              return 'default';
        }
    }

    getDaysColor(days: number): string {
        if (days <= 0) return 'text-red-600 dark:text-red-400';
        if (days <= 4) return 'text-red-500 dark:text-red-400';
        if (days <= 7) return 'text-orange-600 dark:text-orange-400';
        return 'text-amber-600 dark:text-amber-400';
    }

    private formatDate(date: string): string {
        if (!date) return '—';
        try { return new Date(date).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
        catch { return date; }
    }
}
