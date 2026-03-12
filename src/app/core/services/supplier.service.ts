import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap } from 'rxjs';
import { Supplier } from '../models/user.types';
import { ErpApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class SupplierService {
    private _api = inject(ErpApiService);
    private _suppliers: ReplaySubject<Supplier[]> = new ReplaySubject<Supplier[]>(1);
    private _supplier: ReplaySubject<Supplier> = new ReplaySubject<Supplier>(1);

    get suppliers$(): Observable<Supplier[]> {
        return this._suppliers.asObservable();
    }

    get supplier$(): Observable<Supplier> {
        return this._supplier.asObservable();
    }

    getSuppliers(filters?: any): Observable<Supplier[]> {
        const params: any = {
            start: 0,
            limit: 50,
            sort: 'nombre',
            dir: 'asc',
            ...filters
        };

        return from(this._api.post('herramientas/suppliers/listarSuppliers', params)).pipe(
            switchMap((response: any) => {
                const suppliers = response?.data || [];
                this._suppliers.next(suppliers);
                return of(suppliers);
            })
        );
    }

    getSupplierById(id: string): Observable<Supplier> {
        return from(this._api.post('herramientas/suppliers/listarSuppliers', {
            start: 0,
            limit: 1,
            id_supplier: id
        })).pipe(
            switchMap((response: any) => {
                const supplier = response?.data?.[0] || null;
                if (supplier) {
                    this._supplier.next(supplier);
                }
                return of(supplier);
            })
        );
    }

    createSupplier(supplier: Partial<Supplier>): Observable<Supplier> {
        return from(this._api.post('herramientas/suppliers/insertarSuppliers', supplier)).pipe(
            switchMap((response: any) => {
                const newSupplier = response?.data || supplier;
                this._supplier.next(newSupplier as Supplier);
                return of(newSupplier);
            })
        );
    }

    updateSupplier(id: string, supplier: Partial<Supplier>): Observable<Supplier> {
        return from(this._api.post('herramientas/suppliers/insertarSuppliers', {
            ...supplier,
            id_proveedor: id
        })).pipe(
            switchMap((response: any) => {
                const updatedSupplier = response?.data || supplier;
                this._supplier.next(updatedSupplier as Supplier);
                return of(updatedSupplier);
            })
        );
    }

    deleteSupplier(id: string): Observable<void> {
        return from(this._api.post('herramientas/suppliers/eliminarSuppliers', {
            id_supplier: id
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }
}
