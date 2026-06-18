import { Component, OnInit, inject, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AlertRecipient } from '../../../../../../core/services/alert-recipients.service';

export interface FormAlertaData {
    destinatario?: AlertRecipient;
    mode?: 'create' | 'edit';
}

@Component({
    selector: 'app-form-alerta-destinatario',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        DragDropModule,
    ],
    templateUrl: './form-alerta-destinatario.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; }
        form::-webkit-scrollbar { width: 4px; }
        form::-webkit-scrollbar-track { background: transparent; }
        form::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 2px; }
    `]
})
export class FormAlertaDestinatarioComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<FormAlertaDestinatarioComponent>, { optional: true });
    private fb = inject(FormBuilder);

    form!: FormGroup;
    isEditMode = false;

    constructor(@Optional() @Inject(MAT_DIALOG_DATA) public data: FormAlertaData) {}

    ngOnInit(): void {
        this.form = this.fb.group({
            nombre:      ['', [Validators.required, Validators.minLength(3)]],
            email:       ['', [Validators.required, Validators.email]],
            dias_alerta: [30, [Validators.required, Validators.min(1), Validators.max(365)]],
            notes:       [''],
            activo:      [true],
        });

        if (this.data?.destinatario && this.data?.mode === 'edit') {
            this.isEditMode = true;
            this.form.patchValue(this.data.destinatario);
        }
    }

    onSubmit(): void {
        if (this.form.valid) {
            this.dialogRef?.close(this.form.value);
        } else {
            this.form.markAllAsTouched();
        }
    }

    onCancel(): void {
        this.dialogRef?.close();
    }
}
