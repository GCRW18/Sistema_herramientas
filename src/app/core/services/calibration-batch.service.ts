import { Injectable, inject, signal, computed } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, catchError } from 'rxjs';
import {
    CalibrationBatch,
    CalibrationBatchItem,
    CalibrationBatchSummary,
    CreateBatchParams,
    AddToolToBatchParams,
    ConfirmBatchParams,
    ReturnBatchParams
} from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class CalibrationBatchService {
    private _api = inject(ErpApiService);

    // Signals para estado reactivo
    private _batches = signal<CalibrationBatch[]>([]);
    private _currentBatch = signal<CalibrationBatch | null>(null);
    private _batchItems = signal<CalibrationBatchItem[]>([]);
    private _isLoading = signal<boolean>(false);

    // Computed signals
    public batches = this._batches.asReadonly();
    public currentBatch = this._currentBatch.asReadonly();
    public batchItems = this._batchItems.asReadonly();
    public isLoading = this._isLoading.asReadonly();

    public openBatches = computed(() =>
        this._batches().filter(b => b.status === 'open')
    );

    public sentBatches = computed(() =>
        this._batches().filter(b => b.status === 'sent' || b.status === 'in_process')
    );

    public overdueBatches = computed(() =>
        this._batches().filter(b => b.is_overdue)
    );

    public jackItemsInCurrentBatch = computed(() =>
        this._batchItems().filter(item => item.is_jack)
    );

    // ReplaySubjects para compatibilidad con componentes RxJS
    private _batchesSubject: ReplaySubject<CalibrationBatch[]> = new ReplaySubject<CalibrationBatch[]>(1);
    get batches$(): Observable<CalibrationBatch[]> { return this._batchesSubject.asObservable(); }

    // =========================================================================
    // CRUD DE LOTES
    // =========================================================================

    getBatches(filters?: any): Observable<CalibrationBatch[]> {
        this._isLoading.set(true);
        const params = { start: 0, limit: 50, sort: 'id_batch', dir: 'desc', ...filters };

        return from(this._api.post('herramientas/CalibrationBatches/listarCalibrationBatches', params)).pipe(
            switchMap((response: any) => {
                const data = response?.datos || [];
                this._batches.set(data);
                this._batchesSubject.next(data);
                this._isLoading.set(false);
                return of(data);
            }),
            catchError((error) => {
                this._isLoading.set(false);
                return of([]);
            })
        );
    }

    createBatch(params: CreateBatchParams): Observable<any> {
        return from(this._api.post('herramientas/CalibrationBatches/insertarCalibrationBatches', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    updateBatch(id: number, params: Partial<CalibrationBatch>): Observable<any> {
        return from(this._api.post('herramientas/CalibrationBatches/insertarCalibrationBatches', {
            ...params,
            id_batch: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    deleteBatch(id: number): Observable<any> {
        return from(this._api.post('herramientas/CalibrationBatches/eliminarCalibrationBatches', {
            id_batch: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    // =========================================================================
    // ITEMS DEL LOTE
    // =========================================================================

    getBatchItems(batchId: number): Observable<CalibrationBatchItem[]> {
        const params = { start: 0, limit: 200, batch_id: batchId };

        return from(this._api.post('herramientas/CalibrationBatches/listarBatchItems', params)).pipe(
            switchMap((response: any) => {
                const data = response?.datos || [];
                this._batchItems.set(data);
                return of(data);
            }),
            catchError(() => {
                return of([]);
            })
        );
    }

    addToolToBatch(params: AddToolToBatchParams): Observable<any> {
        return from(this._api.post('herramientas/CalibrationBatches/addToolToBatch', params)).pipe(
            switchMap((response: any) => {
                // Refrescar items despues de agregar
                if (params.batch_id) {
                    this.getBatchItems(params.batch_id).subscribe();
                }
                return of(response?.datos || response);
            })
        );
    }

    removeFromBatch(itemId: number, batchId: number): Observable<any> {
        return from(this._api.post('herramientas/CalibrationBatches/removeFromBatch', {
            id_batch_item: itemId
        })).pipe(
            switchMap((response: any) => {
                // Refrescar items despues de eliminar
                this.getBatchItems(batchId).subscribe();
                return of(response?.datos || response);
            })
        );
    }

    // =========================================================================
    // FLUJO DE CONFIRMACION
    // =========================================================================

    confirmBatch(params: ConfirmBatchParams): Observable<any> {
        return from(this._api.post('herramientas/CalibrationBatches/confirmCalibrationBatch', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    // =========================================================================
    // RETORNO MASIVO
    // =========================================================================

    processReturnBatch(params: ReturnBatchParams): Observable<any> {
        return from(this._api.post('herramientas/CalibrationBatches/processReturnBatch', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    // =========================================================================
    // RESUMEN
    // =========================================================================

    getBatchSummary(batchId: number): Observable<CalibrationBatchSummary> {
        return from(this._api.post('herramientas/CalibrationBatches/getBatchSummary', {
            batch_id: batchId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || null);
            }),
            catchError(() => of(null as any))
        );
    }

    // =========================================================================
    // JACK (GATA) ALERTS
    // =========================================================================

    getJackAlerts(): Observable<any[]> {
        return from(this._api.post('herramientas/CalibrationBatches/listarJackAlerts', {
            start: 0, limit: 500
        })).pipe(
            switchMap((response: any) => of(response?.datos || [])),
            catchError(() => of([]))
        );
    }

    getJackSummary(): Observable<any> {
        return from(this._api.post('herramientas/CalibrationBatches/getJackSummary', {})).pipe(
            switchMap((response: any) => of(response?.datos?.[0] || null)),
            catchError(() => of(null))
        );
    }
}
