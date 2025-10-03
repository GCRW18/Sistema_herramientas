import { Routes } from '@angular/router';

export default [
    {
        path: 'entries',
        loadComponent: () => import('./entries/entries.component'),
    },
    {
        path: 'entries/new',
        loadComponent: () => import('./entries/entry-form/entry-form.component'),
    },
    {
        path: 'exits',
        loadComponent: () => import('./exits/exits.component'),
    },
    {
        path: 'exits/new',
        loadComponent: () => import('./exits/exit-form/exit-form.component'),
    },
    {
        path: 'history',
        loadComponent: () => import('./history/history.component'),
    },
    {
        path: 'vouchers',
        loadComponent: () => import('./vouchers/vouchers.component'),
    },
    {
        path: ':id',
        loadComponent: () => import('./movement-detail/movement-detail.component'),
    },
] as Routes;
