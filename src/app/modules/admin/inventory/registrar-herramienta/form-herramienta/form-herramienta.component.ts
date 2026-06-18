import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Herramienta } from '../interfaces';
import { GestionUbicacionesService } from '../../gestion-ubicaciones/gestion-ubicaciones.service';
import { Warehouse, Rack, Level } from '../../gestion-ubicaciones/interfaces';

type Mode = 'new' | 'edit' | 'view';
type TabKey = 'general' | 'calibracion' | 'consumibles' | 'misc';

@Component({
    selector: 'app-form-herramienta',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        MatDialogModule,
        MatIconModule,
        MatSnackBarModule,
        MatSlideToggleModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        DragDropModule,
    ],
    templateUrl: './form-herramienta.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
    `]
})
export class FormHerramientaComponent implements OnInit, OnDestroy {

    dialogRef     = inject(MatDialogRef<FormHerramientaComponent>);
    private fb    = inject(FormBuilder);
    private snack = inject(MatSnackBar);
    private data  = inject<{ mode: Mode; herramienta?: Herramienta }>(MAT_DIALOG_DATA);
    private ubicSvc = inject(GestionUbicacionesService);
    private _destroy$ = new Subject<void>();

    mode: Mode = this.data.mode;
    activeTab: TabKey = 'general';

    unidades   = ['UN', 'PAR', 'CAJA', 'JGO', 'KG', 'LT', 'MT', 'BOLSA', 'ROLLO'];
    estados    = ['NUEVO', 'USADO', 'EN_REPARACION', 'BAJA'];
    categorias: { value: 'general'|'consumible'|'miscelaneo'; label: string; icon: string }[] = [
        { value: 'general',    label: 'General',    icon: 'build' },
        { value: 'consumible', label: 'Consumible', icon: 'inventory_2' },
        { value: 'miscelaneo', label: 'Misceláneo', icon: 'category' },
    ];

    /* ════════ Ubicación — almacén ════════ */
    almacenes:          Warehouse[] = [];
    almacenesFiltrados: Warehouse[] = [];
    almacenSearch    = '';
    showAlmacenDD    = false;
    selectedWarehouse: Warehouse | null = null;
    loadingAlmacenes = false;

    /* ════════ Ubicación — estante ════════ */
    racks:            Rack[] = [];
    estantesFiltrados: Rack[] = [];
    estanteSearch    = '';
    showEstanteDD    = false;
    selectedRack: Rack | null = null;
    loadingRacks = false;

    /* ════════ Ubicación — nivel ════════ */
    levels: Level[] = [];
    loadingLevels = false;

    form!: FormGroup;

    ngOnInit() {
        this.form = this.fb.group({
            codigo:      ['', [Validators.required, Validators.maxLength(40)]],
            pn:          ['', [Validators.required, Validators.maxLength(60)]],
            sn:          [''],
            descripcion: ['', [Validators.required, Validators.maxLength(200)]],
            categoria:   ['general', Validators.required],
            cantidad:    [1, [Validators.required, Validators.min(1)]],
            unidad:      ['UN', Validators.required],
            estado:      ['NUEVO', Validators.required],
            warehouseId: [null],
            rackId:      [null],
            levelId:     [null],

            sujetaCalibracion:  [false],
            calFrecuenciaMeses: [12],
            calUltima:          [''],
            calProxima:         [''],
            calProveedor:       [''],
            calCertificado:     [''],

            stockMinimo:   [0],
            stockActual:   [0],
            unidadConsumo: ['UN'],

            notas: [''],
        });

        if (this.data.herramienta) {
            const h = this.data.herramienta;
            this.form.patchValue({
                codigo: h.codigo, pn: h.pn, sn: h.sn ?? '',
                descripcion: h.descripcion, categoria: h.categoria,
                cantidad: h.cantidad, unidad: h.unidad, estado: h.estado,
                warehouseId: h.warehouseId ?? null, rackId: h.rackId ?? null, levelId: h.levelId ?? null,
                sujetaCalibracion:  h.sujetaCalibracion,
                calFrecuenciaMeses: h.calibracion?.frecuenciaMeses ?? 12,
                calUltima:          h.calibracion?.ultimaCalibracion ?? '',
                calProxima:         h.calibracion?.proximaCalibracion ?? '',
                calProveedor:       h.calibracion?.proveedor ?? '',
                calCertificado:     h.calibracion?.certificado ?? '',
                stockMinimo:   h.consumible?.stockMinimo ?? 0,
                stockActual:   h.consumible?.stockActual ?? 0,
                unidadConsumo: h.consumible?.unidadConsumo ?? 'UN',
                notas: h.miscelaneo?.notas ?? '',
            });
        }

        this.applyCalibrationValidators(this.form.value.sujetaCalibracion);
        this.form.get('sujetaCalibracion')?.valueChanges
            .pipe(takeUntil(this._destroy$))
            .subscribe(v => this.applyCalibrationValidators(!!v));

        if (this.mode === 'view') this.form.disable();

        this._loadAlmacenes();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    /* ════════ Carga inicial ════════ */

    private _loadAlmacenes(): void {
        this.loadingAlmacenes = true;
        this.ubicSvc.getWarehouses()
            .pipe(takeUntil(this._destroy$))
            .subscribe({
                next: ws => {
                    this.almacenes = ws;
                    this.almacenesFiltrados = ws;
                    // Restaurar selección si viene en edición
                    const wId = this.form.get('warehouseId')?.value;
                    if (wId) {
                        const found = ws.find(w => w.id === wId);
                        if (found) this._setWarehouse(found, false);
                    }
                },
                error: () => {},
                complete: () => { this.loadingAlmacenes = false; }
            });
    }

    /* ════════ Almacén buscador ════════ */

    onAlmacenInput(val: string): void {
        this.almacenSearch = val;
        const q = val.trim().toUpperCase();
        this.almacenesFiltrados = q
            ? this.almacenes.filter(w => w.codigo.toUpperCase().includes(q) || w.nombre.toUpperCase().includes(q))
            : this.almacenes;
        this.showAlmacenDD = this.almacenesFiltrados.length > 0;
    }

    hideAlmacenDD(): void {
        setTimeout(() => { this.showAlmacenDD = false; }, 180);
    }

    seleccionarAlmacen(w: Warehouse): void {
        this._setWarehouse(w, true);
        this.showAlmacenDD = false;
    }

    limpiarAlmacen(): void {
        this.selectedWarehouse = null;
        this.almacenSearch = '';
        this.selectedRack = null;
        this.estanteSearch = '';
        this.racks = [];
        this.estantesFiltrados = [];
        this.levels = [];
        this.form.patchValue({ warehouseId: null, rackId: null, levelId: null });
    }

    private _setWarehouse(w: Warehouse, loadRacks = true): void {
        this.selectedWarehouse = w;
        this.almacenSearch = `${w.codigo} · ${w.nombre}`;
        this.form.patchValue({ warehouseId: w.id, rackId: null, levelId: null });
        this.selectedRack = null;
        this.estanteSearch = '';
        this.levels = [];
        if (loadRacks) this._loadRacks(w.id);
    }

    /* ════════ Estante buscador ════════ */

    private _loadRacks(warehouseId: number): void {
        this.loadingRacks = true;
        this.racks = [];
        this.estantesFiltrados = [];
        this.ubicSvc.getRacks(warehouseId)
            .pipe(takeUntil(this._destroy$))
            .subscribe({
                next: rs => {
                    this.racks = rs;
                    this.estantesFiltrados = rs;
                    const rId = this.form.get('rackId')?.value;
                    if (rId) {
                        const found = rs.find(r => r.id === rId);
                        if (found) this._setRack(found, false);
                    }
                },
                error: () => {},
                complete: () => { this.loadingRacks = false; }
            });
    }

    onEstanteInput(val: string): void {
        this.estanteSearch = val;
        const q = val.trim().toUpperCase();
        this.estantesFiltrados = q
            ? this.racks.filter(r => r.codigo.toUpperCase().includes(q) || r.nombre.toUpperCase().includes(q))
            : this.racks;
        this.showEstanteDD = this.estantesFiltrados.length > 0;
    }

    hideEstanteDD(): void {
        setTimeout(() => { this.showEstanteDD = false; }, 180);
    }

    seleccionarEstante(r: Rack): void {
        this._setRack(r, true);
        this.showEstanteDD = false;
    }

    limpiarEstante(): void {
        this.selectedRack = null;
        this.estanteSearch = '';
        this.levels = [];
        this.form.patchValue({ rackId: null, levelId: null });
    }

    private _setRack(r: Rack, loadLevels = true): void {
        this.selectedRack = r;
        this.estanteSearch = `${r.codigo} · ${r.nombre}`;
        this.form.patchValue({ rackId: r.id, levelId: null });
        this.levels = [];
        if (loadLevels) this._loadLevels(r.id);
    }

    /* ════════ Niveles ════════ */

    private _loadLevels(rackId: number): void {
        this.loadingLevels = true;
        this.levels = [];
        this.ubicSvc.getLevels(rackId)
            .pipe(takeUntil(this._destroy$))
            .subscribe({
                next: ls => { this.levels = ls; },
                error: () => {},
                complete: () => { this.loadingLevels = false; }
            });
    }

    /* ════════ Calibración validators ════════ */

    private applyCalibrationValidators(active: boolean) {
        const fields = ['calFrecuenciaMeses', 'calProxima'] as const;
        fields.forEach(f => {
            const c = this.form.get(f);
            if (!c) return;
            if (active) {
                c.setValidators([Validators.required]);
                if (f === 'calFrecuenciaMeses') c.addValidators(Validators.min(1));
            } else {
                c.clearValidators();
            }
            c.updateValueAndValidity({ emitEvent: false });
        });
    }

    /* ════════ Getters ════════ */

    get titulo(): string {
        return this.mode === 'new'  ? 'Nueva Herramienta'
             : this.mode === 'edit' ? 'Editar Herramienta'
             :                        'Detalle de Herramienta';
    }

    get subtitulo(): string {
        return this.mode === 'new'  ? 'Registro en el inventario'
             : this.mode === 'edit' ? 'Modificación de datos'
             :                        'Información de solo lectura';
    }

    get readOnly(): boolean { return this.mode === 'view'; }

    hasError(field: string, error: string): boolean {
        const c = this.form?.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    get sujetaCalibracion(): boolean { return !!this.form?.value?.sujetaCalibracion; }
    get esConsumible():     boolean { return this.form?.value?.categoria === 'consumible'; }

    setTab(t: TabKey) { this.activeTab = t; }

    canShowTab(t: TabKey): boolean {
        if (t === 'calibracion') return this.sujetaCalibracion;
        if (t === 'consumibles') return this.esConsumible;
        return true;
    }

    /* ════════ Save ════════ */

    save() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.snack.open('Complete los campos requeridos en cada pestaña', 'Cerrar', { duration: 3000 });
            if (this.formHasErrorIn('general'))     this.activeTab = 'general';
            else if (this.formHasErrorIn('calibracion') && this.sujetaCalibracion) this.activeTab = 'calibracion';
            return;
        }

        const v = this.form.getRawValue();
        const out: Herramienta = {
            id:          this.data.herramienta?.id ?? 0,
            codigo:      v.codigo.trim(),
            pn:          v.pn.trim(),
            sn:          v.sn?.trim() || undefined,
            descripcion: v.descripcion.trim(),
            categoria:   v.categoria,
            cantidad:    Number(v.cantidad),
            unidad:      v.unidad,
            estado:      v.estado,
            warehouseId: v.warehouseId ?? undefined,
            rackId:      v.rackId ?? undefined,
            levelId:     v.levelId ?? undefined,
            sujetaCalibracion: !!v.sujetaCalibracion,
            calibracion: v.sujetaCalibracion ? {
                frecuenciaMeses:    Number(v.calFrecuenciaMeses),
                ultimaCalibracion:  v.calUltima  || undefined,
                proximaCalibracion: v.calProxima || undefined,
                proveedor:          v.calProveedor?.trim() || undefined,
                certificado:        v.calCertificado?.trim() || undefined,
            } : undefined,
            consumible: v.categoria === 'consumible' ? {
                stockMinimo:   Number(v.stockMinimo),
                stockActual:   Number(v.stockActual),
                unidadConsumo: v.unidadConsumo,
            } : undefined,
            miscelaneo: v.categoria === 'miscelaneo' ? {
                notas: v.notas?.trim() || undefined,
            } : undefined,
            fechaRegistro: this.data.herramienta?.fechaRegistro ?? (() => {
                const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })(),
        };

        this.dialogRef.close(out);
    }

    private formHasErrorIn(tab: TabKey): boolean {
        const groups: Record<TabKey, string[]> = {
            general:     ['codigo', 'pn', 'descripcion', 'categoria', 'cantidad', 'unidad', 'estado'],
            calibracion: ['calFrecuenciaMeses', 'calProxima'],
            consumibles: ['stockMinimo', 'stockActual'],
            misc:        [],
        };
        return groups[tab].some(f => this.form.get(f)?.invalid);
    }
}
