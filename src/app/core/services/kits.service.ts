import { Injectable, inject } from '@angular/core';
import { from, Observable, of, forkJoin, ReplaySubject, map, catchError, switchMap } from 'rxjs';
import { ErpApiService } from '../api/api.service';

export interface KitFilters {
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
        // Defaults antes del spread: son un piso para que las claves lleguen siempre, sin pisar
        // los valores que ya trae el form (ej. total_components = items.length).
        return from(this._api.post('herramientas/kits/insertarKits', {
            active: true,
            is_complete: false,
            total_components: 0,
            present_components: 0,
            completeness_percentage: 0,
            ...kit
        })).pipe(
            map((r: any) => {
                const d = r?.ROOT ?? r;
                if (d?.error === true) throw new Error(d?.detalle?.mensaje ?? d?.mensaje ?? 'Error al crear el kit');
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

        // Sin este chequeo el error se tomaba como éxito: el form seguía borrando y re-insertando
        // componentes y el toggle de activo cambiaba en pantalla aunque no se guardara.
        return this._postOrThrow('herramientas/kits/insertarKits', payload);
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

    // Quita la ubicación asignada al kit (HE_KIT_UBIC_ELI). Se usa al limpiar el picker.
    desasignarKit(id_kit: number): Observable<any> {
        return this._postOrThrow('herramientas/kits/desasignarKits', { id_kit });
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
            sort:     'id_kit_component',
            dir: 'asc'
        })).pipe(
            map((r: any) => this._normalize(r)),
            catchError(() => of([]))
        );
    }

    saveKitComponents(kitId: number, items: any[]): Observable<any[]> {
        // Dedupe por tool_id: he.tkit_components tiene UNIQUE(kit_id, tool_id), una repetida
        // haría fallar todo el guardado.
        const seen = new Set<number>();
        const validos = items.filter(i => {
            if (!i.tool_id || seen.has(i.tool_id)) return false;
            seen.add(i.tool_id);
            return true;
        });
        if (!validos.length) return of([]);
        const calls = validos.map(i =>
            this._postOrThrow('herramientas/kitcomponents/insertarKitComponents', {
                kit_id:           kitId,
                tool_id:          i.tool_id,
                quantity:         1,
                is_mandatory:     true,
                // Conserva los ausentes: re-guardar el kit los volvía a "presente".
                is_present:       i.is_present === false ? 'false' : 'true',
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

    // -----------------------------------------------------------------------------------------------------
    // @ Devolución de préstamos PKT (los kits ahora se prestan desde Préstamo Técnico)
    // -----------------------------------------------------------------------------------------------------

    devolverKit(data: {
        id_kit_loan: number;
        kit_id: number;
        verified_by_name: string;
        verified_by_id?: number;
        is_complete: boolean;
        missing_components?: string;
        damaged_components?: string;
        absent_tool_ids?: number[];
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
        // Faltantes y dañados quedan ausentes en el kit (tkit_components.is_present = false).
        if (data.absent_tool_ids?.length) payload.absent_tool_ids = data.absent_tool_ids.join(',');
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

    /** Préstamos de un kit: los PKT antiguos (he.tkit_loans) + los de Préstamo Técnico
     *  ("agregar kit", he.tloan_items.kit_id), del más reciente al más antiguo. */
    getPrestamosKit(kitId: number): Observable<any[]> {
        const pt$ = from(this._api.post('herramientas/movements/listarLoanItems', {
            start: 0, limit: 1000, sort: 'lis.id_loan_item', dir: 'desc', kit_id: kitId
        })).pipe(
            map((r: any) => [...new Set(this._normalize(r).map((i: any) => Number(i.loan_id)).filter(Boolean))].slice(0, 50)),
            switchMap((ids: number[]) => ids.length
                ? from(this._api.post('herramientas/movements/listarLoans', {
                    start: 0, limit: ids.length, sort: 'id_loan', dir: 'desc', ids_loan: ids.join(',')
                })).pipe(map((r: any) => this._normalize(r)))
                : of([])),
            catchError(() => of([]))
        );
        return forkJoin({ pkt: this.getKitLoans(kitId), pt: pt$ }).pipe(
            map(({ pkt, pt }) => [...pkt, ...pt].sort((a: any, b: any) =>
                String(b.loan_date ?? '').localeCompare(String(a.loan_date ?? ''))))
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
