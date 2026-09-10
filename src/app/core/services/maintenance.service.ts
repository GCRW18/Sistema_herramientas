import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap, catchError } from 'rxjs';
import { Maintenance } from '../models/maintenance.types';
import { ErpApiService } from '../api/api.service';

/** Respuesta de los endpoints de nota PDF (se genera al vuelo, base64). */
export interface NotaPdfResult {
    pdf_base64?: string;
    nombre_archivo: string;
}

@Injectable({
    providedIn: 'root'
})
export class MaintenanceService {
    private _api = inject(ErpApiService);

    /**
     * Get all maintenance records
     */
    getMaintenances(filters?: any): Observable<Maintenance[]> {
        const params: any = {
            start: 0,
            limit: 50,
            ordenacion: 'id_maintenance',
            dir_ordenacion: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/maintenances/listMaintenances', params)).pipe(
            switchMap((response: any) => {
                const raw: any[] = response?.ROOT?.datos ?? response?.datos ?? response?.data ?? [];
                // ...item primero: preserva TODOS los campos crudos que devuelve el backend
                // (requested_by_name, expected_return_date, preventive_subtype, etc.) — antes
                // se armaba el objeto campo por campo y cualquiera no listado explícitamente
                // se perdía en silencio para los consumidores (consulta-auditoria, registros
                // recientes de calibraciones.component.ts), aunque el backend sí lo mandaba.
                const maintenances = raw.map((item: any) => ({
                    ...item,
                    id: item.id_maintenance,
                    id_maintenance: item.id_maintenance,
                    toolId: item.tool_id,
                    toolCode: item.tool_code || '',
                    toolName: item.tool_name || '',
                    type: item.type,
                    status: item.status,
                    scheduledDate: item.scheduled_date ? new Date(item.scheduled_date) : new Date(),
                    completedDate: item.completion_date ? new Date(item.completion_date) : undefined,
                    technician: item.technician,
                    cost: item.cost,
                    description: item.description,
                    notes: item.notes,
                    createdAt: item.created_at ? new Date(item.created_at) : undefined,
                    updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
                    // campos extra que usa consulta-auditoria / registros recientes
                    record_number: item.record_number,
                    tool_code: item.tool_code || '',
                    tool_name: item.tool_name || '',
                    tool_serial: item.tool_serial,
                    provider: item.provider ?? item.supplier_name,
                    send_date: item.send_date,
                    expected_return_date: item.expected_return_date,
                    actual_return_date: item.actual_return_date,
                    return_date: item.actual_return_date,
                    result: item.result,
                    requested_by_name: item.requested_by_name,
                }));
                return of(maintenances);
            }),
            catchError((error) => { console.error('Error en getMaintenances:', error); return of([] as Maintenance[]); })
        );
    }

    // ── PXP Backend: Flujo de Mantenimiento ─────────────────────────────────

    /**
     * Listar mantenimientos activos (en taller) – HE_MAI_ACTIVE_SEL
     */
    getActiveMaintenancesPxp(): Observable<any[]> {
        return from(this._api.post('herramientas/maintenances/listarMaintenancesActivos', {
            start: 0, limit: 100, ordenacion: 'send_date', dir_ordenacion: 'desc'
        })).pipe(
            switchMap((response: any) => {
                const raw = response?.ROOT?.datos ?? response?.datos ?? [];
                return of(Array.isArray(raw) ? raw : (raw && raw !== '' ? [raw] : []));
            }),
            catchError(() => of([]))
        );
    }

    /**
     * Enviar herramienta a mantenimiento – HE_MAI_SEND
     * Genera correlativo EM-NNNN/YYYY, cambia status tool a 'maintenance'
     */
    sendMaintenancePxp(params: {
        tool_id: number;
        type: string;
        request_date?: string;
        send_date?: string;
        expected_return_date?: string;
        provider?: string;
        provider_contact?: string;
        technician?: string;
        description?: string;
        problem?: string;
        requested_by_name?: string;
        cost?: number;
        notes?: string;
    }): Observable<any> {
        return from(this._api.post('herramientas/maintenances/enviarMantenimiento', params)).pipe(
            switchMap((response: any) => {
                const hasError = response?.ROOT?.error === true || response?.error === true;
                if (hasError) {
                    const msg = response?.ROOT?.detalle?.mensaje || response?.mensaje || 'Error al enviar a mantenimiento';
                    throw new Error(msg);
                }
                const datos = response?.ROOT?.datos || response?.datos;
                return of(datos?.[0] ?? datos ?? response);
            })
        );
    }

