import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap } from 'rxjs';
import { Employee } from '../models/employee.types';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
    private _api = inject(ErpApiService);

    getFuncionarios(filters?: { search?: string }): Observable<any[]> {
        const params: any = { start: 0, limit: 5000, sort: 'full_name', dir: 'asc' };

        if (filters?.search) {
            const s = filters.search.replace(/'/g, "''");
            params.filtro_adicional =
                `(LOWER(full_name) LIKE LOWER('%${s}%') OR LOWER(cuenta) LIKE LOWER('%${s}%'))`;
        }

        return from(this._api.post('herramientas/employees/listarFuncionarios', params)).pipe(
            switchMap((response: any) => {
                const raw: any[] = response?.datos || response?.data || [];
                return of(raw.map((e: any) => ({
                    id_usuario:         e.id_usuario,
                    id_employee:        e.id_employee   || null,
                    cuenta:             e.cuenta        || '',
                    full_name:          e.full_name     || '',
                    first_name:         e.nombre        || '',
                    paternal_last_name: e.apellido_paterno || '',
                    maternal_last_name: e.apellido_materno || '',
                    license_number:     e.license_number || null,
                    seal_number:        e.seal_number   || null,
                    cargo:              e.cargo         || null,
                    employee_type:      e.employee_type || null,
                    area:               e.area          || null,
                    base_code:          e.base_code     || null,
                    ci:                 e.ci            || null,
                    active:             e.active === true || e.active === 't' || e.active === 'true' || e.active == null,
                    codigo_funcionario: e.codigo_funcionario || null,
                    fecha_ingreso:      e.fecha_ingreso      || null,
                    email_empresa:      e.email_empresa      || null,
                    interno:            e.interno            || null,
                    telefono_ofi:       e.telefono_ofi       || null,
                    role:               e.role               || null,
                    email_personal:     e.email_personal     || null,
                    phone:              e.phone              || null,
                    base_name:          e.base_name          || null
                })));
            })
        );
    }

    getBases(): Observable<any[]> {
        return from(this._api.post('parametros/Lugar/listarLugar', {
            start: 0,
            limit: 50,
            par_filtro: 'lug.codigo#lug.nombre',
            es_regional: 'si',
            query: ''
        })).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    createEmployee(data: Partial<Employee>): Observable<any> {
        return from(this._api.post('herramientas/employees/insertarEmployees', data)).pipe(
            switchMap((response: any) => of(response?.data || {}))
        );
    }

    updateEmployee(id: string, data: Partial<Employee>): Observable<any> {
        return from(this._api.post('herramientas/employees/modificarEmployees', { ...data, id_employee: id })).pipe(
            switchMap((response: any) => of(response?.data || {}))
        );
    }

    deleteEmployee(id: string): Observable<void> {
        return from(this._api.post('herramientas/employees/eliminarEmployees', { id_employee: id })).pipe(
            switchMap(() => of(undefined))
        );
    }
}
