import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { RoleService } from './role.service';
import { AppArea, AREA_SUBMODULES } from '../models/role.types';

interface PermissionsState {
    /** true si el usuario tiene una fila en he.tusuarios con id_role asignado */
    hasRoleData: boolean;
    permissions: string[];
}

/**
 * Permisos del usuario logueado, resueltos desde he.tusuarios → he.roles y
 * cacheados en memoria por el resto de la sesión (una sola consulta al backend).
 *
 * Fail-open por diseño mientras el rollout de roles esté incompleto: si el
 * usuario no tiene fila en he.tusuarios / id_role asignado, `can()` devuelve
 * true para cualquier permiso (no lo bloquea). Una vez que el usuario SÍ tiene
 * rol asignado, cada permiso puntual se evalúa contra su JSON — ahí si falta,
 * se oculta. Ver [[project_roles_permission_enforcement]] en memoria.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
    private _roleSvc = inject(RoleService);
    private _state$: Observable<PermissionsState> | null = null;

    private _currentUserId(): number | null {
        try {
            const raw = localStorage.getItem('aut');
            const auth = raw ? JSON.parse(raw) : null;
            return auth?.id_usuario ? Number(auth.id_usuario) : null;
        } catch {
            return null;
        }
    }

    private _parsePermissions(raw: any): string[] {
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string' && raw.trim()) {
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch { return []; }
        }
        return [];
    }

    private _load(): Observable<PermissionsState> {
        const idUsuario = this._currentUserId();
        if (!idUsuario) {
            return of({ hasRoleData: false, permissions: [] });
        }
        return this._roleSvc.getUserRoleAssignment(idUsuario).pipe(
            switchMap(({ id_role }) => {
                if (!id_role) return of({ hasRoleData: false, permissions: [] });
                return this._roleSvc.getRoleById(id_role).pipe(
                    map((role: any) => ({
                        hasRoleData: true,
                        permissions: this._parsePermissions(role?.permissions)
                    }))
                );
            }),
            catchError(() => of({ hasRoleData: false, permissions: [] }))
        );
    }

    /** Estado de permisos cacheado en memoria — una sola consulta al backend por sesión. */
    private get state$(): Observable<PermissionsState> {
        if (!this._state$) {
            this._state$ = this._load().pipe(shareReplay({ bufferSize: 1, refCount: false }));
        }
        return this._state$;
    }

    /** true si el elemento protegido por `permissionId` debe mostrarse. */
    can(permissionId: string): Observable<boolean> {
        return this.state$.pipe(
            map(s => !s.hasRoleData || s.permissions.includes(permissionId))
        );
    }

    /** true si el rol tiene al menos un permiso del submódulo (prefijo `kits` → `kits.*`). */
    private _hasPrefix(s: PermissionsState, prefix: string): boolean {
        return !s.hasRoleData || s.permissions.some(p => p.startsWith(prefix + '.'));
    }

    /** Pestañas (type de MODULE_DEFS) del módulo que el rol puede ver. */
    allowedTabs(area: AppArea): Observable<Set<number>> {
        return this.state$.pipe(
            map(s => new Set(
                Object.entries(AREA_SUBMODULES[area])
                    .filter(([, prefix]) => this._hasPrefix(s, prefix))
                    .map(([type]) => Number(type))
            ))
        );
    }

    /** true si el módulo del menú debe mostrarse (alguna de sus pestañas es visible). */
    canAccessArea(area: AppArea): Observable<boolean> {
        return this.allowedTabs(area).pipe(map(tabs => tabs.size > 0));
    }

    /** Limpia la caché — llamar al cerrar sesión para no arrastrar permisos del usuario anterior. */
    reset(): void {
        this._state$ = null;
    }
}
