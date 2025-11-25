import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap } from 'rxjs';
import { DecommissionRecord, QuarantineRecord } from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class QuarantineService {
    private _api = inject(ErpApiService);
    private _quarantines: ReplaySubject<QuarantineRecord[]> = new ReplaySubject<QuarantineRecord[]>(1);
    private _decommissions: ReplaySubject<DecommissionRecord[]> = new ReplaySubject<DecommissionRecord[]>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for quarantines
     */
    get quarantines$(): Observable<QuarantineRecord[]> {
        return this._quarantines.asObservable();
    }

    /**
     * Getter for decommissions
     */
    get decommissions$(): Observable<DecommissionRecord[]> {
        return this._decommissions.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Quarantine
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all quarantine records
     */
    getQuarantines(filters?: any): Observable<QuarantineRecord[]> {
        const params: any = {
            start: 0,
            limit: 50,
            sort: 'entry_date',
            dir: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/quarantines/listQuarantines', params)).pipe(
            switchMap((response: any) => {
                const quarantines = response?.datos || [];
                this._quarantines.next(quarantines);
                return of(quarantines);
            })
        );
    }

    /**
     * Get quarantine by id
     */
    getQuarantineById(id: string): Observable<QuarantineRecord> {
        return from(this._api.post('herramientas/quarantines/listQuarantines', {
            start: 0,
            limit: 1,
            id_quarantine: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || null);
            })
        );
    }

    /**
     * Create quarantine record
     */
    createQuarantine(record: Partial<QuarantineRecord>): Observable<QuarantineRecord> {
        return from(this._api.post('herramientas/quarantines/insertQuarantine', record)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || record);
            })
        );
    }

    /**
     * Update quarantine record
     */
    updateQuarantine(id: string, record: Partial<QuarantineRecord>): Observable<QuarantineRecord> {
        return from(this._api.post('herramientas/quarantines/updateCuarentena', {
            ...record,
            id_quarantine: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || record);
            })
        );
    }

    /**
     * Resolve quarantine
     */
    resolveQuarantine(id: string, resolution: string, actionTaken: string): Observable<QuarantineRecord> {
        return from(this._api.post('herramientas/quarantines/resolverCuarentena', {
            id_quarantine: id,
            resultado: resolution,
            accion_tomada: actionTaken
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Cancel quarantine
     */
    cancelQuarantine(id: string): Observable<QuarantineRecord> {
        return from(this._api.post('herramientas/quarantines/cancelCuarentena', {
            id_quarantine: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Get active quarantines
     */
    getActiveQuarantines(): Observable<QuarantineRecord[]> {
        return from(this._api.post('herramientas/quarantines/listActiveQuarantines', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
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
            limit: 50,
            sort: 'entry_date',
            dir: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/decommissions/listDecommissions', params)).pipe(
            switchMap((response: any) => {
                const decommissions = response?.datos || [];
                this._decommissions.next(decommissions);
                return of(decommissions);
            })
        );
    }

    /**
     * Get decommission by id
     */
    getDecommissionById(id: string): Observable<DecommissionRecord> {
        return from(this._api.post('herramientas/decommissions/listDecommissions', {
            start: 0,
            limit: 1,
            id_baja: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || null);
            })
        );
    }

    /**
     * Create decommission record
     */
    createDecommission(record: Partial<DecommissionRecord>): Observable<DecommissionRecord> {
        return from(this._api.post('herramientas/decommissions/insertDecommission', record)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || record);
            })
        );
    }

    /**
     * Update decommission record
     */
    updateDecommission(id: string, record: Partial<DecommissionRecord>): Observable<DecommissionRecord> {
        return from(this._api.post('herramientas/decommissions/updateBaja', {
            ...record,
            id_baja: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || record);
            })
        );
    }

    /**
     * Approve decommission
     */
    approveDecommission(id: string): Observable<DecommissionRecord> {
        return from(this._api.post('herramientas/decommissions/approveBaja', {
            id_baja: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Generate quarantine report
     */
    generateQuarantineReport(filters?: any): Observable<Blob> {
        // PXP might return a file URL instead of blob
        return from(this._api.post('herramientas/quarantines/generarReporte', filters)).pipe(
            switchMap((response: any) => {
                // Handle file download - might need adjustment based on PXP response format
                return of(new Blob());
            })
        );
    }

    /**
     * Generate decommission report
     */
    generateDecommissionReport(filters?: any): Observable<Blob> {
        // PXP might return a file URL instead of blob
        return from(this._api.post('herramientas/decommissions/generarReporte', filters)).pipe(
            switchMap((response: any) => {
                // Handle file download - might need adjustment based on PXP response format
                return of(new Blob());
            })
        );
    }
}
