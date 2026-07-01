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

    get assignments$(): Observable<RosterAssignment[]> {
        return this._assignments.asObservable();
    }

    get assignment$(): Observable<RosterAssignment> {
        return this._assignment.asObservable();
    }

    get stats$(): Observable<RosterStats> {
        return this._stats.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private helpers — mapeo de payloads al contrato del backend (he.troster_assignments)
    // -----------------------------------------------------------------------------------------------------

    private _fromForm(data: Partial<RosterAssignmentForm>): any {
        return {
            assignment_type: data.assignmentType,
            tool_id: data.toolId,
            kit_id: data.kitId,
            employee_id: data.employeeId,
            aircraft_id: data.aircraftId,
            assignment_date: data.assignmentDate,
            expected_return_date: data.expectedReturnDate,
            shift: data.shift,
            purpose: data.purpose,
            work_order_number: data.workOrderNumber,
            notes: data.notes
        };
    }

    private _fromFilters(filters?: RosterFilters): any {
        if (!filters) return {};
        const params: any = {};
        if (filters.search) params.search = filters.search;
        if (filters.employeeId) params.employee_id = filters.employeeId;
        if (filters.aircraftId) params.aircraft_id = filters.aircraftId;
        if (filters.status) params.status = filters.status;
        if (filters.shift) params.shift = filters.shift;
        if (filters.assignmentType) params.assignment_type = filters.assignmentType;
        if (filters.dateFrom) params.date_from = filters.dateFrom;
        if (filters.dateTo) params.date_to = filters.dateTo;
        return params;
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
            ...this._fromFilters(filters)
        };

        return from(this._api.post('herramientas/roster_assignments/listAssignments', params)).pipe(
            switchMap((response: any) => {
                const assignments = response?.data || [];
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
            id_assignment: id
        })).pipe(
            switchMap((response: any) => {
                const assignment = response?.data?.[0] || null;
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
        return from(this._api.post('herramientas/roster_assignments/insertAssignment', this._fromForm(data))).pipe(
            switchMap((response: any) => {
                const assignment = response?.data || data;
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
            ...this._fromForm(data),
            id_assignment: id
        })).pipe(
            switchMap((response: any) => {
                const updatedAssignment = response?.data || data;
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
            id_assignment: id
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
        return from(this._api.post('herramientas/roster_assignments/returnAssignment', {
            id_assignment: data.assignmentId,
            actual_return_date: data.actualReturnDate,
            return_notes: data.returnNotes
        })).pipe(
            switchMap((response: any) => {
                const assignment = response?.data || {};
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
            id_assignment: id,
            expected_return_date: newExpectedReturnDate,
            notes: notes
        })).pipe(
            switchMap((response: any) => {
                const assignment = response?.data || {};
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
            start: 0,
            limit: 100,
            employee_id: employeeId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || []);
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
            employee_id: employeeId,
            sort: 'assignment_date',
            dir: 'desc'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || []);
            })
        );
    }

    /**
     * Get assignment history for a specific assignment
     */
    getAssignmentHistory(assignmentId: string): Observable<AssignmentHistory[]> {
        return from(this._api.post('herramientas/roster_assignments/getAssignmentHistory', {
            id_assignment: assignmentId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || []);
            })
        );
    }

    /**
     * Get roster statistics
     */
    getStats(): Observable<RosterStats> {
        return from(this._api.post('herramientas/roster_assignments/getAssignmentStats', {})).pipe(
            switchMap((response: any) => {
                const stats = response?.data?.[0] || response?.data || {};
                this._stats.next(stats);
                return of(stats);
            })
        );
    }

    /**
     * Get overdue assignments
     */
    getOverdueAssignments(): Observable<RosterAssignment[]> {
        return from(this._api.post('herramientas/roster_assignments/listOverdueAssignments', {
            start: 0,
            limit: 100
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || []);
            })
        );
    }

    /**
     * Check availability of a specific tool or kit
     */
    checkAvailability(type: 'tool' | 'kit', id: string): Observable<AvailabilityStatus> {
        const param = type === 'kit' ? { kit_id: id } : { tool_id: id };
        return from(this._api.post('herramientas/roster_assignments/getAvailability', {
            assignment_type: type,
            ...param
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data?.[0] || response?.data || {});
            })
        );
    }

    /**
     * Get available tools for assignment
     */
    getAvailableTools(): Observable<AvailabilityStatus[]> {
        return from(this._api.post('herramientas/roster_assignments/getAvailability', {
            assignment_type: 'tool'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || []);
            })
        );
    }

    /**
     * Get available kits for assignment
     */
    getAvailableKits(): Observable<AvailabilityStatus[]> {
        return from(this._api.post('herramientas/roster_assignments/getAvailability', {
            assignment_type: 'kit'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || []);
            })
        );
    }

    /**
     * Get employee roster summary
     */
    getEmployeeRosterSummary(employeeId: string): Observable<EmployeeRosterSummary> {
        return from(this._api.post('herramientas/roster_assignments/getEmployeeSummary', {
            employee_id: employeeId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data?.[0] || response?.data || {});
            })
        );
    }

    /**
     * Get all employees roster summaries
     */
    getAllEmployeesSummaries(): Observable<EmployeeRosterSummary[]> {
        return from(this._api.post('herramientas/roster_assignments/getAllEmployeesSummaries', {
            start: 0,
            limit: 200
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || []);
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
            aircraft_id: aircraftId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || []);
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
            work_order_number: workOrderNumber
        })).pipe(
            switchMap((response: any) => {
                return of(response?.data || []);
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
            shift: shift
        };
        if (date) {
            params.assignment_date = date;
        }

        return from(this._api.post('herramientas/roster_assignments/listAssignments', params)).pipe(
            switchMap((response: any) => {
                return of(response?.data || []);
            })
        );
    }

    /**
     * Export assignments to CSV/Excel
     *
     * NOTA: el backend hoy no genera un archivo — esto reutiliza el listado
     * (alias `exportAssignments` -> `listarRosterAssignments`) hasta que se
     * construya la pantalla y se decida un formato real de exportación.
     */
    exportAssignments(filters?: RosterFilters): Observable<RosterAssignment[]> {
        const params: any = {
            start: 0,
            limit: 1000,
            ...this._fromFilters(filters)
        };

        return from(this._api.post('herramientas/roster_assignments/exportAssignments', params)).pipe(
            switchMap((response: any) => {
                return of(response?.data || []);
            })
        );
    }
}
