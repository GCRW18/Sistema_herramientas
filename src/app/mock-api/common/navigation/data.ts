/* eslint-disable */
import { ErpNavigationItem } from '@erp/components/navigation';

export const defaultNavigation: ErpNavigationItem[] = [
    {
        id   : 'dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/dashboard'
    },
    {
        id      : 'inventory',
        title   : 'Gestión de Herramientas',
        subtitle: 'Inventario y control',
        type    : 'collapsable',
        icon    : 'heroicons_outline:wrench-screwdriver',
        children: [
            {
                id   : 'inventory.warehouses',
                title: 'Almacenes y Ubicaciones',
                type : 'basic',
                link : '/inventory/warehouses'
            },
            {
                id   : 'inventory.tools',
                title: 'Herramientas',
                type : 'basic',
                link : '/inventory/tools'
            },
            {
                id   : 'inventory.categories',
                title: 'Categorías',
                type : 'basic',
                link : '/inventory/categories'
            },
            {
                id   : 'inventory.search',
                title: 'Búsqueda Avanzada',
                type : 'basic',
                link : '/inventory/search'
            },
            {
                id   : 'inventory.view',
                title: 'Visualización Inventario',
                type : 'basic',
                link : '/inventory/view'
            }
        ]
    },
    {
        id      : 'movements',
        title   : 'Gestión de Movimientos',
        subtitle: 'Entradas y salidas',
        type    : 'collapsable',
        icon    : 'heroicons_outline:arrows-right-left',
        children: [
            {
                id   : 'movements.entries',
                title: 'Entradas',
                type : 'basic',
                link : '/movements/entries'
            },
            {
                id   : 'movements.exits',
                title: 'Salidas',
                type : 'basic',
                link : '/movements/exits'
            },
            {
                id   : 'movements.history',
                title: 'Historial',
                type : 'basic',
                link : '/movements/history'
            },
            {
                id   : 'movements.vouchers',
                title: 'Comprobantes',
                type : 'basic',
                link : '/movements/vouchers'
            }
        ]
    },
    {
        id      : 'kits',
        title   : 'Gestión de Kits',
        subtitle: 'Conjuntos de herramientas',
        type    : 'collapsable',
        icon    : 'heroicons_outline:cube',
        children: [
            {
                id   : 'kits.list',
                title: 'Lista de Kits',
                type : 'basic',
                link : '/kits/list'
            },
            {
                id   : 'kits.create',
                title: 'Crear Kit',
                type : 'basic',
                link : '/kits/create'
            },
            {
                id   : 'kits.calibration',
                title: 'Estado de Calibración',
                type : 'basic',
                link : '/kits/calibration-status'
            }
        ]
    },
    {
        id      : 'fleet',
        title   : 'Gestión de Flota',
        subtitle: 'Aeronaves y mantenimiento',
        type    : 'collapsable',
        icon    : 'heroicons_outline:paper-airplane',
        children: [
            {
                id   : 'fleet.list',
                title: 'Lista de Aeronaves',
                type : 'basic',
                link : '/fleet/list'
            },
            {
                id   : 'fleet.create',
                title: 'Nueva Aeronave',
                type : 'basic',
                link : '/fleet/new'
            }
        ]
    },
    {
        id      : 'calibration',
        title   : 'Calibración y Mantenimiento',
        subtitle: 'Control de calidad',
        type    : 'collapsable',
        icon    : 'heroicons_outline:cog-6-tooth',
        children: [
            {
                id   : 'calibration.send',
                title: 'Enviar a Calibración',
                type : 'basic',
                link : '/calibration/send'
            },
            {
                id   : 'calibration.receive',
                title: 'Recibir Calibración',
                type : 'basic',
                link : '/calibration/receive'
            },
            {
                id   : 'calibration.tracking',
                title: 'Seguimiento',
                type : 'basic',
                link : '/calibration/tracking'
            },
            {
                id   : 'calibration.maintenance',
                title: 'Mantenimiento',
                type : 'basic',
                link : '/calibration/maintenance'
            },
            {
                id   : 'calibration.alerts',
                title: 'Alertas de Vencimiento',
                type : 'basic',
                link : '/calibration/alerts'
            }
        ]
    },
    {
        id      : 'status-management',
        title   : 'Gestión de Estado',
        subtitle: 'Bajas y cuarentena',
        type    : 'collapsable',
        icon    : 'heroicons_outline:exclamation-triangle',
        children: [
            {
                id   : 'status-management.quarantine',
                title: 'Cuarentena',
                type : 'basic',
                link : '/status-management/quarantine'
            },
            {
                id   : 'status-management.decommission',
                title: 'Bajas',
                type : 'basic',
                link : '/status-management/decommission'
            },
            {
                id   : 'status-management.reports',
                title: 'Reportes',
                type : 'basic',
                link : '/status-management/reports'
            }
        ]
    },
    {
        id      : 'roster',
        title   : 'Gestión de Roster',
        subtitle: 'Turnos y asignaciones',
        type    : 'collapsable',
        icon    : 'heroicons_outline:calendar-days',
        children: [
            {
                id   : 'roster.list',
                title: 'Lista de Turnos',
                type : 'basic',
                link : '/roster/list'
            }
        ]
    },
    {
        id      : 'utilities',
        title   : 'Utilidades',
        subtitle: 'Herramientas del sistema',
        type    : 'collapsable',
        icon    : 'heroicons_outline:wrench',
        children: [
            {
                id   : 'utilities.barcode',
                title: 'Códigos de Barras',
                type : 'basic',
                link : '/utilities/barcode-generator'
            },
            {
                id   : 'utilities.labels',
                title: 'Etiquetas',
                type : 'basic',
                link : '/utilities/label-generator'
            },
            {
                id   : 'utilities.logs',
                title: 'Logs de Auditoría',
                type : 'basic',
                link : '/logs/audit'
            }
        ]
    },
    {
        id      : 'administration',
        title   : 'Administración',
        subtitle: 'Sistema y usuarios',
        type    : 'collapsable',
        icon    : 'heroicons_outline:cog-8-tooth',
        children: [
            {
                id   : 'administration.users',
                title: 'Usuarios',
                type : 'basic',
                link : '/administration/users'
            },
            {
                id   : 'administration.roles',
                title: 'Roles y Permisos',
                type : 'basic',
                link : '/administration/roles'
            },
            {
                id   : 'administration.suppliers',
                title: 'Proveedores',
                type : 'basic',
                link : '/administration/suppliers'
            },
            {
                id   : 'administration.customers',
                title: 'Clientes',
                type : 'basic',
                link : '/administration/customers'
            }
        ]
    }
];
export const compactNavigation: ErpNavigationItem[] = defaultNavigation;
export const futuristicNavigation: ErpNavigationItem[] = defaultNavigation;
export const horizontalNavigation: ErpNavigationItem[] = [
    {
        id   : 'dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/dashboard'
    },
    {
        id      : 'inventory',
        title   : 'Herramientas',
        type    : 'group',
        icon    : 'heroicons_outline:wrench-screwdriver',
        children: [
            {
                id   : 'inventory.warehouses',
                title: 'Almacenes',
                type : 'basic',
                link : '/inventory/warehouses'
            },
            {
                id   : 'inventory.tools',
                title: 'Herramientas',
                type : 'basic',
                link : '/inventory/tools'
            },
            {
                id   : 'inventory.categories',
                title: 'Categorías',
                type : 'basic',
                link : '/inventory/categories'
            }
        ]
    },
    {
        id      : 'movements',
        title   : 'Movimientos',
        type    : 'group',
        icon    : 'heroicons_outline:arrows-right-left',
        children: [
            {
                id   : 'movements.entries',
                title: 'Entradas',
                type : 'basic',
                link : '/movements/entries'
            },
            {
                id   : 'movements.exits',
                title: 'Salidas',
                type : 'basic',
                link : '/movements/exits'
            }
        ]
    },
    {
        id      : 'kits',
        title   : 'Kits',
        type    : 'basic',
        icon    : 'heroicons_outline:cube',
        link    : '/kits/list'
    },
    {
        id      : 'fleet',
        title   : 'Flota',
        type    : 'basic',
        icon    : 'heroicons_outline:paper-airplane',
        link    : '/fleet/list'
    },
    {
        id      : 'calibration',
        title   : 'Calibración',
        type    : 'group',
        icon    : 'heroicons_outline:cog-6-tooth',
        children: [
            {
                id   : 'calibration.tracking',
                title: 'Seguimiento',
                type : 'basic',
                link : '/calibration/tracking'
            },
            {
                id   : 'calibration.alerts',
                title: 'Alertas',
                type : 'basic',
                link : '/calibration/alerts'
            }
        ]
    },
    {
        id      : 'status-management',
        title   : 'Estado',
        type    : 'group',
        icon    : 'heroicons_outline:exclamation-triangle',
        children: [
            {
                id   : 'status-management.quarantine',
                title: 'Cuarentena',
                type : 'basic',
                link : '/status-management/quarantine'
            },
            {
                id   : 'status-management.decommission',
                title: 'Bajas',
                type : 'basic',
                link : '/status-management/decommission'
            }
        ]
    },
    {
        id      : 'utilities',
        title   : 'Utilidades',
        type    : 'group',
        icon    : 'heroicons_outline:wrench',
        children: [
            {
                id   : 'utilities.barcode',
                title: 'Códigos Barras',
                type : 'basic',
                link : '/utilities/barcode-generator'
            },
            {
                id   : 'utilities.labels',
                title: 'Etiquetas',
                type : 'basic',
                link : '/utilities/label-generator'
            }
        ]
    },
    {
        id      : 'administration',
        title   : 'Admin',
        type    : 'group',
        icon    : 'heroicons_outline:cog-8-tooth',
        children: [
            {
                id   : 'administration.users',
                title: 'Usuarios',
                type : 'basic',
                link : '/administration/users'
            },
            {
                id   : 'administration.suppliers',
                title: 'Proveedores',
                type : 'basic',
                link : '/administration/suppliers'
            }
        ]
    }
];
