import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap, catchError, map, throwError } from 'rxjs';
import {
    CalibrationRecord,
    CalibrationLaboratory,
    ScanToolResult,
    PxpCalibrationAlert
} from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class CalibrationService {
    private _api = inject(ErpApiService);
    private _calibrations: ReplaySubject<CalibrationRecord[]> = new ReplaySubject<CalibrationRecord[]>(1);
    private _laboratories: ReplaySubject<CalibrationLaboratory[]> = new ReplaySubject<CalibrationLaboratory[]>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Helpers (CORREGIDOS PARA PXP)
    // -----------------------------------------------------------------------------------------------------

    private _normalizeResponse(response: any): any[] {
        if (!response) return [];

        // PXP puede devolver datos: "" cuando no hay registros, o un objeto en lugar de array si es 1 solo.
        const extract = (data: any) => {
            if (!data || data === '') return [];
            return Array.isArray(data) ? data : [data];
        };

        if (response?.ROOT?.datos !== undefined) return extract(response.ROOT.datos);
        if (response?.datos !== undefined) return extract(response.datos);
        if (response?.data !== undefined) return extract(response.data);
        if (Array.isArray(response)) return response;

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

    getNextRecordNumber(prefix: 'EC' | 'EM' = 'EC'): Observable<string> {
        return from(this._api.post('herramientas/calibrations/getNextRecordNumber', { prefijo: prefix })).pipe(
            switchMap((response: any) => {
                const num = this._normalizeResponse(response)?.[0]?.next_record_number ?? null;
                return of(num ?? `${prefix}-${new Date().getFullYear()}/001`);
            }),
            catchError(() => of(`${prefix}-${new Date().getFullYear()}/001`))
        );
    }

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
        // El parámetro suelto tool_id NO es procesado por ACTcalibrations: sin el
        // filtro explícito, el endpoint devolvía las últimas calibraciones de TODAS
        // las herramientas y el historial mostraba registros ajenos.
        const idNum = Number(toolId) || 0;
        return from(this._api.post('herramientas/calibrations/listCalibrations', {
            start: 0, limit: 100, sort: 'id_calibration', dir: 'desc',
            filtro: `cls.tool_id = ${idNum}`,
        })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response) as CalibrationRecord[])),
            catchError((error) => { console.error('Error en getToolCalibrationHistory:', error); return of([]); })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ PXP Backend v3: Flujo de Calibración
    // -----------------------------------------------------------------------------------------------------

    sendToCalibrationPxp(params: {
        tool_id: number; calibration_type?: string; work_type?: string; supplier_id?: number;
        supplier_name?: string; base?: string; base_id?: number; request_date?: string;
        send_date?: string; expected_return_date?: string; service_order?: string; cost?: number;
        currency?: string; notes?: string; observations?: string;
        delivered_by_name?: string; requested_by_name?: string; provider_contact?: string;
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

    getCertificateFile(id_calibration: number): Observable<string | null> {
        return from(this._api.post('herramientas/calibrations/getCertificateFile', { id_calibration })).pipe(
            switchMap((response: any) => {
                const item = this._normalizeResponse(response)?.[0];
                return of((item?.certificate_file as string) ?? null);
            }),
            catchError(() => of(null))
        );
    }

    searchToolsAutocomplete(term: string): Observable<any[]> {
        return from(this._api.post('herramientas/tools/searchToolsAutocomplete', { search_term: term, start: 0, limit: 10 })).pipe(
            map((resp: any) => this._normalizeResponse(resp)),
            catchError(() => of([]))
        );
    }

    getToolImages(idTool: number): Observable<string[]> {
        const escaped = String(idTool).replace(/[^\d]/g, '');
        return from(this._api.postRaw('herramientas/tools/listarTools', {
            start: 0, limit: 1, sort: 'id_tool', dir: 'asc',
            filtro_adicional: `id_tool = ${escaped}`,
        })).pipe(
            map((resp: any) => {
                const row = this._normalizeResponse(resp)?.[0];
                const raw = row?.images;
                if (!raw) return [];
                if (Array.isArray(raw)) return raw.filter(Boolean);
                const s = String(raw).trim();
                if (!s || s === '{}' || s === 'NULL') return [];
                return s.replace(/^\{|\}$/g, '')
                    .split(',')
                    .map(x => x.trim().replace(/^"|"$/g, ''))
                    .filter(Boolean);
            }),
            catchError(() => of([] as string[]))
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
    // @ PXP Backend v3: Dashboard y Alertas
    // -----------------------------------------------------------------------------------------------------

    getCalibrationAlertsPxp(filters?: any): Observable<PxpCalibrationAlert[]> {
        const params = { start: 0, limit: 100, sort: 'next_calibration_date', dir: 'asc', ...filters };
        return from(this._api.post('herramientas/calibrations/getCalibrationAlerts', params)).pipe(
            switchMap((response: any) => {
                const alerts = this._normalizeResponse(response);
                return of(alerts as PxpCalibrationAlert[]);
            }),
            catchError((error: any) => { console.error('Error en getCalibrationAlertsPxp:', error); return of([] as PxpCalibrationAlert[]); })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Transcripción histórica
    // -----------------------------------------------------------------------------------------------------

    createHistoricalCalibration(params: {
        tool_id: number;
        certificate_number: string;
        calibration_date: string;
        next_calibration_date?: string;
        supplier_id?: number;
        supplier_name?: string;
        result: 'approved' | 'conditional' | 'rejected';
        observations?: string;
        received_by_name?: string;
        send_date?: string;
        is_historical: true;
    }): Observable<any> {
        return from(this._api.post('herramientas/calibrations/createHistoricalRecord', params)).pipe(
            switchMap((response: any) => {
                if (this._isPxpError(response)) throw new Error(this._extractErrorMessage(response, 'Error al crear transcripción histórica'));
                return of(this._normalizeSingleResponse(response) ?? response);
            }),
            catchError((error) => { console.error('Error en createHistoricalCalibration:', error); throw error; })
        );
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

    saveLaboratory(laboratory: Partial<CalibrationLaboratory>): Observable<CalibrationLaboratory> {
        const payload: any = { ...laboratory };
        if (payload.id_laboratory == null) delete payload.id_laboratory;
        return from(this._api.post('herramientas/calibrations/saveLaboratory', payload)).pipe(
            switchMap((response: any) => of(this._normalizeSingleResponse(response) as CalibrationLaboratory ?? laboratory as CalibrationLaboratory)),
            tap(() => this.getLaboratories().subscribe()),
            catchError((error) => { console.error('Error en saveLaboratory:', error); throw error; })
        );
    }

    deleteLaboratory(id: string): Observable<boolean> {
        return from(this._api.post('herramientas/calibrations/deleteLaboratory', { id_laboratory: id })).pipe(
            switchMap((response: any) => of(response?.success ?? true)),
            tap(() => this.getLaboratories().subscribe()),
            catchError((error) => { console.error('Error en deleteLaboratory:', error); return of(false); })
        );
    }

    // =====================================================================================================
    // @ GENERACIÓN DE PDFs - CORREGIDO
    // =====================================================================================================

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
