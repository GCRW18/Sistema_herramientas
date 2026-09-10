import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap, throwError } from 'rxjs';
import { Tool, ToolFilters } from '../models';
import { ErpApiService } from '../api/api.service';
import { QrScanService } from './qr-scan.service';

@Injectable({ providedIn: 'root' })
export class ToolService {
    private _api = inject(ErpApiService);
    private _qrScan = inject(QrScanService);
    private _tools: ReplaySubject<Tool[]> = new ReplaySubject<Tool[]>(1);
    private _tool: ReplaySubject<Tool> = new ReplaySubject<Tool>(1);

    // Cache corto del listado completo sin filtros (Dashboard / Consultar Inventario):
    // evita re-traer hasta 5000 herramientas cada vez que se vuelve a esas pantallas.
    private _allToolsCache: { data: Tool[]; ts: number } | null = null;
    private readonly ALL_TOOLS_CACHE_TTL_MS = 30000;

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for tools
     */
    get tools$(): Observable<Tool[]> {
        return this._tools.asObservable();
    }

    /**
     * Getter for tool
     */
    get tool$(): Observable<Tool> {
        return this._tool.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all tools with optional filters.
     * Cuando hay query de texto, usa searchToolsAutocomplete (HE_TOS_SEARCH con quote_literal)
     * en vez de listTools+filtro_adicional — el backend ignoraba filtro_adicional porque
     * f_get_record no mapea esa clave, retornando todos los tools sin filtrar.
     */
    getTools(filters?: ToolFilters): Observable<Tool[]> {
        const q = (filters?.query ?? '').trim();
        if (q.length >= 2 || this._qrScan.isQrLabel(q)) {
            // URL de etiqueta QR pegada/escaneada → se traduce a código plano antes de buscar.
            const term$ = this._qrScan.isQrLabel(q) ? this._qrScan.toToolCode(q) : of(q);
            return term$.pipe(
                switchMap((resolved) => {
                    const term = (resolved || '').trim();
                    if (term.length < 2) return of([] as Tool[]);
                    return from(this._api.post('herramientas/tools/searchToolsAutocomplete', {
                        search_term: term, start: 0, limit: 20,
                    })).pipe(
                        switchMap((response: any) => of(response?.datos || response?.data || [])),
                    );
                })
            );
        }

        // limit 5000: con >2000 herramientas activas, el tope de 1000 (ordenado por
        // id_tool ASC) dejaba fuera de la vista unificada / dashboard a las más nuevas.
        const params: any = { start: 0, limit: 5000 };

        if (filters?.categoryId) params.category_id = filters.categoryId;
        if (filters?.warehouseId) params.warehouse_id = filters.warehouseId;
        if (filters?.status)      params.status = filters.status;

        // El listado sin ningún filtro (Dashboard, Consultar Inventario) se cachea unos
        // segundos: son las dos pantallas que más se revisitan en la sesión y no vale la
        // pena re-traer las ~2000+ herramientas activas en cada navegación de vuelta.
        const isPlainListing = !filters?.categoryId && !filters?.warehouseId && !filters?.status;
        if (isPlainListing && this._allToolsCache && (Date.now() - this._allToolsCache.ts) < this.ALL_TOOLS_CACHE_TTL_MS) {
            return of(this._allToolsCache.data);
        }

        return from(this._api.post('herramientas/tools/listTools', params)).pipe(
            switchMap((response: any) => {
                const tools = response?.datos || response?.data || [];
                this._tools.next(tools);
                if (isPlainListing) this._allToolsCache = { data: tools, ts: Date.now() };
                return of(tools);
            })
        );
    }

    /**
     * Get tool by id
     */
    getToolById(id: string): Observable<Tool> {
        return from(this._api.post('herramientas/tools/listTools', {
            start: 0,
            limit: 1,
            id_tool: id
        })).pipe(
            switchMap((response: any) => {
                const tool = response?.data?.[0] || null;
                if (tool) {
                    this._tool.next(tool);
                }
                return of(tool);
            })
        );
    }

    /**
     * Get tool by code.
     * Acepta también el contenido de una etiqueta QR (URL `.../qr-code/<token>`):
     * QrScanService la traduce al código plano antes de consultar el backend.
     */
    getToolByCode(code: string): Observable<Tool> {
        return this._qrScan.toToolCode(code).pipe(
            switchMap((realCode) => {
                if (!realCode) return of(null);
                return from(this._api.post('herramientas/tools/getToolByCode', {
                    code: realCode
                }));
            }),
            switchMap((response: any) => {
                return of(response?.data?.[0] || null);
            })
        );
    }

    /**
     * Create tool
     */
    createTool(tool: Partial<Tool>): Observable<Tool> {
        return from(this._api.post('herramientas/tools/insertTool', tool)).pipe(
            switchMap((response: any) => {
                return of(response?.data || tool);
            })
        );
    }

    /**
     * Guarda (crea o actualiza) una herramienta con payload snake_case directo.
     * Si payload incluye id_tool → actualiza; si no → crea.
     */
    saveTool(payload: Record<string, any>): Observable<any> {
        return from(this._api.post('herramientas/tools/insertTool', payload)).pipe(
            switchMap((response: any) => {
                const root = response?.ROOT ?? response;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al guardar herramienta');
                return of(root?.datos ?? root);
            })
        );
    }

    /**
     * Update tool
     */
    updateTool(id: string, tool: Partial<Tool>): Observable<Tool> {
        return from(this._api.post('herramientas/tools/insertTool', {
            ...tool,
            id_tool: id
        })).pipe(
            switchMap((response: any) => {
                const updatedTool = response?.data || tool;
                this._tool.next(updatedTool as Tool);
                return of(updatedTool);
            })
        );
    }

    /**
     * Delete tool
     */
    deleteTool(id: string): Observable<void> {
        return from(this._api.post('herramientas/tools/deleteTool', {
            id_tool: id
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }

    /**
     * Search tools
     * CORREGIDO: Cambiar 'query' por 'search_text' para que coincida con el backend
     */
    searchTools(query: string): Observable<Tool[]> {
        return from(this._api.post('herramientas/tools/searchToolsByText', {
            search_text: query  // ← CAMBIO: 'query' → 'search_text'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || []);
            })
        );
    }

    /**
     * Get inventory summary
     * CORREGIDO: No enviar parámetros vacíos innecesarios
     */
    getInventorySummary(): Observable<any> {
        return from(this._api.post('herramientas/tools/getInventorySummary', {})).pipe(
            switchMap((response: any) => {
                // La respuesta viene en datos[0] porque es un único registro
                return of(response?.data?.[0] || response?.data || {});
            })
        );
    }

    /**
     * Get tools requiring calibration
     */
    getToolsRequiringCalibration(): Observable<Tool[]> {
        return from(this._api.post('herramientas/tools/getToolsRequireCalibration', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response?.data || []);
            })
        );
    }

    /**
     * Get tools with expired calibration
     */
    getToolsWithExpiredCalibration(): Observable<Tool[]> {
        return from(this._api.post('herramientas/tools/getToolsExpiredCalibration', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response?.data || []);
            })
        );
    }

