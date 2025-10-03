import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject, tap } from 'rxjs';
import { Tool, ToolFilters } from '../models';

@Injectable({ providedIn: 'root' })
export class ToolService {
    private _httpClient = inject(HttpClient);
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
        let params = new HttpParams();

        if (filters) {
            Object.keys(filters).forEach((key) => {
                const value = filters[key as keyof ToolFilters];
                if (value !== undefined && value !== null && value !== '') {
                    params = params.set(key, String(value));
                }
            });
        }

        return this._httpClient.get<Tool[]>('api/tools', { params }).pipe(
            tap((tools) => {
                this._tools.next(tools);
            })
        );
    }

    /**
     * Get tool by id
     */
    getToolById(id: string): Observable<Tool> {
        return this._httpClient.get<Tool>(`api/tools/${id}`).pipe(
            tap((tool) => {
                this._tool.next(tool);
            })
        );
    }

    /**
     * Get tool by code
     */
    getToolByCode(code: string): Observable<Tool> {
        return this._httpClient.get<Tool>(`api/tools/code/${code}`);
    }

    /**
     * Create tool
     */
    createTool(tool: Partial<Tool>): Observable<Tool> {
        return this._httpClient.post<Tool>('api/tools', tool);
    }

    /**
     * Update tool
     */
    updateTool(id: string, tool: Partial<Tool>): Observable<Tool> {
        return this._httpClient.put<Tool>(`api/tools/${id}`, tool).pipe(
            tap((updatedTool) => {
                this._tool.next(updatedTool);
            })
        );
    }

    /**
     * Update tool location
     */
    updateToolLocation(id: string, locationId: string, warehouseId: string): Observable<Tool> {
        return this._httpClient.patch<Tool>(`api/tools/${id}/location`, {
            locationId,
            warehouseId,
        });
    }

    /**
     * Delete tool
     */
    deleteTool(id: string): Observable<void> {
        return this._httpClient.delete<void>(`api/tools/${id}`);
    }

    /**
     * Search tools
     */
    searchTools(query: string): Observable<Tool[]> {
        return this._httpClient.get<Tool[]>(`api/tools/search`, {
            params: { q: query },
        });
    }

    /**
     * Get inventory summary
     */
    getInventorySummary(): Observable<any> {
        return this._httpClient.get<any>('api/tools/inventory/summary');
    }

    /**
     * Get tools requiring calibration
     */
    getToolsRequiringCalibration(): Observable<Tool[]> {
        return this._httpClient.get<Tool[]>('api/tools/calibration/required');
    }

    /**
     * Get tools with expired calibration
     */
    getToolsWithExpiredCalibration(): Observable<Tool[]> {
        return this._httpClient.get<Tool[]>('api/tools/calibration/expired');
    }
}
