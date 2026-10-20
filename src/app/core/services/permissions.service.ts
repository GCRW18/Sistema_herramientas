import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, fromEvent, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
import { RoleService } from './role.service';
import { AppArea, AREA_SUBMODULES } from '../models/role.types';
import { esActivo } from '../utils/bool.utils';

interface PermissionsState {
    permissions: string[];
}

const SIN_PERMISOS: PermissionsState = { permissions: [] };

/** Espera mínima entre recargas automáticas (al navegar o volver a la pestaña del navegador). */
const REFRESH_MIN_MS = 30_000;

/**
 * Permisos del usuario logueado, resueltos desde he.tusuarios → he.roles.
 *
 * Se recargan solos al navegar y al volver a la pestaña del navegador (como mucho
 * cada 30 s), y al instante con `refresh()` — así un cambio de rol se aplica sin
 * cerrar sesión. can()/allowedTabs()/canAccessArea() son streams vivos: vuelven a
 * emitir cuando los permisos cambian (desuscribirse al destruir el componente).
 *
 * Sin rol asignado (o rol desactivado) no hay permisos: el usuario solo ve el
 * Dashboard, igual que he.f_verificar_permiso le corta toda escritura.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
    private _roleSvc = inject(RoleService);
    private _router = inject(Router);
    private _state = new BehaviorSubject<PermissionsState | null>(null);
    private _loadSub: Subscription | null = null;
    private _lastLoad = 0;

    constructor() {
        this._router.events.pipe(filter(e => e instanceof NavigationEnd))
            .subscribe(() => this._refreshIfStale());
        if (typeof document !== 'undefined') {
            fromEvent(document, 'visibilitychange')
                .pipe(filter(() => document.visibilityState === 'visible'))
                .subscribe(() => this._refreshIfStale());
        }
    }

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
            return of(SIN_PERMISOS);
        }
        return this._roleSvc.getUserRoleAssignment(idUsuario).pipe(
            switchMap(({ id_role }) => {
                if (!id_role) return of(SIN_PERMISOS);
                // Rol desactivado = sin permisos (igual que he.f_verificar_permiso)
                return this._roleSvc.getRoleById(id_role).pipe(
                    map((role: any) => ({
                        permissions: role && esActivo(role.active) ? this._parsePermissions(role.permissions) : []
                    }))
                );
            })
        );
    }

    /** Vuelve a leer los permisos del backend; si cambiaron, la UI se actualiza sola. */
    refresh(): void {
        this._loadSub?.unsubscribe();
        this._lastLoad = Date.now();
        this._loadSub = this._load().pipe(
            // Si falla una recarga se conservan los permisos que ya había; si falla la
            // primera, queda sin permisos y se reintenta en la próxima navegación.
            catchError(() => {
                this._lastLoad = 0;
                return of(this._state.value ?? SIN_PERMISOS);
            })
        ).subscribe(s => {
            this._state.next(s);
            this._expulsarSiSinAcceso();
        });
    }

    private _refreshIfStale(): void {
        if (!this._currentUserId() || !this._state.value) return;
        if (Date.now() - this._lastLoad >= REFRESH_MIN_MS) this.refresh();
    }

    /** Si el rol perdió el módulo en el que está el usuario, lo saca al Dashboard. */
    private _expulsarSiSinAcceso(): void {
        const area = this._router.url.split(/[/?#]/)[1] as AppArea;
        if (!AREA_SUBMODULES[area]) return;
        if (!Object.values(AREA_SUBMODULES[area]).some(prefix => this._hasPrefix(this._state.value!, prefix))) {
            this._router.navigateByUrl('/dashboard');
        }
    }

    /** Estado de permisos vigente; la primera suscripción dispara la carga. */
    private get state$(): Observable<PermissionsState> {
        if (!this._state.value && !this._loadSub) this.refresh();
        return this._state.pipe(filter((s): s is PermissionsState => s !== null));
    }

    /** true si el elemento protegido por `permissionId` debe mostrarse. */
    can(permissionId: string): Observable<boolean> {
        return this.state$.pipe(
            map(s => s.permissions.includes(permissionId)),
            distinctUntilChanged()
        );
    }

    /** true si el rol tiene al menos un permiso del submódulo (prefijo `kits` → `kits.*`). */
    private _hasPrefix(s: PermissionsState, prefix: string): boolean {
        return s.permissions.some(p => p.startsWith(prefix + '.'));
    }

    /** Pestañas (type de MODULE_DEFS) del módulo que el rol puede ver. */
    allowedTabs(area: AppArea): Observable<Set<number>> {
        return this.state$.pipe(
            map(s => Object.entries(AREA_SUBMODULES[area])
                .filter(([, prefix]) => this._hasPrefix(s, prefix))
                .map(([type]) => Number(type))
                .join(',')),
            distinctUntilChanged(),
            map(tipos => new Set(tipos ? tipos.split(',').map(Number) : []))
        );
    }

    /** true si el módulo del menú debe mostrarse (alguna de sus pestañas es visible). */
    canAccessArea(area: AppArea): Observable<boolean> {
        return this.allowedTabs(area).pipe(map(tabs => tabs.size > 0), distinctUntilChanged());
    }

    /** Limpia la caché — llamar al cerrar sesión para no arrastrar permisos del usuario anterior. */
    reset(): void {
        this._loadSub?.unsubscribe();
        this._loadSub = null;
        this._lastLoad = 0;
        this._state.next(null);
    }
}
