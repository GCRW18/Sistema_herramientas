import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, of, forkJoin, lastValueFrom } from 'rxjs';
import { takeUntil, finalize, catchError, debounceTime, map, mergeMap } from 'rxjs/operators';
import { MovementService }    from '../../../../core/services/movement.service';
import { BlobStorageService } from '../../../../core/services/blob-storage.service';
import { ToolService }        from '../../../../core/services/tool.service';
import { GestionUbicacionesService } from '../../inventory/gestion-ubicaciones/gestion-ubicaciones.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { localDateStr, formatDateDMY } from '../../../../core/utils/date.utils';

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
    imagen?: string | null;      // preview (dataURL / URL) o ruta_bs ya guardada
    imagenFile?: File | null;    // archivo nuevo a subir al Blob Storage antes de enviar
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
    imagen?: string | null;       // valor crudo guardado (ruta_bs/base64) o dataURL de preview
    imagenFile?: File | null;     // archivo nuevo a subir al Blob Storage
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
    private blobStorage    = inject(BlobStorageService);
    private toolSvc        = inject(ToolService);
    private ubicSvc        = inject(GestionUbicacionesService);
    private destroy$       = new Subject<void>();

    // ── Estado de pestañas ──
    activeTab = signal<TabType>('nueva');
    setTab(tab: TabType): void {
        this.activeTab.set(tab);
        if (tab === 'historial' && this.historialItems.length === 0 && !this.isLoadingHistorial) {
            this.loadHistorial();
        }
    }

    /** pendingChangesGuard (vía MovimientosComponent): ¿hay una recepción o ajuste a medio cargar? */
    tieneCambiosPendientes(): boolean {
        return (this.dataSource?.length ?? 0) > 0
            || (this.dataSourceAjuste?.length ?? 0) > 0
            || !!this.recepcionForm?.dirty
            || !!this.ajusteForm?.dirty;
    }

    // ── Confirmación de borrado inline ──
    confirmingDeleteNueva:  number | null = null;
    confirmingDeleteAjuste: number | null = null;

    // ── Nueva Herramienta ──
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

    // ── Ajuste Ingreso ──
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

    // ── Ciclo de vida ──
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

    // ── Nueva Herramienta - Forms ──
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
            width: 'min(1060px, 96vw)', maxWidth: '96vw', maxHeight: '94vh',
            panelClass: 'no-padding-dialog', disableClose: true,
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

    private async _procesarResultadoHerramienta(result: { action: string; data: HerramientaItem } | undefined, editIndex?: number): Promise<void> {
        if (!result) return;
        const item = result.data;
        const existeIndex = this.dataSource.findIndex(i => i.codigoBoa.toUpperCase() === item.codigoBoa.toUpperCase());
        if (existeIndex >= 0 && editIndex !== existeIndex) {
            this._showMsg('Ya existe una herramienta con este código BOA', 'warning');
            return;
        }
        // Guarda contra la BD: el código no puede ser de una herramienta ya registrada
        // (he.ft_nueva_compra rechaza el lote); se valida al agregar el ítem para avisar antes.
        const yaRegistrado = await this._codigosRegistradosEnBD([item.codigoBoa]);
        if (yaRegistrado.length > 0) {
            this._showMsg(`El código ${yaRegistrado[0]} ya está registrado en otra herramienta del sistema`, 'warning');
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
        // Guarda de código duplicado ANTES del diálogo de confirmación, así el camino
        // confirmar→guardar→nota queda tan corto como en préstamos.
        this.isSaving = true;
        const codigosDuplicados = await this._codigosRegistradosEnBD(this.dataSource.map(h => h.codigoBoa));
        this.isSaving = false;
        if (codigosDuplicados.length > 0) {
            const uno = codigosDuplicados.length === 1;
            this._showMsg(
                `No se puede registrar: ${uno ? 'el código' : 'los códigos'} ${codigosDuplicados.join(', ')} ` +
                `${uno ? 'ya pertenece' : 'ya pertenecen'} a otra herramienta del sistema. Corrija el código antes de continuar.`,
                'error');
            return;
        }
        const { ConfirmarRecepcionComponent } = await import('./confirmar-recepcion/confirmar-recepcion.component');
        const ref = this.dialog.open(ConfirmarRecepcionComponent, {
            width: '580px', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true,
            data: { recepcion: { ...this.recepcionForm.value, fechaIngreso: formatDateDMY(this.recepcionForm.value.fechaIngreso) }, items: this.dataSource }
        });
        ref.afterClosed().subscribe((result: any) => {
            if (result?.action === 'revisar') this.abrirModalRecepcion();
            else if (result?.action === 'confirmar') this.finalizarIngreso(result.printWindow ?? null);
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

    /**
     * Sube al Blob Storage la foto nueva de cada ítem y devuelve, en orden, el valor de
     * `image_base64` para el items_json (ruta_bs nueva · ruta_bs reenviada · '' sin foto).
     */
    private async _subirFotosItems<T extends { imagen?: string | null; imagenFile?: File | null }>(
        items: T[], seedFn: (it: T) => string | number,
    ): Promise<string[]> {
        // Las subidas van en paralelo — en serie, un lote con varias fotos dejaba
        // la pestaña del PDF esperando un request tras otro.
        return Promise.all(items.map(it => {
            if (it.imagenFile) {
                return lastValueFrom(this.blobStorage.upload(it.imagenFile, 'Imagenes', seedFn(it)));
            }
            if (it.imagen && this.blobStorage.isRutaBs(it.imagen)) {
                return Promise.resolve(it.imagen);
            }
            return Promise.resolve('');
        }));
    }

    /**
     * De los códigos dados, devuelve los que ya existen en una herramienta activa de la BD.
     * Ante fallo de red devuelve [] (no bloquea; el backend es la guarda real).
     */
    private async _codigosRegistradosEnBD(codes: string[]): Promise<string[]> {
        const unicos = [...new Set(
            codes.map(c => (c || '').trim().toUpperCase()).filter(c => c.length >= 2)
        )];
        if (unicos.length === 0) return [];
        try {
            const listas = await lastValueFrom(forkJoin(
                unicos.map(code => this.toolSvc.getTools({ query: code }).pipe(catchError(() => of([] as any[]))))
            ));
            return unicos.filter((code, i) =>
                (listas[i] || []).some((t: any) => (t?.code || '').trim().toUpperCase() === code));
        } catch {
            return [];
        }
    }

    // ── Nueva: finalize ───────────────────────────────────────────────────────
    async finalizarIngreso(printWin: Window | null = null): Promise<void> {
        this.isSaving = true;
        const rec = this.recepcionForm.value;
        const prov = rec.proveedor;
        const provNombre = typeof prov === 'object' ? prov?.nombre : prov || '';
        const itemsSnapshot = [...this.dataSource];

        // La guarda de código duplicado ya corrió en abrirModalConfirmacionNueva(); el backend
        // la revalida transaccionalmente, así que aquí no se repite.

        // Sube las fotos al Blob Storage ANTES de armar el items_json.
        // La herramienta aún no existe → se usa el código BOA como semilla del nombre.
        let fotos: string[];
        try {
            fotos = await this._subirFotosItems(itemsSnapshot, h => (h.codigoBoa || '').toUpperCase());
        } catch (e: any) {
            this.isSaving = false;
            try { printWin?.close(); } catch { /* noop */ }
            this._showMsg('No se pudo subir una foto: ' + (e?.message || 'error') + '. Intente de nuevo.', 'error');
            return;
        }

        const itemsJson = JSON.stringify(itemsSnapshot.map((h, i) => ({
            code: h.codigoBoa, name: h.descripcion, description: h.descripcion,
            tool_type: h.tipo || 'HERRAMIENTA',
            brand: h.marca || '', part_number: h.pn || '', serial_number: h.sn || '',
            quantity: h.cantidad,
            shelf: h.estante || '', shelf_level: h.nivelUbicacion || '', accessories: h.accesorios || '',
            warehouse_id: h.warehouseId || null, rack_id: h.rackId || null, level_id: h.levelId || null,
            image_path: fotos[i] || '',
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
                    // Nota de Ingreso MGH-116 (PDF real TCPDF backend).
                    if (resp?.id_movement) this.movementSvc.verNotaIngreso(Number(resp.id_movement), printWin);
                    else { try { printWin?.close(); } catch { /* noop */ } }
                    // Reset in-place — no navigate
                    this.dataSource = [];
                    this.recepcionForm.reset({
                        tipoDe: 'COMPRA',
                        fechaIngreso: this._localDateStr()
                    });
                    this.loadHistorial();
                },
                error: (err: any) => {
                    try { printWin?.close(); } catch { /* noop */ }
                    const msg = err?.message || 'Error al registrar';
                    const esCodigoDuplicado = /ya esta registrad[oa]/i.test(msg);
                    this._showMsg(msg, esCodigoDuplicado ? 'warning' : 'error');
                }
            });
    }

    // ── Nueva: auxiliares ─────────────────────────────────────────────────────
    isRecepcionValida(): boolean { return this.recepcionForm.valid; }

    validateRecepcion(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        this.recepcionForm.markAllAsTouched();
        if (this.recepcionForm.get('nroCmr')?.invalid)         errors.push('Falta Nro Documento/CMR');
        if (this.recepcionForm.get('fechaIngreso')?.invalid)   errors.push('Falta Fecha de Recepción');
        if (!this.recepcionForm.get('funcionarioRecibe')?.value) errors.push('Falta Funcionario que Recibe');
        return { valid: errors.length === 0, errors };
    }


    // ── Categorías dinámicas ──────────────────────────────────────────────────
    async abrirCategorias(): Promise<void> {
        const { CategoriaIngresosDialogComponent } = await import('./categoria-ingresos-dialog/categoria-ingresos-dialog.component');
        this.dialog.open(CategoriaIngresosDialogComponent, {
            panelClass: 'no-padding-dialog', disableClose: false
        });
    }

    // ── Ajuste Ingreso - Forms ──
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
            width: 'min(940px, 96vw)', maxWidth: '96vw', height: 'min(600px, 92vh)',
            panelClass: 'no-padding-dialog', disableClose: true,
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
            else if (result?.action === 'confirmar') this.finalizarAjuste(result.printWindow ?? null);
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
                // `imagen` = valor crudo ya guardado (para reenviarlo si no hay foto nueva);
                // `imagenFile` = foto nueva a subir al Blob Storage.
                imagen:          result.data.imagenMaster || null,
                imagenFile:      result.data.imagenNuevaFile || null,
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

    /**
     * De los ítems de ajuste, devuelve los que he.ft_ajuste_ingreso rechazaría por estado
     * (in_use / in_calibration). Guarda previa a subir fotos; ante fallo de red devuelve [].
     */
    private async _itemsAjusteNoValidos(items: AjusteItem[]): Promise<{ codigo: string; motivo: string }[]> {
        const conCodigo = items.filter(i => (i.codigoBoa || '').trim().length >= 2);
        if (conCodigo.length === 0) return [];
        try {
            const listas = await lastValueFrom(forkJoin(
                conCodigo.map(i => this.toolSvc.getTools({ query: i.codigoBoa.trim() }).pipe(catchError(() => of([] as any[]))))
            ));
            const out: { codigo: string; motivo: string }[] = [];
            conCodigo.forEach((i, idx) => {
                const code = i.codigoBoa.trim().toUpperCase();
                const tool = (listas[idx] || []).find((t: any) => (t?.code || '').trim().toUpperCase() === code);
                if (!tool) return;
                const st = String(tool.status || '').toLowerCase();
                if (st === 'in_use')         out.push({ codigo: i.codigoBoa, motivo: 'en préstamo (in_use)' });
                else if (st === 'in_calibration') out.push({ codigo: i.codigoBoa, motivo: 'en calibración (in_calibration)' });
            });
            return out;
        } catch {
            return [];
        }
    }

    // ── Ajuste: finalize ──────────────────────────────────────────────────────
    async finalizarAjuste(printWin: Window | null = null): Promise<void> {
        const fv = this.ajusteForm.value;
        const abortar = (msg: string) => { try { printWin?.close(); } catch { /* noop */ } this._showMsg(msg, 'error'); };
        if (!fv.aprobadoPor) { abortar('Debe seleccionar un aprobador'); return; }
        if (this.dataSourceAjuste.length === 0) { abortar('No hay items'); return; }
        const sinId = this.dataSourceAjuste.filter(i => !i.toolId || isNaN(i.toolId));
        if (sinId.length > 0) {
            abortar(`${sinId.length} herramienta(s) sin ID de sistema`);
            return;
        }
        this.isSavingAjuste = true;

        const itemsAjuste = [...this.dataSourceAjuste];

        // Guarda previa (como finalizarIngreso): si el backend va a rechazar algún ítem,
        // abortamos ANTES de subir fotos al Blob Storage para no dejarlas huérfanas.
        const noValidos = await this._itemsAjusteNoValidos(itemsAjuste);
        if (noValidos.length > 0) {
            this.isSavingAjuste = false;
            try { printWin?.close(); } catch { /* noop */ }
            this._showMsg(
                'No se puede registrar el ajuste: ' +
                noValidos.map(n => `${n.codigo} (${n.motivo})`).join(', ') +
                '. Use Devolución de Préstamo o Retorno de Calibración.',
                'error');
            return;
        }

        let fotos: string[];
        try {
            fotos = await this._subirFotosItems(itemsAjuste, i => Number(i.toolId));
        } catch (e: any) {
            this.isSavingAjuste = false;
            try { printWin?.close(); } catch { /* noop */ }
            this._showMsg('No se pudo subir una foto: ' + (e?.message || 'error') + '. Intente de nuevo.', 'error');
            return;
        }

        const itemsJson = JSON.stringify(itemsAjuste.map((i, idx) => ({
            tool_id:  Number(i.toolId),
            quantity: i.cantidad,
            condicion: i.estado || 'SERVICEABLE',
            notes:    [
                i.tipoAjuste  ? '[' + i.tipoAjuste + ']'   : '',
                i.obs || ''
            ].filter(Boolean).join(' | '),
            image_path: fotos[idx] || '',
            // Datos maestros editados en el form de detalle: el backend los aplica a
            // he.ttools con COALESCE(NULLIF(...)) → vacío = "no tocar", no borra.
            code:               i.codigoBoa       || '',
            name:               i.descripcion     || '',
            brand:              i.marca           || '',
            part_number:        i.pn              || '',
            serial_number:      i.sn              || '',
            tool_type:          i.tipo            || '',
            unit_of_measure:    i.um              || '',
            criticality_level:  i.nivelCriticidad || '',
            manufacture_origin: i.fabricacion     || '',
            tool_notes:         i.obs             || ''
        })));
        const tipoLabel = fv.tipoAjuste || 'INVENTARIO';
        // registrarAjusteIngreso no toca ubicación (solo cantidad/condición/notas); la ubicación
        // del picker se aplica aparte con moveLevelTool (HE_LTL_MOV).
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
                const nro   = result?.movement_number || '---';
                const idMov = Number(result?.id_movement);
                // Comprobante de Ajuste por Ingreso — PDF real TCPDF backend.
                if (idMov) this.movementSvc.verNotaAjuste(idMov, printWin);
                else { try { printWin?.close(); } catch { /* noop */ } }
                this._showMsg(`Ajuste registrado exitosamente: ${nro}`, 'success');
                this.dataSourceAjuste = [];
                this.ajusteForm.reset({ tipoAjuste: 'INVENTARIO', fecha: localDateStr() });
                this.loadHistorial();
            },
            error: (err: any) => { try { printWin?.close(); } catch { /* noop */ } this._showMsg('Error al registrar el ajuste: ' + (err?.message || ''), 'error'); }
        });
    }

    // ── Ajuste: auxiliares ─────────────────────────────────────────────────────
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

    // ── Historial ──
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

    /** Reimpresión desde el historial: COMPRA → Nota de Ingreso MGH-116; AJUSTE INGRESO →
     *  Comprobante de Ajuste. PDF real TCPDF; ventana reservada dentro del click + un solo POST. */
    pdfHistorialItem(m: any): void {
        const ventana = this.movementSvc.preAbrirVentanaPdf();
        if (!m?.id_movement) {
            try { ventana?.close(); } catch { /* noop */ }
            this._showMsg('No se pudo identificar el registro', 'error');
            return;
        }
        if (this.isAjusteIngreso(m)) this.movementSvc.verNotaAjuste(Number(m.id_movement), ventana);
        else                        this.movementSvc.verNotaIngreso(Number(m.id_movement), ventana);
    }

    // ── Auxiliares comunes ──
    private _localDateStr(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    private _showMsg(msg: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(msg, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
