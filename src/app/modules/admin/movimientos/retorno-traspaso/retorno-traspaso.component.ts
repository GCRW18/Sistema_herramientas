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
    switchMap, of, forkJoin, map
} from 'rxjs';

import { MovementService } from '../../../../core/services/movement.service';
import { ToolService } from '../../../../core/services/tool.service';

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
    cantidad: number;
    condicion: string;
    notas: string;
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
    document_number: string;
    notes: string;
    items_count: number;
    expanded?: boolean;
}

interface PersonaTecnico {
    id: string;
    nombre: string;
    cargo: string;
    licencia: string;
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
        MatProgressSpinnerModule, MatCheckboxModule, MatTooltipModule
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
    @ViewChild('traspasoTecnicoFormDialog') traspasoTecnicoFormDialog!: TemplateRef<any>;
    @ViewChild(MatPaginator) paginator!: MatPaginator;

    public dialogRef = inject(MatDialogRef<RetornoTraspasoComponent>, { optional: true });
    private dialog   = inject(MatDialog);
    private fb       = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private movSvc   = inject(MovementService);
    private toolSvc  = inject(ToolService);
    private _unsub$  = new Subject<void>();
    private _envioDialogRef: any         = null;
    private _traspasoDialogRef: any      = null;
    private _retornoDialogRef: any       = null;
    private _tecnicoDialogRef: any       = null;

    // ── Tab navigation ────────────────────────────────────────────────────────
    activeTab: ActiveTab = 'activos';

    // ── Shared data ───────────────────────────────────────────────────────────
    bases: Ubicacion[]    = [];
    almacenes: Ubicacion[] = [];
    isLoading = false;

    // ── ENVÍO tab ─────────────────────────────────────────────────────────────
    envioForm!: FormGroup;
    itemsEnvio: ToolEnvioItem[]  = [];
    toolSearchEnvio              = '';
    toolResultsEnvio: any[]      = [];
    showToolDropEnvio            = false;
    searchingToolsEnvio          = false;
    isSavingEnvio                = false;
    private _srchEnvio$          = new Subject<string>();

    // ── TRASPASO tab ──────────────────────────────────────────────────────────
    traspasoForm!: FormGroup;
    itemsTraspaso: ToolEnvioItem[] = [];
    toolSearchTraspaso             = '';
    toolResultsTraspaso: any[]     = [];
    showToolDropTraspaso           = false;
    searchingToolsTraspaso         = false;
    isSavingTraspaso               = false;
    private _srchTraspaso$         = new Subject<string>();

    // ── RETORNO tab ───────────────────────────────────────────────────────────
    retornoForm!: FormGroup;
    tipoOrigenActivo: TipoOrigen = 'BASE';
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
    loadingActivos                      = false;
    filterActivos: 'TODOS' | 'ENVIO_BASE' | 'TRASPASO' = 'TODOS';
    loadingPdfActivo: number | null     = null;

