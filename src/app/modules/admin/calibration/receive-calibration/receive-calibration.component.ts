import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CalibrationService } from 'app/core/services';

@Component({
    selector: 'app-receive-calibration',
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
    templateUrl: './receive-calibration.component.html',
    styleUrl: './receive-calibration.component.scss'
})
export default class ReceiveCalibrationComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _route = inject(ActivatedRoute);
    private _calibrationService = inject(CalibrationService);

    form!: FormGroup;
    loading = false;
    calibrationId: string | null = null;

    ngOnInit(): void {
        this.calibrationId = this._route.snapshot.paramMap.get('id');
        console.log('Calibration ID:', this.calibrationId);  // AGREGAR ESTA LÍNEA
        this.initForm();
    }


    initForm(): void {
        // Calcular fecha de próxima calibración (1 año desde hoy por defecto)
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);

        this.form = this._fb.group({
            returnDate: [new Date(), Validators.required],
            result: ['approved', Validators.required],
            certificate: ['', Validators.required],
            nextCalibrationDate: [nextYear, Validators.required],
            observations: [''],
            cost: [''],
        });
    }
    save(): void {
        if (!this.calibrationId) {
            console.error('No calibration ID');
            alert('No se encontró el ID de calibración');
            return;
        }

        if (this.form.invalid) {
            console.error('Form invalid');
            Object.keys(this.form.controls).forEach(key => {
                const control = this.form.get(key);
                if (control?.invalid) {
                    console.error(`Campo inválido: ${key}`, control.errors);
                }
            });
            alert('Por favor complete todos los campos requeridos');
            return;
        }

        this.loading = true;
        const returnData = {
            ...this.form.value,
            calibrationId: this.calibrationId,
        };

        this._calibrationService.receiveFromCalibration(this.calibrationId, returnData).subscribe({
            next: (response) => {
                console.log('Calibration received successfully:', response);
                this.loading = false;
                // Redirigir inmediatamente sin esperar
                this._router.navigate(['/calibration/tracking']).then(() => {
                    console.log('Navigation completed');
                });
            },
            error: (error) => {
                console.error('Error receiving calibration:', error);
                this.loading = false;
                alert('Error al registrar el retorno de calibración: ' + (error?.detalle?.mensaje || 'Error desconocido'));
            },
            complete: () => {
                console.log('Observable completed');
            }
        });
    }







    cancel(): void {
        this._router.navigate(['/calibration/tracking']);
    }
}
