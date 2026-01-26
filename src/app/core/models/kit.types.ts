import { Tool } from './tool.types';
import { User } from './user.types';

/**
 * Estado del kit
 */
export type KitStatus =
    | 'complete'        // Completo - todos los componentes presentes
    | 'incomplete'      // Incompleto - faltan componentes
    | 'in_use'          // En uso - prestado
    | 'in_calibration'  // En calibración
    | 'decommissioned'; // Dado de baja

/**
 * Tipo de kit
 */
export type KitType =
    | 'MAINTENANCE'    // Mantenimiento
    | 'INSPECTION'     // Inspección
    | 'EMERGENCY'      // Emergencia
    | 'SPECIALIZED';   // Especializado

/**
 * Kit de herramientas
 */
export interface Kit {
    id: string;
    code: string; // KIT-001
    name: string; // Kit Motor CFM56
    description?: string;

    // Tipo y categoría
    kitType: KitType;
    category?: string;

    // Estado
    status: KitStatus;
    isComplete: boolean; // Calculado automáticamente

    // Completitud
    totalComponents: number;
    presentComponents: number;
    completenessPercentage: number; // 0-100

    // Ubicación
    warehouseId?: string;
    locationId?: string;
    location?: string; // Display text

    // Calibración
    requiresCalibration?: boolean;
    nextCalibrationDate?: string;

    // Componentes
    components?: KitComponent[];

    // Información adicional
    manufacturer?: string;
    model?: string;
    serialNumber?: string;

    // Imagen
    imageUrl?: string;

    // Notas
    notes?: string;

    // Préstamo actual
    currentLoanId?: string;

    // Auditoría
    active: boolean;
    createdAt: string;
    updatedAt: string;
    createdById?: string;
    createdBy?: User;
}

/**
 * Componente de un kit (anteriormente KitItem)
 */
export interface KitComponent {
    id: string;
    kitId: string;
    kit?: Kit;

    // Herramienta
    toolId: string;
    tool?: Tool;

    // Configuración
    quantity: number;          // Cantidad requerida
    isMandatory: boolean;      // Es obligatorio para el kit
    isPresent: boolean;        // Está presente actualmente
    presentQuantity: number;   // Cantidad actual presente

    // Información adicional
    position?: string;         // Posición en el kit
    notes?: string;

    // Auditoría
    createdAt: string;
    updatedAt: string;
}

/**
 * Verificación de kit
 */
export interface KitVerification {
    id: string;
    kitId: string;
    kit?: Kit;
    verificationDate: string;
    verifiedById: string;
    verifiedBy?: User;

    // Resultados
    isComplete: boolean;
    missingComponents: KitComponentStatus[];
    extraComponents: KitComponentStatus[];

    // Acciones tomadas
    actionsTaken?: string;
    notes?: string;

    createdAt: string;
}

/**
 * Estado de componente en verificación
 */
export interface KitComponentStatus {
    component: KitComponent;
    status: 'present' | 'missing' | 'damaged' | 'extra';
    quantityFound: number;
    quantityExpected: number;
    notes?: string;
}

/**
 * Préstamo de kit
 */
export interface KitLoan {
    id: string;
    kitId: string;
    kit?: Kit;

    // Tipo de préstamo
    loanType: 'complete' | 'partial';

    // Componentes prestados (si es parcial)
    loanedComponents?: KitLoanComponent[];

    // Fechas
    loanDate: string;
    expectedReturnDate: string;
    actualReturnDate?: string;

    // Responsable
    borrowerId: string;
    borrower?: User;
    borrowerName?: string;
    borrowerLicense?: string;

    // Estado
    status: 'active' | 'returned' | 'overdue';

    // Al retorno
    returnedById?: string;
    returnedBy?: User;
    returnCondition?: string;
    returnNotes?: string;

    // Notas
    purpose?: string;
    notes?: string;

    createdAt: string;
    updatedAt: string;
}

/**
 * Componente prestado en un préstamo de kit
 */
export interface KitLoanComponent {
    componentId: string;
    component?: KitComponent;
    quantityLoaned: number;
    quantityReturned?: number;
    condition?: string;
}

/**
 * Dashboard de kits
 */
export interface KitDashboard {
    totalKits: number;
    completeKits: number;
    incompleteKits: number;
    kitsInUse: number;

    kitsByType: KitTypeCount[];
    averageCompleteness: number;

    kitsWithMissingComponents: number;
    activeLoans: number;
    overdueLoans: number;
}

/**
 * Conteo de kits por tipo
 */
export interface KitTypeCount {
    type: KitType;
    typeName: string;
    count: number;
    completeCount: number;
    incompleteCount: number;
}

/**
 * Filtros para kits
 */
export interface KitFilters {
    status?: KitStatus[];
    kitType?: KitType[];
    isComplete?: boolean;
    warehouseId?: string;
    search?: string;
}

// Backwards compatibility
export type KitItem = KitComponent;
export interface KitCalibrationStatus {
    kit: Kit;
    toolsRequiringCalibration: number;
    toolsCalibrated: number;
    toolsExpired: number;
    nextExpirationDate?: string;
    isComplete: boolean;
}
