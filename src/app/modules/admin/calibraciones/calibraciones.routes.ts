import { Routes } from '@angular/router';
import { CalibracionesComponent } from './calibraciones.component';

export default [
    {
        path: '',
        component: CalibracionesComponent
    },
    {
        path: 'historial/:toolId',
        loadComponent: () => import('./historial-herramienta/historial-herramienta.component').then(m => m.HistorialHerramientaComponent)
    }
] as Routes;
