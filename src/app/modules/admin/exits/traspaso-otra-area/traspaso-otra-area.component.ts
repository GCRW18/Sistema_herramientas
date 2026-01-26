import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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

interface TransferItem {
    codigo: string;
    partNumber: string;
    serialNumber: string;
    unidad: string;
    cantidad: number;
    descripcion: string;
    contenido: string;
    marca: string;
    fecha: string;
}

@Component({
    selector: 'app-traspaso-otra-area',
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
    templateUrl: './traspaso-otra-area.component.html',
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

        /* Ajuste Textarea */
        :host ::ng-deep textarea.mat-mdc-input-element {
            margin-top: 10px !important;
            min-height: 60px;
        }
    `]
})
export class TraspasoOtraAreaComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<TraspasoOtraAreaComponent>, { optional: true });
    private dialog = inject(MatDialog);
    transferForm!: FormGroup;

    displayedColumns: string[] = [
        'codigo', 'partNumber', 'serialNumber', 'unidad',
        'cantidad', 'descripcion', 'contenido', 'marca', 'fecha'
    ];

    // Mock Data
    dataSource = signal<TransferItem[]>([
        {
            codigo: 'TRS-001',
            partNumber: 'PN-1234',
            serialNumber: 'SN-5678',
            unidad: 'PZA',
            cantidad: 5,
            descripcion: 'JUEGO DE LLAVES',
            contenido: 'LLAVES MIXTAS 8-24MM',
            marca: 'STANLEY',
            fecha: '2025-01-22'
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
        this.transferForm = this.fb.group({
            buscar: [''],
            nombres: ['', Validators.required],
            fecha: [new Date(), Validators.required],
            apMaterno: ['', Validators.required],
            nroLicencia: ['', Validators.required],
            cargo: ['', Validators.required],
            hora: ['08:00', Validators.required],
            apPaterno: ['', Validators.required],
            gerencia: ['', Validators.required],
            unidad: ['', Validators.required],
            base: ['', Validators.required],
            departamento: ['', Validators.required],
            tipoTraspaso: ['', Validators.required],
            observaciones: ['']
        });
    }

    buscarPersona(): void {
        const buscar = this.transferForm.get('buscar')?.value;
        console.log('Buscando:', buscar);
    }

    imprimir(): void {
        window.print();
    }

    finalizar(): void {
        if (this.transferForm.valid) {
            console.log('Finalizando Traspaso:', this.transferForm.value);
            if (this.dialogRef) {
                this.dialogRef.close({ form: this.transferForm.value, items: this.dataSource() });
            } else {
                this.router.navigate(['/salidas']);
            }
        } else {
            this.transferForm.markAllAsTouched();
        }
    }

    goBack(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/salidas']);
        }
    }

    async openTraspasoHerramienta(): Promise<void> {
        const { TraspasoHerramientaComponent } = await import('./traspaso-herramienta/traspaso-herramienta.component');
        const dialogRef = this.dialog.open(TraspasoHerramientaComponent, {
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
                console.log('Herramienta agregada para traspaso:', result.data);
                const currentItems = this.dataSource();
                const newItem: TransferItem = {
                    codigo: result.data.codigo || '',
                    partNumber: result.data.pn || '',
                    serialNumber: result.data.sn || '',
                    unidad: result.data.unidad || '',
                    cantidad: result.data.cantidad || 1,
                    descripcion: result.data.nombre || '',
                    contenido: '',
                    marca: result.data.marca || '',
                    fecha: new Date().toISOString().split('T')[0]
                };
                this.dataSource.set([...currentItems, newItem]);
            }
        });
    }
}
