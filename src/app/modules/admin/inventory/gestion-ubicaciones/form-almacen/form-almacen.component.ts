import { Component, OnInit, inject, signal, computed, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { switchMap } from 'rxjs/operators';

import { Warehouse, Oficina } from '../interfaces';
import { GestionUbicacionesService } from '../gestion-ubicaciones.service';

type DialogMode = 'new' | 'edit' | 'view';

@Component({
    selector: 'app-form-almacen',
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
    templateUrl: './form-almacen.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
    `]
})
export class FormAlmacenComponent implements OnInit {
    dialogRef = inject(MatDialogRef<FormAlmacenComponent>);
    private fb       = inject(FormBuilder);
    private dialog   = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private svc      = inject(GestionUbicacionesService);
    private data     = inject<{ mode: DialogMode; almacen?: Warehouse }>(MAT_DIALOG_DATA);

    mode: DialogMode = this.data?.mode ?? 'new';

    basesAeronauticas = signal<any[]>([]);
    oficinas          = signal<Oficina[]>([]);
    ofiSearch         = signal('');
    tipoDropOpen      = signal(false);
    saving            = signal(false);

    // ── Picker Base + Oficina (mini ventana / MatDialog anidado) ─────────
    @ViewChild('baseOficinaPickerTpl') baseOficinaPickerTpl!: TemplateRef<any>;
    private pickerRef: MatDialogRef<any> | null = null;
    pickerOpen   = signal(false);
    showBaseGrid = signal(true);

    tipos = ['Principal', 'Secundario'];

    oficinasFiltered = computed(() => {
        const q = this.ofiSearch().toLowerCase().trim();
        if (!q) return this.oficinas();
        return this.oficinas().filter(o =>
            o.nombre_oficina.toLowerCase().includes(q)
        );
    });

    form: FormGroup = this.fb.group({
        id_lugar:    [null, Validators.required],
        codigo:      ['',   Validators.maxLength(40)],
        nombre:      ['',   [Validators.required, Validators.maxLength(120)]],
        ciudad:      ['',   Validators.required],
        id_oficina:  [null, Validators.required],
        tipo:        ['Principal', Validators.required],
        estado:      ['ACTIVO',    Validators.required],
        descripcion: [''],
    });

    ngOnInit(): void {
        if (this.mode === 'view' && this.data?.almacen?.id_oficina != null && this.data.almacen.nombreOficina) {
            this.oficinas.set([{ id_oficina: this.data.almacen.id_oficina as number, nombre_oficina: this.data.almacen.nombreOficina }]);
        }
        this.cargarCatalogos();
        this.inicializarFormulario();
        this.escucharCambioBase();
    }

    private cargarCatalogos(): void {
        this.svc.getBasesAeronauticas().subscribe({
            next: (resp: any) => this.basesAeronauticas.set(resp?.datos || resp?.data || []),
            error: () => this.mostrarError('Error al cargar bases aeronáuticas')
        });

        const idLugarInicial = this.data?.almacen?.id_lugar;
        if (this.mode !== 'view' && idLugarInicial != null) {
            this.cargarOficinas(Number(idLugarInicial));
        }
    }

    private cargarOficinas(idLugar: number | null): void {
        this.svc.getOficinas(idLugar).subscribe({
            next: (oficinas: Oficina[]) => this.oficinas.set(oficinas ?? []),
            error: () => this.mostrarError('Error al cargar catálogo de oficinas')
        });
    }

    /** Al cambiar la Base Aeronáutica, autocompleta la ciudad, recarga las oficinas de esa base y limpia la oficina ya seleccionada */
    private escucharCambioBase(): void {
        if (this.readOnly) return;
        this.form.get('id_lugar')?.valueChanges.subscribe((idLugar) => {
            const id = idLugar != null && idLugar !== '' ? Number(idLugar) : null;
            const base = id != null ? this.basesAeronauticas().find(b => Number(b.id_lugar) === id) : null;

            this.form.patchValue({ id_oficina: null, ciudad: base?.nombre ?? '' }, { emitEvent: false });
            this.ofiSearch.set('');
            this.oficinas.set([]);
            if (id != null) {
                this.cargarOficinas(id);
            }
        });
    }

    private inicializarFormulario(): void {
        if (this.data?.almacen) {
            const a = this.data.almacen;
            this.form.patchValue({
                id_lugar:    a.id_lugar,
                codigo:      a.codigo,
                nombre:      a.nombre,
                ciudad:      a.ciudad,
                id_oficina:  a.id_oficina,
                tipo:        a.tipo,
                estado:      a.estado,
                descripcion: a.descripcion ?? '',
            });
            this.showBaseGrid.set(false);
        }
        if (this.readOnly) {
            this.form.disable();
        }
    }

    get titulo(): string {
        return this.mode === 'new'  ? 'Nuevo Almacén'
            : this.mode === 'edit' ? 'Editar Almacén'
                :                        'Detalle del Almacén';
    }

    get subtitulo(): string {
        return this.mode === 'new'  ? 'Registro en el sistema'
            : this.mode === 'edit' ? 'Modificación de datos'
                :                        'Información de solo lectura';
    }

    get readOnly(): boolean { return this.mode === 'view'; }

    get selectedBase(): any {
        const id = this.form.get('id_lugar')?.value;
        if (id == null || id === '') return null;
        return this.basesAeronauticas().find(b => Number(b.id_lugar) === Number(id)) ?? null;
    }

    get selectedBaseCode(): string { return this.selectedBase?.codigo ?? ''; }
    get selectedBaseName(): string { return this.selectedBase?.nombre ?? ''; }

    get nombreBasePreview(): string {
        const b = this.selectedBase;
        return b ? `${b.nombre} (${b.codigo})` : '';
    }

    get nombreOficinaPreview(): string {
        const id = this.form.get('id_oficina')?.value;
        if (id == null || id === '') return '';
        return this.oficinas().find(o => Number(o.id_oficina) === Number(id))?.nombre_oficina ?? '';
    }

    /** Etiqueta combinada Base › Oficina para el campo único */
    get baseOficinaLabel(): string {
        if (!this.nombreBasePreview) return '';
        return this.nombreOficinaPreview
            ? `${this.nombreBasePreview} › ${this.nombreOficinaPreview}`
            : this.nombreBasePreview;
    }

    /** Código a mostrar en el trigger: el ya generado, o un hint mientras no se guarda */
    get codigoDisplay(): string {
        const c = this.form.get('codigo')?.value;
        if (c) return c;
        return this.mode === 'new' ? 'Se genera al guardar' : '—';
    }

    hasError(field: string, error: string): boolean {
        const c = this.form.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    toggleEstado() {
        if (this.readOnly) return;
        const cur = this.form.get('estado')?.value;
        this.form.patchValue({ estado: cur === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' });
    }

    // ── Picker Base + Oficina ──────────────────────────────────────────
    openBaseOficinaPicker(): void {
        if (this.readOnly) return;
        if (this.pickerRef) { this.closeBaseOficinaPicker(); return; }

        this.showBaseGrid.set(!this.form.get('id_lugar')?.value);
        this.ofiSearch.set('');
        this.pickerOpen.set(true);
        this.pickerRef = this.dialog.open(this.baseOficinaPickerTpl, {
            width: 'min(380px, 94vw)',
            maxHeight: '86vh',
            panelClass: 'no-padding-dialog',
            hasBackdrop: true,
            autoFocus: false,
        });
        this.pickerRef.afterClosed().subscribe(() => {
            this.pickerRef = null;
            this.pickerOpen.set(false);
        });
    }

    closeBaseOficinaPicker(): void {
        this.pickerRef?.close();
    }

    toggleBaseGrid(): void { this.showBaseGrid.set(!this.showBaseGrid()); }

    selectBaseInPicker(base: any): void {
        if (this.form.get('id_lugar')?.value === base.id_lugar) { this.showBaseGrid.set(false); return; }
        this.form.patchValue({ id_lugar: base.id_lugar });
        this.showBaseGrid.set(false);
    }

    selectOficinaInPicker(o: Oficina): void {
        this.form.patchValue({ id_oficina: o.id_oficina });
        this.ofiSearch.set('');
        this.closeBaseOficinaPicker();
    }

    clearBaseOficina(): void {
        this.form.patchValue({ id_lugar: null, id_oficina: null, ciudad: '' });
        this.showBaseGrid.set(true);
    }

    save() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.snackBar.open('Complete los campos requeridos', 'Cerrar', { duration: 2500 });
            return;
        }

        const v = this.form.getRawValue();
        const buildPayload = (codigo: string): Warehouse => ({
            id:            this.data.almacen?.id ?? 0,
            id_lugar:      Number(v.id_lugar),
            codigo,
            nombre:        v.nombre.trim(),
            ciudad:        v.ciudad,
            id_oficina:    Number(v.id_oficina),
            nombreOficina: this.nombreOficinaPreview,
            tipo:          v.tipo,
            estado:        v.estado,
            descripcion:   v.descripcion?.trim() || undefined,
        });

        this.saving.set(true);

        // El código correlativo (ALM-<BASE>-NNNN) se genera recién al guardar, no al
        // elegir la base, para no "quemar" números del contador si el usuario cambia
        // de opinión o cancela el formulario (mismo criterio que KitsService.getNextKitCode()).
        const req$ = this.mode === 'new'
            ? this.svc.getNextWarehouseCode(this.selectedBaseCode).pipe(
                  switchMap(codigo => this.svc.insertWarehouse(buildPayload(codigo)))
              )
            : this.svc.updateWarehouse(buildPayload(v.codigo));

        req$.subscribe({
            next: (resp: any) => {
                this.saving.set(false);
                if (!resp || resp.tipoRespuesta === 'error' || resp.tipoRespuesta === 'ERROR') {
                    this.mostrarError(resp?.mensaje || 'Error al guardar cambios');
                    return;
                }
                this.snackBar.open(
                    this.mode === 'new' ? 'Almacén creado' : 'Almacén actualizado',
                    'Cerrar', { duration: 2500 }
                );
                this.dialogRef.close(true);
            },
            error: (err) => {
                this.saving.set(false);
                console.error('Error guardando almacén', err);
                this.mostrarError(this.mode === 'new' ? 'Error al generar código o guardar el almacén' : 'Error crítico al conectar con el servidor');
            },
        });
    }

    private mostrarError(msg: string): void {
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
    }
}
