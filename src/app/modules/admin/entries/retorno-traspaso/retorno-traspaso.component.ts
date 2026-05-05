import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged, forkJoin, map, switchMap, of } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';

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

// Interfaz para el Historial (Modal)
interface HistorialRecord {
    id: string;
    fecha: string;
    tipo: string;
    documento: string;
    responsable: string;
    estado: string;
    raw?: any;
}

@Component({
    selector: 'app-retorno-traspaso',
    standalone: true,
    imports: [
        CommonModule, RouterModule, ReactiveFormsModule, FormsModule,
        MatCardModule, MatIconModule, MatButtonModule, MatTableModule,
        MatPaginatorModule, MatInputModule, MatFormFieldModule, MatSelectModule, MatDialogModule,
        MatSnackBarModule, MatProgressSpinnerModule, MatCheckboxModule, MatTooltipModule, DragDropModule
    ],
    templateUrl: './retorno-traspaso.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .spinner-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.8); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        .row-selected { background-color: #fffbeb !important; border-color: black !important; }
        :host-context(.dark) .row-selected { background-color: rgba(251, 191, 36, 0.1) !important; border-color: #fbbf24 !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
        ::ng-deep .white-checkbox .mdc-checkbox__background { border-color: white !important; }
        ::ng-deep .white-checkbox.mat-mdc-checkbox-checked .mdc-checkbox__background { background-color: white !important; border-color: white !important; }
        ::ng-deep .white-checkbox .mdc-checkbox__checkmark { color: #0f172a !important; }
    `]
})
export class RetornoTraspasoComponent implements OnInit, OnDestroy {
    @ViewChild('historialDialog') historialDialog!: TemplateRef<any>;
    @ViewChild(MatPaginator) paginator!: MatPaginator;

    public dialogRef = inject(MatDialogRef<RetornoTraspasoComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private _unsubscribeAll = new Subject<void>();

    retornoForm!: FormGroup;

    isLoading = false;
    isSaving = false;
    isSearching = false;
    showConfirmModal = false;
    tipoOrigenActivo: TipoOrigen = 'BASE';

    allData: TraspasoItem[] = [];
    dataSource: TraspasoItem[] = [];
    ubicaciones: Ubicacion[] = [];
    bases: Ubicacion[] = [];
    almacenes: Ubicacion[] = [];
    funcionarios: Funcionario[] = [];
    funcionariosLoading = false;
    showFuncionarioDropdown = false;

    // --- Variables para el Historial ---
    historialRecords: HistorialRecord[] = [];
    selectedHistorialEntry: HistorialRecord | null = null;
    isLoadingHistorial = false;
    totalRecords = 0;
    pageSize = 10;
    pageIndex = 0;
    pageSizeOptions = [5, 10, 25];
    displayedHistorialColumns: string[] = ['fecha', 'tipo', 'documento', 'responsable', 'estado', 'acciones'];

    condiciones: Array<{ value: CondicionRetorno; label: string; color: string; bgColor: string; icon: string; description: string }> = [
        { value: 'BUENO', label: 'Bueno', color: 'green', bgColor: 'bg-green-500', icon: 'check_circle', description: 'Perfecto estado, listo para uso' },
        { value: 'DAÑADO', label: 'Dañado', color: 'red', bgColor: 'bg-red-500', icon: 'report_problem', description: 'Requiere reparación o baja' },
        { value: 'REQUIERE_CALIBRACION', label: 'Req. Calibración', color: 'yellow', bgColor: 'bg-yellow-500', icon: 'speed', description: 'Necesita calibración antes de uso' },
        { value: 'FALTANTE', label: 'Faltante', color: 'red', bgColor: 'bg-red-600', icon: 'help_outline', description: 'No se encuentra, pérdida o extravío' }
    ];

    tiposEnvio: Array<{ value: TipoEnvio; label: string; color: string }> = [
        { value: 'EVENTUAL', label: 'Eventual', color: 'blue' },
        { value: 'PERMANENTE', label: 'Permanente', color: 'purple' },
        { value: 'AOG', label: 'AOG', color: 'red' },
        { value: 'TRASPASO', label: 'Traspaso', color: 'green' }
    ];

    ngOnInit(): void {
        this.initForm();
        this.precargarUsuarioSesion();
        this.loadUbicaciones();
        this.setupSearchFilter();
        this.setupFuncionarioSearch();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private initForm(): void {
        const today = new Date().toISOString().split('T')[0];
        this.retornoForm = this.fb.group({
            tipoOrigen: ['BASE', Validators.required],
            ubicacionOrigen: [null, Validators.required],
            searchText: [''],
            nroDocumento: ['', Validators.required],
            fechaRetorno: [today, Validators.required],
            transportista: [''],
            responsableRecibe: ['', Validators.required],
            observaciones: ['']
        });
    }

    private setupSearchFilter(): void {
        this.retornoForm.get('searchText')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll), debounceTime(300)
        ).subscribe(() => this.filterData());
    }

    private filterData(): void {
        const searchText = this.retornoForm.get('searchText')?.value?.toLowerCase().trim() || '';
        this.dataSource = this.allData.filter(item =>
            !searchText || item.descripcion.toLowerCase().includes(searchText) || item.pn.toLowerCase().includes(searchText) ||
            item.sn.toLowerCase().includes(searchText) || item.codigo.toLowerCase().includes(searchText) || item.nroNotaSalida.toLowerCase().includes(searchText)
        );
    }

    private loadUbicaciones(): void {
        this.isLoading = true;
        this.movementService.getBases().pipe(takeUntil(this._unsubscribeAll)).subscribe({
            next: (data) => {
                this.bases = data.map((b: any) => ({
                    id: b.id, nombre: b.nombre || b.name, codigo: b.codigo || b.code || '', ciudad: b.ciudad || b.city || '', tipo: 'base' as const
                }));
            }
        });

        this.movementService.getWarehouses().pipe(
            takeUntil(this._unsubscribeAll), finalize(() => this.isLoading = false)
        ).subscribe({
            next: (data) => {
                this.almacenes = data.filter((w: any) => w.type === 'warehouse' || w.tipo === 'almacen' || !w.type).map((w: any) => ({
                    id: w.id, nombre: w.nombre || w.name, codigo: w.codigo || w.code || '', tipo: 'almacen' as const
                }));
            }
        });
    }

    private precargarUsuarioSesion(): void {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            const nombre = auth.nombre_usuario || '';
            if (nombre) this.retornoForm.patchValue({ responsableRecibe: nombre });
        } catch {}
    }

    private setupFuncionarioSearch(): void {
        this.retornoForm.get('responsableRecibe')?.valueChanges.pipe(
            debounceTime(500), distinctUntilChanged(), switchMap(term => {
                const t = (term || '').trim();
                if (t.length < 3) {
                    this.funcionarios = []; this.showFuncionarioDropdown = false; this.funcionariosLoading = false; return of([]);
                }
                this.funcionariosLoading = true;
                return this.movementService.getFuncionarios(t);
            }),
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (data) => {
                this.funcionarios = data; this.funcionariosLoading = false; this.showFuncionarioDropdown = data.length > 0;
            },
            error: () => { this.funcionariosLoading = false; }
        });
    }

    selectFuncionario(func: Funcionario): void {
        this.retornoForm.patchValue({ responsableRecibe: func.nombre });
        this.funcionarios = []; this.showFuncionarioDropdown = false;
    }

    hideFuncionarioDropdown(): void { setTimeout(() => { this.showFuncionarioDropdown = false; }, 150); }

    getUbicacionesFiltradas(): Ubicacion[] { return this.tipoOrigenActivo === 'BASE' ? this.bases : this.almacenes; }
    getTipoOrigenLabel(): string { return this.tipoOrigenActivo === 'BASE' ? 'Base Operativa' : 'Almacén'; }
    getDocumentoLabel(): string { return this.tipoOrigenActivo === 'BASE' ? 'Nro. COMAT' : 'Nro. Traspaso'; }

    onTipoOrigenChange(tipo: TipoOrigen): void {
        this.tipoOrigenActivo = tipo;
        this.retornoForm.patchValue({ tipoOrigen: tipo, ubicacionOrigen: null });
        this.clearData();
    }

    consultar(): void {
        const ubicacionOrigen = this.retornoForm.get('ubicacionOrigen')?.value;
        if (!ubicacionOrigen || !ubicacionOrigen.id) { this.showMessage('Seleccione una ubicación de origen', 'warning'); return; }

        this.isSearching = true;
        const exitReason = this.tipoOrigenActivo === 'BASE' ? 'base_send' : 'transfer';
        const destId = Number(ubicacionOrigen.id);
        const filtroAdicional = `mos.type = 'exit' AND mos.exit_reason = '${exitReason}' AND mos.destination_warehouse_id = ${destId} AND mos.status = 'approved'`;

        this.movementService.getMovements({ filtro_adicional: filtroAdicional, limit: 200 }).pipe(
            takeUntil(this._unsubscribeAll), finalize(() => this.isSearching = false)
        ).subscribe({
            next: (data) => {
                const filtered = (data || []).filter((m: any) => m.type === 'exit' && m.exit_reason === exitReason);
                if (filtered.length === 0) {
                    this.allData = []; this.dataSource = []; this.showMessage(`No hay movimientos activos para ${ubicacionOrigen.nombre}`, 'warning'); return;
                }

                forkJoin(filtered.map((mov: any) => this.movementService.getMovementItems(Number(mov.id_movement)).pipe(map((items: any[]) => ({ mov, items }))))).pipe(takeUntil(this._unsubscribeAll)).subscribe({
                    next: (results: any[]) => {
                        const expanded: TraspasoItem[] = [];
                        results.forEach(({ mov, items }) => {
                            if (items && items.length > 0) {
                                items.forEach((item: any) => { expanded.push(this.mapMovementToTraspasoItem(mov, item, expanded.length)); });
                            }
                        });
                        this.allData = expanded; this.dataSource = [...this.allData];
                        if (this.allData.length === 0) { this.showMessage(`No hay herramientas en ${ubicacionOrigen.nombre}`, 'warning'); }
                        else { this.showMessage(`Carga completa: ${this.dataSource.length} herramienta(s) en ${ubicacionOrigen.nombre}`, 'success'); }
                    }
                });
            },
            error: (err) => { this.dataSource = []; this.showMessage('Error al buscar movimientos: ' + (err?.message || ''), 'error'); }
        });
    }

    private mapMovementToTraspasoItem(movement: any, item: any, index: number): TraspasoItem {
        const fechaEnvio = movement.date || '';
        return {
            id: movement.id_movement || movement.id || `temp-${index}`, filaObs: index + 1,
            toolId: String(item?.tool_id || item?.toolId || item?.tool?.id || ''),
            codigo: item?.tool?.code || item?.code || item?.codigo || '', descripcion: item?.tool?.description || item?.description || item?.descripcion || '',
            pn: item?.tool?.part_number || item?.part_number || item?.pn || '', sn: item?.tool?.serial_number || item?.serial_number || item?.sn || '',
            marca: item?.tool?.brand || item?.brand || item?.marca || '', cantidadEnviada: Number(item?.quantity) || 1, cantidadRetorna: Number(item?.quantity) || 1,
            fechaEnvio: fechaEnvio, nroNotaSalida: movement.movement_number || movement.movementNumber || '',
            ubicacionOrigen: this.bases.find(b => String(b.id) === String(movement.destination_warehouse_id))?.nombre || this.almacenes.find(a => String(a.id) === String(movement.destination_warehouse_id))?.nombre || movement.destinationWarehouse?.name || '',
            tipoEnvio: movement.tipoEnvio || movement.sendType || (this.tipoOrigenActivo === 'BASE' ? 'EVENTUAL' : 'TRASPASO'),
            ordenTrabajo: movement.workOrder || movement.ordenTrabajo || '', matriculaAeronave: movement.aircraftRegistration || movement.matriculaAeronave || '',
            motivoEnvio: movement.reason || movement.motivoEnvio || '', estadoSalida: movement.toolStatus || 'DISPONIBLE',
            diasFuera: fechaEnvio ? this.calcularDiasFuera(fechaEnvio) : 0, selected: false, expanded: false, condicion: '', observacionItem: ''
        };
    }

    private clearData(): void { this.allData = []; this.dataSource = []; }

    toggleSelection(item: TraspasoItem): void { item.selected = !item.selected; if (item.selected && !item.expanded) item.expanded = true; }
    toggleAllSelection(event: any): void { const checked = event.checked; this.dataSource.forEach(item => { item.selected = checked; if (checked && !item.expanded) item.expanded = true; }); }
    isAllSelected(): boolean { return this.dataSource.length > 0 && this.dataSource.every(item => item.selected); }
    isSomeSelected(): boolean { return this.dataSource.some(item => item.selected) && !this.isAllSelected(); }
    getSelectedItems(): TraspasoItem[] { return this.dataSource.filter(item => item.selected); }
    getSelectedCount(): number { return this.getSelectedItems().length; }
    toggleExpand(item: TraspasoItem): void { item.expanded = !item.expanded; }

    onCondicionChange(item: TraspasoItem, condicion: CondicionRetorno): void {
        item.condicion = condicion;
        if (condicion === 'FALTANTE') { item.cantidadRetorna = 0; } else if (item.cantidadRetorna === 0) { item.cantidadRetorna = item.cantidadEnviada; }
    }

    validateCantidadRetorna(item: TraspasoItem): void {
        if (item.cantidadRetorna > item.cantidadEnviada) item.cantidadRetorna = item.cantidadEnviada;
        if (item.cantidadRetorna < 0) item.cantidadRetorna = 0;
    }

    isItemValid(item: TraspasoItem): boolean {
        if (!item.selected) return true;
        if (!item.condicion) return false;
        if (item.condicion !== 'FALTANTE' && (item.cantidadRetorna <= 0 || item.cantidadRetorna > item.cantidadEnviada)) return false;
        if ((item.condicion === 'DAÑADO' || item.condicion === 'FALTANTE') && !item.observacionItem.trim()) return false;
        return true;
    }

    getItemErrors(item: TraspasoItem): string[] {
        const errors: string[] = [];
        if (!item.selected) return errors;
        if (!item.condicion) errors.push('Falta Condición');
        if (item.condicion !== 'FALTANTE' && item.cantidadRetorna <= 0) errors.push('Cantidad inválida');
        if (item.condicion !== 'FALTANTE' && item.cantidadRetorna > item.cantidadEnviada) errors.push('Excede enviado');
        if ((item.condicion === 'DAÑADO' || item.condicion === 'FALTANTE') && !item.observacionItem.trim()) errors.push('Falta Observación');
        return errors;
    }

    canProceed(): boolean {
        const selected = this.getSelectedItems();
        if (selected.length === 0) return false;
        if (this.retornoForm.invalid) return false;
        return selected.every(item => this.isItemValid(item));
    }

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

    getTotalEnviado(): number { return this.getSelectedItems().reduce((sum, item) => sum + item.cantidadEnviada, 0); }
    getTotalRetornado(): number { return this.getSelectedItems().reduce((sum, item) => sum + item.cantidadRetorna, 0); }
    getItemsCriticos(): TraspasoItem[] { return this.getSelectedItems().filter(item => (item.diasFuera && item.diasFuera > 30) || item.tipoEnvio === 'AOG'); }

    getCondicionConfig(condicion: CondicionRetorno | '') { return this.condiciones.find(c => c.value === condicion); }
    getTipoEnvioConfig(tipo: TipoEnvio) { return this.tiposEnvio.find(t => t.value === tipo); }

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
        const diffTime = Math.abs(new Date().getTime() - envio.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    openConfirmModal(): void {
        if (!this.canProceed()) {
            if (this.getSelectedCount() === 0) { this.showMessage('Seleccione herramientas', 'warning'); return; }
            this.retornoForm.markAllAsTouched();
            if (this.retornoForm.invalid) { this.showMessage('Complete datos de recepción', 'error'); return; }
            const invalidItems = this.getSelectedItems().filter(i => !this.isItemValid(i));
            if (invalidItems.length > 0) { this.showMessage(`${invalidItems.length} item(s) con errores`, 'error'); invalidItems.forEach(i => i.expanded = true); return; }
        }
        this.showConfirmModal = true;
    }

    closeConfirmModal(): void { this.showConfirmModal = false; }

    finalizar(): void {
        if (!this.canProceed()) return;
        this.closeConfirmModal();

        const selectedItems = this.getSelectedItems();
        const formValue = this.retornoForm.value;

        const sinId = selectedItems.filter(i => !i.toolId);
        if (sinId.length > 0) { this.showMessage(`${sinId.length} herramienta(s) sin ID de sistema`, 'error'); return; }

        this.isSaving = true;

        const itemsJson = JSON.stringify(selectedItems.map(item => ({
            tool_id: Number(item.toolId), quantity: item.cantidadRetorna, condicion: item.condicion || 'BUENO',
            notes: item.observacionItem || '', serial_number: item.sn || '', part_number: item.pn || ''
        })));

        this.movementService.registrarRetornoBase({
            type: this.tipoOrigenActivo === 'BASE' ? 'RETORNO_BASE' : 'RETORNO_TRASPASO',
            date: formValue.fechaRetorno, time: new Date().toTimeString().slice(0, 8),
            requested_by_name: formValue.responsableRecibe || '', responsible_person: formValue.responsableRecibe || '',
            document_number: formValue.nroDocumento, destination_warehouse_id: formValue.ubicacionOrigen?.id,
            source_warehouse_id: this.tipoOrigenActivo === 'TRASPASO' ? formValue.ubicacionOrigen?.id : undefined,
            notes: formValue.observaciones || '', specific_observations: formValue.transportista ? `Transportista: ${formValue.transportista}` : '',
            items_json: itemsJson
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this._unsubscribeAll)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.showMessage(`Retorno registrado: ${nro}`, 'success');
                const selectedIds = selectedItems.map(i => i.id);
                this.allData = this.allData.filter(item => !selectedIds.includes(item.id));
                this.dataSource = this.dataSource.filter(item => !selectedIds.includes(item.id));
                this.generarPdfRetorno(nro, selectedItems, formValue);
            },
            error: (err) => { this.showMessage('Error al registrar el retorno: ' + (err?.message || ''), 'error'); }
        });
    }

    clearSearch(): void { this.retornoForm.patchValue({ searchText: '' }); }

    private generarPdfRetorno(nroMovimiento: string, items: TraspasoItem[], form: any): void {
        const fecha = new Date(form.fechaRetorno).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const tipo = this.tipoOrigenActivo === 'BASE' ? 'RETORNO DE BASE' : 'RETORNO DE TRASPASO';
        const origen = form.ubicacionOrigen?.nombre || '';
        const responsable = form.responsableRecibe || '';
        const nroCmr = form.nroDocumento || '';
        const transportista = form.transportista || '---';
        const observaciones = form.observaciones || '---';
        const resumen = this.getResumenPorCondicion();

        const condLabel: Record<string, string> = { BUENO: 'Bueno', DAÑADO: 'Dañado', REQUIERE_CALIBRACION: 'Req. Calibración', FALTANTE: 'Faltante', '': 'Sin definir' };

        const filas = items.map((it, i) => `
            <tr><td style="text-align:center">${i + 1}</td><td>${it.codigo}</td><td>${it.descripcion}</td><td>${it.pn || '---'}</td><td>${it.sn || '---'}</td><td style="text-align:center">${it.cantidadRetorna} / ${it.cantidadEnviada}</td><td style="text-align:center;font-weight:bold;">${condLabel[it.condicion] || '---'}</td><td>${it.observacionItem || '---'}</td></tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${nroMovimiento}</title><style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px}.header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:12px}.header h1{font-size:15px;font-weight:900;text-transform:uppercase;margin:0}.header .nro{background:#0f172a;color:#fff;padding:6px 14px;font-size:14px;font-weight:900;border-radius:4px}.badge{display:inline-block;background:#fbbf24;color:#000;font-weight:900;padding:2px 8px;border-radius:3px;border:1px solid #000;font-size:10px;margin-bottom:6px}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 16px;margin-bottom:12px}.field label{display:block;font-size:9px;font-weight:900;text-transform:uppercase;color:#555}.field span{display:block;font-weight:700;font-size:11px;border-bottom:1px solid #ccc;padding-bottom:2px}table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10px}th{background:#0f172a;color:#fff;padding:5px 4px;text-align:left;font-size:9px;text-transform:uppercase}td{padding:4px;border-bottom:1px solid #ddd}tr:nth-child(even) td{background:#f8f9fc}.firmas{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px}.firma{border-top:2px solid #000;padding-top:6px;text-align:center;font-size:10px;font-weight:700}@media print{body{padding:10px}}</style></head><body>
        <div class="header"><div><div class="badge">${tipo}</div><h1>Acta de Retorno de Herramientas</h1><div style="font-size:10px;color:#555">BOLIVIANA DE AVIACIÓN — Almacén de Herramientas</div></div><div class="nro">${nroMovimiento}</div></div>
        <div class="grid"><div class="field"><label>Fecha Retorno</label><span>${fecha}</span></div><div class="field"><label>Nro. Documento (CMR)</label><span>${nroCmr}</span></div><div class="field"><label>Base / Almacén Origen</label><span>${origen}</span></div><div class="field"><label>Responsable Recibe</label><span>${responsable}</span></div><div class="field"><label>Transportista</label><span>${transportista}</span></div><div class="field"><label>Observaciones</label><span>${observaciones}</span></div></div>
        <table><thead><tr><th style="width:3%">#</th><th style="width:8%">Código BOA</th><th style="width:25%">Descripción</th><th style="width:14%">P/N</th><th style="width:12%">S/N</th><th style="width:10%;text-align:center">Cant. Ret/Env</th><th style="width:12%;text-align:center">Condición</th><th style="width:16%">Observación</th></tr></thead><tbody>${filas}</tbody></table>
        <div class="firmas"><div class="firma"><div style="height:36px"></div>ENTREGA CONFORME<br>${origen}</div><div class="firma"><div style="height:36px"></div>RECIBE CONFORME<br>${responsable}</div></div>
        <script>window.onload=()=>{window.print()}</script></body></html>`;
        const win = window.open('', '_blank', 'width=900,height=700'); if (win) { win.document.write(html); win.document.close(); }
    }

    // ── LÓGICA DEL HISTORIAL ───────────────────────────────────────────────
    abrirModalHistorial(): void {
        this.selectedHistorialEntry = null;
        this.loadHistorial();
        this.dialog.open(this.historialDialog, {
            width: '900px', maxWidth: '95vw', height: 'auto', maxHeight: '90vh',
            panelClass: 'neo-dialog-transparent', hasBackdrop: true, disableClose: false, autoFocus: false
        });
    }

    cerrarModalHistorial(): void { this.dialog.closeAll(); }

    loadHistorial(): void {
        this.isLoadingHistorial = true;
        this.movementService.getHistorialMovimientos({
            movement_type: 'entry', page: this.pageIndex + 1, limit: this.pageSize
        }).pipe(
            takeUntil(this._unsubscribeAll), finalize(() => this.isLoadingHistorial = false)
        ).subscribe({
            next: (response) => {
                if (response.data && response.data.length > 0) {
                    // Filtramos solo retornos de base y traspaso
                    const retornos = response.data.filter((item: any) =>
                        item.entry_reason === 'base_return' || item.entry_reason === 'transfer_return' ||
                        item.type === 'base_return' || item.type === 'transfer_return'
                    );

                    this.historialRecords = retornos.map((item: any) => ({
                        id: item.id_movement || item.id,
                        fecha: new Date(item.date || item.fecha).toLocaleDateString('es-BO'),
                        tipo: item.entry_reason === 'base_return' ? 'RETORNO DE BASE' : 'RETORNO TRASPASO',
                        documento: item.document_number || item.movement_number || '-',
                        responsable: item.requested_by_name || item.responsable || '-',
                        estado: (item.status || item.estado || 'N/A').toUpperCase(),
                        raw: item
                    }));
                    this.totalRecords = response.total || this.historialRecords.length;
                } else {
                    this.historialRecords = [];
                }
            },
            error: () => { this.showMessage('Error al cargar historial', 'error'); }
        });
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadHistorial();
    }

    verDetalleHistorial(entry: HistorialRecord): void { this.selectedHistorialEntry = entry; }
    cerrarDetalleHistorial(): void { this.selectedHistorialEntry = null; }

    getStatusClass(estado: string): string {
        switch (estado) {
            case 'APPROVED': case 'COMPLETADO': return 'bg-green-100 text-green-800 border-green-400';
            case 'PENDING': case 'PENDIENTE': return 'bg-yellow-100 text-yellow-800 border-yellow-400';
            case 'REVIEW': case 'REVISION': return 'bg-blue-100 text-blue-800 border-blue-400';
            default: return 'bg-gray-100 text-gray-800 border-gray-400';
        }
    }

    hasError(field: string, error: string): boolean {
        const control = this.retornoForm.get(field); return control ? control.hasError(error) && control.touched : false;
    }

    private showMessage(message: string, type: string): void {
        this.snackBar.open(message, 'OK', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
