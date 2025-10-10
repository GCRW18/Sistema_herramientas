import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { User } from 'app/core/user/user.types';
import { map, Observable, of, ReplaySubject, tap } from 'rxjs';
import { cloneDeep } from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class UserService {
    private _httpClient = inject(HttpClient);
    private _user: ReplaySubject<any> = new ReplaySubject<any>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Setter & getter for user
     *
     * @param value
     */
    set user(value: any) {
        // Store the value
        this._user.next(value);
    }

    get user$(): Observable<any> {
        return this._user.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get the current signed-in user data
     */
    get(): Observable<any> {
        let auth = JSON.parse(localStorage.getItem('aut'));

        let protocol = location.protocol.replace(':', '');
        let user = {
            avatar: `${protocol}://erp.boa.bo/uploaded_files/sis_parametros/Archivo/${auth.logo}`,
            email: auth.email,
            id: auth.id_usuario,
            name: auth.nombre_usuario,
            status: "online"
        };

        this._user.next(user);
        return of(cloneDeep(user));
    }

    /**
     * Update the user
     *
     * @param user
     */
    update(user: User): Observable<any> {
        // Update the user
        this._user.next(user);
        // Return the response
        return of(cloneDeep(user));
    }

    /**
     * Get user by ID
     *
     * @param id
     */
    getUserById(id: string): Observable<User> {
        return this._httpClient.get<User>(`api/users/${id}`);
    }

    /**
     * Create user
     *
     * @param user
     */
    createUser(user: Partial<User>): Observable<User> {
        return this._httpClient.post<User>('api/users', user);
    }

    /**
     * Update user by ID
     *
     * @param id
     * @param user
     */
    updateUser(id: string, user: Partial<User>): Observable<User> {
        return this._httpClient.put<User>(`api/users/${id}`, user);
    }

    /**
     * Delete user
     *
     * @param id
     */
    deleteUser(id: string): Observable<void> {
        return this._httpClient.delete<void>(`api/users/${id}`);
    }

    /**
     * Get all users
     */
    getUsers(): Observable<User[]> {
        return this._httpClient.get<User[]>('api/users');
    }
}
