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
import { CalibrationService, ToolService } from 'app/core/services';
import { Tool } from 'app/core/models';

@Component({
    selector: 'app-send-calibration',
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
    templateUrl: './send-calibration.component.html',
    styleUrl: './send-calibration.component.scss'
})
export default class SendCalibrationComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _calibrationService = inject(CalibrationService);
    private _toolService = inject(ToolService);

    form!: FormGroup;
    loading = false;

    tools: Tool[] = [];
    filteredTools: Tool[] = [];

    ngOnInit(): void {
        this.initForm();
        this.loadTools();
    }

    initForm(): void {
        this.form = this._fb.group({
            toolId: ['', Validators.required],
            provider: ['', Validators.required],
            sendDate: [new Date(), Validators.required],
            estimatedReturnDate: ['', Validators.required],
            calibrationType: ['calibration', Validators.required],
            cost: [''],
            notes: [''],
        });
    }

    loadTools(): void {
        this._toolService.getTools({ requiresCalibration: true, status: 'available' }).subscribe({
            next: (tools) => {
                this.tools = tools;
                this.filteredTools = tools;
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
        const calibrationData = this.form.value;

        this._calibrationService.sendToCalibration(calibrationData).subscribe({
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
