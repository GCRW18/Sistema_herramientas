import { Routes } from '@angular/router';
import { ExitsComponent } from './exits.component';

export default [
    {
        path: '',
        component: ExitsComponent,
        children: [
            {
                path: 'dashboard',
                loadComponent: () => import('./dashboard/exits-dashboard.component').then(m => m.ExitsDashboardComponent)
            },
        ]
    }
] as Routes;
