import { Routes } from '@angular/router';

export default [
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
        path: 'reports',
        loadComponent: () => import('./reports/reports.component'),
    },
] as Routes;
