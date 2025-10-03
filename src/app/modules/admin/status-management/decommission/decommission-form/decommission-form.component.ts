import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { ToolService } from 'app/core/services';
import { Tool } from 'app/core/models';

@Component({
    selector: 'app-decommission-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatCardModule,
        MatSelectModule,
        MatDatepickerModule,
    ],
    templateUrl: './decommission-form.component.html',
    styleUrl: './decommission-form.component.scss'
})
export default class DecommissionFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _toolService = inject(ToolService);

    form!: FormGroup;
    tools: Tool[] = [];
    loading = false;

    reasonOptions = [
        'Desgaste irreparable',
        'Obsolescencia tecnológica',
        'Daño irreversible',
        'Fuera de especificaciones',
        'Costo de reparación elevado',
        'Otro',
    ];

    ngOnInit(): void {
        this.initForm();
        this.loadTools();
    }

    initForm(): void {
        this.form = this._fb.group({
            toolId: ['', Validators.required],
            reason: ['', Validators.required],
            date: [new Date(), Validators.required],
            notes: [''],
        });
    }

    loadTools(): void {
        // Load tools that can be decommissioned (typically in quarantine or inactive)
        this._toolService.getTools({ status: 'quarantine' }).subscribe({
            next: (tools) => {
                this.tools = tools;
            },
        });
    }

    save(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.loading = true;
        const formData = this.form.value;

        // TODO: Replace with actual service call
        console.log('Decommission request:', formData);

        setTimeout(() => {
            this.loading = false;
            this._router.navigate(['/status-management/decommission']);
        }, 1000);
    }

    cancel(): void {
        this._router.navigate(['/status-management/decommission']);
    }
}
