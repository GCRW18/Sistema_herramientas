import { Component, OnInit, OnDestroy, signal, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, switchMap, map, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MovementService } from '../../../../core/services/movement.service';
import { FleetService } from '../../../../core/services/fleet.service';
import { ModalHerramientaInternoComponent } from '../prestamo-terceros/modal-herramienta-interno/modal-herramienta-interno.component';

// ── Interfaces ──────────────────────────────────────────────────────────────
interface InternalLoanItem {
    toolId: number; id: number; codigo: string; pn: string; descripcion: string; sn: string;
    marca: string; fechaCalibracion: string; cantidad: number; unidad: string;
    estado: string; contenido: string; selected?: boolean;
}

type CondicionDevolucion = 'BUENO' | 'DAÑADO' | 'IRREPARABLE' | 'REQUIERE_CALIBRACION' | 'FALTANTE';

interface DevolucionItem {
    toolId?: string; imagen?: string; codigo: string; descripcion: string; pn: string; sn: string;
    und: string; marca?: string; listaContenido: string; fechaCalibracion: string;
    estadoAlPrestar: string; fechaPrestamo: string; cantidadPrestada: number;
    cantidadDevolver: number; aeronave: string; ordenTrabajo?: string;
    diasFuera: number; condicionDevolucion: CondicionDevolucion;
    observacionItem: string; selected: boolean;
}

type TabType = 'prestamo' | 'devolucion';

