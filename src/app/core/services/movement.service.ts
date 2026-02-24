import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap } from 'rxjs';
import { Movement, MovementVoucher, CreateMovement } from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class MovementService {
    private _api = inject(ErpApiService);
    private _movements: ReplaySubject<Movement[]> = new ReplaySubject<Movement[]>(1);
    private _movement: ReplaySubject<Movement> = new ReplaySubject<Movement>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for movements
     */
    get movements$(): Observable<Movement[]> {
        return this._movements.asObservable();
    }

    /**
     * Getter for movement
     */
    get movement$(): Observable<Movement> {
        return this._movement.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all movements
     */
    getMovements(filters?: any): Observable<Movement[]> {
        const params = {
            start: 0,
            limit: 50,
            sort: 'date',
            dir: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/movements/listMovement', params)).pipe(
            switchMap((response: any) => {
                const movements = response?.datos || [];
                this._movements.next(movements);
                return of(movements);
            })
        );
    }

    /**
     * Get movement by id
     */
    getMovementById(id: string): Observable<Movement> {
        return from(this._api.post('herramientas/movements/listMovement', {
            start: 0,
            limit: 1,
            id_movement: id
        })).pipe(
            switchMap((response: any) => {
                const movement = response?.datos?.[0] || null;
                if (movement) {
                    this._movement.next(movement);
                }
                return of(movement);
            })
        );
    }

    /**
     * Get movements by tool
     */
    getMovementsByTool(toolId: string): Observable<Movement[]> {
        return from(this._api.post('herramientas/movements/listMovementsByTool', {
            tool_id: toolId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get entries
     */
    getEntries(): Observable<Movement[]> {
        return from(this._api.post('herramientas/movements/listMovement', {
            start: 0,
            limit: 50,
            sort: 'date',
            dir: 'desc',
            movement_type: 'entry'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get exits
     */
    getExits(): Observable<Movement[]> {
        return from(this._api.post('herramientas/movements/listMovement', {
            start: 0,
            limit: 50,
            sort: 'date',
            dir: 'desc',
            movement_type: 'exit'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Create movement (generic method)
     */
    createMovement(movement: Partial<Movement>): Observable<Movement> {
        return from(this._api.post('herramientas/movements/insertMovement', movement)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || movement);
            })
        );
    }

    /**
     * Create entry movement
     */
    createEntry(movement: CreateMovement | Partial<Movement>): Observable<Movement> {
        return this.createMovement({
            ...movement,
            type: movement.type || 'entry'
        } as Partial<Movement>);
    }

    /**
     * Create exit movement
     */
    createExit(movement: CreateMovement | Partial<Movement>): Observable<Movement> {
        return this.createMovement({
            ...movement,
            type: movement.type || 'exit'
        } as Partial<Movement>);
    }

    /**
     * Create transfer movement
     */
    createTransfer(movement: Partial<Movement>): Observable<Movement> {
        return this.createMovement({
            ...movement,
            type: 'transfer'
        });
    }

    /**
     * Update movement
     */
    updateMovement(id: string, movement: Partial<Movement>): Observable<Movement> {
        return from(this._api.post('herramientas/movements/insertMovement', {
            ...movement,
            id_movement: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || movement);
            })
        );
    }

    /**
     * Approve movement
     */
    approveMovement(id: string): Observable<Movement> {
        return from(this._api.post('herramientas/movements/approveMovement', {
            id_movement: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Complete movement
     */
    completeMovement(id: string): Observable<Movement> {
        return from(this._api.post('herramientas/movements/completeMovement', {
            id_movement: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Cancel movement
     */
    cancelMovement(id: string, reason: string): Observable<Movement> {
        return from(this._api.post('herramientas/movements/cancelMovement', {
            id_movement: id,
            cancellation_reason: reason
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Generate voucher
     */
    generateVoucher(id: string): Observable<MovementVoucher> {
        return from(this._api.post('herramientas/Comprobante/listComprobante', {
            id_movement: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || {});
            })
        );
    }

    /**
     * Get movement history for a tool
     */
    getToolMovementHistory(toolId: string): Observable<Movement[]> {
        return this.getMovementsByTool(toolId);
    }

    /**
     * Get pending entries
     */
    getPendingEntries(): Observable<Movement[]> {
        return from(this._api.post('herramientas/movements/listPendingMovements', {
            movement_type: 'entry'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get entries by status
     */
    getEntriesByStatus(status: string): Observable<Movement[]> {
        return from(this._api.post('herramientas/movements/listMovementsByStatus', {
            status: status,
            movement_type: 'entry'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get movements by status
     */
    getMovementsByStatus(status: string, movementType?: string): Observable<Movement[]> {
        const params: any = { status };
        if (movementType) {
            params.movement_type = movementType;
        }
        return from(this._api.post('herramientas/movements/listMovementsByStatus', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get pending movements
     */
    getPendingMovements(movementType?: string): Observable<Movement[]> {
        const params: any = {};
        if (movementType) {
            params.movement_type = movementType;
        }
        return from(this._api.post('herramientas/movements/listPendingMovements', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Export movements to PDF or Excel
     */
    exportMovements(filters?: any, format: 'PDF' | 'EXCEL' = 'PDF'): Observable<Blob> {
        // Return a mock blob for now - backend needs to implement this endpoint
        const mockBlob = new Blob(['PDF Content'], { type: 'application/pdf' });
        return of(mockBlob);
    }

    /**
     * Get historial de movimientos con filtros y paginación
     */
    getHistorialMovimientos(filtros?: any): Observable<{ data: any[], total: number }> {
        const params = {
            start: ((filtros?.page || 1) - 1) * (filtros?.limit || 25),
            limit: filtros?.limit || 25,
            sort: 'date',
            dir: 'desc',
            ...filtros
        };

        return from(this._api.post('herramientas/movements/listMovement', params)).pipe(
            switchMap((response: any) => {
                return of({
                    data: response?.datos || [],
                    total: response?.total || 0
                });
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Métodos auxiliares para formularios
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get proveedores
     */
    getProveedores(): Observable<any[]> {
        return from(this._api.post('herramientas/proveedores/listar', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Get herramientas disponibles
     */
    getHerramientasDisponibles(filters?: any): Observable<any[]> {
        return from(this._api.post('herramientas/herramientas/listar', {
            start: 0,
            limit: 500,
            estado: 'activo',
            ...filters
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Get almacenes
     */
    getAlmacenes(): Observable<any[]> {
        return from(this._api.post('herramientas/almacenes/listar', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Get técnicos/responsables
     */
    getResponsables(): Observable<any[]> {
        return from(this._api.post('herramientas/tecnicos/listar', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Get categorías de herramientas
     */
    getCategorias(): Observable<any[]> {
        return from(this._api.post('herramientas/categorias/listar', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Generate automatic voucher number
     */
    generateVoucherNumber(type: 'entrada' | 'salida'): Observable<string> {
        const prefix = type === 'entrada' ? 'ENT' : 'SAL';
        const year = new Date().getFullYear();

        return from(this._api.post('herramientas/movimientos/getNextVoucherNumber', {
            type: type
        })).pipe(
            switchMap((response: any) => {
                const number = response?.numero || 1;
                return of(`${prefix}-${year}-${String(number).padStart(3, '0')}`);
            })
        );
    }

    /**
     * Get recent entries (for sidebar)
     */
    getRecentEntries(limit: number = 5): Observable<Movement[]> {
        return from(this._api.post('herramientas/movements/listMovement', {
            start: 0,
            limit: limit,
            sort: 'date',
            dir: 'desc',
            movement_type: 'entry'
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Get recent exits (for sidebar)
     */
    getRecentExits(limit: number = 5): Observable<Movement[]> {
        return from(this._api.post('herramientas/movements/listMovement', {
            start: 0,
            limit: limit,
            sort: 'date',
            dir: 'desc',
            movement_type: 'exit'
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Get personal/personnel list
     */
    getPersonal(): Observable<any[]> {
        return from(this._api.post('herramientas/personal/listar', {
            start: 0,
            limit: 500,
            estado: 'activo'
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Get departamentos list
     */
    getDepartamentos(): Observable<any[]> {
        return from(this._api.post('herramientas/departamentos/listar', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Get bases operativas list
     */
    getBases(): Observable<any[]> {
        return from(this._api.post('herramientas/bases/listar', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Get terceros/empresas externas list
     */
    getTerceros(): Observable<any[]> {
        return from(this._api.post('herramientas/terceros/listar', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Get warehouses list (almacenes y bases operativas)
     */
    getWarehouses(): Observable<any[]> {
        return from(this._api.post('herramientas/almacenes/listar', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Get funcionarios list (personal que puede recibir/entregar herramientas)
     */
    getFuncionarios(): Observable<any[]> {
        return from(this._api.post('herramientas/funcionarios/listar', {
            start: 0,
            limit: 500,
            estado: 'activo'
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Métodos específicos para flujo de CALIBRACIÓN
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get herramientas enviadas a calibración pendientes de retorno
     * Estas son las que aparecerán en retorno-calibracion para procesar
     */
    getHerramientasEnCalibracion(baseOrigen?: string): Observable<any[]> {
        const params: any = {
            start: 0,
            limit: 100,
            movement_type: 'exit',
            exitReason: 'calibration_send',
            status: 'completed', // Envíos completados pendientes de retorno
            pendingReturn: true
        };

        if (baseOrigen) {
            params.baseOrigen = baseOrigen;
        }

        return from(this._api.post('herramientas/movements/listMovement', params)).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Vincular retorno de calibración con el envío original
     * Actualiza el movimiento de envío para marcarlo como retornado
     */
    vincularRetornoConEnvio(envioId: string, retornoId: string): Observable<any> {
        return from(this._api.post('herramientas/movements/linkCalibrationReturn', {
            envio_id: envioId,
            retorno_id: retornoId
        })).pipe(
            switchMap((response: any) => of(response?.datos || {}))
        );
    }

    /**
     * Obtener el próximo número correlativo para notas de envío de calibración
     * Formato: EC-XXX/YYYY
     */
    getNextEnvioCalibrationNumber(): Observable<string> {
        const year = new Date().getFullYear();

        return from(this._api.post('herramientas/movements/getNextCorrelative', {
            type: 'calibration_send',
            prefix: 'EC',
            year: year
        })).pipe(
            switchMap((response: any) => {
                const number = response?.numero || 1;
                return of(`EC-${String(number).padStart(3, '0')}/${year}`);
            })
        );
    }

    /**
     * Obtener el próximo número correlativo para notas de retorno de calibración
     * Formato: RC-XXX/YYYY
     */
    getNextRetornoCalibrationNumber(): Observable<string> {
        const year = new Date().getFullYear();

        return from(this._api.post('herramientas/movements/getNextCorrelative', {
            type: 'calibration_return',
            prefix: 'RC',
            year: year
        })).pipe(
            switchMap((response: any) => {
                const number = response?.numero || 1;
                return of(`RC-${String(number).padStart(3, '0')}/${year}`);
            })
        );
    }

    /**
     * Obtener herramientas que requieren calibración (próximas a vencer o vencidas)
     * Para mostrar alertas y sugerencias de envío
     */
    getHerramientasRequierenCalibracion(diasAnticipacion: number = 30): Observable<any[]> {
        return from(this._api.post('herramientas/herramientas/listRequierenCalibracion', {
            start: 0,
            limit: 100,
            dias_anticipacion: diasAnticipacion
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Métodos específicos para flujo de RECEPCIÓN / DEVOLUCIÓN
    // -----------------------------------------------------------------------------------------------------

    /**
     * Procesa la recepción de herramientas devueltas.
     * Crea el movimiento 'entry/return', actualiza tloan_items y ttools atómicamente.
     * Condición DAÑADO/IRREPARABLE → ttools.status = 'quarantine'
     * Condición BUENO/REQUIERE_CALIBRACION → ttools.status = 'available'
     */
    procesarRecepcion(data: {
        movementNumber: string;
        date: string;
        responsablePerson: string;
        recipient: string;
        notes: string;
        items: {
            toolId: string;
            loanItemId?: string;
            quantity: number;
            condicion: string;
            notes: string;
            fechaDevolucion: string;
        }[];
    }): Observable<any> {
        return from(this._api.post('herramientas/recepcionHerramientas/procesarRecepcion', {
            estado_reg: 'activo',
            movement_number: data.movementNumber,
            type: 'entry',
            status: 'completed',
            date: data.date,
            entry_reason: 'return',
            responsible_person: data.responsablePerson,
            recipient: data.recipient,
            notes: data.notes,
            items: data.items
        })).pipe(
            switchMap((response: any) => of(response?.datos || {}))
        );
    }

    /**
     * Lista herramientas prestadas pendientes de retorno para un funcionario.
     */
    getHerramientasPrestadas(filters?: {
        funcionarioId?: string;
        loanNumber?: string;
        codigoHerramienta?: string;
    }): Observable<any[]> {
        return from(this._api.post('herramientas/recepcionHerramientas/getHerramientasPrestadas', {
            start: 0,
            limit: 200,
            returned: false,
            ...filters
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Obtiene los datos completos de una devolución para generar la constancia.
     */
    getConstanciaDevolucion(idMovement: string): Observable<any> {
        return from(this._api.post('herramientas/recepcionHerramientas/getConstanciaDevolucion', {
            id_movement: idMovement
        })).pipe(
            switchMap((response: any) => of(response?.datos?.[0] || {}))
        );
    }

    /**
     * Número correlativo siguiente para notas de devolución: DR-XXX/YYYY
     */
    getNextDevolucionNumber(): Observable<string> {
        const year = new Date().getFullYear();
        return from(this._api.post('herramientas/recepcionHerramientas/getNextDevolucionNumber', {})).pipe(
            switchMap((response: any) => {
                const num = response?.datos?.[0]?.next_number || 1;
                return of(`DR-${String(num).padStart(3, '0')}/${year}`);
            })
        );
    }

    /**
     * Actualizar estado de calibración de una herramienta después del retorno
     */
    actualizarEstadoCalibracion(toolId: string, data: {
        fechaCalibracion: string;
        fechaVencimiento: string;
        nroCertificado: string;
        resultado: 'APROBADO' | 'RECHAZADO' | 'CONDICIONAL';
        ubicacionDestino: string;
    }): Observable<any> {
        return from(this._api.post('herramientas/herramientas/updateCalibracion', {
            tool_id: toolId,
            ...data
        })).pipe(
            switchMap((response: any) => of(response?.datos || {}))
        );
    }

    /**
     * Obtener historial de calibraciones de una herramienta
     */
    getHistorialCalibracion(toolId: string): Observable<any[]> {
        return from(this._api.post('herramientas/calibraciones/historial', {
            tool_id: toolId,
            start: 0,
            limit: 50
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }
}
