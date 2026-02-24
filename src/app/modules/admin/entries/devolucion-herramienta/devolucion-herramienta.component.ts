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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';
import { CreateMovement } from '../../../../core/models/movement.types';

interface Funcionario {
    id: string;
    licencia: string;
    nombreCompleto: string;
    cargo?: string;
    departamento?: string;
    area?: string;
}

interface DevolucionItem {
    fila: number;
    toolId?: string;
    codigo: string;
    descripcion: string;
    pn: string;
    sn: string;
    marca?: string;
    fechaPrestamo: string;
    cantidadPrestada: number;
    cantidadDevolver: number;
    nroNotaSalida: string;
    aeronave: string;
    ordenTrabajo?: string;
    tipoPrestamo: 'OT' | 'EVENTUAL' | 'PERSONAL' | 'AOG';
    diasFuera: number;
    condicionDevolucion: 'BUENO' | 'DAÑADO' | 'IRREPARABLE' | 'REQUIERE_CALIBRACION';
    observacionItem: string;
    selected: boolean;
}

type CondicionDevolucion = 'BUENO' | 'DAÑADO' | 'IRREPARABLE' | 'REQUIERE_CALIBRACION';

@Component({
    selector: 'app-devolucion-herramienta',
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
        MatAutocompleteModule,
        MatTooltipModule,
        MatCheckboxModule,
        DragDropModule
    ],
    templateUrl: './devolucion-herramienta.component.html',
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

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

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
export class DevolucionHerramientaComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<DevolucionHerramientaComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);

    private _unsubscribeAll = new Subject<void>();

    // Formulario reactivo
    devolucionForm!: FormGroup;

    // Estados
    isLoading = false;
    isSaving = false;
    isSearching = false;
    showConfirmation = false;

    // Listas
    funcionarios: Funcionario[] = [];
    funcionariosFiltrados: Funcionario[] = [];
    tiposDevolucion = [
        { value: 'PRESTAMO', label: 'PRÉSTAMO' },
        { value: 'ASIGNACION', label: 'ASIGNACIÓN' },
        { value: 'TEMPORAL', label: 'TEMPORAL' }
    ];

    tiposPrestamo = [
        { value: 'OT', label: 'Orden de Trabajo', color: 'bg-blue-100 text-blue-800' },
        { value: 'EVENTUAL', label: 'Eventual', color: 'bg-green-100 text-green-800' },
        { value: 'PERSONAL', label: 'Personal', color: 'bg-purple-100 text-purple-800' },
        { value: 'AOG', label: 'AOG', color: 'bg-red-100 text-red-800' }
    ];

    condiciones: { value: CondicionDevolucion; label: string; color: string; icon: string }[] = [
        { value: 'BUENO', label: 'BUENO', color: 'bg-green-100 text-green-800 border-green-500', icon: 'check_circle' },
        { value: 'DAÑADO', label: 'DAÑADO', color: 'bg-red-100 text-red-800 border-red-500', icon: 'warning' },
        { value: 'IRREPARABLE', label: 'IRREPARABLE', color: 'bg-gray-100 text-gray-800 border-gray-500', icon: 'cancel' },
        { value: 'REQUIERE_CALIBRACION', label: 'REQ. CALIBRACIÓN', color: 'bg-amber-100 text-amber-800 border-amber-500', icon: 'build' }
    ];

    displayedColumns: string[] = [
        'select', 'fila', 'codigo', 'descripcion', 'pn', 'sn',
        'tipoPrestamo', 'aeronave', 'fechaPrestamo', 'diasFuera',
        'cantidadPrestada', 'cantidadDevolver', 'condicion', 'observacionItem'
    ];

    dataSource: DevolucionItem[] = [];

    constructor() {}

    ngOnInit(): void {
        this.initForm();
        this.loadInitialData();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private initForm(): void {
        this.devolucionForm = this.fb.group({
            funcionario: ['', Validators.required],
            tipoDe: ['PRESTAMO'],
            codigoHerramienta: [''],
            fechaDevolucion: [new Date().toISOString().split('T')[0], Validators.required],
            responsableRecibe: ['', Validators.required],
            observaciones: ['']
        });

        // Filtrar funcionarios mientras escribe
        this.devolucionForm.get('funcionario')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll),
            debounceTime(300),
            distinctUntilChanged()
        ).subscribe(value => {
            this.filtrarFuncionarios(value);
        });
    }

    private loadInitialData(): void {
        this.isLoading = true;

        this.movementService.getPersonal().pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (data) => {
                this.funcionarios = data.map((p: any) => ({
                    id: p.id || p.id_personal,
                    licencia: p.licencia || p.nro_licencia || '',
                    nombreCompleto: `${p.nombre || ''} ${p.apellido_paterno || ''} ${p.apellido_materno || ''}`.trim(),
                    cargo: p.cargo || '',
                    departamento: p.departamento || '',
                    area: p.area || ''
                }));
                this.funcionariosFiltrados = [...this.funcionarios];
            },
            error: () => {
                // Personal técnico de BoA (datos mock realistas)
                this.funcionarios = [
                    { id: '1', licencia: 'TMA-1245', nombreCompleto: 'Gabriel Cruz Mamani', cargo: 'Técnico TMA A&P', departamento: 'Mantenimiento Línea', area: 'VVI' },
                    { id: '2', licencia: 'TMA-0987', nombreCompleto: 'Marco Antonio Quispe Condori', cargo: 'Inspector de Calidad', departamento: 'Control de Calidad', area: 'VVI' },
                    { id: '3', licencia: 'TMA-1456', nombreCompleto: 'Carlos Alberto Flores Rojas', cargo: 'Supervisor Hangar', departamento: 'Hangar Mayor', area: 'VVI' },
                    { id: '4', licencia: 'TMA-0856', nombreCompleto: 'Luis Fernando Choque Vargas', cargo: 'Técnico Aviónica', departamento: 'Aviónica', area: 'VVI' },
                    { id: '5', licencia: 'TMA-1123', nombreCompleto: 'Roberto Limachi Apaza', cargo: 'Jefe de Almacén', departamento: 'Almacén Herramientas', area: 'VVI' },
                    { id: '6', licencia: 'TMA-0745', nombreCompleto: 'María Elena Torrez Huanca', cargo: 'Analista Técnico', departamento: 'Ingeniería', area: 'LPB' },
                    { id: '7', licencia: 'TMA-1378', nombreCompleto: 'Jorge Luis Mamani Calle', cargo: 'Técnico Estructuras', departamento: 'Estructuras', area: 'VVI' },
                    { id: '8', licencia: 'TMA-0923', nombreCompleto: 'Edwin Paco Mendoza', cargo: 'Técnico Motores', departamento: 'Planta Motriz', area: 'VVI' },
                    { id: '9', licencia: 'TMA-1567', nombreCompleto: 'Fernando Rojas Condori', cargo: 'Técnico Línea', departamento: 'Línea de Vuelo', area: 'CBB' },
                    { id: '10', licencia: 'TMA-0654', nombreCompleto: 'Patricia Villca Quispe', cargo: 'Asistente Almacén', departamento: 'Almacén', area: 'VVI' },
                    { id: '11', licencia: 'TMA-1890', nombreCompleto: 'Ricardo Huanca Mamani', cargo: 'Técnico NDT', departamento: 'Ensayos No Destructivos', area: 'VVI' },
                    { id: '12', licencia: 'TMA-0412', nombreCompleto: 'Diego Álvarez Fernández', cargo: 'Técnico Hidráulica', departamento: 'Sistemas', area: 'VVI' }
                ];
                this.funcionariosFiltrados = [...this.funcionarios];
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

    displayFuncionario(funcionario: Funcionario): string {
        return funcionario ? `${funcionario.licencia} - ${funcionario.nombreCompleto}` : '';
    }

    goBack(): void {
        if (this.dataSource.some(item => item.selected)) {
            if (!confirm('¿Está seguro de salir? Hay items seleccionados que no se han procesado.')) {
                return;
            }
        }

        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/entradas']);
        }
    }

    realizarConsulta(): void {
        const funcionario = this.devolucionForm.get('funcionario')?.value;

        if (!funcionario || typeof funcionario === 'string') {
            this.showMessage('Seleccione un funcionario de la lista', 'warning');
            return;
        }

        this.isSearching = true;

        // Buscar herramientas prestadas al funcionario
        this.movementService.getMovements({
            movement_type: 'exit',
            exitReason: 'loan',
            recipient: funcionario.id,
            status: 'completed'
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSearching = false)
        ).subscribe({
            next: (data) => {
                if (data && data.length > 0) {
                    this.dataSource = data.flatMap((mov: any, movIndex: number) => {
                        const items = mov.items || [];
                        const fechaPrestamo = mov.date || '';
                        return items.map((item: any, itemIndex: number) => ({
                            fila: movIndex * 100 + itemIndex + 1,
                            toolId: item.toolId || item.tool?.id || '',
                            codigo: item.tool?.code || item.codigo || '',
                            descripcion: item.tool?.description || item.descripcion || '',
                            pn: item.tool?.partNumber || item.pn || '',
                            sn: item.tool?.serialNumber || item.sn || '',
                            marca: item.tool?.brand || item.marca || '',
                            fechaPrestamo: fechaPrestamo,
                            cantidadPrestada: item.quantity || 1,
                            cantidadDevolver: item.quantity || 1,
                            nroNotaSalida: mov.movementNumber || '',
                            aeronave: mov.aircraft || mov.aeronave || '',
                            ordenTrabajo: mov.workOrder || mov.ordenTrabajo || '',
                            tipoPrestamo: mov.loanType || mov.tipoPrestamo || 'EVENTUAL',
                            diasFuera: fechaPrestamo ? this.calcularDiasFuera(fechaPrestamo) : 0,
                            condicionDevolucion: 'BUENO' as CondicionDevolucion,
                            observacionItem: '',
                            selected: false
                        }));
                    });
                    // Renumerar filas
                    this.dataSource.forEach((item, idx) => item.fila = idx + 1);
                    this.showMessage(`Se encontraron ${this.dataSource.length} herramienta(s)`, 'success');
                } else {
                    this.loadMockData(funcionario);
                }
            },
            error: () => {
                this.loadMockData(funcionario);
            }
        });
    }

    private loadMockData(funcionario: Funcionario): void {
        // Datos de ejemplo con estructura completa basada en préstamos reales de BoA
        this.dataSource = [
            {
                fila: 1,
                toolId: 'tool-001',
                codigo: 'BOA-H-0456',
                descripcion: 'Torquímetro Digital 50-250 lb-ft SNAP-ON',
                pn: 'TECH3FR250',
                sn: 'TQ-2024-0456',
                marca: 'SNAP-ON',
                fechaPrestamo: '2026-01-20',
                cantidadPrestada: 1,
                cantidadDevolver: 1,
                nroNotaSalida: 'PR-2026-0045',
                aeronave: 'CP-3108',
                ordenTrabajo: 'OT-2026-0089',
                tipoPrestamo: 'OT',
                diasFuera: this.calcularDiasFuera('2026-01-20'),
                condicionDevolucion: 'BUENO',
                observacionItem: '',
                selected: false
            },
            {
                fila: 2,
                toolId: 'tool-002',
                codigo: 'BOA-H-0234',
                descripcion: 'Multímetro Digital FLUKE 87V',
                pn: 'FLUKE-87V',
                sn: 'FL-2023-0234',
                marca: 'FLUKE',
                fechaPrestamo: '2026-01-15',
                cantidadPrestada: 1,
                cantidadDevolver: 1,
                nroNotaSalida: 'PR-2026-0038',
                aeronave: 'CP-3105',
                ordenTrabajo: 'OT-2026-0067',
                tipoPrestamo: 'OT',
                diasFuera: this.calcularDiasFuera('2026-01-15'),
                condicionDevolucion: 'BUENO',
                observacionItem: '',
                selected: false
            },
            {
                fila: 3,
                toolId: 'tool-003',
                codigo: 'BOA-H-0789',
                descripcion: 'Juego de Llaves Allen Métrico (1.5-10mm) FACOM',
                pn: 'FACOM-89SH.JP9A',
                sn: 'JLA-2024-0789',
                marca: 'FACOM',
                fechaPrestamo: '2026-01-22',
                cantidadPrestada: 1,
                cantidadDevolver: 1,
                nroNotaSalida: 'PR-2026-0052',
                aeronave: '',
                ordenTrabajo: '',
                tipoPrestamo: 'PERSONAL',
                diasFuera: this.calcularDiasFuera('2026-01-22'),
                condicionDevolucion: 'BUENO',
                observacionItem: '',
                selected: false
            },
            {
                fila: 4,
                toolId: 'tool-004',
                codigo: 'BOA-H-0567',
                descripcion: 'Boroscopio Flexible 3m OLYMPUS IPLEX',
                pn: 'IPLEX-NX',
                sn: 'BR-2023-0567',
                marca: 'OLYMPUS',
                fechaPrestamo: '2026-01-10',
                cantidadPrestada: 1,
                cantidadDevolver: 1,
                nroNotaSalida: 'PR-2026-0028',
                aeronave: 'CP-3102',
                ordenTrabajo: 'OT-2026-0055',
                tipoPrestamo: 'OT',
                diasFuera: this.calcularDiasFuera('2026-01-10'),
                condicionDevolucion: 'BUENO',
                observacionItem: '',
                selected: false
            },
            {
                fila: 5,
                toolId: 'tool-005',
                codigo: 'BOA-H-0123',
                descripcion: 'Pinza Amperimétrica FLUKE 376 FC',
                pn: 'FLUKE-376FC',
                sn: 'PA-2023-0123',
                marca: 'FLUKE',
                fechaPrestamo: '2026-01-25',
                cantidadPrestada: 1,
                cantidadDevolver: 1,
                nroNotaSalida: 'PR-2026-0061',
                aeronave: 'CP-3110',
                ordenTrabajo: 'OT-2026-0095',
                tipoPrestamo: 'AOG',
                diasFuera: this.calcularDiasFuera('2026-01-25'),
                condicionDevolucion: 'BUENO',
                observacionItem: '',
                selected: false
            },
            {
                fila: 6,
                toolId: 'tool-006',
                codigo: 'BOA-H-0345',
                descripcion: 'Calibrador Vernier Digital 0-150mm MITUTOYO',
                pn: '500-196-30',
                sn: 'CV-2024-0345',
                marca: 'MITUTOYO',
                fechaPrestamo: '2026-01-05',
                cantidadPrestada: 2,
                cantidadDevolver: 2,
                nroNotaSalida: 'PR-2026-0015',
                aeronave: '',
                ordenTrabajo: '',
                tipoPrestamo: 'EVENTUAL',
                diasFuera: this.calcularDiasFuera('2026-01-05'),
                condicionDevolucion: 'BUENO',
                observacionItem: '',
                selected: false
            },
            {
                fila: 7,
                toolId: 'tool-007',
                codigo: 'BOA-H-0678',
                descripcion: 'Medidor de Espesor Ultrasónico OLYMPUS',
                pn: '38DL-PLUS',
                sn: 'ME-2024-0678',
                marca: 'OLYMPUS',
                fechaPrestamo: '2025-12-20',
                cantidadPrestada: 1,
                cantidadDevolver: 1,
                nroNotaSalida: 'PR-2025-0289',
                aeronave: 'CP-3108',
                ordenTrabajo: 'OT-2025-0445',
                tipoPrestamo: 'OT',
                diasFuera: this.calcularDiasFuera('2025-12-20'),
                condicionDevolucion: 'BUENO',
                observacionItem: '',
                selected: false
            }
        ];
        this.showMessage(`Se encontraron ${this.dataSource.length} herramienta(s) prestadas a ${funcionario.nombreCompleto}`, 'info');
    }

    private calcularDiasFuera(fechaPrestamo: string): number {
        const prestamo = new Date(fechaPrestamo);
        const hoy = new Date();
        const diffTime = Math.abs(hoy.getTime() - prestamo.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    getTipoPrestamoClass(tipo: string): string {
        const tipoPrestamo = this.tiposPrestamo.find(t => t.value === tipo);
        return tipoPrestamo ? tipoPrestamo.color : 'bg-gray-100 text-gray-800';
    }

    getDiasFueraClass(dias: number): string {
        if (dias <= 3) return 'bg-green-100 text-green-800';
        if (dias <= 7) return 'bg-yellow-100 text-yellow-800';
        if (dias <= 15) return 'bg-orange-100 text-orange-800';
        return 'bg-red-100 text-red-800';
    }

    toggleSelection(item: DevolucionItem): void {
        item.selected = !item.selected;
    }

    toggleAllSelection(event: any): void {
        const checked = event.checked;
        this.dataSource.forEach(item => item.selected = checked);
    }

    isAllSelected(): boolean {
        return this.dataSource.length > 0 && this.dataSource.every(item => item.selected);
    }

    isSomeSelected(): boolean {
        return this.dataSource.some(item => item.selected) && !this.isAllSelected();
    }

    getSelectedCount(): number {
        return this.dataSource.filter(item => item.selected).length;
    }

    getSelectedItems(): DevolucionItem[] {
        return this.dataSource.filter(item => item.selected);
    }

    onCondicionChange(item: DevolucionItem): void {
        // Si la condición es BUENO, limpiar observación
        if (item.condicionDevolucion === 'BUENO') {
            item.observacionItem = '';
        }
    }

    getCondicionClass(condicion: CondicionDevolucion): string {
        const cond = this.condiciones.find(c => c.value === condicion);
        return cond ? cond.color : '';
    }

    getCondicionIcon(condicion: CondicionDevolucion): string {
        const cond = this.condiciones.find(c => c.value === condicion);
        return cond ? cond.icon : 'help';
    }

    validateItems(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const selectedItems = this.getSelectedItems();

        if (selectedItems.length === 0) {
            errors.push('Seleccione al menos una herramienta para devolver');
            return { valid: false, errors };
        }

        const fechaDevolucion = new Date(this.devolucionForm.value.fechaDevolucion);

        selectedItems.forEach((item, idx) => {
            // Validar cantidad
            if (item.cantidadDevolver <= 0) {
                errors.push(`Item ${item.fila}: La cantidad a devolver debe ser mayor a 0`);
            }
            if (item.cantidadDevolver > item.cantidadPrestada) {
                errors.push(`Item ${item.fila}: La cantidad a devolver no puede ser mayor a la prestada (${item.cantidadPrestada})`);
            }

            // Validar observación si condición no es BUENO
            if (item.condicionDevolucion !== 'BUENO' && !item.observacionItem.trim()) {
                errors.push(`Item ${item.fila} (${item.codigo}): La observación es obligatoria cuando la condición es ${item.condicionDevolucion}`);
            }

            // Validar fecha de devolución >= fecha de préstamo
            const fechaPrestamo = new Date(item.fechaPrestamo);
            if (fechaDevolucion < fechaPrestamo) {
                errors.push(`Item ${item.fila}: La fecha de devolución no puede ser anterior a la fecha de préstamo`);
            }
        });

        return { valid: errors.length === 0, errors };
    }

    procesar(): void {
        const validation = this.validateItems();

        if (!validation.valid) {
            validation.errors.forEach(err => this.showMessage(err, 'error'));
            return;
        }

        // Mostrar modal de confirmación
        this.showConfirmation = true;
    }

    cancelarConfirmacion(): void {
        this.showConfirmation = false;
    }

    getResumenPorCondicion(): { condicion: string; cantidad: number; color: string }[] {
        const selectedItems = this.getSelectedItems();
        const resumen: { [key: string]: number } = {};

        selectedItems.forEach(item => {
            resumen[item.condicionDevolucion] = (resumen[item.condicionDevolucion] || 0) + 1;
        });

        return Object.entries(resumen).map(([condicion, cantidad]) => ({
            condicion: this.condiciones.find(c => c.value === condicion)?.label || condicion,
            cantidad,
            color: this.condiciones.find(c => c.value === condicion)?.color || ''
        }));
    }

    finalizar(): void {
        const validation = this.validateItems();

        if (!validation.valid) {
            validation.errors.forEach(err => this.showMessage(err, 'error'));
            return;
        }

        const funcionario = this.devolucionForm.get('funcionario')?.value;
        if (!funcionario || typeof funcionario === 'string') {
            this.showMessage('Debe seleccionar un funcionario', 'error');
            return;
        }

        if (!this.devolucionForm.value.responsableRecibe?.trim()) {
            this.showMessage('Debe ingresar el responsable que recibe', 'error');
            return;
        }

        this.showConfirmation = false;
        this.isSaving = true;

        const selectedItems = this.getSelectedItems();

        const devolucionData: CreateMovement = {
            type: 'entry',
            entryReason: 'return',
            date: this.devolucionForm.value.fechaDevolucion,
            notes: this.devolucionForm.value.observaciones,
            responsiblePerson: this.devolucionForm.value.responsableRecibe,
            recipient: funcionario.nombreCompleto,
            items: selectedItems.map(item => ({
                toolId: item.toolId,
                codigo: item.codigo,
                descripcion: item.descripcion,
                pn: item.pn,
                sn: item.sn,
                marca: item.marca,
                quantity: item.cantidadDevolver,
                cantidad: item.cantidadDevolver,
                cantidadPrestada: item.cantidadPrestada,
                nroNotaSalida: item.nroNotaSalida,
                aeronave: item.aeronave,
                ordenTrabajo: item.ordenTrabajo,
                tipoPrestamo: item.tipoPrestamo,
                diasFuera: item.diasFuera,
                condicion: item.condicionDevolucion,
                notes: item.observacionItem
            }))
        };

        this.movementService.createEntry(devolucionData).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSaving = false)
        ).subscribe({
            next: (response) => {
                this.showMessage('Devolución registrada exitosamente', 'success');

                // Manejar devoluciones parciales: solo remover si se devolvió todo
                this.dataSource = this.dataSource.filter(item => {
                    if (!item.selected) return true;
                    // Si devolvió cantidad completa, remover
                    return item.cantidadDevolver < item.cantidadPrestada;
                });

                // Actualizar cantidades pendientes para devoluciones parciales
                this.dataSource.forEach(item => {
                    if (item.selected && item.cantidadDevolver < item.cantidadPrestada) {
                        item.cantidadPrestada = item.cantidadPrestada - item.cantidadDevolver;
                        item.cantidadDevolver = item.cantidadPrestada;
                        item.selected = false;
                    }
                });

                // Renumerar filas
                this.dataSource.forEach((item, index) => item.fila = index + 1);

                if (this.dialogRef) {
                    this.dialogRef.close({ success: true, data: response });
                }
            },
            error: (err) => {
                console.error('Error al guardar:', err);
                this.showMessage('Error al registrar la devolución. Intente nuevamente.', 'error');
            }
        });
    }

    async openConsultaMovimientos(): Promise<void> {
        const { ConsultaMovimientosComponent } = await import('../consulta-movimientos/consulta-movimientos.component');
        this.dialog.open(ConsultaMovimientosComponent, {
            width: '1400px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '95vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        const config: any = {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        };
        this.snackBar.open(message, 'Cerrar', config);
    }

    hasError(field: string, error: string): boolean {
        const control = this.devolucionForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }
}
