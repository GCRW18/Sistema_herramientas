import { Component, inject, signal, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap, map, catchError, finalize } from 'rxjs/operators';
import { ToolService } from '../../../../../core/services/tool.service';
import { GestionUbicacionesService } from '../../../inventory/gestion-ubicaciones/gestion-ubicaciones.service';
import { Warehouse, Rack, Level } from '../../../inventory/gestion-ubicaciones/interfaces';

interface HerramientaOption {
    id_tool:      number;
    codigo:       string;
    pn:           string;
    nombre:       string;
    marca:        string;
    tipo:         string;
    sn:           string;
    estado:       string;
    ubicacion:    string;
    um:           string;
    imagen?:      string;
    warehouse_id?: number;
    rack_id?:      number;
    level_id?:     number;
}

@Component({
    selector: 'app-detalle-herramienta',
    standalone: true,
    imports: [
        CommonModule, MatIconModule, MatDialogModule,
        MatTooltipModule, MatProgressSpinnerModule,
        FormsModule, ReactiveFormsModule, DragDropModule,
    ],
    templateUrl: './detalle-herramienta.component.html',
    styles: [`
        :host { display: block; width: 100%; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
    `]
})
export class DetalleHerramientaComponent implements OnInit, OnDestroy {
    public  dialogRef = inject(MatDialogRef<DetalleHerramientaComponent>, { optional: true });
    public  data      = inject(MAT_DIALOG_DATA, { optional: true });
    private fb        = inject(FormBuilder);
    private toolSvc   = inject(ToolService);
    private ubicSvc   = inject(GestionUbicacionesService);
    private dialog    = inject(MatDialog);
    private destroy$  = new Subject<void>();

    @ViewChild('ubicDialogTpl') ubicDialogTpl!: TemplateRef<any>;
    private ubicDialogRef: MatDialogRef<any> | null = null;

    /* ════════ Listas ════════ */
    tiposHerramienta = [
        { value: 'HERRAMIENTA',     label: 'Herramienta'              },
        { value: 'BANCO_PRUEBA',    label: 'Banco de Prueba'          },
        { value: 'CONSUMIBLE',      label: 'Consumible'               },
        { value: 'EQUIPO_MEDICION', label: 'Equipo de Medición'       },
        { value: 'EQUIPO_SOPORTE',  label: 'Equipo de Soporte Tierra' },
    ];

    estados = [
        { value: 'SERVICEABLE',    label: 'Serviceable'    },
        { value: 'UNSERVICEABLE',  label: 'Unserviceable'  },
        { value: 'EN_CALIBRACION', label: 'En Calibración' },
        { value: 'REPARACION',     label: 'En Reparación'  },
        { value: 'NUEVO',          label: 'Nuevo'          },
    ];

    unidades = [
        { value: 'UNIDAD', label: 'Unidad' }, { value: 'PAR',   label: 'Par'   },
        { value: 'JUEGO',  label: 'Juego'  }, { value: 'KIT',   label: 'Kit'   },
        { value: 'LITRO',  label: 'Litro'  }, { value: 'METRO', label: 'Metro' },
    ];

    /* ════════ Form ════════ */
    detalleForm!: FormGroup;
    isEditMode = signal<boolean>(false);
    imagenOriginal = signal<string | null>(null);
    imagenNueva    = signal<string | null>(null);

    /* ════════ Buscador header ════════ */
    buscarValue       = '';
    toolSuggestions:  HerramientaOption[] = [];
    showToolDropdown  = false;
    toolSearchLoading = false;
    private _search$  = new Subject<string>();

    /* ════════ Ubicación — picker inline ════════ */
    ubSelectedWarehouse: Warehouse | null = null;
    ubSelectedRack:      Rack     | null = null;
    ubSelectedLevel:     Level    | null = null;

    ubAlmacenes: Warehouse[] = [];
    ubRacks:     Rack[]      = [];
    ubLevels:    Level[]     = [];

    /** Lista completa (sin filtrar) para ubicar herramientas ya guardadas fuera de
     *  Cbba (datos legado) sin perder el auto-select al editar — ver _soloCbba(). */
    private _todosLosAlmacenes: Warehouse[] = [];

