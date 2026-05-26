import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, of, lastValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil, map, catchError } from 'rxjs/operators';

import { MovementService }    from '../../../../../core/services/movement.service';
import { MiscelaneosService } from '../../../../../core/services/miscelaneos.service';
import { Salida, DialogMode, Material } from '../interfaces';

interface Funcionario { id: number; nombre: string; cargo: string; area?: string; }

interface LoteSalidaItem {
    material:  Material;
    cantidad:  number;
    status:    'pending' | 'saving' | 'done' | 'error';
    error?:    string;
    nroNota?:  string;
}

@Component({
    selector: 'app-form-salida',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatDialogModule, MatIconModule,
        MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule, DragDropModule,
    ],
    templateUrl: './form-salida.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ea580c; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #fb923c; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    `]
})
export class FormSalidaComponent implements OnInit, OnDestroy {

    dialogRef        = inject(MatDialogRef<FormSalidaComponent>);
    private snackBar = inject(MatSnackBar);
    private movSvc   = inject(MovementService);
    private svc      = inject(MiscelaneosService);
    private cdr      = inject(ChangeDetectorRef);
    private data     = inject<{ mode: DialogMode; salida?: Salida; materiales?: Material[] }>(MAT_DIALOG_DATA);

    mode: DialogMode = this.data?.mode ?? 'new';

    private _destroy$          = new Subject<void>();
    private _reqSearch$        = new Subject<string>();
    private _despachadoSearch$ = new Subject<string>();
    private _autorizadoSearch$ = new Subject<string>();

    // ── Campos compartidos ──────────────────────────────────
    fecha              = new Date().toISOString().split('T')[0];
    hora               = new Date().toTimeString().slice(0, 5);
    area               = '';
    funcionarioName    = '';
    funcionarioValue   = '';
    despachadoPorName  = '';
    despachadoPorValue = '';
    nroLicencia        = '';
    ordenTrabajo       = '';
    buscadorAeronave   = '';
    autorizadoName     = '';
    autorizadoValue    = '';
    observaciones      = '';
    camposTouched      = false;

    // ── Modo edición ────────────────────────────────────────
    editCantidad = 1;
    isSaving     = signal(false);

    // ── Lote (solo modo new) ────────────────────────────────
    items:         LoteSalidaItem[] = [];
    isProcessing   = signal(false);
    processedCount = 0;

    // ── Buscador de material ────────────────────────────────
    materiales:          Material[] = this.data?.materiales ?? [];
    materialSearch       = '';
    materialFiltrados:   Material[] = [];
    showMaterialDropdown = false;

    // ── Autocomplete Solicitante ────────────────────────────
    funcionarios:           Funcionario[] = [];
    funcionarioLoading      = false;
    showFuncionarioDropdown = false;

    // ── Autocomplete Despachado Por ─────────────────────────
    despachadoPorFuncionarios: Funcionario[] = [];
    despachadoPorLoading       = false;
    showDespachadoPorDropdown  = false;

    // ── Autocomplete Autorizado Por ─────────────────────────
    autorizadoFuncionarios: Funcionario[] = [];
    autorizadoLoading       = false;
    showAutorizadoDropdown  = false;

    // ── Vista ───────────────────────────────────────────────
    salidaView?: Salida;

    // ── Lifecycle ───────────────────────────────────────────
    ngOnInit(): void {
        if (this.data?.salida) {
            const s = this.data.salida;
            this.salidaView         = s;
            this.fecha              = s.fecha;
            this.hora               = s.hora               ?? '';
            this.area               = s.area               ?? '';
            this.funcionarioName    = s.nombre             ?? '';
            this.funcionarioValue   = s.nombre             ?? '';
            this.despachadoPorName  = s.despachadoPor      ?? '';
            this.despachadoPorValue = s.despachadoPor      ?? '';
            this.nroLicencia        = s.nroLicencia        ?? '';
            this.ordenTrabajo       = s.ordenTrabajo       ?? '';
            this.buscadorAeronave   = s.buscadorAeronave   ?? '';
            this.autorizadoName     = s.buscadorAutorizado ?? '';
            this.autorizadoValue    = s.buscadorAutorizado ?? '';
            this.observaciones      = s.observaciones      ?? '';
            this.editCantidad       = s.cantidad           ?? 1;
        }
        if (!this.readOnly) {
            this._setupFuncionarioSearch();
            this._setupDespachadoSearch();
            this._setupAutorizadoSearch();
        }
    }

    ngOnDestroy(): void { this._destroy$.next(); this._destroy$.complete(); }

    get readOnly(): boolean { return this.mode === 'view'; }
    get isEdit():   boolean { return this.mode === 'edit'; }

