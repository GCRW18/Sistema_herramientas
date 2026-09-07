import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, finalize, map, catchError } from 'rxjs/operators';

import { MovementService } from '../../../../../../core/services/movement.service';
import { ToolService } from '../../../../../../core/services/tool.service';
import { localDateStr } from '../../../../../../core/utils/date.utils';
import {
    Ubicacion, ToolEnvioItem, Funcionario, PersonaTecnico, TIPOS_TRASPASO, CONDICIONES_ENVIO, motivoBloqueoSalida
} from '../../retorno-traspaso.types';

export interface TraspasoTecnicoDialogData {
    almacenes: Ubicacion[];
    bases:     Ubicacion[];
    defaultAlmacen?: Ubicacion | null;
}

@Component({
    selector: 'app-traspaso-tecnico-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule, MatSnackBarModule
    ],
    templateUrl: './traspaso-tecnico-dialog.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
    `]
})
export class TraspasoTecnicoDialogComponent implements OnInit, OnDestroy {

    @ViewChild('scanInputTecnico') scanInputRef!: ElementRef<HTMLInputElement>;

    private dialogRef = inject(MatDialogRef<TraspasoTecnicoDialogComponent>);
    data              = inject<TraspasoTecnicoDialogData>(MAT_DIALOG_DATA);
    private dialog    = inject(MatDialog);
    private fb        = inject(FormBuilder);
    private snackBar  = inject(MatSnackBar);
    private movSvc    = inject(MovementService);
    private toolSvc   = inject(ToolService);
    private _unsub$   = new Subject<void>();
    private _srchTecnico$       = new Subject<string>();
    private _srchPersona$       = new Subject<string>();
    private _srchEntrega$       = new Subject<string>();

    // ── Escaneo QR / wedge ──
    scanValueTecnico = '';
    scanningTecnico  = false;
    private _scanTecnico$ = new Subject<string>();
    private _pendingScanTecnico = '';

    traspasoTecnicoForm!: FormGroup;
    itemsTraspasoTecnico: ToolEnvioItem[] = [];
    isSavingTraspasoTecnico = false;

    // Correlativo propio TRPT — separado del TRP de traspaso de área (he.ft_movements_ime #3).
    trptCorrelativoPreview = '';
    loadingCorrelativoTrpt = false;

    // Locations
    get almacenes(): Ubicacion[] { return this.data.almacenes || []; }
    get bases(): Ubicacion[]     { return this.data.bases     || []; }

    // Tool search (mismo input que el escaneo — ver scanValueTecnico/onScanTecnicoInput)
    toolResultsTecnico: any[] = [];
    showToolDropTecnico  = false;
    searchingToolsTecnico = false;

    // Persona técnico autocomplete
    personasTecnico: PersonaTecnico[]  = [];
    personaTecnicoLoading              = false;
    showPersonaTecnicoDropdown         = false;

    // Funcionario entrega autocomplete
    funcEntregaTecnico: Funcionario[]  = [];
    funcEntregaTecnicoLoading          = false;
    showFuncEntregaTecnicoDropdown     = false;

    tiposTraspasoTecnico = TIPOS_TRASPASO;
    condicionesEnvio     = CONDICIONES_ENVIO;

    // Base destino autocomplete
    basesFiltradas: Ubicacion[] = [];
    showBaseDropdown = false;

    ngOnInit(): void {
        const today = localDateStr();
        this.traspasoTecnicoForm = this.fb.group({
            nombreCompletoInput:   ['', Validators.required],
            nroLicencia:           ['', Validators.required],
            cargo:                 ['', Validators.required],
            responsableEntrega:    ['', Validators.required],
            unidad:                ['', Validators.required],
            fecha:                 [today, Validators.required],
            base:                  [null, Validators.required],
            baseTexto:             [''],
            tipoTraspaso:          ['TEMPORAL'],
            fechaRetornoEsperada:  [''],
            observaciones:         ['']
        });
        this._setupSearches();

        // Prellena "Responsable de Entrega" con el usuario logueado (editable). emitEvent:false
        // para no disparar el autocompletado de funcionarios al abrir el formulario.
        const currentUser = this._currentUserName();
        if (currentUser) this.traspasoTecnicoForm.patchValue({ responsableEntrega: currentUser }, { emitEvent: false });

        // Almacén destino autocomplete (lista ya cargada en memoria, filtro sincrónico).
        // OJO: usa this.almacenes (he.twarehouses), NO this.bases (param.tlugar) — el
        // campo se guarda en destination_warehouse_id, cuya FK apunta a he.twarehouses.
        // Enviar un id_lugar ahí viola la FK (tmovements_dest_warehouse_fkey).
        this.traspasoTecnicoForm.get('baseTexto')!.valueChanges.pipe(
            debounceTime(100), takeUntil(this._unsub$)
        ).subscribe(term => {
            const seleccionActual = this.traspasoTecnicoForm.get('base')?.value as Ubicacion | null;
            if (seleccionActual && seleccionActual.nombre !== term) {
                this.traspasoTecnicoForm.patchValue({ base: null }, { emitEvent: false });
            }
            const q = (term || '').trim().toLowerCase();
            this.basesFiltradas = q ? this.almacenes.filter(b => b.nombre.toLowerCase().includes(q)) : this.almacenes;
            this.showBaseDropdown = this.basesFiltradas.length > 0;
        });

        this._setupScanTecnico();
        this._fetchTrptCorrelativoPreview();
        setTimeout(() => this._focusScanTecnico(), 150);
    }

    private _fetchTrptCorrelativoPreview(): void {
        this.loadingCorrelativoTrpt = true;
        this.movSvc.getSiguienteCorrelativoPreview('TRPT')
            .pipe(takeUntil(this._unsub$), finalize(() => this.loadingCorrelativoTrpt = false))
            .subscribe({ next: (nro) => this.trptCorrelativoPreview = nro });
    }

    // ── Escaneo: código → busca la herramienta y la agrega (mismo chequeo que la búsqueda) ──
    private _setupScanTecnico(): void {
        this._scanTecnico$.pipe(
            debounceTime(120), distinctUntilChanged(),
            switchMap(code => {
                const q = code.trim();
                if (q.length < 2) return of({ code: q, tools: [] as any[] });
                this.scanningTecnico = true;
                return this.toolSvc.getTools({ query: q }).pipe(
                    catchError(() => of([] as any[])),
                    finalize(() => this.scanningTecnico = false),
                    map(tools => ({ code: q, tools: tools || [] }))
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe(({ code, tools }) => {
            if (!this._pendingScanTecnico || this._pendingScanTecnico !== code) return;
            this._pendingScanTecnico = '';
            const exact = tools.find((t: any) => String(t.code ?? t.codigo ?? '').trim().toUpperCase() === code.toUpperCase());
            const target = exact || (tools.length === 1 ? tools[0] : null);
            if (target) { this.addToolTecnico(target); this.scanValueTecnico = ''; this._focusScanTecnico(); }
            else this._showMsg(`"${code}" — sin coincidencia exacta, use la búsqueda`, 'warning');
        });
    }
    private _focusScanTecnico(): void { setTimeout(() => { try { this.scanInputRef?.nativeElement.focus(); } catch { /* view not ready */ } }, 50); }
    /** Un solo input hace de escáner (Enter/wedge → coincidencia exacta) y de buscador
     *  (dropdown de sugerencias mientras se escribe), igual que Préstamo Técnico. */
    onScanTecnicoInput(v: string): void { this.scanValueTecnico = v; this._srchTecnico$.next(v); }
    scanTecnicoEnter(): void {
        const code = this.scanValueTecnico.trim();
        if (!code) return;
        this._pendingScanTecnico = code;
        this._scanTecnico$.next(code);
    }

    onBaseFocus(): void {
        const q = (this.traspasoTecnicoForm.get('baseTexto')?.value || '').trim().toLowerCase();
        this.basesFiltradas = q ? this.almacenes.filter(b => b.nombre.toLowerCase().includes(q)) : this.almacenes;
        this.showBaseDropdown = this.basesFiltradas.length > 0;
    }
    hideBaseDropdown(): void { setTimeout(() => this.showBaseDropdown = false, 150); }
    selectBase(b: Ubicacion): void {
        this.traspasoTecnicoForm.patchValue({ base: b, baseTexto: b.nombre }, { emitEvent: false });
        this.showBaseDropdown = false;
    }

    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    private _currentUserName(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || '';
        } catch { return ''; }
    }

    private _setupSearches(): void {
        // Tool search
        this._srchTecnico$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                if (!term || term.trim().length < 2) {
                    this.toolResultsTecnico = []; this.showToolDropTecnico = false; return of([]);
                }
                this.searchingToolsTecnico = true;
                return this.toolSvc.getTools({ query: term.trim() }).pipe(finalize(() => this.searchingToolsTecnico = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (tools: any[]) => {
            this.toolResultsTecnico = tools.slice(0, 12);
            this.showToolDropTecnico = this.toolResultsTecnico.length > 0;
        }});

        // Persona técnico
        this._srchPersona$.pipe(debounceTime(300), distinctUntilChanged(),
            switchMap(q => {
                if (!q || q.length < 2) { this.personasTecnico = []; this.showPersonaTecnicoDropdown = false; return of([]); }
                this.personaTecnicoLoading = true;
                const ql = q.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno].filter(Boolean).join(' ').toLowerCase().includes(ql))
                        .slice(0, 10)
                        .map(f => ({ id: String(f.id_employee || f.id || ''), nombre: f.nombreCompleto || f.nombre || '', cargo: f.cargo || '', licencia: f.nro_licencia || f.licencia || '', area: f.area || f.departamento || '' }))),
                    finalize(() => this.personaTecnicoLoading = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (r: any[]) => {
            this.personasTecnico = r;
            this.showPersonaTecnicoDropdown = this.personasTecnico.length > 0;
        }});

        // Entrega autocomplete
        this._srchEntrega$.pipe(debounceTime(300), distinctUntilChanged(),
            switchMap(q => {
                if (!q || q.length < 2) { this.funcEntregaTecnico = []; this.showFuncEntregaTecnicoDropdown = false; return of([]); }
                this.funcEntregaTecnicoLoading = true;
                const ql = q.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno].filter(Boolean).join(' ').toLowerCase().includes(ql))
                        .slice(0, 10)
                        .map(f => ({ id: String(f.id_employee || f.id || ''), nombre: f.nombreCompleto || f.nombre || '', cargo: f.cargo || '' }))),
                    finalize(() => this.funcEntregaTecnicoLoading = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (r: any[]) => {
            this.funcEntregaTecnico = r;
            this.showFuncEntregaTecnicoDropdown = r.length > 0;
        }});

        // React to nombre changes for search
        this.traspasoTecnicoForm.get('nombreCompletoInput')!.valueChanges.pipe(
            debounceTime(300), takeUntil(this._unsub$)
        ).subscribe(v => this._srchPersona$.next(v || ''));

        // React to entrega changes
        this.traspasoTecnicoForm.get('responsableEntrega')!.valueChanges.pipe(
            debounceTime(300), takeUntil(this._unsub$)
        ).subscribe(v => this._srchEntrega$.next(v || ''));
    }

    // — Persona técnico —
    hidePersonaTecnicoDropdown(): void { setTimeout(() => this.showPersonaTecnicoDropdown = false, 150); }
    selectPersonaTecnico(p: PersonaTecnico): void {
        this.traspasoTecnicoForm.patchValue({
            nombreCompletoInput: p.nombre, nroLicencia: p.licencia, cargo: p.cargo, unidad: p.area || ''
        }, { emitEvent: false });
        this.showPersonaTecnicoDropdown = false;
    }

    // — Entrega —
    hideFuncEntregaTecnicoDropdown(): void { setTimeout(() => this.showFuncEntregaTecnicoDropdown = false, 150); }
    selectFuncEntregaTecnico(f: Funcionario): void { this.traspasoTecnicoForm.patchValue({ responsableEntrega: f.nombre }, { emitEvent: false }); this.showFuncEntregaTecnicoDropdown = false; }

    // — Tool search —
    hideToolDropTecnico(): void { setTimeout(() => this.showToolDropTecnico = false, 150); }
    addToolTecnico(tool: any): void {
        const id = tool.id_tool ?? tool.id;
        if (this.itemsTraspasoTecnico.some(i => i.toolId === id)) { this._showMsg('Herramienta ya en la lista', 'warning'); return; }
        const motivo = motivoBloqueoSalida(tool);
        if (motivo) { this._showMsg(`"${tool.name ?? tool.code ?? 'La herramienta'}" no puede salir del almacén: ${motivo}`, 'warning'); return; }
        this.itemsTraspasoTecnico.push({
            toolId: id, codigo: tool.code ?? tool.codigo ?? '',
            nombre: tool.name ?? tool.description ?? '', pn: tool.part_number ?? '',
            sn: tool.serial_number ?? '', marca: tool.brand ?? '', fechaVencCal: '',
            cantidad: 1, condicion: 'good', notas: ''
        });
        this.scanValueTecnico = ''; this.toolResultsTecnico = []; this.showToolDropTecnico = false;
        this._focusScanTecnico();
    }
    removeToolTecnico(i: number): void { this.itemsTraspasoTecnico.splice(i, 1); }

    async abrirDetalleHerramientaItem(item: ToolEnvioItem): Promise<void> {
        const { DetalleHerramientaComponent } = await import('../../../ingresos-hub/detalle-herramienta/detalle-herramienta.component');
        const editItem = {
            toolId: item.toolId, codigoBoa: item.codigo, pn: item.pn, sn: item.sn,
            descripcion: item.nombre, marca: item.marca, tipo: 'HERRAMIENTA',
            estado: item.condicion, cantidad: item.cantidad, um: item.unidad, obs: item.notesTool,
            imagenMaster: item.imagen, warehouseId: item.warehouseId,
            rackId: item.rackId, levelId: item.levelId
        };
        this.dialog.open(DetalleHerramientaComponent, {
            width: '800px', maxWidth: '96vw', height: '560px',
            panelClass: 'no-padding-dialog', hasBackdrop: true, disableClose: false, autoFocus: false,
            data: { editItem, viewOnly: true }
        });
    }

    requiereFechaRetornoTecnico(): boolean {
        const tipo = this.traspasoTecnicoForm.get('tipoTraspaso')?.value;
        return tipo === 'TEMPORAL' || tipo === 'PRESTAMO';
    }

    canSaveTraspasoTecnico(): boolean {
        return this.traspasoTecnicoForm.valid && this.itemsTraspasoTecnico.length > 0 && !this.isSavingTraspasoTecnico;
    }

    guardarTraspasoTecnico(): void {
        if (!this.canSaveTraspasoTecnico()) {
            this.traspasoTecnicoForm.markAllAsTouched();
            this._showMsg(this.itemsTraspasoTecnico.length === 0 ? 'Agregue al menos una herramienta' : 'Complete los campos requeridos', 'warning');
            return;
        }
        const form = this.traspasoTecnicoForm.value;
        const itemsJson = JSON.stringify(this.itemsTraspasoTecnico.map(it => ({
            tool_id: it.toolId, quantity: it.cantidad,
            condition_on_movement: it.condicion, serial_number: it.sn || '', part_number: it.pn || '', notes: it.notas || ''
        })));
        // Pestaña reservada en el gesto de usuario (click) para la Nota de Traspaso
        // Técnico MGH-109 — el navegador no la bloquea aunque el PDF real (TCPDF
        // backend) se genere después de que responda el guardado.
        const pdfWin = this.movSvc.preAbrirVentanaPdf();
        this.isSavingTraspasoTecnico = true;
        const payload: any = {
            date:               form.fecha,
            time:               new Date().toTimeString().slice(0, 8),
            received_by_name:   form.nombreCompletoInput || '',
            department:         form.unidad              || '',
            requested_by_name:  form.responsableEntrega  || '',
            responsible_person: form.responsableEntrega  || '',
            // El form no pide "Almacén Origen" explícito (es el almacén que entrega la
            // herramienta) — se usa el almacén por defecto del hub para que "Origen" no
            // quede vacío en la tabla de Activos.
            source_warehouse_id: this.data.defaultAlmacen?.id ? Number(this.data.defaultAlmacen.id) : undefined,
            destination_warehouse_id: form.base?.id ? Number(form.base.id) : undefined,
            exit_reason:        'area_transfer',
            transfer_type:      form.tipoTraspaso        || 'TEMPORAL',
            notes:              form.observaciones       || '',
            specific_observations:   'MGH109',
            // Licencia/cargo/unidad del TÉCNICO que recibe (reutiliza las mismas columnas
            // applicant_* de patch HE-82; para el traspaso de área describen al solicitante,
            // aquí al técnico — ver HE_NOTA_TRASPASO_TEC_SEL). Ya no se manda general_observations
            // con estos datos embebidos: la nota real (RReporteTraspasoTecnicoNota) los lee de columna.
            applicant_license:  form.nroLicencia || '',
            applicant_position: form.cargo       || '',
            applicant_unit:     form.unidad      || '',
            items_json:         itemsJson
        };
        if (form.fechaRetornoEsperada && this.requiereFechaRetornoTecnico()) {
            payload.expected_return_date = form.fechaRetornoEsperada;
        }
        this.movSvc.registrarTraspasoOtraArea(payload).pipe(
            finalize(() => this.isSavingTraspasoTecnico = false),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._showMsg(`MGH-109 registrado: ${nro}`, 'success');
                // Nota de Traspaso Técnico MGH-109 — PDF real TCPDF backend.
                const idMov = Number(result?.id_movement);
                if (idMov) this.movSvc.verNotaTraspasoTecnico(idMov, pdfWin);
                else { try { pdfWin?.close(); } catch { /* noop */ } }
                this.dialogRef.close({ refreshActivos: true, movementNumber: nro });
            },
            error: (e: any) => { try { pdfWin?.close(); } catch { /* noop */ } this._showMsg('Error al registrar: ' + (e?.message || ''), 'error'); }
        });
    }

    resetTraspasoTecnicoTab(): void {
        this.traspasoTecnicoForm.reset({ fecha: localDateStr(), tipoTraspaso: 'TEMPORAL', responsableEntrega: this._currentUserName() });
        this.itemsTraspasoTecnico = [];
        this.personasTecnico = []; this.showPersonaTecnicoDropdown = false;
        this.funcEntregaTecnico = []; this.showFuncEntregaTecnicoDropdown = false;
        this.scanValueTecnico = '';
        this._focusScanTecnico();
    }

    cerrarFormTraspasoTecnico(): void { this.dialogRef.close(); }

    private _showMsg(msg: string, type: 'success' | 'error' | 'warning'): void {
        const panelClass = type === 'success' ? 'snack-success' : type === 'error' ? 'snack-error' : 'snack-warning';
        this.snackBar.open(msg, '✕', { duration: 4000, panelClass: [panelClass] });
    }
}