// ── Component ────────────────────────────────────────────────────────────────
@Component({
    selector: 'app-prestamo-tecnico-hub',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatTableModule, MatCheckboxModule, MatDialogModule,
        MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule
    ],
    templateUrl: './prestamo-tecnico-hub.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar-hub::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-hub::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-hub::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar-hub::-webkit-scrollbar-thumb { background: #cbd5e1; }
        [hidden] { display: none !important; }
        .row-selected { background-color: #fef3c7 !important; }
        :host-context(.dark) .row-selected { background-color: rgba(251,191,36,0.2) !important; }
        @keyframes pulse-border {
            0%,100% { border-color:#ef4444; box-shadow:0 0 0 0 rgba(239,68,68,.4); }
            50% { border-color:#f87171; box-shadow:0 0 0 4px rgba(239,68,68,0); }
        }
        .animate-pulse-border { animation: pulse-border 2s cubic-bezier(.4,0,.6,1) infinite; }
        ::ng-deep .white-checkbox .mdc-checkbox__background { border-color:white !important; }
        ::ng-deep .white-checkbox.mat-mdc-checkbox-checked .mdc-checkbox__background { background-color:white !important; border-color:white !important; }
        ::ng-deep .white-checkbox .mdc-checkbox__checkmark { color:#0f172a !important; }
    `]
})
export class PrestamoTecnicoHubComponent implements OnInit, OnDestroy {

    @ViewChild('datosInternoModal')        datosInternoModal!:        TemplateRef<any>;
    @ViewChild('confirmInternoModal')      confirmInternoModal!:      TemplateRef<any>;
    @ViewChild('busquedaModal')            busquedaModal!:            TemplateRef<any>;
    @ViewChild('confirmDevolucionModal')   confirmDevolucionModal!:   TemplateRef<any>;

    public  dialogRef      = inject(MatDialogRef<PrestamoTecnicoHubComponent>, { optional: true });
    private dialogRefActual: MatDialogRef<any> | null = null;
    private dialog         = inject(MatDialog);
    private fb             = inject(FormBuilder);
    private snackBar       = inject(MatSnackBar);
    private movementSvc    = inject(MovementService);
    private fleetSvc       = inject(FleetService);
    private destroy$       = new Subject<void>();

    // ── Tab
    activeTab = signal<TabType>('prestamo');

    // ── Estado general
    isSaving    = false;
    isSearching = false;

    // ─────────────── PRÉSTAMO INTERNO ───────────────
    internalForm!:    FormGroup;
    internalDataSource = signal<InternalLoanItem[]>([]);
    nroNotaInterno     = signal<string>('---');

    private _tecnicoSearch$ = new Subject<string>();
    tecnicosFiltrados:   any[] = [];
    tecnicoLoading       = false;
    showTecnicoDropdown  = false;

    aeronaves: { matricula: string; tipo: string }[] = [];
    destinos = ['Servicios', 'Línea', 'Taller', 'Hangar', 'Rampa'];

    displayedInternalColumns = ['select','codigo','pn','descripcion','sn','marca','cantidad','estado','acciones'];

    // ─────────────── DEVOLUCIÓN ───────────────
    devolucionForm!: FormGroup;
    dataSourceDevolucion: DevolucionItem[] = [];

    private _funcionarioSearch$ = new Subject<string>();
    funcionariosFiltrados:   any[] = [];
    funcionarioLoading       = false;
    showFuncionarioDropdown  = false;
    _funcionarioNombre   = '';
    _funcionarioLicencia = '';

    todasLasHerramientas:  any[] = [];
    herramientasFiltradas: any[] = [];
    herramientaLoading         = false;
    showHerramientaDropdown    = false;
    _herramientaSeleccionada: { codigo: string; nombre: string } | null = null;

    tiposDevolucion = [
        { value: 'RAPIDA',    label: 'RÁPIDA (Escaneo)' },
        { value: 'COMPLETA',  label: 'COMPLETA (Detallada)' }
    ];

    condiciones: { value: CondicionDevolucion; label: string; bgColor: string; icon: string }[] = [
        { value: 'BUENO',               label: 'BUENO',    bgColor: 'bg-green-500',  icon: 'check_circle'  },
        { value: 'DAÑADO',              label: 'DAÑADO',   bgColor: 'bg-red-500',    icon: 'report_problem'},
        { value: 'REQUIERE_CALIBRACION',label: 'CALIBRAR', bgColor: 'bg-yellow-500', icon: 'build'         },
        { value: 'FALTANTE',            label: 'FALTANTE', bgColor: 'bg-red-700',    icon: 'help_outline'  }
    ];

    displayedDevolucionColumns = [
        'select','herramienta','descripcion','calibEstado','destino','fechaDias','cantidades','condicion','observacionItem'
    ];

    private readonly conditionMap: Record<string,string> = {
        'SERVICEABLE':'good','NUEVO':'new','NEW':'new','EN_CALIBRACION':'fair',
        'UNSERVICEABLE':'damaged','EN_REPARACION':'poor','BUENO':'good','REGULAR':'fair','MALO':'poor'
    };

    // ── Lifecycle
    ngOnInit(): void {
        this.initInternalForm();
        this.initDevolucionForm();
        this._setupTecnicoSearch();
        this._setupFuncionarioSearch();
        this.cargarAeronaves();
        this._cargarHerramientas();
    }

    ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

    setTab(tab: TabType): void { this.activeTab.set(tab); }

    // ── Form init
    private initInternalForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const now   = new Date();
        const hh    = now.getHours().toString().padStart(2,'0');
        const mm    = now.getMinutes().toString().padStart(2,'0');
        this.internalForm = this.fb.group({
            buscarTecnico:     [''],
            nombreCompleto:    ['', Validators.required],
            nroLicencia:       ['', Validators.required],
            cargo:             [''],
            fecha:             [today,       Validators.required],
            hora:              [`${hh}:${mm}`, Validators.required],
            matriculaAeronave: ['N/A'],
            ordenTrabajo:      [''],
            destino:           [''],
            trabajoEspecial:   [false],
            observaciones:     ['']
        });
    }

    private initDevolucionForm(): void {
        this.devolucionForm = this.fb.group({
            funcionario:       ['', Validators.required],
            tipoDe:            ['COMPLETA'],
            codigoHerramienta: [''],
            unidadDestino:     [''],
            ordenTrabajo:      [''],
            fechaDevolucion:   [new Date().toISOString().split('T')[0], Validators.required],
            responsableRecibe: ['', Validators.required],
            observaciones:     ['']
        });
    }

    // ── Técnico autocomplete
    private _setupTecnicoSearch(): void {
        this._tecnicoSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showTecnicoDropdown = false; return of([]); }
                this.tecnicoLoading = true;
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map(lista => lista
                        .filter((f: any) => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno, f.licencia, f.nro_licencia]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map((f: any) => ({ id: f.id_employee || f.id, nombre: f.nombreCompleto || f.nombre, cargo: f.cargo || '', licencia: f.licencia ?? f.nro_licencia ?? '' }))
                    ),
                    finalize(() => this.tecnicoLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { this.tecnicosFiltrados = res || []; this.showTecnicoDropdown = (res || []).length > 0; });
    }

    onTecnicoInput(v: string): void {
        this.internalForm.patchValue({ buscarTecnico: v }, { emitEvent: false });
        if (v.length >= 2) this._tecnicoSearch$.next(v); else this.showTecnicoDropdown = false;
    }
    selectTecnico(t: any): void {
        this.internalForm.patchValue({ buscarTecnico: t.nombre, nombreCompleto: t.nombre, nroLicencia: t.licencia, cargo: t.cargo });
        this.showTecnicoDropdown = false;
    }
    hideTecnicoSuggestions(): void { setTimeout(() => this.showTecnicoDropdown = false, 200); }

    // ── Funcionario autocomplete (devolución)
    private _setupFuncionarioSearch(): void {
        this._funcionarioSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showFuncionarioDropdown = false; return of([]); }
                this.funcionarioLoading = true;
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({ id: String(f.id_employee || f.id), nombre: f.nombreCompleto || `${f.nombre||''} ${f.apellido_paterno||''}`.trim(), cargo: f.cargo || '', licencia: f.licencia || f.nro_licencia || '' }))
                    ),
                    finalize(() => this.funcionarioLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { this.funcionariosFiltrados = res || []; this.showFuncionarioDropdown = this.funcionariosFiltrados.length > 0; });
    }

    onFuncionarioInput(val: string): void { this.devolucionForm.patchValue({ funcionario: val }); this._funcionarioSearch$.next(val); }
    selectFuncionario(f: any): void { this._funcionarioNombre = f.nombre; this._funcionarioLicencia = f.licencia; this.devolucionForm.patchValue({ funcionario: f.nombre }); this.showFuncionarioDropdown = false; }
    hideFuncionarioDropdown(): void { setTimeout(() => this.showFuncionarioDropdown = false, 150); }

    // ── Aeronaves
    private cargarAeronaves(): void {
        this.fleetSvc.getAircraft({ limit: 100 } as any).pipe(takeUntil(this.destroy$)).subscribe({
            next: (data: any[]) => {
                this.aeronaves = [...data.map((a: any) => ({ matricula: a.registration || a.matricula || '', tipo: a.manufacturer || '' })), { matricula: 'N/A', tipo: 'No Aplica' }];
            }
        });
    }

    // ── Herramienta search (devolución)
    private _cargarHerramientas(): void {
        this.herramientaLoading = true;
        this.movementSvc.getHerramientasDisponibles({}).pipe(
            takeUntil(this.destroy$), finalize(() => this.herramientaLoading = false), catchError(() => of([]))
        ).subscribe((tools: any[]) => {
            this.todasLasHerramientas = (tools || []).map((t: any) => ({
                id: t.id_tool ?? t.id, codigo: t.code ?? t.codigo ?? '',
                nombre: t.name ?? t.nombre ?? '', pn: t.part_number ?? t.pn ?? '', sn: t.serial_number ?? t.sn ?? ''
            }));
        });
    }

    onHerramientaInput(val: string): void {
        this.devolucionForm.patchValue({ codigoHerramienta: val });
        this._herramientaSeleccionada = null;
        const term = val.trim().toLowerCase();
        if (term.length < 2) { this.herramientasFiltradas = []; this.showHerramientaDropdown = false; return; }
        this.herramientasFiltradas = this.todasLasHerramientas
            .filter(h => h.codigo.toLowerCase().includes(term) || h.nombre.toLowerCase().includes(term) || h.pn.toLowerCase().includes(term))
            .slice(0, 12);
        this.showHerramientaDropdown = this.herramientasFiltradas.length > 0;
    }
    selectHerramienta(h: any): void { this._herramientaSeleccionada = { codigo: h.codigo, nombre: h.nombre }; this.devolucionForm.patchValue({ codigoHerramienta: h.codigo }); this.herramientasFiltradas = []; this.showHerramientaDropdown = false; }
    clearHerramienta(): void { this._herramientaSeleccionada = null; this.devolucionForm.patchValue({ codigoHerramienta: '' }); this.herramientasFiltradas = []; this.showHerramientaDropdown = false; }
    hideHerramientaDropdown(): void { setTimeout(() => this.showHerramientaDropdown = false, 150); }

    // ── Modales préstamo
    abrirModalDatosInterno(): void { this.dialogRefActual = this.dialog.open(this.datosInternoModal, { width:'650px', maxWidth:'95vw', panelClass:'no-padding-dialog', disableClose:true }); }
    cerrarModalDatosInterno(): void { this.dialogRefActual?.close(); }

    isInternalDataValid(): boolean { return this.internalForm.valid; }
    hasErrorInternal(field: string, error: string): boolean { const c = this.internalForm.get(field); return c ? c.hasError(error) && c.touched : false; }

    procesar(): void {
        this.internalForm.markAllAsTouched();
        if (this.internalForm.invalid) { this.showMsg('error', 'Complete los datos del préstamo'); this.abrirModalDatosInterno(); return; }
        if (this.internalDataSource().length === 0) { this.showMsg('warning', 'Agregue al menos una herramienta'); return; }
        this.dialogRefActual = this.dialog.open(this.confirmInternoModal, { width:'600px', maxWidth:'95vw', panelClass:'no-padding-dialog', disableClose:true });
    }
    cerrarModalConfirmInterno(): void { this.dialogRefActual?.close(); }

    finalizarInterno(): void {
        this.cerrarModalConfirmInterno();
        this.isSaving = true;
        const fv    = this.internalForm.getRawValue();
        const items = this.internalDataSource();
        const itemsJson = JSON.stringify(items.map(i => ({
            tool_id: i.toolId, quantity: i.cantidad, notes: i.contenido || '',
            condition: this.conditionMap[i.estado?.toUpperCase()] || 'good'
        })));
        this.movementSvc.registrarPrestamoMultiple({
            type: 'PRESTAMO_INTERNO', date: fv.fecha, time: fv.hora,
            requested_by_name: fv.nombreCompleto, technician: fv.nombreCompleto,
            authorized_by: fv.nroLicencia, department: fv.destino || '',
            aircraft: fv.matriculaAeronave || '', work_order_number: fv.ordenTrabajo || '',
            special_work: fv.trabajoEspecial || false, notes: fv.observaciones || '', items_json: itemsJson
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.nroNotaInterno.set(nro);
                this._imprimirPrestamoInterno(nro, fv, items);
                this.showMsg('success', `Préstamo registrado: ${nro}`);
                this.internalDataSource.set([]);
                this.initInternalForm();
                if (this.dialogRef) this.dialogRef.close({ success: true, movement_number: nro });
            },
            error: (err: any) => this.showMsg('error', err?.message || 'Error al registrar')
        });
    }

    // ── Items de préstamo
    openHerramientasAPrestar(): void {
        const ref = this.dialog.open(ModalHerramientaInternoComponent, { width:'900px', maxWidth:'95vw', panelClass:'no-padding-dialog', disableClose:true });
        ref.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                const d = result.data;
                const item: InternalLoanItem = {
                    toolId: d.id_tool ?? 0, id: Date.now(), codigo: d.codigo || '', pn: d.pn || '',
                    descripcion: d.nombre || '', sn: d.sn || '', marca: d.marca || '',
                    fechaCalibracion: d.fechaVencimiento || '', cantidad: d.cantidad || 1,
                    unidad: d.unidad || 'PZA', estado: d.estado || 'SERVICEABLE', contenido: d.observacion || '', selected: false
                };
                this.internalDataSource.update(list => [...list, item]);
                this.showMsg('success', `"${item.descripcion}" agregada`);
            }
        });
    }

    toggleSelInternal(item: InternalLoanItem): void { item.selected = !item.selected; this.internalDataSource.set([...this.internalDataSource()]); }
    toggleAllInternal(e: any): void { this.internalDataSource.set(this.internalDataSource().map(i => ({ ...i, selected: e.checked }))); }
    isAllSelInternal(): boolean { return this.internalDataSource().length > 0 && this.internalDataSource().every(i => i.selected); }
    isSomeSelInternal(): boolean { return this.internalDataSource().some(i => i.selected) && !this.isAllSelInternal(); }
    getSelCountInternal(): number { return this.internalDataSource().filter(i => i.selected).length; }
    getTotalInternal(): number { return this.internalDataSource().reduce((s, i) => s + i.cantidad, 0); }
    eliminarSeleccionadosInterno(): void { this.internalDataSource.set(this.internalDataSource().filter(i => !i.selected)); }

    eliminarItemInterno(idx: number): void {
        const item = this.internalDataSource()[idx];
        this.internalDataSource.update(list => list.filter((_, i) => i !== idx));
        this.showMsg('info', `"${item.descripcion}" eliminada`);
    }

    // ── Modales devolución
    abrirModalBusqueda(): void { this.dialogRefActual = this.dialog.open(this.busquedaModal, { width:'700px', maxWidth:'95vw', panelClass:'no-padding-dialog', disableClose:true }); }
    cerrarModalBusqueda(): void { this.dialogRefActual?.close(); }

    hasError(field: string, error: string): boolean { const c = this.devolucionForm.get(field); return c ? c.hasError(error) && c.touched : false; }
    isBusquedaValida(): boolean { const f = this.devolucionForm.value; return !!f.funcionario && !!f.responsableRecibe; }

    realizarConsulta(): void {
        const nombre = this._funcionarioNombre || this.devolucionForm.get('funcionario')?.value || '';
        if (!nombre) { this.showMsg('warning', 'Seleccione un técnico de la lista'); return; }
        if (!this.devolucionForm.value.responsableRecibe?.trim()) { this.showMsg('warning', 'Ingrese quien recibe'); return; }

        this.isSearching = true;
        this.dataSourceDevolucion = [];
        const codigoFiltro = (this.devolucionForm.get('codigoHerramienta')?.value || '').trim();
        const nombreSafe = nombre.replace(/'/g, "''");
        const licSafe    = this._funcionarioLicencia.replace(/'/g, "''");
        const filtro     = `loa.status = 'ACTIVO' AND loa.loan_type = 'INTERNO' AND (loa.borrower_name ILIKE '%${nombreSafe}%' OR loa.borrower_license = '${licSafe}')`;

        forkJoin({
            loans: this.movementSvc.getActiveLoans({ filtro_adicional: filtro }),
            items: this.movementSvc.getActiveLoanItems()
        }).pipe(takeUntil(this.destroy$), finalize(() => this.isSearching = false)).subscribe({
            next: ({ loans, items }) => {
                if (!loans?.length) { this.showMsg('info', `Sin préstamos activos para ${nombre}`); this.cerrarModalBusqueda(); return; }
                let resultado: DevolucionItem[] = loans.flatMap((loan: any) => {
                    const loanItems = (items || []).filter((i: any) => String(i.loan_id) === String(loan.id_loan));
                    return loanItems.map((item: any) => ({
                        toolId: String(item.tool_id || ''), codigo: item.code || '',
                        imagen: item.image_url || null, descripcion: item.description || item.name || '',
                        pn: item.part_number || '', sn: item.serial_number || '',
                        und: item.unit_of_measure || 'UND', marca: item.brand || '', listaContenido: '',
                        fechaCalibracion: item.calibration_date || '', estadoAlPrestar: item.condition_on_loan || 'BUENO',
                        fechaPrestamo: loan.loan_date || '', cantidadPrestada: Number(item.quantity) || 1,
                        cantidadDevolver: Number(item.quantity) || 1, aeronave: loan.aircraft || '',
                        ordenTrabajo: loan.work_order_number || '',
                        diasFuera: loan.loan_date ? Math.ceil(Math.abs(new Date().getTime() - new Date(loan.loan_date).getTime()) / 86400000) : 0,
                        condicionDevolucion: 'BUENO' as CondicionDevolucion, observacionItem: '', selected: false
                    }));
                });
                if (codigoFiltro) resultado = resultado.filter(i => i.codigo.toLowerCase().includes(codigoFiltro.toLowerCase()) || i.pn.toLowerCase().includes(codigoFiltro.toLowerCase()));
                if (!resultado.length) { this.showMsg('info', 'Sin herramientas con ese criterio'); return; }
                this.dataSourceDevolucion = resultado;
                this.showMsg('success', `${resultado.length} herramienta(s) cargadas`);
                this.cerrarModalBusqueda();
            },
            error: (err) => this.showMsg('error', 'Error al consultar: ' + (err?.message || ''))
        });
    }

    abrirConfirmDevolucion(): void {
        const val = this._validateDevolucion();
        if (!val.valid) { val.errors.forEach(e => this.showMsg('error', e)); return; }
        if (!this._funcionarioNombre) { this.showMsg('error', 'Busque y seleccione un técnico'); this.abrirModalBusqueda(); return; }
        this.dialogRefActual = this.dialog.open(this.confirmDevolucionModal, { width:'700px', maxWidth:'95vw', panelClass:'no-padding-dialog', disableClose:true });
    }
    cerrarConfirmDevolucion(): void { this.dialogRefActual?.close(); }

    toggleSelDevolucion(item: DevolucionItem): void { item.selected = !item.selected; }
    toggleAllDevolucion(e: any): void { this.dataSourceDevolucion.forEach(i => i.selected = e.checked); }
    isAllSelDevolucion(): boolean { return this.dataSourceDevolucion.length > 0 && this.dataSourceDevolucion.every(i => i.selected); }
    isSomeSelDevolucion(): boolean { return this.dataSourceDevolucion.some(i => i.selected) && !this.isAllSelDevolucion(); }
    getSelCountDevolucion(): number { return this.dataSourceDevolucion.filter(i => i.selected).length; }
    getSelDevolucionItems(): DevolucionItem[] { return this.dataSourceDevolucion.filter(i => i.selected); }

    getDiasFueraClass(dias: number): string {
        if (dias <= 3)  return 'bg-green-100 text-green-800 border-green-300';
        if (dias <= 7)  return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        if (dias <= 15) return 'bg-orange-100 text-orange-800 border-orange-300';
        return 'bg-red-100 text-red-800 border-red-400';
    }

    onCondicionChange(item: DevolucionItem): void { if (item.condicionDevolucion === 'BUENO') item.observacionItem = ''; }
    getCondicionCfg(cond: CondicionDevolucion) { return this.condiciones.find(c => c.value === cond); }
    getCondicionIcon(cond: CondicionDevolucion): string { return this.condiciones.find(c => c.value === cond)?.icon || 'help_outline'; }
    validateCantidad(item: DevolucionItem): void { if (item.cantidadDevolver < 1) item.cantidadDevolver = 1; if (item.cantidadDevolver > item.cantidadPrestada) item.cantidadDevolver = item.cantidadPrestada; }

    private _validateDevolucion(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const sel = this.getSelDevolucionItems();
        if (!sel.length) { errors.push('Seleccione al menos una herramienta'); return { valid: false, errors }; }
        sel.forEach(i => {
            if (i.cantidadDevolver <= 0 || i.cantidadDevolver > i.cantidadPrestada) errors.push(`${i.codigo}: Cantidad inválida`);
            if ((i.condicionDevolucion === 'DAÑADO' || i.condicionDevolucion === 'FALTANTE') && !i.observacionItem.trim()) errors.push(`${i.codigo}: Falta observación`);
        });
        return { valid: errors.length === 0, errors };
    }

    getResumenCondicion(): { condicion: string; cantidad: number; color: string }[] {
        const mapa: Record<string, number> = {};
        this.getSelDevolucionItems().forEach(i => { mapa[i.condicionDevolucion] = (mapa[i.condicionDevolucion] || 0) + 1; });
        return Object.entries(mapa).map(([k, v]) => {
            const cfg = this.condiciones.find(c => c.value === k);
            return { condicion: cfg?.label || k, cantidad: v, color: cfg?.bgColor || '' };
        });
    }

    finalizarDevolucion(): void {
        const val = this._validateDevolucion();
        if (!val.valid) { val.errors.forEach(e => this.showMsg('error', e)); return; }
        this.cerrarConfirmDevolucion();
        this.isSaving = true;
        const sel = this.getSelDevolucionItems();
        const itemsJson = JSON.stringify(sel.map(i => ({
            tool_id: Number(i.toolId), quantity: i.cantidadDevolver, condicion: i.condicionDevolucion,
            unit_of_measure: i.und || '', content_list: i.listaContenido || '',
            estado_al_prestar: i.estadoAlPrestar || '', notes: i.observacionItem || ''
        })));
        this.movementSvc.registrarDevolucionPrestamo({
            type: 'DEVOLUCION_PRESTAMO_INTERNO', date: this.devolucionForm.value.fechaDevolucion,
            time: new Date().toTimeString().slice(0, 8),
            requested_by_name: this.devolucionForm.value.funcionario,
            responsible_person: this.devolucionForm.value.responsableRecibe,
            recipient: this.devolucionForm.value.funcionario,
            destination_unit: this.devolucionForm.value.unidadDestino || '',
            work_order_number: this.devolucionForm.value.ordenTrabajo || '',
            notes: this.devolucionForm.value.observaciones || '', items_json: itemsJson
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                this.showMsg('success', `Devolución registrada: ${result?.movement_number || '---'}`);
                this.dataSourceDevolucion = this.dataSourceDevolucion.filter(i => {
                    if (!i.selected) return true;
                    return i.cantidadDevolver < i.cantidadPrestada;
                });
                this.dataSourceDevolucion.forEach(i => {
                    if (i.selected && i.cantidadDevolver < i.cantidadPrestada) {
                        i.cantidadPrestada -= i.cantidadDevolver;
                        i.cantidadDevolver  = i.cantidadPrestada;
                        i.selected = false;
                    }
                });
            },
            error: (err) => this.showMsg('error', 'Error al registrar: ' + (err?.message || ''))
        });
    }

    // ── Impresión
    private _imprimirPrestamoInterno(nro: string, fv: any, items: InternalLoanItem[]): void {
        const w = window.open('', '_blank');
        if (!w) return;
        const now  = new Date().toLocaleString('es-BO');
        const rows = items.map(i => `<tr><td>${i.codigo||'-'}</td><td>${i.pn||'-'}</td><td>${i.sn||'-'}</td><td style="text-align:center;font-weight:700">${i.cantidad}</td><td>${i.unidad||'PZA'}</td><td>${i.descripcion||'-'}</td><td>${i.contenido||'-'}</td><td>${i.fechaCalibracion||'-'}</td><td>${i.estado||'SERVICEABLE'}</td><td>&nbsp;</td></tr>`).join('');
        const css  = `<style>@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:0}.top{display:flex;justify-content:space-between;margin-bottom:5px}.code-box{border:2px solid #000;padding:3px 10px;font-weight:900;font-size:13px;display:inline-block}h1{text-align:center;font-size:12px;font-weight:900;text-transform:uppercase;background:#111A43;color:white;padding:7px 10px;margin:0 0 7px;border:1px solid #000}.info-tbl{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:7px}.info-tbl td{border:1px solid #ddd;padding:3px 6px}.lbl{background:#f0f0f0;font-weight:700;font-size:9px;width:130px}.nro-cell{background:#f0f0f0;text-align:center;font-weight:900;font-size:15px;vertical-align:middle;width:120px}.sec{background:#111A43;color:white;padding:3px 8px;font-weight:900;font-size:10px;text-transform:uppercase;border:1px solid #000}table.det{width:100%;border-collapse:collapse;border:1px solid #000}table.det th{background:#111A43;color:white;padding:5px 4px;font-size:8.5px;font-weight:900;text-transform:uppercase;border:1px solid #000;text-align:center}table.det td{padding:4px;border:1px solid #ddd;font-size:9px}table.det tr:nth-child(even) td{background:#f9f9f9}.nota{border:1px solid #ccc;padding:5px 8px;margin-top:8px;font-size:8.5px;background:#fffde7;line-height:1.5}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.sig{border:1px solid #000;padding:6px 8px;text-align:center}.sig-ttl{font-weight:900;font-size:9px;text-transform:uppercase;margin-bottom:26px;line-height:1.4}.sig-line{border-top:1px solid #000;padding-top:3px;font-size:8.5px}.footer{text-align:center;margin-top:10px;font-size:7.5px;color:#888;border-top:1px dotted #ccc;padding-top:4px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MGH-100 ${nro}</title>${css}</head><body>
<div class="top"><div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145#114 &nbsp; N-114</div><div style="text-align:right"><div class="code-box">MGH-100</div><br><span style="font-size:9px">REV. 0 &nbsp; 2016-10-13</span></div></div>
<h1>NOTA DE PRÉSTAMO - DEVOLUCIÓN<br><span style="font-size:10px;font-weight:400">HERRAMIENTAS, BANCOS DE PRUEBA Y EQUIPOS DE APOYO</span></h1>
<table class="info-tbl">
<tr><td class="lbl">NOMBRE SOLICITANTE:</td><td>${fv.nombreCompleto||''}</td><td class="lbl">UNIDAD DESTINO:</td><td>${fv.destino||''}</td><td class="nro-cell" rowspan="4"><div style="font-size:8px;font-weight:400">N° NOTA</div>${nro}</td></tr>
<tr><td class="lbl">LICENCIA:</td><td>${fv.nroLicencia||''}</td><td class="lbl">ORDEN DE TRABAJO:</td><td>${fv.ordenTrabajo||''}</td></tr>
<tr><td class="lbl">MATRÍCULA AERONAVE:</td><td>${fv.matriculaAeronave||''}</td><td class="lbl">TRABAJO ESPECIAL:</td><td>${fv.trabajoEspecial?'SÍ':'NO'}</td></tr>
<tr><td class="lbl">FECHA Y HORA:</td><td>${fv.fecha||''} ${fv.hora||''}</td><td class="lbl">OBSERVACIONES:</td><td>${fv.observaciones||''}</td></tr>
</table>
<div class="sec">DATOS PRÉSTAMO</div>
<table class="det"><thead><tr><th>CÓDIGO</th><th>P/N ó MODELO</th><th>S/N</th><th>CANT.</th><th>UND</th><th>DESCRIPCIÓN</th><th>LISTA CONTENIDO</th><th>FECHA CALIBRACIÓN</th><th>ESTADO</th><th>OBS</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sec" style="margin-top:6px">DATOS DEVOLUCIÓN</div>
<table class="det"><thead><tr><th>FECHA/HORA</th><th colspan="2">ENTREGUE CONFORME (NOMBRE/FIRMA)</th><th colspan="2">RECIBI CONFORME (NOMBRE/FIRMA)</th><th>CONDICIÓN DEVOLUCIÓN</th><th>NRO. REPORTE AVERÍA</th><th>OBS</th></tr></thead><tbody>${items.map(()=>`<tr><td style="height:28px">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('')}</tbody></table>
<div class="nota"><strong>NOTA IMPORTANTE:</strong><br>- Para cada herramienta prestada, se encuentra detallada la condición en la que se esta prestando.<br>- Las herramientas deben devolverse en las mismas condiciones en las que fueron prestadas.<br>- En caso de avería, registrar en el formulario REPORTE DE DISCREPANCIA.</div>
<div class="sigs"><div class="sig"><div class="sig-ttl">ENTREGADO POR<br>FIRMA ALMACÉN HERRAMIENTAS</div><div style="font-size:9px;margin-bottom:20px">${fv.nombreCompleto}</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">RECIBIDO POR<br>FIRMA TÉC. O INSP.</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">AUTORIZADO</div><div class="sig-line">&nbsp;</div></div></div>
<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},500);};</script>
</body></html>`);
        w.document.close();
    }

    private showMsg(type: 'success'|'error'|'info'|'warning', text: string): void {
        this.snackBar.open(text, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
