import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { CalibrationService } from './calibration.service';
import {
    ScanToolResult,
    CalibrationRecord,
    AlertUrgency,
    URGENCY_COLORS,
    URGENCY_LABELS
} from '../models/calibration.types';
import {
    CalibrationBatch,
    CalibrationBatchItem
} from '../models/calibration-batch.types';

/**
 * Estados del workflow de calibración
 */
export type CalibrationStatus =
    | 'pending' // Pendiente de envío
    | 'in_transit' // En tránsito al proveedor
    | 'in_calibration' // En proceso de calibración
    | 'calibrated' // Calibrada, pendiente de retorno
    | 'returned' // Retornada, pendiente de verificación
    | 'verified' // Verificada y aprobada
    | 'rejected' // Rechazada, requiere re-calibración
    | 'cancelled'; // Cancelada

/**
 * Interfaz para el proceso de calibración
 */
export interface CalibrationProcess {
    id: string;
    toolId: number | string; // Puede ser string o number según el sistema
    toolCode: string;
    toolName: string;
    status: CalibrationStatus;

    // Datos de envío
    sendDate: Date;
    provider: string;
    calibrationType: 'calibration' | 'verification' | 'repair';
    estimatedReturnDate: Date;
    cost?: number;

    // Datos de seguimiento
    actualReturnDate?: Date;
    certificateNumber?: string;
    certificateDate?: Date;
    nextCalibrationDate?: Date;

    // Resultados
    result?: 'approved' | 'approved_with_adjustments' | 'rejected';
    resultNotes?: string;
    measurements?: CalibrationMeasurement[];

    // Archivos adjuntos
    certificateUrl?: string;
    reportUrl?: string;

    // Auditoría
    createdBy: number;
    createdByName: string;
    createdAt: Date;
    updatedAt: Date;

    // Historial
    history: CalibrationHistoryEntry[];
}

export interface CalibrationMeasurement {
    parameter: string;
    expected: number;
    measured: number;
    tolerance: number;
    unit: string;
    passed: boolean;
}

export interface CalibrationHistoryEntry {
    status: CalibrationStatus;
    date: Date;
    userId: number;
    userName: string;
    notes?: string;
}

/**
 * Validaciones del workflow
 */
export interface WorkflowValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Item escaneado en modo supermercado (extiende CalibrationBatchItem)
 */
export interface BatchScanItem {
    id_batch_item: number;
    batch_id: number;
    tool_id: number;
    calibration_id: number | null;
    scan_order: number;
    tool_code: string;
    tool_name: string;
    tool_serial: string;
    tool_status_snapshot: string | null;
    calibration_date_snapshot: string | null;
    next_calibration_snapshot: string | null;
    is_jack: boolean;
    requires_semiannual: boolean;
    requires_annual: boolean;
    scanned_by_barcode: boolean;
    scan_timestamp: string;
    validation_result: 'valid' | 'warning' | 'rejected';
    validation_message: string | null;
    notes: string | null;
    scanned_at: string;
}

@Injectable({
    providedIn: 'root'
})
export class CalibrationWorkflowService {
    // Hacer públicos los signals para que los componentes puedan accederlos
    public processesSignal = signal<CalibrationProcess[]>([]);
    private processesSubject = new BehaviorSubject<CalibrationProcess[]>([]);

    public processes$ = this.processesSubject.asObservable();

    // Computed signals para diferentes estados
    public pendingProcesses = computed(() =>
        this.processesSignal().filter(p => p.status === 'pending')
    );

    public inTransitProcesses = computed(() =>
        this.processesSignal().filter(p => p.status === 'in_transit')
    );

    public inCalibrationProcesses = computed(() =>
        this.processesSignal().filter(p => p.status === 'in_calibration')
    );

    public overdueProcesses = computed(() =>
        this.processesSignal().filter(p => {
            if (!p.estimatedReturnDate) return false;
            const today = new Date();
            const estimated = new Date(p.estimatedReturnDate);
            return estimated < today && ['in_transit', 'in_calibration'].includes(p.status);
        })
    );

    // =========================================================================
    // MODO SUPERMERCADO - Lotes de Calibración (Signals)
    // =========================================================================

