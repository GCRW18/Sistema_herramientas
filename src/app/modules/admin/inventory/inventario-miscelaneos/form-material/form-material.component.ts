import { Component, OnInit, OnDestroy, inject, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, of, forkJoin } from 'rxjs';
import { catchError, finalize, map, takeUntil } from 'rxjs/operators';

import { Material, DialogMode } from '../interfaces';
import { GestionUbicacionesService } from '../../gestion-ubicaciones/gestion-ubicaciones.service';
import { Warehouse, Rack, Level } from '../../gestion-ubicaciones/interfaces';
import { localDateStr } from '../../../../../core/utils/date.utils';

@Component({
    selector: 'app-form-material',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatIconModule,
        MatSnackBarModule,
        MatTooltipModule,
        DragDropModule,
    ],
    templateUrl: './form-material.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
        .neo-scrollbar::-webkit-scrollbar { width: 6px; }
        .neo-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .neo-scrollbar::-webkit-scrollbar-thumb { background: #0F172A; border: 1px solid #000; border-radius: 3px; }
        /* Modo "Detalle del Ítem" (readOnly): todo el form queda disabled, pero el texto debe
           leerse como un detalle normal, no como un campo apagado — se fuerza negro/blanco por
           encima del gris de "input:disabled" del navegador y de las clases text-stone-400. */
        .readonly-detail input:disabled,
        .readonly-detail select:disabled,
        .readonly-detail textarea:disabled {
            color: #000 !important;
            -webkit-text-fill-color: #000 !important;
            opacity: 1 !important;
        }
        :host-context(.dark) .readonly-detail input:disabled,
        :host-context(.dark) .readonly-detail select:disabled,
        :host-context(.dark) .readonly-detail textarea:disabled {
            color: #fff !important;
            -webkit-text-fill-color: #fff !important;
        }
    `]
})
export class FormMaterialComponent implements OnInit, OnDestroy {
    dialogRef      = inject(MatDialogRef<FormMaterialComponent>);
    private fb             = inject(FormBuilder);
    private snackBar       = inject(MatSnackBar);
    private data           = inject<{ mode: DialogMode; material?: Material }>(MAT_DIALOG_DATA);
    private ubicSvc        = inject(GestionUbicacionesService);
    private dialog          = inject(MatDialog);

    mode: DialogMode = this.data?.mode ?? 'new';

    private _destroy$   = new Subject<void>();

    tiposItem   = ['CONSUMIBLE', 'MATERIAL', 'REPUESTO', 'QUIMICO', 'ELECTRICO'];
    tiposCompra = ['COMPRA DIRECTA', 'LICITACIÓN', 'DONACIÓN', 'TRANSFERENCIA'];
    unidades    = ['UND', 'LT', 'KG', 'MTS', 'GAL', 'CAJA', 'ROLLO', 'JUEGO'];

    // ── Picker de ubicación (mini ventana / MatDialog anidado) ──
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

    get racks():  Rack[]  { return this.racksFull; }
    get levels(): Level[] { return (this.selRack as any)?.niveles ?? []; }

    form: FormGroup = this.fb.group({
        codigoBoaM: ['', [Validators.maxLength(40)]],
        producto:   ['', [Validators.required, Validators.maxLength(200)]],
        tipoItem:   ['CONSUMIBLE', Validators.required],
        tipoCompra: ['COMPRA DIRECTA', Validators.required],
        marca:      [''],
        pn:         [''],
        unidad:     ['UND', Validators.required],
        stock:      [0, [Validators.required, Validators.min(0)]],
        stockMin:   [0, Validators.min(0)],
        stockMax:   [0, Validators.min(0)],
        ubicacion:  [''],
        activo:     [true],
        recibidoPor:[''],
        fecha:      [localDateStr()],
        hora:       [new Date().toTimeString().slice(0, 5)],
        fechaAdquisicion: [''],
        observacion:[''],
    });

    ngOnInit(): void {
        if (this.data?.material) {
            const mat = this.data.material;
            // Asegura que el valor guardado en BD esté en la lista de opciones (evita que el
            // <select> nativo se resetee al primer valor si el guardado no está predefinido).
            if (mat.unidad    && !this.unidades.includes(mat.unidad))       this.unidades    = [mat.unidad,    ...this.unidades];
            if (mat.tipoItem  && !this.tiposItem.includes(mat.tipoItem))    this.tiposItem   = [mat.tipoItem,  ...this.tiposItem];
            if (mat.tipoCompra && !this.tiposCompra.includes(mat.tipoCompra)) this.tiposCompra = [mat.tipoCompra, ...this.tiposCompra];
            this.form.patchValue(mat);
            if (this.mode === 'edit') this.prefillUbicacion(mat);
        }
        // usr_reg, fecha_reg are set by the pxp-framework — the API has no parameter to update them
        this.form.get('recibidoPor')?.disable();
        this.form.get('fecha')?.disable();
        this.form.get('hora')?.disable();
        // El código es siempre generado por el servidor (correlativo BOA-M-NNN al crear,
        // ver HE_MIS_INS) — nunca lo escribe el usuario, ni en alta ni en edición.
        this.form.get('codigoBoaM')?.disable();
        if (this.readOnly) {
            this.form.disable();
        }
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    /**
     * En edición, precarga almacén/estante/nivel actuales del material para mostrar la ubicación
     * vigente y detectar si el usuario la cambia al guardar (ver save()).
     */
    private prefillUbicacion(mat: Material): void {
        const warehouseId = mat.warehouseId ?? null;
        const rackId      = mat.rackId      ?? null;
        const levelId     = mat.levelId     ?? null;
        if (!warehouseId || !rackId || !levelId) return;

        this.loadingWarehouses = true;
        this.ubicSvc.getWarehouses().pipe(
            finalize(() => this.loadingWarehouses = false),
            takeUntil(this._destroy$)
        ).subscribe(ws => {
            const activos = ws.filter(w => w.estado === 'ACTIVO');
            // El picker solo ofrece almacenes de Cbb, pero el almacén actual del ítem se busca
            // en la lista completa (por si viniera de datos legado con otra base).
            this.warehouses = this._soloCbba(activos);
            const wh = activos.find(w => w.id === warehouseId);
            if (!wh) return;
            this.selWarehouse = wh;
            this.loadingRacks = true;
            this._cargarRacksDeAlmacen(wh).pipe(
                finalize(() => this.loadingRacks = false),
                takeUntil(this._destroy$)
            ).subscribe(rs => {
                this.racksFull = rs;
                const rack = this.racksFull.find(r => r.id === rackId);
                if (rack) {
                    this.selRack         = rack;
                    this.selectedLevelId = levelId;
                }
            });
        });
    }

    // ── Picker de ubicación (mini ventana) ──────────────────────
    openUbicacionPicker(): void {
        if (this.ubicacionPickerRef) { this.closeUbicacionPicker(); return; }

        if (!this.warehouses.length) {
            this.loadingWarehouses = true;
            this.ubicSvc.getWarehouses().pipe(
                finalize(() => this.loadingWarehouses = false),
                takeUntil(this._destroy$)
            ).subscribe(ws => {
                this.warehouses = this._soloCbba(ws.filter(w => w.estado === 'ACTIVO'));
                if (!this.selWarehouse && this.warehouses.length === 1) {
                    this.selectWarehouse(this.warehouses[0]);
                }
            });
        }

        this.pickerExpanded    = true;
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
        this.selWarehouse    = w;
        this.selRack         = null;
        this.selectedLevelId = null;
        this.racksFull       = [];
        this.showAlmacenGrid = false;
        this.loadingRacks    = true;
        this._cargarRacksDeAlmacen(w).pipe(
            finalize(() => this.loadingRacks = false),
            takeUntil(this._destroy$)
        ).subscribe(rs => { this.racksFull = rs; });
    }

    // Únicos almacenes con estantes/niveles cargados: los de Cochabamba (DAT-12).
    // Mismo criterio que gestionar-kit.component.ts.
    private _soloCbba(ws: Warehouse[]): Warehouse[] {
        return ws.filter(w => w.codigo?.startsWith('ALM-CBB'));
    }

    /**
     * 2 requests fijos (racks + niveles de TODO el almacén) en vez de 1+N (un getLevels por
     * rack) — mismo fix ya aplicado en gestionar-kit.component.ts y gestion-estantes.component.ts.
     */
    private _cargarRacksDeAlmacen(w: Warehouse) {
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

    selectRack(r: Rack): void {
        this.selRack         = r;
        this.selectedLevelId = null;
    }

    selectLevel(l: Level): void {
        this.selectedLevelId = l.id;
        const etiqueta = `${this.selWarehouse!.nombre} › ${this.selRack!.nombre} › ${l.nombre}`;
        this.form.patchValue({ ubicacion: etiqueta });
        this.closeUbicacionPicker();
    }

    clearUbicacion(): void {
        this.form.patchValue({ ubicacion: '' });
        this.selWarehouse    = null;
        this.selRack         = null;
        this.racksFull       = [];
        this.selectedLevelId = null;
        this.closeUbicacionPicker();
    }

    // ── Getters / helpers ──────────────────────────────────────
    get titulo(): string {
        return this.mode === 'new'  ? 'Nuevo Ítem de Catálogo'
             : this.mode === 'edit' ? 'Editar Ítem'
             :                        'Detalle del Ítem';
    }

    get subtitulo(): string {
        return this.mode === 'new'  ? 'Registro en catálogo misceláneos'
             : this.mode === 'edit' ? 'Modificación de datos del ítem'
             :                        'Información de solo lectura';
    }

    get readOnly(): boolean { return this.mode === 'view'; }

    hasError(field: string, error: string): boolean {
        const c = this.form.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    save(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.snackBar.open('Complete los campos requeridos', 'Cerrar', { duration: 2500 });
            return;
        }
        const v = this.form.getRawValue();
        const out: Partial<Material> = {
            ...(this.data.material ?? {}),
            codigoBoaM:  v.codigoBoaM.trim().toUpperCase(),
            producto:    v.producto.trim(),
            tipoItem:    v.tipoItem   || 'CONSUMIBLE',
            tipoCompra:  v.tipoCompra || 'COMPRA DIRECTA',
            marca:       v.marca?.trim()      || '',
            pn:          v.pn?.trim()         || '',
            unidad:      v.unidad?.trim()       || 'UND',
            stock:       Number(v.stock)      || 0,
            stockMin:    Number(v.stockMin)   || 0,
            stockMax:    Number(v.stockMax)   || 0,
            ubicacion:   v.ubicacion?.trim()  || '',
            activo:      v.activo,
            recibidoPor: v.recibidoPor?.trim() || '',
            fecha:       v.fecha,
            hora:        v.hora,
            fechaAdquisicion: v.fechaAdquisicion || '',
            observacion: v.observacion?.trim() || undefined,
            warehouseId: this.selWarehouse?.id   ?? null,
            rackId:      this.selRack?.id        ?? null,
            levelId:     this.selectedLevelId    ?? null,
        };
        this.dialogRef.close(out);
    }
}
