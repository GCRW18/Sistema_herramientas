/* eslint-disable */
import { ErpNavigationItem } from '@erp/components/navigation';

// Navegación del sistema - Basado en Excel original
export const defaultNavigation: ErpNavigationItem[] = [
    {
        id      : 'dashboard',
        title   : 'DASHBOARD',
        subtitle: 'Panel principal',
        type    : 'basic',
        icon    : 'heroicons_outline:home',
        link    : '/dashboard'
    },
    {
        id      : 'entradas',
        title   : 'ENTRADAS',
        subtitle: 'Registro de ingresos de herramientas',
        type    : 'basic',
        icon    : 'heroicons_outline:arrow-up-tray', // Using an arrow-up-tray icon
        link    : '/entradas'
    },
    {
        id      : 'salidas',
        title   : 'SALIDAS',
        subtitle: 'Control de salidas y entregas de herramientas',
        type    : 'basic',
        icon    : 'heroicons_outline:arrow-down-tray', // Using an arrow-down-tray icon
        link    : '/salidas'
    },
    {
        id      : 'calibraciones',
        title   : 'CALIBRACIONES',
        subtitle: 'Control de calibraciones y servicios',
        type    : 'basic',
        icon    : 'heroicons_outline:wrench-screwdriver',
        link    : '/calibraciones'
    },
    {
        id      : 'inventario',
        title   : 'INVENTARIO',
        subtitle: 'Control de stock, kits y reportes',
        type    : 'basic',
        icon    : 'heroicons_outline:squares-2x2',
        link    : '/inventario'
    },
    {
        id      : 'administration',
        title   : 'ADMINISTRACIÓN',
        subtitle: 'Gestión de usuarios y ubicaciones',
        type    : 'basic',
        icon    : 'heroicons_outline:cog-6-tooth',
        link    : '/administration'
    }
];

export const compactNavigation: ErpNavigationItem[] = defaultNavigation;
export const futuristicNavigation: ErpNavigationItem[] = defaultNavigation;
export const horizontalNavigation: ErpNavigationItem[] = defaultNavigation;
