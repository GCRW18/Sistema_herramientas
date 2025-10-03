import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject, tap } from 'rxjs';
import { DecommissionRecord, QuarantineRecord } from '../models';

@Injectable({ providedIn: 'root' })
export class QuarantineService {
    private _httpClient = inject(HttpClient);
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
        return this._httpClient.get<QuarantineRecord[]>('api/quarantines', { params: filters }).pipe(
            tap((quarantines) => {
                this._quarantines.next(quarantines);
            })
        );
    }

    /**
     * Get quarantine by id
     */
    getQuarantineById(id: string): Observable<QuarantineRecord> {
        return this._httpClient.get<QuarantineRecord>(`api/quarantines/${id}`);
    }

    /**
     * Create quarantine record
     */
    createQuarantine(record: Partial<QuarantineRecord>): Observable<QuarantineRecord> {
        return this._httpClient.post<QuarantineRecord>('api/quarantines', record);
    }

    /**
     * Update quarantine record
     */
    updateQuarantine(id: string, record: Partial<QuarantineRecord>): Observable<QuarantineRecord> {
        return this._httpClient.put<QuarantineRecord>(`api/quarantines/${id}`, record);
    }

    /**
     * Resolve quarantine
     */
    resolveQuarantine(id: string, resolution: string, actionTaken: string): Observable<QuarantineRecord> {
        return this._httpClient.post<QuarantineRecord>(`api/quarantines/${id}/resolve`, {
            resolution,
            actionTaken,
        });
    }

    /**
     * Cancel quarantine
     */
    cancelQuarantine(id: string): Observable<QuarantineRecord> {
        return this._httpClient.post<QuarantineRecord>(`api/quarantines/${id}/cancel`, {});
    }

    /**
     * Get active quarantines
     */
    getActiveQuarantines(): Observable<QuarantineRecord[]> {
        return this._httpClient.get<QuarantineRecord[]>('api/quarantines/active');
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Decommission
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all decommission records
     */
    getDecommissions(filters?: any): Observable<DecommissionRecord[]> {
        return this._httpClient.get<DecommissionRecord[]>('api/decommissions', { params: filters }).pipe(
            tap((decommissions) => {
                this._decommissions.next(decommissions);
            })
        );
    }

    /**
     * Get decommission by id
     */
    getDecommissionById(id: string): Observable<DecommissionRecord> {
        return this._httpClient.get<DecommissionRecord>(`api/decommissions/${id}`);
    }

    /**
     * Create decommission record
     */
    createDecommission(record: Partial<DecommissionRecord>): Observable<DecommissionRecord> {
        return this._httpClient.post<DecommissionRecord>('api/decommissions', record);
    }

    /**
     * Update decommission record
     */
    updateDecommission(id: string, record: Partial<DecommissionRecord>): Observable<DecommissionRecord> {
        return this._httpClient.put<DecommissionRecord>(`api/decommissions/${id}`, record);
    }

    /**
     * Generate quarantine report
     */
    generateQuarantineReport(filters?: any): Observable<Blob> {
        return this._httpClient.get('api/quarantines/report', {
            params: filters,
            responseType: 'blob',
        });
    }

    /**
     * Generate decommission report
     */
    generateDecommissionReport(filters?: any): Observable<Blob> {
        return this._httpClient.get('api/decommissions/report', {
            params: filters,
            responseType: 'blob',
        });
    }
}
