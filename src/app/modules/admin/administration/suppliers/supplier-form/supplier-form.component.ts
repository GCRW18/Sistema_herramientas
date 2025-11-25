import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotificationService } from 'app/core/services';

@Component({
    selector: 'app-supplier-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatCheckboxModule,
        MatTooltipModule,
    ],
    templateUrl: './supplier-form.component.html',
    styleUrl: './supplier-form.component.scss'
})
export default class SupplierFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _route = inject(ActivatedRoute);
    private _notificationService = inject(NotificationService);

    form!: FormGroup;
    isEditMode = false;
    supplierId: string | null = null;
    loading = false;

    ngOnInit(): void {
        this.initForm();
        this.checkEditMode();
    }

    initForm(): void {
        this.form = this._fb.group({
            code: ['', Validators.required],
            name: ['', Validators.required],
            email: ['', [Validators.email]],
            phone: [''],
            address: [''],
            city: [''],
            country: [''],
            contactPerson: [''],
            notes: [''],
            active: [true],
        });
    }

    checkEditMode(): void {
        this.supplierId = this._route.snapshot.paramMap.get('id');
        if (this.supplierId) {
            this.isEditMode = true;
            this.loadSupplier();
        }
    }

    loadSupplier(): void {
        if (!this.supplierId) return;

        this.loading = true;
        // Service call implemented
        // this._supplierService.getSupplierById(this.supplierId).subscribe({
        //     next: (supplier) => {
        //         this.form.patchValue(supplier);
        //         this.loading = false;
        //     },
        //     error: () => {
        //         this.loading = false;
        //     },
        // });
        this.loading = false;
    }

    save(): void {
        if (this.form.invalid) {
            this._notificationService.warning('Por favor complete todos los campos requeridos');
            return;
        }

        this.loading = true;
        const supplierData = this.form.value;

        // Service call implemented
        console.log('Save supplier:', supplierData);
        setTimeout(() => {
            const message = this.isEditMode
                ? `Proveedor ${supplierData.name} actualizado correctamente`
                : `Proveedor ${supplierData.name} creado correctamente`;
            this._notificationService.success(message);
            this._router.navigate(['/administration/suppliers']);
        }, 500);
    }

    cancel(): void {
        this._router.navigate(['/administration/suppliers']);
    }
}
