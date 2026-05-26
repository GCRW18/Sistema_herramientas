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

import { MovementService }     from '../../../../../core/services/movement.service';
import { MiscelaneosService }  from '../../../../../core/services/miscelaneos.service';
import { Entrada, DialogMode, Material } from '../interfaces';

interface Funcionario { id: number; nombre: string; cargo: string; }

interface LoteItem {
    material:  Material;
    cantidad:  number;
    status:    'pending' | 'saving' | 'done' | 'error';
    error?:    string;
    nroNota?:  string;
}

@Component({
    selector: 'app-form-entrada',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatTooltipModule,
        DragDropModule,
    ],
    templateUrl: './form-entrada.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #16a34a; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #4ade80; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    `]
})
export class FormEntradaComponent implements OnInit, OnDestroy {

    dialogRef               = inject(MatDialogRef<FormEntradaComponent>);
    private snackBar        = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private svc             = inject(MiscelaneosService);
    private cdr             = inject(ChangeDetectorRef);
    private data            = inject<{ mode: DialogMode; entrada?: Entrada; materiales?: Material[] }>(MAT_DIALOG_DATA);

    mode: DialogMode = this.data?.mode ?? 'new';

    private _destroy$        = new Subject<void>();
    private _recibidoSearch$ = new Subject<string>();

    // ── Campos compartidos ──────────────────────────────────
    fecha            = new Date().toISOString().split('T')[0];
    hora             = new Date().toTimeString().slice(0, 5);
    recibidoPorName  = '';
    recibidoPorValue = '';
    factura          = '';
    observacion      = '';
    camposTouched    = false;

    // ── Modo edición (single item) ──────────────────────────
    editCantidad     = 1;
    isSaving         = signal(false);

    // ── Lote de materiales (solo modo new) ──────────────────
    items:          LoteItem[] = [];
    isProcessing    = signal(false);
    processedCount  = 0;

    // ── Buscador de material ────────────────────────────────
    materiales:           Material[] = this.data?.materiales ?? [];
    materialSearch        = '';
    materialFiltrados:    Material[] = [];
    showMaterialDropdown  = false;

    // ── Autocomplete funcionario ────────────────────────────
    recibidoPorFuncionarios: Funcionario[] = [];
    recibidoPorLoading       = false;
    showRecibidoPorDropdown  = false;

    // ── Modo vista / edición ────────────────────────────────
    entradaView?: Entrada;

    // ──────────────────────────────────────────────────────
    ngOnInit(): void {
        if (this.data?.entrada) {
            this.entradaView      = this.data.entrada;
            this.fecha            = this.data.entrada.fecha;
            this.hora             = this.data.entrada.hora     ?? '';
            this.recibidoPorName  = this.data.entrada.recibidoPor ?? '';
            this.recibidoPorValue = this.data.entrada.recibidoPor ?? '';
            this.factura          = this.data.entrada.factura  ?? '';
            this.observacion      = this.data.entrada.observacion ?? '';
            this.editCantidad     = this.data.entrada.cantidad ?? 1;
        }
        if (!this.readOnly) this._setupRecibidoSearch();
    }

    ngOnDestroy(): void { this._destroy$.next(); this._destroy$.complete(); }

    get readOnly(): boolean { return this.mode === 'view'; }
    get isEdit():   boolean { return this.mode === 'edit'; }