    // ── TRASPASO TÉCNICO tab ──────────────────────────────────────────────────
    traspasoTecnicoForm!: FormGroup;
    itemsTraspasoTecnico: ToolEnvioItem[] = [];
    toolSearchTecnico                     = '';
    toolResultsTecnico: any[]             = [];
    showToolDropTecnico                   = false;
    searchingToolsTecnico                 = false;
    isSavingTraspasoTecnico               = false;
    private _srchTecnico$                 = new Subject<string>();
    personasTecnico: PersonaTecnico[]     = [];
    personaTecnicoLoading                 = false;
    showPersonaTecnicoDropdown            = false;

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
        this._loadUbicaciones();
        this._setupToolSearchEnvio();
        this._setupToolSearchTraspaso();
        this._setupToolSearchTecnico();
        this._setupFuncSearch();
        this._setupFuncSearchEnvio();
        this._setupPersonaTecnicoSearch();
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
        this._resetEnvioTab();
        this._envioDialogRef = this.dialog.open(this.envioFormDialog, {
            width: 'min(1040px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false
        });
    }
    cerrarFormEnvio(): void { this._envioDialogRef?.close(); }

    abrirFormTraspaso(): void {
        this._resetTraspasoTab();
        this._traspasoDialogRef = this.dialog.open(this.traspasoFormDialog, {
            width: 'min(1040px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false
        });
    }
    cerrarFormTraspaso(): void { this._traspasoDialogRef?.close(); }

    abrirFormRetorno(): void {
        this.allData = []; this.dataSource = [];
        this.retornoForm.patchValue({ ubicacionOrigen: null, searchText: '' });
        this.tipoOrigenActivo = 'BASE';
        this._retornoDialogRef = this.dialog.open(this.retornoFormDialog, {
            width: 'min(1100px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false
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
            fechaEsperadaRetorno:['', Validators.required],
            nroVuelo:            [''],
            aeronave:            [''],
            prioridad:           ['NORMAL'],
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
            cantidad: 1, condicion: 'good', notas: ''
        });
        this.toolSearchEnvio = ''; this.toolResultsEnvio = []; this.showToolDropEnvio = false;
    }

    removeToolEnvio(i: number): void { this.itemsEnvio.splice(i, 1); }

    canSaveEnvio(): boolean {
        return this.envioForm.valid && this.itemsEnvio.length > 0 && !this.isSavingEnvio;
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
            expected_return_date:form.fechaEsperadaRetorno || '',
            notes:               form.notas            || '',
            specific_observations: [
                form.nroVuelo  ? `Vuelo: ${form.nroVuelo}`         : '',
                form.aeronave  ? `Aeronave: ${form.aeronave}`       : '',
                form.prioridad && form.prioridad !== 'NORMAL' ? `Prioridad: ${form.prioridad}` : ''
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
            prioridad:  'NORMAL'
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
            baseOrigen:         [null],
            areaDepartamento:   ['', Validators.required],
            fechaTraspaso:      [today, Validators.required],
            horaTraspaso:       [hora],
            responsableTraspaso:['', Validators.required],
            autorizadoPor:      [''],
            notas:              ['']
        });
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
        this.movSvc.registrarTraspasoOtraArea({
            date: form.fechaTraspaso, time: (form.horaTraspaso || '00:00') + ':00',
            source_warehouse_id: form.baseOrigen?.id ? Number(form.baseOrigen.id) : undefined,
            responsible_person:  form.responsableTraspaso || '',
            department:          form.areaDepartamento    || '',
            exit_reason:         'transfer',
            authorized_by:       form.autorizadoPor       || '',
            notes:               form.notas               || '',
            general_observations: '',
            items_json: itemsJson
        }).pipe(finalize(() => this.isSavingTraspaso = false), takeUntil(this._unsub$)).subscribe({
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
        this.itemsTraspaso = [];
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
        this.retornoForm.patchValue({ responsableRecibe: func.nombre });
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
        this.envioForm.patchValue({ responsableEnvia: func.nombre });
        this.funcionariosEnvia = []; this.showFuncEnviaDropdown = false;
    }

    selectFuncionarioRecibe(func: Funcionario): void {
        this.envioForm.patchValue({ recibeEnDestino: func.nombre });
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
            specific_observations: formVal.transportista ? `Transportista: ${formVal.transportista}` : '',
            items_json: itemsJson
        }).pipe(finalize(() => this.isSavingRetorno = false), takeUntil(this._unsub$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._showMsg(`Retorno registrado: ${nro}`, 'success');
                const ids = new Set(selItems.map(i => i.id));
                this.allData    = this.allData.filter(i => !ids.has(i.id));
                this.dataSource = this.dataSource.filter(i => !ids.has(i.id));
                this._pdfRetorno(nro, selItems, formVal);
                if (this.dataSource.length === 0) this._retornoDialogRef?.close();
                this.loadMovActivos();
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
        this.loadingActivos = true;
        this.movSvc.listarEnviosActivos({ limit: 200 }).pipe(
            takeUntil(this._unsub$), finalize(() => this.loadingActivos = false)
        ).subscribe({
            next: (data: any[]) => {
                this.movActivos = data.map((m: any) => ({
                    id_movement:                m.id_movement,
                    movement_number:            m.movement_number  || '',
                    movement_type_label:        m.movement_type_label || m.type || '',
                    send_date:                  m.send_date  || m.date  || '',
                    expected_return_date:       m.expected_return_date || null,
                    days_remaining:             m.days_remaining != null ? Number(m.days_remaining) : null,
                    alert_status:               m.alert_status || 'SIN_FECHA',
                    source_warehouse_id:        m.source_warehouse_id,
                    destination_warehouse_id:   m.destination_warehouse_id,
                    source_warehouse_name:      m.source_warehouse_name      || '',
                    destination_warehouse_name: m.destination_warehouse_name || '',
                    requested_by_name:          m.requested_by_name  || '',
                    received_by_name:           m.received_by_name   || '',
                    department:                 m.department         || '',
                    document_number:            m.document_number    || '',
                    notes:                      m.notes              || '',
                    items_count:                Number(m.items_count) || 0,
                    expanded: false
                }));
                this._applyFilterActivos();
            },
            error: () => this._showMsg('Error al cargar movimientos activos', 'error')
        });
    }

    setFilterActivos(f: 'TODOS' | 'ENVIO_BASE' | 'TRASPASO'): void {
        this.filterActivos = f;
        this._applyFilterActivos();
    }

    private _applyFilterActivos(): void {
        if (this.filterActivos === 'TODOS') {
            this.movActivosFiltrados = [...this.movActivos];
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
        return t === 'TRASPASO' ? 'bg-amber-400 text-black border-black' : 'bg-blue-600 text-white border-blue-900';
    }

    registrarRetornoDesdeActivo(mov: MovimientoActivo): void {
        const tipoOrigen: TipoOrigen = mov.movement_type_label === 'TRASPASO' ? 'TRASPASO' : 'BASE';
        this.tipoOrigenActivo = tipoOrigen;

        const ubicacion = this.getAllUbicaciones().find(u =>
            u.nombre === mov.destination_warehouse_name ||
            String(u.id) === String(mov.destination_warehouse_id)
        ) || null;

        this.retornoForm.patchValue({
            tipoOrigen,
            ubicacionOrigen: ubicacion,
            fechaRetorno: new Date().toISOString().split('T')[0]
        });
        this.allData = []; this.dataSource = [];
        this._showMsg(`Registrando retorno de ${mov.movement_number}`, 'info');
        this._retornoDialogRef = this.dialog.open(this.retornoFormDialog, {
            width: 'min(1100px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false
        });
    }

    verPdfActivo(mov: MovimientoActivo): void {
        this.loadingPdfActivo = mov.id_movement;
        this.movSvc.getMovementItems(Number(mov.id_movement))
            .pipe(takeUntil(this._unsub$), finalize(() => this.loadingPdfActivo = null))
            .subscribe({
                next: (rawItems: any[]) => {
                    const items: ToolEnvioItem[] = (rawItems || []).map((item: any) => ({
                        toolId:    Number(item.tool_id || item.toolId || 0),
                        codigo:    item.tool?.code || item.code || '',
                        nombre:    item.tool?.description || item.tool?.name || item.name || item.description || '',
                        pn:        item.tool?.part_number || item.part_number || '',
                        sn:        item.tool?.serial_number || item.serial_number || '',
                        cantidad:  Number(item.quantity) || 1,
                        condicion: item.condition_state || 'good',
                        notas:     item.notes || '',
                    }));
                    const tipo = mov.movement_type_label === 'TRASPASO' ? 'TRASPASO DEFINITIVO' : 'ENVÍO A BASE';
                    const fakeForm = {
                        fechaEnvio:           mov.send_date,
                        fechaTraspaso:        mov.send_date,
                        baseDestino:          { nombre: mov.destination_warehouse_name },
                        areaDepartamento:     mov.destination_warehouse_name,
                        responsableEnvia:     mov.requested_by_name,
                        responsableTraspaso:  mov.requested_by_name,
                        nroDocumento:         mov.document_number,
                        fechaEsperadaRetorno: mov.expected_return_date || 'N/A',
                        notas: '',
                    };
                    this._pdfEnvio(mov.movement_number, items, fakeForm, tipo);
                },
                error: () => this._showMsg('Error al generar PDF', 'error'),
            });
    }

    // ── TRASPASO TÉCNICO (MGH-109) ────────────────────────────────────────────

    private _initTraspasoTecnicoForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const hora  = new Date().toTimeString().slice(0, 5);
        this.traspasoTecnicoForm = this.fb.group({
            nombreCompletoInput: ['', Validators.required],
            nombreCompleto:      [''],
            nroLicencia:         ['', Validators.required],
            cargo:               ['', Validators.required],
            fecha:               [today, Validators.required],
            hora:                [hora],
            gerencia:            ['', Validators.required],
            unidad:              ['', Validators.required],
            base:                ['VVI', Validators.required],
            tipoTraspaso:        ['TEMPORAL', Validators.required],
            observaciones:       ['']
        });
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
                            licencia: f.licencia ?? f.nro_licencia ?? ''
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
    }

    abrirFormTraspasoTecnico(): void {
        this.resetTraspasoTecnicoTab();
        this._tecnicoDialogRef = this.dialog.open(this.traspasoTecnicoFormDialog, {
            width: 'min(1040px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false
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
            cantidad: 1, condicion: 'good', notas: ''
        });
        this.toolSearchTecnico = ''; this.toolResultsTecnico = []; this.showToolDropTecnico = false;
    }

    removeToolTecnico(i: number): void { this.itemsTraspasoTecnico.splice(i, 1); }

    selectPersonaTecnico(p: PersonaTecnico): void {
        this.traspasoTecnicoForm.patchValue({
            nombreCompletoInput: p.nombre,
            nombreCompleto:      p.nombre,
            nroLicencia:         p.licencia,
            cargo:               p.cargo
        });
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
        const department = `${fv.gerencia} | ${fv.unidad}`.trim();

        this.isSavingTraspasoTecnico = true;
        this.movSvc.registrarTraspasoOtraArea({
            date:                 fv.fecha,
            time:                 fv.hora + ':00',
            responsible_person:   fv.nombreCompleto || fv.nombreCompletoInput,
            department,
            exit_reason:          'area_transfer',
            authorized_by:        fv.nroLicencia,
            notes:                fv.observaciones ?? '',
            general_observations: `Tipo: ${fv.tipoTraspaso} | Base: ${fv.base} | Cargo: ${fv.cargo} | Licencia: ${fv.nroLicencia}`,
            items_json: itemsJson
        }).pipe(finalize(() => this.isSavingTraspasoTecnico = false), takeUntil(this._unsub$)).subscribe({
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
            fecha:        new Date().toISOString().split('T')[0],
            hora:         new Date().toTimeString().slice(0, 5),
            base:         'VVI',
            tipoTraspaso: 'TEMPORAL'
        });
        this.itemsTraspasoTecnico = [];
        this.personasTecnico = []; this.showPersonaTecnicoDropdown = false;
        this.toolSearchTecnico = ''; this.toolResultsTecnico = []; this.showToolDropTecnico = false;
    }

    private _pdfMGH109(nro: string, fv: any, items: ToolEnvioItem[]): void {
        const now  = new Date().toLocaleString('es-BO');
        const dept = `${fv.gerencia || ''} | ${fv.unidad || ''}`.trim();
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
    <td>${fv.base || '-'}</td>
  </tr>
  <tr>
    <td class="lbl">Tipo de Traspaso</td>
    <td>${fv.tipoTraspaso || '-'}</td>
    <td class="lbl">Gerencia</td>
    <td>${fv.gerencia || '-'}</td>
    <td class="lbl">Unidad</td>
    <td>${fv.unidad || '-'}</td>
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
    <div class="sig-ttl">Entrega (Almacén)</div>
    <div class="sig-line">Firma / Sello</div>
  </div>
  <div class="sig">
    <div class="sig-ttl">Recibe (${fv.nombreCompleto || fv.nombreCompletoInput || '-'})</div>
    <div class="sig-line">Firma: ________________________<br>Licencia: ${fv.nroLicencia || '-'}</div>
  </div>
  <div class="sig">
    <div class="sig-ttl">Autoriza (Jefe de ${fv.gerencia || 'Área'})</div>
    <div class="sig-line">Firma / Sello</div>
  </div>
</div>

<div class="nota">
  <strong>Nota:</strong> Este documento certifica el traspaso de las herramientas/equipos indicados de acuerdo a los procedimientos del Manual de Mantenimiento.
  El receptor asume la responsabilidad de las herramientas hasta su devolución. Dpto: ${dept} | Tipo: ${fv.tipoTraspaso}
</div>

<div class="footer">BOLIVIANA DE AVIACIÓN — Almacén de Herramientas | Generado: ${now} | Doc: ${nro}</div>
</body></html>`;

        const win = window.open('', '_blank', 'width=1050,height=750');
        if (win) { win.document.write(html); win.document.close(); }
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

    private _pdfEnvio(nro: string, items: ToolEnvioItem[], form: any, tipo: string): void {
        const fecha     = new Date(form.fechaEnvio || form.fechaTraspaso || new Date()).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const destino   = form.baseDestino?.nombre || form.areaDepartamento || '---';
        const responsable = form.responsableEnvia || form.responsableTraspaso || '---';
        const condLabel: Record<string, string> = {
            excellent: 'Excelente', good: 'Bueno', fair: 'Regular', damaged: 'Dañado'
        };
        const filas = items.map((it, i) => `
            <tr><td style="text-align:center">${i + 1}</td><td>${it.codigo}</td>
            <td>${it.nombre}</td><td>${it.pn || '---'}</td><td>${it.sn || '---'}</td>
            <td style="text-align:center">${it.cantidad}</td>
            <td style="text-align:center">${condLabel[it.condicion] || it.condicion}</td>
            <td>${it.notas || '---'}</td></tr>`).join('');
        this._abrirPdf(nro, tipo, filas, [
            ['Fecha', fecha], ['Destino / Área', destino], ['Responsable', responsable],
            ['Nro. Documento', form.nroDocumento || '---'],
            ['Fecha Esp. Retorno', form.fechaEsperadaRetorno || 'N/A'],
            ['Nro. Vuelo', form.nroVuelo || '---'],
            ['Aeronave', form.aeronave || '---'],
            ['Prioridad', form.prioridad || 'NORMAL'],
            ['Notas', form.notas || '---']
        ], [['#','3%'],['Código BOA','8%'],['Descripción','24%'],['P/N','13%'],['S/N','11%'],
            ['Cant.','7%'],['Condición','12%'],['Observación','22%']],
            [responsable, destino]);
    }

    private _abrirPdf(
        nro: string, tipo: string, filas: string,
        campos: [string, string][],
        columnas: [string, string][],
        firmas: [string, string]
    ): void {
        const camposHtml = campos.map(([l, v]) =>
            `<div class="field"><label>${l}</label><span>${v}</span></div>`).join('');
        const thHtml = columnas.map(([l, w]) =>
            `<th style="width:${w}">${l}</th>`).join('');
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
.firmas{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px}
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
<div class="firmas">
  <div class="firma"><div style="height:36px"></div>ENTREGA CONFORME<br>${firmas[0]}</div>
  <div class="firma"><div style="height:36px"></div>RECIBE CONFORME<br>${firmas[1]}</div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
        const win = window.open('', '_blank', 'width=900,height=700');
        if (win) { win.document.write(html); win.document.close(); }
    }
}
