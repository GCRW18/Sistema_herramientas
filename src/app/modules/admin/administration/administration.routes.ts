import { Routes } from '@angular/router';
import { AdministrationComponent } from './administration.component';

export default [
    {
        path: '',
        component: AdministrationComponent,
        children: [
            {
                path: 'dashboard',
                loadComponent: () => import('./dashboard/administration-dashboard.component')
                    .then(m => m.AdministrationDashboardComponent)
            },
            {
                path: 'usuarios',
                loadComponent: () => import('./usuarios/usuarios.component')
                    .then(m => m.UsuariosComponent)
            },
            {
                path: 'proveedores',
                loadComponent: () => import('./proveedores/proveedores.component')
                    .then(m => m.ProveedoresComponent)
            },
            {
                path: 'clientes',
                loadComponent: () => import('./clientes/clientes.component')
                    .then(m => m.ClientesComponent)
            },
            {
                path: 'roles',
                loadComponent: () => import('./roles/roles.component')
                    .then(m => m.RolesComponent)
            }
        ]
    }
] as Routes;
