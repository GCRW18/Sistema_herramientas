import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap, catchError, map, throwError } from 'rxjs';
import {
    CalibrationAlert,
    CalibrationRecord,
    MaintenanceRecord,
    CalibrationDashboard,
    CalibrationLaboratory,
    CalibrationFilters,
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
    // @ Helpers
    // -----------------------------------------------------------------------------------------------------

    private _normalizeResponse(response: any): any[] {
        if (!response) return [];
        if (response?.ROOT?.datos && Array.isArray(response.ROOT.datos)) return response.ROOT.datos;
        if (response?.datos && Array.isArray(response.datos)) return response.datos;
        if (Array.isArray(response)) return response;
        if (response?.data && Array.isArray(response.data)) return response.data;
        return [];
    }

    private _normalizeSingleResponse(response: any): any {
        const data = this._normalizeResponse(response);
        return data?.[0] ?? data ?? response;
    }

    private _isPxpError(response: any): boolean {
        return response?.ROOT?.error === true
            || response?.error === true
            || response instanceof Error;
    }

    private _extractErrorMessage(response: any, fallback: string): string {
        if (response instanceof Error) return response.message || fallback;
        return response?.ROOT?.mensaje
            ?? response?.ROOT?.detalle?.mensaje
            ?? response?.mensaje
            ?? response?.message
            ?? response?.detalle?.mensaje
            ?? fallback;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    get calibrations$(): Observable<CalibrationRecord[]> { return this._calibrations.asObservable(); }
    get maintenances$(): Observable<MaintenanceRecord[]> { return this._maintenances.asObservable(); }
    get alerts$(): Observable<CalibrationAlert[]> { return this._alerts.asObservable(); }
    get laboratories$(): Observable<CalibrationLaboratory[]> { return this._laboratories.asObservable(); }
    get dashboard$(): Observable<CalibrationDashboard | null> { return this._dashboard.asObservable(); }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Calibration
    // -----------------------------------------------------------------------------------------------------

    getCalibrations(filters?: any): Observable<CalibrationRecord[]> {
        const params = { start: 0, limit: 50, sort: 'send_date', dir: 'desc', ...filters };
        return from(this._api.post('herramientas/calibrations/listCalibrations', params)).pipe(
            switchMap((response: any) => {
                const calibrations = this._normalizeResponse(response);
                this._calibrations.next(calibrations as CalibrationRecord[]);
                return of(calibrations as CalibrationRecord[]);
            }),
            catchError((error) => { console.error('Error en getCalibrations:', error); return of([]); })
        );
    }

    getCalibrationById(id: string): Observable<CalibrationRecord> {
        return from(this._api.post('herramientas/calibrations/listCalibrations', { start: 0, limit: 1, id_calibration: id })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response)?.[0] as CalibrationRecord ?? null)),
            catchError((error) => { console.error('Error en getCalibrationById:', error); return of(null as any); })
        );
    }

    getNextRecordNumber(prefix: 'EC' | 'EM' = 'EC'): Observable<string> {
        return from(this._api.post('herramientas/calibrations/getNextRecordNumber', { prefijo: prefix })).pipe(
            switchMap((response: any) => {
                const num = this._normalizeResponse(response)?.[0]?.next_record_number ?? null;
                return of(num ?? `${prefix}-${new Date().getFullYear()}/001`);
            }),
            catchError(() => of(`${prefix}-${new Date().getFullYear()}/001`))
        );
    }

    sendToCalibration(record: Partial<CalibrationRecord>): Observable<CalibrationRecord> {
        return from(this._api.post('herramientas/calibrations/insertCalibration', record)).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) as CalibrationRecord ?? record as CalibrationRecord)),
            catchError((error) => { console.error('Error en sendToCalibration:', error); throw error; })
        );
    }

    receiveFromCalibration(id: string, data: any): Observable<CalibrationRecord> {
        return from(this._api.post('herramientas/calibrations/updateCalibration', { ...data, id_calibration: id })).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) as CalibrationRecord ?? data as CalibrationRecord)),
            catchError((error) => { console.error('Error en receiveFromCalibration:', error); throw error; })
        );
    }

    updateCalibration(id: string, record: Partial<CalibrationRecord>): Observable<CalibrationRecord> {
        return from(this._api.post('herramientas/calibrations/insertCalibration', { ...record, id_calibration: id })).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) as CalibrationRecord ?? record as CalibrationRecord)),
            catchError((error) => { console.error('Error en updateCalibration:', error); throw error; })
        );
    }

    // NUEVO MÉTODO PARA ANULAR ENVÍO
    cancelCalibration(id: string, reason: string): Observable<CalibrationRecord> {
        return from(this._api.post('herramientas/calibrations/anularEnvio', {
            id_calibration: id,
            reason: reason
        })).pipe(
            switchMap((response: any) => {
                if (this._isPxpError(response)) throw new Error(this._extractErrorMessage(response, 'Error al anular'));
                return of(this._normalizeSingleResponse(response) as CalibrationRecord ?? {} as CalibrationRecord);
            }),
            catchError((error) => {
                console.error('Error en cancelCalibration:', error);
                throw error;
            })
        );
    }

    getToolCalibrationHistory(toolId: string): Observable<CalibrationRecord[]> {
        return from(this._api.post('herramientas/calibrations/listCalibrations', { start: 0, limit: 50, tool_id: toolId, sort: 'send_date', dir: 'desc' })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response) as CalibrationRecord[])),
            catchError((error) => { console.error('Error en getToolCalibrationHistory:', error); return of([]); })
        );
    }

    getActiveCalibrations(): Observable<CalibrationRecord[]> {
        return this.getCalibrations({ status: 'in_process' });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ PXP Backend v3: Flujo de Calibración
    // -----------------------------------------------------------------------------------------------------

    sendToCalibrationPxp(params: {
        tool_id: number; calibration_type?: string; work_type?: string; supplier_id?: number;
        supplier_name?: string; base?: string; base_id?: number; request_date?: string;
        send_date?: string; expected_return_date?: string; service_order?: string; cost?: number;
        currency?: string; notes?: string; delivered_by_name?: string; requested_by_name?: string;
        provider_contact?: string;
    }): Observable<any> {
        return from(this._api.post('herramientas/calibrations/sendToCalibration', params)).pipe(
            switchMap((response: any) => {
                if (this._isPxpError(response)) throw new Error(this._extractErrorMessage(response, 'Error al enviar a calibración'));
                return of(this._normalizeSingleResponse(response) ?? response);
            }),
            catchError((error) => { console.error('Error en sendToCalibrationPxp:', error); throw error; })
        );
    }

    processCalibrationReturnPxp(params: {
        id_calibration: number; tool_id?: number; result: 'approved' | 'conditional' | 'rejected';
        actual_return_date?: string; calibration_date?: string; certificate_number?: string;
        certificate_date?: string; next_calibration_date?: string; physical_condition?: string;
        calibration_performed?: boolean; notes?: string; observations?: string;
        received_by_name?: string; cost?: number; currency?: string;
        jack_semiannual_date?: string; jack_annual_date?: string;
    }): Observable<any> {
        return from(this._api.post('herramientas/calibrations/processCalibrationReturn', params)).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) ?? response)),
            catchError((error) => { console.error('Error en processCalibrationReturnPxp:', error); throw error; })
        );
    }

    searchToolsAutocomplete(term: string): Observable<any[]> {
        return from(this._api.post('herramientas/tools/searchToolsAutocomplete', { search_term: term, start: 0, limit: 3 })).pipe(
            map((resp: any) => this._normalizeResponse(resp)),
            catchError(() => of([]))
        );
    }

    scanToolForCalibration(barcode: string): Observable<ScanToolResult> {
        return from(this._api.post('herramientas/calibrations/scanToolForCalibration', { code: barcode })).pipe(
            switchMap((response: any) => {
                const raw = this._normalizeResponse(response)?.[0] ?? null;
                if (!raw) return of(null as any);
                return of({ ...raw, code: raw.tool_code || raw.code, name: raw.tool_name || raw.name } as ScanToolResult);
            }),
            catchError((err: any) => {
                const raw = this._normalizeResponse(err)?.[0] ?? null;
                if (raw) return of({ ...raw, code: raw.tool_code || raw.code, name: raw.tool_name || raw.name } as ScanToolResult);
                return of(null as any);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ PXP Backend v3: Lotes de Calibración
    // -----------------------------------------------------------------------------------------------------

    createCalibrationBatch(params: {
        laboratory_id?: number; laboratory_name?: string; base_id?: number; base_name?: string;
        send_date?: string; expected_return_date?: string; service_order?: string; notes?: string;
    }): Observable<CalibrationBatch> {
        return from(this._api.post('herramientas/calibrations/createCalibrationBatch', params)).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) as CalibrationBatch)),
            catchError((error) => { console.error('Error en createCalibrationBatch:', error); throw error; })
        );
    }

    addToolToBatch(params: { batch_id: number; barcode_scan?: string; tool_id?: number; notes?: string }): Observable<CalibrationBatchItem> {
        return from(this._api.post('herramientas/calibrations/addToolToBatch', params)).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) as CalibrationBatchItem)),
            catchError((error) => { console.error('Error en addToolToBatch:', error); throw error; })
        );
    }

    confirmCalibrationBatch(params: { batch_id: number; approved_by_id?: number; approved_by_name?: string }): Observable<any> {
        return from(this._api.post('herramientas/calibrations/confirmCalibrationBatch', params)).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) ?? response)),
            catchError((error) => { console.error('Error en confirmCalibrationBatch:', error); throw error; })
        );
    }

    removeFromBatch(batchItemId: number): Observable<any> {
        return from(this._api.post('herramientas/calibrations/removeFromBatch', { id_batch_item: batchItemId })).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) ?? response)),
            catchError((error) => { console.error('Error en removeFromBatch:', error); throw error; })
        );
    }

    getCalibrationBatches(filters?: any): Observable<CalibrationBatch[]> {
        const params = { start: 0, limit: 50, sort: 'id_batch', dir: 'desc', ...filters };
        return from(this._api.post('herramientas/calibrations/listarCalibrationBatches', params)).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response) as CalibrationBatch[])),
            catchError((error) => { console.error('Error en getCalibrationBatches:', error); return of([]); })
        );
    }

    getBatchItems(batchId: number): Observable<CalibrationBatchItem[]> {
        return from(this._api.post('herramientas/calibrations/listarBatchItems', { start: 0, limit: 200, id_batch: batchId, sort: 'scan_order', dir: 'asc' })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response) as CalibrationBatchItem[])),
            catchError((error) => { console.error('Error en getBatchItems:', error); return of([]); })
        );
    }

    processReturnBatch(params: {
        batch_id: number; actual_return_date?: string; notes?: string;
        items?: Array<{ id_batch_item: number; result: 'approved' | 'conditional' | 'rejected'; certificate_number?: string; certificate_date?: string; next_calibration_date?: string; cost?: number }>;
    }): Observable<any> {
        return from(this._api.post('herramientas/calibrationBatches/processReturnBatch', params)).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) ?? response)),
            catchError((error) => { console.error('Error en processReturnBatch:', error); throw error; })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ PXP Backend v3: Dashboard y Alertas
    // -----------------------------------------------------------------------------------------------------

    getCalibrationDashboardPxp(): Observable<PxpCalibrationDashboard> {
        return from(this._api.post('herramientas/calibrations/getCalibrationDashboard', {})).pipe(
            switchMap((response: any) => of((this._normalizeSingleResponse(response) ?? this._getDefaultPxpDashboard()) as PxpCalibrationDashboard)),
            catchError((error) => { console.error('Error en getCalibrationDashboardPxp:', error); return of(this._getDefaultPxpDashboard()); })
        );
    }

    getCalibrationAlertsPxp(filters?: any): Observable<PxpCalibrationAlert[]> {
        const params = { start: 0, limit: 100, sort: 'next_calibration_date', dir: 'asc', ...filters };
        return from(this._api.post('herramientas/calibrations/getCalibrationAlerts', params)).pipe(
            switchMap((response: any) => {
                const alerts = this._normalizeResponse(response);
                return of(alerts as PxpCalibrationAlert[]);
            }),
            catchError((error: any) => { console.error('Error en getCalibrationAlertsPxp:', error); return of(this._normalizeResponse(error) as PxpCalibrationAlert[]); })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Gatas (Jacks)
    // -----------------------------------------------------------------------------------------------------

    getJackServiceStatus(filters?: any): Observable<JackServiceStatus[]> {
        const params = { start: 0, limit: 100, sort: 'next_calibration_date', dir: 'asc', ...filters };
        return from(this._api.post('herramientas/calibrations/listarJackServiceStatus', params)).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response) as JackServiceStatus[])),
            catchError((error) => { console.error('Error en getJackServiceStatus:', error); return of([]); })
        );
    }

    registerJackService(params: { tool_id: number; service_type: JackServiceType; service_date?: string; notes?: string }): Observable<any> {
        return from(this._api.post('herramientas/calibrations/registerJackService', params)).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) ?? response)),
            catchError((error) => { console.error('Error en registerJackService:', error); throw error; })
        );
    }

    private _getDefaultPxpDashboard(): PxpCalibrationDashboard {
        return {
            cal_valid: 0, cal_expiring_30d: 0, cal_expiring_7d: 0, cal_expired: 0, cal_in_lab: 0,
            total_calibratable: 0, jacks_semi_expired: 0, jacks_semi_expiring_30d: 0,
            jacks_annual_expired: 0, jacks_annual_expiring_30d: 0, total_jacks: 0,
            open_batches: 0, active_calibrations: 0, overdue_calibrations: 0
        };
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Maintenance
    // -----------------------------------------------------------------------------------------------------

    getMaintenances(filters?: any): Observable<MaintenanceRecord[]> {
        const params = { start: 0, limit: 50, sort: 'start_date', dir: 'desc', ...filters };
        return from(this._api.post('herramientas/maintenances/listMaintenances', params)).pipe(
            switchMap((response: any) => {
                const maintenances = this._normalizeResponse(response);
                this._maintenances.next(maintenances as MaintenanceRecord[]);
                return of(maintenances as MaintenanceRecord[]);
            }),
            catchError((error) => { console.error('Error en getMaintenances:', error); return of([]); })
        );
    }

    getMaintenanceById(id: string): Observable<MaintenanceRecord> {
        return from(this._api.post('herramientas/maintenances/listMaintenances', { start: 0, limit: 1, id_maintenance: id })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response)?.[0] as MaintenanceRecord ?? null)),
            catchError((error) => { console.error('Error en getMaintenanceById:', error); return of(null as any); })
        );
    }

    sendToMaintenance(record: Partial<MaintenanceRecord>): Observable<MaintenanceRecord> {
        return from(this._api.post('herramientas/maintenances/insertMaintenance', record)).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) as MaintenanceRecord ?? record as MaintenanceRecord)),
            catchError((error) => { console.error('Error en sendToMaintenance:', error); throw error; })
        );
    }

    receiveFromMaintenance(id: string, data: any): Observable<MaintenanceRecord> {
        return from(this._api.post('herramientas/maintenances/insertMaintenance', { ...data, id_maintenance: id })).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) as MaintenanceRecord ?? data as MaintenanceRecord)),
            catchError((error) => { console.error('Error en receiveFromMaintenance:', error); throw error; })
        );
    }

    updateMaintenance(id: string, record: Partial<MaintenanceRecord>): Observable<MaintenanceRecord> {
        return from(this._api.post('herramientas/maintenances/insertMaintenance', { ...record, id_maintenance: id })).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) as MaintenanceRecord ?? record as MaintenanceRecord)),
            catchError((error) => { console.error('Error en updateMaintenance:', error); throw error; })
        );
    }

    getToolMaintenanceHistory(toolId: string): Observable<MaintenanceRecord[]> {
        return from(this._api.post('herramientas/maintenances/listMaintenances', { start: 0, limit: 50, tool_id: toolId, sort: 'start_date', dir: 'desc' })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response) as MaintenanceRecord[])),
            catchError((error) => { console.error('Error en getToolMaintenanceHistory:', error); return of([]); })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Alerts
    // -----------------------------------------------------------------------------------------------------

    getCalibrationAlerts(): Observable<CalibrationAlert[]> {
        return from(this._api.post('herramientas/calibrations/getResumenAlertas', {})).pipe(
            switchMap((response: any) => {
                const alerts = this._normalizeResponse(response);
                this._alerts.next(alerts as CalibrationAlert[]);
                return of(alerts as CalibrationAlert[]);
            }),
            catchError((error) => {
                console.warn('Error en getCalibrationAlerts:', error);
                const datos = this._normalizeResponse(error);
                if (datos?.length > 0) { this._alerts.next(datos as CalibrationAlert[]); return of(datos as CalibrationAlert[]); }
                return of([]);
            })
        );
    }

    getCriticalAlerts(): Observable<CalibrationAlert[]> {
        return from(this._api.post('herramientas/calibrations/getUpcomingCalibrationAlerts', {})).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response) as CalibrationAlert[])),
            catchError((error) => { console.error('Error en getCriticalAlerts:', error); return of([]); })
        );
    }

    getExpiredAlerts(): Observable<CalibrationAlert[]> {
        return from(this._api.post('herramientas/calibrations/getExpiredCalibrationAlerts', {})).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response) as CalibrationAlert[])),
            catchError((error) => { console.error('Error en getExpiredAlerts:', error); return of([]); })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Dashboard & KPIs
    // -----------------------------------------------------------------------------------------------------

    getDashboard(): Observable<CalibrationDashboard> {
        return from(this._api.post('herramientas/calibrations/getDashboard', {})).pipe(
            switchMap((response: any) => {
                const dashboard = this._normalizeSingleResponse(response) ?? this._getDefaultDashboard();
                this._dashboard.next(dashboard as CalibrationDashboard);
                return of(dashboard as CalibrationDashboard);
            }),
            catchError((error) => {
                console.error('Error en getDashboard:', error);
                const d = this._getDefaultDashboard();
                this._dashboard.next(d);
                return of(d);
            })
        );
    }

    private _getDefaultDashboard(): CalibrationDashboard {
        return {
            totalToolsRequiringCalibration: 0, toolsInCalibration: 0, calibrationsValid: 0,
            calibrationsExpiringSoon: 0, calibrationsExpired: 0, calibrationsPending: 0,
            calibrationsSent: 0, calibrationsInProcess: 0, calibrationsReturned: 0,
            calibrationsApproved: 0, calibrationsRejected: 0, calibrationsConditional: 0,
            totalCostThisMonth: 0, totalCostThisYear: 0, averageCostPerCalibration: 0,
            averageDaysInLaboratory: 0, calibrationsByMonth: [], costsByMonth: []
        };
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Laboratories
    // -----------------------------------------------------------------------------------------------------

    getActiveLaboratoriesPxp(tipo_servicio?: string): Observable<any[]> {
        const params: any = { start: 0, limit: 500, sort: 'name', dir: 'asc' };
        if (tipo_servicio) params.tipo_servicio = tipo_servicio;
        return from(this._api.post('herramientas/calibrations/listActiveLaboratories', params)).pipe(
            switchMap((response: any) => {
                let labs = this._normalizeResponse(response);
                if (!labs?.length && response?.error === true && response?.ROOT?.datos) labs = response.ROOT.datos;
                return of(labs);
            }),
            catchError((error) => {
                console.error('Error en getActiveLaboratoriesPxp:', error);
                return of(this._normalizeResponse(error) ?? []);
            })
        );
    }

    getLaboratories(): Observable<CalibrationLaboratory[]> {
        return from(this._api.post('herramientas/calibrations/listLaboratories', { start: 0, limit: 100, active: true })).pipe(
            switchMap((response: any) => {
                const labs = this._normalizeResponse(response);
                this._laboratories.next(labs as CalibrationLaboratory[]);
                return of(labs as CalibrationLaboratory[]);
            }),
            catchError((error) => { console.error('Error en getLaboratories:', error); this._laboratories.next([]); return of([]); })
        );
    }

    getLaboratoryById(id: string): Observable<CalibrationLaboratory> {
        return from(this._api.post('herramientas/calibrations/listLaboratories', { start: 0, limit: 1, id_laboratory: id })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response)?.[0] as CalibrationLaboratory ?? null)),
            catchError((error) => { console.error('Error en getLaboratoryById:', error); return of(null as any); })
        );
    }

    saveLaboratory(laboratory: Partial<CalibrationLaboratory>): Observable<CalibrationLaboratory> {
        const payload: any = { ...laboratory };
        if (payload.id_laboratory == null) delete payload.id_laboratory;
        return from(this._api.post('herramientas/calibrations/saveLaboratory', payload)).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) as CalibrationLaboratory ?? laboratory as CalibrationLaboratory)),
            tap(() => this.getLaboratories().subscribe()),
            catchError((error) => { console.error('Error en saveLaboratory:', error); throw error; })
        );
    }

    checkLaboratoryUsage(id: string): Observable<{ has_records: boolean; count: number }> {
        return from(this._api.post('herramientas/calibrations/checkLaboratoryUsage', { id_laboratory: id })).pipe(
            switchMap((response: any) => {
                const count = response?.count ?? response?.total ?? 0;
                return of({ has_records: count > 0, count });
            }),
            catchError((error) => { console.error('Error en checkLaboratoryUsage:', error); return of({ has_records: false, count: 0 }); })
        );
    }

    deleteLaboratory(id: string): Observable<boolean> {
        return from(this._api.post('herramientas/calibrations/deleteLaboratory', { id_laboratory: id })).pipe(
            switchMap((response: any) => of(response?.success ?? true)),
            tap(() => this.getLaboratories().subscribe()),
            catchError((error) => { console.error('Error en deleteLaboratory:', error); return of(false); })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Reports (MGH)
    // -----------------------------------------------------------------------------------------------------

    exportReportToExcel(reportCode: string, filters?: any): Observable<Blob> {
        return from(this._api.post('herramientas/calibrations/exportReport', { report_code: reportCode, format: 'excel', ...filters }, { responseType: 'blob' })).pipe(
            switchMap((response: any) => of(response)),
            catchError((error) => { console.error('Error en exportReportToExcel:', error); throw error; })
        );
    }

    exportReportToPDF(reportCode: string, filters?: any): Observable<Blob> {
        return from(this._api.post('herramientas/calibrations/exportReport', { report_code: reportCode, format: 'pdf', ...filters }, { responseType: 'blob' })).pipe(
            switchMap((response: any) => of(response)),
            catchError((error) => { console.error('Error en exportReportToPDF:', error); throw error; })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Statistics & Analytics
    // -----------------------------------------------------------------------------------------------------

    getStatistics(dateFrom: string, dateTo: string): Observable<any> {
        return from(this._api.post('herramientas/calibrations/getStatistics', { date_from: dateFrom, date_to: dateTo })).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) ?? {})),
            catchError((error) => { console.error('Error en getStatistics:', error); return of({}); })
        );
    }

    getTrends(months: number = 6): Observable<any> {
        return from(this._api.post('herramientas/calibrations/getTrends', { months })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response))),
            catchError((error) => { console.error('Error en getTrends:', error); return of([]); })
        );
    }

    getTopLaboratories(limit: number = 5): Observable<any[]> {
        return from(this._api.post('herramientas/calibrations/getTopLaboratories', { limit })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response))),
            catchError((error) => { console.error('Error en getTopLaboratories:', error); return of([]); })
        );
    }

    getReportMGH102(params: any = {}): Observable<any[]> {
        return from(this._api.post('herramientas/calibrations/getReportMGH102', { start: 0, limit: 500, sort: 'next_calibration_date', dir: 'asc', ...params })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response))),
            catchError((error) => { console.error('Error en getReportMGH102:', error); return of([]); })
        );
    }

    getReportMGH103(params: any = {}): Observable<any[]> {
        return from(this._api.post('herramientas/calibrations/getReportMGH103', { start: 0, limit: 12, ...params })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response))),
            catchError((error) => { console.error('Error en getReportMGH103:', error); return of([]); })
        );
    }

    getReportMGH104(params: any = {}): Observable<any[]> {
        return from(this._api.post('herramientas/calibrations/getReportMGH104', { start: 0, limit: 500, sort: 'next_calibration_date', dir: 'asc', ...params })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response))),
            catchError((error) => { console.error('Error en getReportMGH104:', error); return of([]); })
        );
    }

    // =====================================================================================================
    // @ GENERACIÓN DE PDFs - CORREGIDO
    // =====================================================================================================

    /**
     * Genera PDF de Nota de Envío a Calibración.
     */
    generarPdfEnvioCalibracion(id_calibration: number): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        const calibrationId = Number(id_calibration);
        if (isNaN(calibrationId) || calibrationId <= 0) {
            return throwError(() => new Error('ID de calibración inválido: ' + id_calibration));
        }

        return from(this._api.post('herramientas/calibrations/generarPdfEnvioCalibracion', {
            id_calibration: calibrationId
        })).pipe(
            switchMap((response: any) => {
                let datos = null;
                let error = false;
                let mensaje = '';

                if (response?.ROOT) {
                    error = response.ROOT.error === true;
                    mensaje = response.ROOT.detalle?.mensaje || response.ROOT.mensaje || '';
                    datos = response.ROOT.datos;
                }
                else if (response?.datos) {
                    error = response.error === true;
                    mensaje = response.detalle?.mensaje || response.mensaje || '';
                    datos = response.datos;
                }
                else if (Array.isArray(response)) {
                    datos = response;
                }
                else if (response?.data) {
                    datos = response.data;
                }

                let item = null;
                if (Array.isArray(datos) && datos.length > 0) {
                    item = datos[0];
                } else if (datos && typeof datos === 'object') {
                    item = datos;
                }

                if (error || !item?.pdf_base64) {
                    const msg = mensaje || 'Error al generar PDF de envío';
                    throw new Error(msg);
                }

                return of({
                    pdf_base64: item.pdf_base64 as string,
                    nombre_archivo: item.nombre_archivo ?? `nota_envio_${calibrationId}.pdf`
                });
            }),
            catchError((error) => {
                console.error('Error en generarPdfEnvioCalibracion:', error);
                throw error;
            })
        );
    }

    /**
     * Genera PDF de Certificado de Retorno de Calibración.
     */
    generarPdfRetornoCalibracion(id_calibration: number): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        const calibrationId = Number(id_calibration);
        if (isNaN(calibrationId) || calibrationId <= 0) {
            return throwError(() => new Error('ID de calibración inválido: ' + id_calibration));
        }

        return from(this._api.post('herramientas/calibrations/generarPdfRetornoCalibracion', {
            id_calibration: calibrationId
        })).pipe(
            switchMap((response: any) => {
                let datos = null;
                let error = false;
                let mensaje = '';

                if (response?.ROOT) {
                    error = response.ROOT.error === true;
                    mensaje = response.ROOT.detalle?.mensaje || response.ROOT.mensaje || '';
                    datos = response.ROOT.datos;
                }
                else if (response?.datos) {
                    error = response.error === true;
                    mensaje = response.detalle?.mensaje || response.mensaje || '';
                    datos = response.datos;
                }
                else if (Array.isArray(response)) {
                    datos = response;
                }
                else if (response?.data) {
                    datos = response.data;
                }

                let item = null;
                if (Array.isArray(datos) && datos.length > 0) {
                    item = datos[0];
                } else if (datos && typeof datos === 'object') {
                    item = datos;
                }

                if (error || !item?.pdf_base64) {
                    const msg = mensaje || 'Error al generar PDF de retorno';
                    throw new Error(msg);
                }

                return of({
                    pdf_base64: item.pdf_base64 as string,
                    nombre_archivo: item.nombre_archivo ?? `certificado_${calibrationId}.pdf`
                });
            }),
            catchError((error) => {
                console.error('Error en generarPdfRetornoCalibracion:', error);
                throw error;
            })
        );
    }

    /**
     * Abre un documento (PDF o HTML) en nueva pestaña a partir de base64.
     */
    abrirPdf(pdfBase64: string, filename: string = 'documento.pdf'): void {
        if (!pdfBase64) {
            console.error('No se recibió contenido PDF/HTML');
            return;
        }
        try {
            const byteCharacters = atob(pdfBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);

            // Detectar tipo de documento según la extensión proporcionada
            const isHtml = filename.toLowerCase().endsWith('.html');
            const mimeType = isHtml ? 'text/html' : 'application/pdf';

            const blob = new Blob([byteArray], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => window.URL.revokeObjectURL(url), 100);
        } catch (error) {
            console.error('Error al abrir el documento:', error);
        }
    }

    /**
     * Genera y abre PDF de Nota de Envío directamente.
     */
    generarYVerPdfEnvio(id_calibration: number): void {
        this.generarPdfEnvioCalibracion(id_calibration).subscribe({
            next: (result) => {
                if (result?.pdf_base64) {
                    this.abrirPdf(result.pdf_base64, result.nombre_archivo);
                } else {
                    alert('No se recibió contenido PDF válido');
                }
            },
            error: (error) => {
                alert('Error al generar el PDF de envío: ' + (error.message || 'Error desconocido'));
            }
        });
    }

    /**
     * Genera y abre PDF de Certificado de Retorno directamente.
     */
    generarYVerPdfRetorno(id_calibration: number): void {
        this.generarPdfRetornoCalibracion(id_calibration).subscribe({
            next: (result) => {
                if (result?.pdf_base64) {
                    this.abrirPdf(result.pdf_base64, result.nombre_archivo);
                } else {
                    alert('No se recibió contenido PDF válido');
                }
            },
            error: (error) => {
                alert('Error al generar el PDF de retorno: ' + (error.message || 'Error desconocido'));
            }
        });
    }
}
