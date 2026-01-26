import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

// Material Modules
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { DragDropModule } from '@angular/cdk/drag-drop';

@Component({
    selector: 'app-salida-material',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatDialogModule,
        MatDatepickerModule,
        MatNativeDateModule,
        DragDropModule
    ],
    templateUrl: './salida-material.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            /* Variables de diseño Neo-Brutalista */
            --neo-border: 3px solid black;
            --neo-shadow: 5px 5px 0px 0px rgba(0,0,0,1);
        }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 12px !important;
        }

        /* --- ESTILOS DE INPUTS (Neo-Brutalismo) --- */
        :host ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: white !important;
            border: 2px solid black !important;
            border-radius: 8px !important;
            padding: 0 12px !important;
            min-height: 48px;
            box-shadow: 3px 3px 0px 0px rgba(0, 0, 0, 0.1);
            transition: all 0.2s;
            display: flex;
            align-items: center;
        }

        /* Textarea específico */
        :host ::ng-deep .textarea-field .mat-mdc-text-field-wrapper {
            height: 100% !important;
            min-height: 120px;
            align-items: flex-start;
            padding-top: 12px !important;
        }

        :host ::ng-deep textarea.mat-mdc-input-element {
            margin-top: 0px !important;
            height: 100% !important;
        }

        /* Estado Focus */
        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-text-field-wrapper {
            background-color: white !important;
            border-color: black !important;
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);
            transform: translate(-1px, -1px);
        }

        :host ::ng-deep .mat-mdc-input-element {
            font-weight: 700 !important;
            color: black !important;
        }

        :host ::ng-deep .mat-mdc-floating-label {
            font-weight: 800 !important;
            color: #6B7280 !important;
            text-transform: uppercase;
            font-size: 11px !important;
        }

        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-floating-label {
            color: black !important;
        }

        :host ::ng-deep .mat-mdc-icon-button {
            color: black !important;
        }

        /* Limpieza de estilos default */
        :host ::ng-deep .mat-mdc-form-field-focus-overlay,
        :host ::ng-deep .mat-mdc-notched-outline,
        :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
            display: none !important;
        }
    `]
})
export class SalidaMaterialComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<SalidaMaterialComponent>, { optional: true });
    salidaForm!: FormGroup;

    constructor(
        private fb: FormBuilder,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.salidaForm = this.fb.group({
            // Datos Persona
            nroLicencia: ['', Validators.required],
            nro: ['', Validators.required],
            apellidoPaterno: ['', Validators.required],
            apellidoMaterno: ['', Validators.required],
            nombre: ['', Validators.required],
            area: ['', Validators.required],
            nroNota: [''],
            despachadoPor: ['', Validators.required],

            // Datos Material
            codigoNombre: ['', Validators.required],
            producto: ['', Validators.required],
            unidad: ['', Validators.required],
            cantidad: ['', Validators.required],
            stock: [''],
            ordenTrabajo: [''],
            observaciones: [''],
            fecha: [new Date()],
            hora: ['08:00'],
            buscadorAeronave: [''],
            buscadorAutorizado: ['']
        });
    }

    onSubmit(): void {
        if (this.salidaForm.valid) {
            console.log('Form data:', this.salidaForm.value);
            this.closeOrNavigate(this.salidaForm.value);
        } else {
            this.salidaForm.markAllAsTouched();
        }
    }

    onCancel(): void {
        this.closeOrNavigate();
    }

    goBack(): void {
        this.closeOrNavigate();
    }

    private closeOrNavigate(result?: any): void {
        if (this.dialogRef) {
            this.dialogRef.close(result);
        } else {
            this.router.navigate(['/kits']);
        }
    }
}
