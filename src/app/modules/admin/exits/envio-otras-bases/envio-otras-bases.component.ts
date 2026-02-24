import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

interface ExitItem {
    id: number;
    item: number;
    codigo: string;
    descripcion: string;
    marca: string;
    partNumber: string;
    serialNumber: string;
    cantidad: number;
    um: string;
    estado: string;
    prioridad: string;
    motivo: string;
    observaciones: string;
}

interface Funcionario {
    id: number;
    nombre: string;
    cargo: string;
    base: string;
}

interface Base {
    codigo: string;
    nombre: string;
    ciudad: string;
    icao: string;
}

@Component({
    selector: 'app-envio-otras-bases',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatSelectModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatCheckboxModule,
        MatAutocompleteModule,
        MatTooltipModule,
        DragDropModule
    ],
    templateUrl: './envio-otras-bases.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 2px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
        }

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

        .spinner-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            border-radius: 8px;
        }

        :host-context(.dark) .spinner-overlay {
            background: rgba(15, 23, 42, 0.8);
        }

        .row-selected {
            background-color: #fef3c7 !important;
        }

        :host-context(.dark) .row-selected {
            background-color: rgba(251, 191, 36, 0.2) !important;
        }
    `]
})
export class EnvioOtrasBasesComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<EnvioOtrasBasesComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private destroy$ = new Subject<void>();

    // Formulario reactivo
    exitForm!: FormGroup;

    // Estados
    isSaving = false;
    showConfirmation = false; // Modal de confirmación (igual que devolución)

    // Contador para IDs
    private itemIdCounter = 1;

    // Bases de BoA en Bolivia
    bases: Base[] = [
        { codigo: 'VVI', nombre: 'Viru Viru Internacional', ciudad: 'Santa Cruz', icao: 'SLVR' },
        { codigo: 'LPB', nombre: 'El Alto Internacional', ciudad: 'La Paz', icao: 'SLLP' },
        { codigo: 'CBB', nombre: 'Jorge Wilstermann', ciudad: 'Cochabamba', icao: 'SLCB' },
        { codigo: 'SRE', nombre: 'Juana Azurduy de Padilla', ciudad: 'Sucre', icao: 'SLSU' },
        { codigo: 'TJA', nombre: 'Capitán Oriel Lea Plaza', ciudad: 'Tarija', icao: 'SLTJ' },
        { codigo: 'ORU', nombre: 'Juan Mendoza', ciudad: 'Oruro', icao: 'SLOR' },
        { codigo: 'TDD', nombre: 'Teniente Jorge Henrich', ciudad: 'Trinidad', icao: 'SLTR' },
        { codigo: 'CIJ', nombre: 'Capitán Aníbal Arab', ciudad: 'Cobija', icao: 'SLCO' },
        { codigo: 'POI', nombre: 'Capitán Nicolás Rojas', ciudad: 'Potosí', icao: 'SLPO' },
        { codigo: 'RIB', nombre: 'Capitán Av. Selin Zeitun', ciudad: 'Riberalta', icao: 'SLRI' }
    ];

    // Tipos de envío
    tiposEnvio = [
        { value: 'TRASPASO', label: 'Traspaso Definitivo', color: 'bg-purple-100 text-purple-800 border-2 border-purple-500' },
        { value: 'APOYO', label: 'Apoyo Temporal', color: 'bg-blue-100 text-blue-800 border-2 border-blue-500' },
        { value: 'AOG', label: 'AOG (Aircraft on Ground)', color: 'bg-red-100 text-red-800 border-2 border-red-500' },
        { value: 'PRESTAMO', label: 'Préstamo Inter-Base', color: 'bg-green-100 text-green-800 border-2 border-green-500' },
        { value: 'MANTENIMIENTO', label: 'Para Mantenimiento', color: 'bg-orange-100 text-orange-800 border-2 border-orange-500' }
    ];

    // Prioridades
    prioridades = [
        { value: 'NORMAL', label: 'Normal', color: 'bg-gray-100 text-gray-800 border-2 border-gray-500' },
        { value: 'URGENTE', label: 'Urgente', color: 'bg-yellow-100 text-yellow-800 border-2 border-yellow-500' },
        { value: 'AOG', label: 'AOG', color: 'bg-red-100 text-red-800 border-2 border-red-500' }
    ];

    // Funcionarios BoA (entrega)
    funcionariosEntrega: Funcionario[] = [
        { id: 1, nombre: 'Tec. Miguel Ángel Rojas', cargo: 'Encargado Almacén', base: 'VVI' },
        { id: 2, nombre: 'Tec. Julio Espinoza', cargo: 'Técnico Despacho', base: 'VVI' },
        { id: 3, nombre: 'Ing. Roberto Mendoza', cargo: 'Jefe Almacén', base: 'VVI' },
        { id: 4, nombre: 'Tec. Sandra Flores', cargo: 'Técnico Inventarios', base: 'VVI' }
    ];

    // Funcionarios BoA (recibe - varían según base destino)
    funcionariosRecibo: Funcionario[] = [
        { id: 1, nombre: 'Tec. Carlos Mamani', cargo: 'Encargado Almacén', base: 'LPB' },
        { id: 2, nombre: 'Tec. Mario Condori', cargo: 'Técnico Recepción', base: 'LPB' },
        { id: 3, nombre: 'Ing. Patricia Vargas', cargo: 'Jefe Mantenimiento', base: 'CBB' },
        { id: 4, nombre: 'Tec. Luis Fernández', cargo: 'Encargado Almacén', base: 'CBB' },
        { id: 5, nombre: 'Tec. Ana Quispe', cargo: 'Técnico Recepción', base: 'SRE' },
        { id: 6, nombre: 'Tec. Jorge Medina', cargo: 'Encargado Almacén', base: 'TJA' }
    ];

    filteredFuncionariosEntrega: Funcionario[] = [];
    filteredFuncionariosRecibo: Funcionario[] = [];

    // Vuelos BoA
    vuelosDisponibles = [
        'OB-301', 'OB-302', 'OB-401', 'OB-402', 'OB-501', 'OB-502',
        'OB-601', 'OB-602', 'OB-701', 'OB-702', 'OB-801', 'OB-802'
    ];

    // Columnas de la tabla - Mismo estilo que devolución
    displayedColumns: string[] = [
        'item', 'codigo', 'descripcion', 'pn', 'sn',
        'cantidad', 'estado', 'prioridad', 'acciones'
    ];

    // Data source con signal
    dataSource = signal<ExitItem[]>([]);

    constructor() {}

    ngOnInit(): void {
        this.initForm();
        this.setupFilters();
        this.cargarDatosIniciales();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initForm(): void {
        const today = new Date();
        const timeStr = today.toTimeString().slice(0, 5);

        this.exitForm = this.fb.group({
            baseOrigen: ['VVI'],
            baseDestino: ['', Validators.required],
            tipoEnvio: ['APOYO', Validators.required],
            prioridad: ['NORMAL', Validators.required],
            entregadoPor: ['', Validators.required],
            entregadoPorInput: [''],
            recibidoPor: ['', Validators.required],
            recibidoPorInput: [''],
            nroGuia: [''],
            nroVuelo: ['', Validators.required],
            fecha: [today.toISOString().split('T')[0], Validators.required],
            hora: [timeStr, Validators.required],
            aeronave: [''],
            ordenTrabajo: [''],
            observaciones: ['']
        });

        this.generarNumeroGuia();
    }

    private cargarDatosIniciales(): void {
        // Datos mock para demostración
        const mockItems = [
            {
                id: this.itemIdCounter++,
                item: 1,
                codigo: 'BOA-H-0289',
                descripcion: 'TORQUIMETRO DIGITAL 250-1000 LB/FT',
                marca: 'TOHNICHI',
                partNumber: 'TRQ-250-1000',
                serialNumber: 'TQ-78523',
                cantidad: 1,
                um: 'PZA',
                estado: 'SERVICEABLE',
                prioridad: 'AOG',
                motivo: 'Requerido para mantenimiento en LPB',
                observaciones: 'Urgente - Aeronave CP-3209'
            },
            {
                id: this.itemIdCounter++,
                item: 2,
                codigo: 'BOA-H-0523',
                descripcion: 'CALIBRADOR DIGITAL 6 PULGADAS',
                marca: 'MITUTOYO',
                partNumber: 'DG-CALIPER-6',
                serialNumber: 'MIT-112847',
                cantidad: 2,
                um: 'PZA',
                estado: 'SERVICEABLE',
                prioridad: 'NORMAL',
                motivo: 'Apoyo temporal a base CBB',
                observaciones: 'Para medición de piezas críticas'
            },
            {
                id: this.itemIdCounter++,
                item: 3,
                codigo: 'BOA-H-1189',
                descripcion: 'TALADRO ANGULAR 90 GRADOS',
                marca: 'INGERSOLL RAND',
                partNumber: 'DRILL-90DEG',
                serialNumber: 'IR-45632',
                cantidad: 1,
                um: 'PZA',
                estado: 'EN_CALIBRACION',
                prioridad: 'URGENTE',
                motivo: 'Préstamo inter-base para mantenimiento mayor',
                observaciones: 'Requiere calibración previa al uso'
            }
        ];

        this.dataSource.set(mockItems);
    }

    private setupFilters(): void {
        // Inicializar listas filtradas
        this.filteredFuncionariosEntrega = [...this.funcionariosEntrega];
        this.filteredFuncionariosRecibo = [...this.funcionariosRecibo];

        // Filtro para funcionario entrega
        this.exitForm.get('entregadoPorInput')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged())
            .subscribe(value => {
                this.filtrarFuncionariosEntrega(value);
            });

        // Cuando cambia la base destino, filtrar funcionarios de recibo
        this.exitForm.get('baseDestino')?.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(base => {
                this.filteredFuncionariosRecibo = this.funcionariosRecibo.filter(f => f.base === base);
                this.exitForm.patchValue({
                    recibidoPor: '',
                    recibidoPorInput: ''
                });
            });

        // Filtro para funcionario recibo
        this.exitForm.get('recibidoPorInput')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged())
            .subscribe(value => {
                this.filtrarFuncionariosRecibo(value);
            });
    }

    private filtrarFuncionariosEntrega(valor: any): void {
        if (!valor || typeof valor !== 'string') {
            this.filteredFuncionariosEntrega = [...this.funcionariosEntrega];
            return;
        }

        const filtro = valor.toLowerCase();
        this.filteredFuncionariosEntrega = this.funcionariosEntrega.filter(f =>
            f.nombre.toLowerCase().includes(filtro) ||
            f.cargo.toLowerCase().includes(filtro)
        );
    }

    private filtrarFuncionariosRecibo(valor: any): void {
        if (!valor || typeof valor !== 'string') {
            const base = this.exitForm.get('baseDestino')?.value;
            this.filteredFuncionariosRecibo = this.funcionariosRecibo.filter(f => f.base === base);
            return;
        }

        const filtro = valor.toLowerCase();
        const base = this.exitForm.get('baseDestino')?.value;
        const baseFiltered = this.funcionariosRecibo.filter(f => f.base === base);

        this.filteredFuncionariosRecibo = baseFiltered.filter(f =>
            f.nombre.toLowerCase().includes(filtro) ||
            f.cargo.toLowerCase().includes(filtro)
        );
    }

    selectFuncionarioEntrega(func: Funcionario): void {
        this.exitForm.patchValue({
            entregadoPor: func.id,
            entregadoPorInput: func.nombre
        });
    }

    selectFuncionarioRecibo(func: Funcionario): void {
        this.exitForm.patchValue({
            recibidoPor: func.id,
            recibidoPorInput: func.nombre
        });
    }

    displayFuncionario(func: Funcionario): string {
        return func ? `${func.nombre} - ${func.cargo}` : '';
    }

    generarNumeroGuia(): void {
        const year = new Date().getFullYear();
        const correlativo = Math.floor(Math.random() * 9000) + 1000;
        const guia = `ENV-${year}-${correlativo}`;
        this.exitForm.patchValue({ nroGuia: guia });
    }

    getBaseNombre(codigo: string): string {
        if (!codigo) return '';
        const base = this.bases.find(b => b.codigo === codigo);
        return base ? `${base.codigo} - ${base.ciudad}` : codigo;
    }

    getTipoEnvioLabel(tipo: string): string {
        const tipoObj = this.tiposEnvio.find(t => t.value === tipo);
        return tipoObj ? tipoObj.label : tipo;
    }

    getTipoEnvioClass(tipo: string): string {
        const tipoObj = this.tiposEnvio.find(t => t.value === tipo);
        return tipoObj ? tipoObj.color : 'bg-gray-100 text-gray-800 border-2 border-gray-500';
    }

    getPrioridadClass(prioridad: string): string {
        const prio = this.prioridades.find(p => p.value === prioridad);
        return prio ? prio.color : 'bg-gray-100 text-gray-800 border-2 border-gray-500';
    }

    getEstadoClass(estado: string): string {
        switch (estado) {
            case 'SERVICEABLE':
                return 'bg-green-100 text-green-800 border-2 border-green-500';
            case 'UNSERVICEABLE':
                return 'bg-red-100 text-red-800 border-2 border-red-500';
            case 'EN_CALIBRACION':
                return 'bg-yellow-100 text-yellow-800 border-2 border-yellow-500';
            case 'EN_REPARACION':
                return 'bg-orange-100 text-orange-800 border-2 border-orange-500';
            default:
                return 'bg-gray-100 text-gray-800 border-2 border-gray-500';
        }
    }

    removeItem(item: ExitItem): void {
        const currentItems = this.dataSource();
        const updatedItems = currentItems.filter(i => i.id !== item.id);

        // Re-enumerar items
        updatedItems.forEach((it, idx) => it.item = idx + 1);

        this.dataSource.set(updatedItems);
        this.showMessage(`Herramienta ${item.codigo} eliminada del envío`, 'info');
    }

    getTotalCantidad(): number {
        return this.dataSource().reduce((sum, item) => sum + item.cantidad, 0);
    }

    getResumenPorPrioridadArray(): { prioridad: string; cantidad: number; color: string }[] {
        const items = this.dataSource();
        const resumen: { [key: string]: number } = {
            'NORMAL': 0,
            'URGENTE': 0,
            'AOG': 0
        };

        items.forEach(item => {
            resumen[item.prioridad] = (resumen[item.prioridad] || 0) + 1;
        });

        return Object.entries(resumen)
            .filter(([_, cantidad]) => cantidad > 0)
            .map(([prioridad, cantidad]) => ({
                prioridad: this.prioridades.find(p => p.value === prioridad)?.label || prioridad,
                cantidad,
                color: this.prioridades.find(p => p.value === prioridad)?.color || 'bg-gray-100 text-gray-800 border-2 border-gray-500'
            }));
    }

    hasError(field: string, error: string): boolean {
        const control = this.exitForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    // Validación - Mismo estilo que devolución
    validateEnvio(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (this.dataSource().length === 0) {
            errors.push('Debe agregar al menos una herramienta para enviar');
            return { valid: false, errors };
        }

        if (!this.exitForm.get('baseDestino')?.value) {
            errors.push('Seleccione la base destino');
        }

        if (!this.exitForm.get('nroVuelo')?.value) {
            errors.push('Seleccione el número de vuelo');
        }

        if (!this.exitForm.get('entregadoPor')?.value) {
            errors.push('Seleccione el responsable de entrega');
        }

        if (!this.exitForm.get('recibidoPor')?.value) {
            errors.push('Seleccione el responsable de recepción');
        }

        return { valid: errors.length === 0, errors };
    }

    // Procesar - Prepara confirmación
    procesar(): void {
        const validation = this.validateEnvio();

        if (!validation.valid) {
            validation.errors.forEach(err => this.showMessage(err, 'error'));
            return;
        }

        // Mostrar modal de confirmación
        this.showConfirmation = true;
    }

    // Cancelar confirmación
    cancelarConfirmacion(): void {
        this.showConfirmation = false;
    }

    // Confirmar y finalizar envío
    confirmarEnvio(): void {
        this.showConfirmation = false;
        this.isSaving = true;

        // Simular guardado
        setTimeout(() => {
            this.isSaving = false;
            this.showMessage(`Envío ${this.exitForm.get('nroGuia')?.value} registrado exitosamente`, 'success');

            // Limpiar formulario y tabla
            this.dataSource.set([]);
            this.itemIdCounter = 1;
            this.generarNumeroGuia();

            if (this.dialogRef) {
                this.dialogRef.close({
                    success: true,
                    data: {
                        form: this.exitForm.value,
                        items: this.dataSource()
                    }
                });
            }
        }, 1500);
    }

    // Finalizar (método original que abre confirmación)
    finalizar(): void {
        this.procesar();
    }

    goBack(): void {
        if (this.dataSource().length > 0) {
            if (!confirm('¿Está seguro de salir? Hay items pendientes de envío.')) {
                return;
            }
        }

        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/salidas']);
        }
    }

    private showMessage(message: string, type: 'success' | 'error' | 'info'): void {
        const config: any = {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        };
        this.snackBar.open(message, 'Cerrar', config);
    }

    async openHerramientaAEnviar(): Promise<void> {
        const { HerramientaAEnviarComponent } = await import('./herramienta-a-enviar/herramienta-a-enviar.component');
        const dialogRef = this.dialog.open(HerramientaAEnviarComponent, {
            width: '1100px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            disableClose: false,
            data: {
                tipoEnvio: this.exitForm.get('tipoEnvio')?.value,
                prioridad: this.exitForm.get('prioridad')?.value,
                baseDestino: this.exitForm.get('baseDestino')?.value
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                const currentItems = this.dataSource();
                const newItem: ExitItem = {
                    id: this.itemIdCounter++,
                    item: currentItems.length + 1,
                    codigo: result.data.codigo || '',
                    descripcion: result.data.nombre || '',
                    marca: result.data.marca || '',
                    partNumber: result.data.pn || '',
                    serialNumber: result.data.sn || '',
                    cantidad: result.data.cantidad || 1,
                    um: result.data.unidad || 'PZA',
                    estado: result.data.estadoFisico || 'SERVICEABLE',
                    prioridad: result.data.prioridad || this.exitForm.get('prioridad')?.value || 'NORMAL',
                    motivo: result.data.motivo || '',
                    observaciones: result.data.observacion || ''
                };
                this.dataSource.set([...currentItems, newItem]);
                this.showMessage(`Herramienta ${newItem.codigo} agregada al envío`, 'success');
            }
        });
    }
}
