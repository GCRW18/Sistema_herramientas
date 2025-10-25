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
     * Get all tools with optional filters
     */
    getTools(filters?: ToolFilters): Observable<Tool[]> {
        const params: any = {
            start: 0,
            limit: 50,
            sort: 'nombre',
            dir: 'asc',
            ...filters
        };

        return from(this._api.post('herramientas/Herramienta/listarHerramienta', params)).pipe(
            switchMap((response: any) => {
                const tools = response?.datos || [];
                this._tools.next(tools);
                return of(tools);
            })
        );
    }

    /**
     * Get tool by id
     */
    getToolById(id: string): Observable<Tool> {
        return from(this._api.post('herramientas/Herramienta/listarHerramienta', {
            start: 0,
            limit: 1,
            id_herramienta: id
        })).pipe(
            switchMap((response: any) => {
                const tool = response?.datos?.[0] || null;
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
        return from(this._api.post('herramientas/Herramienta/listarHerramientaPorCodigo', {
            codigo_boa: code
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || null);
            })
        );
    }

    /**
     * Create tool
     */
    createTool(tool: Partial<Tool>): Observable<Tool> {
        return from(this._api.post('herramientas/Herramienta/insertarHerramienta', tool)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || tool);
            })
        );
    }

    /**
     * Update tool
     */
    updateTool(id: string, tool: Partial<Tool>): Observable<Tool> {
        return from(this._api.post('herramientas/Herramienta/insertarHerramienta', {
            ...tool,
            id_herramienta: id
        })).pipe(
            switchMap((response: any) => {
                const updatedTool = response?.datos || tool;
                this._tool.next(updatedTool as Tool);
                return of(updatedTool);
            })
        );
    }

    /**
     * Update tool location
     */
    updateToolLocation(id: string, locationId: string, warehouseId: string): Observable<Tool> {
        return from(this._api.post('herramientas/Herramienta/actualizarUbicacionHerramienta', {
            id_herramienta: id,
            id_ubicacion: locationId,
            id_deposito: warehouseId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Delete tool
     */
    deleteTool(id: string): Observable<void> {
        return from(this._api.post('herramientas/Herramienta/eliminarHerramienta', {
            id_herramienta: id
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }

    /**
     * Search tools
     */
    searchTools(query: string): Observable<Tool[]> {
        return from(this._api.post('herramientas/Herramienta/buscarHerramientasTexto', {
            query: query
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get inventory summary
     */
    getInventorySummary(): Observable<any> {
        return from(this._api.post('herramientas/Herramienta/obtenerResumenInventario', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Get tools requiring calibration
     */
    getToolsRequiringCalibration(): Observable<Tool[]> {
        return from(this._api.post('herramientas/Herramienta/obtenerHerramientasRequierenCalibracion', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get tools with expired calibration
     */
    getToolsWithExpiredCalibration(): Observable<Tool[]> {
        return from(this._api.post('herramientas/Herramienta/obtenerHerramientasCalibracionVencida', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Update tool status
     */
    updateToolStatus(id: string, status: string): Observable<Tool> {
        return from(this._api.post('herramientas/Herramienta/actualizarEstadoHerramienta', {
            id_herramienta: id,
            estado: status
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Send tool to calibration
     */
    sendToCalibration(id: string, data: any): Observable<Tool> {
        return from(this._api.post('herramientas/Herramienta/enviarACalibracion', {
            id_herramienta: id,
            ...data
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Send tool to maintenance
     */
    sendToMaintenance(id: string, data: any): Observable<Tool> {
        return from(this._api.post('herramientas/Herramienta/enviarAMantenimiento', {
            id_herramienta: id,
            ...data
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Send tool to quarantine
     */
    sendToQuarantine(id: string, data: any): Observable<Tool> {
        return from(this._api.post('herramientas/Herramienta/enviarACuarentena', {
            id_herramienta: id,
            ...data
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Decommission tool
     */
    decommissionTool(id: string, data: any): Observable<Tool> {
        return from(this._api.post('herramientas/Herramienta/darDeBaja', {
            id_herramienta: id,
            ...data
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }
}
