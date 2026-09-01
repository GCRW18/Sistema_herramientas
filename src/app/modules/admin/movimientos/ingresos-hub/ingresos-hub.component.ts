import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, of, forkJoin } from 'rxjs';
import { takeUntil, finalize, catchError, debounceTime, map, mergeMap } from 'rxjs/operators';
import { MovementService }    from '../../../../core/services/movement.service';
import { CalibrationService }   from '../../../../core/services/calibration.service';
import { GestionUbicacionesService } from '../../inventory/gestion-ubicaciones/gestion-ubicaciones.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { localDateStr, formatDateDMY } from '../../../../core/utils/date.utils';
import { IngresoPdfService, IngresoPdfItem } from './ingreso-pdf.service';

export interface HerramientaItem {
    pn: string;
    sn: string;
    descripcion: string;
    codigoBoa: string;
    cantidad: number;
    unidadMedida: string;
    estado: string;
    estante: string;
    nivelUbicacion: string;
    accesorios?: string;
    observacion: string;
    requiereCalibracion: boolean;
    intervaloCalibracion: number | null;
    fechaCalibracion: string | null;
    nroCertificado: string;
    tipo: string;
    marca: string;
    nivelCriticidad: string;
    fabricacion: string;
    /** Campos oficiales MGH-116 (SCP-43) — se guardan en he.ttools.warranty_expiration
     *  y he.tmovement_items.batch_number respectivamente. */
    fechaVencimiento?: string | null;
    loteNumero?: string;
    imagen?: string | null;
    warehouseId?: number | null;
    rackId?: number | null;
    levelId?: number | null;
}

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
    obs: string;
    tipo?: string;
    nivelCriticidad?: string;
    fabricacion?: string;
    warehouseId?: number | null;
    rackId?: number | null;
    levelId?: number | null;
    imagen?: string | null;
}

type TabType = 'nueva' | 'ajuste' | 'historial';

