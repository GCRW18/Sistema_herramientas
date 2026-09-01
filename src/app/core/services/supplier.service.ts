import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap } from 'rxjs';
import { Supplier } from '../models/user.types';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class SupplierService {
    private _api = inject(ErpApiService);

    getSuppliers(filters?: any): Observable<Supplier[]> {
        const params: any = {
            start: 0,
            limit: 50,
            ordenacion: 'name',
            dir_ordenacion: 'asc',
            ...filters
        };

        return from(this._api.post('herramientas/suppliers/listarSuppliers', params)).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    createSupplier(supplier: Partial<any>): Observable<any> {
        return from(this._api.post('herramientas/suppliers/insertarSuppliers', supplier)).pipe(
            switchMap((response: any) => {
                const root = response?.ROOT || response;
                if (root?.error === true || root?.error === 'true') {
                    throw new Error(root?.detalle?.mensaje || root?.mensaje || 'Error al registrar proveedor');
                }
                return of(root?.datos || root?.data || supplier);
            })
        );
    }

    updateSupplier(id: string, supplier: Partial<any>): Observable<any> {
        return from(this._api.post('herramientas/suppliers/insertarSuppliers', {
            ...supplier,
            id_supplier: id
        })).pipe(
            switchMap((response: any) => {
                const root = response?.ROOT || response;
                if (root?.error === true || root?.error === 'true') {
                    throw new Error(root?.detalle?.mensaje || root?.mensaje || 'Error al actualizar proveedor');
                }
                return of(root?.datos || root?.data || supplier);
            })
        );
    }

}
