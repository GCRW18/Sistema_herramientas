/**
 * Rol de usuario
 */
export type UserRole =
    | 'admin'           // Administrador
    | 'warehouse_manager' // Jefe de almacén
    | 'technician'      // Técnico
    | 'viewer';         // Solo visualización

/**
 * Usuario
 */
export interface User {
    id: string;
    username: string;
    name?: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName?: string;

    // Rol y permisos
    role: UserRole;
    permissions?: string[];

    // Información adicional
    phone?: string;
    position?: string;
    department?: string;
    employeeId?: string;

    // Avatar
    avatar?: string;

    // Estado
    active: boolean;
    status?: 'online' | 'away' | 'busy' | 'not-visible';
    lastLogin?: string;

    createdAt: string;
    updatedAt: string;
}

/**
 * Proveedor
 */
export interface Supplier {
    id: string;
    code: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;

    // Tipo de proveedor
    type?: 'tools' | 'calibration' | 'maintenance' | 'general';

    // Información adicional
    taxId?: string;
    notes?: string;

    active: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * Cliente
 */
export interface Customer {
    id: string;
    code: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;

    // Información adicional
    taxId?: string;
    notes?: string;

    active: boolean;
    createdAt: string;
    updatedAt: string;
}