    private _calibrationService = inject(CalibrationService);

    /** Lote activo (cabecera) */
    public activeBatchSignal = signal<CalibrationBatch | null>(null);

    /** Items escaneados en el lote activo */
    public batchItemsSignal = signal<BatchScanItem[]>([]);

    /** Último resultado de escaneo */
    public lastScanResult = signal<ScanToolResult | null>(null);

    /** Estado del modo supermercado */
    public supermarketMode = signal<boolean>(false);

    /** Conteo de items en el lote */
    public batchItemCount = computed(() => this.batchItemsSignal().length);

    /** Conteo de gatas en el lote */
    public batchJackCount = computed(() =>
        this.batchItemsSignal().filter(i => i.is_jack).length
    );

    /** Items válidos en el lote */
    public batchValidItems = computed(() =>
        this.batchItemsSignal().filter(i => i.validation_result === 'valid')
    );

    /** Items con advertencia en el lote */
    public batchWarningItems = computed(() =>
        this.batchItemsSignal().filter(i => i.validation_result === 'warning')
    );

    constructor() {
        this.loadProcesses().subscribe();
    }

    /**
     * Cargar procesos de calibración desde el backend PXP
     */
    loadProcesses(): Observable<CalibrationProcess[]> {
        return this._calibrationService.getCalibrations({ limit: 200 }).pipe(
            map((records: CalibrationRecord[]) => records.map(r => this.mapRecordToProcess(r))),
            tap(processes => {
                this.processesSignal.set(processes);
                this.processesSubject.next(processes);
            }),
            catchError(() => {
                // Mantener estado actual si falla la API
                return of(this.processesSignal());
            })
        );
    }

    /**
     * Mapear CalibrationRecord del backend a CalibrationProcess del workflow.
     * Maneja tanto los campos camelCase del type CalibrationRecord como los
     * campos snake_case que llegan directamente del API PXP.
     */
    private mapRecordToProcess(record: any): CalibrationProcess {
        const statusMap: Record<string, CalibrationStatus> = {
            'pending': 'pending',
            'sent': 'in_transit',
            'in_process': 'in_calibration',
            'in_calibration': 'in_calibration',
            'completed': 'verified',
            'approved': 'verified',
            'rejected': 'rejected',
            'cancelled': 'cancelled',
            'returned': 'returned',
            'calibrated': 'calibrated'
        };

        // Resolver campos: el API puede devolver snake_case o el tipo usa camelCase
        const id = record.id_calibration || record.id || '';
        const toolId = record.tool_id || record.toolId || 0;
        const toolCode = record.tool_code || record.code || '';
        const toolName = record.tool_name || record.name || '';
        const status = record.status || 'pending';
        const sendDate = record.send_date || record.sentDate || record.requestDate;
        const provider = record.supplier_name || record.laboratory_name || '';
        const calibrationType = record.calibration_type || record.type || 'calibration';
        const expectedReturn = record.expected_return_date || record.expectedReturnDate;
        const actualReturn = record.actual_return_date || record.actualReturnDate;
        const cost = record.cost;
        const certNumber = record.certificate_number || record.certificateNumber;
        const certDate = record.certificate_date || record.certificateDate;
        const nextCalib = record.next_calibration_date || record.nextCalibrationDate;
        const result = record.result;
        const notes = record.observations || record.notes || '';
        const createdBy = record.id_usuario_reg || record.createdById || 0;
        const createdByName = record.usr_reg || '';
        const createdAt = record.fecha_reg || record.createdAt;
        const updatedAt = record.fecha_mod || record.updatedAt;

        return {
            id: String(id),
            toolId,
            toolCode,
            toolName,
            status: statusMap[status] || 'pending',
            sendDate: sendDate ? new Date(sendDate) : new Date(),
            provider,
            calibrationType: calibrationType as any,
            estimatedReturnDate: expectedReturn ? new Date(expectedReturn) : new Date(),
            actualReturnDate: actualReturn ? new Date(actualReturn) : undefined,
            cost,
            certificateNumber: certNumber,
            certificateDate: certDate ? new Date(certDate) : undefined,
            nextCalibrationDate: nextCalib ? new Date(nextCalib) : undefined,
            result: result === 'approved' ? 'approved'
                : result === 'conditional' ? 'approved_with_adjustments'
                : result === 'rejected' ? 'rejected'
                : undefined,
            resultNotes: notes || undefined,
            createdBy: Number(createdBy),
            createdByName,
            createdAt: createdAt ? new Date(createdAt) : new Date(),
            updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
            history: []
        };
    }

