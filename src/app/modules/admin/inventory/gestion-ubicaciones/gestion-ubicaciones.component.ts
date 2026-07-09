import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { Subject, combineLatest } from 'rxjs';
import { startWith, takeUntil, debounceTime } from 'rxjs/operators';

import { Warehouse, Rack, Ciudad } from './interfaces';
import { GestionEstantesComponent } from './gestion-estantes/gestion-estantes.component';
import { GestionUbicacionesService } from './gestion-ubicaciones.service';

@Component({
    selector: 'app-gestion-ubicaciones',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatIconModule,
        MatSnackBarModule,
        MatTooltipModule,
        MatMenuModule,
        GestionEstantesComponent,
    ],
    templateUrl: './gestion-ubicaciones.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        .row-selected { background-color: #fef3c7 !important; border-left: 4px solid #fbbf24 !important; }
        :host-context(.dark) .row-selected { background-color: rgba(251,191,36,0.1) !important; border-left: 4px solid #fbbf24 !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4,0,0.6,1) infinite; }
    `]
})
export class GestionUbicacionesComponent implements OnInit, OnDestroy {

    private dialog    = inject(MatDialog);
    private snackBar  = inject(MatSnackBar);
    private svc       = inject(GestionUbicacionesService);
    private _destroy$ = new Subject<void>();

    searchControl    = new FormControl('');
    filterCiudad     = new FormControl('');
    filterEstado     = new FormControl('');
    ciudadSearchText = new FormControl('');
    ciudadDropdownOpen = signal(false);

    isLoading             = signal(false);
    almacenes:         Warehouse[] = [];
    filteredAlmacenes: Warehouse[] = [];
    racksByWarehouse: Record<number, Rack[]> = {};

    /* ── Paginación ── */
    readonly pageSize = 10;
    pagina = signal(1);

    /** Almacén abierto en la vista de estantes. null = se muestra la lista. */
    almacenActivo = signal<Warehouse | null>(null);

    // Ciudades cargadas desde el backend
    ciudades: Ciudad[] = [];

    estados = [
        { value: '',         label: 'Todos los estados' },
        { value: 'ACTIVO',   label: 'Activos'           },
        { value: 'INACTIVO', label: 'Inactivos'         },
    ];

    ngOnInit() {
        this.cargarCiudades();
        this.cargarAlmacenes();

        combineLatest([
            this.searchControl.valueChanges.pipe(startWith(''), debounceTime(150)),
            this.filterCiudad.valueChanges.pipe(startWith('')),
            this.filterEstado.valueChanges.pipe(startWith('')),
        ])
            .pipe(takeUntil(this._destroy$))
            .subscribe(() => this.applyFilters());

        // Al escribir manualmente en el input de ciudad, limpiar la selección activa
        this.ciudadSearchText.valueChanges
            .pipe(takeUntil(this._destroy$))
            .subscribe(() => {
                if (this.filterCiudad.value) this.filterCiudad.setValue('');
                this.ciudadDropdownOpen.set(true);
            });
    }

    ngOnDestroy() {
        this._destroy$.next();
        this._destroy$.complete();
    }

    cargarCiudades() {
        this.svc.getCiudades().pipe(takeUntil(this._destroy$)).subscribe({
            next:  (data) => { this.ciudades = data ?? []; },
            error: (err)  => {
                console.error('Error cargando ciudades', err);
                this.ciudades = [];
            }
        });
    }

    cargarAlmacenes() {
        this.isLoading.set(true);
        this.svc.getWarehouses().pipe(takeUntil(this._destroy$)).subscribe({
            next: (data) => {
                this.almacenes = data ?? [];
                this.applyFilters();
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error('Error cargando almacenes', err);
                this.almacenes = [];
                this.applyFilters();
                this.isLoading.set(false);
                this.snackBar.open('No se pudieron cargar los almacenes', 'Cerrar', { duration: 3500 });
            }
        });
    }

    private applyFilters() {
        const q      = (this.searchControl.value ?? '').toString().trim().toLowerCase();
        const ciudad = this.filterCiudad.value ?? '';
        const estado = this.filterEstado.value ?? '';

        this.filteredAlmacenes = this.almacenes.filter(a => {
            if (ciudad && a.ciudad !== ciudad) return false;
            if (estado && a.estado !== estado) return false;
            if (q) {
                const blob = `${a.codigo} ${a.nombre} ${a.nombreOficina}`.toLowerCase();
                if (!blob.includes(q)) return false;
            }
            return true;
        });
        this.pagina.set(1);
    }

    /* ── Paginación ── */

    get totalPaginas(): number {
        return Math.max(1, Math.ceil(this.filteredAlmacenes.length / this.pageSize));
    }

    get almacenesPagina(): Warehouse[] {
        const p = Math.min(this.pagina(), this.totalPaginas);
        const inicio = (p - 1) * this.pageSize;
        return this.filteredAlmacenes.slice(inicio, inicio + this.pageSize);
    }

    get rangoPagina(): { desde: number; hasta: number } {
        const total = this.filteredAlmacenes.length;
        if (!total) return { desde: 0, hasta: 0 };
        const p = Math.min(this.pagina(), this.totalPaginas);
        const desde = (p - 1) * this.pageSize + 1;
        return { desde, hasta: Math.min(p * this.pageSize, total) };
    }

    /** Ventana de hasta 5 números de página centrada en la actual */
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

    countActivos()   { return this.almacenes.filter(a => a.estado === 'ACTIVO').length; }
    countInactivos() { return this.almacenes.filter(a => a.estado === 'INACTIVO').length; }
    countEstantes()  { return this.almacenes.reduce((s, a) => s + (a.estantesCount ?? 0), 0); }

    /* ── Autocomplete ciudad ── */
    get ciudadesFiltradas(): Ciudad[] {
        const q = (this.ciudadSearchText.value ?? '').trim().toLowerCase();
        if (!q) return this.ciudades;
        return this.ciudades.filter(c => c.nombre.toLowerCase().includes(q));
    }

    seleccionarCiudad(nombre: string): void {
        this.ciudadSearchText.setValue(nombre, { emitEvent: false });
        this.filterCiudad.setValue(nombre);
        this.ciudadDropdownOpen.set(false);
    }

    limpiarCiudad(): void {
        this.ciudadSearchText.setValue('', { emitEvent: false });
        this.filterCiudad.setValue('');
        this.ciudadDropdownOpen.set(false);
    }

    onCiudadBlur(): void {
        setTimeout(() => this.ciudadDropdownOpen.set(false), 150);
    }

    async nuevoAlmacen() {
        const { FormAlmacenComponent } = await import('./form-almacen/form-almacen.component');
        const ref = this.dialog.open(FormAlmacenComponent, {
            width: '620px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: { mode: 'new' }
        });
        ref.afterClosed().subscribe(ok => { if (ok) this.recargar('Almacén creado'); });
    }

    async editarAlmacen(a: Warehouse, ev: Event) {
        ev.stopPropagation();
        const { FormAlmacenComponent } = await import('./form-almacen/form-almacen.component');
        const ref = this.dialog.open(FormAlmacenComponent, {
            width: '620px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: { mode: 'edit', almacen: a }
        });
        ref.afterClosed().subscribe(ok => { if (ok) this.recargar('Almacén actualizado'); });
    }

    async verAlmacen(a: Warehouse) {
        const { FormAlmacenComponent } = await import('./form-almacen/form-almacen.component');
        this.dialog.open(FormAlmacenComponent, {
            width: '620px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: { mode: 'view', almacen: a }
        });
    }

    abrirEstantes(a: Warehouse) {
        this.almacenActivo.set(a);
    }

    volverAAlmacenes() {
        this.almacenActivo.set(null);
        this.cargarAlmacenes();
    }

    private recargar(msg: string) {
        this.cargarAlmacenes();
        this.snackBar.open(msg, 'Cerrar', { duration: 2000 });
    }
}
