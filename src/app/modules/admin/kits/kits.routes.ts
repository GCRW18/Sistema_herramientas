import { Routes } from '@angular/router';
import { KitsComponent } from './kits.component';

export default [
    {
        path: '',
        component: KitsComponent,
        children: [
            {
                path: 'dashboard',
                loadComponent: () => import('./dashboard/kits-dashboard.component').then(m => m.KitsDashboardComponent)
            },
            {
                path: 'entrada-material',
                loadComponent: () => import('./entrada-material/entrada-material.component').then(m => m.EntradaMaterialComponent)
            },
            {
                path: 'crear-material',
                loadComponent: () => import('./crear-material/crear-material.component').then(m => m.CrearMaterialComponent)
            },
            {
                path: 'salida-material',
                loadComponent: () => import('./salida-material/salida-material.component').then(m => m.SalidaMaterialComponent)
            },
            {
                path: 'lista-kits',
                loadComponent: () => import('./lista-kits/lista-kits.component').then(m => m.ListaKitsComponent)
            },
        ]
    }
] as Routes;
