import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, combineLatest, forkJoin } from 'rxjs';
import { startWith, takeUntil, debounceTime, finalize } from 'rxjs/operators';

import { Material, Entrada, Salida, TabMisc } from './interfaces';
import { MiscelaneosService } from '../../../../core/services/miscelaneos.service';
import { ConfirmDeleteComponent } from '../gestion-ubicaciones/confirm-delete/confirm-delete.component';

@Component({
    selector: 'app-inventario-miscelaneos',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
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

    materiales:         Material[] = [];
    filteredMateriales: Material[] = [];

    entradas:           Entrada[]  = [];
    filteredEntradas:   Entrada[]  = [];

    salidas:            Salida[]   = [];
    filteredSalidas:    Salida[]   = [];

    tiposItem = ['CONSUMIBLE', 'MATERIAL'];

    // ── Vista Stock por ubicación ──────────────────────────
    get stockPorUbicacion(): { ubicacion: string; items: Material[] }[] {
        const map = new Map<string, Material[]>();
        for (const m of this.materiales.filter(m => m.activo)) {
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
    }

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
        .subscribe(() => this.applyFilters());

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
                this.materiales = materiales;
                // Enriquecer entradas con marca/pn del catálogo (el API no los devuelve)
                const matMap = new Map(materiales.map(m => [m.id, m]));
                this.entradas = entradas.map(e => {
                    const mat = matMap.get(e.miscelaneo_id);
                    return mat ? { ...e, marca: mat.marca || '', pn: mat.pn || '' } : e;
                });
                this.salidas = salidas;
                this.applyFilters();
            },
            error: () => this.snackBar.open('Error al cargar datos', 'Cerrar', { duration: 3000 })
        });
    }

    private loadMateriales(): void {
        this.svc.getMiscelaneos().pipe(takeUntil(this._destroy$)).subscribe(list => {
            this.materiales = list;
            this.applyFilters();
        });
    }

    private loadMovimientos(): void {
        forkJoin({ e: this.svc.getEntradas(), s: this.svc.getSalidas() })
            .pipe(takeUntil(this._destroy$))
            .subscribe(({ e, s }) => {
                this.entradas = e;
                this.salidas  = s;
                this.applyFilters();
            });
    }

    // ── Filtros ────────────────────────────────────────────
    applyFilters(): void {
        this.pagina.set(1);
        const q    = (this.searchControl.value  ?? '').trim().toLowerCase();
        const tipo = (this.filterTipoCtrl.value ?? '').trim();

        this.filteredMateriales = this.materiales.filter(m => {
            if (tipo && m.tipoItem !== tipo) return false;
            if (q && !`${m.codigoBoaM} ${m.producto} ${m.pn} ${m.marca}`.toLowerCase().includes(q)) return false;
            return true;
        });

        this.filteredEntradas = this.entradas.filter(e => {
            if (q && !`${e.nroNota} ${e.producto} ${e.codigoNombre} ${e.recibidoPor}`.toLowerCase().includes(q)) return false;
            return true;
        });

        this.filteredSalidas = this.salidas.filter(s => {
            if (q && !`${s.nroNota} ${s.producto} ${s.nombre} ${s.area}`.toLowerCase().includes(q)) return false;
            return true;
        });
    }

    setTab(tab: TabMisc): void {
        this.activeTab.set(tab);
        this.filterTipoCtrl.setValue('', { emitEvent: false });
        this.searchControl.setValue('',  { emitEvent: false });
        this.applyFilters();
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

    get materialesPagina(): Material[] { return this.paginar(this.filteredMateriales); }
    get entradasPagina():   Entrada[]  { return this.paginar(this.filteredEntradas); }
    get salidasPagina():    Salida[]   { return this.paginar(this.filteredSalidas); }

    /** Lista filtrada del tab activo — alimenta el paginador común */
    get listaActiva(): unknown[] {
        switch (this.activeTab()) {
            case 'catalogo': return this.filteredMateriales;
            case 'entradas': return this.filteredEntradas;
            case 'salidas':  return this.filteredSalidas;
            default:         return [];
        }
    }

    get totalPaginas(): number {
        return Math.max(1, Math.ceil(this.listaActiva.length / this.pageSize));
    }

    get rangoPagina(): { desde: number; hasta: number } {
        const total = this.listaActiva.length;
        if (!total) return { desde: 0, hasta: 0 };
        const p = Math.min(this.pagina(), this.totalPaginas);
        return { desde: (p - 1) * this.pageSize + 1, hasta: Math.min(p * this.pageSize, total) };
    }

    paginasVisibles(): number[] {
        const total  = this.totalPaginas;
        const actual = Math.min(this.pagina(), total);
        const inicio = Math.max(1, Math.min(actual - 2, total - 4));
        const fin    = Math.min(total, inicio + 4);
        const out: number[] = [];
        for (let i = inicio; i <= fin; i++) out.push(i);
        return out;
    }

    irAPagina(p: number): void {
        this.pagina.set(Math.min(Math.max(1, p), this.totalPaginas));
    }

    refresh(): void { this.loadAll(); }

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
                .pipe(finalize(() => this.isLoading.set(false)))
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
