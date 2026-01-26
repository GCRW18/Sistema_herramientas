import { Route } from '@angular/router';
import { initialDataResolver } from 'app/app.resolvers';
import { AuthGuard } from 'app/core/auth/guards/auth.guard';
import { NoAuthGuard } from 'app/core/auth/guards/noAuth.guard';
import { LayoutComponent } from 'app/layout/layout.component';

// @formatter:off
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const appRoutes: Route[] = [

    // Redirect empty path to '/dashboard'
    {path: '', pathMatch : 'full', redirectTo: 'dashboard'},

    // Redirect signed-in user to the '/dashboard'
    {path: 'signed-in-redirect', pathMatch : 'full', redirectTo: 'dashboard'},

    // Auth routes for guests
    {
        path: '',
        canActivate: [NoAuthGuard],
        canActivateChild: [NoAuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            {path: 'confirmation-required', loadChildren: () => import('app/modules/auth/confirmation-required/confirmation-required.routes')},
            {path: 'forgot-password', loadChildren: () => import('app/modules/auth/forgot-password/forgot-password.routes')},
            {path: 'reset-password', loadChildren: () => import('app/modules/auth/reset-password/reset-password.routes')},
            {path: 'sign-in', loadChildren: () => import('app/modules/auth/sign-in/sign-in.routes')},
        ]
    },

    // Auth routes for authenticated users
    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            {path: 'sign-out', loadChildren: () => import('app/modules/auth/sign-out/sign-out.routes')},
            {path: 'unlock-session', loadChildren: () => import('app/modules/auth/unlock-session/unlock-session.routes')}
        ]
    },

    // Admin routes
    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        component: LayoutComponent,
        resolve: {
            initialData: initialDataResolver
        },
        children: [
            // DASHBOARD - Panel principal
            {path: 'dashboard', loadComponent: () => import('app/modules/admin/dashboard/dashboard.component').then(m => m.DashboardComponent)},

            // BAJAS - Gestión de bajas de herramientas

            // ENTRADAS - Gestión de entradas de herramientas
            {path: 'entradas', loadChildren: () => import('app/modules/admin/entries/entries.routes')},

            // SALIDAS - Gestión de salidas de herramientas
            {path: 'salidas', loadChildren: () => import('app/modules/admin/exits/exits.routes')},

            // KITS - Gestión de kits de herramientas
            {path: 'kits', loadChildren: () => import('app/modules/admin/kits/kits.routes')},


            // INVENTARIO - Consultas y gestión de inventario
            {path: 'inventario', loadChildren: () => import('app/modules/admin/inventory/inventory.routes')},

            // ADMINISTRACIÓN - Gestión de usuarios, roles, proveedores y clientes
            {path: 'administration', loadChildren: () => import('app/modules/admin/administration/administration.routes')},

            // REPORTES - Reportes y analíticas
            {path: 'reportes', loadChildren: () => import('app/modules/admin/reports/reports.routes')}
        ]
    }
];
