import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef } from '@angular/core';
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
    costoHora: number; // Mantenido a nivel interno para el backend (0 por defecto)
    costoServicio: number; // Mantenido a nivel interno para el backend (0 por defecto)
    estante: string;
    nivelUbicacion: string;
    accesorios: string;
    documento: string;
    observacion: string;
    requiereCalibracion: boolean;
    intervaloCalibracion: number | null;
    fechaCalibracion: string | null;
    nroCertificado: string;
    tipo: string;
    marca: string;
    nivelCriticidad: string;
    fabricacion: string;
}

@Component({
    selector: 'app-nueva-herramienta',
    standalone: true,
    imports: [
        CommonModule, RouterModule, ReactiveFormsModule, FormsModule,
        MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
        MatIconModule, MatButtonModule, MatTableModule, MatDialogModule,
        MatSnackBarModule, MatProgressSpinnerModule, MatAutocompleteModule,
        MatTooltipModule, MatCheckboxModule, MatSlideToggleModule
    ],
    templateUrl: './nueva-herramienta.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
        @keyframes pulse-border {
            0%, 100% { border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            50% { border-color: #f87171; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
        }
        .animate-pulse-border { animation: pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    `]
})
export class NuevaHerramientaComponent implements OnInit, OnDestroy {

    @ViewChild('recepcionModal') recepcionModal!: TemplateRef<any>;
    @ViewChild('herramientaModal') herramientaModal!: TemplateRef<any>;
    @ViewChild('confirmacionModal') confirmacionModal!: TemplateRef<any>;

    private dialogRefActual: MatDialogRef<any> | null = null;
    public dialogRefComponent = inject(MatDialogRef<NuevaHerramientaComponent>, { optional: true });
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);

    private _unsubscribeAll = new Subject<void>();

    recepcionForm!: FormGroup;
    herramientaForm!: FormGroup;

    dataSource: HerramientaItem[] = [];

    isLoading = false;
    isSaving = false;
    editingIndex: number | null = null;

    funcionarios: Funcionario[] = [];
    funcionariosFiltrados: Funcionario[] = [];
    proveedores: Proveedor[] = [];
    proveedoresFiltrados: Proveedor[] = [];

    unidadesMedida = [
        { value: 'UNIDAD', label: 'UNIDAD' }, { value: 'PAR', label: 'PAR' },
        { value: 'JUEGO', label: 'JUEGO' }, { value: 'KIT', label: 'KIT' },
        { value: 'LITRO', label: 'LITRO' }, { value: 'METRO', label: 'METRO' }
    ];

    estados = [
        { value: 'NUEVO', label: 'NUEVO' },
        { value: 'REACONDICIONADO', label: 'REACONDICIONADO' },
        { value: 'USADO', label: 'USADO' }
    ];

    tiposHerramienta = [
        { value: 'HERRAMIENTA', label: 'HERRAMIENTA' }, { value: 'BANCO_PRUEBA', label: 'BANCO DE PRUEBA' },
        { value: 'CONSUMIBLE', label: 'CONSUMIBLE' }, { value: 'EQUIPO_MEDICION', label: 'EQUIPO DE MEDICIÓN' },
        { value: 'EQUIPO_SOPORTE', label: 'EQUIPO DE SOPORTE EN TIERRA' }
    ];

    marcas: string[] = [];
    marcasFiltradas: string[] = [];

    nivelesCriticidad = [
        { value: 'A', label: 'A - Crítico', descripcion: 'Herramienta esencial para operaciones' },
        { value: 'B', label: 'B - Normal', descripcion: 'Herramienta de uso regular' }
    ];

    tiposFabricacion = [
        { value: 'INTERNACIONAL', label: 'INTERNACIONAL' },
        { value: 'LOCAL', label: 'LOCAL' }
    ];

    private ultimoCorrelativo = 0;

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
        this.recepcionForm = this.fb.group({
            tipoDe: ['COMPRA', Validators.required],
            nroCmr: ['', [Validators.required, Validators.minLength(3)]],
            nroFactura: [''],
            proveedor: [''],
            fechaIngreso: [new Date().toISOString().split('T')[0], Validators.required],
            funcionarioRecibe: ['', Validators.required],
            recibiConforme: [''],
            ordenCompra: [''],
            observaciones: ['']
        });

        this.herramientaForm = this.fb.group({
            pn: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z0-9\-_]+$/)]],
            sn: ['', Validators.pattern(/^[A-Za-z0-9\-_]*$/)],
            descripcion: ['', [Validators.required, Validators.minLength(3)]],
            codigoBoa: ['BOA-H-', [Validators.required, Validators.pattern(/^[A-Za-z0-9\-]+$/)]],
            cantidad: [1, [Validators.required, Validators.min(1), Validators.max(9999)]],
            unidadMedida: ['UNIDAD', Validators.required],
            estado: ['NUEVO', Validators.required],
            estante: [''],
            nivelUbicacion: [''],
            accesorios: [''],
            documento: [''],
            observacion: [''],
            requiereCalibracion: [false],
            intervaloCalibracion: [null],
            fechaCalibracion: [null],
            nroCertificado: [''],
            tipo: ['HERRAMIENTA', Validators.required],
            marca: ['', Validators.required],
            nivelCriticidad: ['B', Validators.required],
            fabricacion: ['INTERNACIONAL', Validators.required]
        });

        this.setupFilters();
    }

    private setupFilters(): void {
        this.recepcionForm.get('funcionarioRecibe')?.valueChanges.pipe(takeUntil(this._unsubscribeAll), debounceTime(300), distinctUntilChanged())
            .subscribe(value => this.filtrarFuncionarios(value));

        this.recepcionForm.get('proveedor')?.valueChanges.pipe(takeUntil(this._unsubscribeAll), debounceTime(300), distinctUntilChanged())
            .subscribe(value => this.filtrarProveedores(value));

        this.herramientaForm.get('marca')?.valueChanges.pipe(takeUntil(this._unsubscribeAll), debounceTime(200), distinctUntilChanged())
            .subscribe(value => this.filtrarMarcas(value));

        this.herramientaForm.get('requiereCalibracion')?.valueChanges.pipe(takeUntil(this._unsubscribeAll))
            .subscribe(requiere => {
                const intervaloControl = this.herramientaForm.get('intervaloCalibracion');
                if (requiere) {
                    intervaloControl?.setValidators([Validators.required, Validators.min(1)]);
                } else {
                    intervaloControl?.clearValidators();
                    this.herramientaForm.patchValue({ intervaloCalibracion: null, fechaCalibracion: null, nroCertificado: '' });
                }
                intervaloControl?.updateValueAndValidity();
            });
    }

    private loadInitialData(): void {
        this.isLoading = true;
        this.movementService.getPersonal().pipe(takeUntil(this._unsubscribeAll), finalize(() => this.isLoading = false))
            .subscribe({
                next: (data) => {
                    this.funcionarios = data.map((p: any) => ({
                        id: p.id || p.id_personal,
                        licencia: p.licencia || p.nro_licencia || '',
                        nombreCompleto: `${p.nombre || ''} ${p.apellido_paterno || ''} ${p.apellido_materno || ''}`.trim(),
                        nombre: p.nombre || '',
                        apellidoPaterno: p.apellido_paterno || '',
                        apellidoMaterno: p.apellido_materno || '',
                        cargo: p.cargo || '', departamento: p.departamento || ''
                    }));
                    this.funcionariosFiltrados = [...this.funcionarios];
                }
            });

        this.movementService.getProveedores().pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (data) => {
                    this.proveedores = data.map((p: any) => ({
                        id: p.id, nombre: p.nombre || p.name, nit: p.nit, direccion: p.direccion, telefono: p.telefono
                    }));
                    this.proveedoresFiltrados = [...this.proveedores];
                }
            });

        this.movementService.getDistinctBrands().pipe(takeUntil(this._unsubscribeAll))
            .subscribe({ next: (brands) => { this.marcas = brands; this.marcasFiltradas = [...brands]; } });

        this.movementService.getLastBoaCode().pipe(takeUntil(this._unsubscribeAll))
            .subscribe({ next: (num) => { this.ultimoCorrelativo = num; } });
    }

    // --- MANEJO DE MODALES ---

    abrirModalRecepcion(): void {
        this.dialogRefActual = this.dialog.open(this.recepcionModal, {
            width: '700px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalRecepcion(): void {
        this.dialogRefActual?.close();
    }

    abrirModalHerramienta(index?: number): void {
        if (index !== undefined) {
            this.editingIndex = index;
            const item = this.dataSource[index];
            this.herramientaForm.patchValue({...item});
        } else {
            this.editingIndex = null;
            this.resetHerramientaForm();
        }
        this.dialogRefActual = this.dialog.open(this.herramientaModal, {
            width: '700px', maxWidth: '95vw', maxHeight: '90vh', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalHerramienta(): void {
        this.editingIndex = null;
        this.dialogRefActual?.close();
    }

    abrirModalConfirmacion(): void {
        const validation = this.validateRecepcion();
        if (!validation.valid) {
            validation.errors.forEach(err => this.showMessage(err, 'error'));
            this.abrirModalRecepcion();
            return;
        }
        if (this.dataSource.length === 0) {
            this.showMessage('Agregue al menos una herramienta a la lista', 'warning');
            return;
        }
        this.dialogRefActual = this.dialog.open(this.confirmacionModal, {
            width: '700px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalConfirmacion(): void {
        this.dialogRefActual?.close();
    }

    // --- ACCIONES DE TABLA ---

    agregarHerramienta(): void {
        this.herramientaForm.markAllAsTouched();
        if (this.herramientaForm.invalid) {
            this.showMessage('Complete los campos requeridos', 'error');
            return;
        }

        const f = this.herramientaForm.value;
        const existeIndex = this.dataSource.findIndex(item => item.codigoBoa.toUpperCase() === f.codigoBoa.toUpperCase());

        if (existeIndex >= 0 && this.editingIndex !== existeIndex) {
            this.showMessage('Ya existe una herramienta con este código BOA', 'warning');
            return;
        }

        const item: HerramientaItem = { ...f,
            pn: f.pn.toUpperCase(),
            codigoBoa: f.codigoBoa.toUpperCase(),
            costoHora: 0, // Se envía en 0 por defecto
            costoServicio: 0, // Se envía en 0 por defecto
            intervaloCalibracion: f.requiereCalibracion ? f.intervaloCalibracion : null,
            fechaCalibracion: f.requiereCalibracion ? f.fechaCalibracion : null,
            nroCertificado: f.requiereCalibracion ? f.nroCertificado : ''
        };

        if (this.editingIndex !== null) {
            this.dataSource[this.editingIndex] = item;
            this.showMessage('Herramienta actualizada en la recepción', 'success');
        } else {
            this.dataSource.push(item);
            this.showMessage('Herramienta añadida a la recepción', 'success');
        }

        this.dataSource = [...this.dataSource];
        this.cerrarModalHerramienta();
    }

    eliminarItem(index: number): void {
        if (confirm(`¿Eliminar ${this.dataSource[index].pn} de la lista de recepción?`)) {
            this.dataSource.splice(index, 1);
            this.dataSource = [...this.dataSource];
        }
    }

    duplicarItem(index: number): void {
        const itemCopy = { ...this.dataSource[index] };
        itemCopy.sn = '';
        this.ultimoCorrelativo++;
        itemCopy.codigoBoa = `BOA-H-${this.ultimoCorrelativo.toString().padStart(4, '0')}`;

        this.editingIndex = null;
        this.herramientaForm.patchValue(itemCopy);

        this.dialogRefActual = this.dialog.open(this.herramientaModal, {
            width: '900px', maxWidth: '95vw', maxHeight: '90vh', panelClass: 'neo-dialog-transparent', disableClose: true
        });
        this.showMessage('Ítem copiado. Ajuste el S/N si es necesario.', 'info');
    }

    // --- LÓGICA GENERAL ---

    finalizarIngreso(): void {
        this.cerrarModalConfirmacion();
        this.isSaving = true;

        const recepcion = this.recepcionForm.value;
        const funcionario = recepcion.funcionarioRecibe;
        const proveedor = recepcion.proveedor;
        const proveedorNombre = typeof proveedor === 'object' ? proveedor?.nombre : proveedor || '';

        const itemsJson = JSON.stringify(this.dataSource.map(h => ({
            code: h.codigoBoa, name: h.descripcion, description: h.descripcion,
            brand: h.marca || '', part_number: h.pn || '', serial_number: h.sn || '',
            quantity: h.cantidad, purchase_price: 0, rental_cost_service: 0,
            shelf: h.estante || '', shelf_level: h.nivelUbicacion || '', accessories: h.accesorios || '',
            document_ref: h.documento || '', unit_of_measure: h.unidadMedida || 'UNIDAD',
            condition: h.estado === 'NUEVO' ? 'new' : h.estado === 'REACONDICIONADO' ? 'fair' : 'good',
            criticality_level: h.nivelCriticidad || 'B', manufacture_origin: h.fabricacion || 'INTERNACIONAL',
            requires_calibration: h.requiereCalibracion || false, calibration_interval: h.intervaloCalibracion || null,
            calibration_date: h.fechaCalibracion || null, certificate_number: h.nroCertificado || '', notes: h.observacion || ''
        })));

        this.movementService.registrarNuevaCompra({
            movement_number: recepcion.nroCmr, date: recepcion.fechaIngreso,
            responsible_person: funcionario?.nombreCompleto || '', received_by_name: recepcion.recibiConforme || '',
            supplier: proveedorNombre, invoice_number: recepcion.nroFactura || '',
            purchase_order: recepcion.ordenCompra || '', notes: recepcion.observaciones || '',
            warehouse_id: 1, items_json: itemsJson
        }).pipe(takeUntil(this._unsubscribeAll), finalize(() => this.isSaving = false))
            .subscribe({
                next: (response) => {
                    this.showMessage(`Recepción registrada con éxito: ${response?.movement_number}`, 'success');
                    if (this.dialogRefComponent) this.dialogRefComponent.close({ success: true });
                    else this.router.navigate(['/entradas']);
                },
                error: (err) => this.showMessage(err?.message || 'Error al registrar', 'error')
            });
    }

    async openCatalogo(): Promise<void> {
        const { HerramientasAIngresarComponent } = await import('./herramientas-a-ingresar/herramientas-a-ingresar.component');
        const dialogRef = this.dialog.open(HerramientasAIngresarComponent, {
            width: '700px', maxWidth: '95vw', height: 'auto', maxHeight: '90vh'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.action === 'procesar') {
                const data = result.data;
                const existe = this.dataSource.some(i => i.codigoBoa.toUpperCase() === (data.codigo || '').toUpperCase());
                if (existe) { this.showMessage('Esta herramienta ya está en la recepción', 'warning'); return; }

                this.dataSource.push({
                    pn: data.pn || '', sn: data.sn || '', descripcion: data.nombre || data.descripcion || '',
                    codigoBoa: data.codigo || '', cantidad: data.cantidad || 1, unidadMedida: data.um || data.unidadMedida || 'UNIDAD',
                    estado: data.estado || 'NUEVO', costoHora: 0, costoServicio: 0, estante: '', nivelUbicacion: '',
                    accesorios: '', documento: data.documento || '', observacion: data.observaciones || '',
                    requiereCalibracion: false, intervaloCalibracion: null, fechaCalibracion: null, nroCertificado: '',
                    tipo: 'HERRAMIENTA', marca: '', nivelCriticidad: 'B', fabricacion: 'INTERNACIONAL'
                });
                this.dataSource = [...this.dataSource];
                this.showMessage('Añadido desde catálogo. Complete detalles como Nro. Serie o Estante.', 'success');
            }
        });
    }

    // --- UTILIDADES ---

    isRecepcionValida(): boolean {
        return this.recepcionForm.valid;
    }

    validateRecepcion(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        this.recepcionForm.markAllAsTouched();
        if (this.recepcionForm.get('nroCmr')?.invalid) errors.push('Falta Nro Documento/CMR');
        if (this.recepcionForm.get('fechaIngreso')?.invalid) errors.push('Falta Fecha de Recepción');
        if (!this.recepcionForm.get('funcionarioRecibe')?.value) errors.push('Falta Funcionario que Recibe');
        return { valid: errors.length === 0, errors };
    }

    generarCodigoBoa(): void {
        this.ultimoCorrelativo++;
        this.herramientaForm.patchValue({ codigoBoa: `BOA-H-${this.ultimoCorrelativo.toString().padStart(4, '0')}` });
    }

    private resetHerramientaForm(): void {
        this.herramientaForm.reset({
            codigoBoa: 'BOA-H-', // Valor por defecto
            cantidad: 1, unidadMedida: 'UNIDAD', estado: 'NUEVO',
            requiereCalibracion: false, tipo: 'HERRAMIENTA', nivelCriticidad: 'B', fabricacion: 'INTERNACIONAL'
        });
    }

    getTotalItems = () => this.dataSource.reduce((sum, item) => sum + item.cantidad, 0);

    hasRecepcionError = (field: string, error: string) => this.recepcionForm.get(field)?.hasError(error) && this.recepcionForm.get(field)?.touched;
    hasHerramientaError = (field: string, error: string) => this.herramientaForm.get(field)?.hasError(error) && this.herramientaForm.get(field)?.touched;

    getEstadoClass(estado: string): string {
        switch(estado) {
            case 'NUEVO': return 'bg-green-100 text-green-800 border-green-300';
            case 'REACONDICIONADO': return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'USADO': return 'bg-amber-100 text-amber-800 border-amber-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    }

    displayFuncionario(f: Funcionario): string { return f ? `${f.licencia} - ${f.nombreCompleto}` : ''; }
    displayProveedor(p: Proveedor): string { return p ? `${p.nombre}${p.nit ? ' ('+p.nit+')' : ''}` : ''; }

    private filtrarFuncionarios(v: string): void { this.funcionariosFiltrados = v ? this.funcionarios.filter(f => f.nombreCompleto.toLowerCase().includes(v.toLowerCase()) || f.licencia.toLowerCase().includes(v.toLowerCase())) : [...this.funcionarios]; }
    private filtrarProveedores(v: string): void { this.proveedoresFiltrados = v ? this.proveedores.filter(p => p.nombre.toLowerCase().includes(v.toLowerCase()) || (p.nit && p.nit.includes(v.toLowerCase()))) : [...this.proveedores]; }
    private filtrarMarcas(v: string): void { this.marcasFiltradas = v ? this.marcas.filter(m => m.toLowerCase().includes(v.toLowerCase())) : [...this.marcas]; }

    private showMessage(msg: string, type: string): void {
        this.snackBar.open(msg, 'OK', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
