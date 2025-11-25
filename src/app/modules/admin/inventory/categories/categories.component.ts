import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatTreeFlatDataSource, MatTreeFlattener, MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { RouterModule } from '@angular/router';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { CategoryDialogComponent } from './category-dialog/category-dialog.component';
import { ErpConfirmationService } from '@erp/services/confirmation';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CategoryService, CategoryNode, CategoryFlatNode } from 'app/core/services/category.service';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
    selector: 'app-categories',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatTreeModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatTableModule,
        MatTooltipModule,
        MatChipsModule,
        ReactiveFormsModule,
        DragDropModule,
        MatSnackBarModule,
        MatMenuModule,
        MatProgressBarModule
    ],
    templateUrl: './categories.component.html',
    styleUrl: './categories.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export default class CategoriesComponent implements OnInit {
    private _changeDetectorRef = inject(ChangeDetectorRef);
    private _dialog = inject(MatDialog);
    private _confirmationService = inject(ErpConfirmationService);
    private _snackBar = inject(MatSnackBar);
    private _categoryService = inject(CategoryService);

    treeControl: FlatTreeControl<CategoryFlatNode>;
    treeFlattener: MatTreeFlattener<CategoryNode, CategoryFlatNode>;
    dataSource: MatTreeFlatDataSource<CategoryNode, CategoryFlatNode>;

    searchInputControl: FormControl = new FormControl();
    selectedNode: CategoryFlatNode | null = null;
    isLoading: boolean = false;

    displayedColumns: string[] = ['icono', 'nombre', 'codigo', 'descripcion', 'cantidad_herramientas', 'actions'];

    public cols = [
        { field: 'nombre', header: 'Nombre Categoría', width: 'min-w-1/2'},
        { field: 'codigo', header: 'Código', width: 'min-w-32'},
        { field: 'descripcion', header: 'Descripción', width: 'min-w-64'},
        { field: 'cantidad_herramientas', header: 'Herramientas', width: 'min-w-32'}
    ];

    constructor() {
        this.treeControl = new FlatTreeControl<CategoryFlatNode>(
            node => node.level,
            node => node.expandable
        );

        this.treeFlattener = new MatTreeFlattener(
            this.transformer,
            node => node.level,
            node => node.expandable,
            node => node.children
        );

        this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
    }

    ngOnInit(): void {
        this.loadCategoriesData();

        // Search functionality with debounce
        this.searchInputControl.valueChanges
            .pipe(debounceTime(500))
            .subscribe(query => {
                if (!query || query.trim() === '') {
                    this.loadCategoriesData();
                } else {
                    this.searchCategories(query);
                }
            });
    }

    private transformer = (node: CategoryNode, level: number): CategoryFlatNode => {
        return {
            expandable: !!node.children && node.children.length > 0 || !!node.tiene_hijos,
            item: node,
            level: level,
            hasChildren: node.tiene_hijos || false
        };
    }

    loadCategoriesData(): void {
        this.isLoading = true;
        this._changeDetectorRef.markForCheck();

        // Cargar categorías raíz desde el backend
        this._categoryService.getCategoryTree('0').subscribe({
            next: (data) => {
                this.dataSource.data = data;
                this.treeControl.expandAll();
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
            },
            error: (error) => {
                console.error('Error loading categories:', error);
                this._snackBar.open('Error al cargar categorías', 'Cerrar', {
                    duration: 3000,
                    horizontalPosition: 'end',
                    verticalPosition: 'top'
                });
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
            }
        });
    }

    searchCategories(query: string): void {
        this.isLoading = true;
        this._changeDetectorRef.markForCheck();

        this._categoryService.searchCategoryTree(query).subscribe({
            next: (data) => {
                this.dataSource.data = data;
                this.treeControl.expandAll();
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
            },
            error: (error) => {
                console.error('Error searching categories:', error);
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
            }
        });
    }

    loadChildren(node: CategoryFlatNode): void {
        if (this.treeControl.isExpanded(node)) {
            this.treeControl.collapse(node);
        } else {
            // Lazy loading: cargar hijos desde el servidor si aún no están cargados
            if (node.hasChildren && (!node.item.children || node.item.children.length === 0)) {
                this._categoryService.loadCategoryChildren(node.item).subscribe({
                    next: (children) => {
                        node.item.children = children;
                        this.dataSource.data = [...this.dataSource.data]; // Refresh
                        this.treeControl.expand(node);
                        this._changeDetectorRef.markForCheck();
                    },
                    error: (error) => {
                        console.error('Error loading children:', error);
                        this._snackBar.open('Error al cargar subcategorías', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'end',
                            verticalPosition: 'top'
                        });
                    }
                });
            } else {
                this.treeControl.expand(node);
            }
        }
    }

    createCategory(): void {
        const dialogRef = this._dialog.open(CategoryDialogComponent, {
            width: '600px',
            disableClose: true,
            data: { category: null, parentId: null }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this._categoryService.createCategory({
                    name: result.name,
                    code: result.code,
                    description: result.description,
                    parent_category_id: null,
                    active: result.active
                }).subscribe({
                    next: () => {
                        this._snackBar.open('Categoría creada exitosamente', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'end',
                            verticalPosition: 'top'
                        });
                        this.loadCategoriesData();
                    },
                    error: (error) => {
                        console.error('Error creating category:', error);
                        this._snackBar.open('Error al crear categoría', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'end',
                            verticalPosition: 'top'
                        });
                    }
                });
            }
        });
    }

    createSubcategory(node: CategoryFlatNode): void {
        const dialogRef = this._dialog.open(CategoryDialogComponent, {
            width: '600px',
            disableClose: true,
            data: {
                category: null,
                parentId: node.item.id_category,
                parentName: node.item.name
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this._categoryService.createCategory({
                    name: result.name,
                    code: result.code,
                    description: result.description,
                    parent_category_id: node.item.id_category,
                    active: result.active
                }).subscribe({
                    next: () => {
                        this._snackBar.open('Subcategoría creada exitosamente', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'end',
                            verticalPosition: 'top'
                        });
                        // Recargar hijos del nodo padre
                        node.item.children = [];
                        this._categoryService.loadCategoryChildren(node.item).subscribe(children => {
                            node.item.children = children;
                            this.dataSource.data = [...this.dataSource.data];
                            this.treeControl.expand(node);
                            this._changeDetectorRef.markForCheck();
                        });
                    },
                    error: (error) => {
                        console.error('Error creating subcategory:', error);
                        this._snackBar.open('Error al crear subcategoría', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'end',
                            verticalPosition: 'top'
                        });
                    }
                });
            }
        });
    }

    editCategory(node: CategoryFlatNode): void {
        const dialogRef = this._dialog.open(CategoryDialogComponent, {
            width: '600px',
            disableClose: true,
            data: {
                category: {
                    id: node.item.id_category,
                    code: node.item.code,
                    name: node.item.name,
                    description: node.item.description,
                    active: node.item.estado_reg === 'activo'
                }
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this._categoryService.updateCategory(node.item.id_category.toString(), {
                    name: result.name,
                    code: result.code,
                    description: result.description,
                    active: result.active
                }).subscribe({
                    next: () => {
                        this._snackBar.open('Categoría actualizada exitosamente', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'end',
                            verticalPosition: 'top'
                        });
                        this.loadCategoriesData();
                    },
                    error: (error) => {
                        console.error('Error updating category:', error);
                        this._snackBar.open('Error al actualizar categoría', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'end',
                            verticalPosition: 'top'
                        });
                    }
                });
            }
        });
    }

    deleteCategory(node: CategoryFlatNode): void {
        // Construir mensaje de advertencia
        let warningMessage = `¿Está seguro de eliminar "${node.item.name}"?`;

        if (node.item.cantidad_herramientas && node.item.cantidad_herramientas > 0) {
            warningMessage += `\n\nATENCIÓN: Esta categoría tiene ${node.item.cantidad_herramientas} herramienta(s) asociada(s) y no se podrá eliminar hasta que reasigne o elimine estas herramientas.`;
        }

        if (node.item.children?.length) {
            warningMessage += `\n\nEsta categoría tiene subcategorías y no se podrá eliminar hasta que elimine las subcategorías primero.`;
        }

        const confirmation = this._confirmationService.open({
            title: 'Eliminar Categoría',
            message: warningMessage,
            icon: {
                show: true,
                name: 'heroicons_outline:exclamation-triangle',
                color: 'warn',
            },
            actions: {
                confirm: {
                    show: true,
                    label: 'Eliminar',
                    color: 'warn',
                },
                cancel: {
                    show: true,
                    label: 'Cancelar',
                },
            },
        });

        confirmation.afterClosed().subscribe((result) => {
            if (result === 'confirmed') {
                this._categoryService.deleteCategory(node.item.id_category.toString()).subscribe({
                    next: () => {
                        this._snackBar.open('Categoría eliminada exitosamente', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'end',
                            verticalPosition: 'top'
                        });
                        this.selectedNode = null;
                        this.loadCategoriesData();
                    },
                    error: (error) => {
                        console.error('Error deleting category:', error);

                        // Extraer mensaje de error específico del backend
                        let errorMessage = 'Error al eliminar categoría';

                        if (error?.error?.ROOT?.detalle?.mensaje) {
                            const backendMessage = error.error.ROOT.detalle.mensaje;

                            // Si el backend ya tiene un mensaje descriptivo, usarlo directamente
                            if (backendMessage.includes('No se puede eliminar')) {
                                errorMessage = backendMessage;
                            }
                            // Detectar error de clave foránea con herramientas (category_id o subcategory_id)
                            else if (backendMessage.includes('tools_category_id_fkey') ||
                                     backendMessage.includes('tools_subcategory_id_fkey')) {
                                errorMessage = 'No se puede eliminar: la categoría tiene herramientas asociadas. Reasigne o elimine las herramientas primero.';
                            }
                            // Detectar otros errores de foreign key
                            else if (backendMessage.includes('violates foreign key constraint')) {
                                errorMessage = 'No se puede eliminar: la categoría tiene dependencias asociadas. Elimine las dependencias primero.';
                            }
                        }

                        this._snackBar.open(errorMessage, 'Cerrar', {
                            duration: 5000,
                            horizontalPosition: 'end',
                            verticalPosition: 'top',
                            panelClass: ['error-snackbar']
                        });
                    }
                });
            }
        });
    }

    hasChild = (_: number, node: CategoryFlatNode) => node.expandable;

    collapseAll(): void {
        this.treeControl.collapseAll();
    }

    expandAll(): void {
        this.treeControl.expandAll();
    }
}
