import { Routes } from '@angular/router';

export default [
    // Registro de Entradas
    {
        path: 'entries',
        loadComponent: () => import('./entries/entries.component'),
    },
    {
        path: 'entries/new',
        loadComponent: () => import('./entries/entry-form/entry-form.component'),
    },

    // Registro de Salidas
    {
        path: 'exits',
        loadComponent: () => import('./exits/exits.component'),
    },
    {
        path: 'exits/new',
        loadComponent: () => import('./exits/exit-form/exit-form.component'),
    },

    // Historial de Movimientos
    {
        path: 'history',
        loadComponent: () => import('./history/history.component'),
    },

    // Comprobantes y Notas
    {
        path: 'vouchers',
        loadComponent: () => import('./vouchers/vouchers.component'),
    },
    {
        path: 'comprobante',
        loadComponent: () => import('./comprobante/comprobante-list/comprobante-list.component').then(m => m.ComprobanteListComponent),
    },
    {
        path: 'comprobante/new',
        loadComponent: () => import('./comprobante/comprobante-form/comprobante-form.component').then(m => m.ComprobanteFormComponent),
    },
    {
        path: 'comprobante/:id/edit',
        loadComponent: () => import('./comprobante/comprobante-form/comprobante-form.component').then(m => m.ComprobanteFormComponent),
    },

    // Detalle de Movimiento
    {
        path: ':id',
        loadComponent: () => import('./movement-detail/movement-detail.component'),
    },
] as Routes;
