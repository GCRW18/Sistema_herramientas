import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject, tap } from 'rxjs';
import { Movement, MovementVoucher } from '../models';

@Injectable({ providedIn: 'root' })
export class MovementService {
    private _httpClient = inject(HttpClient);
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
        return this._httpClient.get<Movement[]>('api/movements', { params: filters }).pipe(
            tap((movements) => {
                this._movements.next(movements);
            })
        );
    }

    /**
     * Get movement by id
     */
    getMovementById(id: string): Observable<Movement> {
        return this._httpClient.get<Movement>(`api/movements/${id}`).pipe(
            tap((movement) => {
                this._movement.next(movement);
            })
        );
    }

    /**
     * Get movements by tool
     */
    getMovementsByTool(toolId: string): Observable<Movement[]> {
        return this._httpClient.get<Movement[]>(`api/tools/${toolId}/movements`);
    }

    /**
     * Get entries
     */
    getEntries(): Observable<Movement[]> {
        return this.getMovements({ type: 'entry' });
    }

    /**
     * Get exits
     */
    getExits(): Observable<Movement[]> {
        return this.getMovements({ type: 'exit' });
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
            return this.createTransfer(movement);
        }
    }

    /**
     * Create entry movement
     */
    createEntry(movement: Partial<Movement>): Observable<Movement> {
        return this._httpClient.post<Movement>('api/movements/entries', movement);
    }

    /**
     * Create exit movement
     */
    createExit(movement: Partial<Movement>): Observable<Movement> {
        return this._httpClient.post<Movement>('api/movements/exits', movement);
    }

    /**
     * Create transfer movement
     */
    createTransfer(movement: Partial<Movement>): Observable<Movement> {
        return this._httpClient.post<Movement>('api/movements/transfers', movement);
    }

    /**
     * Update movement
     */
    updateMovement(id: string, movement: Partial<Movement>): Observable<Movement> {
        return this._httpClient.put<Movement>(`api/movements/${id}`, movement);
    }

    /**
     * Approve movement
     */
    approveMovement(id: string): Observable<Movement> {
        return this._httpClient.post<Movement>(`api/movements/${id}/approve`, {});
    }

    /**
     * Complete movement
     */
    completeMovement(id: string): Observable<Movement> {
        return this._httpClient.post<Movement>(`api/movements/${id}/complete`, {});
    }

    /**
     * Cancel movement
     */
    cancelMovement(id: string, reason: string): Observable<Movement> {
        return this._httpClient.post<Movement>(`api/movements/${id}/cancel`, { reason });
    }

    /**
     * Generate voucher
     */
    generateVoucher(id: string): Observable<MovementVoucher> {
        return this._httpClient.get<MovementVoucher>(`api/movements/${id}/voucher`);
    }

    /**
     * Get movement history for a tool
     */
    getToolMovementHistory(toolId: string): Observable<Movement[]> {
        return this._httpClient.get<Movement[]>(`api/movements/tool/${toolId}`);
    }
}
