import { User } from './user.types';
import { Tool } from './tool.types';

/**
 * Estado del pedido
 */
export type OrderStatus =
    | 'pending'       // Pendiente
    | 'approved'      // Aprobado
    | 'in_progress'   // En proceso
    | 'partially_received' // Parcialmente recibido
    | 'completed'     // Completado
    | 'cancelled'     // Cancelado
    | 'rejected';     // Rechazado

/**
 * Prioridad del pedido
 */
export type OrderPriority =
    | 'low'      // Baja
    | 'normal'   // Normal
    | 'high'     // Alta
    | 'urgent';  // Urgente

/**
 * Tipo de pedido
 */
export type OrderType =
    | 'purchase'      // Compra nueva
    | 'replacement'   // Reemplazo
    | 'maintenance'   // Mantenimiento
    | 'calibration'   // Calibración
    | 'stock';        // Reposición de stock

/**
 * Item de pedido
 */
export interface OrderItem {
    id: string;
    orderId: string;

    // Herramienta solicitada
    toolId?: string;
    tool?: Tool;

    // Información del artículo (si no existe en inventario)
    itemName: string;
    itemDescription?: string;
    partNumber?: string;
    manufacturer?: string;

    // Cantidades
    quantityRequested: number;
    quantityApproved?: number;
    quantityReceived: number;

    // Unidad de medida
    unit: string; // ej: 'pcs', 'kg', 'box', etc.

    // Precios
    estimatedUnitPrice?: number;
    actualUnitPrice?: number;
    totalPrice?: number;

    // Especificaciones
    specifications?: string;
    technicalRequirements?: string;

    // Información adicional
    notes?: string;

    // Metadata
    createdAt: string;
    updatedAt: string;
}

/**
 * Pedido
 */
export interface Order {
    id: string;
    orderNumber: string; // Número de pedido único (ej: ORD-2024-001)

    // Tipo y estado
    type: OrderType;
    status: OrderStatus;
    priority: OrderPriority;

    // Solicitante
    requestedById: string;
    requestedBy?: User;
    requestedByName?: string;

    // Departamento/Área
    department?: string;
    costCenter?: string;

    // Fechas
    requestDate: string;
    requiredDate?: string; // Fecha requerida
    approvalDate?: string;
    estimatedDeliveryDate?: string;
    actualDeliveryDate?: string;

    // Aprobación
    approvedById?: string;
    approvedBy?: User;
    approvedByName?: string;
    approvalNotes?: string;

    // Proveedor
    supplierId?: string;
    supplierName?: string;
    supplierContact?: string;

    // Items del pedido
    items: OrderItem[];

    // Totales
    totalItems: number;
    totalEstimatedCost?: number;
    totalActualCost?: number;
    currency: string; // ej: 'USD', 'BOB'

    // Justificación
    justification?: string;
    purpose?: string;

    // Información de seguimiento
    trackingNumber?: string;
    shippingMethod?: string;

    // Documentos
    attachments?: string[]; // URLs de documentos adjuntos

    // Notas
    notes?: string;
    internalNotes?: string;
    cancellationReason?: string;
    rejectionReason?: string;

    // Metadata
    createdAt: string;
    updatedAt: string;
    createdBy?: User;
}

/**
 * Filtros para búsqueda de pedidos
 */
export interface OrderFilters {
    search?: string;
    status?: OrderStatus;
    type?: OrderType;
    priority?: OrderPriority;
    requestedById?: string;
    approvedById?: string;
    supplierId?: string;
    department?: string;
    dateFrom?: string;
    dateTo?: string;
}

/**
 * Estadísticas de pedidos
 */
export interface OrderStats {
    totalOrders: number;
    pendingOrders: number;
    approvedOrders: number;
    inProgressOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    urgentOrders: number;
    totalEstimatedValue: number;
    totalActualValue: number;
}

/**
 * Formulario para crear pedido
 */
export interface OrderCreateForm {
    type: OrderType;
    priority: OrderPriority;
    department?: string;
    costCenter?: string;
    requiredDate?: string;
    supplierId?: string;
    justification?: string;
    purpose?: string;
    items: OrderItemForm[];
    notes?: string;
}

/**
 * Formulario para item de pedido
 */
export interface OrderItemForm {
    toolId?: string;
    itemName: string;
    itemDescription?: string;
    partNumber?: string;
    manufacturer?: string;
    quantityRequested: number;
    unit: string;
    estimatedUnitPrice?: number;
    specifications?: string;
    technicalRequirements?: string;
    notes?: string;
}

/**
 * Formulario para aprobar pedido
 */
export interface OrderApprovalForm {
    orderId: string;
    approved: boolean;
    approvalNotes?: string;
    items?: OrderItemApprovalForm[];
}

/**
 * Aprobación de item individual
 */
export interface OrderItemApprovalForm {
    itemId: string;
    quantityApproved: number;
}

/**
 * Formulario para recibir pedido
 */
export interface OrderReceiveForm {
    orderId: string;
    actualDeliveryDate: string;
    trackingNumber?: string;
    items: OrderItemReceiveForm[];
    notes?: string;
}

/**
 * Recepción de item individual
 */
export interface OrderItemReceiveForm {
    itemId: string;
    quantityReceived: number;
    actualUnitPrice?: number;
    notes?: string;
}

/**
 * Historial de cambios de pedido
 */
export interface OrderHistory {
    id: string;
    orderId: string;
    action: 'created' | 'updated' | 'approved' | 'rejected' | 'received' | 'cancelled';
    actionDate: string;
    performedById: string;
    performedBy?: User;
    previousStatus?: OrderStatus;
    newStatus?: OrderStatus;
    notes?: string;
    changes?: Record<string, any>;
}

/**
 * Resumen de pedido
 */
export interface OrderSummary {
    orderId: string;
    orderNumber: string;
    type: OrderType;
    status: OrderStatus;
    priority: OrderPriority;
    requestDate: string;
    totalItems: number;
    totalCost: number;
    requestedBy: string;
}
