import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

interface HerramientaOption {
    codigo: string;
    nombre: string;
    pn: string;
    sn: string;
    ubicacion: string;
    base: string;
    existencia: number;
    fechaVencimiento: string;
    unidad: string;
    estadoFisico: string;
    contenido: string;
    marca: string;
    imagen?: string;
    descripcion?: string;
}

@Component({
    selector: 'app-herramienta-a-baja',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatInputModule,
        MatFormFieldModule,
        MatSelectModule,
        MatCheckboxModule,
        MatDialogModule,
        FormsModule,
        ReactiveFormsModule,
        DragDropModule
    ],
    templateUrl: './herramienta-a-baja.component.html',
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

        /* --- ESTILOS DE INPUTS (NEO-BRUTALISM + DARK MODE) ESTANDAR --- */

        /* Contenedor del Input */
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

        /* Dark Mode: Input Background */
        :host-context(.dark) ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: #0f172a !important; /* Slate oscuro */
            border-color: #000 !important; /* Borde negro se mantiene */
        }

        /* Estado Focus */
        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-text-field-wrapper {
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);
            transform: translate(-1px, -1px);
        }
        :host-context(.dark) ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-text-field-wrapper {
            box-shadow: 3px 3px 0px 0px rgba(255,255,255,0.5); /* Sombra clara en dark */
            border-color: white !important;
        }

        /* Texto del Input */
        :host ::ng-deep .mat-mdc-input-element {
            font-weight: 700 !important;
            color: black !important;
        }
        :host-context(.dark) ::ng-deep .mat-mdc-input-element {
            color: white !important;
        }

        /* Labels */
        :host ::ng-deep .mat-mdc-floating-label {
            font-weight: 800 !important;
            color: #6B7280 !important;
            text-transform: uppercase;
            font-size: 11px !important;
        }
        :host-context(.dark) ::ng-deep .mat-mdc-floating-label {
            color: #9ca3af !important;
        }

        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-floating-label {
            color: black !important;
        }
        :host-context(.dark) ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-floating-label {
            color: #fca5a5 !important;
        }

        /* Iconos */
        :host ::ng-deep .mat-mdc-icon-button {
            color: black !important;
        }
        :host-context(.dark) ::ng-deep .mat-mdc-icon-button {
            color: white !important;
        }

        /* Selects */
        :host ::ng-deep .mat-mdc-select-value {
            font-weight: 700 !important;
            color: black !important;
        }
        :host-context(.dark) ::ng-deep .mat-mdc-select-value {
            color: white !important;
        }
        :host ::ng-deep .mat-mdc-select-arrow {
            color: black !important;
        }
        :host-context(.dark) ::ng-deep .mat-mdc-select-arrow {
            color: white !important;
        }

        /* Checkbox Override */
        :host ::ng-deep .mdc-checkbox .mdc-checkbox__native-control:enabled:checked~.mdc-checkbox__background,
        :host ::ng-deep .mdc-checkbox .mdc-checkbox__native-control:enabled:indeterminate~.mdc-checkbox__background {
            background-color: #111A43 !important;
            border-color: #111A43 !important;
        }
        :host-context(.dark) ::ng-deep .mdc-checkbox .mdc-checkbox__native-control:enabled:checked~.mdc-checkbox__background {
            background-color: #3b82f6 !important;
            border-color: #3b82f6 !important;
        }

        /* Cleanups Material */
        :host ::ng-deep .mat-mdc-form-field-focus-overlay,
        :host ::ng-deep .mat-mdc-notched-outline,
        :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
            display: none !important;
        }

        :host ::ng-deep textarea.mat-mdc-input-element {
            margin-top: 8px !important;
        }
        :host ::ng-deep .textarea-field .mat-mdc-text-field-wrapper {
            align-items: flex-start;
            padding-top: 8px !important;
            min-height: 100px;
        }
    `]
})
export class HerramientaABajaComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<HerramientaABajaComponent>, { optional: true });
    public data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);

    bajaForm!: FormGroup;
    selectedImage = signal<string | null>(null);
    coincidencias = signal<number>(0);
    herramientaNoEnSistema = signal(false);
    descripcionHerramienta = signal<string>('');

    herramientas: HerramientaOption[] = [
        {
            codigo: 'BOA-H-80001',
            nombre: 'COMPRESSOR DE ALTA',
            pn: 'CP-2002',
            sn: 'SN-001A',
            ubicacion: '10-A',
            base: 'CBB',
            existencia: 3,
            fechaVencimiento: '2025-12-31',
            unidad: 'PZA',
            estadoFisico: 'BUENO',
            contenido: 'COMPRESOR',
            marca: 'ATLAS COPCO',
            descripcion: 'Compresor de alta presión para uso aeronáutico, capacidad 20 BAR'
        },
        {
            codigo: 'BOA-H-80002',
            nombre: 'BOMBA HIDRAULICA',
            pn: 'BH-3003',
            sn: 'SN-002B',
            ubicacion: '11-B',
            base: 'LPB',
            existencia: 2,
            fechaVencimiento: '2025-08-15',
            unidad: 'EA',
            estadoFisico: 'REGULAR',
            contenido: 'BOMBA',
            marca: 'PARKER',
            descripcion: 'Bomba hidráulica de presión, flujo 5 GPM'
        },
        {
            codigo: 'BOA-H-80003',
            nombre: 'GATO NEUMATICO 20T',
            pn: 'GN-4004',
            sn: 'SN-003C',
            ubicacion: '12-C',
            base: 'SRZ',
            existencia: 5,
            fechaVencimiento: '2026-03-20',
            unidad: 'PZA',
            estadoFisico: 'BUENO',
            contenido: 'GATO',
            marca: 'HEIN-WERNER',
            descripcion: 'Gato neumático industrial de 20 toneladas de capacidad'
        },
    ];

    filteredHerramientas: HerramientaOption[] = [];
    bases = ['CBB', 'LPB', 'SRE', 'TJA', 'SRZ', 'CIJ', 'TDD', 'GYA', 'RIB', 'BYC'];

    ngOnInit(): void {
        this.bajaForm = this.fb.group({
            buscar: [''],
            codigo: [''],
            nombre: [''],
            pn: [''],
            sn: [''],
            ubicacion: [''],
            base: [''],
            existencia: [''],
            fechaVencimiento: [''],
            unidad: [''],
            estadoFisico: [''],
            cantidad: [1],
            observacion: [''],
            contenido: [''],
            marca: ['']
        });

        this.filteredHerramientas = [...this.herramientas];
    }

    selectHerramienta(herramienta: HerramientaOption): void {
        this.bajaForm.patchValue({
            codigo: herramienta.codigo,
            nombre: herramienta.nombre,
            pn: herramienta.pn,
            sn: herramienta.sn,
            ubicacion: herramienta.ubicacion,
            base: herramienta.base,
            existencia: herramienta.existencia,
            fechaVencimiento: herramienta.fechaVencimiento,
            unidad: herramienta.unidad,
            estadoFisico: herramienta.estadoFisico,
            contenido: herramienta.contenido,
            marca: herramienta.marca
        });
        this.coincidencias.set(1);
        this.selectedImage.set(herramienta.imagen || null);
        this.descripcionHerramienta.set(herramienta.descripcion || '');
    }

    toggleHerramientaNoEnSistema(): void {
        this.herramientaNoEnSistema.update(v => !v);
        if (this.herramientaNoEnSistema()) {
            this.bajaForm.reset();
            this.bajaForm.patchValue({ cantidad: 1 });
            this.selectedImage.set(null);
            this.descripcionHerramienta.set('');
            this.coincidencias.set(0);
        }
    }

    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                this.selectedImage.set(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    }

    agregar(): void {
        const data = this.bajaForm.value;
        this.dialogRef?.close({ action: 'agregar', data });
    }

    cerrar(): void {
        this.dialogRef?.close();
    }
}
