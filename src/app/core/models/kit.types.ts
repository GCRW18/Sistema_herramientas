import { Tool } from './tool.types';

/**
 * Estado del kit
 */
export type KitStatus =
    | 'available'      // Disponible
    | 'in_use'         // En uso
    | 'incomplete'     // Incompleto
    | 'in_calibration' // En calibración
    | 'in_maintenance' // En mantenimiento
    | 'inactive';      // Inactivo

/**
 * Kit de herramientas
 */
export interface Kit {
    id: string;
    code: string;
    name: string;
    description?: string;

    // Estado
    status: KitStatus;

    // Calibración del kit
    requiresCalibration: boolean;
    lastCalibrationDate?: string;
    nextCalibrationDate?: string;

    // Herramientas del kit
    items: KitItem[];

    // Información adicional
    notes?: string;
    images?: string[];

    active: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * Item de un kit
 */
export interface KitItem {
    id: string;
    kitId: string;
    toolId: string;
    tool?: Tool;
    quantity: number;
    required: boolean; // Si es obligatorio en el kit
    notes?: string;
}

/**
 * Estado de calibración del kit
 */
export interface KitCalibrationStatus {
    kit: Kit;
    toolsRequiringCalibration: number;
    toolsCalibrated: number;
    toolsExpired: number;
    nextExpirationDate?: string;
    isComplete: boolean;
}