    /**
     * Retornar herramienta de mantenimiento – HE_MAI_RETURN
     * Actualiza status tool a 'available', guarda next_maintenance_date
     */
    returnMaintenancePxp(params: {
        id_maintenance: number;
        tool_id: number;
        result: string;
        actual_return_date?: string;
        completion_date?: string;
        solution?: string;
        recommendations?: string;
        received_by_name?: string;
        cost?: number;
        labor_cost?: number;
        parts_cost?: number;
        parts_replaced?: string;
        next_maintenance_date?: string;
        notes?: string;
    }): Observable<any> {
        return from(this._api.post('herramientas/maintenances/retornarMantenimiento', params)).pipe(
            switchMap((response: any) => {
                const hasError = response?.ROOT?.error === true || response?.error === true || response instanceof Error;
                if (hasError) {
                    const msg = response?.ROOT?.detalle?.mensaje || response?.ROOT?.mensaje
                        || response?.mensaje || response?.message || 'Error al retornar mantenimiento';
                    throw new Error(msg);
                }
                const datos = response?.ROOT?.datos ?? response?.datos;
                return of(datos?.[0] ?? datos ?? response);
            })
        );
    }

    // ===================================================================
    // GENERACIÓN DE PDFs para MANTENIMIENTO
    // ===================================================================

    /** Normaliza la respuesta pXP de un endpoint de nota PDF a NotaPdfResult. */
    private _parseNotaResp(response: any, fallbackName: string): NotaPdfResult {
        const root = response?.ROOT ?? response ?? {};
        if (root?.error === true || root?.error === 'true' || response?.error === true) {
            throw new Error(root?.detalle?.mensaje || root?.mensaje || response?.mensaje || 'Error al generar PDF');
        }
        const datos = root?.datos ?? response?.datos ?? response?.data ?? response;
        const row = Array.isArray(datos) ? datos[0] : datos;
        if (!row?.pdf_base64) {
            throw new Error(root?.detalle?.mensaje || root?.mensaje || 'El servidor no devolvió el PDF');
        }
        return {
            pdf_base64: row.pdf_base64 as string,
            nombre_archivo: row.nombre_archivo || fallbackName,
        };
    }

    /** Genera la Nota de Envío a Mantenimiento (una herramienta). */
    generarPdfEnvioMantenimiento(id_maintenance: number): Observable<NotaPdfResult> {
        return from(this._api.post('herramientas/maintenances/generarPdfEnvioMantenimiento', {
            id_maintenance: id_maintenance
        })).pipe(
            switchMap((response: any) => of(this._parseNotaResp(response, `nota_mantenimiento_${id_maintenance}.pdf`))),
            catchError((error) => { throw error; })
        );
    }

    /** Genera la Nota de Retorno de Mantenimiento (herramienta ya devuelta del taller). */
    generarPdfRetornoMantenimiento(id_maintenance: number): Observable<NotaPdfResult> {
        return from(this._api.post('herramientas/maintenances/generarPdfRetornoMantenimiento', {
            id_maintenance: id_maintenance
        })).pipe(
            switchMap((response: any) => of(this._parseNotaResp(response, `nota_retorno_mantenimiento_${id_maintenance}.pdf`))),
            catchError((error) => { throw error; })
        );
    }

    /**
     * Genera PDF de Nota de Envío a Mantenimiento por LOTE (varias herramientas).
     * @param ids - IDs de los registros de mantenimiento del despacho
     */
    generarPdfEnvioMantenimientoLote(ids: number[]): Observable<NotaPdfResult> {
        return from(this._api.post('herramientas/maintenances/generarPdfEnvioMantenimientoLote', {
            ids: (ids || []).filter(n => n > 0).join(',')
        })).pipe(
            switchMap((response: any) => of(this._parseNotaResp(response, 'nota_lote_mantenimiento.pdf'))),
            catchError((error) => { throw error; })
        );
    }

    /**
     * Reserva una pestaña YA, sincrónicamente, DENTRO del gesto del usuario (click).
     * El bloqueador de pop-ups sólo deja window.open si viene de un gesto; como el
     * PDF llega tras un POST, hay que reservar la pestaña antes y navegarla luego
     * con abrirNota(r, ventana). Devuelve null si el bloqueador igual lo impide
     * (ahí abrirNota cae a descarga directa).
     */
    preAbrirVentanaPdf(): Window | null {
        try {
            const w = window.open('', '_blank');
            if (w) {
                w.document.open();
                w.document.write('<!doctype html><meta charset="utf-8"><title>Generando documento…</title>' +
                    '<body style="font:14px system-ui;margin:2rem;color:#334155">Generando el documento PDF… no cierre esta pestaña.</body>');
                w.document.close();
            }
            return w;
        } catch { return null; }
    }

