import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap } from 'rxjs';
import { Tool, ToolFilters } from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class ToolService {
    private _api = inject(ErpApiService);
    private _tools: ReplaySubject<Tool[]> = new ReplaySubject<Tool[]>(1);
    private _tool: ReplaySubject<Tool> = new ReplaySubject<Tool>(1);

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
        if (filters?.query && filters.query.trim().length >= 2) {
            return from(this._api.post('herramientas/tools/searchToolsAutocomplete', {
                search_term: filters.query.trim(),
                start: 0,
                limit: 20
            })).pipe(
                switchMap((response: any) => {
                    const tools = response?.datos || response?.data || [];
                    return of(tools);
                })
            );
        }

        const params: any = { start: 0, limit: 1000 };

        if (filters?.categoryId) params.category_id = filters.categoryId;
        if (filters?.warehouseId) params.warehouse_id = filters.warehouseId;
        if (filters?.status)      params.status = filters.status;

        return from(this._api.post('herramientas/tools/listTools', params)).pipe(
            switchMap((response: any) => {
                const tools = response?.datos || response?.data || [];
                this._tools.next(tools);
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
     * Get tool by code
     */
    getToolByCode(code: string): Observable<Tool> {
        return from(this._api.post('herramientas/tools/getToolByCode', {
            code: code
        })).pipe(
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
     * Update tool location
     */
    updateToolLocation(id: string, locationId: string, warehouseId: string): Observable<Tool> {
        return from(this._api.post('herramientas/tools/updateToolLocation', {
            id_tool: id,
            location_id: locationId,
            warehouse_id: warehouseId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || {});
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
     * Send tool to calibration
     * CORREGIDO: Cambiar 'tool_id' por 'id_tool' para que coincida con el backend
     */
    sendToCalibration(id: string, data: any): Observable<Tool> {
        return from(this._api.post('herramientas/tools/sendToCalibration', {
            id_tool: id,  // ← CAMBIO: 'tool_id' → 'id_tool'
            ...data
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || {});
            })
        );
    }

    /**
     * Send tool to maintenance
     * CORREGIDO: Cambiar 'tool_id' por 'id_tool' para que coincida con el backend
     */
    sendToMaintenance(id: string, data: any): Observable<Tool> {
        return from(this._api.post('herramientas/tools/sendToMaintenance', {
            id_tool: id,  // ← CAMBIO: 'tool_id' → 'id_tool'
            ...data
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || {});
            })
        );
    }

    /**
     * Send tool to quarantine
     * CORREGIDO: Cambiar 'tool_id' por 'id_tool' para que coincida con el backend
     */
    sendToQuarantine(id: string, data: any): Observable<Tool> {
        return from(this._api.post('herramientas/tools/sendToQuarantine', {
            id_tool: id,  // ← CAMBIO: 'tool_id' → 'id_tool'
            ...data
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || {});
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
