import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap, catchError } from 'rxjs';
import {
    CalibrationAlert,
    CalibrationRecord,
    MaintenanceRecord,
    CalibrationDashboard,
    CalibrationLaboratory,
    CalibrationFilters,
    CalibrationReportMGH102,
    ScanToolResult,
    CalibrationBatch,
    CalibrationBatchItem,
    PxpCalibrationAlert,
    PxpCalibrationDashboard,
    JackServiceStatus,
    JackServiceType
} from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class CalibrationService {
    private _api = inject(ErpApiService);
    private _calibrations: ReplaySubject<CalibrationRecord[]> = new ReplaySubject<CalibrationRecord[]>(1);
    private _maintenances: ReplaySubject<MaintenanceRecord[]> = new ReplaySubject<MaintenanceRecord[]>(1);
    private _alerts: ReplaySubject<CalibrationAlert[]> = new ReplaySubject<CalibrationAlert[]>(1);
    private _laboratories: ReplaySubject<CalibrationLaboratory[]> = new ReplaySubject<CalibrationLaboratory[]>(1);
    private _dashboard: ReplaySubject<CalibrationDashboard | null> = new ReplaySubject<CalibrationDashboard | null>(1);

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

    /**
     * Getter for laboratories
     */
    get laboratories$(): Observable<CalibrationLaboratory[]> {
        return this._laboratories.asObservable();
    }

    /**
     * Getter for dashboard
     */
    get dashboard$(): Observable<CalibrationDashboard | null> {
        return this._dashboard.asObservable();
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
    // @ Public methods - PXP Backend v3: Flujo de Calibración
    // -----------------------------------------------------------------------------------------------------

    /**
     * Enviar herramienta a calibración (PXP: HE_CLS_SEND)
     * Crea registro de calibración con status 'sent', genera record_number EC-XXXX/YYYY
     */
    sendToCalibrationPxp(params: {
        tool_id: number;
        calibration_type?: string;
        supplier_id?: number;
        supplier_name?: string;
        send_date?: string;
        expected_return_date?: string;
        service_order?: string;
        cost?: number;
        currency?: string;
        notes?: string;
    }): Observable<any> {
        return from(this._api.post('herramientas/calibrations/sendToCalibration', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    /**
     * Procesar retorno de calibración (PXP: HE_CLS_PROC)
     * Auto-actualiza ttools: last_calibration_date, next_calibration_date, status
     */
    processCalibrationReturnPxp(params: {
        id_calibration: number;
        result: 'approved' | 'conditional' | 'rejected';
        calibration_date?: string;
        certificate_number?: string;
        certificate_date?: string;
        next_calibration_date?: string;
        physical_condition?: string;
        calibration_performed?: boolean;
        notes?: string;
        observations?: string;
        // Campos para gatas
        jack_semiannual_date?: string;
        jack_annual_date?: string;
    }): Observable<any> {
        return from(this._api.post('herramientas/calibrations/processCalibrationReturn', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    /**
     * Escanear herramienta por código de barras (PXP: HE_CLS_SCAN)
     * Retorna info completa incluyendo detección de gata y advertencias
     */
    scanToolForCalibration(barcode: string): Observable<ScanToolResult> {
        return from(this._api.post('herramientas/calibrations/scanToolForCalibration', {
            barcode_scan: barcode
        })).pipe(
            switchMap((response: any) => {
                const data = response?.datos?.[0] || response?.datos || null;
                return of(data);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - PXP Backend v3: Lotes de Calibración (Supermercado)
    // -----------------------------------------------------------------------------------------------------

    /**
     * Crear cabecera de lote de calibración (PXP: HE_CLS_BATCH_INS)
     * Genera batch_number LC-XXXX/YYYY automáticamente
     */
    createCalibrationBatch(params: {
        laboratory_id?: number;
        laboratory_name?: string;
        base_id?: number;
        base_name?: string;
        send_date?: string;
        expected_return_date?: string;
        service_order?: string;
        notes?: string;
    }): Observable<CalibrationBatch> {
        return from(this._api.post('herramientas/calibrations/createCalibrationBatch', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    /**
     * Agregar herramienta escaneada al lote (PXP: HE_CLS_BATCH_ITEM)
     * Acepta barcode_scan o tool_id directo
     */
    addToolToBatch(params: {
        batch_id: number;
        barcode_scan?: string;
        tool_id?: number;
        notes?: string;
    }): Observable<CalibrationBatchItem> {
        return from(this._api.post('herramientas/calibrations/addToolToBatch', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    /**
     * Confirmar y enviar lote a laboratorio (PXP: HE_CLS_BATCH_CONF)
     * Crea registros individuales de calibración por cada herramienta
     */
    confirmCalibrationBatch(params: {
        batch_id: number;
        approved_by_id?: number;
        approved_by_name?: string;
    }): Observable<any> {
        return from(this._api.post('herramientas/calibrations/confirmCalibrationBatch', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    /**
     * Eliminar item de lote abierto (PXP: HE_CLS_BATCH_DEL)
     */
    removeFromBatch(batchItemId: number): Observable<any> {
        return from(this._api.post('herramientas/calibrations/removeFromBatch', {
            id_batch_item: batchItemId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    /**
     * Listar lotes de calibración (PXP: HE_CLS_BATCH_SEL)
     */
    getCalibrationBatches(filters?: any): Observable<CalibrationBatch[]> {
        const params = {
            start: 0,
            limit: 50,
            sort: 'id_batch',
            dir: 'desc',
            ...filters
        };
        return from(this._api.post('herramientas/calibrations/listarCalibrationBatches', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Listar items de un lote específico (PXP: HE_CLS_BATCH_DET)
     */
    getBatchItems(batchId: number): Observable<CalibrationBatchItem[]> {
        return from(this._api.post('herramientas/calibrations/listarBatchItems', {
            start: 0,
            limit: 200,
            id_batch: batchId,
            sort: 'scan_order',
            dir: 'asc'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Procesar retorno de lote completo desde laboratorio (PXP: HE_CBT_RET)
     * Actualiza resultado, fechas y estado de cada herramienta del lote
     */
    processReturnBatch(params: {
        batch_id: number;
        actual_return_date?: string;
        notes?: string;
        items?: Array<{
            id_batch_item: number;
            result: 'approved' | 'conditional' | 'rejected';
            certificate_number?: string;
            certificate_date?: string;
            next_calibration_date?: string;
            cost?: number;
        }>;
    }): Observable<any> {
        return from(this._api.post('herramientas/calibrationBatches/processReturnBatch', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - PXP Backend v3: Dashboard y Alertas Mejoradas
    // -----------------------------------------------------------------------------------------------------

    /**
     * Dashboard de calibraciones en tiempo real (PXP: HE_CLS_DASH)
     * Retorna 14 métricas incluyendo gatas y lotes
     */
    getCalibrationDashboardPxp(): Observable<PxpCalibrationDashboard> {
        return from(this._api.post('herramientas/calibrations/getCalibrationDashboard', {})).pipe(
            switchMap((response: any) => {
                const data = response?.datos?.[0] || response?.datos || this._getDefaultPxpDashboard();
                return of(data);
            }),
            catchError(() => {
                return of(this._getDefaultPxpDashboard());
            })
        );
    }

    /**
     * Alertas mejoradas con niveles de urgencia (PXP: HE_CLS_ALERTS)
     */
    getCalibrationAlertsPxp(filters?: any): Observable<PxpCalibrationAlert[]> {
        const params = {
            start: 0,
            limit: 100,
            sort: 'next_calibration_date',
            dir: 'asc',
            ...filters
        };
        return from(this._api.post('herramientas/calibrations/getCalibrationAlerts', params)).pipe(
            switchMap((response: any) => {
                const alerts = response?.datos || [];
                return of(alerts);
            }),
            catchError(() => of([]))
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - PXP Backend v3: Gatas (Jacks)
    // -----------------------------------------------------------------------------------------------------

    /**
     * Listado de gatas con estado de servicios (PXP: HE_CLS_JACK_SEL)
     */
    getJackServiceStatus(filters?: any): Observable<JackServiceStatus[]> {
        const params = {
            start: 0,
            limit: 100,
            sort: 'next_calibration_date',
            dir: 'asc',
            ...filters
        };
        return from(this._api.post('herramientas/calibrations/listarJackServiceStatus', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Registrar servicio preventivo de gata (PXP: HE_CLS_JACK_SVC)
     * Tipos: 'semiannual', 'annual', 'both'
     */
    registerJackService(params: {
        tool_id: number;
        service_type: JackServiceType;
        service_date?: string;
        notes?: string;
    }): Observable<any> {
        return from(this._api.post('herramientas/calibrations/registerJackService', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    /**
     * Dashboard PXP por defecto
     * @private
     */
    private _getDefaultPxpDashboard(): PxpCalibrationDashboard {
        return {
            cal_valid: 0,
            cal_expiring_30d: 0,
            cal_expiring_7d: 0,
            cal_expired: 0,
            cal_in_lab: 0,
            total_calibratable: 0,
            jacks_semi_expired: 0,
            jacks_semi_expiring_30d: 0,
            jacks_annual_expired: 0,
            jacks_annual_expiring_30d: 0,
            total_jacks: 0,
            open_batches: 0,
            active_calibrations: 0,
            overdue_calibrations: 0
        };
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

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Dashboard & KPIs
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get calibration dashboard with KPIs
     */
    getDashboard(): Observable<CalibrationDashboard> {
        return from(this._api.post('herramientas/calibrations/getDashboard', {})).pipe(
            switchMap((response: any) => {
                const dashboard = response?.datos || this._getDefaultDashboard();
                this._dashboard.next(dashboard);
                return of(dashboard);
            }),
            catchError(() => {
                const defaultDashboard = this._getDefaultDashboard();
                this._dashboard.next(defaultDashboard);
                return of(defaultDashboard);
            })
        );
    }

    /**
     * Get default dashboard structure
     * @private
     */
    private _getDefaultDashboard(): CalibrationDashboard {
        return {
            totalToolsRequiringCalibration: 0,
            toolsInCalibration: 0,
            calibrationsValid: 0,
            calibrationsExpiringSoon: 0,
            calibrationsExpired: 0,
            calibrationsPending: 0,
            calibrationsSent: 0,
            calibrationsInProcess: 0,
            calibrationsReturned: 0,
            calibrationsApproved: 0,
            calibrationsRejected: 0,
            calibrationsConditional: 0,
            totalCostThisMonth: 0,
            totalCostThisYear: 0,
            averageCostPerCalibration: 0,
            averageDaysInLaboratory: 0,
            calibrationsByMonth: [],
            costsByMonth: []
        };
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Laboratories
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all laboratories
     */
    getLaboratories(): Observable<CalibrationLaboratory[]> {
        return from(this._api.post('herramientas/laboratories/listLaboratories', {
            start: 0,
            limit: 100,
            active: true
        })).pipe(
            switchMap((response: any) => {
                const labs = response?.datos || [];
                this._laboratories.next(labs);
                return of(labs);
            })
        );
    }

    /**
     * Get laboratory by id
     */
    getLaboratoryById(id: string): Observable<CalibrationLaboratory> {
        return from(this._api.post('herramientas/laboratories/listLaboratories', {
            start: 0,
            limit: 1,
            id_laboratory: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || null);
            })
        );
    }

    /**
     * Create or update laboratory
     */
    saveLaboratory(laboratory: Partial<CalibrationLaboratory>): Observable<CalibrationLaboratory> {
        return from(this._api.post('herramientas/laboratories/saveLaboratory', laboratory)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || laboratory);
            }),
            tap(() => {
                // Refresh laboratories list
                this.getLaboratories().subscribe();
            })
        );
    }

    /**
     * Delete laboratory
     */
    deleteLaboratory(id: string): Observable<boolean> {
        return from(this._api.post('herramientas/laboratories/deleteLaboratory', {
            id_laboratory: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.success || true);
            }),
            tap(() => {
                // Refresh laboratories list
                this.getLaboratories().subscribe();
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Reports (MGH)
    // -----------------------------------------------------------------------------------------------------

    /**
     * Generate MGH-102 Report: Herramientas sujetas a calibración
     */
    getReportMGH102(filters?: any): Observable<CalibrationReportMGH102> {
        return from(this._api.post('herramientas/calibrations/generateReportMGH102', filters || {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || { tools: [], generatedAt: new Date().toISOString() });
            })
        );
    }

    /**
     * Generate MGH-103 Report: Reporte mensual de calibraciones
     */
    getReportMGH103(year: number, month: number): Observable<any> {
        return from(this._api.post('herramientas/calibrations/generateReportMGH103', {
            year,
            month
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || { calibrations: [], month, year });
            })
        );
    }

    /**
     * Generate MGH-104 Report: Próximas a vencer
     */
    getReportMGH104(daysAhead: number = 30): Observable<any> {
        return from(this._api.post('herramientas/calibrations/generateReportMGH104', {
            days_ahead: daysAhead
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || { tools: [], daysAhead });
            })
        );
    }

    /**
     * Export report to Excel
     */
    exportReportToExcel(reportCode: string, filters?: any): Observable<Blob> {
        return from(this._api.post('herramientas/calibrations/exportReport', {
            report_code: reportCode,
            format: 'excel',
            ...filters
        }, {
            responseType: 'blob'
        })).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }

    /**
     * Export report to PDF
     */
    exportReportToPDF(reportCode: string, filters?: any): Observable<Blob> {
        return from(this._api.post('herramientas/calibrations/exportReport', {
            report_code: reportCode,
            format: 'pdf',
            ...filters
        }, {
            responseType: 'blob'
        })).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Statistics & Analytics
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get calibration statistics by date range
     */
    getStatistics(dateFrom: string, dateTo: string): Observable<any> {
        return from(this._api.post('herramientas/calibrations/getStatistics', {
            date_from: dateFrom,
            date_to: dateTo
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Get calibration trends (by month)
     */
    getTrends(months: number = 6): Observable<any> {
        return from(this._api.post('herramientas/calibrations/getTrends', {
            months
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get top laboratories by usage
     */
    getTopLaboratories(limit: number = 5): Observable<any[]> {
        return from(this._api.post('herramientas/calibrations/getTopLaboratories', {
            limit
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }
}
