import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common'; // Importar Location
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { AdminService } from '../../../../core/services/admin.service';
import { RoleService } from '../../../../core/services/role.service';
import { User, Supplier, Customer } from '../../../../core/models/user.types';
import { Role } from '../../../../core/models/role.types';

// Interfaces
interface DashboardStats {
    usuarios: { total: number; activos: number; inactivos: number; porRol: { rol: string; cantidad: number; }[]; };
    proveedores: { total: number; activos: number; inactivos: number; porTipo: { tipo: string; cantidad: number; }[]; };
    clientes: { total: number; activos: number; inactivos: number; porTipo: { tipo: string; cantidad: number; }[]; };
    roles: { total: number; activos: number; sistema: number; personalizados: number; };
}

interface ActivityItem {
    fecha: Date;
    tipo: 'CREAR' | 'EDITAR' | 'ELIMINAR';
    entidad: string;
    detalle: string;
    usuario: string;
}

@Component({
    selector: 'app-administration-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatDialogModule,
        MatSnackBarModule
    ],
    templateUrl: './administration-dashboard.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 3px solid black;
            --neo-shadow: 5px 5px 0px 0px rgba(0, 0, 0, 1);
        }

        /* --- NEO-BRUTALISM MASTER CLASSES --- */
        .neo-card-base {
            background-color: white;
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
            position: relative;
        }

        .neo-card-base:hover {
            transform: translate(-2px, -2px);
            box-shadow: 7px 7px 0px 0px rgba(0, 0, 0, 1);
        }

        /* Dark mode overrides */
        :host-context(.dark) .neo-card-base {
            background-color: #1e293b;
        }

        :host-context(.dark) .neo-card-base:hover {
            box-shadow: 7px 7px 0px 0px rgb(9, 16, 55);
        }

        /* Scrollbar styling */
        .overflow-y-auto::-webkit-scrollbar,
        .overflow-x-auto::-webkit-scrollbar { width: 8px; height: 8px; }
        .overflow-y-auto::-webkit-scrollbar-track,
        .overflow-x-auto::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
        .overflow-y-auto::-webkit-scrollbar-thumb,
        .overflow-x-auto::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; border: 2px solid #f1f1f1; }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover,
        .overflow-x-auto::-webkit-scrollbar-thumb:hover { background: #111A43; }
    `]
})
export class AdministrationDashboardComponent implements OnInit {
    private router = inject(Router);
    private location = inject(Location); // Inyectar Location
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private adminService = inject(AdminService);
    private roleService = inject(RoleService);

    loading = false;
    stats: DashboardStats = {
        usuarios: { total: 0, activos: 0, inactivos: 0, porRol: [] },
        proveedores: { total: 0, activos: 0, inactivos: 0, porTipo: [] },
        clientes: { total: 0, activos: 0, inactivos: 0, porTipo: [] },
        roles: { total: 0, activos: 0, sistema: 0, personalizados: 0 }
    };

    actividadReciente: ActivityItem[] = [];
    currentDate = new Date();

    ngOnInit(): void {
        this.loadDashboardData();
    }

    loadDashboardData(): void {
        this.loading = true;
        forkJoin({
            usuarios: this.adminService.getUsers(),
            proveedores: this.adminService.getSuppliers(),
            clientes: this.adminService.getCustomers(),
            roles: this.roleService.getRoles()
        }).subscribe({
            next: (data) => {
                this.stats = this.calculateStats(data);
                this.actividadReciente = this.generateRecentActivity();
                this.loading = false;
            },
            error: (err) => {
                console.error(err);
                this.loading = false;
            }
        });
    }

    private calculateStats(data: { usuarios: User[]; proveedores: Supplier[]; clientes: Customer[]; roles: Role[]; }): DashboardStats {
        return {
            usuarios: this.calculateUsuariosStats(data.usuarios, data.roles),
            proveedores: this.calculateProveedoresStats(data.proveedores),
            clientes: this.calculateClientesStats(data.clientes),
            roles: this.calculateRolesStats(data.roles)
        };
    }

    private calculateUsuariosStats(usuarios: User[], roles: Role[]) {
        const activos = usuarios.filter(u => u.active).length;
        return { total: usuarios.length, activos, inactivos: usuarios.length - activos, porRol: [] };
    }

    private calculateProveedoresStats(proveedores: Supplier[]) {
        const activos = proveedores.filter(p => p.active).length;
        return { total: proveedores.length, activos, inactivos: proveedores.length - activos, porTipo: [{tipo: 'MANTENIMIENTO', cantidad: 5}, {tipo: 'CALIBRACION', cantidad: 2}] };
    }

    private calculateClientesStats(clientes: Customer[]) {
        return { total: clientes.length, activos: clientes.length, inactivos: 0, porTipo: [] };
    }

    private calculateRolesStats(roles: Role[]) {
        return { total: roles.length, activos: roles.length, sistema: 0, personalizados: roles.length };
    }

    private generateRecentActivity(): ActivityItem[] {
        const now = new Date();
        return [
            { fecha: new Date(now.getTime() - 5 * 60000), tipo: 'CREAR', entidad: 'Usuario', detalle: 'J. Pérez', usuario: 'Admin' },
            { fecha: new Date(now.getTime() - 15 * 60000), tipo: 'EDITAR', entidad: 'Proveedor', detalle: 'Herramientas SAC', usuario: 'Admin' },
            { fecha: new Date(now.getTime() - 60 * 60000), tipo: 'ELIMINAR', entidad: 'Cliente', detalle: 'Baja #44', usuario: 'Admin' },
            { fecha: new Date(now.getTime() - 120 * 60000), tipo: 'CREAR', entidad: 'Rol', detalle: 'Supervisor', usuario: 'Admin' }
        ];
    }

    navegarA(ruta: string): void {
        this.router.navigate([ruta]);
    }

    goBack(): void {
        this.location.back();
    }

    crearUsuario() { console.log('Crear usuario'); }
    crearProveedor() { console.log('Crear proveedor'); }
    crearCliente() { console.log('Crear cliente'); }

    refreshData(): void {
        this.loadDashboardData();
        this.snackBar.open('Datos actualizados', 'OK', { duration: 2000, panelClass: ['bg-[#111A43]', 'text-white'] });
    }

    formatearFecha(fecha: Date): string {
        const diff = Date.now() - fecha.getTime();
        const minutos = Math.floor(diff / 60000);
        if (minutos < 1) return 'Ahora';
        if (minutos < 60) return `${minutos} min`;
        if (minutos < 1440) return `${Math.floor(minutos / 60)} h`;
        return `${Math.floor(minutos / 1440)} d`;
    }

    getTipoBgColor(tipo: string): string {
        switch (tipo) {
            case 'CREAR': return 'bg-green-300 text-black border-green-600';
            case 'EDITAR': return 'bg-blue-300 text-black border-blue-600';
            case 'ELIMINAR': return 'bg-red-300 text-black border-red-600';
            default: return 'bg-gray-200';
        }
    }
}
