import { Injectable, inject } from '@angular/core';
import { from, Observable, of, map, catchError } from 'rxjs';
import { ErpApiService } from '../api/api.service';
import { Material, Entrada, Salida } from '../../modules/admin/inventory/inventario-miscelaneos/interfaces';

@Injectable({ providedIn: 'root' })
export class MiscelaneosService {
    private _api = inject(ErpApiService);

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _normalize(r: any): any[] {
        const d = r?.ROOT?.datos ?? r?.datos ?? r?.data ?? r;
        if (!d || d === '') return [];
        return Array.isArray(d) ? d : [d];
    }

    private _single(r: any): any {
        return this._normalize(r)[0] ?? null;
    }

    private _mapMaterial(raw: any): Material {
        return {
            id:          Number(raw.id_miscelaneo ?? 0),
            codigoBoaM:  raw.code             ?? '',
            producto:    raw.name             ?? '',
            tipoItem:    raw.item_type        ?? 'CONSUMIBLE',
            tipoCompra:  raw.purchase_type    ?? 'COMPRA DIRECTA',
            marca:       raw.brand            ?? '',
            pn:          raw.part_number      ?? '',
            unidad:      raw.unit_of_measure?.trim()  || 'UND',
            stock:       Number(raw.quantity_in_stock ?? 0),
            stockMin:    Number(raw.stock_min  ?? 0),
            stockMax:    Number(raw.stock_max  ?? 0),
            ubicacion:   raw.location_name    ?? '',
            activo:      raw.active === true || raw.active === 'true' || raw.active === 't',
            recibidoPor: raw.usr_reg           ?? '',
            // Postgres devuelve el timestamp separado por espacio ("2026-08-26 23:38:57"), no
            // por 'T' como ISO 8601 — de ahí el regex [T ] (antes con split('T') se guardaba
            // el string completo sin separar en "fecha" y "hora" quedaba siempre vacío).
            fecha:       raw.fecha_reg        ? (raw.fecha_reg as string).split(/[T ]/)[0] : '',
            hora:        raw.fecha_reg        ? (raw.fecha_reg as string).split(/[T ]/)[1]?.slice(0,5) ?? '' : '',
            fechaAdquisicion: raw.acquisition_date ? (raw.acquisition_date as string).split(/[T ]/)[0] : '',
            // Fecha de la última entrada/salida real (he.tmiscelaneo_movimientos.date), no el alta
            // del catálogo. La usa Consultar Inventario para "Último movimiento".
            lastMovementDate: raw.last_movement_date ? (raw.last_movement_date as string).split(/[T ]/)[0] : '',
            observacion: raw.notes            ?? '',
            warehouseId: raw.warehouse_id != null ? Number(raw.warehouse_id) : null,
            rackId:      raw.rack_id      != null ? Number(raw.rack_id)      : null,
            levelId:     raw.level_id     != null ? Number(raw.level_id)     : null,
            rackName:    raw.rack_name    ?? '',
            levelName:   raw.level_name   ?? '',
        };
    }

    private _mapEntrada(raw: any): Entrada {
        return {
            id:           Number(raw.id_mov_misc    ?? 0),
            miscelaneo_id:Number(raw.miscelaneo_id  ?? 0),
            nroNota:      raw.movement_number       ?? '',
            fecha:        raw.date                  ?? '',
            hora:         raw.time?.slice(0,5)      ?? '',
            recibidoPor:  raw.name                  ?? '',
            codigoNombre: raw.miscelaneo_code       ?? '',
            producto:     raw.miscelaneo_name       ?? '',
            cantidad:     Number(raw.quantity       ?? 0),
            unidad:       raw.unit_of_measure       ?? 'UND',
            factura:      raw.invoice_number        ?? '',
            observacion:  raw.notes                 ?? '',
            // marca y pn se enriquecen en el componente desde el catálogo
            marca:        '',
            pn:           '',
        };
    }

