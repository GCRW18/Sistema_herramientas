import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { ErpApiService } from 'app/core/api/api.service';
import {
    Warehouse, AlmacenTipo, AlmacenEstado,
    Rack, Level, LevelTool, ToolEstado,
    Ciudad, Oficina,
} from './interfaces';

interface BackendWarehouse {
    id_warehouse:    number;
    id_base:         number;
    code:            string;
    name:            string;
    description?:    string;
    address?:        string;
    active:          boolean;
    city?:           string;
    id_oficina?:     number;
    nombre_oficina?: string;
    warehouse_type?: string;
    racks_count?:    number;
    levels_count?:   number;
}

interface BackendOficina {
    id_oficina:     number;
    nombre_oficina: string;
}

interface BackendRack {
    id_rack:       number;
    warehouse_id:  number;
    code:          string;
    name:          string;
    description?:  string;
    active:        boolean;
    levels_count?: number;
    tools_count?:  number;
}

interface BackendLevel {
    id_level:      number;
    rack_id:       number;
    warehouse_id?: number;
    number:        number | null;
    code:          string;
    name:          string;
    description?:  string;
    active:        boolean;
    is_floor:      boolean;
    tools_count?:  number;
}

interface BackendLevelTool {
    id_tool:           number;
    code:              string;
    name:              string;
    brand?:            string;
    part_number:       string;
    serial_number?:    string;
    location_state?:   string;
    unit_of_measure?:  string;
    quantity_in_stock: number;
    image_base64?:     string;
    notes?:            string;
    warehouse_id?:     number;
    rack_id:           number;
    level_id:          number;
    rack_code:         string;
    rack_name:         string;
    level_number:      number;
    level_code:        string;
    level_name:        string;
}

interface BackendCiudad {
    id_ciudad: number;
    nombre:    string;
}


@Injectable({ providedIn: 'root' })
export class GestionUbicacionesService {

    private _api = inject(ErpApiService);

    /* ════════ Paramétricas ════════ */

    getBasesAeronauticas(): Observable<any> {
        return from(this._api.post('herramientas/Bases/listarBases', { start: 0, limit: 100 }));
    }

    getOficinas(): Observable<Oficina[]> {
        return from(this._api.post('herramientas/warehouses/listarOficinas', { start: 0, limit: 500 }))
            .pipe(
                map((r: any) => (r?.datos || r?.data || [])
                    .map((o: BackendOficina) => ({
                        id_oficina:     o.id_oficina,
                        nombre_oficina: o.nombre_oficina,
                    } as Oficina))
                )
            );
    }

    getCiudades(): Observable<Ciudad[]> {
        return from(this._api.post('herramientas/warehouses/listarCiudades', { start: 0, limit: 200 }))
            .pipe(
                map((r: any) => (r?.datos || r?.data || [])
                    .map((c: BackendCiudad) => ({
                        id_ciudad: c.id_ciudad,
                        nombre:    c.nombre,
                    } as Ciudad))
                )
            );
    }

    /* ════════ Warehouses ════════ */

    getWarehouses(): Observable<Warehouse[]> {
        const params = { start: 0, limit: 1000, sort: 'id_warehouse', dir: 'asc' };
        return from(this._api.post('herramientas/warehouses/listarWarehouses', params))
            .pipe(map((r: any) => (r?.datos || r?.data || []).map((w: BackendWarehouse) => this.toWarehouse(w))));
    }

    insertWarehouse(w: Warehouse): Observable<any> {
        return from(this._api.post('herramientas/warehouses/insertarWarehouses', this.fromWarehouse(w)));
    }

    updateWarehouse(w: Warehouse): Observable<any> {
        return from(this._api.post('herramientas/warehouses/insertarWarehouses', { ...this.fromWarehouse(w), id_warehouse: w.id }));
    }

    deleteWarehouse(id: number): Observable<any> {
        return from(this._api.post('herramientas/warehouses/eliminarWarehouses', { id_warehouse: id }));
    }

    /* ════════ Racks ════════ */

