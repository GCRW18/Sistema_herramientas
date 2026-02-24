import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, finalize, debounceTime } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';
import { MovementType, EntryReason, CreateMovement } from '../../../../core/models/movement.types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type TipoOrigen = 'BASE' | 'TRASPASO';
type CondicionRetorno = 'BUENO' | 'DAÑADO' | 'REQUIERE_CALIBRACION' | 'FALTANTE';
type TipoEnvio = 'EVENTUAL' | 'PERMANENTE' | 'TRASPASO' | 'AOG';

interface Ubicacion {
    id: string;
    nombre: string;
    codigo: string;
    ciudad?: string;
    tipo: 'base' | 'almacen';
}

interface TraspasoItem {
    id: string;
    filaObs: number;
    toolId?: string;
    codigo: string;
    descripcion: string;
    pn: string;
    sn: string;
    marca?: string;
    cantidadEnviada: number;
    cantidadRetorna: number;
    fechaEnvio: string;
    nroNotaSalida: string;
    ubicacionOrigen: string;
    tipoEnvio: TipoEnvio;
    ordenTrabajo?: string;
    matriculaAeronave?: string;
    motivoEnvio?: string;
    estadoSalida?: string;
    diasFuera?: number;
    selected: boolean;
    expanded: boolean;
    condicion: CondicionRetorno | '';
    observacionItem: string;
}

interface Funcionario {
    id: string;
    nombre: string;
    cargo: string;
    area: string;
}

