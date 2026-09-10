import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, Subject, switchMap, tap, catchError, map, throwError } from 'rxjs';
import {
    CalibrationRecord,
    CalibrationLaboratory,
    ScanToolResult,
    PxpCalibrationAlert
} from '../models';
import { ErpApiService } from '../api/api.service';
import { BlobStorageService } from './blob-storage.service';
import { QrScanService } from './qr-scan.service';

@Injectable({ providedIn: 'root' })
export class CalibrationService {
    private _api = inject(ErpApiService);
    private _blob = inject(BlobStorageService);
    private _qrScan = inject(QrScanService);
    private _calibrations: ReplaySubject<CalibrationRecord[]> = new ReplaySubject<CalibrationRecord[]>(1);
    private _laboratories: ReplaySubject<CalibrationLaboratory[]> = new ReplaySubject<CalibrationLaboratory[]>(1);

    // Emite cuando un envío/retorno/anulación se registra con éxito. Las tabs de
    // Calibraciones (ENVÍO, RETORNO, ...) son componentes que quedan montados en segundo
    // plano (display:none) al cambiar de tab — no se destruyen ni recrean — así que una
    // tabla no se enteraba de los cambios hechos desde otra tab hasta que se reabría.
    private _calibrationsChanged = new Subject<void>();
    readonly calibrationsChanged$ = this._calibrationsChanged.asObservable();

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
        // ACTcalibrations.php->listarCalibrations() lee 'ordenacion'/'dir_ordenacion' (no
        // 'sort'/'dir') — con las claves equivocadas el backend ignoraba el override y
        // ordenaba por su default (id_calibration ASC), dejando fuera los registros
        // recién enviados/retornados (id_calibration alto) del limit.
        const params = { start: 0, limit: 50, ordenacion: 'send_date', dir_ordenacion: 'desc', ...filters };
        return from(this._api.post('herramientas/calibrations/listCalibrations', params)).pipe(
            switchMap((response: any) => {
                const calibrations = this._normalizeResponse(response);
                this._calibrations.next(calibrations as CalibrationRecord[]);
                return of(calibrations as CalibrationRecord[]);
            }),
            catchError((error) => { console.error('Error en getCalibrations:', error); return of([]); })
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
            tap(() => this._calibrationsChanged.next()),
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
            start: 0, limit: 100, ordenacion: 'id_calibration', dir_ordenacion: 'desc',
            filtro: `cls.tool_id = ${idNum}`,
        })).pipe(
            switchMap((response: any) => of(this._normalizeResponse(response) as CalibrationRecord[])),
            catchError((error) => { console.error('Error en getToolCalibrationHistory:', error); return of([]); })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ PXP Backend v3: Flujo de Calibración
    //   El envío ya NO es una llamada suelta: se arma en el borrador compartido
    //   (getDraftEnvio / addDraftEnvioItem / … / confirmDraftEnvio, más abajo).
    // -----------------------------------------------------------------------------------------------------

    processCalibrationReturnPxp(params: {
        id_calibration: number; tool_id?: number; result: 'approved' | 'conditional' | 'rejected';
        actual_return_date?: string; calibration_date?: string; certificate_number?: string;
        certificate_date?: string; next_calibration_date?: string; physical_condition?: string;
        calibration_performed?: boolean; notes?: string; observations?: string;
        received_by_name?: string; cost?: number; currency?: string;
        jack_semiannual_date?: string; jack_annual_date?: string;
        supplier_id?: number; certificate_file?: string;
    }): Observable<any> {
        return from(this._api.post('herramientas/calibrations/processCalibrationReturn', params)).pipe(
            switchMap((response: any) => {
                if (this._isPxpError(response)) throw new Error(this._extractErrorMessage(response, 'Error al procesar el retorno de calibración'));
                this._calibrationsChanged.next();
                return of(this._normalizeSingleResponse(response) ?? response);
            }),
            catchError((error) => { console.error('Error en processCalibrationReturnPxp:', error); throw error; })
        );
    }

    // Guarda el PDF del certificado en una llamada aparte del retorno: el base64
    // (varios MB) infla la respuesta de pXP y la trunca si va dentro de HE_CLS_RETURN.
    /** Guarda la referencia del certificado en he.tcalibrations.certificate_file.
     *  Ahora `certificate_file` es la `ruta_bs` del Blob Storage (texto corto), no el base64. */
    saveReturnCertificate(id_calibration: number, certificate_file: string): Observable<any> {
        return from(this._api.post('herramientas/calibrations/guardarCertificadoRetorno', {
            id_calibration,
            certificate_file,
            // Chequeo de truncamiento del backend: con una ruta_bs corta siempre coincide.
            certificate_file_len: certificate_file?.length ?? 0,
        })).pipe(
            switchMap((response: any) => {
                if (this._isPxpError(response)) throw new Error(this._extractErrorMessage(response, 'Error al guardar el certificado'));
                return of(this._normalizeSingleResponse(response) ?? response);
            }),
            catchError((error) => { console.error('Error en saveReturnCertificate:', error); throw error; })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Borrador compartido de envío a calibración (he.tcalibration_send_draft)
    //   Un único borrador global 'open': los técnicos agrupan herramientas entre
    //   turnos hasta que alguien confirma y se genera UNA sola nota de envío.
    // -----------------------------------------------------------------------------------------------------

    /** Herramientas del borrador de envío en curso + sus datos comunes. */
    getDraftEnvio(): Observable<any[]> {
        return from(this._api.post('herramientas/calibrations/listDraftEnvio', { start: 0, limit: 500 })).pipe(
            map((resp: any) => this._normalizeResponse(resp)),
            catchError((error) => { console.error('Error en getDraftEnvio:', error); return of([]); })
        );
    }

    addDraftEnvioItem(payload: {
        tool_id: number;
        almacen?: string; base?: string; id_lugar?: number | null;
        send_date?: string; requested_by_name?: string; added_by_name?: string;
        supplier_id?: number | null; supplier_name?: string; work_type?: string;
        calibration_type?: string; expected_return_date?: string; cost?: number | null;
    }): Observable<any> {
        return this._draftPost('addDraftEnvioItem', payload, 'Error al agregar la herramienta al borrador');
    }

    saveDraftEnvioComun(payload: {
        almacen?: string; base?: string; id_lugar?: number | null;
        send_date?: string; requested_by_name?: string;
    }): Observable<any> {
        return this._draftPost('saveDraftEnvioComun', payload, 'Error al guardar los datos comunes');
    }

    updateDraftEnvioItem(payload: {
        id_draft_item: number;
        supplier_id?: number | null; supplier_name?: string; work_type?: string;
        expected_return_date?: string; cost?: number | null; notes?: string;
        repair_description?: string; discrepancy_report?: string;
    }): Observable<any> {
        return this._draftPost('updateDraftEnvioItem', payload, 'Error al actualizar la herramienta');
    }

    deleteDraftEnvioItem(id_draft_item: number): Observable<any> {
        return this._draftPost('deleteDraftEnvioItem', { id_draft_item }, 'Error al quitar la herramienta');
    }

    cancelDraftEnvio(): Observable<any> {
        return this._draftPost('cancelDraftEnvio', {}, 'Error al descartar el borrador');
    }

    /** Cierra el borrador: genera una nota (record_number) y un envío + movimiento por herramienta. */
    confirmDraftEnvio(payload: {
        almacen?: string; base?: string; id_lugar?: number | null;
        send_date?: string; requested_by_name?: string; delivered_by_name?: string;
    }): Observable<{ record_number: string; total: number; id_calibration: number }> {
        return this._draftPost('confirmDraftEnvio', payload, 'Error al confirmar el envío');
    }

    private _draftPost(action: string, payload: any, fallbackMsg: string): Observable<any> {
        // pxp-client serializa `undefined` como el string "undefined" y lo mete crudo
        // en el INSERT de la tabla temporal → "column undefined does not exist".
        // Se descartan las claves sin valor: la función SQL lee NULL para las ausentes.
        const clean: any = {};
        for (const k of Object.keys(payload || {})) {
            const v = payload[k];
            if (v === undefined || v === null) continue;
            if (typeof v === 'number' && isNaN(v)) continue;
            clean[k] = v;
        }
        return from(this._api.post('herramientas/calibrations/' + action, clean)).pipe(
            switchMap((response: any) => {
                if (this._isPxpError(response)) throw new Error(this._extractErrorMessage(response, fallbackMsg));
                return of(this._normalizeSingleResponse(response) ?? response);
            }),
            tap(() => this._calibrationsChanged.next()),
            catchError((error) => { console.error('Error en ' + action + ':', error); throw error; })
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
        // Si pegan/escanean la URL de una etiqueta QR, se traduce a código plano antes de buscar.
        const term$ = this._qrScan.isQrLabel(term) ? this._qrScan.toToolCode(term) : of(term);
        return term$.pipe(
            switchMap(t => {
                const search = (t || '').trim();
                if (!search) return of([] as any[]);
                return from(this._api.post('herramientas/tools/searchToolsAutocomplete', { search_term: search, start: 0, limit: 10 })).pipe(
                    map((resp: any) => this._normalizeResponse(resp)),
                );
            }),
            catchError(() => of([]))
        );
    }

    getToolImages(idTool: number): Observable<string[]> {
        const escaped = String(idTool).replace(/[^\d]/g, '');
        return from(this._api.postRaw('herramientas/tools/listarTools', {
            start: 0, limit: 1, ordenacion: 'id_tool', dir_ordenacion: 'asc',
            filtro_adicional: `id_tool = ${escaped}`,
        })).pipe(
            map((resp: any) => {
                const row = this._normalizeResponse(resp)?.[0];
                // Foto real: location_photo (he.ttool_files/'location_photo') — ruta_bs del
                // Blob Storage o base64/data-URL heredado.
                const foto = row?.location_photo ? String(row.location_photo) : '';
                if (!foto) return [];
                const src = this._blob.resolveImageSrc(foto)
                    ?? (foto.startsWith('data:') || foto.startsWith('http') ? foto : `data:image/jpeg;base64,${foto}`);
                return src ? [src] : [];
            }),
            catchError(() => of([] as string[]))
        );
    }

    scanToolForCalibration(barcode: string): Observable<ScanToolResult> {
        return this._qrScan.toToolCode(barcode).pipe(
            switchMap((code) => {
                if (!code) return of(null as any);
                return from(this._api.post('herramientas/calibrations/scanToolForCalibration', { code }));
            }),
            switchMap((response: any) => {
                if (!response) return of(null as any);
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
        const params = { start: 0, limit: 100, ordenacion: 'next_calibration_date', dir_ordenacion: 'asc', ...filters };
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
        certificate_file?: string;
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
        const params: any = { start: 0, limit: 500, ordenacion: 'name', dir_ordenacion: 'asc' };
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
        return from(this._api.post('herramientas/calibrations/listLaboratories', { start: 0, limit: 100 })).pipe(
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
            switchMap((response: any) => {
                if (this._isPxpError(response)) throw new Error(this._extractErrorMessage(response, 'Error al guardar la empresa'));
                return of(this._normalizeSingleResponse(response) as CalibrationLaboratory ?? laboratory as CalibrationLaboratory);
            }),
            tap(() => this.getLaboratories().subscribe()),
            catchError((error) => { console.error('Error en saveLaboratory:', error); throw error; })
        );
    }

    deleteLaboratory(id: string): Observable<string> {
        return from(this._api.post('herramientas/calibrations/deleteLaboratory', { id_laboratory: id })).pipe(
            switchMap((response: any) => {
                if (this._isPxpError(response)) throw new Error(this._extractErrorMessage(response, 'Error al eliminar la empresa'));
                const norm = this._normalizeSingleResponse(response);
                return of((norm?.mensaje as string) ?? 'Operación completada');
            }),
            tap(() => this.getLaboratories().subscribe()),
            catchError((error) => { console.error('Error en deleteLaboratory:', error); throw error; })
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

    // Normaliza la respuesta pXP { ROOT: { error, detalle, datos:[{pdf_base64,...}] } }
    // de los endpoints de reporte PDF (ACTreportes/generarPDF*).
    private _pdfReporte(endpoint: string, fallbackName: string, params: any = {}): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return from(this._api.post(endpoint, params)).pipe(
            switchMap((response: any) => {
                let datos: any = null;
                let error = false;
                let mensaje = '';

                if (response?.ROOT) {
                    error = response.ROOT.error === true;
                    mensaje = response.ROOT.detalle?.mensaje || response.ROOT.mensaje || '';
                    datos = response.ROOT.datos;
                } else if (response?.datos) {
                    error = response.error === true;
                    mensaje = response.detalle?.mensaje || response.mensaje || '';
                    datos = response.datos;
                } else if (Array.isArray(response)) {
                    datos = response;
                } else if (response?.data) {
                    datos = response.data;
                }

                let item: any = null;
                if (Array.isArray(datos) && datos.length > 0) item = datos[0];
                else if (datos && typeof datos === 'object') item = datos;

                if (error || !item?.pdf_base64) {
                    throw new Error(mensaje || 'Error al generar el reporte');
                }

                return of({
                    pdf_base64: item.pdf_base64 as string,
                    nombre_archivo: item.nombre_archivo ?? fallbackName,
                });
            }),
            catchError((err) => {
                console.error('Error en', endpoint, err);
                throw err;
            })
        );
    }

    // Reporte de herramientas enviadas y NO retornadas (submódulo Envío a
    // Calibración). PDF real (TCPDF vía ACTreportes/RReporteNoRetornadas), mismo
    // diseño que la nota de envío — reemplaza al HTML client-side de printNoRetornadas().
    generarPdfNoRetornadas(): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return this._pdfReporte('herramientas/reportes/generarPDFNoRetornadas', 'pendientes_retorno.pdf');
    }

    // Espejo del anterior para el submódulo Retorno / Bandeja de Retornos:
    // herramientas ya retornadas de calibración.
    generarPdfRetornadas(): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return this._pdfReporte('herramientas/reportes/generarPDFRetornadas', 'retornadas_calibracion.pdf');
    }

    // MGH-111 — Herramientas y equipos enviados a calibración (Consultoría y Auditoría).
    generarPdfEnviadasCalibracionForm(): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return this._pdfReporte('herramientas/reportes/generarPDFEnviadasCalibracionForm', 'enviadas_calibracion.pdf');
    }

    // MGH-104 — Próximas a vencer por días de holgura (Centro de Control).
    generarPdfVencerHolgura(diasHolgura = 60): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return this._pdfReporte('herramientas/reportes/generarPDFVencerHolgura', 'vencer_calibracion.pdf', { dias_holgura: diasHolgura });
    }

    // MGH-123 — Reporte mensual de próximas a vencer, por período en días (Centro de Control).
    generarPdfVencerMensual(periodoDias = 30): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return this._pdfReporte('herramientas/reportes/generarPDFVencerMensual', 'vencer_mensual.pdf', { periodo_dias: periodoDias });
    }

    // R-AUD-01 — Registro Histórico de Auditoría Técnica (Consulta y Auditoría / Servicios de
    // Mantenimiento). Combina calibraciones + mantenimientos. params: tipo, record_number,
    // tool_search, filter_status, id_laboratory, date_from, date_to, subtitulo.
    generarPdfAuditoriaTecnica(params: any = {}): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return this._pdfReporte('herramientas/reportes/generarPDFAuditoriaTecnica', 'auditoria_tecnica.pdf', params);
    }

    // MGH-102 — Listado de herramientas sujetas a calibración / alertas de vencimiento
    // (Centro de Control, botón Imprimir). range: all|expired|4d|7d|15d|30d|90d|in_lab.
    generarPdfAlertasCalibracion(range = 'all'): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return this._pdfReporte('herramientas/reportes/generarPDFAlertasCalibracion', 'alertas_calibracion.pdf', { range });
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
