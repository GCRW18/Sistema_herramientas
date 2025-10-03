import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject, tap } from 'rxjs';
import { Category, Subcategory } from '../models';

@Injectable({ providedIn: 'root' })
export class CategoryService {
    private _httpClient = inject(HttpClient);
    private _categories: ReplaySubject<Category[]> = new ReplaySubject<Category[]>(1);
    private _subcategories: ReplaySubject<Subcategory[]> = new ReplaySubject<Subcategory[]>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for categories
     */
    get categories$(): Observable<Category[]> {
        return this._categories.asObservable();
    }

    /**
     * Getter for subcategories
     */
    get subcategories$(): Observable<Subcategory[]> {
        return this._subcategories.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all categories
     */
    getCategories(): Observable<Category[]> {
        return this._httpClient.get<Category[]>('api/categories').pipe(
            tap((categories) => {
                this._categories.next(categories);
            })
        );
    }

    /**
     * Get category by id
     */
    getCategoryById(id: string): Observable<Category> {
        return this._httpClient.get<Category>(`api/categories/${id}`);
    }

    /**
     * Create category
     */
    createCategory(category: Partial<Category>): Observable<Category> {
        return this._httpClient.post<Category>('api/categories', category);
    }

    /**
     * Update category
     */
    updateCategory(id: string, category: Partial<Category>): Observable<Category> {
        return this._httpClient.put<Category>(`api/categories/${id}`, category);
    }

    /**
     * Delete category
     */
    deleteCategory(id: string): Observable<void> {
        return this._httpClient.delete<void>(`api/categories/${id}`);
    }

    /**
     * Get all subcategories
     */
    getSubcategories(categoryId?: string): Observable<Subcategory[]> {
        const url = categoryId
            ? `api/subcategories?categoryId=${categoryId}`
            : 'api/subcategories';

        return this._httpClient.get<Subcategory[]>(url).pipe(
            tap((subcategories) => {
                this._subcategories.next(subcategories);
            })
        );
    }

    /**
     * Get subcategory by id
     */
    getSubcategoryById(id: string): Observable<Subcategory> {
        return this._httpClient.get<Subcategory>(`api/subcategories/${id}`);
    }

    /**
     * Create subcategory
     */
    createSubcategory(subcategory: Partial<Subcategory>): Observable<Subcategory> {
        return this._httpClient.post<Subcategory>('api/subcategories', subcategory);
    }

    /**
     * Update subcategory
     */
    updateSubcategory(id: string, subcategory: Partial<Subcategory>): Observable<Subcategory> {
        return this._httpClient.put<Subcategory>(`api/subcategories/${id}`, subcategory);
    }

    /**
     * Delete subcategory
     */
    deleteSubcategory(id: string): Observable<void> {
        return this._httpClient.delete<void>(`api/subcategories/${id}`);
    }
}
