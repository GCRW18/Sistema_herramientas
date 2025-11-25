import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap } from 'rxjs';
import {
    RosterAssignment,
    RosterFilters,
    RosterStats,
    AssignmentHistory,
    AvailabilityStatus,
    EmployeeRosterSummary,
    RosterAssignmentForm,
    RosterReturnForm
} from '../models/roster.types';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class RosterService {
    private _api = inject(ErpApiService);
    private _assignments: ReplaySubject<RosterAssignment[]> = new ReplaySubject<RosterAssignment[]>(1);
    private _assignment: ReplaySubject<RosterAssignment> = new ReplaySubject<RosterAssignment>(1);
    private _stats: ReplaySubject<RosterStats> = new ReplaySubject<RosterStats>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for assignments
     */
    get assignments$(): Observable<RosterAssignment[]> {
        return this._assignments.asObservable();
    }

    /**
     * Getter for assignment
     */
    get assignment$(): Observable<RosterAssignment> {
        return this._assignment.asObservable();
    }

    /**
     * Getter for stats
     */
    get stats$(): Observable<RosterStats> {
        return this._stats.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all assignments with optional filters
     */
    getAssignments(filters?: RosterFilters): Observable<RosterAssignment[]> {
        const params: any = {
            start: 0,
            limit: 50,
            sort: 'assignment_date',
            dir: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/roster_assignments/listAssignments', params)).pipe(
            switchMap((response: any) => {
                const assignments = response?.datos || [];
                this._assignments.next(assignments);
                return of(assignments);
            })
        );
    }

    /**
     * Get assignment by id
     */
    getAssignmentById(id: string): Observable<RosterAssignment> {
        return from(this._api.post('herramientas/roster_assignments/listAssignments', {
            start: 0,
            limit: 1,
            id_asignacion: id
        })).pipe(
            switchMap((response: any) => {
                const assignment = response?.datos?.[0] || null;
                if (assignment) {
                    this._assignment.next(assignment);
                }
                return of(assignment);
            })
        );
    }

    /**
     * Create assignment
     */
    createAssignment(data: RosterAssignmentForm): Observable<RosterAssignment> {
        return from(this._api.post('herramientas/roster_assignments/insertAssignment', data)).pipe(
            switchMap((response: any) => {
                const assignment = response?.datos || data;
                this._assignment.next(assignment as RosterAssignment);
                return of(assignment);
            })
        );
    }

    /**
     * Update assignment
     */
    updateAssignment(id: string, data: Partial<RosterAssignmentForm>): Observable<RosterAssignment> {
        return from(this._api.post('herramientas/roster_assignments/updateAssignment', {
            ...data,
            id_asignacion: id
        })).pipe(
            switchMap((response: any) => {
                const updatedAssignment = response?.datos || data;
                this._assignment.next(updatedAssignment as RosterAssignment);
                return of(updatedAssignment);
            })
        );
    }

    /**
     * Delete assignment
     */
    deleteAssignment(id: string): Observable<void> {
        return from(this._api.post('herramientas/roster_assignments/deleteAssignment', {
            id_asignacion: id
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }

    /**
     * Return assignment (mark as returned)
     */
    returnAssignment(data: RosterReturnForm): Observable<RosterAssignment> {
        return from(this._api.post('herramientas/roster_assignments/returnAssignment', data)).pipe(
            switchMap((response: any) => {
                const assignment = response?.datos || {};
                this._assignment.next(assignment);
                return of(assignment);
            })
        );
    }

    /**
     * Extend assignment (update expected return date)
     */
    extendAssignment(id: string, newExpectedReturnDate: string, notes?: string): Observable<RosterAssignment> {
        return from(this._api.post('herramientas/roster_assignments/extendAssignment', {
            id_asignacion: id,
            expected_return_date: newExpectedReturnDate,
            notes: notes
        })).pipe(
            switchMap((response: any) => {
                const assignment = response?.datos || {};
                this._assignment.next(assignment);
                return of(assignment);
            })
        );
    }

    /**
     * Get active assignments for an employee
     */
    getEmployeeActiveAssignments(employeeId: string): Observable<RosterAssignment[]> {
        return from(this._api.post('herramientas/roster_assignments/listActiveAssignments', {
            id_funcionario: employeeId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get assignment history for an employee
     */
    getEmployeeAssignmentHistory(employeeId: string): Observable<RosterAssignment[]> {
        return from(this._api.post('herramientas/roster_assignments/listAssignments', {
            start: 0,
            limit: 100,
            id_funcionario: employeeId,
            sort: 'assignment_date',
            dir: 'desc'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get assignment history for a specific assignment
     */
    getAssignmentHistory(assignmentId: string): Observable<AssignmentHistory[]> {
        return from(this._api.post('herramientas/roster_assignments/getAssignmentHistory', {
            id_asignacion: assignmentId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get roster statistics
     */
    getStats(): Observable<RosterStats> {
        return from(this._api.post('herramientas/roster_assignments/getAssignmentStats', {})).pipe(
            switchMap((response: any) => {
                const stats = response?.datos || {};
                this._stats.next(stats);
                return of(stats);
            })
        );
    }

    /**
     * Get overdue assignments
     */
    getOverdueAssignments(): Observable<RosterAssignment[]> {
        return from(this._api.post('herramientas/roster_assignments/listOverdueAssignments', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Check availability of tool or kit
     */
    checkAvailability(type: 'tool' | 'kit', id: string): Observable<AvailabilityStatus> {
        return from(this._api.post('herramientas/roster_assignments/getAvailability', {
            tipo: type,
            id_item: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Get available tools for assignment
     */
    getAvailableTools(): Observable<AvailabilityStatus[]> {
        return from(this._api.post('herramientas/roster_assignments/getAvailability', {
            tipo: 'tool'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get available kits for assignment
     */
    getAvailableKits(): Observable<AvailabilityStatus[]> {
        return from(this._api.post('herramientas/roster_assignments/getAvailability', {
            tipo: 'kit'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get employee roster summary
     */
    getEmployeeRosterSummary(employeeId: string): Observable<EmployeeRosterSummary> {
        return from(this._api.post('herramientas/roster_assignments/getEmployeeSummary', {
            id_funcionario: employeeId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Get all employees roster summaries
     */
    getAllEmployeesSummaries(): Observable<EmployeeRosterSummary[]> {
        return from(this._api.post('herramientas/roster_assignments/getAllEmployeesSummaries', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get assignments by aircraft
     */
    getAssignmentsByAircraft(aircraftId: string): Observable<RosterAssignment[]> {
        return from(this._api.post('herramientas/roster_assignments/listAssignments', {
            start: 0,
            limit: 100,
            id_aircraft: aircraftId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get assignments by work order
     */
    getAssignmentsByWorkOrder(workOrderNumber: string): Observable<RosterAssignment[]> {
        return from(this._api.post('herramientas/roster_assignments/listAssignments', {
            start: 0,
            limit: 100,
            nro_orden_trabajo: workOrderNumber
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get assignments by shift
     */
    getAssignmentsByShift(shift: string, date?: string): Observable<RosterAssignment[]> {
        const params: any = {
            start: 0,
            limit: 100,
            turno: shift
        };
        if (date) {
            params.fecha = date;
        }

        return from(this._api.post('herramientas/roster_assignments/listAssignments', params)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Export assignments to CSV/Excel
     */
    exportAssignments(filters?: RosterFilters, format: 'csv' | 'excel' = 'csv'): Observable<Blob> {
        const params: any = {
            formato: format,
            ...filters
        };

        // This would need to be handled differently - PXP might not support blob responses
        // You might need to return a file URL instead
        return from(this._api.post('herramientas/roster_assignments/exportAssignments', params)).pipe(
            switchMap((response: any) => {
                // Handle file download URL from response
                return of(new Blob());
            })
        );
    }
}
