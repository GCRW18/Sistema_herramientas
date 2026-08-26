import { Component, OnInit, OnDestroy, inject, signal, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap, catchError, finalize } from 'rxjs/operators';
import { ToolService } from '../../../../../core/services/tool.service';
import { MovementService } from '../../../../../core/services/movement.service';
import { GestionUbicacionesService } from '../../../inventory/gestion-ubicaciones/gestion-ubicaciones.service';
import { Warehouse, Rack, Level } from '../../../inventory/gestion-ubicaciones/interfaces';
import type { HerramientaItem } from '../ingresos-hub.component';

export interface RecepcionHerramientaData {
    item?: Partial<HerramientaItem>;
    mode: 'nuevo' | 'editar';
    /** Si es true, genera automáticamente un código BOA nuevo al abrir (duplicar / desde catálogo). */
    autoGenerarCodigo?: boolean;
}

export interface RecepcionHerramientaResult {
    action: 'agregar' | 'actualizar';
    data: HerramientaItem;
}

@Component({
    selector: 'app-recepcion-herramienta',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule,
        MatIconModule, MatSnackBarModule,
        MatTooltipModule, MatProgressSpinnerModule, DragDropModule,
    ],
    templateUrl: './recepcion-herramienta.component.html',
    styles: [`
        :host { display: block; width: 100%; height: 100%; }
        .custom-scrollbar-ing::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ing::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ing::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
    `]
})
export class RecepcionHerramientaComponent implements OnInit, OnDestroy {
    public  dialogRef = inject(MatDialogRef<RecepcionHerramientaComponent>, { optional: true });
    public  data      = inject<RecepcionHerramientaData>(MAT_DIALOG_DATA, { optional: true });
    private fb        = inject(FormBuilder);
    private dialog    = inject(MatDialog);
    private snackBar  = inject(MatSnackBar);
    private toolSvc   = inject(ToolService);
    private movementSvc = inject(MovementService);
    private ubicSvc   = inject(GestionUbicacionesService);
    private destroy$  = new Subject<void>();

    @ViewChild('ubicDialogTpl') ubicDialogTpl!: TemplateRef<any>;
    private ubicDialogRef: MatDialogRef<any> | null = null;

    isEditMode = false;
    herramientaForm!: FormGroup;
    herramientaImagen = signal<string | null>(null);

    /* ════════ Buscador herramienta existente (header) ════════ */
    herBuscarValue    = '';
    herSuggestions: any[] = [];
    showHerDD         = false;
    herSearchLoading  = false;
    private _herSearch$ = new Subject<string>();

    /* ════════ Listas ════════ */
    marcas: string[] = [];

    tiposHerramienta: { value: string; label: string }[] = [
        { value: 'HERRAMIENTA',     label: 'HERRAMIENTA'                  },
        { value: 'BANCO_PRUEBA',    label: 'BANCO DE PRUEBA'              },
        { value: 'CONSUMIBLE',      label: 'CONSUMIBLE'                   },
        { value: 'EQUIPO_MEDICION', label: 'EQUIPO DE MEDICIÓN'           },
        { value: 'EQUIPO_SOPORTE',  label: 'EQUIPO DE SOPORTE EN TIERRA' },
    ];

    unidadesMedida = [
        { value: 'UNIDAD', label: 'UNIDAD' }, { value: 'PAR',   label: 'PAR'   },
        { value: 'JUEGO',  label: 'JUEGO'  }, { value: 'KIT',   label: 'KIT'   },
        { value: 'LITRO',  label: 'LITRO'  }, { value: 'METRO', label: 'METRO' },
    ];

    private ultimoCorrelativo = 0;

    /* ════════ Ubicación — picker inline ════════ */
    ubAlmacenes: Warehouse[] = [];
    /** Lista completa de almacenes (sin filtrar a ALM-CBB), para poder ubicar
     *  herramientas ya guardadas en un almacén fuera de Cochabamba (datos legado). */
    private _todosLosAlmacenes: Warehouse[] = [];
    /** Ubicación pendiente de aplicar si el usuario selecciona una herramienta del
     *  buscador antes de que _loadAlmacenes() haya terminado de resolver. */
    private _pendingAutoSelect: { wId: number; rId: number | null | undefined; lId: number | null | undefined } | null = null;
    ubRacks:     Rack[]      = [];
    ubLevels:    Level[]     = [];
    ubSelectedWarehouse: Warehouse | null = null;
    ubSelectedRack:      Rack     | null = null;
    ubSelectedLevel:     Level    | null = null;

