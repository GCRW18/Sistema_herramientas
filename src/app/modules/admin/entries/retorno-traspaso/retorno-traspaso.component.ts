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

interface TraspasoReturn {
    filaObs: number;
    cantidad: number;
    descripcion: string;
    modeloPn: string;
    serialNumber: string;
    codigoBoa: string;
    fechaEnvio: string;
    base: string;
    coMat: string;
}

@Component({
    selector: 'app-retorno-traspaso',
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
    templateUrl: './retorno-traspaso.component.html',
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
export class RetornoTraspasoComponent {
    public dialogRef = inject(MatDialogRef<RetornoTraspasoComponent>, { optional: true });

    searchText: string = '';

    displayedColumns: string[] = [
        'filaObs', 'cantidad', 'descripcion', 'modeloPn', 'serialNumber',
        'codigoBoa', 'fechaEnvio', 'base', 'coMat'
    ];

    dataSource: TraspasoReturn[] = [];

    constructor(private router: Router) {}

    goBack(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/entradas']);
        }
    }

    consultar(): void {
        console.log('Realizar consulta con:', this.searchText);
        // Simulación de datos
        this.dataSource = [
            { filaObs: 1, cantidad: 5, descripcion: 'Llave Inglesa', modeloPn: 'LI-10', serialNumber: 'SN-55', codigoBoa: 'BOA-88', fechaEnvio: '2024-05-10', base: 'VVI', coMat: 'CM-100' }
        ];
    }

    procesar(): void {
        console.log('Procesar');
    }
}
