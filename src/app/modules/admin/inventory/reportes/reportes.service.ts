import { Injectable, inject } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ErpApiService } from '../../../../core/api/api.service';

/* ── Filtros genéricos ─────────────────────────────────────────────────── */
export interface FiltrosReporte {
    fechaDesde?:    string;
    fechaHasta?:    string;
    warehouseId?:   number;
    status?:        string;
    diasHolgura?:   number;
    tipo?:          string;
    limit?:         number;
    start?:         number;
    [key: string]:  any;
}

/* ── Row types ─────────────────────────────────────────────────────────── */
export interface ToolReporteRow {
    code:                      string;
    name:                      string;
    part_number:               string;
    serial_number:             string;
    brand:                     string;
    model:                     string;
    status:                    string;
    condition:                 string;
    warehouse_id:              number;
    location_id:               number;
    requires_calibration:      boolean;
    next_calibration_date:     string;
    last_calibration_date:     string;
    calibration_interval:      number;
    days_to_calibration_expiry: number;
    sent_to_calibration:       boolean;
    manufacture_origin:        string;
    quantity_in_stock:         number;
    content_list:              string;
    unit_of_measure:           string;
    notes:                     string;
}

export interface LoanReporteRow {
    loan_number:           string;
    borrower_name:         string;
    borrower_license:      string;
    aircraft:              string;
    work_order_number:     string;
    task_description:      string;
    loan_date:             string;
    expected_return_date:  string;
    actual_return_date:    string;
    days_loaned:           number;
    days_overdue:          number;
    status:                string;
    delivered_by_name:     string;
    loan_type:             string;
    loan_notes:            string;
}

export interface MiscStockRow {
    code:             string;
    name:             string;
    brand:            string;
    part_number:      string;
    item_type:        string;
    quantity_in_stock: number;
    stock_min:        number;
    stock_max:        number;
    unit_of_measure:  string;
    location_name:    string;
    under_min:        boolean;
}

export interface MiscMovRow {
    movement_number:   string;
    type:              string;
    date:              string;
    time:              string;
    miscelaneo_code:   string;
    miscelaneo_name:   string;
    quantity:          number;
    unit_of_measure:   string;
    name:              string;
    license_number:    string;
    area:              string;
    work_order_number: string;
    aircraft:          string;
    authorized_by:     string;
    supplier:          string;
    invoice_number:    string;
    reason:            string;
}

export interface KitReporteRow {
    code:                    string;
    name:                    string;
    category:                string;
    status:                  string;
    is_complete:             boolean;
    present_components:      number;
    total_components:        number;
    completeness_percentage: number;
    funcionario_nombre:      string;
    location_name:           string;
}

export interface MovReporteRow {
    movement_number:   string;
    date:              string;
    type:              string;
    tool_code:         string;
    tool_name:         string;
    part_number:       string;
    serial_number:     string;
    quantity:          number;
    responsible_name:  string;
    area:              string;
    aircraft:          string;
    work_order:        string;
    notes:             string;
}

export interface DashboardStats {
    total_herramientas:        number;
    herramientas_disponibles:  number;
    herramientas_prestadas:    number;
    herramientas_calibracion:  number;
    herramientas_cuarentena:   number;
    herramientas_vencen_30:    number;
    kits_activos:              number;
    misc_bajo_stock:           number;
    deudores_activos:          number;
    enviadas_calibracion:      number;
    traspasos_mes:             number;
    bajas_mes:                 number;
}

/* ─────────────────────────────────────────────────────────────────────── */

@Injectable({ providedIn: 'root' })
export class ReportesService {

    private _api = inject(ErpApiService);

    /* ── helpers ──────────────────────────────────────────────────────── */
    private _norm(r: any): any[] {
        if (!r) return [];
        const x = (d: any) => !d || d === '' ? [] : Array.isArray(d) ? d : [d];
        if (r?.ROOT?.datos !== undefined) return x(r.ROOT.datos);
        if (r?.datos !== undefined)       return x(r.datos);
        if (r?.data !== undefined)        return x(r.data);
        if (Array.isArray(r))             return r;
        return [];
    }

    private _req<T>(url: string, params: any = {}): Observable<T[]> {
        const p = { start: params.start ?? 0, limit: params.limit ?? 1000, ...params };
        return from(this._api.post(url, p)).pipe(
            switchMap((r: any) => {
                // pxp-client strips ROOT → response is { datos, total, error }
                // Mirrors the proven pattern: response?.datos || response?.data || []
                const raw = r?.datos ?? r?.data ?? r?.ROOT?.datos;
                if (!raw || raw === '' || raw === 0) return of([] as T[]);
                const arr = Array.isArray(raw) ? raw : [raw];
                return of(arr as T[]);
            }),
            catchError(e => { console.error('[ReportesService]', url, e); return of([] as T[]); })
        );
    }

    /* ── Inventario / Herramientas ────────────────────────────────────── */

