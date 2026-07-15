import { Component, inject, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, Subscription, Observable, of, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize, mergeMap, map } from 'rxjs/operators';
import { MovementService }          from '../../../../core/services/movement.service';
import { CalibrationService }       from '../../../../core/services/calibration.service';
import { GestionUbicacionesService } from '../gestion-ubicaciones/gestion-ubicaciones.service';
import { Warehouse, Rack, Level }   from '../gestion-ubicaciones/interfaces';
import { KitsService }              from '../../../../core/services/kits.service';

@Component({
    selector: 'app-gestionar-kit',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatIconModule,
        DragDropModule,
        MatDialogModule
    ],
    templateUrl: './gestionar-kit.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; }

        .neo-scrollbar::-webkit-scrollbar { width: 8px; }
        .neo-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .neo-scrollbar::-webkit-scrollbar-thumb { background: #0F172A; border: 2px solid #000; border-radius: 4px; }
        .neo-scrollbar::-webkit-scrollbar-thumb:hover { background: #000; }
        :host-context(.dark) .neo-scrollbar::-webkit-scrollbar-thumb { background: #fbbf24; border-color: #000; }

        @keyframes itemPopIn {
            0%   { opacity: 0; transform: translateY(-6px) scaleY(0.85); }
            60%  { opacity: 1; transform: translateY(2px) scaleY(1.02); }
            100% { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        .item-enter {
            animation: itemPopIn 0.28s cubic-bezier(0.34, 1.4, 0.64, 1) both;
        }
    `]
})
export class GestionarKitComponent implements OnInit, OnDestroy {

    kitForm: FormGroup;
    modoEdicion = false;
    saving = false;
    errorMsg = '';

    categorias: string[]     = [];
    categoriasLoading        = false;
    readonly estados = [
        { value: 'complete',       label: 'COMPLETO' },
        { value: 'incomplete',     label: 'INCOMPLETO' },
        { value: 'in_use',         label: 'EN USO' },
        { value: 'in_calibration', label: 'EN CALIBRACIÓN' }
    ];

    // ── Autocomplete funcionarios ──────────────────────────────────────
    funcionarioSuggestions: any[] = [];
    funcionarioLoading = false;
    showFuncionarioSuggestions = false;
    private _reqSearch$ = new Subject<string>();

    // ── Autocomplete herramientas ──────────────────────────────────────
    toolSearchValue   = '';
    toolSuggestions:  any[] = [];
    toolSearchLoading = false;
    showToolDropdown  = false;
    private _toolSearch$ = new Subject<string>();

    // ── Picker de ubicación (mini ventana / MatDialog anidado) ──────────
    @ViewChild('ubicacionPickerTpl') ubicacionPickerTpl!: TemplateRef<any>;
    private ubicacionPickerRef: MatDialogRef<any> | null = null;
    pickerExpanded    = false;
    showAlmacenGrid   = false;
    loadingWarehouses = false;
    loadingRacks      = false;
    warehouses:   Warehouse[] = [];
    racksFull:    Rack[]      = [];
    selWarehouse: Warehouse | null = null;
    selRack:      Rack | null      = null;
    selectedLevelId: number | null = null;

    // Ubicacion original del kit al abrir el form en modo edicion (para detectar si el
    // usuario la cambio y disparar moverKit en vez de mezclarlo con el guardado normal).
    private originalLocation: { rackId: number | null; levelId: number | null } | null = null;

    get racks():  Rack[]  { return this.racksFull; }
    get levels(): Level[] { return this.selRack?.niveles ?? []; }

    private _subs = new Subscription();

    private fb               = inject(FormBuilder);
    public  dialogRef        = inject(MatDialogRef<GestionarKitComponent>);
    private dialogData       = inject<any>(MAT_DIALOG_DATA, { optional: true });
    private movementService  = inject(MovementService);
    private calibrationService = inject(CalibrationService);
    private ubicSvc          = inject(GestionUbicacionesService);
    private kitsService      = inject(KitsService);
    private dialog           = inject(MatDialog);

    constructor() {
        this.kitForm = this.fb.group({
            codigo:         [{ value: '', disabled: true }],
            nombreKit:      ['', Validators.required],
            categoria:      ['GENERAL', Validators.required],
            estado:         ['complete', Validators.required],
            funcionario:    [''],
            ubicacion:      [''],
            descripcionKit: [''],
            items:          this.fb.array([])
        });
    }

    itemsLoading = false;

    ngOnInit(): void {
        // Cargar categorías desde backend
        this.categoriasLoading = true;
        this._subs.add(
            this.kitsService.getKitCategories().pipe(
                finalize(() => this.categoriasLoading = false)
            ).subscribe(cats => {
                this.categorias = cats.filter(c => c.active).map(c => c.name);
                if (this.categorias.length > 0 && !this.kitForm.get('categoria')?.value) {
                    this.kitForm.get('categoria')?.setValue(this.categorias[0]);
                }
            })
        );

        if (this.dialogData?.mode === 'edit' && this.dialogData?.kit) {
            this.modoEdicion = true;
            const kit = this.dialogData.kit;
            const id_kit = kit.id_kit ?? kit.id;
            this.kitForm.patchValue({
                codigo:         kit.code        ?? '',
                nombreKit:      kit.name        ?? kit.nombre      ?? '',
                categoria:      kit.category    ?? kit.categoria   ?? 'GENERAL',
                estado:         kit.status      ?? 'complete',
                funcionario:    kit.funcionario_nombre ?? kit.responsable ?? '',
                ubicacion:      kit.location_name ?? kit.ubicacion ?? '',
                descripcionKit: kit.description ?? kit.descripcion ?? ''
            });
            this.prefillUbicacion(kit);
            // Cargar componentes existentes desde el backend (no desde _raw, que no los tiene)
            if (id_kit) {
                this.itemsLoading = true;
                this._subs.add(
                    this.kitsService.getKitComponents(id_kit).pipe(
                        finalize(() => this.itemsLoading = false)
                    ).subscribe(components => {
                        components.forEach((c: any) => {
                            this.items.push(this._buildItemGroup(
                                c.tool_name ?? c.name ?? '',
                                c.tool_code ?? c.code ?? '',
                                c.tool_id ?? null
                            ));
                        });
                    })
                );
            }
        } else {
            // Modo crear: el código se genera al guardar, no al abrir
            this.kitForm.get('codigo')?.setValue('Auto-generado al guardar');
        }

        // Búsqueda de funcionarios
        this._subs.add(
            this._reqSearch$.pipe(
                debounceTime(350),
                distinctUntilChanged(),
                switchMap(term => {
                    if (term.length < 2) {
                        this.funcionarioSuggestions     = [];
                        this.showFuncionarioSuggestions = false;
                        return of([]);
                    }
                    this.funcionarioLoading = true;
                    const q = term.toLowerCase();
                    return this.movementService.getPersonal().pipe(
                        map(lista => lista
                            .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                                .filter(Boolean).join(' ').toLowerCase().includes(q))
                            .slice(0, 10)
                            .map(f => ({ ...f, nombre: f.nombreCompleto || f.nombre }))
                        ),
                        finalize(() => this.funcionarioLoading = false),
                        catchError(() => of([]))
                    );
                })
            ).subscribe(lista => {
                this.funcionarioSuggestions     = lista;
                this.showFuncionarioSuggestions = lista.length > 0;
            })
        );

        // Búsqueda de herramientas
        this._subs.add(
            this._toolSearch$.pipe(
                debounceTime(350),
                distinctUntilChanged(),
                switchMap(term => {
                    if (term.length < 2) {
                        this.toolSuggestions  = [];
                        this.showToolDropdown = false;
                        return of([]);
                    }
                    this.toolSearchLoading = true;
                    return this.calibrationService.searchToolsAutocomplete(term).pipe(
                        finalize(() => this.toolSearchLoading = false),
                        catchError(() => of([]))
                    );
                })
            ).subscribe(tools => {
                this.toolSuggestions  = tools;
                this.showToolDropdown = tools.length > 0;
            })
        );
    }

    ngOnDestroy(): void { this._subs.unsubscribe(); }

    // ── FormArray ──────────────────────────────────────────────────────
    get items(): FormArray { return this.kitForm.get('items') as FormArray; }

    private _buildItemGroup(descripcion = '', codigo = '', tool_id: number | null = null): FormGroup {
        return this.fb.group({
            descripcion: [descripcion],
            codigo:      [codigo],
            tool_id:     [tool_id]
        });
    }

    eliminarItem(i: number): void { this.items.removeAt(i); }

    // ── Funcionarios ───────────────────────────────────────────────────
    onFuncionarioInput(event: Event): void {
        this._reqSearch$.next((event.target as HTMLInputElement).value);
    }

    seleccionarFuncionario(f: any): void {
        this.kitForm.get('funcionario')?.setValue(f.nombre ?? f.full_name ?? '');
        this.showFuncionarioSuggestions = false;
        this.funcionarioSuggestions    = [];
    }

    ocultarFuncionarios(): void {
        setTimeout(() => this.showFuncionarioSuggestions = false, 150);
    }

    // ── Herramientas ───────────────────────────────────────────────────
    onToolInput(event: Event): void {
        this.toolSearchValue = (event.target as HTMLInputElement).value;
        this._toolSearch$.next(this.toolSearchValue.trim());
    }

    seleccionarHerramienta(tool: any): void {
        this.items.push(this._buildItemGroup(
            tool.name ?? tool.tool_name ?? '',
            tool.code ?? tool.tool_code ?? '',
            tool.id_tool ?? tool.tool_id ?? null
        ));
        this.toolSearchValue  = '';
        this.toolSuggestions  = [];
        this.showToolDropdown = false;
    }

    ocultarTools(): void {
        setTimeout(() => this.showToolDropdown = false, 150);
    }

    // ── Picker de ubicación (mini ventana) ───────────────────────────────
    openUbicacionPicker(): void {
        if (this.ubicacionPickerRef) { this.closeUbicacionPicker(); return; }

        if (!this.warehouses.length) {
            this.loadingWarehouses = true;
            this._subs.add(
                this.ubicSvc.getWarehouses().pipe(
                    finalize(() => this.loadingWarehouses = false)
                ).subscribe(ws => {
                    this.warehouses = this._soloCbba(ws.filter(w => w.estado === 'ACTIVO'));
                    if (!this.selWarehouse && this.warehouses.length === 1) {
                        this.selectWarehouse(this.warehouses[0]);
                    }
                })
            );
        }

        this.pickerExpanded     = true;
        this.ubicacionPickerRef = this.dialog.open(this.ubicacionPickerTpl, {
            width: 'min(760px, 96vw)',
            maxHeight: '70vh',
            panelClass: 'no-padding-dialog',
            hasBackdrop: true,
            autoFocus: false,
        });
        this.ubicacionPickerRef.afterClosed().subscribe(() => {
            this.ubicacionPickerRef = null;
            this.pickerExpanded     = false;
        });
    }

    closeUbicacionPicker(): void {
        this.ubicacionPickerRef?.close();
    }

    toggleAlmacenGrid(): void { this.showAlmacenGrid = !this.showAlmacenGrid; }

    selectWarehouse(w: Warehouse): void {
        if (this.selWarehouse?.id === w.id) { this.showAlmacenGrid = false; return; }
        this.selWarehouse   = w;
        this.selRack        = null;
        this.selectedLevelId = null;
        this.racksFull      = [];
        this.showAlmacenGrid = false;
        this.loadingRacks   = true;
        this._subs.add(
            this._cargarRacksDeAlmacen(w).pipe(
                finalize(() => this.loadingRacks = false)
            ).subscribe(rs => { this.racksFull = rs; })
        );
    }

    // Únicos almacenes reales de Cochabamba con estantes/niveles cargados (catálogo DAT-12,
    // data000001.sql): Almacén Central Hangar CBB y Depósito Externo CBB (zona Hazmat).
    // El resto de bases del catálogo están vacías (sin estantes todavía).
    // startsWith en vez de code exacto: DAT-12 los creó como 'ALM-CBB'/'ALM-CBB-EXT', y DAT-14
    // los renombra a 'ALM-CBB-0001'/'ALM-CBB-0002' (formato oficial) — a la fecha no está
    // confirmado si DAT-14 ya corrió en el servidor que se esté usando, así que se cubren
    // ambos estados. Mismo patrón de fallback que ya usa form-envio.component.ts para esto.
    private _soloCbba(ws: Warehouse[]): Warehouse[] {
        return ws.filter(w => w.codigo?.startsWith('ALM-CBB'));
    }

    /**
     * 2 requests fijos (racks + niveles de TODO el almacén) en vez de 1+N (un getLevels
     * por rack) — ALM-CBB tiene 33 estantes, eso eran hasta 34 llamadas HTTP paralelas
     * cada vez que se abría el picker. Mismo fix ya aplicado en gestion-estantes.component.ts.
     */
    private _cargarRacksDeAlmacen(w: Warehouse): Observable<Rack[]> {
        return forkJoin([
            this.ubicSvc.getRacks(w.id),
            this.ubicSvc.getLevelsByWarehouse(w.id)
        ]).pipe(
            map(([racks, levels]) => racks
                .filter(r => r.activo)
                .map(r => ({
                    ...r,
                    niveles: levels.filter(l => l.rackId === r.id && l.activo && !l.isFloor)
                }))
            ),
            catchError(() => of([] as Rack[]))
        );
    }

    /**
     * En modo edicion, precarga almacen/estante/nivel actuales del kit (rack_id/level_id
     * reales) para que el picker muestre la ubicacion vigente y para poder detectar si el
     * usuario la cambia al guardar (ver onSubmit).
     */
    private prefillUbicacion(kit: any): void {
        const warehouseId = kit.warehouse_id != null ? Number(kit.warehouse_id) : null;
        const rackId      = kit.rack_id      != null ? Number(kit.rack_id)      : null;
        const levelId     = kit.level_id     != null ? Number(kit.level_id)     : null;
        this.originalLocation = { rackId, levelId };
        if (!warehouseId || !rackId || !levelId) return;

        this.loadingWarehouses = true;
        this._subs.add(
            this.ubicSvc.getWarehouses().pipe(
                finalize(() => this.loadingWarehouses = false)
            ).subscribe(ws => {
                const activos = ws.filter(w => w.estado === 'ACTIVO');
                // El picker solo ofrece almacenes de Cbb, pero la busqueda del almacen
                // actual del kit usa la lista completa (por si viniera de datos legado
                // con otra base) para no perder el dato al editar.
                this.warehouses = this._soloCbba(activos);
                const wh = activos.find(w => w.id === warehouseId);
                if (!wh) return;
                this.selWarehouse = wh;
                this.loadingRacks = true;
                this._subs.add(
                    this._cargarRacksDeAlmacen(wh).pipe(
                        finalize(() => this.loadingRacks = false)
                    ).subscribe(rs => {
                        this.racksFull = rs;
                        const rack = rs.find(r => r.id === rackId);
                        if (rack) {
                            this.selRack         = rack;
                            this.selectedLevelId = levelId;
                        }
                    })
                );
            })
        );
    }

    selectRack(r: Rack): void {
        this.selRack        = r;
        this.selectedLevelId = null;
    }

    selectLevel(l: Level): void {
        this.selectedLevelId = l.id;
        const etiqueta = `${this.selWarehouse!.nombre} › ${this.selRack!.nombre} › ${l.nombre}`;
        this.kitForm.patchValue({ ubicacion: etiqueta });
        this.closeUbicacionPicker();
    }

    clearUbicacion(): void {
        this.kitForm.patchValue({ ubicacion: '' });
        this.selWarehouse    = null;
        this.selRack         = null;
        this.racksFull       = [];
        this.selectedLevelId = null;
        this.closeUbicacionPicker();
    }

    // ── Submit ─────────────────────────────────────────────────────────
    cerrar(): void { this.dialogRef.close(); }

    onSubmit(): void {
        if (!this.kitForm.valid || this.saving) return;

        this.saving   = true;
        this.errorMsg = '';

        const raw    = this.kitForm.getRawValue();
        const items  = this.items.value as any[];
        const payload: any = {
            code:               raw.codigo,
            name:               raw.nombreKit,
            category:           raw.categoria,
            status:             raw.estado,
            funcionario_nombre: raw.funcionario || null,
            location_name:      raw.ubicacion   || null,
            notes:              raw.descripcionKit || null,
            kit_type:           'MAINTENANCE',
            active:             true,
            is_complete:        false,
            total_components:   items.length,
            present_components: 0,
            completeness_percentage: 0
        };

        if (this.modoEdicion) {
            const id_kit = this.dialogData.kit.id_kit ?? this.dialogData.kit.id;
            payload.id_kit = id_kit;

            this._subs.add(
                this.kitsService.updateKit(id_kit, payload).pipe(
                    mergeMap(() => this.kitsService.getKitComponents(id_kit)),
                    mergeMap(existentes => this.kitsService.deleteKitComponents(existentes)),
                    mergeMap(() => this.kitsService.saveKitComponents(id_kit, items)),
                    mergeMap(() => this._moverKitSiCambioUbicacion(id_kit)),
                    finalize(() => this.saving = false)
                ).subscribe({
                    next: () => { this.dialogRef.close({ saved: true }); },
                    error: (e) => { this.errorMsg = e?.message ?? 'Error al guardar el kit'; }
                })
            );
        } else {
            // createKit no filtra nulls como updateKit (ver kits.service.ts) — pxp-client
            // serializa JS null como el string 'null', que Postgres rechaza al castear a
            // integer. Por eso estos campos solo se agregan al payload si hay ubicacion
            // elegida; si no, se omiten y quedan NULL reales del lado de la BD.
            if (this.selRack?.id && this.selectedLevelId) {
                payload.warehouse_id = this.selWarehouse?.id ?? null;
                payload.rack_id      = this.selRack.id;
                payload.level_id     = this.selectedLevelId;
            }

            this._subs.add(
                this.kitsService.getNextKitCode().pipe(
                    mergeMap(code => {
                        payload.code = code;
                        this.kitForm.get('codigo')?.setValue(code);
                        return this.kitsService.createKit(payload);
                    }),
                    mergeMap(res => {
                        const id_kit = res.id_kit;
                        if (!id_kit) throw new Error('No se recibió ID del kit creado');
                        return this.kitsService.saveKitComponents(id_kit, items);
                    }),
                    finalize(() => this.saving = false)
                ).subscribe({
                    next: () => { this.dialogRef.close({ saved: true }); },
                    error: (e) => { this.errorMsg = e?.message ?? 'Error al guardar el kit'; }
                })
            );
        }
    }

    /**
     * En modo edicion, HE_KIT_MOD nunca toca rack_id/level_id (a proposito, ver
     * ft_kits_ime.sql). Si el usuario cambio la ubicacion en el picker, se dispara
     * HE_KIT_MOV por separado a traves de moverKit().
     */
    private _moverKitSiCambioUbicacion(id_kit: number) {
        const rackId  = this.selRack?.id      ?? null;
        const levelId = this.selectedLevelId  ?? null;
        const changed = rackId  !== (this.originalLocation?.rackId  ?? null)
                     || levelId !== (this.originalLocation?.levelId ?? null);
        if (!changed || !rackId || !levelId) return of(null);
        return this.kitsService.moverKit(id_kit, rackId, levelId);
    }

    // ── Helpers ────────────────────────────────────────────────────────
    getEstadoLabel(value: string): string {
        return this.estados.find(e => e.value === value)?.label ?? value;
    }

    getEstadoClass(value: string): string {
        const m: Record<string, string> = {
            'complete':       'bg-green-100 text-green-800 border-green-800',
            'incomplete':     'bg-yellow-100 text-yellow-800 border-yellow-800',
            'in_use':         'bg-blue-100 text-blue-800 border-blue-800',
            'in_calibration': 'bg-purple-100 text-purple-800 border-purple-800'
        };
        return m[value] ?? 'bg-stone-200 text-black border-black';
    }
}
