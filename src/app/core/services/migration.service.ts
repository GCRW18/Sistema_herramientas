import { Injectable, inject, signal, computed } from '@angular/core';
import { from, Observable, of, switchMap, catchError } from 'rxjs';
import {
    ProductoExcel,
    HerramientaObservado,
    MigrationSummary,
    MigrationResult,
    ValidationResult
} from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class MigrationService {
    private _api = inject(ErpApiService);

    // Signals para estado reactivo
    private _productos = signal<ProductoExcel[]>([]);
    private _observados = signal<HerramientaObservado[]>([]);
    private _summary = signal<MigrationSummary | null>(null);
    private _isLoading = signal<boolean>(false);
    private _isMigrating = signal<boolean>(false);

    // Computed signals publicos
    public productos = this._productos.asReadonly();
    public observados = this._observados.asReadonly();
    public summary = this._summary.asReadonly();
    public isLoading = this._isLoading.asReadonly();
    public isMigrating = this._isMigrating.asReadonly();

    public pendingCount = computed(() =>
        this._productos().filter(p => p.migrado === 'no').length
    );

    public migratedCount = computed(() =>
        this._productos().filter(p => p.migrado === 'si').length
    );

    public errorCount = computed(() =>
        this._productos().filter(p => p.migrado === 'err' || p.migrado === 'obs').length
    );

    public progressPercentage = computed(() => {
        const s = this._summary();
        return s ? s.porcentaje_avance : 0;
    });

    // =========================================================================
    // PRODUCTOS EXCEL (STAGING)
    // =========================================================================

    getProductosExcel(filters?: any): Observable<ProductoExcel[]> {
        this._isLoading.set(true);
        const params = { start: 0, limit: 50, sort: 'id_data', dir: 'asc', ...filters };

        return from(this._api.post('herramientas/ProductosExcel/listarProductosExcel', params)).pipe(
            switchMap((response: any) => {
                const data = response?.data || [];
                this._productos.set(data);
                this._isLoading.set(false);
                return of(data);
            }),
            catchError(() => {
                this._isLoading.set(false);
                return of([]);
            })
        );
    }

    insertProductoExcel(producto: Partial<ProductoExcel>): Observable<any> {
        return from(this._api.post('herramientas/ProductosExcel/insertarProductosExcel', producto)).pipe(
            switchMap((response: any) => of(response?.data || response))
        );
    }

    updateProductoExcel(id: number, producto: Partial<ProductoExcel>): Observable<any> {
        return from(this._api.post('herramientas/ProductosExcel/insertarProductosExcel', {
            ...producto,
            id_data: id
        })).pipe(
            switchMap((response: any) => of(response?.data || response))
        );
    }

    deleteProductoExcel(id: number): Observable<any> {
        return from(this._api.post('herramientas/ProductosExcel/eliminarProductosExcel', {
            id_data: id
        })).pipe(
            switchMap((response: any) => of(response?.data || response))
        );
    }

    // =========================================================================
    // VALIDACION PRE-MIGRACION
    // =========================================================================

    validarDatos(): Observable<ValidationResult> {
        this._isLoading.set(true);
        return from(this._api.post('herramientas/ProductosExcel/validarDatosMigracion', {})).pipe(
            switchMap((response: any) => {
                this._isLoading.set(false);
                const result: ValidationResult = {
                    total_validados: parseInt(response?.data?.total_validados || '0'),
                    total_errores: parseInt(response?.data?.total_errores || '0'),
                    mensaje: response?.data?.mensaje || ''
                };
                return of(result);
            }),
            catchError(() => {
                this._isLoading.set(false);
                return of({ total_validados: 0, total_errores: 0, mensaje: 'Error en validacion' });
            })
        );
    }

    // =========================================================================
    // PROCESAMIENTO DE MIGRACION
    // =========================================================================

    procesarMigracion(batchSize: number = 500): Observable<MigrationResult> {
        this._isMigrating.set(true);
        return from(this._api.post('herramientas/ProductosExcel/procesarMigracion', {
            batch_size: batchSize
        })).pipe(
            switchMap((response: any) => {
                this._isMigrating.set(false);
                const result: MigrationResult = {
                    total_migrados: parseInt(response?.data?.total_migrados || '0'),
                    total_errores: parseInt(response?.data?.total_errores || '0'),
                    mensaje: response?.data?.mensaje || ''
                };
                // Refrescar resumen
                this.getResumenMigracion().subscribe();
                return of(result);
            }),
            catchError(() => {
                this._isMigrating.set(false);
                return of({ total_migrados: 0, total_errores: 0, mensaje: 'Error en migracion' });
            })
        );
    }

    migrarRegistroIndividual(idData: number): Observable<any> {
        return from(this._api.post('herramientas/ProductosExcel/migrarRegistroIndividual', {
            id_data: idData
        })).pipe(
            switchMap((response: any) => of(response?.data || response))
        );
    }

    // =========================================================================
    // RESETEAR REGISTROS CON ERROR
    // =========================================================================

    resetearRegistrosError(): Observable<any> {
        return from(this._api.post('herramientas/ProductosExcel/resetearRegistrosError', {})).pipe(
            switchMap((response: any) => {
                this.getResumenMigracion().subscribe();
                return of(response?.data || response);
            })
        );
    }

    // =========================================================================
    // HERRAMIENTAS OBSERVADAS
    // =========================================================================

    getHerramientasObservadas(filters?: any): Observable<HerramientaObservado[]> {
        const params = { start: 0, limit: 50, sort: 'codigo_he', dir: 'asc', ...filters };

        return from(this._api.post('herramientas/ProductosExcel/listarHerramientaObservado', params)).pipe(
            switchMap((response: any) => {
                const data = response?.data || [];
                this._observados.set(data);
                return of(data);
            }),
            catchError(() => of([]))
        );
    }

    insertHerramientaObservado(item: HerramientaObservado): Observable<any> {
        return from(this._api.post('herramientas/ProductosExcel/insertarHerramientaObservado', item)).pipe(
            switchMap((response: any) => of(response?.data || response))
        );
    }

    deleteHerramientaObservado(codigoHe: string): Observable<any> {
        return from(this._api.post('herramientas/ProductosExcel/eliminarHerramientaObservado', {
            codigo_he: codigoHe
        })).pipe(
            switchMap((response: any) => of(response?.data || response))
        );
    }

    // =========================================================================
    // RESUMEN DE MIGRACION
    // =========================================================================

    getResumenMigracion(): Observable<MigrationSummary> {
        return from(this._api.post('herramientas/ProductosExcel/getResumenMigracion', {})).pipe(
            switchMap((response: any) => {
                const data = response?.data?.[0] || this._getDefaultSummary();
                this._summary.set(data);
                return of(data);
            }),
            catchError(() => {
                const defaultSummary = this._getDefaultSummary();
                this._summary.set(defaultSummary);
                return of(defaultSummary);
            })
        );
    }

    private _getDefaultSummary(): MigrationSummary {
        return {
            total_registros: 0,
            total_migrados: 0,
            total_pendientes: 0,
            total_observados: 0,
            total_con_calibracion: 0,
            total_sin_codigo: 0,
            porcentaje_avance: 0
        };
    }
}
