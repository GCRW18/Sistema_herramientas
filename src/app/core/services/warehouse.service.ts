import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap } from 'rxjs';
import { Location, Warehouse } from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class WarehouseService {
    private _api = inject(ErpApiService);
    private _warehouses: ReplaySubject<Warehouse[]> = new ReplaySubject<Warehouse[]>(1);
    private _locations: ReplaySubject<Location[]> = new ReplaySubject<Location[]>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for warehouses
     */
    get warehouses$(): Observable<Warehouse[]> {
        return this._warehouses.asObservable();
    }

    /**
     * Getter for locations
     */
    get locations$(): Observable<Location[]> {
        return this._locations.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all warehouses
     */
    getWarehouses(): Observable<Warehouse[]> {
        return from(this._api.post('herramientas/Deposito/listarDeposito', {
            start: 0,
            limit: 50,
            sort: 'nombre',
            dir: 'asc'
        })).pipe(
            switchMap((response: any) => {
                const warehouses = response?.datos || [];
                this._warehouses.next(warehouses);
                return of(warehouses);
            })
        );
    }

    /**
     * Get warehouse by id
     */
    getWarehouseById(id: string): Observable<Warehouse> {
        return from(this._api.post('herramientas/Deposito/listarDeposito', {
            start: 0,
            limit: 1,
            id_deposito: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || null);
            })
        );
    }

    /**
     * Create warehouse
     */
    createWarehouse(warehouse: Partial<Warehouse>): Observable<Warehouse> {
        return from(this._api.post('herramientas/Deposito/insertarDeposito', warehouse)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || warehouse);
            })
        );
    }

    /**
     * Update warehouse
     */
    updateWarehouse(id: string, warehouse: Partial<Warehouse>): Observable<Warehouse> {
        return from(this._api.post('herramientas/Deposito/insertarDeposito', {
            ...warehouse,
            id_deposito: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || warehouse);
            })
        );
    }

    /**
     * Delete warehouse
     */
    deleteWarehouse(id: string): Observable<void> {
        return from(this._api.post('herramientas/Deposito/eliminarDeposito', {
            id_deposito: id
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }

    /**
     * Get all locations
     */
    getLocations(warehouseId?: string): Observable<Location[]> {
        const params = {
            start: 0,
            limit: 50,
            sort: 'nombre',
            dir: 'asc',
            ...(warehouseId ? { id_deposito: warehouseId } : {})
        };

        return from(this._api.post('herramientas/AlmacenUbicacion/listarAlmacenUbicacion', params)).pipe(
            switchMap((response: any) => {
                const locations = response?.datos || [];
                this._locations.next(locations);
                return of(locations);
            })
        );
    }

    /**
     * Get location by id
     */
    getLocationById(id: string): Observable<Location> {
        return from(this._api.post('herramientas/AlmacenUbicacion/listarAlmacenUbicacion', {
            start: 0,
            limit: 1,
            id_ubicacion: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || null);
            })
        );
    }

    /**
     * Create location
     */
    createLocation(location: Partial<Location>): Observable<Location> {
        return from(this._api.post('herramientas/AlmacenUbicacion/insertarAlmacenUbicacion', location)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || location);
            })
        );
    }

    /**
     * Update location
     */
    updateLocation(id: string, location: Partial<Location>): Observable<Location> {
        return from(this._api.post('herramientas/AlmacenUbicacion/insertarAlmacenUbicacion', {
            ...location,
            id_ubicacion: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || location);
            })
        );
    }

    /**
     * Delete location
     */
    deleteLocation(id: string): Observable<void> {
        return from(this._api.post('herramientas/AlmacenUbicacion/eliminarAlmacenUbicacion', {
            id_ubicacion: id
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }
}
