/**
 * Warehouse Model
 * Estructura según tabla he.warehouses
 */
export interface Warehouse {
    id?: number; // Alias para id_warehouse - AGREGAR ESTA LÍNEA
    id_warehouse: number;
    code: string;
    name: string;
    description?: string;
    address?: string;
    responsible?: string;
    active: boolean;
    estado_reg?: string;
    created_at?: Date;
    updated_at?: Date;
    id_usuario_reg?: number;
    fecha_reg?: Date;
    id_usuario_mod?: number;
    fecha_mod?: Date;
    usr_reg?: string;
    usr_mod?: string;
}


/**
 * Location Model
 * Estructura según tabla he.locations
 */
export interface Location {
    id_location: number;
    warehouse_id: number;
    code: string;              // varchar(50)
    name: string;              // varchar(100)
    description?: string;      // varchar(255)
    level?: string;            // varchar(50)
    section?: string;          // varchar(50)
    active: boolean;
    estado_reg?: string;
    created_at?: Date;
    updated_at?: Date;
    id_usuario_reg?: number;
    fecha_reg?: Date;
    id_usuario_mod?: number;
    fecha_mod?: Date;
    usr_reg?: string;
    usr_mod?: string;
}
export interface Location {
    id?: number; // Alias para id_location - AGREGAR ESTA LÍNEA
    id_location: number;
    warehouse_id: number;
    code: string;
    name: string;
    description?: string;
    level?: string;
    section?: string;
    active: boolean;
    estado_reg?: string;
    created_at?: Date;
    updated_at?: Date;
    id_usuario_reg?: number;
    fecha_reg?: Date;
    id_usuario_mod?: number;
    fecha_mod?: Date;
    usr_reg?: string;
    usr_mod?: string;
}

