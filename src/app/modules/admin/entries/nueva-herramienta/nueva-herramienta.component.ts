import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';
import { CreateMovement } from '../../../../core/models/movement.types';
import { DragDropModule } from '@angular/cdk/drag-drop';

interface Funcionario {
    id: string;
    licencia: string;
    nombreCompleto: string;
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno?: string;
    cargo?: string;
    departamento?: string;
}

interface Proveedor {
    id: string;
    nombre: string;
    nit?: string;
    direccion?: string;
    telefono?: string;
}

interface HerramientaItem {
    pn: string;
    sn: string;
    descripcion: string;
    codigoBoa: string;
    cantidad: number;
    unidadMedida: string;
    estado: string;
    costoUnitario: number;
    precioVenta: number;
    ubicacion: string;
    requiereCalibracion: boolean;
    intervaloCalibracion: number | null;
    fechaCalibracion: string | null;
    nroCertificado: string;
    costoTotal: number;
    // Campos adicionales del Excel
    tipo: string; // HERRAMIENTA, BANCO DE PRUEBA, CONSUMIBLE
    marca: string;
    nivelCriticidad: string; // A, B
    fabricacion: string; // LOCAL, INTERNACIONAL
}

@Component({
    selector: 'app-nueva-herramienta',
    standalone: true,
    imports: [
        CommonModule, RouterModule, ReactiveFormsModule, FormsModule,
        MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
        MatIconModule, MatButtonModule, MatTableModule, MatDialogModule,
        MatSnackBarModule, MatProgressSpinnerModule, MatAutocompleteModule,
        MatTooltipModule, MatCheckboxModule, MatSlideToggleModule,
        DragDropModule
    ],
    templateUrl: './nueva-herramienta.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 2px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
        }

        /* Forzar esquema oscuro para inputs nativos en modo dark */
        :host-context(.dark) {
            color-scheme: dark;
        }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base {
            background-color: #1e293b !important;
        }

        .spinner-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
        }

        :host-context(.dark) .spinner-overlay {
            background: rgba(0,0,0,0.7);
        }

        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #000;
            border-radius: 3px;
        }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
        }

        .calibration-fields {
            animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .animate-fadeIn {
            animation: fadeIn 0.2s ease-out forwards;
        }
    `]
})
export class NuevaHerramientaComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<NuevaHerramientaComponent>, { optional: true });
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);

    private _unsubscribeAll = new Subject<void>();

    // Formularios
    recepcionForm!: FormGroup;
    herramientaForm!: FormGroup;

    // Data
    dataSource: HerramientaItem[] = [];
    displayedColumns: string[] = [
        'pn', 'descripcion', 'sn', 'codigoBoa', 'tipo', 'marca',
        'cantidad', 'estado', 'costoTotal', 'calibracion', 'acciones'
    ];

    // Estados
    isLoading = false;
    isSaving = false;
    showConfirmation = false;
    editingIndex: number | null = null;

    // Listas
    funcionarios: Funcionario[] = [];
    funcionariosFiltrados: Funcionario[] = [];
    proveedores: Proveedor[] = [];
    proveedoresFiltrados: Proveedor[] = [];

    unidadesMedida = [
        { value: 'UNIDAD', label: 'UNIDAD' },
        { value: 'PAR', label: 'PAR' },
        { value: 'JUEGO', label: 'JUEGO' },
        { value: 'KIT', label: 'KIT' },
        { value: 'LITRO', label: 'LITRO' },
        { value: 'METRO', label: 'METRO' }
    ];

    estados = [
        { value: 'NUEVO', label: 'NUEVO', color: 'bg-green-100 text-green-800' },
        { value: 'REACONDICIONADO', label: 'REACONDICIONADO', color: 'bg-purple-100 text-purple-800' },
        { value: 'USADO', label: 'USADO', color: 'bg-yellow-100 text-yellow-800' }
    ];

    // Tipos de herramienta (del Excel)
    tiposHerramienta = [
        { value: 'HERRAMIENTA', label: 'HERRAMIENTA' },
        { value: 'BANCO_PRUEBA', label: 'BANCO DE PRUEBA' },
        { value: 'CONSUMIBLE', label: 'CONSUMIBLE' },
        { value: 'EQUIPO_MEDICION', label: 'EQUIPO DE MEDICIÓN' },
        { value: 'EQUIPO_SOPORTE', label: 'EQUIPO DE SOPORTE EN TIERRA' }
    ];

    // Marcas comunes de herramientas aeronáuticas
    marcas = [
        { value: 'SNAP-ON', label: 'SNAP-ON' },
        { value: 'STANLEY', label: 'STANLEY' },
        { value: 'FLUKE', label: 'FLUKE' },
        { value: 'MITUTOYO', label: 'MITUTOYO' },
        { value: 'STARRETT', label: 'STARRETT' },
        { value: 'WIHA', label: 'WIHA' },
        { value: 'BOEING', label: 'BOEING' },
        { value: 'AIRBUS', label: 'AIRBUS' },
        { value: 'CDI', label: 'CDI TORQUE' },
        { value: 'GEDORE', label: 'GEDORE' },
        { value: 'FACOM', label: 'FACOM' },
        { value: 'KNIPEX', label: 'KNIPEX' },
        { value: 'OTRO', label: 'OTRO' }
    ];

    // Niveles de criticidad (del Excel)
    nivelesCriticidad = [
        { value: 'A', label: 'A - Crítico', descripcion: 'Herramienta esencial para operaciones' },
        { value: 'B', label: 'B - Normal', descripcion: 'Herramienta de uso regular' }
    ];

    // Fabricación (del Excel)
    tiposFabricacion = [
        { value: 'INTERNACIONAL', label: 'INTERNACIONAL' },
        { value: 'LOCAL', label: 'LOCAL' }
    ];

    // Ubicaciones predefinidas (basado en estructura de almacén BoA)
    ubicaciones = [
        { value: 'ESTANTE-A1', label: 'Estante A - Nivel 1' },
        { value: 'ESTANTE-A2', label: 'Estante A - Nivel 2' },
        { value: 'ESTANTE-A3', label: 'Estante A - Nivel 3' },
        { value: 'ESTANTE-B1', label: 'Estante B - Nivel 1' },
        { value: 'ESTANTE-B2', label: 'Estante B - Nivel 2' },
        { value: 'ESTANTE-B3', label: 'Estante B - Nivel 3' },
        { value: 'ESTANTE-C1', label: 'Estante C - Nivel 1' },
        { value: 'ESTANTE-C2', label: 'Estante C - Nivel 2' },
        { value: 'VITRINA-1', label: 'Vitrina 1 - Precisión' },
        { value: 'VITRINA-2', label: 'Vitrina 2 - Calibración' },
        { value: 'PISO', label: 'Piso - Equipos Grandes' }
    ];

    // Correlativo para código BOA (simulado)
    private ultimoCorrelativo = 1200;

    constructor() {}

    ngOnInit(): void {
        this.initForms();
        this.loadInitialData();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private initForms(): void {
        // Formulario de recepción
        this.recepcionForm = this.fb.group({
            tipoDe: ['COMPRA', Validators.required],
            nroCmr: ['', [Validators.required, Validators.minLength(3)]],
            nroFactura: [''],
            proveedor: [''],
            fechaIngreso: [new Date().toISOString().split('T')[0], Validators.required],
            funcionarioRecibe: ['', Validators.required],
            ordenCompra: [''],
            observaciones: ['']
        });

        // Formulario de herramienta individual
        this.herramientaForm = this.fb.group({
            pn: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z0-9\-_]+$/)]],
            sn: ['', Validators.pattern(/^[A-Za-z0-9\-_]*$/)],
            descripcion: ['', [Validators.required, Validators.minLength(3)]],
            codigoBoa: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9\-]+$/)]],
            cantidad: [1, [Validators.required, Validators.min(1), Validators.max(9999)]],
            unidadMedida: ['UNIDAD', Validators.required],
            estado: ['NUEVO', Validators.required],
            costoUnitario: [0, [Validators.required, Validators.min(0)]],
            precioVenta: [0, Validators.min(0)],
            ubicacion: [''],
            requiereCalibracion: [false],
            intervaloCalibracion: [null],
            fechaCalibracion: [null],
            nroCertificado: [''],
            // Campos adicionales del Excel
            tipo: ['HERRAMIENTA', Validators.required],
            marca: ['', Validators.required],
            nivelCriticidad: ['B', Validators.required],
            fabricacion: ['INTERNACIONAL', Validators.required]
        });

        // Filtrar funcionarios
        this.recepcionForm.get('funcionarioRecibe')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll),
            debounceTime(300),
            distinctUntilChanged()
        ).subscribe(value => {
            this.filtrarFuncionarios(value);
        });

        // Filtrar proveedores
        this.recepcionForm.get('proveedor')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll),
            debounceTime(300),
            distinctUntilChanged()
        ).subscribe(value => {
            this.filtrarProveedores(value);
        });

        // Validación condicional de calibración
        this.herramientaForm.get('requiereCalibracion')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(requiere => {
            const intervaloControl = this.herramientaForm.get('intervaloCalibracion');
            if (requiere) {
                intervaloControl?.setValidators([Validators.required, Validators.min(1)]);
            } else {
                intervaloControl?.clearValidators();
                this.herramientaForm.patchValue({
                    intervaloCalibracion: null,
                    fechaCalibracion: null,
                    nroCertificado: ''
                });
            }
            intervaloControl?.updateValueAndValidity();
        });
    }

    private loadInitialData(): void {
        this.isLoading = true;

        // Cargar funcionarios/personal
        this.movementService.getPersonal().pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (data) => {
                this.funcionarios = data.map((p: any) => ({
                    id: p.id || p.id_personal,
                    licencia: p.licencia || p.nro_licencia || '',
                    nombreCompleto: `${p.nombre || ''} ${p.apellido_paterno || ''} ${p.apellido_materno || ''}`.trim(),
                    nombre: p.nombre || '',
                    apellidoPaterno: p.apellido_paterno || '',
                    apellidoMaterno: p.apellido_materno || '',
                    cargo: p.cargo || '',
                    departamento: p.departamento || ''
                }));
                this.funcionariosFiltrados = [...this.funcionarios];
            },
            error: () => {
                // Personal técnico de mantenimiento BoA (datos mock realistas)
                this.funcionarios = [
                    { id: '1', licencia: 'TMA-1245', nombreCompleto: 'Gabriel Cruz Mamani', nombre: 'Gabriel', apellidoPaterno: 'Cruz', apellidoMaterno: 'Mamani', cargo: 'Técnico TMA A&P', departamento: 'Mantenimiento Línea' },
                    { id: '2', licencia: 'TMA-0987', nombreCompleto: 'Marco Antonio Quispe Condori', nombre: 'Marco Antonio', apellidoPaterno: 'Quispe', apellidoMaterno: 'Condori', cargo: 'Inspector de Calidad', departamento: 'Control de Calidad' },
                    { id: '3', licencia: 'TMA-1456', nombreCompleto: 'Carlos Alberto Flores Rojas', nombre: 'Carlos Alberto', apellidoPaterno: 'Flores', apellidoMaterno: 'Rojas', cargo: 'Supervisor Hangar', departamento: 'Hangar Mayor' },
                    { id: '4', licencia: 'TMA-0856', nombreCompleto: 'Luis Fernando Choque Vargas', nombre: 'Luis Fernando', apellidoPaterno: 'Choque', apellidoMaterno: 'Vargas', cargo: 'Técnico Aviónica', departamento: 'Aviónica' },
                    { id: '5', licencia: 'TMA-1123', nombreCompleto: 'Roberto Limachi Apaza', nombre: 'Roberto', apellidoPaterno: 'Limachi', apellidoMaterno: 'Apaza', cargo: 'Jefe de Almacén', departamento: 'Almacén Herramientas' },
                    { id: '6', licencia: 'TMA-0745', nombreCompleto: 'María Elena Torrez Huanca', nombre: 'María Elena', apellidoPaterno: 'Torrez', apellidoMaterno: 'Huanca', cargo: 'Analista Técnico', departamento: 'Ingeniería' },
                    { id: '7', licencia: 'TMA-1378', nombreCompleto: 'Jorge Luis Mamani Calle', nombre: 'Jorge Luis', apellidoPaterno: 'Mamani', apellidoMaterno: 'Calle', cargo: 'Técnico Estructuras', departamento: 'Estructuras' },
                    { id: '8', licencia: 'TMA-0923', nombreCompleto: 'Edwin Paco Mendoza', nombre: 'Edwin', apellidoPaterno: 'Paco', apellidoMaterno: 'Mendoza', cargo: 'Técnico Motores', departamento: 'Planta Motriz' }
                ];
                this.funcionariosFiltrados = [...this.funcionarios];
            }
        });

        // Cargar proveedores
        this.movementService.getProveedores().pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (data) => {
                this.proveedores = data.map((p: any) => ({
                    id: p.id,
                    nombre: p.nombre || p.name,
                    nit: p.nit,
                    direccion: p.direccion,
                    telefono: p.telefono
                }));
                this.proveedoresFiltrados = [...this.proveedores];
            },
            error: () => {
                // Proveedores de herramientas aeronáuticas (datos mock realistas)
                this.proveedores = [
                    { id: '1', nombre: 'Snap-On Industrial Bolivia', nit: '1023456017', direccion: 'Av. Blanco Galindo Km 5, Cochabamba', telefono: '+591-4-4358900' },
                    { id: '2', nombre: 'Boeing Distribution Services', nit: '1025896321', direccion: 'Miami, FL - USA', telefono: '+1-305-5551234' },
                    { id: '3', nombre: 'Airbus Americas', nit: '1027896541', direccion: 'Houston, TX - USA', telefono: '+1-713-5559876' },
                    { id: '4', nombre: 'IMSA Bolivia S.A.', nit: '1015987654', direccion: 'Zona Industrial El Alto', telefono: '+591-2-2824500' },
                    { id: '5', nombre: 'Ferretería Industrial FERBO', nit: '1018754321', direccion: 'Av. Montes 1250, La Paz', telefono: '+591-2-2371500' },
                    { id: '6', nombre: 'AVIALL Services (Boeing Company)', nit: '1029654123', direccion: 'Dallas, TX - USA', telefono: '+1-972-5558541' },
                    { id: '7', nombre: 'Pratt & Whitney Parts', nit: '1031257896', direccion: 'East Hartford, CT - USA', telefono: '+1-860-5553200' },
                    { id: '8', nombre: 'HEICO Aerospace', nit: '1033698521', direccion: 'Hollywood, FL - USA', telefono: '+1-954-5556200' },
                    { id: '9', nombre: 'Fluke Bolivia (Representante)', nit: '1012589746', direccion: 'Calle Comercio 456, Santa Cruz', telefono: '+591-3-3365200' },
                    { id: '10', nombre: 'Mitutoyo Sudamérica', nit: '1035478962', direccion: 'São Paulo, Brasil', telefono: '+55-11-55123000' }
                ];
                this.proveedoresFiltrados = [...this.proveedores];
            }
        });
    }

    private filtrarFuncionarios(valor: string): void {
        if (!valor || typeof valor !== 'string') {
            this.funcionariosFiltrados = [...this.funcionarios];
            return;
        }
        const filtro = valor.toLowerCase();
        this.funcionariosFiltrados = this.funcionarios.filter(f =>
            f.nombreCompleto.toLowerCase().includes(filtro) ||
            f.licencia.toLowerCase().includes(filtro)
        );
    }

    private filtrarProveedores(valor: string): void {
        if (!valor || typeof valor !== 'string') {
            this.proveedoresFiltrados = [...this.proveedores];
            return;
        }
        const filtro = valor.toLowerCase();
        this.proveedoresFiltrados = this.proveedores.filter(p =>
            p.nombre.toLowerCase().includes(filtro) ||
            (p.nit && p.nit.includes(filtro))
        );
    }

    displayFuncionario(funcionario: Funcionario): string {
        return funcionario ? `${funcionario.licencia} - ${funcionario.nombreCompleto}` : '';
    }

    displayProveedor(proveedor: Proveedor): string {
        return proveedor ? `${proveedor.nombre}${proveedor.nit ? ' (' + proveedor.nit + ')' : ''}` : '';
    }

    // Genera automáticamente el código BoA con formato BOA-H-XXXX
    generarCodigoBoa(): void {
        this.ultimoCorrelativo++;
        const codigo = `BOA-H-${this.ultimoCorrelativo.toString().padStart(4, '0')}`;
        this.herramientaForm.patchValue({ codigoBoa: codigo });
        this.showMessage(`Código generado: ${codigo}`, 'info');
    }

    agregarHerramienta(): void {
        // Validar campos de herramienta
        this.herramientaForm.markAllAsTouched();

        if (this.herramientaForm.invalid) {
            this.showMessage('Complete los campos requeridos de la herramienta', 'error');
            return;
        }

        const f = this.herramientaForm.value;

        // Verificar duplicados por código BOA
        const existeIndex = this.dataSource.findIndex(item =>
            item.codigoBoa.toUpperCase() === f.codigoBoa.toUpperCase()
        );

        if (existeIndex >= 0 && this.editingIndex !== existeIndex) {
            this.showMessage('Ya existe una herramienta con este código BOA en la lista', 'warning');
            return;
        }

        const item: HerramientaItem = {
            pn: f.pn.toUpperCase(),
            sn: f.sn || '',
            descripcion: f.descripcion,
            codigoBoa: f.codigoBoa.toUpperCase(),
            cantidad: f.cantidad,
            unidadMedida: f.unidadMedida,
            estado: f.estado,
            costoUnitario: f.costoUnitario || 0,
            precioVenta: f.precioVenta || 0,
            ubicacion: f.ubicacion || '',
            requiereCalibracion: f.requiereCalibracion || false,
            intervaloCalibracion: f.requiereCalibracion ? f.intervaloCalibracion : null,
            fechaCalibracion: f.requiereCalibracion ? f.fechaCalibracion : null,
            nroCertificado: f.requiereCalibracion ? f.nroCertificado : '',
            costoTotal: f.cantidad * (f.costoUnitario || 0),
            // Campos adicionales del Excel
            tipo: f.tipo || 'HERRAMIENTA',
            marca: f.marca || '',
            nivelCriticidad: f.nivelCriticidad || 'B',
            fabricacion: f.fabricacion || 'INTERNACIONAL'
        };

        if (this.editingIndex !== null) {
            // Actualizar item existente
            this.dataSource[this.editingIndex] = item;
            this.dataSource = [...this.dataSource];
            this.editingIndex = null;
            this.showMessage('Herramienta actualizada', 'success');
        } else {
            // Agregar nuevo item
            this.dataSource = [...this.dataSource, item];
            this.showMessage('Herramienta agregada a la lista', 'success');
        }

        this.resetHerramientaForm();
    }

    editarItem(index: number): void {
        const item = this.dataSource[index];
        this.editingIndex = index;

        this.herramientaForm.patchValue({
            pn: item.pn,
            sn: item.sn,
            descripcion: item.descripcion,
            codigoBoa: item.codigoBoa,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            estado: item.estado,
            costoUnitario: item.costoUnitario,
            precioVenta: item.precioVenta,
            ubicacion: item.ubicacion,
            requiereCalibracion: item.requiereCalibracion,
            intervaloCalibracion: item.intervaloCalibracion,
            fechaCalibracion: item.fechaCalibracion,
            nroCertificado: item.nroCertificado,
            // Campos adicionales del Excel
            tipo: item.tipo || 'HERRAMIENTA',
            marca: item.marca || '',
            nivelCriticidad: item.nivelCriticidad || 'B',
            fabricacion: item.fabricacion || 'INTERNACIONAL'
        });

        // Scroll al formulario
        document.querySelector('.herramienta-form')?.scrollIntoView({ behavior: 'smooth' });
    }

    eliminarItem(index: number): void {
        const item = this.dataSource[index];
        if (confirm(`¿Eliminar ${item.pn} - ${item.descripcion} de la lista?`)) {
            this.dataSource.splice(index, 1);
            this.dataSource = [...this.dataSource];

            if (this.editingIndex === index) {
                this.editingIndex = null;
                this.resetHerramientaForm();
            }

            this.showMessage(`${item.pn} eliminado de la lista`, 'info');
        }
    }

    cancelarEdicion(): void {
        this.editingIndex = null;
        this.resetHerramientaForm();
    }

    private resetHerramientaForm(): void {
        this.herramientaForm.reset({
            pn: '',
            sn: '',
            descripcion: '',
            codigoBoa: '',
            cantidad: 1,
            unidadMedida: 'UNIDAD',
            estado: 'NUEVO',
            costoUnitario: 0,
            precioVenta: 0,
            ubicacion: '',
            requiereCalibracion: false,
            intervaloCalibracion: null,
            fechaCalibracion: null,
            nroCertificado: '',
            // Campos adicionales del Excel
            tipo: 'HERRAMIENTA',
            marca: '',
            nivelCriticidad: 'B',
            fabricacion: 'INTERNACIONAL'
        });
        this.herramientaForm.markAsUntouched();
    }

    goBack(): void {
        if (this.dataSource.length > 0) {
            if (!confirm('¿Está seguro de salir? Se perderán los datos no guardados.')) {
                return;
            }
        }

        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/entradas']);
        }
    }

    // Cálculos
    getTotalItems(): number {
        return this.dataSource.reduce((sum, item) => sum + item.cantidad, 0);
    }

    getCostoTotal(): number {
        return this.dataSource.reduce((sum, item) => sum + item.costoTotal, 0);
    }

    getItemsConCalibracion(): number {
        return this.dataSource.filter(item => item.requiereCalibracion).length;
    }

    // Validaciones
    validateRecepcion(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        this.recepcionForm.markAllAsTouched();

        if (this.recepcionForm.get('nroCmr')?.invalid) {
            errors.push('Ingrese el número de CMR/Documento');
        }
        if (this.recepcionForm.get('fechaIngreso')?.invalid) {
            errors.push('Seleccione la fecha de ingreso');
        }
        if (!this.recepcionForm.get('funcionarioRecibe')?.value ||
            typeof this.recepcionForm.get('funcionarioRecibe')?.value === 'string') {
            errors.push('Seleccione el funcionario que recibe');
        }

        return { valid: errors.length === 0, errors };
    }

    procesar(): void {
        const validation = this.validateRecepcion();

        if (!validation.valid) {
            validation.errors.forEach(err => this.showMessage(err, 'error'));
            return;
        }

        if (this.dataSource.length === 0) {
            this.showMessage('Agregue al menos una herramienta a la lista', 'warning');
            return;
        }

        // Mostrar modal de confirmación
        this.showConfirmation = true;
    }

    cancelarConfirmacion(): void {
        this.showConfirmation = false;
    }

    finalizar(): void {
        const validation = this.validateRecepcion();

        if (!validation.valid) {
            validation.errors.forEach(err => this.showMessage(err, 'error'));
            return;
        }

        if (this.dataSource.length === 0) {
            this.showMessage('No hay herramientas para registrar', 'warning');
            return;
        }

        this.showConfirmation = false;
        this.isSaving = true;

        const recepcion = this.recepcionForm.value;
        const funcionario = recepcion.funcionarioRecibe;
        const proveedor = recepcion.proveedor;

        const compraData: CreateMovement = {
            type: 'entry',
            entryReason: 'purchase',
            date: recepcion.fechaIngreso,
            movementNumber: recepcion.nroCmr,
            supplier: typeof proveedor === 'object' ? proveedor?.nombre : proveedor || '',
            notes: recepcion.observaciones || '',
            responsiblePerson: funcionario?.nombreCompleto || '',
            items: this.dataSource.map(h => ({
                toolCode: h.codigoBoa,
                codigo: h.codigoBoa,
                pn: h.pn,
                sn: h.sn,
                descripcion: h.descripcion,
                quantity: h.cantidad,
                cantidad: h.cantidad,
                unidadMedida: h.unidadMedida,
                estado: h.estado,
                unitCost: h.costoUnitario,
                costoUnitario: h.costoUnitario,
                salePrice: h.precioVenta,
                precioVenta: h.precioVenta,
                ubicacion: h.ubicacion,
                requiresCalibration: h.requiereCalibracion,
                requiereCalibracion: h.requiereCalibracion,
                calibrationInterval: h.intervaloCalibracion,
                intervaloCalibracion: h.intervaloCalibracion,
                calibrationDate: h.fechaCalibracion,
                fechaCalibracion: h.fechaCalibracion,
                certificateNumber: h.nroCertificado,
                nroCertificado: h.nroCertificado,
                // Campos adicionales del Excel
                tipo: h.tipo,
                marca: h.marca,
                nivelCriticidad: h.nivelCriticidad,
                fabricacion: h.fabricacion
            }))
        };

        this.movementService.createEntry(compraData).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSaving = false)
        ).subscribe({
            next: (response) => {
                this.showMessage('Entrada de compra registrada exitosamente', 'success');
                if (this.dialogRef) {
                    this.dialogRef.close({ success: true, data: response });
                } else {
                    this.router.navigate(['/entradas']);
                }
            },
            error: (err) => {
                console.error('Error al guardar:', err);
                this.showMessage('Error al registrar la entrada. Intente nuevamente.', 'error');
            }
        });
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }

    hasError(form: FormGroup, field: string, error: string): boolean {
        const control = form.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    hasRecepcionError(field: string, error: string): boolean {
        return this.hasError(this.recepcionForm, field, error);
    }

    hasHerramientaError(field: string, error: string): boolean {
        return this.hasError(this.herramientaForm, field, error);
    }

    getEstadoColor(estado: string): string {
        const estadoObj = this.estados.find(e => e.value === estado);
        return estadoObj ? estadoObj.color : 'bg-gray-100 text-gray-800';
    }

    async openHerramientasAIngresar(): Promise<void> {
        const { HerramientasAIngresarComponent } = await import('./herramientas-a-ingresar/herramientas-a-ingresar.component');

        const dialogRef = this.dialog.open(HerramientasAIngresarComponent, {
            width: '1000px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            disableClose: false
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.action === 'procesar') {
                const data = result.data;

                // Verificar duplicado
                const existe = this.dataSource.some(item =>
                    item.codigoBoa.toUpperCase() === (data.codigo || '').toUpperCase()
                );

                if (existe) {
                    this.showMessage('Esta herramienta ya está en la lista', 'warning');
                    return;
                }

                const item: HerramientaItem = {
                    pn: data.pn || '',
                    sn: data.sn || '',
                    descripcion: data.nombre || data.descripcion || '',
                    codigoBoa: data.codigo || '',
                    cantidad: data.cantidad || 1,
                    unidadMedida: data.unidadMedida || 'UNIDAD',
                    estado: data.estado || 'NUEVO',
                    costoUnitario: data.costoUnitario || 0,
                    precioVenta: data.precioVenta || 0,
                    ubicacion: data.ubicacion || '',
                    requiereCalibracion: data.requiereCalibracion || false,
                    intervaloCalibracion: data.intervaloCalibracion || null,
                    fechaCalibracion: data.fechaCalibracion || null,
                    nroCertificado: data.nroCertificado || '',
                    costoTotal: (data.cantidad || 1) * (data.costoUnitario || 0),
                    // Campos adicionales del Excel
                    tipo: data.tipo || 'HERRAMIENTA',
                    marca: data.marca || '',
                    nivelCriticidad: data.nivelCriticidad || 'B',
                    fabricacion: data.fabricacion || 'INTERNACIONAL'
                };

                this.dataSource = [...this.dataSource, item];
                this.showMessage('Herramienta agregada desde catálogo', 'success');
            }
        });
    }
}
