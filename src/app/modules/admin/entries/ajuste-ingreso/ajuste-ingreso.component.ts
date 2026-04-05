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

interface AjusteItem {
    id: number;
    toolId: number;
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
        :host-context(.dark) { color-scheme: dark; }
        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 8px !important;
            background-color: white;
        }
        :host-context(.dark) .neo-card-base { background-color: #1e293b !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
        .row-selected {
            background-color: #fffbeb !important;
            border-left: 4px solid #fbbf24 !important;
        }
        :host-context(.dark) .row-selected {
            background-color: rgba(251,191,36,0.1) !important;
            border-left: 4px solid #fbbf24 !important;
        }
        .spinner-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 100;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }
        ::ng-deep .white-checkbox .mdc-checkbox__background { border-color: white !important; }
        ::ng-deep .white-checkbox.mat-mdc-checkbox-checked .mdc-checkbox__background {
            background-color: white !important;
            border-color: white !important;
        }
        ::ng-deep .white-checkbox .mdc-checkbox__checkmark { color: #0f172a !important; }
    `]
})
export class AjusteIngresoComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<AjusteIngresoComponent>, { optional: true });
    private dialog   = inject(MatDialog);
    private fb       = inject(FormBuilder);
    private router   = inject(Router);
    private movementService = inject(MovementService);
    private destroy$ = new Subject<void>();

    ajusteForm!: FormGroup;

    isLoading       = false;
    isSaving        = false;
    showConfirmModal = false;

    tiposAjuste = [
        { value: 'INVENTARIO',  label: 'Ajuste Inventario',  color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',     icon: 'inventory_2' },
        { value: 'REUBICACION', label: 'Reubicación',        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', icon: 'swap_horiz' },
        { value: 'DONACION',    label: 'Donación Recibida',  color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',   icon: 'card_giftcard' },
        { value: 'ENCONTRADO',  label: 'Item Encontrado',    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',   icon: 'search' },
        { value: 'SOBRANTE',    label: 'Sobrante',           color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',       icon: 'add_box' },
        { value: 'CORRECCION',  label: 'Corrección Sistema', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',           icon: 'build' }
    ];

    estados = [
        { value: 'SERVICEABLE',    label: 'Serviceable',    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
        { value: 'UNSERVICEABLE',  label: 'Unserviceable',  color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
        { value: 'EN_CALIBRACION', label: 'En Calibración', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
        { value: 'REPARACION',     label: 'En Reparación',  color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
        { value: 'NUEVO',          label: 'Nuevo',          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' }
    ];


    funcionarios: Funcionario[]      = [];
    filteredFuncionarios: Funcionario[] = [];
    filteredAprobadores: Funcionario[]  = [];

    displayedColumns: string[] = [
        'select', 'fila', 'codigoBoa', 'descripcion', 'pn', 'sn',
        'cantidad', 'estado', 'ubicacion', 'tipoAjuste', 'acciones'
    ];

    dataSource: AjusteItem[] = [];
    itemIdCounter = 1;

    message     = '';
    messageType: 'success' | 'error' | 'info' = 'info';
    showMessage = false;

    ngOnInit(): void {
        this.initForm();
        this.setupFilters();
        this.loadInitialData();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initForm(): void {
        const today = new Date().toISOString().split('T')[0];
        this.ajusteForm = this.fb.group({
            realizadoPor:      ['', Validators.required],
            realizadoPorInput: [''],
            aprobadoPor:       ['', Validators.required],
            aprobadoPorInput:  [''],
            tipoAjuste:        ['INVENTARIO', Validators.required],
            documento:         [''],
            fecha:             [today, Validators.required],
            descripcion:       ['']
        });
    }

    private setupFilters(): void {
        this.ajusteForm.get('realizadoPorInput')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(200))
            .subscribe(value => {
                this.filteredFuncionarios = this.doFilterFuncionarios(value);
            });

        this.ajusteForm.get('aprobadoPorInput')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(200))
            .subscribe(value => {
                this.filteredAprobadores = this.doFilterFuncionarios(value);
            });
    }

    private loadInitialData(): void {
        this.isLoading = true;
        this.movementService.getPersonal().pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (data) => {
                this.funcionarios = data.map((p: any) => ({
                    id:     p.id || p.id_employee,
                    nombre: p.nombreCompleto || p.nombre || '',
                    cargo:  p.cargo || '',
                    area:   p.area || ''
                }));
                this.filteredFuncionarios = [...this.funcionarios];
                this.filteredAprobadores  = [...this.funcionarios];
            },
            error: () => {
                this.funcionarios = [];
                this.showSystemMessage('Error al cargar el personal', 'error');
            }
        });
    }

    private doFilterFuncionarios(value: string): Funcionario[] {
        if (!value) return [...this.funcionarios];
        const f = value.toLowerCase();
        return this.funcionarios.filter(p =>
            p.nombre.toLowerCase().includes(f) ||
            p.cargo.toLowerCase().includes(f)
        );
    }

    selectFuncionario(func: Funcionario): void {
        this.ajusteForm.patchValue({
            realizadoPor:      func.nombre,
            realizadoPorInput: func.nombre
        });
    }

    selectAprobador(func: Funcionario): void {
        this.ajusteForm.patchValue({
            aprobadoPor:      func.nombre,
            aprobadoPorInput: func.nombre
        });
    }

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
        const resumen: { [key: string]: number } = {};
        this.dataSource.forEach(item => {
            resumen[item.tipoAjuste] = (resumen[item.tipoAjuste] || 0) + 1;
        });
        return resumen;
    }

    getTotalCantidad(): number {
        return this.dataSource.reduce((sum, item) => sum + item.cantidad, 0);
    }

    getResumenPorEstado(): any {
        return {
            serviceable:   this.dataSource.filter(i => i.estado === 'SERVICEABLE').length,
            unserviceable: this.dataSource.filter(i => i.estado === 'UNSERVICEABLE').length,
            calibracion:   this.dataSource.filter(i => i.estado === 'EN_CALIBRACION').length,
            reparacion:    this.dataSource.filter(i => i.estado === 'REPARACION').length,
            nuevos:        this.dataSource.filter(i => i.estado === 'NUEVO').length
        };
    }


    getRealizadoPorNombre(): string { return this.ajusteForm.value.realizadoPorInput || 'No seleccionado'; }
    getAprobadoPorNombre(): string  { return this.ajusteForm.value.aprobadoPorInput  || 'No seleccionado'; }
    getDocumentoText(): string      { return this.ajusteForm.value.documento || 'Sin documento'; }
    getFechaText(): string          { return this.ajusteForm.value.fecha || ''; }

    goBack(): void {
        if (this.dataSource.some(item => item.selected)) {
            if (!confirm('Hay items seleccionados. ¿Está seguro de salir?')) return;
        }
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/entradas']);
        }
    }

    procesar(): void {
        if (this.dataSource.length === 0) { this.showSystemMessage('No hay items para procesar', 'error'); return; }
        if (!this.ajusteForm.value.realizadoPor) { this.showSystemMessage('Debe seleccionar quien realiza el ajuste', 'error'); return; }
        if (!this.ajusteForm.value.aprobadoPor)  { this.showSystemMessage('Debe seleccionar un aprobador', 'error'); return; }
        this.showConfirmModal = true;
    }

    openConfirmModal(): void { this.procesar(); }
    closeConfirmModal(): void { this.showConfirmModal = false; }

    finalizar(): void {
        const fv = this.ajusteForm.value;

        if (!fv.aprobadoPor)         { this.showSystemMessage('Debe seleccionar un aprobador', 'error'); return; }
        if (this.dataSource.length === 0) { this.showSystemMessage('No hay items', 'error'); return; }

        const sinId = this.dataSource.filter(i => !i.toolId || isNaN(i.toolId));
        if (sinId.length > 0) {
            this.showSystemMessage(`${sinId.length} herramienta(s) sin ID de sistema`, 'error');
            return;
        }

        this.isSaving = true;
        const itemsJson = JSON.stringify(this.dataSource.map(item => ({
            tool_id:  Number(item.toolId),
            quantity: item.cantidad,
            condicion: item.estado || 'good',
            notes:    item.obs || ''
        })));

        this.movementService.registrarAjusteIngreso({
            date:               fv.fecha,
            time:               new Date().toTimeString().slice(0, 8),
            responsible_person: fv.realizadoPorInput || fv.realizadoPor,
            authorized_by:      fv.aprobadoPorInput  || fv.aprobadoPor,
            document_number:    fv.documento  || '',
            notes:              fv.descripcion || '',
            items_json:         itemsJson
        }).pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isSaving = false)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.showSystemMessage(`Ajuste registrado: ${nro}`, 'success');
                this.showConfirmModal = false;
                this.dataSource = [];
                this.ajusteForm.patchValue({
                    realizadoPor: '', realizadoPorInput: '',
                    aprobadoPor:  '', aprobadoPorInput:  '',
                    descripcion:  '', documento:         ''
                });
                if (this.dialogRef) this.dialogRef.close({ success: true, data: result });
            },
            error: (err) => {
                this.showSystemMessage('Error al registrar el ajuste: ' + (err?.message || ''), 'error');
            }
        });
    }

    removeItem(item: AjusteItem): void {
        if (confirm(`¿Está seguro de eliminar el item ${item.codigoBoa}?`)) {
            this.dataSource = this.dataSource.filter(i => i.id !== item.id);
            this.showSystemMessage(`Item ${item.codigoBoa} eliminado`, 'info');
        }
    }

    editItem(item: AjusteItem): void { this.openDetalleHerramienta(item); }

    getTipoAjusteClass(tipo: string): string {
        return this.tiposAjuste.find(t => t.value === tipo)?.color || 'bg-gray-100 text-gray-800';
    }
    getTipoAjusteLabel(tipo: string): string {
        return this.tiposAjuste.find(t => t.value === tipo)?.label || tipo;
    }
    getTipoAjusteIcon(tipo: string): string {
        return this.tiposAjuste.find(t => t.value === tipo)?.icon || 'help';
    }
    getEstadoClass(estado: string): string {
        return this.estados.find(e => e.value === estado)?.color || 'bg-gray-100 text-gray-800';
    }
    getEstadoLabel(estado: string): string {
        return this.estados.find(e => e.value === estado)?.label || estado;
    }

    generarDocumento(): void {
        const tipo = this.ajusteForm.get('tipoAjuste')?.value;
        const prefijos: { [key: string]: string } = {
            'INVENTARIO': 'INV', 'REUBICACION': 'REUB', 'DONACION': 'DON',
            'ENCONTRADO': 'AJU', 'SOBRANTE': 'SOB',    'CORRECCION': 'CORR'
        };
        const prefijo = prefijos[tipo] || 'AJU';
        const year = new Date().getFullYear();
        const num  = Math.floor(Math.random() * 900) + 100;
        this.ajusteForm.patchValue({ documento: `${prefijo}-${year}-${num}` });
    }

    private showSystemMessage(msg: string, type: 'success' | 'error' | 'info'): void {
        this.message     = msg;
        this.messageType = type;
        this.showMessage = true;
        setTimeout(() => this.showMessage = false, 4000);
    }

    async openDetalleHerramienta(editItem?: AjusteItem): Promise<void> {
        const { DetalleHerramientaComponent } = await import('./detalle-herramienta/detalle-herramienta.component');
        const dialogRef = this.dialog.open(DetalleHerramientaComponent, {
            width: '1100px', maxWidth: '95vw',
            height: 'auto', maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true, disableClose: false, autoFocus: false,
            data: { tipoAjuste: this.ajusteForm.get('tipoAjuste')?.value, editItem }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action !== 'procesar') return;

            if (editItem) {
                const index = this.dataSource.findIndex(i => i.id === editItem.id);
                if (index !== -1) {
                    this.dataSource[index] = {
                        ...this.dataSource[index],
                        toolId:      result.data.toolId      || this.dataSource[index].toolId,
                        pn:          result.data.pn           || '',
                        descripcion: result.data.nombre       || '',
                        marca:       result.data.marca        || '',
                        sn:          result.data.sn           || '',
                        codigoBoa:   result.data.codigo       || '',
                        cantidad:    result.data.cantidad     || 1,
                        um:          result.data.um           || '',
                        estado:      result.data.estado       || '',
                        ubicacion:   result.data.ubicacion    || '',
                        tipoAjuste:  result.data.tipoAjuste   || this.ajusteForm.get('tipoAjuste')?.value,
                        documentos:  result.data.documento    || '',
                        obs:         result.data.observaciones || ''
                    };
                    this.dataSource = [...this.dataSource];
                    this.showSystemMessage(`Item ${result.data.codigo} actualizado`, 'success');
                }
            } else {
                const newItem: AjusteItem = {
                    id:          this.itemIdCounter++,
                    toolId:      result.data.toolId      || 0,
                    pn:          result.data.pn           || '',
                    descripcion: result.data.nombre       || '',
                    marca:       result.data.marca        || '',
                    sn:          result.data.sn           || '',
                    codigoBoa:   result.data.codigo       || '',
                    cantidad:    result.data.cantidad     || 1,
                    um:          result.data.um           || '',
                    estado:      result.data.estado       || '',
                    ubicacion:   result.data.ubicacion    || '',
                    tipoAjuste:  result.data.tipoAjuste   || this.ajusteForm.get('tipoAjuste')?.value,
                    documentos:  result.data.documento    || '',
                    obs:         result.data.observaciones || '',
                    selected:    false
                };
                this.dataSource = [...this.dataSource, newItem];
                this.showSystemMessage(`Item ${result.data.codigo} agregado`, 'success');
            }
        });
    }

    hasError(field: string, error: string): boolean {
        const control = this.ajusteForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }
}
