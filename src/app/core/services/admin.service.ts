import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject, tap } from 'rxjs';
import { Customer, Supplier, User } from '../models';

@Injectable({ providedIn: 'root' })
export class AdminService {
    private _httpClient = inject(HttpClient);
    private _users: ReplaySubject<User[]> = new ReplaySubject<User[]>(1);
    private _suppliers: ReplaySubject<Supplier[]> = new ReplaySubject<Supplier[]>(1);
    private _customers: ReplaySubject<Customer[]> = new ReplaySubject<Customer[]>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for users
     */
    get users$(): Observable<User[]> {
        return this._users.asObservable();
    }

    /**
     * Getter for suppliers
     */
    get suppliers$(): Observable<Supplier[]> {
        return this._suppliers.asObservable();
    }

    /**
     * Getter for customers
     */
    get customers$(): Observable<Customer[]> {
        return this._customers.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Users
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all users
     */
    getUsers(): Observable<User[]> {
        return this._httpClient.get<User[]>('api/admin/users').pipe(
            tap((users) => {
                this._users.next(users);
            })
        );
    }

    /**
     * Get user by id
     */
    getUserById(id: string): Observable<User> {
        return this._httpClient.get<User>(`api/admin/users/${id}`);
    }

    /**
     * Create user
     */
    createUser(user: Partial<User>): Observable<User> {
        return this._httpClient.post<User>('api/admin/users', user);
    }

    /**
     * Update user
     */
    updateUser(id: string, user: Partial<User>): Observable<User> {
        return this._httpClient.put<User>(`api/admin/users/${id}`, user);
    }

    /**
     * Delete user
     */
    deleteUser(id: string): Observable<void> {
        return this._httpClient.delete<void>(`api/admin/users/${id}`);
    }

    /**
     * Update user permissions
     */
    updateUserPermissions(id: string, permissions: string[]): Observable<User> {
        return this._httpClient.put<User>(`api/admin/users/${id}/permissions`, { permissions });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Suppliers
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all suppliers
     */
    getSuppliers(): Observable<Supplier[]> {
        return this._httpClient.get<Supplier[]>('api/admin/suppliers').pipe(
            tap((suppliers) => {
                this._suppliers.next(suppliers);
            })
        );
    }

    /**
     * Get supplier by id
     */
    getSupplierById(id: string): Observable<Supplier> {
        return this._httpClient.get<Supplier>(`api/admin/suppliers/${id}`);
    }

    /**
     * Create supplier
     */
    createSupplier(supplier: Partial<Supplier>): Observable<Supplier> {
        return this._httpClient.post<Supplier>('api/admin/suppliers', supplier);
    }

    /**
     * Update supplier
     */
    updateSupplier(id: string, supplier: Partial<Supplier>): Observable<Supplier> {
        return this._httpClient.put<Supplier>(`api/admin/suppliers/${id}`, supplier);
    }

    /**
     * Delete supplier
     */
    deleteSupplier(id: string): Observable<void> {
        return this._httpClient.delete<void>(`api/admin/suppliers/${id}`);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Customers
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all customers
     */
    getCustomers(): Observable<Customer[]> {
        return this._httpClient.get<Customer[]>('api/admin/customers').pipe(
            tap((customers) => {
                this._customers.next(customers);
            })
        );
    }

    /**
     * Get customer by id
     */
    getCustomerById(id: string): Observable<Customer> {
        return this._httpClient.get<Customer>(`api/admin/customers/${id}`);
    }

    /**
     * Create customer
     */
    createCustomer(customer: Partial<Customer>): Observable<Customer> {
        return this._httpClient.post<Customer>('api/admin/customers', customer);
    }

    /**
     * Update customer
     */
    updateCustomer(id: string, customer: Partial<Customer>): Observable<Customer> {
        return this._httpClient.put<Customer>(`api/admin/customers/${id}`, customer);
    }

    /**
     * Delete customer
     */
    deleteCustomer(id: string): Observable<void> {
        return this._httpClient.delete<void>(`api/admin/customers/${id}`);
    }
}
