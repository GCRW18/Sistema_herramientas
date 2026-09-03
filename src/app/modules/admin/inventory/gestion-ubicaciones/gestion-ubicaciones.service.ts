import { Injectable, inject } from '@angular/core';
import { Observable, from, map, of, catchError } from 'rxjs';
import { ErpApiService } from 'app/core/api/api.service';
import {
    Warehouse, AlmacenTipo, AlmacenEstado,
    Rack, Level, LevelTool, ToolEstado,
    Ciudad, Oficina, LevelKit, LevelMiscelaneo,
} from './interfaces';

interface BackendWarehouse {
    id_warehouse:    number;
    id_base:         number;
    id_lugar:        number;
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
    requires_calibration?:    boolean | string;
    calibration_interval?:    number;
    last_calibration_date?:   string;
    next_calibration_date?:   string;
    calibration_certificate?: string;
    image_base64?:     string;
    notes?:            string;
    content_list?:     string;
    warehouse_id?:     number;
    rack_id:           number;
    level_id:          number;
    rack_code:         string;
    rack_name:         string;
    level_number:      number;
    level_code:        string;
    level_name:        string;
}

interface BackendLugar {
    id_lugar: number;
    nombre:   string;
    codigo:   string;
}

interface BackendKit {
    id_kit:              number;
    code:                string;
    name:                string;
    category?:           string;
    status:              string;
    is_complete:         boolean;
    total_components:    number;
    present_components:  number;
    warehouse_id?:       number;
    rack_id:             number;
    level_id:            number;
    rack_name?:          string;
    level_name?:         string;
    funcionario_nombre?: string;
}

interface BackendMiscelaneo {
    id_miscelaneo:     number;
    code:              string;
    name:              string;
    item_type?:        string;
    quantity_in_stock: number;
    unit_of_measure:   string;
    warehouse_id?:     number;
    rack_id:           number;
    level_id:          number;
    rack_name?:        string;
    level_name?:       string;
    active:            boolean;
}


@Injectable({ providedIn: 'root' })
export class GestionUbicacionesService {

    private _api = inject(ErpApiService);

    /**
     * Normaliza la respuesta de una operación de escritura y LANZA si el backend
     * reportó un error. Necesario porque ErpApiService.post atrapa el rechazo de
     * PxpClient y devuelve el objeto de error como si fuera un valor normal — sin
     * esto, el callback `next` de cada subscribe corría igual y la UI mostraba
     * "creado / actualizado" en falso (mismo patrón que miscelaneos/kits.service).
     */
    private _unwrap(r: any): any {
        if (r instanceof Error) throw r;
        const root = r?.ROOT ?? r;
        if (root?.error === true || root?.error === 'true' || root?.tipoRespuesta === 'error') {
            throw new Error(
                root?.detalle?.mensaje ?? root?.mensaje ?? root?.message ?? 'No se pudo completar la operación'
            );
        }
        return root?.datos ?? root;
    }

    /* ════════ Paramétricas ════════ */

    getBasesAeronauticas(): Observable<any> {
        return from(this._api.post('parametros/Lugar/listarLugar', {
            start: 0, limit: 100,
            par_filtro: 'lug.codigo#lug.nombre',
            es_regional: 'si',
            query: ''
        }));
    }

    getOficinas(idLugar?: number | null): Observable<Oficina[]> {
        const params = {
            start: 0, limit: 500,
            ordenacion: 'nombre', dir_ordenacion: 'DESC',
            par_filtro: 'ofi.nombre#ofi.codigo#lug.nombre',
            query: ''
        };
        return from(this._api.post('organigrama/Oficina/listarOficina', params)).pipe(
            map((r: any) => (r?.datos || r?.data || [])
                .map((o: any) => ({
                    id_oficina:     Number(o.id_oficina),
                    nombre_oficina: o.nombre || o.nombre_oficina || '',
                    id_lugar:       o.id_lugar != null ? Number(o.id_lugar) : undefined,
                } as Oficina))
            ),
            map((oficinas: Oficina[]) => idLugar != null
                ? oficinas.filter(o => o.id_lugar === Number(idLugar))
                : oficinas
            )
        );
    }

    getCiudades(): Observable<Ciudad[]> {
        return from(this._api.post('parametros/Lugar/listarLugar', {
            start: 0, limit: 200,
            par_filtro: 'lug.codigo#lug.nombre',
            es_regional: 'si',
            query: ''
        })).pipe(
            map((r: any) => (r?.datos || r?.data || [])
                .map((c: BackendLugar) => ({
                    id_lugar: Number(c.id_lugar),
                    nombre:   c.nombre,
                } as Ciudad))
            )
        );
    }