interface ResumenCondicion {
    buenos: number;
    danados: number;
    calibracion: number;
    faltantes: number;
    pendientes: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

@Component({
    selector: 'app-retorno-traspaso',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatInputModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatCheckboxModule,
        MatTooltipModule,
        DragDropModule
    ],
    templateUrl: './retorno-traspaso.component.html',
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

        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
        }
        :host-context(.dark) .spinner-overlay {
            background: rgba(0,0,0,0.7);
        }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        .row-selected {
            background-color: #fffbeb !important;
            border-color: black !important;
        }
        :host-context(.dark) .row-selected {
            background-color: rgba(251, 191, 36, 0.1) !important;
            border-color: #fbbf24 !important;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }

        ::ng-deep .white-checkbox .mdc-checkbox__background {
            border-color: white !important;
        }
        ::ng-deep .white-checkbox.mat-mdc-checkbox-checked .mdc-checkbox__background {
            background-color: white !important;
            border-color: white !important;
        }
        ::ng-deep .white-checkbox .mdc-checkbox__checkmark {
            color: #0f172a !important;
        }
    `]
})
export class RetornoTraspasoComponent implements OnInit, OnDestroy {
    // ========================================================================
    // DEPENDENCY INJECTION
    // ========================================================================
    public dialogRef = inject(MatDialogRef<RetornoTraspasoComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private _unsubscribeAll = new Subject<void>();

    // ========================================================================
    // FORM
    // ========================================================================
    retornoForm!: FormGroup;

    // ========================================================================
    // STATE
    // ========================================================================
    isLoading = false;
    isSaving = false;
    isSearching = false;
    showConfirmModal = false;
    tipoOrigenActivo: TipoOrigen = 'BASE';

    // ========================================================================
    // DATA
    // ========================================================================
    allData: TraspasoItem[] = [];
    dataSource: TraspasoItem[] = [];
    ubicaciones: Ubicacion[] = [];
    bases: Ubicacion[] = [];
    almacenes: Ubicacion[] = [];
    funcionarios: Funcionario[] = [];

    // ========================================================================
    // CONFIGURATION
    // ========================================================================
    condiciones: Array<{
        value: CondicionRetorno;
        label: string;
        color: string;
        bgColor: string;
        icon: string;
        description: string;
    }> = [
        {
            value: 'BUENO',
            label: 'Bueno',
            color: 'green',
            bgColor: 'bg-green-500',
            icon: 'check_circle',
            description: 'Perfecto estado, listo para uso'
        },
        {
            value: 'DAÑADO',
            label: 'Dañado',
            color: 'red',
            bgColor: 'bg-red-500',
            icon: 'report_problem',
            description: 'Requiere reparación o baja'
        },
        {
            value: 'REQUIERE_CALIBRACION',
            label: 'Req. Calibración',
            color: 'yellow',
            bgColor: 'bg-yellow-500',
            icon: 'speed',
            description: 'Necesita calibración antes de uso'
        },
        {
            value: 'FALTANTE',
            label: 'Faltante',
            color: 'red',
            bgColor: 'bg-red-600',
            icon: 'help_outline',
            description: 'No se encuentra, pérdida o extravío'
        }
    ];

    tiposEnvio: Array<{ value: TipoEnvio; label: string; color: string }> = [
        { value: 'EVENTUAL', label: 'Eventual', color: 'blue' },
        { value: 'PERMANENTE', label: 'Permanente', color: 'purple' },
        { value: 'AOG', label: 'AOG', color: 'red' },
        { value: 'TRASPASO', label: 'Traspaso', color: 'green' }
    ];

    // ========================================================================
    // LIFECYCLE HOOKS
    // ========================================================================
    constructor() {}

    ngOnInit(): void {
        this.initForm();
        this.loadUbicaciones();
        this.loadFuncionarios();
        this.setupSearchFilter();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    private initForm(): void {
        const today = new Date().toISOString().split('T')[0];
        this.retornoForm = this.fb.group({
            tipoOrigen: ['BASE', Validators.required],
            ubicacionOrigen: [null, Validators.required],
            searchText: [''],
            nroDocumento: ['', Validators.required],
            fechaRetorno: [today, Validators.required],
            transportista: [''],
            responsableRecibe: [null, Validators.required],
            observaciones: ['']
        });
    }

    private setupSearchFilter(): void {
        this.retornoForm.get('searchText')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll),
            debounceTime(300)
        ).subscribe(() => {
            this.filterData();
        });
    }

    private filterData(): void {
        const searchText = this.retornoForm.get('searchText')?.value?.toLowerCase().trim() || '';

        this.dataSource = this.allData.filter(item => {
            return !searchText ||
                item.descripcion.toLowerCase().includes(searchText) ||
                item.pn.toLowerCase().includes(searchText) ||
                item.sn.toLowerCase().includes(searchText) ||
                item.codigo.toLowerCase().includes(searchText) ||
                item.nroNotaSalida.toLowerCase().includes(searchText);
        });
    }

    // ========================================================================
    // DATA LOADING
    // ========================================================================
    private loadUbicaciones(): void {
        this.isLoading = true;

        // Cargar bases
        this.movementService.getBases().pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (data) => {
                this.bases = data.map((b: any) => ({
                    id: b.id,
                    nombre: b.nombre || b.name,
                    codigo: b.codigo || b.code || '',
                    ciudad: b.ciudad || b.city || '',
                    tipo: 'base' as const
                }));
            },
            error: () => {
                this.bases = this.getMockBases();
            }
        });

        // Cargar almacenes
        this.movementService.getWarehouses().pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (data) => {
                this.almacenes = data
                    .filter((w: any) => w.type === 'warehouse' || w.tipo === 'almacen' || !w.type)
                    .map((w: any) => ({
                        id: w.id,
                        nombre: w.nombre || w.name,
                        codigo: w.codigo || w.code || '',
                        tipo: 'almacen' as const
                    }));
            },
            error: () => {
                this.almacenes = this.getMockAlmacenes();
            }
        });
    }

    private loadFuncionarios(): void {
        const funcionariosObservable = this.movementService.getFuncionarios?.();

        if (funcionariosObservable) {
            funcionariosObservable.pipe(
                takeUntil(this._unsubscribeAll)
            ).subscribe({
                next: (data) => {
                    if (data && data.length > 0) {
                        this.funcionarios = data.map((f: any) => ({
                            id: f.id,
                            nombre: f.nombre || f.name || `${f.firstName} ${f.lastName}`,
                            cargo: f.cargo || f.position || '',
                            area: f.area || f.department || ''
                        }));
                    } else {
                        this.loadDefaultFuncionarios();
                    }
                },
                error: () => {
                    this.loadDefaultFuncionarios();
                }
            });
        } else {
            this.loadDefaultFuncionarios();
        }
    }

    private loadDefaultFuncionarios(): void {
        this.funcionarios = [
            { id: '1', nombre: 'MENDEZ CRUZ JOSE RODRIGO', cargo: 'Técnico Almacén', area: 'Almacén Central' },
            { id: '2', nombre: 'VARGAS NESTOR', cargo: 'Supervisor', area: 'Almacén' },
            { id: '3', nombre: 'LEDEZMA GUSTAVO', cargo: 'Jefe de Área', area: 'Control de Calidad' },
            { id: '4', nombre: 'ESCOBAR JOSE LUIS', cargo: 'Técnico', area: 'Herramientas' },
            { id: '5', nombre: 'GARCIA MARTINEZ PEDRO', cargo: 'Inspector', area: 'Recepción' },
            { id: '6', nombre: 'LOPEZ MAMANI CARLOS', cargo: 'Técnico Senior', area: 'Mantenimiento' }
        ];
    }

    private getMockBases(): Ubicacion[] {
        return [
            { id: '1', nombre: 'Aeropuerto Internacional El Alto', codigo: 'LPB', ciudad: 'La Paz', tipo: 'base' },
            { id: '2', nombre: 'Aeropuerto Internacional Viru Viru', codigo: 'VVI', ciudad: 'Santa Cruz', tipo: 'base' },
            { id: '3', nombre: 'Aeropuerto Jorge Wilstermann', codigo: 'CBB', ciudad: 'Cochabamba', tipo: 'base' },
            { id: '4', nombre: 'Aeropuerto Alcantarí', codigo: 'SRE', ciudad: 'Sucre', tipo: 'base' },
            { id: '5', nombre: 'Aeropuerto Cap. Oriel Lea Plaza', codigo: 'TJA', ciudad: 'Tarija', tipo: 'base' },
            { id: '6', nombre: 'Aeropuerto Ten. Av. Jorge Henrich', codigo: 'TDD', ciudad: 'Trinidad', tipo: 'base' }
        ];
    }

    private getMockAlmacenes(): Ubicacion[] {
        return [
            { id: '10', nombre: 'Almacén Central Herramientas', codigo: 'ALM-HER-CENT', tipo: 'almacen' },
            { id: '11', nombre: 'Almacén Hangar 1 - VVI', codigo: 'ALM-H1-VVI', tipo: 'almacen' },
            { id: '12', nombre: 'Almacén Hangar 2 - VVI', codigo: 'ALM-H2-VVI', tipo: 'almacen' },
            { id: '13', nombre: 'Almacén Línea de Vuelo LPB', codigo: 'ALM-LIN-LPB', tipo: 'almacen' },
            { id: '14', nombre: 'Almacén Taller Aviónica', codigo: 'ALM-AVI', tipo: 'almacen' }
        ];
    }

    // ========================================================================
    // GETTER METHODS
    // ========================================================================
    getUbicacionesFiltradas(): Ubicacion[] {
        return this.tipoOrigenActivo === 'BASE' ? this.bases : this.almacenes;
    }

    getTipoOrigenLabel(): string {
        return this.tipoOrigenActivo === 'BASE' ? 'Base Operativa' : 'Almacén';
    }

    getDocumentoLabel(): string {
        return this.tipoOrigenActivo === 'BASE' ? 'Nro. COMAT' : 'Nro. Traspaso';
    }

    // ========================================================================
    // DATA MANAGEMENT
    // ========================================================================
    onTipoOrigenChange(tipo: TipoOrigen): void {
        this.tipoOrigenActivo = tipo;
        this.retornoForm.patchValue({ tipoOrigen: tipo, ubicacionOrigen: null });
        this.clearData();
    }

    consultar(): void {
        const ubicacionOrigen = this.retornoForm.get('ubicacionOrigen')?.value;

        if (!ubicacionOrigen || !ubicacionOrigen.id) {
            this.showMessage('Seleccione una ubicación de origen', 'warning');
            return;
        }

        this.isSearching = true;
        const exitReason = this.tipoOrigenActivo === 'BASE' ? 'base_send' : 'transfer';

        this.movementService.getMovements({
            movement_type: 'exit',
            exitReason: exitReason,
            destinationWarehouseId: ubicacionOrigen.id,
            status: 'completed'
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSearching = false)
        ).subscribe({
            next: (data) => {
                if (data && data.length > 0) {
                    const filtered = this.tipoOrigenActivo === 'BASE'
                        ? data.filter((m: any) => m.tipoEnvio === 'EVENTUAL' || !m.tipoEnvio)
                        : data;

                    this.allData = filtered.map((item: any, index: number) =>
                        this.mapMovementToTraspasoItem(item, index)
                    );
                } else {
                    this.loadMockData(ubicacionOrigen);
                }
                this.dataSource = [...this.allData];
                this.showMessage(`Carga completa: ${this.dataSource.length} herramientas en ${ubicacionOrigen.nombre}`, 'success');
            },
            error: () => {
                this.loadMockData(ubicacionOrigen);
                this.dataSource = [...this.allData];
                this.showMessage('Datos de prueba cargados', 'info');
            }
        });
    }

    private mapMovementToTraspasoItem(movement: any, index: number): TraspasoItem {
        const item = movement.items?.[0];
        const fechaEnvio = movement.date || '';
        return {
            id: movement.id || `temp-${index}`,
            filaObs: index + 1,
            toolId: item?.toolId || item?.tool?.id,
            codigo: item?.tool?.code || item?.codigo || '',
            descripcion: item?.tool?.description || item?.descripcion || '',
            pn: item?.tool?.partNumber || item?.pn || '',
            sn: item?.tool?.serialNumber || item?.sn || '',
            marca: item?.tool?.brand || item?.marca || '',
            cantidadEnviada: item?.quantity || 1,
            cantidadRetorna: item?.quantity || 1,
            fechaEnvio: fechaEnvio,
            nroNotaSalida: movement.movementNumber || '',
            ubicacionOrigen: movement.destinationWarehouse?.name || '',
            tipoEnvio: movement.tipoEnvio || movement.sendType || (this.tipoOrigenActivo === 'BASE' ? 'EVENTUAL' : 'TRASPASO'),
            ordenTrabajo: movement.workOrder || movement.ordenTrabajo || '',
            matriculaAeronave: movement.aircraftRegistration || movement.matriculaAeronave || '',
            motivoEnvio: movement.reason || movement.motivoEnvio || '',
            estadoSalida: movement.toolStatus || 'DISPONIBLE',
            diasFuera: fechaEnvio ? this.calcularDiasFuera(fechaEnvio) : 0,
            selected: false,
            expanded: false,
            condicion: '',
            observacionItem: ''
        };
    }

    private loadMockData(ubicacion: Ubicacion): void {
        const prefix = this.tipoOrigenActivo === 'BASE' ? 'COMAT' : 'TRP';

        if (this.tipoOrigenActivo === 'BASE') {
            this.allData = this.getMockDataBase(ubicacion, prefix);
        } else {
            this.allData = this.getMockDataTraspaso(ubicacion, prefix);
        }
    }

    private getMockDataBase(ubicacion: Ubicacion, prefix: string): TraspasoItem[] {
        return [
            {
                id: '1', filaObs: 1, codigo: 'BOA-H-0456',
                descripcion: 'Torquímetro Digital 50-250 lb-ft SNAP-ON',
                pn: 'TECH3FR250', sn: 'TQ-2024-0456', marca: 'SNAP-ON',
                cantidadEnviada: 1, cantidadRetorna: 1,
                fechaEnvio: '2026-01-10',
                nroNotaSalida: `${prefix}-${ubicacion.codigo}-001/2026`,
                ubicacionOrigen: ubicacion.nombre, tipoEnvio: 'EVENTUAL',
                ordenTrabajo: 'OT-2026-0045', matriculaAeronave: 'CP-3108',
                motivoEnvio: 'Check C - Inspección tren de aterrizaje',
                estadoSalida: 'DISPONIBLE',
                diasFuera: this.calcularDiasFuera('2026-01-10'),
                selected: false, expanded: false, condicion: '', observacionItem: ''
            },
            {
                id: '2', filaObs: 2, codigo: 'BOA-H-0234',
                descripcion: 'Multímetro Digital FLUKE 87V',
                pn: 'FLUKE-87V', sn: 'FL-2023-0234', marca: 'FLUKE',
                cantidadEnviada: 1, cantidadRetorna: 1,
                fechaEnvio: '2026-01-15',
                nroNotaSalida: `${prefix}-${ubicacion.codigo}-002/2026`,
                ubicacionOrigen: ubicacion.nombre, tipoEnvio: 'AOG',
                ordenTrabajo: 'OT-2026-0067', matriculaAeronave: 'CP-3105',
                motivoEnvio: 'AOG - Falla sistema eléctrico',
                estadoSalida: 'DISPONIBLE',
                diasFuera: this.calcularDiasFuera('2026-01-15'),
                selected: false, expanded: false, condicion: '', observacionItem: ''
            },
            {
                id: '3', filaObs: 3, codigo: 'BOA-H-0789',
                descripcion: 'Juego de Llaves Allen Métrico (1.5-10mm)',
                pn: 'FACOM-89SH.JP9A', sn: 'JLA-2024-0789', marca: 'FACOM',
                cantidadEnviada: 1, cantidadRetorna: 1,
                fechaEnvio: '2026-01-08',
                nroNotaSalida: `${prefix}-${ubicacion.codigo}-003/2026`,
                ubicacionOrigen: ubicacion.nombre, tipoEnvio: 'EVENTUAL',
                ordenTrabajo: 'OT-2026-0032', matriculaAeronave: 'CP-3102',
                motivoEnvio: 'Mantenimiento programado',
                estadoSalida: 'DISPONIBLE',
                diasFuera: this.calcularDiasFuera('2026-01-08'),
                selected: false, expanded: false, condicion: '', observacionItem: ''
            },
            {
                id: '4', filaObs: 4, codigo: 'BOA-H-0567',
                descripcion: 'Boroscopio Flexible 3m OLYMPUS',
                pn: 'IPLEX-NX', sn: 'BR-2023-0567', marca: 'OLYMPUS',
                cantidadEnviada: 1, cantidadRetorna: 1,
                fechaEnvio: '2026-01-12',
                nroNotaSalida: `${prefix}-${ubicacion.codigo}-004/2026`,
                ubicacionOrigen: ubicacion.nombre, tipoEnvio: 'EVENTUAL',
                ordenTrabajo: 'OT-2026-0055', matriculaAeronave: 'CP-3108',
                motivoEnvio: 'Inspección interna motor',
                estadoSalida: 'DISPONIBLE',
                diasFuera: this.calcularDiasFuera('2026-01-12'),
                selected: false, expanded: false, condicion: '', observacionItem: ''
            }
        ];
    }

    private getMockDataTraspaso(ubicacion: Ubicacion, prefix: string): TraspasoItem[] {
        return [
            {
                id: '1', filaObs: 1, codigo: 'BOA-H-0901',
                descripcion: 'Kit de Conectores Deutsch',
                pn: 'DT-KIT-500', sn: 'KC-2024-0901', marca: 'DEUTSCH',
                cantidadEnviada: 3, cantidadRetorna: 3,
                fechaEnvio: '2026-01-03',
                nroNotaSalida: `${prefix}-${ubicacion.codigo}-001/2026`,
                ubicacionOrigen: ubicacion.nombre, tipoEnvio: 'TRASPASO',
                ordenTrabajo: '', matriculaAeronave: '',
                motivoEnvio: 'Redistribución de inventario',
                estadoSalida: 'DISPONIBLE',
                diasFuera: this.calcularDiasFuera('2026-01-03'),
                selected: false, expanded: false, condicion: '', observacionItem: ''
            },
            {
                id: '2', filaObs: 2, codigo: 'BOA-H-0902',
                descripcion: 'Pelacables Automático KNIPEX',
                pn: '12-62-180', sn: 'PK-2024-0902', marca: 'KNIPEX',
                cantidadEnviada: 5, cantidadRetorna: 5,
                fechaEnvio: '2026-01-07',
                nroNotaSalida: `${prefix}-${ubicacion.codigo}-002/2026`,
                ubicacionOrigen: ubicacion.nombre, tipoEnvio: 'TRASPASO',
                ordenTrabajo: '', matriculaAeronave: '',
                motivoEnvio: 'Transferencia a taller aviónica',
                estadoSalida: 'DISPONIBLE',
                diasFuera: this.calcularDiasFuera('2026-01-07'),
                selected: false, expanded: false, condicion: '', observacionItem: ''
            },
            {
                id: '3', filaObs: 3, codigo: 'BOA-H-0903',
                descripcion: 'Juego de Destornilladores Aislados WIHA',
                pn: 'WIHA-35389', sn: 'JD-2024-0903', marca: 'WIHA',
                cantidadEnviada: 2, cantidadRetorna: 2,
                fechaEnvio: '2026-01-10',
                nroNotaSalida: `${prefix}-${ubicacion.codigo}-003/2026`,
                ubicacionOrigen: ubicacion.nombre, tipoEnvio: 'TRASPASO',
                ordenTrabajo: '', matriculaAeronave: '',
                motivoEnvio: 'Consolidación de herramientas',
                estadoSalida: 'DISPONIBLE',
                diasFuera: this.calcularDiasFuera('2026-01-10'),
                selected: false, expanded: false, condicion: '', observacionItem: ''
            }
        ];
    }

    private clearData(): void {
        this.allData = [];
        this.dataSource = [];
    }

    // ========================================================================
    // SELECTION MANAGEMENT
    // ========================================================================
    toggleSelection(item: TraspasoItem): void {
        item.selected = !item.selected;
        if (item.selected && !item.expanded) item.expanded = true;
    }

    toggleAllSelection(event: any): void {
        const checked = event.checked;
        this.dataSource.forEach(item => {
            item.selected = checked;
            if (checked && !item.expanded) item.expanded = true;
        });
    }

    isAllSelected(): boolean {
        return this.dataSource.length > 0 && this.dataSource.every(item => item.selected);
    }

    isSomeSelected(): boolean {
        return this.dataSource.some(item => item.selected) && !this.isAllSelected();
    }

    getSelectedItems(): TraspasoItem[] {
        return this.dataSource.filter(item => item.selected);
    }

    getSelectedCount(): number {
        return this.getSelectedItems().length;
    }

    toggleExpand(item: TraspasoItem): void {
        item.expanded = !item.expanded;
    }

    // ========================================================================
    // ITEM MANAGEMENT
    // ========================================================================
    onCondicionChange(item: TraspasoItem, condicion: CondicionRetorno): void {
        item.condicion = condicion;
        // Si es faltante, la cantidad retorna es 0
        if (condicion === 'FALTANTE') {
            item.cantidadRetorna = 0;
        } else if (item.cantidadRetorna === 0) {
            item.cantidadRetorna = item.cantidadEnviada;
        }
    }

    validateCantidadRetorna(item: TraspasoItem): void {
        if (item.cantidadRetorna > item.cantidadEnviada) {
            item.cantidadRetorna = item.cantidadEnviada;
        }
        if (item.cantidadRetorna < 0) {
            item.cantidadRetorna = 0;
        }
    }

    // ========================================================================
    // VALIDATION
    // ========================================================================
    isItemValid(item: TraspasoItem): boolean {
        if (!item.selected) return true;

        // Condición es obligatoria
        if (!item.condicion) return false;

        // Cantidad válida
        if (item.condicion !== 'FALTANTE' && (item.cantidadRetorna <= 0 || item.cantidadRetorna > item.cantidadEnviada)) {
            return false;
        }

        // Si está dañado o faltante, requiere observación
        if ((item.condicion === 'DAÑADO' || item.condicion === 'FALTANTE') && !item.observacionItem.trim()) {
            return false;
        }

        return true;
    }

    getItemErrors(item: TraspasoItem): string[] {
        const errors: string[] = [];
        if (!item.selected) return errors;

        if (!item.condicion) errors.push('Falta Condición');
        if (item.condicion !== 'FALTANTE' && item.cantidadRetorna <= 0) errors.push('Cantidad inválida');
        if (item.condicion !== 'FALTANTE' && item.cantidadRetorna > item.cantidadEnviada) errors.push('Excede enviado');
        if ((item.condicion === 'DAÑADO' || item.condicion === 'FALTANTE') && !item.observacionItem.trim()) {
            errors.push('Falta Observación');
        }

        return errors;
    }

    canProceed(): boolean {
        const selected = this.getSelectedItems();
        if (selected.length === 0) return false;
        if (this.retornoForm.invalid) return false;
        return selected.every(item => this.isItemValid(item));
    }

    // ========================================================================
    // SUMMARY & STATISTICS
    // ========================================================================
    getResumenPorCondicion(): ResumenCondicion {
        const selected = this.getSelectedItems();
        return {
            buenos: selected.filter(i => i.condicion === 'BUENO').length,
            danados: selected.filter(i => i.condicion === 'DAÑADO').length,
            calibracion: selected.filter(i => i.condicion === 'REQUIERE_CALIBRACION').length,
            faltantes: selected.filter(i => i.condicion === 'FALTANTE').length,
            pendientes: selected.filter(i => !i.condicion).length
        };
    }

    getTotalEnviado(): number {
        return this.getSelectedItems().reduce((sum, item) => sum + item.cantidadEnviada, 0);
    }

    getTotalRetornado(): number {
        return this.getSelectedItems().reduce((sum, item) => sum + item.cantidadRetorna, 0);
    }

    getItemsCriticos(): TraspasoItem[] {
        return this.getSelectedItems().filter(item =>
            (item.diasFuera && item.diasFuera > 30) || item.tipoEnvio === 'AOG'
        );
    }

    // ========================================================================
    // UI HELPERS
    // ========================================================================
    getCondicionConfig(condicion: CondicionRetorno | '') {
        return this.condiciones.find(c => c.value === condicion);
    }

    getTipoEnvioConfig(tipo: TipoEnvio) {
        return this.tiposEnvio.find(t => t.value === tipo);
    }

    getRowClass(item: TraspasoItem): string {
        if (!item.selected) return '';
        switch (item.condicion) {
            case 'BUENO': return 'bg-green-50 dark:bg-green-900/10 border-green-400';
            case 'DAÑADO': return 'bg-red-50 dark:bg-red-900/10 border-red-400';
            case 'REQUIERE_CALIBRACION': return 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-400';
            case 'FALTANTE': return 'bg-red-100 dark:bg-red-900/20 border-red-500';
            default: return 'row-selected border-black';
        }
    }

    getDiasFueraClass(dias: number | undefined): string {
        if (!dias) return 'bg-gray-100 text-gray-600';
        if (dias <= 7) return 'bg-green-100 text-green-800 border-green-500';
        if (dias <= 15) return 'bg-yellow-100 text-yellow-800 border-yellow-500';
        if (dias <= 30) return 'bg-orange-100 text-orange-800 border-orange-500';
        return 'bg-red-100 text-red-800 border-red-500';
    }

    private calcularDiasFuera(fechaEnvio: string): number {
        const envio = new Date(fechaEnvio);
        const hoy = new Date();
        const diffTime = Math.abs(hoy.getTime() - envio.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // ========================================================================
    // ACTIONS
    // ========================================================================
    goBack(): void {
        if (this.getSelectedItems().length > 0) {
            if (!confirm('¿Está seguro de salir? Hay items seleccionados no guardados.')) return;
        }
        this.dialogRef ? this.dialogRef.close() : this.router.navigate(['/entradas']);
    }

    openConfirmModal(): void {
        if (!this.canProceed()) {
            if (this.getSelectedCount() === 0) {
                this.showMessage('Seleccione herramientas', 'warning');
                return;
            }
            this.retornoForm.markAllAsTouched();
            if (this.retornoForm.invalid) {
                this.showMessage('Complete datos de recepción', 'error');
                return;
            }

            const invalidItems = this.getSelectedItems().filter(i => !this.isItemValid(i));
            if (invalidItems.length > 0) {
                this.showMessage(`${invalidItems.length} item(s) con errores`, 'error');
                invalidItems.forEach(i => i.expanded = true);
                return;
            }
        }
        this.showConfirmModal = true;
    }

    closeConfirmModal(): void {
        this.showConfirmModal = false;
    }

    finalizar(): void {
        if (!this.canProceed()) return;
        this.closeConfirmModal();
        this.isSaving = true;

        const selectedItems = this.getSelectedItems();
        const formValue = this.retornoForm.value;
        const entryReason = this.tipoOrigenActivo === 'BASE' ? 'base_return' : 'return';

        const retornoData: CreateMovement = {
            type: 'entry' as MovementType,
            entryReason: entryReason as EntryReason,
            date: formValue.fechaRetorno,
            movementNumber: formValue.nroDocumento,
            sourceWarehouseId: formValue.ubicacionOrigen.id,
            notes: formValue.observaciones,
            responsiblePerson: formValue.responsableRecibe?.nombre || '',
            items: selectedItems.map(item => ({
                toolId: item.toolId,
                codigo: item.codigo,
                descripcion: item.descripcion,
                pn: item.pn,
                sn: item.sn,
                marca: item.marca,
                quantity: item.cantidadRetorna,
                cantidadEnviada: item.cantidadEnviada,
                condicion: item.condicion,
                nroNotaSalida: item.nroNotaSalida,
                tipoEnvio: item.tipoEnvio,
                ordenTrabajo: item.ordenTrabajo,
                matriculaAeronave: item.matriculaAeronave,
                diasFuera: item.diasFuera,
                notes: item.observacionItem
            }))
        };

        this.movementService.createEntry(retornoData).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSaving = false)
        ).subscribe({
            next: (response) => {
                this.showMessage('Retorno guardado exitosamente', 'success');
                const selectedIds = selectedItems.map(i => i.id);
                this.allData = this.allData.filter(item => !selectedIds.includes(item.id));
                this.dataSource = this.dataSource.filter(item => !selectedIds.includes(item.id));
                if (this.dialogRef) this.dialogRef.close({ success: true, data: response });
            },
            error: (err) => {
                console.error(err);
                this.showMessage('Error al guardar el retorno', 'error');
            }
        });
    }

    clearSearch(): void {
        this.retornoForm.patchValue({ searchText: '' });
    }

    async realizarConsulta() {
        const { ConsultaMovimientosComponent } = await import('../consulta-movimientos/consulta-movimientos.component');
        this.dialog.open(ConsultaMovimientosComponent, { width: '95vw', maxWidth: '1400px', height: '90vh' });
    }

    hasError(field: string, error: string): boolean {
        const control = this.retornoForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    private showMessage(message: string, type: string): void {
        this.snackBar.open(message, 'OK', { duration: 3000, panelClass: [`snackbar-${type}`] });
    }
}
