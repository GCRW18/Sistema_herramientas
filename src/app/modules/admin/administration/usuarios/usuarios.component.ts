import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FormUsuarioComponent } from './dialogs/form-usuario/form-usuario.component';
import { UsuariosService, UsuarioHE } from '../../../../core/services/usuarios.service';
import { RoleService } from '../../../../core/services/role.service';

interface UsuarioTabla {
    id: number;
    nombre: string;
    email: string;
    rol: string;
    departamento: string;
    estado: 'ACTIVO' | 'INACTIVO';
    ultimoAcceso: string;
    _raw: UsuarioHE;
}

@Component({
    selector: 'app-usuarios',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        ReactiveFormsModule
    ],
    templateUrl: './usuarios.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
    `]
})
export class UsuariosComponent implements OnInit {
    private router          = inject(Router);
    private dialog          = inject(MatDialog);
    private usuariosService = inject(UsuariosService);
    private roleService     = inject(RoleService);

    searchControl = new FormControl('');
    displayedColumns: string[] = ['nombre', 'email', 'rol', 'departamento', 'estado', 'ultimoAcceso', 'acciones'];

    usuarios: UsuarioTabla[] = [];
    filteredUsuarios: UsuarioTabla[] = [];
    rolesList: any[] = [];
    isLoading = false;

    ngOnInit(): void {
        this.cargarRoles();
        this.cargarUsuarios();
        this.searchControl.valueChanges.subscribe(value => {
            this.filterUsuarios(value || '');
        });
    }

    private cargarRoles(): void {
        this.roleService.getRoles().subscribe({
            next: (roles) => { this.rolesList = roles; },
            error: () => { this.rolesList = []; }
        });
    }

    private cargarUsuarios(): void {
        this.isLoading = true;
        this.usuariosService.getUsuarios().subscribe({
            next: (data: UsuarioHE[]) => {
                this.usuarios = data.map(u => this.mapearUsuario(u));
                this.filteredUsuarios = [...this.usuarios];
                this.isLoading = false;
            },
            error: () => { this.isLoading = false; }
        });
    }

    private mapearUsuario(u: UsuarioHE): UsuarioTabla {
        const rol = this.rolesList.find(r => r.id_role === u.id_role);
        return {
            id: u.id_usuario_he,
            nombre: `${u.nombres} ${u.apellidos}`,
            email: u.email,
            rol: rol ? rol.name : 'Sin rol',
            departamento: u.departamento || 'Sin asignar',
            estado: u.active ? 'ACTIVO' : 'INACTIVO',
            ultimoAcceso: u.ultimo_acceso
                ? new Date(u.ultimo_acceso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Nunca',
            _raw: u
        };
    }

    filterUsuarios(searchTerm: string): void {
        const term = searchTerm.toLowerCase();
        this.filteredUsuarios = this.usuarios.filter(u =>
            u.nombre.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term) ||
            u.rol.toLowerCase().includes(term) ||
            u.departamento.toLowerCase().includes(term)
        );
    }

    volver(): void {
        this.router.navigate(['/administration']);
    }

    nuevoUsuario(): void {
        const dialogRef = this.dialog.open(FormUsuarioComponent, {
            width: '900px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            panelClass: ['neo-dialog', 'no-padding-dialog'],
            data: { mode: 'create', rolesList: this.rolesList }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (!result) return;
            this.usuariosService.createUsuario({
                username:     result.username,
                nombres:      result.nombres,
                apellidos:    result.apellidos,
                ci:           result.ci || '',
                telefono:     result.telefono || '',
                email:        result.email,
                password:     result.password,
                id_role:      result.role_id,
                departamento: result.departamento || 'Sin asignar',
                active:       result.active ? 'true' : 'false'
            }).subscribe({ next: () => this.cargarUsuarios() });
        });
    }

    editarUsuario(usuario: UsuarioTabla): void {
        const dialogRef = this.dialog.open(FormUsuarioComponent, {
            width: '900px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            panelClass: ['neo-dialog', 'no-padding-dialog'],
            data: {
                mode: 'edit',
                rolesList: this.rolesList,
                usuario: {
                    username:     usuario._raw.username,
                    nombres:      usuario._raw.nombres,
                    apellidos:    usuario._raw.apellidos,
                    ci:           usuario._raw.ci,
                    telefono:     usuario._raw.telefono,
                    email:        usuario._raw.email,
                    role_id:      usuario._raw.id_role,
                    departamento: usuario._raw.departamento,
                    active:       usuario._raw.active
                }
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (!result) return;
            this.usuariosService.updateUsuario(usuario.id, {
                username:     result.username,
                nombres:      result.nombres,
                apellidos:    result.apellidos,
                ci:           result.ci || '',
                telefono:     result.telefono || '',
                email:        result.email,
                password:     result.password || '',
                id_role:      result.role_id,
                departamento: result.departamento || 'Sin asignar',
                active:       result.active ? 'true' : 'false'
            }).subscribe({ next: () => this.cargarUsuarios() });
        });
    }

    eliminarUsuario(usuario: UsuarioTabla): void {
        if (confirm(`¿Está seguro de eliminar al usuario ${usuario.nombre}?`)) {
            this.usuariosService.deleteUsuario(usuario.id).subscribe({
                next: () => this.cargarUsuarios()
            });
        }
    }

    getUsuariosActivos(): number {
        return this.usuarios.filter(u => u.estado === 'ACTIVO').length;
    }

    getUsuariosInactivos(): number {
        return this.usuarios.filter(u => u.estado === 'INACTIVO').length;
    }
}