    /* ════════ Warehouses ════════ */

    getWarehouses(): Observable<Warehouse[]> {
        const params = { start: 0, limit: 1000, ordenacion: 'id_warehouse', dir_ordenacion: 'asc' };
        return from(this._api.post('herramientas/warehouses/listarWarehouses', params))
            .pipe(map((r: any) => (r?.datos || r?.data || []).map((w: BackendWarehouse) => this.toWarehouse(w))));
    }

    insertWarehouse(w: Warehouse): Observable<any> {
        return from(this._api.post('herramientas/warehouses/insertarWarehouses', this.fromWarehouse(w)))
            .pipe(map(r => this._unwrap(r)));
    }

    updateWarehouse(w: Warehouse): Observable<any> {
        return from(this._api.post('herramientas/warehouses/insertarWarehouses', { ...this.fromWarehouse(w), id_warehouse: w.id }))
            .pipe(map(r => this._unwrap(r)));
    }

    /**
     * Siguiente código correlativo para un almacén nuevo, formato ALM-<codigoBase>-NNNN.
     * Contador perpetuo e independiente por base (nunca se mezcla ni se reinicia por año).
     */
    getNextWarehouseCode(codigoBase: string): Observable<string> {
        return from(this._api.post('herramientas/correlativos/siguienteCorrelativoSinAnio', {
            prefijo: `ALM-${codigoBase}`
        })).pipe(
            map((r: any) => {
                if (r?.error === true || r?.ROOT?.error === true) {
                    throw new Error(r?.mensaje ?? r?.ROOT?.mensaje ?? 'Error del servidor al generar correlativo');
                }
                let datos = r?.ROOT?.datos ?? r?.datos ?? r?.data ?? r;
                if (typeof datos === 'string') {
                    try { datos = JSON.parse(datos); } catch { /* mantener como string */ }
                }
                const numero = datos?.numero;
                if (!numero) throw new Error('Correlativo de almacén no recibido del servidor');
                return numero as string;
            })
        );
    }

    /* ════════ Racks ════════ */

    getRacks(warehouseId: number): Observable<Rack[]> {
        const params = {
            start: 0, limit: 1000, ordenacion: 'rk.id_rack', dir_ordenacion: 'asc',
            filtro_adicional: `rk.warehouse_id = ${warehouseId}`,
            warehouse_id: warehouseId
        };
        return from(this._api.post('herramientas/racks/listarRacks', params)).pipe(
            map((r: any) => (r?.datos || r?.data || []).map((x: BackendRack) => this.toRack(x))),
            map(racks => racks.filter(rack => rack.warehouseId === warehouseId))
        );
    }

    insertRack(r: Rack): Observable<any> {
        return from(this._api.post('herramientas/racks/insertarRacks', this.fromRack(r)))
            .pipe(map(x => this._unwrap(x)));
    }

    updateRack(r: Rack): Observable<any> {
        return from(this._api.post('herramientas/racks/insertarRacks', { ...this.fromRack(r), id_rack: r.id }))
            .pipe(map(x => this._unwrap(x)));
    }

    deleteRack(id: number): Observable<any> {
        return from(this._api.post('herramientas/racks/eliminarRacks', { id_rack: id }))
            .pipe(map(x => this._unwrap(x)));
    }

    /* ════════ Levels ════════ */

    getLevels(rackId: number): Observable<Level[]> {
        const params = {
            start: 0, limit: 1000, ordenacion: 'lv.number', dir_ordenacion: 'asc',
            filtro_adicional: `lv.rack_id = ${rackId}`,
            rack_id: rackId
        };
        return from(this._api.post('herramientas/levels/listarLevels', params)).pipe(
            map((r: any) => (r?.datos || r?.data || []).map((x: BackendLevel) => this.toLevel(x))),
            map(levels => levels.filter(level => level.rackId === rackId))
        );
    }

    /**
     * Todos los niveles de un almacén en una sola llamada (ft_levels_sel ya expone
     * rk.warehouse_id). Evita el N+1 de pedir los niveles estante por estante.
     */
    getLevelsByWarehouse(warehouseId: number): Observable<Level[]> {
        const params = {
            start: 0, limit: 5000, ordenacion: 'lv.number', dir_ordenacion: 'asc',
            filtro_adicional: `rk.warehouse_id = ${warehouseId}`,
            warehouse_id: warehouseId
        };
        return from(this._api.post('herramientas/levels/listarLevels', params)).pipe(
            map((r: any) => (r?.datos || r?.data || [])
                .filter((x: BackendLevel) => Number(x.warehouse_id) === warehouseId)
                .map((x: BackendLevel) => this.toLevel(x))
            )
        );
    }

