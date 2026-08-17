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
            fecha:       raw.fecha_reg        ? (raw.fecha_reg as string).split('T')[0] : '',
            hora:        raw.fecha_reg        ? (raw.fecha_reg as string).split('T')[1]?.slice(0,5) ?? '' : '',
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
            nro:             '',
            apellidoPaterno: '',
            apellidoMaterno: '',
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

    getMiscelaneos(search?: string): Observable<Material[]> {
        const params: any = { start: 0, limit: 200, sort: 'code', dir: 'asc' };
        if (search?.trim()) params.search = search.trim();
        return from(this._api.post('herramientas/miscelaneos/listarMiscelaneos', params)).pipe(
            map((r: any) => this._normalize(r).map(x => this._mapMaterial(x))),
            catchError(() => of([]))
        );
    }

    createMiscelaneo(mat: Partial<Material>): Observable<{ id: number }> {
        const payload: any = {
            code:             mat.codigoBoaM?.trim().toUpperCase(),
            name:             mat.producto?.trim(),
            description:      mat.observacion?.trim() || null,
            brand:            mat.marca?.trim()        || null,
            part_number:      mat.pn?.trim()           || null,
            unit_of_measure:  mat.unidad               || 'UND',
            purchase_type:    mat.tipoCompra           || 'COMPRA DIRECTA',
            item_type:        mat.tipoItem             || 'CONSUMIBLE',
            quantity_in_stock:mat.stock                ?? 0,
            stock_min:        mat.stockMin             ?? 0,
            stock_max:        mat.stockMax             ?? 0,
            location_name:    mat.ubicacion?.trim()    || null,
            notes:            mat.observacion?.trim()  || null,
            active:           mat.activo               ?? true,
        };
        // pxp-client serializa JS null como la string 'null', que Postgres rechaza al castear
        // a int4 — por eso rack_id/level_id/warehouse_id solo se agregan si hay ubicación
        // elegida (mismo criterio que kits.service.ts#createKit).
        if (mat.rackId && mat.levelId) {
            payload.warehouse_id = mat.warehouseId ?? null;
            payload.rack_id      = mat.rackId;
            payload.level_id     = mat.levelId;
        }
        return from(this._api.post('herramientas/miscelaneos/insertarMiscelaneos', payload)).pipe(
            map((r: any) => {
                const root = r?.ROOT ?? r;
                if (root?.error === true) throw new Error(root?.detalle?.mensaje ?? root?.mensaje ?? 'Error al crear misceláneo');
                const d = root?.datos ?? root;
                return { id: Number(d?.id_miscelaneo ?? 0) };
            }),
            catchError(err => { throw err; })
        );
    }

    updateMiscelaneo(id: number, mat: Partial<Material>): Observable<any> {
        const payload: any = { id_miscelaneo: id };
        if (mat.codigoBoaM  !== undefined) payload.code            = mat.codigoBoaM.trim().toUpperCase();
        if (mat.producto    !== undefined) payload.name            = mat.producto.trim();
        if (mat.observacion !== undefined) payload.description     = mat.observacion.trim() || null;
        if (mat.marca       !== undefined) payload.brand           = mat.marca.trim() || null;
        if (mat.pn          !== undefined) payload.part_number     = mat.pn.trim() || null;
        if (mat.unidad      !== undefined) payload.unit_of_measure = mat.unidad;
        if (mat.tipoCompra  !== undefined) payload.purchase_type   = mat.tipoCompra;
        if (mat.tipoItem    !== undefined) payload.item_type       = mat.tipoItem;
        if (mat.stock       !== undefined) payload.quantity_in_stock = mat.stock;
        if (mat.stockMin    !== undefined) payload.stock_min       = mat.stockMin;
        if (mat.stockMax    !== undefined) payload.stock_max       = mat.stockMax;
        if (mat.ubicacion   !== undefined) payload.location_name   = mat.ubicacion.trim() || null;
        if (mat.observacion !== undefined) payload.notes           = mat.observacion.trim() || null;
        if (mat.activo      !== undefined) payload.active          = mat.activo;

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
        const params: any = { start: 0, limit: 500, sort: 'mv.fecha_reg', dir: 'desc', type: 'ENTRADA' };
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
        const params: any = { start: 0, limit: 500, sort: 'mv.fecha_reg', dir: 'desc', type: 'SALIDA' };
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
        return from(this._api.post('herramientas/miscelaneomovimientos/entradaMiscelaneos', {
            miscelaneo_id:  data.miscelaneo_id,
            quantity:       data.cantidad,
            date:           data.fecha,
            time:           data.hora,
            name:           data.recibidoPor,
            invoice_number: data.factura  || null,
            notes:          data.observacion || null,
        })).pipe(
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
        return from(this._api.post('herramientas/miscelaneomovimientos/salidaMiscelaneos', {
            miscelaneo_id:    data.miscelaneo_id,
            quantity:         data.cantidad,
            date:             data.fecha,
            time:             data.hora,
            name:             data.nombre,
            area:             data.area,
            authorized_by:    data.despachadoPor,
            license_number:   data.nroLicencia       || null,
            work_order_number:data.ordenTrabajo       || null,
            aircraft:         data.buscadorAeronave   || null,
            reason:           data.buscadorAutorizado || null,
            notes:            data.observaciones      || null,
        })).pipe(
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
        return from(this._api.post('herramientas/miscelaneomovimientos/actualizarMiscelaneoMovimientos', {
            id_mov_misc:    data.id,
            quantity:       data.cantidad,
            date:           data.fecha,
            time:           data.hora,
            name:           data.recibidoPor,
            invoice_number: data.factura    || null,
            notes:          data.observacion || null,
        })).pipe(
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
        return from(this._api.post('herramientas/miscelaneomovimientos/actualizarSalidaMiscelaneos', {
            id_mov_misc:       data.id,
            quantity:          data.cantidad,
            date:              data.fecha,
            time:              data.hora,
            name:              data.nombre,
            area:              data.area,
            authorized_by:     data.despachadoPor,
            license_number:    data.nroLicencia        || null,
            work_order_number: data.ordenTrabajo       || null,
            aircraft:          data.buscadorAeronave   || null,
            reason:            data.buscadorAutorizado || null,
            notes:             data.observaciones      || null,
        })).pipe(
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
