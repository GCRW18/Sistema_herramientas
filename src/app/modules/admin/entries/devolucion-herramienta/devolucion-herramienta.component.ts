import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef } from '@angular/core';
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
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';

interface Funcionario {
    id: string;
    licencia: string;
    nombreCompleto: string;
    cargo?: string;
    departamento?: string;
    area?: string;
}

interface DevolucionItem {
    toolId?: string;
    imagen?: string;
    codigo: string;
    descripcion: string;
    pn: string;
    sn: string;
    und: string;
    marca?: string;
    listaContenido: string;
    fechaCalibracion: string;
    estadoAlPrestar: string;
    fechaPrestamo: string;
    cantidadPrestada: number;
    cantidadDevolver: number;
    aeronave: string;
    ordenTrabajo?: string;
    tipoPrestamo: 'OT' | 'EVENTUAL' | 'PERSONAL' | 'AOG';
    diasFuera: number;
    condicionDevolucion: 'BUENO' | 'DAÑADO' | 'IRREPARABLE' | 'REQUIERE_CALIBRACION' | 'FALTANTE';
    observacionItem: string;
    selected: boolean;
}

type CondicionDevolucion = 'BUENO' | 'DAÑADO' | 'IRREPARABLE' | 'REQUIERE_CALIBRACION' | 'FALTANTE';

