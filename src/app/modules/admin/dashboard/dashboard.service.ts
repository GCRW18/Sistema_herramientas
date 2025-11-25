import { Injectable } from '@angular/core';
import { ErpApiService } from '../../../core/api/api.service';
import { from, Observable, of, switchMap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class DashboardService {

    constructor(
        private _api: ErpApiService
    ) { }

    /**
     * Obtiene lista de herramientas con paginación
     */
    getTools(): Observable<any[]> {
        return from(this._api.post(
            'herramientas/tools/listTools',
            {
                start: 0,
                limit: 50,
                sort: 'name',
                dir: 'asc',
                query: ''
            }
        )).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }

    /**
     * Obtiene resumen del inventario para el dashboard
     */
    getInventorySummary(): Observable<any> {
        return from(this._api.post(
            'herramientas/tools/getInventorySummary',
            {}  // Sin parámetros o con parámetros específicos si los necesita
        )).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }

    /**
     * Obtiene herramientas que requieren calibración
     */
    getToolsRequireCalibration(): Observable<any[]> {
        return from(this._api.post(
            'herramientas/tools/getToolsRequireCalibration',
            {}
        )).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }

    /**
     * Obtiene herramientas con calibración expirada
     */
    getToolsExpiredCalibration(): Observable<any[]> {
        return from(this._api.post(
            'herramientas/tools/getToolsExpiredCalibration',
            {}
        )).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }

    /**
     * Busca herramientas por texto
     */
    searchToolsByText(query: string): Observable<any[]> {
        return from(this._api.post(
            'herramientas/tools/searchToolsByText',
            {
                query: query,
                start: 0,
                limit: 50
            }
        )).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }

    /**
     * Obtiene herramienta por código
     */
    getToolByCode(code: string): Observable<any> {
        return from(this._api.post(
            'herramientas/tools/getToolByCode',
            {
                code: code
            }
        )).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }
}
