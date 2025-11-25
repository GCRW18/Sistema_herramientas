import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap } from 'rxjs';
import { Category, Subcategory } from '../models';
import { ErpApiService } from '../api/api.service';

// Interfaces para estructura jerárquica (tipo árbol)
export interface CategoryNode {
    id_category: number;
    name: string;
    code?: string;
    description?: string;
    parent_category_id?: number;
    nivel?: number;
    tiene_hijos?: boolean;
    cantidad_herramientas?: number;
    estado_reg?: string;
    children?: CategoryNode[];
}

export interface CategoryFlatNode {
    expandable: boolean;
    item: CategoryNode;
    level: number;
    hasChildren: boolean;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
    private _api = inject(ErpApiService);
    private _categories: ReplaySubject<Category[]> = new ReplaySubject<Category[]>(1);
    private _subcategories: ReplaySubject<Subcategory[]> = new ReplaySubject<Subcategory[]>(1);
    private _categoryTree: ReplaySubject<CategoryNode[]> = new ReplaySubject<CategoryNode[]>(1);

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

    /**
     * Getter for category tree (hierarchical structure)
     */
    get categoryTree$(): Observable<CategoryNode[]> {
        return this._categoryTree.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Standard CRUD
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all categories (flat list)
     */
    getCategories(): Observable<Category[]> {
        return from(this._api.post('herramientas/categories/listCategories', {
            start: 0,
            limit: 500,
            sort: 'name',
            dir: 'asc'
        })).pipe(
            switchMap((response: any) => {
                const categories = response?.datos || [];
                this._categories.next(categories);
                return of(categories);
            })
        );
    }

    /**
     * Get category by id
     */
    getCategoryById(id: string): Observable<Category> {
        return from(this._api.post('herramientas/categories/listCategories', {
            start: 0,
            limit: 1,
            id_category: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || null);
            })
        );
    }

    /**
     * Create category
     */
    createCategory(category: any): Observable<any> {
        return from(this._api.post('herramientas/categories/insertCategory', category)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || category);
            })
        );
    }

    /**
     * Update category
     */
    updateCategory(id: string, category: any): Observable<any> {
        return from(this._api.post('herramientas/categories/insertCategory', {
            ...category,
            id_category: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || category);
            })
        );
    }

    /**
     * Delete category
     */
    deleteCategory(id: string): Observable<void> {
        return from(this._api.post('herramientas/categories/deleteCategory', {
            id_category: id
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Hierarchical Tree
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get category tree (hierarchical structure)
     * @param parentId - ID de categoría padre (null o '0' para raíz)
     */
    getCategoryTree(parentId: string = '0'): Observable<CategoryNode[]> {
        return from(this._api.post('herramientas/categories/listCategories', {
            start: 0,
            limit: 500,
            parent_category_id: parentId === '0' ? null : parentId,
            sort: 'name',
            dir: 'asc'
        })).pipe(
            switchMap((response: any) => {
                const categories = response?.datos || [];

                // Transform to tree nodes
                const treeNodes: CategoryNode[] = categories.map((cat: any) => ({
                    id_category: cat.id_category,
                    name: cat.name,
                    code: cat.code,
                    description: cat.description,
                    parent_category_id: cat.parent_category_id,
                    nivel: cat.nivel || 0,
                    tiene_hijos: cat.tiene_hijos || false,
                    cantidad_herramientas: cat.cantidad_herramientas || 0,
                    estado_reg: cat.estado_reg,
                    children: []
                }));

                this._categoryTree.next(treeNodes);
                return of(treeNodes);
            })
        );
    }

    /**
     * Load children for a specific category node (lazy loading)
     */
    loadCategoryChildren(parentNode: CategoryNode): Observable<CategoryNode[]> {
        return from(this._api.post('herramientas/categories/listCategories', {
            start: 0,
            limit: 500,
            parent_category_id: parentNode.id_category,
            sort: 'name',
            dir: 'asc'
        })).pipe(
            switchMap((response: any) => {
                const children = response?.datos || [];

                const childrenNodes: CategoryNode[] = children.map((cat: any) => ({
                    id_category: cat.id_category,
                    name: cat.name,
                    code: cat.code,
                    description: cat.description,
                    parent_category_id: cat.parent_category_id,
                    nivel: (parentNode.nivel || 0) + 1,
                    tiene_hijos: cat.tiene_hijos || false,
                    cantidad_herramientas: cat.cantidad_herramientas || 0,
                    estado_reg: cat.estado_reg,
                    children: []
                }));

                return of(childrenNodes);
            })
        );
    }

    /**
     * Search categories by text (full tree search)
     */
    searchCategoryTree(query: string): Observable<CategoryNode[]> {
        if (!query || query.trim() === '') {
            return this.getCategoryTree('0');
        }

        return from(this._api.post('herramientas/categories/listCategories', {
            start: 0,
            limit: 500,
            name: query, // Búsqueda por nombre
            sort: 'name',
            dir: 'asc'
        })).pipe(
            switchMap((response: any) => {
                const categories = response?.datos || [];

                const treeNodes: CategoryNode[] = categories.map((cat: any) => ({
                    id_category: cat.id_category,
                    name: cat.name,
                    code: cat.code,
                    description: cat.description,
                    parent_category_id: cat.parent_category_id,
                    nivel: cat.nivel || 0,
                    tiene_hijos: cat.tiene_hijos || false,
                    cantidad_herramientas: cat.cantidad_herramientas || 0,
                    estado_reg: cat.estado_reg,
                    children: []
                }));

                return of(treeNodes);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Subcategories (if needed separately)
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all subcategories
     */
    getSubcategories(categoryId?: string): Observable<Subcategory[]> {
        const params: any = {
            start: 0,
            limit: 500,
            sort: 'name',
            dir: 'asc'
        };

        if (categoryId) {
            params.parent_category_id = categoryId;
        }

        return from(this._api.post('herramientas/categories/listCategories', params)).pipe(
            switchMap((response: any) => {
                const subcategories = response?.datos || [];
                this._subcategories.next(subcategories);
                return of(subcategories);
            })
        );
    }

    /**
     * Get subcategory by id
     */
    getSubcategoryById(id: string): Observable<Subcategory> {
        return this.getCategoryById(id) as Observable<Subcategory>;
    }

    /**
     * Create subcategory
     */
    createSubcategory(subcategory: Partial<Subcategory>): Observable<Subcategory> {
        return this.createCategory(subcategory) as Observable<Subcategory>;
    }

    /**
     * Update subcategory
     */
    updateSubcategory(id: string, subcategory: Partial<Subcategory>): Observable<Subcategory> {
        return this.updateCategory(id, subcategory) as Observable<Subcategory>;
    }

    /**
     * Delete subcategory
     */
    deleteSubcategory(id: string): Observable<void> {
        return this.deleteCategory(id);
    }

    /**
     * Get category statistics
     */
    getCategoryStatistics(): Observable<any> {
        return from(this._api.post('herramientas/categories/listCategories', {
            start: 0,
            limit: 1000
        })).pipe(
            switchMap((response: any) => {
                const categories = response?.datos || [];

                const stats = {
                    total: categories.length,
                    activas: categories.filter((c: any) => c.estado_reg === 'activo').length,
                    con_herramientas: categories.filter((c: any) => (c.cantidad_herramientas || 0) > 0).length,
                    raices: categories.filter((c: any) => !c.parent_category_id).length,
                    subcategorias: categories.filter((c: any) => c.parent_category_id).length
                };

                return of(stats);
            })
        );
    }
}
