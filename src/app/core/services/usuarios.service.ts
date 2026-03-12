import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap } from 'rxjs';
import { ErpApiService } from '../api/api.service';

export interface UsuarioHE {
    id_usuario_he: number;
    estado_reg: string;
    username: string;
    nombres: string;
    apellidos: string;
    ci: string;
    telefono: string;
    email: string;
    id_role: number;
    departamento: string;
    active: boolean;
    ultimo_acceso: string | null;
    fecha_reg: string;
    fecha_mod: string;
    usr_reg: string;
    usr_mod: string;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
    private _api = inject(ErpApiService);
    private _usuarios: ReplaySubject<UsuarioHE[]> = new ReplaySubject<UsuarioHE[]>(1);

    get usuarios$(): Observable<UsuarioHE[]> {
        return this._usuarios.asObservable();
    }

    getUsuarios(filters?: any): Observable<UsuarioHE[]> {
        const params: any = {
            start: 0,
            limit: 100,
            sort: 'id_usuario_he',
            dir: 'asc',
            ...filters
        };
        return from(this._api.post('herramientas/usuarios/listarUsuarios', params)).pipe(
            switchMap((response: any) => {
                const usuarios = response?.data || [];
                this._usuarios.next(usuarios);
                return of(usuarios);
            })
        );
    }

    createUsuario(usuario: any): Observable<any> {
        return from(this._api.post('herramientas/usuarios/insertarUsuarios', usuario)).pipe(
            switchMap((response: any) => of(response?.data || usuario))
        );
    }

    updateUsuario(id: number, usuario: any): Observable<any> {
        return from(this._api.post('herramientas/usuarios/insertarUsuarios', {
            ...usuario,
            id_usuario_he: id
        })).pipe(
            switchMap((response: any) => of(response?.data || usuario))
        );
    }

    deleteUsuario(id: number): Observable<void> {
        return from(this._api.post('herramientas/usuarios/eliminarUsuarios', {
            id_usuario_he: id
        })).pipe(
            switchMap(() => of(undefined))
        );
    }
}
