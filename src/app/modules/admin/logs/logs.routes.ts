import { Routes } from '@angular/router';

export default [
    {
        path: '',
        redirectTo: 'audit',
        pathMatch: 'full'
    },
    {
        path: 'audit',
        loadComponent: () => import('./audit-log/audit-log.component'),
    },
] as Routes;
