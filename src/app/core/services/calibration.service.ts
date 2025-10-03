import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject, tap } from 'rxjs';
import { CalibrationAlert, CalibrationRecord, MaintenanceRecord } from '../models';

@Injectable({ providedIn: 'root' })
export class CalibrationService {
    private _httpClient = inject(HttpClient);
    private _calibrations: ReplaySubject<CalibrationRecord[]> = new ReplaySubject<CalibrationRecord[]>(1);
    private _maintenances: ReplaySubject<MaintenanceRecord[]> = new ReplaySubject<MaintenanceRecord[]>(1);
    private _alerts: ReplaySubject<CalibrationAlert[]> = new ReplaySubject<CalibrationAlert[]>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for calibrations
     */
    get calibrations$(): Observable<CalibrationRecord[]> {
        return this._calibrations.asObservable();
    }

    /**
     * Getter for maintenances
     */
    get maintenances$(): Observable<MaintenanceRecord[]> {
        return this._maintenances.asObservable();
    }

    /**
     * Getter for alerts
     */
    get alerts$(): Observable<CalibrationAlert[]> {
        return this._alerts.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Calibration
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all calibration records
     */
    getCalibrations(filters?: any): Observable<CalibrationRecord[]> {
        return this._httpClient.get<CalibrationRecord[]>('api/calibrations', { params: filters }).pipe(
            tap((calibrations) => {
                this._calibrations.next(calibrations);
            })
        );
    }

    /**
     * Get calibration by id
     */
    getCalibrationById(id: string): Observable<CalibrationRecord> {
        return this._httpClient.get<CalibrationRecord>(`api/calibrations/${id}`);
    }

    /**
     * Send tool to calibration
     */
    sendToCalibration(record: Partial<CalibrationRecord>): Observable<CalibrationRecord> {
        return this._httpClient.post<CalibrationRecord>('api/calibrations/send', record);
    }

    /**
     * Receive tool from calibration
     */
    receiveFromCalibration(id: string, data: any): Observable<CalibrationRecord> {
        return this._httpClient.post<CalibrationRecord>(`api/calibrations/${id}/receive`, data);
    }

    /**
     * Update calibration record
     */
    updateCalibration(id: string, record: Partial<CalibrationRecord>): Observable<CalibrationRecord> {
        return this._httpClient.put<CalibrationRecord>(`api/calibrations/${id}`, record);
    }

    /**
     * Cancel calibration
     */
    cancelCalibration(id: string, reason: string): Observable<CalibrationRecord> {
        return this._httpClient.post<CalibrationRecord>(`api/calibrations/${id}/cancel`, { reason });
    }

    /**
     * Get calibration history for a tool
     */
    getToolCalibrationHistory(toolId: string): Observable<CalibrationRecord[]> {
        return this._httpClient.get<CalibrationRecord[]>(`api/calibrations/tool/${toolId}`);
    }

    /**
     * Get active calibrations (in-process calibrations)
     */
    getActiveCalibrations(): Observable<CalibrationRecord[]> {
        return this.getCalibrations({ status: 'in_process' });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Maintenance
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all maintenance records
     */
    getMaintenances(filters?: any): Observable<MaintenanceRecord[]> {
        return this._httpClient.get<MaintenanceRecord[]>('api/maintenances', { params: filters }).pipe(
            tap((maintenances) => {
                this._maintenances.next(maintenances);
            })
        );
    }

    /**
     * Get maintenance by id
     */
    getMaintenanceById(id: string): Observable<MaintenanceRecord> {
        return this._httpClient.get<MaintenanceRecord>(`api/maintenances/${id}`);
    }

    /**
     * Send tool to maintenance
     */
    sendToMaintenance(record: Partial<MaintenanceRecord>): Observable<MaintenanceRecord> {
        return this._httpClient.post<MaintenanceRecord>('api/maintenances/send', record);
    }

    /**
     * Receive tool from maintenance
     */
    receiveFromMaintenance(id: string, data: any): Observable<MaintenanceRecord> {
        return this._httpClient.post<MaintenanceRecord>(`api/maintenances/${id}/receive`, data);
    }

    /**
     * Update maintenance record
     */
    updateMaintenance(id: string, record: Partial<MaintenanceRecord>): Observable<MaintenanceRecord> {
        return this._httpClient.put<MaintenanceRecord>(`api/maintenances/${id}`, record);
    }

    /**
     * Get maintenance history for a tool
     */
    getToolMaintenanceHistory(toolId: string): Observable<MaintenanceRecord[]> {
        return this._httpClient.get<MaintenanceRecord[]>(`api/maintenances/tool/${toolId}`);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Alerts
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get calibration alerts
     */
    getCalibrationAlerts(): Observable<CalibrationAlert[]> {
        return this._httpClient.get<CalibrationAlert[]>('api/calibrations/alerts').pipe(
            tap((alerts) => {
                this._alerts.next(alerts);
            })
        );
    }

    /**
     * Get critical alerts
     */
    getCriticalAlerts(): Observable<CalibrationAlert[]> {
        return this._httpClient.get<CalibrationAlert[]>('api/calibrations/alerts/critical');
    }
}
