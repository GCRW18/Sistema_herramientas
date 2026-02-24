import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

interface InternalLoanItem {
    id: number;
    codigo: string;
    pn: string;
    descripcion: string;
    sn: string;
    marca: string;
    fechaCalibracion: string;
    cantidad: number;
    unidad: string;
    estado: string;
    contenido: string;
}

interface ExternalLoanItem {
    id: number;
    codigo: string;
    pn: string;
    descripcion: string;
    sn: string;
    marca: string;
    fechaCalibracion: string;
    cantidad: number;
    horas: number;
    estado: string;
    contenido: string;
    costoHora: number;
    precioTotal: number;
}

interface Tecnico {
    id: string;
    nroLicencia: string;
    apPaterno: string;
    apMaterno: string;
    nombres: string;
    cargo: string;
    area: string;
    base: string;
}

interface EmpresaTercero {
    id: string;
    nombre: string;
    nit: string;
    tipo: string;
    contacto: string;
    telefono: string;
    email: string;
}

interface Aeronave {
    matricula: string;
    tipo: string;
    modelo: string;
    msn: string;
}

interface HerramientaOption {
    codigo: string;
    nombre: string;
    pn: string;
    sn: string;
    marca: string;
    ubicacion: string;
    existencia: number;
    fechaVencimiento: string;
    unidad: string;
    estado: string;
    costoHora: number;
    imagen?: string;
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
        MatAutocompleteModule,
        MatTooltipModule,
        DragDropModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './prestamo-terceros.component.html',
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