    /**
     * Abre la nota (PDF base64). Si se pasa `ventana` (reservada con
     * preAbrirVentanaPdf dentro del gesto) se le inyecta el visor; si no, window.open,
     * y si el bloqueador lo corta, fuerza la descarga del archivo.
     */
    abrirNota(r: NotaPdfResult, ventana?: Window | null): void {
        if (!r?.pdf_base64) { try { ventana?.close(); } catch { /* noop */ } return; }
        try {
            const bin = atob(r.pdf_base64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const name = (r.nombre_archivo || 'nota.pdf').replace(/["<>]/g, '');

            if (ventana && !ventana.closed) {
                // Inyectar un visor <iframe> en la pestaña ya reservada: navegar
                // location tras un document.write no siempre prende en Chrome.
                ventana.document.open();
                ventana.document.write(
                    '<!doctype html><html><head><meta charset="utf-8"><title>' + name + '</title>' +
                    '<style>html,body{margin:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%}</style>' +
                    '</head><body><iframe src="' + url + '" type="application/pdf"></iframe></body></html>'
                );
                ventana.document.close();
            } else {
                const w = window.open(url, '_blank');
                if (!w) {
                    const a = document.createElement('a');
                    a.href = url; a.download = name; a.rel = 'noopener';
                    document.body.appendChild(a); a.click(); a.remove();
                }
            }
            setTimeout(() => window.URL.revokeObjectURL(url), 120000);
        } catch (e) {
            console.error('abrirNota:', e);
            try { ventana?.close(); } catch { /* noop */ }
        }
    }

    /**
     * Genera y abre PDF de Nota de Envío a Mantenimiento directamente
     * @param id_maintenance - ID del registro de mantenimiento
     */
    generarYVerPdfEnvioMantenimiento(id_maintenance: number): void {
        this.generarPdfEnvioMantenimiento(id_maintenance).subscribe({
            next: (result) => this.abrirNota(result),
            error: (error) => {
                console.error('Error al generar PDF de envío de mantenimiento:', error);
            }
        });
    }

    /**
     * Abre un PDF en nueva pestaña a partir de base64
     * @param pdfBase64 - String en base64 del PDF
     * @param filename - Nombre del archivo (opcional)
     */
    private abrirPdf(base64OrHtml: string, _filename?: string): void {
        if (!base64OrHtml) return;

        const trimmed = base64OrHtml.trimStart();

        // Already raw HTML
        if (trimmed.startsWith('<')) {
            const win = window.open('', '_blank');
            if (win) { win.document.write(base64OrHtml); win.document.close(); }
            return;
        }

        let decoded: string;
        try {
            decoded = atob(base64OrHtml);
        } catch {
            const win = window.open('', '_blank');
            if (win) { win.document.write(base64OrHtml); win.document.close(); }
            return;
        }

        if (decoded.trimStart().startsWith('<')) {
            // Base64-encoded HTML — use document.write to avoid blob URL revocation issues
            const win = window.open('', '_blank');
            if (win) { win.document.write(decoded); win.document.close(); }
            return;
        }

        // Binary PDF
        const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
        const blob  = new Blob([bytes], { type: 'application/pdf' });
        const url   = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    }

    // MGH-125 — Listado de gatas hidráulicas (PDF real vía ACTreportes/RReporteGatasHidraulicas).
    generarPdfGatasHidraulicas(): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return from(this._api.post('herramientas/reportes/generarPDFGatasHidraulicas', {})).pipe(
            switchMap((response: any) => {
                // pxp-client puede dejar {ROOT:{...}} o desenvolverlo a {error,detalle,datos}.
                const root = response?.ROOT ?? response ?? {};
                const mensaje = root?.detalle?.mensaje ?? root?.mensaje ?? response?.mensaje;
                if (root?.error === true || response?.error === true) {
                    throw new Error(mensaje || 'Error al generar el reporte de gatas');
                }
                let datos = root?.datos ?? response?.datos ?? response?.data;
                const item = Array.isArray(datos) ? datos[0] : datos;
                if (!item?.pdf_base64) {
                    throw new Error(mensaje || 'Respuesta sin PDF (el backend no devolvió el documento)');
                }
                return of({
                    pdf_base64: item.pdf_base64 as string,
                    nombre_archivo: item.nombre_archivo || 'gatas_hidraulicas.pdf',
                });
            }),
            catchError((error) => { throw error; })
        );
    }

    generarYVerPdfGatas(): void {
        this.generarPdfGatasHidraulicas().subscribe({
            next: (result) => this.abrirPdf(result.pdf_base64, result.nombre_archivo),
            error: (error) => console.error('Error al generar el listado de gatas hidráulicas:', error),
        });
    }
}
