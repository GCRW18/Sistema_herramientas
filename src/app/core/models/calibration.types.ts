import { Tool } from './tool.types';
import { User } from './user.types';

/**
 * Estado del proceso de calibración
 */
export type CalibrationStatus =
    | 'pending'     // Pendiente de envío
    | 'sent'        // Enviado a laboratorio
    | 'in_transit'  // En tránsito
    | 'in_process'  // En proceso de calibración
    | 'completed'   // Completado y aprobado
    | 'returned'    // Retornado al almacén
    | 'rejected'    // Rechazado
    | 'cancelled';  // Cancelado

/**
 * Resultado de la calibración
 */
export type CalibrationResult =
    | 'approved'      // Aprobado - dentro de tolerancia
    | 'conditional'   // Condicional - requiere seguimiento
    | 'rejected'      // Rechazado - fuera de tolerancia
    | 'not_applicable' // No aplica
    | null;

/**
 * Severidad de alerta de calibración
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Tipo de calibración
 */
export type CalibrationType =
    | 'initial'     // Calibración inicial
    | 'periodic'    // Calibración periódica
    | 'extraordinary' // Calibración extraordinaria
    | 'verification'; // Verificación

/**
 * Tipo de trabajo solicitado
 */
export type WorkRequestType =
    | 'calibration'  // Calibración
    | 'repair';      // Reparación

/**
 * Estado físico de la herramienta después de calibración
 */
export type PhysicalCondition =
    | 'R'  // Reparable
    | 'M'  // Malo
    | 'T'  // ?
    | 'S'; // Serviciable

/**
 * Laboratorio de calibración
 */
export interface CalibrationLaboratory {
    id: string;
    code: string;
    name: string;
    address?: string;
    city?: string;
    country?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    website?: string;

    // Certificaciones
    isCertified: boolean;
    certificationNumber?: string; // ISO 17025, etc.
    certificationTypes?: string[]; // Tipos de calibración que realiza

    // Evaluación
    rating?: number; // 0-5
    averageDeliveryDays?: number;

    active: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * Registro de calibración completo
 */
export interface CalibrationRecord {
    id: string;
    recordNumber: string; // Número correlativo (CAL-2025-001)

    // Herramienta
    toolId: string;
    tool?: Tool;

    // Tipo y estado
    type: CalibrationType;
    workType?: WorkRequestType; // Tipo de trabajo: calibración o reparación
    status: CalibrationStatus;
    result?: CalibrationResult;

    // Base de origen
    base?: string; // CBB, LPB, SCZ, etc.

    // Fechas del proceso
    requestDate: string;          // Fecha de solicitud
    sentDate?: string;            // Fecha de envío al laboratorio
    expectedReturnDate?: string;  // Fecha estimada de retorno
    actualReturnDate?: string;    // Fecha real de retorno
    calibrationDate?: string;     // Fecha de calibración realizada
    nextCalibrationDate?: string; // Próxima calibración calculada

    // Laboratorio/Proveedor
    supplierId?: string;
    supplier?: CalibrationLaboratory;
    providerContact?: string;

    // Certificado de calibración
    certificateNumber?: string;
    certificateDate?: string;
    certificateFile?: string; // URL del archivo PDF

    // Detalles técnicos
    calibrationStandard?: string;  // Norma aplicada (ISO, ASTM, etc.)
    toleranceAccepted?: boolean;   // Dentro de tolerancia
    toleranceValue?: string;       // Valor de tolerancia
    measurementUncertainty?: string; // Incertidumbre de medición

    // Estado físico después de calibración
    physicalCondition?: PhysicalCondition;
    calibrationPerformed?: boolean; // Confirmación SI/NO de calibración realizada

    // Técnico calibrador
    technicianCalibrator?: string;

    // Responsables internos
    requestedById: string;
    requestedBy?: User;
    deliveredById?: string;  // Técnico de almacén que entrega
    deliveredBy?: User;
    receivedById?: string;
    receivedBy?: User;
    approvedById?: string;
    approvedBy?: User;

