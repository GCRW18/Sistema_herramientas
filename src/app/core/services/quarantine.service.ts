import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap } from 'rxjs';
import { DecommissionRecord, QuarantineRecord } from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class QuarantineService {
    private _api = inject(ErpApiService);

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Quarantine
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all quarantine records
     */
    getQuarantines(filters?: any): Observable<QuarantineRecord[]> {
        const params: any = {
            start: 0,
            limit: 100,
            sort: 'id_quarantine',
            dir: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/quarantines/listQuarantines', params)).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Create quarantine record
     */
    createQuarantine(record: Partial<QuarantineRecord>): Observable<any> {
        return from(this._api.post('herramientas/quarantines/insertQuarantine', record)).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response.mensaje || 'Error al registrar cuarentena');
                return of(response?.datos?.[0] || response?.datos || response || record);
            })
        );
    }

    /**
     * Update quarantine record
     */
    updateQuarantine(id: string | number, record: any): Observable<any> {
        return from(this._api.post('herramientas/quarantines/updateCuarentena', {
            ...record,
            id_quarantine: id
        })).pipe(
            switchMap((response: any) => {
                const root = response?.ROOT || response;
                if (root?.error === true || root?.error === 'true') {
                    throw new Error(root?.detalle?.mensaje || root?.mensaje || 'Error al actualizar cuarentena');
                }
                return of(root?.datos?.[0] || root?.datos || root?.data || {});
            })
        );
    }

    /**
     * Get active quarantines
     */
    getActiveQuarantines(): Observable<QuarantineRecord[]> {
        return from(this._api.post('herramientas/quarantines/listActiveQuarantines', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response?.data || []);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Decommission
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all decommission records
     */
    getDecommissions(filters?: any): Observable<DecommissionRecord[]> {
        const params: any = {
            start: 0,
            limit: 100,
            sort: 'id_decommission',
            dir: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/decommissions/listDecommissions', params)).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Create decommission record
     */
    createDecommission(record: Partial<DecommissionRecord>): Observable<any> {
        return from(this._api.post('herramientas/decommissions/insertDecommission', record)).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response.mensaje || 'Error al registrar baja');
                return of(response?.datos?.[0] || response?.datos || response || record);
            })
        );
    }

    /**
     * Update decommission record
     */
    updateDecommission(id: string | number, record: any): Observable<any> {
        return from(this._api.post('herramientas/decommissions/updateBaja', {
            ...record,
            id_decommission: id
        })).pipe(
            switchMap((response: any) => {
                const root = response?.ROOT || response;
                if (root?.error === true || root?.error === 'true') {
                    throw new Error(root?.detalle?.mensaje || root?.mensaje || 'Error al actualizar baja');
                }
                return of(root?.datos?.[0] || root?.datos || root?.data || {});
            })
        );
    }
}
