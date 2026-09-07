import { Component, Inject, Optional, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface FormClienteData {
    cliente?: any;
    mode?: 'create' | 'edit';
}

/**
 * Alta/edición de un cliente / empresa de terceros (he.tcustomers).
 * El `code` (CLI-YYYY-NNNNN) lo autogenera he.ft_customers_ime si no se envía.
 */
@Component({
    selector: 'app-form-cliente-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatDialogModule],
    templateUrl: './form-cliente-dialog.component.html',
    styles: [`
        .neo-input {
            width: 100%; height: 38px; padding: 0 10px;
            background-color: #f9fafb; border: 2px solid #000;
            border-radius: 8px; font-weight: 800; font-size: 12px;
            color: #1f2937; transition: all 0.15s;
        }
        textarea.neo-input { height: auto; padding: 8px 10px; min-height: 64px; }
        .neo-input::placeholder { font-weight: 600; color: #9ca3af; }
        .neo-input:focus { outline: none; box-shadow: 3px 3px 0px 0px #000; transform: translateY(-1px); }
        :host-context(.dark) .neo-input { background-color: #1e293b; color: white; border-color: #475569; }
        .field-label { display: block; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #6b7280; margin-bottom: 3px; margin-left: 2px; letter-spacing: 0.04em; }
        :host-context(.dark) .field-label { color: #94a3b8; }
    `]
})
export class FormClienteDialogComponent implements OnInit {
    dialogRef = inject(MatDialogRef<FormClienteDialogComponent>, { optional: true });
    private fb = inject(FormBuilder);

    form!: FormGroup;
    isEdit = false;

    constructor(@Optional() @Inject(MAT_DIALOG_DATA) public data: FormClienteData) {}

    ngOnInit(): void {
        this.form = this.fb.group({
            name:           ['', Validators.required],
            tax_id:         [''],
            contact_person: [''],
            phone:          [''],
            email:          ['', [Validators.email]],
            city:           [''],
            address:        [''],
            notes:          [''],
        });
        if (this.data?.cliente && this.data?.mode === 'edit') {
            this.isEdit = true;
            this.form.patchValue(this.data.cliente);
        }
    }

    guardar(): void {
        if (this.form.invalid) { this.form.markAllAsTouched(); return; }
        this.dialogRef?.close(this.form.value);
    }

    cancelar(): void { this.dialogRef?.close(null); }
}