    getReporteHerramientas(f: FiltrosReporte = {}): Observable<ToolReporteRow[]> {
        return this._req<ToolReporteRow>('herramientas/reportes/listarReporteHerramientas', f);
    }

    getReporteCalibracion(f: FiltrosReporte = {}): Observable<ToolReporteRow[]> {
        return this._req<ToolReporteRow>('herramientas/reportes/listarReporteCalibracion', f);
    }

    getReporteProximasVencer(diasHolgura = 60, f: FiltrosReporte = {}): Observable<ToolReporteRow[]> {
        return this._req<ToolReporteRow>('herramientas/reportes/listarReporteProximasVencer',
            { ...f, dias_holgura: diasHolgura });
    }

    getReporteVencidas(f: FiltrosReporte = {}): Observable<ToolReporteRow[]> {
        return this._req<ToolReporteRow>('herramientas/reportes/listarReporteVencidas', f);
    }

    getReporteEnviadasCalibracion(f: FiltrosReporte = {}): Observable<ToolReporteRow[]> {
        return this._req<ToolReporteRow>('herramientas/reportes/listarReporteEnviadasCalibracion', f);
    }

    /* ── Préstamos / Deudores ─────────────────────────────────────────── */

    getReportePrestamos(f: FiltrosReporte = {}): Observable<LoanReporteRow[]> {
        return this._req<LoanReporteRow>('herramientas/reportes/listarReportePrestamos', f);
    }

    getReporteDeudores(f: FiltrosReporte = {}): Observable<LoanReporteRow[]> {
        return this._req<LoanReporteRow>('herramientas/reportes/listarReporteDeudores', f);
    }

    /* ── Misceláneos ──────────────────────────────────────────────────── */

    getReporteMiscelaneos(f: FiltrosReporte = {}): Observable<MiscStockRow[]> {
        return this._req<MiscStockRow>('herramientas/reportes/listarReporteMiscelaneos', f);
    }

    getReporteMovimientosMisc(tipo: 'ENTRADA' | 'SALIDA' | 'TODOS', f: FiltrosReporte = {}): Observable<MiscMovRow[]> {
        return this._req<MiscMovRow>('herramientas/reportes/listarReporteSalidasMisc',
            { ...f, tipo_movimiento: tipo });
    }

    /* ── Kits ─────────────────────────────────────────────────────────── */

    getReporteKits(f: FiltrosReporte = {}): Observable<KitReporteRow[]> {
        return this._req<KitReporteRow>('herramientas/reportes/listarReporteKits', f);
    }

    /* ── Movimientos generales ────────────────────────────────────────── */

    getReporteMovimientos(tipo: string, f: FiltrosReporte = {}): Observable<MovReporteRow[]> {
        return this._req<MovReporteRow>('herramientas/reportes/listarReporteMovimientos',
            { ...f, tipo_movimiento: tipo });
    }

    /* ── Dashboard stats ──────────────────────────────────────────────── */

    getDashboardStats(): Observable<DashboardStats> {
        return from(this._api.post('herramientas/reportes/getDashboardStats', { start: 0, limit: 1 })).pipe(
            switchMap((r: any) => of((this._norm(r)?.[0] ?? {}) as DashboardStats)),
            catchError(() => of({} as DashboardStats))
        );
    }

    /* ── Exportación ──────────────────────────────────────────────────── */

    exportarPDF(tipoReporte: string, filtros: FiltrosReporte = {}): void {
        // Usa POST autenticado → recibe JSON con html_content → abre como blob
        const params = {
            tipo_reporte: tipoReporte,
            cantidad: '5000',
            puntero:  '0',
            ...Object.fromEntries(
                Object.entries(filtros)
                    .filter(([, v]) => v !== undefined && v !== null)
                    .map(([k, v]) => [k, String(v)])
            )
        };
        from(this._api.post('herramientas/reportes/exportarPDF', params)).pipe(
            switchMap((r: any) => {
                const html: string = this._norm(r)?.[0]?.html_content ?? '';
                if (html) {
                    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
                    const url  = URL.createObjectURL(blob);
                    const win  = window.open(url, '_blank');
                    if (!win) console.warn('Permita ventanas emergentes para ver el reporte PDF');
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                } else {
                    console.error('exportarPDF: respuesta vacía del servidor', r);
                }
                return of(null);
            }),
            catchError(e => { console.error('exportarPDF', e); return of(null); })
        ).subscribe();
    }

    exportarExcel(data: any[], columnas: { key: string; header: string }[], archivo = 'reporte'): void {
        if (!data?.length) return;
        const headers = columnas.map(c => c.header).join(';');
        const rows = data.map(row =>
            columnas.map(c => {
                const v = row[c.key] ?? '';
                return `"${String(v).replace(/"/g, '""')}"`;
            }).join(';')
        );
        const csv  = '﻿' + [headers, ...rows].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${archivo}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