    getRacks(warehouseId: number): Observable<Rack[]> {
        const params = {
            start: 0, limit: 1000, sort: 'rk.id_rack', dir: 'asc',
            filtro_adicional: `rk.warehouse_id = ${warehouseId}`,
            warehouse_id: warehouseId
        };
        return from(this._api.post('herramientas/racks/listarRacks', params)).pipe(
            map((r: any) => (r?.datos || r?.data || []).map((x: BackendRack) => this.toRack(x))),
            map(racks => racks.filter(rack => rack.warehouseId === warehouseId))
        );
    }

    insertRack(r: Rack): Observable<any> {
        return from(this._api.post('herramientas/racks/insertarRacks', this.fromRack(r)));
    }

    updateRack(r: Rack): Observable<any> {
        return from(this._api.post('herramientas/racks/insertarRacks', { ...this.fromRack(r), id_rack: r.id }));
    }

    deleteRack(id: number): Observable<any> {
        return from(this._api.post('herramientas/racks/eliminarRacks', { id_rack: id }));
    }

    /* ════════ Levels ════════ */

    getLevels(rackId: number): Observable<Level[]> {
        const params = {
            start: 0, limit: 1000, sort: 'lv.number', dir: 'asc',
            filtro_adicional: `lv.rack_id = ${rackId}`,
            rack_id: rackId
        };
        return from(this._api.post('herramientas/levels/listarLevels', params)).pipe(
            map((r: any) => (r?.datos || r?.data || []).map((x: BackendLevel) => this.toLevel(x))),
            map(levels => levels.filter(level => level.rackId === rackId))
        );
    }

    insertLevel(l: Level): Observable<any> {
        return from(this._api.post('herramientas/levels/insertarLevels', this.fromLevel(l)));
    }

    updateLevel(l: Level): Observable<any> {
        return from(this._api.post('herramientas/levels/insertarLevels', { ...this.fromLevel(l), id_level: l.id }));
    }

    deleteLevel(id: number): Observable<any> {
        return from(this._api.post('herramientas/levels/eliminarLevels', { id_level: id }));
    }

    /* ════════ Level Tools ════════ */

    getLevelTools(rackId: number): Observable<LevelTool[]> {
        const params = {
            start: 0, limit: 5000, sort: 'tl.id_tool', dir: 'asc',
            filtro_adicional: `tl.rack_id = ${rackId}`,
            rack_id: rackId
        };
        return from(this._api.post('herramientas/leveltools/listarLevelTools', params)).pipe(
            map((r: any) => (r?.datos || r?.data || []).map((x: BackendLevelTool) => this.toLevelTool(x))),
            map(tools => tools.filter(tool => tool.rackId === rackId))
        );
    }

    getLevelToolsByWarehouse(warehouseId: number): Observable<LevelTool[]> {
        const params = {
            start: 0, limit: 5000, sort: 'tl.id_tool', dir: 'asc',
            filtro_adicional: `tl.warehouse_id = ${warehouseId} and tl.level_id is not null`,
            warehouse_id: warehouseId
        };
        return from(this._api.post('herramientas/leveltools/listarLevelTools', params)).pipe(
            map((r: any) => {
                let rawData = r?.datos || r?.data || [];
                rawData = rawData.filter((x: BackendLevelTool) => x.warehouse_id === warehouseId);
                return rawData.map((x: BackendLevelTool) => this.toLevelTool(x));
            })
        );
    }

    insertLevelTool(t: LevelTool, warehouseId: number): Observable<any> {
        return from(this._api.post('herramientas/leveltools/insertarLevelTools',
            { ...this.fromLevelTool(t), warehouse_id: warehouseId }));
    }

    updateLevelTool(t: LevelTool): Observable<any> {
        return from(this._api.post('herramientas/leveltools/insertarLevelTools',
            { ...this.fromLevelTool(t), id_tool: t.id }));
    }

    moveLevelTool(toolId: number, rackId: number, levelId: number): Observable<any> {
        return from(this._api.post('herramientas/leveltools/moverLevelTools',
            { id_tool: toolId, rack_id: rackId, level_id: levelId }));
    }

