import { Tool } from './tool.types';
import { User } from './user.types';
import { Warehouse } from './warehouse.types';

/**
 * Tipo de movimiento
 */
export type MovementType =
    | 'entry'     // Entrada
    | 'exit'      // Salida
    | 'transfer'  // Traspaso
    | 'loan'      // Préstamo
    | 'return'    // Devolución
    | 'adjustment'; // Ajuste

/**
 * Razón del movimiento de entrada
 */
export type EntryReason =
    | 'purchase'           // Compra
    | 'return'             // Devolución
    | 'adjustment'         // Ajuste
    | 'donation'           // Donación
    | 'calibration_return' // Retorno de calibración
    | 'base_return'        // Retorno de base operativa
    | 'third_party_return'; // Retorno de terceros

/**
 * Razón del movimiento de salida
 */
export type ExitReason =
    | 'loan'              // Préstamo
    | 'transfer'          // Traspaso
    | 'sale'              // Venta
    | 'adjustment'        // Ajuste
    | 'donation'          // Donación
    | 'calibration_send'  // Envío a calibración
    | 'maintenance_send'  // Envío a mantenimiento
    | 'base_send'         // Envío a base operativa
    | 'third_party_send'  // Envío a terceros
    | 'decommission'      // Baja
    | 'lost'              // Perdido
    | 'quarantine'        // Cuarentena
    | 'consumption';      // Consumo

/**
 * Estado del movimiento
 */
export type MovementStatus =
    | 'pending'    // Pendiente
    | 'approved'   // Aprobado
    | 'completed'  // Completado
    | 'cancelled'; // Cancelado

/**
 * Movimiento de herramienta
 */
export interface Movement {
    id: string;
    movementNumber: string; // Número de comprobante
    type: MovementType;
    status: MovementStatus;

    // Fechas
    date: string;
    effectiveDate?: string;

    // Origen y destino
    sourceWarehouseId?: string;
    sourceWarehouse?: Warehouse;
    destinationWarehouseId?: string;
    destinationWarehouse?: Warehouse;

    // Razón del movimiento
    entryReason?: EntryReason;
    exitReason?: ExitReason;

    // Responsables
    requestedById: string;
    requestedBy?: User;
    approvedById?: string;
    approvedBy?: User;
    receivedById?: string;
    receivedBy?: User;
    responsiblePerson?: string; // Persona responsable del movimiento

    // Campos Aeronáuticos
    aircraft?: string; // Matrícula de la aeronave
    workOrderNumber?: string; // Número de orden de trabajo
    technician?: string; // Técnico responsable
    authorizedBy?: string; // Persona que autoriza
    department?: string; // Departamento o área

    // Información adicional
    supplier?: string;
    customer?: string;
    recipient?: string; // Destinatario (para préstamos)
    expectedReturnDate?: string; // Para préstamos
    calibrationProvider?: string; // Proveedor de calibración
    maintenanceType?: string; // Tipo de mantenimiento

    // Notas
    notes?: string;

    // Items del movimiento
    items: MovementItem[];

    // Documentos
    documents?: string[];

    createdAt: string;
    updatedAt: string;
}

/**
 * Item de un movimiento
 */
export interface MovementItem {
    id: string;
    movementId: string;
    toolId: string;
    tool?: Tool;
    quantity: number;
    notes?: string;
}

/**
 * Item para crear un movimiento (sin id ni movementId que se generan en backend)
 */
export interface CreateMovementItem {
    toolId?: string;
    toolCode?: string;
    codigo?: string;
    descripcion?: string;
    modeloPn?: string;
    serialNumber?: string;
    quantity?: number;
    cantidad?: number;
    notes?: string;
    certificado?: string;
    nroNotaSalida?: string;
}

/**
 * Datos para crear un nuevo movimiento
 */
export interface CreateMovement {
    type: MovementType;
    entryReason?: EntryReason;
    exitReason?: ExitReason;
    date?: string;
    notes?: string;
    calibrationProvider?: string;
    supplier?: string;
    recipient?: string;
    sourceWarehouseId?: string;
    destinationWarehouseId?: string;
    items: CreateMovementItem[];
    [key: string]: any; // Permitir propiedades adicionales
}

/**
 * Comprobante de movimiento
 */
export interface MovementVoucher {
    movement: Movement;
    generatedAt: string;
    generatedBy: User;
}
