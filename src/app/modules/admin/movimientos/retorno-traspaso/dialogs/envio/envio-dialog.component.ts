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
    private _unsub$   = new Subject<void>();
    private _srchEnvio$ = new Subject<string>();

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
                this._pdfEnvio(nro, this.itemsEnvio, form, 'ENVÍO A BASE');
                this.dialogRef.close({ refreshActivos: true });
            },
            error: (err) => this._showMsg('Error al registrar envío: ' + (err?.message || ''), 'error')
        });
    }

    imprimirCoMat(): void {
        const form = this.envioForm.value;
        if (this.itemsEnvio.length === 0) { this._showMsg('Agregue al menos una herramienta', 'warning'); return; }
        this._pdfCoMat(this.envCorrelativoPreview || 'ENV-?/?', this.itemsEnvio, form);
    }

    cerrarFormEnvio(): void { this.dialogRef.close(); }

    // ── PDF ────────────────────────────────────────────────────────────────────

    private _pdfEnvio(nro: string, items: ToolEnvioItem[], form: any, tipo: string): void {
        const fecha       = new Date(form.fechaEnvio || new Date()).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const destino     = form.baseDestino?.nombre || form.areaDepartamento || '---';
        const responsable = form.responsableEnvia || '---';
        const recibe      = form.recibeEnDestino  || null;
        const condLabel: Record<string, string> = { excellent: 'Excelente', good: 'Bueno', fair: 'Regular', damaged: 'Dañado' };
        const filas = items.map((it, i) => `
            <tr><td style="text-align:center">${i + 1}</td><td>${it.codigo}</td>
            <td>${it.nombre}</td><td>${it.pn || '---'}</td><td>${it.sn || '---'}</td>
            <td style="text-align:center">${it.cantidad}</td>
            <td style="text-align:center">${condLabel[it.condicion] || it.condicion}</td>
            <td>${it.notas || '---'}</td></tr>`).join('');
        const campos: [string, string][] = [
            ['Fecha', fecha], ['Destino / Área', destino], ['Responsable', responsable],
            ['Nro. Documento', form.nroDocumento || '---'],
            ['Fecha Esp. Retorno', form.fechaEsperadaRetorno || 'N/A'],
            ['Nro. Vuelo', form.nroVuelo || '---'], ['Aeronave', form.aeronave || '---'],
            ['Tipo Envío', form.tipoEnvio || 'EVENTUAL'], ['Notas', form.notas || '---']
        ];
        const columnas: [string, string][] = [
            ['#','3%'],['Código BOA','8%'],['Descripción','24%'],['P/N','13%'],['S/N','11%'],
            ['Cant.','7%'],['Condición','12%'],['Observación','22%']
        ];
        const firmas: [string, string] = [responsable, destino];
        this._abrirPdf(nro, tipo, filas, campos, columnas, firmas);
    }

    private _pdfCoMat(nro: string, items: ToolEnvioItem[], form: any): void {
        const now  = new Date();
        const fecha = now.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora  = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
        const origen  = form.baseOrigen?.nombre || 'ALMACÉN CBB';
        const destino = form.baseDestino?.nombre || '---';
        const responsable = form.responsableEnvia || '---';
        const recibe      = form.recibeEnDestino  || '';
        const nVuelo      = form.nroVuelo  || '---';
        const aeronave    = form.aeronave  || '---';
        const tipoEnvio   = form.tipoEnvio || 'EVENTUAL';
        const rows = items.map((it, i) => `
            <tr><td class="tc">${i + 1}</td><td class="tc"><strong>${it.cantidad}</strong></td>
            <td>${it.nombre || '-'}</td><td class="mono">${it.pn || '---'}</td>
            <td class="mono">${it.sn || '---'}</td><td class="mono">${it.codigo || '-'}</td></tr>`).join('');
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>CO-MAT ${nro}</title>
<style>
  @page{size:A4;margin:10mm 12mm}*{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:10px;color:#000}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}
  .top-center{text-align:center;flex:1}.top-center h1{font-size:14px;font-weight:900;text-transform:uppercase}
  .top-right{text-align:right}.nro-box{border:2.5px solid #000;padding:5px 14px;font-size:16px;font-weight:900;display:inline-block}
  .tipo-badge{display:inline-block;background:${tipoEnvio==='PERMANENTE'?'#fbbf24':'#dcfce7'};border:1.5px solid #000;font-weight:900;font-size:9px;padding:2px 7px;border-radius:3px;margin-top:3px}
  .meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px 14px;margin-bottom:8px;border:1.5px solid #ddd;padding:7px 10px}
  .field label{display:block;font-size:7.5px;font-weight:900;text-transform:uppercase;color:#666;margin-bottom:1px}
  .field span{display:block;font-weight:700;font-size:10px;border-bottom:1px solid #ccc;padding-bottom:1px;min-height:13px}
  .sec-title{background:#0f172a;color:#fff;font-size:9px;font-weight:900;text-transform:uppercase;padding:4px 8px}
  table{width:100%;border-collapse:collapse;margin-bottom:10px}
  th{background:#334155;color:#fff;padding:4px 5px;font-size:8.5px;font-weight:900;text-align:left;border:1px solid #000}
  td{padding:3.5px 5px;border:1px solid #ddd;font-size:9px}tr:nth-child(even)td{background:#f8f9fc}
  .tc{text-align:center}.mono{font-family:monospace;font-size:9px}
  .firmas{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:14px}
  .firma{border:1.5px solid #000;padding:6px 8px}
  .firma-title{font-size:8px;font-weight:900;text-transform:uppercase;background:#0f172a;color:#fff;padding:3px 6px;margin:-6px -8px 8px}
  .firma-sign{height:34px;border-bottom:1px solid #000;margin-top:4px}
  .footer{text-align:center;font-size:7.5px;color:#888;margin-top:10px;border-top:1px dotted #ccc;padding-top:4px}
</style><script>window.onload=()=>window.print();</script></head><body>
<div class="top">
  <div style="font-size:8.5px;color:#555;line-height:1.6"><div><strong>BoAMM</strong> OAM145# N-014</div><div>BOLIVIANA DE AVIACIÓN</div><div>Almacén de Herramientas</div></div>
  <div class="top-center"><h1>Solicitud de Envío</h1><div style="font-size:9px;color:#555">CO-MAT — Comprobante de Movimiento de Material</div><div class="tipo-badge">${tipoEnvio}</div></div>
  <div class="top-right"><div class="nro-box">${nro}</div><div style="font-size:8px;color:#555;margin-top:4px">Fecha: ${fecha} ${hora}</div></div>
</div>
<div class="meta">
  <div class="field"><label>Origen / Almacén</label><span>${origen}</span></div>
  <div class="field"><label>Base Destino</label><span>${destino}</span></div>
  <div class="field"><label>Fecha Retorno Esperada</label><span>${tipoEnvio==='PERMANENTE'?(form.fechaEsperadaRetorno||'---'):'No aplica (Eventual)'}</span></div>
  <div class="field"><label>Responsable / Envía</label><span>${responsable}</span></div>
  <div class="field"><label>Recibe en Destino</label><span>${recibe||'---'}</span></div>
  <div class="field"><label>Nro. Vuelo / Aeronave</label><span>${nVuelo!=='---'||aeronave!=='---'?nVuelo+' / '+aeronave:'---'}</span></div>
</div>
<div class="sec-title">Detalle de Herramientas / Equipos</div>
<table><thead><tr>
  <th style="width:4%">ITEM</th><th style="width:6%">CANT.</th><th style="width:35%">DESCRIPCIÓN</th>
  <th style="width:18%">MODELO / P/N</th><th style="width:15%">SERIAL NUMBER</th><th style="width:12%">CÓDIGO BOA</th>
</tr></thead><tbody>${rows}</tbody></table>
<div class="firmas">
  <div class="firma"><div class="firma-title">ENTREGUE CONFORME / MM-CBB</div>
    <div style="font-size:8px;font-weight:700">Nombre: ${responsable}</div><div class="firma-sign"></div></div>
  <div class="firma"><div class="firma-title">RECIBI CONFORME / CARGA-VOA</div>
    <div style="font-size:8px;font-weight:700">Nombre: ${recibe||'&nbsp;'}</div><div class="firma-sign"></div></div>
</div>
<div class="footer">BOLIVIANA DE AVIACIÓN — Almacén de Herramientas · CO-MAT | Generado: ${now.toLocaleString('es-BO')} | Nro: ${nro}</div>
</body></html>`;
        abrirBlob(html);
    }

    private _abrirPdf(nro: string, tipo: string, filas: string, campos: [string,string][], columnas: [string,string][], firmas: [string,string]): void {
        const camposHtml = campos.map(([l,v]) => `<div class="field"><label>${l}</label><span>${v}</span></div>`).join('');
        const thHtml     = columnas.map(([l,w]) => `<th style="width:${w}">${l}</th>`).join('');
        const [f0,f1]    = firmas;
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${nro}</title>
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
td{padding:4px;border-bottom:1px solid #ddd}tr:nth-child(even)td{background:#f8f9fc}
.firmas{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px}
.firma{border-top:2px solid #000;padding-top:6px;text-align:center;font-size:10px;font-weight:700}
@media print{body{padding:10px}}
</style></head><body>
<div class="header">
  <div><div class="badge">${tipo}</div><h1>Acta de ${tipo}</h1>
  <div style="font-size:10px;color:#555">BOLIVIANA DE AVIACIÓN — Almacén de Herramientas</div></div>
  <div class="nro">${nro}</div>
</div>
<div class="grid">${camposHtml}</div>
<table><thead><tr>${thHtml}</tr></thead><tbody>${filas}</tbody></table>
<div class="firmas">
  <div class="firma"><div style="height:36px"></div>ENTREGA CONFORME<br>${f0}</div>
  <div class="firma"><div style="height:36px"></div>RECIBE CONFORME<br>${f1}</div>
</div>
<script>window.onload=()=>window.print();</script>
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
