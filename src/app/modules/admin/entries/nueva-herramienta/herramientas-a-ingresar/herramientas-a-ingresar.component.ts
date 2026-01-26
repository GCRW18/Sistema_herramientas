import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

interface HerramientaOption {
    codigo: string;
    pn: string;
    nombre: string;
    sn: string;
    estado: string;
    ubicacion: string;
    um: string;
}

@Component({
    selector: 'app-herramientas-a-ingresar',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatInputModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDialogModule,
        FormsModule,
        ReactiveFormsModule,
        DragDropModule
    ],
    templateUrl: './herramientas-a-ingresar.component.html',
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

        /* ESTILOS DE INPUTS */
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

        :host ::ng-deep .mat-mdc-select-value {
            font-weight: 700 !important;
            color: black !important;
        }

        :host ::ng-deep .mat-mdc-select-arrow {
            color: black !important;
        }

        :host ::ng-deep textarea.mat-mdc-input-element {
            margin-top: 8px !important;
        }

        :host ::ng-deep .textarea-field .mat-mdc-text-field-wrapper {
            align-items: flex-start;
            padding-top: 8px !important;
            min-height: 80px;
        }
    `]
})
export class HerramientasAIngresarComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<HerramientasAIngresarComponent>, { optional: true });
    public data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);

    ingresoForm!: FormGroup;
    selectedImage = signal<string | null>(null);
    coincidencias = signal<number>(0);

    // Mock data for autocomplete
    herramientas: HerramientaOption[] = [
        { codigo: 'BOA-H-83272', pn: 'BU-2581-AQ BU-2581-KB', nombre: 'REGULADOR DE NITROGENO', sn: 'NONE', estado: 'SERVICEABLE', ubicacion: 'BASE-LPB', um: 'EA' },
        { codigo: 'BOA-H-83273', pn: 'BU-2582-AQ', nombre: 'MANOMETRO DIGITAL', sn: '12345', estado: 'SERVICEABLE', ubicacion: 'BASE-CBB', um: 'EA' },
        { codigo: 'BOA-H-83274', pn: 'BU-2583-KB', nombre: 'LLAVE TORQUE 50-250', sn: '67890', estado: 'EN CALIBRACION', ubicacion: 'BASE-SCZ', um: 'PZA' },
    ];

    filteredHerramientas: HerramientaOption[] = [];

    ngOnInit(): void {
        this.ingresoForm = this.fb.group({
            buscar: [''],
            codigo: [''],
            pn: [''],
            nombre: [''],
            sn: [''],
            estado: [''],
            ubicacion: [''],
            um: [''],
            cantidad: [1],
            documento: [''],
            observaciones: ['']
        });

        this.filteredHerramientas = [...this.herramientas];
    }

    onBuscarChange(value: string): void {
        if (!value) {
            this.filteredHerramientas = [...this.herramientas];
            this.coincidencias.set(0);
            return;
        }

        const searchTerm = value.toLowerCase();
        this.filteredHerramientas = this.herramientas.filter(h =>
            h.codigo.toLowerCase().includes(searchTerm) ||
            h.pn.toLowerCase().includes(searchTerm) ||
            h.nombre.toLowerCase().includes(searchTerm)
        );
        this.coincidencias.set(this.filteredHerramientas.length);
    }

    selectHerramienta(herramienta: HerramientaOption): void {
        this.ingresoForm.patchValue({
            codigo: herramienta.codigo,
            pn: herramienta.pn,
            nombre: herramienta.nombre,
            sn: herramienta.sn,
            estado: herramienta.estado,
            ubicacion: herramienta.ubicacion,
            um: herramienta.um
        });
        this.coincidencias.set(1);
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

    crearItem(): void {
        console.log('Crear nuevo item');
    }

    procesar(): void {
        if (this.ingresoForm.valid) {
            const data = this.ingresoForm.value;
            console.log('Procesar ingreso:', data);
            this.dialogRef?.close({ action: 'procesar', data });
        }
    }

    cerrar(): void {
        this.dialogRef?.close();
    }
}
