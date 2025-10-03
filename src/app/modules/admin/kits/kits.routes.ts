import { Routes } from '@angular/router';

export default [
    {
        path: 'list',
        loadComponent: () => import('./kits-list/kits-list.component'),
    },
    {
        path: 'create',
        loadComponent: () => import('./kit-form/kit-form.component'),
    },
    {
        path: ':id',
        loadComponent: () => import('./kit-detail/kit-detail.component'),
    },
    {
        path: ':id/edit',
        loadComponent: () => import('./kit-form/kit-form.component'),
    },
    {
        path: 'calibration-status',
        loadComponent: () => import('./calibration-status/calibration-status.component'),
    },
] as Routes;
