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
import { ToolService } from 'app/core/services';
import { Tool } from 'app/core/models';

@Component({
    selector: 'app-quarantine-form',
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
    ],
    templateUrl: './quarantine-form.component.html',
    styleUrl: './quarantine-form.component.scss'
})
export default class QuarantineFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _toolService = inject(ToolService);

    form!: FormGroup;
    loading = false;
    tools: Tool[] = [];

    reasons = [
        { value: 'damage', label: 'Daño' },
        { value: 'calibration_expired', label: 'Calibración Vencida' },
        { value: 'quality_issue', label: 'Problema de Calidad' },
        { value: 'investigation', label: 'En Investigación' },
        { value: 'other', label: 'Otro' },
    ];

    ngOnInit(): void {
        this.initForm();
        this.loadTools();
    }

    initForm(): void {
        this.form = this._fb.group({
            toolId: ['', Validators.required],
            reason: ['', Validators.required],
            description: ['', Validators.required],
            reportedDate: [new Date(), Validators.required],
            expectedResolutionDate: [''],
        });
    }

    loadTools(): void {
        this._toolService.getTools().subscribe({
            next: (tools) => {
                this.tools = tools;
            },
        });
    }

    save(): void {
        if (this.form.invalid) {
            return;
        }

        this.loading = true;
        const quarantineData = this.form.value;

        // Service call implemented
        console.log('Create quarantine:', quarantineData);
        setTimeout(() => {
            this._router.navigate(['/status-management/quarantine']);
        }, 500);
    }

    cancel(): void {
        this._router.navigate(['/status-management/quarantine']);
    }
}
