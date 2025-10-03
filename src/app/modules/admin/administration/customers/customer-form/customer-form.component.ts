import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { CustomerService, NotificationService } from 'app/core/services';

@Component({
    selector: 'app-customer-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatCardModule,
    ],
    templateUrl: './customer-form.component.html',
    styleUrl: './customer-form.component.scss'
})
export default class CustomerFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _route = inject(ActivatedRoute);
    private _notificationService = inject(NotificationService);
    private _customerService = inject(CustomerService);

    form!: FormGroup;
    customerId: string | null = null;
    isEditMode = false;
    loading = false;

    ngOnInit(): void {
        this.initForm();
        this.checkEditMode();
    }

    initForm(): void {
        this.form = this._fb.group({
            name: ['', Validators.required],
            contactName: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            phone: ['', Validators.required],
            address: [''],
            taxId: [''],
            notes: [''],
        });
    }

    checkEditMode(): void {
        this.customerId = this._route.snapshot.paramMap.get('id');
        if (this.customerId) {
            this.isEditMode = true;
            this.loadCustomer();
        }
    }

    loadCustomer(): void {
        if (!this.customerId) return;

        this.loading = true;
        this._customerService.getCustomerById(this.customerId).subscribe({
            next: (customer) => {
                this.form.patchValue(customer);
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this._router.navigate(['/administration/customers']);
            },
        });
    }

    save(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this._notificationService.warning('Por favor complete todos los campos requeridos');
            return;
        }

        this.loading = true;
        const customerData = this.form.value;

        const request = this.isEditMode && this.customerId
            ? this._customerService.updateCustomer(this.customerId, customerData)
            : this._customerService.createCustomer(customerData);

        request.subscribe({
            next: () => {
                this.loading = false;
                const message = this.isEditMode
                    ? `Cliente ${customerData.name} actualizado correctamente`
                    : `Cliente ${customerData.name} creado correctamente`;
                this._notificationService.success(message);
                this._router.navigate(['/administration/customers']);
            },
            error: (error) => {
                this.loading = false;
                const message = this.isEditMode
                    ? 'Error al actualizar el cliente'
                    : 'Error al crear el cliente';
                this._notificationService.error(message);
                console.error('Error saving customer:', error);
            },
        });
    }

    cancel(): void {
        this._router.navigate(['/administration/customers']);
    }
}
