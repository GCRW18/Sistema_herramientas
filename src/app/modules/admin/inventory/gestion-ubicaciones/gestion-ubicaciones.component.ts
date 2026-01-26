import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { DragDropModule } from '@angular/cdk/drag-drop';

interface Ubicacion {
    id: number;
    codigo: string;
    nombre: string;
    tipo: string;
    capacidad: number;
    ocupacion: number;
    estado: string;
}

@Component({
    selector: 'app-gestion-ubicaciones',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTableModule,
        DragDropModule
    ],
    templateUrl: './gestion-ubicaciones.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 3px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
        }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 12px !important;
        }

        /* --- OVERRIDES DE ANGULAR MATERIAL (NEO-BRUTALISM) --- */

        /* Contenedor del input */
        :host ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: white !important;
            border: 2px solid black !important;
            border-radius: 8px !important;
            padding: 0 12px !important;
            min-height: 52px;
            box-shadow: 3px 3px 0px 0px rgba(0, 0, 0, 0.1);
            transition: all 0.2s;
            display: flex;
            align-items: center;
        }

        /* Estado Focus */
        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-text-field-wrapper {
            background-color: white !important;
            border-color: black !important;
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);
            transform: translate(-1px, -1px);
        }

        /* Texto dentro del input */
        :host ::ng-deep .mat-mdc-input-element {
            font-weight: 700 !important;
            color: black !important;
        }

        /* Selects */
        :host ::ng-deep .mat-mdc-select-value {
            font-weight: 700 !important;
            color: black !important;
        }
        :host ::ng-deep .mat-mdc-select-arrow {
            color: black !important;
        }

        /* Etiquetas Flotantes */
        :host ::ng-deep .mat-mdc-floating-label {
            font-weight: 800 !important;
            color: #6B7280 !important;
            text-transform: uppercase;
            font-size: 11px !important;
            letter-spacing: 0.5px;
        }

        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-floating-label {
            color: black !important;
        }

        /* Ocultar líneas inferiores default de Material */
        :host ::ng-deep .mat-mdc-form-field-focus-overlay,
        :host ::ng-deep .mat-mdc-notched-outline,
        :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
            display: none !important;
        }
    `]
})
export class GestionUbicacionesComponent implements OnInit {
    private fb = inject(FormBuilder);
    public dialogRef = inject(MatDialogRef<GestionUbicacionesComponent>, { optional: true });

    ubicacionForm!: FormGroup;
    displayedColumns: string[] = ['codigo', 'nombre', 'tipo', 'capacidad', 'ocupacion', 'estado', 'acciones'];

    ubicaciones: Ubicacion[] = [
        { id: 1, codigo: '13-SUELO', nombre: 'Almacén Principal - Suelo', tipo: 'PISO', capacidad: 100, ocupacion: 45, estado: 'ACTIVO' },
        { id: 2, codigo: '14-RACK-A2', nombre: 'Rack A - Nivel 2', tipo: 'RACK', capacidad: 50, ocupacion: 32, estado: 'ACTIVO' },
        { id: 3, codigo: '15-ESTANTE-B1', nombre: 'Estante B - Nivel 1', tipo: 'ESTANTE', capacidad: 30, ocupacion: 28, estado: 'CASI LLENO' }
    ];

    tiposUbicacion = [
        'PISO',
        'RACK',
        'ESTANTE',
        'GABINETE',
        'CAJÓN',
        'CONTENEDOR'
    ];

    ngOnInit(): void {
        this.ubicacionForm = this.fb.group({
            codigo: ['', Validators.required],
            nombre: ['', Validators.required],
            tipo: ['', Validators.required],
            capacidad: ['', [Validators.required, Validators.min(1)]],
            descripcion: ['']
        });
    }

    agregarUbicacion(): void {
        if (this.ubicacionForm.valid) {
            const nuevaUbicacion: Ubicacion = {
                id: this.ubicaciones.length + 1,
                codigo: this.ubicacionForm.value.codigo,
                nombre: this.ubicacionForm.value.nombre,
                tipo: this.ubicacionForm.value.tipo,
                capacidad: this.ubicacionForm.value.capacidad,
                ocupacion: 0,
                estado: 'ACTIVO'
            };

            // Usamos el spread operator para que la tabla detecte el cambio de referencia y se actualice
            this.ubicaciones = [...this.ubicaciones, nuevaUbicacion];
            this.ubicacionForm.reset();
        }
    }

    editarUbicacion(ubicacion: Ubicacion): void {
        console.log('Editar ubicación:', ubicacion);
    }

    eliminarUbicacion(ubicacion: Ubicacion): void {
        this.ubicaciones = this.ubicaciones.filter(u => u.id !== ubicacion.id);
    }

    getOcupacionPorcentaje(ubicacion: Ubicacion): number {
        if (!ubicacion.capacidad || ubicacion.capacidad === 0) return 0;
        return (ubicacion.ocupacion / ubicacion.capacidad) * 100;
    }

    cerrar(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        }
    }
}
