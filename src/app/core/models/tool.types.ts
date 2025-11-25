import { Category, Subcategory } from './category.types';
import { Location, Warehouse } from './warehouse.types';

/**
 * Estado de la herramienta
 */
export type ToolStatus =
    | 'available'      // Disponible
    | 'in_use'         // En uso
    | 'in_calibration' // En calibración
    | 'in_maintenance' // En mantenimiento
    | 'quarantine'     // En cuarentena
    | 'decommissioned' // Dado de baja
    | 'lost';          // Perdido

/**
 * Condición física de la herramienta
 */
export type ToolCondition =
    | 'new'       // Nuevo
    | 'excellent' // Excelente
    | 'good'      // Bueno
    | 'fair'      // Regular
    | 'poor'      // Malo
    | 'damaged';  // Dañado

/**
 * Herramienta
 */
export interface Tool {
    id: string;
    code: string; // Código único de la herramienta
    name: string;
    description?: string;

    // Categorización
    categoryId: string;
    category?: Category;
    categoryName?: string; // Added for flat representation
    subcategoryId?: string;
    subcategory?: Subcategory;
    subcategoryName?: string; // Added for flat representation

    // Especificaciones
    brand?: string;
    model?: string;
    serialNumber?: string;
    partNumber?: string;

    // Campos Aeronáuticos
    aircraft?: string; // Matrícula de la aeronave
    workOrderNumber?: string; // Número de orden de trabajo
    technician?: string; // Técnico responsable
    department?: string; // Departamento o área

    // Ubicación
    warehouseId: string;
    warehouse?: Warehouse;
    warehouseName?: string; // Added for flat representation
    locationId?: string;
    location?: Location;
    locationName?: string; // Added for flat representation

    // Estado y condición
    status: ToolStatus;
    condition: ToolCondition;

    // Calibración
    requiresCalibration: boolean;
    calibrationInterval?: number; // Días
    lastCalibrationDate?: string;
    nextCalibrationDate?: string;
    calibrationCertificate?: string;

    // Información adicional
    purchaseDate?: string;
    purchasePrice?: number;
    supplier?: string;
    warranty?: string;
    warrantyExpiration?: string;

    // Imágenes y documentos
    images?: string[];
    documents?: string[];

    // Notas
    notes?: string;

    active: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * Filtros para búsqueda de herramientas
 */
export interface ToolFilters {
    search?: string;
    query?: string; // ← AGREGAR ESTA LÍNEA
    categoryId?: string;
    subcategoryId?: string;
    warehouseId?: string;
    locationId?: string;
    status?: ToolStatus;
    condition?: ToolCondition;
    requiresCalibration?: boolean;
    calibrationExpired?: boolean;
}