    private _mapSalida(raw: any): Salida {
        return {
            id:              Number(raw.id_mov_misc    ?? 0),
            miscelaneo_id:   Number(raw.miscelaneo_id  ?? 0),
            nroNota:         raw.movement_number       ?? '',
            fecha:           raw.date                  ?? '',
            hora:            raw.time?.slice(0,5)      ?? '',
            nroLicencia:     raw.license_number        ?? '',
            nombre:          raw.name                  ?? '',
            area:            raw.area                  ?? '',
            despachadoPor:   raw.authorized_by         ?? '',
            codigoNombre:    raw.miscelaneo_code       ?? '',
            producto:        raw.miscelaneo_name       ?? '',
            unidad:          raw.unit_of_measure       ?? 'UND',
            cantidad:        Number(raw.quantity       ?? 0),
            ordenTrabajo:    raw.work_order_number     ?? '',
            buscadorAeronave:  raw.aircraft            ?? '',
            buscadorAutorizado: raw.reason             ?? '',
            observaciones:   raw.notes                 ?? '',
        };
    }

    // ── Catálogo ──────────────────────────────────────────────────────────────

    getMiscelaneos(): Observable<Material[]> {
        // limit 2000: el catálogo, las notificaciones de bajo stock y la vista unificada
        // consumen la lista completa — con 200 se truncaba silenciosamente.
        const params: any = { start: 0, limit: 2000, ordenacion: 'code', dir_ordenacion: 'asc' };
        return from(this._api.post('herramientas/miscelaneos/listarMiscelaneos', params)).pipe(
            map((r: any) => this._normalize(r).map(x => this._mapMaterial(x))),
            catchError(() => of([]))
        );
    }

