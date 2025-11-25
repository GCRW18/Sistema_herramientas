import { Component, OnInit, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { Maintenance, MaintenanceType, MAINTENANCE_TYPE_LABELS } from 'app/core/models/maintenance.types';

export interface MaintenanceDialogData {
    maintenance?: Maintenance;
    mode: 'create' | 'edit';
}

@Component({
    selector: 'app-maintenance-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatIconModule,
    ],
    templateUrl: './maintenance-dialog.component.html',
    styleUrl: './maintenance-dialog.component.scss'
})
export class MaintenanceDialogComponent implements OnInit {
    private _formBuilder = inject(FormBuilder);
    maintenanceForm: FormGroup;

    maintenanceTypes: Array<{ value: MaintenanceType; label: string }> = [
        { value: 'preventive', label: MAINTENANCE_TYPE_LABELS.preventive },
        { value: 'corrective', label: MAINTENANCE_TYPE_LABELS.corrective },
        { value: 'predictive', label: MAINTENANCE_TYPE_LABELS.predictive },
    ];

    constructor(
        public dialogRef: MatDialogRef<MaintenanceDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: MaintenanceDialogData
    ) {
        // En modo creación, toolId no es requerido inicialmente
        const isCreateMode = this.data.mode === 'create';

        this.maintenanceForm = this._formBuilder.group({
            toolId: [''],
            toolCode: ['', isCreateMode ? [] : Validators.required],
            toolName: ['', isCreateMode ? [] : Validators.required],
            type: ['preventive', Validators.required],
            scheduledDate: [new Date(), Validators.required],
            technician: [''],
            description: ['', Validators.required],
            notes: [''],
            estimatedCost: [0, [Validators.min(0)]],
        });
    }

    ngOnInit(): void {
        if (this.data.maintenance && this.data.mode === 'edit') {
            this.maintenanceForm.patchValue({
                toolId: this.data.maintenance.toolId,
                toolCode: this.data.maintenance.toolCode,
                toolName: this.data.maintenance.toolName,
                type: this.data.maintenance.type,
                scheduledDate: this.data.maintenance.scheduledDate,
                technician: this.data.maintenance.technician,
                description: this.data.maintenance.description,
                notes: this.data.maintenance.notes,
                estimatedCost: this.data.maintenance.cost || 0,
            });
        }
    }

    get isEditMode(): boolean {
        return this.data.mode === 'edit';
    }

    get dialogTitle(): string {
        return this.isEditMode ? 'Editar Mantenimiento' : 'Nuevo Mantenimiento';
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onSave(): void {
        if (this.maintenanceForm.valid) {
            this.dialogRef.close(this.maintenanceForm.value);
        }
    }
}
