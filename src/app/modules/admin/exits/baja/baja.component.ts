import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { DomSanitizer } from '@angular/platform-browser';
import { MatTooltipModule } from '@angular/material/tooltip';

interface BajaItem {
    codigo: string;
    pn: string;
    sn: string;
    nombre: string;
    cantidad: number;
    contenido: string;
    base: string;
    marca: string;
}

@Component({
    selector: 'app-baja',
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
        DragDropModule,
        MatTooltipModule
    ],
    templateUrl: './baja.component.html',
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

        :host-context(.dark) ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: #0f172a !important;
            border-color: #000 !important;
        }

        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-text-field-wrapper {
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);
            transform: translate(-1px, -1px);
        }
        :host-context(.dark) ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-text-field-wrapper {
            box-shadow: 3px 3px 0px 0px rgba(255,255,255,0.5);
            border-color: white !important;
        }

        :host ::ng-deep .mat-mdc-input-element {
            font-weight: 700 !important;
            color: black !important;
        }
        :host-context(.dark) ::ng-deep .mat-mdc-input-element {
            color: white !important;
        }

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

        :host ::ng-deep .mat-mdc-icon-button {
            color: black !important;
        }
        :host-context(.dark) ::ng-deep .mat-mdc-icon-button {
            color: white !important;
        }

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
export class BajaComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<BajaComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private iconRegistry = inject(MatIconRegistry);
    private sanitizer = inject(DomSanitizer);

    bajaForm!: FormGroup;

    dataSource = signal<BajaItem[]>([]);

    usuarios = [
        { value: 'SISTEMASBOA', nombre: 'DEPARTAMENTO SISTEMAS BOLIVIA', cargo: 'DPTO. SISTEMAS' },
        { value: 'ALMACEN', nombre: 'ALMACEN CENTRAL BOA', cargo: 'ALMACEN' },
        { value: 'MANTENIMIENTO', nombre: 'MANTENIMIENTO AERONAVES', cargo: 'MTO. LINEA' }
    ];

    unidades = ['CBB', 'LPB', 'SRE', 'TJA', 'SRZ', 'CIJ', 'TDD', 'GYA', 'RIB', 'BYC'];

    estados = [
        { value: 'PENDIENTE', label: 'PENDIENTE' },
        { value: 'EN_PROCESO', label: 'EN PROCESO' },
        { value: 'APROBADO', label: 'APROBADO' },
        { value: 'RECHAZADO', label: 'RECHAZADO' }
    ];

    nroNota = signal('BJA-3/2026');

    constructor(
        private fb: FormBuilder,
        private router: Router
    ) {
        this.iconRegistry.addSvgIcon('heroicons_outline:clipboard-document-list', this.sanitizer.bypassSecurityTrustHtml('<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>'));
    }

    ngOnInit(): void {
        this.initForm();
        this.generateNroNota();
    }

    private initForm(): void {
        const now = new Date();
        this.bajaForm = this.fb.group({
            procesadoPor: ['SISTEMASBOA', Validators.required],
            nombre: [{ value: 'DEPARTAMENTO SISTEMAS BOLIVIA', disabled: true }],
            cargo: [{ value: 'DPTO. SISTEMAS', disabled: true }],
            fecha: [now, Validators.required],
            hora: [this.formatTime(now), Validators.required],
            verificadoPor: [''],
            estado: ['PENDIENTE'],
            inspector: [''],
            unidad: [''],
            autorizadoPor: [''],
            observaciones: ['']
        });

        this.bajaForm.get('procesadoPor')?.valueChanges.subscribe(value => {
            const usuario = this.usuarios.find(u => u.value === value);
            if (usuario) {
                this.bajaForm.patchValue({
                    nombre: usuario.nombre,
                    cargo: usuario.cargo
                }, { emitEvent: false });
            }
        });
    }

    private formatTime(date: Date): string {
        const h = date.getHours().toString().padStart(2, '0');
        const m = date.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
    }

    private generateNroNota(): void {
        const year = new Date().getFullYear();
        const num = Math.floor(Math.random() * 100) + 1;
        this.nroNota.set(`BJA-${num}/${year}`);
    }

    // LÓGICA DE APERTURA DE MODAL RESTAURADA
    async openHerramientaABaja(): Promise<void> {
        // Importación dinámica del componente modal
        const { HerramientaABajaComponent } = await import('./herramienta-a-baja/herramienta-a-baja.component');

        // Apertura del dialogo
        const dialogRef = this.dialog.open(HerramientaABajaComponent, {
            width: '1100px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog', // Asegúrate de tener estilos para esto si lo usas
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });

        // Suscripción al resultado al cerrar
        dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'agregar' && result.data) {
                console.log('Herramienta agregada para baja:', result.data);

                // Mapeo de datos del modal a la estructura de la tabla local
                const newItem: BajaItem = {
                    codigo: result.data.codigo || '',
                    pn: result.data.pn || '',
                    sn: result.data.sn || '',
                    nombre: result.data.nombre || '',
                    cantidad: result.data.cantidad || 1,
                    contenido: result.data.contenido || '',
                    base: result.data.base || '',
                    marca: result.data.marca || ''
                };

                // Actualizar señal de la tabla
                this.dataSource.update(items => [...items, newItem]);
            }
        });
    }

    removeItem(index: number): void {
        this.dataSource.update(items => {
            const newItems = [...items];
            newItems.splice(index, 1);
            return newItems;
        });
    }

    procesarEImprimir(): void {
        if (this.bajaForm.valid && this.dataSource().length > 0) {
            console.log('Procesando...', this.bajaForm.getRawValue());
        } else {
            this.bajaForm.markAllAsTouched();
        }
    }

    goBack(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/salidas']);
        }
    }
}
