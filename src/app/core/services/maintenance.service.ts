import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { Maintenance, MaintenanceFormData, MaintenanceCompletionData } from '../models/maintenance.types';

@Injectable({
    providedIn: 'root'
})
export class MaintenanceService {
    private _httpClient = inject(HttpClient);
    private _maintenances = new BehaviorSubject<Maintenance[]>([]);
    private readonly _apiUrl = '/api/maintenances';

    /**
     * Getter for maintenances
     */
    get maintenances$(): Observable<Maintenance[]> {
        return this._maintenances.asObservable();
    }

    /**
     * Get all maintenance records
     */
    getMaintenances(): Observable<Maintenance[]> {
        return this._httpClient.get<Maintenance[]>(this._apiUrl).pipe(
            tap((maintenances) => {
                this._maintenances.next(maintenances);
            })
        );
    }

    /**
     * Get maintenance by ID
     */
    getMaintenanceById(id: string): Observable<Maintenance> {
        return this._httpClient.get<Maintenance>(`${this._apiUrl}/${id}`);
    }

    /**
     * Get maintenance records for a specific tool
     */
    getMaintenancesByTool(toolId: string): Observable<Maintenance[]> {
        return this._httpClient.get<Maintenance[]>(`${this._apiUrl}/tool/${toolId}`);
    }

    /**
     * Create a new maintenance record
     */
    createMaintenance(data: MaintenanceFormData): Observable<Maintenance> {
        return this._httpClient.post<Maintenance>(this._apiUrl, data).pipe(
            tap((newMaintenance) => {
                const currentMaintenances = this._maintenances.value;
                this._maintenances.next([newMaintenance, ...currentMaintenances]);
            })
        );
    }

    /**
     * Update an existing maintenance record
     */
    updateMaintenance(id: string, data: Partial<Maintenance>): Observable<Maintenance> {
        return this._httpClient.put<Maintenance>(`${this._apiUrl}/${id}`, data).pipe(
            tap((updatedMaintenance) => {
                const currentMaintenances = this._maintenances.value;
                const index = currentMaintenances.findIndex(m => m.id === id);
                if (index !== -1) {
                    currentMaintenances[index] = updatedMaintenance;
                    this._maintenances.next(currentMaintenances);
                }
            })
        );
    }

    /**
     * Complete a maintenance record
     */
    completeMaintenance(id: string, data: MaintenanceCompletionData): Observable<Maintenance> {
        return this._httpClient.post<Maintenance>(`${this._apiUrl}/${id}/receive`, data).pipe(
            tap((completedMaintenance) => {
                const currentMaintenances = this._maintenances.value;
                const index = currentMaintenances.findIndex(m => m.id === id);
                if (index !== -1) {
                    currentMaintenances[index] = completedMaintenance;
                    this._maintenances.next(currentMaintenances);
                }
            })
        );
    }

    /**
     * Change maintenance status
     */
    changeMaintenanceStatus(id: string, status: 'in_progress' | 'cancelled'): Observable<Maintenance> {
        return this._httpClient.put<Maintenance>(`${this._apiUrl}/${id}`, { status }).pipe(
            tap((updatedMaintenance) => {
                const currentMaintenances = this._maintenances.value;
                const index = currentMaintenances.findIndex(m => m.id === id);
                if (index !== -1) {
                    currentMaintenances[index] = updatedMaintenance;
                    this._maintenances.next(currentMaintenances);
                }
            })
        );
    }

    /**
     * Delete a maintenance record
     */
    deleteMaintenance(id: string): Observable<void> {
        return this._httpClient.delete<void>(`${this._apiUrl}/${id}`).pipe(
            tap(() => {
                const currentMaintenances = this._maintenances.value;
                const filteredMaintenances = currentMaintenances.filter(m => m.id !== id);
                this._maintenances.next(filteredMaintenances);
            })
        );
    }
}
