import { Routes } from '@angular/router';

export default [
    {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full'
    },
    {
        path: 'list',
        loadComponent: () => import('./roster-list/roster-list.component'),
    },
    {
        path: 'new',
        loadComponent: () => import('./roster-form/roster-form.component'),
    },
    {
        path: ':id',
        loadComponent: () => import('./roster-detail/roster-detail.component'),
    },
    {
        path: ':id/edit',
        loadComponent: () => import('./roster-form/roster-form.component'),
    },
] as Routes;
