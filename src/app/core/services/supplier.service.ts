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
            sort: 'name',
            dir: 'asc',
            ...filters
        };

        return from(this._api.post('herramientas/suppliers/listarSuppliers', params)).pipe(
            switchMap((response: any) => of(response?.datos || response?.data || []))
        );
    }

    createSupplier(supplier: Partial<any>): Observable<any> {
        return from(this._api.post('herramientas/suppliers/insertarSuppliers', supplier)).pipe(
            switchMap((response: any) => {
                const newSupplier = response?.datos || response?.data || supplier;
                return of(newSupplier);
            })
        );
    }

    updateSupplier(id: string, supplier: Partial<any>): Observable<any> {
        return from(this._api.post('herramientas/suppliers/insertarSuppliers', {
            ...supplier,
            id_supplier: id
        })).pipe(
            switchMap((response: any) => {
                const updatedSupplier = response?.datos || response?.data || supplier;
                return of(updatedSupplier);
            })
        );
    }

}
