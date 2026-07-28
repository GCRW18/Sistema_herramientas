import { Component, OnInit, OnDestroy, signal, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { OverlayModule } from '@angular/cdk/overlay';
import { Subject, of, forkJoin } from 'rxjs';
import { takeUntil, finalize, catchError, debounceTime, distinctUntilChanged, switchMap, map, mergeMap } from 'rxjs/operators';
import { MovementService }    from '../../../../core/services/movement.service';
import { ToolService }         from '../../../../core/services/tool.service';
import { SupplierService }      from '../../../../core/services/supplier.service';
import { CalibrationService }   from '../../../../core/services/calibration.service';
import { GestionUbicacionesService } from '../../inventory/gestion-ubicaciones/gestion-ubicaciones.service';
import { Warehouse, Rack, Level }    from '../../inventory/gestion-ubicaciones/interfaces';

interface Proveedor {
    id: string;
    nombre: string;
    nit?: string;
    contacto?: string;
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
    estante: string;
    nivelUbicacion: string;
    accesorios: string;
    observacion: string;
    requiereCalibracion: boolean;
    intervaloCalibracion: number | null;
    fechaCalibracion: string | null;
    nroCertificado: string;
    tipo: string;
    marca: string;
    nivelCriticidad: string;
    fabricacion: string;
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
    documentos: string;
    obs: string;
    tipo?: string;
    nivelCriticidad?: string;
    fabricacion?: string;
    warehouseId?: number | null;
    rackId?: number | null;
    levelId?: number | null;
    selected?: boolean;
}

type TabType = 'nueva' | 'ajuste' | 'historial';

@Component({
    selector: 'app-ingresos-hub',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatTableModule, MatCheckboxModule,
        MatDialogModule, MatSnackBarModule, MatProgressSpinnerModule,
        MatTooltipModule, MatAutocompleteModule, MatSlideToggleModule, DragDropModule, OverlayModule
    ],
    templateUrl: './ingresos-hub.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar-ing::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ing::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ing::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
        [hidden] { display: none !important; }
        .row-nueva-selected { background-color: #dcfce7 !important; }
        .row-ajuste-selected { background-color: #fef3c7 !important; }
        :host-context(.dark) .row-nueva-selected { background-color: rgba(21,128,61,0.15) !important; }
        :host-context(.dark) .row-ajuste-selected { background-color: rgba(251,191,36,0.2) !important; }
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

    @ViewChild('recepcionModal')    recepcionModal!:    TemplateRef<any>;
    @ViewChild('herramientaModal')  herramientaModal!:  TemplateRef<any>;
    @ViewChild('ubicDialogTpl')     ubicDialogTpl!:     TemplateRef<any>;
    @ViewChild('confirmNuevaModal') confirmNuevaModal!: TemplateRef<any>;
    @ViewChild('datosAjusteModal')  datosAjusteModal!:  TemplateRef<any>;
    @ViewChild('confirmAjusteModal') confirmAjusteModal!: TemplateRef<any>;
    @ViewChild('catalogModal')      catalogModal!:      TemplateRef<any>;
    @ViewChild('itemDetailModal')        itemDetailModal!:        TemplateRef<any>;
    @ViewChild('recepcionDetalleModal')  recepcionDetalleModal!:  TemplateRef<any>;
    @ViewChild('ajusteDetalleModal')     ajusteDetalleModal!:     TemplateRef<any>;

    public  dialogRefComponent = inject(MatDialogRef<IngresosHubComponent>, { optional: true });
    private dialogRefActual: MatDialogRef<any> | null = null;
    private dialog      = inject(MatDialog);
    private fb          = inject(FormBuilder);
    private snackBar    = inject(MatSnackBar);
    private movementSvc    = inject(MovementService);
    private toolSvc        = inject(ToolService);
    private supplierSvc    = inject(SupplierService);
    private calibrationSvc = inject(CalibrationService);
    private ubicSvc        = inject(GestionUbicacionesService);
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
    confirmingBulkDelete = false;

    // ── Catalog modal search ───────────────────────────────────────────────────
    catalogSearch  = '';
    catalogItems:  any[] = [];
    catalogLoading = false;
    private catalog$ = new Subject<string>();

    // ── Imagen herramienta (manual) ────────────────────────────────────────────
    herramientaImagen = signal<string | null>(null);

    // ── Buscador herramienta existente (header herramientaModal) ──────────────
    herBuscarValue       = '';
    herSuggestions:  any[] = [];
    showHerDD        = false;
    herSearchLoading = false;
    private _herSearch$ = new Subject<string>();

    // ══════════════════════════════════════════════════════════════════════════
    //  NUEVA HERRAMIENTA
    // ══════════════════════════════════════════════════════════════════════════
    recepcionForm!: FormGroup;
    herramientaForm!: FormGroup;
    dataSource: HerramientaItem[] = [];
    isSaving      = false;
    editingIndex: number | null = null;

    _funcSearch$  = new Subject<string>();
    funcFiltrados: { id: string; nombre: string; cargo: string }[] = [];
    funcLoading   = false;
    showFuncDropdown = false;

    proveedores:          Proveedor[] = [];
    proveedoresFiltrados: Proveedor[] = [];
    proveedorInput        = '';
    showProveedorDropdown = false;
    proveedorSeleccionado: Proveedor | null = null;

    marcas:         string[] = [];
    marcasFiltradas: string[] = [];
    private ultimoCorrelativo = 0;

    selectedItemDetail: HerramientaItem | null = null;

    // ── Historial ──────────────────────────────────────────────────────────────
    searchControl      = new FormControl('');
    filterMovType      = new FormControl('');
    historialItems:    any[] = [];
    filteredHistorial: any[] = [];
    isLoadingHistorial = false;
    historialTotal     = 0;

    abrirDetalleRecepcion(): void {
        this.dialog.open(this.recepcionDetalleModal, {
            width: '460px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog', disableClose: false, autoFocus: false
        });
    }

    abrirDetalleAjuste(): void {
        this.dialog.open(this.ajusteDetalleModal, {
            width: '460px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog', disableClose: false, autoFocus: false
        });
    }

    abrirDetalleItem(item: HerramientaItem): void {
        this.selectedItemDetail = item;
        this.dialog.open(this.itemDetailModal, {
            width: '460px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog', disableClose: false, autoFocus: false
        });
    }

    // ── Ubicación buscador (herramientaModal) ──────────────────────────────────
    ubAlmacenes:          Warehouse[] = [];
    ubAlmacenesFiltrados: Warehouse[] = [];
    ubAlmacenSearch      = '';
    showAlmacenDD        = false;
    loadingAlmacenes     = false;
    ubSelectedWarehouse: Warehouse | null = null;
    private _warehouseCbba: Warehouse | null = null;

    ubRacks:           Rack[] = [];
    ubEstantesFiltrados: Rack[] = [];
    ubEstanteSearch    = '';
    showEstanteDD      = false;
    loadingRacks       = false;
    ubSelectedRack:    Rack | null = null;

    ubLevels:     Level[] = [];
    loadingLevels = false;
    showUbAlmacenGrid  = true;
    showUbNivelDD      = false;
    ubSelectedLevel: Level | null = null;
    showUbicacionPanel = false;
    private ubicDialogRef: MatDialogRef<any> | null = null;

    _recibiConformeSearch$    = new Subject<string>();
    recibiConformeFiltrados:    { id: string; nombre: string; cargo: string }[] = [];
    recibiConformeLoading     = false;
    showRecibiConformeDropdown = false;

    unidadesMedida = [
        { value: 'UNIDAD', label: 'UNIDAD' }, { value: 'PAR',   label: 'PAR'   },
        { value: 'JUEGO',  label: 'JUEGO'  }, { value: 'KIT',   label: 'KIT'   },
        { value: 'LITRO',  label: 'LITRO'  }, { value: 'METRO', label: 'METRO' }
    ];

    estadosNueva = [
        { value: 'NUEVO',          label: 'NUEVO'          },
        { value: 'REACONDICIONADO', label: 'REACONDICIONADO' },
        { value: 'USADO',           label: 'USADO'           }
    ];

    tiposHerramienta: { value: string; label: string }[] = [
        { value: 'HERRAMIENTA',    label: 'HERRAMIENTA'                  },
        { value: 'BANCO_PRUEBA',   label: 'BANCO DE PRUEBA'              },
        { value: 'CONSUMIBLE',     label: 'CONSUMIBLE'                   },
        { value: 'EQUIPO_MEDICION', label: 'EQUIPO DE MEDICIÓN'          },
        { value: 'EQUIPO_SOPORTE',  label: 'EQUIPO DE SOPORTE EN TIERRA' }
    ];
    private readonly _tiposFallback = [...this.tiposHerramienta];

    nivelesCriticidad = [
        { value: 'A', label: 'A - Crítico', descripcion: 'Herramienta esencial para operaciones' },
        { value: 'B', label: 'B - Normal',  descripcion: 'Herramienta de uso regular'            }
    ];

    tiposFabricacion = [
        { value: 'INTERNACIONAL', label: 'INTERNACIONAL' },
        { value: 'LOCAL',         label: 'LOCAL'         }
    ];

    // ══════════════════════════════════════════════════════════════════════════
    //  AJUSTE INGRESO
    // ══════════════════════════════════════════════════════════════════════════
    ajusteForm!: FormGroup;
    dataSourceAjuste: AjusteItem[] = [];
    isSavingAjuste = false;
    itemIdCounter  = 1;

    _realizadoPorSearch$ = new Subject<string>();
    realizadoPorFiltrados: { id: string; nombre: string; cargo: string }[] = [];
    realizadoPorLoading   = false;
    showRealizadoPorDropdown = false;

    _aprobadoPorSearch$ = new Subject<string>();
    aprobadoPorFiltrados: { id: string; nombre: string; cargo: string }[] = [];
    aprobadoPorLoading   = false;
    showAprobadoPorDropdown = false;

    displayedColumnsAjuste = ['select','fila','identificacion','descripcion','cantEstado','ubicacion','tipoAjuste','acciones'];

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
        this._loadInitialData();
        this._loadAlmacenes();

        this._crearBuscadorFuncionario(
            this._funcSearch$,
            v => this.funcLoading = v,
            v => this.funcFiltrados = v,
            v => this.showFuncDropdown = v
        );
        this._crearBuscadorFuncionario(
            this._realizadoPorSearch$,
            v => this.realizadoPorLoading = v,
            v => this.realizadoPorFiltrados = v,
            v => this.showRealizadoPorDropdown = v
        );
        this._crearBuscadorFuncionario(
            this._aprobadoPorSearch$,
            v => this.aprobadoPorLoading = v,
            v => this.aprobadoPorFiltrados = v,
            v => this.showAprobadoPorDropdown = v
        );
        this._crearBuscadorFuncionario(
            this._recibiConformeSearch$,
            v => this.recibiConformeLoading = v,
            v => this.recibiConformeFiltrados = v,
            v => this.showRecibiConformeDropdown = v
        );

        this.recepcionForm.get('tipoDe')?.valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.recepcionForm.patchValue({ nroCmr: '' });
                this.recepcionForm.patchValue({ recibiConforme: '' });
            });

        this.searchControl.valueChanges.pipe(
            debounceTime(250), takeUntil(this.destroy$)
        ).subscribe(() => this.applyHistorialFilters());

        this.filterMovType.valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe(() => this.applyHistorialFilters());

        this.catalog$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(term => {
                if (term.trim().length < 2) {
                    this.catalogItems   = [];
                    this.catalogLoading = false;
                    return of([]);
                }
                this.catalogLoading = true;
                return this.toolSvc.getTools({ query: term.trim() }).pipe(
                    catchError(() => of([])),
                    finalize(() => this.catalogLoading = false)
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(tools => { this.catalogItems = tools as any[]; });

        this._herSearch$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(term => {
                if (term.trim().length < 2) { this.showHerDD = false; return of([]); }
                this.herSearchLoading = true;
                return this.toolSvc.getTools({ query: term.trim() }).pipe(
                    catchError(() => of([])),
                    finalize(() => { this.herSearchLoading = false; })
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(tools => {
            this.herSuggestions = tools as any[];
            this.showHerDD      = this.herSuggestions.length > 0;
        });
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

        this.herramientaForm = this.fb.group({
            pn:                   ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z0-9\-_]+$/)]],
            sn:                   ['', Validators.pattern(/^[A-Za-z0-9\-_]*$/)],
            descripcion:          ['', [Validators.required, Validators.minLength(3)]],
            codigoBoa:            ['BOA-H-', [Validators.required, Validators.pattern(/^[A-Za-z0-9\-]+$/)]],
            cantidad:             [1, [Validators.required, Validators.min(1), Validators.max(9999)]],
            unidadMedida:         ['UNIDAD', Validators.required],
            estado:               ['NUEVO', Validators.required],
            estante:              [''],
            nivelUbicacion:       [''],
            accesorios:           [''],
            observacion:          [''],
            requiereCalibracion:  [false],
            intervaloCalibracion: [null],
            fechaCalibracion:     [null],
            nroCertificado:       [''],
            tipo:                 ['HERRAMIENTA', Validators.required],
            marca:                ['', Validators.required],
            nivelCriticidad:      ['B', Validators.required],
            fabricacion:          ['INTERNACIONAL', Validators.required],
            warehouseId:          [null],
            rackId:               [null],
            levelId:              [null]
        });

        this.herramientaForm.get('marca')?.valueChanges.pipe(
            takeUntil(this.destroy$), debounceTime(200), distinctUntilChanged()
        ).subscribe(v => this._filtrarMarcas(v));

        this.herramientaForm.get('requiereCalibracion')?.valueChanges.pipe(
            takeUntil(this.destroy$)
        ).subscribe(requiere => {
            const ctrl = this.herramientaForm.get('intervaloCalibracion');
            if (requiere) {
                ctrl?.setValidators([Validators.required, Validators.min(1)]);
            } else {
                ctrl?.clearValidators();
                this.herramientaForm.patchValue({ intervaloCalibracion: null, fechaCalibracion: null, nroCertificado: '' });
            }
            ctrl?.updateValueAndValidity();
        });
    }

    private _crearBuscadorFuncionario(
        search$: Subject<string>,
        setLoading: (v: boolean) => void,
        setItems:   (v: any[])   => void,
        setShow:    (v: boolean) => void
    ): void {
        search$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { setShow(false); return of([]); }
                setLoading(true);
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({
                            id:     String(f.id_employee || f.id),
                            nombre: f.nombreCompleto || `${f.nombre || ''} ${f.apellido_paterno || ''}`.trim(),
                            cargo:  f.cargo || ''
                        }))),
                    finalize(() => setLoading(false)),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { setItems(res || []); setShow((res || []).length > 0); });
    }

    private _loadInitialData(): void {
        this.supplierSvc.getSuppliers().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (data: any[]) => {
                    this.proveedores = data.map((s: any) => ({
                        id:       String(s.id_supplier ?? s.id ?? ''),
                        nombre:   s.name ?? '',
                        nit:      s.taxId ?? s.tax_id ?? '',
                        contacto: s.contactPerson ?? s.contact_person ?? '',
                        direccion: s.address ?? '',
                        telefono: s.phone ?? ''
                    }));
                    this.proveedoresFiltrados = [...this.proveedores];
                }});

        this.movementSvc.getDistinctBrands().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (brands: string[]) => { this.marcas = brands; this.marcasFiltradas = [...brands]; } });

        this._cargarTiposHerramienta();

        this.movementSvc.getLastBoaCode().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (num: number) => { this.ultimoCorrelativo = num; } });
    }

    // ── Nueva: modal handlers ─────────────────────────────────────────────────
    abrirModalRecepcion(): void {
        if (!this.recepcionForm.get('nroCmr')?.value) {
            this.generarNroCmr();
        }
        this.dialogRefActual = this.dialog.open(this.recepcionModal, {
            width: '520px', maxWidth: '95vw', height: '88vh', panelClass: 'no-padding-dialog', disableClose: true
        });
    }

    generarNroCmr(): void {
        const tipo = this.recepcionForm.get('tipoDe')?.value || 'COMPRA';
        const prefijos: Record<string, string> = { 'COMPRA': 'CMR', 'DONACION': 'DON', 'TRANSFERENCIA': 'TRANS' };
        this.movementSvc.getSiguienteCorrelativoPreview(prefijos[tipo] || 'CMR')
            .pipe(takeUntil(this.destroy$))
            .subscribe(num => this.recepcionForm.patchValue({ nroCmr: num }));
    }

    cerrarModalRecepcion(): void { this.dialogRefActual?.close(); }

    abrirModalHerramienta(index?: number): void {
        this._resetUbicacionBuscador();
        if (index !== undefined) {
            this.editingIndex = index;
            this.herramientaForm.patchValue({ ...this.dataSource[index] });
            this.herramientaImagen.set((this.dataSource[index] as any).imagen || null);
            // Mostrar valores guardados en los inputs del buscador
            const item = this.dataSource[index];
            if (item.estante) this.ubEstanteSearch = item.estante;
            if (item.nivelUbicacion) this.ubLevels = [];
        } else {
            this.editingIndex = null;
            this._resetHerramientaForm();
            if (this._warehouseCbba) {
                this.seleccionarUbAlmacen(this._warehouseCbba);
            }
        }
        this.dialogRefActual = this.dialog.open(this.herramientaModal, {
            width: 'min(760px, 96vw)', maxWidth: '96vw', height: 'min(680px, 92vh)', panelClass: 'no-padding-dialog', disableClose: true
        });
    }

    cerrarModalHerramienta(): void {
        this.editingIndex = null;
        this.herramientaImagen.set(null);
        this.dialogRefActual?.close();
    }

    onHerramientaImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => this.herramientaImagen.set(reader.result as string);
        reader.readAsDataURL(file);
    }

    clearHerramientaImagen(): void { this.herramientaImagen.set(null); }

    abrirModalConfirmacionNueva(): void {
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
        this.dialogRefActual = this.dialog.open(this.confirmNuevaModal, {
            width: '580px', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true
        });
    }

    cerrarModalConfirmacionNueva(): void { this.dialogRefActual?.close(); }

    // ── Nueva: table actions ──────────────────────────────────────────────────
    agregarHerramienta(): void {
        this.herramientaForm.markAllAsTouched();
        if (this.herramientaForm.invalid) {
            this._showMsg('Complete los campos requeridos', 'error');
            return;
        }
        const f = this.herramientaForm.value;
        const existeIndex = this.dataSource.findIndex(
            i => i.codigoBoa.toUpperCase() === f.codigoBoa.toUpperCase()
        );
        if (existeIndex >= 0 && this.editingIndex !== existeIndex) {
            this._showMsg('Ya existe una herramienta con este código BOA', 'warning');
            return;
        }
        const item: HerramientaItem = {
            ...f,
            pn:                   f.pn.toUpperCase(),
            codigoBoa:            f.codigoBoa.toUpperCase(),
            intervaloCalibracion: f.requiereCalibracion ? f.intervaloCalibracion : null,
            fechaCalibracion:     f.requiereCalibracion ? f.fechaCalibracion     : null,
            nroCertificado:       f.requiereCalibracion ? f.nroCertificado       : '',
            imagen:               this.herramientaImagen() || null
        };
        if (this.editingIndex !== null) {
            this.dataSource[this.editingIndex] = item;
            this._showMsg('Herramienta actualizada en la recepción', 'success');
        } else {
            this.dataSource.push(item);
            this._showMsg('Herramienta añadida a la recepción', 'success');
        }
        this.dataSource = [...this.dataSource];
        this.cerrarModalHerramienta();
    }

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

    duplicarItem(index: number): void {
        const copy = { ...this.dataSource[index] };
        copy.sn = '';
        this.ultimoCorrelativo++;
        copy.codigoBoa = `BOA-H-${this.ultimoCorrelativo.toString().padStart(4, '0')}`;
        this.editingIndex = null;
        this.herramientaForm.patchValue(copy);
        this._resetUbicacionBuscador();
        if (this._warehouseCbba) {
            this.seleccionarUbAlmacen(this._warehouseCbba);
        }
        this.dialogRefActual = this.dialog.open(this.herramientaModal, {
            width: 'min(760px, 96vw)', maxWidth: '96vw', height: 'min(680px, 92vh)', panelClass: 'no-padding-dialog', disableClose: true
        });
        this._showMsg('Ítem copiado. Ajuste el S/N si es necesario.', 'info');
    }

    // ── Nueva: finalize ───────────────────────────────────────────────────────
    finalizarIngreso(): void {
        this.cerrarModalConfirmacionNueva();
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
            document_ref: '', unit_of_measure: h.unidadMedida || 'UNIDAD',
            condition: h.estado === 'NUEVO' ? 'new' : h.estado === 'REACONDICIONADO' ? 'reconditioned' : 'good',
            criticality_level: h.nivelCriticidad || 'B', manufacture_origin: h.fabricacion || 'INTERNACIONAL',
            requires_calibration: h.requiereCalibracion || false, calibration_interval: h.intervaloCalibracion || null,
            calibration_date: h.fechaCalibracion || null, certificate_number: h.nroCertificado || '', notes: h.observacion || ''
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
                    this.proveedorInput = '';
                    this.proveedorSeleccionado = null;
                    this.loadHistorial();
                },
                error: (err: any) => this._showMsg(err?.message || 'Error al registrar', 'error')
            });
    }

    openCatalogo(): void {
        this.catalogSearch  = '';
        this.catalogItems   = [];
        this.catalogLoading = false;
        this.dialogRefActual = this.dialog.open(this.catalogModal, {
            width: '760px', maxWidth: '95vw', height: '80vh', panelClass: 'no-padding-dialog', disableClose: false
        });
    }

    onCatalogSearch(term: string): void {
        this.catalogSearch = term;
        this.catalog$.next(term);
    }

    selectFromCatalog(tool: any): void {
        this.dialogRefActual?.close();
        this.editingIndex = null;
        this._resetHerramientaForm();
        this.herramientaForm.patchValue({
            pn:          tool.part_number  || tool.pn          || '',
            sn:          tool.serial_number || tool.sn          || '',
            descripcion: tool.name         || tool.description  || tool.descripcion || '',
            marca:       tool.brand        || tool.marca        || '',
            tipo:        tool.tool_type    || 'HERRAMIENTA',
            unidadMedida: tool.unit_of_measure || 'UNIDAD',
            estado:      'NUEVO',
        });
        this.generarCodigoBoa();
        setTimeout(() => {
            this.dialogRefActual = this.dialog.open(this.herramientaModal, {
                width: 'min(760px, 96vw)', maxWidth: '96vw', height: 'min(680px, 92vh)', panelClass: 'no-padding-dialog', disableClose: true
            });
        }, 100);
    }

    // ── Buscador herramienta existente (header herramientaModal) ─────────────
    onHerBuscarInput(val: string): void {
        this.herBuscarValue = val;
        this._herSearch$.next(val);
    }

    hideHerDD(): void { setTimeout(() => { this.showHerDD = false; }, 180); }

    seleccionarHerExistente(tool: any): void {
        this.herBuscarValue = `${tool.code || ''} · ${tool.name || tool.description || ''}`;
        this.showHerDD = false;
        this.herramientaForm.patchValue({
            pn:          tool.part_number  || '',
            sn:          tool.serial_number || '',
            codigoBoa:   tool.code         || '',
            descripcion: tool.name         || tool.description || '',
            marca:       tool.brand        || '',
        });
    }

    limpiarHerBuscar(): void {
        this.herBuscarValue = '';
        this.herSuggestions = [];
        this.showHerDD      = false;
    }

    // ── Nueva: utilities ──────────────────────────────────────────────────────
    onFuncionarioInput(val: string): void {
        this.recepcionForm.patchValue({ funcionarioRecibe: val });
        this._funcSearch$.next(val);
    }

    selectFuncionario(f: { id: string; nombre: string; cargo: string }): void {
        this.recepcionForm.patchValue({ funcionarioRecibe: f.nombre });
        this.showFuncDropdown = false;
    }

    hideFuncDropdown(): void { setTimeout(() => this.showFuncDropdown = false, 150); }

    onProveedorInput(val: string): void {
        this.proveedorInput = val;
        this.recepcionForm.patchValue({ proveedor: val });
        this.proveedorSeleccionado = null;
        this._filtrarProveedores(val);
        this.showProveedorDropdown = val.length > 0 && this.proveedoresFiltrados.length > 0;
    }

    selectProveedor(p: Proveedor): void {
        this.proveedorInput = p.nombre;
        this.recepcionForm.patchValue({ proveedor: p.nombre });
        this.proveedorSeleccionado = p;
        this.showProveedorDropdown = false;
    }

    hideProveedorDropdown(): void { setTimeout(() => this.showProveedorDropdown = false, 150); }

    onRecibiConformeInput(val: string): void {
        this.recepcionForm.patchValue({ recibiConforme: val });
        this._recibiConformeSearch$.next(val);
    }

    selectRecibiConforme(f: { id: string; nombre: string; cargo: string }): void {
        this.recepcionForm.patchValue({ recibiConforme: f.nombre });
        this.showRecibiConformeDropdown = false;
    }

    hideRecibiConformeDropdown(): void { setTimeout(() => this.showRecibiConformeDropdown = false, 150); }

    isRecepcionValida(): boolean { return this.recepcionForm.valid; }

    getNroCmrLabel(): string {
        const t = this.recepcionForm.get('tipoDe')?.value;
        if (t === 'DONACION')      return 'N° Carta de Donación';
        if (t === 'TRANSFERENCIA') return 'N° Doc. Transferencia';
        return 'N° CMR / Documento';
    }

    getNroCmrPlaceholder(): string {
        const t = this.recepcionForm.get('tipoDe')?.value;
        if (t === 'DONACION')      return 'CART-DON-001';
        if (t === 'TRANSFERENCIA') return 'TRANS-2026-001';
        return 'CMR-001 / NRT-2026';
    }

    getProveedorLabel(): string {
        const t = this.recepcionForm.get('tipoDe')?.value;
        if (t === 'DONACION')      return 'Donante / Organización';
        if (t === 'TRANSFERENCIA') return 'Dependencia / Origen';
        return 'Proveedor / Empresa';
    }

    getProveedorPlaceholder(): string {
        const t = this.recepcionForm.get('tipoDe')?.value;
        if (t === 'DONACION')      return 'Nombre del donante u organización...';
        if (t === 'TRANSFERENCIA') return 'Dependencia de origen...';
        return 'Nombre del proveedor o empresa...';
    }

    getEntregadoPorLabel(): string {
        const t = this.recepcionForm.get('tipoDe')?.value;
        if (t === 'DONACION')      return 'Representante Donante';
        if (t === 'TRANSFERENCIA') return 'Responsable Origen';
        return 'Entregado / Conforme por';
    }

    validateRecepcion(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        this.recepcionForm.markAllAsTouched();
        if (this.recepcionForm.get('nroCmr')?.invalid)         errors.push('Falta Nro Documento/CMR');
        if (this.recepcionForm.get('fechaIngreso')?.invalid)   errors.push('Falta Fecha de Recepción');
        if (!this.recepcionForm.get('funcionarioRecibe')?.value) errors.push('Falta Funcionario que Recibe');
        return { valid: errors.length === 0, errors };
    }

    generarCodigoBoa(): void {
        this.ultimoCorrelativo++;
        this.herramientaForm.patchValue({ codigoBoa: `BOA-H-${this.ultimoCorrelativo.toString().padStart(4, '0')}` });
    }

    getTotalItems(): number { return this.dataSource.reduce((sum, i) => sum + i.cantidad, 0); }

    getEstadoNuevaClass(estado: string): string {
        switch (estado) {
            case 'NUEVO':           return 'bg-green-100 text-green-800 border-green-300';
            case 'REACONDICIONADO': return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'USADO':           return 'bg-amber-100 text-amber-800 border-amber-300';
            default:                return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    }

    displayProveedor(p: Proveedor): string {
        return p ? `${p.nombre}${p.nit ? ' (' + p.nit + ')' : ''}` : '';
    }

    hasRecepcionError(field: string, error: string): boolean {
        const c = this.recepcionForm.get(field);
        return !!(c?.hasError(error) && c?.touched);
    }

    hasHerramientaError(field: string, error: string): boolean {
        const c = this.herramientaForm.get(field);
        return !!(c?.hasError(error) && c?.touched);
    }

    private _resetHerramientaForm(): void {
        this.herramientaForm.reset({
            codigoBoa: 'BOA-H-', cantidad: 1, unidadMedida: 'UNIDAD', estado: 'NUEVO',
            requiereCalibracion: false, tipo: 'HERRAMIENTA', nivelCriticidad: 'B', fabricacion: 'INTERNACIONAL'
        });
        this.herramientaImagen.set(null);
        this._resetUbicacionBuscador();
    }

    // ── Ubicación buscador ────────────────────────────────────────────────────

    private _loadAlmacenes(): void {
        this.loadingAlmacenes = true;
        this.ubicSvc.getWarehouses().pipe(takeUntil(this.destroy$))
            .subscribe({
                next: ws => {
                    // Solo almacenes de Cochabamba (mismo criterio que Kits/Misceláneos):
                    // esta pantalla registra ingresos nuevos, siempre entran por Cbba.
                    this.ubAlmacenes = ws.filter(w => w.codigo?.startsWith('ALM-CBB'));
                    this.ubAlmacenesFiltrados = this.ubAlmacenes;
                    this._warehouseCbba = this.ubAlmacenes[0] ?? null;
                },
                error: () => {},
                complete: () => { this.loadingAlmacenes = false; }
            });
    }

    private _resetUbicacionBuscador(): void {
        this.closeUbicacionDialog();
        this.ubSelectedWarehouse = null;
        this.ubAlmacenSearch     = '';
        this.ubAlmacenesFiltrados = [...this.ubAlmacenes];
        this.showAlmacenDD       = false;
        this.showUbAlmacenGrid   = true;
        this.ubSelectedRack      = null;
        this.ubEstanteSearch     = '';
        this.ubEstantesFiltrados = [];
        this.showEstanteDD       = false;
        this.ubRacks             = [];
        this.ubLevels            = [];
        this.ubSelectedLevel     = null;
        this.showUbNivelDD       = false;
        this.showUbicacionPanel  = false;
    }

    onUbAlmacenInput(val: string): void {
        this.ubAlmacenSearch = val;
        const q = val.trim().toUpperCase();
        this.ubAlmacenesFiltrados = q
            ? this.ubAlmacenes.filter(w => w.codigo.toUpperCase().includes(q) || w.nombre.toUpperCase().includes(q))
            : this.ubAlmacenes;
        this.showAlmacenDD = this.ubAlmacenesFiltrados.length > 0;
    }

    hideUbAlmacenDD(): void { setTimeout(() => { this.showAlmacenDD = false; }, 180); }

    seleccionarUbAlmacen(w: Warehouse): void {
        this.ubSelectedWarehouse = w;
        this.ubAlmacenSearch     = `${w.codigo} · ${w.nombre}`;
        this.showAlmacenDD       = false;
        this.showUbAlmacenGrid   = false;
        this.ubSelectedRack      = null;
        this.ubEstanteSearch     = '';
        this.ubRacks             = [];
        this.ubEstantesFiltrados = [];
        this.ubLevels            = [];
        this.ubSelectedLevel     = null;
        this.showUbNivelDD       = false;
        this.herramientaForm.patchValue({ estante: '', nivelUbicacion: '', warehouseId: w.id, rackId: null, levelId: null });
        this.loadingRacks = true;
        this.ubicSvc.getRacks(w.id).pipe(takeUntil(this.destroy$))
            .subscribe({ next: rs => { this.ubRacks = rs; this.ubEstantesFiltrados = rs; }, error: () => {}, complete: () => { this.loadingRacks = false; } });
    }

    limpiarUbAlmacen(): void {
        this._resetUbicacionBuscador();
        this.herramientaForm.patchValue({ estante: '', nivelUbicacion: '', warehouseId: null, rackId: null, levelId: null });
    }

    onUbEstanteInput(val: string): void {
        this.ubEstanteSearch = val;
        const q = val.trim().toUpperCase();
        this.ubEstantesFiltrados = q
            ? this.ubRacks.filter(r => r.codigo.toUpperCase().includes(q) || r.nombre.toUpperCase().includes(q))
            : this.ubRacks;
        this.showEstanteDD = this.ubEstantesFiltrados.length > 0;
    }

    hideUbEstanteDD(): void { setTimeout(() => { this.showEstanteDD = false; }, 180); }

    seleccionarUbEstante(r: Rack): void {
        this.ubSelectedRack  = r;
        this.ubEstanteSearch = `${r.codigo} · ${r.nombre}`;
        this.showEstanteDD   = false;
        this.ubLevels        = [];
        this.ubSelectedLevel = null;
        this.showUbNivelDD   = false;
        this.herramientaForm.patchValue({ estante: r.codigo, nivelUbicacion: '', rackId: r.id, levelId: null });
        this.loadingLevels = true;
        this.ubicSvc.getLevels(r.id).pipe(takeUntil(this.destroy$))
            .subscribe({ next: ls => { this.ubLevels = ls; }, error: () => {}, complete: () => { this.loadingLevels = false; } });
    }

    limpiarUbEstante(): void {
        this.ubSelectedRack  = null;
        this.ubEstanteSearch = '';
        this.ubLevels        = [];
        this.ubSelectedLevel = null;
        this.showUbNivelDD   = false;
        this.herramientaForm.patchValue({ estante: '', nivelUbicacion: '', rackId: null, levelId: null });
    }

    seleccionarUbNivel(levelId: number | null): void {
        if (!levelId) { this.herramientaForm.patchValue({ nivelUbicacion: '' }); return; }
        const l = this.ubLevels.find(x => x.id === levelId);
        if (l) this.herramientaForm.patchValue({ nivelUbicacion: l.isFloor ? 'SUELO' : l.codigo });
    }

    openUbicacionDialog(): void {
        if (this.ubicDialogRef) { this.closeUbicacionDialog(); return; }
        this.showUbicacionPanel = true;
        this.ubicDialogRef = this.dialog.open(this.ubicDialogTpl, {
            width: 'min(760px, 96vw)',
            maxHeight: '70vh',
            panelClass: 'no-padding-dialog',
            hasBackdrop: true,
            backdropClass: 'ubic-backdrop',
            autoFocus: false,
        });
        this.ubicDialogRef.afterClosed().subscribe(() => {
            this.ubicDialogRef = null;
            this.showUbicacionPanel = false;
        });
    }

    closeUbicacionDialog(): void {
        this.ubicDialogRef?.close();
        this.ubicDialogRef = null;
        this.showUbicacionPanel = false;
    }

    seleccionarUbNivelCard(l: Level): void {
        this.ubSelectedLevel = l;
        this.showUbNivelDD   = false;
        this.herramientaForm.patchValue({ nivelUbicacion: l.isFloor ? 'SUELO' : l.codigo, levelId: l.id });
        this.closeUbicacionDialog();
    }

    private _filtrarProveedores(v: string): void {
        if (!v) { this.proveedoresFiltrados = [...this.proveedores]; return; }
        const q = v.toLowerCase();
        this.proveedoresFiltrados = this.proveedores.filter(p =>
            p.nombre.toLowerCase().includes(q) ||
            (p.nit && p.nit.toLowerCase().includes(q)) ||
            (p.contacto && p.contacto.toLowerCase().includes(q))
        );
    }

    private _filtrarMarcas(v: string): void {
        this.marcasFiltradas = v
            ? this.marcas.filter(m => m.toLowerCase().includes(v.toLowerCase()))
            : [...this.marcas];
    }

    // ── Categorías dinámicas ──────────────────────────────────────────────────
    _cargarTiposHerramienta(): void {
        this.movementSvc.getIngresosCategories().pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (cats) => {
                    if (cats.length > 0) {
                        this.tiposHerramienta = cats.map(c => ({
                            value: c.code || c.name.replace(/\s+/g, '_'),
                            label: c.name
                        }));
                    }
                },
                error: () => { /* mantiene el array estático como fallback */ }
            });
    }

    async abrirCategorias(): Promise<void> {
        const { CategoriaIngresosDialogComponent } = await import('./categoria-ingresos-dialog/categoria-ingresos-dialog.component');
        const ref = this.dialog.open(CategoriaIngresosDialogComponent, {
            panelClass: 'no-padding-dialog', disableClose: false
        });
        ref.afterClosed().subscribe(result => {
            if (result?.recargar) this._cargarTiposHerramienta();
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
            fecha:             [new Date().toISOString().split('T')[0], Validators.required],
            descripcion:       ['']
        });
    }

    // ── Ajuste: modal handlers ────────────────────────────────────────────────
    abrirModalDatosAjuste(): void {
        if (!this.ajusteForm.get('documento')?.value) {
            this.generarDocumento();
        }
        this.dialogRefActual = this.dialog.open(this.datosAjusteModal, {
            width: '820px', maxWidth: '98vw', height: '88vh', panelClass: 'no-padding-dialog', disableClose: true
        });
    }

    cerrarModalDatosAjuste(): void { this.dialogRefActual?.close(); }

    isDatosAjusteValido(): boolean { return this.ajusteForm.valid; }

    abrirModalConfirmacionAjuste(): void {
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
        this.dialogRefActual = this.dialog.open(this.confirmAjusteModal, {
            width: '800px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalConfirmacionAjuste(): void { this.dialogRefActual?.close(); }

    // ── Ajuste: table actions ─────────────────────────────────────────────────
    toggleSelectionAjuste(item: AjusteItem): void { item.selected = !item.selected; }

    toggleAllAjuste(event: any): void {
        const checked = event.checked;
        this.dataSourceAjuste.forEach(i => i.selected = checked);
    }

    isAllAjusteSelected(): boolean {
        return this.dataSourceAjuste.length > 0 && this.dataSourceAjuste.every(i => i.selected);
    }

    isSomeAjusteSelected(): boolean {
        return this.dataSourceAjuste.some(i => i.selected) && !this.isAllAjusteSelected();
    }

    getAjusteSelectedCount(): number { return this.dataSourceAjuste.filter(i => i.selected).length; }

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

    eliminarSeleccionados(): void {
        this.confirmingBulkDelete = true;
    }

    cancelarBulkDelete(): void {
        this.confirmingBulkDelete = false;
    }

    ejecutarBulkDelete(): void {
        const count = this.dataSourceAjuste.filter(i => i.selected).length;
        this.dataSourceAjuste = this.dataSourceAjuste.filter(i => !i.selected);
        this.confirmingBulkDelete = false;
        this._showMsg(`${count} ítem(s) eliminados`, 'info');
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
                documentos:      result.data.documento       || '',
                obs:             result.data.observaciones   || '',
                tipo:            result.data.tipo            || 'HERRAMIENTA',
                nivelCriticidad: result.data.nivelCriticidad || 'B',
                fabricacion:     result.data.fabricacion     || 'INTERNACIONAL',
                warehouseId:     result.data.warehouseId     || null,
                rackId:          result.data.rackId          || null,
                levelId:         result.data.levelId         || null,
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
                const newItem: AjusteItem = { id: this.itemIdCounter++, selected: false, ...mapped };
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
        this.cerrarModalConfirmacionAjuste();
        this.isSavingAjuste = true;
        const itemsJson = JSON.stringify(this.dataSourceAjuste.map(i => ({
            tool_id:  Number(i.toolId),
            quantity: i.cantidad,
            condicion: i.estado || 'SERVICEABLE',
            notes:    [
                i.tipoAjuste  ? '[' + i.tipoAjuste + ']'   : '',
                i.documentos  ? 'DOC:' + i.documentos       : '',
                i.obs || ''
            ].filter(Boolean).join(' | ')
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
                this.ajusteForm.reset({ tipoAjuste: 'INVENTARIO', fecha: new Date().toISOString().split('T')[0] });
                this.loadHistorial();
            },
            error: (err: any) => this._showMsg('Error al registrar el ajuste: ' + (err?.message || ''), 'error')
        });
    }

    // ── Ajuste: utilities ─────────────────────────────────────────────────────
    onRealizadoPorInput(val: string): void {
        this.ajusteForm.patchValue({ realizadoPorInput: val });
        this._realizadoPorSearch$.next(val);
    }

    selectRealizadoPor(f: { id: string; nombre: string; cargo: string }): void {
        this.ajusteForm.patchValue({ realizadoPor: f.nombre, realizadoPorInput: f.nombre });
        this.showRealizadoPorDropdown = false;
    }

    hideRealizadoPorDropdown(): void { setTimeout(() => this.showRealizadoPorDropdown = false, 150); }

    onAprobadoPorInput(val: string): void {
        this.ajusteForm.patchValue({ aprobadoPorInput: val });
        this._aprobadoPorSearch$.next(val);
    }

    selectAprobador(f: { id: string; nombre: string; cargo: string }): void {
        this.ajusteForm.patchValue({ aprobadoPor: f.nombre, aprobadoPorInput: f.nombre });
        this.showAprobadoPorDropdown = false;
    }

    hideAprobadoPorDropdown(): void { setTimeout(() => this.showAprobadoPorDropdown = false, 150); }

    getRealizadoPorNombre(): string { return this.ajusteForm.value.realizadoPorInput || 'No seleccionado'; }
    getAprobadoPorNombre():  string { return this.ajusteForm.value.aprobadoPorInput  || 'No seleccionado'; }
    getDocumentoText():      string { return this.ajusteForm.value.documento || 'S/D'; }
    getFechaText():          string { return this.ajusteForm.value.fecha || ''; }

    getTipoAjusteClass(tipo: string): string {
        return this.tiposAjuste.find(t => t.value === tipo)?.color || 'bg-gray-100 text-gray-800 border-gray-400';
    }
    getTipoAjusteLabel(tipo: string): string {
        return this.tiposAjuste.find(t => t.value === tipo)?.label || tipo;
    }
    getEstadoAjusteClass(estado: string): string {
        return this.estadosAjuste.find(e => e.value === estado)?.color || 'bg-gray-100 text-gray-800 border-gray-400';
    }
    getEstadoAjusteLabel(estado: string): string {
        return this.estadosAjuste.find(e => e.value === estado)?.label || estado;
    }

    generarDocumento(): void {
        const tipo = this.ajusteForm.get('tipoAjuste')?.value;
        const prefijos: { [k: string]: string } = {
            'INVENTARIO': 'AI', 'REUBICACION': 'REUB', 'DONACION': 'DON',
            'ENCONTRADO': 'AJU', 'SOBRANTE': 'SOB', 'CORRECCION': 'CORR'
        };
        const prefijo = prefijos[tipo] || 'AI';
        this.movementSvc.getSiguienteCorrelativoPreview(prefijo)
            .pipe(takeUntil(this.destroy$))
            .subscribe(num => this.ajusteForm.patchValue({ documento: num }));
    }

    hasAjusteError(field: string, error: string): boolean {
        const c = this.ajusteForm.get(field);
        return !!(c?.hasError(error) && c?.touched);
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

    pdfHistorialItem(m: any): void {
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

    // ══════════════════════════════════════════════════════════════════════════
    //  PDF — NUEVA HERRAMIENTA (INGRESO POR COMPRA)
    // ══════════════════════════════════════════════════════════════════════════
    private _abrirImpresionIngreso(nro: string, items: HerramientaItem[], rec: any, provNombre: string): void {
        const now  = new Date().toLocaleString('es-BO');
        const rows = items.map((h, idx) => `
            <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td><span style="font-family:monospace;font-weight:700;background:#0f172a;color:white;padding:1px 5px;border-radius:3px;font-size:9px">${h.codigoBoa}</span></td>
                <td style="font-family:monospace;font-size:9px">${h.pn || '-'}</td>
                <td style="font-family:monospace;font-size:9px">${h.sn || '-'}</td>
                <td style="text-align:center;font-weight:700">${h.cantidad}</td>
                <td style="font-size:9px">${h.unidadMedida || 'UND'}</td>
                <td>${h.descripcion || '-'}</td>
                <td style="font-size:9px">${h.marca || '-'}</td>
                <td style="text-align:center"><span style="padding:1px 4px;border:1px solid #000;font-size:8px;font-weight:700">${h.estado}</span></td>
                <td style="font-size:8.5px">${h.estante ? h.estante + (h.nivelUbicacion ? '/' + h.nivelUbicacion : '') : '-'}</td>
            </tr>`).join('');

        const css = `<style>@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:0}.top{display:flex;justify-content:space-between;margin-bottom:5px}.code-box{border:2px solid #000;padding:3px 10px;font-weight:900;font-size:13px;display:inline-block}h1{text-align:center;font-size:12px;font-weight:900;text-transform:uppercase;background:#111A43;color:white;padding:7px 10px;margin:0 0 7px;border:1px solid #000}.info-tbl{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:7px}.info-tbl td{border:1px solid #ddd;padding:3px 6px}.lbl{background:#f0f0f0;font-weight:700;font-size:9px;width:130px}.nro-cell{background:#f0f0f0;text-align:center;font-weight:900;font-size:15px;vertical-align:middle;width:120px}.sec{background:#111A43;color:white;padding:3px 8px;font-weight:900;font-size:10px;text-transform:uppercase;border:1px solid #000}table.det{width:100%;border-collapse:collapse;border:1px solid #000}table.det th{background:#111A43;color:white;padding:4px 3px;font-size:8px;font-weight:900;text-transform:uppercase;border:1px solid #000;text-align:center}table.det td{padding:3px 4px;border:1px solid #ddd;font-size:9px}table.det tr:nth-child(even) td{background:#f9f9f9}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.sig{border:1px solid #000;padding:6px 8px;text-align:center}.sig-ttl{font-weight:900;font-size:9px;text-transform:uppercase;margin-bottom:26px}.sig-line{border-top:1px solid #000;padding-top:3px;font-size:8.5px}.footer{text-align:center;margin-top:10px;font-size:7.5px;color:#888;border-top:1px dotted #ccc;padding-top:4px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>NI ${nro}</title>${css}<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script></head><body>
<div class="top"><div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145# N-114</div><div style="text-align:right"><div class="code-box">NI</div><br><span style="font-size:9px">NOTA DE INGRESO</span></div></div>
<h1>NOTA DE INGRESO A ALMACÉN DE HERRAMIENTAS<br><span style="font-size:10px;font-weight:400">HERRAMIENTAS, BANCOS DE PRUEBA Y EQUIPOS DE APOYO</span></h1>
<table class="info-tbl">
<tr><td class="lbl">DOCUMENTO / CMR:</td><td style="font-weight:700">${rec.nroCmr || nro}</td><td class="lbl">FACTURA:</td><td>${rec.nroFactura || '—'}</td><td class="nro-cell" rowspan="3"><div style="font-size:8px;font-weight:400">N° INGRESO</div>${nro}</td></tr>
<tr><td class="lbl">PROVEEDOR:</td><td>${provNombre || '—'}</td><td class="lbl">ORDEN DE COMPRA:</td><td>${rec.ordenCompra || '—'}</td></tr>
<tr><td class="lbl">RECIBE EN ALMACÉN:</td><td style="font-weight:700">${rec.funcionarioRecibe || '—'}</td><td class="lbl">FECHA INGRESO:</td><td>${rec.fechaIngreso || '—'}</td></tr>
</table>
<div class="sec">DETALLE DE HERRAMIENTAS INGRESADAS</div>
<table class="det"><thead><tr><th>#</th><th>CÓDIGO BOA</th><th>P/N</th><th>S/N</th><th>CANT.</th><th>UND</th><th>DESCRIPCIÓN</th><th>MARCA</th><th>ESTADO</th><th>UBICACIÓN</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sigs">
<div class="sig"><div class="sig-ttl">ENTREGADO POR / PROVEEDOR</div><div style="font-size:9px;margin-bottom:16px">${rec.recibiConforme || '____________________'}</div><div class="sig-line">Firma / Sello</div></div>
<div class="sig"><div class="sig-ttl">RECIBIDO EN ALMACÉN</div><div style="font-size:9px;margin-bottom:16px">${rec.funcionarioRecibe || '____________________'}</div><div class="sig-line">Firma / Cargo</div></div>
<div class="sig"><div class="sig-ttl">JEFE DE ALMACÉN</div><div class="sig-line">Firma / Cargo</div></div>
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
                <td style="font-size:8.5px">${item.documentos || '-'}</td>
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
      <td class="lbl">FECHA:</td><td>${fv.fecha || '—'}</td>
      <td class="lbl">OBSERVACIÓN:</td><td>${fv.descripcion || '—'}</td>
    </tr>
  </table>
  <div class="sec">DETALLE DE HERRAMIENTAS AJUSTADAS</div>
  <table class="det">
    <thead><tr>
      <th style="width:25px">ITEM</th><th>CÓDIGO BOA</th><th>P/N</th><th>S/N</th>
      <th style="width:35px">CANT.</th><th>DESCRIPCIÓN</th><th>ESTADO</th>
      <th>LISTA CONT.</th><th>UBICACIÓN</th><th>OBS</th>
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
