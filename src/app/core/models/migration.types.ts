// =========================================================================
// Migration Types - Migracion desde Excel
// =========================================================================

export interface ProductoExcel {
    id_data: number;
    cod_he: string;
    nombre: string;
    part_numbert: string;
    serial_numbert: string;
    cod_boa_af: string;
    marca: string;
    tipo: string;
    subtipo: string;
    lista_contenido: string;
    requiere_calibracion: string;
    intervalo_calibracion: string;
    fecha_vencimiento: string;
    precio_unitario: string;
    precio_venta: string;
    usuario: string;
    ubicacion: string;
    nivel: string;
    fabricacion: string;
    observaciones: string;
    migrado: MigrationStatus;
    validation_status: 'valido' | 'error' | 'duplicado';
    validation_errors: string | null;
}

export type MigrationStatus = 'no' | 'si' | 'obs' | 'err';

export interface HerramientaObservado {
    codigo_he: string;
    nombre: string;
    part_numbert: string;
    serial_numbert: string;
}

export interface MigrationSummary {
    total_registros: number;
    total_migrados: number;
    total_pendientes: number;
    total_observados: number;
    total_con_calibracion: number;
    total_sin_codigo: number;
    porcentaje_avance: number;
}

export interface MigrationResult {
    total_migrados: number;
    total_errores: number;
    mensaje: string;
}

export interface ValidationResult {
    total_validados: number;
    total_errores: number;
    mensaje: string;
}
