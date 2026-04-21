import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, catchError } from 'rxjs';
import { ErpApiService } from '../api/api.service';

export interface CalibrationBatch {
    id_batch: number;
    estado_reg: string;
    batch_number: string;
    status: 'open' | 'sent' | 'in_process' | 'completed' | 'cancelled';
    laboratory_id: number;
    laboratory_name: string;
    base_id: number;
    base_name: string;
    send_date: string;
    expected_return_date: string;
    actual_return_date: string;
    total_items: number;
    created_by_id: number;
    created_by_name: string;
    approved_by_id: number;
    approved_by_name: string;
    service_order: string;
    cost: number;
    currency: string;
    notes: string;
    observations: string;
    jack_items_count: number;
    days_since_sent: number;
    is_overdue: boolean;
    id_usuario_reg: number;
    fecha_reg: string;
    id_usuario_mod: number;
    fecha_mod: string;
    usr_reg: string;
    usr_mod: string;
}

export interface CalibrationBatchItem {
    id_batch_item: number;
    estado_reg: string;
    batch_id: number;
    tool_id: number;
    tool_code: string;
    tool_name: string;
    tool_serial: string;
    tool_part_number: string;
    calibration_id: number;
    calibration_record: string;
    scan_order: number;
    tool_status_snapshot: string;
    calibration_date_snapshot: string;
    next_calibration_snapshot: string;
    is_jack: boolean;
    tool_is_jack?: boolean;
    requires_semiannual: boolean;
    requires_annual: boolean;
    scanned_by_barcode: boolean;
    scan_timestamp: string;
    validation_result: 'valid' | 'warning' | 'rejected';
    validation_message: string;
    notes: string;
    category_name: string;
    next_semiannual_service: string;
    next_annual_service: string;
    next_calibration_date: string;
    result: string;
    certificate_number: string;
    certificate_date: string;
    cost: number;
    id_usuario_reg: number;
    fecha_reg: string;
    usr_reg: string;
}

@Injectable({
    providedIn: 'root'
})
export class CalibrationBatchService {
    private _api = inject(ErpApiService);
    private _batchesSubject: ReplaySubject<CalibrationBatch[]> = new ReplaySubject<CalibrationBatch[]>(1);

    get batches$(): Observable<CalibrationBatch[]> {
        return this._batchesSubject.asObservable();
    }

    // =========================================================================
    // CRUD DE LOTES
    // =========================================================================

    getBatches(filters?: any): Observable<CalibrationBatch[]> {
        const params = { start: 0, limit: 50, sort: 'id_batch', dir: 'desc', ...filters };
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches (minúsculas)
        return from(this._api.post('herramientas/calibrationbatches/listarCalibrationBatches', params)).pipe(
            switchMap((response: any) => {
                const data = response?.datos || response?.data || [];
                this._batchesSubject.next(data);
                return of(data);
            }),
            catchError((error) => {
                console.error('Error en getBatches:', error);
                return of([]);
            })
        );
    }

