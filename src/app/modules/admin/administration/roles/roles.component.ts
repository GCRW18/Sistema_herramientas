import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, startWith } from 'rxjs/operators';
import { RoleService } from '../../../../core/services/role.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

/**
 * Módulo Roles y Permisos — CRUD completo contra he.roles (herramientas/roles/*),
 * con la matriz de permisos serializada en he.roles.permissions como JSON de ids.
 */
interface RoleDisplay {
    id: string;
    nombre: string;
    descripcion: string;
    permissions: string[];
    userCount: number;
    activo: boolean;
}

@Component({
    selector: 'app-roles',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        HasPermissionDirective
    ],
    templateUrl: './roles.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
    `]
})
export class RolesComponent implements OnInit {
    private snackBar = inject(MatSnackBar);
    private dialog   = inject(MatDialog);
    private roleSvc  = inject(RoleService);

    searchControl = new FormControl('');

    roles: RoleDisplay[] = [];
    filteredRoles: RoleDisplay[] = [];
    isLoading = false;

    /* ── Paginación ── */
    readonly pageSize = 10;
    pagina = signal(1);

    ngOnInit(): void {
        this.loadRoles();
        this.setupSearch();
    }

    loadRoles(): void {
        this.isLoading = true;
        this.roleSvc.getRoles().subscribe({
            next: (rows: any[]) => {
                this.roles = (rows || []).map((x: any) => this.mapToDisplay(x));
                this.applyFilters();
                this.isLoading = false;
            },
            error: () => {
                this.roles = [];
                this.applyFilters();
                this.isLoading = false;
                this.snackBar.open('Error al cargar roles', 'Cerrar', { duration: 5000, verticalPosition: 'top' });
            }
        });
    }

    private mapToDisplay(r: any): RoleDisplay {
        return {
            id:          String(r.id_role ?? r.id ?? ''),
            nombre:      r.name || '',
            descripcion: r.description || '',
            permissions: this.parsePermissions(r.permissions),
            userCount:   Number(r.user_count ?? 0),
            activo:      this.parseActivo(r.active)
        };
    }

    private parsePermissions(raw: any): string[] {
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string' && raw.trim()) {
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch { return []; }
        }
        return [];
    }

    private parseActivo(val: any): boolean {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return ['true', 't', '1', 'activo', 'si'].includes(val.toLowerCase());
        return !!val;
    }

    /* ── Acciones CRUD ── */

    private buildPayload(formValue: any, activo: boolean): any {
        return {
            name:        formValue.nombre,
            description: formValue.descripcion || '',
            active:      formValue.active !== undefined ? formValue.active : activo,
            permissions: JSON.stringify(formValue.permissions || []),
        };
    }

    async nuevoRol(): Promise<void> {
        const { FormRolComponent } = await import('./dialogs/form-rol/form-rol.component');
        const ref = this.dialog.open(FormRolComponent, {
            width: '820px', maxWidth: '95vw', maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: { mode: 'create' }
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.roleSvc.createRole(this.buildPayload(result, true)).subscribe({
                next: () => {
                    this.snackBar.open('Rol creado', 'Cerrar', { duration: 2500 });
                    this.loadRoles();
                },
                error: () => this.snackBar.open('Error al crear rol', 'Cerrar', { duration: 4000 }),
            });
        });
    }

    async editarRol(r: RoleDisplay, ev?: Event): Promise<void> {
        ev?.stopPropagation();
        const { FormRolComponent } = await import('./dialogs/form-rol/form-rol.component');
        const ref = this.dialog.open(FormRolComponent, {
            width: '820px', maxWidth: '95vw', maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: {
                mode: 'edit',
                rol: { nombre: r.nombre, descripcion: r.descripcion, permissions: r.permissions, active: r.activo }
            }
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            const payload = this.buildPayload(result, r.activo);
            this.roleSvc.updateRole(r.id, payload).subscribe({
                next: () => {
                    this.snackBar.open('Rol actualizado', 'Cerrar', { duration: 2500 });
                    // Actualiza la fila localmente con lo que se acaba de guardar en vez de
                    // volver a pedir la lista: el backend tarda un instante en reflejar el
                    // commit en listarRoles, y un refetch inmediato aquí devolvía el dato
                    // viejo (se veía "no se actualiza" hasta un refresh manual).
                    this.applyOptimisticUpdate(r.id, {
                        nombre:      payload.name,
                        descripcion: payload.description,
                        permissions: result.permissions || [],
                        activo:      payload.active,
                    });
                },
                error: () => this.snackBar.open('Error al actualizar rol', 'Cerrar', { duration: 4000 }),
            });
        });
    }

    /** Refleja en la tabla, sin esperar un refetch, un cambio que ya se confirmó guardado. */
    private applyOptimisticUpdate(id: string, patch: Partial<RoleDisplay>): void {
        const idx = this.roles.findIndex(x => x.id === id);
        if (idx === -1) return;
        this.roles[idx] = { ...this.roles[idx], ...patch };
        this.applyFilters();
    }

    async verDetalle(r: RoleDisplay): Promise<void> {
        const { DetalleRolComponent } = await import('./dialogs/detalle-rol/detalle-rol.component');
        const ref = this.dialog.open(DetalleRolComponent, {
            width: '520px', maxWidth: '95vw', maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: {
                rol: {
                    nombre: r.nombre, name: r.nombre,
                    descripcion: r.descripcion, description: r.descripcion,
                    permissions: r.permissions,
                    userCount: r.userCount,
                    active: r.activo,
                },
                permissions: null
            }
        });
        ref.afterClosed().subscribe(result => {
            if (result?.action === 'edit') this.editarRol(r);
        });
    }

    toggleEstado(r: RoleDisplay, ev: Event): void {
        ev.stopPropagation();
        // HE_ROL_MOD sobrescribe todos los campos: enviar el registro completo
        // (permissions viaja serializado como JSON text, igual que en buildPayload)
        const payload: any = {
            name:        r.nombre,
            description: r.descripcion,
            active:      !r.activo,
            permissions: JSON.stringify(r.permissions),
        };
        this.roleSvc.updateRole(r.id, payload).subscribe({
            next: () => {
                this.snackBar.open(`Rol ${!r.activo ? 'activado' : 'desactivado'}`, 'Cerrar', { duration: 2500 });
                this.applyOptimisticUpdate(r.id, { activo: payload.active });
            },
            error: () => this.snackBar.open('Error al cambiar estado', 'Cerrar', { duration: 4000 }),
        });
    }

    /* ── Filtros ── */

    setupSearch(): void {
        this.searchControl.valueChanges.pipe(
            startWith(''),
            debounceTime(300)
        ).subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        const term = this.searchControl.value?.toLowerCase() || '';
        this.filteredRoles = term
            ? this.roles.filter(r =>
                r.nombre.toLowerCase().includes(term) ||
                r.descripcion?.toLowerCase().includes(term))
            : [...this.roles];
        this.pagina.set(1);
    }

    /* ── Paginación ── */

    get totalPaginas(): number {
        return Math.max(1, Math.ceil(this.filteredRoles.length / this.pageSize));
    }

    get rolesPagina(): RoleDisplay[] {
        const p = Math.min(this.pagina(), this.totalPaginas);
        const inicio = (p - 1) * this.pageSize;
        return this.filteredRoles.slice(inicio, inicio + this.pageSize);
    }

    get rangoPagina(): { desde: number; hasta: number } {
        const total = this.filteredRoles.length;
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

    getRolesActivos(): number {
        return this.roles.filter(r => r.activo).length;
    }

    getRolesInactivos(): number {
        return this.roles.filter(r => !r.activo).length;
    }
}
