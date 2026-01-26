import { Routes } from '@angular/router';
import { EntriesComponent } from './entries.component';

export default [
    {
        path: '',
        component: EntriesComponent,
        children: [
            {
                path: 'dashboard',
                loadComponent: () => import('./dashboard/entries-dashboard.component').then(m => m.EntriesDashboardComponent)
            }
        ]
    }
] as Routes;