    unassignLevelTool(toolId: number): Observable<any> {
        return from(this._api.post('herramientas/leveltools/eliminarLevelTools', { id_tool: toolId }));
    }

    /* ════════ Mapeos ════════ */

    private toWarehouse(b: BackendWarehouse): Warehouse {
        const tipo  = (b.warehouse_type as AlmacenTipo) || 'Principal';
        const estado: AlmacenEstado = b.active ? 'ACTIVO' : 'INACTIVO';
        return {
            id:            b.id_warehouse,
            id_base:       b.id_base,
            codigo:        b.code,
            nombre:        b.name,
            ciudad:        b.city || '',
            id_oficina:    b.id_oficina ?? null,
            nombreOficina: b.nombre_oficina || '',
            tipo,
            estado,
            descripcion:   b.description,
            estantesCount: Number(b.racks_count ?? 0),
            nivelesCount:  Number(b.levels_count ?? 0),
        };
    }

    private fromWarehouse(w: Warehouse): any {
        return {
            id_base:        w.id_base,
            code:           w.codigo,
            name:           w.nombre,
            description:    w.descripcion ?? '',
            address:        '',
            active:         w.estado === 'ACTIVO' ? 'true' : 'false',
            city:           w.ciudad,
            id_oficina:     w.id_oficina,
            warehouse_type: w.tipo,
        };
    }

    private toRack(b: BackendRack): Rack {
        return {
            id:          b.id_rack,
            warehouseId: b.warehouse_id,
            codigo:      b.code,
            nombre:      b.name,
            descripcion: b.description,
            activo:      !!b.active,
            niveles:     [],
        };
    }

    private fromRack(r: Rack): any {
        return {
            warehouse_id: r.warehouseId,
            code:         r.codigo,
            name:         r.nombre,
            description:  r.descripcion ?? '',
            active:       !!r.activo,
        };
    }

    private _parseBool(val: any): boolean {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return val === 'true' || val === 't' || val === '1';
        return !!val;
    }

    private toLevel(b: BackendLevel): Level {
        return {
            id:          b.id_level,
            rackId:      b.rack_id,
            numero:      b.number != null ? Number(b.number) : null,
            codigo:      b.code,
            nombre:      b.name,
            descripcion: b.description,
            activo:      this._parseBool(b.active),
            isFloor:     this._parseBool(b.is_floor),
            tools:       [],
        };
    }

    private fromLevel(l: Level): any {
        return {
            rack_id:     l.rackId,
            number:      l.isFloor ? null : l.numero,
            code:        l.isFloor ? 'SUELO' : l.codigo,
            name:        l.isFloor ? 'Nivel Suelo' : l.nombre,
            description: l.descripcion ?? '',
            active:      !!l.activo,
            is_floor:    l.isFloor,
        };
    }

    private toLevelTool(b: BackendLevelTool): LevelTool {
        const estado: ToolEstado = (b.location_state as ToolEstado) || 'NUEVO';
        return {
            id:            b.id_tool,
            levelId:       b.level_id,
            rackId:        b.rack_id,
            rackCodigo:    b.rack_code,
            levelNumero:   Number(b.level_number),
            levelCodigo:   b.level_code,
            codigo:        b.code,
            pn:            b.part_number,
            sn:            b.serial_number,
            nombre:        b.name,
            marca:         b.brand,
            estado,
            cantidad:      Number(b.quantity_in_stock ?? 1),
            um:            b.unit_of_measure || 'UNIDAD',
            imagenBase64:  b.image_base64,
            observaciones: b.notes,
        };
    }

    private fromLevelTool(t: LevelTool): any {
        return {
            rack_id:           t.rackId,
            level_id:          t.levelId,
            code:              t.codigo,
            name:              t.nombre,
            brand:             t.marca ?? '',
            part_number:       t.pn,
            serial_number:     t.sn ?? '',
            location_state:    t.estado,
            unit_of_measure:   t.um,
            quantity_in_stock: t.cantidad,
            image_base64:      t.imagenBase64 ?? '',
            notes:             t.observaciones ?? '',
        };
    }
}
