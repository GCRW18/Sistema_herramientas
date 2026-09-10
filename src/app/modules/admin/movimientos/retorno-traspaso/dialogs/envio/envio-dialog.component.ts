import {
    Component, OnInit, OnDestroy, inject, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap, of, map, catchError } from 'rxjs';

import { MovementService } from '../../../../../../core/services/movement.service';
import { ToolService } from '../../../../../../core/services/tool.service';
import { QrScanService } from '../../../../../../core/services/qr-scan.service';
import { FleetService } from '../../../../../../core/services/fleet.service';
import { localDateStr } from '../../../../../../core/utils/date.utils';
import {
    Ubicacion, ToolEnvioItem, Funcionario,
    CONDICIONES_ENVIO, abrirBlob, motivoBloqueoSalida
} from '../../retorno-traspaso.types';

export interface EnvioDialogData {
    almacenes: Ubicacion[];
    bases: Ubicacion[];
}

@Component({
    selector: 'app-envio-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule, MatSnackBarModule
    ],
    templateUrl: './envio-dialog.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class EnvioDialogComponent implements OnInit, OnDestroy {

    @ViewChild('scanInputEnv') scanInputRef!: ElementRef<HTMLInputElement>;

    private dialogRef = inject(MatDialogRef<EnvioDialogComponent>);
    private dialog    = inject(MatDialog);
    data              = inject<EnvioDialogData>(MAT_DIALOG_DATA);
    private fb        = inject(FormBuilder);
    private snackBar  = inject(MatSnackBar);
    private movSvc    = inject(MovementService);
    private toolSvc   = inject(ToolService);
    private qrScan    = inject(QrScanService);
    private fleetSvc  = inject(FleetService);
    private _unsub$   = new Subject<void>();
    private _srchEnvio$ = new Subject<string>();
    private _logoBoaDataUri: Promise<string> | null = null;

    // Catálogo de aeronaves (he.taircraft) — mismo origen que Préstamo Técnico.
    aeronaves: { matricula: string; tipo: string }[] = [];

    // ── Escaneo QR / wedge ──
    scanValueEnv = '';
    scanningEnv  = false;
    private _scanEnv$ = new Subject<string>();
    private _pendingScanEnv = '';

    envioForm!: FormGroup;
    itemsEnvio: ToolEnvioItem[] = [];

    // Búsqueda de herramienta (mismo input que el escaneo — ver scanValueEnv/onScanEnvInput)
    toolResultsEnvio: any[] = [];
    showToolDropEnvio   = false;
    searchingToolsEnvio = false;

    // Correlativo
    isSavingEnvio           = false;
    envCorrelativoPreview   = '';
    loadingCorrelativo      = false;

    // Funcionarios
    funcionariosEnvia: Funcionario[]  = [];
    funcEnviaLoading                  = false;
    showFuncEnviaDropdown             = false;
    funcionariosRecibe: Funcionario[] = [];
    funcRecibeLoading                 = false;
    showFuncRecibeDropdown            = false;

    // Dept (autocompletado)
    deptUbicacionesEnvio: Ubicacion[] = [];
    showDeptDropEnvio                  = false;

    readonly condicionesEnvio = CONDICIONES_ENVIO;

    get almacenes(): Ubicacion[] { return this.data.almacenes; }
    get bases(): Ubicacion[]    { return this.data.bases; }

    ngOnInit(): void {
        this._initForm();
        this._setupToolSearch();
        this._setupScanEnv();
        this._setupFuncSearch();
        this._setDefaultAlmacen();
        this._setDefaultResponsable();
        this._fetchCorrelativoPreview();
        this._cargarAeronaves();
        setTimeout(() => { try { this.scanInputRef?.nativeElement.focus(); } catch { /* view not ready */ } }, 150);
    }

    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    private _cargarAeronaves(): void {
        this.fleetSvc.getAircraft({ limit: 100 } as any).pipe(
            catchError(() => of([] as any[])),
            takeUntil(this._unsub$)
        ).subscribe((data: any[]) => {
            this.aeronaves = [
                ...data.map((a: any) => ({ matricula: a.registration || a.matricula || '', tipo: a.manufacturer || '' })),
                { matricula: 'N/A', tipo: 'No Aplica' }
            ];
        });
    }

    // ── Escaneo: código → busca la herramienta y la agrega (mismo chequeo que la búsqueda) ──
    private _setupScanEnv(): void {
        this._scanEnv$.pipe(
            debounceTime(120), distinctUntilChanged(),
            switchMap(code => {
                const q = code.trim();
                if (q.length < 2) return of({ code: q, tools: [] as any[] });
                this.scanningEnv = true;
                return this.toolSvc.getTools({ query: q }).pipe(
                    catchError(() => of([] as any[])),
                    finalize(() => this.scanningEnv = false),
                    map(tools => ({ code: q, tools: (tools || []) as any[] }))
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe(({ code, tools }) => {
            if (!this._pendingScanEnv || this._pendingScanEnv !== code) return;
            this._pendingScanEnv = '';
            const exact = tools.find((t: any) => String(t.code ?? t.codigo ?? '').trim().toUpperCase() === code.toUpperCase());
            const target = exact || (tools.length === 1 ? tools[0] : null);
            if (target) { this.addToolEnvio(target); this.scanValueEnv = ''; this._focusScanEnv(); }
            else this._showMsg(`"${code}" — sin coincidencia exacta, use la búsqueda`, 'warning');
        });
    }
    private _focusScanEnv(): void { setTimeout(() => { try { this.scanInputRef?.nativeElement.focus(); } catch { /* noop */ } }, 50); }
    /** Un solo input hace de escáner (Enter/wedge → coincidencia exacta) y de buscador
     *  (dropdown de sugerencias mientras se escribe), igual que Préstamo Técnico. */
    onScanEnvInput(v: string): void { this.scanValueEnv = v; this._srchEnvio$.next(v); }
    scanEnvEnter(): void {
        const raw = this.scanValueEnv.trim();
        if (!raw) return;
        // Etiqueta QR (URL `.../qr-code/<token>`): descifra a código plano y reintenta.
        if (this.qrScan.isQrLabel(raw)) {
            this.scanningEnv = true;
            this.qrScan.toToolCode(raw).pipe(takeUntil(this._unsub$)).subscribe(code => {
                this.scanningEnv = false;
                if (!code) { this._showMsg('Etiqueta QR no reconocida', 'warning'); this.scanValueEnv = ''; this._focusScanEnv(); return; }
                this.scanValueEnv = code;
                this.scanEnvEnter();
            });
            return;
        }
        this._pendingScanEnv = raw;
        this._scanEnv$.next(raw);
    }

    getAllUbicaciones(): Ubicacion[] { return [...this.bases, ...this.almacenes]; }

    private _initForm(): void {
        const today = localDateStr();
        const hora  = new Date().toTimeString().slice(0, 5);
        this.envioForm = this.fb.group({
            baseOrigen:           [null],
            baseDestino:          [null, Validators.required],
            fechaEnvio:           [today, Validators.required],
            horaEnvio:            [hora],
            responsableEnvia:     ['', Validators.required],
            recibeEnDestino:      [''],
            departamento:         [''],
            nroDocumento:         [''],
            tipoEnvio:            ['EVENTUAL'],
            fechaEsperadaRetorno: [''],
            nroVuelo:             [''],
            aeronave:             [''],
            notas:                ['']
        });
    }

    private _setupToolSearch(): void {
        this._srchEnvio$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                if (!term || term.trim().length < 2) {
                    this.toolResultsEnvio = []; this.showToolDropEnvio = false; return of([]);
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

    private _setupFuncSearch(): void {
        // Responsable envía
        this.envioForm.get('responsableEnvia')?.valueChanges.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(term => {
                const t = (term || '').trim();
                if (t.length < 2) { this.funcionariosEnvia = []; this.showFuncEnviaDropdown = false; return of([]); }
                this.funcEnviaLoading = true;
                const q = t.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10).map(f => ({ ...f, nombre: f.nombreCompleto || f.nombre }))),
                    finalize(() => this.funcEnviaLoading = false)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (data: any[]) => { this.funcionariosEnvia = data; this.showFuncEnviaDropdown = data.length > 0; },
            error: () => this.funcEnviaLoading = false
        });

        // Recibe en destino
        this.envioForm.get('recibeEnDestino')?.valueChanges.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(term => {
                const t = (term || '').trim();
                if (t.length < 2) { this.funcionariosRecibe = []; this.showFuncRecibeDropdown = false; return of([]); }
                this.funcRecibeLoading = true;
                const q = t.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10).map(f => ({ ...f, nombre: f.nombreCompleto || f.nombre }))),
                    finalize(() => this.funcRecibeLoading = false)
                );
            }),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (data: any[]) => { this.funcionariosRecibe = data; this.showFuncRecibeDropdown = data.length > 0; },
            error: () => this.funcRecibeLoading = false
        });
    }

    private _setDefaultAlmacen(): void {
        const cbba = this.almacenes.find(u => u.nombre.toLowerCase().includes('cochabamba')) ?? this.almacenes[0] ?? null;
        if (cbba) this.envioForm.patchValue({ baseOrigen: cbba }, { emitEvent: false });
    }

    /** Prellena "Responsable / Envía" con el usuario logueado (editable). emitEvent:false
     *  para no disparar el autocompletado de funcionarios al abrir el formulario. */
    private _setDefaultResponsable(): void {
        const user = this._currentUserName();
        if (user) this.envioForm.patchValue({ responsableEnvia: user }, { emitEvent: false });
    }

    private _currentUserName(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || '';
        } catch { return ''; }
    }

    private _fetchCorrelativoPreview(): void {
        this.loadingCorrelativo = true;
        this.envCorrelativoPreview = '';
        this.movSvc.getSiguienteCorrelativoPreview('ENV')
            .pipe(takeUntil(this._unsub$), finalize(() => this.loadingCorrelativo = false))
            .subscribe({ next: (nro) => {
                this.envCorrelativoPreview = nro;
                this.envioForm.patchValue({ nroDocumento: nro }, { emitEvent: false });
            }});
    }

    // ── Búsqueda de herramienta ──

    hideToolDropEnvio(): void { setTimeout(() => this.showToolDropEnvio = false, 150); }

    addToolEnvio(tool: any): void {
        const id = tool.id_tool ?? tool.id;
        if (this.itemsEnvio.some(i => i.toolId === id)) { this._showMsg('Herramienta ya en la lista', 'warning'); return; }
        const motivo = motivoBloqueoSalida(tool);
        if (motivo) { this._showMsg(`"${tool.name ?? tool.code ?? 'La herramienta'}" no puede salir del almacén: ${motivo}`, 'warning'); return; }
        this.itemsEnvio.push({
            toolId: id, codigo: tool.code ?? tool.codigo ?? '',
            nombre: tool.name ?? tool.description ?? '',
            pn: tool.part_number ?? '', sn: tool.serial_number ?? '',
            marca: tool.brand ?? tool.marca ?? '',
            fechaVencCal: tool.calibration_expiry_date ?? tool.next_calibration_date ?? '',
            cantidad: 1, condicion: 'good', notas: '',
            unidad: tool.unit_of_measure ?? tool.unidad ?? 'PZA',
            listaContenido: tool.content_list ?? '',
            imagen: tool.location_photo ?? null,
            notesTool: tool.notes ?? '',
            warehouseId: tool.warehouse_id != null ? Number(tool.warehouse_id) : null,
            rackId:      tool.rack_id      != null ? Number(tool.rack_id)      : null,
            levelId:     tool.level_id     != null ? Number(tool.level_id)     : null,
        });
        this.scanValueEnv = ''; this.toolResultsEnvio = []; this.showToolDropEnvio = false;
        this._focusScanEnv();
    }

    removeToolEnvio(i: number): void { this.itemsEnvio.splice(i, 1); }

    async abrirDetalleHerramientaItem(item: ToolEnvioItem): Promise<void> {
        const { DetalleHerramientaComponent } = await import('../../../ingresos-hub/detalle-herramienta/detalle-herramienta.component');
        const editItem = {
            toolId: item.toolId, codigoBoa: item.codigo, pn: item.pn, sn: item.sn,
            descripcion: item.nombre, marca: item.marca, tipo: 'HERRAMIENTA',
            estado: item.condicion, cantidad: item.cantidad, um: item.unidad || 'PZA', obs: item.notesTool,
            imagenMaster: item.imagen, warehouseId: item.warehouseId,
            rackId: item.rackId, levelId: item.levelId
        };
        this.dialog.open(DetalleHerramientaComponent, {
            width: '800px', maxWidth: '96vw', height: '560px',
            panelClass: 'no-padding-dialog', hasBackdrop: true, disableClose: false, autoFocus: false,
            data: { editItem, viewOnly: true }
        });
    }

    // ── Funcionarios ───────────────────────────────────────────────────────────

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

    // ── Autocompletado de departamento ──

    onDeptChangeEnvio(term: string): void {
        const q = (term || '').toLowerCase().trim();
        if (!q) { this.deptUbicacionesEnvio = []; this.showDeptDropEnvio = false; return; }
        this.deptUbicacionesEnvio = this.getAllUbicaciones().filter(u => u.nombre.toLowerCase().includes(q)).slice(0, 10);
        this.showDeptDropEnvio = this.deptUbicacionesEnvio.length > 0;
    }
    selectDeptEnvio(nombre: string): void {
        this.envioForm.patchValue({ departamento: nombre });
        this.deptUbicacionesEnvio = []; this.showDeptDropEnvio = false;
    }
    hideDeptDropEnvio(): void { setTimeout(() => this.showDeptDropEnvio = false, 150); }

    // ── Save ───────────────────────────────────────────────────────────────────

    requiereFechaRetornoEnvio(): boolean { return this.envioForm.get('tipoEnvio')?.value === 'PERMANENTE'; }

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
            serial_number: it.sn || '', part_number: it.pn || '', notes: it.notas || '',
            unit_of_measure: it.unidad || '', content_list: it.listaContenido || ''
        })));

        // Pestaña reservada en el gesto (click) para la nota "Registro de Herramientas
        // en Otras Bases" — PDF real TCPDF backend generado tras responder el guardado.
        const pdfWin = this.movSvc.preAbrirVentanaPdf();
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
            notes: form.notas || '',
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
                // Nota "Registro de Herramientas en Otras Bases" — PDF real TCPDF backend.
                const idMov = Number(result?.id_movement);
                if (idMov) this.movSvc.verNotaEnvio(idMov, pdfWin);
                else { try { pdfWin?.close(); } catch { /* noop */ } }
                this.dialogRef.close({ refreshActivos: true });
            },
            error: (err) => { try { pdfWin?.close(); } catch { /* noop */ } this._showMsg('Error al registrar envío: ' + (err?.message || ''), 'error'); }
        });
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

    imprimirCoMat(): void {
        const form = this.envioForm.value;
        if (this.itemsEnvio.length === 0) { this._showMsg('Agregue al menos una herramienta', 'warning'); return; }
        this._pdfCoMat(this.envCorrelativoPreview || 'ENV-?/?', this.itemsEnvio, form);
    }

    cerrarFormEnvio(): void {
        if (this.itemsEnvio.length > 0 &&
            !confirm(`¿Cancelar el envío? Se perderán las ${this.itemsEnvio.length} herramienta(s) agregada(s).`)) return;
        this.dialogRef.close();
    }

    // ── PDF ────────────────────────────────────────────────────────────────────

    /**
     * "Solicitud de Envío — CO-MAT" (hoja CO-MAT del Excel de formularios). Sin código de documento
     * (solo texto); el correlativo ENV-N/YYYY va en la celda "SERIAL NUMBER:". Sin columna "Código BOA".
     */
    private async _pdfCoMat(nro: string, items: ToolEnvioItem[], form: any): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();
        const now   = new Date();
        const fecha = now.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora  = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
        const origen  = form.baseOrigen?.nombre || '---';
        const destino = form.baseDestino?.nombre || '---';
        const responsable = form.responsableEnvia || '---';
        const recibe      = form.recibeEnDestino  || '---';
        const tipoEnvio   = form.tipoEnvio || 'EVENTUAL';
        const vueloAeronave = (form.nroVuelo || form.aeronave)
            ? `${form.nroVuelo || '---'} / ${form.aeronave || '---'}` : '---';

        const filas = items.map((it, i) => `
            <tr>
                <td class="tc">${i + 1}</td>
                <td class="tc">${it.cantidad}</td>
                <td>${it.nombre || '---'}</td>
                <td class="mono">${it.pn || '---'}</td>
                <td class="mono">${it.sn || '---'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>CO-MAT ${nro}</title>
<style>
  @page { size: A4; margin: 8mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }

  table.head-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 6px; }
  table.head-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: middle; }
  .logo-cell { width: 22%; text-align: center; }
  .logo-cell img { max-width: 100%; max-height: 34px; }
  .title-cell { width: 78%; text-align: center; }
  .title-cell div { font-size: 10px; font-weight: 900; text-transform: uppercase; }
  .title-cell .comat { font-size: 15px; margin-top: 3px; }

  table.meta-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.meta-table td { border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; height: 20px; }
  table.meta-table td b { font-weight: 900; }

  .detalle-bar { background: #fff; border: 2px solid #000; border-top: none; text-align: center; font-weight: 900; font-size: 11px; text-transform: uppercase; padding: 3px; }

  table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.items th { border: 1px solid #000; background: #e5e7eb; font-size: 7.7px; font-weight: 900; text-transform: uppercase; padding: 4px 2px; }
  table.items td { border: 1px solid #000; padding: 4px 3px; font-size: 8.7px; }
  table.items tbody tr { height: 20px; }
  .tc { text-align: center; }
  .mono { font-family: monospace; }

  table.foot-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; }
  table.foot-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 9.5px; width: 50%; }
  .firma-lbl { font-weight: 900; }
  .firma-line { border-bottom: 1px solid #000; height: 26px; margin-top: 14px; }
  .firma-sub { font-size: 8.5px; margin-top: 2px; }
  .firma-fecha { margin-top: 8px; font-size: 8.5px; }

  @media print { body { padding: 0; } }
</style>
<script>window.onload = () => window.print();</script>
</head><body>

<table class="head-table">
  <tr>
    <td class="logo-cell">
      ${logoUri ? `<img src="${logoUri}" alt="BoA">` : '<div style="font-weight:900;font-size:16px">BoA</div>'}
    </td>
    <td class="title-cell">
      <div>Departamento de Mantenimiento</div>
      <div>Unidad de Almacén de Herramientas</div>
      <div>Solicitud de Envío</div>
      <div class="comat">CO-MAT</div>
    </td>
  </tr>
</table>

<table class="meta-table">
  <tr>
    <td style="width:16%"><b>ORIGEN:</b></td><td style="width:34%">${origen}</td>
    <td style="width:20%"><b>SERIAL NUMBER:</b></td><td style="width:30%">${nro}</td>
  </tr>
  <tr>
    <td><b>Nº DE BULTOS:</b></td><td>${items.length}</td>
    <td><b>PESO:</b></td><td>&nbsp;</td>
  </tr>
  <tr>
    <td><b>DESTINO:</b></td><td>${destino}</td>
    <td><b>RESPONSABLE / ENVÍA:</b></td><td>${responsable}</td>
  </tr>
  <tr>
    <td><b>RECIBE EN DESTINO:</b></td><td>${recibe}</td>
    <td><b>FECHA Y HORA:</b></td><td>${fecha} ${hora}</td>
  </tr>
  <tr>
    <td><b>TIPO ENVÍO:</b></td><td>${tipoEnvio}</td>
    <td><b>N° VUELO / AERONAVE:</b></td><td>${vueloAeronave}</td>
  </tr>
</table>

<div class="detalle-bar">DETALLE</div>
<table class="items">
  <thead><tr>
    <th style="width:8%">ITEM</th><th style="width:10%">CANT.</th><th style="width:44%">DESCRIPCIÓN</th>
    <th style="width:19%">PART NUMBER</th><th style="width:19%">SERIAL NUMBER</th>
  </tr></thead>
  <tbody>${filas || '<tr><td colspan="5" class="tc">Sin ítems</td></tr>'}</tbody>
</table>

<table class="foot-table">
  <tr>
    <td>
      <div class="firma-lbl">ENTREGUE CONFORME / MM-CBB</div>
      <div class="firma-line"></div>
      <div class="firma-sub">Firma — ${responsable}</div>
      <div class="firma-fecha">FECHA Y HORA: _____________</div>
    </td>
    <td>
      <div class="firma-lbl">RECIBÍ CONFORME / CARGA-VOA</div>
      <div class="firma-line"></div>
      <div class="firma-sub">Firma — ${recibe}</div>
      <div class="firma-fecha">FECHA Y HORA: _____________</div>
    </td>
  </tr>
</table>

</body></html>`;
        abrirBlob(html);
    }

    private _showMsg(msg: string, type: string): void {
        this.snackBar.open(msg, 'OK', {
            duration: 3500, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
