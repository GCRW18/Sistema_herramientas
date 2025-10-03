import { Routes } from '@angular/router';

export default [
    {
        path: 'warehouses',
        loadComponent: () => import('./warehouses/warehouses.component').then(m => m.WarehousesComponent),
    },
    {
        path: 'warehouses/new',
        loadComponent: () => import('./warehouses/warehouse-form/warehouse-form.component').then(m => m.WarehouseFormComponent),
    },
    {
        path: 'warehouses/:id',
        loadComponent: () => import('./warehouses/warehouse-detail/warehouse-detail.component').then(m => m.WarehouseDetailComponent),
    },
    {
        path: 'warehouses/:id/edit',
        loadComponent: () => import('./warehouses/warehouse-form/warehouse-form.component').then(m => m.WarehouseFormComponent),
    },
    {
        path: 'tools',
        loadComponent: () => import('./tools/tools-list.component').then(m => m.ToolsListComponent),
    },
    {
        path: 'tools/new',
        loadComponent: () => import('./tools/tool-form/tool-form.component').then(m => m.ToolFormComponent),
    },
    {
        path: 'tools/:id',
        loadComponent: () => import('./tools/tool-detail/tool-detail.component'),
    },
    {
        path: 'tools/:id/edit',
        loadComponent: () => import('./tools/tool-form/tool-form.component').then(m => m.ToolFormComponent),
    },
    {
        path: 'categories',
        loadComponent: () => import('./categories/categories.component'),
    },
    {
        path: 'search',
        loadComponent: () => import('./search/search.component'),
    },
    {
        path: 'view',
        loadComponent: () => import('./inventory-view/inventory-view.component'),
    },
] as Routes;
