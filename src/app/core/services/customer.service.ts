import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject, tap } from 'rxjs';

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
    private _httpClient = inject(HttpClient);
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
    getCustomers(): Observable<Customer[]> {
        return this._httpClient.get<Customer[]>('api/customers').pipe(
            tap((customers) => {
                this._customers.next(customers);
            })
        );
    }

    /**
     * Get customer by id
     */
    getCustomerById(id: string): Observable<Customer> {
        return this._httpClient.get<Customer>(`api/customers/${id}`).pipe(
            tap((customer) => {
                this._customer.next(customer);
            })
        );
    }

    /**
     * Create customer
     */
    createCustomer(customer: Partial<Customer>): Observable<Customer> {
        return this._httpClient.post<Customer>('api/customers', customer);
    }

    /**
     * Update customer
     */
    updateCustomer(id: string, customer: Partial<Customer>): Observable<Customer> {
        return this._httpClient.put<Customer>(`api/customers/${id}`, customer);
    }

    /**
     * Delete customer
     */
    deleteCustomer(id: string): Observable<void> {
        return this._httpClient.delete<void>(`api/customers/${id}`);
    }
}
