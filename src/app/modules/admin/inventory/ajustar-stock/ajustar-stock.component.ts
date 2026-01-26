import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DragDropModule } from '@angular/cdk/drag-drop';

@Component({
    selector: 'app-ajustar-stock',
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
        DragDropModule
    ],
    templateUrl: './ajustar-stock.component.html',
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
            min-height: 52px; /* Un poco más alto para mejor click */
            box-shadow: 3px 3px 0px 0px rgba(0, 0, 0, 0.1);
            transition: all 0.2s;
            display: flex;
            align-items: center;
        }

        /* Area de texto (Textarea) */
        :host ::ng-deep .textarea-field .mat-mdc-text-field-wrapper {
            height: auto !important;
            min-height: 100px;
            align-items: flex-start;
            padding-top: 12px !important;
        }

        :host ::ng-deep textarea.mat-mdc-input-element {
            margin-top: 0 !important;
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

        /* Iconos sufijos */
        :host ::ng-deep .mat-mdc-icon-button {
            color: black !important;
        }

        /* Ocultar líneas inferiores default de Material */
        :host ::ng-deep .mat-mdc-form-field-focus-overlay,
        :host ::ng-deep .mat-mdc-notched-outline,
        :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
            display: none !important; /* Oculta espacio de error para layout compacto */
        }
    `]
})
export class AjustarStockComponent implements OnInit {
    private fb = inject(FormBuilder);
    public dialogRef = inject(MatDialogRef<AjustarStockComponent>, { optional: true });

    ajusteForm!: FormGroup;

    tiposAjuste = [
        { value: 'AUMENTO', label: 'Aumento (+)' },
        { value: 'REDUCCION', label: 'Reducción (-)' },
        { value: 'CORRECCION', label: 'Corrección (=)' },
        { value: 'MERMA', label: 'Merma / Daño (-)' }
    ];

    motivos = [
        'Compra nueva',
        'Donación',
        'Transferencia interna',
        'Devolución a almacén',
        'Daño o deterioro',
        'Extravío',
        'Conteo físico (Auditoría)',
        'Error de registro previo',
        'Otro'
    ];

    ngOnInit(): void {
        this.ajusteForm = this.fb.group({
            codigo: ['', Validators.required],
            descripcion: [''],
            tipoAjuste: ['', Validators.required],
            cantidadActual: [{ value: '', disabled: true }],
            cantidadAjuste: ['', [Validators.required, Validators.min(1)]],
            cantidadFinal: [{ value: '', disabled: true }],
            motivo: ['', Validators.required],
            observaciones: ['']
        });

        // Simulación: Al escribir código específico
        this.ajusteForm.get('codigo')?.valueChanges.subscribe(codigo => {
            // Aquí conectarías con tu Backend real
            if (codigo === 'BOA-H-123') {
                this.ajusteForm.patchValue({
                    descripcion: 'LLAVE TORQUE 12MM',
                    cantidadActual: 15
                });
                this.calcularCantidadFinal();
            }
        });

        this.ajusteForm.get('cantidadAjuste')?.valueChanges.subscribe(() => this.calcularCantidadFinal());
        this.ajusteForm.get('tipoAjuste')?.valueChanges.subscribe(() => this.calcularCantidadFinal());
    }

    calcularCantidadFinal(): void {
        const actual = this.ajusteForm.get('cantidadActual')?.value || 0;
        const ajuste = this.ajusteForm.get('cantidadAjuste')?.value || 0;
        const tipo = this.ajusteForm.get('tipoAjuste')?.value;

        let final = actual;

        if (tipo === 'AUMENTO') {
            final = actual + ajuste;
        } else if (tipo === 'REDUCCION' || tipo === 'MERMA') {
            final = actual - ajuste;
        } else if (tipo === 'CORRECCION') {
            final = ajuste;
        }

        // Evitar negativos visuales
        if (final < 0) final = 0;

        this.ajusteForm.patchValue({ cantidadFinal: final }, { emitEvent: false });
    }

    buscarHerramienta(): void {
        const codigo = this.ajusteForm.get('codigo')?.value;
        console.log('Buscar herramienta:', codigo);
    }

    guardar(): void {
        if (this.ajusteForm.valid) {
            console.log('Ajuste guardado:', this.ajusteForm.getRawValue());
            this.cerrar();
        }
    }

    cerrar(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        }
    }
}
