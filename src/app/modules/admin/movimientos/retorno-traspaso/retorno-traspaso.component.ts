import {
    Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
    Subject, takeUntil, finalize, debounceTime, distinctUntilChanged,
    switchMap, of, forkJoin, map, catchError
} from 'rxjs';

import { MovementService } from '../../../../core/services/movement.service';
import { ToolService } from '../../../../core/services/tool.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

// Dialog components (standalone subfolders)
import { EnvioDialogComponent } from './dialogs/envio/envio-dialog.component';
import { TraspasoDialogComponent } from './dialogs/traspaso/traspaso-dialog.component';
import { RetornoDialogComponent } from './dialogs/retorno/retorno-dialog.component';
import { TraspasoTecnicoDialogComponent } from './dialogs/traspaso-tecnico/traspaso-tecnico-dialog.component';
import { DevolucionTecnicoDialogComponent } from './dialogs/devolucion-tecnico/devolucion-tecnico-dialog.component';
import { RetornoAreaDialogComponent } from './dialogs/retorno-area/retorno-area-dialog.component';

// ── Types ─────────────────────────────────────────────────────────────────────
type ActiveTab    = 'envio' | 'traspaso' | 'retorno' | 'activos' | 'traspaso-tecnico';
type TipoOrigen   = 'BASE' | 'TRASPASO';
type CondRetorno  = 'BUENO' | 'DAÑADO' | 'REQUIERE_CALIBRACION' | 'FALTANTE';

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Ubicacion {
    id: string;
    nombre: string;
    codigo: string;
    ciudad?: string;
}

interface ToolEnvioItem {
    toolId: number;
    codigo: string;
    nombre: string;
    pn: string;
    sn: string;
    marca: string;
    fechaVencCal: string;
    cantidad: number;
    condicion: string;
    notas: string;
    unidad?: string;
    listaContenido?: string;
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
    diasFuera?: number;
    selected: boolean;
    expanded: boolean;
    condicion: CondRetorno | '';
    observacionItem: string;
}

interface Funcionario {
    id: string;
    nombre: string;
    cargo: string;
}

interface MovimientoActivo {
    id_movement: number;
    movement_number: string;
    movement_type_label: string;
    transfer_type: string;        // TEMPORAL | PERMANENTE | REASIGNACION | PRESTAMO (solo TRASPASO)
    send_date: string;
    expected_return_date: string | null;
    days_remaining: number | null;
    alert_status: string;
    source_warehouse_id?: number;
    destination_warehouse_id?: number;
    source_warehouse_name: string;
    destination_warehouse_name: string;
    requested_by_name: string;
    received_by_name: string;
    department: string;
    authorized_by?: string;
    destination_department?: string;
    destination_unit?: string;
    document_number: string;
    notes: string;
    specific_observations?: string;
    items_count: number;
    expanded?: boolean;
    isCompleted?: boolean;
    return_movement_number?: string;
    return_id_movement?: number;
}

interface PersonaTecnico {
    id: string;
    nombre: string;
    cargo: string;
    licencia: string;
    area?: string;   // orga.tuo.nombre_unidad → auto-llena "Unidad" en el form
}

interface ResumenCondicion {
    buenos: number;
    danados: number;
    calibracion: number;
    faltantes: number;
    pendientes: number;
}

interface HistorialRecord {
    id: string;
    fecha: string;
    tipo: string;
    documento: string;
    responsable: string;
    estado: string;
    raw?: any;
}

// ─────────────────────────────────────────────────────────────────────────────

