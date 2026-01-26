import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

interface DevolucionItem {
    fila: number;
    codigo: string;
    descripcion: string;
    fecha: string;
    cantidad: number;
    nroNotaSalida: string;
    estado: string;
    observaciones: string;
}

@Component({
    selector: 'app-devolucion-herramienta',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatInputModule,
        MatFormFieldModule,
        MatDialogModule,
        FormsModule,
        DragDropModule
    ],
    templateUrl: './devolucion-herramienta.component.html',
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

        :host ::ng-deep .textarea-field .mat-mdc-text-field-wrapper {
            height: 100% !important;
            min-height: 140px;
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
export class DevolucionHerramientaComponent {
    public dialogRef = inject(MatDialogRef<DevolucionHerramientaComponent>, { optional: true });

    nroLicenciaNombre: string = '';
    nroLicencia: string = '';
    tipoDe: string = '';
    codigoHerramienta: string = '';
    apPaterno: string = '';
    apMaterno: string = '';
    nombres: string = '';

    displayedColumns: string[] = [
        'fila', 'codigo', 'descripcion', 'fecha', 'cantidad', 'nroNotaSalida', 'estado', 'observaciones'
    ];

    dataSource: DevolucionItem[] = [];

    constructor(private router: Router) {}

    goBack(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/entradas']);
        }
    }

    realizarConsulta(): void {
        console.log('Consultando...');
        // Simulamos datos para visualizar la tabla
        this.dataSource = [
            { fila: 1, codigo: 'H-901', descripcion: 'Llave de Impacto', fecha: '2024-02-15', cantidad: 1, nroNotaSalida: 'NS-550', estado: 'PENDIENTE', observaciones: '-' }
        ];
    }

    procesar(): void {
        console.log('Procesar devolución');
    }

    finalizar(): void {
        console.log('Finalizar devolución');
        this.router.navigate(['/entradas']);
    }
}
