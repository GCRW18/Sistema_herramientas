import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap } from 'rxjs';
import { Kit, KitCalibrationStatus } from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class KitService {
    private _api = inject(ErpApiService);
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
    getKits(filters?: any): Observable<Kit[]> {
        const params: any = {
            start: 0,
            limit: 50,
            sort: 'name',
            dir: 'asc',
            ...filters
        };

        return from(this._api.post('herramientas/kits/listKit', params)).pipe(
            switchMap((response: any) => {
                const kits = response?.datos || [];
                this._kits.next(kits);
                return of(kits);
            })
        );
    }

    /**
     * Get kit by id
     */
    getKitById(id: string): Observable<Kit> {
        return from(this._api.post('herramientas/kits/listKit', {
            start: 0,
            limit: 1,
            id_kit: id
        })).pipe(
            switchMap((response: any) => {
                const kit = response?.datos?.[0] || null;
                if (kit) {
                    this._kit.next(kit);
                }
                return of(kit);
            })
        );
    }

    /**
     * Create kit
     */
    createKit(kit: Partial<Kit>): Observable<Kit> {
        return from(this._api.post('herramientas/kits/insertKit', kit)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || kit);
            })
        );
    }

    /**
     * Update kit
     */
    updateKit(id: string, kit: Partial<Kit>): Observable<Kit> {
        return from(this._api.post('herramientas/kits/updateKit', {
            ...kit,
            id_kit: id
        })).pipe(
            switchMap((response: any) => {
                const updatedKit = response?.datos || kit;
                this._kit.next(updatedKit as Kit);
                return of(updatedKit);
            })
        );
    }

    /**
     * Delete kit
     */
    deleteKit(id: string): Observable<void> {
        return from(this._api.post('herramientas/kits/deleteKit', {
            id_kit: id
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }

    /**
     * Add tool to kit
     */
    addToolToKit(kitId: string, toolId: string, quantity: number, required: boolean): Observable<Kit> {
        return from(this._api.post('herramientas/kits/addToolToKit', {
            id_kit: kitId,
            tool_id: toolId,
            cantidad: quantity,
            requerido: required
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Remove tool from kit
     */
    removeToolFromKit(kitId: string, itemId: string): Observable<Kit> {
        return from(this._api.post('herramientas/kits/removeToolFromKit', {
            id_kit: kitId,
            id_componente: itemId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Update kit item
     */
    updateKitItem(kitId: string, itemId: string, data: any): Observable<Kit> {
        return from(this._api.post('herramientas/kits/updateKitComponent', {
            id_kit: kitId,
            id_componente: itemId,
            ...data
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Get kit calibration status
     */
    getKitCalibrationStatus(kitId: string): Observable<KitCalibrationStatus> {
        return from(this._api.post('herramientas/kits/getKitCalibrationStatus', {
            id_kit: kitId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Get all kits calibration status
     */
    getAllKitsCalibrationStatus(): Observable<KitCalibrationStatus[]> {
        return from(this._api.post('herramientas/kits/getAllKitsCalibrationStatus', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }
}
