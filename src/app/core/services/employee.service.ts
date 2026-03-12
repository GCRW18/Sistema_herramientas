import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap } from 'rxjs';
import { Employee } from '../models/employee.types';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
    private _api = inject(ErpApiService);

    getEmployees(filters?: { search?: string; area?: string; base?: string; active?: boolean }): Observable<Employee[]> {
        const params: any = { start: 0, limit: 200, sort: 'full_name', dir: 'asc' };

        const extra: string[] = [];
        if (filters?.search) {
            const s = filters.search.replace(/'/g, "''");
            extra.push(`(LOWER(emp.full_name) LIKE LOWER('%${s}%') OR LOWER(emp.license_number) LIKE LOWER('%${s}%'))`);
        }
        if (filters?.area)   extra.push(`emp.area = '${filters.area}'`);
        if (filters?.base)   extra.push(`emp.id_base::text = '${filters.base}'`);
        if (filters?.active !== undefined) extra.push(`emp.active = ${filters.active}`);
        if (extra.length)    params.filtro_adicional = extra.join(' AND ');

        return from(this._api.post('herramientas/employees/listarEmployees', params)).pipe(
            switchMap((response: any) => of(response?.data || []))
        );
    }

    createEmployee(data: Partial<Employee>): Observable<any> {
        return from(this._api.post('herramientas/employees/insertarEmployees', data)).pipe(
            switchMap((response: any) => of(response?.data || {}))
        );
    }

    updateEmployee(id: string, data: Partial<Employee>): Observable<any> {
        return from(this._api.post('herramientas/employees/insertarEmployees', { ...data, id_employee: id })).pipe(
            switchMap((response: any) => of(response?.data || {}))
        );
    }

    deleteEmployee(id: string): Observable<void> {
        return from(this._api.post('herramientas/employees/eliminarEmployees', { id_employee: id })).pipe(
            switchMap(() => of(undefined))
        );
    }
}
