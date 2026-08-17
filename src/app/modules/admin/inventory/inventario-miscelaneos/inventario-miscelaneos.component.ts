import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, combineLatest, forkJoin, of } from 'rxjs';
import { startWith, takeUntil, debounceTime, finalize, mergeMap } from 'rxjs/operators';

import { Material, Entrada, Salida, TabMisc } from './interfaces';
import { MiscelaneosService } from '../../../../core/services/miscelaneos.service';
import { ConfirmDeleteComponent } from '../gestion-ubicaciones/confirm-delete/confirm-delete.component';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

@Component({
    selector: 'app-inventario-miscelaneos',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule, MatSnackBarModule, MatTooltipModule, HasPermissionDirective],
    templateUrl: './inventario-miscelaneos.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar-misc::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-misc::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-misc::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar-misc::-webkit-scrollbar-thumb { background: #cbd5e1; }
        /* Los paneles de tabs ocultos no ocupan espacio en el flex container */
        [hidden] { display: none !important; }
    `]
})
export class InventarioMiscelaneosComponent implements OnInit, OnDestroy {

    public dialogRef  = inject(MatDialogRef<InventarioMiscelaneosComponent>, { optional: true });
    private dialog    = inject(MatDialog);
    private snackBar  = inject(MatSnackBar);
    private svc       = inject(MiscelaneosService);
    private _destroy$ = new Subject<void>();

    activeTab  = signal<TabMisc>('catalogo');
    isLoading  = signal(false);

    searchControl  = new FormControl('');
    filterTipoCtrl = new FormControl('');

    // Datos crudos como signals: solo se recomputan valores derivados cuando
    // estas señales realmente cambian, nunca en cada ciclo de detección de
    // cambios (antes eran getters/arrays planos leídos por *ngFor y devolvían
    // una referencia nueva en cada CD → recreación completa del DOM en cada
    // tick, que junto a BrowserAnimationsModule producía un loop de animación
    // infinito y congelaba la pestaña al entrar al módulo).
    private _materiales = signal<Material[]>([]);
    private _entradas   = signal<Entrada[]>([]);
    private _salidas    = signal<Salida[]>([]);

    private _searchTerm = signal('');
    private _tipoFiltro = signal('');

    get materiales(): Material[] { return this._materiales(); }
    get entradas():   Entrada[]  { return this._entradas(); }
    get salidas():    Salida[]   { return this._salidas(); }

    filteredMateriales = computed(() => {
        const tipo = this._tipoFiltro();
        const q    = this._searchTerm();
        return this._materiales().filter(m => {
            if (tipo && m.tipoItem !== tipo) return false;
            if (q && !`${m.codigoBoaM} ${m.producto} ${m.pn} ${m.marca}`.toLowerCase().includes(q)) return false;
            return true;
        });
    });

    filteredEntradas = computed(() => {
        const q = this._searchTerm();
        return this._entradas().filter(e => {
            if (q && !`${e.nroNota} ${e.producto} ${e.codigoNombre} ${e.recibidoPor}`.toLowerCase().includes(q)) return false;
            return true;
        });
    });

    filteredSalidas = computed(() => {
        const q = this._searchTerm();
        return this._salidas().filter(s => {
            if (q && !`${s.nroNota} ${s.producto} ${s.nombre} ${s.area}`.toLowerCase().includes(q)) return false;
            return true;
        });
    });

    tiposItem = ['CONSUMIBLE', 'MATERIAL'];

    // ── Vista Stock por ubicación ──────────────────────────
    stockPorUbicacion = computed<{ ubicacion: string; items: Material[] }[]>(() => {
        const map = new Map<string, Material[]>();
        for (const m of this._materiales().filter(m => m.activo)) {
            const loc = m.ubicacion?.trim() || 'Sin ubicación';
            if (!map.has(loc)) map.set(loc, []);
            map.get(loc)!.push(m);
        }
        return Array.from(map.entries())
            .map(([ubicacion, items]) => ({ ubicacion, items }))
            .sort((a, b) => {
                if (a.ubicacion === 'Sin ubicación') return 1;
                if (b.ubicacion === 'Sin ubicación') return -1;
                return a.ubicacion.localeCompare(b.ubicacion);
            });
    });

    countBajoStockEnUbicacion(items: Material[]): number {
        return items.filter(m => m.stockMin > 0 && m.stock <= m.stockMin).length;
    }

    // ── Lifecycle ──────────────────────────────────────────
    ngOnInit(): void {
        combineLatest([
            this.searchControl.valueChanges.pipe(startWith(''), debounceTime(150)),
            this.filterTipoCtrl.valueChanges.pipe(startWith(''))
        ])
        .pipe(takeUntil(this._destroy$))
        .subscribe(([q, tipo]) => {
            this._searchTerm.set((q ?? '').trim().toLowerCase());
            this._tipoFiltro.set((tipo ?? '').trim());
            this.pagina.set(1);
        });

        this.loadAll();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    private loadAll(): void {
        this.isLoading.set(true);
        forkJoin({
            materiales: this.svc.getMiscelaneos(),
            entradas:   this.svc.getEntradas(),
            salidas:    this.svc.getSalidas(),
        })
        .pipe(finalize(() => this.isLoading.set(false)), takeUntil(this._destroy$))
        .subscribe({
            next: ({ materiales, entradas, salidas }) => {
                this._materiales.set(materiales);
                // Enriquecer entradas con marca/pn del catálogo (el API no los devuelve)
                const matMap = new Map(materiales.map(m => [m.id, m]));
                this._entradas.set(entradas.map(e => {
                    const mat = matMap.get(e.miscelaneo_id);
                    return mat ? { ...e, marca: mat.marca || '', pn: mat.pn || '' } : e;
                }));
                this._salidas.set(salidas);
                this.pagina.set(1);
            },
            error: () => this.snackBar.open('Error al cargar datos', 'Cerrar', { duration: 3000 })
        });
    }

    private loadMateriales(): void {
        this.svc.getMiscelaneos().pipe(takeUntil(this._destroy$)).subscribe(list => {
            this._materiales.set(list);
            this.pagina.set(1);
        });
    }

    private loadMovimientos(): void {
        forkJoin({ e: this.svc.getEntradas(), s: this.svc.getSalidas() })
            .pipe(takeUntil(this._destroy$))
            .subscribe(({ e, s }) => {
                this._entradas.set(e);
                this._salidas.set(s);
                this.pagina.set(1);
            });
    }

    setTab(tab: TabMisc): void {
        this.activeTab.set(tab);
        this.filterTipoCtrl.setValue('', { emitEvent: false });
        this.searchControl.setValue('',  { emitEvent: false });
        this._searchTerm.set('');
        this._tipoFiltro.set('');
        this.pagina.set(1);
    }

    /* ── Paginación (compartida entre los tabs de listas) ── */
    readonly pageSize = 10;
    pagina = signal(1);

    private paginar<T>(list: T[]): T[] {
        const total = Math.max(1, Math.ceil(list.length / this.pageSize));
        const p = Math.min(this.pagina(), total);
        const inicio = (p - 1) * this.pageSize;
        return list.slice(inicio, inicio + this.pageSize);
    }

    materialesPagina = computed(() => this.paginar(this.filteredMateriales()));
    entradasPagina   = computed(() => this.paginar(this.filteredEntradas()));
    salidasPagina    = computed(() => this.paginar(this.filteredSalidas()));

    /** Lista filtrada del tab activo — alimenta el paginador común */
    listaActiva = computed<unknown[]>(() => {
        switch (this.activeTab()) {
            case 'catalogo': return this.filteredMateriales();
            case 'entradas': return this.filteredEntradas();
            case 'salidas':  return this.filteredSalidas();
            default:         return [];
        }
    });

    totalPaginas = computed(() => Math.max(1, Math.ceil(this.listaActiva().length / this.pageSize)));

    rangoPagina = computed<{ desde: number; hasta: number }>(() => {
        const total = this.listaActiva().length;
        if (!total) return { desde: 0, hasta: 0 };
        const p = Math.min(this.pagina(), this.totalPaginas());
        return { desde: (p - 1) * this.pageSize + 1, hasta: Math.min(p * this.pageSize, total) };
    });

    paginasVisibles = computed<number[]>(() => {
        const total  = this.totalPaginas();
        const actual = Math.min(this.pagina(), total);
        const inicio = Math.max(1, Math.min(actual - 2, total - 4));
        const fin    = Math.min(total, inicio + 4);
        const out: number[] = [];
        for (let i = inicio; i <= fin; i++) out.push(i);
        return out;
    });

    irAPagina(p: number): void {
        this.pagina.set(Math.min(Math.max(1, p), this.totalPaginas()));
    }

    refresh(): void { this.loadAll(); }

    /* trackBy para *ngFor — evita que Angular destruya/recree filas cuando
       los computed() de arriba devuelven una nueva referencia de array. */
    trackById = (_: number, item: { id: number }): number => item.id;
    trackByUbicacion = (_: number, grupo: { ubicacion: string }): string => grupo.ubicacion;
    trackByPagina = (_: number, p: number): number => p;

    // ── Stats ──────────────────────────────────────────────
    countActivos()   { return this.materiales.filter(m => m.activo).length; }
    countBajoStock() { return this.materiales.filter(m => m.stockMin > 0 && m.stock <= m.stockMin).length; }

    // ── Helpers visuales ───────────────────────────────────
    getStockPct(m: Material): number {
        if (!m.stockMax) return 0;
        return Math.min(100, (m.stock / m.stockMax) * 100);
    }

    getStockColor(m: Material): string {
        const p = this.getStockPct(m);
        if (p >= 70) return 'bg-green-500';
        if (p >= 30) return 'bg-yellow-500';
        return 'bg-red-500';
    }

    getTipoColor(tipo: string): string {
        const map: Record<string, string> = {
            'CONSUMIBLE': 'bg-blue-100 text-blue-900',
            'REPUESTO':   'bg-orange-100 text-orange-900',
            'MATERIAL':   'bg-green-100 text-green-900',
            'QUIMICO':    'bg-purple-100 text-purple-900',
            'ELECTRICO':  'bg-cyan-100 text-cyan-900',
        };
        return map[tipo] || 'bg-gray-100 text-gray-700';
    }

    // ── Catálogo ───────────────────────────────────────────
    async nuevoCatalogo(): Promise<void> {
        const { FormMaterialComponent } = await import('./form-material/form-material.component');
        this.dialog.open(FormMaterialComponent, {
            maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: { mode: 'new' }
        }).afterClosed().subscribe((r: Partial<Material> | undefined) => {
            if (!r) return;
            this.isLoading.set(true);
            this.svc.createMiscelaneo(r)
                .pipe(finalize(() => this.isLoading.set(false)))
                .subscribe({
                    next: ({ id }) => {
                        this.snackBar.open('Ítem registrado', 'Cerrar', { duration: 2500 });
                        this.loadMateriales();
                    },
                    error: (err) => this.snackBar.open(err?.message ?? 'Error al guardar', 'Cerrar', { duration: 3500 })
                });
        });
    }

    async editarCatalogo(m: Material): Promise<void> {
        const { FormMaterialComponent } = await import('./form-material/form-material.component');
        this.dialog.open(FormMaterialComponent, {
            maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: { mode: 'edit', material: m }
        }).afterClosed().subscribe((r: Partial<Material> | undefined) => {
            if (!r) return;
            this.isLoading.set(true);
            this.svc.updateMiscelaneo(m.id, r)
                .pipe(
                    // HE_MIS_MOD no toca rack_id/level_id a propósito (ver miscelaneos.service.ts).
                    // Si el usuario cambió la ubicación en el picker, se dispara HE_MIS_MOV aparte.
                    mergeMap(() => {
                        const changed = r.rackId !== m.rackId || r.levelId !== m.levelId;
                        if (!changed || !r.rackId || !r.levelId) return of(null);
                        return this.svc.moverMiscelaneo(m.id, r.rackId, r.levelId);
                    }),
                    finalize(() => this.isLoading.set(false))
                )
                .subscribe({
                    next: () => {
                        this.snackBar.open('Ítem actualizado', 'Cerrar', { duration: 2500 });
                        this.loadMateriales();
                    },
                    error: (err) => this.snackBar.open(err?.message ?? 'Error al actualizar', 'Cerrar', { duration: 3500 })
                });
        });
    }

    async verCatalogo(m: Material): Promise<void> {
        const { FormMaterialComponent } = await import('./form-material/form-material.component');
        this.dialog.open(FormMaterialComponent, {
            maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: { mode: 'view', material: m }
        });
    }

    eliminarCatalogo(m: Material): void {
        const ref = this.dialog.open(ConfirmDeleteComponent, {
            width: '420px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: {
                title:        'ELIMINAR ÍTEM',
                itemKind:     'ítem de catálogo',
                itemCode:     m.codigoBoaM,
                itemName:     m.producto,
                warning:      'Se eliminará permanentemente del catálogo de misceláneos.',
                confirmLabel: 'Eliminar Ítem',
            }
        });
        ref.afterClosed().subscribe(confirmed => {
            if (!confirmed) return;
            this.isLoading.set(true);
            this.svc.deleteMiscelaneo(m.id)
                .pipe(finalize(() => this.isLoading.set(false)))
                .subscribe({
                    next: () => {
                        this.snackBar.open('Ítem eliminado', 'Cerrar', { duration: 2500 });
                        this.loadMateriales();
                    },
                    error: (err) => this.snackBar.open(err?.message ?? 'Error al eliminar', 'Cerrar', { duration: 3500 })
                });
        });
    }

    // ── Entradas ───────────────────────────────────────────
    async nuevaEntrada(): Promise<void> {
        const { FormEntradaComponent } = await import('./form-entrada/form-entrada.component');
        this.dialog.open(FormEntradaComponent, {
            width:      '900px',
            maxWidth:   '95vw',
            height:     '88vh',
            panelClass: 'no-padding-dialog',
            data: { mode: 'new', materiales: this.materiales }
        }).afterClosed().subscribe((ok: boolean | undefined) => {
            if (ok) this.loadAll();
        });
    }

    async verEntrada(e: Entrada): Promise<void> {
        const { FormEntradaComponent } = await import('./form-entrada/form-entrada.component');
        this.dialog.open(FormEntradaComponent, {
            maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: { mode: 'view', entrada: e, materiales: this.materiales }
        });
    }

    async editarEntrada(e: Entrada): Promise<void> {
        const { FormEntradaComponent } = await import('./form-entrada/form-entrada.component');
        this.dialog.open(FormEntradaComponent, {
            width: '560px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: { mode: 'edit', entrada: e, materiales: this.materiales }
        }).afterClosed().subscribe((ok: boolean | undefined) => {
            if (ok) this.loadAll();
        });
    }

    eliminarEntrada(e: Entrada): void {
        const ref = this.dialog.open(ConfirmDeleteComponent, {
            width: '420px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: {
                title:        'ELIMINAR ENTRADA',
                itemKind:     'entrada de material',
                itemCode:     e.nroNota,
                itemName:     `${e.producto} — ${e.cantidad} ${e.unidad}`,
                warning:      'Se eliminará el movimiento y el stock será revertido automáticamente.',
                confirmLabel: 'Eliminar Entrada',
            }
        });
        ref.afterClosed().subscribe(confirmed => {
            if (!confirmed) return;
            this.isLoading.set(true);
            this.svc.eliminarEntrada(e.id)
                .pipe(finalize(() => this.isLoading.set(false)))
                .subscribe({
                    next: () => {
                        this.snackBar.open(`Entrada ${e.nroNota} eliminada y stock revertido`, 'Cerrar', { duration: 3500 });
                        this.loadAll();
                    },
                    error: (err) => this.snackBar.open(err?.message ?? 'Error al eliminar', 'Cerrar', { duration: 4000 })
                });
        });
    }

    // ── Salidas ────────────────────────────────────────────
    async nuevaSalida(): Promise<void> {
        const { FormSalidaComponent } = await import('./form-salida/form-salida.component');
        this.dialog.open(FormSalidaComponent, {
            width:      '900px',
            maxWidth:   '95vw',
            height:     '88vh',
            panelClass: 'no-padding-dialog',
            data: { mode: 'new', materiales: this.materiales }
        }).afterClosed().subscribe((ok: boolean | undefined) => {
            if (ok) this.loadAll();
        });
    }

    async verSalida(s: Salida): Promise<void> {
        const { FormSalidaComponent } = await import('./form-salida/form-salida.component');
        this.dialog.open(FormSalidaComponent, {
            maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: { mode: 'view', salida: s, materiales: this.materiales }
        });
    }

    async editarSalida(s: Salida): Promise<void> {
        const { FormSalidaComponent } = await import('./form-salida/form-salida.component');
        this.dialog.open(FormSalidaComponent, {
            width: '500px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: { mode: 'edit', salida: s, materiales: this.materiales }
        }).afterClosed().subscribe((ok: boolean | undefined) => {
            if (ok) this.loadAll();
        });
    }

    eliminarSalida(s: Salida): void {
        const ref = this.dialog.open(ConfirmDeleteComponent, {
            width: '420px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: {
                title:        'ELIMINAR SALIDA',
                itemKind:     'salida de material',
                itemCode:     s.nroNota,
                itemName:     `${s.producto} — ${s.cantidad} ${s.unidad}`,
                warning:      'Se eliminará el movimiento y el stock será repuesto automáticamente.',
                confirmLabel: 'Eliminar Salida',
            }
        });
        ref.afterClosed().subscribe(confirmed => {
            if (!confirmed) return;
            this.isLoading.set(true);
            this.svc.eliminarSalida(s.id)
                .pipe(finalize(() => this.isLoading.set(false)))
                .subscribe({
                    next: () => {
                        this.snackBar.open(`Salida ${s.nroNota} eliminada y stock repuesto`, 'Cerrar', { duration: 3500 });
                        this.loadAll();
                    },
                    error: (err) => this.snackBar.open(err?.message ?? 'Error al eliminar', 'Cerrar', { duration: 4000 })
                });
        });
    }
}
