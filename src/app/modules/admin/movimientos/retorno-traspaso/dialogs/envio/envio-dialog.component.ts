import {
    Component, OnInit, OnDestroy, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap, of, map } from 'rxjs';

import { MovementService } from '../../../../../../core/services/movement.service';
import { ToolService } from '../../../../../../core/services/tool.service';
import {
    Ubicacion, ToolEnvioItem, Funcionario,
    CONDICIONES_ENVIO, abrirBlob
} from '../../retorno-traspaso.types';
import { EnvioBasePdfService, EnvioBasePdfData } from '../../envio-base-pdf.service';

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

    private dialogRef = inject(MatDialogRef<EnvioDialogComponent>);
    data              = inject<EnvioDialogData>(MAT_DIALOG_DATA);
    private fb        = inject(FormBuilder);
    private snackBar  = inject(MatSnackBar);
    private movSvc    = inject(MovementService);
    private toolSvc   = inject(ToolService);
    private pdfSvc    = inject(EnvioBasePdfService);
    private _unsub$   = new Subject<void>();
    private _srchEnvio$ = new Subject<string>();
    private _logoBoaDataUri: Promise<string> | null = null;

    envioForm!: FormGroup;
    itemsEnvio: ToolEnvioItem[] = [];
    activeEnvioChip: number | null = null;

    // Tool search
    toolSearchEnvio     = '';
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

    // Dept autocomplete
    deptUbicacionesEnvio: Ubicacion[] = [];
    showDeptDropEnvio                  = false;

    readonly condicionesEnvio = CONDICIONES_ENVIO;

    get almacenes(): Ubicacion[] { return this.data.almacenes; }
    get bases(): Ubicacion[]    { return this.data.bases; }

    ngOnInit(): void {
        this._initForm();
        this._setupToolSearch();
        this._setupFuncSearch();
        this._setDefaultAlmacen();
        this._fetchCorrelativoPreview();
    }

    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    getAllUbicaciones(): Ubicacion[] { return [...this.bases, ...this.almacenes]; }

    private _initForm(): void {
        const today = new Date().toISOString().split('T')[0];
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

    // ── Tool search ────────────────────────────────────────────────────────────

    onToolSearchEnvio(term: string): void { this.toolSearchEnvio = term; this._srchEnvio$.next(term); }
    hideToolDropEnvio(): void { setTimeout(() => this.showToolDropEnvio = false, 150); }

    addToolEnvio(tool: any): void {
        const id = tool.id_tool ?? tool.id;
        if (this.itemsEnvio.some(i => i.toolId === id)) { this._showMsg('Herramienta ya en la lista', 'warning'); return; }
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

    // ── Dept autocomplete ──────────────────────────────────────────────────────

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
                this._pdfEnvioOficial(nro, this.itemsEnvio, form);
                this.dialogRef.close({ refreshActivos: true });
            },
            error: (err) => this._showMsg('Error al registrar envío: ' + (err?.message || ''), 'error')
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

    cerrarFormEnvio(): void { this.dialogRef.close(); }

    // ── PDF ────────────────────────────────────────────────────────────────────

    /** Nota de "Registro de Herramientas en Otras Bases" (formato oficial calcado del Excel). */
    private _pdfEnvioOficial(nro: string, items: ToolEnvioItem[], form: any): void {
        const data: EnvioBasePdfData = {
            nroNota: nro,
            origen: form.baseOrigen?.nombre || '---',
            destino: form.baseDestino?.nombre || '---',
            fechaEnvio: new Date(form.fechaEnvio || new Date()).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            responsable: form.responsableEnvia || '',
            recibe: form.recibeEnDestino || '',
            tipoEnvio: form.tipoEnvio || 'EVENTUAL',
            fechaEsperadaRetorno: form.fechaEsperadaRetorno || '',
            nroDocumento: form.nroDocumento || '',
            nroVuelo: form.nroVuelo || '',
            aeronave: form.aeronave || '',
            observaciones: form.notas || '',
            items: items.map(it => ({ descripcion: it.nombre, pn: it.pn, sn: it.sn })),
        };
        this.pdfSvc.generarPdf(data);
    }

    /**
     * "Solicitud de Envío — CO-MAT", calcado de "Sistema Herramientas con Macros/Formularios.xlsx",
     * hoja "CO-MAT". A diferencia de los demás formularios calcados, esta hoja no tiene logo con
     * código de documento (ni MGH-xxx ni MOM-) — es solo texto: "DEPARTAMENTO DE MANTENIMIENTO" /
     * "UNIDAD DE ALMACÉN DE HERRAMIENTAS" / "SOLICITUD DE ENVÍO" / "CO-MAT". La implementación
     * previa mostraba "OAM145# N-014" en el header, pero ese código pertenece a la hoja "SALIDA
     * CONSUMIBLES" del mismo Excel, no a CO-MAT — se retiró por infidelidad a la fuente. El número
     * de documento interno (correlativo ENV-N/YYYY) se imprime en la celda "SERIAL NUMBER:" que la
     * hoja sí reserva junto a ORIGEN, en vez de inventar una caja de código aparte. La tabla también
     * pierde la columna "Código BOA" (no existe en el Excel, solo ITEM/CANT./DESCRIPCIÓN/PART
     * NUMBER/SERIAL NUMBER).
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
