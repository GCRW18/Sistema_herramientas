import { Routes } from '@angular/router';
import { InventoryComponent } from './inventory.component';

export default [
    {
        path: '',
        component: InventoryComponent,
        children: [
            // Inventory dashboard unificado
            {
                path: 'dashboard',
                loadComponent: () => import('./dashboard/unified-dashboard.component')
                    .then(m => m.UnifiedDashboardComponent)
            },
            // Movimientos unificados
            {
                path: 'movimientos',
                loadComponent: () => import('./movimientos/unified-movements.component')
                    .then(m => m.UnifiedMovementsComponent)
            },
            // --- Inventory existing routes ---
            {
                path: 'consultar-inventario',
                loadComponent: () => import('./consultar-inventario/consultar-inventario.component')
                    .then(m => m.ConsultarInventarioComponent)
            },
            {
                path: 'ajustar-stock',
                loadComponent: () => import('./ajustar-stock/ajustar-stock.component')
                    .then(m => m.AjustarStockComponent)
            },
            {
                path: 'gestion-ubicaciones',
                loadComponent: () => import('./gestion-ubicaciones/gestion-ubicaciones.component')
                    .then(m => m.GestionUbicacionesComponent)
            },
            // --- Reportes (moved from reports module) ---
            {
                path: 'reportes',
                loadComponent: () => import('./reportes-general/reports.component')
                    .then(m => m.ReportsComponent)
            },
            // --- Kits routes (moved from kits module) ---
            {
                path: 'lista-kits',
                loadComponent: () => import('./lista-kits/lista-kits.component')
                    .then(m => m.ListaKitsComponent)
            },
            {
                path: 'entrada-material',
                loadComponent: () => import('./entrada-material/entrada-material.component')
                    .then(m => m.EntradaMaterialComponent)
            },
            {
                path: 'crear-material',
                loadComponent: () => import('./crear-material/crear-material.component')
                    .then(m => m.CrearMaterialComponent)
            },
            {
                path: 'salida-material',
                loadComponent: () => import('./salida-material/salida-material.component')
                    .then(m => m.SalidaMaterialComponent)
            },
            // --- Historial de Estados (Bitacora) ---
            {
                path: 'historial-estados',
                loadComponent: () => import('./historial-estados/historial-estados.component')
                    .then(m => m.HistorialEstadosComponent)
            },
            // --- Migracion Excel ---
            {
                path: 'migracion-excel',
                loadComponent: () => import('./migracion-excel/migracion-excel.component')
                    .then(m => m.MigracionExcelComponent)
            }
        ]
    }
] as Routes;