    get titulo(): string {
        if (this.mode === 'new')  return 'Nueva Salida de Material';
        if (this.mode === 'edit') return 'Editar Salida';
        return 'Detalle de Salida';
    }
    get subtitulo(): string {
        if (this.mode === 'new')  return 'Despacho de materiales del almacén';
        if (this.mode === 'edit') return `Editando: ${this.salidaView?.nroNota ?? ''}`;
        return 'Información de solo lectura';
    }

    // ── Lote ───────────────────────────────────────────────
    addItem(material: Material): void {
        if (this.items.some(i => i.material.id === material.id)) {
            this.snackBar.open(`${material.codigoBoaM} ya está en el lote`, 'OK', { duration: 2000 });
            return;
        }
        this.items.push({ material, cantidad: 1, status: 'pending' });
        this.materialSearch       = '';
        this.materialFiltrados    = [];
        this.showMaterialDropdown = false;
    }

    removeItem(index: number): void {
        if (!this.isProcessing()) this.items.splice(index, 1);
    }

    retryErrors(): void {
        this.items.filter(i => i.status === 'error').forEach(i => {
            i.status = 'pending';
            i.error  = undefined;
        });
    }

    get canSubmit(): boolean {
        return this.items.length > 0
            && !!this.fecha
            && !!this.funcionarioValue.trim()
            && !!this.despachadoPorValue.trim()
            && this.items.filter(i => i.status !== 'done').every(i => i.cantidad >= 1);
    }

    get doneCount():    number { return this.items.filter(i => i.status === 'done').length;    }
    get errorCount():   number { return this.items.filter(i => i.status === 'error').length;   }
    get pendingCount(): number { return this.items.filter(i => i.status === 'pending' || i.status === 'saving').length; }

    // ── Guardar edición ────────────────────────────────────
    async saveEdit(): Promise<void> {
        this.camposTouched = true;
        if (!this.fecha || !this.funcionarioValue.trim() || !this.despachadoPorValue.trim() || this.editCantidad < 1) {
            this.snackBar.open('Complete todos los campos requeridos', 'Cerrar', { duration: 2500 });
            return;
        }
        this.isSaving.set(true);
        try {
            await lastValueFrom(
                this.svc.editarSalida({
                    id:                 this.salidaView!.id,
                    cantidad:           this.editCantidad,
                    fecha:              this.fecha,
                    hora:               this.hora,
                    nombre:             this.funcionarioValue.trim(),
                    area:               this.area,
                    despachadoPor:      this.despachadoPorValue.trim(),
                    nroLicencia:        this.nroLicencia.trim()      || undefined,
                    ordenTrabajo:       this.ordenTrabajo.trim()     || undefined,
                    buscadorAeronave:   this.buscadorAeronave.trim() || undefined,
                    buscadorAutorizado: this.autorizadoValue.trim()  || undefined,
                    observaciones:      this.observaciones.trim()    || undefined,
                })
            );
            this.snackBar.open('Salida actualizada correctamente', 'OK', { duration: 3000 });
            this.dialogRef.close(true);
        } catch (err: any) {
            this.snackBar.open(err?.message ?? 'Error al actualizar', 'Cerrar', { duration: 4000 });
        } finally {
            this.isSaving.set(false);
        }
    }

    // ── Guardar lote ───────────────────────────────────────
    async save(): Promise<void> {
        this.camposTouched = true;
        if (!this.canSubmit) {
            this.snackBar.open(
                this.items.length === 0
                    ? 'Agregue al menos un material al lote'
                    : 'Complete todos los campos requeridos (solicitante, despachado por)',
                'Cerrar', { duration: 3000 }
            );
            return;
        }

        this.isProcessing.set(true);
        this.processedCount = 0;

        for (const item of this.items) {
            if (item.status === 'done') continue;

            if (item.material.stock < item.cantidad) {
                item.status = 'error';
                item.error  = `Stock insuficiente (disponible: ${item.material.stock} ${item.material.unidad})`;
                this.processedCount++;
                this.cdr.detectChanges();
                continue;
            }

            item.status = 'saving';
            this.cdr.detectChanges();

            try {
                const res = await lastValueFrom(
                    this.svc.registrarSalida({
                        miscelaneo_id:      item.material.id,
                        cantidad:           item.cantidad,
                        fecha:              this.fecha,
                        hora:               this.hora,
                        nombre:             this.funcionarioValue.trim(),
                        area:               this.area,
                        despachadoPor:      this.despachadoPorValue.trim(),
                        nroLicencia:        this.nroLicencia.trim()      || undefined,
                        ordenTrabajo:       this.ordenTrabajo.trim()     || undefined,
                        buscadorAeronave:   this.buscadorAeronave.trim() || undefined,
                        buscadorAutorizado: this.autorizadoValue.trim()  || undefined,
                        observaciones:      this.observaciones.trim()    || undefined,
                    })
                );
                item.status  = 'done';
                item.nroNota = res?.numero ?? '';
            } catch (err: any) {
                item.status = 'error';
                item.error  = err?.message ?? 'Error al registrar';
            }
            this.processedCount++;
            this.cdr.detectChanges();
        }

        this.isProcessing.set(false);

        if (this.errorCount === 0) {
            const notas = this.items.map(i => i.nroNota).filter(Boolean).join(', ');
            this.snackBar.open(`Salidas registradas${notas ? ': ' + notas : ''}`, 'OK', { duration: 3500 });
            setTimeout(() => this.dialogRef.close(true), 1200);
        } else {
            this.snackBar.open(`${this.errorCount} ítem(s) con error. Revise y reintente.`, 'OK', { duration: 4000 });
        }
    }

