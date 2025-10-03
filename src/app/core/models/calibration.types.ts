import { Tool } from './tool.types';
import { User } from './user.types';

/**
 * Estado del proceso de calibración
 */
export type CalibrationStatus =
    | 'pending'    // Pendiente de envío
    | 'sent'       // Enviado
    | 'in_process' // En proceso
    | 'completed'  // Completado
    | 'rejected'   // Rechazado
    | 'cancelled'; // Cancelado

/**
 * Resultado de la calibración
 */
export type CalibrationResult =
    | 'approved'      // Aprobado
    | 'conditional'   // Condicional
    | 'rejected'      // Rechazado
    | 'not_applicable'; // No aplica

/**
 * Registro de calibración
 */
export interface CalibrationRecord {
    id: string;
    recordNumber: string; // Número de registro

    // Herramienta
    toolId: string;
    tool?: Tool;

    // Estado y resultado
    status: CalibrationStatus;
    result?: CalibrationResult;

    // Fechas
    requestDate: string;
    sentDate?: string;
    expectedReturnDate?: string;
    actualReturnDate?: string;
    calibrationDate?: string;
    nextCalibrationDate?: string;

    // Proveedor de calibración
    provider?: string;
    providerContact?: string;

    // Certificado
    certificateNumber?: string;
    certificateFile?: string;

    // Responsables
    requestedById: string;
    requestedBy?: User;
    receivedById?: string;
    receivedBy?: User;

    // Costos
    cost?: number;

    // Notas y observaciones
    notes?: string;
    observations?: string;

    // Documentos
    documents?: string[];

    createdAt: string;
    updatedAt: string;
}

/**
 * Registro de mantenimiento
 */
export interface MaintenanceRecord {
    id: string;
    recordNumber: string;

    // Herramienta
    toolId: string;
    tool?: Tool;

    // Tipo de mantenimiento
    type: 'preventive' | 'corrective' | 'emergency';

    // Estado
    status: CalibrationStatus; // Reutilizamos el mismo estado

    // Fechas
    requestDate: string;
    sentDate?: string;
    expectedReturnDate?: string;
    actualReturnDate?: string;

    // Proveedor de mantenimiento
    provider?: string;
    providerContact?: string;

    // Responsables
    requestedById: string;
    requestedBy?: User;
    receivedById?: string;
    receivedBy?: User;

    // Información del mantenimiento
    problem?: string;
    solution?: string;

    // Costos
    cost?: number;

    // Notas
    notes?: string;

    // Documentos
    documents?: string[];

    createdAt: string;
    updatedAt: string;
}

/**
 * Alerta de vencimiento de calibración
 */
export interface CalibrationAlert {
    toolId: string;
    tool: Tool;
    nextCalibrationDate: string;
    daysUntilExpiration: number;
    isExpired: boolean;
    severity: 'critical' | 'warning' | 'info';
}

// Alias for CalibrationRecord
export type Calibration = CalibrationRecord;
export type Maintenance = MaintenanceRecord;