    /**
     * Iniciar proceso de calibración (Enviar) - Llama al backend PXP HE_CLS_SEND
     */
    startCalibrationProcess(data: Partial<CalibrationProcess>): Observable<CalibrationProcess> {
        const validation = this.validateStartCalibration(data);

        if (!validation.isValid) {
            throw new Error(validation.errors.join(', '));
        }

        const sendDate = data.sendDate || new Date();
        const formatDate = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        return this._calibrationService.sendToCalibrationPxp({
            tool_id: Number(data.toolId),
            calibration_type: data.calibrationType || 'calibration',
            supplier_name: data.provider,
            send_date: formatDate(sendDate),
            expected_return_date: data.estimatedReturnDate ? formatDate(new Date(data.estimatedReturnDate)) : undefined,
            cost: data.cost,
            notes: data.resultNotes
        }).pipe(
            map((response: any) => {
                const newProcess: CalibrationProcess = {
                    id: String(response?.id_calibration || this.generateId()),
                    toolId: data.toolId!,
                    toolCode: data.toolCode!,
                    toolName: data.toolName!,
                    status: 'in_transit',
                    sendDate,
                    provider: data.provider!,
                    calibrationType: data.calibrationType || 'calibration',
                    estimatedReturnDate: data.estimatedReturnDate!,
                    cost: data.cost,
                    createdBy: response?.id_usuario_reg || 0,
                    createdByName: response?.usr_reg || '',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    history: [{
                        status: 'in_transit',
                        date: new Date(),
                        userId: response?.id_usuario_reg || 0,
                        userName: response?.usr_reg || '',
                        notes: 'Herramienta enviada a calibracion'
                    }]
                };

                const processes = [...this.processesSignal(), newProcess];
                this.processesSignal.set(processes);
                this.processesSubject.next(processes);

                return newProcess;
            })
        );
    }

    /**
     * Actualizar estado del proceso
     */
    updateProcessStatus(
        processId: string,
        newStatus: CalibrationStatus,
        notes?: string,
        additionalData?: Partial<CalibrationProcess>
    ): Observable<CalibrationProcess> {
        const processes = this.processesSignal();
        const processIndex = processes.findIndex(p => p.id === processId);

        if (processIndex === -1) {
            throw new Error('Proceso no encontrado');
        }

        const validation = this.validateStatusTransition(processes[processIndex].status, newStatus);
        if (!validation.isValid) {
            throw new Error(validation.errors.join(', '));
        }

        const updatedProcess: CalibrationProcess = {
            ...processes[processIndex],
            ...additionalData,
            status: newStatus,
            updatedAt: new Date(),
            history: [
                ...processes[processIndex].history,
                {
                    status: newStatus,
                    date: new Date(),
                    userId: 1,
                    userName: 'Usuario Actual',
                    notes
                }
            ]
        };

        const updatedProcesses = [...processes];
        updatedProcesses[processIndex] = updatedProcess;

        this.processesSignal.set(updatedProcesses);
        this.processesSubject.next(updatedProcesses);

        return of(updatedProcess);
    }

    /**
     * Recibir herramienta calibrada
     */
    receiveCalibration(
        processId: string,
        data: {
            certificateNumber: string;
            certificateDate: Date;
            nextCalibrationDate: Date;
            result: 'approved' | 'approved_with_adjustments' | 'rejected';
            resultNotes?: string;
            measurements?: CalibrationMeasurement[];
            certificateUrl?: string;
            reportUrl?: string;
        }
    ): Observable<CalibrationProcess> {
        return this.updateProcessStatus(
            processId,
            'returned',
            'Herramienta recibida del proveedor',
            {
                actualReturnDate: new Date(),
                certificateNumber: data.certificateNumber,
                certificateDate: data.certificateDate,
                nextCalibrationDate: data.nextCalibrationDate,
                result: data.result,
                resultNotes: data.resultNotes,
                measurements: data.measurements,
                certificateUrl: data.certificateUrl,
                reportUrl: data.reportUrl
            }
        );
    }

