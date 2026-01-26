import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

// Material Modules
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

interface CalibrationItem {
    item: number;
    cantidad: number;
    descripcion: string;
    partNumber: string;
    serialNumber: string;
    codigoBoa: string;
    enviadoDesde: string;
    base: string;
    tipoTrabajo: string;
    imagen?: string;
}

@Component({
    selector: 'app-envio-calibracion',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatSelectModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './envio-calibracion.component.html',
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

        /* --- ESTILOS DE INPUTS (NEO-BRUTALISMO) --- */
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

        /* Ocultar elementos default de Material */
        :host ::ng-deep .mat-mdc-form-field-focus-overlay,
        :host ::ng-deep .mat-mdc-notched-outline,
        :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
            display: none !important;
        }
    `]
})
export class EnvioCalibracionComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<EnvioCalibracionComponent>, { optional: true });

    // Formulario de Confirmación (Paso final)
    calibrationForm!: FormGroup;

    // Formulario de Herramienta Individual (Paso inicial)
    toolForm!: FormGroup;

    // Señal para la imagen seleccionada
    selectedImage = signal<string | null>(null);

    displayedColumns: string[] = [
        'item', 'cantidad', 'descripcion', 'partNumber',
        'serialNumber', 'codigoBoa', 'enviadoDesde', 'base', 'tipoTrabajo', 'accion'
    ];

    dataSource = signal<CalibrationItem[]>([]);

    constructor(
        private fb: FormBuilder,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.initForms();
    }

    private initForms(): void {
        // 1. Formulario de la Herramienta (Carga individual)
        this.toolForm = this.fb.group({
            buscar: [''],
            codigo: ['', Validators.required],
            nombre: ['', Validators.required],
            partNumber: ['', Validators.required],
            serialNumber: ['', Validators.required],
            ubicacion: [''],
            existencia: [0],
            fechaVencimiento: [''],
            estadoFisico: ['SERVICIABLE', Validators.required],
            unidad: ['PZA'],
            enviarDesde: ['ALMACEN SERVICIABLES', Validators.required],
            cantidad: [1, [Validators.required, Validators.min(1)]],
            baseOrigen: ['', Validators.required],
            tipoTrabajo: ['', Validators.required],
            obs: ['']
        });

        // 2. Formulario de Envío (Datos Generales)
        this.calibrationForm = this.fb.group({
            fechaEnvio: [new Date(), Validators.required],
            enviadoPor: ['', Validators.required],
            empresa: ['', Validators.required],
            fechaRetorno: [''],
            recibidoPor: [''],
            observacionGeneral: ['']
        });
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

    buscarHerramienta(): void {
        // Lógica de simulación de búsqueda
        console.log("Buscando...", this.toolForm.get('buscar')?.value);
        this.toolForm.patchValue({
            codigo: 'BOA-H-84425',
            nombre: 'ROCKET LED TOWER (REFLECTOR)',
            partNumber: '2130-20',
            serialNumber: '58-27-0087',
            ubicacion: 'BASE-SRZ',
            existencia: 1
        });
    }

    agregarItem(): void {
        if (this.toolForm.valid) {
            const formVal = this.toolForm.value;

            const newItem: CalibrationItem = {
                item: this.dataSource().length + 1,
                cantidad: formVal.cantidad,
                descripcion: formVal.nombre,
                partNumber: formVal.partNumber,
                serialNumber: formVal.serialNumber,
                codigoBoa: formVal.codigo,
                enviadoDesde: formVal.enviarDesde,
                base: formVal.baseOrigen,
                tipoTrabajo: formVal.tipoTrabajo,
                imagen: this.selectedImage() || undefined
            };

            // Actualizar tabla (Signal)
            this.dataSource.update(items => [...items, newItem]);

            // Resetear formulario parcial y mantener valores por defecto
            this.toolForm.reset({
                estadoFisico: 'SERVICIABLE',
                enviarDesde: 'ALMACEN SERVICIABLES',
                cantidad: 1,
                unidad: 'PZA'
            });
            this.selectedImage.set(null);
        } else {
            this.toolForm.markAllAsTouched();
        }
    }

    eliminarItem(index: number): void {
        this.dataSource.update(items => items.filter((_, i) => i !== index));
    }

    imprimir(): void {
        window.print();
    }

    finalizar(): void {
        if (this.calibrationForm.valid && this.dataSource().length > 0) {
            const dataFinal = {
                cabecera: this.calibrationForm.value,
                items: this.dataSource()
            };

            if (this.dialogRef) {
                this.dialogRef.close(dataFinal);
            } else {
                console.log('Enviando datos:', dataFinal);
                this.router.navigate(['/salidas']);
            }
        } else {
            this.calibrationForm.markAllAsTouched();
            if(this.dataSource().length === 0) alert('Debe agregar al menos una herramienta');
        }
    }

    goBack(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/salidas']);
        }
    }
}
