export interface MaintenanceBatch {
    id_batch?: number;
    batch_number?: string;
    status?: 'open' | 'confirmed' | 'completed' | 'cancelled';
    provider: string;
    provider_contact?: string;
    maintenance_type: 'preventive' | 'corrective';
    preventive_subtype?: 'semiannual' | 'annual';
    send_date: string;
    expected_return_date?: string;
    actual_return_date?: string;
    discrepancy_report_num?: string;
    notes?: string;
    total_items?: number;
    created_by?: string;
    created_at?: string;
}

export interface MaintenanceBatchItem {
    id_batch_item?: number;
    batch_id?: number;
    tool_id: number;
    tool_code: string;
    tool_name: string;
    tool_serial?: string;
    scan_order?: number;
    maintenance_id?: number;
    record_number?: string;
    problem_description?: string;
}

export interface MaintenanceBatchPayload {
    provider: string;
    provider_contact?: string;
    maintenance_type: string;
    preventive_subtype?: string;
    send_date: string;
    expected_return_date?: string;
    discrepancy_report_num?: string;
    notes?: string;
    requested_by_name: string;
    items: Array<{ tool_id: number; tool_code: string; tool_name: string; problem_description?: string }>;
}

export interface MaintenanceBatchResult {
    batch_number: string;
    id_batch: number;
    total_created: number;
    record_numbers: string[];
}
