// =========================================================================
// Calibration Batch Types - Modo Supermercado
// =========================================================================

export interface CalibrationBatch {
    id_batch: number;
    estado_reg: string;
    batch_number: string;
    status: CalibrationBatchStatus;
    laboratory_id: number;
    laboratory_name: string;
    base_id: number;
    base_name: string;
    send_date: string;
    expected_return_date: string;
    actual_return_date: string | null;
    total_items: number;
    created_by_id: number;
    created_by_name: string;
    approved_by_id: number | null;
    approved_by_name: string | null;
    service_order: string;
    cost: number | null;
    currency: string;
    notes: string;
    observations: string;
    id_usuario_reg: number;
    fecha_reg: string;
    id_usuario_mod: number | null;
    fecha_mod: string | null;
    usr_reg: string;
    usr_mod: string | null;
    jack_items_count: number;
    days_since_sent: number | null;
    is_overdue: boolean;
}

export type CalibrationBatchStatus = 'open' | 'sent' | 'in_process' | 'completed' | 'cancelled';

export interface CalibrationBatchItem {
    id_batch_item: number;
    estado_reg: string;
    batch_id: number;
    tool_id: number;
    tool_code: string;
    tool_name: string;
    tool_serial: string;
    tool_part_number: string;
    calibration_id: number | null;
    calibration_record: string | null;
    scan_order: number;
    tool_status_snapshot: string;
    calibration_date_snapshot: string | null;
    next_calibration_snapshot: string | null;
    is_jack: boolean;
    requires_semiannual: boolean;
    requires_annual: boolean;
    scanned_by_barcode: boolean;
    scan_timestamp: string;
    validation_result: 'valid' | 'warning' | 'rejected';
    validation_message: string | null;
    notes: string;
    id_usuario_reg: number;
    fecha_reg: string;
    usr_reg: string;
    category_name: string;
    // Campos de retorno (HE_CBI_SEL enriquecido)
    result: string | null;
    certificate_number: string | null;
    certificate_date: string | null;
    next_calibration_date: string | null;
    cost: number | null;
    // Campos de Gata (del JOIN a ttools)
    tool_is_jack: boolean;
    next_semiannual_service: string | null;
    next_annual_service: string | null;
}

export interface CalibrationBatchSummary {
    id_batch: number;
    batch_number: string;
    status: CalibrationBatchStatus;
    total_items: number;
    confirmed_date: string | null;
    total_jacks: number;
    total_standard: number;
    items_approved: number;
    items_rejected: number;
    items_pending: number;
    laboratory_name: string;
    base_name: string;
    send_date: string;
    expected_return_date: string;
}

export interface CreateBatchParams {
    laboratory_id: number;
    laboratory_name: string;
    base_id: number;
    base_name: string;
    send_date: string;
    expected_return_date?: string;
    created_by_id: number;
    created_by_name: string;
    service_order?: string;
    notes?: string;
    observations?: string;
}

export interface AddToolToBatchParams {
    batch_id: number;
    barcode_scan?: string;
    tool_id?: number;
    notes?: string;
}

export interface ConfirmBatchParams {
    batch_id: number;
    approved_by_id: number;
    approved_by_name: string;
}

export interface ReturnBatchParams {
    batch_id: number;
    actual_return_date?: string;
    result: 'approved' | 'conditional' | 'rejected';
    certificate_number?: string;
    certificate_date?: string;
    calibration_date?: string;
    received_by_id?: number;
    received_by_name?: string;
    cost?: number;
    currency?: string;
    observations?: string;
}