    /**
     * Update tool status
     * CORREGIDO: Cambiar 'tool_id' por 'id_tool' para que coincida con el backend
     */
    updateToolStatus(id: string, status: string): Observable<Tool> {
        return from(this._api.post('herramientas/tools/updateToolStatus', {
            id_tool: id,  // ← CAMBIO: 'tool_id' → 'id_tool'
            status: status
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || {});
            })
        );
    }

    /**
     * Genera la etiqueta con código QR de una o varias herramientas (reporte
     * RCodigoQRTools, pensado para impresora de etiquetas Bixolon). Acepta un
     * solo id_tool o un array (el backend soporta id_tool separados por coma
     * y arma un único PDF con una etiqueta por herramienta). Misma forma de
     * respuesta que generarPdfEnvioCalibracion/generarPdfEnvioMantenimiento:
     * JSON con pdf_base64 + nombre_archivo dentro de ROOT.datos.
     */
    generarCodigoQR(id_tool: number | number[]): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        const ids = (Array.isArray(id_tool) ? id_tool : [id_tool])
            .map(Number)
            .filter(n => !isNaN(n) && n > 0);
        if (ids.length === 0) {
            return throwError(() => new Error('ID de herramienta inválido: ' + id_tool));
        }

        return from(this._api.post('herramientas/tools/listarCodigoQRHerramientas', {
            id_tool: ids.join(',')
        })).pipe(
            switchMap((response: any) => {
                let datos = null;
                let error = false;
                let mensaje = '';

                if (response?.ROOT) {
                    error = response.ROOT.error === true;
                    mensaje = response.ROOT.detalle?.mensaje || response.ROOT.mensaje || '';
                    datos = response.ROOT.datos;
                }
                else if (response?.datos) {
                    error = response.error === true;
                    mensaje = response.detalle?.mensaje || response.mensaje || '';
                    datos = response.datos;
                }
                else if (Array.isArray(response)) {
                    datos = response;
                }
                else if (response?.data) {
                    datos = response.data;
                }

                let item = null;
                if (Array.isArray(datos) && datos.length > 0) {
                    item = datos[0];
                } else if (datos && typeof datos === 'object') {
                    item = datos;
                }

                if (error || !item?.pdf_base64) {
                    const msg = mensaje || 'Error al generar el código QR';
                    throw new Error(msg);
                }

                return of({
                    pdf_base64: item.pdf_base64 as string,
                    nombre_archivo: item.nombre_archivo ?? (ids.length > 1 ? 'codigos_qr.pdf' : `codigo_qr_${ids[0]}.pdf`)
                });
            })
        );
    }

    /**
     * Decommission tool
     * CORREGIDO: Cambiar 'tool_id' por 'id_tool' para que coincida con el backend
     */
    decommissionTool(id: string, data: any): Observable<Tool> {
        return from(this._api.post('herramientas/tools/decommission', {
            id_tool: id,  // ← CAMBIO: 'tool_id' → 'id_tool'
            ...data
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || {});
            })
        );
    }
}
