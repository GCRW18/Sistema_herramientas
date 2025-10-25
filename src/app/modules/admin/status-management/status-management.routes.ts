import { Routes } from '@angular/router';

export default [
    // Gestión de Cuarentena
    {
        path: 'quarantine',
        loadComponent: () => import('./quarantine/quarantine.component'),
    },
    {
        path: 'quarantine/new',
        loadComponent: () => import('./quarantine/quarantine-form/quarantine-form.component'),
    },
    {
        path: 'quarantine/:id',
        loadComponent: () => import('./quarantine/quarantine-detail/quarantine-detail.component'),
    },
    {
        path: 'quarantine/:id/edit',
        loadComponent: () => import('./quarantine/quarantine-form/quarantine-form.component'),
    },

    // Gestión de Bajas (Decommission)
    {
        path: 'decommission',
        loadComponent: () => import('./decommission/decommission.component'),
    },
    {
        path: 'decommission/new',
        loadComponent: () => import('./decommission/decommission-form/decommission-form.component'),
    },
    {
        path: 'decommission/:id',
        loadComponent: () => import('./decommission/decommission-detail/decommission-detail.component'),
    },
    {
        path: 'decommission/:id/edit',
        loadComponent: () => import('./decommission/decommission-form/decommission-form.component'),
    },

    // Bajas (desde inventory)
    {
        path: 'baja',
        loadComponent: () => import('./baja/baja-list/baja-list.component').then(m => m.BajaListComponent),
    },
    {
        path: 'baja/new',
        loadComponent: () => import('./baja/baja-form/baja-form.component').then(m => m.BajaFormComponent),
    },
    {
        path: 'baja/:id/edit',
        loadComponent: () => import('./baja/baja-form/baja-form.component').then(m => m.BajaFormComponent),
    },

    // Reportes
    {
        path: 'reports',
        loadComponent: () => import('./reports/reports.component'),
    },
] as Routes;
