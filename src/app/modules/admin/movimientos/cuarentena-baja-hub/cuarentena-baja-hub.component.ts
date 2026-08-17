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
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

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
    selected?: boolean;
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
        .custom-scrollbar-cb::-webkit-scrollbar-thumb { background: #FF1414; border-radius: 3px; }
        [hidden] { display: none !important; }
        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.85); display: flex; align-items: center;
            justify-content: center; z-index: 9999;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(15,23,42,0.85); }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
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
    private destroy$      = new Subject<void>();
    private _logoBoaDataUri: Promise<string> | null = null;

    // ── Tab ────────────────────────────────────────────────────────────────────
    activeTab = signal<TabType>('cuarentena');
    setTab(tab: TabType): void {
        this.activeTab.set(tab);
        if (tab === 'historial' && this.historialItems.length === 0) this.loadHistorial();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  CUARENTENA
    // ══════════════════════════════════════════════════════════════════════════
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

    herramientasCache:   any[]  = [];
    warehouses:          any[]  = [];
    toolsFiltradas:      any[]  = [];
    showToolDropdown            = false;
    buscarValueC                = '';
    toolCSearchLoading          = false;
    private _toolCSearch$       = new Subject<string>();
    private toolIdActual        = 0;

    private _personaSearch$ = new Subject<string>();
    personasFiltradas:   any[]  = [];
    showPersonaDropdown         = false;
    personaLoading              = false;

    reporteForm!:        FormGroup;
    toolCuarentenaForm!: FormGroup;
    cuarentenaList:      any[]  = [];
    selectedToolImage    = signal<string | null>(null);
    isSavingCuarentena   = false;

    // ══════════════════════════════════════════════════════════════════════════
    //  BAJA
    // ══════════════════════════════════════════════════════════════════════════
    bases: any[] = [];

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

    // ══════════════════════════════════════════════════════════════════════════
    //  HISTORIAL
    // ══════════════════════════════════════════════════════════════════════════
    historialItems:     any[] = [];
    filteredHistorial:  any[] = [];
    isLoadingHistorial        = false;
    historialTotal            = 0;
    historialSearch           = new FormControl('');

    // ── Resolver cuarentena ────────────────────────────────────────────────
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

    // ══════════════════════════════════════════════════════════════════════════
    //  LIFECYCLE
    // ══════════════════════════════════════════════════════════════════════════
    ngOnInit(): void {
        this._initFormsCuarentena();
        this._initFormBaja();
        this._initResolverForm();
        this._initAnularBajaForm();
        this._cargarHerramientas();
        this._setupPersonaSearch();
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
        this._cargarBases();
        this._setupToolCSearch();
        this.historialSearch.valueChanges.pipe(
            debounceTime(200), takeUntil(this.destroy$)
        ).subscribe(() => this._filterHistorial());
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  CUARENTENA — lógica
    // ══════════════════════════════════════════════════════════════════════════
    private _today(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    private _rdcKey(): string {
        const d = new Date();
        return `rdc_v2_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    }

    /** Lee el próximo número SIN incrementar el contador. Usado por el botón ↺. */
    private _peekNroRDC(): string {
        const d   = new Date();
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const anio = d.getFullYear();
        const seq = parseInt(sessionStorage.getItem(this._rdcKey()) || '0') + 1;
        return `RDC-${dia}${mes}${anio}-${seq.toString().padStart(3, '0')}`;
    }

    /** Incrementa el contador y devuelve el número definitivo. Solo llamar al hacer submit. */
    private _generarNroRDC(): string {
        const d   = new Date();
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const anio = d.getFullYear();
        const key = this._rdcKey();
        const seq = parseInt(sessionStorage.getItem(key) || '0') + 1;
        sessionStorage.setItem(key, seq.toString());
        return `RDC-${dia}${mes}${anio}-${seq.toString().padStart(3, '0')}`;
    }

    private _initFormsCuarentena(): void {
        const today = this._today();
        const auth  = JSON.parse(localStorage.getItem('aut') || '{}');
        this.reporteForm = this.fb.group({
            nroReporteDiscrepancia: ['', Validators.required],
            fecha:          [today, Validators.required],
            motivo:         ['',    Validators.required],
            descripcion:    ['',    Validators.required],
            nombreApellido: [''],
            realizadoPor:   [auth?.nombre_usuario || '']
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

    private _cargarHerramientas(): void {
        this.movementSvc.getHerramientasDisponibles().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (t: any[]) => { this.herramientasCache = t; } });
    }

    private _cargarWarehouses(): void {
        this.movementSvc.getWarehouses().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (w: any[]) => { this.warehouses = w; } });
    }

    private _cargarBases(): void {
        this.movementSvc.getBases().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (b: any[]) => { this.bases = b; } });
    }

    regenerarNroRDC(): void {
        this.reporteForm.patchValue({ nroReporteDiscrepancia: this._peekNroRDC() });
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
        this.selectedToolImage.set(null);
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

    private _setupToolCSearch(): void {
        this._toolCSearch$.pipe(
            debounceTime(250), distinctUntilChanged(),
            takeUntil(this.destroy$)
        ).subscribe(q => {
            const query = q.trim().toLowerCase();
            if (query.length < 2) { this.toolsFiltradas = []; this.showToolDropdown = false; this.toolCSearchLoading = false; return; }
            this.toolsFiltradas = this.herramientasCache
                .filter(t => {
                    const nombre = (t.name || t.description || '').toLowerCase();
                    return (t.code            ?? '').toLowerCase().includes(query) ||
                           nombre.includes(query) ||
                           (t.part_number    ?? '').toLowerCase().includes(query) ||
                           (t.serial_number  ?? '').toLowerCase().includes(query);
                })
                .slice(0, 8);
            this.showToolDropdown  = this.toolsFiltradas.length > 0;
            this.toolCSearchLoading = false;
        });
    }

    onBuscarToolCInput(value: string): void {
        this.buscarValueC       = value;
        this.toolCSearchLoading = value.trim().length >= 2;
        this._toolCSearch$.next(value);
    }

    hideToolCDD(): void { setTimeout(() => { this.showToolDropdown = false; }, 180); }

    limpiarBuscarToolC(): void {
        this.buscarValueC     = '';
        this.toolsFiltradas   = [];
        this.showToolDropdown = false;
        this.toolCuarentenaForm.patchValue({ id_tool: 0, codigo: '', nombre: '', partNumber: '', serialNumber: '', existencia: 0 });
    }

    filtrarHerramientas(event: Event): void {
        const q = (event.target as HTMLInputElement).value.trim().toLowerCase();
        if (q.length < 2) { this.toolsFiltradas = []; this.showToolDropdown = false; return; }
        this.toolsFiltradas = this.herramientasCache
            .filter(t => {
                const nombre = (t.name || t.description || '').toLowerCase();
                return (t.code ?? '').toLowerCase().includes(q) || nombre.includes(q) ||
                       (t.part_number ?? '').toLowerCase().includes(q) ||
                       (t.serial_number ?? '').toLowerCase().includes(q);
            })
            .slice(0, 6);
        this.showToolDropdown = this.toolsFiltradas.length > 0;
    }

    selectTool(tool: any): void {
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
        this.showToolDropdown = false;
    }

    ocultarSugerencias(): void { setTimeout(() => { this.showToolDropdown = false; }, 200); }

    onToolImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => this.selectedToolImage.set(reader.result as string);
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
        if (fv.cantidad > fv.existencia) {
            this._showMsg(`Solo hay ${fv.existencia} unidades en stock.`, 'error');
            return;
        }
        this.cuarentenaList = [...this.cuarentenaList, { ...fv, foto: this.selectedToolImage() }];
        this.dialogRefActual?.close();
        this._showMsg('Herramienta preparada para cuarentena.', 'success');
    }

    removerDeLista(index: number): void {
        this.cuarentenaList.splice(index, 1);
        this.cuarentenaList = [...this.cuarentenaList];
    }

    getEstadoFisicoLabel(val: string): string {
        return this.estadosFisicos.find(e => e.value === val)?.label || val;
    }

    submitQuarantine(): void {
        if (!this.isReporteValido() || this.cuarentenaList.length === 0) return;
        // Siempre genera (incrementa el contador) al momento del submit real,
        // así el ↺ puede usarse N veces sin consumir números.
        this.reporteForm.patchValue({ nroReporteDiscrepancia: this._generarNroRDC() });
        this.isSavingCuarentena = true;
        const rep = this.reporteForm.getRawValue();
        const requests = this.cuarentenaList.map(tool => {
            const notesExtra = `Cant: ${tool.cantidad}. Base: ${tool.base || '-'}.` +
                               (tool.fechaVencimiento ? ` Vence: ${tool.fechaVencimiento}.` : '');
            const payload: any = {
                report_number:      rep.nroReporteDiscrepancia,
                record_number:      rep.nroReporteDiscrepancia,
                tool_id:            tool.id_tool,
                start_date:         rep.fecha,
                reported_by_name:   rep.nombreApellido || rep.realizadoPor,
                reason:             'other',       // valor fijo para satisfacer el CHECK constraint de tquarantines.reason
                reason_description: rep.motivo,    // texto libre ingresado por el usuario
                status:             'active',
                notes:              notesExtra
            };
            // reported_by_id no se envía: getPersonal() devuelve id_usuario (segu.tusuario)
            // pero tquarantines.reported_by_id referencia he.temployees — IDs distintos.
            // reported_by_name es suficiente para identificar al responsable.
            return this.quarantineSvc.createQuarantine(payload);
        });
        forkJoin(requests).pipe(
            finalize(() => { this.isSavingCuarentena = false; }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: () => {
                this._abrirImpresionCuarentena(rep, this.cuarentenaList);
                this._showMsg('Cuarentena procesada correctamente.', 'success');
                this.cuarentenaList = [];
                this.reporteForm.reset({ fecha: this._today(), nroReporteDiscrepancia: '' });
                this.historialItems = [];
            },
            error: () => this._showMsg('Error al procesar la cuarentena.', 'error')
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

    // ══════════════════════════════════════════════════════════════════════════
    //  BAJA — lógica
    // ══════════════════════════════════════════════════════════════════════════
    private _initFormBaja(): void {
        const now = new Date();
        const today = this._today();
        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        this.bajaForm = this.fb.group({
            procesadoPor:    ['', Validators.required],
            nombre:          [''],
            cargo:           [''],
            fecha:           [today, Validators.required],
            hora:            [`${hh}:${mm}`, Validators.required],
            verificadoPor:   [''],
            estado:          ['requested', Validators.required],
            motivo:          ['beyond_repair', Validators.required],
            disposalMethod:  [''],
            descripcionBaja: ['', Validators.required],
            unidad:          [null],
            autorizadoPor:   [''],
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
                        .map((f: any) => ({ id: f.id_employee || f.id, nombre: f.nombreCompleto || f.nombre, cargo: f.cargo || '' }))
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
        this.bajaForm.patchValue({ procesadoPor: p.nombre, nombre: p.nombre, cargo: p.cargo });
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
        this.bajaForm.patchValue({ autorizadoPor: p.nombre });
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
            selected:     false
        };
        this.bajaItems.update(items => [...items, item]);
    }

    removeItemBaja(index: number): void {
        const removed = this.bajaItems()[index];
        this.bajaItems.update(items => { const n = [...items]; n.splice(index, 1); return n; });
        this._showMsg(`${removed.codigo} removida de la lista.`, 'info');
    }

    getTotalCantidad(): number {
        return this.bajaItems().reduce((t, i) => t + (Number(i.cantidad) || 1), 0);
    }

    getEstadoLabel(val: string): string {
        return this.estados.find(e => e.value === val)?.label || 'No definido';
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
                requested_by_name:    fv.procesadoPor        ?? '',
                authorized_by_name:   fv.autorizadoPor       ?? '',
                received_by_name:     fv.verificadoPor       ?? '',
                notes:                fv.observaciones       ?? '',
                condition_description: item.estadoFisico     || ''
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
                this._abrirImpresionBaja({
                    nroNota: nro, ...fv,
                    herramientas: items,
                    totalHerramientas: items.length,
                    totalItems: this.getTotalCantidad()
                });
                this._showMsg(`Baja ${nro} procesada exitosamente.`, 'success');
                this.bajaItems.set([]);
                this.bajaForm.reset({
                    estado: 'requested', motivo: 'beyond_repair',
                    disposalMethod: 'other', fecha: this._today()
                });
                this.historialItems = [];
            },
            error: (err: any) => this._showMsg(err?.message || 'Error al registrar la baja.', 'error')
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  HISTORIAL
    // ══════════════════════════════════════════════════════════════════════════
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
        return m.start_date || m.request_date ||
            (m.fecha_reg ? String(m.fecha_reg).slice(0, 10) : '') || '---';
    }

    getHistorialTypeLabel(m: any): string {
        return m._type === 'cuarentena' ? 'Cuarentena' : 'Baja';
    }

    getHistorialTypeClass(m: any): string {
        if (m._type === 'cuarentena') return 'bg-amber-100 text-amber-800 border-amber-400';
        return 'bg-[#FF1414]/10 text-[#FF1414] border-[#FF1414]/30';
    }

    /** Reimpresión de un único registro desde la pestaña Historial (cuarentena o
     *  baja ya resueltos individualmente) — mismo renderer visual que el resto,
     *  con una sola fila de ítem ya que acá cada registro histórico es 1 herramienta. */
    async pdfHistorialItem(m: any): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();
        const isCuarentena = m._type === 'cuarentena';
        const nro    = m.record_number || m.report_number || '---';
        const fecha  = m.start_date || m.request_date || (m.fecha_reg ? String(m.fecha_reg).slice(0,10) : '') || '---';
        const resp   = m.reported_by_name || m.requested_by_name || '---';
        const motivo = isCuarentena
            ? (this.motivosCuarentena.find(x => x.value === m.reason)?.label || m.reason || '---')
            : (m.reason || '---');
        const desc   = m.reason_description || m.notes || '---';
        const codigo = m.tool?.code || m.tool_code || m.code || '---';
        const nombre = m.tool?.description || m.tool_name || m.description || (m.tool_id ? `ID: ${m.tool_id}` : '---');
        const pn     = m.tool?.part_number || m.part_number || '---';
        const sn     = m.tool?.serial_number || m.serial_number || '---';

        const titulo = isCuarentena ? 'Reporte de Cuarentena' : 'Nota de Baja';

        const filas = `<tr>
            <td class="tc">1</td>
            <td class="mono">${codigo}</td>
            <td class="mono">${pn}</td>
            <td class="mono">${sn}</td>
            <td>${nombre}</td>
            <td class="tc">${m.status || '---'}</td>
            <td>${desc}</td>
        </tr>`;

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${titulo} ${nro}</title>
<style>
  @page { size: A4; margin: 8mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }

  table.head-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 6px; }
  table.head-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: middle; }
  .logo-cell { width: 22%; text-align: center; }
  .logo-cell img { max-width: 100%; max-height: 34px; }
  .logo-cell .oam { font-size: 8px; font-weight: 900; margin-top: 2px; }
  .title-cell { width: 58%; text-align: center; }
  .title-cell h1 { font-size: 13px; font-weight: 900; text-transform: uppercase; }
  .code-cell { width: 20%; text-align: center; }
  .code-cell .nro { font-size: 13px; font-weight: 900; }

  table.meta-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.meta-table td { border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; height: 20px; }
  table.meta-table td b { font-weight: 900; }

  .detalle-bar { background: #fff; border: 2px solid #000; border-top: none; text-align: center; font-weight: 900; font-size: 11px; text-transform: uppercase; padding: 3px; }

  table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; }
  table.items th { border: 1px solid #000; background: #e5e7eb; font-size: 7.7px; font-weight: 900; text-transform: uppercase; padding: 4px 2px; }
  table.items td { border: 1px solid #000; padding: 4px 3px; font-size: 8.7px; }
  .tc { text-align: center; }
  .mono { font-family: monospace; }

  @media print { body { padding: 0; } }
</style>
<script>window.onload = () => window.print();</script>
</head><body>

<table class="head-table">
  <tr>
    <td class="logo-cell" rowspan="2">
      ${logoUri ? `<img src="${logoUri}" alt="BoA">` : '<div style="font-weight:900;font-size:16px">BoA</div>'}
      <div class="oam">BoAMM &nbsp; OAM145# N-114</div>
    </td>
    <td class="title-cell" rowspan="2"><h1>${titulo}</h1></td>
    <td class="code-cell"><div class="nro">N° ${nro}</div></td>
  </tr>
</table>

<table class="meta-table">
  <tr>
    <td style="width:20%"><b>RESPONSABLE:</b></td><td style="width:30%">${resp}</td>
    <td style="width:20%"><b>FECHA:</b></td><td style="width:30%">${fecha}</td>
  </tr>
  <tr>
    <td><b>${isCuarentena ? 'MOTIVO:' : 'MÉTODO DISPOSICIÓN:'}</b></td><td>${isCuarentena ? motivo : (m.disposal_method || '---')}</td>
    <td><b>ESTADO:</b></td><td>${m.status || '---'}</td>
  </tr>
  ${m.notes ? `<tr><td><b>NOTAS:</b></td><td colspan="3">${m.notes}</td></tr>` : ''}
</table>

<div class="detalle-bar">DETALLE</div>
<table class="items">
  <thead><tr>
    <th style="width:5%">#</th><th style="width:13%">CÓDIGO</th><th style="width:13%">P/N</th><th style="width:13%">S/N</th>
    <th style="width:21%">DESCRIPCIÓN</th><th style="width:10%">ESTADO</th><th style="width:25%">DESCRIPCIÓN / NOTAS</th>
  </tr></thead>
  <tbody>${filas}</tbody>
</table>

</body></html>`;
        this._abrirVentana(html);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  RESOLVER CUARENTENA
    // ══════════════════════════════════════════════════════════════════════════
    private _initResolverForm(): void {
        this.resolverForm = this.fb.group({
            resolved_by_name: ['', Validators.required],
            resolution_date:  [this._today(), Validators.required],
            resolution:       ['', Validators.required],
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

    getStatusClass(status: string): string {
        if (status === 'resolved')  return 'bg-green-100 text-green-800 border-green-400';
        if (status === 'cancelled') return 'bg-gray-100 text-gray-600 border-gray-400';
        return 'bg-amber-100 text-amber-800 border-amber-400';
    }

    abrirModalResolver(item: any): void {
        this.quarantenaSeleccionada = item;
        this.resolverForm.reset({
            resolution_date:  this._today(),
            resolved_by_name: '',
            resolution:       '',
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
            resolution:         fv.resolution,
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

    // ══════════════════════════════════════════════════════════════════════════
    //  ANULAR BAJA
    // ══════════════════════════════════════════════════════════════════════════
    private _initAnularBajaForm(): void {
        this.anularBajaForm = this.fb.group({
            motivoAnulacion: ['', Validators.required]
        });
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

    getBajaStatusClass(status: string): string {
        if (status === 'executed')  return 'bg-[#FF1414]/10 text-[#FF1414] border-[#FF1414]/30';
        if (status === 'approved')  return 'bg-green-100 text-green-800 border-green-400';
        if (status === 'cancelled' || status === 'rejected') return 'bg-gray-100 text-gray-500 border-gray-400';
        return 'bg-yellow-100 text-yellow-800 border-yellow-400';
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

    // ══════════════════════════════════════════════════════════════════════════
    //  PDFs — Cuarentena
    // ══════════════════════════════════════════════════════════════════════════
    /**
     * "Reporte Discrepancia de Herramienta" — la hoja real del Excel (MGH-101,
     * REV.0, 2016-10-13) es de UNA sola herramienta por reporte (PART NUMBER/
     * NOMBRE/SERIAL NUMBER/CÓDIGO como campos, no tabla), pero el sistema registra
     * cuarentena por LOTE (varias herramientas bajo un mismo Nro. Reporte) —
     * decisión del usuario: no forzar 1 PDF por herramienta, solo restylear al
     * mismo patrón visual del resto, manteniendo la tabla de ítems.
     */
    private async _abrirImpresionCuarentena(rep: any, items: any[]): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();
        const motivoLabel = rep.motivo || '---';

        const filas = items.map((item: any, i: number) => `
            <tr>
                <td class="tc">${i + 1}</td>
                <td class="mono">${item.codigo || '---'}</td>
                <td class="mono">${item.partNumber || '---'}</td>
                <td class="mono">${item.serialNumber || '---'}</td>
                <td class="tc">${item.cantidad || 1}</td>
                <td>${item.nombre || '---'}</td>
                <td class="tc">${this.getEstadoFisicoLabel(item.estadoFisico)}</td>
                <td class="tc">${item.base || '---'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte Discrepancia ${rep.nroReporteDiscrepancia}</title>
<style>
  @page { size: A4; margin: 8mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }

  table.head-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 6px; }
  table.head-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: middle; }
  .logo-cell { width: 22%; text-align: center; }
  .logo-cell img { max-width: 100%; max-height: 34px; }
  .logo-cell .oam { font-size: 8px; font-weight: 900; margin-top: 2px; }
  .title-cell { width: 58%; text-align: center; }
  .title-cell h1 { font-size: 12.5px; font-weight: 900; text-transform: uppercase; }
  .code-cell { width: 20%; text-align: center; padding: 0; }
  .code-cell .mgh { font-size: 15px; font-weight: 900; padding: 6px 0; border-bottom: 1px solid #000; }
  .code-cell .rev-fecha { display: flex; font-size: 9px; font-weight: 700; }
  .code-cell .rev-fecha > div { flex: 1; padding: 3px 0; }
  .code-cell .rev-fecha > div:first-child { border-right: 1px solid #000; }

  table.meta-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.meta-table td { border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; height: 20px; }
  table.meta-table td b { font-weight: 900; }
  .nnota-cell { text-align: center; font-weight: 900; }

  .detalle-bar { background: #fff; border: 2px solid #000; border-top: none; text-align: center; font-weight: 900; font-size: 11px; text-transform: uppercase; padding: 3px; }

  table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.items th { border: 1px solid #000; background: #e5e7eb; font-size: 7.7px; font-weight: 900; text-transform: uppercase; padding: 4px 2px; }
  table.items td { border: 1px solid #000; padding: 4px 3px; font-size: 8.7px; }
  table.items tbody tr { height: 20px; }
  .tc { text-align: center; }
  .mono { font-family: monospace; }

  table.foot-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; }
  table.foot-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 9.5px; width: 33.3%; }
  .firma-lbl { font-weight: 900; }
  .firma-line { border-bottom: 1px solid #000; height: 26px; margin-top: 12px; }
  .firma-sub { text-align: center; font-size: 8.5px; font-weight: 700; margin-top: 2px; }

  @media print { body { padding: 0; } }
</style>
<script>window.onload = () => window.print();</script>
</head><body>

<table class="head-table">
  <tr>
    <td class="logo-cell" rowspan="2">
      ${logoUri ? `<img src="${logoUri}" alt="BoA">` : '<div style="font-weight:900;font-size:16px">BoA</div>'}
      <div class="oam">BoAMM &nbsp; OAM145# N-114</div>
    </td>
    <td class="title-cell" rowspan="2">
      <h1>Reporte Discrepancia de Herramienta</h1>
    </td>
    <td class="code-cell">
      <div class="mgh">MGH-101</div>
      <div class="rev-fecha"><div>REV. 0</div><div>2016-10-13</div></div>
    </td>
  </tr>
</table>

<table class="meta-table">
  <tr>
    <td style="width:16%"><b>NRO. REPORTE:</b></td><td style="width:26%">${rep.nroReporteDiscrepancia}</td>
    <td style="width:16%"><b>MOTIVO:</b></td><td style="width:22%">${motivoLabel}</td>
    <td rowspan="3" class="nnota-cell" style="width:20%"><div style="font-size:8px;font-weight:400">NRO. REPORTE</div><div style="font-size:12px">${rep.nroReporteDiscrepancia}</div></td>
  </tr>
  <tr>
    <td><b>REPORTADO POR:</b></td><td>${rep.nombreApellido || rep.realizadoPor || '---'}</td>
    <td><b>FECHA:</b></td><td>${rep.fecha || '---'}</td>
  </tr>
  <tr>
    <td><b>DESCRIPCIÓN:</b></td><td colspan="3">${rep.descripcion || '---'}</td>
  </tr>
</table>

<div class="detalle-bar">DETALLE DE HERRAMIENTAS EN CUARENTENA</div>
<table class="items">
  <thead><tr>
    <th style="width:4%">#</th><th style="width:12%">CÓDIGO BOA</th><th style="width:12%">P/N</th><th style="width:12%">S/N</th>
    <th style="width:7%">CANT.</th><th style="width:25%">DESCRIPCIÓN</th><th style="width:14%">ESTADO FÍSICO</th><th style="width:14%">BASE</th>
  </tr></thead>
  <tbody>${filas || '<tr><td colspan="8" class="tc">Sin ítems</td></tr>'}</tbody>
</table>

<table class="foot-table">
  <tr>
    <td>
      <div class="firma-lbl">REPORTADO POR</div>
      <div class="firma-line"></div>
      <div class="firma-sub">${rep.nombreApellido || rep.realizadoPor || ''}</div>
    </td>
    <td>
      <div class="firma-lbl">JEFE DE ALMACÉN</div>
      <div class="firma-line"></div>
      <div class="firma-sub">&nbsp;</div>
    </td>
    <td>
      <div class="firma-lbl">CONTROL DE CALIDAD</div>
      <div class="firma-line"></div>
      <div class="firma-sub">&nbsp;</div>
    </td>
  </tr>
</table>

</body></html>`;
        this._abrirVentana(html);
    }

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

    // ══════════════════════════════════════════════════════════════════════════
    //  PDFs — Baja
    // ══════════════════════════════════════════════════════════════════════════
    /**
     * "Nota de Baja — Herramientas, Bancos de Prueba y Equipos de Apoyo" (MGH-119),
     * calcada de "Sistema Herramientas con Macros/Formularios.xlsx", hoja "BAJAR"
     * (REV. 0, 2020-06-03) — misma fuente ya confirmada vigente para este documento.
     * Esta es la ÚNICA ruta real de impresión de Baja: `baja/baja.component.ts` es
     * código huérfano (nunca importado en ningún módulo/ruta) y fue eliminado.
     */
    private async _abrirImpresionBaja(d: any): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();

        let licencia = '---';
        let departamento = '---';
        try {
            const personal = await lastValueFrom(this.movementSvc.getPersonal());
            const q = (d.procesadoPor || '').trim().toLowerCase();
            const match = q ? (personal || []).find((f: any) => (f.nombreCompleto || '').trim().toLowerCase() === q) : null;
            if (match) { licencia = match.licencia || '---'; departamento = match.departamento || '---'; }
        } catch { /* enriquecimiento opcional, no bloquea la impresión */ }

        const fechaHora = `${d.fecha || '---'} ${d.hora || ''}`.trim();
        const estadoLabel = this.getEstadoLabel(d.estado);

        const filas = (d.herramientas || []).map((item: BajaItem, i: number) => `
            <tr>
                <td class="tc">${i + 1}</td>
                <td class="mono">${item.codigo || '---'}</td>
                <td class="mono">${item.pn || '---'}</td>
                <td class="mono">${item.sn || '---'}</td>
                <td>${item.nombre || '---'}</td>
                <td class="tc">${item.cantidad || 1}</td>
                <td>${item.marca || '---'}</td>
                <td>${item.contenido || '---'}</td>
                <td class="tc">${item.base || '---'}</td>
                <td>${item.estadoFisico && item.estadoFisico !== 'INSERVIBLE' ? item.estadoFisico : '---'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Nota de Baja ${d.nroNota}</title>
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
  .title-cell h1 { font-size: 12.5px; font-weight: 900; text-transform: uppercase; }
  .title-cell h2 { font-size: 9px; font-weight: 900; text-transform: uppercase; margin-top: 2px; }
  .code-cell { width: 20%; text-align: center; padding: 0; }
  .code-cell .mgh { font-size: 15px; font-weight: 900; padding: 6px 0; border-bottom: 1px solid #000; }
  .code-cell .rev-fecha { display: flex; font-size: 9px; font-weight: 700; }
  .code-cell .rev-fecha > div { flex: 1; padding: 3px 0; }
  .code-cell .rev-fecha > div:first-child { border-right: 1px solid #000; }

  table.meta-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.meta-table td { border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; height: 20px; }
  table.meta-table td b { font-weight: 900; }
  .nnota-cell { text-align: center; font-weight: 900; }

  .detalle-bar { background: #fff; border: 2px solid #000; border-top: none; text-align: center; font-weight: 900; font-size: 11px; text-transform: uppercase; padding: 3px; }

  table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.items th { border: 1px solid #000; background: #e5e7eb; font-size: 7.7px; font-weight: 900; text-transform: uppercase; padding: 4px 2px; }
  table.items td { border: 1px solid #000; padding: 4px 3px; font-size: 8.7px; }
  table.items tbody tr { height: 20px; }
  .tc { text-align: center; }
  .mono { font-family: monospace; }

  table.foot-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.foot-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 9.5px; }
  .firma-lbl { font-weight: 900; }
  .firma-line { border-bottom: 1px solid #000; height: 26px; margin-top: 12px; }
  .firma-sub { text-align: center; font-size: 8.5px; font-weight: 700; margin-top: 2px; }
  .nota-importante { font-size: 8.5px; }
  .nota-importante ul { margin: 4px 0 0 12px; }
  .nota-importante li { margin-bottom: 4px; }

  table.autoriza-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; }
  table.autoriza-table td { border: 1px solid #000; padding: 6px 8px; font-size: 9.5px; }

  @media print { body { padding: 0; } }
</style>
<script>window.onload = () => window.print();</script>
</head><body>

<table class="head-table">
  <tr>
    <td class="logo-cell" rowspan="2">
      ${logoUri ? `<img src="${logoUri}" alt="BoA">` : '<div style="font-weight:900;font-size:16px">BoA</div>'}
      <div class="oam">BoAMM &nbsp; OAM145# N-114</div>
    </td>
    <td class="title-cell" rowspan="2">
      <h1>Nota de Baja</h1>
      <h2>Herramientas, Bancos de Prueba y Equipos de Apoyo</h2>
    </td>
    <td class="code-cell">
      <div class="mgh">MGH-119</div>
      <div class="rev-fecha"><div>REV. 0</div><div>2020-06-03</div></div>
    </td>
  </tr>
</table>

<table class="meta-table">
  <tr>
    <td style="width:16%"><b>NOMBRE SOLICITANTE:</b></td><td style="width:26%">${d.nombre || d.procesadoPor || '---'}</td>
    <td style="width:16%"><b>VERIFICADO POR:</b></td><td style="width:22%">${d.verificadoPor || '---'}</td>
    <td rowspan="4" class="nnota-cell" style="width:20%"><div style="font-size:8px;font-weight:400">N° NOTA</div><div style="font-size:12px">${d.nroNota}</div></td>
  </tr>
  <tr>
    <td><b>LICENCIA:</b></td><td>${licencia}</td>
    <td><b>DEPARTAMENTO:</b></td><td>${departamento}</td>
  </tr>
  <tr>
    <td><b>CARGO:</b></td><td>${d.cargo || '---'}</td>
    <td><b>UNIDAD:</b></td><td>${d.unidad || '---'}</td>
  </tr>
  <tr>
    <td><b>FECHA Y HORA:</b></td><td>${fechaHora || '---'}</td>
    <td><b>MOVIMIENTO:</b></td><td>---</td>
  </tr>
  <tr>
    <td><b>ESTADO:</b></td><td colspan="3">${estadoLabel}</td>
  </tr>
  ${d.observaciones ? `<tr><td><b>OBSERVACIÓN:</b></td><td colspan="3">${d.observaciones}</td></tr>` : ''}
</table>

<div class="detalle-bar">DETALLE</div>
<table class="items">
  <thead><tr>
    <th style="width:4%">#</th><th style="width:10%">CÓDIGO</th><th style="width:10%">P/N ó MODELO</th><th style="width:9%">S/N</th>
    <th style="width:18%">NOMBRE</th><th style="width:5%">CANT.</th><th style="width:9%">MARCA</th>
    <th style="width:14%">LISTA DE CONTENIDO</th><th style="width:6%">BASE</th><th style="width:15%">OBSERVACIÓN</th>
  </tr></thead>
  <tbody>${filas || '<tr><td colspan="10" class="tc">Sin ítems</td></tr>'}</tbody>
</table>

<table class="foot-table">
  <tr>
    <td style="width:33%">
      <div class="firma-lbl">PROCESADO POR:</div>
      <div class="firma-line"></div>
      <div class="firma-sub">Firma Almacén Herramientas — ${d.nombre || d.procesadoPor || ''}</div>
    </td>
    <td style="width:33%">
      <div class="firma-lbl">VERIFICADO POR:</div>
      <div class="firma-line"></div>
      <div class="firma-sub">Firma recepción — ${d.verificadoPor || ''}</div>
    </td>
    <td style="width:34%" class="nota-importante">
      <b>NOTA IMPORTANTE:</b>
      <ul>
        <li>Las herramientas descritas en la presente nota se encuentran en condición INOPERATIVAS, a menos que se indique lo contrario en la casilla de OBSERVACIONES.</li>
      </ul>
      La firma de la presente nota implica que se está en conformidad con toda la información detallada.
    </td>
  </tr>
</table>
<table class="autoriza-table">
  <tr>
    <td style="width:50%"><b>AUTORIZADO POR:</b> ${d.autorizadoPor || '&nbsp;'}</td>
    <td style="width:50%"><b>Firma:</b> _____________________________</td>
  </tr>
</table>

</body></html>`;
        this._abrirVentana(html);
    }

    private _abrirVentana(html: string): void {
        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  SHARED
    // ══════════════════════════════════════════════════════════════════════════
    private _showMsg(msg: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(msg, 'OK', {
            duration: 4000, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
