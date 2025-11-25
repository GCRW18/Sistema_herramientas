/**
 * Categoría de herramientas
 */
export interface Category {
    id?: string;
    id_category?: number; // Campo del backend - AGREGAR ESTA LÍNEA
    code: string;
    name: string;
    description?: string;
    active: boolean;
    createdAt?: string;
    updatedAt?: string;
}


/**
 * Subcategoría de herramientas
 */
export interface Subcategory {
    id: string;
    categoryId: string;
    category?: Category;
    code: string;
    name: string;
    description?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}
