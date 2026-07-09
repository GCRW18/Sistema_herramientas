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
import { ErpApiService } from '../../../../core/api/api.service';

/**
 * Módulo Usuarios — patrón "Funcionarios" (solo consulta), con dos fuentes conmutables:
 *  · 'modulo': herramientas/employees/listarFuncionarios (he.ft_funcionarios_segu_sel,
 *    une segu.tusuario + he.temployees → cargo/área/base/licencia y ficha completa).
 *  · 'erp': seguridad/Usuario/listarUsuario — endpoint oficial del framework (payload
 *    provisto por el equipo ERP). Solo devuelve cuenta/nombre/estado, sin datos técnicos.
 * Ambas son SOLO LECTURA: las cuentas de login pertenecen al framework (schema segu).
 * Click en fila (solo fuente módulo) → ficha VerUsuarioComponent.
 */
type FuenteUsuarios = 'modulo' | 'erp';
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
    private api         = inject(ErpApiService);

    searchControl = new FormControl('');

    usuarios: UsuarioTabla[] = [];
    filteredUsuarios: UsuarioTabla[] = [];
    isLoading = false;

    /** Fuente activa: módulo (segu + he.temployees, con ficha) o endpoint oficial del ERP */
    fuente = signal<FuenteUsuarios>('modulo');

    /* ── Paginación ── */
    readonly pageSize = 10;
    pagina = signal(1);

    ngOnInit(): void {
        this.cargarUsuarios();
        this.searchControl.valueChanges.subscribe(value => {
            this.filterUsuarios(value || '');
        });
    }

    get esERP(): boolean { return this.fuente() === 'erp'; }

    cambiarFuente(f: FuenteUsuarios): void {
        if (this.fuente() === f) return;
        this.fuente.set(f);
        this.searchControl.setValue('', { emitEvent: false });
        this.cargarUsuarios();
    }

    cargarUsuarios(): void {
        if (this.esERP) { this.cargarUsuariosERP(); return; }
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

    /** Endpoint oficial del framework (segu.tusuario) — payload provisto por el equipo ERP */
    private async cargarUsuariosERP(): Promise<void> {
        this.isLoading = true;
        try {
            const r: any = await this.api.post('seguridad/Usuario/listarUsuario', {
                start: 0, limit: 50, sort: 'desc_person', dir: 'ASC', usuarios_activo: 'si'
            });
            const raw: any[] = r?.datos || r?.data || [];
            this.usuarios = raw.map(u => ({
                id: Number(u.id_usuario ?? 0),
                cuenta: u.cuenta || '',
                nombreCompleto: u.desc_person || u.cuenta || '',
                cargo: '',
                area: '',
                base: '',
                estado: (this.parseActivo(u.estado_reg) ? 'ACTIVO' : 'INACTIVO') as 'ACTIVO' | 'INACTIVO',
                raw: u
            }));
            this.filterUsuarios(this.searchControl.value || '');
        } catch {
            this.usuarios = [];
            this.filterUsuarios('');
            this.snackBar.open('Error al cargar usuarios del ERP', 'Cerrar', { duration: 5000, verticalPosition: 'top' });
        } finally {
            this.isLoading = false;
        }
    }

    private parseActivo(val: any): boolean {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return ['true', 't', '1', 'activo', 'si'].includes(val.toLowerCase());
        return !!val;
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
        if (this.esERP) {
            // El endpoint del ERP no trae datos técnicos: la ficha solo aplica a la fuente módulo
            this.snackBar.open('Fuente ERP: listado simple sin ficha técnica', 'Cerrar', { duration: 2500 });
            return;
        }
        const { VerUsuarioComponent } = await import('./dialogs/ver-usuario/ver-usuario.component');
        this.dialog.open(VerUsuarioComponent, {
            width: '520px', maxWidth: '95vw', maxHeight: '90vh',
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