    createBatch(params: any): Observable<any> {
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/insertarCalibrationBatches', params)).pipe(
            switchMap((response: any) => of(response?.data || response)),
            catchError((error) => {
                console.error('Error en createBatch:', error);
                throw error;
            })
        );
    }

    updateBatch(id: number, params: Partial<CalibrationBatch>): Observable<any> {
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/insertarCalibrationBatches', {
            ...params,
            id_batch: id
        })).pipe(
            switchMap((response: any) => of(response?.data || response)),
            catchError((error) => {
                console.error('Error en updateBatch:', error);
                throw error;
            })
        );
    }

    deleteBatch(id: number): Observable<any> {
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/eliminarCalibrationBatches', {
            id_batch: id
        })).pipe(
            switchMap((response: any) => of(response?.data || response)),
            catchError((error) => {
                console.error('Error en deleteBatch:', error);
                throw error;
            })
        );
    }

    // =========================================================================
    // ITEMS DEL LOTE
    // =========================================================================

    getBatchItems(batchId: number): Observable<CalibrationBatchItem[]> {
        const params = { start: 0, limit: 200, batch_id: batchId, sort: 'scan_order', dir: 'asc' };
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/listarBatchItems', params)).pipe(
            switchMap((response: any) => {
                const data = response?.datos || response?.data || [];
                return of(data);
            }),
            catchError((error) => {
                console.error('Error en getBatchItems:', error);
                return of([]);
            })
        );
    }

    addToolToBatch(params: { batch_id: number; barcode_scan?: string; tool_id?: number; notes?: string }): Observable<any> {
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/addToolToBatch', params)).pipe(
            switchMap((response: any) => of(response?.data || response)),
            catchError((error) => {
                console.error('Error en addToolToBatch:', error);
                throw error;
            })
        );
    }

    removeFromBatch(itemId: number, batchId: number): Observable<any> {
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/removeFromBatch', {
            id_batch_item: itemId
        })).pipe(
            switchMap((response: any) => of(response?.data || response)),
            catchError((error) => {
                console.error('Error en removeFromBatch:', error);
                throw error;
            })
        );
    }

    // =========================================================================
    // FLUJO DE CONFIRMACIÓN
    // =========================================================================

    confirmBatch(params: { batch_id: number; approved_by_id?: number; approved_by_name?: string }): Observable<any> {
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/confirmCalibrationBatch', params)).pipe(
            switchMap((response: any) => of(response?.data || response)),
            catchError((error) => {
                console.error('Error en confirmBatch:', error);
                throw error;
            })
        );
    }

    // =========================================================================
    // RETORNO MASIVO
    // =========================================================================

    processReturnBatch(params: any): Observable<any> {
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/processReturnBatch', params)).pipe(
            switchMap((response: any) => of(response?.data || response)),
            catchError((error) => {
                console.error('Error en processReturnBatch:', error);
                throw error;
            })
        );
    }

    // =========================================================================
    // RESUMEN
    // =========================================================================

    getBatchSummary(batchId: number): Observable<any> {
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/getBatchSummary', {
            batch_id: batchId
        })).pipe(
            switchMap((response: any) => of(response?.data?.[0] || response?.data || null)),
            catchError((error) => {
                console.error('Error en getBatchSummary:', error);
                return of(null);
            })
        );
    }

    // =========================================================================
    // JACK (GATA) ALERTS
    // =========================================================================

    getJackAlerts(): Observable<any[]> {
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/listarJackAlerts', {
            start: 0, limit: 500
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || [])),
            catchError((error) => {
                console.error('Error en getJackAlerts:', error);
                return of([]);
            })
        );
    }

    getJackSummary(): Observable<any> {
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/getJackSummary', {})).pipe(
            switchMap((response: any) => of(response?.data?.[0] || response?.datos?.[0] || null)),
            catchError((error) => {
                console.error('Error en getJackSummary:', error);
                return of(null);
            })
        );
    }

    // =========================================================================
    // GENERACIÓN DE PDFs para LOTES
    // =========================================================================

    generarPdfNotaEnvioLote(id_batch: number): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/generarPdfNotaEnvioLote', {
            id_batch: id_batch
        })).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response?.mensaje || 'Error al generar PDF');
                const data = response?.datos || response;
                return of({
                    pdf_base64: data?.pdf_base64,
                    nombre_archivo: data?.nombre_archivo || `lote_${id_batch}.pdf`
                });
            }),
            catchError((error) => {
                console.error('Error en generarPdfNotaEnvioLote:', error);
                throw error;
            })
        );
    }

    generarPdfNotaRetornoLote(id_batch: number): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        // ✅ CORREGIDO: CalibrationBatches -> calibrationbatches
        return from(this._api.post('herramientas/calibrationbatches/generarPdfNotaRetornoLote', {
            id_batch: id_batch
        })).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response?.mensaje || 'Error al generar PDF');
                const data = response?.datos || response;
                return of({
                    pdf_base64: data?.pdf_base64,
                    nombre_archivo: data?.nombre_archivo || `retorno_lote_${id_batch}.pdf`
                });
            }),
            catchError((error) => {
                console.error('Error en generarPdfNotaRetornoLote:', error);
                throw error;
            })
        );
    }

    generarYVerPdfNotaEnvioLote(id_batch: number): void {
        this.generarPdfNotaEnvioLote(id_batch).subscribe({
            next: (result) => this.abrirPdf(result.pdf_base64, result.nombre_archivo),
            error: (error) => console.error('Error al generar PDF de lote:', error)
        });
    }

    generarYVerPdfNotaRetornoLote(id_batch: number): void {
        this.generarPdfNotaRetornoLote(id_batch).subscribe({
            next: (result) => this.abrirPdf(result.pdf_base64, result.nombre_archivo),
            error: (error) => console.error('Error al generar PDF de retorno de lote:', error)
        });
    }

    private abrirPdf(pdfBase64: string, filename?: string): void {
        if (!pdfBase64) return;
        const byteCharacters = atob(pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
    }
}