    loadingAlmacenes = false;
    loadingRacks     = false;
    loadingLevels    = false;

    showUbicacionPanel = false;
    showUbAlmacenGrid  = true;

    /* ════════ Lifecycle ════════ */
    ngOnInit(): void {
        this.isEditMode = this.data?.mode === 'editar';

        this.herramientaForm = this.fb.group({
            pn:                   ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z0-9\-_]+$/)]],
            sn:                   ['', Validators.pattern(/^[A-Za-z0-9\-_]*$/)],
            descripcion:          ['', [Validators.required, Validators.minLength(3)]],
            codigoBoa:            ['BOA-H-', [Validators.required, Validators.pattern(/^[A-Za-z0-9\-]+$/)]],
            cantidad:             [1, [Validators.required, Validators.min(1), Validators.max(9999)]],
            unidadMedida:         ['UNIDAD', Validators.required],
            estado:               ['NUEVO', Validators.required],
            estante:              [''],
            nivelUbicacion:       [''],
            observacion:          [''],
            requiereCalibracion:  [false],
            intervaloCalibracion: [null],
            fechaCalibracion:     [null],
            nroCertificado:       [''],
            tipo:                 ['HERRAMIENTA', Validators.required],
            marca:                ['', Validators.required],
            nivelCriticidad:      ['B', Validators.required],
            fabricacion:          ['INTERNACIONAL', Validators.required],
            warehouseId:          [null],
            rackId:               [null],
            levelId:              [null],
        });

        if (this.data?.item) {
            this.herramientaForm.patchValue(this.data.item);
            if ((this.data.item as any).imagen) this.herramientaImagen.set((this.data.item as any).imagen);
        }

        this.herramientaForm.get('requiereCalibracion')?.valueChanges.pipe(
            takeUntil(this.destroy$)
        ).subscribe(requiere => {
            const ctrl = this.herramientaForm.get('intervaloCalibracion');
            if (requiere) {
                ctrl?.setValidators([Validators.required, Validators.min(1)]);
            } else {
                ctrl?.clearValidators();
                this.herramientaForm.patchValue({ intervaloCalibracion: null, fechaCalibracion: null, nroCertificado: '' });
            }
            ctrl?.updateValueAndValidity();
        });

        this._setupHerSearch();
        this._loadMarcas();
        this._loadTiposHerramienta();
        this._loadUltimoCorrelativo();
        this._loadAlmacenes();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /* ════════ Carga de listas ════════ */
    private _loadMarcas(): void {
        this.movementSvc.getDistinctBrands().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (brands: string[]) => { this.marcas = brands; } });
    }

    private _loadTiposHerramienta(): void {
        this.movementSvc.getIngresosCategories().pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (cats) => {
                    if (cats.length > 0) {
                        this.tiposHerramienta = cats.map(c => ({
                            value: c.code || c.name.replace(/\s+/g, '_'),
                            label: c.name
                        }));
                    }
                },
                error: () => { /* mantiene el array estático como fallback */ }
            });
    }

    private _loadUltimoCorrelativo(): void {
        this.movementSvc.getLastBoaCode().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (num: number) => {
                this.ultimoCorrelativo = num;
                if (this.data?.autoGenerarCodigo) this.generarCodigoBoa();
            } });
    }

    generarCodigoBoa(): void {
        this.ultimoCorrelativo++;
        this.herramientaForm.patchValue({ codigoBoa: `BOA-H-${this.ultimoCorrelativo.toString().padStart(4, '0')}` });
    }

    /* ════════ Buscador herramienta existente ════════ */
    private _setupHerSearch(): void {
        this._herSearch$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(term => {
                if (term.trim().length < 2) { this.showHerDD = false; return of([]); }
                this.herSearchLoading = true;
                return this.toolSvc.getTools({ query: term.trim() }).pipe(
                    catchError(() => of([])),
                    finalize(() => { this.herSearchLoading = false; })
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(tools => {
            this.herSuggestions = tools as any[];
            this.showHerDD      = this.herSuggestions.length > 0;
        });
    }

    onHerBuscarInput(val: string): void {
        this.herBuscarValue = val;
        this._herSearch$.next(val);
    }

    hideHerDD(): void { setTimeout(() => { this.showHerDD = false; }, 180); }

    seleccionarHerExistente(tool: any): void {
        this.herBuscarValue = `${tool.code || ''} · ${tool.name || tool.description || ''}`;
        this.showHerDD = false;
        this.herramientaForm.patchValue({
            pn:          tool.part_number  || '',
            sn:          tool.serial_number || '',
            codigoBoa:   tool.code         || '',
            descripcion: tool.name         || tool.description || '',
            marca:       tool.brand        || '',
            observacion: tool.notes        || '',
        });
        if (tool.location_photo) this.herramientaImagen.set(tool.location_photo);

        // Ubicación actual de la herramienta (rack_id/level_id de he.ttools) —
        // busca en la lista COMPLETA de almacenes (no la filtrada a ALM-CBB), igual
        // que detalle-herramienta.component.ts: la herramienta puede estar en un
        // almacén fuera de Cochabamba (datos legado) y no queremos perder el dato.
        const wId = tool.warehouse_id ? Number(tool.warehouse_id) : null;
        const rId = tool.rack_id      ? Number(tool.rack_id)      : null;
        const lId = tool.level_id     ? Number(tool.level_id)     : null;
        if (wId && this._todosLosAlmacenes.length > 0) {
            const w = this._todosLosAlmacenes.find(a => a.id === wId);
            if (w) { this._autoSelectWarehouse(w, rId, lId); return; }
        }
        // Si los almacenes aún no cargaron, espera y reintenta cuando _loadAlmacenes() resuelva.
        if (wId && this._todosLosAlmacenes.length === 0) {
            this._pendingAutoSelect = { wId, rId, lId };
        }
    }

    limpiarHerBuscar(): void {
        this.herBuscarValue = '';
        this.herSuggestions = [];
        this.showHerDD      = false;
    }

    /* ════════ Imagen ════════ */
    onHerramientaImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => this.herramientaImagen.set(reader.result as string);
        reader.readAsDataURL(file);
    }

    clearHerramientaImagen(): void { this.herramientaImagen.set(null); }

    /* ════════ Ubicación ════════ */
    private _loadAlmacenes(): void {
        this.loadingAlmacenes = true;
        this.ubicSvc.getWarehouses().pipe(takeUntil(this.destroy$))
            .subscribe({
                next: ws => {
                    this._todosLosAlmacenes = ws;
                    this.ubAlmacenes = ws.filter(w => w.codigo?.startsWith('ALM-CBB'));
                    const item = this.data?.item;
                    if (item?.warehouseId) {
                        const w = this.ubAlmacenes.find(a => a.id === item.warehouseId) || ws.find(a => a.id === item.warehouseId);
                        if (w) this._autoSelectWarehouse(w, item.rackId, item.levelId);
                    }
                    if (this._pendingAutoSelect) {
                        const p = this._pendingAutoSelect;
                        this._pendingAutoSelect = null;
                        const w = ws.find(a => a.id === p.wId);
                        if (w) this._autoSelectWarehouse(w, p.rId, p.lId);
                    }
                    // Ya no se preselecciona ubAlmacenes[0] por defecto en ítems nuevos: pisaba
                    // la ubicación real de la herramienta al seleccionarla desde el buscador
                    // (seleccionarHerExistente), que llega en un request aparte y puede resolver
                    // después de este. Ahora queda sin asignar hasta que el usuario la elija.
                },
                error: () => {},
                complete: () => { this.loadingAlmacenes = false; }
            });
    }

    private _autoSelectWarehouse(w: Warehouse, rId?: number | null, lId?: number | null): void {
        this.ubSelectedWarehouse = w;
        this.showUbAlmacenGrid   = false;
        this.herramientaForm.patchValue({ warehouseId: w.id });
        if (!rId) return;
        this.loadingRacks = true;
        this.ubicSvc.getRacks(w.id).pipe(takeUntil(this.destroy$), finalize(() => this.loadingRacks = false))
            .subscribe({
                next: racks => {
                    this.ubRacks = racks;
                    const r = racks.find(x => x.id === rId);
                    if (!r) return;
                    this.ubSelectedRack = r;
                    this.herramientaForm.patchValue({ estante: r.codigo, rackId: r.id });
                    if (!lId) return;
                    this.loadingLevels = true;
                    this.ubicSvc.getLevels(r.id).pipe(takeUntil(this.destroy$), finalize(() => this.loadingLevels = false))
                        .subscribe({
                            next: levels => {
                                this.ubLevels = levels;
                                const l = levels.find(x => x.id === lId);
                                if (l) {
                                    this.ubSelectedLevel = l;
                                    this.herramientaForm.patchValue({ nivelUbicacion: l.isFloor ? 'SUELO' : l.codigo, levelId: l.id });
                                }
                            },
                            error: () => {}
                        });
                },
                error: () => {}
            });
    }

    seleccionarUbAlmacen(w: Warehouse): void {
        this.ubSelectedWarehouse = w;
        this.showUbAlmacenGrid   = false;
        this.ubSelectedRack      = null;
        this.ubRacks             = [];
        this.ubLevels            = [];
        this.ubSelectedLevel     = null;
        this.herramientaForm.patchValue({ estante: '', nivelUbicacion: '', warehouseId: w.id, rackId: null, levelId: null });
        this.loadingRacks = true;
        this.ubicSvc.getRacks(w.id).pipe(takeUntil(this.destroy$))
            .subscribe({ next: rs => { this.ubRacks = rs; }, error: () => {}, complete: () => { this.loadingRacks = false; } });
    }

    limpiarUbAlmacen(): void {
        this.ubSelectedWarehouse = null;
        this.ubSelectedRack      = null;
        this.ubSelectedLevel     = null;
        this.ubRacks             = [];
        this.ubLevels            = [];
        this.showUbAlmacenGrid   = true;
        this.herramientaForm.patchValue({ estante: '', nivelUbicacion: '', warehouseId: null, rackId: null, levelId: null });
    }

    seleccionarUbEstante(r: Rack): void {
        this.ubSelectedRack  = r;
        this.ubLevels        = [];
        this.ubSelectedLevel = null;
        this.herramientaForm.patchValue({ estante: r.codigo, nivelUbicacion: '', rackId: r.id, levelId: null });
        this.loadingLevels = true;
        this.ubicSvc.getLevels(r.id).pipe(takeUntil(this.destroy$))
            .subscribe({ next: ls => { this.ubLevels = ls; }, error: () => {}, complete: () => { this.loadingLevels = false; } });
    }

    seleccionarUbNivelCard(l: Level): void {
        this.ubSelectedLevel = l;
        this.herramientaForm.patchValue({ nivelUbicacion: l.isFloor ? 'SUELO' : l.codigo, levelId: l.id });
        this.closeUbicacionDialog();
    }

    openUbicacionDialog(): void {
        if (this.ubicDialogRef) { this.closeUbicacionDialog(); return; }
        this.showUbicacionPanel = true;
        this.ubicDialogRef = this.dialog.open(this.ubicDialogTpl, {
            width: 'min(760px, 96vw)',
            maxHeight: '70vh',
            panelClass: 'no-padding-dialog',
            hasBackdrop: true,
            backdropClass: 'ubic-backdrop',
            autoFocus: false,
        });
        this.ubicDialogRef.afterClosed().subscribe(() => {
            this.ubicDialogRef = null;
            this.showUbicacionPanel = false;
        });
    }

    closeUbicacionDialog(): void {
        this.ubicDialogRef?.close();
        this.ubicDialogRef = null;
        this.showUbicacionPanel = false;
    }

    /* ════════ Helpers ════════ */
    hasHerramientaError(field: string, error: string): boolean {
        const c = this.herramientaForm.get(field);
        return !!(c?.hasError(error) && c?.touched);
    }

    /* ════════ Acciones ════════ */
    agregarHerramienta(): void {
        this.herramientaForm.markAllAsTouched();
        if (this.herramientaForm.invalid) {
            this.snackBar.open('Complete los campos requeridos', 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-error'] });
            return;
        }
        const f = this.herramientaForm.value;
        const item: HerramientaItem = {
            ...f,
            pn:                   f.pn.toUpperCase(),
            codigoBoa:            f.codigoBoa.toUpperCase(),
            intervaloCalibracion: f.requiereCalibracion ? f.intervaloCalibracion : null,
            fechaCalibracion:     f.requiereCalibracion ? f.fechaCalibracion     : null,
            nroCertificado:       f.requiereCalibracion ? f.nroCertificado       : '',
            imagen:               this.herramientaImagen() || null
        };
        const result: RecepcionHerramientaResult = { action: this.isEditMode ? 'actualizar' : 'agregar', data: item };
        this.dialogRef?.close(result);
    }

    cerrarModalHerramienta(): void { this.dialogRef?.close(); }
}
