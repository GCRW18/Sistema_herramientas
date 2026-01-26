import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap } from 'rxjs';
import { Movement, MovementVoucher } from '../models';
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
    createEntry(movement: Partial<Movement>): Observable<Movement> {
        return this.createMovement({
            ...movement,
            type: movement.type || 'entry'
        });
    }

    /**
     * Create exit movement
     */
    createExit(movement: Partial<Movement>): Observable<Movement> {
        return this.createMovement({
            ...movement,
            type: movement.type || 'exit'
        });
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
    getHerramientasDisponibles(): Observable<any[]> {
        return from(this._api.post('herramientas/herramientas/listar', {
            start: 0,
            limit: 500,
            estado: 'activo'
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
}
