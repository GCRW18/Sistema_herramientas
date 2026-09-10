import { Injectable, inject } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

/** 'YYYY-MM-DD' → Date en hora local (evita el corrimiento de un día de new Date('YYYY-MM-DD')). */
function parseYMD(s: string | null | undefined): Date | null {
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

const MS_DAY = 86400000;

/** Completa days_overdue / days_loaned (no los calcula ninguna transacción SQL). */
function enrichLoanRow(r: any): any {
    const loan     = parseYMD(r.loan_date);
    const expected = parseYMD(r.expected_return_date);
    const actual   = parseYMD(r.actual_return_date);
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    return {
        ...r,
        days_loaned:  loan ? Math.max(0, Math.floor(((actual ?? today).getTime() - loan.getTime()) / MS_DAY)) : null,
        days_overdue: (expected && !actual)
            ? Math.max(0, Math.floor((today.getTime() - expected.getTime()) / MS_DAY))
            : 0,
    };
}
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
        return this._req<LoanReporteRow>('herramientas/reportes/listarReportePrestamos', f)
            .pipe(map(rows => rows.map(enrichLoanRow)));
    }

    getReporteDeudores(f: FiltrosReporte = {}): Observable<LoanReporteRow[]> {
        return this._req<LoanReporteRow>('herramientas/reportes/listarReporteDeudores', f)
            .pipe(map(rows => rows.map(enrichLoanRow)));
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

    /* ── Exportación ──────────────────────────────────────────────────── */

    // Normaliza la respuesta pXP de los endpoints PDF (pdf_base64). El componente
    // reserva la pestaña en el gesto del click y la vuelca al llegar (anti pop-up blocker).
    private _pdfReq(endpoint: string, params: any, fallbackName: string): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return from(this._api.post(endpoint, params)).pipe(
            switchMap((r: any) => {
                const root = r?.ROOT ?? r ?? {};
                const mensaje = root?.detalle?.mensaje ?? root?.mensaje ?? r?.mensaje;
                if (root?.error === true || r?.error === true) {
                    throw new Error(mensaje || 'Error al generar el reporte');
                }
                const row: any = this._norm(r)?.[0];
                if (!row?.pdf_base64) throw new Error(mensaje || 'El servidor no devolvió el PDF');
                return of({
                    pdf_base64: row.pdf_base64 as string,
                    nombre_archivo: row.nombre_archivo || fallbackName,
                });
            }),
            catchError(e => { console.error(endpoint, e); throw e; })
        );
    }

    // Centro de Reportes: TCPDF vía RReporteInventarioTabular. `titulo`/`mgh_code`/`columnas` (JSON).
    exportarPDF(tipoReporte: string, filtros: FiltrosReporte = {}): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        const params = {
            tipo_reporte: tipoReporte,
            cantidad: '2000',
            puntero:  '0',
            ...Object.fromEntries(
                Object.entries(filtros)
                    .filter(([, v]) => v !== undefined && v !== null)
                    .map(([k, v]) => [k, String(v)])
            )
        };
        return this._pdfReq('herramientas/reportes/exportarPDF', params, `${tipoReporte}.pdf`);
    }

    // Inventario Unificado (Consultar Inventario): filas ya combinadas en el front.
    exportarPdfTabular(titulo: string, mghCode: string, columnas: any[], filas: any[]):
        Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return this._pdfReq('herramientas/reportes/generarPDFTabularCustom', {
            titulo, mgh_code: mghCode,
            columnas: JSON.stringify(columnas),
            filas: JSON.stringify(filas),
        }, 'inventario_unificado.pdf');
    }

    // Ficha de Inventario individual (herramienta / kit / misceláneo).
    exportarPdfFicha(titulo: string, codigo: string, subtitulo: string, campos: [string, string][], tablas: any[]):
        Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return this._pdfReq('herramientas/reportes/generarPDFFichaInventario', {
            titulo, codigo, subtitulo,
            campos: JSON.stringify(campos),
            tablas: JSON.stringify(tablas),
        }, `ficha_${codigo}.pdf`);
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
