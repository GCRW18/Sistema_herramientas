import { Component, OnInit, OnDestroy, inject, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, of, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize, map, takeUntil } from 'rxjs/operators';

import { Material, DialogMode } from '../interfaces';
import { GestionUbicacionesService } from '../../gestion-ubicaciones/gestion-ubicaciones.service';
import { Warehouse, Rack, Level } from '../../gestion-ubicaciones/interfaces';
import { MovementService } from '../../../../../core/services/movement.service';

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
    `]
})
export class FormMaterialComponent implements OnInit, OnDestroy {
    dialogRef      = inject(MatDialogRef<FormMaterialComponent>);
    private fb             = inject(FormBuilder);
    private snackBar       = inject(MatSnackBar);
    private data           = inject<{ mode: DialogMode; material?: Material }>(MAT_DIALOG_DATA);
    private ubicSvc        = inject(GestionUbicacionesService);
    private movementService= inject(MovementService);
    private dialog          = inject(MatDialog);

    mode: DialogMode = this.data?.mode ?? 'new';

    private _destroy$   = new Subject<void>();
    private _reqSearch$ = new Subject<string>();

    tiposItem   = ['CONSUMIBLE', 'MATERIAL', 'REPUESTO', 'QUIMICO', 'ELECTRICO'];
    tiposCompra = ['COMPRA DIRECTA', 'LICITACIÓN', 'DONACIÓN', 'TRANSFERENCIA'];
    unidades    = ['UND', 'LT', 'KG', 'MTS', 'GAL', 'CAJA', 'ROLLO', 'JUEGO'];

    // ── Picker de ubicación (mini ventana / MatDialog anidado) ──
    @ViewChild('ubicacionPickerTpl') ubicacionPickerTpl!: TemplateRef<any>;
    private ubicacionPickerRef: MatDialogRef<any> | null = null;
    pickerExpanded    = false;
    showAlmacenGrid   = false;
    showNivelDropdown = false;
    loadingWarehouses = false;
    loadingRacks      = false;
    warehouses:   Warehouse[] = [];
    racksFull:    Rack[]      = [];
    selWarehouse: Warehouse | null = null;
    selRack:      Rack | null      = null;
    selectedLevelId: number | null = null;

    get racks():  Rack[]  { return this.racksFull; }
    get levels(): Level[] { return (this.selRack as any)?.niveles ?? []; }

    // ── Funcionario autocomplete ───────────────────────────────
    funcionarioSuggestions: any[] = [];
    funcionarioLoading            = false;
    showFuncionarioSuggestions    = false;

    form: FormGroup = this.fb.group({
        codigoBoaM: ['', [Validators.required, Validators.maxLength(40)]],
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
        fecha:      [new Date().toISOString().split('T')[0]],
        hora:       [new Date().toTimeString().slice(0, 5)],
        observacion:[''],
    });

    ngOnInit(): void {
        if (this.data?.material) {
            const mat = this.data.material;
            // Asegurar que el valor actual de la BD esté en la lista de opciones
            // Esto previene que el native <select> resetee al primer valor si el valor guardado
            // no está en la lista predefinida (ej: valor con espacios, nuevo tipo, etc.)
            if (mat.unidad    && !this.unidades.includes(mat.unidad))       this.unidades    = [mat.unidad,    ...this.unidades];
            if (mat.tipoItem  && !this.tiposItem.includes(mat.tipoItem))    this.tiposItem   = [mat.tipoItem,  ...this.tiposItem];
            if (mat.tipoCompra && !this.tiposCompra.includes(mat.tipoCompra)) this.tiposCompra = [mat.tipoCompra, ...this.tiposCompra];
            this.form.patchValue(mat);
        }
        // usr_reg, fecha_reg are set by the pxp-framework — the API has no parameter to update them
        this.form.get('recibidoPor')?.disable();
        this.form.get('fecha')?.disable();
        this.form.get('hora')?.disable();
        // El código es inmutable una vez creado (identificador único del ítem)
        if (this.mode === 'edit') {
            this.form.get('codigoBoaM')?.disable();
        }
        if (this.readOnly) {
            this.form.disable();
        }
        this._setupFuncionarioSearch();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    // ── Funcionarios ───────────────────────────────────────────
    private _setupFuncionarioSearch(): void {
        this._reqSearch$.pipe(
            debounceTime(200),
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
                    map(lista => lista.filter(f => {
                        const texto = [
                            f.nombreCompleto,
                            f.nombre,
                            f.apellido_paterno,
                            f.apellido_materno,
                        ].filter(Boolean).join(' ').toLowerCase();
                        return texto.includes(q);
                    }).slice(0, 10)),
                    finalize(() => this.funcionarioLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this._destroy$)
        ).subscribe(lista => {
            this.funcionarioSuggestions     = lista;
            this.showFuncionarioSuggestions = lista.length > 0;
        });
    }

    onFuncionarioInput(event: Event): void {
        this._reqSearch$.next((event.target as HTMLInputElement).value);
    }

    seleccionarFuncionario(f: any): void {
        this.form.get('recibidoPor')?.setValue(f.nombreCompleto ?? f.nombre ?? f.full_name ?? '');
        this.showFuncionarioSuggestions = false;
        this.funcionarioSuggestions    = [];
    }

    ocultarFuncionarios(): void {
        setTimeout(() => this.showFuncionarioSuggestions = false, 150);
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
                this.warehouses = ws.filter(w => w.estado === 'ACTIVO');
                if (!this.selWarehouse) {
                    const cbba = this.warehouses.find(w =>
                        w.ciudad?.toLowerCase().includes('cochabamba') ||
                        w.nombre?.toLowerCase().includes('cochabamba')
                    );
                    if (cbba) this.selectWarehouse(cbba);
                }
            });
        }

        this.pickerExpanded    = true;
        this.ubicacionPickerRef = this.dialog.open(this.ubicacionPickerTpl, {
            width: 'min(380px, 94vw)',
            maxHeight: '86vh',
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

    toggleAlmacenGrid():   void { this.showAlmacenGrid   = !this.showAlmacenGrid; }
    toggleNivelDropdown(): void { this.showNivelDropdown = !this.showNivelDropdown; }

    levelSeleccionado(): Level | null {
        return this.levels.find(l => l.id === this.selectedLevelId) ?? null;
    }

    selectWarehouse(w: Warehouse): void {
        if (this.selWarehouse?.id === w.id) { this.showAlmacenGrid = false; return; }
        this.selWarehouse    = w;
        this.selRack         = null;
        this.selectedLevelId = null;
        this.racksFull       = [];
        this.showAlmacenGrid    = false;
        this.showNivelDropdown  = false;
        this.loadingRacks       = true;
        this.ubicSvc.getRacks(w.id).pipe(
            switchMap(rs => {
                const activos = rs.filter(r => r.activo);
                if (!activos.length) return of([] as Rack[]);
                return forkJoin(activos.map(r =>
                    this.ubicSvc.getLevels(r.id).pipe(
                        map(ls => ({ ...r, niveles: ls.filter(l => l.activo && !l.isFloor) })),
                        catchError(() => of({ ...r, niveles: [] as Level[] }))
                    )
                ));
            }),
            finalize(() => this.loadingRacks = false),
            takeUntil(this._destroy$)
        ).subscribe(rs => { this.racksFull = rs as Rack[]; });
    }

    selectRack(r: Rack): void {
        this.selRack         = r;
        this.selectedLevelId = null;
        this.showNivelDropdown = false;
    }

    selectLevel(l: Level): void {
        this.selectedLevelId = l.id;
        const etiqueta = `${this.selWarehouse!.nombre} › ${this.selRack!.nombre} › ${l.nombre}`;
        this.form.patchValue({ ubicacion: etiqueta });
        this.showNivelDropdown = false;
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
            observacion: v.observacion?.trim() || undefined,
        };
        this.dialogRef.close(out);
    }
}
