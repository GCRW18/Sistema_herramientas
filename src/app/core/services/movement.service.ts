import { Injectable, inject } from '@angular/core';
import { catchError, from, map, Observable, of, switchMap } from 'rxjs';
import { Movement } from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class MovementService {
    private _api = inject(ErpApiService);
    private _personalPromise: Promise<any[]> | null = null;

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
            switchMap((response: any) => of(response?.datos || response?.data || []))
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
     * Get herramientas disponibles
     */
    getHerramientasDisponibles(filters?: any): Observable<any[]> {
        return from(this._api.post('herramientas/tools/listTools', {
            start: 0,
            limit: 2000,
            ...filters
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
            this._personalPromise = (this._api.post('herramientas/employees/listarFuncionarios', {
                start: 0,
                limit: 5000,
                sort: 'full_name',
                dir: 'asc'
            }) as Promise<any>).then((response: any) => {
                const raw: any[] = response?.datos || response?.data || [];
                const mapped = raw.map((emp: any) => ({
                    id:               emp.id_usuario || emp.id_employee || emp.id,
                    id_employee:      emp.id_usuario || emp.id_employee || emp.id,
                    licencia:         emp.license_number || '',
                    nro_licencia:     emp.license_number || '',
                    nombreCompleto:   emp.full_name ||
                                      `${emp.apellido_paterno || emp.paternal_last_name || ''} ${emp.apellido_materno || emp.maternal_last_name || ''} ${emp.nombre || emp.first_name || ''}`.trim(),
                    nombre:           emp.nombre || emp.first_name || '',
                    apellido_paterno: emp.apellido_paterno || emp.paternal_last_name || '',
                    apellido_materno: emp.apellido_materno || emp.maternal_last_name || '',
                    cargo:            emp.cargo || emp.employee_type || emp.cuenta || '',
                    departamento:     emp.area || '',
                    area:             emp.area || '',
                    active:           emp.active === true || emp.active === 't' || emp.active === 'true' || true
                }));
                if (mapped.length === 0) this._personalPromise = null;
                return mapped;
            });
        }
        return from(this._personalPromise);
    }

    /**
     * Get bases operativas list
     */
    getBases(): Observable<any[]> {
        return from(this._api.post('parametros/Lugar/listarLugar', {
            start: 0,
            limit: 100,
            par_filtro: 'lug.codigo#lug.nombre',
            es_regional: 'si',
            query: ''
        })).pipe(
            switchMap((response: any) => {
                const rows = response?.ROOT?.datos || response?.datos || response?.data || (Array.isArray(response) ? response : []);
                const mapped = rows.map((b: any) => ({
                    ...b,
                    id:      b.id_lugar,
                    id_lugar: b.id_lugar,
                    nombre:  b.nombre,
                    codigo:  b.codigo,
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
     * Lee el correlativo actual sin incrementarlo y retorna el SIGUIENTE número formateado.
     * Útil para preview antes de guardar (ej: "ENV-5/2026").
     */
    getSiguienteCorrelativoPreview(prefijo: string): Observable<string> {
        const anio = new Date().getFullYear();
        return from(this._api.post('herramientas/correlativos/listarCorrelativos', { start: 0, limit: 200 })).pipe(
            switchMap((response: any) => {
                const lista: any[] = response?.ROOT?.datos || response?.datos || response?.data || (Array.isArray(response) ? response : []);
                const row = lista.find((r: any) => r.prefijo === prefijo && Number(r.anio) === anio);
                const siguiente = row ? (Number(row.ultimo_numero) + 1) : 1;
                return of(`${prefijo}-${siguiente}/${anio}`);
            }),
            catchError(() => of(`${prefijo}-?/${anio}`))
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

    // ─── Categorías de ingresos (he.tcategories) ──────────────────────────────

    getIngresosCategories(): Observable<{ id_category: number; name: string; code: string; active: boolean }[]> {
        return from(this._api.post('herramientas/categories/listCategories', {
            start: 0, limit: 200, sort: 'display_order', dir: 'asc'
        })).pipe(
            map((r: any) => {
                const data = r?.ROOT?.datos ?? r?.datos ?? r?.data ?? [];
                return (Array.isArray(data) ? data : []).filter((c: any) => c.active !== false);
            }),
            catchError(() => of([]))
        );
    }

    createIngresosCategory(name: string): Observable<any> {
        const upper = name.trim().toUpperCase();
        return from(this._api.post('herramientas/categories/insertCategory', {
            name: upper,
            code: upper.replace(/\s+/g, '_'),
            description: '',
            color: 'bg-gray-600',
            icon: 'category',
            display_order: 0,
            is_fixed: false,
            parent_category_id: null,
            level: 1,
            has_children: false,
            active: true
        })).pipe(catchError(err => { throw err; }));
    }

    deleteIngresosCategory(id_category: number): Observable<any> {
        return from(this._api.post('herramientas/categories/deleteCategory', { id_category }))
            .pipe(catchError(err => { throw err; }));
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

    /**
     * Obtener préstamos activos (herramientas no devueltas) desde tloans + tloan_items + ttools.
     * Retorna array de loans, cada uno con propiedad items[] conteniendo los datos de la herramienta.
     */
    getActiveLoans(params?: { filtro_adicional?: string; [key: string]: any }): Observable<any[]> {
        const { filtro_adicional, ...rest } = params || {};
        const postParams: any = { start: 0, limit: 200, sort: 'id_loan', dir: 'desc', ...rest };
        if (filtro_adicional) { postParams.filtro_adicional = filtro_adicional; }
        return from(this._api.post('herramientas/movements/listarLoans', postParams)).pipe(
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
                const datos = (response?.datos || response?.data)?.[0] || response?.datos || response?.data || {};
                // pxp devuelve ROOT.error=false incluso cuando la función SQL falla;
                // el error real queda en datos.error='true' / datos.mensaje
                if (datos?.error === 'true' || datos?.error === true) {
                    throw new Error(datos.mensaje || 'Error al registrar el retorno');
                }
                if (!datos?.movement_number) {
                    throw new Error(datos?.mensaje || 'El retorno no pudo registrarse');
                }
                return of(datos);
            })
        );
    }

    /**
     * Registrar traspaso de herramientas a otra area/departamento.
     * Genera correlativo TRP automaticamente, inserta cabecera + items y decrementa stock.
     * transfer_type: TEMPORAL | PERMANENTE | REASIGNACION | PRESTAMO
     * expected_return_date: fecha esperada de retorno (requerida para TEMPORAL y PRESTAMO)
     * received_by_name: nombre del funcionario que recibe en destino
     */
    registrarTraspasoOtraArea(data: {
        date: string;
        time: string;
        source_warehouse_id?: number;
        responsible_person: string;
        received_by_name?: string;
        department: string;
        exit_reason: string;
        authorized_by?: string;
        transfer_type?: string;
        expected_return_date?: string;
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
     * Obtiene valores de he.tparametros filtrados por categoria.
     * Retorna array de strings con los valores (campo "valor").
     */
    getParametrosPorCategoria(categoria: string): Observable<string[]> {
        return from(this._api.post('herramientas/parametros/listarParametros', {
            start: 0, limit: 200,
            sort: 'nombre', dir: 'asc',
            filtro: `par.categoria = '${categoria}' AND par.active = true AND par.estado_reg = 'activo'`
        })).pipe(
            switchMap((response: any) => {
                const rows: any[] = response?.datos || response?.data || [];
                return of(rows.map(r => r.valor || r.nombre).filter(Boolean));
            }),
            catchError(() => of([]))
        );
    }

    listarMovimientosCompletados(params?: { limit?: number; start?: number }): Observable<any[]> {
        return from(this._api.post('herramientas/movements/listarMovimientosCompletados', {
            start: params?.start ?? 0,
            limit: params?.limit ?? 200
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    cerrarMovimiento(idMovement: number): Observable<any> {
        return from(this._api.post('herramientas/movements/cerrarMovimiento', { id_movement: idMovement })).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response.mensaje || 'Error al cerrar el movimiento');
                const datos = (response?.datos || response?.data)?.[0] || response?.datos || response?.data || {};
                if (datos?.error === 'true' || datos?.error === true) {
                    throw new Error(datos.mensaje || 'Error al cerrar el movimiento');
                }
                return of(datos);
            })
        );
    }

    /**
     * Lista envíos activos (ENVIO_BASE y TRASPASO) pendientes de retorno.
     * Devuelve: movement_number, movement_type_label, send_date, expected_return_date,
     * days_remaining, alert_status (VENCIDO/VENCE_HOY/PROXIMO/EN_PLAZO/SIN_FECHA),
     * items_count, source/destination warehouse names.
     */
    listarEnviosActivos(params?: { limit?: number; start?: number }): Observable<any[]> {
        return from(this._api.post('herramientas/movements/listarEnviosActivos', {
            start: params?.start ?? 0,
            limit: params?.limit ?? 200
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }
}
