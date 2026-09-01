import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap, catchError } from 'rxjs';
import { Maintenance } from '../models/maintenance.types';
import { ErpApiService } from '../api/api.service';

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

    /**
     * Genera PDF de Nota de Envío a Mantenimiento
     * @param id_maintenance - ID del registro de mantenimiento
     * @returns Observable con el PDF en base64
     */
    generarPdfEnvioMantenimiento(id_maintenance: number): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return from(this._api.post('herramientas/maintenances/generarPdfEnvioMantenimiento', {
            id_maintenance: id_maintenance
        })).pipe(
            switchMap((response: any) => {
                const hasError = response?.ROOT?.error === true || response?.error === true;
                if (hasError) throw new Error(response?.ROOT?.detalle?.mensaje || response?.mensaje || 'Error al generar PDF');
                const data = response?.ROOT?.datos ?? response?.datos ?? response;
                return of({
                    pdf_base64: data?.pdf_base64 as string,
                    nombre_archivo: data?.nombre_archivo || `nota_mantenimiento_${id_maintenance}.html`
                });
            }),
            catchError((error) => { throw error; })
        );
    }

    /**
     * Genera y abre PDF de Nota de Envío a Mantenimiento directamente
     * @param id_maintenance - ID del registro de mantenimiento
     */
    generarYVerPdfEnvioMantenimiento(id_maintenance: number): void {
        this.generarPdfEnvioMantenimiento(id_maintenance).subscribe({
            next: (result) => {
                this.abrirPdf(result.pdf_base64, result.nombre_archivo);
            },
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
