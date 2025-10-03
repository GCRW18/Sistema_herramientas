import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject, tap } from 'rxjs';
import { Kit, KitCalibrationStatus } from '../models';

@Injectable({ providedIn: 'root' })
export class KitService {
    private _httpClient = inject(HttpClient);
    private _kits: ReplaySubject<Kit[]> = new ReplaySubject<Kit[]>(1);
    private _kit: ReplaySubject<Kit> = new ReplaySubject<Kit>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for kits
     */
    get kits$(): Observable<Kit[]> {
        return this._kits.asObservable();
    }

    /**
     * Getter for kit
     */
    get kit$(): Observable<Kit> {
        return this._kit.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all kits
     */
    getKits(): Observable<Kit[]> {
        return this._httpClient.get<Kit[]>('api/kits').pipe(
            tap((kits) => {
                this._kits.next(kits);
            })
        );
    }

    /**
     * Get kit by id
     */
    getKitById(id: string): Observable<Kit> {
        return this._httpClient.get<Kit>(`api/kits/${id}`).pipe(
            tap((kit) => {
                this._kit.next(kit);
            })
        );
    }

    /**
     * Create kit
     */
    createKit(kit: Partial<Kit>): Observable<Kit> {
        return this._httpClient.post<Kit>('api/kits', kit);
    }

    /**
     * Update kit
     */
    updateKit(id: string, kit: Partial<Kit>): Observable<Kit> {
        return this._httpClient.put<Kit>(`api/kits/${id}`, kit).pipe(
            tap((updatedKit) => {
                this._kit.next(updatedKit);
            })
        );
    }

    /**
     * Delete kit
     */
    deleteKit(id: string): Observable<void> {
        return this._httpClient.delete<void>(`api/kits/${id}`);
    }

    /**
     * Add tool to kit
     */
    addToolToKit(kitId: string, toolId: string, quantity: number, required: boolean): Observable<Kit> {
        return this._httpClient.post<Kit>(`api/kits/${kitId}/tools`, {
            toolId,
            quantity,
            required,
        });
    }

    /**
     * Remove tool from kit
     */
    removeToolFromKit(kitId: string, itemId: string): Observable<Kit> {
        return this._httpClient.delete<Kit>(`api/kits/${kitId}/tools/${itemId}`);
    }

    /**
     * Update kit item
     */
    updateKitItem(kitId: string, itemId: string, data: any): Observable<Kit> {
        return this._httpClient.put<Kit>(`api/kits/${kitId}/tools/${itemId}`, data);
    }

    /**
     * Get kit calibration status
     */
    getKitCalibrationStatus(kitId: string): Observable<KitCalibrationStatus> {
        return this._httpClient.get<KitCalibrationStatus>(`api/kits/${kitId}/calibration-status`);
    }

    /**
     * Get all kits calibration status
     */
    getAllKitsCalibrationStatus(): Observable<KitCalibrationStatus[]> {
        return this._httpClient.get<KitCalibrationStatus[]>('api/kits/calibration-status');
    }
}
