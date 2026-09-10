import { Routes } from '@angular/router';
import { pendingChangesGuard } from 'app/core/guards/pending-changes.guard';
import { CalibracionesComponent } from './calibraciones.component';

export default [
    {
        path: '',
        component: CalibracionesComponent,
        canDeactivate: [pendingChangesGuard]
    },
    {
        path: 'historial/:toolId',
        loadComponent: () => import('./historial-herramienta/historial-herramienta.component').then(m => m.HistorialHerramientaComponent)
    }
] as Routes;
