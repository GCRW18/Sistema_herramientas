import { Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
    selector: 'app-nueva-herramienta',
    standalone: true,
    imports: [
        CommonModule, RouterModule, ReactiveFormsModule, FormsModule,
        MatFormFieldModule, MatInputModule, MatSelectModule,
        MatIconModule, MatButtonModule, MatTableModule, MatDialogModule
    ],
    templateUrl: './nueva-herramienta.component.html',
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

        /* ESTILOS DE INPUTS NEO-BRUTALISTAS */
        :host ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: white !important; /* Por defecto blanco */
            border: 2px solid black !important;
            border-radius: 8px !important;
            padding: 0 12px !important;
            min-height: 48px;
            box-shadow: 3px 3px 0px 0px rgba(0, 0, 0, 0.1);
            transition: all 0.2s;
            display: flex;
            align-items: center;
        }

        /* SOPORTE DARK MODE PARA INPUTS */
        /* Si tu aplicación usa la clase 'dark' en el body, esto aplicará */
        :host-context(.dark) ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: #0f172a !important; /* Slate muy oscuro */
            border-color: #000 !important; /* Borde negro se mantiene para contraste */
        }

        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-text-field-wrapper {
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);
            transform: translate(-1px, -1px);
        }

        /* TEXTO DEL INPUT */
        :host ::ng-deep .mat-mdc-input-element {
            font-weight: 700 !important;
            color: black !important;
        }

        :host-context(.dark) ::ng-deep .mat-mdc-input-element {
            color: white !important;
        }

        /* SELECTS */
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

        /* FLOATING LABELS */
        :host ::ng-deep .mat-mdc-floating-label {
            font-weight: 800 !important;
            color: #6B7280 !important;
            text-transform: uppercase;
            font-size: 11px !important;
            top: 24px !important;
        }
        :host-context(.dark) ::ng-deep .mat-mdc-floating-label {
            color: #9ca3af !important; /* Gray-400 */
        }

        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-floating-label,
        :host ::ng-deep .mat-mdc-form-field.mat-form-field-should-float .mat-mdc-floating-label {
            color: black !important;
            top: 6px !important;
            font-size: 10px !important;
        }
        :host-context(.dark) ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-floating-label,
        :host-context(.dark) ::ng-deep .mat-mdc-form-field.mat-form-field-should-float .mat-mdc-floating-label {
            color: #fbbf24 !important; /* Amber-400 para resaltar en dark */
        }

        /* LIMPIEZA DE MATERIAL STANDARD */
        :host ::ng-deep .mat-mdc-form-field-focus-overlay,
        :host ::ng-deep .mat-mdc-notched-outline,
        :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
            display: none !important;
        }

        :host ::ng-deep .mat-mdc-icon-button {
             color: black !important;
        }
        :host-context(.dark) ::ng-deep .mat-mdc-icon-button {
             color: white !important;
        }
    `]
})
export class NuevaHerramientaComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<NuevaHerramientaComponent>, { optional: true });
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private dialog = inject(MatDialog);
    private iconRegistry = inject(MatIconRegistry);
    private sanitizer = inject(DomSanitizer);

    herramientaForm!: FormGroup;
    dataSource: any[] = [];
    displayedColumns: string[] = ['pn', 'descripcion', 'sn', 'codigoBoa', 'cantidad', 'estado', 'acciones'];

    constructor() {
        // Registro rápido de iconos si no están en el módulo principal,
        // puedes borrar esto si ya tienes un servicio de iconos centralizado.
        this.iconRegistry.addSvgIcon('heroicons_outline:clipboard-document-list', this.sanitizer.bypassSecurityTrustHtml('<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>'));
    }

    ngOnInit(): void {
        this.initForm();
    }

    private initForm(): void {
        this.herramientaForm = this.fb.group({
            tipoDe: ['COMPRA', Validators.required],
            nroCmr: [''],
            fecha: [new Date().toISOString().split('T')[0]],
            pn: [''],
            sn: [''],
            descripcion: [''],
            codigoBoa: [''],
            cantidad: [1],
            estado: ['NUEVO']
        });
    }

    agregarHerramienta(): void {
        const f = this.herramientaForm.value;
        if (!f.pn && !f.descripcion) return;

        this.dataSource = [...this.dataSource, { ...f }];

        // Reset parcial manteniendo algunos datos
        this.herramientaForm.patchValue({
            pn: '',
            sn: '',
            descripcion: '',
            codigoBoa: '',
            cantidad: 1
        });
    }

    eliminarItem(index: number): void {
        this.dataSource.splice(index, 1);
        this.dataSource = [...this.dataSource];
    }

    goBack() {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/entradas']);
        }
    }

    procesar() { console.log('Procesando...'); }
    finalizar() { console.log('Finalizando...'); }

    async openHerramientasAIngresar(): Promise<void> {
        // Implementación futura
        console.log("Abrir modal de búsqueda");
    }
}
