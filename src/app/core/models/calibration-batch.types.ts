// calibration-batch.types.ts

export interface CalibrationBatch {
    id_batch: number;
    estado_reg: string;
    batch_number: string;
    status: 'open' | 'sent' | 'in_process' | 'completed' | 'cancelled';
    laboratory_id: number;
    laboratory_name: string;
    base_id: number;
    base_name: string;
    send_date: string;
    expected_return_date: string;
    actual_return_date: string;
    total_items: number;
    created_by_id: number;
    created_by_name: string;
    approved_by_id: number;
    approved_by_name: string;
    service_order: string;
    cost: number;
    currency: string;
    notes: string;
    observations: string;
    jack_items_count: number;
    days_since_sent: number;
    is_overdue: boolean;
    id_usuario_reg: number;
    fecha_reg: string;
    id_usuario_mod: number;
    fecha_mod: string;
    usr_reg: string;
    usr_mod: string;
}

export interface CalibrationBatchItem {
    id_batch_item: number;
    estado_reg: string;
    batch_id: number;
    tool_id: number;
    tool_code: string;
    tool_name: string;
    tool_serial: string;
    tool_part_number: string;
    calibration_id: number;
    calibration_record: string;
    scan_order: number;
    tool_status_snapshot: string;
    calibration_date_snapshot: string;
    next_calibration_snapshot: string;
    is_jack: boolean;
    tool_is_jack?: boolean;  // ✅ Hacer opcional
    requires_semiannual: boolean;
    requires_annual: boolean;
    scanned_by_barcode: boolean;
    scan_timestamp: string;
    validation_result: 'valid' | 'warning' | 'rejected';
    validation_message: string;
    notes: string;
    category_name: string;
    next_semiannual_service: string;
    next_annual_service: string;
    next_calibration_date: string;
    result: string;
    certificate_number: string;
    certificate_date: string;
    cost: number;
    id_usuario_reg: number;
    fecha_reg: string;
    usr_reg: string;
}

export interface CreateBatchParams {
    laboratory_id: number;
    laboratory_name?: string;
    send_date: string;
    expected_return_date?: string;
    notes?: string;
}

export interface AddToolToBatchParams {
    batch_id: number;
    barcode_scan?: string;
    tool_id?: number;
    notes?: string;
}

export interface ConfirmBatchParams {
    batch_id: number;
    approved_by_id?: number;
    approved_by_name?: string;
}

export interface ReturnBatchParams {
    batch_id: number;
    actual_return_date?: string;
    result?: string;
    certificate_number?: string;
    certificate_date?: string;
    cost?: number;
    currency?: string;
    observations?: string;
}

export interface CalibrationBatchSummary {
    id_batch: number;
    batch_code: string;
    batch_name: string;
    status: string;
    tools_count: number;
    tools_approved: number;
    tools_rejected: number;
    total_cost: number;
}
