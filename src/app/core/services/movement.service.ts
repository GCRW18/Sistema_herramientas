import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, from, Observable, of, ReplaySubject, switchMap, tap } from 'rxjs';
import { Movement, MovementVoucher, CreateMovement } from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class MovementService {
    private _api = inject(ErpApiService);
    private _movements: ReplaySubject<Movement[]> = new ReplaySubject<Movement[]>(1);
    private _movement: ReplaySubject<Movement> = new ReplaySubject<Movement>(1);
    private _personalPromise: Promise<any[]> | null = null;

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

        return from(this._api.post('herramientas/movements/listarMovements', params)).pipe(
            switchMap((response: any) => {
                const movements = response?.datos || response?.data || [];
                this._movements.next(movements);
                return of(movements);
            })
        );
    }

    /**
     * Get movement by id
     */
    getMovementById(id: string): Observable<Movement> {
        return from(this._api.post('herramientas/movements/listarMovements', {
            start: 0,
            limit: 1,
            id_movement: id
        })).pipe(
            switchMap((response: any) => {
                const movement = response?.datos || response?.data?.[0] || null;
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
        return from(this._api.post('herramientas/movements/listarMovementssByTool', {
            tool_id: toolId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response?.data || []);
            })
        );
    }

    /**
     * Get entries
     */
    getEntries(): Observable<Movement[]> {
        return from(this._api.post('herramientas/movements/listarMovements', {
            start: 0,
            limit: 50,
            sort: 'date',
            dir: 'desc',
            movement_type: 'entry'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response?.data || []);
            })
        );
    }

    /**
     * Get exits
     */
    getExits(): Observable<Movement[]> {
        return from(this._api.post('herramientas/movements/listarMovements', {
            start: 0,
            limit: 50,
            sort: 'date',
            dir: 'desc',
            movement_type: 'exit'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response?.data || []);
            })
        );
    }

    /** Convert camelCase keys to snake_case so pxp can map them to DB columns */
    private toSnake(obj: any): any {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
            result[snakeKey] = obj[key];
        }
        return result;
    }

    /**
     * Create movement (generic method)
     */
    createMovement(movement: Partial<Movement>): Observable<Movement> {
        // Translate camelCase → snake_case so pxp maps fields to DB columns correctly
        const payload: any = this.toSnake({ ...movement });

        // Remove optional date fields if null/empty so pxp doesn't receive "null" strings
        const optionalDateFields = ['calibration_expiration', 'calibration_date', 'expected_return_date',
                                    'actual_return_date', 'effective_date'];
        optionalDateFields.forEach(field => {
            if (payload[field] === '' || payload[field] === undefined || payload[field] === null) {
                delete payload[field];
            }
        });

        console.log('=== PAYLOAD SNAKE_CASE ENVIADO A insertarMovements ===', JSON.stringify(payload, null, 2));

        return from(this._api.post('herramientas/movements/insertarMovements', payload)).pipe(
            switchMap((response: any) => {
                console.log('=== RESPUESTA insertarMovements ===', response);
                if (response?.error) {
                    console.error('=== ERROR EN RESPUESTA ===', response);
                    throw new Error(response.mensaje || 'Error al guardar el movimiento');
                }
                return of(response?.datos || response?.data || movement);
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
        return from(this._api.post('herramientas/movements/insertarMovements', {
            ...this.toSnake(movement),
            id_movement: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response?.data || movement);
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
                return of(response?.datos || response?.data || {});
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
                return of(response?.datos || response?.data || {});
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
                return of(response?.datos || response?.data || {});
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
                return of(response?.datos || response?.data?.[0] || {});
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
                return of(response?.datos || response?.data || []);
            })
        );
    }

    /**
     * Get entries by status
     */
    getEntriesByStatus(status: string): Observable<Movement[]> {
        return from(this._api.post('herramientas/movements/listarMovementssByStatus', {
            status: status,
            movement_type: 'entry'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response?.data || []);
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
        return from(this._api.post('herramientas/movements/listarMovementssByStatus', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || response?.data || []);
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
                return of(response?.datos || response?.data || []);
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
        const isEntradas = filtros?.movement_type === 'entry';
        const endpoint   = isEntradas
            ? 'herramientas/movements/listarEntradas'
            : 'herramientas/movements/listarMovements';

        const params = {
            start: ((filtros?.page || 1) - 1) * (filtros?.limit || 25),
            limit: filtros?.limit || 25,
            sort: 'date',
            dir: 'desc',
            ...filtros
        };

        return from(this._api.post(endpoint, params)).pipe(
            switchMap((response: any) => of({
                data: response?.datos || response?.data || [],
                total: response?.total || 0
            }))
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Métodos auxiliares para formularios
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get proveedores
     */
    getProveedores(): Observable<any[]> {
        return from(this._api.post('herramientas/suppliers/listarSuppliers', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of((response?.datos || response?.data || []).map((s: any) => ({
                ...s,
                id:     s.id     ?? s.id_supplier,
                nombre: s.nombre ?? s.name,
                nit:    s.nit    ?? s.tax_id
            }))))
        );
    }

    /**
     * Get herramientas disponibles
     */
    getHerramientasDisponibles(filters?: any): Observable<any[]> {
        return from(this._api.post('herramientas/tools/listTools', {
            start: 0,
            limit: 500,
            ...filters
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Get almacenes
     */
    getAlmacenes(): Observable<any[]> {
        return from(this._api.post('herramientas/warehouses/listarWarehouses', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of((response?.datos || response?.data || []).map((w: any) => ({
                ...w,
                id: w.id ?? w.id_warehouse,
                nombre: w.nombre ?? w.name,
                codigo: w.codigo ?? w.code
            }))))
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
            switchMap((response: any) => of(response?.datos || response?.data || []))
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
            switchMap((response: any) => of(response?.datos || response?.data || []))
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
        return from(this._api.post('herramientas/movements/listarMovements', {
            start: 0,
            limit: limit,
            sort: 'date',
            dir: 'desc',
            movement_type: 'entry'
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Get recent exits (for sidebar)
     */
    getRecentExits(limit: number = 5): Observable<Movement[]> {
        return from(this._api.post('herramientas/movements/listarMovements', {
            start: 0,
            limit: limit,
            sort: 'date',
            dir: 'desc',
            movement_type: 'exit'
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Get personal/personnel list (uses employees table).
     * La Promise se crea una sola vez: N componentes concurrentes comparten
     * el mismo request HTTP en vez de disparar N requests independientes.
     */
    getPersonal(): Observable<any[]> {
        if (!this._personalPromise) {
            this._personalPromise = (this._api.post('herramientas/employees/listarEmployees', {
                start: 0,
                limit: 100,
                sort: 'full_name',
                dir: 'asc'
            }) as Promise<any>).then((response: any) => {
                const data = response?.datos || response?.data || [];
                return data.map((emp: any) => ({
                    id:               emp.id_employee || emp.id,
                    id_employee:      emp.id_employee || emp.id,
                    licencia:         emp.license_number || '',
                    nro_licencia:     emp.license_number || '',
                    nombreCompleto:   emp.full_name || `${emp.first_name || ''} ${emp.paternal_last_name || ''} ${emp.maternal_last_name || ''}`.trim(),
                    nombre:           emp.first_name || '',
                    apellido_paterno: emp.paternal_last_name || '',
                    apellido_materno: emp.maternal_last_name || '',
                    cargo:            emp.cargo || emp.employee_type || '',
                    departamento:     emp.area || '',
                    area:             emp.area || '',
                    active:           emp.active
                }));
            });
        }
        return from(this._personalPromise);
    }

    /** Invalida el caché de personal (llamar tras crear/editar/eliminar un empleado) */
    clearPersonalCache(): void {
        this._personalPromise = null;
    }

    /**
     * Get departamentos list
     */
    getDepartamentos(): Observable<any[]> {
        return from(this._api.post('herramientas/departamentos/listar', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Get bases operativas list
     */
    getBases(): Observable<any[]> {
        return from(this._api.post('herramientas/bases/listarBases', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => {
                const rows = response?.ROOT?.datos || response?.datos || response?.data || (Array.isArray(response) ? response : []);
                const mapped = rows.map((b: any) => ({
                    ...b,
                    id: b.id ?? b.id_base,
                    nombre: b.nombre ?? b.name,
                    codigo: b.codigo ?? b.code,
                    ciudad: b.ciudad ?? b.city
                }));
                const seen = new Set();
                return of(mapped.filter((b: any) => {
                    if (seen.has(b.id)) return false;
                    seen.add(b.id);
                    return true;
                }));
            })
        );
    }

    /**
     * Get items of a specific movement
     */
    getMovementItems(movementId: number): Observable<any[]> {
        return from(this._api.post('herramientas/movements/listarMovementItems', {
            movement_id: movementId,
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Get terceros/empresas externas list
     */
    getTerceros(): Observable<any[]> {
        return from(this._api.post('herramientas/customers/listarCustomers', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Get warehouses list (almacenes y bases operativas)
     */
    getWarehouses(): Observable<any[]> {
        return from(this._api.post('herramientas/warehouses/listarWarehouses', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => {
                const rows = response?.ROOT?.datos || response?.datos || response?.data || (Array.isArray(response) ? response : []);
                return of(rows.map((w: any) => ({
                    ...w,
                    id: w.id ?? w.id_warehouse,
                    nombre: w.nombre ?? w.name,
                    codigo: w.codigo ?? w.code
                })));
            })
        );
    }

    /**
     * Get funcionarios list (personal que puede recibir/entregar herramientas)
     */
    getFuncionarios(search?: string): Observable<any[]> {
        const params: any = { start: 0, limit: 30, sort: 'full_name', dir: 'asc' };
        if (search && search.trim().length >= 1) {
            params.search_term = search.trim();
        }
        return from(this._api.post('herramientas/employees/listarEmployees', params)).pipe(
            switchMap((response: any) => of((response?.datos || response?.data || []).map((f: any) => ({
                ...f,
                id: f.id ?? f.id_employee,
                nombre: f.nombre ?? f.full_name,
                cargo: f.cargo ?? f.role,
                area: f.area
            }))))
        );
    }

    /**
     * Registrar ingreso de nuevas herramientas por compra.
     * Crea el movimiento, los registros en ttools y los movement_items en una sola transacción.
     * items_json: [{code, name, brand, part_number, serial_number, quantity, purchase_price,
     *              unit_of_measure, condition, criticality_level, manufacture_origin,
     *              requires_calibration, calibration_interval, calibration_date, certificate_number}]
     */
    registrarNuevaCompra(data: {
        movement_number:     string;
        date:                string;
        responsible_person:  string;
        supplier?:           string;
        invoice_number?:     string;
        purchase_order?:     string;
        notes?:              string;
        warehouse_id?:       number;
        items_json:          string;
        received_by_name?:   string;
        [key: string]:       any;
    }): Observable<{ id_movement: number; movement_number: string }> {
        return from(this._api.post('herramientas/movements/registrarNuevaCompra', data)).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response.mensaje || 'Error al registrar compra');
                const datos = response?.datos || response?.data || {};
                if (datos?.error === 'true' || datos?.error === true) {
                    throw new Error(datos.mensaje || 'Error en el servidor');
                }
                return of(datos);
            })
        );
    }

    /**
     * Obtener marcas distintas registradas en ttools
     */
    getDistinctBrands(): Observable<string[]> {
        return from(this._api.post('herramientas/tools/listarTools', {
            start: 0,
            limit: 500,
            sort: 'brand',
            dir: 'asc'
        })).pipe(
            switchMap((response: any) => {
                const tools = response?.datos || response?.data || [];
                const brands = [...new Set(
                    tools.map((t: any) => t.brand || t.marca).filter((b: any) => b && b.trim())
                )] as string[];
                return of(brands.sort());
            })
        );
    }

    /**
     * Obtener el número del último código BOA-H registrado en ttools
     */
    getLastBoaCode(): Observable<number> {
        return from(this._api.post('herramientas/tools/listarTools', {
            start: 0,
            limit: 2000,
            sort: 'id_tool',
            dir: 'desc'
        })).pipe(
            switchMap((response: any) => {
                const tools = response?.datos || response?.data || [];
                let maxNum = 0;
                tools.forEach((t: any) => {
                    const match = String(t.code || '').match(/BOA-H-(\d+)/);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > maxNum) maxNum = num;
                    }
                });
                return of(maxNum);
            })
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

        return from(this._api.post('herramientas/movements/listarMovements', params)).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
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
            switchMap((response: any) => of(response?.datos || response?.data || {}))
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
     * Para mostrar dashboard-alertas y sugerencias de envío
     */
    getHerramientasRequierenCalibracion(diasAnticipacion: number = 30): Observable<any[]> {
        return from(this._api.post('herramientas/herramientas/listRequierenCalibracion', {
            start: 0,
            limit: 100,
            dias_anticipacion: diasAnticipacion
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
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
            switchMap((response: any) => of(response?.datos || response?.data || {}))
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
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Obtiene los datos completos de una devolución para generar la constancia.
     */
    getConstanciaDevolucion(idMovement: string): Observable<any> {
        return from(this._api.post('herramientas/recepcionHerramientas/getConstanciaDevolucion', {
            id_movement: idMovement
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data?.[0] || {}))
        );
    }

    /**
     * Número correlativo siguiente para notas de devolución: DR-XXX/YYYY
     */
    getNextDevolucionNumber(): Observable<string> {
        const year = new Date().getFullYear();
        return from(this._api.post('herramientas/recepcionHerramientas/getNextDevolucionNumber', {})).pipe(
            switchMap((response: any) => {
                const num = response?.datos || response?.data?.[0]?.next_number || 1;
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
            switchMap((response: any) => of(response?.datos || response?.data || {}))
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
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Obtener préstamos activos (herramientas no devueltas) desde tloans + tloan_items + ttools.
     * Retorna array de loans, cada uno con propiedad items[] conteniendo los datos de la herramienta.
     */
    getActiveLoans(params?: { filtro_adicional?: string; [key: string]: any }): Observable<any[]> {
        return from(this._api.post('herramientas/movements/listarLoans', {
            start: 0, limit: 200, sort: 'id_loan', dir: 'desc',
            ...params
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    getActiveLoanItems(params?: { filtro_adicional?: string; [key: string]: any }): Observable<any[]> {
        return from(this._api.post('herramientas/movements/listarLoanItems', {
            start: 0, limit: 1000, sort: 'id_loan_item', dir: 'asc',
            ...params
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    /**
     * Registrar préstamo de una herramienta a técnico interno o tercero.
     * Genera correlativo PT-N/YYYY (interno) o PTT-N/YYYY (externo).
     */
    registrarPrestamo(data: {
        id_tool: number;
        type: 'PRESTAMO_INTERNO' | 'PRESTAMO_EXTERNO';
        quantity: number;
        date: string;
        time: string;
        requested_by_name: string;
        technician?: string;
        authorized_by?: string;
        department?: string;
        aircraft?: string;
        work_order_number?: string;
        notes?: string;
        expected_return_date?: string;
        source_warehouse_id?: number;
        recipient?: string;
        [key: string]: any;
    }): Observable<{ id_movement: number; movement_number: string }> {
        return from(this._api.post('herramientas/movements/registrarPrestamo', data)).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response.mensaje || 'Error al registrar el préstamo');
                return of((response?.datos || response?.data)?.[0] || response?.datos || response?.data || {});
            })
        );
    }

    /**
     * Registrar prestamo de multiples herramientas en una sola transaccion.
     * Genera un unico correlativo PT-N/YYYY (interno) o PTT-N/YYYY (externo).
     * items_json: JSON.stringify([{tool_id, quantity, notes, condition}])
     */
    registrarPrestamoMultiple(data: {
        type: 'PRESTAMO_INTERNO' | 'PRESTAMO_EXTERNO';
        date: string;
        time: string;
        requested_by_name: string;
        technician?: string;
        authorized_by?: string;
        department?: string;
        aircraft?: string;
        aircraft_id?: number;
        work_order_number?: string;
        special_work?: boolean;
        notes?: string;
        expected_return_date?: string;
        source_warehouse_id?: number;
        recipient?: string;
        customer?: string;
        customer_id?: number;
        items_json: string;
        [key: string]: any;
    }): Observable<{ id_movement: number; movement_number: string; id_loan: number }> {
        return from(this._api.post('herramientas/movements/registrarPrestamoMultiple', data)).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response.mensaje || 'Error al registrar el préstamo');
                return of((response?.datos || response?.data)?.[0] || response?.datos || response?.data || {});
            })
        );
    }

    /**
     * Registrar devolucion de herramientas prestadas a tecnico BOA (interno) o tercero externo.
     * Genera correlativo DP-N/YYYY (interno) o DPE-N/YYYY (externo).
     * Incrementa stock, actualiza estado segun condicion y marca prestamo como DEVUELTO.
     * items_json: JSON.stringify([{tool_id, quantity, condicion, notes}])
     */
    registrarDevolucionPrestamo(data: {
        type: 'DEVOLUCION_PRESTAMO_INTERNO' | 'DEVOLUCION_PRESTAMO_EXTERNO';
        date: string;
        time: string;
        requested_by_name: string;
        responsible_person: string;
        recipient?: string;
        customer?: string;
        notes?: string;
        specific_observations?: string;
        items_json: string;
        [key: string]: any;
    }): Observable<{ id_movement: number; movement_number: string }> {
        return from(this._api.post('herramientas/movements/registrarDevolucionPrestamo', data)).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response.mensaje || 'Error al registrar la devolución');
                return of((response?.datos || response?.data)?.[0] || response?.datos || response?.data || {});
            })
        );
    }

    /**
     * Registrar ajuste de ingreso de herramientas existentes.
     * Genera correlativo AI-N/YYYY, incrementa stock en ttools.
     * items_json: JSON.stringify([{tool_id, quantity, condicion, notes}])
     */
    registrarAjusteIngreso(data: {
        date: string;
        time: string;
        responsible_person: string;
        authorized_by: string;
        document_number?: string;
        notes?: string;
        items_json: string;
    }): Observable<{ id_movement: number; movement_number: string }> {
        return from(this._api.post('herramientas/movements/registrarAjusteIngreso', data)).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response.mensaje || 'Error al registrar el ajuste');
                return of((response?.datos || response?.data)?.[0] || response?.datos || response?.data || {});
            })
        );
    }

    /**
     * Registrar retorno de multiples herramientas desde una base operativa o almacen remoto.
     * Genera correlativo RB-N/YYYY (base) o RTR-N/YYYY (traspaso).
     * Por cada item: incrementa stock y actualiza status segun condicion.
     * items_json: JSON.stringify([{tool_id, quantity, condicion, notes, serial_number, part_number}])
     */
    registrarRetornoBase(data: {
        type: 'RETORNO_BASE' | 'RETORNO_TRASPASO';
        date: string;
        time: string;
        requested_by_name: string;
        responsible_person: string;
        document_number: string;
        source_warehouse_id?: number;
        notes?: string;
        specific_observations?: string;
        items_json: string;
        [key: string]: any;
    }): Observable<{ id_movement: number; movement_number: string }> {
        return from(this._api.post('herramientas/movements/registrarRetornoBase', data)).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response.mensaje || 'Error al registrar el retorno');
                return of((response?.datos || response?.data)?.[0] || response?.datos || response?.data || {});
            })
        );
    }

    /**
     * Registrar traspaso de herramientas a otra area/departamento.
     * Genera correlativo TRP automaticamente, inserta cabecera + items y decrementa stock.
     */
    registrarTraspasoOtraArea(data: {
        date: string;
        time: string;
        source_warehouse_id?: number;
        responsible_person: string;
        department: string;
        exit_reason: string;
        authorized_by?: string;
        notes?: string;
        general_observations?: string;
        items_json: string;
        [key: string]: any;
    }): Observable<{ id_movement: number; movement_number: string }> {
        return from(this._api.post('herramientas/movements/registrarTraspasoOtraArea', data)).pipe(
            switchMap((response: any) => {
                if (response?.error) {
                    throw new Error(response.mensaje || 'Error al registrar el traspaso');
                }
                return of((response?.datos || response?.data)?.[0] || response?.datos || response?.data || {});
            })
        );
    }

    /**
     * Registrar envio de herramientas a otra base.
     * Genera correlativo ENV automaticamente, inserta cabecera + items y decrementa stock.
     * items: [{tool_id, quantity, condition_on_movement, serial_number, part_number, notes}]
     */
    registrarEnvioOtrasBases(data: {
        date: string;
        time: string;
        source_warehouse_id?: number;
        destination_warehouse_id?: number;
        requested_by_id?: number;
        requested_by_name: string;
        received_by_id?: number;
        received_by_name: string;
        responsible_person: string;
        department: string;
        document_number: string;
        notes: string;
        specific_observations: string;
        items_json: string;
        [key: string]: any;
    }): Observable<{ id_movement: number; movement_number: string }> {
        return from(this._api.post('herramientas/movements/registrarEnvioOtrasBases', data)).pipe(
            switchMap((response: any) => {
                if (response?.error) {
                    throw new Error(response.mensaje || 'Error al registrar el envío');
                }
                return of((response?.datos || response?.data)?.[0] || response?.datos || response?.data || {});
            })
        );
    }

    /**
     * Obtiene el historial completo de movimientos de una herramienta en los últimos N días.
     * Combina ítems de movimiento, calibraciones y mantenimientos en un timeline unificado.
     * Usa: getToolAuditHistory (movimientos), getCalibrationsByTool (calibraciones), getMaintenancesByTool (mantenimientos).
     * @param toolId ID numérico de la herramienta
     * @param days Número de días hacia atrás (defecto 90, máx 365)
     */
    getToolAuditHistory(toolId: number, days = 90): Observable<any[]> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const movItems$ = from(this._api.post('herramientas/movements/getToolAuditHistory', {
            tool_id: toolId, days, start: 0, limit: 200
        })).pipe(
            switchMap((r: any) => of((r?.datos || r?.data || []).map((item: any) => ({
                fecha: item.fecha_reg || '',
                tipo: 'MOVIMIENTO',
                subtipo: item.condition_on_movement || '-',
                comprobante: item.movement_id ? `MOV-${item.movement_id}` : '-',
                herramienta: item.code || '-',
                descripcion: item.description || '-',
                cantidad: item.quantity ?? 0,
                condicion: item.condition_on_movement || item.tool_status_snapshot || '-',
                responsable: item.usr_reg || '-',
                notas: item.notes || '',
                color: 'blue',
                source: 'movement_item'
            })))),
            catchError(() => of([]))
        );

        const calibrations$ = from(this._api.post('herramientas/calibrations/getCalibrationsByTool', {
            tool_id: toolId, days, start: 0, limit: 50
        })).pipe(
            switchMap((r: any) => of((r?.datos || r?.data || []).map((cal: any) => ({
                fecha: cal.send_date || cal.fecha_reg || '',
                tipo: 'CALIBRACIÓN',
                subtipo: cal.work_type === 'calibration_repair' ? 'CAL/REP' : (cal.work_type === 'repair' ? 'REPARACIÓN' : 'CALIBRACIÓN'),
                comprobante: cal.record_number || '-',
                herramienta: cal.tool_code || '-',
                descripcion: cal.tool_name || '-',
                cantidad: 1,
                condicion: cal.status || '-',
                responsable: cal.requested_by_name || cal.usr_reg || '-',
                notas: cal.notes || '',
                color: cal.work_type === 'calibration_repair' ? 'red' : 'amber',
                source: 'calibration'
            })))),
            catchError(() => of([]))
        );

        const maintenances$ = from(this._api.post('herramientas/maintenances/getMaintenancesByTool', {
            tool_id: toolId, days, start: 0, limit: 50
        })).pipe(
            switchMap((r: any) => of((r?.datos || r?.data || []).map((m: any) => ({
                fecha: m.send_date || m.fecha_reg || '',
                tipo: 'MANTENIMIENTO',
                subtipo: m.type || 'SERVICIO',
                comprobante: m.record_number || '-',
                herramienta: m.tool_code || '-',
                descripcion: m.tool_name || '-',
                cantidad: 1,
                condicion: m.status || '-',
                responsable: m.requested_by_name || m.usr_reg || '-',
                notas: m.description || m.notes || '',
                color: 'green',
                source: 'maintenance'
            })))),
            catchError(() => of([]))
        );

        return forkJoin([movItems$, calibrations$, maintenances$]).pipe(
            switchMap(([movs, cals, maints]: [any[], any[], any[]]) => {
                const all = [...movs, ...cals, ...maints]
                    .filter(item => {
                        if (!item.fecha) return true;
                        try { return new Date(item.fecha) >= cutoff; } catch { return true; }
                    })
                    .sort((a, b) => {
                        try { return new Date(b.fecha).getTime() - new Date(a.fecha).getTime(); } catch { return 0; }
                    });
                return of(all);
            })
        );
    }
}