@Component({
    selector: 'app-devolucion-herramienta',
    standalone: true,
    imports: [
        CommonModule, RouterModule, ReactiveFormsModule, FormsModule,
        MatCardModule, MatIconModule, MatButtonModule, MatTableModule,
        MatInputModule, MatFormFieldModule, MatSelectModule, MatDialogModule,
        MatSnackBarModule, MatProgressSpinnerModule, MatAutocompleteModule,
        MatTooltipModule, MatCheckboxModule, DragDropModule
    ],
    templateUrl: './devolucion-herramienta.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }

        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(15, 23, 42, 0.8); }

        .row-selected { background-color: #fef3c7 !important; }
        :host-context(.dark) .row-selected { background-color: rgba(251, 191, 36, 0.2) !important; }

        @keyframes pulse-border {
            0%, 100% { border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            50% { border-color: #f87171; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
        }
        .animate-pulse-border { animation: pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    `]
})
export class DevolucionHerramientaComponent implements OnInit, OnDestroy {
    @ViewChild('busquedaModal') busquedaModal!: TemplateRef<any>;
    @ViewChild('confirmacionModal') confirmacionModal!: TemplateRef<any>;

    private dialogRefActual: MatDialogRef<any> | null = null;
    public dialogRef = inject(MatDialogRef<DevolucionHerramientaComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);

    private _unsubscribeAll = new Subject<void>();

    devolucionForm!: FormGroup;

    isLoading = false;
    isSaving = false;
    isSearching = false;

    funcionarios: Funcionario[] = [];
    funcionariosFiltrados: Funcionario[] = [];

    tiposDevolucion = [
        { value: 'RAPIDA', label: 'RÁPIDA (Escaneo)' },
        { value: 'COMPLETA', label: 'COMPLETA (Detallada)' }
    ];

    condiciones: { value: CondicionDevolucion; label: string; bgColor: string; icon: string }[] = [
        { value: 'BUENO', label: 'BUENO', bgColor: 'bg-green-500', icon: 'check_circle' },
        { value: 'DAÑADO', label: 'DAÑADO', bgColor: 'bg-red-500', icon: 'report_problem' },
        { value: 'REQUIERE_CALIBRACION', label: 'CALIBRAR', bgColor: 'bg-yellow-500', icon: 'build' },
        { value: 'FALTANTE', label: 'FALTANTE', bgColor: 'bg-red-700', icon: 'help_outline' }
    ];

    displayedColumns: string[] = [
        'select',
        'herramienta',
        'descripcion',
        'calibEstado',
        'destino',
        'fechaDias',
        'cantidades',
        'condicion',
        'observacionItem'
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
            tipoDe: ['COMPLETA'],
            codigoHerramienta: [''],
            unidadDestino: [''],
            ordenTrabajo: [''],
            fechaDevolucion: [new Date().toISOString().split('T')[0], Validators.required],
            responsableRecibe: ['', Validators.required],
            observaciones: ['']
        });

        this.devolucionForm.get('funcionario')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll), debounceTime(300), distinctUntilChanged()
        ).subscribe(value => this.filtrarFuncionarios(value));
    }

    private loadInitialData(): void {
        this.isLoading = true;
        this.movementService.getPersonal().pipe(
            takeUntil(this._unsubscribeAll), finalize(() => this.isLoading = false)
        ).subscribe({
            next: (data) => {
                this.funcionarios = data.map((p: any) => ({
                    id: p.id || p.id_personal,
                    licencia: p.licencia || p.nro_licencia || '',
                    nombreCompleto: `${p.nombre || ''} ${p.apellido_paterno || ''} ${p.apellido_materno || ''}`.trim(),
                    cargo: p.cargo || '', departamento: p.departamento || '', area: p.area || ''
                }));
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
            f.nombreCompleto.toLowerCase().includes(filtro) || f.licencia.toLowerCase().includes(filtro)
        );
    }

    displayFuncionario(f: Funcionario): string {
        return f ? `${f.licencia} - ${f.nombreCompleto}` : '';
    }

    // --- MANEJO DE MODALES ---

    abrirModalBusqueda(): void {
        this.dialogRefActual = this.dialog.open(this.busquedaModal, {
            width: '800px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalBusqueda(): void {
        this.dialogRefActual?.close();
    }

    abrirModalConfirmacion(): void {
        const validation = this.validateItems();
        if (!validation.valid) {
            validation.errors.forEach(err => this.showMessage(err, 'error'));
            return;
        }
        const funcionario = this.devolucionForm.get('funcionario')?.value;
        if (!funcionario || typeof funcionario === 'string') {
            this.showMessage('Debe seleccionar un funcionario válido', 'error');
            this.abrirModalBusqueda();
            return;
        }

        this.dialogRefActual = this.dialog.open(this.confirmacionModal, {
            width: '800px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalConfirmacion(): void {
        this.dialogRefActual?.close();
    }

    // --- LÓGICA DE BÚSQUEDA ---

    isBusquedaValida(): boolean {
        const f = this.devolucionForm.value;
        return !!f.funcionario && typeof f.funcionario !== 'string' && !!f.responsableRecibe;
    }

    realizarConsulta(): void {
        const funcionario = this.devolucionForm.get('funcionario')?.value;

        if (!funcionario || typeof funcionario === 'string') {
            this.showMessage('Seleccione un técnico/funcionario de la lista', 'warning');
            return;
        }
        if (!this.devolucionForm.value.responsableRecibe?.trim()) {
            this.showMessage('Ingrese el nombre de quien recibe', 'warning');
            return;
        }

        this.isSearching = true;
        this.dataSource = [];
        const codigoFiltro = (this.devolucionForm.get('codigoHerramienta')?.value || '').trim();
        const nombreSafe = (funcionario.nombreCompleto || '').replace(/'/g, "''");
        const licenciaSafe = (funcionario.licencia || '').replace(/'/g, "''");
        let filtroLoans = `loa.status = 'ACTIVO' AND loa.loan_type = 'INTERNO' AND (loa.borrower_name ILIKE '%${nombreSafe}%' OR loa.borrower_license = '${licenciaSafe}')`;

        forkJoin({
            loans: this.movementService.getActiveLoans({ filtro_adicional: filtroLoans }),
            items: this.movementService.getActiveLoanItems()
        }).pipe(
            takeUntil(this._unsubscribeAll), finalize(() => this.isSearching = false)
        ).subscribe({
            next: ({ loans, items }) => {
                if (!loans || loans.length === 0) {
                    this.showMessage(`No hay préstamos activos para ${funcionario.nombreCompleto}`, 'info');
                    this.cerrarModalBusqueda();
                    return;
                }

                let resultado = loans.flatMap((loan: any) => {
                    const loanItems = (items || []).filter((i: any) => String(i.loan_id) === String(loan.id_loan));
                    return loanItems.map((item: any) => ({
                        toolId: String(item.tool_id || ''),
                        codigo: item.code || '',
                        imagen: item.image_url || null,
                        descripcion: item.description || item.name || '',
                        pn: item.part_number || '',
                        sn: item.serial_number || '',
                        und: item.unit_of_measure || 'UND',
                        marca: item.brand || '',
                        listaContenido: '',
                        fechaCalibracion: item.calibration_date || '',
                        estadoAlPrestar: item.condition_on_loan || 'BUENO',
                        fechaPrestamo: loan.loan_date || '',
                        cantidadPrestada: Number(item.quantity) || 1,
                        cantidadDevolver: Number(item.quantity) || 1,
                        aeronave: loan.aircraft || '',
                        ordenTrabajo: loan.work_order_number || '',
                        tipoPrestamo: 'EVENTUAL' as any,
                        diasFuera: loan.loan_date ? this.calcularDiasFuera(loan.loan_date) : 0,
                        condicionDevolucion: 'BUENO' as CondicionDevolucion,
                        observacionItem: '',
                        selected: false
                    }));
                });

                if (codigoFiltro) {
                    resultado = resultado.filter((item: DevolucionItem) => item.codigo.toLowerCase().includes(codigoFiltro.toLowerCase()) || item.pn.toLowerCase().includes(codigoFiltro.toLowerCase()));
                }

                if (resultado.length === 0) {
                    this.showMessage('No se encontraron herramientas con ese criterio', 'info');
                    return;
                }

                this.dataSource = resultado;
                this.showMessage(`${this.dataSource.length} herramienta(s) cargadas`, 'success');
                this.cerrarModalBusqueda();
            },
            error: (err) => this.showMessage('Error al consultar: ' + (err?.message || ''), 'error')
        });
    }

    private calcularDiasFuera(fechaPrestamo: string): number {
        const prestamo = new Date(fechaPrestamo);
        const diffTime = Math.abs(new Date().getTime() - prestamo.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // --- ACCIONES TABLA ---

    toggleSelection(item: DevolucionItem): void { item.selected = !item.selected; }
    toggleAllSelection(event: any): void { const checked = event.checked; this.dataSource.forEach(item => item.selected = checked); }
    isAllSelected(): boolean { return this.dataSource.length > 0 && this.dataSource.every(item => item.selected); }
    isSomeSelected(): boolean { return this.dataSource.some(item => item.selected) && !this.isAllSelected(); }
    getSelectedCount(): number { return this.dataSource.filter(item => item.selected).length; }
    getSelectedItems(): DevolucionItem[] { return this.dataSource.filter(item => item.selected); }

    getDiasFueraClass(dias: number): string {
        if (dias <= 3) return 'bg-green-100 text-green-800 border-green-300';
        if (dias <= 7) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        if (dias <= 15) return 'bg-orange-100 text-orange-800 border-orange-300';
        return 'bg-red-100 text-red-800 border-red-400';
    }

    onCondicionChange(item: DevolucionItem, condValue?: string): void {
        if (condValue) {
            item.condicionDevolucion = condValue as CondicionDevolucion;
            item.selected = true;
        }
        if (item.condicionDevolucion === 'BUENO') item.observacionItem = '';
    }

    getCondicionConfig(condicion: CondicionDevolucion) {
        return this.condiciones.find(c => c.value === condicion);
    }

    validateCantidadDevolver(item: DevolucionItem): void {
        if (item.cantidadDevolver < 1) item.cantidadDevolver = 1;
        if (item.cantidadDevolver > item.cantidadPrestada) item.cantidadDevolver = item.cantidadPrestada;
    }

    validateItems(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const selectedItems = this.getSelectedItems();
        if (selectedItems.length === 0) {
            errors.push('Seleccione al menos una herramienta'); return { valid: false, errors };
        }
        selectedItems.forEach(item => {
            if (item.cantidadDevolver <= 0 || item.cantidadDevolver > item.cantidadPrestada) errors.push(`Item ${item.codigo}: Cantidad inválida`);
            if ((item.condicionDevolucion === 'DAÑADO' || item.condicionDevolucion === 'FALTANTE') && !item.observacionItem.trim()) errors.push(`Item ${item.codigo}: Falta observación obligatoria`);
        });
        return { valid: errors.length === 0, errors };
    }

    getResumenPorCondicion(): { condicion: string; cantidad: number; color: string }[] {
        const selectedItems = this.getSelectedItems();
        const resumen: { [key: string]: number } = {};
        selectedItems.forEach(item => { resumen[item.condicionDevolucion] = (resumen[item.condicionDevolucion] || 0) + 1; });
        return Object.entries(resumen).map(([condicion, cantidad]) => {
            const cfg = this.condiciones.find(c => c.value === condicion);
            return { condicion: cfg?.label || condicion, cantidad, color: cfg?.bgColor || '' };
        });
    }

    finalizar(): void {
        const validation = this.validateItems();
        if (!validation.valid) { validation.errors.forEach(err => this.showMessage(err, 'error')); return; }

        const funcionario = this.devolucionForm.get('funcionario')?.value;
        const selectedItems = this.getSelectedItems();

        this.cerrarModalConfirmacion();
        this.isSaving = true;

        const itemsJson = JSON.stringify(selectedItems.map(item => ({
            tool_id: Number(item.toolId), quantity: item.cantidadDevolver, condicion: item.condicionDevolucion,
            unit_of_measure: item.und || '', content_list: item.listaContenido || '',
            estado_al_prestar: item.estadoAlPrestar || '', notes: item.observacionItem || ''
        })));

        this.movementService.registrarDevolucionPrestamo({
            type: 'DEVOLUCION_PRESTAMO_INTERNO',
            date: this.devolucionForm.value.fechaDevolucion,
            time: new Date().toTimeString().slice(0, 8),
            requested_by_name: funcionario.nombreCompleto,
            responsible_person: this.devolucionForm.value.responsableRecibe,
            recipient: funcionario.nombreCompleto,
            destination_unit: this.devolucionForm.value.unidadDestino || '',
            work_order_number: this.devolucionForm.value.ordenTrabajo || '',
            notes: this.devolucionForm.value.observaciones || '',
            items_json: itemsJson
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this._unsubscribeAll)).subscribe({
            next: (result: any) => {
                this.showMessage(`Devolución registrada: ${result?.movement_number || '---'}`, 'success');
                this.dataSource = this.dataSource.filter(item => {
                    if (!item.selected) return true;
                    return item.cantidadDevolver < item.cantidadPrestada;
                });
                this.dataSource.forEach(item => {
                    if (item.selected && item.cantidadDevolver < item.cantidadPrestada) {
                        item.cantidadPrestada -= item.cantidadDevolver;
                        item.cantidadDevolver = item.cantidadPrestada;
                        item.selected = false;
                    }
                });
            },
            error: (err) => this.showMessage('Error al registrar: ' + (err?.message || ''), 'error')
        });
    }

    hasError(field: string, error: string): boolean {
        const control = this.devolucionForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    private showMessage(msg: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(msg, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