    /**
     * Verificar y aprobar calibración
     */
    verifyCalibration(
        processId: string,
        approved: boolean,
        notes?: string
    ): Observable<CalibrationProcess> {
        const newStatus = approved ? 'verified' : 'rejected';
        return this.updateProcessStatus(
            processId,
            newStatus,
            notes || (approved ? 'Calibración verificada y aprobada' : 'Calibración rechazada')
        );
    }

    /**
     * Cancelar proceso
     */
    cancelProcess(processId: string, reason: string): Observable<CalibrationProcess> {
        return this.updateProcessStatus(
            processId,
            'cancelled',
            `Proceso cancelado: ${reason}`
        );
    }

    /**
     * Validar inicio de calibración
     */
    public validateStartCalibration(data: Partial<CalibrationProcess>): WorkflowValidation {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!data.toolId) errors.push('Debe seleccionar una herramienta');
        if (!data.provider) errors.push('Debe especificar el proveedor');
        if (!data.estimatedReturnDate) errors.push('Debe especificar fecha estimada de retorno');

        if (data.estimatedReturnDate) {
            const today = new Date();
            const estimated = new Date(data.estimatedReturnDate);
            if (estimated <= today) {
                warnings.push('La fecha estimada de retorno es muy próxima');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validar transición de estado
     */
    private validateStatusTransition(
        currentStatus: CalibrationStatus,
        newStatus: CalibrationStatus
    ): WorkflowValidation {
        const errors: string[] = [];
        const validTransitions: Record<CalibrationStatus, CalibrationStatus[]> = {
            pending: ['in_transit', 'cancelled'],
            in_transit: ['in_calibration', 'cancelled'],
            in_calibration: ['calibrated', 'rejected', 'cancelled'],
            calibrated: ['returned'],
            returned: ['verified', 'rejected'],
            verified: [],
            rejected: ['in_transit'], // Re-enviar
            cancelled: []
        };

        const allowed = validTransitions[currentStatus];
        if (!allowed.includes(newStatus)) {
            errors.push(`No se puede cambiar de ${currentStatus} a ${newStatus}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings: []
        };
    }

    /**
     * Obtener estado siguiente sugerido
     */
    getNextSuggestedStatus(currentStatus: CalibrationStatus): CalibrationStatus | null {
        const nextStatus: Record<CalibrationStatus, CalibrationStatus | null> = {
            pending: 'in_transit',
            in_transit: 'in_calibration',
            in_calibration: 'calibrated',
            calibrated: 'returned',
            returned: 'verified',
            verified: null,
            rejected: null,
            cancelled: null
        };

        return nextStatus[currentStatus];
    }

    /**
     * Obtener nombre legible del estado
     */
    getStatusLabel(status: CalibrationStatus): string {
        const labels: Record<CalibrationStatus, string> = {
            pending: 'Pendiente',
            in_transit: 'En Tránsito',
            in_calibration: 'En Calibración',
            calibrated: 'Calibrada',
            returned: 'Retornada',
            verified: 'Verificada',
            rejected: 'Rechazada',
            cancelled: 'Cancelada'
        };

        return labels[status];
    }

    /**
     * Obtener color del estado
     */
    getStatusColor(status: CalibrationStatus): string {
        const colors: Record<CalibrationStatus, string> = {
            pending: '#9ca3af',
            in_transit: '#3b82f6',
            in_calibration: '#f59e0b',
            calibrated: '#10b981',
            returned: '#8b5cf6',
            verified: '#059669',
            rejected: '#ef4444',
            cancelled: '#6b7280'
        };

        return colors[status];
    }

    // =========================================================================
    // MODO SUPERMERCADO - Métodos de Lote
    // =========================================================================

    /**
     * Activar modo supermercado y crear lote
     */
    startSupermarketMode(params: {
        laboratory_id?: number;
        laboratory_name?: string;
        base_id?: number;
        base_name?: string;
        send_date?: string;
        expected_return_date?: string;
        service_order?: string;
        notes?: string;
    }): Observable<CalibrationBatch> {
        return this._calibrationService.createCalibrationBatch(params).pipe(
            tap((batch) => {
                this.activeBatchSignal.set(batch);
                this.batchItemsSignal.set([]);
                this.supermarketMode.set(true);
            })
        );
    }

    /**
     * Escanear herramienta y agregarla al lote activo
     * Detecta automáticamente si es gata
     */
    scanAndAddToBatch(barcode: string): Observable<BatchScanItem> {
        const batch = this.activeBatchSignal();
        if (!batch) {
            throw new Error('No hay lote activo. Inicie el modo supermercado primero.');
        }

        return this._calibrationService.addToolToBatch({
            batch_id: batch.id_batch,
            barcode_scan: barcode
        }).pipe(
            tap((item: any) => {
                const scanItem: BatchScanItem = {
                    ...item,
                    scanned_at: new Date().toISOString()
                };
                this.batchItemsSignal.update(items => [...items, scanItem]);
                // Actualizar total en la cabecera
                this.activeBatchSignal.update(b => b ? { ...b, total_items: (b.total_items || 0) + 1 } : null);
            })
        );
    }

    /**
     * Escanear herramienta para obtener info sin agregar al lote
     */
    scanToolPreview(barcode: string): Observable<ScanToolResult> {
        return this._calibrationService.scanToolForCalibration(barcode).pipe(
            tap((result) => {
                this.lastScanResult.set(result);
            })
        );
    }

    /**
     * Eliminar item del lote
     */
    removeItemFromBatch(batchItemId: number): Observable<any> {
        return this._calibrationService.removeFromBatch(batchItemId).pipe(
            tap(() => {
                this.batchItemsSignal.update(items =>
                    items.filter(i => i.id_batch_item !== batchItemId)
                );
                this.activeBatchSignal.update(b =>
                    b ? { ...b, total_items: Math.max(0, (b.total_items || 0) - 1) } : null
                );
            })
        );
    }

    /**
     * Confirmar y enviar lote completo al laboratorio
     */
    confirmAndSendBatch(approvedBy?: { id: number; name: string }): Observable<any> {
        const batch = this.activeBatchSignal();
        if (!batch) {
            throw new Error('No hay lote activo para confirmar.');
        }

        return this._calibrationService.confirmCalibrationBatch({
            batch_id: batch.id_batch,
            approved_by_id: approvedBy?.id,
            approved_by_name: approvedBy?.name
        }).pipe(
            tap(() => {
                this.activeBatchSignal.update(b => b ? { ...b, status: 'sent' } : null);
                this.supermarketMode.set(false);
            })
        );
    }

    /**
     * Cancelar modo supermercado y limpiar estado
     */
    cancelSupermarketMode(): void {
        this.activeBatchSignal.set(null);
        this.batchItemsSignal.set([]);
        this.lastScanResult.set(null);
        this.supermarketMode.set(false);
    }

    /**
     * Cargar items de un lote existente
     */
    loadBatchItems(batchId: number): Observable<CalibrationBatchItem[]> {
        return this._calibrationService.getBatchItems(batchId).pipe(
            tap((items) => {
                const scanItems: BatchScanItem[] = items.map(i => ({
                    ...i,
                    scanned_at: i.scan_timestamp
                }));
                this.batchItemsSignal.set(scanItems);
            })
        );
    }

    // =========================================================================
    // UTILIDADES DE URGENCIA
    // =========================================================================

    /**
     * Obtener color para nivel de urgencia
     */
    getUrgencyColor(urgency: AlertUrgency): string {
        return URGENCY_COLORS[urgency] || '#6b7280';
    }

    /**
     * Obtener label para nivel de urgencia
     */
    getUrgencyLabel(urgency: AlertUrgency): string {
        return URGENCY_LABELS[urgency] || 'Desconocido';
    }

    /**
     * Generar ID temporal
     */
    private generateId(): string {
        return `cal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

}
