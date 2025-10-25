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
import { MovementService, ToolService } from 'app/core/services';
import { Tool } from 'app/core/models';

@Component({
    selector: 'app-exit-form',
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
    templateUrl: './exit-form.component.html',
    styleUrl: './exit-form.component.scss'
})
export default class ExitFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _movementService = inject(MovementService);
    private _toolService = inject(ToolService);

    form!: FormGroup;
    loading = false;

    tools: Tool[] = [];
    availableTools: Tool[] = [];
    filteredTools: Tool[] = [];

    exitTypes = [
        { value: 'exit_loan', label: 'Préstamo' },
        { value: 'exit_sale', label: 'Venta' },
        { value: 'exit_calibration', label: 'Envío a Calibración' },
        { value: 'exit_maintenance', label: 'Envío a Mantenimiento' },
    ];

    ngOnInit(): void {
        this.initForm();
        this.loadData();
    }

    initForm(): void {
        this.form = this._fb.group({
            type: ['exit_loan', Validators.required],
            date: [new Date(), Validators.required],
            toolId: ['', Validators.required],
            responsiblePerson: ['', Validators.required],
            // Campos Aeronáuticos
            aircraft: [''],
            workOrderNumber: [''],
            technician: [''],
            authorizedBy: [''],
            department: [''],
            recipient: [''],
            expectedReturnDate: [''],
            calibrationProvider: [''],
            maintenanceType: [''],
            notes: [''],
        });

        this.form.get('type')?.valueChanges.subscribe((type) => {
            this.updateFormValidators(type);
        });
    }

    updateFormValidators(type: string): void {
        const recipientControl = this.form.get('recipient');
        const returnDateControl = this.form.get('expectedReturnDate');
        const providerControl = this.form.get('calibrationProvider');
        const maintenanceControl = this.form.get('maintenanceType');

        // Limpiar validadores
        recipientControl?.clearValidators();
        returnDateControl?.clearValidators();
        providerControl?.clearValidators();
        maintenanceControl?.clearValidators();

        // Agregar validadores según el tipo
        if (type === 'exit_loan') {
            recipientControl?.setValidators([Validators.required]);
            returnDateControl?.setValidators([Validators.required]);
        } else if (type === 'exit_calibration') {
            providerControl?.setValidators([Validators.required]);
            returnDateControl?.setValidators([Validators.required]);
        } else if (type === 'exit_maintenance') {
            maintenanceControl?.setValidators([Validators.required]);
            returnDateControl?.setValidators([Validators.required]);
        }

        // Actualizar validez
        recipientControl?.updateValueAndValidity();
        returnDateControl?.updateValueAndValidity();
        providerControl?.updateValueAndValidity();
        maintenanceControl?.updateValueAndValidity();
    }

    loadData(): void {
        this._toolService.getTools({ status: 'available' }).subscribe({
            next: (tools) => {
                this.availableTools = tools;
                this.filteredTools = tools;
            },
        });
    }

    filterTools(event: Event): void {
        const value = (event.target as HTMLInputElement).value.toLowerCase();
        this.filteredTools = this.availableTools.filter(
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
                this._router.navigate(['/movements/exits']);
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    cancel(): void {
        this._router.navigate(['/movements/exits']);
    }
}
