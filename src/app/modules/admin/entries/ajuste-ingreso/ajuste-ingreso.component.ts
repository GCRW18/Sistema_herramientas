import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, finalize } from 'rxjs/operators';
import { MovementService } from '../../../../core/services/movement.service';
import { CreateMovement } from '../../../../core/models/movement.types';

interface AjusteItem {
    id: number;
    pn: string;
    descripcion: string;
    marca: string;
    sn: string;
    codigoBoa: string;
    cantidad: number;
    um: string;
    estado: string;
    ubicacion: string;
    tipoAjuste: string;
    documentos: string;
    obs: string;
    selected?: boolean;
}

interface Funcionario {
    id: number;
    nombre: string;
    cargo: string;
    area: string;
}

@Component({
    selector: 'app-ajuste-ingreso',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatInputModule,
        MatFormFieldModule,
        MatDialogModule,
        MatSelectModule,
        MatAutocompleteModule,
        MatTooltipModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        FormsModule,
        ReactiveFormsModule,
        DragDropModule
    ],
    templateUrl: './ajuste-ingreso.component.html',
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

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }

        .row-selected {
            background-color: #fffbeb !important;
            border-left: 4px solid #fbbf24 !important;
        }

        :host-context(.dark) .row-selected {
            background-color: rgba(251, 191, 36, 0.1) !important;
            border-left: 4px solid #fbbf24 !important;
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
export class AjusteIngresoComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<AjusteIngresoComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private movementService = inject(MovementService);
    private destroy$ = new Subject<void>();

    ajusteForm!: FormGroup;

    // Estados
    isLoading = false;
    isSaving = false;
    showConfirmModal = false;

    // Tipos de ajuste
    tiposAjuste = [
        { value: 'INVENTARIO', label: 'Ajuste Inventario', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: 'inventory_2' },
        { value: 'REUBICACION', label: 'Reubicación', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', icon: 'swap_horiz' },
        { value: 'DONACION', label: 'Donación Recibida', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: 'card_giftcard' },
        { value: 'ENCONTRADO', label: 'Item Encontrado', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: 'search' },
        { value: 'SOBRANTE', label: 'Sobrante', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300', icon: 'add_box' },
        { value: 'CORRECCION', label: 'Corrección Sistema', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: 'build' }
    ];

    // Estados de herramienta
    estados = [
        { value: 'SERVICEABLE', label: 'Serviceable', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
        { value: 'UNSERVICEABLE', label: 'Unserviceable', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
        { value: 'EN_CALIBRACION', label: 'En Calibración', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
        { value: 'REPARACION', label: 'En Reparación', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
        { value: 'NUEVO', label: 'Nuevo', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' }
    ];

    // Almacenes BoA
    almacenes = [
        { value: 'ALM-VVI-01', label: 'Almacén Principal VVI' },
        { value: 'ALM-VVI-02', label: 'Almacén Secundario VVI' },
        { value: 'ALM-LPB-01', label: 'Almacén La Paz' },
        { value: 'ALM-CBB-01', label: 'Almacén Cochabamba' },
        { value: 'ALM-SRE-01', label: 'Almacén Sucre' },
        { value: 'ALM-TJA-01', label: 'Almacén Tarija' },
        { value: 'ALM-ORU-01', label: 'Almacén Oruro' },
        { value: 'ALM-TDD-01', label: 'Almacén Trinidad' }
    ];

    // Funcionarios BoA (personal autorizado para ajustes)
    funcionarios: Funcionario[] = [
        { id: 1, nombre: 'Ing. Roberto Mendoza', cargo: 'Jefe Almacén Herramientas', area: 'Almacén VVI' },
        { id: 2, nombre: 'Ing. Patricia Vargas', cargo: 'Supervisor Control Calidad', area: 'Quality Assurance' },
        { id: 3, nombre: 'Tec. Miguel Ángel Rojas', cargo: 'Encargado Inventarios', area: 'Almacén VVI' },
        { id: 4, nombre: 'Ing. Fernando Gutiérrez', cargo: 'Jefe Mantenimiento Base', area: 'Mantenimiento VVI' },
        { id: 5, nombre: 'Lic. Sandra Morales', cargo: 'Auditora Interna', area: 'Auditoría' },
        { id: 6, nombre: 'Ing. Carlos Mamani', cargo: 'Gerente Técnico', area: 'Gerencia Técnica' },
        { id: 7, nombre: 'Tec. Julio Espinoza', cargo: 'Técnico Control Stock', area: 'Almacén VVI' },
        { id: 8, nombre: 'Ing. Rosa Fernández', cargo: 'Jefe Quality Control', area: 'Quality Control' }
    ];

    // Aprobadores (nivel superior)
    aprobadores: Funcionario[] = [
        { id: 1, nombre: 'Ing. Carlos Mamani', cargo: 'Gerente Técnico', area: 'Gerencia Técnica' },
        { id: 2, nombre: 'Ing. Patricia Vargas', cargo: 'Supervisor Control Calidad', area: 'Quality Assurance' },
        { id: 3, nombre: 'Lic. Sandra Morales', cargo: 'Auditora Interna', area: 'Auditoría' },
        { id: 4, nombre: 'Ing. Roberto Mendoza', cargo: 'Jefe Almacén Herramientas', area: 'Almacén VVI' }
    ];

    filteredFuncionarios: Funcionario[] = [];
    filteredAprobadores: Funcionario[] = [];

    displayedColumns: string[] = [
        'select', 'fila', 'codigoBoa', 'descripcion', 'pn', 'sn',
        'cantidad', 'estado', 'ubicacion', 'tipoAjuste', 'acciones'
    ];

    dataSource: AjusteItem[] = [];
    itemIdCounter = 1;

    // Mensajes de sistema
    message: string = '';
    messageType: 'success' | 'error' | 'info' = 'info';
    showMessage = false;

    ngOnInit(): void {
        this.initForm();
        this.setupFilters();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initForm(): void {
        const today = new Date().toISOString().split('T')[0];

        this.ajusteForm = this.fb.group({
            realizadoPor: ['', Validators.required],
            realizadoPorInput: [''],
            aprobadoPor: ['', Validators.required],
            aprobadoPorInput: [''],
            tipoAjuste: ['INVENTARIO', Validators.required],
            almacen: ['ALM-VVI-01', Validators.required],
            documento: [''],
            fecha: [today, Validators.required],
            descripcion: ['']
        });
    }

    private setupFilters(): void {
        // Filtro para funcionario realizador
        this.ajusteForm.get('realizadoPorInput')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(200))
            .subscribe(value => {
                this.filteredFuncionarios = this.filterFuncionarios(value, this.funcionarios);
            });

        // Filtro para aprobador
        this.ajusteForm.get('aprobadoPorInput')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(200))
            .subscribe(value => {
                this.filteredAprobadores = this.filterFuncionarios(value, this.aprobadores);
            });

        this.filteredFuncionarios = [...this.funcionarios];
        this.filteredAprobadores = [...this.aprobadores];
    }

    private filterFuncionarios(value: string, list: Funcionario[]): Funcionario[] {
        if (!value) return [...list];
        const filterValue = value.toLowerCase();
        return list.filter(f =>
            f.nombre.toLowerCase().includes(filterValue) ||
            f.cargo.toLowerCase().includes(filterValue)
        );
    }

    selectFuncionario(func: Funcionario): void {
        this.ajusteForm.patchValue({
            realizadoPor: func.id,
            realizadoPorInput: func.nombre
        });
    }

    selectAprobador(func: Funcionario): void {
        this.ajusteForm.patchValue({
            aprobadoPor: func.id,
            aprobadoPorInput: func.nombre
        });
    }

    private loadMockData(): void {
        // Datos mock de ajustes pendientes (herramientas encontradas o por ajustar)
        this.dataSource = [
            {
                id: this.itemIdCounter++,
                pn: 'F27537000',
                descripcion: 'TOOL REMOVAL ASSY MLG BEARING',
                marca: 'SNAP-ON',
                sn: 'SN-44116',
                codigoBoa: 'BOA-H-0156',
                cantidad: 1,
                um: 'PZA',
                estado: 'SERVICEABLE',
                ubicacion: 'EST-17-4',
                tipoAjuste: 'INVENTARIO',
                documentos: 'INV-2025-001',
                obs: 'Ajuste por conteo físico',
                selected: false
            },
            {
                id: this.itemIdCounter++,
                pn: 'TRQ-250-1000',
                descripcion: 'TORQUIMETRO DIGITAL 250-1000 LB/FT',
                marca: 'TOHNICHI',
                sn: 'TQ-78523',
                codigoBoa: 'BOA-H-0289',
                cantidad: 1,
                um: 'PZA',
                estado: 'EN_CALIBRACION',
                ubicacion: 'EST-18-2',
                tipoAjuste: 'ENCONTRADO',
                documentos: 'AJU-2025-015',
                obs: 'Encontrado durante auditoría interna',
                selected: false
            },
            {
                id: this.itemIdCounter++,
                pn: 'MS21250-05020',
                descripcion: 'BROCAS AVIATION SET 5-20MM',
                marca: 'CLEVELAND',
                sn: 'N/A',
                codigoBoa: 'BOA-H-0412',
                cantidad: 3,
                um: 'SET',
                estado: 'NUEVO',
                ubicacion: 'EST-05-1',
                tipoAjuste: 'DONACION',
                documentos: 'DON-2025-003',
                obs: 'Donación de Airbus Training',
                selected: false
            },
            {
                id: this.itemIdCounter++,
                pn: 'DG-CALIPER-6',
                descripcion: 'CALIBRADOR DIGITAL 6 PULGADAS',
                marca: 'MITUTOYO',
                sn: 'MIT-112847',
                codigoBoa: 'BOA-H-0523',
                cantidad: 2,
                um: 'PZA',
                estado: 'SERVICEABLE',
                ubicacion: 'EST-09-3',
                tipoAjuste: 'SOBRANTE',
                documentos: 'SOB-2025-008',
                obs: 'Sobrante de proyecto CRJ-200',
                selected: false
            },
            {
                id: this.itemIdCounter++,
                pn: 'HYD-PRESS-3000',
                descripcion: 'GATO HIDRAULICO 3 TON',
                marca: 'MALABAR',
                sn: 'ML-45672',
                codigoBoa: 'BOA-H-0634',
                cantidad: 1,
                um: 'PZA',
                estado: 'SERVICEABLE',
                ubicacion: 'EST-22-1',
                tipoAjuste: 'REUBICACION',
                documentos: 'REUB-2025-012',
                obs: 'Reubicado desde Hangar 2',
                selected: false
            }
        ];
    }

    // Métodos de gestión de items
    toggleSelection(item: AjusteItem): void {
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

    getSelectedItems(): AjusteItem[] {
        return this.dataSource.filter(item => item.selected);
    }

    getResumenPorTipo(): any {
        const selectedItems = this.getSelectedItems();
        const resumen: { [key: string]: number } = {};

        selectedItems.forEach(item => {
            resumen[item.tipoAjuste] = (resumen[item.tipoAjuste] || 0) + 1;
        });

        return resumen;
    }

    getTotalCantidad(): number {
        return this.getSelectedItems().reduce((sum, item) => sum + item.cantidad, 0);
    }

    getResumenPorEstado(): any {
        const selectedItems = this.getSelectedItems();
        return {
            serviceable: selectedItems.filter(item => item.estado === 'SERVICEABLE').length,
            unserviceable: selectedItems.filter(item => item.estado === 'UNSERVICEABLE').length,
            calibracion: selectedItems.filter(item => item.estado === 'EN_CALIBRACION').length,
            reparacion: selectedItems.filter(item => item.estado === 'REPARACION').length,
            nuevos: selectedItems.filter(item => item.estado === 'NUEVO').length
        };
    }

    // Métodos helper para plantillas
    getAlmacenLabel(almacenValue: string): string {
        const almacen = this.almacenes.find(a => a.value === almacenValue);
        return almacen ? almacen.label : '-';
    }

    getRealizadoPorNombre(): string {
        return this.ajusteForm.value.realizadoPorInput || 'No seleccionado';
    }

    getAprobadoPorNombre(): string {
        return this.ajusteForm.value.aprobadoPorInput || 'No seleccionado';
    }

    getDocumentoText(): string {
        return this.ajusteForm.value.documento || 'Sin documento';
    }

    getFechaText(): string {
        return this.ajusteForm.value.fecha || '';
    }

    // Métodos principales
    goBack(): void {
        if (this.dataSource.some(item => item.selected)) {
            if (!confirm('Hay items seleccionados. ¿Está seguro de salir?')) {
                return;
            }
        }

        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/entradas']);
        }
    }

    procesar(): void {
        if (this.dataSource.length === 0) {
            this.showSystemMessage('No hay items para procesar', 'error');
            return;
        }

        const formData = this.ajusteForm.value;
        if (!formData.realizadoPor) {
            this.showSystemMessage('Debe seleccionar quien realiza el ajuste', 'error');
            return;
        }

        if (!formData.aprobadoPor) {
            this.showSystemMessage('Debe seleccionar un aprobador', 'error');
            return;
        }

        // Mostrar modal de confirmación
        this.showConfirmModal = true;
    }

    openConfirmModal(): void {
        if (this.dataSource.length === 0) {
            this.showSystemMessage('No hay items para procesar', 'error');
            return;
        }

        const formData = this.ajusteForm.value;
        if (!formData.realizadoPor) {
            this.showSystemMessage('Debe seleccionar quien realiza el ajuste', 'error');
            return;
        }

        if (!formData.aprobadoPor) {
            this.showSystemMessage('Debe seleccionar un aprobador', 'error');
            return;
        }

        this.showConfirmModal = true;
    }

    closeConfirmModal(): void {
        this.showConfirmModal = false;
    }

    finalizar(): void {
        const formData = this.ajusteForm.value;

        if (!formData.aprobadoPor) {
            this.showSystemMessage('Debe seleccionar un aprobador para finalizar', 'error');
            return;
        }

        if (this.dataSource.length === 0) {
            this.showSystemMessage('No hay items para finalizar', 'error');
            return;
        }

        this.isSaving = true;

        const ajusteData: CreateMovement = {
            type: 'entry',
            status: 'completed',
            entryReason: 'adjustment',
            date: formData.fecha,
            movementNumber: formData.documento || '',
            notes: formData.descripcion || '',
            responsiblePerson: formData.realizadoPorInput || '',
            authorizedBy: formData.aprobadoPorInput || '',
            items: this.dataSource.map(item => ({
                codigo: item.codigoBoa,
                descripcion: item.descripcion,
                modeloPn: item.pn,
                serialNumber: item.sn,
                quantity: item.cantidad,
                notes: item.obs || ''
            }))
        };

        this.movementService.createEntry(ajusteData).pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isSaving = false)
        ).subscribe({
            next: () => {
                this.showSystemMessage('Ajuste registrado exitosamente', 'success');
                this.showConfirmModal = false;
                this.dataSource = [];
                this.ajusteForm.patchValue({
                    realizadoPor: '',
                    realizadoPorInput: '',
                    aprobadoPor: '',
                    aprobadoPorInput: '',
                    descripcion: '',
                    documento: ''
                });
            },
            error: () => {
                this.showSystemMessage('Error al registrar el ajuste. Intente nuevamente.', 'error');
            }
        });
    }

    removeItem(item: AjusteItem): void {
        if (confirm(`¿Está seguro de eliminar el item ${item.codigoBoa}?`)) {
            this.dataSource = this.dataSource.filter(i => i.id !== item.id);
            this.showSystemMessage(`Item ${item.codigoBoa} eliminado`, 'info');
        }
    }

    editItem(item: AjusteItem): void {
        // Abrir diálogo de edición
        this.openDetalleHerramienta(item);
    }

    getTipoAjusteClass(tipo: string): string {
        const tipoObj = this.tiposAjuste.find(t => t.value === tipo);
        return tipoObj ? tipoObj.color : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }

    getTipoAjusteLabel(tipo: string): string {
        const tipoObj = this.tiposAjuste.find(t => t.value === tipo);
        return tipoObj ? tipoObj.label : tipo;
    }

    getTipoAjusteIcon(tipo: string): string {
        const tipoObj = this.tiposAjuste.find(t => t.value === tipo);
        return tipoObj ? tipoObj.icon : 'help';
    }

    getEstadoClass(estado: string): string {
        const estadoObj = this.estados.find(e => e.value === estado);
        return estadoObj ? estadoObj.color : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }

    getEstadoLabel(estado: string): string {
        const estadoObj = this.estados.find(e => e.value === estado);
        return estadoObj ? estadoObj.label : estado;
    }

    private showSystemMessage(msg: string, type: 'success' | 'error' | 'info'): void {
        this.message = msg;
        this.messageType = type;
        this.showMessage = true;
        setTimeout(() => this.showMessage = false, 4000);
    }

    async openDetalleHerramienta(editItem?: AjusteItem): Promise<void> {
        const { DetalleHerramientaComponent } = await import('./detalle-herramienta/detalle-herramienta.component');
        const dialogRef = this.dialog.open(DetalleHerramientaComponent, {
            width: '1100px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false,
            data: {
                tipoAjuste: this.ajusteForm.get('tipoAjuste')?.value,
                editItem: editItem
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'procesar') {
                console.log('Detalle procesado:', result.data);

                if (editItem) {
                    // Actualizar item existente
                    const index = this.dataSource.findIndex(i => i.id === editItem.id);
                    if (index !== -1) {
                        this.dataSource[index] = {
                            ...this.dataSource[index],
                            pn: result.data.pn || '',
                            descripcion: result.data.nombre || '',
                            marca: result.data.marca || '',
                            sn: result.data.sn || '',
                            codigoBoa: result.data.codigo || '',
                            cantidad: result.data.cantidad || 1,
                            um: result.data.um || '',
                            estado: result.data.estado || '',
                            ubicacion: result.data.ubicacion || '',
                            tipoAjuste: result.data.tipoAjuste || this.ajusteForm.get('tipoAjuste')?.value,
                            documentos: result.data.documento || '',
                            obs: result.data.observaciones || ''
                        };
                        this.dataSource = [...this.dataSource];
                        this.showSystemMessage(`Item ${result.data.codigo} actualizado`, 'success');
                    }
                } else {
                    // Agregar nuevo item
                    const newItem: AjusteItem = {
                        id: this.itemIdCounter++,
                        pn: result.data.pn || '',
                        descripcion: result.data.nombre || '',
                        marca: result.data.marca || '',
                        sn: result.data.sn || '',
                        codigoBoa: result.data.codigo || '',
                        cantidad: result.data.cantidad || 1,
                        um: result.data.um || '',
                        estado: result.data.estado || '',
                        ubicacion: result.data.ubicacion || '',
                        tipoAjuste: result.data.tipoAjuste || this.ajusteForm.get('tipoAjuste')?.value,
                        documentos: result.data.documento || '',
                        obs: result.data.observaciones || '',
                        selected: false
                    };
                    this.dataSource = [...this.dataSource, newItem];
                    this.showSystemMessage(`Item ${result.data.codigo} agregado`, 'success');
                }
            }
        });
    }

    generarDocumento(): void {
        const tipo = this.ajusteForm.get('tipoAjuste')?.value;
        const prefijos: { [key: string]: string } = {
            'INVENTARIO': 'INV',
            'REUBICACION': 'REUB',
            'DONACION': 'DON',
            'ENCONTRADO': 'AJU',
            'SOBRANTE': 'SOB',
            'CORRECCION': 'CORR'
        };
        const prefijo = prefijos[tipo] || 'AJU';
        const year = new Date().getFullYear();
        const correlativo = Math.floor(Math.random() * 900) + 100;
        const documento = `${prefijo}-${year}-${correlativo}`;
        this.ajusteForm.patchValue({ documento });
        this.showSystemMessage(`Documento generado: ${documento}`, 'info');
    }

    hasError(field: string, error: string): boolean {
        const control = this.ajusteForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }
}
