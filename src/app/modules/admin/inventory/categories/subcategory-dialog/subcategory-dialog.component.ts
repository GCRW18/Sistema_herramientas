import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { CategoryService, NotificationService } from 'app/core/services';
import { Category, Subcategory } from 'app/core/models';
import { ErpConfirmationService } from '@erp/services/confirmation';

@Component({
    selector: 'app-subcategory-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSlideToggleModule,
        MatIconModule,
        MatTooltipModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
    ],
    templateUrl: './subcategory-dialog.component.html',
    styleUrl: './subcategory-dialog.component.scss'
})
export class SubcategoryDialogComponent implements OnInit {
    form: FormGroup;
    parentCategory: Category;
    subcategories: Subcategory[] = [];
    dataSource = new MatTableDataSource<Subcategory>();
    displayedColumns: string[] = ['code', 'name', 'description', 'active', 'actions'];
    loading = false;
    isEditMode = false;
    currentSubcategoryId: string | null = null;

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<SubcategoryDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { category: Category },
        private _categoryService: CategoryService,
        private _notificationService: NotificationService,
        private _confirmationService: ErpConfirmationService,
    ) {
        this.parentCategory = data.category;
        this.initForm();
    }

    ngOnInit(): void {
        this.loadSubcategories();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    initForm(): void {
        this.form = this._fb.group({
            id: [null],
            code: ['', [Validators.required, Validators.maxLength(50)]],
            name: ['', [Validators.required, Validators.maxLength(200)]],
            description: ['', Validators.maxLength(500)],
            active: [true],
        });
    }

    loadSubcategories(): void {
        this.loading = true;
        this._categoryService.getSubcategories(this.parentCategory.id).subscribe({
            next: (subcategories) => {
                this.subcategories = subcategories;
                this.dataSource.data = subcategories;
                this.loading = false;
            },
            error: (error) => {
                this._notificationService.error('Error al cargar las subcategorías');
                console.error('Error loading subcategories:', error);
                this.loading = false;
            },
        });
    }

    createSubcategory(): void {
        this.isEditMode = false;
        this.currentSubcategoryId = null;
        this.form.reset({ active: true });
    }

    editSubcategory(subcategory: Subcategory): void {
        this.isEditMode = true;
        this.currentSubcategoryId = subcategory.id;
        this.form.patchValue(subcategory);
    }

    saveSubcategory(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this._notificationService.warning('Por favor complete todos los campos requeridos');
            return;
        }

        this.loading = true;
        const subcategoryData = { ...this.form.value, parentId: this.parentCategory.id };

        const operation = this.isEditMode && this.currentSubcategoryId
            ? this._categoryService.updateSubcategory(this.currentSubcategoryId, subcategoryData)
            : this._categoryService.createSubcategory(subcategoryData);

        operation.subscribe({
            next: () => {
                this._notificationService.success(`Subcategoría ${subcategoryData.name} guardada correctamente`);
                this.form.reset({ active: true });
                this.isEditMode = false;
                this.currentSubcategoryId = null;
                this.loadSubcategories();
            },
            error: (error) => {
                this._notificationService.error('Error al guardar la subcategoría');
                console.error('Error saving subcategory:', error);
                this.loading = false;
            },
        });
    }

    deleteSubcategory(subcategory: Subcategory): void {
        const confirmation = this._confirmationService.open({
            title: 'Eliminar Subcategoría',
            message: `¿Está seguro de eliminar la subcategoría <strong>${subcategory.name}</strong>? Esta acción no se puede deshacer.`,
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
                this._categoryService.deleteSubcategory(subcategory.id).subscribe({
                    next: () => {
                        this._notificationService.success(`Subcategoría ${subcategory.name} eliminada correctamente`);
                        this.loadSubcategories();
                    },
                    error: (error) => {
                        this._notificationService.error('Error al eliminar la subcategoría');
                        console.error('Error deleting subcategory:', error);
                    },
                });
            }
        });
    }

    cancelEdit(): void {
        this.form.reset({ active: true });
        this.isEditMode = false;
        this.currentSubcategoryId = null;
    }

    closeDialog(): void {
        this._dialogRef.close(true);
    }
}
