export interface Role {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
    userCount?: number;
    active: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Permission {
    id: string;
    name: string;
    description?: string;
    module: string;
    action: string;
}

export interface RoleFormData {
    name: string;
    description?: string;
    permissions: string[];
    active: boolean;
}

export const AVAILABLE_PERMISSIONS: Permission[] = [
    // Inventory permissions
    { id: 'inventory.view', name: 'Ver Inventario', description: 'Visualizar inventario de herramientas', module: 'Inventario', action: 'view' },
    { id: 'inventory.create', name: 'Crear Herramientas', description: 'Crear nuevas herramientas', module: 'Inventario', action: 'create' },
    { id: 'inventory.edit', name: 'Editar Herramientas', description: 'Modificar herramientas existentes', module: 'Inventario', action: 'edit' },
    { id: 'inventory.delete', name: 'Eliminar Herramientas', description: 'Eliminar herramientas', module: 'Inventario', action: 'delete' },

    // Tools permissions
    { id: 'tools.view', name: 'Ver Herramientas', description: 'Visualizar herramientas', module: 'Herramientas', action: 'view' },
    { id: 'tools.edit', name: 'Editar Herramientas', description: 'Modificar herramientas', module: 'Herramientas', action: 'edit' },

    // Calibration permissions
    { id: 'calibration.view', name: 'Ver Calibraciones', description: 'Visualizar calibraciones', module: 'Calibración', action: 'view' },
    { id: 'calibration.manage', name: 'Gestionar Calibraciones', description: 'Crear y gestionar calibraciones', module: 'Calibración', action: 'manage' },
    { id: 'calibration.approve', name: 'Aprobar Calibraciones', description: 'Aprobar calibraciones', module: 'Calibración', action: 'approve' },

    // Movements permissions
    { id: 'movements.view', name: 'Ver Movimientos', description: 'Visualizar movimientos', module: 'Movimientos', action: 'view' },
    { id: 'movements.create', name: 'Crear Movimientos', description: 'Registrar entradas/salidas', module: 'Movimientos', action: 'create' },
    { id: 'movements.approve', name: 'Aprobar Movimientos', description: 'Aprobar movimientos', module: 'Movimientos', action: 'approve' },

    // Kits permissions
    { id: 'kits.view', name: 'Ver Kits', description: 'Visualizar kits', module: 'Kits', action: 'view' },
    { id: 'kits.manage', name: 'Gestionar Kits', description: 'Crear y modificar kits', module: 'Kits', action: 'manage' },

    // Quarantine permissions
    { id: 'quarantine.view', name: 'Ver Cuarentenas', description: 'Visualizar cuarentenas', module: 'Cuarentena', action: 'view' },
    { id: 'quarantine.manage', name: 'Gestionar Cuarentenas', description: 'Crear y gestionar cuarentenas', module: 'Cuarentena', action: 'manage' },

    // Reports permissions
    { id: 'reports.view', name: 'Ver Reportes', description: 'Visualizar reportes', module: 'Reportes', action: 'view' },
    { id: 'reports.generate', name: 'Generar Reportes', description: 'Generar reportes', module: 'Reportes', action: 'generate' },

    // Users permissions
    { id: 'users.view', name: 'Ver Usuarios', description: 'Visualizar usuarios', module: 'Usuarios', action: 'view' },
    { id: 'users.manage', name: 'Gestionar Usuarios', description: 'Crear y modificar usuarios', module: 'Usuarios', action: 'manage' },

    // Roles permissions
    { id: 'roles.view', name: 'Ver Roles', description: 'Visualizar roles', module: 'Roles', action: 'view' },
    { id: 'roles.manage', name: 'Gestionar Roles', description: 'Crear y modificar roles', module: 'Roles', action: 'manage' },

    // Administration permissions
    { id: 'admin.full', name: 'Administración Completa', description: 'Acceso total al sistema', module: 'Sistema', action: 'all' },
];