@Component({
    selector: 'app-ingresos-hub',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule,
        MatIconModule, MatSnackBarModule, MatProgressSpinnerModule,
        MatTooltipModule,
        HasPermissionDirective
    ],
    templateUrl: './ingresos-hub.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar-ing::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ing::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ing::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
        [hidden] { display: none !important; }
        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(15,23,42,0.85); }
        @keyframes pulse-border { 0%,100% { border-color:#ef4444; } 50% { border-color:#f87171; } }
        .animate-pulse-border { animation: pulse-border 2s cubic-bezier(.4,0,.6,1) infinite; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
        ::ng-deep .ubic-backdrop { background: rgba(0,0,0,0.25) !important; }
    `]
})
export class IngresosHubComponent implements OnInit, OnDestroy {

    public  dialogRefComponent = inject(MatDialogRef<IngresosHubComponent>, { optional: true });
    private dialog      = inject(MatDialog);
    private fb          = inject(FormBuilder);
    private snackBar    = inject(MatSnackBar);
    private movementSvc    = inject(MovementService);
    private calibrationSvc = inject(CalibrationService);
    private ubicSvc        = inject(GestionUbicacionesService);
    private ingresoPdfSvc  = inject(IngresoPdfService);
    private destroy$       = new Subject<void>();

    // ── Tab state ──────────────────────────────────────────────────────────────
    activeTab = signal<TabType>('nueva');
    setTab(tab: TabType): void {
        this.activeTab.set(tab);
        if (tab === 'historial' && this.historialItems.length === 0 && !this.isLoadingHistorial) {
            this.loadHistorial();
        }
    }

    // ── Inline delete confirmation ─────────────────────────────────────────────
    confirmingDeleteNueva:  number | null = null;
    confirmingDeleteAjuste: number | null = null;

    // ══════════════════════════════════════════════════════════════════════════
    //  NUEVA HERRAMIENTA
    // ══════════════════════════════════════════════════════════════════════════
    recepcionForm!: FormGroup;
    dataSource: HerramientaItem[] = [];
    isSaving      = false;

    // ── Historial ──────────────────────────────────────────────────────────────
    searchControl      = new FormControl('');
    filterMovType      = new FormControl('');
    historialItems:    any[] = [];
    filteredHistorial: any[] = [];
    isLoadingHistorial = false;
    historialTotal     = 0;

    async abrirDetalleRecepcion(): Promise<void> {
        const { DetalleRecepcionComponent } = await import('./detalle-recepcion/detalle-recepcion.component');
        const ref = this.dialog.open(DetalleRecepcionComponent, {
            width: '460px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog', disableClose: false, autoFocus: false,
            data: { recepcion: { ...this.recepcionForm.value, fechaIngreso: formatDateDMY(this.recepcionForm.value.fechaIngreso) } }
        });
        ref.afterClosed().subscribe((result: any) => {
            if (result?.action === 'edit') this.abrirModalRecepcion();
        });
    }

    async abrirDetalleAjuste(): Promise<void> {
        const { DetalleAjusteComponent } = await import('./detalle-ajuste/detalle-ajuste.component');
        const ref = this.dialog.open(DetalleAjusteComponent, {
            width: '460px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog', disableClose: false, autoFocus: false,
            data: { resumen: this._buildResumenAjuste() }
        });
        ref.afterClosed().subscribe((result: any) => {
            if (result?.action === 'edit') this.abrirModalDatosAjuste();
        });
    }

    async abrirDetalleItem(item: HerramientaItem): Promise<void> {
        const { DetalleItemNuevaComponent } = await import('./detalle-item-nueva/detalle-item-nueva.component');
        this.dialog.open(DetalleItemNuevaComponent, {
            width: '460px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog', disableClose: false, autoFocus: false,
            data: { item }
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  AJUSTE INGRESO
    // ══════════════════════════════════════════════════════════════════════════
    ajusteForm!: FormGroup;
    dataSourceAjuste: AjusteItem[] = [];
    isSavingAjuste = false;
    itemIdCounter  = 1;

    tiposAjuste = [
        { value: 'INVENTARIO',  label: 'Ajuste Inventario',  color: 'bg-blue-100 text-blue-800 border-blue-400',      icon: 'inventory_2'   },
        { value: 'REUBICACION', label: 'Reubicación',        color: 'bg-purple-100 text-purple-800 border-purple-400', icon: 'swap_horiz'    },
        { value: 'DONACION',    label: 'Donación Recibida',  color: 'bg-green-100 text-green-800 border-green-400',    icon: 'card_giftcard' },
        { value: 'ENCONTRADO',  label: 'Item Encontrado',    color: 'bg-amber-100 text-amber-800 border-amber-400',    icon: 'search'        },
        { value: 'SOBRANTE',    label: 'Sobrante',           color: 'bg-cyan-100 text-cyan-800 border-cyan-400',       icon: 'add_box'       },
        { value: 'CORRECCION',  label: 'Corrección Sistema', color: 'bg-red-100 text-red-800 border-red-400',          icon: 'build'         }
    ];

    estadosAjuste = [
        { value: 'SERVICEABLE',    label: 'Serviceable',    color: 'bg-green-100 text-green-800 border-green-400'   },
        { value: 'UNSERVICEABLE',  label: 'Unserviceable',  color: 'bg-red-100 text-red-800 border-red-400'         },
        { value: 'EN_CALIBRACION', label: 'En Calibración', color: 'bg-yellow-100 text-yellow-800 border-yellow-400' },
        { value: 'REPARACION',     label: 'En Reparación',  color: 'bg-orange-100 text-orange-800 border-orange-400' },
        { value: 'NUEVO',          label: 'Nuevo',          color: 'bg-blue-100 text-blue-800 border-blue-400'      }
    ];

    // ══════════════════════════════════════════════════════════════════════════
    //  LIFECYCLE
    // ══════════════════════════════════════════════════════════════════════════
    ngOnInit(): void {
        this._initFormsNueva();
        this._initFormAjuste();

        this.searchControl.valueChanges.pipe(
            debounceTime(250), takeUntil(this.destroy$)
        ).subscribe(() => this.applyHistorialFilters());

        this.filterMovType.valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe(() => this.applyHistorialFilters());
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  NUEVA HERRAMIENTA — FORMS
    // ══════════════════════════════════════════════════════════════════════════
    private _initFormsNueva(): void {
        this.recepcionForm = this.fb.group({
            tipoDe:           ['COMPRA', Validators.required],
            nroCmr:           ['', [Validators.required, Validators.minLength(3)]],
            nroFactura:       [''],
            proveedor:        [''],
            fechaIngreso:     [this._localDateStr(), Validators.required],
            funcionarioRecibe: ['', Validators.required],
            recibiConforme:   [''],
            ordenCompra:      [''],
            observaciones:    ['']
        });
    }

    // ── Nueva: modal handlers ─────────────────────────────────────────────────
    async abrirModalRecepcion(): Promise<void> {
        const { DatosRecepcionComponent } = await import('./datos-recepcion/datos-recepcion.component');
        this.dialog.open(DatosRecepcionComponent, {
            width: '520px', maxWidth: '95vw', height: '88vh', panelClass: 'no-padding-dialog', disableClose: true,
            data: { form: this.recepcionForm }
        });
    }

    async abrirModalHerramienta(index?: number): Promise<void> {
        const { RecepcionHerramientaComponent } = await import('./recepcion-herramienta/recepcion-herramienta.component');
        const isEdit = index !== undefined;
        const ref = this.dialog.open(RecepcionHerramientaComponent, {
            width: '800px', maxWidth: '96vw', height: '560px', panelClass: 'no-padding-dialog', disableClose: true,
            data: { item: isEdit ? this.dataSource[index] : undefined, mode: isEdit ? 'editar' : 'nuevo' }
        });
        ref.afterClosed().subscribe((result: any) => this._procesarResultadoHerramienta(result, isEdit ? index : undefined));
    }

    private _procesarResultadoHerramienta(result: { action: string; data: HerramientaItem } | undefined, editIndex?: number): void {
        if (!result) return;
        const item = result.data;
        const existeIndex = this.dataSource.findIndex(i => i.codigoBoa.toUpperCase() === item.codigoBoa.toUpperCase());
        if (existeIndex >= 0 && editIndex !== existeIndex) {
            this._showMsg('Ya existe una herramienta con este código BOA', 'warning');
            return;
        }
        if (editIndex !== undefined) {
            this.dataSource[editIndex] = item;
            this._showMsg('Herramienta actualizada en la recepción', 'success');
        } else {
            this.dataSource.push(item);
            this._showMsg('Herramienta añadida a la recepción', 'success');
        }
        this.dataSource = [...this.dataSource];
    }

    async abrirModalConfirmacionNueva(): Promise<void> {
        const validation = this.validateRecepcion();
        if (!validation.valid) {
            validation.errors.forEach(err => this._showMsg(err, 'error'));
            this.abrirModalRecepcion();
            return;
        }
        if (this.dataSource.length === 0) {
            this._showMsg('Agregue al menos una herramienta a la lista', 'warning');
            return;
        }
        const { ConfirmarRecepcionComponent } = await import('./confirmar-recepcion/confirmar-recepcion.component');
        const ref = this.dialog.open(ConfirmarRecepcionComponent, {
            width: '580px', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true,
            data: { recepcion: { ...this.recepcionForm.value, fechaIngreso: formatDateDMY(this.recepcionForm.value.fechaIngreso) }, items: this.dataSource }
        });
        ref.afterClosed().subscribe((result: any) => {
            if (result?.action === 'revisar') this.abrirModalRecepcion();
            else if (result?.action === 'confirmar') this.finalizarIngreso();
        });
    }

    // ── Nueva: table actions ──────────────────────────────────────────────────
    eliminarItemNueva(index: number): void {
        this.confirmingDeleteNueva = index;
    }

    cancelarEliminarNueva(): void {
        this.confirmingDeleteNueva = null;
    }

    ejecutarEliminarNueva(index: number): void {
        this.dataSource.splice(index, 1);
        this.dataSource = [...this.dataSource];
        this.confirmingDeleteNueva = null;
    }

    async duplicarItem(index: number): Promise<void> {
        const { RecepcionHerramientaComponent } = await import('./recepcion-herramienta/recepcion-herramienta.component');
        const copy: any = { ...this.dataSource[index] };
        copy.sn = '';
        copy.codigoBoa      = 'BOA-H-';
        copy.estante        = '';
        copy.nivelUbicacion = '';
        copy.warehouseId    = null;
        copy.rackId         = null;
        copy.levelId        = null;
        const ref = this.dialog.open(RecepcionHerramientaComponent, {
            width: '800px', maxWidth: '96vw', height: '560px', panelClass: 'no-padding-dialog', disableClose: true,
            data: { item: copy, mode: 'nuevo', autoGenerarCodigo: true }
        });
        ref.afterClosed().subscribe((result: any) => this._procesarResultadoHerramienta(result));
        this._showMsg('Ítem copiado. Ajuste el S/N si es necesario.', 'info');
    }

    // ── Nueva: finalize ───────────────────────────────────────────────────────
    finalizarIngreso(): void {
        this.isSaving = true;
        const rec = this.recepcionForm.value;
        const prov = rec.proveedor;
        const provNombre = typeof prov === 'object' ? prov?.nombre : prov || '';
        const itemsSnapshot = [...this.dataSource];
        const itemsJson = JSON.stringify(itemsSnapshot.map(h => ({
            code: h.codigoBoa, name: h.descripcion, description: h.descripcion,
            tool_type: h.tipo || 'HERRAMIENTA',
            brand: h.marca || '', part_number: h.pn || '', serial_number: h.sn || '',
            quantity: h.cantidad,
            shelf: h.estante || '', shelf_level: h.nivelUbicacion || '', accessories: h.accesorios || '',
            warehouse_id: h.warehouseId || null, rack_id: h.rackId || null, level_id: h.levelId || null,
            image_base64: h.imagen || '',
            document_ref: '', unit_of_measure: h.unidadMedida || 'UNIDAD',
            condition: h.estado === 'NUEVO' ? 'new' : h.estado === 'REACONDICIONADO' ? 'reconditioned' : 'good',
            criticality_level: h.nivelCriticidad || 'B', manufacture_origin: h.fabricacion || 'INTERNACIONAL',
            requires_calibration: h.requiereCalibracion || false, calibration_interval: h.intervaloCalibracion || null,
            calibration_date: h.fechaCalibracion || null, certificate_number: h.nroCertificado || '', notes: h.observacion || '',
            warranty_expiration: h.fechaVencimiento || null, batch_number: h.loteNumero || ''
        })));
        this.movementSvc.registrarNuevaCompra({
            movement_number:    rec.nroCmr,
            date:               rec.fechaIngreso,
            responsible_person: rec.funcionarioRecibe || '',
            received_by_name:   rec.recibiConforme   || '',
            supplier:           provNombre,
            invoice_number:     rec.nroFactura       || '',
            purchase_order:     rec.ordenCompra      || '',
            notes:              (rec.tipoDe ? '[' + rec.tipoDe + '] ' : '') + (rec.observaciones || ''),
            warehouse_id: null,
            items_json: itemsJson
        }).pipe(takeUntil(this.destroy$), finalize(() => this.isSaving = false))
            .subscribe({
                next: (resp: any) => {
                    this._showMsg(`Recepción registrada: ${resp?.movement_number || rec.nroCmr}`, 'success');
                    this._abrirImpresionIngreso(resp?.movement_number || rec.nroCmr, itemsSnapshot, rec, provNombre);
                    // Reset in-place — no navigate
                    this.dataSource = [];
                    this.recepcionForm.reset({
                        tipoDe: 'COMPRA',
                        fechaIngreso: this._localDateStr()
                    });
                    this.loadHistorial();
                },
                error: (err: any) => {
                    const msg = err?.message || 'Error al registrar';
                    const esCodigoDuplicado = /ya esta registrad[oa]/i.test(msg);
                    this._showMsg(msg, esCodigoDuplicado ? 'warning' : 'error');
                }
            });
    }

    async openCatalogo(): Promise<void> {
        const { CatalogoHerramientasComponent } = await import('./catalogo-herramientas/catalogo-herramientas.component');
        const ref = this.dialog.open(CatalogoHerramientasComponent, {
            width: '760px', maxWidth: '95vw', height: '80vh', panelClass: 'no-padding-dialog', disableClose: false
        });
        ref.afterClosed().subscribe((result: any) => {
            if (result?.action === 'select') this.selectFromCatalog(result.tool);
            else if (result?.action === 'new') this.abrirModalHerramienta();
        });
    }

    async selectFromCatalog(tool: any): Promise<void> {
        const { RecepcionHerramientaComponent } = await import('./recepcion-herramienta/recepcion-herramienta.component');
        const item: any = {
            pn:          tool.part_number  || tool.pn          || '',
            sn:          tool.serial_number || tool.sn          || '',
            descripcion: tool.name         || tool.description  || tool.descripcion || '',
            marca:       tool.brand        || tool.marca        || '',
            tipo:        tool.tool_type    || 'HERRAMIENTA',
            unidadMedida: tool.unit_of_measure || 'UNIDAD',
            estado:      'NUEVO',
        };
        const ref = this.dialog.open(RecepcionHerramientaComponent, {
            width: '800px', maxWidth: '96vw', height: '560px', panelClass: 'no-padding-dialog', disableClose: true,
            data: { item, mode: 'nuevo', autoGenerarCodigo: true }
        });
        ref.afterClosed().subscribe((result: any) => this._procesarResultadoHerramienta(result));
    }

    // ── Nueva: utilities ──────────────────────────────────────────────────────
    isRecepcionValida(): boolean { return this.recepcionForm.valid; }

    validateRecepcion(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        this.recepcionForm.markAllAsTouched();
        if (this.recepcionForm.get('nroCmr')?.invalid)         errors.push('Falta Nro Documento/CMR');
        if (this.recepcionForm.get('fechaIngreso')?.invalid)   errors.push('Falta Fecha de Recepción');
        if (!this.recepcionForm.get('funcionarioRecibe')?.value) errors.push('Falta Funcionario que Recibe');
        return { valid: errors.length === 0, errors };
    }

    getTotalItems(): number { return this.dataSource.reduce((sum, i) => sum + i.cantidad, 0); }

    // ── Categorías dinámicas ──────────────────────────────────────────────────
    async abrirCategorias(): Promise<void> {
        const { CategoriaIngresosDialogComponent } = await import('./categoria-ingresos-dialog/categoria-ingresos-dialog.component');
        this.dialog.open(CategoriaIngresosDialogComponent, {
            panelClass: 'no-padding-dialog', disableClose: false
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  AJUSTE INGRESO — FORMS
    // ══════════════════════════════════════════════════════════════════════════
    private _initFormAjuste(): void {
        this.ajusteForm = this.fb.group({
            realizadoPor:      ['', Validators.required],
            realizadoPorInput: [''],
            aprobadoPor:       ['', Validators.required],
            aprobadoPorInput:  [''],
            tipoAjuste:        ['INVENTARIO', Validators.required],
            documento:         [''],
            fecha:             [localDateStr(), Validators.required],
            descripcion:       ['']
        });
    }

    // ── Ajuste: modal handlers ────────────────────────────────────────────────
    async abrirModalDatosAjuste(): Promise<void> {
        const { DatosAjusteComponent } = await import('./datos-ajuste/datos-ajuste.component');
        this.dialog.open(DatosAjusteComponent, {
            width: '820px', maxWidth: '98vw', height: '88vh', panelClass: 'no-padding-dialog', disableClose: true,
            data: { form: this.ajusteForm }
        });
    }

    isDatosAjusteValido(): boolean { return this.ajusteForm.valid; }

    private _buildResumenAjuste(): {
        realizadoPor: string; aprobadoPor: string; tipoLabel: string; fecha: string;
        documento: string; descripcion: string; totalLineas: number; totalCantidad: number;
        porTipo: { label: string; icon: string; count: number }[]; isValido: boolean;
    } {
        const fv = this.ajusteForm.value;
        return {
            realizadoPor:  this.getRealizadoPorNombre(),
            aprobadoPor:   this.getAprobadoPorNombre(),
            tipoLabel:     this.getTipoAjusteLabel(fv.tipoAjuste),
            fecha:         this.getFechaText(),
            documento:     this.getDocumentoText(),
            descripcion:   fv.descripcion || '',
            totalLineas:   this.dataSourceAjuste.length,
            totalCantidad: this.getTotalCantidadAjuste(),
            porTipo: this.getResumenPorTipoEntries()
                .map(e => {
                    const t = this.tiposAjuste.find(x => x.value === e.key);
                    return { label: t?.label || e.key, icon: t?.icon || 'category', count: e.value };
                }),
            isValido: this.isDatosAjusteValido()
        };
    }

    async abrirModalConfirmacionAjuste(): Promise<void> {
        this.ajusteForm.markAllAsTouched();
        if (this.ajusteForm.invalid) {
            this._showMsg('Complete los datos generales del ajuste', 'error');
            this.abrirModalDatosAjuste();
            return;
        }
        if (this.dataSourceAjuste.length === 0) {
            this._showMsg('Agregue al menos una herramienta', 'warning');
            return;
        }
        const { ConfirmarAjusteComponent } = await import('./confirmar-ajuste/confirmar-ajuste.component');
        const ref = this.dialog.open(ConfirmarAjusteComponent, {
            width: '580px', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true,
            data: { resumen: this._buildResumenAjuste() }
        });
        ref.afterClosed().subscribe((result: any) => {
            if (result?.action === 'revisar') this.abrirModalDatosAjuste();
            else if (result?.action === 'confirmar') this.finalizarAjuste();
        });
    }

    // ── Ajuste: table actions ─────────────────────────────────────────────────
    getTotalCantidadAjuste(): number { return this.dataSourceAjuste.reduce((s, i) => s + i.cantidad, 0); }

    getResumenPorTipo(): { [key: string]: number } {
        const resumen: { [key: string]: number } = {};
        this.dataSourceAjuste.forEach(i => { resumen[i.tipoAjuste] = (resumen[i.tipoAjuste] || 0) + 1; });
        return resumen;
    }

    getResumenPorTipoEntries(): { key: string; value: number }[] {
        const r = this.getResumenPorTipo();
        return Object.keys(r).map(k => ({ key: k, value: r[k] }));
    }

    removeItemAjuste(item: AjusteItem): void {
        this.confirmingDeleteAjuste = item.id;
    }

    cancelarEliminarAjuste(): void {
        this.confirmingDeleteAjuste = null;
    }

    ejecutarEliminarAjuste(item: AjusteItem): void {
        this.dataSourceAjuste = this.dataSourceAjuste.filter(i => i.id !== item.id);
        this.confirmingDeleteAjuste = null;
        this._showMsg(`Item ${item.codigoBoa} eliminado`, 'info');
    }

    editItemAjuste(item: AjusteItem): void { this.openDetalleHerramienta(item); }

    async openDetalleHerramienta(editItem?: AjusteItem): Promise<void> {
        const { DetalleHerramientaComponent } = await import('./detalle-herramienta/detalle-herramienta.component');
        const ref = this.dialog.open(DetalleHerramientaComponent, {
            width: '800px', maxWidth: '96vw', height: '560px',
            panelClass: 'no-padding-dialog', hasBackdrop: true, disableClose: false, autoFocus: false,
            data: { tipoAjuste: this.ajusteForm.get('tipoAjuste')?.value, editItem }
        });
        ref.afterClosed().subscribe((result: any) => {
            if (result?.action !== 'procesar') return;
            const mapped = {
                toolId:          result.data.toolId          || 0,
                pn:              result.data.pn              || '',
                descripcion:     result.data.nombre          || '',
                marca:           result.data.marca           || '',
                sn:              result.data.sn              || '',
                codigoBoa:       result.data.codigo          || '',
                cantidad:        result.data.cantidad        || 1,
                um:              result.data.um              || '',
                estado:          result.data.estado          || '',
                ubicacion:       result.data.ubicacion       || '',
                tipoAjuste:      result.data.tipoAjuste      || this.ajusteForm.get('tipoAjuste')?.value,
                obs:             result.data.observaciones   || '',
                tipo:            result.data.tipo            || 'HERRAMIENTA',
                nivelCriticidad: result.data.nivelCriticidad || 'B',
                fabricacion:     result.data.fabricacion     || 'INTERNACIONAL',
                warehouseId:     result.data.warehouseId     || null,
                rackId:          result.data.rackId          || null,
                levelId:         result.data.levelId         || null,
                imagen:          result.data.imagenNueva || result.data.imagenMaster || null,
            };
            if (editItem) {
                const idx = this.dataSourceAjuste.findIndex(i => i.id === editItem.id);
                if (idx !== -1) {
                    this.dataSourceAjuste[idx] = { ...this.dataSourceAjuste[idx], ...mapped };
                    this.dataSourceAjuste = [...this.dataSourceAjuste];
                    this._showMsg(`Item ${result.data.codigo} actualizado`, 'success');
                }
            } else {
                const codigoNuevo = (result.data.codigo || '').toUpperCase();
                if (codigoNuevo && this.dataSourceAjuste.some(i => i.codigoBoa.toUpperCase() === codigoNuevo)) {
                    this._showMsg(`Código ${codigoNuevo} ya está en la lista de ajuste`, 'warning');
                    return;
                }
                const newItem: AjusteItem = { id: this.itemIdCounter++, ...mapped };
                this.dataSourceAjuste = [...this.dataSourceAjuste, newItem];
                this._showMsg(`Item ${result.data.codigo} agregado`, 'success');
            }
        });
    }

    // ── Ajuste: finalize ──────────────────────────────────────────────────────
    finalizarAjuste(): void {
        const fv = this.ajusteForm.value;
        if (!fv.aprobadoPor) { this._showMsg('Debe seleccionar un aprobador', 'error'); return; }
        if (this.dataSourceAjuste.length === 0) { this._showMsg('No hay items', 'error'); return; }
        const sinId = this.dataSourceAjuste.filter(i => !i.toolId || isNaN(i.toolId));
        if (sinId.length > 0) {
            this._showMsg(`${sinId.length} herramienta(s) sin ID de sistema`, 'error');
            return;
        }
        this.isSavingAjuste = true;
        const itemsJson = JSON.stringify(this.dataSourceAjuste.map(i => ({
            tool_id:  Number(i.toolId),
            quantity: i.cantidad,
            condicion: i.estado || 'SERVICEABLE',
            notes:    [
                i.tipoAjuste  ? '[' + i.tipoAjuste + ']'   : '',
                i.obs || ''
            ].filter(Boolean).join(' | '),
            image_base64: i.imagen || ''
        })));
        const tipoLabel = fv.tipoAjuste || 'INVENTARIO';
        // Ubicación elegida en el picker (rack/nivel) de cada item: registrarAjusteIngreso
        // solo actualiza cantidad/condición/notas, no toca ubicación (mismo criterio que
        // HE_KIT_MOD/HE_MIS_MOD). Se aplica aparte con moveLevelTool (HE_LTL_MOV).
        const itemsConUbicacion = this.dataSourceAjuste.filter(i => i.rackId && i.levelId);
        this.movementSvc.registrarAjusteIngreso({
            date:               fv.fecha,
            time:               new Date().toTimeString().slice(0, 8),
            responsible_person: fv.realizadoPorInput || fv.realizadoPor,
            authorized_by:      fv.aprobadoPorInput  || fv.aprobadoPor,
            document_number:    fv.documento  || '',
            notes:              '[' + tipoLabel + '] ' + (fv.descripcion || ''),
            items_json:         itemsJson
        }).pipe(
            takeUntil(this.destroy$),
            mergeMap((result: any) => {
                if (itemsConUbicacion.length === 0) return of(result);
                return forkJoin(itemsConUbicacion.map(i =>
                    this.ubicSvc.moveLevelTool(i.toolId, i.rackId!, i.levelId!).pipe(catchError(() => of(null)))
                )).pipe(map(() => result));
            }),
            finalize(() => this.isSavingAjuste = false)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._abrirImpresionAjuste(nro, this.dataSourceAjuste, fv);
                this._showMsg(`Ajuste registrado exitosamente: ${nro}`, 'success');
                this.dataSourceAjuste = [];
                this.ajusteForm.reset({ tipoAjuste: 'INVENTARIO', fecha: localDateStr() });
                this.loadHistorial();
            },
            error: (err: any) => this._showMsg('Error al registrar el ajuste: ' + (err?.message || ''), 'error')
        });
    }

    // ── Ajuste: utilities ─────────────────────────────────────────────────────
    getRealizadoPorNombre(): string { return this.ajusteForm.value.realizadoPorInput || 'No seleccionado'; }
    getAprobadoPorNombre():  string { return this.ajusteForm.value.aprobadoPorInput  || 'No seleccionado'; }
    getDocumentoText():      string { return this.ajusteForm.value.documento || 'S/D'; }
    getFechaText():          string { return formatDateDMY(this.ajusteForm.value.fecha); }

    getTipoAjusteLabel(tipo: string): string {
        return this.tiposAjuste.find(t => t.value === tipo)?.label || tipo;
    }
    getEstadoAjusteLabel(estado: string): string {
        return this.estadosAjuste.find(e => e.value === estado)?.label || estado;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  HISTORIAL
    // ══════════════════════════════════════════════════════════════════════════
    loadHistorial(): void {
        this.isLoadingHistorial = true;
        this.movementSvc.getHistorialMovimientos({ limit: 200, movement_type: 'entry' })
            .pipe(takeUntil(this.destroy$), finalize(() => this.isLoadingHistorial = false),
                catchError(() => of({ data: [], total: 0 })))
            .subscribe((result: any) => {
                this.historialItems = result.data || [];
                this.historialTotal = this.historialItems.length;
                this.applyHistorialFilters();
            });
    }

    applyHistorialFilters(): void {
        const q    = (this.searchControl.value || '').toLowerCase().trim();
        const tipo = this.filterMovType.value || '';
        let base   = this.historialItems;
        if (tipo === 'purchase') {
            base = base.filter((m: any) => (m.movement_number || '').toUpperCase().startsWith('ING-'));
        } else if (tipo === 'adjustment') {
            base = base.filter((m: any) => (m.movement_number || '').toUpperCase().startsWith('AI-'));
        }
        this.filteredHistorial = q
            ? base.filter((m: any) =>
                (m.movement_number    || '').toLowerCase().includes(q) ||
                (m.responsible_person || '').toLowerCase().includes(q) ||
                (m.received_by_name   || '').toLowerCase().includes(q) ||
                (m.supplier || m.document_number || '').toLowerCase().includes(q))
            : [...base];
    }

    isAjusteIngreso(m: any): boolean {
        return (m.movement_number || '').toUpperCase().startsWith('AI-');
    }

    /** Reimpresión desde el historial. COMPRA usa el formato oficial MGH-116
     *  (IngresoPdfService, mismo layout que la impresión inmediata al guardar);
     *  AJUSTE_INGRESO sigue con el layout genérico propio de esta función —
     *  fuera de alcance de la consolidación MGH-116 (tiene su propia hoja Excel
     *  "AJUSTE INGRESO" pendiente de recalcar aparte). */
    pdfHistorialItem(m: any): void {
        if (!this.isAjusteIngreso(m)) {
            this._pdfHistorialCompraOficial(m);
            return;
        }
        const generarPdfConItems = (items: any[]) => {
            const nro   = m.movement_number || '---';
            const fecha = m.date ? new Date(m.date).toLocaleDateString('es-BO') : '';
            const resp  = m.received_by_name || m.responsible_person || '---';
            const prov  = m.supplier || m.document_number || '---';
            const rows = items.length
                ? items.map((it: any, idx: number) => `
                    <tr>
                        <td style="text-align:center">${idx + 1}</td>
                        <td style="font-family:monospace;font-weight:700">${it.code || it.codigo || '-'}</td>
                        <td style="font-family:monospace;font-size:9px">${it.part_number || it.pn || '-'}</td>
                        <td style="font-family:monospace;font-size:9px">${it.serial_number || it.sn || '-'}</td>
                        <td style="text-align:center;font-weight:700">${it.quantity || it.cantidad || 1}</td>
                        <td>${it.description || it.name || it.descripcion || '-'}</td>
                    </tr>`).join('')
                : `<tr><td colspan="6" style="text-align:center;color:#888">Sin detalle disponible</td></tr>`;
            const css = `<style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:0}h1{text-align:center;font-size:12px;font-weight:900;text-transform:uppercase;background:#111A43;color:white;padding:7px 10px;margin:0 0 7px;border:1px solid #000}.info-tbl{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:7px}.info-tbl td{border:1px solid #ddd;padding:3px 6px}.lbl{background:#f0f0f0;font-weight:700;font-size:9px;width:130px}.nro-cell{background:#f0f0f0;text-align:center;font-weight:900;font-size:15px;vertical-align:middle;width:120px}.sec{background:#111A43;color:white;padding:3px 8px;font-weight:900;font-size:10px;text-transform:uppercase;border:1px solid #000}table.det{width:100%;border-collapse:collapse;border:1px solid #000}table.det th{background:#111A43;color:white;padding:4px;font-size:8px;font-weight:900;text-transform:uppercase;border:1px solid #000;text-align:center}table.det td{padding:3px 4px;border:1px solid #ddd;font-size:9px}table.det tr:nth-child(even) td{background:#f9f9f9}.footer{text-align:center;margin-top:10px;font-size:7.5px;color:#888;border-top:1px dotted #ccc;padding-top:4px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ingreso ${nro}</title>${css}<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script></head><body>
<h1>NOTA DE INGRESO A ALMACÉN</h1>
<table class="info-tbl"><tr><td class="lbl">N° DOCUMENTO:</td><td><strong>${nro}</strong></td><td class="nro-cell" rowspan="2">N°<br>${nro}</td></tr><tr><td class="lbl">FECHA:</td><td>${fecha}</td></tr><tr><td class="lbl">RECIBIDO POR:</td><td>${resp}</td><td class="lbl">PROVEEDOR / REF:</td><td>${prov}</td></tr></table>
<div class="sec">DETALLE</div>
<table class="det"><thead><tr><th>#</th><th>CÓDIGO</th><th>P/N</th><th>S/N</th><th>CANT.</th><th>DESCRIPCIÓN</th></tr></thead><tbody>${rows}</tbody></table>
<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${new Date().toLocaleString('es-BO')}</div>
</body></html>`;
            const blob = new Blob([html], { type: 'text/html' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.target = '_blank'; a.rel = 'noopener';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        };

        if (m.id_movement) {
            this.movementSvc.getMovementItems(Number(m.id_movement)).pipe(
                takeUntil(this.destroy$),
                catchError(() => of([]))
            ).subscribe(items => generarPdfConItems(items));
        } else {
            generarPdfConItems([]);
        }
    }

    private _pdfHistorialCompraOficial(m: any): void {
        const nro          = m.movement_number || '---';
        const fecha        = m.date ? new Date(m.date).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
        const proveedor    = m.supplier || m.document_number || '';
        const factura      = m.invoice_number || '';
        const entregadoPor = m.received_by_name || '';
        const recibidoPor  = m.responsible_person || '';

        const build = (items: any[]) => {
            const pdfItems: IngresoPdfItem[] = items.map(it => ({
                codigo:           it.code || '',
                pn:               it.part_number || it.pn || '',
                proveedor,
                factura,
                descripcion:      it.description || it.name || it.descripcion || '',
                unidad:           it.unit_of_measure || 'UND',
                cantidad:         Number(it.quantity ?? it.cantidad ?? 1),
                fechaVencimiento: it.warranty_expiration
                    ? new Date(it.warranty_expiration).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '',
                origenAB: IngresoPdfService.origenAB(it.manufacture_origin),
                tipoAB:   IngresoPdfService.tipoAB(it.category_code),
                lote:     it.batch_number || ''
            }));
            this.ingresoPdfSvc.generarPdf({
                nroNota: nro, fechaIngreso: fecha, observaciones: m.notes || '',
                entregadoPor, recibidoPor, items: pdfItems
            });
        };

        if (m.id_movement) {
            this.movementSvc.getMovementItems(Number(m.id_movement)).pipe(
                takeUntil(this.destroy$),
                catchError(() => of([]))
            ).subscribe(items => build(items));
        } else {
            build([]);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  PDF — NUEVA HERRAMIENTA (INGRESO POR COMPRA) — formato oficial MGH-116
    // ══════════════════════════════════════════════════════════════════════════
    private _abrirImpresionIngreso(nro: string, items: HerramientaItem[], rec: any, provNombre: string): void {
        const pdfItems: IngresoPdfItem[] = items.map(h => ({
            codigo:           h.codigoBoa,
            pn:               h.pn || '',
            proveedor:        provNombre || '',
            factura:          rec.nroFactura || '',
            descripcion:      h.descripcion || '',
            unidad:           h.unidadMedida || 'UND',
            cantidad:         h.cantidad,
            fechaVencimiento: formatDateDMY(h.fechaVencimiento),
            origenAB: IngresoPdfService.origenAB(h.fabricacion),
            tipoAB:   IngresoPdfService.tipoAB(h.tipo),
            lote:     h.loteNumero || ''
        }));
        this.ingresoPdfSvc.generarPdf({
            nroNota:       nro,
            fechaIngreso:  formatDateDMY(rec.fechaIngreso),
            observaciones: (rec.tipoDe ? '[' + rec.tipoDe + '] ' : '') + (rec.observaciones || ''),
            entregadoPor:  rec.recibiConforme    || '',
            recibidoPor:   rec.funcionarioRecibe || '',
            items: pdfItems
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  PDF — AJUSTE INGRESO
    // ══════════════════════════════════════════════════════════════════════════
    private _abrirImpresionAjuste(nro: string, items: AjusteItem[], fv: any): void {
        const now = new Date().toLocaleString('es-BO');
        const rows = items.map((item, idx) => `
            <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td><span style="font-family:monospace;font-weight:700;background:#0f172a;color:white;padding:1px 5px;border-radius:3px;font-size:9px">${item.codigoBoa || '-'}</span></td>
                <td style="font-family:monospace;font-size:9px">${item.pn || '-'}</td>
                <td style="font-family:monospace;font-size:9px">${item.sn || '-'}</td>
                <td style="text-align:center;font-weight:700">${item.cantidad}</td>
                <td style="font-size:9px">${item.descripcion || '-'}</td>
                <td style="text-align:center"><span style="padding:2px 5px;border:1px solid #000;font-size:8px;font-weight:700">${item.estado || '-'}</span></td>
                <td style="font-size:8.5px">${item.ubicacion || '-'}</td>
                <td style="font-size:8.5px">${item.obs || ''}</td>
            </tr>`).join('');
        const tipoLabel = this.getTipoAjusteLabel(fv.tipoAjuste || 'INVENTARIO');
        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Ajuste Ingreso ${nro}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
  .code-box { border: 2px solid #000; padding: 3px 10px; font-weight: 900; font-size: 13px; display: inline-block; }
  h1 { text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase;
       background: #111A43; color: white; padding: 7px 10px; margin: 0 0 7px; border: 1px solid #000; }
  .info-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 7px; }
  .info-tbl td { border: 1px solid #ddd; padding: 3px 6px; }
  .lbl { background: #f0f0f0; font-weight: 700; font-size: 9px; width: 130px; }
  .nro-cell { background: #f0f0f0; text-align: center; font-weight: 900; font-size: 15px; vertical-align: middle; width: 120px; }
  .sec { background: #111A43; color: white; padding: 3px 8px; font-weight: 900; font-size: 10px;
         text-transform: uppercase; border: 1px solid #000; margin-bottom: 0; }
  table.det { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.det th { background: #111A43; color: white; padding: 4px 3px; font-size: 8px; font-weight: 900;
                 text-transform: uppercase; border: 1px solid #000; text-align: center; }
  table.det td { padding: 3px 4px; border: 1px solid #ddd; font-size: 9px; }
  table.det tr:nth-child(even) td { background: #f9f9f9; }
  .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
  .sig { border: 1px solid #000; padding: 6px 8px; text-align: center; }
  .sig-ttl { font-weight: 900; font-size: 9px; text-transform: uppercase; margin-bottom: 26px; }
  .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 8.5px; }
  .footer { text-align: center; margin-top: 10px; font-size: 7.5px; color: #888; border-top: 1px dotted #ccc; padding-top: 4px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
<script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); };</script>
</head><body>
  <div class="top">
    <div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145# N-114</div>
    <div style="text-align:right">
      <div class="code-box">API</div><br>
      <span style="font-size:9px">AJUSTE POR INGRESO</span>
    </div>
  </div>
  <h1>COMPROBANTE AJUSTE POR INGRESO<br>
    <span style="font-size:10px;font-weight:400">HERRAMIENTAS, BANCOS DE PRUEBA Y EQUIPOS DE APOYO</span>
  </h1>
  <table class="info-tbl">
    <tr>
      <td class="lbl">DOCUMENTO REF.:</td><td>${fv.documento || '—'}</td>
      <td class="lbl">TIPO AJUSTE:</td><td><strong>${tipoLabel}</strong></td>
      <td class="nro-cell" rowspan="3"><div style="font-size:8px;font-weight:400">N° AJUSTE</div>${nro}</td>
    </tr>
    <tr>
      <td class="lbl">ELABORÓ AJUSTE:</td><td>${fv.realizadoPorInput || fv.realizadoPor || '—'}</td>
      <td class="lbl">AUTORIZÓ:</td><td>${fv.aprobadoPorInput || fv.aprobadoPor || '—'}</td>
    </tr>
    <tr>
      <td class="lbl">FECHA:</td><td>${formatDateDMY(fv.fecha) || '—'}</td>
      <td class="lbl">OBSERVACIÓN:</td><td>${fv.descripcion || '—'}</td>
    </tr>
  </table>
  <div class="sec">DETALLE DE HERRAMIENTAS AJUSTADAS</div>
  <table class="det">
    <thead><tr>
      <th style="width:25px">ITEM</th><th>CÓDIGO BOA</th><th>P/N</th><th>S/N</th>
      <th style="width:35px">CANT.</th><th>DESCRIPCIÓN</th><th>ESTADO</th>
      <th>UBICACIÓN</th><th>OBS</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sigs">
    <div class="sig">
      <div class="sig-ttl">ELABORÓ AJUSTE</div>
      <div style="font-size:9px;margin-bottom:16px">${fv.realizadoPorInput || fv.realizadoPor || '____________________'}</div>
      <div class="sig-line">Firma / Cargo</div>
    </div>
    <div class="sig">
      <div class="sig-ttl">AUTORIZÓ</div>
      <div style="font-size:9px;margin-bottom:16px">${fv.aprobadoPorInput || fv.aprobadoPor || '____________________'}</div>
      <div class="sig-line">Firma / Cargo</div>
    </div>
    <div class="sig">
      <div class="sig-ttl">RECIBIÓ ALMACÉN</div>
      <div class="sig-line">Firma Almacén Herramientas</div>
    </div>
  </div>
  <div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div>
</body></html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  SHARED UTILITIES
    // ══════════════════════════════════════════════════════════════════════════
    private _localDateStr(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    private _showMsg(msg: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(msg, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
