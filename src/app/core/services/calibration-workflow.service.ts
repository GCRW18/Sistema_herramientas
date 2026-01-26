import { Injectable, signal, computed } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

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

    constructor() {
        this.loadProcesses();
    }

    /**
     * Cargar procesos de calibración
     */
    loadProcesses(): Observable<CalibrationProcess[]> {
        // TODO: Reemplazar con llamada real a API
        return this.getMockProcesses().pipe(
            tap(processes => {
                this.processesSignal.set(processes);
                this.processesSubject.next(processes);
            })
        );
    }

    /**
     * Iniciar proceso de calibración (Enviar)
     */
    startCalibrationProcess(data: Partial<CalibrationProcess>): Observable<CalibrationProcess> {
        const validation = this.validateStartCalibration(data);

        if (!validation.isValid) {
            throw new Error(validation.errors.join(', '));
        }

        const newProcess: CalibrationProcess = {
            id: this.generateId(),
            toolId: data.toolId!,
            toolCode: data.toolCode!,
            toolName: data.toolName!,
            status: 'in_transit',
            sendDate: data.sendDate || new Date(),
            provider: data.provider!,
            calibrationType: data.calibrationType || 'calibration',
            estimatedReturnDate: data.estimatedReturnDate!,
            cost: data.cost,
            createdBy: 1, // TODO: Obtener usuario actual
            createdByName: 'Usuario Actual',
            createdAt: new Date(),
            updatedAt: new Date(),
            history: [{
                status: 'in_transit',
                date: new Date(),
                userId: 1,
                userName: 'Usuario Actual',
                notes: 'Herramienta enviada a calibración'
            }]
        };

        // TODO: Llamada a API
        const processes = [...this.processesSignal(), newProcess];
        this.processesSignal.set(processes);
        this.processesSubject.next(processes);

        return of(newProcess);
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

    /**
     * Generar ID temporal
     */
    private generateId(): string {
        return `cal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Datos mock para desarrollo
     */
    private getMockProcesses(): Observable<CalibrationProcess[]> {
        const mockProcesses: CalibrationProcess[] = [
            {
                id: 'cal-001',
                toolId: 123,
                toolCode: 'BOA-H-00123',
                toolName: 'Torquímetro Digital 50-250 Nm',
                status: 'in_calibration',
                sendDate: new Date(2024, 10, 15),
                provider: 'Calibraciones Técnicas S.A.',
                calibrationType: 'calibration',
                estimatedReturnDate: new Date(2024, 11, 15),
                cost: 350,
                createdBy: 1,
                createdByName: 'Juan Pérez',
                createdAt: new Date(2024, 10, 15),
                updatedAt: new Date(2024, 10, 20),
                history: [
                    {
                        status: 'in_transit',
                        date: new Date(2024, 10, 15),
                        userId: 1,
                        userName: 'Juan Pérez',
                        notes: 'Enviada a calibración'
                    },
                    {
                        status: 'in_calibration',
                        date: new Date(2024, 10, 20),
                        userId: 2,
                        userName: 'María García',
                        notes: 'Confirmada recepción por el proveedor'
                    }
                ]
            },
            {
                id: 'cal-002',
                toolId: 456,
                toolCode: 'BOA-H-00456',
                toolName: 'Micrómetro Digital 0-25mm',
                status: 'returned',
                sendDate: new Date(2024, 10, 1),
                provider: 'Metrología Andina',
                calibrationType: 'calibration',
                estimatedReturnDate: new Date(2024, 10, 25),
                actualReturnDate: new Date(2024, 10, 24),
                cost: 280,
                certificateNumber: 'CERT-2024-1234',
                certificateDate: new Date(2024, 10, 24),
                nextCalibrationDate: new Date(2025, 10, 24),
                result: 'approved',
                resultNotes: 'Calibración exitosa, dentro de tolerancias',
                createdBy: 1,
                createdByName: 'Juan Pérez',
                createdAt: new Date(2024, 10, 1),
                updatedAt: new Date(2024, 10, 24),
                history: [
                    {
                        status: 'in_transit',
                        date: new Date(2024, 10, 1),
                        userId: 1,
                        userName: 'Juan Pérez',
                        notes: 'Enviada a calibración'
                    },
                    {
                        status: 'in_calibration',
                        date: new Date(2024, 10, 5),
                        userId: 2,
                        userName: 'María García',
                        notes: 'Confirmada recepción por el proveedor'
                    },
                    {
                        status: 'calibrated',
                        date: new Date(2024, 10, 20),
                        userId: 2,
                        userName: 'María García',
                        notes: 'Calibración completada'
                    },
                    {
                        status: 'returned',
                        date: new Date(2024, 10, 24),
                        userId: 1,
                        userName: 'Juan Pérez',
                        notes: 'Recibida del proveedor'
                    }
                ]
            }
        ];

        return of(mockProcesses);
    }
}
