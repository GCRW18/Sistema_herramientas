import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap, catchError } from 'rxjs';
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
            sort: 'send_date',
            dir: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/calibrations/listCalibrations', params)).pipe(
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
        return from(this._api.post('herramientas/calibrations/listCalibrations', {
            start: 0,
            limit: 1,
            id_calibration: id
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
        return from(this._api.post('herramientas/calibrations/insertCalibration', record)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || record);
            })
        );
    }

    /**
     * Receive tool from calibration
     */
    receiveFromCalibration(id: string, data: any): Observable<CalibrationRecord> {
        return from(this._api.post('herramientas/calibrations/updateCalibration', {
            ...data,
            id_calibration: id
        })).pipe(
            switchMap((response: any) => {
                console.log('receiveFromCalibration response:', response);
                return of(response?.datos || data);
            })
        );
    }

    /**
     * Update calibration record
     */
    updateCalibration(id: string, record: Partial<CalibrationRecord>): Observable<CalibrationRecord> {
        return from(this._api.post('herramientas/calibrations/insertCalibration', {
            ...record,
            id_calibration: id
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
        return from(this._api.post('herramientas/calibrations/insertCalibration', {
            id_calibration: id,
            status: 'cancelled',
            notes: reason
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
        return from(this._api.post('herramientas/calibrations/listCalibrations', {
            start: 0,
            limit: 50,
            tool_id: toolId,
            sort: 'send_date',
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
        return this.getCalibrations({ status: 'in_process' });
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
            sort: 'start_date',
            dir: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/maintenances/listMaintenances', params)).pipe(
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
        return from(this._api.post('herramientas/maintenances/listMaintenances', {
            start: 0,
            limit: 1,
            id_maintenance: id
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
        return from(this._api.post('herramientas/maintenances/insertMaintenance', record)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || record);
            })
        );
    }

    /**
     * Receive tool from maintenance
     */
    receiveFromMaintenance(id: string, data: any): Observable<MaintenanceRecord> {
        return from(this._api.post('herramientas/maintenances/insertMaintenance', {
            ...data,
            id_maintenance: id
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
        return from(this._api.post('herramientas/maintenances/insertMaintenance', {
            ...record,
            id_maintenance: id
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
        return from(this._api.post('herramientas/maintenances/listMaintenances', {
            start: 0,
            limit: 50,
            tool_id: toolId,
            sort: 'start_date',
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
        return from(this._api.post('herramientas/calibrations/getResumenAlertas', {})).pipe(
            switchMap((response: any) => {
                const alerts = response?.datos || [];
                this._alerts.next(alerts);
                return of(alerts);
            }),
            // Capturar error pero extraer datos si existen
            catchError((error) => {
                console.warn('Error en getCalibrationAlerts, intentando extraer datos:', error);
                const datos = error?.ROOT?.datos || error?.datos || [];
                if (datos && datos.length > 0) {
                    console.log('Datos recuperados a pesar del error:', datos);
                    this._alerts.next(datos);
                    return of(datos);
                }
                return of([]);
            })
        );
    }

    /**
     * Get critical alerts (upcoming calibration < 30 days)
     */
    getCriticalAlerts(): Observable<CalibrationAlert[]> {
        return from(this._api.post('herramientas/calibrations/getUpcomingCalibrationAlerts', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get expired calibration alerts
     */
    getExpiredAlerts(): Observable<CalibrationAlert[]> {
        return from(this._api.post('herramientas/calibrations/getExpiredCalibrationAlerts', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }
}
