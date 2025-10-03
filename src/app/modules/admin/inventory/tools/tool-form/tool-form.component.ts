import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { ToolService, CategoryService, WarehouseService, NotificationService } from 'app/core/services';
import { Category, Subcategory, Warehouse, Location } from 'app/core/models';

@Component({
    selector: 'app-tool-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatTooltipModule,
    ],
    templateUrl: './tool-form.component.html',
    styleUrls: ['./tool-form.component.scss'],
})
export class ToolFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _route = inject(ActivatedRoute);
    private _toolService = inject(ToolService);
    private _categoryService = inject(CategoryService);
    private _warehouseService = inject(WarehouseService);
    private _notificationService = inject(NotificationService);

    form!: FormGroup;
    isEditMode = false;
    toolId: string | null = null;
    loading = false;

    categories: Category[] = [];
    subcategories: Subcategory[] = [];
    warehouses: Warehouse[] = [];
    locations: Location[] = [];

    ngOnInit(): void {
        this.initForm();
        this.loadData();
        this.checkEditMode();
    }

    initForm(): void {
        this.form = this._fb.group({
            code: ['', Validators.required],
            name: ['', Validators.required],
            description: [''],
            categoryId: ['', Validators.required],
            subcategoryId: [''],
            brand: [''],
            model: [''],
            serialNumber: [''],
            partNumber: [''],
            warehouseId: ['', Validators.required],
            locationId: [''],
            status: ['available', Validators.required],
            condition: ['good', Validators.required],
            requiresCalibration: [false],
            calibrationInterval: [''],
            lastCalibrationDate: [''],
            nextCalibrationDate: [''],
            calibrationCertificate: [''],
            purchaseDate: [''],
            purchasePrice: [''],
            supplier: [''],
            warranty: [''],
            warrantyExpiration: [''],
            notes: [''],
        });

        this.form.get('categoryId')?.valueChanges.subscribe((categoryId) => {
            if (categoryId) {
                this._categoryService.getSubcategories(categoryId).subscribe({
                    next: (subcategories) => {
                        this.subcategories = subcategories;
                    },
                });
            } else {
                this.subcategories = [];
                this.form.patchValue({ subcategoryId: '' });
            }
        });

        this.form.get('warehouseId')?.valueChanges.subscribe((warehouseId) => {
            if (warehouseId) {
                this._warehouseService.getLocations(warehouseId).subscribe({
                    next: (locations) => {
                        this.locations = locations;
                    },
                });
            } else {
                this.locations = [];
                this.form.patchValue({ locationId: '' });
            }
        });
    }

    loadData(): void {
        this._categoryService.getCategories().subscribe({
            next: (categories) => {
                this.categories = categories;
            },
        });

        this._warehouseService.getWarehouses().subscribe({
            next: (warehouses) => {
                this.warehouses = warehouses;
            },
        });
    }

    checkEditMode(): void {
        this.toolId = this._route.snapshot.paramMap.get('id');
        if (this.toolId) {
            this.isEditMode = true;
            this.loadTool();
        }
    }

    loadTool(): void {
        if (!this.toolId) return;

        this.loading = true;
        this._toolService.getToolById(this.toolId).subscribe({
            next: (tool) => {
                this.form.patchValue(tool);
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    save(): void {
        if (this.form.invalid) {
            this._notificationService.warning('Por favor complete todos los campos requeridos');
            return;
        }

        this.loading = true;
        const toolData = this.form.value;

        const operation = this.isEditMode && this.toolId
            ? this._toolService.updateTool(this.toolId, toolData)
            : this._toolService.createTool(toolData);

        operation.subscribe({
            next: () => {
                const message = this.isEditMode
                    ? `Herramienta ${toolData.code} actualizada correctamente`
                    : `Herramienta ${toolData.code} creada correctamente`;
                this._notificationService.success(message);
                this._router.navigate(['/inventory/tools']);
            },
            error: (error) => {
                this.loading = false;
                const message = this.isEditMode
                    ? 'Error al actualizar la herramienta'
                    : 'Error al crear la herramienta';
                this._notificationService.error(message);
                console.error('Error saving tool:', error);
            },
        });
    }

    cancel(): void {
        this._router.navigate(['/inventory/tools']);
    }
}
