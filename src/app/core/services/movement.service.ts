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
     * Get all entries
     */
    getMovements(filters?: any): Observable<Movement[]> {
        const params = {
            start: 0,
            limit: 50,
            sort: 'fecha_entrada',
            dir: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/Entrada/listarEntrada', params)).pipe(
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
        return from(this._api.post('herramientas/Entrada/listarEntrada', {
            start: 0,
            limit: 1,
            id_entrada: id
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
        return from(this._api.post('herramientas/Entrada/listarEntrada', {
            start: 0,
            limit: 50,
            id_herramienta: toolId
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
        return this.getMovements();
    }

    /**
     * Get exits
     */
    getExits(): Observable<Movement[]> {
        return from(this._api.post('herramientas/Salida/listarSalida', {
            start: 0,
            limit: 50,
            sort: 'fecha_salida',
            dir: 'desc'
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
        if (movement.type === 'entry' || movement.type?.startsWith('entry_')) {
            return this.createEntry(movement);
        } else if (movement.type === 'exit' || movement.type?.startsWith('exit_')) {
            return this.createExit(movement);
        } else {
            return this.createEntry(movement);
        }
    }

    /**
     * Create entry movement
     */
    createEntry(movement: Partial<Movement>): Observable<Movement> {
        return from(this._api.post('herramientas/Entrada/insertarEntrada', movement)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || movement);
            })
        );
    }

    /**
     * Create exit movement
     */
    createExit(movement: Partial<Movement>): Observable<Movement> {
        return from(this._api.post('herramientas/Salida/insertarSalida', movement)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || movement);
            })
        );
    }

    /**
     * Create transfer movement
     */
    createTransfer(movement: Partial<Movement>): Observable<Movement> {
        return this.createEntry(movement);
    }

    /**
     * Update movement
     */
    updateMovement(id: string, movement: Partial<Movement>): Observable<Movement> {
        return from(this._api.post('herramientas/Entrada/insertarEntrada', {
            ...movement,
            id_entrada: id
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
        return from(this._api.post('herramientas/Entrada/aprobarEntrada', {
            id_entrada: id
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
        return from(this._api.post('herramientas/Entrada/completarEntrada', {
            id_entrada: id
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
        return from(this._api.post('herramientas/Entrada/cancelarEntrada', {
            id_entrada: id,
            motivo_cancelacion: reason
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
        return from(this._api.post('herramientas/Comprobante/listarComprobante', {
            id_entrada: id
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
        return from(this._api.post('herramientas/Entrada/listarEntradasPendientes', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get entries by status
     */
    getEntriesByStatus(status: string): Observable<Movement[]> {
        return from(this._api.post('herramientas/Entrada/listarEntradaPorEstado', {
            estado: status
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }
}
