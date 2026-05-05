export type AlmacenTipo   = 'Principal' | 'Secundario' | 'Técnico' | 'Herramientas';
export type AlmacenEstado = 'ACTIVO' | 'INACTIVO';

export interface Ciudad {
    id_ciudad: number;
    nombre:    string;
}

export interface Oficina {
    id_oficina:     number;
    nombre_oficina: string;
}

export interface Warehouse {
    id:            number;
    id_base:       number;
    codigo:        string;
    nombre:        string;
    ciudad:        string;
    id_oficina:    number | null;
    nombreOficina: string;
    tipo:          AlmacenTipo;
    estado:        AlmacenEstado;
    descripcion?:  string;
    estantesCount?: number;
    nivelesCount?:  number;
}

export interface Rack {
    id: number;
    warehouseId: number;
    codigo: string;
    nombre: string;
    descripcion?: string;
    activo: boolean;
    niveles: Level[];
}

export interface Level {
    id:          number;
    rackId:      number;
    numero:      number | null;
    codigo:      string;
    nombre:      string;
    descripcion?: string;
    activo:      boolean;
    isFloor:     boolean;
    tools?:      LevelTool[];
}

export type ToolEstado = 'NUEVO' | 'REACONDICIONADO' | 'USADO';

export interface LevelTool {
    id:             number;
    levelId:        number;
    rackId:         number;
    rackCodigo:     string;
    levelNumero:    number | null;
    levelCodigo:    string;
    codigo:         string;
    pn:             string;
    sn?:            string;
    nombre:         string;
    marca?:         string;
    estado:         ToolEstado;
    cantidad:       number;
    um:             string;
    imagenBase64?:  string;
    observaciones?: string;
}
