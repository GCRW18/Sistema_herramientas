/**
 * Almacén
 */
export interface Warehouse {
    id: string;
    code: string;
    name: string;
    description?: string;
    address?: string;
    responsible?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * Ubicación dentro de un almacén
 */
export interface Location {
    id: string;
    warehouseId: string;
    warehouse?: Warehouse;
    code: string;
    name: string;
    description?: string;
    level?: string; // Nivel, pasillo, estante, etc.
    section?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}
