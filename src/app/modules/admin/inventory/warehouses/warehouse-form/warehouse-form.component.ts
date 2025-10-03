import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WarehouseService, NotificationService } from 'app/core/services';
import { Warehouse } from 'app/core/models';

@Component({
    selector: 'app-warehouse-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatIconModule,
        MatCardModule,
        MatTooltipModule,
    ],
    templateUrl: './warehouse-form.component.html',
    styleUrl: './warehouse-form.component.scss'
})
export class WarehouseFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _warehouseService = inject(WarehouseService);
    private _notificationService = inject(NotificationService);

    form!: FormGroup;
    warehouseId: string | null = null;
    isEditMode = false;
    loading = false;
    submitting = false;

    ngOnInit(): void {
        this.warehouseId = this._route.snapshot.paramMap.get('id');
        this.isEditMode = !!this.warehouseId;
        this.initForm();

        if (this.isEditMode && this.warehouseId) {
            this.loadWarehouse(this.warehouseId);
        }
    }

    initForm(): void {
        this.form = this._fb.group({
            code: ['', [Validators.required, Validators.maxLength(50)]],
            name: ['', [Validators.required, Validators.maxLength(200)]],
            description: ['', Validators.maxLength(500)],
            address: ['', Validators.maxLength(500)],
            phone: ['', Validators.maxLength(50)],
            responsible: ['', Validators.maxLength(200)],
            active: [true],
        });
    }

    loadWarehouse(id: string): void {
        this.loading = true;
        this._warehouseService.getWarehouseById(id).subscribe({
            next: (warehouse) => {
                this.form.patchValue(warehouse);
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this._router.navigate(['/inventory/warehouses']);
            },
        });
    }

    save(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this._notificationService.warning('Por favor complete todos los campos requeridos');
            return;
        }

        this.submitting = true;
        const warehouseData: Warehouse = this.form.value;

        const request = this.isEditMode && this.warehouseId
            ? this._warehouseService.updateWarehouse(this.warehouseId, warehouseData)
            : this._warehouseService.createWarehouse(warehouseData);

        request.subscribe({
            next: () => {
                this.submitting = false;
                const message = this.isEditMode
                    ? `Almacén ${warehouseData.code} actualizado correctamente`
                    : `Almacén ${warehouseData.code} creado correctamente`;
                this._notificationService.success(message);
                this._router.navigate(['/inventory/warehouses']);
            },
            error: (error) => {
                this.submitting = false;
                const message = this.isEditMode
                    ? 'Error al actualizar el almacén'
                    : 'Error al crear el almacén';
                this._notificationService.error(message);
                console.error('Error saving warehouse:', error);
            },
        });
    }

    cancel(): void {
        this._router.navigate(['/inventory/warehouses']);
    }

    getErrorMessage(fieldName: string): string {
        const field = this.form.get(fieldName);
        if (field?.hasError('required')) {
            return 'Este campo es requerido';
        }
        if (field?.hasError('maxLength')) {
            return `Máximo ${field.errors?.['maxLength'].requiredLength} caracteres`;
        }
        return '';
    }
}
