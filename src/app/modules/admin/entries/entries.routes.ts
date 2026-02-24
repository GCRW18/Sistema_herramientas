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
            },
            {
                path: 'consulta-movimientos',
                loadComponent: () => import('./consulta-movimientos/consulta-movimientos.component').then(m => m.ConsultaMovimientosComponent)
            },
            {
                path: 'retorno-traspaso',
                loadComponent: () => import('./retorno-traspaso/retorno-traspaso.component').then(m => m.RetornoTraspasoComponent)
            }
        ]
    }
] as Routes;
