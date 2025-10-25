import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject, tap } from 'rxjs';
import { Aircraft, AircraftFilters } from '../models';

@Injectable({ providedIn: 'root' })
export class FleetService {
    private _httpClient = inject(HttpClient);
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
        return this._httpClient.get<Aircraft[]>('api/fleet', { params: filters as any }).pipe(
            tap((aircraft) => {
                this._aircraft.next(aircraft);
            })
        );
    }

    /**
     * Get aircraft by id
     */
    getAircraftById(id: string): Observable<Aircraft> {
        return this._httpClient.get<Aircraft>(`api/fleet/${id}`).pipe(
            tap((aircraft) => {
                this._singleAircraft.next(aircraft);
            })
        );
    }

    /**
     * Get aircraft by registration
     */
    getAircraftByRegistration(registration: string): Observable<Aircraft> {
        return this._httpClient.get<Aircraft>(`api/fleet/registration/${registration}`).pipe(
            tap((aircraft) => {
                this._singleAircraft.next(aircraft);
            })
        );
    }

    /**
     * Create aircraft
     */
    createAircraft(aircraft: Partial<Aircraft>): Observable<Aircraft> {
        return this._httpClient.post<Aircraft>('api/fleet', aircraft);
    }

    /**
     * Update aircraft
     */
    updateAircraft(id: string, aircraft: Partial<Aircraft>): Observable<Aircraft> {
        return this._httpClient.put<Aircraft>(`api/fleet/${id}`, aircraft).pipe(
            tap((updatedAircraft) => {
                this._singleAircraft.next(updatedAircraft);
            })
        );
    }

    /**
     * Delete aircraft
     */
    deleteAircraft(id: string): Observable<void> {
        return this._httpClient.delete<void>(`api/fleet/${id}`);
    }

    /**
     * Get aircraft statistics
     */
    getAircraftStatistics(): Observable<any> {
        return this._httpClient.get<any>('api/fleet/statistics');
    }

    /**
     * Get aircraft maintenance history
     */
    getMaintenanceHistory(id: string): Observable<any[]> {
        return this._httpClient.get<any[]>(`api/fleet/${id}/maintenance-history`);
    }

    /**
     * Get tools assigned to aircraft
     */
    getAssignedTools(id: string): Observable<any[]> {
        return this._httpClient.get<any[]>(`api/fleet/${id}/tools`);
    }
}
