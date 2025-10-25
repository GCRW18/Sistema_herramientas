import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { FleetService, NotificationService } from 'app/core/services';

@Component({
    selector: 'app-fleet-form',
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
        MatTooltipModule,
    ],
    templateUrl: './fleet-form.component.html',
    styleUrl: './fleet-form.component.scss'
})
export default class FleetFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _route = inject(ActivatedRoute);
    private _fleetService = inject(FleetService);
    private _notificationService = inject(NotificationService);

    form!: FormGroup;
    isEditMode = false;
    aircraftId: string | null = null;
    loading = false;

    ngOnInit(): void {
        this.initForm();
        this.checkEditMode();
    }

    initForm(): void {
        this.form = this._fb.group({
            registration: ['', Validators.required],
            manufacturer: ['', Validators.required],
            model: ['', Validators.required],
            serialNumber: [''],
            type: ['passenger', Validators.required],
            status: ['active', Validators.required],
            baseLocation: [''],
            currentLocation: [''],
            manufactureDate: [''],
            acquisitionDate: [''],
            lastMaintenanceDate: [''],
            nextMaintenanceDate: [''],
            passengerCapacity: [''],
            cargoCapacity: [''],
            fuelCapacity: [''],
            totalFlightHours: [''],
            totalCycles: [''],
            owner: [''],
            operator: [''],
            notes: [''],
        });
    }

    checkEditMode(): void {
        this.aircraftId = this._route.snapshot.paramMap.get('id');
        if (this.aircraftId) {
            this.isEditMode = true;
            this.loadAircraft();
        }
    }

    loadAircraft(): void {
        if (!this.aircraftId) return;

        this.loading = true;
        this._fleetService.getAircraftById(this.aircraftId).subscribe({
            next: (aircraft) => {
                this.form.patchValue(aircraft);
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
        const aircraftData = this.form.value;

        const operation = this.isEditMode && this.aircraftId
            ? this._fleetService.updateAircraft(this.aircraftId, aircraftData)
            : this._fleetService.createAircraft(aircraftData);

        operation.subscribe({
            next: () => {
                const message = this.isEditMode
                    ? `Aeronave ${aircraftData.registration} actualizada correctamente`
                    : `Aeronave ${aircraftData.registration} creada correctamente`;
                this._notificationService.success(message);
                this._router.navigate(['/fleet']);
            },
            error: (error) => {
                this.loading = false;
                const message = this.isEditMode
                    ? 'Error al actualizar la aeronave'
                    : 'Error al crear la aeronave';
                this._notificationService.error(message);
                console.error('Error saving aircraft:', error);
            },
        });
    }

    cancel(): void {
        this._router.navigate(['/fleet']);
    }
}