    createMiscelaneo(mat: Partial<Material>): Observable<{ id: number; code: string }> {
        // Payload explícito: solo claves con valor real (pxp-client serializa null como el string
        // "null" y rompe casts de fecha/int en el backend). code se genera solo (correlativo BOA-M).
        const payload: any = {
            name:              mat.producto?.trim() || '',
            unit_of_measure:   mat.unidad     || 'UND',
            purchase_type:     mat.tipoCompra || 'COMPRA DIRECTA',
            item_type:         mat.tipoItem   || 'CONSUMIBLE',
            quantity_in_stock: mat.stock    ?? 0,
            stock_min:         mat.stockMin ?? 0,
            stock_max:         mat.stockMax ?? 0,
            active:            mat.activo ?? true,
        };
        const obs = mat.observacion?.trim();
        if (mat.marca?.trim())     payload.brand           = mat.marca.trim();
        if (mat.pn?.trim())        payload.part_number     = mat.pn.trim();
        if (mat.ubicacion?.trim()) payload.location_name   = mat.ubicacion.trim();
        if (mat.fechaAdquisicion)  payload.acquisition_date = mat.fechaAdquisicion;
        if (obs) { payload.description = obs; payload.notes = obs; }
        // warehouse_id no se manda: HE_MIS_INS lo deriva del rack.
        if (mat.rackId && mat.levelId) {
            payload.rack_id  = mat.rackId;
            payload.level_id = mat.levelId;
        }
        return from(this._api.post('herramientas/miscelaneos/insertarMiscelaneos', payload)).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al crear misceláneo');
                const d = root?.datos ?? root;
                return { id: Number(d?.id_miscelaneo ?? 0), code: d?.code ?? '' };
            }),
            catchError(err => { throw err; })
        );
    }

    updateMiscelaneo(id: number, mat: Partial<Material>): Observable<any> {
        // Payload completo con valores limpios ('' para texto vacío, nunca null). El backend
        // (HE_MIS_MOD) interpreta '' como "borrar el campo" y la clave ausente como "no tocar".
        // code es inmutable (correlativo BOA-M) — no se envía.
        const obs = mat.observacion?.trim() ?? '';
        const payload: any = {
            id_miscelaneo:     id,
            name:              mat.producto?.trim() ?? '',
            brand:             mat.marca?.trim() ?? '',
            part_number:       mat.pn?.trim() ?? '',
            unit_of_measure:   mat.unidad ?? 'UND',
            purchase_type:     mat.tipoCompra ?? 'COMPRA DIRECTA',
            item_type:         mat.tipoItem ?? 'CONSUMIBLE',
            quantity_in_stock: mat.stock ?? 0,
            stock_min:         mat.stockMin ?? 0,
            stock_max:         mat.stockMax ?? 0,
            location_name:     mat.ubicacion?.trim() ?? '',
            description:       obs,
            notes:             obs,
            active:            mat.activo ?? true,
        };
        // acquisition_date es date: '' o 'null' revientan el casteo — se omite si está vacío
        // (el backend deja el valor previo).
        if (mat.fechaAdquisicion) payload.acquisition_date = mat.fechaAdquisicion;

        return from(this._api.post('herramientas/miscelaneos/insertarMiscelaneos', payload)).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al actualizar misceláneo');
                return root;
            }),
            catchError(err => { throw err; })
        );
    }

    // HE_MIS_MOD (updateMiscelaneo) nunca toca rack_id/level_id a propósito — igual criterio
    // que he.ft_kits_ime (HE_KIT_MOD no mueve, HE_KIT_MOV sí). Mover ubicación va por acá.
    moverMiscelaneo(id: number, rackId: number, levelId: number): Observable<any> {
        return from(this._api.post('herramientas/miscelaneos/moverMiscelaneos', {
            id_miscelaneo: id, rack_id: rackId, level_id: levelId
        })).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al mover misceláneo');
                return root;
            }),
            catchError(err => { throw err; })
        );
    }

    // Libera rack_id/level_id/warehouse_id (a diferencia de HE_MIS_MOD, que nunca los toca).
    // Usar cuando el usuario quita la ubicación en el picker del catálogo (ver
    // inventario-miscelaneos.component.ts#editarCatalogo) — sin esto, el item quedaba huérfano
    // en la grilla de Gestión de Ubicaciones aunque el catálogo mostrara "Sin asignar".
    desasignarMiscelaneo(id: number): Observable<any> {
        return from(this._api.post('herramientas/miscelaneos/desasignarMiscelaneos', {
            id_miscelaneo: id
        })).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al desasignar ubicación');
                return root;
            }),
            catchError(err => { throw err; })
        );
    }

    deleteMiscelaneo(id: number): Observable<boolean> {
        return from(this._api.post('herramientas/miscelaneos/eliminarMiscelaneos', { id_miscelaneo: id })).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al eliminar misceláneo');
                return true;
            }),
            catchError(err => { throw err; })
        );
    }

    // ── Movimientos ───────────────────────────────────────────────────────────

    getEntradas(miscelaneo_id?: number): Observable<Entrada[]> {
        const params: any = { start: 0, limit: 500, ordenacion: 'mv.fecha_reg', dir_ordenacion: 'desc', type: 'ENTRADA' };
        if (miscelaneo_id) params.miscelaneo_id = miscelaneo_id;
        return from(this._api.post('herramientas/miscelaneomovimientos/listarMiscelaneoMovimientos', params)).pipe(
            map((r: any) => this._normalize(r)
                .filter((x: any) => x.type === 'ENTRADA')
                .map((x: any) => this._mapEntrada(x))
            ),
            catchError(() => of([]))
        );
    }

    getSalidas(miscelaneo_id?: number): Observable<Salida[]> {
        const params: any = { start: 0, limit: 500, ordenacion: 'mv.fecha_reg', dir_ordenacion: 'desc', type: 'SALIDA' };
        if (miscelaneo_id) params.miscelaneo_id = miscelaneo_id;
        return from(this._api.post('herramientas/miscelaneomovimientos/listarMiscelaneoMovimientos', params)).pipe(
            map((r: any) => this._normalize(r)
                .filter((x: any) => x.type === 'SALIDA')
                .map((x: any) => this._mapSalida(x))
            ),
            catchError(() => of([]))
        );
    }

    registrarEntrada(data: {
        miscelaneo_id: number;
        cantidad:      number;
        fecha:         string;
        hora:          string;
        recibidoPor:   string;
        factura?:      string;
        observacion?:  string;
    }): Observable<{ id: number; numero: string }> {
        const payload: any = {
            miscelaneo_id: data.miscelaneo_id,
            quantity:      data.cantidad,
            date:          data.fecha,
            time:          data.hora,
            name:          data.recibidoPor,
        };
        if (data.factura?.trim())     payload.invoice_number = data.factura.trim();
        if (data.observacion?.trim()) payload.notes          = data.observacion.trim();
        return from(this._api.post('herramientas/miscelaneomovimientos/entradaMiscelaneos', payload)).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al registrar entrada');
                const d = root?.datos ?? root;
                return { id: Number(d?.id_mov_misc ?? 0), numero: d?.numero ?? '' };
            }),
            catchError(err => { throw err; })
        );
    }

    registrarSalida(data: {
        miscelaneo_id:      number;
        cantidad:           number;
        fecha:              string;
        hora:               string;
        nombre:             string;
        area:               string;
        despachadoPor:      string;
        nroLicencia?:       string;
        ordenTrabajo?:      string;
        buscadorAeronave?:  string;
        buscadorAutorizado?: string;
        observaciones?:     string;
    }): Observable<{ id: number; numero: string }> {
        const payload: any = {
            miscelaneo_id: data.miscelaneo_id,
            quantity:      data.cantidad,
            date:          data.fecha,
            time:          data.hora,
            name:          data.nombre,
            area:          data.area,
            authorized_by: data.despachadoPor,
        };
        if (data.nroLicencia?.trim())        payload.license_number    = data.nroLicencia.trim();
        if (data.ordenTrabajo?.trim())       payload.work_order_number = data.ordenTrabajo.trim();
        if (data.buscadorAeronave?.trim())   payload.aircraft          = data.buscadorAeronave.trim();
        if (data.buscadorAutorizado?.trim()) payload.reason            = data.buscadorAutorizado.trim();
        if (data.observaciones?.trim())      payload.notes             = data.observaciones.trim();
        return from(this._api.post('herramientas/miscelaneomovimientos/salidaMiscelaneos', payload)).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al registrar salida');
                const d = root?.datos ?? root;
                return { id: Number(d?.id_mov_misc ?? 0), numero: d?.numero ?? '' };
            }),
            catchError(err => { throw err; })
        );
    }

    editarEntrada(data: {
        id:          number;
        cantidad:    number;
        fecha:       string;
        hora:        string;
        recibidoPor: string;
        factura?:    string;
        observacion?:string;
    }): Observable<void> {
        const payload: any = {
            id_mov_misc: data.id,
            quantity:    data.cantidad,
            date:        data.fecha,
            time:        data.hora,
            name:        data.recibidoPor,
        };
        if (data.factura?.trim())     payload.invoice_number = data.factura.trim();
        if (data.observacion?.trim()) payload.notes          = data.observacion.trim();
        return from(this._api.post('herramientas/miscelaneomovimientos/actualizarMiscelaneoMovimientos', payload)).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al actualizar entrada');
            }),
            catchError(err => { throw err; })
        );
    }

    eliminarEntrada(id: number): Observable<void> {
        return from(this._api.post('herramientas/miscelaneomovimientos/eliminarMiscelaneoMovimientos', {
            id_mov_misc: id,
        })).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al eliminar entrada');
            }),
            catchError(err => { throw err; })
        );
    }

    editarSalida(data: {
        id:                  number;
        cantidad:            number;
        fecha:               string;
        hora:                string;
        nombre:              string;
        area:                string;
        despachadoPor:       string;
        nroLicencia?:        string;
        ordenTrabajo?:       string;
        buscadorAeronave?:   string;
        buscadorAutorizado?: string;
        observaciones?:      string;
    }): Observable<void> {
        const payload: any = {
            id_mov_misc:   data.id,
            quantity:      data.cantidad,
            date:          data.fecha,
            time:          data.hora,
            name:          data.nombre,
            area:          data.area,
            authorized_by: data.despachadoPor,
        };
        if (data.nroLicencia?.trim())        payload.license_number    = data.nroLicencia.trim();
        if (data.ordenTrabajo?.trim())       payload.work_order_number = data.ordenTrabajo.trim();
        if (data.buscadorAeronave?.trim())   payload.aircraft          = data.buscadorAeronave.trim();
        if (data.buscadorAutorizado?.trim()) payload.reason            = data.buscadorAutorizado.trim();
        if (data.observaciones?.trim())      payload.notes             = data.observaciones.trim();
        return from(this._api.post('herramientas/miscelaneomovimientos/actualizarSalidaMiscelaneos', payload)).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al actualizar salida');
            }),
            catchError(err => { throw err; })
        );
    }

    // Reutiliza el mismo endpoint que eliminarEntrada — HE_MMV_ELI revierte stock para ambos tipos
    eliminarSalida(id: number): Observable<void> {
        return from(this._api.post('herramientas/miscelaneomovimientos/eliminarMiscelaneoMovimientos', {
            id_mov_misc: id,
        })).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al eliminar salida');
            }),
            catchError(err => { throw err; })
        );
    }
}
