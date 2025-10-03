import { Routes } from '@angular/router';

export default [
    {
        path: 'users',
        loadComponent: () => import('./users/users.component'),
    },
    {
        path: 'users/new',
        loadComponent: () => import('./users/user-form/user-form.component'),
    },
    {
        path: 'users/:id',
        loadComponent: () => import('./users/user-detail/user-detail.component'),
    },
    {
        path: 'users/:id/edit',
        loadComponent: () => import('./users/user-form/user-form.component'),
    },
    {
        path: 'roles',
        loadComponent: () => import('./roles/roles.component'),
    },
    {
        path: 'suppliers',
        loadComponent: () => import('./suppliers/suppliers.component'),
    },
    {
        path: 'suppliers/new',
        loadComponent: () => import('./suppliers/supplier-form/supplier-form.component'),
    },
    {
        path: 'suppliers/:id/edit',
        loadComponent: () => import('./suppliers/supplier-form/supplier-form.component'),
    },
    {
        path: 'customers',
        loadComponent: () => import('./customers/customers.component'),
    },
    {
        path: 'customers/new',
        loadComponent: () => import('./customers/customer-form/customer-form.component'),
    },
    {
        path: 'customers/:id/edit',
        loadComponent: () => import('./customers/customer-form/customer-form.component'),
    },
] as Routes;
