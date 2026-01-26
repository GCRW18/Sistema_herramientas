import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

/**
 * Tipos de movimientos
 */
export type MovementType = 'entry' | 'exit' | 'transfer' | 'adjustment';

/**
 * Tipos de entrada
 */
export type EntryType =
    | 'purchase' // Compra
    | 'donation' // Donación
    | 'return' // Devolución de préstamo
    | 'calibration_return' // Retorno de calibración
    | 'repair_return' // Retorno de reparación
    | 'adjustment'; // Ajuste de inventario

/**
 * Tipos de salida
 */
export type ExitType =
    | 'loan' // Préstamo
    | 'calibration' // Envío a calibración
    | 'repair' // Envío a reparación
    | 'decommission' // Baja
    | 'donation' // Donación
    | 'loss' // Pérdida
    | 'adjustment'; // Ajuste de inventario

/**
 * Resultado de validación
 */
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

export interface ValidationError {
    field: string;
    message: string;
    code: string;
}

export interface ValidationWarning {
    field: string;
    message: string;
    code: string;
}

/**
 * Datos de movimiento para validación
 */
export interface MovementData {
    type: MovementType;
    subType?: EntryType | ExitType;
    toolId: number;
    toolCode?: string;
    quantity: number;
    userId?: number;
    destinationId?: number; // Usuario, ubicación, etc.
    warehouseId?: number;
    locationId?: number;
    estimatedReturnDate?: Date;
    notes?: string;
}

/**
 * Reglas de negocio para movimientos
 */
@Injectable({
    providedIn: 'root'
})
export class MovementValidationService {

    /**
     * Validar movimiento completo
     */
    validateMovement(data: MovementData): Observable<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // Validaciones generales
        this.validateBasicFields(data, result);

        // Validaciones específicas por tipo
        if (data.type === 'entry') {
            this.validateEntry(data, result);
        } else if (data.type === 'exit') {
            this.validateExit(data, result);
        }

        // Validaciones de negocio
        this.validateBusinessRules(data, result);

