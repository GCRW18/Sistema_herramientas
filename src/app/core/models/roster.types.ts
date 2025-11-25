import { User } from './user.types';
import { Tool } from './tool.types';
import { Kit } from './kit.types';
import { Aircraft } from './aircraft.types';

/**
 * Estado de la asignación de roster
 */
export type RosterStatus =
    | 'active'      // Activo (asignado)
    | 'returned'    // Devuelto
    | 'overdue'     // Vencido (no devuelto a tiempo)
    | 'extended';   // Extendido (plazo ampliado)

/**
 * Turno de trabajo
 */
export type ShiftType =
    | 'morning'     // Mañana
    | 'afternoon'   // Tarde
    | 'night'       // Noche
    | 'all_day';    // Todo el día

/**
 * Tipo de asignación
 */
export type AssignmentType =
    | 'tool'        // Herramienta individual
    | 'kit';        // Kit completo

/**
 * Asignación de Roster
 */
export interface RosterAssignment {
    id: string;

    // Tipo de asignación
    assignmentType: AssignmentType;

    // Elemento asignado (solo uno puede estar presente)
    toolId?: string;
    tool?: Tool;
    toolName?: string; // Para representación plana
    toolCode?: string; // Para representación plana

    kitId?: string;
    kit?: Kit;
    kitName?: string; // Para representación plana
    kitCode?: string; // Para representación plana

    // Asignado a
    employeeId: string;
    employee?: User;
    employeeName?: string; // Para representación plana
    employeePosition?: string; // Para representación plana

    // Aeronave relacionada (opcional)
    aircraftId?: string;
    aircraft?: Aircraft;
    aircraftRegistration?: string; // Para representación plana

    // Fechas
    assignmentDate: string; // Fecha y hora de asignación
    expectedReturnDate?: string; // Fecha esperada de devolución
    actualReturnDate?: string; // Fecha real de devolución

    // Estado
    status: RosterStatus;

    // Turno
    shift?: ShiftType;

    // Información adicional
    purpose?: string; // Propósito de la asignación
    workOrderNumber?: string; // Número de orden de trabajo
    notes?: string;

    // Información de devolución
    returnedById?: string;
    returnedBy?: User;
    returnNotes?: string; // Notas al momento de devolver

    // Auditoría
    createdAt: string;
    updatedAt: string;
    createdBy?: User;
}

/**
 * Filtros para búsqueda de asignaciones
 */
export interface RosterFilters {
    search?: string;
    employeeId?: string;
    aircraftId?: string;
    status?: RosterStatus;
    shift?: ShiftType;
    assignmentType?: AssignmentType;
    dateFrom?: string;
    dateTo?: string;
    overdueOnly?: boolean;
}

/**
 * Estadísticas de roster
 */
export interface RosterStats {
    totalAssignments: number;
    activeAssignments: number;
    overdueAssignments: number;
    returnedToday: number;
    toolsAssigned: number;
    kitsAssigned: number;
}

/**
 * Historial de asignación
 */
export interface AssignmentHistory {
    assignmentId: string;
    action: 'assigned' | 'returned' | 'extended' | 'overdue';
    actionDate: string;
    performedById?: string;
    performedBy?: User;
    notes?: string;
}

/**
 * Disponibilidad de herramienta/kit para asignación
 */
export interface AvailabilityStatus {
    id: string;
    type: 'tool' | 'kit';
    code: string;
    name: string;
    isAvailable: boolean;
    reason?: string; // Razón si no está disponible
    currentAssignment?: RosterAssignment;
}

/**
 * Resumen de asignaciones por empleado
 */
export interface EmployeeRosterSummary {
    employeeId: string;
    employee: User;
    activeAssignments: number;
    totalAssignments: number;
    overdueAssignments: number;
    currentTools: Tool[];
    currentKits: Kit[];
}

/**
 * Formulario para crear/editar asignación
 */
export interface RosterAssignmentForm {
    assignmentType: AssignmentType;
    toolId?: string;
    kitId?: string;
    employeeId: string;
    aircraftId?: string;
    assignmentDate: string;
    expectedReturnDate?: string;
    shift?: ShiftType;
    purpose?: string;
    workOrderNumber?: string;
    notes?: string;
}

/**
 * Formulario para devolución
 */
export interface RosterReturnForm {
    assignmentId: string;
    actualReturnDate: string;
    returnNotes?: string;
}
