import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CategoryService } from 'app/core/services';
import { Category } from 'app/core/models';
import { CategoryDialogComponent } from './category-dialog/category-dialog.component';
import { ErpConfirmationService } from '@erp/services/confirmation';

@Component({
    selector: 'app-categories',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatFormFieldModule,
        MatInputModule,
        MatTooltipModule,
        MatExpansionModule,
        MatDialogModule,
    ],
    templateUrl: './categories.component.html',
    styleUrl: './categories.component.scss'
})
export default class CategoriesComponent implements OnInit {
    private _categoryService = inject(CategoryService);
    private _dialog = inject(MatDialog);
    private _confirmationService = inject(ErpConfirmationService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['code', 'name', 'description', 'toolCount', 'active', 'actions'];
    dataSource = new MatTableDataSource<Category>();
    loading = false;

    ngOnInit(): void {
        this.loadCategories();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadCategories(): void {
        this.loading = true;
        this._categoryService.getCategories().subscribe({
            next: (categories) => {
                this.dataSource.data = categories;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    applyFilter(event: Event): void {
        const filterValue = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }

    createCategory(): void {
        const dialogRef = this._dialog.open(CategoryDialogComponent, {
            width: '600px',
            disableClose: true,
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this._categoryService.createCategory(result).subscribe({
                    next: () => {
                        this.loadCategories();
                    },
                });
            }
        });
    }

    editCategory(id: string): void {
        const category = this.dataSource.data.find(c => c.id === id);
        if (!category) return;

        const dialogRef = this._dialog.open(CategoryDialogComponent, {
            width: '600px',
            disableClose: true,
            data: { category },
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this._categoryService.updateCategory(id, result).subscribe({
                    next: () => {
                        this.loadCategories();
                    },
                });
            }
        });
    }

    deleteCategory(id: string): void {
        const category = this.dataSource.data.find(c => c.id === id);
        if (!category) return;

        const confirmation = this._confirmationService.open({
            title: 'Eliminar Categoría',
            message: `¿Está seguro de eliminar la categoría "${category.name}"? Esta acción no se puede deshacer.`,
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
                this._categoryService.deleteCategory(id).subscribe({
                    next: () => {
                        this.loadCategories();
                    },
                });
            }
        });
    }

    manageSubcategories(category: Category): void {
        // TODO: Implement subcategory management dialog
        console.log('Manage subcategories for:', category.name);
    }

    getActiveCategoryCount(): number {
        return this.dataSource.data.filter(c => c.active).length;
    }
}
