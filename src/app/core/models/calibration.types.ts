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
 * Nivel de urgencia PXP (del backend v3)
 */
export type AlertUrgency =
    | 'EXPIRED'       // Vencida
    | 'CRITICAL_7D'   // Crítico - 7 días
    | 'URGENT_15D'    // Urgente - 15 días
    | 'UPCOMING_30D'  // Próxima - 30 días
    | 'VALID'         // Vigente
    | 'IN_LAB';       // En laboratorio

/**
 * Estado de lote de calibración
 * @deprecated Usar CalibrationBatchStatus de calibration-batch.types.ts
 */
export type BatchStatus =
    | 'open'        // Abierto para escaneo
    | 'confirmed'   // Confirmado
    | 'sent'        // Enviado a laboratorio
    | 'in_process'  // En proceso en laboratorio
    | 'completed'   // Completado
    | 'cancelled';  // Cancelado

/**
 * Tipo de servicio para Gatas (Jacks)
 */
export type JackServiceType = 'semiannual' | 'annual' | 'both';

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

// =========================================================================
// PXP BACKEND v3 - Interfaces para respuestas del backend
// =========================================================================

/**
 * Resultado de escaneo de herramienta (PXP: HE_CLS_SCAN)
 */
export interface ScanToolResult {
    id_tool: number;
    code: string;
    name: string;
    serial_number: string;
    part_number: string;
    status: string;
    requires_calibration: boolean;
    calibration_interval: number;
    last_calibration_date: string | null;
    next_calibration_date: string | null;
    is_jack: boolean;
    // Servicios de gata (solo si is_jack = true)
    last_semiannual_service: string | null;
    next_semiannual_service: string | null;
    semiannual_service_interval: number | null;
    last_annual_service: string | null;
    next_annual_service: string | null;
    annual_service_interval: number | null;
    // Advertencia de estado
    scan_warning: string | null;
}

// CalibrationBatch y CalibrationBatchItem se definen en calibration-batch.types.ts
// (version canonica con todos los campos del backend PXP incluyendo Jack/Gata)

/**
 * Alerta de calibración PXP (HE_CLS_ALERTS)
 */
export interface PxpCalibrationAlert {
    id_tool: number;
    code: string;
    name: string;
    serial_number: string;
    part_number: string;
    status: string;
    is_jack: boolean;
    category_name: string | null;
    warehouse_name: string | null;
    base_name: string | null;
    // Calibración
    last_calibration_date: string | null;
    next_calibration_date: string | null;
    calibration_interval: number | null;
    cal_days_remaining: number | null;
    cal_urgency: AlertUrgency;
    // Servicio semestral (solo gatas)
    last_semiannual_service: string | null;
    next_semiannual_service: string | null;
    semi_days_remaining: number | null;
    semi_urgency: AlertUrgency | null;
    // Servicio anual (solo gatas)
    last_annual_service: string | null;
    next_annual_service: string | null;
    annual_days_remaining: number | null;
    annual_urgency: AlertUrgency | null;
    // Laboratorio
    laboratory_name: string | null;
}

/**
 * Dashboard de calibración PXP (HE_CLS_DASH) - 14 métricas
 */
export interface PxpCalibrationDashboard {
    // Métricas generales
    cal_valid: number;
    cal_expiring_30d: number;
    cal_expiring_7d: number;
    cal_expired: number;
    cal_in_lab: number;
    total_calibratable: number;
    // Métricas de Gatas - Semestral
    jacks_semi_expired: number;
    jacks_semi_expiring_30d: number;
    // Métricas de Gatas - Anual
    jacks_annual_expired: number;
    jacks_annual_expiring_30d: number;
    // Totales gatas
    total_jacks: number;
    // Lotes
    open_batches: number;
    // Calibraciones activas
    active_calibrations: number;
    overdue_calibrations: number;
}

/**
 * Estado de servicios de una Gata (PXP: HE_CLS_JACK_SEL)
 */
export interface JackServiceStatus {
    id_tool: number;
    code: string;
    name: string;
    serial_number: string;
    status: string;
    // Calibración
    last_calibration_date: string | null;
    next_calibration_date: string | null;
    cal_days_remaining: number | null;
    cal_status: string; // VIGENTE, POR_VENCER, VENCIDO, SIN_FECHA
    // Servicio semestral
    last_semiannual_service: string | null;
    next_semiannual_service: string | null;
    semi_days_remaining: number | null;
    semi_status: string;
    // Servicio anual
    last_annual_service: string | null;
    next_annual_service: string | null;
    annual_days_remaining: number | null;
    annual_status: string;
    // Metadata
    category_name: string | null;
    warehouse_name: string | null;
    base_name: string | null;
}

/**
 * Mapa de colores para niveles de urgencia
 */
export const URGENCY_COLORS: Record<AlertUrgency, string> = {
    EXPIRED: '#ef4444',      // Rojo
    CRITICAL_7D: '#dc2626',  // Rojo oscuro
    URGENT_15D: '#f97316',   // Naranja
    UPCOMING_30D: '#eab308', // Amarillo
    VALID: '#22c55e',        // Verde
    IN_LAB: '#8b5cf6'        // Púrpura
};

/**
 * Mapa de labels para niveles de urgencia
 */
export const URGENCY_LABELS: Record<AlertUrgency, string> = {
    EXPIRED: 'Vencida',
    CRITICAL_7D: 'Crítico (7 días)',
    URGENT_15D: 'Urgente (15 días)',
    UPCOMING_30D: 'Próxima (30 días)',
    VALID: 'Vigente',
    IN_LAB: 'En Laboratorio'
};

// Alias for CalibrationRecord
export type Calibration = CalibrationRecord;
