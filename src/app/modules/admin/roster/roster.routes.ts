import { Routes } from '@angular/router';

export default [
    {
        path: 'list',
        loadComponent: () => import('./roster-list/roster-list.component').then(m => m.RosterListComponent),
    },
] as Routes;
