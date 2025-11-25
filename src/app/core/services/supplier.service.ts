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

        // Using PXP's organization module - Proveedor entity
        return from(this._api.post('organigrama/Proveedor/listProveedor', params)).pipe(
            switchMap((response: any) => {
                const suppliers = response?.datos || [];
                this._suppliers.next(suppliers);
                return of(suppliers);
            })
        );
    }

    getSupplierById(id: string): Observable<Supplier> {
        return from(this._api.post('organigrama/Proveedor/listProveedor', {
            start: 0,
            limit: 1,
            id_proveedor: id
        })).pipe(
            switchMap((response: any) => {
                const supplier = response?.datos?.[0] || null;
                if (supplier) {
                    this._supplier.next(supplier);
                }
                return of(supplier);
            })
        );
    }

    createSupplier(supplier: Partial<Supplier>): Observable<Supplier> {
        return from(this._api.post('organigrama/Proveedor/insertProveedor', supplier)).pipe(
            switchMap((response: any) => {
                const newSupplier = response?.datos || supplier;
                this._supplier.next(newSupplier as Supplier);
                return of(newSupplier);
            })
        );
    }

    updateSupplier(id: string, supplier: Partial<Supplier>): Observable<Supplier> {
        return from(this._api.post('organigrama/Proveedor/updateProveedor', {
            ...supplier,
            id_proveedor: id
        })).pipe(
            switchMap((response: any) => {
                const updatedSupplier = response?.datos || supplier;
                this._supplier.next(updatedSupplier as Supplier);
                return of(updatedSupplier);
            })
        );
    }

    deleteSupplier(id: string): Observable<void> {
        return from(this._api.post('organigrama/Proveedor/deleteProveedor', {
            id_proveedor: id
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }
}
