import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MovementService, ToolService, WarehouseService } from 'app/core/services';
import { Tool, Warehouse, Location } from 'app/core/models';

@Component({
    selector: 'app-entry-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatAutocompleteModule,
        MatTooltipModule,
    ],
    templateUrl: './entry-form.component.html',
    styleUrl: './entry-form.component.scss'
})
export default class EntryFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _movementService = inject(MovementService);
    private _toolService = inject(ToolService);
    private _warehouseService = inject(WarehouseService);

    form!: FormGroup;
    loading = false;

    tools: Tool[] = [];
    warehouses: Warehouse[] = [];
    locations: Location[] = [];
    filteredTools: Tool[] = [];

    entryTypes = [
        { value: 'entry_purchase', label: 'Compra' },
        { value: 'entry_return', label: 'Devolución' },
        { value: 'entry_adjustment', label: 'Ajuste de Inventario' },
        { value: 'entry_calibration_return', label: 'Retorno de Calibración' },
    ];

    ngOnInit(): void {
        this.initForm();
        this.loadData();
    }

    initForm(): void {
        this.form = this._fb.group({
            type: ['entry_purchase', Validators.required],
            date: [new Date(), Validators.required],
            toolId: ['', Validators.required],
            quantity: [1, [Validators.required, Validators.min(1)]],
            warehouseId: ['', Validators.required],
            locationId: [''],
            responsiblePerson: ['', Validators.required],
            supplier: [''],
            invoiceNumber: [''],
            purchasePrice: [''],
            notes: [''],
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

        this.form.get('type')?.valueChanges.subscribe((type) => {
            this.updateFormValidators(type);
        });
    }

    updateFormValidators(type: string): void {
        const supplierControl = this.form.get('supplier');
        const invoiceControl = this.form.get('invoiceNumber');

        if (type === 'entry_purchase') {
            supplierControl?.setValidators([Validators.required]);
        } else {
            supplierControl?.clearValidators();
        }

        supplierControl?.updateValueAndValidity();
        invoiceControl?.updateValueAndValidity();
    }

    loadData(): void {
        this._toolService.getTools().subscribe({
            next: (tools) => {
                this.tools = tools;
                this.filteredTools = tools;
            },
        });

        this._warehouseService.getWarehouses().subscribe({
            next: (warehouses) => {
                this.warehouses = warehouses;
            },
        });
    }

    filterTools(event: Event): void {
        const value = (event.target as HTMLInputElement).value.toLowerCase();
        this.filteredTools = this.tools.filter(
            (tool) =>
                tool.name.toLowerCase().includes(value) ||
                tool.code.toLowerCase().includes(value)
        );
    }

    save(): void {
        if (this.form.invalid) {
            return;
        }

        this.loading = true;
        const movementData = this.form.value;

        this._movementService.createMovement(movementData).subscribe({
            next: () => {
                this._router.navigate(['/movements/entries']);
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    cancel(): void {
        this._router.navigate(['/movements/entries']);
    }
}