    // Costos
    cost?: number;
    currency?: string; // BOB, USD, etc.

    // Notas y observaciones
    notes?: string;
    observations?: string;
    internalNotes?: string;

    // Documentos adjuntos
    documents?: CalibrationDocument[];

    // Auditoría
    createdAt: string;
    updatedAt: string;
    createdById?: string;
    updatedById?: string;
}

/**
 * Documento adjunto de calibración
 */
export interface CalibrationDocument {
    id: string;
    fileName: string;
    fileType: string; // pdf, jpg, png, etc.
    fileSize: number; // en bytes
    fileUrl: string;
    uploadedAt: string;
    uploadedById: string;
    uploadedBy?: User;
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
    id: string;
    toolId: string;
    tool?: Tool;

    // Fechas
    lastCalibrationDate?: string;
    nextCalibrationDate: string;

    // Cálculos
    daysUntilExpiration: number;
    isExpired: boolean;
    severity: AlertSeverity;

    // Info adicional
    calibrationInterval?: number; // días
    lastCertificateNumber?: string;

    // Notificación
    notificationSent?: boolean;
    notificationDate?: string;
}

/**
 * Dashboard de calibración - KPIs
 */
export interface CalibrationDashboard {
    // Totales
    totalToolsRequiringCalibration: number;
    toolsInCalibration: number;

    // Por estado de calibración
    calibrationsValid: number;      // Vigentes
    calibrationsExpiringSoon: number; // Por vencer (30 días)
    calibrationsExpired: number;    // Vencidas

    // Por estado del proceso
    calibrationsPending: number;    // Pendientes de envío
    calibrationsSent: number;       // Enviadas
    calibrationsInProcess: number;  // En proceso
    calibrationsReturned: number;   // Retornadas este mes

    // Resultados
    calibrationsApproved: number;
    calibrationsRejected: number;
    calibrationsConditional: number;

    // Costos
    totalCostThisMonth: number;
    totalCostThisYear: number;
    averageCostPerCalibration: number;

    // Tiempos promedio
    averageDaysInLaboratory: number;

    // Tendencias
    calibrationsByMonth: CalibrationTrend[];
    costsByMonth: CalibrationCostTrend[];
}

/**
 * Tendencia de calibraciones por mes
 */
export interface CalibrationTrend {
    month: string; // YYYY-MM
    monthName: string; // Enero, Febrero, etc.
    total: number;
    approved: number;
    rejected: number;
    conditional: number;
}

/**
 * Tendencia de costos de calibración
 */
export interface CalibrationCostTrend {
    month: string;
    monthName: string;
    totalCost: number;
    count: number;
    averageCost: number;
}

/**
 * Filtros para listado de calibraciones
 */
export interface CalibrationFilters {
    status?: CalibrationStatus[];
    result?: CalibrationResult[];
    supplierId?: string;
    dateFrom?: string;
    dateTo?: string;
    toolId?: string;
    search?: string;
}

/**
 * Reporte MGH-102: Herramientas sujetas a calibración
 */
export interface CalibrationReportMGH102 {
    tools: CalibrationReportTool[];
    generatedAt: string;
    generatedBy: User;
    filters: {
        status?: string;
        includeExpired?: boolean;
    };
}

/**
 * Herramienta para reporte de calibración
 */
export interface CalibrationReportTool {
    toolCode: string;
    toolName: string;
    partNumber?: string;
    serialNumber?: string;
    category?: string;
    location?: string;

    requiresCalibration: boolean;
    calibrationInterval: number; // días

    lastCalibrationDate?: string;
    lastCertificateNumber?: string;

    nextCalibrationDate?: string;
    daysUntilExpiration?: number;

    status: 'VIGENTE' | 'POR VENCER' | 'VENCIDA' | 'NO APLICA';
    statusColor: 'green' | 'yellow' | 'red' | 'gray';
}

// Alias for CalibrationRecord
export type Calibration = CalibrationRecord;
