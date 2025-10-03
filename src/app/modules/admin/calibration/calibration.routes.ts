import { Routes } from '@angular/router';

export default [
    {
        path: 'send',
        loadComponent: () => import('./send-calibration/send-calibration.component'),
    },
    {
        path: 'receive',
        loadComponent: () => import('./receive-calibration/receive-calibration.component'),
    },
    {
        path: 'tracking',
        loadComponent: () => import('./calibration-tracking/calibration-tracking.component'),
    },
    {
        path: 'maintenance',
        loadComponent: () => import('./maintenance/maintenance.component'),
    },
    {
        path: 'alerts',
        loadComponent: () => import('./alerts/alerts.component'),
    },
    {
        path: ':id',
        loadComponent: () => import('./calibration-detail/calibration-detail.component'),
    },
] as Routes;