    loadingAlmacenes = false;
    loadingRacks     = false;
    loadingLevels    = false;

    showUbicacionPanel = false;
    showUbAlmacenGrid  = true;
    ubStep = 1;

    /* ════════ Lifecycle ════════ */
    ngOnInit(): void {
        this.detalleForm = this.fb.group({
            toolId:         [null],
            codigo:         ['', [Validators.required, Validators.maxLength(40)]],
            pn:             ['', [Validators.required, Validators.maxLength(60)]],
            sn:             [''],
            nombre:         ['', [Validators.required, Validators.maxLength(150)]],
            marca:          [''],
            tipo:           ['HERRAMIENTA'],
            cantidad:       [1,  [Validators.required, Validators.min(1)]],
            um:             ['UNIDAD', Validators.required],
            estado:         ['SERVICEABLE', Validators.required],
            nivelCriticidad:['B'],
            fabricacion:    ['INTERNACIONAL'],
            warehouseId:    [null],
            rackId:         [null],
            levelId:        [null],
            documento:      [''],
            observaciones:  [''],
            tipoAjuste:     [this.data?.tipoAjuste || 'INVENTARIO'],
        });

        if (this.data?.editItem) {
            this.isEditMode.set(true);
            this._loadEditData(this.data.editItem);
        }

        this._setupSearch();
        this._loadAlmacenes();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /* ════════ Búsqueda de herramientas ════════ */
    private _setupSearch(): void {
        this._search$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(term => {
                const q = term.trim();
                if (q.length < 2) { this.showToolDropdown = false; return of([]); }
                this.toolSearchLoading = true;
                return this.toolSvc.getTools({ query: q }).pipe(
                    map((tools: any[]) => tools.map(t => ({
                        id_tool:      t.id_tool,
                        codigo:       t.code            || '',
                        pn:           t.part_number     || '',
                        nombre:       t.name            || t.description || '',
                        marca:        t.brand           || '',
                        tipo:         t.tool_type       || t.category    || '',
                        sn:           t.serial_number   || '',
                        estado:       t.status          || '',
                        ubicacion:    t.location        || '',
                        um:           t.unit_of_measure || 'UNIDAD',
                        imagen:       t.image_url       || t.image_base64 || null,
                        warehouse_id: t.warehouse_id    ? Number(t.warehouse_id)  : null,
                        rack_id:      t.rack_id         ? Number(t.rack_id)       : null,
                        level_id:     t.level_id        ? Number(t.level_id)      : null,
                    } as HerramientaOption))),
                    catchError(() => of([])),
                    finalize(() => { this.toolSearchLoading = false; })
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(results => {
            this.toolSuggestions  = results as HerramientaOption[];
            this.showToolDropdown = this.toolSuggestions.length > 0;
        });
    }

    onBuscarInput(value: string): void {
        this.buscarValue = value;
        this._search$.next(value);
    }

    hideBuscarDropdown(): void { setTimeout(() => { this.showToolDropdown = false; }, 180); }

    seleccionarHerramienta(tool: HerramientaOption): void {
        this.buscarValue      = `${tool.codigo} · ${tool.nombre}`;
        this.showToolDropdown = false;
        this.detalleForm.patchValue({
            toolId: tool.id_tool,
            codigo: tool.codigo,
            pn:     tool.pn,
            sn:     tool.sn,
            nombre: tool.nombre,
            marca:  tool.marca,
            tipo:   this.tiposHerramienta.some(t => t.value === tool.tipo) ? tool.tipo : 'HERRAMIENTA',
            estado: this.estados.some(e => e.value === tool.estado) ? tool.estado : 'SERVICEABLE',
            um:     this.unidades.some(u => u.value === tool.um)    ? tool.um     : 'UNIDAD',
        });
        if (tool.imagen) this.imagenOriginal.set(tool.imagen);

        // Auto-seleccionar ubicación si el tool la trae (búsqueda contra la lista
        // completa, no la filtrada a Cbba: la herramienta puede estar en otra base
        // por datos legado y no queremos perder el dato al editar).
        if (tool.warehouse_id && this._todosLosAlmacenes.length > 0) {
            const w = this._todosLosAlmacenes.find(a => a.id === tool.warehouse_id);
            if (w) {
                this._autoSelectWarehouse(w, tool.rack_id, tool.level_id);
                return;
            }
        }
        // Si almacenes aún no cargaron, espera y reintenta
        if (tool.warehouse_id && this._todosLosAlmacenes.length === 0) {
            this._pendingAutoSelect = { wId: tool.warehouse_id, rId: tool.rack_id, lId: tool.level_id };
        }
    }

    private _pendingAutoSelect: { wId: number; rId: number | null | undefined; lId: number | null | undefined } | null = null;

    limpiarBuscar(): void {
        this.buscarValue      = '';
        this.toolSuggestions  = [];
        this.showToolDropdown = false;
        this.detalleForm.patchValue({
            toolId: null, codigo: '', pn: '', sn: '', nombre: '', marca: '',
            tipo: 'HERRAMIENTA', estado: 'SERVICEABLE', um: 'UNIDAD',
        });
        this.imagenOriginal.set(null);
    }

    /* ════════ Ubicación ════════ */
    private _loadAlmacenes(): void {
        this.loadingAlmacenes = true;
        this.ubicSvc.getWarehouses().pipe(
            takeUntil(this.destroy$),
            finalize(() => { this.loadingAlmacenes = false; })
        ).subscribe({
            next: warehouses => {
                this._todosLosAlmacenes = warehouses;
                // Solo almacenes de Cochabamba en el picker (mismo criterio que
                // Kits/Misceláneos); _todosLosAlmacenes conserva la lista completa
                // para ubicar herramientas ya guardadas fuera de Cbba (datos legado).
                this.ubAlmacenes = warehouses.filter(w => w.codigo?.startsWith('ALM-CBB'));
                if (this._pendingAutoSelect) {
                    const p = this._pendingAutoSelect;
                    this._pendingAutoSelect = null;
                    const w = warehouses.find(a => a.id === p.wId);
                    if (w) this._autoSelectWarehouse(w, p.rId, p.lId);
                }
            },
            error: () => {}
        });
    }

    private _autoSelectWarehouse(w: Warehouse, rId?: number | null, lId?: number | null): void {
        this.ubSelectedWarehouse = w;
        this.detalleForm.patchValue({ warehouseId: w.id });
        if (rId) {
            this.loadingRacks = true;
            this.ubicSvc.getRacks(w.id).pipe(
                takeUntil(this.destroy$),
                finalize(() => { this.loadingRacks = false; })
            ).subscribe({
                next: racks => {
                    this.ubRacks = racks;
                    const r = racks.find(x => x.id === rId);
                    if (r) {
                        this.ubSelectedRack = r;
                        this.detalleForm.patchValue({ rackId: r.id });
                        if (lId) {
                            this.loadingLevels = true;
                            this.ubicSvc.getLevels(r.id).pipe(
                                takeUntil(this.destroy$),
                                finalize(() => { this.loadingLevels = false; })
                            ).subscribe({
                                next: levels => {
                                    this.ubLevels = levels;
                                    const l = levels.find(x => x.id === lId);
                                    if (l) { this.ubSelectedLevel = l; this.detalleForm.patchValue({ levelId: l.id }); }
                                },
                                error: () => {}
                            });
                        }
                    }
                },
                error: () => {}
            });
        }
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
            this.ubicDialogRef     = null;
            this.showUbicacionPanel = false;
        });
    }

    closeUbicacionDialog(): void {
        this.ubicDialogRef?.close();
        this.ubicDialogRef     = null;
        this.showUbicacionPanel = false;
    }

    seleccionarAlmacen(w: Warehouse): void {
        this.ubSelectedWarehouse = w;
        this.ubSelectedRack      = null;
        this.ubSelectedLevel     = null;
        this.ubRacks             = [];
        this.ubLevels            = [];
        this.showUbAlmacenGrid   = false;
        this.detalleForm.patchValue({ warehouseId: w.id, rackId: null, levelId: null });
        this.ubStep = 2;
        this.loadingRacks = true;
        this.ubicSvc.getRacks(w.id).pipe(
            takeUntil(this.destroy$),
            finalize(() => { this.loadingRacks = false; })
        ).subscribe({ next: racks => { this.ubRacks = racks; }, error: () => {} });
    }

    seleccionarRack(r: Rack): void {
        this.ubSelectedRack  = r;
        this.ubSelectedLevel = null;
        this.ubLevels        = [];
        this.detalleForm.patchValue({ rackId: r.id, levelId: null });
        this.ubStep = 3;
        this.loadingLevels = true;
        this.ubicSvc.getLevels(r.id).pipe(
            takeUntil(this.destroy$),
            finalize(() => { this.loadingLevels = false; })
        ).subscribe({ next: levels => { this.ubLevels = levels; }, error: () => {} });
    }

    seleccionarLevel(l: Level): void {
        this.ubSelectedLevel = l;
        this.detalleForm.patchValue({ levelId: l.id });
        this.closeUbicacionDialog();
    }

    limpiarUbicacion(): void {
        this.ubSelectedWarehouse = null;
        this.ubSelectedRack      = null;
        this.ubSelectedLevel     = null;
        this.ubRacks             = [];
        this.ubLevels            = [];
        this.ubStep              = 1;
        this.showUbAlmacenGrid   = true;
        this.detalleForm.patchValue({ warehouseId: null, rackId: null, levelId: null });
    }

    volverAlmacen(): void  { this.ubSelectedRack = null; this.ubSelectedLevel = null; this.ubRacks = []; this.ubLevels = []; this.ubStep = 1; }
    volverEstante(): void  { this.ubSelectedLevel = null; this.ubLevels = []; this.ubStep = 2; }

    getUbicacionLabel(): string {
        if (!this.ubSelectedWarehouse) return 'Sin asignar';
        let label = this.ubSelectedWarehouse.codigo;
        if (this.ubSelectedRack)  label += ' → ' + this.ubSelectedRack.codigo;
        if (this.ubSelectedLevel) label += ' · ' + (this.ubSelectedLevel.isFloor ? 'Suelo' : 'N° ' + this.ubSelectedLevel.numero);
        return label;
    }

    /* ════════ Edición ════════ */
    private _loadEditData(item: any): void {
        this.buscarValue = item.codigoBoa ? `${item.codigoBoa} · ${item.descripcion}` : '';
        this.detalleForm.patchValue({
            toolId:          item.toolId,
            codigo:          item.codigoBoa    || '',
            pn:              item.pn           || '',
            sn:              item.sn           || '',
            nombre:          item.descripcion  || '',
            marca:           item.marca        || '',
            tipo:            item.tipo         || 'HERRAMIENTA',
            cantidad:        item.cantidad     || 1,
            um:              item.um           || 'UNIDAD',
            estado:          item.estado       || 'SERVICEABLE',
            nivelCriticidad: item.nivelCriticidad || 'B',
            fabricacion:     item.fabricacion  || 'INTERNACIONAL',
            warehouseId:     item.warehouseId  || null,
            rackId:          item.rackId       || null,
            levelId:         item.levelId      || null,
            documento:       item.documentos   || '',
            observaciones:   item.obs          || '',
            tipoAjuste:      item.tipoAjuste   || 'INVENTARIO',
        });
        if (item.imagenMaster) this.imagenOriginal.set(item.imagenMaster);
        if (item.imagenNueva)  this.imagenNueva.set(item.imagenNueva);

        if (item.warehouseId) {
            this._pendingAutoSelect = { wId: item.warehouseId, rId: item.rackId, lId: item.levelId };
        }
    }

    /* ════════ Foto ════════ */
    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { this.imagenNueva.set(reader.result as string); };
        reader.readAsDataURL(file);
    }

    /* ════════ Helpers ════════ */
    hasError(field: string, error: string): boolean {
        const c = this.detalleForm.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    /* ════════ Acciones ════════ */
    procesar(): void {
        this.detalleForm.markAllAsTouched();
        if (this.detalleForm.invalid) return;
        const v = this.detalleForm.getRawValue();
        const ubicacion = this.getUbicacionLabel() !== 'Sin asignar' ? this.getUbicacionLabel() : '';

        this.dialogRef?.close({
            action: 'procesar',
            data: {
                ...v,
                ubicacion,
                imagenMaster: this.imagenOriginal(),
                imagenNueva:  this.imagenNueva(),
            }
        });
    }

    cerrar(): void { this.dialogRef?.close(); }
}
