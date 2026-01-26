import { Component, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-gestionar-kit',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        DragDropModule,
        MatButtonModule,
        MatDialogModule
    ],
    encapsulation: ViewEncapsulation.None,
    templateUrl: './gestionar-kit.component.html',
    styles: [`
        /* Variables y Reset */
        app-gestionar-kit {
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        /* --- CLASES UTILITARIAS NEO --- */
        .neo-card-base {
            border: 3px solid black !important;
            box-shadow: 4px 4px 0px 0px rgba(0,0,0,1) !important;
            border-radius: 12px !important;
            transition: all 0.2s ease;
        }

        .neo-input-label {
            font-weight: 900;
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.05em;
            margin-bottom: 0.25rem;
            display: block;
        }

        /* --- MATERIAL OVERRIDES (INPUTS) --- */

        /* 1. CONTENEDOR DEL INPUT (Caja) */
        :host ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: white !important; /* LIGHT MODE: Fondo Blanco */
            border: 2px solid black !important;
            border-radius: 8px !important;
            padding: 0 12px !important;
            height: 48px;
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,0.1);
            transition: all 0.2s;
        }

        /* DARK MODE: Fondo Oscuro para que se lea el texto blanco */
        :host-context(.dark) ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: #1e293b !important; /* Slate-800 */
            border-color: rgba(255,255,255,0.5) !important; /* Borde gris claro */
            box-shadow: none !important;
        }

        /* 2. TEXTO DENTRO DEL INPUT */
        :host ::ng-deep .mat-mdc-input-element {
            font-weight: 700 !important;
            color: black !important; /* LIGHT MODE: Texto Negro */
        }

        /* DARK MODE: Texto Blanco */
        :host-context(.dark) ::ng-deep .mat-mdc-input-element {
            color: white !important;
            caret-color: #FFE500 !important; /* Cursor Amarillo */
        }

        /* Placeholder en Dark Mode */
        :host-context(.dark) ::ng-deep .mat-mdc-input-element::placeholder {
            color: rgba(255, 255, 255, 0.4) !important;
        }

        /* 3. FOCUS STATES */
        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-text-field-wrapper {
            background-color: white !important;
            border-color: black !important;
            box-shadow: 3px 3px 0px 0px #FFE500 !important;
            transform: translate(-1px, -1px);
        }

        /* DARK MODE FOCUS: Mantener fondo oscuro, borde brillante */
        :host-context(.dark) ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-text-field-wrapper {
            background-color: #0f172a !important; /* Slate-900 (Más oscuro al focus) */
            border-color: #FFE500 !important; /* Borde amarillo */
            box-shadow: 0px 0px 10px rgba(255, 229, 0, 0.2) !important;
        }

        /* --- TABLE INPUTS (Más compactos) --- */
        .table-input .mat-mdc-text-field-wrapper {
            height: 40px !important;
            min-height: 40px !important;
            padding: 0 8px !important;
            box-shadow: none !important;
        }

        /* Limpieza de Material */
        .mat-mdc-form-field-subscript-wrapper,
        .mat-mdc-form-field-focus-overlay,
        .mat-mdc-notched-outline {
            display: none !important;
        }
    `]
})
export class GestionarKitComponent {
    kitForm: FormGroup;
    private fb = inject(FormBuilder);
    public dialogRef = inject(MatDialogRef<GestionarKitComponent>);

    constructor() {
        this.kitForm = this.fb.group({
            nombreKit: ['', Validators.required],
            descripcionKit: [''],
            ubicacion: [''],
            items: this.fb.array([])
        });
    }

    get items() { return this.kitForm.get('items') as FormArray; }

    createItem(): FormGroup {
        return this.fb.group({
            descripcion: ['', Validators.required],
            codigo: ['', Validators.required],
            ubicacion: ['']
        });
    }

    agregarItem() { this.items.push(this.createItem()); }
    eliminarItem(i: number) { this.items.removeAt(i); }
    cerrar() { this.dialogRef.close(); }
    onSubmit() { if (this.kitForm.valid) this.dialogRef.close(this.kitForm.value); }
}
