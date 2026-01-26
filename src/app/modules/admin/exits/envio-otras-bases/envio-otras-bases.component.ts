import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

interface ExitItem {
    item: number;
    descripcion: string;
    partNumber: string;
    serialNumber1: string;
    serialNumber2: string;
    codigoBoa: string;
}

@Component({
    selector: 'app-envio-otras-bases',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
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
    templateUrl: './envio-otras-bases.component.html',
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

        /* --- ESTILOS DE INPUTS (OVERRIDE MATERIAL) --- */
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

        /* Ocultar elementos default de Material para limpiar el diseño */
        :host ::ng-deep .mat-mdc-form-field-focus-overlay,
        :host ::ng-deep .mat-mdc-notched-outline,
        :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
            display: none !important;
        }
    `]
})
export class EnvioOtrasBasesComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<EnvioOtrasBasesComponent>, { optional: true });
    private dialog = inject(MatDialog);
    exitForm!: FormGroup;

    displayedColumns: string[] = [
        'item', 'descripcion', 'partNumber',
        'serialNumber1', 'serialNumber2', 'codigoBoa'
    ];

    // Mock Data
    dataSource = signal<ExitItem[]>([
        {
            item: 1,
            descripcion: 'COMPRESSOR DE ALTA',
            partNumber: 'CP-2002',
            serialNumber1: 'SN-001A',
            serialNumber2: 'SN-001B',
            codigoBoa: 'BOA-LOG-01'
        }
    ]);

    constructor(
        private fb: FormBuilder,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.initForm();
    }

    private initForm(): void {
        this.exitForm = this.fb.group({
            entregueConforme: ['MM-CBB', Validators.required],
            recibiConforme: ['CARGA-BOA', Validators.required],
            nroCoMat1: ['', Validators.required],
            nroCoMat2: ['', Validators.required],
            nroCoMat3: ['', Validators.required],
            fecha: [new Date(), Validators.required],
            hora: ['14:30', Validators.required],
            destino: ['', Validators.required],
            nroVuelo: ['', Validators.required],
            observaciones: [''],
            tipoDe: ['']
        });
    }

    procesar(): void {
        console.log('Procesando herramienta...');
    }

    finalizar(): void {
        if (this.exitForm.valid) {
            console.log('Finalizando Envío:', this.exitForm.value);
            if (this.dialogRef) {
                this.dialogRef.close({ form: this.exitForm.value, items: this.dataSource() });
            } else {
                this.router.navigate(['/salidas']);
            }
        } else {
            this.exitForm.markAllAsTouched();
        }
    }

    goBack(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/salidas']);
        }
    }

    async openHerramientaAEnviar(): Promise<void> {
        const { HerramientaAEnviarComponent } = await import('./herramienta-a-enviar/herramienta-a-enviar.component');
        const dialogRef = this.dialog.open(HerramientaAEnviarComponent, {
            width: '1100px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                console.log('Herramienta agregada para envío:', result.data);
                const currentItems = this.dataSource();
                const newItem: ExitItem = {
                    item: currentItems.length + 1,
                    descripcion: result.data.nombre || '',
                    partNumber: result.data.pn || '',
                    serialNumber1: result.data.sn || '',
                    serialNumber2: '',
                    codigoBoa: result.data.codigo || ''
                };
                this.dataSource.set([...currentItems, newItem]);
            }
        });
    }
}
