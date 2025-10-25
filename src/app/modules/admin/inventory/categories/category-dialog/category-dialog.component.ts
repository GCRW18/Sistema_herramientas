import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';

interface CategoryDialogData {
    category?: {
        id?: number;
        code?: string;
        name: string;
        description?: string;
        active?: boolean;
    };
    parentId?: number;
    parentName?: string;
}

@Component({
    selector: 'app-category-dialog',
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
    ],
    templateUrl: './category-dialog.component.html',
    styleUrl: './category-dialog.component.scss'
})
export class CategoryDialogComponent implements OnInit {
    form: FormGroup;
    isEditMode = false;
    isSubcategory = false;
    parentName = '';

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<CategoryDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: CategoryDialogData
    ) {
        this.isEditMode = !!data?.category;
        this.isSubcategory = !!data?.parentId;
        this.parentName = data?.parentName || '';

        this.form = this._fb.group({
            code: ['', [Validators.required, Validators.maxLength(50)]],
            name: ['', [Validators.required, Validators.maxLength(200)]],
            description: ['', Validators.maxLength(500)],
            active: [true],
        });
    }

    ngOnInit(): void {
        if (this.isEditMode && this.data.category) {
            this.form.patchValue({
                code: this.data.category.code || '',
                name: this.data.category.name || '',
                description: this.data.category.description || '',
                active: this.data.category.active !== false
            });
        }
    }

    getTitle(): string {
        if (this.isEditMode) {
            return this.isSubcategory ? 'Editar Subcategoría' : 'Editar Categoría';
        }
        return this.isSubcategory ? 'Nueva Subcategoría' : 'Nueva Categoría';
    }

    save(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this._dialogRef.close(this.form.value);
    }

    cancel(): void {
        this._dialogRef.close();
    }
}
