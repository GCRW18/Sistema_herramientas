import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap } from 'rxjs';
import { Role, RoleFormData } from '../models';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class RoleService {
    private _api = inject(ErpApiService);
    private _roles = new ReplaySubject<Role[]>(1);

    get roles$(): Observable<Role[]> {
        return this._roles.asObservable();
    }

    getRoles(): Observable<Role[]> {
        return from(this._api.post('herramientas/roles/listarRoles', {
            start: 0,
            limit: 200,
            sort: 'name',
            dir: 'asc'
        })).pipe(
            switchMap((response: any) => {
                const roles = response?.data || [];
                this._roles.next(roles);
                return of(roles);
            })
        );
    }

    getRoleById(id: string): Observable<Role> {
        return from(this._api.post('herramientas/roles/listarRoles', {
            start: 0,
            limit: 1,
            id_role: id
        })).pipe(
            switchMap((response: any) => of(response?.data?.[0] || null))
        );
    }

    createRole(data: RoleFormData): Observable<Role> {
        return from(this._api.post('herramientas/roles/insertarRoles', data)).pipe(
            switchMap((response: any) => {
                this.getRoles().subscribe();
                return of(response?.data || data);
            })
        );
    }

    updateRole(id: string, data: Partial<RoleFormData>): Observable<Role> {
        return from(this._api.post('herramientas/roles/insertarRoles', {
            ...data,
            id_role: id
        })).pipe(
            switchMap((response: any) => {
                this.getRoles().subscribe();
                return of(response?.data || data);
            })
        );
    }

    deleteRole(id: string): Observable<void> {
        return from(this._api.post('herramientas/roles/eliminarRoles', {
            id_role: id
        })).pipe(
            switchMap(() => {
                this.getRoles().subscribe();
                return of(undefined);
            })
        );
    }

    toggleRoleStatus(id: string, active: boolean): Observable<Role> {
        return from(this._api.post('herramientas/roles/insertarRoles', {
            id_role: id,
            active: active
        })).pipe(
            switchMap((response: any) => {
                this.getRoles().subscribe();
                return of(response?.data || {});
            })
        );
    }
}
