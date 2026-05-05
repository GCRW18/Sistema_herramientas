export type ToolEstado = 'NUEVO' | 'USADO' | 'EN_REPARACION' | 'BAJA';

export interface Herramienta {
    id: number;
    codigo:        string;
    pn:            string;
    sn?:           string;
    descripcion:   string;
    categoria:     'general' | 'consumible' | 'miscelaneo';
    cantidad:      number;
    unidad:        string;
    estado:        ToolEstado;

    warehouseId?:  number;
    rackId?:       number;
    levelId?:      number;
    ubicacionLabel?: string;

    sujetaCalibracion: boolean;
    calibracion?: {
        frecuenciaMeses:    number;
        ultimaCalibracion?: string;
        proximaCalibracion?: string;
        proveedor?:         string;
        certificado?:       string;
    };

    consumible?: {
        stockMinimo: number;
        stockActual: number;
        unidadConsumo: string;
    };

    miscelaneo?: {
        notas?: string;
    };

    fechaRegistro: string;
}
