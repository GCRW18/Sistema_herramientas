import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, combineLatest } from 'rxjs';
import { startWith, takeUntil, debounceTime } from 'rxjs/operators';

import { Material, Entrada, Salida, TabMisc } from './interfaces';

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
    `]
})
export class InventarioMiscelaneosComponent implements OnInit, OnDestroy {

    public dialogRef  = inject(MatDialogRef<InventarioMiscelaneosComponent>, { optional: true });
    private dialog    = inject(MatDialog);
    private snackBar  = inject(MatSnackBar);
    private _destroy$ = new Subject<void>();

    activeTab  = signal<TabMisc>('catalogo');
    isLoading  = signal(false);

    searchControl   = new FormControl('');
    filterTipoCtrl  = new FormControl('');

    // ── Datos ─────────────────────────────────────────
    materiales:         Material[] = [];
    filteredMateriales: Material[] = [];

    entradas:           Entrada[]  = [];
    filteredEntradas:   Entrada[]  = [];

    salidas:            Salida[]   = [];
    filteredSalidas:    Salida[]   = [];

    tiposItem = ['CONSUMIBLE', 'MATERIAL'];

    // ── Vista Stock por ubicación ──────────────────────
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

    // ── Lifecycle ─────────────────────────────────────
    ngOnInit(): void {
        combineLatest([
            this.searchControl.valueChanges.pipe(startWith(''), debounceTime(150)),
            this.filterTipoCtrl.valueChanges.pipe(startWith(''))
        ])
        .pipe(takeUntil(this._destroy$))
        .subscribe(() => this.applyFilters());
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    // ── Filtros ───────────────────────────────────────
    applyFilters(): void {
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

    // ── Stats ─────────────────────────────────────────
    countActivos()   { return this.materiales.filter(m => m.activo).length; }
    countBajoStock() { return this.materiales.filter(m => m.stockMin > 0 && m.stock <= m.stockMin).length; }

    // ── Helpers visuales ──────────────────────────────
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

    // ── Catálogo ──────────────────────────────────────
    async nuevoCatalogo(): Promise<void> {
        const { FormMaterialComponent } = await import('./form-material/form-material.component');
        this.dialog.open(FormMaterialComponent, { maxWidth: '95vw', panelClass: 'no-padding-dialog', data: { mode: 'new' } })
            .afterClosed().subscribe((r: Material | undefined) => {
                if (r) {
                    this.materiales.push({ ...r, id: Date.now(), activo: true });
                    this.applyFilters();
                    this.snackBar.open('Ítem registrado', 'Cerrar', { duration: 2500 });
                }
            });
    }

    async editarCatalogo(m: Material): Promise<void> {
        const { FormMaterialComponent } = await import('./form-material/form-material.component');
        this.dialog.open(FormMaterialComponent, { maxWidth: '95vw', panelClass: 'no-padding-dialog', data: { mode: 'edit', material: m } })
            .afterClosed().subscribe((r: Material | undefined) => {
                if (r) {
                    const idx = this.materiales.findIndex(x => x.id === m.id);
                    if (idx !== -1) this.materiales[idx] = { ...r, id: m.id };
                    this.applyFilters();
                    this.snackBar.open('Ítem actualizado', 'Cerrar', { duration: 2500 });
                }
            });
    }

    async verCatalogo(m: Material): Promise<void> {
        const { FormMaterialComponent } = await import('./form-material/form-material.component');
        this.dialog.open(FormMaterialComponent, { maxWidth: '95vw', panelClass: 'no-padding-dialog', data: { mode: 'view', material: m } });
    }

    eliminarCatalogo(m: Material): void {
        if (!confirm(`¿Eliminar "${m.producto}" del catálogo?`)) return;
        this.materiales = this.materiales.filter(x => x.id !== m.id);
        this.applyFilters();
        this.snackBar.open('Ítem eliminado', 'Cerrar', { duration: 2500 });
    }

    // ── Entradas ──────────────────────────────────────
    async nuevaEntrada(): Promise<void> {
        const { FormEntradaComponent } = await import('./form-entrada/form-entrada.component');
        this.dialog.open(FormEntradaComponent, { maxWidth: '95vw', panelClass: 'no-padding-dialog', data: { mode: 'new' } })
            .afterClosed().subscribe((r: Entrada | undefined) => {
                if (r) {
                    this.entradas.unshift({ ...r, id: Date.now() });
                    this.applyFilters();
                    this.snackBar.open('Entrada registrada', 'Cerrar', { duration: 2500 });
                }
            });
    }

    async verEntrada(e: Entrada): Promise<void> {
        const { FormEntradaComponent } = await import('./form-entrada/form-entrada.component');
        this.dialog.open(FormEntradaComponent, { maxWidth: '95vw', panelClass: 'no-padding-dialog', data: { mode: 'view', entrada: e } });
    }

    // ── Salidas ───────────────────────────────────────
    async nuevaSalida(): Promise<void> {
        const { FormSalidaComponent } = await import('./form-salida/form-salida.component');
        this.dialog.open(FormSalidaComponent, { maxWidth: '95vw', panelClass: 'no-padding-dialog', data: { mode: 'new' } })
            .afterClosed().subscribe((r: Salida | undefined) => {
                if (r) {
                    this.salidas.unshift({ ...r, id: Date.now() });
                    this.applyFilters();
                    this.snackBar.open('Salida registrada', 'Cerrar', { duration: 2500 });
                }
            });
    }

    async verSalida(s: Salida): Promise<void> {
        const { FormSalidaComponent } = await import('./form-salida/form-salida.component');
        this.dialog.open(FormSalidaComponent, { maxWidth: '95vw', panelClass: 'no-padding-dialog', data: { mode: 'view', salida: s } });
    }
}
