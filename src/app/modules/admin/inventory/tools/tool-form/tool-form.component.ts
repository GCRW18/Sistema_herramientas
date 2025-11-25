import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { ToolService, CategoryService, WarehouseService, NotificationService } from 'app/core/services';
import { Category, Subcategory, Warehouse, Location } from 'app/core/models';

@Component({
    selector: 'app-tool-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatProgressBarModule,
        MatListModule,
    ],
    templateUrl: './tool-form.component.html',
    styleUrls: ['./tool-form.component.scss']
})
export class ToolFormComponent implements OnInit {
    private _formBuilder = inject(FormBuilder);
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _toolService = inject(ToolService);
    private _categoryService = inject(CategoryService);
    private _warehouseService = inject(WarehouseService);
    private _notificationService = inject(NotificationService);

    form!: FormGroup;
    isEditMode: boolean = false;
    toolId: string | null = null;
    loading: boolean = false;

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
        this.form = this._formBuilder.group({
            id: [null],
            name: ['', Validators.required],
            description: [null],
            code: ['', Validators.required],
            categoryId: ['', Validators.required],
            subcategoryId: [null],
            warehouseId: ['', Validators.required],
            locationId: [null],
            status: ['available'],
            condition: ['good'],
            purchaseDate: [null],
            price: [null, [Validators.min(0)]],
            supplier: [null],
            serialNumber: [null],
            assetNumber: [null],
            brand: [null],
            model: [null],
            warranty: [null],
            warrantyExpiration: [null],
            requiresCalibration: [false],
            calibrationInterval: [null],
            lastCalibrationDate: [null],
            nextCalibrationDate: [null],
            calibrationCertificate: [null],
            notes: [null],
            aircraft: [null],
            workOrderNumber: [null],
            technician: [null],
            department: [null]
        });

        this.form.get('categoryId')?.valueChanges.subscribe((categoryId) => {
            if (categoryId) {
                this._categoryService.getSubcategories(categoryId).subscribe((subcategories) => {
                    this.subcategories = subcategories;
                });
            } else {
                this.subcategories = [];
                this.form.patchValue({ subcategoryId: '' });
            }
        });

        this.form.get('warehouseId')?.valueChanges.subscribe((warehouseId) => {
            if (warehouseId) {
                // TODO: Descomentar cuando ACTlocations.php esté en el servidor
                // this._warehouseService.getLocations(warehouseId).subscribe((locations) => {
                //     this.locations = locations;
                // });
                this.locations = []; // Temporal: vacío hasta que se suba ACTlocations.php
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
            }
        });

        this._warehouseService.getWarehouses().subscribe({
            next: (warehouses) => {
                this.warehouses = warehouses;
            }
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
            }
        });
    }

    save(): void {
        if (this.form.invalid) {
            this._notificationService.warning('Por favor complete todos los campos requeridos.');
            return;
        }

        this.loading = true;
        const formValue = this.form.value;

        // Mapear nombres de campos del formulario a nombres esperados por el backend
        // Función helper para limpiar valores undefined/null
        const cleanValue = (value: any) => {
            // Convertir string "null" a null real
            if (value === 'null' || value === 'undefined') return null;
            // Valores vacíos a null
            if (value === undefined || value === null || value === '') return null;
            // Strings vacíos a null
            if (typeof value === 'string' && value.trim() === '') return null;
            // Números como string a null si son cero o vacíos
            if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() === '') return null;
            return value;
        };

        // Función helper para formatear fechas
        const formatDate = (value: any) => {
            if (!value || value === 'null' || value === 'undefined') return null;
            if (value instanceof Date) {
                const year = value.getFullYear();
                const month = String(value.getMonth() + 1).padStart(2, '0');
                const day = String(value.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            // Si ya es string en formato YYYY-MM-DD, dejarlo como está
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return value;
            }
            return null;
        };

        // Función helper para convertir null a string vacío (PXP requiere todos los campos)
        const toEmptyString = (value: any) => {
            return value === null || value === undefined ? '' : value;
        };

        // Construir objeto con TODOS los campos (la función SQL los requiere todos)
        // IMPORTANTE: PXP requiere que todos los campos existan
        // - Usar '' para campos de texto, fecha, numéricos (se convierten con NULLIF en SQL)
        // - NO incluir images/documents (arrays) - se manejarán en el backend como NULL
        const toolData: any = {
            code: formValue.code,
            name: formValue.name,
            description: toEmptyString(cleanValue(formValue.description)),
            category_id: formValue.categoryId,
            subcategory_id: toEmptyString(cleanValue(formValue.subcategoryId)),
            warehouse_id: formValue.warehouseId,
            location_id: toEmptyString(cleanValue(formValue.locationId)),
            status: formValue.status || 'available',
            condition: formValue.condition || 'good',
            aircraft: toEmptyString(cleanValue(formValue.aircraft)),
            work_order_number: toEmptyString(cleanValue(formValue.workOrderNumber)),
            technician: toEmptyString(cleanValue(formValue.technician)),
            department: toEmptyString(cleanValue(formValue.department)),
            brand: toEmptyString(cleanValue(formValue.brand)),
            model: toEmptyString(cleanValue(formValue.model)),
            serial_number: toEmptyString(cleanValue(formValue.serialNumber)),
            part_number: toEmptyString(cleanValue(formValue.assetNumber)),
            purchase_date: toEmptyString(formatDate(formValue.purchaseDate)),
            purchase_price: toEmptyString(cleanValue(formValue.price)),
            supplier: toEmptyString(cleanValue(formValue.supplier)),
            warranty: toEmptyString(cleanValue(formValue.warranty)),
            warranty_expiration: toEmptyString(formatDate(formValue.warrantyExpiration)),
            requires_calibration: formValue.requiresCalibration || false,
            calibration_interval: toEmptyString(cleanValue(formValue.calibrationInterval)),
            last_calibration_date: toEmptyString(formatDate(formValue.lastCalibrationDate)),
            next_calibration_date: toEmptyString(formatDate(formValue.nextCalibrationDate)),
            calibration_certificate: toEmptyString(cleanValue(formValue.calibrationCertificate)),
            notes: toEmptyString(cleanValue(formValue.notes)),
            active: true
            // images y documents NO se envían - el backend los manejará como NULL
        };

        const operation = this.isEditMode && this.toolId
            ? this._toolService.updateTool(this.toolId, toolData)
            : this._toolService.createTool(toolData);

        operation.subscribe({
            next: () => {
                const message = this.isEditMode
                    ? 'Herramienta actualizada exitosamente!'
                    : 'Herramienta creada exitosamente!';
                this._notificationService.success(message);
                this._router.navigate(['/inventory/tools']);
            },
            error: (err) => {
                this.loading = false;
                const message = this.isEditMode
                    ? 'Error al actualizar la herramienta.'
                    : 'Error al crear la herramienta.';
                this._notificationService.error(message);
                console.error(err);
            }
        });
    }

    cancel(): void {
        this._router.navigate(['/inventory/tools']);
    }
}
