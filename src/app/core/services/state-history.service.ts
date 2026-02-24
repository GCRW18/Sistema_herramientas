import { Injectable, inject, signal, computed } from '@angular/core';
import { from, Observable, of, switchMap, catchError } from 'rxjs';
import {
    StateHistoryRecord,
    StateHistoryTimeline,
    StateChangeSummary,
    CreateStateHistoryParams
} from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class StateHistoryService {
    private _api = inject(ErpApiService);

    // Signals para estado reactivo
    private _records = signal<StateHistoryRecord[]>([]);
    private _timeline = signal<StateHistoryTimeline[]>([]);
    private _isLoading = signal<boolean>(false);

    // Computed signals publicos
    public records = this._records.asReadonly();
    public timeline = this._timeline.asReadonly();
    public isLoading = this._isLoading.asReadonly();

    public totalRecords = computed(() => this._records().length);

    // =========================================================================
    // LISTADO GENERAL
    // =========================================================================

    getStateHistory(filters?: any): Observable<StateHistoryRecord[]> {
        this._isLoading.set(true);
        const params = { start: 0, limit: 50, sort: 'sh.change_date', dir: 'desc', ...filters };

        return from(this._api.post('herramientas/StateHistory/listarStateHistory', params)).pipe(
            switchMap((response: any) => {
                const data = response?.datos || [];
                this._records.set(data);
                this._isLoading.set(false);
                return of(data);
            }),
            catchError(() => {
                this._isLoading.set(false);
                return of([]);
            })
        );
    }

    // =========================================================================
    // HISTORIAL POR HERRAMIENTA (Timeline)
    // =========================================================================

    getToolHistory(toolId: number): Observable<StateHistoryTimeline[]> {
        this._isLoading.set(true);
        const params = {
            start: 0, limit: 100,
            sort: 'sh.change_date', dir: 'desc',
            tool_id: toolId
        };

        return from(this._api.post('herramientas/StateHistory/listarHistorialPorHerramienta', params)).pipe(
            switchMap((response: any) => {
                const data = response?.datos || [];
                this._timeline.set(data);
                this._isLoading.set(false);
                return of(data);
            }),
            catchError(() => {
                this._isLoading.set(false);
                return of([]);
            })
        );
    }

    // =========================================================================
    // REGISTRO MANUAL
    // =========================================================================

    createStateHistory(params: CreateStateHistoryParams): Observable<any> {
        return from(this._api.post('herramientas/StateHistory/insertarStateHistory', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    deleteStateHistory(id: number): Observable<any> {
        return from(this._api.post('herramientas/StateHistory/eliminarStateHistory', {
            id_history: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response);
            })
        );
    }

    // =========================================================================
    // RESUMEN POR PERIODO
    // =========================================================================

    getStateChangeSummary(fechaDesde: string, fechaHasta: string): Observable<StateChangeSummary[]> {
        return from(this._api.post('herramientas/StateHistory/getStateChangeSummary', {
            fecha_desde: fechaDesde,
            fecha_hasta: fechaHasta
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            }),
            catchError(() => of([]))
        );
    }

    // =========================================================================
    // UTILIDADES
    // =========================================================================

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            'available': 'Disponible',
            'in_use': 'En Uso',
            'in_calibration': 'En Calibracion',
            'in_maintenance': 'En Mantenimiento',
            'quarantine': 'Cuarentena',
            'decommissioned': 'Dado de Baja',
            'lost': 'Perdido',
            'NEW': 'Nuevo'
        };
        return labels[status] || status;
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            'available': '#22c55e',
            'in_use': '#3b82f6',
            'in_calibration': '#f59e0b',
            'in_maintenance': '#8b5cf6',
            'quarantine': '#ef4444',
            'decommissioned': '#6b7280',
            'lost': '#dc2626'
        };
        return colors[status] || '#6b7280';
    }
}
