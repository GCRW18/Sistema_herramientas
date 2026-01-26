/**
 * Tipo de empleado/técnico
 */
export type EmployeeType =
    | 'Tecnico MM I'
    | 'Tecnico MM II'
    | 'Inspector'
    | 'Supervisor'
    | 'Jefe de Linea'
    | 'Jefe de Mantenimiento';

/**
 * Área de trabajo
 */
export type EmployeeArea =
    | 'LINEA'
    | 'MANTENIMIENTO'
    | 'CENTRO CONTROL'
    | 'AVIONICOS'
    | 'ESTRUCTURAS'
    | 'MOTORES';

/**
 * Base de operaciones
 */
export type EmployeeBase =
    | 'TJA'  // Tarija
    | 'SRZ'  // Santa Cruz
    | 'CBB'  // Cochabamba
    | 'LPB'  // La Paz
    | 'SCL'; // Sucre

/**
 * Certificación de aeronave
 */
export interface AircraftCertification {
    aircraftType: string;        // Tipo de aeronave (ej: BoALB37, BoARTNG, BoAAVI-NG, etc.)
    certified: boolean;           // Si está certificado o no
    certificationDate?: string;   // Fecha de certificación
    expirationDate?: string;      // Fecha de vencimiento (si aplica)
    notes?: string;               // Notas adicionales
}

/**
 * Empleado/Técnico
 * Basado en la hoja "Roster" del Excel
 */
export interface Employee {
    id: string;

    // Identificación
    licenseNumber: string;        // Nro. Licencia (clave del Excel)
    sealNumber?: string;          // Nro. Sello

    // Datos personales
    firstName: string;            // Nombres
    paternalLastName: string;     // Ap. Paterno
    maternalLastName?: string;    // Ap. Materno
    fullName?: string;            // Nombre completo (calculado)

    // Información laboral
    type: EmployeeType;           // Tipo (Técnico MM I, II, Inspector, etc.)
    area: EmployeeArea;           // Area (LINEA, MANTENIMIENTO, etc.)
    base: EmployeeBase;           // Base (TJA, SRZ, CBB, etc.)

    // Certificaciones por tipo de aeronave
    certifications: AircraftCertification[];

    // Estado
    active: boolean;              // ALTA BAJA (1=activo, 0=inactivo)

    // Información de contacto (opcional - no está en Excel original)
    email?: string;
    phone?: string;

    // Metadata
    createdAt: string;
    updatedAt: string;
}

/**
 * Filtros para búsqueda de empleados
 */
export interface EmployeeFilters {
    search?: string;              // Búsqueda general
    licenseNumber?: string;       // Por número de licencia
    type?: EmployeeType;          // Por tipo
    area?: EmployeeArea;          // Por área
    base?: EmployeeBase;          // Por base
    active?: boolean;             // Solo activos/inactivos
    certifiedFor?: string;        // Certificado para aeronave específica
}

/**
 * Estadísticas de empleados
 */
export interface EmployeeStats {
    totalEmployees: number;
    activeEmployees: number;
    inactiveEmployees: number;
    byType: Record<EmployeeType, number>;
    byArea: Record<EmployeeArea, number>;
    byBase: Record<EmployeeBase, number>;
}

/**
 * Formulario para crear/editar empleado
 */
export interface EmployeeForm {
    licenseNumber: string;
    sealNumber?: string;
    firstName: string;
    paternalLastName: string;
    maternalLastName?: string;
    type: EmployeeType;
    area: EmployeeArea;
    base: EmployeeBase;
    certifications: AircraftCertification[];
    email?: string;
    phone?: string;
    active: boolean;
}

/**
 * Resumen de empleado (para listas)
 */
export interface EmployeeSummary {
    id: string;
    licenseNumber: string;
    fullName: string;
    type: EmployeeType;
    area: EmployeeArea;
    base: EmployeeBase;
    certificationsCount: number;
    active: boolean;
}
