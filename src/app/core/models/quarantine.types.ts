import { Tool } from './tool.types';
import { User } from './user.types';

/**
 * Razón de cuarentena
 */
export type QuarantineReason =
    | 'quality_issue'      // Problema de calidad
    | 'calibration_failed' // Falló calibración
    | 'damage_suspected'   // Daño sospechado
    | 'investigation'      // Investigación
    | 'contamination'      // Contaminación
    | 'other';             // Otro

/**
 * Estado de cuarentena
 */
export type QuarantineStatus =
    | 'active'     // Activa
    | 'resolved'   // Resuelta
    | 'cancelled'; // Cancelada

/**
 * Registro de cuarentena
 */
export interface QuarantineRecord {
    id: string;
    recordNumber: string;

    // Herramienta
    toolId: string;
    tool?: Tool;

    // Estado y razón
    status: QuarantineStatus;
    reason: QuarantineReason;
    reasonDescription?: string;

    // Fechas
    startDate: string;
    expectedResolutionDate?: string;
    resolutionDate?: string;

    // Responsables
    reportedById: string;
    reportedBy?: User;
    resolvedById?: string;
    resolvedBy?: User;

    // Resolución
    resolution?: string;
    actionTaken?: string;

    // Notas
    notes?: string;

    // Documentos
    documents?: string[];

    createdAt: string;
    updatedAt: string;
}

/**
 * Razón de baja
 */
export type DecommissionReason =
    | 'obsolete'       // Obsoleto
    | 'beyond_repair'  // No reparable
    | 'lost'           // Perdido
    | 'stolen'         // Robado
    | 'end_of_life'    // Fin de vida útil
    | 'other';         // Otro

/**
 * Registro de baja
 */
export interface DecommissionRecord {
    id: string;
    recordNumber: string;

    // Herramienta
    toolId: string;
    tool?: Tool;

    // Razón
    reason: DecommissionReason;
    reasonDescription?: string;

    // Fechas
    decommissionDate: string;

    // Responsables
    authorizedById: string;
    authorizedBy?: User;

    // Información de disposición
    disposalMethod?: string;
    disposalDate?: string;
    disposalCost?: number;

    // Valor
    originalValue?: number;
    residualValue?: number;

    // Notas
    notes?: string;

    // Documentos
    documents?: string[];

    createdAt: string;
    updatedAt: string;
}
