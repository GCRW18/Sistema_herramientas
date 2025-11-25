import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap } from 'rxjs';
import { ErpApiService } from '../api/api.service';

export interface Customer {
    id: string;
    name: string;
    contactName: string;
    email: string;
    phone: string;
    address?: string;
    taxId?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
    private _api = inject(ErpApiService);
    private _customers: ReplaySubject<Customer[]> = new ReplaySubject<Customer[]>(1);
    private _customer: ReplaySubject<Customer> = new ReplaySubject<Customer>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for customers
     */
    get customers$(): Observable<Customer[]> {
        return this._customers.asObservable();
    }

    /**
     * Getter for customer
     */
    get customer$(): Observable<Customer> {
        return this._customer.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all customers
     */
    getCustomers(filters?: any): Observable<Customer[]> {
        const params: any = {
            start: 0,
            limit: 50,
            sort: 'name',
            dir: 'asc',
            ...filters
        };

        // Using PXP's organization module - Cliente entity
        return from(this._api.post('organigrama/Cliente/listCliente', params)).pipe(
            switchMap((response: any) => {
                const customers = response?.datos || [];
                this._customers.next(customers);
                return of(customers);
            })
        );
    }

    /**
     * Get customer by id
     */
    getCustomerById(id: string): Observable<Customer> {
        return from(this._api.post('organigrama/Cliente/listCliente', {
            start: 0,
            limit: 1,
            id_cliente: id
        })).pipe(
            switchMap((response: any) => {
                const customer = response?.datos?.[0] || null;
                if (customer) {
                    this._customer.next(customer);
                }
                return of(customer);
            })
        );
    }

    /**
     * Create customer
     */
    createCustomer(customer: Partial<Customer>): Observable<Customer> {
        return from(this._api.post('organigrama/Cliente/insertCliente', customer)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || customer);
            })
        );
    }

    /**
     * Update customer
     */
    updateCustomer(id: string, customer: Partial<Customer>): Observable<Customer> {
        return from(this._api.post('organigrama/Cliente/updateCliente', {
            ...customer,
            id_cliente: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || customer);
            })
        );
    }

    /**
     * Delete customer
     */
    deleteCustomer(id: string): Observable<void> {
        return from(this._api.post('organigrama/Cliente/deleteCliente', {
            id_cliente: id
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }
}
