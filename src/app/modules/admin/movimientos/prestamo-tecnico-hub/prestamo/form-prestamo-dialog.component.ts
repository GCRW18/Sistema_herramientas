import { Component, OnInit, OnDestroy, signal, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, switchMap, map, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service';
import { FleetService } from '../../../../../core/services/fleet.service';
import { KitsService } from '../../../../../core/services/kits.service';
import { ModalHerramientaInternoComponent } from './modal-herramienta-interno/modal-herramienta-interno.component';

interface InternalLoanItem {
    toolId: number; id: number; codigo: string; pn: string; descripcion: string; sn: string;
    marca: string; fechaCalibracion: string; listaContenido: string; cantidad: number; unidad: string;
    estado: string; contenido: string; selected?: boolean;
}

@Component({
    selector: 'app-form-prestamo-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatCheckboxModule, MatDialogModule,
        MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule
    ],
    templateUrl: './form-prestamo-dialog.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class FormPrestamoDialogComponent implements OnInit, OnDestroy {

    @ViewChild('confirmInternoModal') confirmInternoModal!: TemplateRef<any>;

    dialogRef        = inject(MatDialogRef<FormPrestamoDialogComponent>);
    private _confirmDialogRef: any = null;

    private dialog      = inject(MatDialog);
    private fb          = inject(FormBuilder);
    private snackBar    = inject(MatSnackBar);
    private movementSvc = inject(MovementService);
    private fleetSvc    = inject(FleetService);
    private kitsService = inject(KitsService);
    private destroy$    = new Subject<void>();

    isSaving    = false;

    internalForm!: FormGroup;
    internalDataSource = signal<InternalLoanItem[]>([]);
    nroNotaInterno     = '';

    private _tecnicoSearch$ = new Subject<string>();
    tecnicosFiltrados:  any[] = [];
    tecnicoLoading      = false;
    showTecnicoDropdown = false;

    aeronaves: { matricula: string; tipo: string }[] = [];
    destinos:        string[] = [];
    loadingDestinos          = false;

    ptCorrelativoPreview  = '';
    loadingPtCorrelativo  = false;

    toolSearchPt          = '';
    toolSuggestionsPt:    any[] = [];
    showToolDropPt        = false;
    toolSearchLoadingPt   = false;
    private _toolSearchPt$ = new Subject<string>();
    private todasLasHerramientas: any[] = [];
    private _toolIdsEnPrestamo: Set<number> = new Set();

    kits:              any[] = [];
    loadingKits              = false;
    kitSeleccionado          = '';
    loadingKitComponents     = false;

    private readonly conditionMap: Record<string, string> = {
        'SERVICEABLE': 'good', 'NUEVO': 'new', 'NEW': 'new', 'EN_CALIBRACION': 'fair',
        'UNSERVICEABLE': 'damaged', 'EN_REPARACION': 'poor', 'BUENO': 'good', 'REGULAR': 'fair', 'MALO': 'poor'
    };

    ngOnInit(): void {
        this.initInternalForm();
        this._setupTecnicoSearch();
        this._setupToolSearchPt();
        this.cargarAeronaves();
        this.cargarDestinos();
        this._cargarHerramientas();
        this._fetchPtCorrelativoPreview();
        this.loadKits();
    }

    ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

    _localDateStr(d = new Date()): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    get hoy(): string { return this._localDateStr(); }

    private initInternalForm(): void {
        const today = this._localDateStr();
        const now   = new Date();
        this.internalForm = this.fb.group({
            buscarTecnico:     [''],
            nombreCompleto:    ['', Validators.required],
            nroLicencia:       ['', Validators.required],
            cargo:             [''],
            fecha:             [today, Validators.required],
            hora:              [`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`, Validators.required],
            matriculaAeronave: ['N/A'],
            ordenTrabajo:      [''],
            destino:           [''],
            trabajoEspecial:   [false],
            observaciones:     ['']
        });
    }

    private _setupTecnicoSearch(): void {
        this._tecnicoSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showTecnicoDropdown = false; return of([]); }
                this.tecnicoLoading = true;
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map(lista => (lista as any[])
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno, f.licencia, f.nro_licencia]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({ id: f.id_employee || f.id, nombre: f.nombreCompleto || f.nombre, cargo: f.cargo || '', licencia: f.licencia ?? f.nro_licencia ?? '' }))
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

    private cargarDestinos(): void {
        this.loadingDestinos = true;
        this.movementSvc.getParametrosPorCategoria('AREA_DESTINO')
            .pipe(takeUntil(this.destroy$), finalize(() => this.loadingDestinos = false))
            .subscribe({
                next: (vals) => { this.destinos = vals.length ? vals : ['Servicios', 'Línea', 'Taller', 'Hangar', 'Rampa']; },
                error: () => { this.destinos = ['Servicios', 'Línea', 'Taller', 'Hangar', 'Rampa']; }
            });
    }

    private cargarAeronaves(): void {
        this.fleetSvc.getAircraft({ limit: 100 } as any).pipe(takeUntil(this.destroy$)).subscribe({
            next: (data: any[]) => {
                this.aeronaves = [
                    ...data.map((a: any) => ({ matricula: a.registration || a.matricula || '', tipo: a.manufacturer || '' })),
                    { matricula: 'N/A', tipo: 'No Aplica' }
                ];
            }
        });
    }

    private readonly _statusBloqueado = new Set(['decommissioned', 'in_calibration', 'quarantine', 'in_maintenance']);

    private _toolDisponible(t: any): boolean {
        const status  = (t.status ?? t.tool_status ?? '').toLowerCase();
        const stock   = Number(t.quantity_in_stock ?? t.stock ?? t.existencia ?? 0);
        const expiry  = t.next_calibration_date ?? t.calibration_due_date ?? null;
        const vencida = expiry ? expiry < this._localDateStr() : false;
        return !this._statusBloqueado.has(status) && stock > 0 && !vencida;
    }

    private _motivoNoDisponible(t: any): string {
        const status = (t.status ?? t.tool_status ?? '').toLowerCase();
        const stock  = Number(t.quantity_in_stock ?? t.stock ?? t.existencia ?? 0);
        const expiry = t.next_calibration_date ?? t.calibration_due_date ?? null;
        if (status === 'decommissioned') return 'Herramienta dada de baja';
        if (status === 'in_calibration') return 'En proceso de calibración';
        if (status === 'quarantine')     return 'En cuarentena / no serviciable';
        if (status === 'in_maintenance') return 'En mantenimiento';
        if (stock <= 0)                  return 'Sin stock disponible';
        if (expiry && expiry < this._localDateStr()) return `Calibración vencida (${expiry})`;
        return 'No disponible';
    }

    private _cargarHerramientas(): void {
        forkJoin({
            tools:     this.movementSvc.getHerramientasDisponibles({}).pipe(catchError(() => of([]))),
            loanItems: this.movementSvc.getActiveLoanItems({ filtro_adicional: 'returned = false' }).pipe(catchError(() => of([])))
        }).pipe(takeUntil(this.destroy$)).subscribe(({ tools, loanItems }: any) => {
            this._toolIdsEnPrestamo = new Set((loanItems || []).map((i: any) => Number(i.tool_id)));
            this.todasLasHerramientas = (tools || [])
                .filter(t => this._toolDisponible(t))
                .map((t: any) => ({
                    id: t.id_tool ?? t.id, codigo: t.code ?? t.codigo ?? '',
                    nombre: t.name ?? t.nombre ?? '', pn: t.part_number ?? t.pn ?? '',
                    sn: t.serial_number ?? t.sn ?? '', marca: t.brand ?? t.marca ?? '',
                    existencia: Number(t.quantity_in_stock ?? t.stock ?? t.existencia ?? 0),
                    status: (t.status ?? 'available').toLowerCase(),
                    enPrestamo: this._toolIdsEnPrestamo.has(Number(t.id_tool ?? t.id)),
                    fechaCalibracion: t.next_calibration_date ?? t.calibration_due_date ?? '',
                    listaContenido:   t.content_list ?? '',
                    unidad:           t.unit_of_measure ?? t.unidad ?? 'PZA'
                }));
        });
    }

    private _setupToolSearchPt(): void {
        this._toolSearchPt$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                if (term.length < 2) { this.showToolDropPt = false; return of([]); }
                this.toolSearchLoadingPt = true;
                const q = term.toLowerCase();
                const results = this.todasLasHerramientas
                    .filter(h => h.codigo.toLowerCase().includes(q) || h.nombre.toLowerCase().includes(q) || (h.pn || '').toLowerCase().includes(q))
                    .slice(0, 12);
                this.toolSearchLoadingPt = false;
                return of(results);
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { this.toolSuggestionsPt = res; this.showToolDropPt = res.length > 0; });
    }

    onToolInputPt(value: string): void { this.toolSearchPt = value; this._toolSearchPt$.next(value.trim()); }
    hideToolDropPt(): void { setTimeout(() => this.showToolDropPt = false, 150); }
    selectToolSuggestionPt(tool: any): void { this.toolSearchPt = tool.codigo; this.showToolDropPt = false; this._agregarToolPt(tool); }

    addToolPtFromInput(): void {
        const code = this.toolSearchPt.trim();
        if (!code) return;
        const tool = this.todasLasHerramientas.find(h => h.codigo.toLowerCase() === code.toLowerCase());
        if (!tool) { this.showMsg('warning', `Herramienta "${code}" no encontrada`); return; }
        this._agregarToolPt(tool);
    }

    private _agregarToolPt(tool: any): void {
        if (this.internalDataSource().some(i => i.codigo === tool.codigo)) { this.showMsg('info', `"${tool.nombre}" ya está en la lista`); return; }
        if (this._toolIdsEnPrestamo.has(Number(tool.id))) { this.showMsg('warning', `"${tool.nombre}" ya tiene un préstamo activo y no está disponible`); return; }
        const item: InternalLoanItem = {
            toolId: tool.id ?? 0, id: Date.now(), codigo: tool.codigo,
            pn: tool.pn || '', descripcion: tool.nombre || '', sn: tool.sn || '',
            marca: tool.marca || '',
            fechaCalibracion: tool.fechaCalibracion || '',
            listaContenido:   tool.listaContenido   || '',
            cantidad: 1,
            unidad: tool.unidad || 'PZA', estado: 'SERVICEABLE', contenido: '', selected: false
        };
        this.internalDataSource.update(list => [...list, item]);
        this.showMsg('success', `"${item.descripcion}" agregada`);
        this.toolSearchPt = '';
        this.toolSuggestionsPt = [];
    }

    private _fetchPtCorrelativoPreview(): void {
        this.loadingPtCorrelativo = true;
        this.movementSvc.getSiguienteCorrelativoPreview('PT')
            .pipe(takeUntil(this.destroy$), finalize(() => this.loadingPtCorrelativo = false))
            .subscribe({ next: (nro) => this.ptCorrelativoPreview = nro });
    }

    loadKits(): void {
        this.loadingKits = true;
        forkJoin({ categorias: this.kitsService.getKitCategories(), kits: this.kitsService.getKits({ limit: 200 }) })
            .pipe(takeUntil(this.destroy$), finalize(() => this.loadingKits = false))
            .subscribe({
                next: ({ categorias, kits }) => {
                    const nombresValidos = new Set(
                        (categorias || []).filter(c => c.active !== false).map(c => (c.name ?? '').trim().toUpperCase())
                    );
                    this.kits = (kits || []).filter(k => {
                        const cat    = (k.category ?? '').trim().toUpperCase();
                        const status = (k.status ?? '').toLowerCase();
                        return k.active !== false && nombresValidos.has(cat) && !['in_use', 'decommissioned', 'in_calibration'].includes(status);
                    });
                },
                error: () => { this.kits = []; }
            });
    }

    agregarKit(): void {
        const kitId = Number(this.kitSeleccionado);
        if (!kitId) { this.showMsg('warning', 'Seleccione un kit'); return; }
        const kit = this.kits.find(k => (k.id_kit ?? k.id) === kitId);
        this.loadingKitComponents = true;
        this.kitsService.getKitComponents(kitId)
            .pipe(takeUntil(this.destroy$), finalize(() => this.loadingKitComponents = false))
            .subscribe({
                next: (comps: any[]) => {
                    let added = 0; const bloqueadas: string[] = [];
                    comps.forEach(c => {
                        const codigo = c.tool_code ?? c.code ?? c.codigo ?? '';
                        if (!codigo) return;
                        if (this.internalDataSource().some(i => i.codigo === codigo)) return;
                        if (!this._toolDisponible(c)) { bloqueadas.push(`${codigo}: ${this._motivoNoDisponible(c)}`); return; }
                        if (this._toolIdsEnPrestamo.has(Number(c.tool_id ?? c.id_tool ?? 0))) { bloqueadas.push(`${codigo}: ya tiene un préstamo activo`); return; }
                        const item: InternalLoanItem = {
                            toolId: c.tool_id ?? c.id_tool ?? 0, id: Date.now() + Math.random(), codigo,
                            pn: c.part_number ?? c.pn ?? '',
                            descripcion: c.tool_name ?? c.name ?? c.nombre ?? c.description ?? '',
                            sn: c.serial_number ?? c.sn ?? '', marca: c.brand ?? c.marca ?? '',
                            fechaCalibracion: c.next_calibration_date ?? c.calibration_due_date ?? '',
                            listaContenido:   c.content_list ?? '',
                            cantidad: c.quantity ?? c.cantidad ?? 1,
                            unidad: c.unit_of_measure ?? c.unidad ?? 'PZA',
                            estado: 'SERVICEABLE', contenido: '', selected: false
                        };
                        this.internalDataSource.update(list => [...list, item]);
                        added++;
                    });
                    const kitNombre = kit?.nombre ?? kit?.name ?? `Kit #${kitId}`;
                    if (added > 0) this.showMsg('success', `Kit "${kitNombre}": ${added} herramienta(s) agregadas`);
                    bloqueadas.forEach(msg => this.showMsg('warning', msg));
                    if (added === 0 && bloqueadas.length === 0) this.showMsg('info', 'Todas las herramientas ya están en la lista');
                    this.kitSeleccionado = '';
                },
                error: () => this.showMsg('error', 'Error al cargar componentes del kit')
            });
    }

    openHerramientasAPrestar(): void {
        const ref = this.dialog.open(ModalHerramientaInternoComponent, { width: 'min(1000px, 98vw)', maxWidth: '98vw', panelClass: 'no-padding-dialog', disableClose: true });
        ref.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                const d = result.data;
                if (this.internalDataSource().some(i => i.codigo === d.codigo)) { this.showMsg('info', `"${d.nombre}" ya está en la lista`); return; }
                if (this._toolIdsEnPrestamo.has(Number(d.id_tool ?? 0))) { this.showMsg('warning', `"${d.nombre}" ya tiene un préstamo activo y no está disponible`); return; }
                const item: InternalLoanItem = {
                    toolId: d.id_tool ?? 0, id: Date.now(), codigo: d.codigo || '', pn: d.pn || '',
                    descripcion: d.nombre || '', sn: d.sn || '', marca: d.marca || '',
                    fechaCalibracion: d.fechaVencimiento || '',
                    listaContenido:   d.content_list ?? d.listaContenido ?? '',
                    cantidad: d.cantidad || 1,
                    unidad: d.unidad || 'PZA', estado: d.estado || 'SERVICEABLE', contenido: d.observacion || '', selected: false
                };
                this.internalDataSource.update(list => [...list, item]);
                this.showMsg('success', `"${item.descripcion}" agregada`);
            }
        });
    }

    limpiarPrestamo(): void { this.internalDataSource.set([]); this.initInternalForm(); }

    hasErrorInternal(field: string, error: string): boolean {
        const c = this.internalForm.get(field);
        return c ? c.hasError(error) && c.touched : false;
    }

    eliminarItemInterno(idx: number): void {
        const item = this.internalDataSource()[idx];
        this.internalDataSource.update(list => list.filter((_, i) => i !== idx));
        this.showMsg('info', `"${item.descripcion}" eliminada`);
    }

    procesar(): void {
        this.internalForm.markAllAsTouched();
        if (this.internalForm.invalid) { this.showMsg('error', 'Complete los datos del técnico'); return; }
        if (this.internalDataSource().length === 0) { this.showMsg('warning', 'Agregue al menos una herramienta'); return; }
        this._confirmDialogRef = this.dialog.open(this.confirmInternoModal, {
            width: '600px', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true
        });
    }
    cerrarModalConfirmInterno(): void { this._confirmDialogRef?.close(); }

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
                this.nroNotaInterno = nro;
                this._imprimirPrestamoInterno(nro, fv, items);
                this.showMsg('success', `Préstamo registrado: ${nro}`);
                this.internalDataSource.set([]);
                this.initInternalForm();
                this.dialogRef.close({ success: true, movement_number: nro });
            },
            error: (err: any) => this.showMsg('error', err?.message || 'Error al registrar')
        });
    }

    cerrar(): void { this.dialogRef.close(); }

    private _imprimirPrestamoInterno(nro: string, fv: any, items: InternalLoanItem[]): void {
        const w = window.open('', '_blank');
        if (!w) return;
        const now  = new Date().toLocaleString('es-BO');
        const rows = items.map(i => `<tr><td>${i.codigo||'-'}</td><td>${i.pn||'-'}</td><td>${i.sn||'-'}</td><td style="text-align:center;font-weight:700">${i.cantidad}</td><td>${i.unidad||'PZA'}</td><td>${i.descripcion||'-'}</td><td>${i.listaContenido||'-'}</td><td>${i.fechaCalibracion||'-'}</td><td>${i.estado||'SERVICEABLE'}</td><td>${i.contenido||'&nbsp;'}</td></tr>`).join('');
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
<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
</body></html>`);
        w.document.close();
    }

    private showMsg(type: 'success' | 'error' | 'info' | 'warning', text: string): void {
        this.snackBar.open(text, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
