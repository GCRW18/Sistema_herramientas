import { Routes } from '@angular/router';

export default [
    {
        path: 'audit',
        loadComponent: () => import('./audit-log/audit-log.component').then(m => m.AuditLogComponent),
    },
] as Routes;
