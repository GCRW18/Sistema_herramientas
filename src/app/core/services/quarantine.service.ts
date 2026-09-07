import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap } from 'rxjs';
import { DecommissionRecord, QuarantineRecord } from '../models';
import { ErpApiService } from '../api/api.service';
import { MovementService } from './movement.service';

@Injectable({ providedIn: 'root' })
export class QuarantineService {
    private _api = inject(ErpApiService);
    private _movementSvc = inject(MovementService);

    /** Normaliza la respuesta pXP de un endpoint que devuelve un PDF en base64. */
    private _pdfResp(mensajeError: string) {
        return (response: any) => {
            const root = response?.ROOT || response;
            const error = root?.error === true || root?.error === 'true';
            const datos = root?.datos || root?.data || [];
            const item = Array.isArray(datos) ? datos[0] : datos;
            if (error || !item?.pdf_base64) {
                throw new Error(root?.detalle?.mensaje || root?.mensaje || mensajeError);
            }
            return of({ pdf_base64: item.pdf_base64 as string, nombre_archivo: item.nombre_archivo as string });
        };
    }

    /** PDF real (TCPDF backend) del "Reporte Discrepancia de Herramienta" MGH-101.
     *  `ids` = id_quarantine de todas las cuarentenas del lote (o una sola, para reimpresión). */
    generarPdfNotaCuarentena(ids: (number | string)[]): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        const csv = ids.map(Number).filter(n => !isNaN(n) && n > 0).join(',');
        return from(this._api.post('herramientas/quarantines/generarPdfNotaCuarentena', { ids: csv })).pipe(
            switchMap(this._pdfResp('Error al generar el reporte de discrepancia MGH-101'))
        );
    }

    /** PDF real (TCPDF backend) de la "Nota de Baja" MGH-119.
     *  `ids` = id_decommission de todas las bajas del lote (o una sola, para reimpresión). */
    generarPdfNotaBaja(ids: (number | string)[]): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        const csv = ids.map(Number).filter(n => !isNaN(n) && n > 0).join(',');
        return from(this._api.post('herramientas/decommissions/generarPdfNotaBaja', { ids: csv })).pipe(
            switchMap(this._pdfResp('Error al generar la nota de baja MGH-119'))
        );
    }

    /** Genera y abre el reporte de discrepancia MGH-101 en una sola llamada.
     *  `ventana` = pestaña reservada con MovementService.preAbrirVentanaPdf() dentro del gesto. */
    verNotaCuarentena(ids: (number | string)[], ventana?: Window | null): void {
        this.generarPdfNotaCuarentena(ids).subscribe({
            next: (r) => this._movementSvc.abrirPdfNota(r.pdf_base64, r.nombre_archivo, ventana),
            error: (e) => { try { ventana?.close(); } catch { /* noop */ } console.error('verNotaCuarentena:', e?.message || e); }
        });
    }

    /** Genera y abre la nota de baja MGH-119 en una sola llamada.
     *  `ventana` = pestaña reservada con MovementService.preAbrirVentanaPdf() dentro del gesto. */
    verNotaBaja(ids: (number | string)[], ventana?: Window | null): void {
        this.generarPdfNotaBaja(ids).subscribe({
            next: (r) => this._movementSvc.abrirPdfNota(r.pdf_base64, r.nombre_archivo, ventana),
            error: (e) => { try { ventana?.close(); } catch { /* noop */ } console.error('verNotaBaja:', e?.message || e); }
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Quarantine
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all quarantine records
     */
    getQuarantines(filters?: any): Observable<QuarantineRecord[]> {
        const params: any = {
            start: 0,
            limit: 100,
            ordenacion: 'id_quarantine',
            dir_ordenacion: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/quarantines/listQuarantines', params)).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Create quarantine record
     */
    createQuarantine(record: Partial<QuarantineRecord>): Observable<any> {
        return from(this._api.post('herramientas/quarantines/insertQuarantine', record)).pipe(
            switchMap((response: any) => {
                const root = response?.ROOT || response;
                if (root?.error === true || root?.error === 'true') {
                    throw new Error(root?.detalle?.mensaje || root?.mensaje || 'Error al registrar cuarentena');
                }
                return of(root?.datos?.[0] || root?.datos || record);
            })
        );
    }

    /**
     * Update quarantine record
     */
    updateQuarantine(id: string | number, record: any): Observable<any> {
        return from(this._api.post('herramientas/quarantines/updateCuarentena', {
            ...record,
            id_quarantine: id
        })).pipe(
            switchMap((response: any) => {
                const root = response?.ROOT || response;
                if (root?.error === true || root?.error === 'true') {
                    throw new Error(root?.detalle?.mensaje || root?.mensaje || 'Error al actualizar cuarentena');
                }
                return of(root?.datos?.[0] || root?.datos || root?.data || {});
            })
        );
    }

    /**
     * Get active quarantines
     */
    getActiveQuarantines(): Observable<QuarantineRecord[]> {
        return from(this._api.post('herramientas/quarantines/listActiveQuarantines', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response?.data || []);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Decommission
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all decommission records
     */
    getDecommissions(filters?: any): Observable<DecommissionRecord[]> {
        const params: any = {
            start: 0,
            limit: 100,
            ordenacion: 'id_decommission',
            dir_ordenacion: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/decommissions/listDecommissions', params)).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Create decommission record
     */
    createDecommission(record: Partial<DecommissionRecord>): Observable<any> {
        return from(this._api.post('herramientas/decommissions/insertDecommission', record)).pipe(
            switchMap((response: any) => {
                const root = response?.ROOT || response;
                if (root?.error === true || root?.error === 'true') {
                    throw new Error(root?.detalle?.mensaje || root?.mensaje || 'Error al registrar baja');
                }
                return of(root?.datos?.[0] || root?.datos || record);
            })
        );
    }

    /**
     * Update decommission record
     */
    updateDecommission(id: string | number, record: any): Observable<any> {
        return from(this._api.post('herramientas/decommissions/updateBaja', {
            ...record,
            id_decommission: id
        })).pipe(
            switchMap((response: any) => {
                const root = response?.ROOT || response;
                if (root?.error === true || root?.error === 'true') {
                    throw new Error(root?.detalle?.mensaje || root?.mensaje || 'Error al actualizar baja');
                }
                return of(root?.datos?.[0] || root?.datos || root?.data || {});
            })
        );
    }
}
