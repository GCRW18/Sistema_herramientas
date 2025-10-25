import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { Location } from 'app/core/models';

@Component({
    selector: 'app-location-form',
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
    templateUrl: './location-form.component.html',
    styleUrl: './location-form.component.scss'
})
export class LocationFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _warehouseService = inject(WarehouseService);
    private _notificationService = inject(NotificationService);

    form!: FormGroup;
    warehouseId: string | null = null;
    locationId: string | null = null;
    isEditMode = false;
    loading = false;
    submitting = false;

    locationTypes: string[] = ['shelf', 'rack', 'bin', 'drawer', 'cabinet', 'area', 'other'];

    ngOnInit(): void {
        this.warehouseId = this._route.snapshot.paramMap.get('warehouseId');
        this.locationId = this._route.snapshot.paramMap.get('locationId');
        this.isEditMode = !!this.locationId;
        this.initForm();

        if (this.isEditMode && this.warehouseId && this.locationId) {
            this.loadLocation(this.warehouseId, this.locationId);
        }
    }

    initForm(): void {
        this.form = this._fb.group({
            code: ['', [Validators.required, Validators.maxLength(50)]],
            name: ['', [Validators.required, Validators.maxLength(200)]],
            description: ['', Validators.maxLength(500)],
            type: ['shelf', Validators.required],
            capacity: [null],
            currentCapacity: [0],
            active: [true],
        });
    }

    loadLocation(warehouseId: string, locationId: string): void {
        this.loading = true;
        this._warehouseService.getLocationById(locationId).subscribe({
            next: (location) => {
                this.form.patchValue(location);
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this._router.navigate(['/inventory/warehouses', this.warehouseId]);
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
        const locationData: Location = { ...this.form.value, warehouseId: this.warehouseId };

        const request = this.isEditMode && this.locationId
            ? this._warehouseService.updateLocation(this.locationId, locationData)
            : this._warehouseService.createLocation(locationData);

        request.subscribe({
            next: () => {
                this.submitting = false;
                const message = this.isEditMode
                    ? `Ubicación ${locationData.name} actualizada correctamente`
                    : `Ubicación ${locationData.name} creada correctamente`;
                this._notificationService.success(message);
                this._router.navigate(['/inventory/warehouses', this.warehouseId]);
            },
            error: (error) => {
                this.submitting = false;
                const message = this.isEditMode
                    ? 'Error al actualizar la ubicación'
                    : 'Error al crear la ubicación';
                this._notificationService.error(message);
                console.error('Error saving location:', error);
            },
        });
    }

    cancel(): void {
        this._router.navigate(['/inventory/warehouses', this.warehouseId]);
    }

    getErrorMessage(fieldName: string): string {
        const field = this.form.get(fieldName);
        if (field?.hasError('required')) {
            return 'Este campo es requerido';
        }
        if (field?.hasError('maxlength')) {
            return `Máximo ${field.errors?.['maxlength'].requiredLength} caracteres`;
        }
        return '';
    }
}
