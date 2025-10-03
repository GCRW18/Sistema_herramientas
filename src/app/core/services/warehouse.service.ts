import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject, tap } from 'rxjs';
import { Location, Warehouse } from '../models';

@Injectable({ providedIn: 'root' })
export class WarehouseService {
    private _httpClient = inject(HttpClient);
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
        return this._httpClient.get<Warehouse[]>('api/warehouses').pipe(
            tap((warehouses) => {
                this._warehouses.next(warehouses);
            })
        );
    }

    /**
     * Get warehouse by id
     */
    getWarehouseById(id: string): Observable<Warehouse> {
        return this._httpClient.get<Warehouse>(`api/warehouses/${id}`);
    }

    /**
     * Create warehouse
     */
    createWarehouse(warehouse: Partial<Warehouse>): Observable<Warehouse> {
        return this._httpClient.post<Warehouse>('api/warehouses', warehouse);
    }

    /**
     * Update warehouse
     */
    updateWarehouse(id: string, warehouse: Partial<Warehouse>): Observable<Warehouse> {
        return this._httpClient.put<Warehouse>(`api/warehouses/${id}`, warehouse);
    }

    /**
     * Delete warehouse
     */
    deleteWarehouse(id: string): Observable<void> {
        return this._httpClient.delete<void>(`api/warehouses/${id}`);
    }

    /**
     * Get all locations
     */
    getLocations(warehouseId?: string): Observable<Location[]> {
        const url = warehouseId
            ? `api/locations?warehouseId=${warehouseId}`
            : 'api/locations';

        return this._httpClient.get<Location[]>(url).pipe(
            tap((locations) => {
                this._locations.next(locations);
            })
        );
    }

    /**
     * Get location by id
     */
    getLocationById(id: string): Observable<Location> {
        return this._httpClient.get<Location>(`api/locations/${id}`);
    }

    /**
     * Create location
     */
    createLocation(location: Partial<Location>): Observable<Location> {
        return this._httpClient.post<Location>('api/locations', location);
    }

    /**
     * Update location
     */
    updateLocation(id: string, location: Partial<Location>): Observable<Location> {
        return this._httpClient.put<Location>(`api/locations/${id}`, location);
    }

    /**
     * Delete location
     */
    deleteLocation(id: string): Observable<void> {
        return this._httpClient.delete<void>(`api/locations/${id}`);
    }
}
