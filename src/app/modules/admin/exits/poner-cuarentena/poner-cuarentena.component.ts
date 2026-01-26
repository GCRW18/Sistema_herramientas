import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

// Material Imports
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

type ViewMode = 'quarantine' | 'calibration';

@Component({
    selector: 'app-poner-cuarentena',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatSelectModule,
        MatCheckboxModule,
        MatCardModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './poner-cuarentena.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
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

        :host ::ng-deep .textarea-field .mat-mdc-text-field-wrapper {
            height: 100% !important;
            min-height: 100px;
            align-items: flex-start;
            padding-top: 12px !important;
        }

        :host ::ng-deep textarea.mat-mdc-input-element {
            margin-top: 0px !important;
            height: 100% !important;
        }

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

        :host ::ng-deep .mat-mdc-form-field-focus-overlay,
        :host ::ng-deep .mat-mdc-notched-outline,
        :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
            display: none !important;
        }
    `]
})
export class PonerCuarentenaComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<PonerCuarentenaComponent>, { optional: true });

    currentView = signal<ViewMode>('quarantine');
    quarantineForm!: FormGroup;
    calibrationForm!: FormGroup;
    selectedImage = signal<string | null>(null);

    constructor(
        private fb: FormBuilder,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.initQuarantineForm();
        this.initCalibrationForm();
    }

    private initQuarantineForm(): void {
        this.quarantineForm = this.fb.group({
            codigo: ['', Validators.required],
            nombre: ['', Validators.required],
            partNumber: ['', Validators.required],
            serialNumber: ['', Validators.required],
            ubicacion: ['', Validators.required],
            existencia: ['', Validators.required],
            unidad: ['', Validators.required],
            base: ['', Validators.required],
            fechaVencimiento: [''],
            estadoFisico: ['', Validators.required],
            listaContenido: [''],
            nroReporteDiscrepancia: ['', Validators.required],
            cantidad: [1, [Validators.required, Validators.min(1)]],
            fecha: [new Date(), Validators.required],
            descripcion: ['', Validators.required],
            buscar: [''],
            nroLicencia: [''],
            nombreReportado: [''],
            nombreApellido: [''],
            realizadoPor: ['Admin Sistema']
        });
    }

    private initCalibrationForm(): void {
        this.calibrationForm = this.fb.group({
            tipoTrabajo: ['CALIBRACION', Validators.required],
            nroCertificado: ['', Validators.required],
            fechaCalibracion: [new Date(), Validators.required],
            fechaVencimiento: ['', Validators.required],
            observacion: [''],
            recibidoPor: ['', Validators.required],
            fechaRecpcion: [new Date(), Validators.required],

            // Reparación / Baja
            casoReparacion: [''],
            sePudoReparar: [''],
            nroInformeTecnico: [''],
            descripcionBaja: ['']
        });
    }

    switchView(view: ViewMode): void {
        this.currentView.set(view);
    }

    buscarPersona(): void {
        const termino = this.quarantineForm.get('buscar')?.value;
        if(termino) {
            this.quarantineForm.patchValue({
                nroLicencia: 'LIC-7788',
                nombreReportado: 'MARIO GOMEZ',
                nombreApellido: 'MARIO GOMEZ PEREZ'
            });
        }
    }

    onImageSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.selectedImage.set(e.target?.result as string);
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    agregar(): void {
        if (this.quarantineForm.valid) {
            const finalData = {
                quarantine: this.quarantineForm.value,
                calibration: this.calibrationForm.value
            };

            if (this.dialogRef) {
                this.dialogRef.close(finalData);
            } else {
                this.router.navigate(['/salidas']);
            }
        } else {
            this.quarantineForm.markAllAsTouched();
        }
    }

    cerrar(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/salidas']);
        }
    }

    goBack(): void {
        this.cerrar();
    }
}
