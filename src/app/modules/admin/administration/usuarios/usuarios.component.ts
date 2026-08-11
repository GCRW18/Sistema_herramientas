import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { EmployeeService } from '../../../../core/services/employee.service';

/**
 * Módulo Usuarios — patrón "Funcionarios" (solo consulta):
 * herramientas/employees/listarFuncionarios (he.ft_funcionarios_segu_sel,
 * une segu.tusuario + he.temployees → cargo/área/base/licencia y ficha completa).
 * SOLO LECTURA: las cuentas de login pertenecen al framework (schema segu).
 * Click en fila → ficha VerUsuarioComponent.
 */
interface UsuarioTabla {
    id: number;
    cuenta: string;
    nombreCompleto: string;
    cargo: string;
    area: string;
    base: string;
    estado: 'ACTIVO' | 'INACTIVO';
    raw: any;
}

@Component({
    selector: 'app-usuarios',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatTooltipModule,
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
    private snackBar    = inject(MatSnackBar);
    private dialog      = inject(MatDialog);
    private employeeSvc = inject(EmployeeService);

    searchControl = new FormControl('');

    usuarios: UsuarioTabla[] = [];
    filteredUsuarios: UsuarioTabla[] = [];
    isLoading = false;

    /* ── Paginación ── */
    readonly pageSize = 10;
    pagina = signal(1);

    ngOnInit(): void {
        this.cargarUsuarios();
        this.searchControl.valueChanges.subscribe(value => {
            this.filterUsuarios(value || '');
        });
    }

    cargarUsuarios(): void {
        this.isLoading = true;
        this.employeeSvc.getFuncionarios().subscribe({
            next: (rows: any[]) => {
                this.usuarios = rows.map(f => this.mapearUsuario(f));
                this.filterUsuarios(this.searchControl.value || '');
                this.isLoading = false;
            },
            error: () => {
                this.usuarios = [];
                this.filterUsuarios('');
                this.isLoading = false;
                this.snackBar.open('Error al cargar usuarios', 'Cerrar', { duration: 5000, verticalPosition: 'top' });
            }
        });
    }

    private mapearUsuario(f: any): UsuarioTabla {
        return {
            id: Number(f.id_usuario ?? 0),
            cuenta: f.cuenta || '',
            nombreCompleto: f.full_name || f.cuenta || '',
            cargo: f.cargo || '',
            area: f.area || '',
            base: f.base_code || '',
            estado: f.active ? 'ACTIVO' : 'INACTIVO',
            raw: f
        };
    }

    filterUsuarios(searchTerm: string): void {
        const term = searchTerm.toLowerCase();
        this.filteredUsuarios = this.usuarios.filter(u =>
            u.nombreCompleto.toLowerCase().includes(term) ||
            u.cuenta.toLowerCase().includes(term) ||
            u.cargo.toLowerCase().includes(term) ||
            u.area.toLowerCase().includes(term)
        );
        this.pagina.set(1);
    }

    /* ── Ficha de solo lectura ── */

    async verFicha(u: UsuarioTabla): Promise<void> {
        const { VerUsuarioComponent } = await import('./dialogs/ver-usuario/ver-usuario.component');
        this.dialog.open(VerUsuarioComponent, {
            width: '860px', maxWidth: '95vw', maxHeight: '90vh',
            panelClass: 'no-padding-dialog',
            data: { funcionario: u.raw }
        });
    }

    /* ── Paginación ── */

    get totalPaginas(): number {
        return Math.max(1, Math.ceil(this.filteredUsuarios.length / this.pageSize));
    }

    get usuariosPagina(): UsuarioTabla[] {
        const p = Math.min(this.pagina(), this.totalPaginas);
        const inicio = (p - 1) * this.pageSize;
        return this.filteredUsuarios.slice(inicio, inicio + this.pageSize);
    }

    get rangoPagina(): { desde: number; hasta: number } {
        const total = this.filteredUsuarios.length;
        if (!total) return { desde: 0, hasta: 0 };
        const p = Math.min(this.pagina(), this.totalPaginas);
        const desde = (p - 1) * this.pageSize + 1;
        return { desde, hasta: Math.min(p * this.pageSize, total) };
    }

    paginasVisibles(): number[] {
        const total  = this.totalPaginas;
        const actual = Math.min(this.pagina(), total);
        const inicio = Math.max(1, Math.min(actual - 2, total - 4));
        const fin    = Math.min(total, inicio + 4);
        const out: number[] = [];
        for (let i = inicio; i <= fin; i++) out.push(i);
        return out;
    }

    irAPagina(p: number): void {
        this.pagina.set(Math.min(Math.max(1, p), this.totalPaginas));
    }

    /* ── KPIs ── */

    getUsuariosActivos(): number {
        return this.usuarios.filter(u => u.estado === 'ACTIVO').length;
    }

    getUsuariosInactivos(): number {
        return this.usuarios.filter(u => u.estado === 'INACTIVO').length;
    }
}
