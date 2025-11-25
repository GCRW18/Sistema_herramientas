import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap } from 'rxjs';
import { Aircraft, AircraftFilters } from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class FleetService {
    private _api = inject(ErpApiService);
    private _aircraft: ReplaySubject<Aircraft[]> = new ReplaySubject<Aircraft[]>(1);
    private _singleAircraft: ReplaySubject<Aircraft> = new ReplaySubject<Aircraft>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for aircraft list
     */
    get aircraft$(): Observable<Aircraft[]> {
        return this._aircraft.asObservable();
    }

    /**
     * Getter for single aircraft
     */
    get singleAircraft$(): Observable<Aircraft> {
        return this._singleAircraft.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all aircraft
     */
    getAircraft(filters?: AircraftFilters): Observable<Aircraft[]> {
        const params: any = {
            start: 0,
            limit: 50,
            sort: 'matricula',
            dir: 'asc',
            ...filters
        };

        return from(this._api.post('herramientas/aircraft/listAircraft', params)).pipe(
            switchMap((response: any) => {
                const aircraft = response?.datos || [];
                this._aircraft.next(aircraft);
                return of(aircraft);
            })
        );
    }

    /**
     * Get aircraft by id
     */
    getAircraftById(id: string): Observable<Aircraft> {
        return from(this._api.post('herramientas/aircraft/listAircraft', {
            start: 0,
            limit: 1,
            id_aircraft: id
        })).pipe(
            switchMap((response: any) => {
                const aircraft = response?.datos?.[0] || null;
                if (aircraft) {
                    this._singleAircraft.next(aircraft);
                }
                return of(aircraft);
            })
        );
    }

    /**
     * Get aircraft by registration
     */
    getAircraftByRegistration(registration: string): Observable<Aircraft> {
        return from(this._api.post('herramientas/aircraft/listAircraft', {
            start: 0,
            limit: 1,
            matricula: registration
        })).pipe(
            switchMap((response: any) => {
                const aircraft = response?.datos?.[0] || null;
                if (aircraft) {
                    this._singleAircraft.next(aircraft);
                }
                return of(aircraft);
            })
        );
    }

    /**
     * Create aircraft
     */
    createAircraft(aircraft: Partial<Aircraft>): Observable<Aircraft> {
        return from(this._api.post('herramientas/aircraft/insertAircraft', aircraft)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || aircraft);
            })
        );
    }

    /**
     * Update aircraft
     */
    updateAircraft(id: string, aircraft: Partial<Aircraft>): Observable<Aircraft> {
        return from(this._api.post('herramientas/aircraft/updateAircraft', {
            ...aircraft,
            id_aircraft: id
        })).pipe(
            switchMap((response: any) => {
                const updatedAircraft = response?.datos || aircraft;
                this._singleAircraft.next(updatedAircraft as Aircraft);
                return of(updatedAircraft);
            })
        );
    }

    /**
     * Delete aircraft
     */
    deleteAircraft(id: string): Observable<void> {
        return from(this._api.post('herramientas/aircraft/deleteAircraft', {
            id_aircraft: id
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }

    /**
     * Get aircraft statistics
     */
    getAircraftStatistics(): Observable<any> {
        return from(this._api.post('herramientas/aircraft/getAircraftStats', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Get aircraft maintenance history
     */
    getMaintenanceHistory(id: string): Observable<any[]> {
        return from(this._api.post('herramientas/aircraft/getMaintenanceHistory', {
            id_aircraft: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get tools assigned to aircraft
     */
    getAssignedTools(id: string): Observable<any[]> {
        return from(this._api.post('herramientas/aircraft/getAssignedTools', {
            id_aircraft: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }
}
