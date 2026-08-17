import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap } from 'rxjs';
import { Role, RoleFormData } from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class RoleService {
    private _api = inject(ErpApiService);

    getRoles(): Observable<Role[]> {
        return from(this._api.post('herramientas/roles/listarRoles', {
            start: 0,
            limit: 200,
            sort: 'name',
            dir: 'asc'
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    getRoleById(id: string): Observable<Role> {
        return from(this._api.post('herramientas/roles/listarRoles', {
            start: 0,
            limit: 1,
            id_role: id
        })).pipe(
            switchMap((response: any) => {
                const list = response?.datos || response?.data || [];
                return of(list[0] || null);
            })
        );
    }

    createRole(data: RoleFormData): Observable<Role> {
        return from(this._api.post('herramientas/roles/insertarRoles', data)).pipe(
            switchMap((response: any) => of(response?.datos?.[0] || response?.data?.[0] || data))
        );
    }

    updateRole(id: string, data: Partial<RoleFormData>): Observable<Role> {
        return from(this._api.post('herramientas/roles/insertarRoles', {
            ...data,
            id_role: id
        })).pipe(
            switchMap((response: any) => of(response?.datos?.[0] || response?.data?.[0] || data))
        );
    }

    deleteRole(id: string): Observable<void> {
        return from(this._api.post('herramientas/roles/eliminarRoles', {
            id_role: id
        })).pipe(
            switchMap(() => of(undefined))
        );
    }

    /**
     * Rol actualmente asignado (si existe fila espejo en he.tusuarios) para un usuario
     * real del framework. id_role se devuelve como string a propósito: el backend PHP
     * serializa los enteros de Postgres como string, y las <option [ngValue]> del
     * selector de rol también quedan como string — hay que comparar tipos iguales o
     * Angular nunca marca la opción como seleccionada.
     */
    getUserRoleAssignment(idUsuario: number): Observable<{ id_role: string | null }> {
        return from(this._api.post('herramientas/usuarios/listarUsuarios', {
            start: 0,
            limit: 1,
            filtro_adicional: `usr.id_usuario = ${idUsuario}`
        })).pipe(
            switchMap((response: any) => {
                const rows = response?.datos || response?.data || [];
                const idRole = rows[0]?.id_role;
                return of({ id_role: (idRole !== null && idRole !== undefined) ? String(idRole) : null });
            })
        );
    }

    /** Asigna/cambia el rol de un usuario real del framework (upsert en he.tusuarios). */
    assignRoleToUser(payload: {
        idUsuario: number; idRole: string | null;
        username: string; nombres: string; apellidos: string; email?: string;
    }): Observable<void> {
        return from(this._api.post('herramientas/usuarios/asignarRolUsuario', {
            id_usuario: payload.idUsuario,
            id_role:    payload.idRole,
            username:   payload.username,
            nombres:    payload.nombres,
            apellidos:  payload.apellidos,
            email:      payload.email || ''
        })).pipe(switchMap(() => of(undefined)));
    }
}
