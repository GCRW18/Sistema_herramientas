import { Routes } from '@angular/router';

export default [
    // Almacenes y Ubicaciones
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
        path: 'warehouses/:warehouseId/locations/new',
        loadComponent: () => import('./warehouses/location-form/location-form.component').then(m => m.LocationFormComponent),
    },
    {
        path: 'warehouses/:warehouseId/locations/:locationId/edit',
        loadComponent: () => import('./warehouses/location-form/location-form.component').then(m => m.LocationFormComponent),
    },

    // Herramientas
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

    // Categorías y Subcategorías
    {
        path: 'categories',
        loadComponent: () => import('./categories/categories.component'),
    },

    // Búsqueda y Filtro
    {
        path: 'search',
        loadComponent: () => import('./search/search.component'),
    },

    // Visualización del Inventario
    {
        path: 'view',
        loadComponent: () => import('./inventory-view/inventory-view.component'),
    },
] as Routes;
