import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap } from 'rxjs';
import { CalibrationAlert, CalibrationRecord, MaintenanceRecord } from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class CalibrationService {
    private _api = inject(ErpApiService);
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
        const params = {
            start: 0,
            limit: 50,
            sort: 'fecha_envio',
            dir: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/Calibracion/listarCalibracion', params)).pipe(
            switchMap((response: any) => {
                const calibrations = response?.datos || [];
                this._calibrations.next(calibrations);
                return of(calibrations);
            })
        );
    }

    /**
     * Get calibration by id
     */
    getCalibrationById(id: string): Observable<CalibrationRecord> {
        return from(this._api.post('herramientas/Calibracion/listarCalibracion', {
            start: 0,
            limit: 1,
            id_calibracion: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || null);
            })
        );
    }

    /**
     * Send tool to calibration
     */
    sendToCalibration(record: Partial<CalibrationRecord>): Observable<CalibrationRecord> {
        return from(this._api.post('herramientas/Calibracion/insertarCalibracion', record)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || record);
            })
        );
    }

    /**
     * Receive tool from calibration
     */
    receiveFromCalibration(id: string, data: any): Observable<CalibrationRecord> {
        return from(this._api.post('herramientas/Calibracion/insertarCalibracion', {
            ...data,
            id_calibracion: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || data);
            })
        );
    }

    /**
     * Update calibration record
     */
    updateCalibration(id: string, record: Partial<CalibrationRecord>): Observable<CalibrationRecord> {
        return from(this._api.post('herramientas/Calibracion/insertarCalibracion', {
            ...record,
            id_calibracion: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || record);
            })
        );
    }

    /**
     * Cancel calibration
     */
    cancelCalibration(id: string, reason: string): Observable<CalibrationRecord> {
        return from(this._api.post('herramientas/Calibracion/insertarCalibracion', {
            id_calibracion: id,
            estado: 'cancelled',
            observaciones: reason
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Get calibration history for a tool
     */
    getToolCalibrationHistory(toolId: string): Observable<CalibrationRecord[]> {
        return from(this._api.post('herramientas/Calibracion/listarCalibracion', {
            start: 0,
            limit: 50,
            id_herramienta: toolId,
            sort: 'fecha_envio',
            dir: 'desc'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get active calibrations (in-process calibrations)
     */
    getActiveCalibrations(): Observable<CalibrationRecord[]> {
        return this.getCalibrations({ estado: 'in_process' });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Maintenance
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all maintenance records
     */
    getMaintenances(filters?: any): Observable<MaintenanceRecord[]> {
        const params = {
            start: 0,
            limit: 50,
            sort: 'fecha_inicio',
            dir: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/Mantenimiento/listarMantenimiento', params)).pipe(
            switchMap((response: any) => {
                const maintenances = response?.datos || [];
                this._maintenances.next(maintenances);
                return of(maintenances);
            })
        );
    }

    /**
     * Get maintenance by id
     */
    getMaintenanceById(id: string): Observable<MaintenanceRecord> {
        return from(this._api.post('herramientas/Mantenimiento/listarMantenimiento', {
            start: 0,
            limit: 1,
            id_mantenimiento: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || null);
            })
        );
    }

    /**
     * Send tool to maintenance
     */
    sendToMaintenance(record: Partial<MaintenanceRecord>): Observable<MaintenanceRecord> {
        return from(this._api.post('herramientas/Mantenimiento/insertarMantenimiento', record)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || record);
            })
        );
    }

    /**
     * Receive tool from maintenance
     */
    receiveFromMaintenance(id: string, data: any): Observable<MaintenanceRecord> {
        return from(this._api.post('herramientas/Mantenimiento/insertarMantenimiento', {
            ...data,
            id_mantenimiento: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || data);
            })
        );
    }

    /**
     * Update maintenance record
     */
    updateMaintenance(id: string, record: Partial<MaintenanceRecord>): Observable<MaintenanceRecord> {
        return from(this._api.post('herramientas/Mantenimiento/insertarMantenimiento', {
            ...record,
            id_mantenimiento: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || record);
            })
        );
    }

    /**
     * Get maintenance history for a tool
     */
    getToolMaintenanceHistory(toolId: string): Observable<MaintenanceRecord[]> {
        return from(this._api.post('herramientas/Mantenimiento/listarMantenimiento', {
            start: 0,
            limit: 50,
            id_herramienta: toolId,
            sort: 'fecha_inicio',
            dir: 'desc'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Alerts
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get calibration alerts
     */
    getCalibrationAlerts(): Observable<CalibrationAlert[]> {
        return from(this._api.post('herramientas/Calibracion/obtenerResumenAlertas', {})).pipe(
            switchMap((response: any) => {
                const alerts = response?.datos || [];
                this._alerts.next(alerts);
                return of(alerts);
            })
        );
    }

    /**
     * Get critical alerts (upcoming calibration < 30 days)
     */
    getCriticalAlerts(): Observable<CalibrationAlert[]> {
        return from(this._api.post('herramientas/Calibracion/obtenerAlertasCalibracionProxima', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get expired calibration alerts
     */
    getExpiredAlerts(): Observable<CalibrationAlert[]> {
        return from(this._api.post('herramientas/Calibracion/obtenerAlertasCalibracionVencida', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }
}
