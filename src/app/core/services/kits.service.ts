import { Injectable, inject } from '@angular/core';
import { from, Observable, of, forkJoin, ReplaySubject, map, catchError, switchMap } from 'rxjs';
import { ErpApiService } from '../api/api.service';

export interface KitFilters {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
}

@Injectable({ providedIn: 'root' })
export class KitsService {
    private _api = inject(ErpApiService);
    private _kits: ReplaySubject<any[]> = new ReplaySubject<any[]>(1);

    get kits$(): Observable<any[]> { return this._kits.asObservable(); }

    // -----------------------------------------------------------------------------------------------------
    // @ Helpers
    // -----------------------------------------------------------------------------------------------------

    // pxp-client y api.service nunca rechazan: devuelven { error: true } como valor.
    // Este helper lo convierte en un error real para que mergeMap/forkJoin fallen correctamente.
    private _postOrThrow(url: string, params: any): Observable<any> {
        return from(this._api.post(url, params)).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) {
                    throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? root?.message ?? 'Error del servidor');
                }
                return r;
            })
        );
    }

    private _normalize(r: any): any[] {
        const d = r?.ROOT?.datos ?? r?.datos ?? r?.data ?? r;
        if (!d || d === '') return [];
        return Array.isArray(d) ? d : [d];
    }

    private _normalizeSingle(r: any): any {
        const arr = this._normalize(r);
        return arr[0] ?? null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Kits CRUD
    // -----------------------------------------------------------------------------------------------------

    getKits(filters?: KitFilters): Observable<any[]> {
        const params: any = {
            start: ((filters?.page ?? 1) - 1) * (filters?.limit ?? 50),
            limit: filters?.limit ?? 50,
            sort: 'id_kit',
            dir: 'desc'
        };
        if (filters?.status)   params.status   = filters.status;
        if (filters?.category) params.category = filters.category;
        if (filters?.search)   params.search   = filters.search;

        return from(this._api.post('herramientas/kits/listarKits', params)).pipe(
            map((r: any) => {
                const kits = this._normalize(r);
                this._kits.next(kits);
                return kits;
            }),
            catchError(() => of([]))
        );
    }

    createKit(kit: any): Observable<{ id_kit: number; code: string }> {
        return from(this._api.post('herramientas/kits/insertarKits', {
            ...kit,
            active: true,
            is_complete: false,
            total_components: 0,
            present_components: 0,
            completeness_percentage: 0
        })).pipe(
            map((r: any) => {
                const d = r?.ROOT ?? r;
                return { id_kit: Number(d?.id_kit ?? d?.data?.id_kit ?? d?.datos?.id_kit ?? 0), code: kit.code ?? '' };
            }),
            catchError(err => { throw err; })
        );
    }

    updateKit(id_kit: number, kit: any): Observable<any> {
        // pxp-client serializa null como la string 'null', que PostgreSQL rechaza en campos bool/int4/date.
        // Se construye el payload omitiendo nulls y forzando booleanos.
        const payload: any = { id_kit };
        for (const [k, v] of Object.entries(kit)) {
            if (v !== null && v !== undefined && v !== 'null') payload[k] = v;
        }
        // Campos bool obligatorios: deben tener valor explícito aunque el raw sea null
        payload.active               = kit.active               ?? false;
        payload.requires_calibration = kit.requires_calibration ?? false;
        payload.is_complete          = kit.is_complete          ?? false;

        return from(this._api.post('herramientas/kits/insertarKits', payload)).pipe(
            map((r: any) => r),
            catchError(err => { throw err; })
        );
    }

    deleteKit(id_kit: number): Observable<boolean> {
        return from(this._api.post('herramientas/kits/eliminarKits', { id_kit })).pipe(
            map(() => true),
            catchError(() => of(false))
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Ubicación — mover kit a otro almacén/estante/nivel (HE_KIT_MOV, no toca otros campos del kit)
    // -----------------------------------------------------------------------------------------------------

    moverKit(id_kit: number, rack_id: number, level_id: number): Observable<any> {
        return this._postOrThrow('herramientas/kits/moverKits', { id_kit, rack_id, level_id });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Correlativos — código auto-generado
    // -----------------------------------------------------------------------------------------------------

    getNextKitCode(): Observable<string> {
        return from(this._api.post('herramientas/correlativos/siguienteCorrelativo', { prefijo: 'KIT' })).pipe(
            map((r: any) => {
                // ErpApiService.catch() devuelve el error en vez de relanzarlo,
                // por lo que r puede ser el objeto de error cuando pxp-client rechaza.
                if (r?.error === true || r?.ROOT?.error === true) {
                    throw new Error(r?.mensaje ?? r?.ROOT?.mensaje ?? 'Error del servidor al generar correlativo');
                }
                let datos = r?.ROOT?.datos ?? r?.datos ?? r?.data ?? r;
                if (typeof datos === 'string') {
                    try { datos = JSON.parse(datos); } catch { /* mantener como string */ }
                }
                const numero = datos?.numero ?? datos?.nro_formateado;
                if (!numero) throw new Error('Correlativo KIT no recibido del servidor');
                return numero as string;
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Componentes del kit
    // -----------------------------------------------------------------------------------------------------

    getKitComponents(kitId: number): Observable<any[]> {
        return from(this._api.post('herramientas/kitcomponents/listarKitComponents', {
            start: 0, limit: 200,
            kit_id: kitId,
            sort:   'id_kit_component',
            dir:    'asc'
        })).pipe(
            map((r: any) => this._normalize(r)),
            catchError(() => of([]))
        );
    }

    saveKitComponents(kitId: number, items: any[]): Observable<any[]> {
        const validos = items.filter(i => i.tool_id);
        if (!validos.length) return of([]);
        const calls = validos.map(i =>
            this._postOrThrow('herramientas/kitcomponents/insertarKitComponents', {
                kit_id:           kitId,
                tool_id:          i.tool_id,
                quantity:         1,
                is_mandatory:     true,
                is_present:       true,
                present_quantity: 0
            })
        );
        return forkJoin(calls);
    }

    deleteKitComponents(components: any[]): Observable<any[]> {
        if (!components.length) return of([]);
        const calls = components.map(c =>
            this._postOrThrow('herramientas/kitcomponents/eliminarKitComponents', {
                id_kit_component: c.id_kit_component
            })
        );
        return forkJoin(calls);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Categorías de kits
    // -----------------------------------------------------------------------------------------------------

    getKitCategories(): Observable<{ id_kit_category: number; name: string; active: boolean }[]> {
        return from(this._api.post('herramientas/kitcategories/listarKitCategorias', {
            start: 0, limit: 100, sort: 'name', dir: 'asc'
        })).pipe(
            map((r: any) => this._normalize(r) as { id_kit_category: number; name: string; active: boolean }[]),
            catchError(() => of([]))
        );
    }

    createKitCategory(name: string): Observable<any> {
        return from(this._api.post('herramientas/kitcategories/insertarKitCategorias', {
            name: name.trim().toUpperCase(),
            active: true
        })).pipe(
            catchError(err => { throw err; })
        );
    }

    deleteKitCategory(id_kit_category: number): Observable<any> {
        return this._postOrThrow('herramientas/kitcategories/eliminarKitCategorias', { id_kit_category });
    }

    getNextWorkOrderNumber(): Observable<string> {
        return from(this._api.post('herramientas/correlativos/siguienteCorrelativo', { prefijo: 'OT' })).pipe(
            map((r: any) => {
                if (r?.error === true || r?.ROOT?.error === true) {
                    throw new Error(r?.mensaje ?? r?.ROOT?.mensaje ?? 'Error al generar OT');
                }
                let datos = r?.ROOT?.datos ?? r?.datos ?? r?.data ?? r;
                if (typeof datos === 'string') { try { datos = JSON.parse(datos); } catch { /* */ } }
                const numero = datos?.numero ?? datos?.nro_formateado;
                if (!numero) throw new Error('Correlativo OT no recibido');
                return numero as string;
            }),
            catchError(() => of(''))
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Préstamos de kits
    // -----------------------------------------------------------------------------------------------------

    prestarKit(data: {
        kit_id: number;
        borrower_name: string;
        borrower_id?: number;
        department?: string;
        work_order_number?: string;
        loan_date?: string;
        expected_return_date?: string;
        delivered_by_name?: string;
        notes?: string;
    }): Observable<{ id_kit_loan: number; loan_number: string }> {
        return from(this._api.post('herramientas/kitloans/prestarKit', data)).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al registrar préstamo');
                const d = root?.datos ?? root;
                return {
                    id_kit_loan: Number(d?.id_kit_loan ?? 0),
                    loan_number: d?.loan_number ?? ''
                };
            }),
            catchError(err => { throw err; })
        );
    }

    devolverKit(data: {
        id_kit_loan: number;
        kit_id: number;
        verified_by_name: string;
        verified_by_id?: number;
        is_complete: boolean;
        missing_components?: string;
        damaged_components?: string;
        extra_components?: string;
        actions_taken?: string;
        notes?: string;
    }): Observable<{ kit_status: string; id_verification: number }> {
        // Construir payload explícitamente para evitar que pxp-client serialice 'undefined' como string
        const payload: any = {
            id_kit_loan:      data.id_kit_loan,
            kit_id:           data.kit_id,
            verified_by_name: data.verified_by_name,
            is_complete:      data.is_complete ? 'true' : 'false',
        };
        if (data.verified_by_id)     payload.verified_by_id     = data.verified_by_id;
        if (data.missing_components) payload.missing_components = data.missing_components;
        if (data.damaged_components) payload.damaged_components = data.damaged_components;
        if (data.extra_components)   payload.extra_components   = data.extra_components;
        if (data.actions_taken)      payload.actions_taken      = data.actions_taken;
        if (data.notes)              payload.notes              = data.notes;

        return from(this._api.post('herramientas/kitloans/devolverKit', payload)).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al registrar devolución');
                const d = root?.datos ?? root;
                return {
                    kit_status:      d?.kit_status      ?? 'complete',
                    id_verification: Number(d?.id_verification ?? 0)
                };
            }),
            catchError(err => { throw err; })
        );
    }

    getKitLoans(kitId?: number): Observable<any[]> {
        const params: any = { start: 0, limit: 100, sort: 'id_kit_loan', dir: 'desc' };
        if (kitId) params.kit_id = kitId;
        return from(this._api.post('herramientas/kitloans/listarKitLoans', params)).pipe(
            map((r: any) => this._normalize(r)),
            catchError(() => of([]))
        );
    }
}
