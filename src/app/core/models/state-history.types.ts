// =========================================================================
// State History Types - Auditoria de Estados
// =========================================================================

export interface StateHistoryRecord {
    id_history: number;
    estado_reg: string;
    tool_id: number;
    tool_code: string;
    tool_name: string;
    tool_serial: string;
    category_name: string;
    warehouse_name: string;
    previous_status: ToolStatusType;
    new_status: ToolStatusType;
    change_date: string;
    reason: string;
    reference_document: string | null;
    responsible_id: number | null;
    responsible_name: string | null;
    id_usuario_reg: number;
    fecha_reg: string;
    usr_reg: string;
}

export interface StateHistoryTimeline {
    id_history: number;
    previous_status: ToolStatusType;
    new_status: ToolStatusType;
    change_date: string;
    reason: string;
    reference_document: string | null;
    responsible_name: string | null;
    usr_reg: string;
    fecha_reg: string;
}

export interface StateChangeSummary {
    previous_status: ToolStatusType;
    new_status: ToolStatusType;
    transition_count: number;
    last_occurrence: string;
}

export interface CreateStateHistoryParams {
    tool_id: number;
    previous_status: ToolStatusType;
    new_status: ToolStatusType;
    reason: string;
    reference_document?: string;
    responsible_id?: number;
}

export type ToolStatusType =
    | 'available'
    | 'in_use'
    | 'in_calibration'
    | 'in_maintenance'
    | 'quarantine'
    | 'decommissioned'
    | 'lost'
    | 'NEW';
