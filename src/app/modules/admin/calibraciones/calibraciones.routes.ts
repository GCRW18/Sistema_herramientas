import { Routes } from '@angular/router';
import { CalibracionesComponent } from './calibraciones.component';

export default [
    {
        path: '',
        component: CalibracionesComponent,
        children: [
            {
                path: 'dashboard',
                loadComponent: () => import('./dashboard/calibraciones-dashboard.component')
                    .then(m => m.CalibracionesDashboardComponent)
            },
            {
                path: 'alertas',
                loadComponent: () => import('./alertas/calibraciones-alertas.component')
                    .then(m => m.CalibracionesAlertasComponent)
            },
            {
                path: 'laboratorios',
                loadComponent: () => import('./laboratorios/laboratorios.component')
                    .then(m => m.LaboratoriosComponent)
            },
            {
                path: 'servicios-gatas',
                loadComponent: () => import('./servicios-gatas/servicios-gatas.component')
                    .then(m => m.ServiciosGatasComponent)
            },
            {
                path: 'reportes',
                loadComponent: () => import('./reportes/reportes-calibracion.component')
                    .then(m => m.ReportesCalibracionComponent)
            },
            {
                path: 'lotes-calibracion',
                loadComponent: () => import('./lotes-calibracion/lotes-calibracion.component')
                    .then(m => m.LotesCalibracionComponent)
            }
        ]
    }
] as Routes;
