import { Component, OnInit, OnDestroy, signal, inject, ViewChild, TemplateRef, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, switchMap, map, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service';
import { FleetService } from '../../../../../core/services/fleet.service';
import { KitsService } from '../../../../../core/services/kits.service';
import { ToolService } from '../../../../../core/services/tool.service';
import { QrScanService } from '../../../../../core/services/qr-scan.service';
import { motivoBloqueoSalida } from '../../retorno-traspaso/retorno-traspaso.types';

interface InternalLoanItem {
    toolId: number; id: number; codigo: string; pn: string; descripcion: string; sn: string;
    marca: string; fechaCalibracion: string; listaContenido: string; cantidad: number; unidad: string;
    estado: string; contenido: string; selected?: boolean;
    // Datos reales de la herramienta (catálogo), para el detalle de solo-lectura — no
    // confundir con "contenido" (siempre vacío, nunca lo llena esta pantalla).
    imagen?: string | null;
    notesTool?: string;
    warehouseId?: number | null;
    rackId?: number | null;
    levelId?: number | null;
}

@Component({
    selector: 'app-form-prestamo-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatCheckboxModule, MatDialogModule, MatSnackBarModule
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
    @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

    dialogRef        = inject(MatDialogRef<FormPrestamoDialogComponent>);
    private _confirmDialogRef: any = null;

    private dialog      = inject(MatDialog);
    private fb          = inject(FormBuilder);
    private snackBar    = inject(MatSnackBar);
    private movementSvc  = inject(MovementService);
    private fleetSvc     = inject(FleetService);
    private kitsService  = inject(KitsService);
    private toolSvc      = inject(ToolService);
    private qrScan       = inject(QrScanService);
    private destroy$    = new Subject<void>();

    isSaving    = false;

    internalForm!: FormGroup;
    internalDataSource = signal<InternalLoanItem[]>([]);

    private _tecnicoSearch$ = new Subject<string>();
    tecnicosFiltrados:  any[] = [];
    tecnicoLoading      = false;
    showTecnicoDropdown = false;

    private _entregadorSearch$ = new Subject<string>();
    entregadoresFiltrados:  any[] = [];
    entregadorLoading      = false;
    showEntregadorDropdown = false;

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
    private _toolIdsEnPrestamo: Set<number> = new Set();

    kits:              any[] = [];
    kitSeleccionado          = '';
    loadingKitComponents     = false;

    private readonly conditionMap: Record<string, string> = {
        'SERVICEABLE': 'good', 'NUEVO': 'new', 'NEW': 'new', 'EN_CALIBRACION': 'fair',
        'UNSERVICEABLE': 'damaged', 'EN_REPARACION': 'poor', 'REPARACION': 'poor',
        'BUENO': 'good', 'REGULAR': 'fair', 'MALO': 'poor'
    };

    ngOnInit(): void {
        this.initInternalForm();
        this._setupTecnicoSearch();
        this._setupEntregadorSearch();
        this._setupToolSearchPt();
        this.cargarAeronaves();
        this.cargarDestinos();
        this._cargarHerramientasEnPrestamo();
        this._fetchPtCorrelativoPreview();
        this.loadKits();
        setTimeout(() => this._focusScanPt(), 150);
    }

    ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

    private _focusScanPt(): void {
        try { this.scanInputRef?.nativeElement.focus(); } catch { /* view not ready */ }
    }

    _localDateStr(d = new Date()): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    get hoy(): string { return this._localDateStr(); }

    private initInternalForm(): void {
        const today = this._localDateStr();
        const now   = new Date();
        let defaultEntregador = '';
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            if (auth.nombre_usuario) defaultEntregador = auth.nombre_usuario;
        } catch { /* ignore */ }
        this.internalForm = this.fb.group({
            buscarTecnico:     [''],
            nombreCompleto:    ['', Validators.required],
            nroLicencia:       ['', Validators.required],
            cargo:             [''],
            fecha:             [today, Validators.required],
            hora:              [`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`, Validators.required],
            matriculaAeronave: ['N/A'],
            ordenTrabajo:      [''],
            destino:           ['', Validators.required],
            trabajoEspecial:   [false],
            observaciones:     [''],
            nombreEntregador:  [defaultEntregador, Validators.required]
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

    private _setupEntregadorSearch(): void {
        this._entregadorSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showEntregadorDropdown = false; return of([]); }
                this.entregadorLoading = true;
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map(lista => (lista as any[])
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({ id: f.id_employee || f.id, nombre: f.nombreCompleto || f.nombre, cargo: f.cargo || '' }))
                    ),
                    finalize(() => this.entregadorLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { this.entregadoresFiltrados = res || []; this.showEntregadorDropdown = (res || []).length > 0; });
    }

    onEntregadorInput(v: string): void {
        this.internalForm.patchValue({ nombreEntregador: v }, { emitEvent: false });
        if (v.length >= 2) this._entregadorSearch$.next(v); else this.showEntregadorDropdown = false;
    }
    selectEntregador(e: any): void {
        this.internalForm.patchValue({ nombreEntregador: e.nombre });
        this.showEntregadorDropdown = false;
    }
    hideEntregadorSuggestions(): void { setTimeout(() => this.showEntregadorDropdown = false, 200); }

    private cargarDestinos(): void {
        this.loadingDestinos = true;
        this.internalForm.get('destino')?.disable();
        this.movementSvc.getParametrosPorCategoria('AREA_DESTINO')
            .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingDestinos = false; this.internalForm.get('destino')?.enable(); }))
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

    private _toolDisponible(t: any): boolean {
        const stock = Number(t.quantity_in_stock ?? t.stock ?? t.existencia ?? 0);
        return !motivoBloqueoSalida(t) && stock > 0;
    }

    private _motivoNoDisponible(t: any): string {
        const motivo = motivoBloqueoSalida(t);
        if (motivo) return motivo;
        const stock = Number(t.quantity_in_stock ?? t.stock ?? t.existencia ?? 0);
        if (stock <= 0) return 'Sin stock disponible';
        return 'No disponible';
    }

    private _cargarHerramientasEnPrestamo(): void {
        this.movementSvc.getActiveLoanItems({ filtro_adicional: 'returned = false' })
            .pipe(takeUntil(this.destroy$), catchError(() => of([])))
            .subscribe((loanItems: any[]) => {
                this._toolIdsEnPrestamo = new Set((loanItems || []).map((i: any) => Number(i.tool_id)));
            });
    }

    // Búsqueda en vivo contra el backend (getTools → searchToolsAutocomplete), sin filtrar
    // disponibilidad: eso se valida al agregar (filtrarlo escondía herramientas reales).
    private _setupToolSearchPt(): void {
        this._toolSearchPt$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                if (term.length < 2) { this.showToolDropPt = false; return of([]); }
                this.toolSearchLoadingPt = true;
                return this.toolSvc.getTools({ query: term }).pipe(
                    map((tools: any[]) => (tools || [])
                        .map((t: any) => ({
                            id: t.id_tool ?? t.id, codigo: t.code ?? t.codigo ?? '',
                            nombre: t.name ?? t.nombre ?? '', pn: t.part_number ?? t.pn ?? '',
                            sn: t.serial_number ?? t.sn ?? '', marca: t.brand ?? t.marca ?? '',
                            status: (t.status ?? 'available').toLowerCase(),
                            enPrestamo: this._toolIdsEnPrestamo.has(Number(t.id_tool ?? t.id)),
                            fechaCalibracion: t.next_calibration_date ?? t.calibration_due_date ?? '',
                            listaContenido:   t.content_list ?? '',
                            unidad:           t.unit_of_measure ?? t.unidad ?? 'PZA',
                            imagen:           t.location_photo ?? null,
                            notesTool:        t.notes ?? '',
                            warehouseId:      t.warehouse_id != null ? Number(t.warehouse_id) : null,
                            rackId:           t.rack_id      != null ? Number(t.rack_id)      : null,
                            levelId:          t.level_id     != null ? Number(t.level_id)     : null,
                        }))
                        .slice(0, 12)
                    ),
                    finalize(() => this.toolSearchLoadingPt = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { this.toolSuggestionsPt = res; this.showToolDropPt = res.length > 0; });
    }

    onToolInputPt(value: string): void { this.toolSearchPt = value; this._toolSearchPt$.next(value.trim()); }
    hideToolDropPt(): void { setTimeout(() => this.showToolDropPt = false, 150); }
    selectToolSuggestionPt(tool: any): void { this.toolSearchPt = tool.codigo; this.showToolDropPt = false; this._agregarToolPt(tool); }

    /** Enter en el input / lector físico wedge: usa la coincidencia exacta de las
     *  sugerencias si ya llegó, si no resuelve el código directo contra el backend. */
    scanAndAddPt(): void {
        const code = this.toolSearchPt.trim();
        if (!code) return;
        // Etiqueta QR (URL `.../qr-code/<token>`): descifra a código plano y reintenta.
        if (this.qrScan.isQrLabel(code)) {
            this.toolSearchLoadingPt = true;
            this.qrScan.toToolCode(code).pipe(takeUntil(this.destroy$)).subscribe(real => {
                this.toolSearchLoadingPt = false;
                if (!real) { this.showMsg('warning', 'Etiqueta QR no reconocida'); this.toolSearchPt = ''; return; }
                this.toolSearchPt = real;
                this.scanAndAddPt();
            });
            return;
        }
        const exact = this.toolSuggestionsPt.find(h => h.codigo.toLowerCase() === code.toLowerCase());
        if (exact) { this._agregarToolPt(exact); return; }
        this.toolSearchLoadingPt = true;
        this.toolSvc.getToolByCode(code).pipe(
            finalize(() => this.toolSearchLoadingPt = false),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (raw: any) => {
                if (!raw) { this.showMsg('warning', `No se encontró la herramienta "${code}"`); return; }
                this._agregarToolPt(this._mapToolRow(raw));
            },
            error: () => this.showMsg('error', 'Error al buscar la herramienta')
        });
    }

    private _mapToolRow(t: any): any {
        return {
            id:               t.id_tool ?? t.id,
            codigo:           t.code ?? t.codigo ?? '',
            nombre:           t.name ?? t.nombre ?? t.description ?? '',
            pn:               t.part_number ?? t.pn ?? '',
            sn:               t.serial_number ?? t.sn ?? '',
            marca:            t.brand ?? t.marca ?? '',
            status:           (t.status ?? 'available').toLowerCase(),
            fechaCalibracion: t.next_calibration_date ?? t.calibration_due_date ?? '',
            listaContenido:   t.content_list ?? '',
            unidad:           t.unit_of_measure ?? t.unidad ?? 'PZA',
            imagen:           t.location_photo ?? null,
            notesTool:        t.notes ?? '',
            warehouseId:      t.warehouse_id != null ? Number(t.warehouse_id) : null,
            rackId:           t.rack_id      != null ? Number(t.rack_id)      : null,
            levelId:          t.level_id     != null ? Number(t.level_id)     : null,
        };
    }

    private _agregarToolPt(tool: any): void {
        if (this.internalDataSource().some(i => i.codigo === tool.codigo)) { this.showMsg('info', `"${tool.nombre}" ya está en la lista`); return; }
        if (this._toolIdsEnPrestamo.has(Number(tool.id))) { this.showMsg('warning', `"${tool.nombre}" ya tiene un préstamo activo y no está disponible`); return; }
        const motivoBloqueo = motivoBloqueoSalida(tool);
        if (motivoBloqueo) { this.showMsg('warning', `"${tool.nombre}" no se puede prestar: ${motivoBloqueo}`); return; }
        const item: InternalLoanItem = {
            toolId: tool.id ?? 0, id: Date.now(), codigo: tool.codigo,
            pn: tool.pn || '', descripcion: tool.nombre || '', sn: tool.sn || '',
            marca: tool.marca || '',
            fechaCalibracion: tool.fechaCalibracion || '',
            listaContenido:   tool.listaContenido   || '',
            cantidad: 1,
            unidad: tool.unidad || 'PZA', estado: 'SERVICEABLE', contenido: '', selected: false,
            imagen: tool.imagen ?? null, notesTool: tool.notesTool || '',
            warehouseId: tool.warehouseId ?? null, rackId: tool.rackId ?? null, levelId: tool.levelId ?? null
        };
        this.internalDataSource.update(list => [...list, item]);
        this.showMsg('success', `"${item.descripcion}" agregada`);
        this.toolSearchPt = '';
        this.toolSuggestionsPt = [];
        this.showToolDropPt = false;
        setTimeout(() => this._focusScanPt(), 50);
    }

    private _fetchPtCorrelativoPreview(): void {
        this.loadingPtCorrelativo = true;
        this.movementSvc.getSiguienteCorrelativoPreview('PT')
            .pipe(takeUntil(this.destroy$), finalize(() => this.loadingPtCorrelativo = false))
            .subscribe({ next: (nro) => this.ptCorrelativoPreview = nro });
    }

    loadKits(): void {
        forkJoin({ categorias: this.kitsService.getKitCategories(), kits: this.kitsService.getKits({ limit: 200 }) })
            .pipe(takeUntil(this.destroy$))
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
                            estado: 'SERVICEABLE', contenido: '', selected: false,
                            imagen: c.location_photo ?? null, notesTool: c.tool_notes || '',
                            warehouseId: c.warehouse_id != null ? Number(c.warehouse_id) : null,
                            rackId:      c.rack_id      != null ? Number(c.rack_id)      : null,
                            levelId:     c.level_id     != null ? Number(c.level_id)     : null,
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

    // Clic en un ítem del préstamo → abre el form de detalle de herramienta (el de ingresos-hub)
    // en modo solo-vista, sin buscador ni guardar.
    async abrirDetalleHerramientaItem(item: InternalLoanItem): Promise<void> {
        const { DetalleHerramientaComponent } = await import('../../ingresos-hub/detalle-herramienta/detalle-herramienta.component');
        const editItem = {
            toolId: item.toolId, codigoBoa: item.codigo, pn: item.pn, sn: item.sn,
            descripcion: item.descripcion, marca: item.marca, tipo: 'HERRAMIENTA',
            estado: item.estado, cantidad: item.cantidad, um: item.unidad, obs: item.notesTool,
            imagenMaster: item.imagen, warehouseId: item.warehouseId,
            rackId: item.rackId, levelId: item.levelId
        };
        this.dialog.open(DetalleHerramientaComponent, {
            width: '800px', maxWidth: '96vw', height: '560px',
            panelClass: 'no-padding-dialog', hasBackdrop: true, disableClose: false, autoFocus: false,
            data: { editItem, viewOnly: true }
        });
    }

    limpiarPrestamo(): void { this.internalDataSource.set([]); this.initInternalForm(); this._fetchPtCorrelativoPreview(); }

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
            width: 'min(920px, 95vw)', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true
        });
    }
    cerrarModalConfirmInterno(): void { this._confirmDialogRef?.close(); }

    finalizarInterno(): void {
        this.cerrarModalConfirmInterno();
        this.isSaving = true;
        // Pestaña reservada dentro del gesto (click en "Registrar") para que la
        // nota MGH-100 no la corte el bloqueador de pop-ups tras el POST.
        const notaWin = this.movementSvc.preAbrirVentanaPdf();
        const fv    = this.internalForm.getRawValue();
        const items = this.internalDataSource();
        const itemsJson = JSON.stringify(items.map(i => ({
            tool_id: i.toolId, quantity: i.cantidad, notes: i.contenido || '',
            condition: this.conditionMap[i.estado?.toUpperCase()] || 'good'
        })));
        const responsiblePerson = fv.nombreEntregador || 'ALMACÉN';
        this.movementSvc.registrarPrestamoMultiple({
            type: 'PRESTAMO_INTERNO', date: fv.fecha, time: fv.hora,
            requested_by_name: fv.nombreCompleto, technician: fv.nombreCompleto,
            authorized_by: fv.nroLicencia, department: fv.destino || '',
            aircraft: fv.matriculaAeronave || '', work_order_number: fv.ordenTrabajo || '',
            special_work: fv.trabajoEspecial || false, notes: fv.observaciones || '',
            responsible_person: responsiblePerson, items_json: itemsJson
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                const idLoan = Number(result?.id_loan);
                if (idLoan) this.movementSvc.verNotaPrestamo(idLoan, 'mgh100', false, notaWin);
                else { try { notaWin?.close(); } catch { /* noop */ } this.showMsg('warning', `Préstamo ${nro} registrado, pero no se pudo abrir la nota MGH-100 (sin id_loan)`); }
                this.showMsg('success', `Préstamo registrado: ${nro}`);
                this.internalDataSource.set([]);
                this.initInternalForm();
                this.dialogRef.close({ success: true, movement_number: nro });
            },
            error: (err: any) => { try { notaWin?.close(); } catch { /* noop */ } this.showMsg('error', err?.message || 'Error al registrar'); }
        });
    }

    cerrar(): void {
        if (this.internalDataSource().length > 0 &&
            !confirm(`¿Cancelar el préstamo? Se perderán los ${this.internalDataSource().length} ítem(s) agregado(s).`)) return;
        this.dialogRef.close();
    }

    private showMsg(type: 'success' | 'error' | 'info' | 'warning', text: string): void {
        this.snackBar.open(text, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
