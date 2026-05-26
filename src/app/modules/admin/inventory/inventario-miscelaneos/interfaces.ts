export interface Material {
    id: number;
    codigoBoaM: string;
    producto: string;
    tipoItem: string;
    tipoCompra: string;
    marca: string;
    pn: string;
    unidad: string;
    stock: number;
    stockMin: number;
    stockMax: number;
    ubicacion: string;
    activo: boolean;
    recibidoPor: string;
    fecha: string;
    hora: string;
    observacion?: string;
}

export interface Entrada {
    id: number;
    miscelaneo_id: number;
    nroNota: string;
    fecha: string;
    hora: string;
    recibidoPor: string;
    codigoNombre: string;
    producto: string;
    cantidad: number;
    unidad: string;
    pn?: string;
    stock?: string;
    marca?: string;
    factura?: string;
    observacion?: string;
}

export interface Salida {
    id: number;
    miscelaneo_id: number;
    nroNota: string;
    fecha: string;
    hora: string;
    nroLicencia: string;
    nro: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    nombre: string;
    area: string;
    despachadoPor: string;
    codigoNombre: string;
    producto: string;
    unidad: string;
    cantidad: number;
    stock?: string;
    ordenTrabajo?: string;
    observaciones?: string;
    buscadorAeronave?: string;
    buscadorAutorizado?: string;
}

export type TabMisc    = 'catalogo' | 'entradas' | 'salidas' | 'stock';
export type DialogMode = 'new' | 'edit' | 'view';

export interface UbicacionRef {
    almacenId:     number;
    almacenNombre: string;
    estandeId:     number;
    estanteNombre: string;
    nivelId:       number;
    nivelNombre:   string;
    etiqueta:      string;
}