    insertLevel(l: Level): Observable<any> {
        return from(this._api.post('herramientas/levels/insertarLevels', this.fromLevel(l)))
            .pipe(map(x => this._unwrap(x)));
    }

    updateLevel(l: Level): Observable<any> {
        return from(this._api.post('herramientas/levels/insertarLevels', { ...this.fromLevel(l), id_level: l.id }))
            .pipe(map(x => this._unwrap(x)));
    }

    deleteLevel(id: number): Observable<any> {
        return from(this._api.post('herramientas/levels/eliminarLevels', { id_level: id }))
            .pipe(map(x => this._unwrap(x)));
    }

    /* ════════ Level Tools ════════ */

    getLevelTools(rackId: number): Observable<LevelTool[]> {
        const params = {
            start: 0, limit: 5000, ordenacion: 'tl.id_tool', dir_ordenacion: 'asc',
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
            start: 0, limit: 5000, ordenacion: 'tl.id_tool', dir_ordenacion: 'asc',
            filtro_adicional: `tl.warehouse_id = ${warehouseId} and tl.level_id is not null`,
            warehouse_id: warehouseId
        };
        return from(this._api.post('herramientas/leveltools/listarLevelTools', params)).pipe(
            map((r: any) => {
                let rawData = r?.datos || r?.data || [];
                rawData = rawData.filter((x: BackendLevelTool) => Number(x.warehouse_id) === warehouseId);
                return rawData.map((x: BackendLevelTool) => this.toLevelTool(x));
            })
        );
    }

    /**
     * Mapa id_tool → ubicación real (rack/nivel) para TODAS las herramientas con
     * rack/nivel asignado. Usado por consultar-inventario para mostrar la misma
     * ubicación que gestion-ubicaciones (antes dependía de ttools.location_id,
     * que mover-herramientas nunca actualiza — quedaba desincronizado).
     */
    getToolLocationsMap(): Observable<Map<number, { warehouseId: number; rackName: string; levelLabel: string }>> {
        const params = {
            start: 0, limit: 5000, ordenacion: 'tl.id_tool', dir_ordenacion: 'asc',
            filtro_adicional: 'tl.level_id is not null',
        };
        return from(this._api.post('herramientas/leveltools/listarLevelTools', params)).pipe(
            map((r: any) => {
                const raw: BackendLevelTool[] = r?.datos || r?.data || [];
                const out = new Map<number, { warehouseId: number; rackName: string; levelLabel: string }>();
                raw.forEach(x => {
                    out.set(Number(x.id_tool), {
                        warehouseId: Number(x.warehouse_id),
                        rackName:    x.rack_name || x.rack_code || '',
                        levelLabel:  x.level_name || (x.level_number != null ? `N°${x.level_number}` : x.level_code) || '',
                    });
                });
                return out;
            })
        );
    }

