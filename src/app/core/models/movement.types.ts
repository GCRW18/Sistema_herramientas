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
    | 'calibration_return'; // Retorno de calibración

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
    | 'decommission'      // Baja
    | 'lost';             // Perdido

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
 * Comprobante de movimiento
 */
export interface MovementVoucher {
    movement: Movement;
    generatedAt: string;
    generatedBy: User;
}