        /* --- ESTILOS INPUTS MATERIAL TIPO 'NEO' --- */
        .compact-form-field ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: white !important;
            border: 2px solid black !important;
            border-radius: 8px !important;
            padding: 0 12px !important;
            height: 42px !important;
            min-height: unset !important;
            display: flex;
            align-items: center;
            box-shadow: 2px 2px 0px 0px rgba(0,0,0,0.1);
            transition: all 0.2s;
        }

        .compact-form-field.mat-focused ::ng-deep .mat-mdc-text-field-wrapper,
        .compact-form-field:hover ::ng-deep .mat-mdc-text-field-wrapper {
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);
            transform: translate(-1px, -1px);
        }

        .compact-form-field ::ng-deep .mat-mdc-input-element {
            color: black !important;
            font-weight: 600;
        }

        .compact-form-field ::ng-deep .mat-mdc-input-element::placeholder {
            color: rgba(0,0,0,0.6) !important;
        }
        .compact-form-field ::ng-deep .mat-icon {
            color: black !important;
        }

        :host-context(.dark) .compact-form-field ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: #0F172AFF !important;
            border-color: #475569 !important;
            box-shadow: none !important;
        }

        :host-context(.dark) .compact-form-field ::ng-deep .mat-mdc-input-element {
            color: white !important;
        }

        :host-context(.dark) .compact-form-field ::ng-deep .mat-mdc-input-element::placeholder {
            color: rgba(255,255,255,0.5) !important;
        }

        :host-context(.dark) .compact-form-field ::ng-deep .mat-icon {
            color: white !important;
        }

        ::ng-deep .mat-mdc-form-field-subscript-wrapper {
            display: none !important;
        }
        ::ng-deep .mat-mdc-form-field-infix {
            padding-top: 6px !important;
            padding-bottom: 6px !important;
            min-height: unset !important;
        }

        /* --- AUTOCOMPLETE STYLES --- */
        :host ::ng-deep .mat-mdc-autocomplete-panel {
            border: 2px solid black !important;
            border-radius: 8px !important;
            box-shadow: 4px 4px 0px 0px rgba(0,0,0,1) !important;
            margin-top: 4px !important;
        }

        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999;
        }
        :host-context(.dark) .spinner-overlay {
            background: rgba(0,0,0,0.7);
        }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
    `]
})
export class PrestamoTercerosComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<PrestamoTercerosComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private destroy$ = new Subject<void>();

    currentView = signal<ViewMode>('internal');
    internalForm!: FormGroup;
    externalForm!: FormGroup;
    externalToolForm!: FormGroup;
    isSaving = false;

    // Mensajes de feedback
    message = signal<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);

    // Números de nota
    nroNotaInterno = signal<string>('PI-001/2026');
    nroNotaExterno = signal<string>('PE-001/2026');

    // Data Source
    internalDataSource = signal<InternalLoanItem[]>([
        {
            id: 1,
            codigo: 'BOA-H-0001',
            pn: 'TRQ-2502D',
            descripcion: 'TORQUÍMETRO DIGITAL 50-250 IN-LB',
            sn: 'TRQ-2024-001',
            marca: 'SNAP-ON',
            fechaCalibracion: '2025-06-15',
            cantidad: 2,
            unidad: 'PZA',
            estado: 'SERVICEABLE',
            contenido: 'INCLUYE MALETÍN Y BATERÍAS'
        }
    ]);

    externalDataSource = signal<ExternalLoanItem[]>([
        {
            id: 1,
            codigo: 'BOA-H-0007',
            pn: 'MJ-10T-TP',
            descripcion: 'GATO HIDRÁULICO TRIPODE 10T',
            sn: 'GAT-2024-001',
            marca: 'MALABAR',
            fechaCalibracion: '2025-12-01',
            cantidad: 1,
            horas: 8,
            estado: 'SERVICEABLE',
            contenido: 'EQUIPO PARA MANTENIMIENTO',
            costoHora: 75.00,
            precioTotal: 600.00
        }
    ]);

    // Importe total para vista externa
    importeTotal = signal<number>(600.00);

    // Signals for external tool form
    selectedImageExternal = signal<string | null>(null);
    coincidenciasExternal = signal<number>(0);
    precioTotalExternal = signal<number>(0);

    // Técnicos de BoA
    tecnicos: Tecnico[] = [
        { id: 'T001', nroLicencia: 'LAB-2021-0145', apPaterno: 'Mamani', apMaterno: 'Quispe', nombres: 'Juan Carlos', cargo: 'Técnico A&P', area: 'Línea', base: 'VVI' },
        { id: 'T002', nroLicencia: 'LAB-2019-0089', apPaterno: 'Fernández', apMaterno: 'Vargas', nombres: 'Roberto', cargo: 'Inspector de Calidad', area: 'Hangar', base: 'VVI' },
        { id: 'T003', nroLicencia: 'LAB-2020-0156', apPaterno: 'Condori', apMaterno: 'Flores', nombres: 'María Elena', cargo: 'Técnico Aviónica', area: 'Aviónica', base: 'VVI' },
        { id: 'T004', nroLicencia: 'LAB-2018-0067', apPaterno: 'Gutiérrez', apMaterno: 'Rojas', nombres: 'Pedro', cargo: 'Técnico A&P', area: 'Taller', base: 'LPB' },
        { id: 'T005', nroLicencia: 'LAB-2022-0201', apPaterno: 'Torrez', apMaterno: 'Mendoza', nombres: 'Ana Lucia', cargo: 'Técnico Estructuras', area: 'Hangar', base: 'VVI' }
    ];

    filteredTecnicos: Tecnico[] = [];

    // Empresas terceras
    empresasTerceras: EmpresaTercero[] = [
        { id: 'E001', nombre: 'Amaszonas S.A.', nit: '1023456789', tipo: 'Aerolínea', contacto: 'Ing. Mario Vargas', telefono: '+591 3 3364446', email: 'mantenimiento@amaszonas.com' },
        { id: 'E002', nombre: 'TAB - Transportes Aéreos Bolivianos', nit: '2034567890', tipo: 'Aerolínea', contacto: 'Lic. Carmen Peña', telefono: '+591 2 2810808', email: 'operaciones@tab.bo' },
        { id: 'E003', nombre: 'Ecojet Bolivia', nit: '3045678901', tipo: 'Aerolínea', contacto: 'Ing. Fernando Silva', telefono: '+591 3 3536363', email: 'mro@ecojet.bo' }
    ];

    filteredEmpresas: EmpresaTercero[] = [];

    // Aeronaves de la flota BoA
    aeronaves: Aeronave[] = [
        { matricula: 'CP-2880', tipo: 'Boeing 737-800', modelo: 'B738', msn: '41561' },
        { matricula: 'CP-2881', tipo: 'Boeing 737-800', modelo: 'B738', msn: '41562' },
        { matricula: 'CP-2882', tipo: 'Boeing 737-800', modelo: 'B738', msn: '41563' },
        { matricula: 'CP-3100', tipo: 'Boeing 737 MAX 8', modelo: 'B38M', msn: '44512' },
        { matricula: 'N/A', tipo: 'No Aplica', modelo: 'N/A', msn: 'N/A' }
    ];

    // Herramientas disponibles
    herramientasExternal: HerramientaOption[] = [
        { codigo: 'BOA-H-0001', nombre: 'TORQUÍMETRO DIGITAL 50-250 IN-LB', pn: 'TRQ-2502D', sn: 'TRQ-2024-001', marca: 'SNAP-ON', ubicacion: 'VVI-EST-A1', existencia: 2, fechaVencimiento: '2025-06-15', unidad: 'PZA', estado: 'SERVICEABLE', costoHora: 25.00 },
        { codigo: 'BOA-H-0002', nombre: 'TORQUÍMETRO CLICK 150-750 IN-LB', pn: 'QC3R750A', sn: 'TRQ-2024-002', marca: 'SNAP-ON', ubicacion: 'VVI-EST-A1', existencia: 3, fechaVencimiento: '2025-08-20', unidad: 'PZA', estado: 'SERVICEABLE', costoHora: 30.00 },
        { codigo: 'BOA-H-0007', nombre: 'GATO HIDRÁULICO TRIPODE 10T', pn: 'MJ-10T-TP', sn: 'GAT-2024-001', marca: 'MALABAR', ubicacion: 'VVI-HAN-B1', existencia: 2, fechaVencimiento: '2025-12-01', unidad: 'PZA', estado: 'SERVICEABLE', costoHora: 75.00 },
        { codigo: 'BOA-H-0010', nombre: 'MULTÍMETRO DIGITAL FLUKE', pn: 'FLUKE-87V', sn: 'FLK-2024-001', marca: 'FLUKE', ubicacion: 'VVI-EST-C2', existencia: 4, fechaVencimiento: '2025-10-05', unidad: 'PZA', estado: 'SERVICEABLE', costoHora: 15.00 },
        { codigo: 'BOA-H-0019', nombre: 'PISTOLA NEUMÁTICA 1/2" 800FT-LB', pn: 'MG725', sn: 'ING-2024-001', marca: 'INGERSOLL RAND', ubicacion: 'VVI-HAN-B3', existencia: 4, fechaVencimiento: '2025-05-15', unidad: 'PZA', estado: 'SERVICEABLE', costoHora: 20.00 }
    ];

    filteredHerramientasExternal: HerramientaOption[] = [];

    // Destinos y tipos de trabajo
    destinos = ['Servicios', 'Línea', 'Taller', 'Hangar', 'Rampa'];
    tiposMotivoPrestamo = [
        { value: 'AOG', label: 'AOG - Aircraft on Ground' },
        { value: 'MANTENIMIENTO', label: 'Mantenimiento Programado' },
        { value: 'REPARACION', label: 'Reparación' },
        { value: 'APOYO', label: 'Apoyo Operacional' },
        { value: 'PRUEBA', label: 'Prueba/Ensayo' }
    ];

    ngOnInit(): void {
        this.initInternalForm();
        this.initExternalForm();
        this.initExternalToolForm();
        this.filteredTecnicos = [...this.tecnicos];
        this.filteredEmpresas = [...this.empresasTerceras];
        this.filteredHerramientasExternal = [...this.herramientasExternal];
        this.generateNroNotas();
        this.setupFormListeners();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private generateNroNotas(): void {
        const year = new Date().getFullYear();
        const numInterno = Math.floor(Math.random() * 900) + 100;
        const numExterno = Math.floor(Math.random() * 100) + 1;
        this.nroNotaInterno.set(`PI-${numInterno}/${year}`);
        this.nroNotaExterno.set(`PE-${String(numExterno).padStart(3, '0')}/${year}`);
    }

    private setupFormListeners(): void {
        // Filtrar técnicos
        this.internalForm.get('buscarTecnico')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged())
            .subscribe(value => this.filterTecnicos(value));

        // Filtrar empresas
        this.externalForm.get('buscarEmpresa')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged())
            .subscribe(value => this.filterEmpresas(value));

        // Calcular precio total cuando cambian horas o costo
        this.externalToolForm.get('horas')?.valueChanges.subscribe(() => this.calcularPrecioTotalExternal());
        this.externalToolForm.get('costoHora')?.valueChanges.subscribe(() => this.calcularPrecioTotalExternal());
    }

    private initInternalForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');

        this.internalForm = this.fb.group({
            buscarTecnico: [''],
            tecnicoSeleccionado: [null, Validators.required],
            nroLicencia: ['', Validators.required],
            apPaterno: ['', Validators.required],
            apMaterno: ['', Validators.required],
            nombres: ['', Validators.required],
            cargo: [''],
            fecha: [today, Validators.required],
            hora: [`${hours}:${minutes}`, Validators.required],
            matriculaAeronave: ['N/A'],
            ordenTrabajo: [''],
            destino: [''],
            trabajoEspecial: [false],
            observaciones: ['']
        });
    }

    private initExternalForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');

        this.externalForm = this.fb.group({
            buscarEmpresa: [''],
            empresaSeleccionada: [null, Validators.required],
            nombreEmpresa: ['', Validators.required],
            nit: [''],
            contacto: [''],
            telefono: [''],
            fecha: [today, Validators.required],
            hora: [`${hours}:${minutes}`, Validators.required],
            motivoPrestamo: ['', Validators.required],
            autorizado: [''],
            observaciones: ['']
        });
    }

    private initExternalToolForm(): void {
        this.externalToolForm = this.fb.group({
            buscar: [''],
            codigo: [''],
            nombre: [''],
            pn: [''],
            sn: [''],
            marca: [''],
            ubicacion: [''],
            existencia: [{ value: 0, disabled: true }],
            fechaVencimiento: [''],
            unidad: [''],
            estado: [''],
            costoHora: [0],
            horas: [1, [Validators.required, Validators.min(1)]],
            cantidad: [1, [Validators.required, Validators.min(1)]],
            observacion: ['']
        });
    }

    private filterTecnicos(value: string): void {
        if (!value) {
            this.filteredTecnicos = [...this.tecnicos];
            return;
        }
        const term = value.toLowerCase();
        this.filteredTecnicos = this.tecnicos.filter(t =>
            t.nombres.toLowerCase().includes(term) ||
            t.apPaterno.toLowerCase().includes(term) ||
            t.nroLicencia.toLowerCase().includes(term)
        );
    }

    private filterEmpresas(value: string): void {
        if (!value) {
            this.filteredEmpresas = [...this.empresasTerceras];
            return;
        }
        const term = value.toLowerCase();
        this.filteredEmpresas = this.empresasTerceras.filter(e =>
            e.nombre.toLowerCase().includes(term) ||
            e.tipo.toLowerCase().includes(term)
        );
    }

    onBuscarHerramientaExternal(value: string): void {
        if (!value) {
            this.filteredHerramientasExternal = [...this.herramientasExternal];
            this.coincidenciasExternal.set(0);
            return;
        }
        const term = value.toLowerCase();
        this.filteredHerramientasExternal = this.herramientasExternal.filter(h =>
            h.codigo.toLowerCase().includes(term) ||
            h.nombre.toLowerCase().includes(term) ||
            h.pn.toLowerCase().includes(term) ||
            h.marca.toLowerCase().includes(term)
        );
        this.coincidenciasExternal.set(this.filteredHerramientasExternal.length);
    }

    // ==================== MÉTODOS DE SELECCIÓN ====================
    displayTecnico(tecnico: Tecnico): string {
        return tecnico ? `${tecnico.nombres} ${tecnico.apPaterno} ${tecnico.apMaterno}` : '';
    }

    displayEmpresa(empresa: EmpresaTercero): string {
        return empresa ? `${empresa.nombre} (${empresa.tipo})` : '';
    }

    displayHerramienta(h: HerramientaOption): string {
        return h ? `${h.codigo} - ${h.nombre}` : '';
    }

    selectTecnico(tecnico: Tecnico): void {
        this.internalForm.patchValue({
            tecnicoSeleccionado: tecnico,
            nroLicencia: tecnico.nroLicencia,
            apPaterno: tecnico.apPaterno,
            apMaterno: tecnico.apMaterno,
            nombres: tecnico.nombres,
            cargo: tecnico.cargo
        });
    }

    selectEmpresa(empresa: EmpresaTercero): void {
        this.externalForm.patchValue({
            empresaSeleccionada: empresa,
            nombreEmpresa: empresa.nombre,
            nit: empresa.nit,
            contacto: empresa.contacto,
            telefono: empresa.telefono
        });
    }

    selectHerramientaExternal(herramienta: HerramientaOption): void {
        this.externalToolForm.patchValue({
            codigo: herramienta.codigo,
            nombre: herramienta.nombre,
            pn: herramienta.pn,
            sn: herramienta.sn,
            marca: herramienta.marca,
            ubicacion: herramienta.ubicacion,
            existencia: herramienta.existencia,
            fechaVencimiento: herramienta.fechaVencimiento,
            unidad: herramienta.unidad,
            estado: herramienta.estado,
            costoHora: herramienta.costoHora
        });
        this.coincidenciasExternal.set(1);
        this.calcularPrecioTotalExternal();
    }

    // ==================== CÁLCULOS ====================
    calcularPrecioTotalExternal(): void {
        const costoHora = this.externalToolForm.get('costoHora')?.value || 0;
        const horas = this.externalToolForm.get('horas')?.value || 0;
        const total = costoHora * horas;
        this.precioTotalExternal.set(total);
    }

    calcularImporteTotal(): void {
        const total = this.externalDataSource().reduce((sum, item) => sum + (item.precioTotal || 0), 0);
        this.importeTotal.set(total);
    }

    getTotalItemsInterno(): number {
        return this.internalDataSource().reduce((sum, item) => sum + item.cantidad, 0);
    }

    getTotalItemsExterno(): number {
        return this.externalDataSource().reduce((sum, item) => sum + item.cantidad, 0);
    }

    // ==================== MANEJO DE ITEMS ====================
    agregarHerramientaExternal(): void {
        const formValue = this.externalToolForm.getRawValue();
        if (!formValue.codigo) {
            this.showMessage('error', 'Seleccione una herramienta');
            return;
        }

        const newItem: ExternalLoanItem = {
            id: Date.now(),
            codigo: formValue.codigo,
            pn: formValue.pn,
            descripcion: formValue.nombre,
            sn: formValue.sn,
            marca: formValue.marca,
            fechaCalibracion: formValue.fechaVencimiento,
            cantidad: formValue.cantidad || 1,
            horas: formValue.horas || 0,
            estado: formValue.estado,
            contenido: formValue.observacion,
            costoHora: formValue.costoHora,
            precioTotal: this.precioTotalExternal()
        };

        this.externalDataSource.update(items => [...items, newItem]);
        this.calcularImporteTotal();
        this.resetExternalToolForm();
        this.showMessage('success', `Herramienta "${newItem.descripcion}" agregada`);
    }

    eliminarItemExterno(index: number): void {
        const item = this.externalDataSource()[index];
        this.externalDataSource.update(items => items.filter((_, i) => i !== index));
        this.calcularImporteTotal();
        this.showMessage('info', `Herramienta "${item.descripcion}" eliminada`);
    }

    eliminarItemInterno(index: number): void {
        const item = this.internalDataSource()[index];
        this.internalDataSource.update(items => items.filter((_, i) => i !== index));
        this.showMessage('info', `Herramienta "${item.descripcion}" eliminada`);
    }

    resetExternalToolForm(): void {
        this.externalToolForm.reset({
            buscar: '',
            codigo: '',
            nombre: '',
            pn: '',
            sn: '',
            marca: '',
            ubicacion: '',
            existencia: 0,
            fechaVencimiento: '',
            unidad: '',
            estado: '',
            costoHora: 0,
            horas: 1,
            cantidad: 1,
            observacion: ''
        });
        this.selectedImageExternal.set(null);
        this.coincidenciasExternal.set(0);
        this.precioTotalExternal.set(0);
    }

    onImageSelectedExternal(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => this.selectedImageExternal.set(reader.result as string);
            reader.readAsDataURL(file);
        }
    }

    // ==================== VISTAS Y NAVEGACIÓN ====================
    switchView(view: ViewMode): void {
        this.currentView.set(view);
    }

    goBack(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/salidas']);
        }
    }

    // ==================== PROCESAMIENTO ====================
    async procesar(): Promise<void> {
        if (this.internalDataSource().length === 0) {
            this.showMessage('error', 'Agregue al menos una herramienta');
            return;
        }

        const errors = this.getFormErrorsInternal();
        if (errors.length > 0) {
            this.showMessage('error', `Complete los campos requeridos: ${errors.length} error(es)`);
            return;
        }

        this.isSaving = true;

        // Simular procesamiento
        setTimeout(() => {
            this.isSaving = false;
            this.showMessage('success', `Nota de préstamo interno ${this.nroNotaInterno()} procesada`);

            // Aquí iría la lógica real de guardado
            console.log('Préstamo interno procesado:', {
                nota: this.nroNotaInterno(),
                form: this.internalForm.value,
                items: this.internalDataSource()
            });
        }, 1500);
    }

    async procesarExterno(): Promise<void> {
        if (this.externalDataSource().length === 0) {
            this.showMessage('error', 'Agregue al menos una herramienta');
            return;
        }

        const errors = this.getFormErrorsExternal();
        if (errors.length > 0) {
            this.showMessage('error', `Complete los campos requeridos: ${errors.length} error(es)`);
            return;
        }

        this.isSaving = true;

        // Simular procesamiento
        setTimeout(() => {
            this.isSaving = false;
            this.showMessage('success', `Nota de préstamo externo ${this.nroNotaExterno()} procesada - Total: $${this.importeTotal().toFixed(2)}`);

            // Aquí iría la lógica real de guardado
            console.log('Préstamo externo procesado:', {
                nota: this.nroNotaExterno(),
                form: this.externalForm.value,
                items: this.externalDataSource(),
                importeTotal: this.importeTotal()
            });
        }, 1500);
    }

    // ==================== VALIDACIONES ====================
    getFormErrorsInternal(): string[] {
        const errors: string[] = [];
        const form = this.internalForm;

        if (!form.get('tecnicoSeleccionado')?.value) errors.push('Técnico');
        if (!form.get('nroLicencia')?.value) errors.push('Número de Licencia');
        if (!form.get('apPaterno')?.value) errors.push('Apellido Paterno');
        if (!form.get('apMaterno')?.value) errors.push('Apellido Materno');
        if (!form.get('nombres')?.value) errors.push('Nombres');
        if (!form.get('fecha')?.value) errors.push('Fecha');
        if (!form.get('hora')?.value) errors.push('Hora');

        return errors;
    }

    getFormErrorsExternal(): string[] {
        const errors: string[] = [];
        const form = this.externalForm;

        if (!form.get('empresaSeleccionada')?.value) errors.push('Empresa');
        if (!form.get('nombreEmpresa')?.value) errors.push('Nombre Empresa');
        if (!form.get('fecha')?.value) errors.push('Fecha');
        if (!form.get('hora')?.value) errors.push('Hora');
        if (!form.get('motivoPrestamo')?.value) errors.push('Motivo del Préstamo');

        return errors;
    }

    hasErrorInternal(field: string, error: string): boolean {
        const control = this.internalForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    hasErrorExternal(field: string, error: string): boolean {
        const control = this.externalForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    // ==================== HERRAMIENTAS A PRESTAR ====================
    async openHerramientasAPrestar(): Promise<void> {
        const { HerramientasAPrestarComponent } = await import('./herramientas-a-prestar/herramientas-a-prestar.component');
        const dialogRef = this.dialog.open(HerramientasAPrestarComponent, {
            width: '900px',
            maxWidth: '95vw',
            height: '85vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false,
            data: { mode: 'add' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                const newItem: InternalLoanItem = {
                    id: Date.now(),
                    codigo: result.data.codigo || '',
                    pn: result.data.pn || '',
                    descripcion: result.data.nombre || '',
                    sn: result.data.sn || '',
                    marca: result.data.marca || '',
                    fechaCalibracion: result.data.fechaVencimiento || '',
                    cantidad: result.data.cantidad || 1,
                    unidad: result.data.unidad || 'PZA',
                    estado: result.data.estado || '',
                    contenido: result.data.observacion || ''
                };
                this.internalDataSource.update(items => [...items, newItem]);
                this.showMessage('success', `Herramienta "${newItem.descripcion}" agregada`);
            }
        });
    }

    // ==================== MENSAJES ====================
    private showMessage(type: 'success' | 'error' | 'info' | 'warning', text: string): void {
        this.message.set({ type, text });
        setTimeout(() => this.message.set(null), 4000);
    }
}
