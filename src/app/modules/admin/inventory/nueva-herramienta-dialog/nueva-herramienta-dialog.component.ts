import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';

@Component({
    selector: 'app-nueva-herramienta-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule
    ],
    encapsulation: ViewEncapsulation.None,
    templateUrl: './nueva-herramienta-dialog.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        .mat-mdc-dialog-container .mdc-dialog__surface {
            background-color: transparent !important;
            box-shadow: none !important;
            overflow: visible !important;
        }

        .field-label {
            display: block;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
            padding-left: 2px;
        }

        :host ::ng-deep .mat-mdc-text-field-wrapper {
            height: 40px !important;
            min-height: 40px !important;
            padding: 0 !important;
            border-radius: 8px !important;
            background-color: white !important;
        }

        :host ::ng-deep .dark .mat-mdc-text-field-wrapper {
            background-color: #0f172a !important;
        }

        :host ::ng-deep .mat-mdc-notched-outline__leading,
        :host ::ng-deep .mat-mdc-notched-outline__notch,
        :host ::ng-deep .mat-mdc-notched-outline__trailing {
            border-color: #d1d5db !important;
            border-width: 1px !important;
        }

        :host ::ng-deep .dark .mat-mdc-notched-outline__leading,
        :host ::ng-deep .dark .mat-mdc-notched-outline__notch,
        :host ::ng-deep .dark .mat-mdc-notched-outline__trailing {
            border-color: #4b5563 !important;
        }

        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-notched-outline__leading,
        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-notched-outline__notch,
        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-notched-outline__trailing {
            border-color: #2563eb !important;
            border-width: 2px !important;
        }

        :host ::ng-deep .mat-mdc-input-element {
            top: -6px !important;
            position: relative;
            font-size: 13px !important;
            font-weight: 600 !important;
            padding: 0 12px !important;
            color: black !important;
        }

        :host ::ng-deep .dark .mat-mdc-input-element {
            color: white !important;
        }

        :host ::ng-deep .mat-mdc-floating-label {
            display: none !important;
        }

        :host ::ng-deep .mat-mdc-notched-outline__notch {
            border-top-width: 1px !important;
            border-top-color: #d1d5db !important;
        }

        :host ::ng-deep .dark .mat-mdc-notched-outline__notch {
            border-top-color: #4b5563 !important;
        }

        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-notched-outline__notch {
            border-top-width: 2px !important;
            border-top-color: #2563eb !important;
        }

        :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
            display: none !important;
        }

        :host ::ng-deep textarea.mat-mdc-input-element {
            top: 0 !important;
            padding: 12px !important;
            min-height: 80px !important;
        }

        :host ::ng-deep .mat-mdc-select {
            top: -6px !important;
            position: relative;
            padding: 0 12px !important;
        }

        :host ::ng-deep .mat-mdc-select-value {
            font-size: 13px !important;
            font-weight: 600 !important;
            color: black !important;
        }

        :host ::ng-deep .dark .mat-mdc-select-value {
            color: white !important;
        }

        :host ::ng-deep .mat-icon {
            color: #6b7280 !important;
        }

        :host ::ng-deep .dark .mat-icon {
            color: #9ca3af !important;
        }
    `]
})
export class NuevaHerramientaDialogComponent implements OnInit {
    herramientaForm!: FormGroup;

    constructor(
        private fb: FormBuilder,
        public dialogRef: MatDialogRef<NuevaHerramientaDialogComponent>
    ) {}

    ngOnInit(): void {
        this.initForm();
    }

    private initForm(): void {
        this.herramientaForm = this.fb.group({
            // Información General
            pn: ['', Validators.required],
            sn: [''],
            descripcion: ['', Validators.required],
            codigoBoa: ['', Validators.required],
            ubicacion: [''],

            // Detalles de Inventario
            cantidad: [1, [Validators.required, Validators.min(1)]],
            um: ['UN', Validators.required],
            estado: ['NUEVO', Validators.required],

            // Documentación y Recepción
            tipoDe: ['COMPRA'],
            nroCmr: [''],
            nroComprobante: [''],
            fecha: [new Date().toISOString().split('T')[0]],
            entregado: [''],
            recibidoPor: [''],
            ci: [''],
            documentos: [''],
            obs: ['']
        });
    }

    onSubmit(): void {
        if (this.herramientaForm.valid) {
            this.dialogRef.close(this.herramientaForm.value);
        } else {
            this.herramientaForm.markAllAsTouched();
        }
    }

    cerrar(): void {
        this.dialogRef.close();
    }
}
