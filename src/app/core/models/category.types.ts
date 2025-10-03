/**
 * Categoría de herramientas
 */
export interface Category {
    id: string;
    code: string;
    name: string;
    description?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
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
