import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap } from 'rxjs';
import { ErpApiService } from '../api/api.service';

export interface Decommission {
    id: string;
    toolId: string;
    toolCode?: string;
    toolName?: string;
    reason: string;
    decommissionDate: string;
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvalDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class DecommissionService {
    private _api = inject(ErpApiService);
    private _decommissions: ReplaySubject<Decommission[]> = new ReplaySubject<Decommission[]>(1);
    private _decommission: ReplaySubject<Decommission> = new ReplaySubject<Decommission>(1);

    get decommissions$(): Observable<Decommission[]> {
        return this._decommissions.asObservable();
    }

    get decommission$(): Observable<Decommission> {
        return this._decommission.asObservable();
    }

    getDecommissions(filters?: any): Observable<Decommission[]> {
        const params: any = {
            start: 0,
            limit: 50,
            sort: 'decommission_date',
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

    getDecommissionById(id: string): Observable<Decommission> {
        return from(this._api.post('herramientas/decommissions/listDecommissions', {
            start: 0,
            limit: 1,
            id_decommission: id
        })).pipe(
            switchMap((response: any) => {
                const decommission = response?.datos?.[0] || null;
                if (decommission) {
                    this._decommission.next(decommission);
                }
                return of(decommission);
            })
        );
    }

    createDecommission(decommission: Partial<Decommission>): Observable<Decommission> {
        return from(this._api.post('herramientas/decommissions/insertDecommission', decommission)).pipe(
            switchMap((response: any) => {
                const newDecommission = response?.datos || decommission;
                this._decommission.next(newDecommission as Decommission);
                return of(newDecommission);
            })
        );
    }

    updateDecommission(id: string, decommission: Partial<Decommission>): Observable<Decommission> {
        return from(this._api.post('herramientas/decommissions/updateBaja', {
            ...decommission,
            id_decommission: id
        })).pipe(
            switchMap((response: any) => {
                const updatedDecommission = response?.datos || decommission;
                this._decommission.next(updatedDecommission as Decommission);
                return of(updatedDecommission);
            })
        );
    }

    deleteDecommission(id: string): Observable<void> {
        return from(this._api.post('herramientas/decommissions/deleteDecommission', {
            id_decommission: id
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }

    approveDecommission(id: string, notes?: string): Observable<Decommission> {
        return from(this._api.post('herramientas/decommissions/approveBaja', {
            id_decommission: id,
            notes: notes
        })).pipe(
            switchMap((response: any) => {
                const decommission = response?.datos || {};
                this._decommission.next(decommission);
                return of(decommission);
            })
        );
    }

    rejectDecommission(id: string, reason: string): Observable<Decommission> {
        return from(this._api.post('herramientas/decommissions/rechazarBaja', {
            id_decommission: id,
            rejection_reason: reason
        })).pipe(
            switchMap((response: any) => {
                const decommission = response?.datos || {};
                this._decommission.next(decommission);
                return of(decommission);
            })
        );
    }
}
