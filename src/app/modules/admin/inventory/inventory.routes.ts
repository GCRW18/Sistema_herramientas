import { Routes } from '@angular/router';
import { InventoryComponent } from './inventory.component';

export default [
    {
        path: '',
        component: InventoryComponent,
        children: [
            {
                path: 'dashboard',
                loadComponent: () => import('./dashboard/inventory-dashboard.component')
                    .then(m => m.InventoryDashboardComponent)
            },
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
            {
                path: 'reportes',
                loadComponent: () => import('./reportes/reportes-inventario.component')
                    .then(m => m.ReportesInventarioComponent)
            }
        ]
    }
] as Routes;