    // ── Buscador de material ────────────────────────────────
    onMaterialInput(val: string): void {
        this.materialSearch = val;
        const q = val.trim().toLowerCase();
        if (!q) { this.materialFiltrados = []; this.showMaterialDropdown = false; return; }
        this.materialFiltrados = this.materiales
            .filter(m => m.activo && (`${m.codigoBoaM} ${m.producto} ${m.pn} ${m.marca}`).toLowerCase().includes(q))
            .slice(0, 12);
        this.showMaterialDropdown = this.materialFiltrados.length > 0;
    }

    selectMaterial(m: Material): void { this.addItem(m); }
    hideMaterialDropdown(): void { setTimeout(() => this.showMaterialDropdown = false, 200); }

    // ── Helpers autocomplete ────────────────────────────────
    private _buildFuncionario(f: any): Funcionario {
        return {
            id:     f.id_employee || f.id,
            nombre: f.nombreCompleto || f.nombre,
            cargo:  f.cargo || '',
            area:   f.area  || '',
        };
    }

    private _filterPersonal(t: string) {
        const q = t.toLowerCase();
        return this.movSvc.getPersonal().pipe(
            map(lista => lista
                .filter((f: any) => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                    .filter(Boolean).join(' ').toLowerCase().includes(q))
                .slice(0, 10)
                .map((f: any) => this._buildFuncionario(f))
            ),
            catchError(() => of([]))
        );
    }

    private _setupFuncionarioSearch(): void {
        this._reqSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showFuncionarioDropdown = false; return of([]); }
                this.funcionarioLoading = true;
                return this._filterPersonal(t).pipe(finalize(() => this.funcionarioLoading = false));
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.funcionarios = res || [];
            this.showFuncionarioDropdown = this.funcionarios.length > 0;
        });
    }

    private _setupDespachadoSearch(): void {
        this._despachadoSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showDespachadoPorDropdown = false; return of([]); }
                this.despachadoPorLoading = true;
                return this._filterPersonal(t).pipe(finalize(() => this.despachadoPorLoading = false));
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.despachadoPorFuncionarios = res || [];
            this.showDespachadoPorDropdown = this.despachadoPorFuncionarios.length > 0;
        });
    }

    private _setupAutorizadoSearch(): void {
        this._autorizadoSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showAutorizadoDropdown = false; return of([]); }
                this.autorizadoLoading = true;
                return this._filterPersonal(t).pipe(finalize(() => this.autorizadoLoading = false));
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.autorizadoFuncionarios = res || [];
            this.showAutorizadoDropdown = this.autorizadoFuncionarios.length > 0;
        });
    }

    onFuncionarioInput(v: string): void {
        this.funcionarioName  = v;
        this.funcionarioValue = v;
        if (v.length >= 2) this._reqSearch$.next(v);
        else this.showFuncionarioDropdown = false;
    }

    selectFuncionario(f: Funcionario): void {
        this.funcionarioName  = f.nombre;
        this.funcionarioValue = f.nombre;
        if (f.area) this.area = f.area;
        this.showFuncionarioDropdown = false;
    }

    hideFuncionarioDropdown(): void { setTimeout(() => this.showFuncionarioDropdown = false, 200); }

    onDespachadoInput(v: string): void {
        this.despachadoPorName  = v;
        this.despachadoPorValue = v;
        if (v.length >= 2) this._despachadoSearch$.next(v);
        else this.showDespachadoPorDropdown = false;
    }

    selectDespachado(f: Funcionario): void {
        this.despachadoPorName  = f.nombre;
        this.despachadoPorValue = f.nombre;
        this.showDespachadoPorDropdown = false;
    }

    hideDespachadoDropdown(): void { setTimeout(() => this.showDespachadoPorDropdown = false, 200); }

    onAutorizadoInput(v: string): void {
        this.autorizadoName  = v;
        this.autorizadoValue = v;
        if (v.length >= 2) this._autorizadoSearch$.next(v);
        else this.showAutorizadoDropdown = false;
    }

    selectAutorizado(f: Funcionario): void {
        this.autorizadoName  = f.nombre;
        this.autorizadoValue = f.nombre;
        this.showAutorizadoDropdown = false;
    }

    hideAutorizadoDropdown(): void { setTimeout(() => this.showAutorizadoDropdown = false, 200); }
}
