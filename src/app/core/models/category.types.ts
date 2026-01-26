/**
 * Categoría de herramientas - Sistema Aeronáutico
 */
export interface Category {
    id?: string;
    id_category?: number; // Campo del backend
    code: string;
    name: string;
    description?: string;

    // Campos aeronáuticos y visuales
    color?: string; // Color para identificación visual (hex: #FF5733)
    icon?: string; // Icono Material (ej: 'build', 'settings')
    order?: number; // Orden de visualización
    is_fixed?: boolean; // Indica si es una categoría fija (Misceláneos, Herramientas)

    // Estado y fechas
    active: boolean;
    estado_reg?: string; // Estado del registro en backend ('activo', 'inactivo')

    // Relaciones
    parent_category_id?: number; // ID de categoría padre (para futuras subcategorías)
    nivel?: number; // Nivel jerárquico (0 = raíz)
    tiene_hijos?: boolean; // Indica si tiene subcategorías
    cantidad_herramientas?: number; // Cantidad de herramientas asignadas

    // Auditoría
    createdAt?: string;
    updatedAt?: string;
    created_by?: string;
    updated_by?: string;
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
