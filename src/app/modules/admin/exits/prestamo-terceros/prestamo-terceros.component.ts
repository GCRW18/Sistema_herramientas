import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

// Material Modules
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

interface InternalLoanItem {
    codigo: string;
    pn: string;
    descripcion: string;
    sn: string;
    fechaCalibracion: string;
    cantidad: number;
    unidad: string;
    estadoFisico: string;
    contenido: string;
}

interface ExternalLoanItem {
    codigo: string;
    pn: string;
    descripcion: string;
    sn: string;
    fechaCalibracion: string;
    cantidad: number;
    horas: number;
    estadoFisico: string;
    contenido: string;
    precioTotal: number;
}

interface HerramientaOption {
    codigo: string;
    nombre: string;
    pn: string;
    sn: string;
    ubicacion: string;
    existencia: number;
    fechaVencimiento: string;
    unidad: string;
    estadoFisico: string;
    costoHora: number;
}

type ViewMode = 'internal' | 'external';

@Component({
    selector: 'app-prestamo-terceros',
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
        MatCheckboxModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './prestamo-terceros.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        /* Animación fadeIn */
        .animate-fadeIn {
            animation: fadeIn 0.3s ease-in-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* ESTILOS DE INPUTS - Estilo Neomórfico */
        :host ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: white !important;
            border: 3px solid black !important;
            border-radius: 12px !important;
            padding: 0 14px !important;
            min-height: 52px;
            box-shadow: 3px 3px 0px 0px rgba(0, 0, 0, 0.1);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
        }

        :host ::ng-deep .textarea-field .mat-mdc-text-field-wrapper {
            height: 100% !important;
            min-height: 100px;
            align-items: flex-start;
            padding-top: 14px !important;
        }

        :host ::ng-deep textarea.mat-mdc-input-element {
            margin-top: 0px !important;
            height: 100% !important;
        }

        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-text-field-wrapper {
            background-color: white !important;
            border-color: black !important;
            box-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
            transform: translate(-2px, -2px);
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
            letter-spacing: 0.5px;
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

        /* Dark mode para inputs */
        :host-context(.dark) ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: #1e293b !important;
        }

        :host-context(.dark) ::ng-deep .mat-mdc-input-element {
            color: white !important;
        }

        :host-context(.dark) ::ng-deep .mat-mdc-floating-label {
            color: #94a3b8 !important;
        }

        :host-context(.dark) ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-floating-label {
            color: white !important;
        }

        /* Checkbox Override - Estilo Neomórfico */
        :host ::ng-deep .mdc-checkbox .mdc-checkbox__native-control:enabled:checked~.mdc-checkbox__background {
            background-color: #111A43 !important;
            border-color: black !important;
        }

        :host ::ng-deep .mdc-checkbox .mdc-checkbox__native-control:enabled~.mdc-checkbox__background {
            border-color: black !important;
            border-width: 2px !important;
            border-radius: 4px !important;
        }

        :host ::ng-deep .mat-mdc-checkbox label {
            font-weight: 700 !important;
        }

        /* Select dropdown styling */
        :host ::ng-deep .mat-mdc-select-value {
            font-weight: 700 !important;
        }

        /* Table row hover effects */
        :host ::ng-deep .mat-mdc-row:hover {
            transition: background-color 0.2s ease;
        }
    `]
})
export class PrestamoTercerosComponent implements OnInit {

    // Inyectamos MatDialogRef opcionalmente para poder cerrar el modal
    public dialogRef = inject(MatDialogRef<PrestamoTercerosComponent>, { optional: true });
    private dialog = inject(MatDialog);

    currentView = signal<ViewMode>('internal');
    internalForm!: FormGroup;
    externalForm!: FormGroup;
    externalToolForm!: FormGroup;

    // Data Mock
    internalDataSource = signal<InternalLoanItem[]>([
        { codigo: 'TOOL-001', pn: 'PN-123', descripcion: 'TALADRO', sn: 'SN-999', fechaCalibracion: '2025-01-01', cantidad: 1, unidad: 'PZA', estadoFisico: 'BUENO', contenido: 'COMPLETO' }
    ]);

    externalDataSource = signal<ExternalLoanItem[]>([
        { codigo: 'EXT-001', pn: 'EXT-PN', descripcion: 'MULTIMETRO', sn: 'SN-888', fechaCalibracion: '2025-02-01', cantidad: 1, horas: 24, estadoFisico: 'REGULAR', contenido: 'CABLES', precioTotal: 100 }
    ]);

    // Importe total para vista externa
    importeTotal = signal<number>(0);

    // Signals for external tool form
    selectedImageExternal = signal<string | null>(null);
    coincidenciasExternal = signal<number>(0);
    precioTotalExternal = signal<number>(0);

    // Mock data for herramientas
    herramientasExternal: HerramientaOption[] = [
        { codigo: 'BOA-H-90001', nombre: 'TALADRO NEUMATICO', pn: 'PN-TAL-001', sn: 'SN-001', ubicacion: '15-A', existencia: 5, fechaVencimiento: '2025-12-31', unidad: 'PZA', estadoFisico: 'BUENO', costoHora: 15.50 },
        { codigo: 'BOA-H-90002', nombre: 'TORQUIMETRO DIGITAL', pn: 'PN-TOR-002', sn: 'SN-002', ubicacion: '16-B', existencia: 3, fechaVencimiento: '2025-06-30', unidad: 'PZA', estadoFisico: 'BUENO', costoHora: 25.00 },
        { codigo: 'BOA-H-90003', nombre: 'MULTIMETRO FLUKE', pn: 'PN-MUL-003', sn: 'SN-003', ubicacion: '17-C', existencia: 8, fechaVencimiento: '2025-09-15', unidad: 'EA', estadoFisico: 'REGULAR', costoHora: 10.00 },
    ];

    filteredHerramientasExternal: HerramientaOption[] = [];

    displayedColumnsInternal: string[] = ['codigo', 'pn', 'descripcion', 'sn', 'fechaCalibracion', 'cantidad', 'unidad', 'estadoFisico', 'contenido'];
    displayedColumnsExternal: string[] = ['codigo', 'pn', 'descripcion', 'sn', 'fechaCalibracion', 'cantidad', 'horas', 'estadoFisico', 'contenido', 'precioTotal'];

    constructor(private fb: FormBuilder, private router: Router) {}

    ngOnInit(): void {
        this.initInternalForm();
        this.initExternalForm();
        this.initExternalToolForm();
        this.filteredHerramientasExternal = [...this.herramientasExternal];
        this.calcularImporteTotal();
    }

    private initInternalForm(): void {
        this.internalForm = this.fb.group({
            buscar: [''],
            nroLicencia: [''],
            apPaterno: [''],
            apMaterno: [''],
            nombres: [''],
            fecha: [new Date()],
            hora: ['01:20'],
            matriculaAeronave: ['N/A'],
            ordenTrabajo: [''],
            destinoServicios: [false],
            destinoLinea: [false],
            destinoTaller: [false],
            trabajoEspecialNo: [false],
            trabajoEspecialSi: [false],
            observaciones: [''],
            kitSeleccionado: ['']
        });
    }

    private initExternalForm(): void {
        this.externalForm = this.fb.group({
            apPaterno: [''],
            apMaterno: [''],
            nombres: [''],
            ci: [''],
            fecha: [new Date()],
            hora: ['01:25'],
            empresa: [''],
            motivoPrestamo: [''],
            entregueConforme: [''],
            autorizado: [''],
            cargo: [''],
            importe: ['']
        });
    }

    private initExternalToolForm(): void {
        this.externalToolForm = this.fb.group({
            buscar: [''],
            codigo: [''],
            nombre: [''],
            pn: [''],
            sn: [''],
            ubicacion: [''],
            existencia: [''],
            fechaVencimiento: [''],
            unidad: [''],
            estadoFisico: [''],
            costoHora: [0],
            horas: [1],
            cantidad: [1],
            observacion: ['']
        });

        // Calculate total price when hours or cost changes
        this.externalToolForm.get('horas')?.valueChanges.subscribe(() => this.calcularPrecioTotalExternal());
        this.externalToolForm.get('costoHora')?.valueChanges.subscribe(() => this.calcularPrecioTotalExternal());
    }

    calcularPrecioTotalExternal(): void {
        const costoHora = this.externalToolForm.get('costoHora')?.value || 0;
        const horas = this.externalToolForm.get('horas')?.value || 0;
        const total = costoHora * horas;
        this.precioTotalExternal.set(total);
    }

    selectHerramientaExternal(herramienta: HerramientaOption): void {
        this.externalToolForm.patchValue({
            codigo: herramienta.codigo,
            nombre: herramienta.nombre,
            pn: herramienta.pn,
            sn: herramienta.sn,
            ubicacion: herramienta.ubicacion,
            existencia: herramienta.existencia,
            fechaVencimiento: herramienta.fechaVencimiento,
            unidad: herramienta.unidad,
            estadoFisico: herramienta.estadoFisico,
            costoHora: herramienta.costoHora
        });
        this.coincidenciasExternal.set(1);
        this.calcularPrecioTotalExternal();
    }

    onImageSelectedExternal(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                this.selectedImageExternal.set(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    }

    agregarHerramientaExternal(): void {
        const formValue = this.externalToolForm.getRawValue();
        const newItem: ExternalLoanItem = {
            codigo: formValue.codigo || '',
            pn: formValue.pn || '',
            descripcion: formValue.nombre || '',
            sn: formValue.sn || '',
            fechaCalibracion: formValue.fechaVencimiento || '',
            cantidad: formValue.cantidad || 1,
            horas: formValue.horas || 0,
            estadoFisico: formValue.estadoFisico || '',
            contenido: formValue.observacion || '',
            precioTotal: this.precioTotalExternal()
        };
        this.externalDataSource.update(items => [...items, newItem]);
        this.calcularImporteTotal();
        this.resetExternalToolForm();
    }

    resetExternalToolForm(): void {
        this.externalToolForm.reset({
            buscar: '',
            codigo: '',
            nombre: '',
            pn: '',
            sn: '',
            ubicacion: '',
            existencia: '',
            fechaVencimiento: '',
            unidad: '',
            estadoFisico: '',
            costoHora: 0,
            horas: 1,
            cantidad: 1,
            observacion: ''
        });
        this.selectedImageExternal.set(null);
        this.coincidenciasExternal.set(0);
        this.precioTotalExternal.set(0);
    }

    switchView(view: ViewMode): void {
        this.currentView.set(view);
    }

    // --- CORRECCIÓN AQUÍ ---
    goBack(): void {
        if (this.dialogRef) {
            // Si está abierto como modal, cerramos el modal
            this.dialogRef.close();
        } else {
            // Si es una página normal, navegamos
            this.router.navigate(['/salidas']);
        }
    }

    agregarTecnico(): void {}
    agregarKit(): void {}
    procesar(): void {}
    reimprimir(): void {}
    procesarExterno(): void {
        console.log('Procesando préstamo externo:', this.externalForm.value, this.externalDataSource());
    }

    async openPrestamoTercerosDialog(): Promise<void> {
        const { PrestamoTercerosDialogComponent } = await import('./prestamo-terceros-dialog/prestamo-terceros-dialog.component');
        const dialogRef = this.dialog.open(PrestamoTercerosDialogComponent, {
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
                console.log('Herramienta agregada para préstamo a terceros:', result.data);
                const newItem: ExternalLoanItem = {
                    codigo: result.data.codigo || '',
                    pn: result.data.pn || '',
                    descripcion: result.data.nombre || '',
                    sn: result.data.sn || '',
                    fechaCalibracion: result.data.fechaVencimiento || '',
                    cantidad: result.data.cantidad || 1,
                    horas: result.data.horas || 0,
                    estadoFisico: result.data.estadoFisico || '',
                    contenido: result.data.observacion || '',
                    precioTotal: result.data.precioTotal || 0
                };
                this.externalDataSource.update(items => [...items, newItem]);
                this.calcularImporteTotal();
            }
        });
    }

    calcularImporteTotal(): void {
        const total = this.externalDataSource().reduce((sum, item) => sum + (item.precioTotal || 0), 0);
        this.importeTotal.set(total);
    }

    salir(): void {
        this.goBack();
    }

    async openHerramientasAPrestar(): Promise<void> {
        const { HerramientasAPrestarComponent } = await import('./herramientas-a-prestar/herramientas-a-prestar.component');
        const dialogRef = this.dialog.open(HerramientasAPrestarComponent, {
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
                console.log('Herramienta agregada para préstamo:', result.data);
                // Add to the appropriate data source based on current view
                if (this.currentView() === 'internal') {
                    const newItem: InternalLoanItem = {
                        codigo: result.data.codigo || '',
                        pn: result.data.pn || '',
                        descripcion: result.data.nombre || '',
                        sn: result.data.sn || '',
                        fechaCalibracion: result.data.fechaVencimiento || '',
                        cantidad: result.data.cantidad || 1,
                        unidad: result.data.unidad || '',
                        estadoFisico: result.data.estado || '',
                        contenido: ''
                    };
                    this.internalDataSource.update(items => [...items, newItem]);
                } else {
                    const newItem: ExternalLoanItem = {
                        codigo: result.data.codigo || '',
                        pn: result.data.pn || '',
                        descripcion: result.data.nombre || '',
                        sn: result.data.sn || '',
                        fechaCalibracion: result.data.fechaVencimiento || '',
                        cantidad: result.data.cantidad || 1,
                        horas: 0,
                        estadoFisico: result.data.estado || '',
                        contenido: '',
                        precioTotal: 0
                    };
                    this.externalDataSource.update(items => [...items, newItem]);
                }
            }
        });
    }
}
