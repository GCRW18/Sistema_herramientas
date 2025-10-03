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
        this.initForm();
    }

    initForm(): void {
        this.form = this._fb.group({
            returnDate: [new Date(), Validators.required],
            result: ['approved', Validators.required],
            certificate: ['', Validators.required],
            nextCalibrationDate: ['', Validators.required],
            observations: [''],
            cost: [''],
        });
    }

    save(): void {
        if (this.form.invalid || !this.calibrationId) {
            return;
        }

        this.loading = true;
        const returnData = {
            ...this.form.value,
            calibrationId: this.calibrationId,
        };

        if (!this.calibrationId) return;

        this._calibrationService.receiveFromCalibration(this.calibrationId, returnData).subscribe({
            next: () => {
                this._router.navigate(['/calibration/tracking']);
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    cancel(): void {
        this._router.navigate(['/calibration/tracking']);
    }
}
