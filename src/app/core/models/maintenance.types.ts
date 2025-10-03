export interface Maintenance {
    id: string;
    toolId: string;
    toolCode?: string;
    toolName?: string;
    type: MaintenanceType;
    status: MaintenanceStatus;
    scheduledDate: Date;
    completedDate?: Date;
    technician?: string;
    cost?: number;
    description: string;
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export type MaintenanceType = 'preventive' | 'corrective' | 'predictive';

export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface MaintenanceFormData {
    toolId: string;
    type: MaintenanceType;
    scheduledDate: Date;
    technician?: string;
    description: string;
    notes?: string;
    estimatedCost?: number;
}

export interface MaintenanceCompletionData {
    completedDate: Date;
    cost: number;
    notes?: string;
    result: 'success' | 'partial' | 'failed';
}

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
    preventive: 'Preventivo',
    corrective: 'Correctivo',
    predictive: 'Predictivo'
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
    scheduled: 'Programado',
    in_progress: 'En Progreso',
    completed: 'Completado',
    cancelled: 'Cancelado'
};
