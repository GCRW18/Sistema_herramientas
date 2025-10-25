import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthUtils } from 'app/core/auth/auth.utils';
import { UserService } from 'app/core/user/user.service';
import { catchError, from, Observable, of, switchMap, throwError, timeout } from 'rxjs';
import { Router } from '@angular/router';

import PxpClient from 'pxp-client';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private _authenticated: boolean = false;
    private _httpClient = inject(HttpClient);
    private _userService = inject(UserService);
    private _erpInitialized: boolean = false;

    /**
     * Constructor
     */
    constructor(private _router: Router) {
        let auth = JSON.parse(localStorage.getItem('aut'));

        if( auth ) {
            this._authenticated = true;
        }
    }

    /**
     * Initialize params for authentication ERP
     */
    initErp() {
        if (this._erpInitialized) {
            return;
        }

        try {
            PxpClient.init(
                environment.host,
                environment.baseUrl,
                environment.mode,
                environment.port,
                environment.protocol,
                environment.backendRestVersion,
                environment.initWebSocket,
                environment.portWs,
                environment.backendVersion,
                environment.urlLogin,
                environment.storeToken
            );
            this._erpInitialized = true;
        } catch (error) {
            console.error('Error initializing PxpClient:', error);
            throw error;
        }
    }
    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Setter & getter for access token
     */
    set accessToken(token: string) {
        localStorage.setItem('accessToken', token);
    }

    get accessToken(): string {
        return localStorage.getItem('accessToken') ?? '';
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Forgot password
     *
     * @param email
     */
    forgotPassword(email: string): Observable<any> {
        return this._httpClient.post('api/auth/forgot-password', email);
    }

    /**
     * Reset password
     *
     * @param password
     */
    resetPassword(password: string): Observable<any> {
        return this._httpClient.post('api/auth/reset-password', password);
    }

    /**
     * Sign in
     *
     * @param credentials
     */
    signIn(credentials: { email: string; password: string }): Observable<any> {
        console.log('[AuthService] Iniciando login para:', credentials.email);
        console.time('login-duration');

        // Throw error, if the user is already logged in
        if (this._authenticated) {
            console.warn('[AuthService] Sesión ya activa');
            return of({
                error: true,
                message: 'Ya hay una sesión activa.'
            });
        }

        console.log('[AuthService] Inicializando PxpClient...');
        try {
            this.initErp();
            console.log('[AuthService] PxpClient inicializado correctamente');
        } catch (error) {
            console.error('[AuthService] Error inicializando PxpClient:', error);
            return of({
                error: true,
                message: 'Error al inicializar el cliente de autenticación'
            });
        }

        console.log('[AuthService] Llamando a PxpClient.login...');
        const loginStart = performance.now();

        return from(PxpClient.login(credentials.email, credentials.password)).pipe(
            timeout(90000), // Timeout reducido a 15 segundos
            switchMap((response: any) => {
                const loginEnd = performance.now();
                console.log(`[AuthService] Respuesta recibida en ${(loginEnd - loginStart).toFixed(2)}ms`);
                console.log('[AuthService] Respuesta del servidor:', response);

                // Store the access token in the local storage
                if ( response?.data?.success ) {
                    console.log('[AuthService] Login exitoso');

                    // Set the authenticated flag to true
                    this._authenticated = true;

                    // Store the user on the user service
                    let protocol = location.protocol.replace(':', '');
                    let user = {
                        id: response.data.id_usuario,
                        name: response.data.nombre_usuario,
                        email: response.user,
                        avatar: `${protocol}://erp.boa.bo/uploaded_files/sis_parametros/Archivo/${response.data.logo}`,
                        status: "online"
                    };
                    this._userService.user = user;

                    console.timeEnd('login-duration');
                    console.log('[AuthService] Usuario guardado:', user);

                    // Return a new observable with the response
                    return of(user);
                } else {
                    console.warn('[AuthService] Login fallido:', response?.message);
                    console.timeEnd('login-duration');

                    // Login failed
                    return of({
                        error: true,
                        message: response?.message || 'Usuario o contraseña incorrectos'
                    });
                }
            }),
            catchError((error) => {
                console.timeEnd('login-duration');
                console.error('[AuthService] Error en signIn:', error);

                let errorMessage = 'Error al iniciar sesión';

                if (error.name === 'TimeoutError') {
                    errorMessage = 'Tiempo de espera agotado (15s). Verifica la conexión al servidor.';
                    console.error('[AuthService] Timeout - El servidor no respondió en 15 segundos');
                } else if (error.message) {
                    errorMessage = error.message;
                } else if (!navigator.onLine) {
                    errorMessage = 'No hay conexión a internet.';
                }

                return of({
                    error: true,
                    message: errorMessage
                });
            })
        );
    }

    /**
     * Sign in using the access token
     */
    signInUsingToken(): Observable<any> {
        // Sign in using the token
        return this._httpClient
            .post('api/auth/sign-in-with-token', {
                accessToken: this.accessToken,
            })
            .pipe(
                catchError(() =>
                    // Return false
                    of(false)
                ),
                switchMap((response: any) => {
                    // Replace the access token with the new one if it's available on
                    // the response object.
                    //
                    // This is an added optional step for better security. Once you sign
                    // in using the token, you should generate a new one on the server
                    // side and attach it to the response object. Then the following
                    // piece of code can replace the token with the refreshed one.
                    if (response.accessToken) {
                        this.accessToken = response.accessToken;
                    }

                    // Set the authenticated flag to true
                    this._authenticated = true;

                    // Store the user on the user service
                    this._userService.user = response.user;

                    // Return true
                    return of(true);
                })
            );
    }

    /**
     * Sign out
     */
    signOut(): Observable<any> {
        // Remove the access token from the local storage
        localStorage.removeItem('aut');
        // Set the authenticated flag to false
        this._authenticated = false;
        PxpClient.logout();
        // Return the observable
        return of(true);
    }

    /**
     * Sign up
     *
     * @param user
     */
    signUp(user: {
        name: string;
        email: string;
        password: string;
        company: string;
    }): Observable<any> {
        return this._httpClient.post('api/auth/sign-up', user);
    }

    /**
     * Unlock session
     *
     * @param credentials
     */
    unlockSession(credentials: {
        email: string;
        password: string;
    }): Observable<any> {
        return this._httpClient.post('api/auth/unlock-session', credentials);
    }

    /**
     * Check the authentication status
     */
    check(): Observable<boolean> {
        // Check if the user is logged in
        let auth:any = localStorage.getItem('aut');
        if ( auth !== null)
            auth = JSON.parse(auth);

        // Check if the user is logged in
        if (auth) {
            return of(true);
        }

        return of(false);
    }

    /**
     * Redirect to
     */
    redirect(): Observable<any>
    {
        // Remove the access token from the local storage
        localStorage.removeItem('accessToken');
        // Set the authenticated flag to false
        this._authenticated = false;

        // Return the observable
        return of(true);
    }
}
