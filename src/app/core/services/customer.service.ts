import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap } from 'rxjs';
import { ErpApiService } from '../api/api.service';

export interface Customer {
    id_customer: number;
    code: string;
    name: string;
    customer_type?: string;
    company_name?: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    city?: string;
    country?: string;
    address?: string;
    tax_id?: string;
    fiscal_registry?: string;
    phone_contact?: string;
    email_contact?: string;
    notes?: string;
    active: boolean;
    estado_reg: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
    private _api = inject(ErpApiService);
    private _customers: ReplaySubject<Customer[]> = new ReplaySubject<Customer[]>(1);
    private _customer: ReplaySubject<Customer> = new ReplaySubject<Customer>(1);

    get customers$(): Observable<Customer[]> {
        return this._customers.asObservable();
    }

    get customer$(): Observable<Customer> {
        return this._customer.asObservable();
    }

    getCustomers(filters?: any): Observable<Customer[]> {
        const params: any = { start: 0, limit: 500, sort: 'name', dir: 'asc', ...filters };
        return from(this._api.post('herramientas/customers/listarCustomers', params)).pipe(
            switchMap((response: any) => {
                const customers = response?.datos || response?.data || [];
                this._customers.next(customers);
                return of(customers);
            })
        );
    }

    getCustomerById(id: string): Observable<Customer> {
        return from(this._api.post('herramientas/customers/listarCustomers', {
            start: 0, limit: 1, id_customer: id
        })).pipe(
            switchMap((response: any) => {
                const customer = (response?.datos || response?.data || [])[0] || null;
                if (customer) this._customer.next(customer);
                return of(customer);
            })
        );
    }

    createCustomer(customer: Partial<any>): Observable<any> {
        return from(this._api.post('herramientas/customers/insertarCustomers', customer)).pipe(
            switchMap((response: any) => of(response?.datos?.[0] || response?.data?.[0] || customer))
        );
    }

    updateCustomer(id: string, customer: Partial<any>): Observable<any> {
        return from(this._api.post('herramientas/customers/insertarCustomers', {
            ...customer,
            id_customer: id
        })).pipe(
            switchMap((response: any) => of(response?.datos?.[0] || response?.data?.[0] || customer))
        );
    }

    deleteCustomer(id: string): Observable<void> {
        return from(this._api.post('herramientas/customers/eliminarCustomers', {
            id_customer: id
        })).pipe(
            switchMap(() => of(undefined))
        );
    }
}
