import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FormUsuarioComponent } from './dialogs/form-usuario/form-usuario.component';

interface Usuario {
    id: number;
    nombre: string;
    email: string;
    rol: string;
    departamento: string;
    estado: 'ACTIVO' | 'INACTIVO';
    ultimoAcceso: string;
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
        ReactiveFormsModule
    ],
    templateUrl: './usuarios.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }
    `]
})
export class UsuariosComponent implements OnInit {
    private router = inject(Router);
    private dialog = inject(MatDialog);

    searchControl = new FormControl('');
    displayedColumns: string[] = ['nombre', 'email', 'rol', 'departamento', 'estado', 'ultimoAcceso', 'acciones'];

    usuarios: Usuario[] = [
        {
            id: 1,
            nombre: 'Gabriel CR',
            email: 'gabriel.cr@boa.bo',
            rol: 'Administrador',
            departamento: 'Sistemas',
            estado: 'ACTIVO',
            ultimoAcceso: '04/01/2026 14:30'
        },
        {
            id: 2,
            nombre: 'Juan Pérez',
            email: 'juan.perez@boa.bo',
            rol: 'Encargado de Almacén',
            departamento: 'Mantenimiento',
            estado: 'ACTIVO',
            ultimoAcceso: '04/01/2026 12:15'
        },
        {
            id: 3,
            nombre: 'Ana López',
            email: 'ana.lopez@boa.bo',
            rol: 'Técnico',
            departamento: 'Operaciones',
            estado: 'ACTIVO',
            ultimoAcceso: '03/01/2026 16:45'
        },
        {
            id: 4,
            nombre: 'Carlos Mendoza',
            email: 'carlos.mendoza@boa.bo',
            rol: 'Visualizador',
            departamento: 'Administración',
            estado: 'INACTIVO',
            ultimoAcceso: '25/12/2025 09:00'
        }
    ];

    filteredUsuarios: Usuario[] = [...this.usuarios];

    ngOnInit(): void {
        this.searchControl.valueChanges.subscribe(value => {
            this.filterUsuarios(value || '');
        });
    }

    filterUsuarios(searchTerm: string): void {
        const term = searchTerm.toLowerCase();
        this.filteredUsuarios = this.usuarios.filter(usuario =>
            usuario.nombre.toLowerCase().includes(term) ||
            usuario.email.toLowerCase().includes(term) ||
            usuario.rol.toLowerCase().includes(term) ||
            usuario.departamento.toLowerCase().includes(term)
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
            data: { mode: 'create' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                const nuevoUsuario: Usuario = {
                    id: this.usuarios.length + 1,
                    nombre: `${result.nombres} ${result.apellidos}`,
                    email: result.email,
                    rol: this.getRolNombre(result.role_id),
                    departamento: 'Sin asignar',
                    estado: result.active ? 'ACTIVO' : 'INACTIVO',
                    ultimoAcceso: 'Nunca'
                };
                this.usuarios.push(nuevoUsuario);
                this.filteredUsuarios = [...this.usuarios];
            }
        });
    }

    editarUsuario(usuario: Usuario): void {
        const dialogRef = this.dialog.open(FormUsuarioComponent, {
            width: '900px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            panelClass: ['neo-dialog', 'no-padding-dialog'],
            data: {
                mode: 'edit',
                usuario: {
                    username: usuario.email.split('@')[0],
                    nombres: usuario.nombre.split(' ')[0],
                    apellidos: usuario.nombre.split(' ').slice(1).join(' '),
                    ci: '',
                    telefono: '',
                    email: usuario.email,
                    role_id: this.getRolId(usuario.rol),
                    active: usuario.estado === 'ACTIVO'
                }
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                const index = this.usuarios.findIndex(u => u.id === usuario.id);
                if (index !== -1) {
                    this.usuarios[index] = {
                        ...this.usuarios[index],
                        nombre: `${result.nombres} ${result.apellidos}`,
                        email: result.email,
                        rol: this.getRolNombre(result.role_id),
                        estado: result.active ? 'ACTIVO' : 'INACTIVO'
                    };
                    this.filteredUsuarios = [...this.usuarios];
                }
            }
        });
    }

    verDetalles(usuario: Usuario): void {
        const dialogRef = this.dialog.open(FormUsuarioComponent, {
            width: '900px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            panelClass: ['neo-dialog', 'no-padding-dialog'],
            data: {
                mode: 'edit',
                usuario: {
                    username: usuario.email.split('@')[0],
                    nombres: usuario.nombre.split(' ')[0],
                    apellidos: usuario.nombre.split(' ').slice(1).join(' '),
                    ci: '',
                    telefono: '',
                    email: usuario.email,
                    role_id: this.getRolId(usuario.rol),
                    active: usuario.estado === 'ACTIVO'
                }
            }
        });
    }

    private getRolNombre(roleId: number): string {
        const roles: { [key: number]: string } = {
            1: 'Administrador',
            2: 'Supervisor',
            3: 'Técnico',
            4: 'Encargado',
            5: 'Auditor'
        };
        return roles[roleId] || 'Sin rol';
    }

    private getRolId(rolNombre: string): number {
        const roles: { [key: string]: number } = {
            'Administrador': 1,
            'Supervisor': 2,
            'Técnico': 3,
            'Encargado': 4,
            'Auditor': 5,
            'Encargado de Almacén': 2,
            'Visualizador': 5
        };
        return roles[rolNombre] || 1;
    }

    eliminarUsuario(usuario: Usuario): void {
        if (confirm(`¿Está seguro de eliminar al usuario ${usuario.nombre}?`)) {
            this.usuarios = this.usuarios.filter(u => u.id !== usuario.id);
            this.filteredUsuarios = [...this.usuarios];
            console.log('Usuario eliminado:', usuario);
        }
    }

    getUsuariosActivos(): number {
        return this.usuarios.filter(u => u.estado === 'ACTIVO').length;
    }

    getUsuariosInactivos(): number {
        return this.usuarios.filter(u => u.estado === 'INACTIVO').length;
    }
}