    findToolByCode(codigo: string): Observable<LevelTool | null> {
        const safe = codigo.replace(/'/g, "''");
        const params = {
            start: 0, limit: 2,
            filtro_adicional: `tl.code = '${safe}' and tl.level_id is not null`,
        };
        return from(this._api.post('herramientas/leveltools/listarLevelTools', params)).pipe(
            map((r: any) => {
                const raw: BackendLevelTool[] = r?.datos || r?.data || [];
                return raw.length ? this.toLevelTool(raw[0]) : null;
            })
        );
    }

    findToolByCodeAny(codigo: string): Observable<LevelTool | null> {
        const safe = codigo.replace(/'/g, "''");
        const params = { start: 0, limit: 2, filtro_adicional: `tl.code = '${safe}'` };
        return from(this._api.post('herramientas/leveltools/listarLevelTools', params)).pipe(
            map((r: any) => {
                const raw: BackendLevelTool[] = r?.datos || r?.data || [];
                return raw.length ? this.toLevelTool(raw[0]) : null;
            })
        );
    }

    insertLevelTool(t: LevelTool, warehouseId: number): Observable<any> {
        return from(this._api.post('herramientas/leveltools/insertarLevelTools',
            { ...this.fromLevelTool(t), warehouse_id: warehouseId })).pipe(map(x => this._unwrap(x)));
    }

    updateLevelTool(t: LevelTool): Observable<any> {
        return from(this._api.post('herramientas/leveltools/insertarLevelTools',
            { ...this.fromLevelTool(t), id_tool: t.id })).pipe(map(x => this._unwrap(x)));
    }

    moveLevelTool(toolId: number, rackId: number, levelId: number): Observable<any> {
        return from(this._api.post('herramientas/leveltools/moverLevelTools',
            { id_tool: toolId, rack_id: rackId, level_id: levelId })).pipe(map(x => this._unwrap(x)));
    }

    unassignLevelTool(toolId: number): Observable<any> {
        return from(this._api.post('herramientas/leveltools/eliminarLevelTools', { id_tool: toolId }))
            .pipe(map(x => this._unwrap(x)));
    }

    /** Adjunta/reemplaza la foto de una herramienta (ruta_bs del Blob Storage). */
    attachToolPhoto(toolId: number, rutaBs: string): Observable<any> {
        return from(this._api.post('herramientas/leveltools/adjuntarFotoHerramienta',
            { id_tool: toolId, image_path: rutaBs })).pipe(map(x => this._unwrap(x)));
    }

    /* ════════ Kits (ubicados en rack/nivel) ════════ */

    /**
     * Kits del módulo Gestión de Kits que tienen rack/nivel real asignado
     * (he.tkits.rack_id/level_id, ver he.ft_kits_ime HE_KIT_INS/HE_KIT_MOV). Se muestran
     * junto a las herramientas en la grilla de estantes de este módulo.
     */
    getKitsByWarehouse(warehouseId: number): Observable<LevelKit[]> {
        const params = {
            start: 0, limit: 5000, ordenacion: 'kit.id_kit', dir_ordenacion: 'asc',
            filtro_adicional: `kit.warehouse_id = ${warehouseId} and kit.level_id is not null`,
            warehouse_id: warehouseId
        };
        return from(this._api.post('herramientas/kits/listarKits', params)).pipe(
            map((r: any) => {
                let rawData = r?.datos || r?.data || [];
                rawData = rawData.filter((x: BackendKit) => Number(x.warehouse_id) === warehouseId);
                return rawData.map((x: BackendKit) => this.toLevelKit(x));
            }),
            catchError(() => of([]))
        );
    }

    moveKit(kitId: number, rackId: number, levelId: number): Observable<any> {
        return from(this._api.post('herramientas/kits/moverKits', { id_kit: kitId, rack_id: rackId, level_id: levelId }))
            .pipe(map(x => this._unwrap(x)));
    }

    /* ════════ Misceláneos (ubicados en rack/nivel) ════════ */

    /**
     * Ítems del catálogo de Misceláneos con rack/nivel real asignado (he.tmiscelaneos.rack_id/
     * level_id, ver he.ft_miscelaneos_ime HE_MIS_INS/HE_MIS_MOV). Se muestran junto a herramientas
     * y kits en la grilla de estantes de este módulo.
     */
    getMiscelaneosByWarehouse(warehouseId: number): Observable<LevelMiscelaneo[]> {
        const params = {
            start: 0, limit: 5000, ordenacion: 'mis.id_miscelaneo', dir_ordenacion: 'asc',
            filtro_adicional: `mis.warehouse_id = ${warehouseId} and mis.level_id is not null`,
            warehouse_id: warehouseId
        };
        return from(this._api.post('herramientas/miscelaneos/listarMiscelaneos', params)).pipe(
            map((r: any) => {
                let rawData = r?.datos || r?.data || [];
                rawData = rawData.filter((x: BackendMiscelaneo) => Number(x.warehouse_id) === warehouseId);
                return rawData.map((x: BackendMiscelaneo) => this.toLevelMiscelaneo(x));
            }),
            catchError(() => of([]))
        );
    }

    moveMiscelaneo(id: number, rackId: number, levelId: number): Observable<any> {
        return from(this._api.post('herramientas/miscelaneos/moverMiscelaneos', { id_miscelaneo: id, rack_id: rackId, level_id: levelId }))
            .pipe(map(x => this._unwrap(x)));
    }

    /* ════════ Mapeos ════════ */

    private toWarehouse(b: BackendWarehouse): Warehouse {
        const tipo  = (b.warehouse_type as AlmacenTipo) || 'Principal';
        const estado: AlmacenEstado = this._parseBool(b.active) ? 'ACTIVO' : 'INACTIVO';
        return {
            id:            Number(b.id_warehouse),
            id_lugar:      Number(b.id_lugar) || Number(b.id_base) || 0,
            codigo:        b.code,
            nombre:        b.name,
            ciudad:        b.city || '',
            id_oficina:    b.id_oficina != null ? Number(b.id_oficina) : null,
            nombreOficina: b.nombre_oficina || '',
            tipo,
            estado,
            descripcion:   b.description,
            estantesCount: Number(b.racks_count ?? 0),
            nivelesCount:  Number(b.levels_count ?? 0),
        };
    }

    private fromWarehouse(w: Warehouse): any {
        const payload: any = {
            code:           w.codigo,
            name:           w.nombre,
            description:    w.descripcion ?? '',
            address:        '',
            active:         w.estado === 'ACTIVO' ? 'true' : 'false',
            city:           w.ciudad ?? '',
            warehouse_type: w.tipo,
        };
        // id_lugar es obligatorio en el form; id_oficina es opcional (13/15 almacenes
        // sembrados no la tienen). Se omiten si vienen nulos — pxp-client serializa
        // null como el string "null" y revienta un parámetro int4.
        if (w.id_lugar != null)   payload.id_lugar   = w.id_lugar;
        if (w.id_oficina != null) payload.id_oficina = w.id_oficina;
        return payload;
    }

    private toRack(b: BackendRack): Rack {
        return {
            id:          Number(b.id_rack),
            warehouseId: Number(b.warehouse_id),
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
            id:          Number(b.id_level),
            rackId:      Number(b.rack_id),
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
            id:            Number(b.id_tool),
            levelId:       Number(b.level_id),
            rackId:        Number(b.rack_id),
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
            listaContenido: b.content_list,
            requiereCalibracion:  this._parseBool(b.requires_calibration),
            intervaloCalibracion: b.calibration_interval != null ? Number(b.calibration_interval) : null,
            fechaCalibracion:     b.last_calibration_date ?? null,
            nroCertificado:       b.calibration_certificate,
        };
    }

    private toLevelKit(b: BackendKit): LevelKit {
        return {
            id:                 Number(b.id_kit),
            levelId:            Number(b.level_id),
            rackId:             Number(b.rack_id),
            rackCodigo:         b.rack_name || '',
            levelNumero:        null,
            levelCodigo:        b.level_name || '',
            codigo:             b.code,
            nombre:             b.name,
            category:           b.category,
            status:             b.status,
            isComplete:         this._parseBool(b.is_complete),
            totalComponents:    Number(b.total_components ?? 0),
            presentComponents:  Number(b.present_components ?? 0),
            funcionarioNombre:  b.funcionario_nombre,
        };
    }

    private toLevelMiscelaneo(b: BackendMiscelaneo): LevelMiscelaneo {
        return {
            id:              Number(b.id_miscelaneo),
            levelId:         Number(b.level_id),
            rackId:          Number(b.rack_id),
            rackCodigo:      b.rack_name || '',
            levelNumero:     null,
            levelCodigo:     b.level_name || '',
            codigo:          b.code,
            nombre:          b.name,
            itemType:        b.item_type,
            quantityInStock: Number(b.quantity_in_stock ?? 0),
            unitOfMeasure:   b.unit_of_measure || 'UND',
            activo:          this._parseBool(b.active),
        };
    }

    private fromLevelTool(t: LevelTool): any {
        return {
            rack_id:              t.rackId,
            level_id:             t.levelId,
            code:                 t.codigo,
            name:                 t.nombre,
            brand:                t.marca ?? '',
            part_number:          t.pn,
            serial_number:        t.sn ?? '',
            location_state:       t.estado,
            unit_of_measure:      t.um,
            quantity_in_stock:    t.cantidad,
            image_path:           t.imagenBase64 ?? '',   // ruta_bs del Blob Storage (el nombre "imagenBase64" quedó por herencia)
            notes:                t.observaciones ?? '',
            content_list:         t.listaContenido ?? '',
            tool_type:            t.tipo ?? 'HERRAMIENTA',
            criticality_level:    t.nivelCriticidad ?? 'B',
            manufacture_origin:   t.fabricacion ?? 'INTERNACIONAL',
            requires_calibration: t.requiereCalibracion ?? false,
            calibration_interval: t.intervaloCalibracion != null ? String(t.intervaloCalibracion) : '',
            calibration_date:     t.fechaCalibracion     ?? '',
            certificate_number:   t.nroCertificado ?? '',
        };
    }
}
