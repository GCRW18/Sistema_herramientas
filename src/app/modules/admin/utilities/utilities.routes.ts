import { Routes } from '@angular/router';

export default [
    // Generador de Códigos de Barras
    {
        path: 'barcode-generator',
        loadComponent: () => import('./barcode-generator/barcode-generator.component'),
    },

    // Generador de Etiquetas
    {
        path: 'label-generator',
        loadComponent: () => import('./label-generator/label-generator.component'),
    },

    // Logs de Auditoría
    {
        path: 'audit-logs',
        loadComponent: () => import('./audit-logs/audit-logs.component'),
    },

    // Gestión de Archivos
    {
        path: 'file',
        loadComponent: () => import('./file/file-list/file-list.component').then(m => m.FileListComponent),
    },
    {
        path: 'file/new',
        loadComponent: () => import('./file/file-form/file-form.component').then(m => m.FileFormComponent),
    },
    {
        path: 'file/:id/edit',
        loadComponent: () => import('./file/file-form/file-form.component').then(m => m.FileFormComponent),
    },

    // Utilidades Generales
    {
        path: 'utilidades',
        loadComponent: () => import('./utilidades/utilidades-list/utilidades-list.component').then(m => m.UtilidadesListComponent),
    },
    {
        path: 'utilidades/new',
        loadComponent: () => import('./utilidades/utilidades-form/utilidades-form.component').then(m => m.UtilidadesFormComponent),
    },
    {
        path: 'utilidades/:id/edit',
        loadComponent: () => import('./utilidades/utilidades-form/utilidades-form.component').then(m => m.UtilidadesFormComponent),
    },
] as Routes;