        result.isValid = result.errors.length === 0;
        return of(result);
    }

    /**
     * Validar campos básicos
     */
    private validateBasicFields(data: MovementData, result: ValidationResult): void {
        if (!data.toolId) {
            result.errors.push({
                field: 'toolId',
                message: 'Debe seleccionar una herramienta',
                code: 'REQUIRED_TOOL'
            });
        }

        if (!data.quantity || data.quantity <= 0) {
            result.errors.push({
                field: 'quantity',
                message: 'La cantidad debe ser mayor a cero',
                code: 'INVALID_QUANTITY'
            });
        }

        if (data.quantity && data.quantity !== Math.floor(data.quantity)) {
            result.errors.push({
                field: 'quantity',
                message: 'La cantidad debe ser un número entero',
                code: 'FRACTIONAL_QUANTITY'
            });
        }
    }

    /**
     * Validar entrada
     */
    private validateEntry(data: MovementData, result: ValidationResult): void {
        if (!data.warehouseId) {
            result.errors.push({
                field: 'warehouseId',
                message: 'Debe seleccionar un almacén de destino',
                code: 'REQUIRED_WAREHOUSE'
            });
        }

        // Validaciones específicas por subtipo de entrada
        if (data.subType === 'return' || data.subType === 'calibration_return') {
            // Para devoluciones, validar que hubo un préstamo previo
            if (!data.userId) {
                result.warnings.push({
                    field: 'userId',
                    message: 'Se recomienda especificar el usuario que devuelve',
                    code: 'MISSING_USER'
                });
            }
        }

        if (data.subType === 'purchase') {
            // Para compras, se recomienda tener documentación
            if (!data.notes || data.notes.trim().length === 0) {
                result.warnings.push({
                    field: 'notes',
                    message: 'Se recomienda incluir información de la compra (proveedor, factura, etc.)',
                    code: 'MISSING_PURCHASE_INFO'
                });
            }
        }
    }

    /**
     * Validar salida
     */
    private validateExit(data: MovementData, result: ValidationResult): void {
        // Validar que la herramienta esté disponible
        // TODO: Verificar disponibilidad real en el sistema

        if (data.subType === 'loan') {
            // Para préstamos
            if (!data.destinationId) {
                result.errors.push({
                    field: 'destinationId',
                    message: 'Debe especificar el usuario que recibe el préstamo',
                    code: 'REQUIRED_USER'
                });
            }

            if (!data.estimatedReturnDate) {
                result.errors.push({
                    field: 'estimatedReturnDate',
                    message: 'Debe especificar la fecha estimada de devolución',
                    code: 'REQUIRED_RETURN_DATE'
                });
            }

            if (data.estimatedReturnDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const returnDate = new Date(data.estimatedReturnDate);
                returnDate.setHours(0, 0, 0, 0);

                if (returnDate < today) {
                    result.errors.push({
                        field: 'estimatedReturnDate',
                        message: 'La fecha de devolución no puede ser anterior a hoy',
                        code: 'INVALID_RETURN_DATE'
                    });
                }

                // Advertencia si el préstamo es muy largo
                const diffDays = Math.ceil((returnDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays > 30) {
                    result.warnings.push({
                        field: 'estimatedReturnDate',
                        message: 'El préstamo supera los 30 días. ¿Es correcto?',
                        code: 'LONG_LOAN_PERIOD'
                    });
                }
            }
        }

        if (data.subType === 'calibration') {
            // Para calibración
            if (!data.estimatedReturnDate) {
                result.warnings.push({
                    field: 'estimatedReturnDate',
                    message: 'Se recomienda especificar fecha estimada de retorno',
                    code: 'MISSING_RETURN_DATE'
                });
            }
        }

        if (data.subType === 'decommission' || data.subType === 'loss') {
            // Para bajas y pérdidas, requerir justificación
            if (!data.notes || data.notes.trim().length < 10) {
                result.errors.push({
                    field: 'notes',
                    message: 'Debe proporcionar una justificación detallada (mínimo 10 caracteres)',
                    code: 'REQUIRED_JUSTIFICATION'
                });
            }
        }
    }

    /**
     * Validar reglas de negocio
     */
    private validateBusinessRules(data: MovementData, result: ValidationResult): void {
        // Regla: No se puede prestar una herramienta que requiere calibración vencida
        // TODO: Verificar estado de calibración real

        // Regla: No se puede prestar una herramienta en cuarentena
        // TODO: Verificar estado de cuarentena

        // Regla: Cantidad no puede exceder el stock disponible
        // TODO: Verificar stock disponible
    }

    /**
     * Validar disponibilidad de herramienta
     */
    validateToolAvailability(toolId: number, quantity: number): Observable<ValidationResult> {
        // TODO: Implementar verificación real con el servicio de inventario
        return of({
            isValid: true,
            errors: [],
            warnings: []
        });
    }

    /**
     * Validar estado de calibración
     */
    validateCalibrationStatus(toolId: number): Observable<ValidationResult> {
        // TODO: Implementar verificación real con el servicio de calibración
        return of({
            isValid: true,
            errors: [],
            warnings: []
        });
    }

    /**
     * Validar préstamos activos del usuario
     */
    validateUserActiveLoans(userId: number, maxLoans: number = 10): Observable<ValidationResult> {
        // TODO: Implementar verificación real
        // Si el usuario ya tiene muchos préstamos activos, advertir
        return of({
            isValid: true,
            errors: [],
            warnings: []
        });
    }

    /**
     * Validar que la herramienta no esté en uso
     */
    validateToolNotInUse(toolId: number): Observable<ValidationResult> {
        // TODO: Implementar verificación real
        return of({
            isValid: true,
            errors: [],
            warnings: []
        });
    }

    /**
     * Obtener tipo de movimiento legible
     */
    getMovementTypeLabel(type: MovementType): string {
        const labels: Record<MovementType, string> = {
            entry: 'Entrada',
            exit: 'Salida',
            transfer: 'Transferencia',
            adjustment: 'Ajuste'
        };
        return labels[type];
    }

    /**
     * Obtener subtipo de entrada legible
     */
    getEntryTypeLabel(type: EntryType): string {
        const labels: Record<EntryType, string> = {
            purchase: 'Compra',
            donation: 'Donación',
            return: 'Devolución',
            calibration_return: 'Retorno de Calibración',
            repair_return: 'Retorno de Reparación',
            adjustment: 'Ajuste'
        };
        return labels[type];
    }

    /**
     * Obtener subtipo de salida legible
     */
    getExitTypeLabel(type: ExitType): string {
        const labels: Record<ExitType, string> = {
            loan: 'Préstamo',
            calibration: 'Calibración',
            repair: 'Reparación',
            decommission: 'Baja',
            donation: 'Donación',
            loss: 'Pérdida',
            adjustment: 'Ajuste'
        };
        return labels[type];
    }

    /**
     * Verificar si se requiere fecha de devolución
     */
    requiresReturnDate(subType: string): boolean {
        return ['loan', 'calibration', 'repair'].includes(subType);
    }

    /**
     * Verificar si se requiere usuario destino
     */
    requiresDestinationUser(subType: string): boolean {
        return ['loan'].includes(subType);
    }

    /**
     * Verificar si se requiere justificación
     */
    requiresJustification(subType: string): boolean {
        return ['decommission', 'loss', 'donation'].includes(subType);
    }
}
