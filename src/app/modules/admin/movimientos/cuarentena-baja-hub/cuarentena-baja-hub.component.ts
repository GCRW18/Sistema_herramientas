import { Component, OnInit, OnDestroy, signal, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, forkJoin, of, lastValueFrom } from 'rxjs';
import { takeUntil, finalize, catchError, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { MovementService } from '../../../../core/services/movement.service';
import { QuarantineService } from '../../../../core/services/quarantine.service';
import { BlobStorageService } from '../../../../core/services/blob-storage.service';
import { GestionUbicacionesService } from '../../inventory/gestion-ubicaciones/gestion-ubicaciones.service';
import { ToolService } from '../../../../core/services/tool.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { formatDateDMY } from '../../../../core/utils/date.utils';

interface BajaItem {
    id: string;
    toolId: number;
    codigo: string;
    pn: string;
    sn: string;
    nombre: string;
    cantidad: number;
    contenido: string;
    base: string;
    marca: string;
    estadoFisico: string;
    observacion: string;
    imagen: string | null;
    imagenFile?: File | null;
    warehouseId: number | null;
    rackId: number | null;
    levelId: number | null;
    notesTool: string;
}

type TabType = 'cuarentena' | 'baja' | 'historial';

@Component({
    selector: 'app-cuarentena-baja-hub',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule, MatSnackBarModule,
        MatProgressSpinnerModule, MatTooltipModule, DragDropModule,
        HasPermissionDirective
    ],
    templateUrl: './cuarentena-baja-hub.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar-cb::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-cb::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-cb::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
        [hidden] { display: none !important; }
        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.85); display: flex; align-items: center;
            justify-content: center; z-index: 9999;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(15,23,42,0.85); }
        @keyframes pulse-border { 0%,100% { border-color:#ef4444; } 50% { border-color:#f87171; } }
        .animate-pulse-border { animation: pulse-border 2s cubic-bezier(.4,0,.6,1) infinite; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
        ::ng-deep .ubic-backdrop { background: rgba(0,0,0,0.25) !important; }
    `]
})
export class CuarentenaBajaHubComponent implements OnInit, OnDestroy {

    @ViewChild('reporteModal')      reporteModal!:      TemplateRef<any>;
    @ViewChild('herramientaCModal') herramientaCModal!: TemplateRef<any>;
    @ViewChild('datosBajaModal')    datosBajaModal!:    TemplateRef<any>;
    @ViewChild('resolverModal')     resolverModal!:     TemplateRef<any>;
    @ViewChild('anularBajaModal')   anularBajaModal!:   TemplateRef<any>;

    public  dialogRefComponent = inject(MatDialogRef<CuarentenaBajaHubComponent>, { optional: true });
    private dialogRefActual: MatDialogRef<any> | null = null;
    private dialog        = inject(MatDialog);
    private fb            = inject(FormBuilder);
    private snackBar      = inject(MatSnackBar);
    private movementSvc   = inject(MovementService);
    private quarantineSvc = inject(QuarantineService);
    private blobStorage   = inject(BlobStorageService);
    private ubicSvc       = inject(GestionUbicacionesService);
    private toolSvc       = inject(ToolService);
    private destroy$      = new Subject<void>();

    /** Sube a Blob Storage las fotos nuevas de los ítems y las adjunta a cada herramienta.
     *  Best-effort: un fallo de foto no revierte la cuarentena/baja ya registrada. */
    private async _persistirFotos(items: { toolId: number; file: File | null | undefined }[]): Promise<void> {
        for (const it of items) {
            if (!it.file || !it.toolId) continue;
            try {
                const ruta = await lastValueFrom(this.blobStorage.upload(it.file, 'Imagenes', it.toolId));
                await lastValueFrom(this.ubicSvc.attachToolPhoto(it.toolId, ruta));
            } catch (e) {
                console.warn('No se pudo guardar la foto de la herramienta', it.toolId, e);
            }
        }
    }

    // ── Tab ────────────────────────────────────────────────────────────────────
    activeTab = signal<TabType>('cuarentena');
    setTab(tab: TabType): void {
        this.activeTab.set(tab);
        if (tab === 'historial' && this.historialItems.length === 0) this.loadHistorial();
    }

    /** pendingChangesGuard (vía MovimientosComponent): ¿hay una cuarentena o baja a medio cargar? */
    tieneCambiosPendientes(): boolean {
        return (this.cuarentenaList?.length ?? 0) > 0
            || this.bajaItems().length > 0
            || !!this.toolCuarentenaForm?.dirty
            || !!this.bajaForm?.dirty
            || !!this.reporteForm?.dirty;
    }

    // ── Cuarentena ──
    estadosFisicos = [
        { value: 'BUENO',      label: 'BUENO'      },
        { value: 'REGULAR',    label: 'REGULAR'     },
        { value: 'MALO',       label: 'MALO'        },
        { value: 'INSERVIBLE', label: 'INSERVIBLE'  }
    ];

    motivosCuarentena = [
        { value: 'quality_issue',       label: 'CALIDAD'       },
        { value: 'calibration_failed',  label: 'FALLA CALIB.'  },
        { value: 'damage_suspected',    label: 'DAÑO SOSP.'    },
        { value: 'investigation',       label: 'INVESTIGACIÓN' },
        { value: 'contamination',       label: 'CONTAMINA.'    },
        { value: 'expired_calibration', label: 'CAL. VENC.'    },
        { value: 'operational_failure', label: 'FALLA OPER.'   },
        { value: 'physical_damage',     label: 'DAÑO FÍSICO'   },
        { value: 'other',               label: 'OTRO'          }
    ];

    warehouses:          any[]  = [];
    toolsFiltradas:      any[]  = [];
    showToolDropdown            = false;
    buscarValueC                = '';
    toolCSearchLoading          = false;
    private _toolCSearch$       = new Subject<string>();
    private toolIdActual        = 0;
    // Ubicación real de la herramienta (almacén/estante/nivel según Consultar Inventario), distinta
    // de "Base" (a dónde se manda administrativamente). searchToolsAutocomplete ya trae estos ids.
    private toolWarehouseIdActual: number | null = null;
    private toolRackIdActual:      number | null = null;
    private toolLevelIdActual:     number | null = null;
    // Marca/Observaciones reales de la herramienta (ttools.brand/notes) para el detalle solo-lectura,
    // distinto del campo "Observaciones" del form de cuarentena.
    private toolMarcaActual:  string = '';
    private toolNotesActual:  string = '';

    private _personaSearch$ = new Subject<string>();
    personasFiltradas:   any[]  = [];
    showPersonaDropdown         = false;
    personaLoading              = false;

    // Aprobado Por / Jefe de Almacén — mismo dato que en Ajuste/Baja; en Cuarentena faltaba aunque
    // el PDF ya tiene el casillero de firma esperándolo.
    private _aprobadoPorCSearch$ = new Subject<string>();
    aprobadoPorCFuncionarios: any[]  = [];
    showAprobadoPorCDropdown        = false;
    aprobadoPorCLoading             = false;

    reporteForm!:        FormGroup;
    toolCuarentenaForm!: FormGroup;
    cuarentenaList:      any[]  = [];
    selectedToolImage    = signal<string | null>(null);
    isSavingCuarentena   = false;

    // ── Baja ──
    estados = [
        { value: 'requested', label: 'SOLICITADO', color: 'yellow', icon: 'pending'      },
        { value: 'approved',  label: 'APROBADO',   color: 'green',  icon: 'check_circle' },
        { value: 'rejected',  label: 'RECHAZADO',  color: 'red',    icon: 'cancel'       },
        { value: 'executed',  label: 'EJECUTADO',  color: 'blue',   icon: 'engineering'  },
        { value: 'cancelled', label: 'CANCELADO',  color: 'gray',   icon: 'block'        }
    ];

    motivosBaja = [
        { value: 'beyond_repair',          label: 'IRREPARABLE'           },
        { value: 'end_of_life',            label: 'FIN DE VIDA ÚTIL'      },
        { value: 'obsolete',               label: 'OBSOLETO'              },
        { value: 'deterioration',          label: 'DETERIORO'             },
        { value: 'calibration_rejected',   label: 'CALIBRACIÓN RECHAZADA' },
        { value: 'lost',                   label: 'PERDIDO'               },
        { value: 'stolen',                 label: 'ROBADO'                },
        { value: 'other',                  label: 'OTRO'                  }
    ];

    metodosDisposicion = [
        { value: 'destruction', label: 'DESTRUCCIÓN' },
        { value: 'recycling',   label: 'RECICLAJE'   },
        { value: 'donation',    label: 'DONACIÓN'    },
        { value: 'sale',        label: 'VENTA'       },
        { value: 'other',       label: 'OTRO'        }
    ];

    bajaForm!: FormGroup;
    bajaItems  = signal<BajaItem[]>([]);
    nroNota    = signal('---');
    isSavingBaja = false;

    private _procesadoPorSearch$ = new Subject<string>();
    procesadoPorFuncionarios: any[] = [];
    procesadoPorLoading              = false;
    showProcesadoPorDropdown         = false;

    private _verificadoPorSearch$ = new Subject<string>();
    verificadoPorFuncionarios: any[] = [];
    verificadoPorLoading              = false;
    showVerificadoPorDropdown         = false;

    private _autorizadoPorSearch$ = new Subject<string>();
    autorizadoPorFuncionarios: any[] = [];
    autorizadoPorLoading              = false;
    showAutorizadoPorDropdown         = false;

    // ── Historial ──
    historialItems:     any[] = [];
    filteredHistorial:  any[] = [];
    isLoadingHistorial        = false;
    historialTotal            = 0;
    historialSearch           = new FormControl('');

    // ── Resolver cuarentena ────────────────────────────────────────────────
    // he.tquarantines.resolution es varchar(30) con CHECK a estos 5 valores; el diagnóstico
    // en prosa del usuario va a la columna "diagnosis" (text), no a "resolution".
    resolucionesCuarentena = [
        { value: 'released',         label: 'LIBERADA — VUELVE A SERVICIO' },
        { value: 'repaired',         label: 'REPARADA' },
        { value: 'sent_calibration', label: 'ENVIADA A CALIBRACIÓN' },
        { value: 'decommissioned',   label: 'DADA DE BAJA' },
        { value: 'pending',          label: 'PENDIENTE' }
    ];
    resolverForm!:                 FormGroup;
    quarantenaSeleccionada:        any    = null;
    isResolviendo                        = false;
    private _resolverPersonaSearch$      = new Subject<string>();
    resolverPersonaFiltrados:      any[] = [];
    resolverPersonaLoading               = false;
    showResolverPersonaDropdown          = false;

    // ── Anular baja ────────────────────────────────────────────────────────
    anularBajaForm!:               FormGroup;
    bajaSeleccionada:              any    = null;
    isAnulando                           = false;

    // ── Ciclo de vida ──
    ngOnInit(): void {
        this._initFormsCuarentena();
        this._initFormBaja();
        this._initResolverForm();
        this._initAnularBajaForm();
        this._setupPersonaSearch();
        this._setupFuncionarioSearch(
            this._aprobadoPorCSearch$,
            list => this.aprobadoPorCFuncionarios = list,
            v    => this.aprobadoPorCLoading      = v,
            v    => this.showAprobadoPorCDropdown  = v
        );
        this._setupFuncionarioSearch(
            this._procesadoPorSearch$,
            list => this.procesadoPorFuncionarios = list,
            v    => this.procesadoPorLoading      = v,
            v    => this.showProcesadoPorDropdown  = v
        );
        this._setupFuncionarioSearch(
            this._verificadoPorSearch$,
            list => this.verificadoPorFuncionarios = list,
            v    => this.verificadoPorLoading      = v,
            v    => this.showVerificadoPorDropdown  = v
        );
        this._setupFuncionarioSearch(
            this._autorizadoPorSearch$,
            list => this.autorizadoPorFuncionarios = list,
            v    => this.autorizadoPorLoading      = v,
            v    => this.showAutorizadoPorDropdown  = v
        );
        this._setupFuncionarioSearch(
            this._resolverPersonaSearch$,
            list => this.resolverPersonaFiltrados       = list,
            v    => this.resolverPersonaLoading         = v,
            v    => this.showResolverPersonaDropdown    = v
        );
        this._cargarWarehouses();
        this._setupToolCSearch();
        this.historialSearch.valueChanges.pipe(
            debounceTime(200), takeUntil(this.destroy$)
        ).subscribe(() => this._filterHistorial());
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // ── Cuarentena - Lógica ──
    private _today(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    private _initFormsCuarentena(): void {
        const today = this._today();
        const auth  = JSON.parse(localStorage.getItem('aut') || '{}');
        this.reporteForm = this.fb.group({
            // El N° de Reporte (RDC) lo genera el backend al finalizar (correlativo 'RDC');
            // no es editable ni requerido aquí.
            nroReporteDiscrepancia: [''],
            fecha:          [today, Validators.required],
            motivo:         ['',    Validators.required],
            descripcion:    ['',    Validators.required],
            // "Funcionario" (quien reporta) y "Realizado Por" prellenados con el usuario logueado (editables).
            nombreApellido: [auth?.nombre_usuario || ''],
            realizadoPor:   [auth?.nombre_usuario || ''],
            aprobadoPor:    ['']
        });
        this.toolCuarentenaForm = this.fb.group({
            id_tool:          [0],
            codigo:           ['', Validators.required],
            nombre:           [''],
            partNumber:       [''],
            serialNumber:     [''],
            base:             ['ALM-CBB-0001', Validators.required],
            fechaInicio:      [today, Validators.required],
            fechaVencimiento: [''],
            existencia:       [0],
            cantidad:         [1, [Validators.required, Validators.min(1)]],
            estadoFisico:     ['BUENO', Validators.required],
            motivoItem:       ['', Validators.required],
            observaciones:    ['']
        });
    }

    private _cargarWarehouses(): void {
        this.movementSvc.getWarehouses().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (w: any[]) => { this.warehouses = w; } });
    }

    abrirModalReporte(): void {
        this.dialogRefActual = this.dialog.open(this.reporteModal, {
            width: '620px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog', disableClose: true
        });
    }

    guardarYcerrarReporte(): void {
        if (this.reporteForm.invalid) { this.reporteForm.markAllAsTouched(); return; }
        this.dialogRefActual?.close();
        this._showMsg('Datos de reporte guardados.', 'success');
    }

    abrirModalHerramientaCuarentena(): void {
        const today = this._today();
        this.toolCuarentenaForm.reset({ existencia: 0, cantidad: 1, estadoFisico: 'BUENO', base: 'ALM-CBB-0001', fechaInicio: today, motivoItem: '', observaciones: '' });
        this.selectedToolImage.set(null); this.selectedToolImageFile = null;
        this.showToolDropdown = false;
        this.buscarValueC     = '';
        this.toolsFiltradas   = [];
        this.toolCSearchLoading = false;
        this.dialogRefActual = this.dialog.open(this.herramientaCModal, {
            width: '800px', maxWidth: '96vw', height: '560px',
            panelClass: 'no-padding-dialog', disableClose: true, autoFocus: false
        });
    }

    isReporteValido(): boolean { return this.reporteForm.valid; }

    // Búsqueda en vivo contra el backend (ToolService.getTools → searchToolsAutocomplete), igual
    // que el buscador de detalle-herramienta.component.ts.
    private _setupToolCSearch(): void {
        this._toolCSearch$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                const q = term.trim();
                if (q.length < 2) { this.showToolDropdown = false; return of([]); }
                this.toolCSearchLoading = true;
                return this.toolSvc.getTools({ query: q }).pipe(
                    catchError(() => of([])),
                    finalize(() => this.toolCSearchLoading = false)
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe((tools: any[]) => {
            this.toolsFiltradas   = (tools || []).slice(0, 8);
            this.showToolDropdown = this.toolsFiltradas.length > 0;
        });
    }

    onBuscarToolCInput(value: string): void {
        this.buscarValueC = value;
        this._toolCSearch$.next(value);
    }

    hideToolCDD(): void { setTimeout(() => { this.showToolDropdown = false; }, 180); }

    limpiarBuscarToolC(): void {
        this.buscarValueC     = '';
        this.toolsFiltradas   = [];
        this.showToolDropdown = false;
        this.toolCuarentenaForm.patchValue({ id_tool: 0, codigo: '', nombre: '', partNumber: '', serialNumber: '', existencia: 0 });
        this.selectedToolImage.set(null); this.selectedToolImageFile = null;
        this.toolWarehouseIdActual = null;
        this.toolRackIdActual      = null;
        this.toolLevelIdActual     = null;
        this.toolMarcaActual       = '';
        this.toolNotesActual       = '';
    }

    /** Motivo por el que una herramienta no puede entrar a cuarentena / baja
     *  (refleja las guardas de he.ft_quarantines_ime / he.ft_decommissions_ime). */
    private _motivoNoDisponible(status: string): string | null {
        switch (String(status || '').toLowerCase()) {
            case 'decommissioned':
            case 'baja':           return 'ya está dada de baja';
            case 'quarantine':
            case 'cuarentena':     return 'ya está en cuarentena';
            case 'lost':           return 'está registrada como perdida';
            case 'in_use':
            case 'loaned':         return 'está prestada — registre primero su devolución';
            case 'in_calibration':
            case 'calibracion':    return 'está en calibración — registre primero su retorno';
            case 'in_maintenance': return 'está en mantenimiento — registre primero su retorno';
            default:               return null;
        }
    }

    selectTool(tool: any): void {
        const motivo = this._motivoNoDisponible(tool.status ?? tool.tool_status);
        if (motivo) {
            this._showMsg(`${tool.code || 'La herramienta'} ${motivo}.`, 'warning');
            this.showToolDropdown = false;
            return;
        }
        this.toolIdActual = tool.id_tool ?? tool.id ?? 0;
        this.buscarValueC = `${tool.code ?? ''} · ${tool.name ?? ''}`;
        this.toolCuarentenaForm.patchValue({
            id_tool:      this.toolIdActual,
            codigo:       tool.code              ?? '',
            nombre:       tool.name              ?? '',
            partNumber:   tool.part_number       ?? '',
            serialNumber: tool.serial_number     ?? '',
            existencia:   tool.quantity_in_stock ?? 0,
            cantidad:     1,
            estadoFisico: 'BUENO'
        });
        // Si la herramienta ya tiene una foto registrada (location_photo, vía
        // searchToolsAutocomplete), se precarga — el usuario igual puede reemplazarla.
        this.selectedToolImage.set(this.blobStorage.resolveImageSrc(tool.location_photo) || null);
        // Ubicación real de la herramienta (almacén/estante/nivel), para mostrarla completa
        // en el detalle de solo-lectura — searchToolsAutocomplete ya la trae.
        this.toolWarehouseIdActual = tool.warehouse_id != null ? Number(tool.warehouse_id) : null;
        this.toolRackIdActual      = tool.rack_id      != null ? Number(tool.rack_id)      : null;
        this.toolLevelIdActual     = tool.level_id     != null ? Number(tool.level_id)     : null;
        // Marca/Observaciones reales de la herramienta (catálogo) para el detalle solo-lectura,
        // distinto del motivo/notas de ESTA cuarentena.
        this.toolMarcaActual = tool.brand ?? tool.marca ?? '';
        this.toolNotesActual = tool.notes ?? '';
        this.showToolDropdown = false;
    }

    selectedToolImageFile: File | null = null;

    onToolImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) { this._showMsg('La imagen no debe superar 8MB', 'error'); return; }
        this.selectedToolImageFile = file;
        const reader = new FileReader();
        reader.onload = () => this.selectedToolImage.set(reader.result as string); // solo preview
        reader.readAsDataURL(file);
    }

    addToolToList(): void {
        const fv = this.toolCuarentenaForm.value;
        if (this.toolCuarentenaForm.invalid || !fv.codigo || !this.selectedToolImage()) {
            this.toolCuarentenaForm.markAllAsTouched();
            this._showMsg('Complete los datos obligatorios y asigne una foto referencial.', 'warning');
            return;
        }
        if (this.cuarentenaList.find(t => t.id_tool === fv.id_tool && fv.id_tool !== 0)) {
            this._showMsg('Esta herramienta ya está en la lista.', 'warning');
            return;
        }
        if (fv.existencia > 0 && fv.cantidad > fv.existencia) {
            this._showMsg(`Solo hay ${fv.existencia} unidades en stock.`, 'error');
            return;
        }
        // Ubicación completa (almacén/estante/nivel) de la herramienta seleccionada — la real
        // según Consultar Inventario, no solo "Base" (a dónde se manda administrativamente).
        this.cuarentenaList = [...this.cuarentenaList, {
            ...fv, foto: this.selectedToolImage(), fotoFile: this.selectedToolImageFile,
            warehouseId: this.toolWarehouseIdActual,
            rackId:      this.toolRackIdActual,
            levelId:     this.toolLevelIdActual,
            marcaTool:   this.toolMarcaActual,
            notesTool:   this.toolNotesActual
        }];
        this.dialogRefActual?.close();
        this._showMsg('Herramienta preparada para cuarentena.', 'success');
    }

    removerDeLista(index: number): void {
        this.cuarentenaList.splice(index, 1);
        this.cuarentenaList = [...this.cuarentenaList];
    }

    // Clic en un ítem ya agregado a la lista → abre el mismo form de detalle de herramienta
    // usado en ingresos-hub (Ajuste de Herramienta) y en préstamo técnico, en modo solo-vista.
    async abrirDetalleHerramientaCuarentena(item: any): Promise<void> {
        const { DetalleHerramientaComponent } = await import('../ingresos-hub/detalle-herramienta/detalle-herramienta.component');
        const editItem = {
            toolId: item.id_tool, codigoBoa: item.codigo, pn: item.partNumber, sn: item.serialNumber,
            descripcion: item.nombre, cantidad: item.cantidad,
            marca: item.marcaTool, obs: item.notesTool,
            imagenMaster: item.foto, warehouseId: item.warehouseId,
            rackId: item.rackId, levelId: item.levelId
        };
        this.dialog.open(DetalleHerramientaComponent, {
            width: '800px', maxWidth: '96vw', height: '560px',
            panelClass: 'no-padding-dialog', hasBackdrop: true, disableClose: false, autoFocus: false,
            data: { editItem, viewOnly: true }
        });
    }

    getEstadoFisicoLabel(val: string): string {
        return this.estadosFisicos.find(e => e.value === val)?.label || val;
    }

    getEstadoFisicoColor(val: string): string {
        const colors: Record<string, string> = {
            BUENO:      'bg-green-100 text-green-800 border-green-400',
            REGULAR:    'bg-amber-100 text-amber-800 border-amber-400',
            MALO:       'bg-orange-100 text-orange-800 border-orange-400',
            INSERVIBLE: 'bg-red-100 text-red-800 border-red-400'
        };
        return colors[val] || 'bg-stone-100 text-stone-600 border-stone-300';
    }

    submitQuarantine(): void {
        if (!this.isReporteValido() || this.cuarentenaList.length === 0) return;
        this.isSavingCuarentena = true;
        // Pestaña reservada dentro del gesto (click) para el reporte MGH-101.
        const notaWin = this.movementSvc.preAbrirVentanaPdf();
        const rep = this.reporteForm.getRawValue();
        const requests = this.cuarentenaList.map(tool => {
            const notesExtra = `${rep.descripcion ? 'Descripción: ' + rep.descripcion + '. ' : ''}` +
                               `${tool.motivoItem ? 'Motivo ítem: ' + tool.motivoItem + '. ' : ''}` +
                               `Cant: ${tool.cantidad}. Base: ${tool.base || '-'}.` +
                               (tool.observaciones ? ` Obs: ${tool.observaciones}.` : '') +
                               (tool.fechaVencimiento ? ` Vence: ${tool.fechaVencimiento}.` : '');
            const payload: any = {
                // record_number / report_number: los genera el backend (correlativo 'RDC' en
                // he.tcorrelativos) — no se envían desde aquí, ver he.ft_quarantines_ime.
                tool_id:            tool.id_tool,
                start_date:         rep.fecha,
                reported_by_name:   rep.nombreApellido || rep.realizadoPor,
                reason:             'other',       // valor fijo para satisfacer el CHECK constraint de tquarantines.reason
                reason_description: rep.motivo,    // texto libre ingresado por el usuario
                status:             'active',
                notes:              notesExtra,
                evaluator_name:     rep.aprobadoPor || ''   // Aprobado Por / Jefe de Almacén
            };
            // reported_by_id / evaluator_id no se envían: getPersonal() da id_usuario (segu) pero
            // tquarantines referencia he.temployees. El _name basta.
            return this.quarantineSvc.createQuarantine(payload);
        });
        forkJoin(requests).pipe(
            finalize(() => { this.isSavingCuarentena = false; }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (results: any[]) => {
                // Cada herramienta genera su record_number único (RDC-N/YYYY); el impreso es el
                // de la primera fila del lote (igual que "N° Nota" en Baja).
                const nro = results[0]?.record_number || '---';
                this.reporteForm.patchValue({ nroReporteDiscrepancia: nro });
                void this._persistirFotos(this.cuarentenaList.map((t: any) => ({ toolId: t.id_tool, file: t.fotoFile })));
                // Reporte Discrepancia MGH-101 — PDF real TCPDF backend.
                const ids = results.map((r: any) => r?.id_quarantine).filter(Boolean);
                if (ids.length) this.quarantineSvc.verNotaCuarentena(ids, notaWin);
                else { try { notaWin?.close(); } catch { /* noop */ } }
                this._showMsg(`Cuarentena ${nro} procesada correctamente.`, 'success');
                this.cuarentenaList = [];
                this.reporteForm.reset({
                    fecha: this._today(), nroReporteDiscrepancia: '',
                    nombreApellido: this._currentUserName(), realizadoPor: this._currentUserName()
                });
                this.historialItems = [];
            },
            error: (err: any) => { try { notaWin?.close(); } catch { /* noop */ } this._showMsg(err?.message || 'Error al procesar la cuarentena.', 'error'); }
        });
    }

    // ── Cuarentena: búsqueda persona ───────────────────────────────────────
    private _setupPersonaSearch(): void {
        this._personaSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showPersonaDropdown = false; return of([]); }
                this.personaLoading = true;
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map((f: any) => ({ id: f.id_employee || f.id, nombre: f.nombreCompleto || f.nombre, cargo: f.cargo || '' }))
                    ),
                    finalize(() => this.personaLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => {
            this.personasFiltradas   = res || [];
            this.showPersonaDropdown = this.personasFiltradas.length > 0;
        });
    }

    onPersonaInput(v: string): void {
        this.reporteForm.patchValue({ nombreApellido: v }, { emitEvent: false });
        if (v.length >= 2) this._personaSearch$.next(v);
        else this.showPersonaDropdown = false;
    }

    selectPersona(p: any): void {
        this.reporteForm.patchValue({ nombreApellido: p.nombre });
        this.showPersonaDropdown = false;
    }

    hidePersonaDropdown(): void { setTimeout(() => this.showPersonaDropdown = false, 200); }

    onAprobadoPorCInput(v: string): void {
        this.reporteForm.patchValue({ aprobadoPor: v }, { emitEvent: false });
        if (v.length >= 2) this._aprobadoPorCSearch$.next(v);
        else this.showAprobadoPorCDropdown = false;
    }

    selectAprobadoPorC(p: any): void {
        this.reporteForm.patchValue({ aprobadoPor: p.nombre });
        this.showAprobadoPorCDropdown = false;
    }

    hideAprobadoPorCDropdown(): void { setTimeout(() => this.showAprobadoPorCDropdown = false, 200); }

    // ── Baja - Lógica ──
    private _currentUserName(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth?.nombre_usuario || '';
        } catch { return ''; }
    }

    private _initFormBaja(): void {
        const now = new Date();
        const today = this._today();
        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        this.bajaForm = this.fb.group({
            // "Procesado Por" prellenado con el usuario logueado (editable).
            procesadoPor:    [this._currentUserName(), Validators.required],
            nombre:          [''],
            cargo:           [''],
            // Licencia / Departamento del solicitante — se autocompletan al elegirlo
            // del buscador (snapshot de he.temployees), van a he.tdecommissions.applicant_*.
            licencia:        [''],
            departamento:    [''],
            fecha:           [today, Validators.required],
            hora:            [`${hh}:${mm}`, Validators.required],
            verificadoPor:   [''],
            estado:          ['requested', Validators.required],
            motivo:          ['beyond_repair', Validators.required],
            disposalMethod:  [''],
            descripcionBaja: ['', Validators.required],
            unidad:          [null],
            autorizadoPor:   [''],
            autorizadoCargo: [''],
            observaciones:   ['']
        });
    }

    private _setupFuncionarioSearch(
        subject$: Subject<string>,
        setFuncionarios: (list: any[]) => void,
        setLoading:  (v: boolean) => void,
        setDropdown: (v: boolean) => void
    ): void {
        subject$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { setDropdown(false); return of([]); }
                setLoading(true);
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map((f: any) => ({
                            id: f.id_employee || f.id,
                            nombre: f.nombreCompleto || f.nombre,
                            cargo: f.cargo || '',
                            licencia: f.licencia || f.nro_licencia || '',
                            departamento: f.departamento || f.area || ''
                        }))
                    ),
                    finalize(() => setLoading(false)),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => {
            setFuncionarios(res || []);
            setDropdown((res || []).length > 0);
        });
    }

    onProcesadoPorInput(v: string): void {
        this.bajaForm.patchValue({ procesadoPor: v }, { emitEvent: false });
        if (v.length >= 2) this._procesadoPorSearch$.next(v);
        else this.showProcesadoPorDropdown = false;
    }
    selectProcesadoPor(p: any): void {
        this.bajaForm.patchValue({
            procesadoPor: p.nombre, nombre: p.nombre, cargo: p.cargo,
            licencia: p.licencia || '', departamento: p.departamento || ''
        });
        this.showProcesadoPorDropdown = false;
    }
    hideProcesadoPorDropdown(): void { setTimeout(() => this.showProcesadoPorDropdown = false, 200); }

    onVerificadoPorInput(v: string): void {
        this.bajaForm.patchValue({ verificadoPor: v }, { emitEvent: false });
        if (v.length >= 2) this._verificadoPorSearch$.next(v);
        else this.showVerificadoPorDropdown = false;
    }
    selectVerificadoPor(p: any): void {
        this.bajaForm.patchValue({ verificadoPor: p.nombre });
        this.showVerificadoPorDropdown = false;
    }
    hideVerificadoPorDropdown(): void { setTimeout(() => this.showVerificadoPorDropdown = false, 200); }

    onAutorizadoPorInput(v: string): void {
        this.bajaForm.patchValue({ autorizadoPor: v }, { emitEvent: false });
        if (v.length >= 2) this._autorizadoPorSearch$.next(v);
        else this.showAutorizadoPorDropdown = false;
    }
    selectAutorizadoPor(p: any): void {
        this.bajaForm.patchValue({ autorizadoPor: p.nombre, autorizadoCargo: p.cargo || '' });
        this.showAutorizadoPorDropdown = false;
    }
    hideAutorizadoPorDropdown(): void { setTimeout(() => this.showAutorizadoPorDropdown = false, 200); }

    abrirModalDatos(): void {
        this.dialogRefActual = this.dialog.open(this.datosBajaModal, {
            width: '720px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog', disableClose: true
        });
    }

    cerrarModalDatos(): void {
        if (this.bajaForm.invalid) {
            this.bajaForm.markAllAsTouched();
            this._showMsg('Complete los campos obligatorios.', 'error');
            return;
        }
        this.dialogRefActual?.close();
    }

    cancelarModalDatos(): void { this.dialogRefActual?.close(); }

    async openHerramientaABaja(): Promise<void> {
        const { HerramientaABajaComponent } = await import('./baja/herramienta-a-baja/herramienta-a-baja.component');
        const ref = this.dialog.open(HerramientaABajaComponent, {
            width: '800px', maxWidth: '96vw', height: '560px',
            panelClass: 'no-padding-dialog', hasBackdrop: true, disableClose: true, autoFocus: false
        });
        ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
            if (result?.action === 'agregar' && result.data) {
                this._agregarItemBaja(result.data);
            }
        });
    }

    private _agregarItemBaja(data: any): void {
        const item: BajaItem = {
            id:           crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            toolId:       data.id_tool      ?? 0,
            codigo:       data.codigo       || '',
            pn:           data.pn           || '',
            sn:           data.sn           || '',
            nombre:       data.nombre       || '',
            cantidad:     data.cantidad     || 1,
            contenido:    data.contenido    || '',
            base:         data.base         || '',
            marca:        data.marca        || '',
            estadoFisico: data.estadoFisico || 'INSERVIBLE',
            observacion:  data.observacion  || '',
            imagen:       data.imagen       || null,
            imagenFile:   data.imagenFile   ?? null,
            warehouseId:  data.warehouseId  ?? null,
            rackId:       data.rackId       ?? null,
            levelId:      data.levelId      ?? null,
            notesTool:    data.notesTool    || ''
        };
        this.bajaItems.update(items => [...items, item]);
        this._sincronizarUnidadBaja();
    }

    removeItemBaja(index: number): void {
        const removed = this.bajaItems()[index];
        this.bajaItems.update(items => { const n = [...items]; n.splice(index, 1); return n; });
        this._sincronizarUnidadBaja();
        this._showMsg(`${removed.codigo} removida de la lista.`, 'info');
    }

    /** Bases (almacén) reales de las herramientas ya agregadas a la lista de baja. */
    basesEnLista(): string[] {
        return [...new Set(this.bajaItems().map(i => (i.base || '').trim()).filter(Boolean))];
    }

    /** "Base / Unidad" del proceso = base de las herramientas de la lista. Si todas
     *  comparten un almacén, lo autocompleta (el usuario igual puede cambiarlo). */
    private _sincronizarUnidadBaja(): void {
        const ids = [...new Set(this.bajaItems().map(i => i.warehouseId).filter((v): v is number => v != null))];
        if (ids.length !== 1) return;
        const w = this.warehouses.find(x => Number(x.id) === ids[0]);
        const codigo = w?.codigo || null;
        if (codigo && this.bajaForm.get('unidad')?.value !== codigo) {
            this.bajaForm.patchValue({ unidad: codigo });
        }
    }

    // Clic en un ítem ya agregado a la lista → abre el mismo form de detalle de herramienta
    // usado en ingresos-hub (Ajuste de Herramienta) y en préstamo técnico, en modo solo-vista.
    async abrirDetalleHerramientaBaja(item: BajaItem): Promise<void> {
        const { DetalleHerramientaComponent } = await import('../ingresos-hub/detalle-herramienta/detalle-herramienta.component');
        const editItem = {
            toolId: item.toolId, codigoBoa: item.codigo, pn: item.pn, sn: item.sn,
            descripcion: item.nombre, marca: item.marca, cantidad: item.cantidad, obs: item.notesTool,
            imagenMaster: item.imagen, warehouseId: item.warehouseId,
            rackId: item.rackId, levelId: item.levelId
        };
        this.dialog.open(DetalleHerramientaComponent, {
            width: '800px', maxWidth: '96vw', height: '560px',
            panelClass: 'no-padding-dialog', hasBackdrop: true, disableClose: false, autoFocus: false,
            data: { editItem, viewOnly: true }
        });
    }

    isProcessValid(): boolean {
        if (!this.bajaForm || this.bajaForm.invalid) return false;
        const fv = this.bajaForm.value;
        return !!(fv.procesadoPor && fv.fecha && fv.hora && fv.estado && fv.descripcionBaja);
    }

    hasError(field: string, error: string): boolean {
        const c = this.bajaForm.get(field);
        return !!(c?.hasError(error) && c?.touched);
    }

    procesarEImprimir(): void {
        if (!this.isProcessValid()) {
            this.bajaForm.markAllAsTouched();
            this._showMsg('Complete los campos requeridos del proceso de baja.', 'error');
            return;
        }
        if (this.bajaItems().length === 0) {
            this._showMsg('Agregue al menos una herramienta para dar de baja.', 'error');
            return;
        }
        this.isSavingBaja = true;
        // Pestaña reservada dentro del gesto (click) para la nota MGH-119.
        const notaWin = this.movementSvc.preAbrirVentanaPdf();
        const fv    = this.bajaForm.getRawValue();
        const items = this.bajaItems();
        const calls = items.map(item => {
            const payload: any = {
                tool_id:              item.toolId            || 0,
                status:               fv.estado              ?? 'requested',
                reason:               fv.motivo              ?? 'other',
                reason_description:   fv.descripcionBaja     || '',
                disposal_method:      fv.disposalMethod      ?? 'other',
                request_date:         fv.fecha,
                request_time:         fv.hora                || '',
                requested_by_name:    fv.procesadoPor        ?? '',
                authorized_by_name:   fv.autorizadoPor       ?? '',
                received_by_name:     fv.verificadoPor       ?? '',
                notes:                fv.observaciones       ?? '',
                condition_description: item.observacion      || item.estadoFisico || '',
                // Datos del solicitante / autorizante para la nota MGH-119 (patch HE-81).
                applicant_license:    fv.licencia            || '',
                applicant_department: fv.departamento        || '',
                applicant_position:   fv.cargo               || '',
                applicant_unit:       fv.unidad              || '',
                authorized_position:  fv.autorizadoCargo     || '',
                quantity:             Number(item.cantidad)  || 1
            };
            return this.quarantineSvc.createDecommission(payload);
        });
        forkJoin(calls).pipe(
            finalize(() => { this.isSavingBaja = false; }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (results: any[]) => {
                const nro = results[0]?.decommission_number || results[0]?.record_number || 'BJA';
                this.nroNota.set(nro);
                void this._persistirFotos(items.map(i => ({ toolId: i.toolId, file: i.imagenFile })));
                // Nota de Baja MGH-119 — PDF real TCPDF backend.
                const ids = results.map((r: any) => r?.id_decommission).filter(Boolean);
                if (ids.length) this.quarantineSvc.verNotaBaja(ids, notaWin);
                else { try { notaWin?.close(); } catch { /* noop */ } }
                this._showMsg(`Baja ${nro} procesada exitosamente.`, 'success');
                this.bajaItems.set([]);
                this.bajaForm.reset({
                    estado: 'requested', motivo: 'beyond_repair',
                    disposalMethod: 'other', fecha: this._today(),
                    procesadoPor: this._currentUserName()
                });
                this.historialItems = [];
            },
            error: (err: any) => { try { notaWin?.close(); } catch { /* noop */ } this._showMsg(err?.message || 'Error al registrar la baja.', 'error'); }
        });
    }

    // ── Historial ──
    loadHistorial(): void {
        this.isLoadingHistorial = true;
        forkJoin([
            this.quarantineSvc.getQuarantines({ limit: 100 }).pipe(
                map((data: any[]) => (data || []).map((q: any) => ({ ...q, _type: 'cuarentena' }))),
                catchError(() => of([]))
            ),
            this.quarantineSvc.getDecommissions({ limit: 100 }).pipe(
                map((data: any[]) => (data || []).map((d: any) => ({ ...d, _type: 'baja' }))),
                catchError(() => of([]))
            )
        ]).pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isLoadingHistorial = false)
        ).subscribe(([quarantines, decommissions]: [any[], any[]]) => {
            this.historialItems = [...quarantines, ...decommissions].sort((a: any, b: any) => {
                const da = new Date(b.fecha_reg || b.start_date || b.request_date || 0).getTime();
                const db = new Date(a.fecha_reg || a.start_date || a.request_date || 0).getTime();
                return da - db;
            });
            this.historialTotal = this.historialItems.length;
            this._filterHistorial();
        });
    }

    private _filterHistorial(): void {
        const q = (this.historialSearch.value || '').toLowerCase().trim();
        this.filteredHistorial = q
            ? this.historialItems.filter((m: any) =>
                (m.record_number      || '').toLowerCase().includes(q) ||
                (m.report_number      || '').toLowerCase().includes(q) ||
                (m.reported_by_name   || '').toLowerCase().includes(q) ||
                (m.requested_by_name  || '').toLowerCase().includes(q))
            : [...this.historialItems];
    }

    getHistorialFecha(m: any): string {
        const raw = m.start_date || m.request_date ||
            (m.fecha_reg ? String(m.fecha_reg).slice(0, 10) : '');
        return raw ? formatDateDMY(raw) : '---';
    }

    formatDate(date: string | null | undefined): string {
        return date ? formatDateDMY(date) : '';
    }

    getHistorialTypeLabel(m: any): string {
        return m._type === 'cuarentena' ? 'Cuarentena' : 'Baja';
    }

    /** Reimpresión de un registro desde Historial — PDF real TCPDF: cuarentena → MGH-101,
     *  baja → MGH-119. Ventana reservada dentro del click + un solo POST. */
    pdfHistorialItem(m: any): void {
        const ventana = this.movementSvc.preAbrirVentanaPdf();
        if (m._type === 'cuarentena') {
            const id = m.id_quarantine;
            if (id) this.quarantineSvc.verNotaCuarentena([id], ventana);
            else { try { ventana?.close(); } catch { /* noop */ } this._showMsg('No se pudo identificar la cuarentena', 'error'); }
        } else {
            const id = m.id_decommission;
            if (id) this.quarantineSvc.verNotaBaja([id], ventana);
            else { try { ventana?.close(); } catch { /* noop */ } this._showMsg('No se pudo identificar la baja', 'error'); }
        }
    }

    // ── Resolver Cuarentena ──
    private _initResolverForm(): void {
        this.resolverForm = this.fb.group({
            resolved_by_name: ['', Validators.required],
            resolution_date:  [this._today(), Validators.required],
            resolution:       ['', Validators.required],
            diagnosis:        ['', Validators.required],
            action_taken:     ['']
        });
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            active:    'ACTIVO',
            resolved:  'RESUELTO',
            cancelled: 'CANCELADO',
            pending:   'PENDIENTE'
        };
        return labels[status] || (status || 'ACTIVO').toUpperCase();
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            active:    'bg-amber-100 text-amber-800 border-amber-400',
            resolved:  'bg-green-100 text-green-800 border-green-400',
            cancelled: 'bg-stone-100 text-stone-600 border-stone-300',
            pending:   'bg-stone-100 text-stone-600 border-stone-300'
        };
        return colors[status] || 'bg-amber-100 text-amber-800 border-amber-400';
    }

    abrirModalResolver(item: any): void {
        this.quarantenaSeleccionada = item;
        this.resolverForm.reset({
            resolution_date:  this._today(),
            resolved_by_name: '',
            resolution:       '',
            diagnosis:        '',
            action_taken:     ''
        });
        this.resolverPersonaFiltrados    = [];
        this.showResolverPersonaDropdown = false;
        this.dialogRefActual = this.dialog.open(this.resolverModal, {
            width: '520px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog', disableClose: true
        });
    }

    onResolverPersonaInput(v: string): void {
        this.resolverForm.patchValue({ resolved_by_name: v }, { emitEvent: false });
        if (v.length >= 2) this._resolverPersonaSearch$.next(v);
        else this.showResolverPersonaDropdown = false;
    }

    selectResolverPersona(p: any): void {
        this.resolverForm.patchValue({ resolved_by_name: p.nombre });
        this.showResolverPersonaDropdown = false;
    }

    hideResolverPersonaDropdown(): void { setTimeout(() => this.showResolverPersonaDropdown = false, 200); }

    confirmarResolver(): void {
        if (this.resolverForm.invalid || !this.quarantenaSeleccionada) {
            this.resolverForm.markAllAsTouched();
            return;
        }
        const fv = this.resolverForm.getRawValue();
        const q  = this.quarantenaSeleccionada;
        const payload: any = {
            record_number:      q.record_number      || q.report_number || '',
            tool_id:            q.tool_id             || 0,
            status:             'resolved',
            reason:             q.reason              || 'other',
            reason_description: q.reason_description  || '',
            start_date:         q.start_date          || this._today(),
            report_number:      q.report_number       || q.record_number || '',
            reported_by_name:   q.reported_by_name    || '',
            notes:              q.notes               || '',
            resolution_date:    fv.resolution_date,
            resolved_by_name:   fv.resolved_by_name,
            resolution:         fv.resolution,       // enum restringido (varchar(30) + CHECK)
            diagnosis:          fv.diagnosis,         // texto libre del resultado/diagnóstico
            action_taken:       fv.action_taken       || ''
        };
        this.isResolviendo = true;
        this.quarantineSvc.updateQuarantine(q.id_quarantine, payload).pipe(
            finalize(() => { this.isResolviendo = false; }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: () => {
                this.dialogRefActual?.close();
                this._showMsg('Cuarentena resuelta. La herramienta vuelve a disponible.', 'success');
                this.historialItems = [];
                this.loadHistorial();
            },
            error: (err: any) => this._showMsg(err?.message || 'Error al resolver la cuarentena.', 'error')
        });
    }

    // ── Anular Baja ──
    private _initAnularBajaForm(): void {
        this.anularBajaForm = this.fb.group({
            motivoAnulacion: ['', Validators.required]
        });
    }

    getBajaStatusColor(status: string): string {
        const colors: Record<string, string> = {
            requested: 'bg-amber-100 text-amber-800 border-amber-400',
            approved:  'bg-blue-100 text-blue-800 border-blue-400',
            rejected:  'bg-red-100 text-red-800 border-red-400',
            executed:  'bg-stone-200 text-stone-700 border-stone-400',
            cancelled: 'bg-stone-100 text-stone-600 border-stone-300'
        };
        return colors[status] || 'bg-amber-100 text-amber-800 border-amber-400';
    }

    getBajaStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            requested:  'SOLICITADO',
            approved:   'APROBADO',
            rejected:   'RECHAZADO',
            executed:   'EJECUTADO',
            cancelled:  'ANULADO'
        };
        return labels[status] || (status || '---').toUpperCase();
    }

    bajaEsAnulable(m: any): boolean {
        return m._type === 'baja' &&
               m.status !== 'executed' &&
               m.status !== 'cancelled' &&
               m.status !== 'rejected';
    }

    abrirModalAnularBaja(item: any): void {
        this.bajaSeleccionada = item;
        this.anularBajaForm.reset({ motivoAnulacion: '' });
        this.dialogRefActual = this.dialog.open(this.anularBajaModal, {
            width: '480px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog', disableClose: true
        });
    }

    confirmarAnularBaja(): void {
        if (this.anularBajaForm.invalid || !this.bajaSeleccionada) {
            this.anularBajaForm.markAllAsTouched();
            return;
        }
        const fv = this.anularBajaForm.getRawValue();
        const b  = this.bajaSeleccionada;
        const payload: any = {
            record_number:       b.record_number       || '',
            tool_id:             b.tool_id              || 0,
            reason:              b.reason               || 'other',
            reason_description:  b.reason_description   || '',
            condition_description: b.condition_description || '',
            request_date:        b.request_date         || this._today(),
            requested_by_name:   b.requested_by_name    || '',
            authorized_by_name:  b.authorized_by_name   || '',
            received_by_name:    b.received_by_name     || '',
            disposal_method:     b.disposal_method      || '',
            status:              'cancelled',
            notes:               (b.notes ? b.notes + ' | ' : '') + 'ANULACIÓN: ' + fv.motivoAnulacion
        };
        this.isAnulando = true;
        this.quarantineSvc.updateDecommission(b.id_decommission, payload).pipe(
            finalize(() => { this.isAnulando = false; }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: () => {
                this.dialogRefActual?.close();
                this._showMsg('Baja anulada. La herramienta vuelve a disponible.', 'success');
                this.historialItems = [];
                this.loadHistorial();
            },
            error: (err: any) => this._showMsg(err?.message || 'Error al anular la baja.', 'error')
        });
    }

    // ── Común ──
    private _showMsg(msg: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(msg, 'OK', {
            duration: 4000, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
