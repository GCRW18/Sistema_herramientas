import { Routes } from '@angular/router';

export default [
    {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full'
    },
    {
        path: 'list',
        loadComponent: () => import('./fleet-list/fleet-list.component'),
    },
    {
        path: 'new',
        loadComponent: () => import('./fleet-form/fleet-form.component'),
    },
    {
        path: ':id',
        loadComponent: () => import('./fleet-detail/fleet-detail.component'),
    },
    {
        path: ':id/edit',
        loadComponent: () => import('./fleet-form/fleet-form.component'),
    },
] as Routes;
