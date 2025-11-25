import { Routes } from '@angular/router';

export default [
    {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full'
    },
    // Listado de Kits
    {
        path: 'list',
        loadComponent: () => import('./kits-list/kits-list.component'),
    },

    // Creación y Edición de Kits
    {
        path: 'create',
        loadComponent: () => import('./kit-form/kit-form.component'),
    },
    {
        path: ':id/edit',
        loadComponent: () => import('./kit-form/kit-form.component'),
    },

    // Detalle de Kit
    {
        path: ':id',
        loadComponent: () => import('./kit-detail/kit-detail.component'),
    },

    // Estado de Calibración
    {
        path: 'calibration-status',
        loadComponent: () => import('./calibration-status/calibration-status.component'),
    },

    // Componentes de Kit
    {
        path: 'componente-kit',
        loadComponent: () => import('./componente-kit/componente-kit-list/componente-kit-list.component').then(m => m.ComponenteKitListComponent),
    },
    {
        path: 'componente-kit/new',
        loadComponent: () => import('./componente-kit/componente-kit-form/componente-kit-form.component').then(m => m.ComponenteKitFormComponent),
    },
    {
        path: 'componente-kit/:id/edit',
        loadComponent: () => import('./componente-kit/componente-kit-form/componente-kit-form.component').then(m => m.ComponenteKitFormComponent),
    },
] as Routes;