    get titulo(): string {
        if (this.mode === 'new')  return 'Nueva Entrada de Material';
        if (this.mode === 'edit') return 'Editar Entrada';
        return 'Detalle de Entrada';
    }
    get subtitulo(): string {
        if (this.mode === 'new')  return 'Registro de ingreso al almacén';
        if (this.mode === 'edit') return `Editando: ${this.entradaView?.nroNota ?? ''}`;
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

    get canSubmit(): boolean {
        return this.items.length > 0
            && !!this.fecha
            && !!this.recibidoPorValue.trim()
            && this.items.filter(i => i.status !== 'done').every(i => i.cantidad >= 1);
    }

    get doneCount():  number { return this.items.filter(i => i.status === 'done').length;  }
    get errorCount(): number { return this.items.filter(i => i.status === 'error').length; }
    get pendingCount(): number { return this.items.filter(i => i.status === 'pending' || i.status === 'saving').length; }

    // ── Guardar edición ────────────────────────────────────
    async saveEdit(): Promise<void> {
        this.camposTouched = true;
        if (!this.fecha || !this.recibidoPorValue.trim() || this.editCantidad < 1) {
            this.snackBar.open('Complete todos los campos requeridos', 'Cerrar', { duration: 2500 });
            return;
        }
        this.isSaving.set(true);
        try {
            await lastValueFrom(
                this.svc.editarEntrada({
                    id:          this.entradaView!.id,
                    cantidad:    this.editCantidad,
                    fecha:       this.fecha,
                    hora:        this.hora,
                    recibidoPor: this.recibidoPorValue.trim(),
                    factura:     this.factura.trim()     || undefined,
                    observacion: this.observacion.trim() || undefined,
                })
            );
            this.snackBar.open('Entrada actualizada correctamente', 'OK', { duration: 3000 });
            this.dialogRef.close(true);
        } catch (err: any) {
            this.snackBar.open(err?.message ?? 'Error al actualizar', 'Cerrar', { duration: 4000 });
        } finally {
            this.isSaving.set(false);
        }
    }

    async save(): Promise<void> {
        this.camposTouched = true;
        if (!this.canSubmit) {
            this.snackBar.open(
                this.items.length === 0
                    ? 'Agregue al menos un material al lote'
                    : 'Complete todos los campos requeridos',
                'Cerrar', { duration: 3000 }
            );
            return;
        }

        this.isProcessing.set(true);
        this.processedCount = 0;

        for (const item of this.items) {
            if (item.status === 'done') continue;
            item.status = 'saving';
            this.cdr.detectChanges();

            try {
                const res = await lastValueFrom(
                    this.svc.registrarEntrada({
                        miscelaneo_id: item.material.id,
                        cantidad:      item.cantidad,
                        fecha:         this.fecha,
                        hora:          this.hora,
                        recibidoPor:   this.recibidoPorValue.trim(),
                        factura:       this.factura.trim()    || undefined,
                        observacion:   this.observacion.trim() || undefined,
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
            this.snackBar.open(`Entradas registradas${notas ? ': ' + notas : ''}`, 'OK', { duration: 3500 });
            setTimeout(() => this.dialogRef.close(true), 1200);
        } else {
            this.snackBar.open(`${this.errorCount} item(s) con error. Revise y reintente.`, 'OK', { duration: 4000 });
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

    // ── Autocomplete funcionario ────────────────────────────
    private _setupRecibidoSearch(): void {
        this._recibidoSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showRecibidoPorDropdown = false; return of([]); }
                this.recibidoPorLoading = true;
                const q = t.toLowerCase();
                return this.movementService.getPersonal().pipe(
                    map(lista => lista
                        .filter((f: any) => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map((f: any) => ({ id: f.id_employee || f.id, nombre: f.nombreCompleto || f.nombre, cargo: f.cargo || '' }))
                    ),
                    finalize(() => this.recibidoPorLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.recibidoPorFuncionarios = res || [];
            this.showRecibidoPorDropdown = this.recibidoPorFuncionarios.length > 0;
        });
    }

    onRecibidoInput(v: string): void {
        this.recibidoPorName  = v;
        this.recibidoPorValue = v;
        if (v.length >= 2) this._recibidoSearch$.next(v);
        else this.showRecibidoPorDropdown = false;
    }

    selectRecibido(f: Funcionario): void {
        this.recibidoPorName  = f.nombre;
        this.recibidoPorValue = f.nombre;
        this.showRecibidoPorDropdown = false;
    }

    hideRecibidoDropdown(): void { setTimeout(() => this.showRecibidoPorDropdown = false, 200); }
}
