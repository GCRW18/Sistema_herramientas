import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { Role, RoleFormData } from '../models';

@Injectable({
    providedIn: 'root'
})
export class RoleService {
    private _httpClient = inject(HttpClient);
    private _roles = new BehaviorSubject<Role[]>([]);

    private readonly _apiUrl = '/api/roles';

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    get roles$(): Observable<Role[]> {
        return this._roles.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all roles
     */
    getRoles(): Observable<Role[]> {
        return this._httpClient.get<Role[]>(this._apiUrl).pipe(
            tap((roles) => this._roles.next(roles))
        );
    }

    /**
     * Get role by id
     */
    getRoleById(id: string): Observable<Role> {
        return this._httpClient.get<Role>(`${this._apiUrl}/${id}`);
    }

    /**
     * Create role
     */
    createRole(data: RoleFormData): Observable<Role> {
        return this._httpClient.post<Role>(this._apiUrl, data).pipe(
            tap(() => {
                // Refresh roles list
                this.getRoles().subscribe();
            })
        );
    }

    /**
     * Update role
     */
    updateRole(id: string, data: Partial<RoleFormData>): Observable<Role> {
        return this._httpClient.put<Role>(`${this._apiUrl}/${id}`, data).pipe(
            tap(() => {
                // Refresh roles list
                this.getRoles().subscribe();
            })
        );
    }

    /**
     * Delete role
     */
    deleteRole(id: string): Observable<void> {
        return this._httpClient.delete<void>(`${this._apiUrl}/${id}`).pipe(
            tap(() => {
                // Refresh roles list
                this.getRoles().subscribe();
            })
        );
    }

    /**
     * Toggle role active status
     */
    toggleRoleStatus(id: string, active: boolean): Observable<Role> {
        return this._httpClient.patch<Role>(`${this._apiUrl}/${id}/status`, { active }).pipe(
            tap(() => {
                // Refresh roles list
                this.getRoles().subscribe();
            })
        );
    }
}
