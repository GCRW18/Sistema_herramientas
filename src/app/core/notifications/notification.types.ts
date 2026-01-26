/**
 * Tipos y modelos para el Sistema de Notificaciones
 * Sistema de Gestión de Herramientas BoA
 */

/**
 * Tipos de notificaciones disponibles
 */
export type NotificationType =
    | 'CALIBRATION_EXPIRED'
    | 'CALIBRATION_EXPIRING_SOON'
    | 'CALIBRATION_EXPIRING_CRITICAL'
    | 'LOAN_OVERDUE'
    | 'LOAN_OVERDUE_CRITICAL'
    | 'STOCK_LOW'
    | 'STOCK_CRITICAL'
    | 'QUARANTINE_PROLONGED'
    | 'MAINTENANCE_DUE'
    | 'MAINTENANCE_OVERDUE'
    | 'TOOL_DECOMMISSIONED'
    | 'SYSTEM_UPDATE'
    | 'USER_ASSIGNMENT'
    | 'GENERAL';

/**
 * Prioridad de la notificación
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Estado de la notificación
 */
export type NotificationStatus = 'unread' | 'read' | 'archived' | 'dismissed';

/**
 * Categorías de notificaciones
 */
export type NotificationCategory =
    | 'CALIBRATION'
    | 'LOANS'
    | 'INVENTORY'
    | 'MAINTENANCE'
    | 'SYSTEM'
    | 'USER';

/**
 * Interfaz principal de Notificación
 */
export interface Notification {
    id: string;
    type: NotificationType;
    category: NotificationCategory;
    priority: NotificationPriority;
    status: NotificationStatus;

    // Contenido
    title: string;
    message: string;
    description?: string;

    // Información adicional
    icon?: string;
    iconColor?: string;
    link?: string; // Enlace a la entidad relacionada
    actionLabel?: string;
    actionLink?: string;

    // Datos relacionados
    relatedEntityId?: number | string;
    relatedEntityType?: 'tool' | 'movement' | 'calibration' | 'maintenance' | 'user';
    metadata?: Record<string, any>;

    // Timestamps
    createdAt: Date;
    readAt?: Date;
    dismissedAt?: Date;
    expiresAt?: Date;

    // Usuario
    userId: number;
    userName?: string;
}

/**
 * Configuración de alertas automáticas
 */
export interface NotificationRule {
    id: string;
    name: string;
    description: string;
    type: NotificationType;
    enabled: boolean;

    // Condiciones
    condition: {
        field: string;
        operator: 'equals' | 'greater_than' | 'less_than' | 'between' | 'contains';
        value: any;
    };

    // Configuración de la alerta
    priority: NotificationPriority;
    notifyDaysBefore?: number; // Para alertas preventivas
    repeatInterval?: number; // Minutos para repetir si no se atiende

    // Destinatarios
    recipientRoles?: number[]; // IDs de roles que deben recibir
    recipientUsers?: number[]; // IDs de usuarios específicos

    // Plantilla del mensaje
    titleTemplate: string;
    messageTemplate: string;

    // Activo/Inactivo
    lastTriggered?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Configuración de usuario para notificaciones
 */
export interface NotificationPreferences {
    userId: number;

    // Preferencias generales
    enableNotifications: boolean;
    enableEmailNotifications: boolean;
    enablePushNotifications: boolean;
    enableSoundAlerts: boolean;

    // Preferencias por categoría
    categories: {
        [key in NotificationCategory]: {
            enabled: boolean;
            minPriority: NotificationPriority;
            email: boolean;
            push: boolean;
        };
    };

    // Horario de silencio
    quietHoursEnabled: boolean;
    quietHoursStart?: string; // HH:mm
    quietHoursEnd?: string; // HH:mm

    updatedAt: Date;
}

/**
 * Resumen de notificaciones
 */
export interface NotificationSummary {
    total: number;
    unread: number;
    byPriority: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
    byCategory: {
        [key in NotificationCategory]: number;
    };
    latestNotifications: Notification[];
}

/**
 * Grupos de notificaciones para la vista
 */
export interface GroupedNotifications {
    today: Notification[];
    yesterday: Notification[];
    older: Notification[];
}

/**
 * Filtros para consultar notificaciones
 */
export interface NotificationFilters {
    status?: NotificationStatus[];
    priority?: NotificationPriority[];
    category?: NotificationCategory[];
    type?: NotificationType[];
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
}

/**
 * Evento de notificación en tiempo real
 */
export interface NotificationEvent {
    type: 'new' | 'update' | 'delete';
    notification: Notification;
    timestamp: Date;
}