@Component({
    selector: 'app-retorno-traspaso',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatButtonModule, MatTableModule,
        MatPaginatorModule, MatDialogModule, MatSnackBarModule,
        MatProgressSpinnerModule, MatCheckboxModule, MatTooltipModule,
        HasPermissionDirective,
    ],
    templateUrl: './retorno-traspaso.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.85); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center; z-index: 9999;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.75); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        ::ng-deep .white-checkbox .mdc-checkbox__background { border-color: white !important; }
        ::ng-deep .white-checkbox.mat-mdc-checkbox-checked .mdc-checkbox__background { background-color: white !important; border-color: white !important; }
        ::ng-deep .white-checkbox .mdc-checkbox__checkmark { color: #0f172a !important; }
    `]
})
export class RetornoTraspasoComponent implements OnInit, OnDestroy {

    @ViewChild('historialDialog')           historialDialog!:           TemplateRef<any>;
    @ViewChild('envioFormDialog')           envioFormDialog!:           TemplateRef<any>;
    @ViewChild('traspasoFormDialog')        traspasoFormDialog!:        TemplateRef<any>;
    @ViewChild('retornoFormDialog')         retornoFormDialog!:         TemplateRef<any>;
    @ViewChild('traspasoTecnicoFormDialog')    traspasoTecnicoFormDialog!:    TemplateRef<any>;
    @ViewChild('devolucionTecnicoFormDialog')  devolucionTecnicoFormDialog!:  TemplateRef<any>;
    @ViewChild('retornoAreaFormDialog')        retornoAreaFormDialog!:        TemplateRef<any>;
    @ViewChild(MatPaginator) paginator!: MatPaginator;

    public dialogRef = inject(MatDialogRef<RetornoTraspasoComponent>, { optional: true });
    private dialog   = inject(MatDialog);
    private fb       = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private movSvc   = inject(MovementService);
    private toolSvc  = inject(ToolService);
    private _unsub$  = new Subject<void>();
    private _logoBoaDataUri: Promise<string> | null = null;
    private _envioDialogRef: any          = null;
    private _traspasoDialogRef: any       = null;
    private _retornoDialogRef: any        = null;
    private _tecnicoDialogRef: any        = null;
    private _devTecnicoDialogRef: any     = null;
    private _retornoAreaDialogRef: any    = null;

    // ── Tab navigation ────────────────────────────────────────────────────────
    activeTab: ActiveTab = 'activos';

    // ── Shared data ───────────────────────────────────────────────────────────
    bases: Ubicacion[]    = [];
    almacenes: Ubicacion[] = [];
    isLoading = false;

    // ── ENVÍO tab ─────────────────────────────────────────────────────────────
    envioForm!: FormGroup;
    itemsEnvio: ToolEnvioItem[]  = [];
    activeEnvioChip: number | null = null;
    toolSearchEnvio              = '';
    toolResultsEnvio: any[]      = [];
    showToolDropEnvio            = false;
    searchingToolsEnvio          = false;
    isSavingEnvio                = false;
    envCorrelativoPreview        = '';
    loadingCorrelativo           = false;
    private _srchEnvio$          = new Subject<string>();

    // ── TRASPASO tab ──────────────────────────────────────────────────────────
    traspasoForm!: FormGroup;
    itemsTraspaso: ToolEnvioItem[] = [];
    activeTraspasoChip: number | null = null;
    toolSearchTraspaso             = '';
    toolResultsTraspaso: any[]     = [];
    showToolDropTraspaso           = false;
    searchingToolsTraspaso         = false;
    isSavingTraspaso               = false;
    trpCorrelativoPreview          = '';
    loadingCorrelativoTrp          = false;
    private _srchTraspaso$         = new Subject<string>();

    // Buscadores de funcionario — Traspaso
    funcionariosTraspasoResp: Funcionario[]    = [];
    funcTraspasoRespLoading                    = false;
    showFuncTraspasoRespDropdown               = false;
    funcionariosTraspasoAut: Funcionario[]     = [];
    funcTraspasoAutLoading                     = false;
    showFuncTraspasoAutDropdown                = false;
    funcionariosTraspasoRecibe: Funcionario[]  = [];
    funcTraspasoRecibeLoading                  = false;
    showFuncTraspasoRecibeDropdown             = false;
    private _srchTraspasoResp$                 = new Subject<string>();
    private _srchTraspasoAut$                  = new Subject<string>();
    private _srchTraspasoRecibe$               = new Subject<string>();
    private _cancelTraspasoResp$               = new Subject<void>();
    private _cancelTraspasoAut$                = new Subject<void>();
    private _cancelTraspasoRecibe$             = new Subject<void>();

    // ── RETORNO tab ───────────────────────────────────────────────────────────
    retornoForm!: FormGroup;
    tipoOrigenActivo: TipoOrigen = 'BASE';
    movSeleccionadoParaRetorno: MovimientoActivo | null = null;
    allData: TraspasoItem[]      = [];
    dataSource: TraspasoItem[]   = [];
    isSearching                  = false;
    isSavingRetorno              = false;
    showConfirmModal             = false;
    funcionarios: Funcionario[]  = [];
    funcionariosLoading          = false;
    showFuncDropdown             = false;

    // ── ENVÍO funcionarios autocomplete ───────────────────────────────────────
    funcionariosEnvia: Funcionario[]  = [];
    funcEnviaLoading                  = false;
    showFuncEnviaDropdown             = false;
    funcionariosRecibe: Funcionario[] = [];
    funcRecibeLoading                 = false;
    showFuncRecibeDropdown            = false;

    // ── Dept/Location autocomplete ────────────────────────────────────────────
    deptUbicacionesEnvio:    Ubicacion[] = [];
    showDeptDropEnvio                    = false;
    deptUbicacionesTraspaso: Ubicacion[] = [];
    showDeptDropTraspaso                 = false;

    condiciones = [
        { value: 'BUENO' as CondRetorno,               label: 'Bueno',           bgColor: 'bg-green-500',  icon: 'check_circle',  description: 'Perfecto estado' },
        { value: 'DAÑADO' as CondRetorno,              label: 'Dañado',          bgColor: 'bg-red-500',    icon: 'report_problem', description: 'Requiere reparación' },
        { value: 'REQUIERE_CALIBRACION' as CondRetorno,label: 'Req. Calibración',bgColor: 'bg-yellow-500', icon: 'speed',          description: 'Necesita calibración' },
        { value: 'FALTANTE' as CondRetorno,            label: 'Faltante',        bgColor: 'bg-red-600',    icon: 'help_outline',   description: 'No se encuentra' }
    ];

    condicionesEnvio = [
        { value: 'excellent', label: 'Excelente' },
        { value: 'good',      label: 'Bueno' },
        { value: 'fair',      label: 'Regular' },
        { value: 'damaged',   label: 'Dañado' },
    ];

    // Historial dialog
    historialRecords: HistorialRecord[]     = [];
    selectedHistorialEntry: HistorialRecord | null = null;
    isLoadingHistorial = false;
    totalHistorial     = 0;
    pageSize           = 10;
    pageIndex          = 0;
    pageSizeOptions    = [5, 10, 25];
    historialCols      = ['fecha', 'tipo', 'documento', 'responsable', 'estado', 'acciones'];

    // ── ACTIVOS tab ───────────────────────────────────────────────────────────
    movActivos: MovimientoActivo[]      = [];
    movActivosFiltrados: MovimientoActivo[] = [];
    movCompletados: MovimientoActivo[]  = [];
    loadingActivos                      = false;
    loadingCompletados                  = false;
    filterActivos: 'TODOS' | 'ENVIO_BASE' | 'TRASPASO' | 'COMPLETADOS' = 'TODOS';
    activeTabView: 'activos' | 'envios' | 'traspasos' | 'tecnico' = 'activos';
    loadingPdfActivo: number | null     = null;

    // ── TRASPASO TÉCNICO tab ──────────────────────────────────────────────────
    traspasoTecnicoForm!: FormGroup;
    itemsTraspasoTecnico: ToolEnvioItem[] = [];
    activeTecnicoChip: number | null = null;
    toolSearchTecnico                     = '';
    toolResultsTecnico: any[]             = [];
    showToolDropTecnico                   = false;
    searchingToolsTecnico                 = false;
    isSavingTraspasoTecnico               = false;
    private _srchTecnico$                 = new Subject<string>();
    personasTecnico: PersonaTecnico[]     = [];
    personaTecnicoLoading                 = false;
    showPersonaTecnicoDropdown            = false;
    // Búsqueda para "Recepciona / Entrega desde almacén"
    funcEntregaTecnico: Funcionario[]     = [];
    funcEntregaTecnicoLoading             = false;
    showFuncEntregaTecnicoDropdown        = false;
    private _cancelEntregaTecnico$        = new Subject<void>();

    // ── DEVOLUCIÓN TÉCNICA (MGH-109 return) ──────────────────────────────────
    devolucionTecnicoForm!: FormGroup;
    devolucionTecnicoItems: TraspasoItem[]          = [];
    movTecnicoSeleccionado: MovimientoActivo | null = null;
    isSavingDevolucionTecnico                       = false;
    showDevolucionTecnicoConfirm                    = false;
    loadingDevolucionItems                          = false;
    searchTecnicoNombre                             = '';
    funcDevolucionRecibe: Funcionario[]             = [];
    funcDevolucionRecibeLoading                     = false;
    showFuncDevolucionRecibeDropdown                = false;
    private _cancelDevolucionRecibe$                = new Subject<void>();

    // ── RETORNO ÁREA (TRASPASO doble-panel) ──────────────────────────────────
    retornoAreaForm!: FormGroup;
    retornoAreaItems: TraspasoItem[]            = [];
    movAreaSeleccionado: MovimientoActivo | null = null;
    isSavingRetornoArea                          = false;
    showRetornoAreaConfirm                       = false;
    loadingRetornoAreaItems                      = false;
    searchAreaMovimiento                         = '';
    funcRetornoAreaRecibe: Funcionario[]         = [];
    funcRetornoAreaRecibeLoading                 = false;
    showFuncRetornoAreaRecibeDropdown            = false;
    private _cancelRetornoAreaRecibe$            = new Subject<void>();

    /** Tipos de traspaso usados en el form TRP */
    tiposTraspaso = [
        { value: 'TEMPORAL',     label: 'Temporal' },
        { value: 'PERMANENTE',   label: 'Permanente' },
        { value: 'REASIGNACION', label: 'Reasignación' },
        { value: 'PRESTAMO',     label: 'Préstamo Interno' },
    ];

    tiposTraspasoTecnico = [
        { value: 'TEMPORAL',     label: 'Temporal' },
        { value: 'PERMANENTE',   label: 'Permanente' },
        { value: 'REASIGNACION', label: 'Reasignación' },
        { value: 'PRESTAMO',     label: 'Préstamo Interno' },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    ngOnInit(): void {
        this._initEnvioForm();
        this._initTraspasoForm();
        this._initRetornoForm();
        this._initTraspasoTecnicoForm();
        this._initDevolucionTecnicoForm();
        this._initRetornoAreaForm();
        this._loadUbicaciones();
        this._setupToolSearchEnvio();
        this._setupToolSearchTraspaso();
        this._setupToolSearchTecnico();
        this._setupFuncSearch();
        this._setupFuncSearchEnvio();
        this._setupFuncSearchTraspaso();
        this._setupPersonaTecnicoSearch();
        this._setupFuncDevolucionSearch();
        this._setupFuncRetornoAreaSearch();
        this._precargarUsuario();
        this.loadMovActivos();
    }

    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    setActiveTab(tab: ActiveTab): void {
        this.activeTab = tab;
        if (tab === 'activos') this.loadMovActivos();
    }

    // ── Open / close form dialogs ─────────────────────────────────────────────

    abrirFormEnvio(): void {
        this._envioDialogRef = this.dialog.open(EnvioDialogComponent, {
            width: 'min(780px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases }
        });
        this._envioDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    private _fetchEnvCorrelativoPreview(): void {
        this.loadingCorrelativo = true;
        this.envCorrelativoPreview = '';
        this.movSvc.getSiguienteCorrelativoPreview('ENV')
            .pipe(takeUntil(this._unsub$), finalize(() => this.loadingCorrelativo = false))
            .subscribe({
                next: (nro) => {
                    this.envCorrelativoPreview = nro;
                    // Pre-llenar nroDocumento con el mismo número para que el CO-MAT
                    // físico coincida con el registro en el sistema
                    this.envioForm.patchValue({ nroDocumento: nro }, { emitEvent: false });
                }
            });
    }

    imprimirCoMat(): void {
        const form = this.envioForm.value;
        if (this.itemsEnvio.length === 0) {
            this._showMsg('Agregue al menos una herramienta para imprimir el CO-MAT', 'warning');
            return;
        }
        this._pdfCoMat(this.envCorrelativoPreview || 'ENV-?/?', this.itemsEnvio, form);
    }
    cerrarFormEnvio(): void { this._envioDialogRef?.close(); }

    abrirFormTraspaso(): void {
        const defaultAlmacen = this.almacenes.find(u => u.nombre.toLowerCase().includes('cochabamba')) ?? this.almacenes[0] ?? null;
        this._traspasoDialogRef = this.dialog.open(TraspasoDialogComponent, {
            width: 'min(860px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases, defaultAlmacen }
        });
        this._traspasoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }
    cerrarFormTraspaso(): void { this._traspasoDialogRef?.close(); }

    abrirFormRetorno(): void {
        this._retornoDialogRef = this.dialog.open(RetornoDialogComponent, {
            width: 'min(700px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases }
        });
        this._retornoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }
    cerrarFormRetorno(): void { this._retornoDialogRef?.close(); }

    // ── SHARED ────────────────────────────────────────────────────────────────

    private _loadUbicaciones(): void {
        this.isLoading = true;
        this.movSvc.getBases().pipe(takeUntil(this._unsub$)).subscribe({
            next: (data) => {
                this.bases = data.map((b: any) => ({
                    id: String(b.id ?? b.id_base), nombre: b.nombre ?? b.name ?? '',
                    codigo: b.codigo ?? b.code ?? '', ciudad: b.ciudad ?? b.city ?? ''
                }));
            }
        });
        this.movSvc.getWarehouses().pipe(
            takeUntil(this._unsub$), finalize(() => this.isLoading = false)
        ).subscribe({
            next: (data) => {
                this.almacenes = data.map((w: any) => ({
                    id: String(w.id ?? w.id_warehouse), nombre: w.nombre ?? w.name ?? '',
                    codigo: w.codigo ?? w.code ?? ''
                }));
                this._setDefaultAlmacenOrigen();
            }
        });
    }

    getAllUbicaciones(): Ubicacion[] { return [...this.bases, ...this.almacenes]; }

    private _showMsg(msg: string, type: string): void {
        this.snackBar.open(msg, 'OK', {
            duration: 3500, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }

    // ── ENVÍO tab ─────────────────────────────────────────────────────────────

    private _initEnvioForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const hora  = new Date().toTimeString().slice(0, 5);
        this.envioForm = this.fb.group({
            baseOrigen:          [null],
            baseDestino:         [null, Validators.required],
            fechaEnvio:          [today, Validators.required],
            horaEnvio:           [hora],
            responsableEnvia:    ['', Validators.required],
            recibeEnDestino:     [''],
            departamento:        [''],
            nroDocumento:        [''],
            tipoEnvio:           ['EVENTUAL'],
            fechaEsperadaRetorno:[''],
            nroVuelo:            [''],
            aeronave:            [''],
            notas:               ['']
        });
    }

    private _setupToolSearchEnvio(): void {
        this._srchEnvio$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                if (!term || term.trim().length < 2) {
                    this.toolResultsEnvio = []; this.showToolDropEnvio = false;
                    return of([]);
                }
                this.searchingToolsEnvio = true;
                return this.toolSvc.getTools({ query: term.trim() }).pipe(
                    finalize(() => this.searchingToolsEnvio = false)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (tools: any[]) => {
            this.toolResultsEnvio = tools.slice(0, 12);
            this.showToolDropEnvio = this.toolResultsEnvio.length > 0;
        }});
    }

    onToolSearchEnvio(term: string): void { this.toolSearchEnvio = term; this._srchEnvio$.next(term); }
    hideToolDropEnvio(): void { setTimeout(() => this.showToolDropEnvio = false, 150); }

    addToolEnvio(tool: any): void {
        const id = tool.id_tool ?? tool.id;
        if (this.itemsEnvio.some(i => i.toolId === id)) {
            this._showMsg('Herramienta ya en la lista', 'warning'); return;
        }
        this.itemsEnvio.push({
            toolId: id, codigo: tool.code ?? tool.codigo ?? '',
            nombre: tool.name ?? tool.description ?? '',
            pn: tool.part_number ?? '', sn: tool.serial_number ?? '',
            marca: tool.brand ?? tool.marca ?? '',
            fechaVencCal: tool.calibration_expiry_date ?? tool.next_calibration_date ?? '',
            cantidad: 1, condicion: 'good', notas: ''
        });
        this.toolSearchEnvio = ''; this.toolResultsEnvio = []; this.showToolDropEnvio = false;
    }

    removeToolEnvio(i: number): void { this.itemsEnvio.splice(i, 1); }

    canSaveEnvio(): boolean {
        if (!this.envioForm.valid || this.itemsEnvio.length === 0 || this.isSavingEnvio) return false;
        if (this.requiereFechaRetornoEnvio() && !this.envioForm.get('fechaEsperadaRetorno')?.value) return false;
        return true;
    }

    guardarEnvio(): void {
        if (!this.canSaveEnvio()) {
            this.envioForm.markAllAsTouched();
            if (this.itemsEnvio.length === 0) this._showMsg('Agregue al menos una herramienta', 'warning');
            else this._showMsg('Complete los campos requeridos', 'error');
            return;
        }
        const form = this.envioForm.value;
        const itemsJson = JSON.stringify(this.itemsEnvio.map(it => ({
            tool_id: it.toolId, quantity: it.cantidad,
            condition_on_movement: it.condicion,
            serial_number: it.sn || '', part_number: it.pn || '', notes: it.notas || ''
        })));

        this.isSavingEnvio = true;
        this.movSvc.registrarEnvioOtrasBases({
            date: form.fechaEnvio, time: (form.horaEnvio || '00:00') + ':00',
            source_warehouse_id:      form.baseOrigen?.id ? Number(form.baseOrigen.id) : undefined,
            destination_warehouse_id: form.baseDestino?.id ? Number(form.baseDestino.id) : undefined,
            requested_by_name:   form.responsableEnvia || '',
            received_by_name:    form.recibeEnDestino  || '',
            responsible_person:  form.responsableEnvia || '',
            department:          form.departamento     || '',
            document_number:     form.nroDocumento     || '',
            expected_return_date: this.requiereFechaRetornoEnvio() ? (form.fechaEsperadaRetorno || '') : '',
            notes:               form.notas            || '',
            specific_observations: [
                `Tipo envío: ${form.tipoEnvio === 'PERMANENTE' ? 'PERMANENTE' : 'EVENTUAL'}`,
                form.nroVuelo  ? `Vuelo: ${form.nroVuelo}`   : '',
                form.aeronave  ? `Aeronave: ${form.aeronave}` : ''
            ].filter(Boolean).join(' | '),
            items_json: itemsJson
        }).pipe(finalize(() => this.isSavingEnvio = false), takeUntil(this._unsub$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._showMsg(`Envío registrado: ${nro}`, 'success');
                this._pdfEnvio(nro, this.itemsEnvio, form, 'ENVÍO A BASE');
                this._resetEnvioTab();
                this._envioDialogRef?.close();
                this.loadMovActivos();
            },
            error: (err) => this._showMsg('Error al registrar envío: ' + (err?.message || ''), 'error')
        });
    }

    private _resetEnvioTab(): void {
        this.envioForm.reset({
            fechaEnvio: new Date().toISOString().split('T')[0],
            horaEnvio:  new Date().toTimeString().slice(0, 5),
            tipoEnvio:  'EVENTUAL'
        });
        this._setDefaultAlmacenOrigen();
        this.itemsEnvio = [];
        this.funcionariosEnvia  = []; this.showFuncEnviaDropdown  = false;
        this.funcionariosRecibe = []; this.showFuncRecibeDropdown = false;
    }

    // ── TRASPASO tab ──────────────────────────────────────────────────────────

    private _initTraspasoForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const hora  = new Date().toTimeString().slice(0, 5);
        this.traspasoForm = this.fb.group({
            baseOrigen:           [null],
            areaDepartamento:     ['', Validators.required],
            fechaTraspaso:        [today, Validators.required],
            horaTraspaso:         [hora],
            responsableTraspaso:  ['', Validators.required],
            autorizadoPor:        ['', Validators.required],
            recibeEnDestino:      ['', Validators.required],
            tipoTraspaso:         ['TEMPORAL', Validators.required],
            fechaRetornoEsperada: [''],
            nroDocumento:         [''],
            notas:                ['']
        });
    }

    /** Tipo de envío a base (PERMANENTE requiere fecha retorno, EVENTUAL no) */
    requiereFechaRetornoEnvio(): boolean {
        return this.envioForm.get('tipoEnvio')?.value === 'PERMANENTE';
    }

    /** Indica si el tipo de traspaso del form TRP requiere fecha de retorno */
    requiereFechaRetornoTrp(): boolean {
        const tipo = this.traspasoForm.get('tipoTraspaso')?.value;
        return tipo === 'TEMPORAL' || tipo === 'PRESTAMO';
    }

    private _setupToolSearchTraspaso(): void {
        this._srchTraspaso$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                if (!term || term.trim().length < 2) {
                    this.toolResultsTraspaso = []; this.showToolDropTraspaso = false;
                    return of([]);
                }
                this.searchingToolsTraspaso = true;
                return this.toolSvc.getTools({ query: term.trim() }).pipe(
                    finalize(() => this.searchingToolsTraspaso = false)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (tools: any[]) => {
            this.toolResultsTraspaso = tools.slice(0, 12);
            this.showToolDropTraspaso = this.toolResultsTraspaso.length > 0;
        }});
    }

    onToolSearchTraspaso(term: string): void { this.toolSearchTraspaso = term; this._srchTraspaso$.next(term); }
    hideToolDropTraspaso(): void { setTimeout(() => this.showToolDropTraspaso = false, 150); }

    addToolTraspaso(tool: any): void {
        const id = tool.id_tool ?? tool.id;
        if (this.itemsTraspaso.some(i => i.toolId === id)) {
            this._showMsg('Herramienta ya en la lista', 'warning'); return;
        }
        this.itemsTraspaso.push({
            toolId: id, codigo: tool.code ?? tool.codigo ?? '',
            nombre: tool.name ?? tool.description ?? '',
            pn: tool.part_number ?? '', sn: tool.serial_number ?? '',
            marca: tool.brand ?? tool.marca ?? '',
            fechaVencCal: tool.calibration_expiry_date ?? tool.next_calibration_date ?? '',
            cantidad: 1, condicion: 'good', notas: ''
        });
        this.toolSearchTraspaso = ''; this.toolResultsTraspaso = []; this.showToolDropTraspaso = false;
    }

    removeToolTraspaso(i: number): void { this.itemsTraspaso.splice(i, 1); }

    canSaveTraspaso(): boolean {
        return this.traspasoForm.valid && this.itemsTraspaso.length > 0 && !this.isSavingTraspaso;
    }

    guardarTraspaso(): void {
        if (!this.canSaveTraspaso()) {
            this.traspasoForm.markAllAsTouched();
            if (this.itemsTraspaso.length === 0) this._showMsg('Agregue al menos una herramienta', 'warning');
            else this._showMsg('Complete los campos requeridos', 'error');
            return;
        }
        const form = this.traspasoForm.value;
        const itemsJson = JSON.stringify(this.itemsTraspaso.map(it => ({
            tool_id: it.toolId, quantity: it.cantidad,
            condition_on_movement: it.condicion,
            serial_number: it.sn || '', part_number: it.pn || '', notes: it.notas || ''
        })));

        this.isSavingTraspaso = true;
        const traspasoPayload: any = {
            date: form.fechaTraspaso, time: (form.horaTraspaso || '00:00') + ':00',
            source_warehouse_id: form.baseOrigen?.id ? Number(form.baseOrigen.id) : undefined,
            requested_by_name:   form.responsableTraspaso || '',
            responsible_person:  form.responsableTraspaso || '',
            received_by_name:    form.recibeEnDestino     || '',
            department:          form.areaDepartamento    || '',
            document_number:     form.nroDocumento        || '',
            exit_reason:         'area_transfer',
            authorized_by:       form.autorizadoPor       || '',
            transfer_type:       form.tipoTraspaso        || 'TEMPORAL',
            notes:               form.notas               || '',
            general_observations: [
                form.baseOrigen?.nombre  ? `Origen: ${form.baseOrigen.nombre}`    : '',
                form.recibeEnDestino     ? `Recibe: ${form.recibeEnDestino}`      : '',
                form.autorizadoPor       ? `Autorizado: ${form.autorizadoPor}`   : '',
                form.notas               ? `Notas: ${form.notas}`                : ''
            ].filter(Boolean).join(' | '),
            items_json: itemsJson
        };
        if (form.fechaRetornoEsperada && this.requiereFechaRetornoTrp()) {
            traspasoPayload.expected_return_date = form.fechaRetornoEsperada;
        }
        this.movSvc.registrarTraspasoOtraArea(traspasoPayload).pipe(finalize(() => this.isSavingTraspaso = false), takeUntil(this._unsub$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._showMsg(`Traspaso registrado: ${nro}`, 'success');
                this._pdfEnvio(nro, this.itemsTraspaso, { ...form, baseDestino: { nombre: form.areaDepartamento } }, 'TRASPASO DEFINITIVO');
                this._resetTraspasoTab();
                this._traspasoDialogRef?.close();
                this.loadMovActivos();
            },
            error: (err) => this._showMsg('Error al registrar traspaso: ' + (err?.message || ''), 'error')
        });
    }

    private _resetTraspasoTab(): void {
        this.traspasoForm.reset({
            fechaTraspaso: new Date().toISOString().split('T')[0],
            horaTraspaso:  new Date().toTimeString().slice(0, 5)
        });
        this._setDefaultAlmacenOrigen();
        this.itemsTraspaso = [];
        this.funcionariosTraspasoResp   = []; this.showFuncTraspasoRespDropdown   = false;
        this.funcionariosTraspasoAut    = []; this.showFuncTraspasoAutDropdown    = false;
        this.funcionariosTraspasoRecibe = []; this.showFuncTraspasoRecibeDropdown = false;
    }

    // ── RETORNO tab ───────────────────────────────────────────────────────────

    private _initRetornoForm(): void {
        const today = new Date().toISOString().split('T')[0];
        this.retornoForm = this.fb.group({
            tipoOrigen:        ['BASE', Validators.required],
            ubicacionOrigen:   [null, Validators.required],
            searchText:        [''],
            nroDocumento:      ['', Validators.required],
            fechaRetorno:      [today, Validators.required],
            transportista:     [''],
            responsableRecibe: ['', Validators.required],
            observaciones:     ['']
        });

        this.retornoForm.get('searchText')?.valueChanges.pipe(
            takeUntil(this._unsub$), debounceTime(300)
        ).subscribe(() => this._filterRetornoData());
    }

    private _precargarUsuario(): void {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            const nombre = auth.nombre_usuario || '';
            if (nombre) this.retornoForm.patchValue({ responsableRecibe: nombre });
        } catch { /* noop */ }
    }

    private _setupFuncSearch(): void {
        this.retornoForm.get('responsableRecibe')?.valueChanges.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(term => {
                const t = (term || '').trim();
                if (t.length < 2) {
                    this.funcionarios = []; this.showFuncDropdown = false; return of([]);
                }
                this.funcionariosLoading = true;
                const q = t.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({ ...f, nombre: f.nombreCompleto || f.nombre }))
                    ),
                    finalize(() => this.funcionariosLoading = false)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (data: any[]) => {
                this.funcionarios = data; this.funcionariosLoading = false;
                this.showFuncDropdown = data.length > 0;
            },
            error: () => this.funcionariosLoading = false
        });
    }

    selectFuncionario(func: Funcionario): void {
        this.retornoForm.patchValue({ responsableRecibe: func.nombre }, { emitEvent: false });
        this.funcionarios = []; this.showFuncDropdown = false;
    }

    hideFuncDropdown(): void { setTimeout(() => this.showFuncDropdown = false, 150); }

    // ── ENVÍO — autocomplete funcionarios (responsableEnvia + recibeEnDestino) ──

    private _setupFuncSearchEnvio(): void {
        // Responsable envía
        this.envioForm.get('responsableEnvia')?.valueChanges.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(term => {
                const t = (term || '').trim();
                if (t.length < 2) {
                    this.funcionariosEnvia = []; this.showFuncEnviaDropdown = false; return of([]);
                }
                this.funcEnviaLoading = true;
                const q = t.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({ ...f, nombre: f.nombreCompleto || f.nombre }))
                    ),
                    finalize(() => this.funcEnviaLoading = false)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (data: any[]) => {
                this.funcionariosEnvia = data; this.funcEnviaLoading = false;
                this.showFuncEnviaDropdown = data.length > 0;
            },
            error: () => this.funcEnviaLoading = false
        });

        // Recibe en destino
        this.envioForm.get('recibeEnDestino')?.valueChanges.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(term => {
                const t = (term || '').trim();
                if (t.length < 2) {
                    this.funcionariosRecibe = []; this.showFuncRecibeDropdown = false; return of([]);
                }
                this.funcRecibeLoading = true;
                const q = t.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({ ...f, nombre: f.nombreCompleto || f.nombre }))
                    ),
                    finalize(() => this.funcRecibeLoading = false)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (data: any[]) => {
                this.funcionariosRecibe = data; this.funcRecibeLoading = false;
                this.showFuncRecibeDropdown = data.length > 0;
            },
            error: () => this.funcRecibeLoading = false
        });
    }

    selectFuncionarioEnvia(func: Funcionario): void {
        this.envioForm.patchValue({ responsableEnvia: func.nombre }, { emitEvent: false });
        this.funcionariosEnvia = []; this.showFuncEnviaDropdown = false;
    }

    selectFuncionarioRecibe(func: Funcionario): void {
        this.envioForm.patchValue({ recibeEnDestino: func.nombre }, { emitEvent: false });
        this.funcionariosRecibe = []; this.showFuncRecibeDropdown = false;
    }

    hideFuncEnviaDropdown(): void  { setTimeout(() => this.showFuncEnviaDropdown  = false, 150); }
    hideFuncRecibeDropdown(): void { setTimeout(() => this.showFuncRecibeDropdown = false, 150); }

    // ── Almacén Cochabamba predeterminado ──────────────────────────────────────

    private _setDefaultAlmacenOrigen(): void {
        // Solo buscar en almacenes — source_warehouse_id FK referencia he.twarehouses,
        // no he.tbases. Enviar un ID de base causa violación de FK.
        const cbba = this.almacenes.find(u =>
            u.nombre.toLowerCase().includes('cochabamba')
        ) ?? this.almacenes[0] ?? null;
        if (cbba) {
            this.envioForm.patchValue({ baseOrigen: cbba }, { emitEvent: false });
            this.traspasoForm?.patchValue({ baseOrigen: cbba }, { emitEvent: false });
            // MGH-109: almacenOrigen = almacén que entrega (mismo origen)
            this.traspasoTecnicoForm?.patchValue({ almacenOrigen: cbba }, { emitEvent: false });
        }
        // MGH-109: base destino — preferir VVI/Cochabamba del catálogo real de he.tbases
        const defaultBase = this.bases.find(b =>
            (b.codigo || '').toUpperCase() === 'VVI' ||
            (b.nombre  || '').toLowerCase().includes('cochabamba')
        ) ?? this.bases[0] ?? null;
        if (defaultBase) {
            this.traspasoTecnicoForm?.patchValue({ base: defaultBase }, { emitEvent: false });
        }
    }

    // ── Dept autocomplete — Envío ─────────────────────────────────────────────

    onDeptChangeEnvio(term: string): void {
        const q = (term || '').toLowerCase().trim();
        if (!q) { this.deptUbicacionesEnvio = []; this.showDeptDropEnvio = false; return; }
        this.deptUbicacionesEnvio = this.getAllUbicaciones()
            .filter(u => u.nombre.toLowerCase().includes(q))
            .slice(0, 10);
        this.showDeptDropEnvio = this.deptUbicacionesEnvio.length > 0;
    }

    selectDeptEnvio(nombre: string): void {
        this.envioForm.patchValue({ departamento: nombre });
        this.deptUbicacionesEnvio = []; this.showDeptDropEnvio = false;
    }

    hideDeptDropEnvio(): void { setTimeout(() => this.showDeptDropEnvio = false, 150); }

    // ── Dept autocomplete — Traspaso ──────────────────────────────────────────

    onDeptChangeTraspaso(term: string): void {
        const q = (term || '').toLowerCase().trim();
        if (!q) { this.deptUbicacionesTraspaso = []; this.showDeptDropTraspaso = false; return; }
        this.deptUbicacionesTraspaso = this.getAllUbicaciones()
            .filter(u => u.nombre.toLowerCase().includes(q))
            .slice(0, 10);
        this.showDeptDropTraspaso = this.deptUbicacionesTraspaso.length > 0;
    }

    selectDeptTraspaso(nombre: string): void {
        this.traspasoForm.patchValue({ areaDepartamento: nombre });
        this.deptUbicacionesTraspaso = []; this.showDeptDropTraspaso = false;
    }

    hideDeptDropTraspaso(): void { setTimeout(() => this.showDeptDropTraspaso = false, 150); }

    // ── Funcionario autocomplete — Traspaso Responsable + Autorizado ──────────

    private _setupFuncSearchTraspaso(): void {
        // Responsable / Envía
        this._srchTraspasoResp$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.trim().length < 2) { this.funcionariosTraspasoResp = []; this.showFuncTraspasoRespDropdown = false; return of([]); }
                this.funcTraspasoRespLoading = true;
                const q = t.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({ ...f, nombre: f.nombreCompleto || f.nombre }))
                    ),
                    finalize(() => this.funcTraspasoRespLoading = false),
                    takeUntil(this._cancelTraspasoResp$)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe(data => {
            this.funcionariosTraspasoResp = data as Funcionario[];
            this.showFuncTraspasoRespDropdown = (data as any[]).length > 0;
        });

        // Autorizado
        this._srchTraspasoAut$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.trim().length < 2) { this.funcionariosTraspasoAut = []; this.showFuncTraspasoAutDropdown = false; return of([]); }
                this.funcTraspasoAutLoading = true;
                const q = t.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({ ...f, nombre: f.nombreCompleto || f.nombre }))
                    ),
                    finalize(() => this.funcTraspasoAutLoading = false),
                    takeUntil(this._cancelTraspasoAut$)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe(data => {
            this.funcionariosTraspasoAut = data as Funcionario[];
            this.showFuncTraspasoAutDropdown = (data as any[]).length > 0;
        });

        // Recibe en Destino
        this._srchTraspasoRecibe$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.trim().length < 2) { this.funcionariosTraspasoRecibe = []; this.showFuncTraspasoRecibeDropdown = false; return of([]); }
                this.funcTraspasoRecibeLoading = true;
                const q = t.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({ ...f, nombre: f.nombreCompleto || f.nombre }))
                    ),
                    finalize(() => this.funcTraspasoRecibeLoading = false),
                    takeUntil(this._cancelTraspasoRecibe$)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe(data => {
            this.funcionariosTraspasoRecibe = data as Funcionario[];
            this.showFuncTraspasoRecibeDropdown = (data as any[]).length > 0;
        });
    }

    onResponsableTraspasoInput(v: string): void {
        this.traspasoForm.patchValue({ responsableTraspaso: v }, { emitEvent: false });
        if (v.trim().length >= 2) this._srchTraspasoResp$.next(v);
        else this.showFuncTraspasoRespDropdown = false;
    }

    selectFuncionarioTraspasoResp(func: Funcionario): void {
        this._cancelTraspasoResp$.next();
        this.traspasoForm.patchValue({ responsableTraspaso: func.nombre });
        this.funcionariosTraspasoResp = []; this.showFuncTraspasoRespDropdown = false;
    }

    hideFuncTraspasoRespDropdown(): void { setTimeout(() => this.showFuncTraspasoRespDropdown = false, 150); }

    onAutorizadoTraspasoInput(v: string): void {
        this.traspasoForm.patchValue({ autorizadoPor: v }, { emitEvent: false });
        if (v.trim().length >= 2) this._srchTraspasoAut$.next(v);
        else this.showFuncTraspasoAutDropdown = false;
    }

    selectFuncionarioTraspasoAut(func: Funcionario): void {
        this._cancelTraspasoAut$.next();
        this.traspasoForm.patchValue({ autorizadoPor: func.nombre });
        this.funcionariosTraspasoAut = []; this.showFuncTraspasoAutDropdown = false;
    }

    hideFuncTraspasoAutDropdown(): void { setTimeout(() => this.showFuncTraspasoAutDropdown = false, 150); }

    onRecibeTraspasoInput(v: string): void {
        this.traspasoForm.patchValue({ recibeEnDestino: v }, { emitEvent: false });
        if (v.trim().length >= 2) this._srchTraspasoRecibe$.next(v);
        else this.showFuncTraspasoRecibeDropdown = false;
    }

    selectFuncionarioTraspasoRecibe(func: Funcionario): void {
        this._cancelTraspasoRecibe$.next();
        this.traspasoForm.patchValue({ recibeEnDestino: func.nombre });
        this.funcionariosTraspasoRecibe = []; this.showFuncTraspasoRecibeDropdown = false;
    }

    hideFuncTraspasoRecibeDropdown(): void { setTimeout(() => this.showFuncTraspasoRecibeDropdown = false, 150); }

    getUbicacionesFiltradas(): Ubicacion[] {
        return this.tipoOrigenActivo === 'BASE' ? this.bases : this.almacenes;
    }

    getTipoOrigenLabel(): string { return this.tipoOrigenActivo === 'BASE' ? 'Base Operativa' : 'Almacén'; }
    getDocumentoLabel(): string  { return this.tipoOrigenActivo === 'BASE' ? 'Nro. COMAT' : 'Nro. Traspaso'; }

    onTipoOrigenChange(tipo: TipoOrigen): void {
        this.tipoOrigenActivo = tipo;
        this.retornoForm.patchValue({ tipoOrigen: tipo, ubicacionOrigen: null });
        this.allData = []; this.dataSource = [];
    }

    consultarRetorno(): void {
        const ubicacionOrigen = this.retornoForm.get('ubicacionOrigen')?.value;
        if (!ubicacionOrigen?.id) { this._showMsg('Seleccione una ubicación de origen', 'warning'); return; }

        this.isSearching = true;
        const exitReason  = this.tipoOrigenActivo === 'BASE' ? 'base_send' : 'area_transfer';
        const typeValues  = this.tipoOrigenActivo === 'BASE'
            ? `mos.type IN ('exit','ENVIO_BASE')`
            : `mos.type IN ('exit','TRASPASO')`;
        const destId      = Number(ubicacionOrigen.id);
        const filtroAdicional = `${typeValues} AND mos.exit_reason = '${exitReason}' AND mos.destination_warehouse_id = ${destId} AND mos.status IN ('approved','completed')`;

        this.movSvc.getMovements({ filtro_adicional: filtroAdicional, limit: 200 }).pipe(
            takeUntil(this._unsub$), finalize(() => this.isSearching = false)
        ).subscribe({
            next: (data: any[]) => {
                const filtered = (data || []).filter((m: any) =>
                    ['exit','ENVIO_BASE','TRASPASO'].includes(m.type) && m.exit_reason === exitReason
                );
                if (filtered.length === 0) {
                    this.allData = []; this.dataSource = [];
                    this._showMsg(`Sin movimientos activos para ${ubicacionOrigen.nombre}`, 'warning');
                    return;
                }
                forkJoin(
                    filtered.map((mov: any) => this.movSvc.getMovementItems(Number(mov.id_movement)).pipe(
                        map((items: any[]) => ({ mov, items }))
                    ))
                ).pipe(takeUntil(this._unsub$)).subscribe({
                    next: (results: any[]) => {
                        const expanded: TraspasoItem[] = [];
                        results.forEach(({ mov, items }) => {
                            if (items?.length) {
                                items.forEach((item: any) => {
                                    expanded.push(this._mapToTraspasoItem(mov, item, expanded.length));
                                });
                            }
                        });
                        this.allData = expanded; this.dataSource = [...this.allData];
                        if (this.allData.length === 0) this._showMsg(`Sin herramientas en ${ubicacionOrigen.nombre}`, 'warning');
                        else this._showMsg(`Cargadas: ${this.dataSource.length} herramienta(s)`, 'success');
                    }
                });
            },
            error: (err) => { this.dataSource = []; this._showMsg('Error al buscar: ' + (err?.message || ''), 'error'); }
        });
    }

    private _mapToTraspasoItem(movement: any, item: any, index: number): TraspasoItem {
        return {
            id: movement.id_movement || `temp-${index}`, filaObs: index + 1,
            toolId: String(item?.tool_id || item?.toolId || item?.tool?.id || ''),
            codigo: item?.tool?.code || item?.code || item?.codigo || '',
            descripcion: item?.tool?.description || item?.description || item?.descripcion || '',
            pn: item?.tool?.part_number || item?.part_number || '',
            sn: item?.tool?.serial_number || item?.serial_number || '',
            marca: item?.tool?.brand || item?.brand || '',
            cantidadEnviada: Number(item?.quantity) || 1, cantidadRetorna: Number(item?.quantity) || 1,
            fechaEnvio: movement.date || '',
            nroNotaSalida: movement.movement_number || '',
            ubicacionOrigen: this.getAllUbicaciones().find(u => String(u.id) === String(movement.destination_warehouse_id))?.nombre
                || movement.destinationWarehouse?.name || '',
            diasFuera: movement.date ? this._calcDiasFuera(movement.date) : 0,
            selected: false, expanded: false, condicion: '', observacionItem: ''
        };
    }

    private _filterRetornoData(): void {
        const s = (this.retornoForm.get('searchText')?.value || '').toLowerCase().trim();
        this.dataSource = this.allData.filter(item =>
            !s || item.descripcion.toLowerCase().includes(s) || item.pn.toLowerCase().includes(s) ||
            item.sn.toLowerCase().includes(s) || item.codigo.toLowerCase().includes(s) ||
            item.nroNotaSalida.toLowerCase().includes(s)
        );
    }

    private _calcDiasFuera(fechaEnvio: string): number {
        const d = new Date(fechaEnvio);
        return Math.ceil(Math.abs(Date.now() - d.getTime()) / 86400000);
    }

    // Row/selection helpers
    toggleSelection(item: TraspasoItem): void {
        item.selected = !item.selected;
        if (item.selected && !item.expanded) item.expanded = true;
    }
    toggleAllSelection(event: any): void {
        this.dataSource.forEach(i => { i.selected = event.checked; if (event.checked) i.expanded = true; });
    }
    isAllSelected(): boolean { return this.dataSource.length > 0 && this.dataSource.every(i => i.selected); }
    isSomeSelected(): boolean { return this.dataSource.some(i => i.selected) && !this.isAllSelected(); }
    getSelected(): TraspasoItem[] { return this.dataSource.filter(i => i.selected); }
    getSelectedCount(): number { return this.getSelected().length; }
    toggleExpand(item: TraspasoItem): void { item.expanded = !item.expanded; }

    onCondicionChange(item: TraspasoItem, cond: CondRetorno): void {
        item.condicion = cond;
        if (cond === 'FALTANTE') item.cantidadRetorna = 0;
        else if (item.cantidadRetorna === 0) item.cantidadRetorna = item.cantidadEnviada;
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
        const e: string[] = [];
        if (!item.selected) return e;
        if (!item.condicion) e.push('Falta Condición');
        if (item.condicion !== 'FALTANTE' && item.cantidadRetorna <= 0) e.push('Cantidad inválida');
        if (item.condicion !== 'FALTANTE' && item.cantidadRetorna > item.cantidadEnviada) e.push('Excede enviado');
        if ((item.condicion === 'DAÑADO' || item.condicion === 'FALTANTE') && !item.observacionItem.trim()) e.push('Falta Observación');
        return e;
    }

    canProceedRetorno(): boolean {
        const sel = this.getSelected();
        return sel.length > 0 && this.retornoForm.valid && sel.every(i => this.isItemValid(i));
    }

    getResumenCondicion(): ResumenCondicion {
        const sel = this.getSelected();
        return {
            buenos:     sel.filter(i => i.condicion === 'BUENO').length,
            danados:    sel.filter(i => i.condicion === 'DAÑADO').length,
            calibracion:sel.filter(i => i.condicion === 'REQUIERE_CALIBRACION').length,
            faltantes:  sel.filter(i => i.condicion === 'FALTANTE').length,
            pendientes: sel.filter(i => !i.condicion).length
        };
    }

    getTotalEnviado(): number  { return this.getSelected().reduce((s, i) => s + i.cantidadEnviada, 0); }
    getTotalRetornado(): number { return this.getSelected().reduce((s, i) => s + i.cantidadRetorna, 0); }

    getCondicionCfg(cond: CondRetorno | '') { return this.condiciones.find(c => c.value === cond); }

    getRowClass(item: TraspasoItem): string {
        if (!item.selected) return '';
        const map: Record<string, string> = {
            'BUENO':                'bg-green-50 dark:bg-green-900/10 border-green-400',
            'DAÑADO':               'bg-red-50 dark:bg-red-900/10 border-red-400',
            'REQUIERE_CALIBRACION': 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-400',
            'FALTANTE':             'bg-red-100 dark:bg-red-900/20 border-red-500',
        };
        return map[item.condicion] || 'border-black';
    }

    getDiasFueraClass(dias: number | undefined): string {
        if (!dias) return 'bg-gray-100 text-gray-600 border-gray-300';
        if (dias <= 7)  return 'bg-green-100 text-green-800 border-green-400';
        if (dias <= 15) return 'bg-yellow-100 text-yellow-800 border-yellow-400';
        if (dias <= 30) return 'bg-orange-100 text-orange-800 border-orange-400';
        return 'bg-red-100 text-red-800 border-red-400';
    }

    openConfirmModal(): void {
        if (!this.canProceedRetorno()) {
            if (this.getSelectedCount() === 0) { this._showMsg('Seleccione herramientas', 'warning'); return; }
            this.retornoForm.markAllAsTouched();
            if (this.retornoForm.invalid) { this._showMsg('Complete datos de recepción', 'error'); return; }
            const inv = this.getSelected().filter(i => !this.isItemValid(i));
            if (inv.length) { this._showMsg(`${inv.length} ítem(s) con errores`, 'error'); inv.forEach(i => i.expanded = true); return; }
        }
        this.showConfirmModal = true;
    }

    closeConfirmModal(): void { this.showConfirmModal = false; }

    finalizarRetorno(): void {
        if (!this.canProceedRetorno()) return;
        this.closeConfirmModal();
        const selItems = this.getSelected();
        const formVal  = this.retornoForm.value;

        if (selItems.some(i => !i.toolId)) {
            this._showMsg(`Herramienta(s) sin ID de sistema`, 'error'); return;
        }

        this.isSavingRetorno = true;
        const itemsJson = JSON.stringify(selItems.map(item => ({
            tool_id: Number(item.toolId), quantity: item.cantidadRetorna,
            condicion: item.condicion || 'BUENO',
            notes: item.observacionItem || '', serial_number: item.sn || '', part_number: item.pn || ''
        })));

        this.movSvc.registrarRetornoBase({
            type: this.tipoOrigenActivo === 'BASE' ? 'RETORNO_BASE' : 'RETORNO_TRASPASO',
            date: formVal.fechaRetorno, time: new Date().toTimeString().slice(0, 8),
            requested_by_name:  formVal.responsableRecibe || '',
            responsible_person: formVal.responsableRecibe || '',
            document_number:    formVal.nroDocumento,
            destination_warehouse_id: formVal.ubicacionOrigen?.id,
            source_warehouse_id: this.tipoOrigenActivo === 'TRASPASO' ? formVal.ubicacionOrigen?.id : undefined,
            notes: formVal.observaciones || '',
            specific_observations: [
                formVal.transportista ? `Transportista: ${formVal.transportista}` : '',
                this.movSeleccionadoParaRetorno ? `Retorno de envío ${this.movSeleccionadoParaRetorno.movement_number}` : ''
            ].filter(Boolean).join(' | '),
            items_json: itemsJson
        }).pipe(finalize(() => this.isSavingRetorno = false), takeUntil(this._unsub$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._showMsg(`Retorno registrado: ${nro}`, 'success');
                const ids = new Set(selItems.map(i => i.id));
                this.allData    = this.allData.filter(i => !ids.has(i.id));
                this.dataSource = this.dataSource.filter(i => !ids.has(i.id));
                this._pdfRetorno(nro, selItems, formVal);
                // Si hay items DAÑADOS o FALTANTES → genera Reporte de Discrepancia (lógica del sistema Excel)
                const itemsConNovedad = selItems.filter(it => it.condicion === 'DAÑADO' || it.condicion === 'FALTANTE');
                if (itemsConNovedad.length > 0) {
                    setTimeout(() => this._pdfDiscrepancia(nro, itemsConNovedad, formVal), 900);
                }
                if (this.dataSource.length === 0) {
                    this._retornoDialogRef?.close();
                    const movOrigen = this.movSeleccionadoParaRetorno;
                    this.movSeleccionadoParaRetorno = null;
                    if (movOrigen?.id_movement) {
                        this.movSvc.cerrarMovimiento(movOrigen.id_movement)
                            .pipe(takeUntil(this._unsub$))
                            .subscribe({ next: () => { this.loadMovActivos(); }, error: () => this.loadMovActivos() });
                    } else {
                        this.loadMovActivos();
                    }
                } else {
                    this.loadMovActivos();
                }
            },
            error: (err) => this._showMsg('Error al registrar: ' + (err?.message || ''), 'error')
        });
    }

    hasError(field: string, error: string): boolean {
        const c = this.retornoForm.get(field);
        return c ? c.hasError(error) && c.touched : false;
    }

    // ── ACTIVOS tab ───────────────────────────────────────────────────────────

    loadMovActivos(): void {
        this.loadingActivos    = true;
        this.loadingCompletados = true;
        forkJoin({
            activos:     this.movSvc.listarEnviosActivos({ limit: 200 }),
            completados: this.movSvc.listarMovimientosCompletados({ limit: 200 })
        }).pipe(
            takeUntil(this._unsub$),
            finalize(() => { this.loadingActivos = false; this.loadingCompletados = false; })
        ).subscribe({
            next: ({ activos, completados }) => {
                this.movActivos = (activos || []).map((m: any) => {
                    const isMgh109 = !!(m.specific_observations?.includes('MGH109'));
                    const rawType  = m.movement_type_label || m.type || '';
                    return {
                        id_movement:                Number(m.id_movement),
                        movement_number:            m.movement_number  || '',
                        movement_type_label:        isMgh109 ? 'MGH_109' : rawType,
                        transfer_type:              m.transfer_type    || '',
                        send_date:                  m.send_date  || m.date  || '',
                        expected_return_date:       m.expected_return_date || null,
                        days_remaining:             m.days_remaining != null ? Number(m.days_remaining) : null,
                        alert_status:               m.alert_status || 'SIN_FECHA',
                        source_warehouse_id:        m.source_warehouse_id,
                        destination_warehouse_id:   m.destination_warehouse_id,
                        source_warehouse_name:      m.source_warehouse_name      || '',
                        destination_warehouse_name: m.destination_warehouse_name || '',
                        requested_by_name:          m.requested_by_name  || m.responsible_person || '',
                        received_by_name:           m.received_by_name   || '',
                        department:                 m.department         || '',
                        authorized_by:              m.authorized_by      || '',
                        destination_department:     m.destination_department || '',
                        destination_unit:           m.destination_unit       || '',
                        document_number:            m.document_number    || '',
                        notes:                      m.notes              || '',
                        specific_observations:      m.specific_observations      || '',
                        items_count:                Number(m.items_count) || 0,
                        expanded:                   false,
                        isCompleted:                m.status === 'returned',
                        return_movement_number:     m.return_movement_number || '',
                        return_id_movement:         Number(m.return_id_movement) || 0,
                    };
                });
                this.movCompletados = (completados || []).map((m: any) => {
                    const isMgh109 = !!(m.specific_observations?.includes('MGH109'));
                    const rawType  = m.movement_type_label || m.type || '';
                    return {
                        id_movement:                Number(m.id_movement),
                        movement_number:            m.movement_number  || '',
                        movement_type_label:        isMgh109 ? 'MGH_109' : rawType,
                        transfer_type:              m.transfer_type    || '',
                        send_date:                  m.send_date  || m.date  || '',
                        expected_return_date:       m.expected_return_date || null,
                        days_remaining:             null,
                        alert_status:               'DEVUELTO',
                        source_warehouse_id:        m.source_warehouse_id,
                        destination_warehouse_id:   m.destination_warehouse_id,
                        source_warehouse_name:      m.source_warehouse_name      || '',
                        destination_warehouse_name: m.destination_warehouse_name || '',
                        requested_by_name:          m.requested_by_name  || m.responsible_person || '',
                        received_by_name:           m.received_by_name   || '',
                        department:                 m.department         || '',
                        authorized_by:              m.authorized_by      || '',
                        destination_department:     m.destination_department || '',
                        destination_unit:           m.destination_unit       || '',
                        document_number:            m.document_number    || '',
                        notes:                      m.notes              || '',
                        specific_observations:      m.specific_observations || '',
                        items_count:                Number(m.items_count) || 0,
                        expanded:                   false,
                        isCompleted:                true,
                        return_movement_number:     m.return_movement_number || '',
                        return_id_movement:         Number(m.return_id_movement) || 0,
                    };
                });
                this._applyFilterActivos();
            },
            error: () => this._showMsg('Error al cargar movimientos', 'error')
        });
    }

    setFilterActivos(f: 'TODOS' | 'ENVIO_BASE' | 'TRASPASO' | 'COMPLETADOS'): void {
        this.filterActivos = f;
        if (f === 'COMPLETADOS' && this.movCompletados.length === 0 && !this.loadingCompletados) {
            this.loadMovCompletados();
        } else {
            this._applyFilterActivos();
        }
    }

    setTabView(tab: 'activos' | 'envios' | 'traspasos' | 'tecnico'): void {
        this.activeTabView = tab;
        const map: Record<string, 'TODOS' | 'ENVIO_BASE' | 'TRASPASO'> = {
            'activos':   'TODOS',
            'envios':    'ENVIO_BASE',
            'traspasos': 'TRASPASO',
            'tecnico':   'TRASPASO'
        };
        this.setFilterActivos(map[tab] || 'TODOS');
        if (tab === 'activos') this.loadMovActivos();
    }

    private _applyFilterActivos(): void {
        if (this.filterActivos === 'COMPLETADOS') {
            this.movActivosFiltrados = [...this.movCompletados];
        } else if (this.filterActivos === 'TODOS') {
            this.movActivosFiltrados = [...this.movActivos, ...this.movCompletados];
        } else if (this.filterActivos === 'TRASPASO') {
            // MGH-109 es un subtipo de TRASPASO → incluirlo en este filtro
            this.movActivosFiltrados = this.movActivos.filter(m =>
                m.movement_type_label === 'TRASPASO' || m.movement_type_label === 'MGH_109'
            );
        } else {
            this.movActivosFiltrados = this.movActivos.filter(m => m.movement_type_label === this.filterActivos);
        }
    }

    getActivosStats() {
        const a = this.movActivos;
        return {
            total:    a.length,
            vencidos: a.filter(m => m.alert_status === 'VENCIDO' || m.alert_status === 'VENCE_HOY').length,
            proximos: a.filter(m => m.alert_status === 'PROXIMO').length,
            enPlazo:  a.filter(m => m.alert_status === 'EN_PLAZO').length,
            sinFecha: a.filter(m => m.alert_status === 'SIN_FECHA').length,
        };
    }

    getAlertBadgeClass(s: string): string {
        return {
            'VENCIDO':   'bg-black text-white border-black',
            'VENCE_HOY': 'bg-red-600 text-white border-red-900',
            'PROXIMO':   'bg-orange-500 text-white border-orange-700',
            'EN_PLAZO':  'bg-green-500 text-white border-green-700',
            'SIN_FECHA': 'bg-gray-400 text-white border-gray-500',
        }[s] || 'bg-gray-400 text-white border-gray-500';
    }

    getAlertLabel(s: string): string {
        return {
            'VENCIDO':   'VENCIDO',
            'VENCE_HOY': 'VENCE HOY',
            'PROXIMO':   'PRÓXIMO',
            'EN_PLAZO':  'EN PLAZO',
            'SIN_FECHA': 'SIN FECHA',
        }[s] || s;
    }

    getAlertRowClass(s: string): string {
        return {
            'VENCIDO':   'border-l-4 border-l-black',
            'VENCE_HOY': 'border-l-4 border-l-red-600',
            'PROXIMO':   'border-l-4 border-l-orange-500',
            'EN_PLAZO':  'border-l-4 border-l-green-500',
            'SIN_FECHA': 'border-l-4 border-l-gray-400',
        }[s] || '';
    }

    getTypeClass(t: string): string {
        if (t === 'MGH_109')  return 'bg-[#0F172A] text-[#FFC501FF] border-[#FFC501FF]';
        if (t === 'TRASPASO') return 'bg-amber-400 text-black border-black';
        return 'bg-blue-600 text-white border-blue-900';
    }

    /** Clase de badge para el tipo de traspaso (TEMPORAL/PERMANENTE/REASIGNACION/PRESTAMO) */
    getTransferTypeClass(tt: string): string {
        const map: Record<string, string> = {
            'TEMPORAL':     'bg-blue-100 text-blue-800 border-blue-400',
            'PERMANENTE':   'bg-purple-100 text-purple-800 border-purple-400',
            'REASIGNACION': 'bg-green-100 text-green-800 border-green-400',
            'PRESTAMO':     'bg-yellow-100 text-yellow-800 border-yellow-400',
        };
        return map[tt] || 'bg-gray-100 text-gray-600 border-gray-300';
    }

    /** Etiqueta corta del tipo de traspaso */
    getTransferTypeLabel(tt: string): string {
        const map: Record<string, string> = {
            'TEMPORAL':     'Temporal',
            'PERMANENTE':   'Permanente',
            'REASIGNACION': 'Reasignación',
            'PRESTAMO':     'Préstamo',
        };
        return map[tt] || tt;
    }

    registrarRetornoDesdeActivo(mov: MovimientoActivo): void {
        if (this._esTraspasoTecnico(mov)) {
            // Traspaso técnico MGH-109 (destino = persona, sin almacén) → Dev. TÉC.
            this.abrirFormDevolucionTecnico();
            setTimeout(() => this.seleccionarMovimientoTecnico(mov), 150);
            return;
        }

        if (this._esTraspasoArea(mov)) {
            // Traspaso de área (destino = almacén real) → Ret. ÁREA
            this.abrirFormRetornoArea();
            setTimeout(() => this.seleccionarMovimientoArea(mov), 150);
            return;
        }

        // Flujo BASE (ENVIO_BASE)
        this._showMsg(`Registrando retorno de ${mov.movement_number}`, 'info');
        this._retornoDialogRef = this.dialog.open(RetornoDialogComponent, {
            width: 'min(700px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases, movimiento: mov, tipoOrigen: 'BASE' as const }
        });
        this._retornoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    verPdfActivo(mov: MovimientoActivo): void {
        this.loadingPdfActivo = mov.id_movement;
        forkJoin({
            rawItems: this.movSvc.getMovementItems(Number(mov.id_movement)),
            personal: this.movSvc.getPersonal().pipe(catchError(() => of([] as any[])))
        })
            .pipe(takeUntil(this._unsub$), finalize(() => this.loadingPdfActivo = null))
            .subscribe({
                next: ({ rawItems, personal }) => {
                    const items: ToolEnvioItem[] = (rawItems || []).map((item: any) => ({
                        toolId:    Number(item.tool_id || item.toolId || 0),
                        codigo:    item.tool?.code || item.code || '',
                        nombre:    item.tool?.description || item.tool?.name || item.name || item.description || '',
                        pn:        item.tool?.part_number || item.part_number || '',
                        sn:        item.tool?.serial_number || item.serial_number || '',
                        marca:     item.tool?.brand || item.brand || '',
                        fechaVencCal: item.tool?.calibration_expiry_date || item.calibration_expiry_date || '',
                        cantidad:  Number(item.quantity) || 1,
                        condicion: item.condition_state || 'good',
                        notas:     item.notes || '',
                        unidad:         item.unit_of_measure || '',
                        listaContenido: item.content_list    || '',
                    }));
                    // Cruza nombre contra el padrón de funcionarios (mismo origen que usan los
                    // autocompletados del form) para completar Licencia/Cargo, que el movimiento
                    // en sí no guarda — solo el nombre en texto libre.
                    const buscarFuncionario = (nombre: string): any => {
                        const q = (nombre || '').trim().toLowerCase();
                        if (!q) return null;
                        return (personal || []).find((f: any) => (f.nombreCompleto || '').trim().toLowerCase() === q) || null;
                    };
                    const solicitante = buscarFuncionario(mov.requested_by_name);
                    const autorizado  = buscarFuncionario(mov.authorized_by || '');

                    const tipo = mov.movement_type_label === 'TRASPASO' ? 'TRASPASO DEFINITIVO' : 'ENVÍO A BASE';
                    const fakeForm = {
                        fechaEnvio:           mov.send_date,
                        fechaTraspaso:        mov.send_date,
                        baseOrigen:           { nombre: mov.source_warehouse_name },
                        baseDestino:          { nombre: mov.destination_warehouse_name },
                        areaDepartamento:     mov.destination_warehouse_name,
                        department:           mov.department,
                        departamentoDestino:  mov.destination_department,
                        unidadDestino:        mov.destination_unit,
                        responsableEnvia:     mov.requested_by_name,
                        responsableTraspaso:  mov.requested_by_name,
                        licenciaSolicitante:  solicitante?.licencia || '',
                        cargoSolicitante:     solicitante?.cargo    || '',
                        recibeEnDestino:      mov.received_by_name,
                        tipoTraspaso:         mov.transfer_type,
                        autorizadoPor:        mov.authorized_by || '',
                        cargoAutorizado:      autorizado?.cargo || '',
                        nroDocumento:         mov.document_number,
                        fechaEsperadaRetorno: mov.expected_return_date || 'N/A',
                        notas: mov.notes || '',
                    };
                    this._pdfEnvio(mov.movement_number, items, fakeForm, tipo);
                },
                error: () => this._showMsg('Error al generar PDF', 'error'),
            });
    }

    loadMovCompletados(): void {
        this.loadingCompletados = true;
        this.movSvc.listarMovimientosCompletados({ limit: 200 }).pipe(
            takeUntil(this._unsub$), finalize(() => { this.loadingCompletados = false; this._applyFilterActivos(); })
        ).subscribe({
            next: (data: any[]) => {
                this.movCompletados = (data || []).map((m: any) => {
                    const isMgh109 = !!(m.specific_observations?.includes('MGH109'));
                    const rawType  = m.movement_type_label || m.type || '';
                    return {
                        id_movement:                Number(m.id_movement),
                        movement_number:            m.movement_number  || '',
                        movement_type_label:        isMgh109 ? 'MGH_109' : rawType,
                        transfer_type:              m.transfer_type    || '',
                        send_date:                  m.send_date  || m.date  || '',
                        expected_return_date:       m.expected_return_date || null,
                        days_remaining:             null,
                        alert_status:               'DEVUELTO',
                        source_warehouse_id:        m.source_warehouse_id,
                        destination_warehouse_id:   m.destination_warehouse_id,
                        source_warehouse_name:      m.source_warehouse_name      || '',
                        destination_warehouse_name: m.destination_warehouse_name || '',
                        requested_by_name:          m.requested_by_name  || m.responsible_person || '',
                        received_by_name:           m.received_by_name   || '',
                        department:                 m.department         || '',
                        authorized_by:              m.authorized_by      || '',
                        destination_department:     m.destination_department || '',
                        destination_unit:           m.destination_unit       || '',
                        document_number:            m.document_number    || '',
                        notes:                      m.notes              || '',
                        specific_observations:      m.specific_observations || '',
                        items_count:                Number(m.items_count) || 0,
                        expanded:                   false,
                        isCompleted:                true,
                        return_movement_number:     m.return_movement_number || '',
                        return_id_movement:         Number(m.return_id_movement) || 0,
                    };
                });
            },
            error: () => this._showMsg('Error al cargar completados', 'error')
        });
    }

    verPdfRetornoCompletado(mov: MovimientoActivo): void {
        if (!mov.return_id_movement) return;
        this.loadingPdfActivo = mov.id_movement;
        this.movSvc.getMovementItems(mov.return_id_movement)
            .pipe(takeUntil(this._unsub$), finalize(() => this.loadingPdfActivo = null))
            .subscribe({
                next: (rawItems: any[]) => {
                    const items: ToolEnvioItem[] = (rawItems || []).map((item: any) => ({
                        toolId:    Number(item.tool_id || 0),
                        codigo:    item.code || '',
                        nombre:    item.description || item.name || '',
                        pn:        item.part_number || '',
                        sn:        item.serial_number || '',
                        marca:     item.brand || '',
                        fechaVencCal: item.calibration_expiry_date || '',
                        cantidad:  Number(item.quantity) || 1,
                        condicion: item.condition_on_movement || item.condition_state || 'good',
                        notas:     item.notes || '',
                    }));
                    this._pdfRetornoSimple(
                        mov.return_movement_number || '---',
                        mov.movement_number,
                        mov.source_warehouse_name,
                        mov.destination_warehouse_name,
                        mov.received_by_name || mov.requested_by_name,
                        items
                    );
                },
                error: () => this._showMsg('Error al generar PDF de retorno', 'error'),
            });
    }

    private _pdfRetornoSimple(rtrNro: string, originalNro: string, almacen: string, origen: string, recibePor: string, items: ToolEnvioItem[]): void {
        const now = new Date().toLocaleString('es-BO');
        const rows = items.map((item, i) => `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td><span style="font-family:monospace;font-weight:700;background:#0f172a;color:white;padding:1px 4px;border-radius:2px;font-size:9px">${item.codigo || '-'}</span></td>
                <td>${item.nombre || '-'}</td>
                <td style="font-family:monospace;font-size:9px">${item.pn || '-'}</td>
                <td style="font-family:monospace;font-size:9px">${item.sn || '-'}</td>
                <td style="text-align:center;font-weight:700">${item.cantidad}</td>
                <td style="text-align:center;font-size:9px">${item.condicion || '-'}</td>
            </tr>`).join('');
        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Retorno ${rtrNro}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
  h1 { text-align: center; font-size: 13px; font-weight: 900; text-transform: uppercase;
       background: #166534; color: white; padding: 7px 10px; margin: 0 0 7px; border: 1px solid #000; }
  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 6px; }
  .meta-box { border: 1.5px solid #000; padding: 4px 8px; border-radius: 3px; }
  .meta-box label { font-size: 8px; font-weight: 900; text-transform: uppercase; color: #6b7280; display: block; }
  .meta-box span  { font-weight: 900; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th { background: #0f172a; color: white; padding: 4px 6px; font-weight: 900; text-transform: uppercase; text-align: left; }
  td { padding: 3px 6px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { margin-top: 18px; display: flex; justify-content: space-around; }
  .sign { text-align: center; }
  .sign-line { border-top: 2px solid #000; width: 160px; margin: 40px auto 3px; }
  .sign-label { font-size: 8px; font-weight: 900; text-transform: uppercase; }
  .badge { background:#dcfce7;border:2px solid #166534;color:#166534;font-weight:900;
           padding:2px 8px;border-radius:4px;display:inline-block;font-size:11px; }
</style></head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px">
    <div>
      <div class="badge">RETORNO</div>
      <div style="font-size:10px;font-weight:700;margin-top:2px">Retorno de: <strong>${originalNro}</strong></div>
    </div>
    <div style="text-align:right;font-size:9px;color:#6b7280">
      <div>Impreso: ${now}</div>
    </div>
  </div>
  <h1>NOTA DE RETORNO — ${rtrNro}</h1>
  <div class="meta">
    <div class="meta-box"><label>Nro. Retorno</label><span>${rtrNro}</span></div>
    <div class="meta-box"><label>Movimiento Original</label><span>${originalNro}</span></div>
    <div class="meta-box"><label>Almacén Receptor</label><span>${almacen || '—'}</span></div>
    <div class="meta-box"><label>Origen / Técnico</label><span>${origen || '—'}</span></div>
    <div class="meta-box"><label>Recibido Por</label><span>${recibePor || '—'}</span></div>
  </div>
  <table>
    <thead><tr>
      <th style="width:30px">#</th><th style="width:90px">Código</th>
      <th>Descripción</th><th style="width:100px">P/N</th>
      <th style="width:100px">S/N</th><th style="width:40px;text-align:center">Cant.</th>
      <th style="width:70px;text-align:center">Condición</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <div class="sign"><div class="sign-line"></div><div class="sign-label">Entrega</div></div>
    <div class="sign"><div class="sign-line"></div><div class="sign-label">Recibe — ${almacen || 'Almacén'}</div></div>
    <div class="sign"><div class="sign-line"></div><div class="sign-label">Autoriza</div></div>
  </div>
</body></html>`;
        this._abrirBlob(html);
    }

    // ── TRASPASO TÉCNICO (MGH-109) ────────────────────────────────────────────

    private _initTraspasoTecnicoForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const hora  = new Date().toTimeString().slice(0, 5);
        this.traspasoTecnicoForm = this.fb.group({
            nombreCompletoInput:  ['', Validators.required],
            nombreCompleto:       [''],
            nroLicencia:          ['', Validators.required],
            cargo:                ['', Validators.required],
            responsableEntrega:   [this._getUsuarioActual() || '', Validators.required],
            fecha:                [today, Validators.required],
            hora:                 [hora],
            almacenOrigen:        [null],
            unidad:               ['', Validators.required],
            base:                 [null, Validators.required],
            tipoTraspaso:         ['TEMPORAL', Validators.required],
            fechaRetornoEsperada: [''],
            observaciones:        ['']
        });
    }

    /** Indica si el tipo de traspaso técnico requiere fecha de retorno */
    requiereFechaRetornoTecnico(): boolean {
        const tipo = this.traspasoTecnicoForm.get('tipoTraspaso')?.value;
        return tipo === 'TEMPORAL' || tipo === 'PRESTAMO';
    }

    /** Nombre del usuario logueado desde localStorage */
    private _getUsuarioActual(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || '';
        } catch { return ''; }
    }

    private _setupToolSearchTecnico(): void {
        this._srchTecnico$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                if (!term || term.trim().length < 2) {
                    this.toolResultsTecnico = []; this.showToolDropTecnico = false;
                    return of([]);
                }
                this.searchingToolsTecnico = true;
                return this.toolSvc.getTools({ query: term.trim() }).pipe(
                    finalize(() => this.searchingToolsTecnico = false)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (tools: any[]) => {
            this.toolResultsTecnico = tools.slice(0, 12);
            this.showToolDropTecnico = this.toolResultsTecnico.length > 0;
        }});
    }

    private _setupPersonaTecnicoSearch(): void {
        this.traspasoTecnicoForm.get('nombreCompletoInput')?.valueChanges.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(term => {
                const t = (term || '').trim();
                if (t.length < 2) {
                    this.personasTecnico = []; this.showPersonaTecnicoDropdown = false; return of([]);
                }
                this.personaTecnicoLoading = true;
                const q = t.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno, f.licencia, f.nro_licencia]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({
                            id:       String(f.id_employee || f.id || ''),
                            nombre:   f.nombreCompleto || f.nombre || '',
                            cargo:    f.cargo || '',
                            licencia: f.licencia ?? f.nro_licencia ?? '',
                            area:     f.departamento || f.area || ''
                        } as PersonaTecnico))
                    ),
                    finalize(() => this.personaTecnicoLoading = false)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (data: PersonaTecnico[]) => {
                this.personasTecnico = data; this.personaTecnicoLoading = false;
                this.showPersonaTecnicoDropdown = data.length > 0;
            },
            error: () => this.personaTecnicoLoading = false
        });

        // Búsqueda para "Responsable Entrega"
        this.traspasoTecnicoForm.get('responsableEntrega')?.valueChanges.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(term => {
                const t = (term || '').trim();
                if (t.length < 2) {
                    this.funcEntregaTecnico = []; this.showFuncEntregaTecnicoDropdown = false; return of([]);
                }
                this.funcEntregaTecnicoLoading = true;
                const q = t.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({
                            id:    String(f.id_employee || f.id || ''),
                            nombre: f.nombreCompleto || f.nombre || '',
                            cargo:  f.cargo || '',
                            licencia: ''
                        } as Funcionario))
                    ),
                    finalize(() => this.funcEntregaTecnicoLoading = false),
                    takeUntil(this._cancelEntregaTecnico$)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (data: Funcionario[]) => {
                this.funcEntregaTecnico = data; this.funcEntregaTecnicoLoading = false;
                this.showFuncEntregaTecnicoDropdown = data.length > 0;
            },
            error: () => this.funcEntregaTecnicoLoading = false
        });
    }

    selectFuncEntregaTecnico(func: Funcionario): void {
        this._cancelEntregaTecnico$.next();
        this.traspasoTecnicoForm.patchValue({ responsableEntrega: func.nombre }, { emitEvent: false });
        this.funcEntregaTecnico = []; this.showFuncEntregaTecnicoDropdown = false;
    }

    hideFuncEntregaTecnicoDropdown(): void { setTimeout(() => this.showFuncEntregaTecnicoDropdown = false, 150); }

    abrirFormTraspasoTecnico(): void {
        const defaultAlmacen = this.almacenes.find(u => u.nombre.toLowerCase().includes('cochabamba')) ?? this.almacenes[0] ?? null;
        this._tecnicoDialogRef = this.dialog.open(TraspasoTecnicoDialogComponent, {
            width: 'min(860px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases, defaultAlmacen }
        });
        this._tecnicoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    cerrarFormTraspasoTecnico(): void { this._tecnicoDialogRef?.close(); }

    onToolSearchTecnico(term: string): void { this.toolSearchTecnico = term; this._srchTecnico$.next(term); }
    hideToolDropTecnico(): void { setTimeout(() => this.showToolDropTecnico = false, 150); }

    addToolTecnico(tool: any): void {
        const id = tool.id_tool ?? tool.id;
        if (this.itemsTraspasoTecnico.some(i => i.toolId === id)) {
            this._showMsg('Herramienta ya en la lista', 'warning'); return;
        }
        this.itemsTraspasoTecnico.push({
            toolId: id, codigo: tool.code ?? tool.codigo ?? '',
            nombre: tool.name ?? tool.description ?? '',
            pn: tool.part_number ?? '', sn: tool.serial_number ?? '',
            marca: tool.brand ?? tool.marca ?? '',
            fechaVencCal: tool.calibration_expiry_date ?? tool.next_calibration_date ?? '',
            cantidad: 1, condicion: 'good', notas: ''
        });
        this.toolSearchTecnico = ''; this.toolResultsTecnico = []; this.showToolDropTecnico = false;
    }

    removeToolTecnico(i: number): void { this.itemsTraspasoTecnico.splice(i, 1); }

    selectPersonaTecnico(p: PersonaTecnico): void {
        // emitEvent: false → evita que valueChanges relance la búsqueda y reabre el dropdown
        this.traspasoTecnicoForm.patchValue({
            nombreCompletoInput: p.nombre,
            nombreCompleto:      p.nombre,
            nroLicencia:         p.licencia,
            cargo:               p.cargo,
            ...(p.area ? { unidad: p.area } : {})
        }, { emitEvent: false });
        this.personasTecnico = []; this.showPersonaTecnicoDropdown = false;
    }

    hidePersonaTecnicoDropdown(): void { setTimeout(() => this.showPersonaTecnicoDropdown = false, 150); }

    canSaveTraspasoTecnico(): boolean {
        return this.traspasoTecnicoForm.valid && this.itemsTraspasoTecnico.length > 0 && !this.isSavingTraspasoTecnico;
    }

    guardarTraspasoTecnico(): void {
        if (!this.canSaveTraspasoTecnico()) {
            this.traspasoTecnicoForm.markAllAsTouched();
            if (this.itemsTraspasoTecnico.length === 0) this._showMsg('Agregue al menos una herramienta', 'warning');
            else this._showMsg('Complete los campos requeridos', 'error');
            return;
        }
        const fv = this.traspasoTecnicoForm.getRawValue();
        const itemsJson = JSON.stringify(this.itemsTraspasoTecnico.map(it => ({
            tool_id:               it.toolId,
            quantity:              it.cantidad,
            condition_on_movement: it.condicion || 'good',
            serial_number:         it.sn   || '',
            part_number:           it.pn   || '',
            notes:                 it.notas || ''
        })));
        const department = fv.unidad?.trim() || '';

        const baseLabel = fv.base?.codigo
            ? `${fv.base.codigo} — ${fv.base.nombre}`
            : (fv.base?.nombre || '');

        this.isSavingTraspasoTecnico = true;
        const tecnicoPayload: any = {
            date:                    fv.fecha,
            time:                    fv.hora + ':00',
            source_warehouse_id:     fv.almacenOrigen?.id ? Number(fv.almacenOrigen.id) : undefined,
            destination_warehouse_id:fv.base?.id          ? Number(fv.base.id)           : undefined,
            requested_by_name:       fv.responsableEntrega || this._getUsuarioActual() || '',
            responsible_person:      fv.responsableEntrega || this._getUsuarioActual() || 'Almacén',
            received_by_name:        fv.nombreCompleto || fv.nombreCompletoInput,
            department,
            exit_reason:             'area_transfer',
            transfer_type:           fv.tipoTraspaso,
            notes:                   fv.observaciones ?? '',
            specific_observations:   'MGH109',
            general_observations:    `Base: ${baseLabel} | Cargo: ${fv.cargo} | Licencia: ${fv.nroLicencia}`,
            items_json: itemsJson
        };
        if (this.requiereFechaRetornoTecnico() && fv.fechaRetornoEsperada) {
            tecnicoPayload.expected_return_date = fv.fechaRetornoEsperada;
        }
        this.movSvc.registrarTraspasoOtraArea(tecnicoPayload).pipe(finalize(() => this.isSavingTraspasoTecnico = false), takeUntil(this._unsub$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._showMsg(`Traspaso Técnico registrado: ${nro}`, 'success');
                this._pdfMGH109(nro, fv, this.itemsTraspasoTecnico);
                this.resetTraspasoTecnicoTab();
                this._tecnicoDialogRef?.close();
                this.loadMovActivos();
            },
            error: (err) => this._showMsg('Error al registrar traspaso técnico: ' + (err?.message || ''), 'error')
        });
    }

    resetTraspasoTecnicoTab(): void {
        this.traspasoTecnicoForm.reset({
            fecha:                new Date().toISOString().split('T')[0],
            hora:                 new Date().toTimeString().slice(0, 5),
            base:                 null,
            almacenOrigen:        null,
            responsableEntrega:   this._getUsuarioActual() || '',
            tipoTraspaso:         'TEMPORAL',
            fechaRetornoEsperada: ''
        });
        this._setDefaultAlmacenOrigen();
        this.itemsTraspasoTecnico = [];
        this.personasTecnico      = []; this.showPersonaTecnicoDropdown     = false;
        this.funcEntregaTecnico   = []; this.showFuncEntregaTecnicoDropdown = false;
        this.toolSearchTecnico    = ''; this.toolResultsTecnico             = []; this.showToolDropTecnico = false;
    }

    // ── DEVOLUCIÓN TÉCNICA (MGH-109) ─────────────────────────────────────────

    /**
     * Helper: un TRASPASO es "técnico" (MGH-109) cuando el destino es una PERSONA
     * (destination_warehouse_id === 0 / "0" / nulo), no un almacén físico.
     */
    private _esTraspasoTecnico(m: MovimientoActivo): boolean {
        // Nuevo: marcado explícitamente con 'MGH109' en specific_observations
        if (m.movement_type_label === 'MGH_109') return true;
        // Fallback para registros anteriores (heurística: sin warehouse destino)
        const id = Number(m.destination_warehouse_id);
        return m.movement_type_label === 'TRASPASO' && (!id || id === 0);
    }

    /**
     * Helper: un TRASPASO es "de área" cuando tiene almacén destino real (id > 0)
     * y NO es MGH-109.
     */
    private _esTraspasoArea(m: MovimientoActivo): boolean {
        if (m.movement_type_label === 'MGH_109') return false;
        const id = Number(m.destination_warehouse_id);
        return m.movement_type_label === 'TRASPASO' && id > 0;
    }

    /** TRASPASOs técnicos activos → Dev. TÉC. (MGH-109): destino = persona, warehouse_id = 0 */
    get movTecnicosActivos(): MovimientoActivo[] {
        return this.movActivos.filter(m => this._esTraspasoTecnico(m));
    }

    /** Filtrados por nombre del técnico / correlativo / departamento */
    get movTecnicosFiltrados(): MovimientoActivo[] {
        const q = (this.searchTecnicoNombre || '').toLowerCase().trim();
        if (!q) return this.movTecnicosActivos;
        return this.movTecnicosActivos.filter(m =>
            (m.received_by_name || '').toLowerCase().includes(q) ||
            (m.movement_number  || '').toLowerCase().includes(q) ||
            (m.department       || '').toLowerCase().includes(q)
        );
    }

    /** TRASPASOs de área activos → Ret. ÁREA: destino = almacén real (warehouse_id > 0) */
    get movTraspasosActivos(): MovimientoActivo[] {
        return this.movActivos.filter(m => this._esTraspasoArea(m));
    }

    /** Filtrados por área destino / correlativo / responsable */
    get movTraspasosFiltrados(): MovimientoActivo[] {
        const q = (this.searchAreaMovimiento || '').toLowerCase().trim();
        if (!q) return this.movTraspasosActivos;
        return this.movTraspasosActivos.filter(m =>
            (m.destination_warehouse_name || '').toLowerCase().includes(q) ||
            (m.source_warehouse_name      || '').toLowerCase().includes(q) ||
            (m.movement_number            || '').toLowerCase().includes(q) ||
            (m.received_by_name           || '').toLowerCase().includes(q)
        );
    }

    private _initDevolucionTecnicoForm(): void {
        const today = new Date().toISOString().split('T')[0];
        this.devolucionTecnicoForm = this.fb.group({
            fechaDevolucion: [today, Validators.required],
            recibeAlmacen:   [this._getUsuarioActual() || '', Validators.required],
            nroDocumento:    [''],
            observaciones:   ['']
        });
    }

    private _setupFuncDevolucionSearch(): void {
        this.devolucionTecnicoForm.get('recibeAlmacen')?.valueChanges.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(term => {
                const t = (term || '').trim();
                if (t.length < 2) {
                    this.funcDevolucionRecibe = []; this.showFuncDevolucionRecibeDropdown = false; return of([]);
                }
                this.funcDevolucionRecibeLoading = true;
                const q = t.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({
                            id:     String(f.id_employee || f.id || ''),
                            nombre: f.nombreCompleto || f.nombre || '',
                            cargo:  f.cargo || ''
                        } as Funcionario))
                    ),
                    finalize(() => this.funcDevolucionRecibeLoading = false),
                    takeUntil(this._cancelDevolucionRecibe$)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (data: Funcionario[]) => {
                this.funcDevolucionRecibe = data; this.funcDevolucionRecibeLoading = false;
                this.showFuncDevolucionRecibeDropdown = data.length > 0;
            },
            error: () => this.funcDevolucionRecibeLoading = false
        });
    }

    abrirFormDevolucionTecnico(): void {
        this._devTecnicoDialogRef = this.dialog.open(DevolucionTecnicoDialogComponent, {
            width: 'min(900px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { movTecnicosActivos: this.movTecnicosActivos }
        });
        this._devTecnicoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    cerrarFormDevolucionTecnico(): void { this._devTecnicoDialogRef?.close(); }

    seleccionarMovimientoTecnico(mov: MovimientoActivo): void {
        if (this.movTecnicoSeleccionado?.id_movement === mov.id_movement) return;
        this.movTecnicoSeleccionado = mov;
        this.devolucionTecnicoItems = [];
        this.loadingDevolucionItems = true;
        this.movSvc.getMovementItems(Number(mov.id_movement)).pipe(
            takeUntil(this._unsub$), finalize(() => this.loadingDevolucionItems = false)
        ).subscribe({
            next: (rawItems: any[]) => {
                this.devolucionTecnicoItems = (rawItems || []).map((item: any, idx: number) =>
                    this._mapToTraspasoItem(mov as any, item, idx)
                );
            },
            error: () => this._showMsg('Error al cargar ítems del movimiento', 'error')
        });
    }

    toggleSelectionDevolucion(item: TraspasoItem): void {
        item.selected = !item.selected;
        if (item.selected && !item.expanded) item.expanded = true;
    }

    toggleAllDevolucion(event: any): void {
        this.devolucionTecnicoItems.forEach(i => { i.selected = event.checked; if (event.checked) i.expanded = true; });
    }

    isAllSelectedDevolucion(): boolean {
        return this.devolucionTecnicoItems.length > 0 && this.devolucionTecnicoItems.every(i => i.selected);
    }

    isSomeSelectedDevolucion(): boolean {
        return this.devolucionTecnicoItems.some(i => i.selected) && !this.isAllSelectedDevolucion();
    }

    getSelectedDevolucion(): TraspasoItem[] {
        return this.devolucionTecnicoItems.filter(i => i.selected);
    }

    getDevolucionBuenosCount(): number {
        return this.getSelectedDevolucion().filter(i => i.condicion === 'BUENO').length;
    }
    getDevolucionDanadosCount(): number {
        return this.getSelectedDevolucion().filter(i => i.condicion === 'DAÑADO').length;
    }
    getDevolucionFaltantesCount(): number {
        return this.getSelectedDevolucion().filter(i => i.condicion === 'FALTANTE').length;
    }

    canProceedDevolucionTecnico(): boolean {
        const sel = this.getSelectedDevolucion();
        return sel.length > 0 && this.devolucionTecnicoForm.valid && sel.every(i => this.isItemValid(i));
    }

    openDevolucionTecnicoConfirm(): void {
        if (!this.canProceedDevolucionTecnico()) {
            if (this.getSelectedDevolucion().length === 0) { this._showMsg('Seleccione herramientas a devolver', 'warning'); return; }
            this.devolucionTecnicoForm.markAllAsTouched();
            if (this.devolucionTecnicoForm.invalid) { this._showMsg('Complete datos de recepción', 'error'); return; }
            const inv = this.getSelectedDevolucion().filter(i => !this.isItemValid(i));
            if (inv.length) { this._showMsg(`${inv.length} ítem(s) con errores`, 'error'); inv.forEach(i => i.expanded = true); return; }
        }
        this.showDevolucionTecnicoConfirm = true;
    }

    closeDevolucionTecnicoConfirm(): void { this.showDevolucionTecnicoConfirm = false; }

    selectFuncDevolucionRecibe(func: Funcionario): void {
        this._cancelDevolucionRecibe$.next();
        this.devolucionTecnicoForm.patchValue({ recibeAlmacen: func.nombre }, { emitEvent: false });
        this.funcDevolucionRecibe = []; this.showFuncDevolucionRecibeDropdown = false;
    }

    hideFuncDevolucionRecibeDropdown(): void { setTimeout(() => this.showFuncDevolucionRecibeDropdown = false, 150); }

    finalizarDevolucionTecnico(): void {
        if (!this.canProceedDevolucionTecnico()) return;
        this.closeDevolucionTecnicoConfirm();
        const selItems = this.getSelectedDevolucion();
        const formVal  = this.devolucionTecnicoForm.value;
        const mov      = this.movTecnicoSeleccionado!;

        if (selItems.some(i => !i.toolId)) {
            this._showMsg('Herramienta(s) sin ID de sistema', 'error'); return;
        }

        this.isSavingDevolucionTecnico = true;
        const itemsJson = JSON.stringify(selItems.map(item => ({
            tool_id:       Number(item.toolId),
            quantity:      item.cantidadRetorna,
            condicion:     item.condicion || 'BUENO',
            notes:         item.observacionItem || '',
            serial_number: item.sn || '',
            part_number:   item.pn || ''
        })));

        this.movSvc.registrarRetornoBase({
            type:                     'RETORNO_TRASPASO',
            date:                     formVal.fechaDevolucion,
            time:                     new Date().toTimeString().slice(0, 8),
            requested_by_name:        formVal.recibeAlmacen || '',
            responsible_person:       formVal.recibeAlmacen || '',
            document_number:          formVal.nroDocumento  || '',
            // Herramientas retornan AL almacén de origen del traspaso (source_warehouse_id = base)
            source_warehouse_id:      mov.source_warehouse_id || undefined,
            notes:                    formVal.observaciones || '',
            specific_observations:    `Retorno de técnico: ${mov.received_by_name || '-'} | Traspaso original: ${mov.movement_number}`,
            items_json:               itemsJson
        }).pipe(finalize(() => this.isSavingDevolucionTecnico = false), takeUntil(this._unsub$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._showMsg(`Devolución técnica registrada: ${nro}`, 'success');
                this._pdfDevolucionMGH109(nro, selItems, formVal, mov);
                const ids = new Set(selItems.map(i => i.id));
                this.devolucionTecnicoItems = this.devolucionTecnicoItems.filter(i => !ids.has(i.id));
                if (this.devolucionTecnicoItems.length === 0) {
                    this.movTecnicoSeleccionado = null;
                    this.cerrarFormDevolucionTecnico();
                    // Todos los ítems devueltos → marcar movimiento original como 'returned'
                    this.movSvc.cerrarMovimiento(mov.id_movement)
                        .pipe(takeUntil(this._unsub$))
                        .subscribe({ next: () => { this.loadMovActivos(); }, error: () => this.loadMovActivos() });
                } else {
                    this.loadMovActivos();
                }
            },
            error: (err) => this._showMsg('Error al registrar devolución: ' + (err?.message || ''), 'error')
        });
    }

    private _pdfDevolucionMGH109(nro: string, items: TraspasoItem[], form: any, mov: MovimientoActivo): void {
        const now = new Date().toLocaleString('es-BO');
        const condLabel: Record<string, string> = {
            BUENO: 'Bueno', DAÑADO: 'Dañado', REQUIERE_CALIBRACION: 'Req. Calibración', FALTANTE: 'Faltante'
        };
        const rows = items.map((item, i) => `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td><span style="font-family:monospace;font-weight:700;background:#0f172a;color:white;padding:1px 4px;border-radius:2px;font-size:9px">${item.codigo || '-'}</span></td>
                <td>${item.descripcion || '-'}</td>
                <td>${item.pn || '-'}</td>
                <td>${item.sn || '-'}</td>
                <td style="text-align:center;font-weight:700">${item.cantidadRetorna} / ${item.cantidadEnviada}</td>
                <td style="font-weight:bold;text-align:center;color:${item.condicion === 'BUENO' ? '#16a34a' : item.condicion === 'DAÑADO' ? '#dc2626' : '#d97706'}">${condLabel[item.condicion] || '-'}</td>
                <td>${item.observacionItem || '-'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Devolución MGH-109 ${nro}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
  .code-box { border: 2px solid #000; padding: 3px 10px; font-weight: 900; font-size: 13px; display: inline-block; }
  .badge-return { background: #dcfce7; border: 2px solid #166534; color: #166534; font-weight: 900; padding: 2px 8px; border-radius: 4px; display: inline-block; font-size: 11px; margin: 3px 0; }
  h1 { text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; background: #166534; color: white; padding: 7px 10px; margin: 0 0 7px; border: 1px solid #000; }
  .info-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 7px; }
  .info-tbl td { border: 1px solid #ddd; padding: 3px 6px; }
  .lbl { background: #f0f0f0; font-weight: 700; font-size: 9px; width: 130px; }
  .nro-cell { background: #dcfce7; text-align: center; font-weight: 900; font-size: 15px; vertical-align: middle; width: 120px; color: #166534; }
  .sec { background: #166534; color: white; padding: 3px 8px; font-weight: 900; font-size: 10px; text-transform: uppercase; border: 1px solid #000; }
  table.det { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.det th { background: #166534; color: white; padding: 5px 4px; font-size: 8.5px; font-weight: 900; text-transform: uppercase; border: 1px solid #000; text-align: center; }
  table.det td { padding: 4px; border: 1px solid #ddd; font-size: 9px; }
  table.det tr:nth-child(even) td { background: #f0fdf4; }
  .nota { border: 1px solid #ccc; padding: 5px 8px; margin-top: 8px; font-size: 8.5px; background: #f0fdf4; line-height: 1.5; }
  .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 18px; }
  .sig { border: 1px solid #000; padding: 6px 8px; text-align: center; }
  .sig-ttl { font-weight: 900; font-size: 9px; text-transform: uppercase; margin-bottom: 28px; }
  .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 8.5px; }
  .footer { text-align: center; margin-top: 10px; font-size: 7.5px; color: #888; border-top: 1px dotted #ccc; padding-top: 4px; }
</style>
<script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); };</script>
</head><body>
<div class="top">
  <div>
    <div class="code-box">BoAMM OAM145# N-014</div>
    <div class="badge-return">✓ DEVOLUCIÓN MGH-109</div>
    <div style="font-size:9px;margin-top:2px;">Formulario MGH-109 — Devolución de Herramienta Técnica</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9px;color:#555">Generado: ${now}</div>
  </div>
</div>
<h1>DEVOLUCIÓN DE HERRAMIENTA / EQUIPO — NOTA TÉCNICA</h1>
<table class="info-tbl">
  <tr>
    <td class="lbl">Nro. Devolución</td>
    <td class="nro-cell" rowspan="3">${nro}</td>
    <td class="lbl">Técnico / Responsable</td>
    <td><strong>${mov.received_by_name || '-'}</strong></td>
    <td class="lbl">Traspaso Original</td>
    <td><strong>${mov.movement_number || '-'}</strong></td>
  </tr>
  <tr>
    <td class="lbl">Fecha Devolución</td>
    <td>${form.fechaDevolucion || '-'}</td>
    <td class="lbl">Unidad / Área</td>
    <td>${mov.department || '-'}</td>
    <td class="lbl">Recibe en Almacén</td>
    <td>${form.recibeAlmacen || '-'}</td>
  </tr>
  <tr>
    <td class="lbl">Nro. Documento</td>
    <td>${form.nroDocumento || '---'}</td>
    <td class="lbl">Observaciones</td>
    <td colspan="2">${form.observaciones || '---'}</td>
  </tr>
</table>
<div class="sec">DETALLE DE HERRAMIENTAS / EQUIPOS DEVUELTOS</div>
<table class="det">
  <thead>
    <tr>
      <th style="width:3%">#</th>
      <th style="width:9%">Código BOA</th>
      <th style="width:22%">Descripción</th>
      <th style="width:11%">P/N</th>
      <th style="width:10%">S/N</th>
      <th style="width:10%">Dev/Env</th>
      <th style="width:10%">Condición</th>
      <th style="width:25%">Observaciones</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="sigs">
  <div class="sig">
    <div class="sig-ttl">Devuelve (${mov.received_by_name || '-'})</div>
    <div class="sig-line">Firma: ________________________</div>
  </div>
  <div class="sig">
    <div class="sig-ttl">Recibe en Almacén (${form.recibeAlmacen || 'Almacén'})</div>
    <div class="sig-line">Firma / Sello</div>
  </div>
  <div class="sig">
    <div class="sig-ttl">Verificado (Jefe Almacén)</div>
    <div class="sig-line">Firma / Sello</div>
  </div>
</div>
<div class="nota">
  <strong>Nota:</strong> Este documento certifica la devolución de herramientas/equipos al almacén de origen.
  El responsable de almacén verifica el estado de las herramientas conforme al detalle. Traspaso origen: ${mov.movement_number} | Técnico: ${mov.received_by_name || '-'}
</div>
<div class="footer">BOLIVIANA DE AVIACIÓN — Almacén de Herramientas | Generado: ${now} | Doc Devolución: ${nro}</div>
</body></html>`;

        this._abrirBlob(html);
    }

    private _pdfMGH109(nro: string, fv: any, items: ToolEnvioItem[]): void {
        const now      = new Date().toLocaleString('es-BO');
        const dept     = fv.unidad || '';
        const baseText = fv.base?.codigo
            ? `${fv.base.codigo} — ${fv.base.nombre}`
            : (fv.base?.nombre || fv.base || '-');
        const rows = items.map((item, i) => `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td><span style="font-family:monospace;font-weight:700;background:#0f172a;color:white;padding:1px 4px;border-radius:2px;font-size:9px">${item.codigo || '-'}</span></td>
                <td>${item.pn || '-'}</td>
                <td>${item.sn || '-'}</td>
                <td style="text-align:center">PZA</td>
                <td style="text-align:center;font-weight:700">${item.cantidad}</td>
                <td>${item.nombre || '-'}</td>
                <td>${item.notas || '-'}</td>
                <td>${fv.fecha || '-'}</td>
                <td>&nbsp;</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>MGH-109 Nota de Traspaso ${nro}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
  .code-box { border: 2px solid #000; padding: 3px 10px; font-weight: 900; font-size: 13px; display: inline-block; }
  h1 { text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; background: #111A43; color: white; padding: 7px 10px; margin: 0 0 7px; border: 1px solid #000; }
  .info-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 7px; }
  .info-tbl td { border: 1px solid #ddd; padding: 3px 6px; }
  .lbl { background: #f0f0f0; font-weight: 700; font-size: 9px; width: 130px; }
  .nro-cell { background: #f0f0f0; text-align: center; font-weight: 900; font-size: 15px; vertical-align: middle; width: 120px; }
  .sec { background: #111A43; color: white; padding: 3px 8px; font-weight: 900; font-size: 10px; text-transform: uppercase; border: 1px solid #000; }
  table.det { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.det th { background: #111A43; color: white; padding: 5px 4px; font-size: 8.5px; font-weight: 900; text-transform: uppercase; border: 1px solid #000; text-align: center; }
  table.det td { padding: 4px; border: 1px solid #ddd; font-size: 9px; }
  table.det tr:nth-child(even) td { background: #f9f9f9; }
  .nota { border: 1px solid #ccc; padding: 5px 8px; margin-top: 8px; font-size: 8.5px; background: #fffde7; line-height: 1.5; }
  .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 18px; }
  .sig { border: 1px solid #000; padding: 6px 8px; text-align: center; }
  .sig-ttl { font-weight: 900; font-size: 9px; text-transform: uppercase; margin-bottom: 28px; }
  .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 8.5px; }
  .footer { text-align: center; margin-top: 10px; font-size: 7.5px; color: #888; border-top: 1px dotted #ccc; padding-top: 4px; }
</style>
<script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); };</script>
</head><body>
<div class="top">
  <div>
    <div class="code-box">BoAMM OAM145# N-014</div>
    <div style="font-size:9px;margin-top:3px;">Formulario MGH-109 — Nota de Traspaso de Herramienta</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9px;color:#555">Generado: ${now}</div>
  </div>
</div>

<h1>NOTA DE TRASPASO DE HERRAMIENTA / EQUIPO</h1>

<table class="info-tbl">
  <tr>
    <td class="lbl">Nro. Documento</td>
    <td class="nro-cell" rowspan="4">${nro}</td>
    <td class="lbl">Nombre Completo</td>
    <td>${fv.nombreCompleto || fv.nombreCompletoInput || '-'}</td>
    <td class="lbl">Nro. Licencia / CI</td>
    <td>${fv.nroLicencia || '-'}</td>
  </tr>
  <tr>
    <td class="lbl">Fecha</td>
    <td>${fv.fecha || '-'}</td>
    <td class="lbl">Cargo</td>
    <td>${fv.cargo || '-'}</td>
    <td class="lbl">Base</td>
    <td>${baseText}</td>
  </tr>
  <tr>
    <td class="lbl">Tipo de Traspaso</td>
    <td>${fv.tipoTraspaso || '-'}</td>
    <td class="lbl">Unidad / Área</td>
    <td colspan="2">${fv.unidad || '-'}</td>
  </tr>
  <tr>
    <td class="lbl">Observaciones</td>
    <td colspan="4">${fv.observaciones || '---'}</td>
  </tr>
</table>

<div class="sec">DETALLE DE HERRAMIENTAS / EQUIPOS</div>
<table class="det">
  <thead>
    <tr>
      <th style="width:3%">#</th>
      <th style="width:9%">Código BOA</th>
      <th style="width:11%">P/N</th>
      <th style="width:10%">S/N</th>
      <th style="width:5%">Unid.</th>
      <th style="width:6%">Cant.</th>
      <th style="width:24%">Descripción</th>
      <th style="width:18%">Observaciones</th>
      <th style="width:8%">Fecha</th>
      <th style="width:6%">Firma</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div class="sigs">
  <div class="sig">
    <div class="sig-ttl">Entrega (${fv.responsableEntrega || 'Almacén'})</div>
    <div class="sig-line">Firma / Sello</div>
  </div>
  <div class="sig">
    <div class="sig-ttl">Recibe (${fv.nombreCompleto || fv.nombreCompletoInput || '-'})</div>
    <div class="sig-line">Firma: ________________________<br>Licencia: ${fv.nroLicencia || '-'}</div>
  </div>
  <div class="sig">
    <div class="sig-ttl">Autoriza (Jefe de ${fv.unidad || 'Área'})</div>
    <div class="sig-line">Firma / Sello</div>
  </div>
</div>

<div class="nota">
  <strong>Nota:</strong> Este documento certifica el traspaso de las herramientas/equipos indicados de acuerdo a los procedimientos del Manual de Mantenimiento.
  El receptor asume la responsabilidad de las herramientas hasta su devolución. Dpto: ${dept} | Tipo: ${fv.tipoTraspaso}
</div>

<div class="footer">BOLIVIANA DE AVIACIÓN — Almacén de Herramientas | Generado: ${now} | Doc: ${nro}</div>
</body></html>`;

        this._abrirBlob(html);
    }

    // ── RETORNO ÁREA (TRASPASO doble-panel) ──────────────────────────────────

    private _initRetornoAreaForm(): void {
        this.retornoAreaForm = this.fb.group({
            fechaRetorno:  [new Date().toISOString().slice(0, 10), Validators.required],
            recibeAlmacen: ['', Validators.required],
            nroDocumento:  ['', Validators.required],
            observaciones: [''],
        });
    }

    private _setupFuncRetornoAreaSearch(): void {
        this.retornoAreaForm.get('recibeAlmacen')!.valueChanges.pipe(
            debounceTime(300), distinctUntilChanged(), takeUntil(this._unsub$)
        ).subscribe(v => {
            if ((v || '').trim().length >= 2) this._srchRetornoAreaRecibe(v);
            else { this.funcRetornoAreaRecibe = []; this.showFuncRetornoAreaRecibeDropdown = false; }
        });
    }

    private _srchRetornoAreaRecibe(q: string): void {
        this._cancelRetornoAreaRecibe$.next();
        this.funcRetornoAreaRecibeLoading = true;
        const term = q.toLowerCase();
        this.movSvc.getPersonal().pipe(
            takeUntil(this._cancelRetornoAreaRecibe$),
            finalize(() => this.funcRetornoAreaRecibeLoading = false)
        ).subscribe({
            next: (lista: any[]) => {
                this.funcRetornoAreaRecibe = (lista || [])
                    .filter((f: any) => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                        .filter(Boolean).join(' ').toLowerCase().includes(term))
                    .slice(0, 10)
                    .map((f: any) => ({
                        id:     String(f.id_employee || f.id || ''),
                        nombre: f.nombreCompleto || f.nombre || '',
                        cargo:  f.cargo || ''
                    } as Funcionario));
                this.showFuncRetornoAreaRecibeDropdown = this.funcRetornoAreaRecibe.length > 0;
            },
            error: () => { this.funcRetornoAreaRecibe = []; }
        });
    }

    abrirFormRetornoArea(): void {
        this._retornoAreaDialogRef = this.dialog.open(RetornoAreaDialogComponent, {
            width: 'min(820px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { movTraspasosActivos: this.movTraspasosActivos }
        });
        this._retornoAreaDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    cerrarFormRetornoArea(): void {
        this._retornoAreaDialogRef?.close();
        this._retornoAreaDialogRef = null;
    }

    seleccionarMovimientoArea(mov: MovimientoActivo): void {
        if (this.movAreaSeleccionado?.id_movement === mov.id_movement) return;
        this.movAreaSeleccionado = mov;
        this.retornoAreaItems    = [];
        this.loadingRetornoAreaItems = true;
        this.movSvc.getMovementItems(Number(mov.id_movement)).pipe(
            takeUntil(this._unsub$), finalize(() => this.loadingRetornoAreaItems = false)
        ).subscribe({
            next: (items: any[]) => {
                this.retornoAreaItems = (items || []).map((item: any, idx: number) =>
                    this._mapToTraspasoItem(mov, item, idx)
                );
            },
            error: () => this._showMsg('Error al cargar ítems del movimiento', 'error')
        });
    }

    toggleSelectionArea(item: TraspasoItem): void {
        item.selected = !item.selected;
        if (item.selected && !item.expanded) item.expanded = true;
    }
    toggleAllArea(event: any): void {
        this.retornoAreaItems.forEach(i => { i.selected = event.checked; if (event.checked) i.expanded = true; });
    }
    isAllSelectedArea(): boolean  { return this.retornoAreaItems.length > 0 && this.retornoAreaItems.every(i => i.selected); }
    isSomeSelectedArea(): boolean { return this.retornoAreaItems.some(i => i.selected) && !this.isAllSelectedArea(); }
    getSelectedArea(): TraspasoItem[] { return this.retornoAreaItems.filter(i => i.selected); }

    getAreaBuenosCount(): number    { return this.getSelectedArea().filter(i => i.condicion === 'BUENO').length; }
    getAreaDanadosCount(): number   { return this.getSelectedArea().filter(i => i.condicion === 'DAÑADO').length; }
    getAreaFaltantesCount(): number { return this.getSelectedArea().filter(i => i.condicion === 'FALTANTE').length; }
    getAreaCalibCount(): number     { return this.getSelectedArea().filter(i => i.condicion === 'REQUIERE_CALIBRACION').length; }

    canProceedRetornoArea(): boolean {
        const sel = this.getSelectedArea();
        return sel.length > 0 && this.retornoAreaForm.valid && sel.every(i => this.isItemValid(i));
    }

    openRetornoAreaConfirm(): void {
        if (!this.canProceedRetornoArea()) {
            if (this.getSelectedArea().length === 0) { this._showMsg('Seleccione herramientas a retornar', 'warning'); return; }
            this.retornoAreaForm.markAllAsTouched();
            if (this.retornoAreaForm.invalid) { this._showMsg('Complete datos de recepción', 'error'); return; }
            const inv = this.getSelectedArea().filter(i => !this.isItemValid(i));
            if (inv.length) { this._showMsg(`${inv.length} ítem(s) con errores`, 'error'); inv.forEach(i => i.expanded = true); return; }
        }
        this.showRetornoAreaConfirm = true;
    }
    closeRetornoAreaConfirm(): void { this.showRetornoAreaConfirm = false; }

    selectFuncRetornoAreaRecibe(func: Funcionario): void {
        this._cancelRetornoAreaRecibe$.next();
        this.retornoAreaForm.patchValue({ recibeAlmacen: func.nombre });
        this.funcRetornoAreaRecibe = []; this.showFuncRetornoAreaRecibeDropdown = false;
    }
    hideFuncRetornoAreaRecibeDropdown(): void { setTimeout(() => this.showFuncRetornoAreaRecibeDropdown = false, 150); }

    finalizarRetornoArea(): void {
        if (!this.canProceedRetornoArea()) return;
        this.closeRetornoAreaConfirm();
        const selItems = this.getSelectedArea();
        const formVal  = this.retornoAreaForm.value;
        const mov      = this.movAreaSeleccionado!;

        if (selItems.some(i => !i.toolId)) {
            this._showMsg('Herramienta(s) sin ID de sistema', 'error'); return;
        }

        this.isSavingRetornoArea = true;
        const itemsJson = JSON.stringify(selItems.map(item => ({
            tool_id:       Number(item.toolId),
            quantity:      item.cantidadRetorna,
            condicion:     item.condicion || 'BUENO',
            notes:         item.observacionItem || '',
            serial_number: item.sn  || '',
            part_number:   item.pn  || ''
        })));

        this.movSvc.registrarRetornoBase({
            type:                     'RETORNO_TRASPASO',
            date:                     formVal.fechaRetorno,
            time:                     new Date().toTimeString().slice(0, 8),
            requested_by_name:        formVal.recibeAlmacen || '',
            responsible_person:       formVal.recibeAlmacen || '',
            document_number:          formVal.nroDocumento,
            destination_warehouse_id: mov.source_warehouse_id,
            source_warehouse_id:      mov.destination_warehouse_id,
            notes:                    formVal.observaciones || '',
            specific_observations:    `Retorno de traspaso ${mov.movement_number}`,
            items_json:               itemsJson
        }).pipe(finalize(() => this.isSavingRetornoArea = false), takeUntil(this._unsub$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._showMsg(`Retorno registrado: ${nro}`, 'success');
                this._pdfRetornoArea(nro, selItems, formVal, mov);
                const ids = new Set(selItems.map(i => i.id));
                this.retornoAreaItems = this.retornoAreaItems.filter(i => !ids.has(i.id));
                if (this.retornoAreaItems.length === 0) {
                    this.movAreaSeleccionado = null;
                    this.cerrarFormRetornoArea();
                    this.movSvc.cerrarMovimiento(mov.id_movement)
                        .pipe(takeUntil(this._unsub$))
                        .subscribe({ next: () => { this.loadMovActivos(); }, error: () => this.loadMovActivos() });
                } else {
                    this.loadMovActivos();
                }
            },
            error: (err) => this._showMsg('Error al registrar: ' + (err?.message || ''), 'error')
        });
    }

    private _pdfRetornoArea(nro: string, items: TraspasoItem[], form: any, mov: MovimientoActivo): void {
        const now     = new Date().toLocaleString('es-BO');
        const fecha   = new Date(form.fechaRetorno).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const origen  = mov.destination_warehouse_name || '';
        const destino = mov.source_warehouse_name || '';
        const recibe  = form.recibeAlmacen || '';
        const movNro  = mov.movement_number || '';
        const condLabel: Record<string, string> = {
            'BUENO': 'BUENO', 'DAÑADO': 'DAÑADO',
            'REQUIERE_CALIBRACION': 'REQUIERE CALIB.', 'FALTANTE': 'FALTANTE'
        };

        const rows = items.map((it, i) => `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td><span style="font-family:monospace;font-weight:700;background:#0f172a;color:white;padding:1px 4px;border-radius:2px;font-size:9px">${it.codigo || '—'}</span></td>
                <td>${it.descripcion || '—'}</td>
                <td>${it.pn || '—'}</td>
                <td>${it.sn || '—'}</td>
                <td style="text-align:center;font-weight:700">${it.cantidadRetorna} / ${it.cantidadEnviada}</td>
                <td style="font-weight:bold;text-align:center;color:${it.condicion==='BUENO'?'#16a34a':it.condicion==='DAÑADO'?'#dc2626':'#d97706'}">${condLabel[it.condicion] || '—'}</td>
                <td>${it.observacionItem || ''}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Retorno Traspaso ${nro}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
  .code-box { border: 2px solid #000; padding: 3px 10px; font-weight: 900; font-size: 13px; display: inline-block; }
  .badge-ret { background: #fef3c7; border: 2px solid #b45309; color: #92400e; font-weight: 900; padding: 2px 8px; border-radius: 4px; display: inline-block; font-size: 11px; margin: 3px 0; }
  h1 { text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; background: #b45309; color: white; padding: 7px 10px; margin: 0 0 7px; border: 1px solid #000; }
  .info-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 7px; }
  .info-tbl td { border: 1px solid #ddd; padding: 3px 6px; }
  .lbl { background: #f0f0f0; font-weight: 700; font-size: 9px; width: 130px; }
  .nro-cell { background: #fef3c7; text-align: center; font-weight: 900; font-size: 15px; vertical-align: middle; width: 120px; color: #92400e; }
  .sec { background: #b45309; color: white; padding: 3px 8px; font-weight: 900; font-size: 10px; text-transform: uppercase; border: 1px solid #000; }
  table.det { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.det th { background: #b45309; color: white; padding: 5px 4px; font-size: 8.5px; font-weight: 900; text-transform: uppercase; border: 1px solid #000; text-align: center; }
  table.det td { padding: 4px; border: 1px solid #ddd; font-size: 9px; }
  table.det tr:nth-child(even) td { background: #fffbeb; }
  .nota { border: 1px solid #ccc; padding: 5px 8px; margin-top: 8px; font-size: 8.5px; background: #fffbeb; line-height: 1.5; }
  .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 18px; }
  .sig { border: 1px solid #000; padding: 6px 8px; text-align: center; }
  .sig-ttl { font-weight: 900; font-size: 9px; text-transform: uppercase; margin-bottom: 28px; }
  .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 8.5px; }
  .footer { text-align: center; margin-top: 10px; font-size: 7.5px; color: #888; border-top: 1px dotted #ccc; padding-top: 4px; }
</style>
<script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); };</script>
</head><body>
<div class="top">
  <div>
    <div class="code-box">BOA — Almacén Herramientas</div>
    <div class="badge-ret">↩ RETORNO DE TRASPASO ÁREA</div>
    <div style="font-size:9px;margin-top:2px;">Devolución de herramientas desde área/almacén externo</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9px;color:#555">Generado: ${now}</div>
  </div>
</div>

<h1>NOTA DE RETORNO DE TRASPASO DE ÁREA</h1>

<table class="info-tbl">
  <tr>
    <td class="lbl">Nro. Retorno</td><td class="nro-cell">${nro}</td>
    <td class="lbl">Traspaso origen</td><td><strong>${movNro}</strong></td>
  </tr>
  <tr>
    <td class="lbl">Desde (Área / Almacén)</td><td>${origen}</td>
    <td class="lbl">Retorna a (Almacén)</td><td>${destino}</td>
  </tr>
  <tr>
    <td class="lbl">Fecha Retorno</td><td>${fecha}</td>
    <td class="lbl">Recibe en almacén</td><td><strong>${recibe}</strong></td>
  </tr>
  <tr>
    <td class="lbl">Observaciones</td><td colspan="3">${form.observaciones || '—'}</td>
  </tr>
</table>

<div class="sec">DETALLE DE HERRAMIENTAS RETORNADAS</div>
<table class="det">
  <thead><tr>
    <th>#</th><th>Código</th><th>Descripción</th><th>P/N</th><th>S/N</th>
    <th>Cant. Ret./Env.</th><th>Condición</th><th>Observación ítem</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="sigs">
  <div class="sig">
    <div class="sig-ttl">Entrega desde Área<br>(${origen})</div>
    <div class="sig-line">Firma / Sello</div>
  </div>
  <div class="sig">
    <div class="sig-ttl">Recibe en Almacén<br>(${recibe})</div>
    <div class="sig-line">Firma / Sello</div>
  </div>
  <div class="sig">
    <div class="sig-ttl">Vo.Bo. Jefe Almacén</div>
    <div class="sig-line">Firma / Sello</div>
  </div>
</div>

<div class="nota">
  <strong>Nota:</strong> Este documento certifica el retorno de herramientas/equipos al almacén de origen.
  El responsable de almacén verifica el estado conforme al detalle. Traspaso origen: ${movNro} | Área: ${origen}
</div>
<div class="footer">BOLIVIANA DE AVIACIÓN — Almacén de Herramientas | Generado: ${now} | Doc Retorno: ${nro}</div>
</body></html>`;

        this._abrirBlob(html);
    }

    // ── HISTORIAL ─────────────────────────────────────────────────────────────

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
        this.movSvc.getHistorialMovimientos({ movement_type: 'entry', page: this.pageIndex + 1, limit: this.pageSize }).pipe(
            takeUntil(this._unsub$), finalize(() => this.isLoadingHistorial = false)
        ).subscribe({
            next: (response) => {
                if (response?.data?.length) {
                    const retornos = response.data.filter((item: any) =>
                        item.entry_reason === 'base_return' || item.entry_reason === 'transfer_return' ||
                        item.type === 'RETORNO_BASE' || item.type === 'RETORNO_TRASPASO'
                    );
                    this.historialRecords = retornos.map((item: any) => ({
                        id: item.id_movement || item.id,
                        fecha: new Date(item.date || item.fecha).toLocaleDateString('es-BO'),
                        tipo: item.entry_reason === 'base_return' || item.type === 'RETORNO_BASE'
                            ? 'RETORNO DE BASE' : 'RETORNO TRASPASO',
                        documento:    item.document_number || item.movement_number || '-',
                        responsable:  item.requested_by_name || '-',
                        estado:       (item.status || 'N/A').toUpperCase(),
                        raw: item
                    }));
                    this.totalHistorial = response.total || this.historialRecords.length;
                } else { this.historialRecords = []; }
            },
            error: () => this._showMsg('Error al cargar historial', 'error')
        });
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex; this.pageSize = event.pageSize; this.loadHistorial();
    }

    verDetalleHistorial(e: HistorialRecord): void { this.selectedHistorialEntry = e; }
    cerrarDetalleHistorial(): void { this.selectedHistorialEntry = null; }

    getStatusClass(estado: string): string {
        const map: Record<string, string> = {
            'APPROVED':   'bg-green-100 text-green-800 border-green-400',
            'COMPLETADO': 'bg-green-100 text-green-800 border-green-400',
            'PENDING':    'bg-yellow-100 text-yellow-800 border-yellow-400',
            'PENDIENTE':  'bg-yellow-100 text-yellow-800 border-yellow-400',
            'REVIEW':     'bg-blue-100 text-blue-800 border-blue-400',
        };
        return map[estado] || 'bg-gray-100 text-gray-800 border-gray-400';
    }

    // ── PDF GENERATION ────────────────────────────────────────────────────────

    private _pdfRetorno(nro: string, items: TraspasoItem[], form: any): void {
        const fecha       = new Date(form.fechaRetorno).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const tipo        = this.tipoOrigenActivo === 'BASE' ? 'RETORNO DE BASE' : 'RETORNO DE TRASPASO';
        const origen      = form.ubicacionOrigen?.nombre || '';
        const responsable = form.responsableRecibe || '';
        const condLabel: Record<string, string> = {
            BUENO: 'Bueno', DAÑADO: 'Dañado', REQUIERE_CALIBRACION: 'Req. Calibración', FALTANTE: 'Faltante'
        };
        const filas = items.map((it, i) => `
            <tr><td style="text-align:center">${i + 1}</td><td>${it.codigo}</td>
            <td>${it.descripcion}</td><td>${it.pn || '---'}</td><td>${it.sn || '---'}</td>
            <td style="text-align:center">${it.cantidadRetorna} / ${it.cantidadEnviada}</td>
            <td style="font-weight:bold;text-align:center">${condLabel[it.condicion] || '---'}</td>
            <td>${it.observacionItem || '---'}</td></tr>`).join('');
        this._abrirPdf(nro, tipo, filas, [
            ['Fecha Retorno', fecha], ['Nro. Documento', form.nroDocumento || '---'],
            ['Base/Almacén Origen', origen], ['Recibido por', responsable],
            ['Transportista', form.transportista || '---'], ['Observaciones', form.observaciones || '---']
        ], [['#','3%'],['Código BOA','8%'],['Descripción','24%'],['P/N','13%'],['S/N','11%'],
            ['Cant. Ret/Env','10%'],['Condición','12%'],['Observación','19%']],
            [origen, responsable]);
    }

    /** Carga el logo de BoA como data-URI (una sola vez, cacheado) para poder incrustarlo
     *  en el HTML que se abre en una pestaña nueva vía Blob — esa pestaña no comparte el
     *  árbol de assets de la app, así que una ruta relativa /images/... no es confiable ahí. */
    private _loadLogoBoaDataUri(): Promise<string> {
        if (!this._logoBoaDataUri) {
            this._logoBoaDataUri = fetch('/images/logo-boa.png')
                .then(r => r.blob())
                .then(blob => new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload  = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                }))
                .catch(() => '');
        }
        return this._logoBoaDataUri;
    }

    /** Nota de Traspaso — formato oficial MGH-109 (BoAMM OAM145# N-014), calcado del
     *  formulario Excel/impreso real. Piloto: por ahora solo se usa para TRASPASO DEFINITIVO. */
    private async _pdfTraspasoOficial(nro: string, items: ToolEnvioItem[], form: any): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();
        const now     = new Date();
        const fecha   = new Date(form.fechaTraspaso || now).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora    = form.horaTraspaso || now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

        const solicitante = form.responsableTraspaso || form.responsableEnvia || '---';
        const destino     = form.baseDestino?.nombre || form.areaDepartamento || '---';
        const recibe      = form.recibeEnDestino || '---';
        const autorizado  = form.autorizadoPor || '---';
        const tipoTrp     = this.getTransferTypeLabel(form.tipoTraspaso || '') || '---';
        // Licencia/Cargo no se guardan en el movimiento — se cruzan por nombre contra el
        // padrón de funcionarios (he.employees) al momento de generar el PDF, ver verPdfActivo().
        const licencia        = form.licenciaSolicitante || '---';
        const cargo           = form.cargoSolicitante     || '---';
        const cargoAutorizado = form.cargoAutorizado      || '---';
        // Desglose organizativo del destino (SCP-41) — texto libre, no hay catalogo.
        // Sin fallback a form.department (Gerencia Destino): son campos deliberadamente
        // separados, mostrar la Gerencia acá disfrazaría un destination_department vacío.
        const departamentoDestino = form.departamentoDestino || '---';
        const unidadDestino       = form.unidadDestino       || '---';

        const filas = items.map(it => `
            <tr>
                <td class="mono">${it.codigo || '---'}</td>
                <td class="mono">${it.pn || '---'}</td>
                <td class="mono">${it.sn || '---'}</td>
                <td class="tc">${it.unidad || '---'}</td>
                <td class="tc">${it.cantidad}</td>
                <td>${it.nombre || '---'}</td>
                <td>${it.listaContenido || '---'}</td>
                <td>${it.marca || '---'}</td>
                <td class="tc" style="font-size:8.5px">${it.fechaVencCal || '---'}</td>
                <td>${it.notas || '---'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Nota de Traspaso ${nro}</title>
<style>
  @page { size: A4; margin: 8mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }

  table.head-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 6px; }
  table.head-table td { border: 1px solid #000; padding: 4px 8px; vertical-align: middle; }
  .logo-cell { width: 22%; text-align: center; padding: 6px 8px; }
  .logo-cell img { max-width: 100%; max-height: 34px; }
  .logo-cell .oam { font-size: 8px; font-weight: 900; margin-top: 2px; }
  .title-cell { width: 58%; text-align: center; }
  .title-cell h1 { font-size: 14px; font-weight: 900; text-transform: uppercase; }
  .title-cell h2 { font-size: 10.5px; font-weight: 900; text-transform: uppercase; margin-top: 2px; }
  .code-cell { width: 20%; text-align: center; padding: 0; }
  .code-cell .mgh { font-size: 15px; font-weight: 900; padding: 6px 0; border-bottom: 1px solid #000; }
  .code-cell .rev-fecha { display: flex; font-size: 9px; font-weight: 700; }
  .code-cell .rev-fecha > div { flex: 1; padding: 3px 0; }
  .code-cell .rev-fecha > div:first-child { border-right: 1px solid #000; }

  table.meta-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.meta-table td { border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; height: 20px; }
  table.meta-table td b { font-weight: 900; }
  .nnota-cell { text-align: center; font-weight: 900; }
  .nnota-cell .lbl { font-size: 8px; text-transform: uppercase; }
  .nnota-cell .val { font-size: 12px; }

  .detalle-bar { background: #fff; border: 2px solid #000; border-top: none; text-align: center; font-weight: 900; font-size: 11px; text-transform: uppercase; padding: 3px; }

  table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.items th { border: 1px solid #000; background: #e5e7eb; font-size: 8px; font-weight: 900; text-transform: uppercase; padding: 4px 3px; }
  table.items td { border: 1px solid #000; padding: 4px 3px; font-size: 9px; min-height: 16px; }
  table.items tbody tr { height: 22px; }
  .tc { text-align: center; }
  .mono { font-family: monospace; }

  table.foot-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; }
  table.foot-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 9.5px; }
  .firma-lbl { font-weight: 900; }
  .firma-line { border-bottom: 1px solid #000; height: 30px; margin-top: 14px; }
  .firma-sub { text-align: center; font-size: 8.5px; font-weight: 700; margin-top: 2px; }
  .nota-importante { font-size: 8.5px; }
  .nota-importante b { font-style: italic; }
  .nota-importante ul { margin: 4px 0 0 12px; }
  .nota-importante li { margin-bottom: 5px; }

  table.autoriza-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 14px; }
  table.autoriza-table td { border: 1px solid #000; padding: 6px 8px; font-size: 9.5px; }

  @media print { body { padding: 0; } }
</style>
<script>window.onload = () => window.print();</script>
</head><body>

<table class="head-table">
  <tr>
    <td class="logo-cell" rowspan="2">
      ${logoUri ? `<img src="${logoUri}" alt="BoA">` : '<div style="font-weight:900;font-size:16px">BoA</div>'}
      <div class="oam">BoAMM &nbsp; OAM145# N-014</div>
    </td>
    <td class="title-cell" rowspan="2">
      <h1>Nota de Traspaso</h1>
      <h2>Herramientas, Bancos de Prueba y Equipos de Apoyo</h2>
    </td>
    <td class="code-cell">
      <div class="mgh">MGH-109</div>
      <div class="rev-fecha"><div>REV. 0</div><div>${fecha}</div></div>
    </td>
  </tr>
</table>

<table class="meta-table">
  <tr>
    <td style="width:16%"><b>NOMBRE DE SOLICITANTE:</b></td><td style="width:26%">${solicitante}</td>
    <td style="width:16%"><b>GERENCIA DESTINO:</b></td><td style="width:22%">${destino}</td>
    <td rowspan="5" class="nnota-cell" style="width:20%"><div class="lbl">N° Nota</div><div class="val">${nro}</div></td>
  </tr>
  <tr>
    <td><b>LICENCIA:</b></td><td>${licencia}</td>
    <td><b>DEPARTAMENTO:</b></td><td>${departamentoDestino}</td>
  </tr>
  <tr>
    <td><b>CARGO:</b></td><td>${cargo}</td>
    <td><b>UNIDAD:</b></td><td>${unidadDestino}</td>
  </tr>
  <tr>
    <td><b>FECHA Y HORA:</b></td><td>${fecha} ${hora}</td>
    <td><b>TIPO TRASPASO:</b></td><td>${tipoTrp}</td>
  </tr>
  <tr>
    <td colspan="1"><b>OBSERVACIONES:</b></td><td colspan="3">${form.notas || '---'}</td>
  </tr>
</table>

<div class="detalle-bar">Detalle</div>
<table class="items">
  <thead><tr>
    <th style="width:8%">Código</th><th style="width:10%">P/N ó Modelo</th><th style="width:9%">S/N</th>
    <th style="width:6%">Unidad</th><th style="width:5%">Cant.</th><th style="width:14%">Nombre</th>
    <th style="width:14%">Lista de Contenido</th><th style="width:9%">Marca</th>
    <th style="width:10%">Fecha de Calibración</th><th style="width:15%">Obs</th>
  </tr></thead>
  <tbody>${filas || '<tr><td colspan="10" class="tc">Sin ítems</td></tr>'}</tbody>
</table>

<table class="foot-table">
  <tr>
    <td style="width:27%">
      <div class="firma-lbl">ENTREGADO POR:</div>
      <div class="firma-line"></div>
      <div class="firma-sub">Firma Almacén Herramientas — ${solicitante}</div>
    </td>
    <td style="width:27%">
      <div class="firma-lbl">RECIBIDO POR:</div>
      <div class="firma-line"></div>
      <div class="firma-sub">Firma recepción — ${recibe}</div>
    </td>
    <td style="width:46%" class="nota-importante">
      <b>NOTA IMPORTANTE:</b>
      <ul>
        <li>Las herramientas descritas en la presente nota se encuentran en condición SERVICIABLE, a menos que se indique lo contrario en la casilla de OBSERVACIONES.</li>
        <li>La firma de la presente nota implica que se está en conformidad con toda la información detallada.</li>
      </ul>
    </td>
  </tr>
</table>

<table class="autoriza-table">
  <tr>
    <td style="width:20%"><b>AUTORIZADO POR</b></td>
    <td style="width:16%"><b>Nombre:</b></td><td style="width:24%">${autorizado}</td>
    <td style="width:12%"><b>Cargo:</b></td><td style="width:28%">${cargoAutorizado}</td>
  </tr>
  <tr>
    <td></td>
    <td colspan="2"><div class="firma-line"></div><div class="firma-sub">Firma</div></td>
    <td colspan="2"></td>
  </tr>
</table>

</body></html>`;
        this._abrirBlob(html);
    }

    private _pdfEnvio(nro: string, items: ToolEnvioItem[], form: any, tipo: string): void {
        if (tipo === 'TRASPASO DEFINITIVO') { this._pdfTraspasoOficial(nro, items, form); return; }
        const fecha       = new Date(form.fechaEnvio || form.fechaTraspaso || new Date()).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const destino     = form.baseDestino?.nombre || form.areaDepartamento || '---';
        const responsable = form.responsableEnvia || form.responsableTraspaso || '---';
        const recibe      = form.recibeEnDestino || null;
        const autorizado  = form.autorizadoPor || null;
        const esTraspaso  = tipo === 'TRASPASO DEFINITIVO';
        const condLabel: Record<string, string> = {
            excellent: 'Excelente', good: 'Bueno', fair: 'Regular', damaged: 'Dañado'
        };
        const filas = items.map((it, i) => `
            <tr><td style="text-align:center">${i + 1}</td><td>${it.codigo}</td>
            <td>${it.nombre}</td><td>${it.pn || '---'}</td><td>${it.sn || '---'}</td>
            ${esTraspaso ? `<td>${it.marca || '---'}</td><td style="font-size:9px">${it.fechaVencCal || '---'}</td>` : ''}
            <td style="text-align:center">${it.cantidad}</td>
            <td style="text-align:center">${condLabel[it.condicion] || it.condicion}</td>
            <td>${it.notas || '---'}</td></tr>`).join('');

        const campos: [string, string][] = esTraspaso ? [
            ['Fecha',                fecha],
            ['Almacén Origen',       form.baseOrigen?.nombre || '---'],
            ['Área / Base Destino',  destino],
            ['Responsable / Envía',  responsable],
            ['Recibe en Destino',    recibe   || '---'],
            ['Autorizado por',       autorizado || '---'],
            ['Notas',                form.notas || '---']
        ] : [
            ['Fecha',                fecha],
            ['Destino / Área',       destino],
            ['Responsable',          responsable],
            ['Nro. Documento',       form.nroDocumento     || '---'],
            ['Fecha Esp. Retorno',   form.fechaEsperadaRetorno || 'N/A'],
            ['Nro. Vuelo',           form.nroVuelo         || '---'],
            ['Aeronave',             form.aeronave         || '---'],
            ['Tipo Envío',           form.tipoEnvio         || 'EVENTUAL'],
            ['Notas',                form.notas            || '---']
        ];

        // Traspaso: 3 firmas (Envía / Recibe / Autorizado) cuando hay autorizado,
        // si no hay autorizado 2 firmas (Envía / Recibe usando área destino)
        const firmas: [string, string] | [string, string, string] = esTraspaso
            ? (autorizado
                ? [responsable, recibe || destino, autorizado]
                : [responsable, recibe || destino])
            : [responsable, destino];

        const columnas: [string, string][] = esTraspaso
            ? [['#','3%'],['Código BOA','8%'],['Descripción','18%'],['P/N','10%'],['S/N','9%'],
               ['Marca','8%'],['Venc. Cal.','9%'],['Cant.','5%'],['Condición','10%'],['Notas','20%']]
            : [['#','3%'],['Código BOA','8%'],['Descripción','24%'],['P/N','13%'],['S/N','11%'],
               ['Cant.','7%'],['Condición','12%'],['Observación','22%']];
        this._abrirPdf(nro, tipo, filas, campos, columnas, firmas as [string, string]);
    }

    /** Genera la Solicitud de Envío CO-MAT (formato OAM145# N-014 de BoAMM) */
    private _pdfCoMat(nro: string, items: ToolEnvioItem[], form: any): void {
        const now  = new Date();
        const fecha = now.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora  = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
        const origen  = form.baseOrigen?.nombre  || form.baseOrigen?.codigo  || 'ALMACÉN CBB';
        const destino = form.baseDestino?.nombre || form.baseDestino?.codigo || '---';
        const responsable = form.responsableEnvia || '---';
        const recibe      = form.recibeEnDestino  || '';
        const nVuelo      = form.nroVuelo  || '---';
        const aeronave    = form.aeronave  || '---';
        const tipoEnvio   = form.tipoEnvio || 'EVENTUAL';
        const nBultos     = items.length;

        const rows = items.map((it, i) => `
            <tr>
                <td class="tc">${i + 1}</td>
                <td class="tc"><strong>${it.cantidad}</strong></td>
                <td>${it.nombre || '-'}</td>
                <td class="mono">${it.pn || '---'}</td>
                <td class="mono">${it.sn || '---'}</td>
                <td class="mono">${it.codigo || '-'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>CO-MAT ${nro}</title>
<style>
  @page { size: A4; margin: 10mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }

  /* ── ENCABEZADO ── */
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
  .top-left { font-size: 8.5px; color: #555; line-height: 1.6; }
  .top-center { text-align: center; flex: 1; }
  .top-center h1 { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  .top-center .subtitle { font-size: 9px; color: #555; margin-top: 1px; }
  .top-right { text-align: right; }
  .nro-box { border: 2.5px solid #000; padding: 5px 14px; font-size: 16px; font-weight: 900; letter-spacing: 1px; display: inline-block; }
  .tipo-badge { display: inline-block; background: ${tipoEnvio === 'PERMANENTE' ? '#fbbf24' : '#dcfce7'}; border: 1.5px solid #000; font-weight: 900; font-size: 9px; padding: 2px 7px; border-radius: 3px; margin-top: 3px; }

  /* ── GRID DATOS ── */
  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px 14px; margin-bottom: 8px; border: 1.5px solid #ddd; border-radius: 4px; padding: 7px 10px; }
  .field label { display: block; font-size: 7.5px; font-weight: 900; text-transform: uppercase; color: #666; margin-bottom: 1px; }
  .field span { display: block; font-weight: 700; font-size: 10px; border-bottom: 1px solid #ccc; padding-bottom: 1px; min-height: 13px; }

  /* ── TABLA ── */
  .sec-title { background: #0f172a; color: #fff; font-size: 9px; font-weight: 900; text-transform: uppercase; padding: 4px 8px; letter-spacing: 0.5px; margin-bottom: 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th { background: #334155; color: #fff; padding: 4px 5px; font-size: 8.5px; font-weight: 900; text-transform: uppercase; text-align: left; border: 1px solid #000; }
  td { padding: 3.5px 5px; border: 1px solid #ddd; font-size: 9px; }
  tr:nth-child(even) td { background: #f8f9fc; }
  .tc { text-align: center; }
  .mono { font-family: monospace; font-size: 9px; }

  /* ── PIE ── */
  .cargo-info { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 5px 10px; border: 1.5px solid #000; border-radius: 4px; padding: 6px 10px; margin-bottom: 10px; }
  .cargo-field label { font-size: 7.5px; font-weight: 900; text-transform: uppercase; color: #555; display: block; }
  .cargo-field span { font-weight: 700; font-size: 10px; border-bottom: 1px solid #aaa; display: block; min-height: 13px; padding-bottom: 1px; }

  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 14px; }
  .firma { border: 1.5px solid #000; padding: 6px 8px; }
  .firma-title { font-size: 8px; font-weight: 900; text-transform: uppercase; background: #0f172a; color: #fff; padding: 3px 6px; margin: -6px -8px 8px; letter-spacing: 0.3px; }
  .firma-row { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
  .firma-item label { font-size: 7.5px; text-transform: uppercase; font-weight: 900; color: #555; display: block; }
  .firma-item span { border-bottom: 1px solid #000; display: block; min-height: 16px; font-size: 9px; font-weight: 700; min-width: 100px; padding-bottom: 1px; }
  .firma-sign { height: 34px; border-bottom: 1px solid #000; margin-top: 4px; }

  .footer { text-align: center; font-size: 7.5px; color: #888; margin-top: 10px; border-top: 1px dotted #ccc; padding-top: 4px; }
  @media print { body { padding: 0; } }
</style>
<script>window.onload = () => window.print();</script>
</head><body>

<!-- ENCABEZADO -->
<div class="top">
  <div class="top-left">
    <div><strong>BoAMM</strong>  OAM145# N-014</div>
    <div>BOLIVIANA DE AVIACIÓN</div>
    <div>Almacén de Herramientas</div>
  </div>
  <div class="top-center">
    <h1>Solicitud de Envío</h1>
    <div class="subtitle">CO-MAT — Comprobante de Movimiento de Material</div>
    <div class="tipo-badge">${tipoEnvio}</div>
  </div>
  <div class="top-right">
    <div class="nro-box">${nro}</div>
    <div style="font-size:8px;color:#555;margin-top:4px">Fecha: ${fecha} ${hora}</div>
  </div>
</div>

<!-- DATOS PRINCIPALES -->
<div class="meta">
  <div class="field"><label>Origen / Almacén</label><span>${origen}</span></div>
  <div class="field"><label>Base Destino</label><span>${destino}</span></div>
  <div class="field"><label>Fecha Retorno Esperada</label><span>${tipoEnvio === 'PERMANENTE' ? (form.fechaEsperadaRetorno || '---') : 'No aplica (Eventual)'}</span></div>
  <div class="field"><label>Responsable / Envía</label><span>${responsable}</span></div>
  <div class="field"><label>Recibe en Destino</label><span>${recibe || '---'}</span></div>
  <div class="field"><label>Nro. Vuelo / Aeronave</label><span>${nVuelo !== '---' || aeronave !== '---' ? nVuelo + ' / ' + aeronave : '---'}</span></div>
</div>

<!-- TABLA ITEMS -->
<div class="sec-title">Detalle de Herramientas / Equipos</div>
<table>
  <thead>
    <tr>
      <th style="width:4%">ITEM</th>
      <th style="width:6%">CANT.</th>
      <th style="width:35%">DESCRIPCIÓN</th>
      <th style="width:18%">MODELO / P/N</th>
      <th style="width:15%">SERIAL NUMBER</th>
      <th style="width:12%">CÓDIGO BOA</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<!-- DATOS DE CARGA -->
<div class="cargo-info">
  <div class="cargo-field"><label>ORIGEN</label><span>${origen}</span></div>
  <div class="cargo-field"><label>Nº DE BULTOS</label><span>${nBultos}</span></div>
  <div class="cargo-field"><label>PESO (Kg)</label><span>&nbsp;</span></div>
  <div class="cargo-field"><label>SERIAL NUMBER (Envío)</label><span>${nro}</span></div>
</div>

<!-- FIRMAS -->
<div class="firmas">
  <div class="firma">
    <div class="firma-title">ENTREGUE CONFORME / MM-CBB</div>
    <div class="firma-row">
      <div class="firma-item"><label>Nombre</label><span>${responsable}</span></div>
      <div class="firma-item"><label>Fecha / Hora</label><span>${fecha} ${hora}</span></div>
    </div>
    <div class="firma-sign"></div>
    <div style="font-size:7.5px;text-align:center;margin-top:3px;color:#555;font-weight:700">FIRMA / SELLO</div>
  </div>
  <div class="firma">
    <div class="firma-title">RECIBI CONFORME / CARGA-VOA</div>
    <div class="firma-row">
      <div class="firma-item"><label>Nombre</label><span>${recibe || '&nbsp;'}</span></div>
      <div class="firma-item"><label>Fecha / Hora</label><span>&nbsp;</span></div>
    </div>
    <div class="firma-sign"></div>
    <div style="font-size:7.5px;text-align:center;margin-top:3px;color:#555;font-weight:700">FIRMA / SELLO</div>
  </div>
</div>

<div class="footer">
  BOLIVIANA DE AVIACIÓN — Almacén de Herramientas · CO-MAT | Generado: ${now.toLocaleString('es-BO')} | Nro: ${nro}
</div>
</body></html>`;
        this._abrirBlob(html);
    }

    /** Genera el "Reporte de Discrepancia" para items devueltos DAÑADOS o FALTANTES */
    private _pdfDiscrepancia(nro: string, items: TraspasoItem[], form: any): void {
        const fecha       = form.fechaRetorno
            ? new Date(form.fechaRetorno).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : new Date().toLocaleDateString('es-BO');
        const responsable = form.responsableRecibe || '---';
        const condLabel: Record<string, string> = {
            DAÑADO: 'DAÑADO / NO SERVICIABLE', FALTANTE: 'FALTANTE',
            BUENO: 'Bueno', REQUIERE_CALIBRACION: 'Req. Calibración'
        };
        const rows = items.map((it, i) => `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td><span style="font-family:monospace;font-weight:700;background:#0f172a;color:#fff;padding:1px 5px;border-radius:2px;font-size:9px">${it.codigo || '-'}</span></td>
                <td>${it.descripcion || '-'}</td>
                <td style="font-family:monospace;font-size:9px">${it.pn || '-'}</td>
                <td style="font-family:monospace;font-size:9px">${it.sn || '-'}</td>
                <td style="font-weight:900;color:#dc2626;text-align:center">${condLabel[it.condicion] || it.condicion || '-'}</td>
                <td>${it.observacionItem || '---'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte de Discrepancia ${nro}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #dc2626; padding-bottom: 8px; margin-bottom: 10px; }
  .title { font-size: 16px; font-weight: 900; text-transform: uppercase; color: #dc2626; margin: 0; letter-spacing: 0.5px; }
  .subtitle { font-size: 9px; color: #555; margin: 2px 0 0; }
  .nro-box { background: #dc2626; color: #fff; font-weight: 900; font-size: 13px; padding: 6px 14px; border-radius: 4px; }
  .alert { background: #fef2f2; border: 2px solid #dc2626; border-radius: 5px; padding: 7px 12px; margin-bottom: 10px; font-size: 9px; font-weight: 700; color: #991b1b; line-height: 1.5; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px 14px; margin-bottom: 10px; }
  .field label { display: block; font-size: 8px; font-weight: 900; text-transform: uppercase; color: #666; }
  .field span { display: block; font-weight: 700; font-size: 10px; border-bottom: 1px solid #ccc; padding-bottom: 1px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9.5px; }
  th { background: #dc2626; color: #fff; padding: 5px 4px; text-align: left; font-size: 8.5px; text-transform: uppercase; }
  td { padding: 4px; border-bottom: 1px solid #fca5a5; }
  tr:nth-child(even) td { background: #fff5f5; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 22px; }
  .firma { border-top: 2px solid #000; padding-top: 6px; text-align: center; font-size: 9.5px; font-weight: 700; }
  .firma-red { border-top: 2px solid #dc2626 !important; background: #fff5f5; padding: 6px 4px 4px; }
  .footer { text-align: center; font-size: 7.5px; color: #888; margin-top: 12px; border-top: 1px dotted #ccc; padding-top: 4px; }
  @media print { body { padding: 0; } }
</style>
<script>window.onload = () => window.print();</script>
</head><body>
<div class="header">
  <div>
    <h1 class="title">Reporte de Discrepancia</h1>
    <div class="subtitle">BOLIVIANA DE AVIACIÓN — Almacén de Herramientas · Retorno con novedades</div>
  </div>
  <div class="nro-box">${nro}</div>
</div>
<div class="alert">
  ⚠ Este documento certifica el retorno de herramientas en condición <strong>NO SERVICIABLE</strong> (Dañada/Faltante).
  Requiere investigación, acción correctiva y firmas de los responsables antes de archivarse.
</div>
<div class="grid">
  <div class="field"><label>Nro. Documento Retorno</label><span>${nro}</span></div>
  <div class="field"><label>Fecha de Retorno</label><span>${fecha}</span></div>
  <div class="field"><label>Responsable</label><span>${responsable}</span></div>
  <div class="field"><label>Nro. Referencia (COMAT/TRP)</label><span>${form.nroDocumento || '---'}</span></div>
  <div class="field"><label>Origen / Base</label><span>${form.ubicacionOrigen?.nombre || '---'}</span></div>
  <div class="field"><label>Observaciones Generales</label><span>${form.observaciones || '---'}</span></div>
</div>
<table>
  <thead>
    <tr>
      <th style="width:3%">#</th>
      <th style="width:9%">Código BOA</th>
      <th style="width:27%">Descripción</th>
      <th style="width:12%">P/N</th>
      <th style="width:10%">S/N</th>
      <th style="width:14%">Condición</th>
      <th style="width:25%">Descripción de Avería / Novedades</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="firmas">
  <div class="firma"><div style="height:36px"></div>ENTREGA CONFORME<br>${responsable}</div>
  <div class="firma"><div style="height:36px"></div>RECIBE — ALMACÉN<br>Firma / Sello</div>
  <div class="firma firma-red">
    <div style="height:36px"></div>
    <span style="color:#991b1b;font-size:8.5px;font-weight:900;display:block;margin-bottom:2px">AUTORIZADO / JEFE ALMACÉN</span>
    Firma / Sello
  </div>
</div>
<div class="footer">BOLIVIANA DE AVIACIÓN — Almacén de Herramientas | Generado: ${new Date().toLocaleString('es-BO')} | Doc: ${nro}</div>
</body></html>`;
        this._abrirBlob(html);
    }

    private _abrirPdf(
        nro: string, tipo: string, filas: string,
        campos: [string, string][],
        columnas: [string, string][],
        firmas: [string, string] | [string, string, string]
    ): void {
        const camposHtml = campos.map(([l, v]) =>
            `<div class="field"><label>${l}</label><span>${v}</span></div>`).join('');
        const thHtml = columnas.map(([l, w]) =>
            `<th style="width:${w}">${l}</th>`).join('');
        const cols   = firmas.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr';
        const f0     = firmas[0], f1 = firmas[1], f2 = (firmas as any)[2];
        const firmasHtml = f2
            ? `<div class="firma"><div style="height:36px"></div>ENTREGA CONFORME<br>${f0}</div>
               <div class="firma"><div style="height:36px"></div>RECIBE CONFORME<br>${f1}</div>
               <div class="firma" style="background:#fffde7;border-top:3px solid #f59e0b">
                 <div style="height:36px"></div>
                 <span style="font-size:9px;color:#92400e;font-weight:900;display:block;margin-bottom:2px">AUTORIZADO POR</span>
                 ${f2}
               </div>`
            : `<div class="firma"><div style="height:36px"></div>ENTREGA CONFORME<br>${f0}</div>
               <div class="firma"><div style="height:36px"></div>RECIBE CONFORME<br>${f1}</div>`;
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${nro}</title>
<style>
body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
.header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:12px}
.header h1{font-size:15px;font-weight:900;text-transform:uppercase;margin:0}
.nro{background:#0f172a;color:#fff;padding:6px 14px;font-size:14px;font-weight:900;border-radius:4px}
.badge{display:inline-block;background:#fbbf24;color:#000;font-weight:900;padding:2px 8px;border-radius:3px;border:1px solid #000;font-size:10px;margin-bottom:6px}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 16px;margin-bottom:12px}
.field label{display:block;font-size:9px;font-weight:900;text-transform:uppercase;color:#555}
.field span{display:block;font-weight:700;font-size:11px;border-bottom:1px solid #ccc;padding-bottom:2px}
table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10px}
th{background:#0f172a;color:#fff;padding:5px 4px;text-align:left;font-size:9px;text-transform:uppercase}
td{padding:4px;border-bottom:1px solid #ddd}
tr:nth-child(even) td{background:#f8f9fc}
.firmas{display:grid;grid-template-columns:${cols};gap:20px;margin-top:24px}
.firma{border-top:2px solid #000;padding-top:6px;text-align:center;font-size:10px;font-weight:700}
@media print{body{padding:10px}}
</style></head><body>
<div class="header">
  <div><div class="badge">${tipo}</div>
  <h1>Acta de ${tipo}</h1>
  <div style="font-size:10px;color:#555">BOLIVIANA DE AVIACIÓN — Almacén de Herramientas</div></div>
  <div class="nro">${nro}</div>
</div>
<div class="grid">${camposHtml}</div>
<table><thead><tr>${thHtml}</tr></thead><tbody>${filas}</tbody></table>
<div class="firmas">${firmasHtml}</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
        this._abrirBlob(html);
    }

    private _abrirBlob(html: string): void {
        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
}
