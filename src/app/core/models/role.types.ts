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

/**
 * Catálogo de permisos — un módulo por cada submódulo real del sistema (los
 * mismos tabs definidos en MODULE_DEFS de inventory/movimientos/calibraciones/
 * administration.component.ts), y una acción por cada operación real que ese
 * submódulo expone hoy. Al agregar/quitar una función de un submódulo, este es
 * el único lugar que hay que actualizar para que la matriz de roles la refleje.
 */
export const AVAILABLE_PERMISSIONS: Permission[] = [
    // ── Inventario · Almacén y Ubicaciones ──────────────────────────────
    { id: 'inv_ubicaciones.view',   name: 'Ver Almacenes y Ubicaciones', description: 'Consultar almacenes, estantes y niveles', module: 'Almacén y Ubicaciones', action: 'view' },
    { id: 'inv_ubicaciones.manage', name: 'Gestionar Almacenes',         description: 'Crear/editar almacenes, estantes y niveles', module: 'Almacén y Ubicaciones', action: 'manage' },
    { id: 'inv_ubicaciones.move',   name: 'Mover Herramientas/Kits',     description: 'Reubicar herramientas y kits entre niveles', module: 'Almacén y Ubicaciones', action: 'move' },

    // ── Inventario · Misceláneos ─────────────────────────────────────────
    { id: 'miscelaneos.view',   name: 'Ver Misceláneos',        description: 'Consultar catálogo y stock de misceláneos', module: 'Misceláneos', action: 'view' },
    { id: 'miscelaneos.entry',  name: 'Registrar Entrada',      description: 'Registrar entrada de material misceláneo', module: 'Misceláneos', action: 'entry' },
    { id: 'miscelaneos.exit',   name: 'Registrar Salida',       description: 'Registrar salida de material misceláneo', module: 'Misceláneos', action: 'exit' },
    { id: 'miscelaneos.move',   name: 'Mover Ubicación',        description: 'Reubicar material misceláneo', module: 'Misceláneos', action: 'move' },

    // ── Inventario · Gestión Kits ─────────────────────────────────────────
    { id: 'kits.view',    name: 'Ver Kits',      description: 'Consultar kits y su contenido', module: 'Gestión Kits', action: 'view' },
    { id: 'kits.create',  name: 'Crear Kits',    description: 'Crear nuevos kits',              module: 'Gestión Kits', action: 'create' },
    { id: 'kits.edit',    name: 'Editar Kits',   description: 'Modificar datos de un kit existente', module: 'Gestión Kits', action: 'edit' },
    { id: 'kits.prestar', name: 'Prestar Kits',  description: 'Registrar préstamo de un kit',    module: 'Gestión Kits', action: 'prestar' },
    { id: 'kits.devolver',name: 'Devolver Kits', description: 'Registrar devolución de un kit',  module: 'Gestión Kits', action: 'devolver' },
    { id: 'kits.move',    name: 'Mover Kits',    description: 'Reubicar un kit',                 module: 'Gestión Kits', action: 'move' },
    { id: 'kits.toggle',  name: 'Activar/Desactivar Kits', description: 'Cambiar el estado activo/inactivo de un kit', module: 'Gestión Kits', action: 'toggle' },

    // ── Inventario · Reportes ─────────────────────────────────────────────
    { id: 'inv_reportes.view',     name: 'Ver Reportes de Inventario', description: 'Consultar reportes de inventario', module: 'Reportes Inventario', action: 'view' },
    { id: 'inv_reportes.generate', name: 'Generar Reportes',           description: 'Generar/exportar reportes de inventario', module: 'Reportes Inventario', action: 'generate' },

    // ── Inventario · Consultar Inventario ─────────────────────────────────
    { id: 'inv_consulta.view', name: 'Consultar Inventario', description: 'Ver ficha y ubicación real de cada herramienta', module: 'Consultar Inventario', action: 'view' },

    // ── Movimientos · Inter-Bases (Envío/Traspaso/Retorno) ────────────────
    { id: 'interbases.view',     name: 'Ver Inter-Bases',       description: 'Consultar movimientos entre bases', module: 'Inter-Bases', action: 'view' },
    { id: 'interbases.enviar',   name: 'Enviar a Base',         description: 'Registrar envío de herramientas a otra base', module: 'Inter-Bases', action: 'enviar' },
    { id: 'interbases.traspasar',name: 'Traspasar',             description: 'Registrar traspaso interno/técnico',           module: 'Inter-Bases', action: 'traspasar' },
    { id: 'interbases.retornar', name: 'Retornar',              description: 'Registrar retorno de base o de área',          module: 'Inter-Bases', action: 'retornar' },

    // ── Movimientos · Préstamo Técnico BOA ─────────────────────────────────
    { id: 'prestamo_tecnico.view',     name: 'Ver Préstamos Técnicos', description: 'Consultar préstamos a técnicos BOA', module: 'Préstamo Técnico BOA', action: 'view' },
    { id: 'prestamo_tecnico.prestar',  name: 'Prestar',                description: 'Registrar préstamo a técnico',        module: 'Préstamo Técnico BOA', action: 'prestar' },
    { id: 'prestamo_tecnico.devolver', name: 'Devolver',               description: 'Registrar devolución de técnico',     module: 'Préstamo Técnico BOA', action: 'devolver' },

    // ── Movimientos · Préstamo Terceros ────────────────────────────────────
    { id: 'prestamo_terceros.view',     name: 'Ver Préstamos a Terceros', description: 'Consultar préstamos a empresas/terceros', module: 'Préstamo Terceros', action: 'view' },
    { id: 'prestamo_terceros.prestar',  name: 'Prestar',                  description: 'Registrar préstamo a tercero',            module: 'Préstamo Terceros', action: 'prestar' },
    { id: 'prestamo_terceros.devolver', name: 'Devolver',                 description: 'Registrar devolución de tercero',         module: 'Préstamo Terceros', action: 'devolver' },

    // ── Movimientos · Ingresos Almacén ─────────────────────────────────────
    { id: 'ingresos.view',     name: 'Ver Ingresos',       description: 'Consultar ingresos al almacén', module: 'Ingresos Almacén', action: 'view' },
    { id: 'ingresos.register', name: 'Registrar Ingreso',  description: 'Registrar recepción/compra nueva', module: 'Ingresos Almacén', action: 'register' },
    { id: 'ingresos.adjust',   name: 'Ajustar Stock',      description: 'Registrar ajustes de inventario', module: 'Ingresos Almacén', action: 'adjust' },

    // ── Movimientos · Cuarentena y Baja ────────────────────────────────────
    { id: 'cuarentena.view',      name: 'Ver Cuarentena y Baja', description: 'Consultar herramientas en cuarentena/baja', module: 'Cuarentena y Baja', action: 'view' },
    { id: 'cuarentena.poner',     name: 'Poner en Cuarentena',   description: 'Enviar una herramienta a cuarentena',       module: 'Cuarentena y Baja', action: 'poner' },
    { id: 'cuarentena.baja',      name: 'Dar de Baja',           description: 'Registrar la baja de una herramienta',      module: 'Cuarentena y Baja', action: 'baja' },
    { id: 'cuarentena.anular',    name: 'Anular Baja',           description: 'Anular una baja registrada',                module: 'Cuarentena y Baja', action: 'anular' },
    { id: 'cuarentena.resolver',  name: 'Resolver Cuarentena',   description: 'Resolver una herramienta en cuarentena',    module: 'Cuarentena y Baja', action: 'resolver' },

    // ── Calibraciones · Envío Calibración ──────────────────────────────────
    { id: 'cal_envio.view',   name: 'Ver Envíos a Calibración', description: 'Consultar envíos a calibración', module: 'Envío Calibración', action: 'view' },
    { id: 'cal_envio.enviar', name: 'Enviar a Calibración',     description: 'Registrar envío de herramientas a calibrar', module: 'Envío Calibración', action: 'enviar' },
    { id: 'cal_envio.anular', name: 'Anular Envío',             description: 'Anular un envío a calibración',              module: 'Envío Calibración', action: 'anular' },

    // ── Calibraciones · Retorno Calibración ────────────────────────────────
    { id: 'cal_retorno.view',      name: 'Ver Retornos de Calibración', description: 'Consultar retornos de calibración', module: 'Retorno Calibración', action: 'view' },
    { id: 'cal_retorno.registrar', name: 'Registrar Retorno',           description: 'Confirmar el retorno de una herramienta calibrada', module: 'Retorno Calibración', action: 'registrar' },

    // ── Calibraciones · Empresas de Servicio (laboratorios) ───────────────
    { id: 'cal_labs.view',   name: 'Ver Empresas de Servicio', description: 'Consultar laboratorios/empresas de calibración', module: 'Empresas de Servicio', action: 'view' },
    { id: 'cal_labs.create', name: 'Crear Empresa',            description: 'Registrar nueva empresa de servicio', module: 'Empresas de Servicio', action: 'create' },
    { id: 'cal_labs.edit',   name: 'Editar Empresa',           description: 'Modificar datos de una empresa de servicio', module: 'Empresas de Servicio', action: 'edit' },
    { id: 'cal_labs.delete', name: 'Eliminar Empresa',         description: 'Eliminar una empresa de servicio', module: 'Empresas de Servicio', action: 'delete' },

    // ── Calibraciones · Consulta y Auditoría ───────────────────────────────
    { id: 'cal_auditoria.view',  name: 'Ver Consulta y Auditoría', description: 'Consultar historial y auditoría de calibraciones', module: 'Consulta y Auditoría', action: 'view' },
    { id: 'cal_auditoria.print', name: 'Imprimir Reporte',         description: 'Imprimir reporte de auditoría', module: 'Consulta y Auditoría', action: 'print' },

    // ── Calibraciones · Servicios de Mantenimiento ─────────────────────────
    { id: 'mantenimiento.view',      name: 'Ver Mantenimientos',   description: 'Consultar servicios de mantenimiento', module: 'Servicios de Mantenimiento', action: 'view' },
    { id: 'mantenimiento.create',    name: 'Crear Lote',           description: 'Crear un nuevo lote de mantenimiento', module: 'Servicios de Mantenimiento', action: 'create' },
    { id: 'mantenimiento.registrar', name: 'Registrar Retorno',    description: 'Registrar el retorno de un mantenimiento', module: 'Servicios de Mantenimiento', action: 'registrar' },

    // ── Calibraciones · Centro de Control (alertas) ────────────────────────
    { id: 'cal_alertas.view', name: 'Ver Centro de Control', description: 'Consultar alertas y vencimientos de calibración', module: 'Centro de Control', action: 'view' },

    // ── Calibraciones · Transcripción Histórico ────────────────────────────
    { id: 'transcripcion.view', name: 'Ver Transcripción Histórico', description: 'Consultar transcripciones históricas', module: 'Transcripción Histórico', action: 'view' },
    { id: 'transcripcion.edit', name: 'Editar Transcripción',        description: 'Completar/corregir una transcripción histórica', module: 'Transcripción Histórico', action: 'edit' },

    // ── Administración · Usuarios ───────────────────────────────────────────
    { id: 'admin_usuarios.view',        name: 'Ver Usuarios',    description: 'Consultar ficha de usuarios/funcionarios', module: 'Usuarios', action: 'view' },
    { id: 'admin_usuarios.assign_role', name: 'Asignar Rol',     description: 'Asignar o cambiar el rol de un usuario',   module: 'Usuarios', action: 'assign_role' },

    // ── Administración · Proveedores ────────────────────────────────────────
    { id: 'admin_proveedores.view',   name: 'Ver Proveedores',    description: 'Consultar proveedores', module: 'Proveedores', action: 'view' },
    { id: 'admin_proveedores.create', name: 'Crear Proveedor',    description: 'Registrar nuevo proveedor', module: 'Proveedores', action: 'create' },
    { id: 'admin_proveedores.edit',   name: 'Editar Proveedor',   description: 'Modificar datos de un proveedor', module: 'Proveedores', action: 'edit' },
    { id: 'admin_proveedores.toggle', name: 'Activar/Desactivar', description: 'Cambiar el estado de un proveedor', module: 'Proveedores', action: 'toggle' },

    // ── Administración · Roles y Permisos ───────────────────────────────────
    { id: 'admin_roles.view',   name: 'Ver Roles',          description: 'Consultar roles y su matriz de permisos', module: 'Roles y Permisos', action: 'view' },
    { id: 'admin_roles.create', name: 'Crear Rol',          description: 'Registrar un nuevo rol', module: 'Roles y Permisos', action: 'create' },
    { id: 'admin_roles.edit',   name: 'Editar Rol',         description: 'Modificar un rol existente', module: 'Roles y Permisos', action: 'edit' },
    { id: 'admin_roles.toggle', name: 'Activar/Desactivar', description: 'Cambiar el estado de un rol', module: 'Roles y Permisos', action: 'toggle' },
];
