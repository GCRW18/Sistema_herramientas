import { Component, EventEmitter, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { forkJoin, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';

import { CalibrationService } from 'app/core/services/calibration.service';

import { Warehouse, Rack, Level, LevelTool, LevelKit, LevelMiscelaneo } from '../interfaces';
import { ConfirmDeleteComponent, ConfirmDeleteData } from '../confirm-delete/confirm-delete.component';
import { GestionUbicacionesService } from '../gestion-ubicaciones.service';
import { NivelHerramientasDialogComponent, NivelHerramientasData } from '../nivel-herramientas/nivel-herramientas-dialog.component';

@Component({
    selector: 'app-gestion-estantes',
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
    templateUrl: './gestion-estantes.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Estante 3D */
        .estante-3d { perspective: 1200px; }
        .estante-3d-inner {
            transform: rotateX(4deg) rotateY(-5deg);
            transform-style: preserve-3d;
            transition: transform 0.3s ease;
        }
        .estante-3d-inner:hover { transform: rotateX(2deg) rotateY(-3deg); }
        .nivel-3d {
            transform: translateZ(0);
            transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        .nivel-3d:hover { transform: translateZ(12px); }
        /* En móvil, desactivar 3D para evitar overflow */
        @media (max-width: 1023px) {
            .estante-3d-inner { transform: none !important; }
            .nivel-3d:hover { transform: none; }
        }

        /* Pared de fondo del área del estante: grilla sutil sobre degradado */
        .estante-wall {
            background:
                linear-gradient(rgba(15,23,42,0.045) 1px, transparent 1px) 0 0 / 32px 32px,
                linear-gradient(90deg, rgba(15,23,42,0.045) 1px, transparent 1px) 0 0 / 32px 32px,
                linear-gradient(135deg, #f3f4f6, #e2e5ea);
        }
        :host-context(.dark) .estante-wall {
            background:
                linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px) 0 0 / 32px 32px,
                linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px) 0 0 / 32px 32px,
                linear-gradient(135deg, #1e293b, #0f172a);
        }
    `]
})
export class GestionEstantesComponent implements OnInit, OnChanges, OnDestroy {

    private dialog      = inject(MatDialog);
    private snackBar    = inject(MatSnackBar);
    private svc         = inject(GestionUbicacionesService);
    private calibSvc    = inject(CalibrationService);
    private _destroy$   = new Subject<void>();

    @Input({ required: true }) almacen!: Warehouse;
    @Input() todosLosAlmacenes: Warehouse[] = [];
    @Output() volver = new EventEmitter<void>();

    vistaActiva = signal<'tabla' | 'detalle'>('tabla');

    estantes: Rack[] = [];
    loadingEstantes = signal(false);
    estanteActivoId = signal<number | null>(null);

    searchControl = new FormControl('');

    /* ── Paginación tabla de estantes ── */
    readonly pageSize = 10;
    pagina = signal(1);

    /* ════════ Buscador Global ════════ */
    buscarVisible      = signal(false);
    busquedaControl    = new FormControl('');
    todasHerramientas: LevelTool[] = [];
    calibEnCurso       = new Set<string>();
    loadingBusqueda    = signal(false);

    get estanteActivo(): Rack | undefined {
        return this.estantes.find(r => r.id === this.estanteActivoId());
    }

    ngOnInit() {
        if (!this.todosLosAlmacenes.length) this.todosLosAlmacenes = [this.almacen];
        this.searchControl.valueChanges
            .pipe(takeUntil(this._destroy$))
            .subscribe(() => this.pagina.set(1));
        this.cargarEstantes();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['almacen'] && !changes['almacen'].isFirstChange()) {
            this.estantes = [];
            this.vistaActiva.set('tabla');
            this.estanteActivoId.set(null);
            this.cargarEstantes();
        }
    }

    cargarEstantes() {
        // 3 requests fijos (estantes + niveles + herramientas del almacén completo)
        // en lugar de 1 + 2 por estante: con los 34 estantes reales de CBB el patrón
        // anterior disparaba ~69 llamadas al backend y tardaba varios segundos.
        this.loadingEstantes.set(true);
        forkJoin({
            racks:  this.svc.getRacks(this.almacen.id),
            levels: this.svc.getLevelsByWarehouse(this.almacen.id).pipe(catchError(() => of([] as Level[]))),
            tools:  this.svc.getLevelToolsByWarehouse(this.almacen.id).pipe(catchError(() => of([] as LevelTool[]))),
            kits:   this.svc.getKitsByWarehouse(this.almacen.id).pipe(catchError(() => of([] as LevelKit[]))),
            miscelaneos: this.svc.getMiscelaneosByWarehouse(this.almacen.id).pipe(catchError(() => of([] as LevelMiscelaneo[]))),
        }).subscribe({
            next: ({ racks, levels, tools, kits, miscelaneos }) => {
                const toolsPorNivel = new Map<number, LevelTool[]>();
                tools.forEach(t => {
                    const arr = toolsPorNivel.get(t.levelId) ?? [];
                    arr.push(t);
                    toolsPorNivel.set(t.levelId, arr);
                });
                const kitsPorNivel = new Map<number, LevelKit[]>();
                kits.forEach(k => {
                    const arr = kitsPorNivel.get(k.levelId) ?? [];
                    arr.push(k);
                    kitsPorNivel.set(k.levelId, arr);
                });
                const miscPorNivel = new Map<number, LevelMiscelaneo[]>();
                miscelaneos.forEach(m => {
                    const arr = miscPorNivel.get(m.levelId) ?? [];
                    arr.push(m);
                    miscPorNivel.set(m.levelId, arr);
                });
                const nivelesPorEstante = new Map<number, Level[]>();
                levels.forEach(lv => {
                    const arr = nivelesPorEstante.get(lv.rackId) ?? [];
                    arr.push({
                        ...lv,
                        tools: toolsPorNivel.get(lv.id) ?? [],
                        kits: kitsPorNivel.get(lv.id) ?? [],
                        miscelaneos: miscPorNivel.get(lv.id) ?? [],
                    });
                    nivelesPorEstante.set(lv.rackId, arr);
                });
                this.estantes = racks.map(r => ({ ...r, niveles: nivelesPorEstante.get(r.id) ?? [] }));
                this.loadingEstantes.set(false);
            },
            error: (err) => {
                console.error('Error cargando estantes', err);
                this.estantes = [];
                this.loadingEstantes.set(false);
                this.snackBar.open('No se pudieron cargar los estantes', 'Cerrar', { duration: 3500 });
            }
        });
    }

    get estantesFiltrados(): Rack[] {
        const q = (this.searchControl.value ?? '').toString().trim().toLowerCase();
        if (!q) return this.estantes;
        return this.estantes.filter(r => `${r.codigo} ${r.nombre} ${r.descripcion}`.toLowerCase().includes(q));
    }

    /* ── Paginación ── */

    get totalPaginas(): number {
        return Math.max(1, Math.ceil(this.estantesFiltrados.length / this.pageSize));
    }

    get estantesPagina(): Rack[] {
        const p = Math.min(this.pagina(), this.totalPaginas);
        const inicio = (p - 1) * this.pageSize;
        return this.estantesFiltrados.slice(inicio, inicio + this.pageSize);
    }

    get rangoPagina(): { desde: number; hasta: number } {
        const total = this.estantesFiltrados.length;
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

    verDetalleEstante(r: Rack) {
        this.estanteActivoId.set(r.id);
        this.vistaActiva.set('detalle');
    }

    volverAEstantes() {
        this.vistaActiva.set('tabla');
        this.estanteActivoId.set(null);
    }

    /* ════════ Miniventana de herramientas del nivel ════════ */

    abrirNivel(r: Rack, l: Level, highlightToolId?: number) {
        const data: NivelHerramientasData = {
            almacen:           this.almacen,
            todosLosAlmacenes: this.todosLosAlmacenes,
            estantes:          this.estantes,
            rack:              r,
            level:             l,
            highlightToolId,
        };
        this.dialog.open(NivelHerramientasDialogComponent, {
            width: '640px', maxWidth: '95vw', panelClass: 'no-padding-dialog', data,
        }).afterClosed().subscribe((changed: boolean) => {
            if (changed) this.cargarEstantes();
        });
    }

    /* ════════ Helpers ════════ */

    contarHerramientas(r: Rack): number {
        return r.niveles.reduce((acc, n) => acc + (n.tools?.length ?? 0), 0);
    }

    contarKits(r: Rack): number {
        return r.niveles.reduce((acc, n) => acc + (n.kits?.length ?? 0), 0);
    }

    contarMiscelaneos(r: Rack): number {
        return r.niveles.reduce((acc, n) => acc + (n.miscelaneos?.length ?? 0), 0);
    }

    estadoBadge(estado: string): { bg: string; tx: string } {
        switch (estado) {
            case 'NUEVO':           return { bg: 'bg-green-500',  tx: 'text-white' };
            case 'REACONDICIONADO': return { bg: 'bg-blue-700',   tx: 'text-white'  };
            case 'USADO':           return { bg: 'bg-[#FF1414FF]',  tx: 'text-white' };
            default:                return { bg: 'bg-gray-200',   tx: 'text-gray-900'  };
        }
    }

    tieneSuelo(r: Rack): boolean {
        return r.niveles.some(n => !!n.isFloor);
    }

    /* ════════ CRUD Estantes / Niveles ════════ */

    async nuevoEstante() {
        const { FormEstanteComponent } = await import('../form-estante/form-estante.component');
        const ref = this.dialog.open(FormEstanteComponent, { width: '560px', maxWidth: '95vw', panelClass: 'no-padding-dialog', data: { mode: 'new', warehouse: this.almacen, racksExistentes: this.estantes } });
        ref.afterClosed().subscribe((rack: Rack | null) => {
            if (!rack) return;
            rack.warehouseId = this.almacen.id;
            this.svc.insertRack(rack).subscribe({
                next: () => {
                    this.snackBar.open('Estante creado', 'Cerrar', { duration: 2500 });
                    this.cargarEstantes();
                },
                error: () => this.snackBar.open('Error al crear estante', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    async editarEstante(r: Rack, ev: Event) {
        ev.stopPropagation();
        const { FormEstanteComponent } = await import('../form-estante/form-estante.component');
        const ref = this.dialog.open(FormEstanteComponent, { width: '560px', maxWidth: '95vw', panelClass: 'no-padding-dialog', data: { mode: 'edit', warehouse: this.almacen, rack: r } });
        ref.afterClosed().subscribe((rack: Rack | null) => {
            if (!rack) return;
            this.svc.updateRack({ ...rack, id: r.id, warehouseId: r.warehouseId }).subscribe({
                next: () => {
                    Object.assign(r, { codigo: rack.codigo, nombre: rack.nombre, descripcion: rack.descripcion, activo: rack.activo });
                    this.snackBar.open('Estante actualizado', 'Cerrar', { duration: 2500 });
                },
                error: () => this.snackBar.open('Error al actualizar estante', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    eliminarEstante(r: Rack, ev: Event) {
        ev.stopPropagation();
        const data: ConfirmDeleteData = { itemKind: 'estante', itemCode: r.codigo, itemName: r.nombre, warning: r.niveles.length ? `Se eliminarán también ${r.niveles.length} nivel(es) asociados.` : undefined };
        this.dialog.open(ConfirmDeleteComponent, { width: '420px', maxWidth: '95vw', panelClass: 'no-padding-dialog', data, hasBackdrop: true }).afterClosed().subscribe(ok => {
            if (!ok) return;
            this.svc.deleteRack(r.id).subscribe({
                next: () => {
                    this.estantes = this.estantes.filter(e => e.id !== r.id);
                    if (this.estanteActivoId() === r.id) this.volverAEstantes();
                    this.snackBar.open('Estante eliminado', 'Cerrar', { duration: 2500 });
                },
                error: () => this.snackBar.open('Error al eliminar estante', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    toggleEstadoEstante(r: Rack, ev: Event) {
        ev.stopPropagation();
        const updated: Rack = { ...r, activo: !r.activo };
        this.svc.updateRack(updated).subscribe({
            next: () => {
                r.activo = !r.activo;
                this.snackBar.open(`Estante ${r.activo ? 'activado' : 'desactivado'}`, 'Cerrar', { duration: 2000 });
            },
            error: () => this.snackBar.open('Error al cambiar estado', 'Cerrar', { duration: 3500 }),
        });
    }

    async nuevoNivel(r: Rack, ev: Event) {
        ev.stopPropagation();
        const { FormNivelComponent } = await import('../form-nivel/form-nivel.component');
        const regularLevels = r.niveles.filter(n => !n.isFloor);
        const maxNum = regularLevels.length > 0 ? Math.max(...regularLevels.map(n => n.numero ?? 0)) : 0;
        const ref = this.dialog.open(FormNivelComponent, { width: '560px', maxWidth: '95vw', panelClass: 'no-padding-dialog', data: { mode: 'new', rack: r, suggestedNumero: maxNum + 1 } });
        ref.afterClosed().subscribe((lvl: Level | null) => {
            if (!lvl) return;
            this.svc.insertLevel({ ...lvl, rackId: r.id }).subscribe({
                next: () => {
                    this.snackBar.open('Nivel agregado', 'Cerrar', { duration: 2500 });
                    this.cargarEstantes();
                },
                error: () => this.snackBar.open('Error al crear nivel', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    async editarNivel(r: Rack, l: Level, ev: Event) {
        ev.stopPropagation();
        const { FormNivelComponent } = await import('../form-nivel/form-nivel.component');
        const ref = this.dialog.open(FormNivelComponent, { width: '560px', maxWidth: '95vw', panelClass: 'no-padding-dialog', data: { mode: 'edit', rack: r, level: l } });
        ref.afterClosed().subscribe((lvl: Level | null) => {
            if (!lvl) return;
            this.svc.updateLevel({ ...lvl, id: l.id, rackId: r.id }).subscribe({
                next: () => {
                    Object.assign(l, { numero: lvl.numero, codigo: lvl.codigo, nombre: lvl.nombre, descripcion: lvl.descripcion, activo: lvl.activo, isFloor: lvl.isFloor });
                    r.niveles.sort((a, b) => {
                        if (a.isFloor) return 1;
                        if (b.isFloor) return -1;
                        return (a.numero ?? 0) - (b.numero ?? 0);
                    });
                    this.snackBar.open('Nivel actualizado', 'Cerrar', { duration: 2500 });
                },
                error: () => this.snackBar.open('Error al actualizar nivel', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    eliminarNivel(r: Rack, l: Level, ev: Event) {
        ev.stopPropagation();
        const data: ConfirmDeleteData = { itemKind: 'nivel', itemCode: l.codigo, itemName: `Nivel ${l.numero} · ${l.nombre}`, warning: (l.tools?.length ?? 0) > 0 ? `Se desasignarán ${l.tools!.length} herramienta(s) de este nivel.` : undefined };
        this.dialog.open(ConfirmDeleteComponent, { width: '420px', maxWidth: '95vw', panelClass: 'no-padding-dialog', data, hasBackdrop: true }).afterClosed().subscribe(ok => {
            if (!ok) return;
            this.svc.deleteLevel(l.id).subscribe({
                next: () => {
                    r.niveles = r.niveles.filter(n => n.id !== l.id);
                    this.snackBar.open('Nivel eliminado', 'Cerrar', { duration: 2500 });
                },
                error: () => this.snackBar.open('Error al eliminar nivel', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    /* ════════ Buscador Global ════════ */

    abrirBusqueda(): void {
        this.buscarVisible.set(true);
        this.loadingBusqueda.set(true);
        this.todasHerramientas = [];
        this.calibEnCurso = new Set();

        forkJoin({
            tools: this.svc.getLevelToolsByWarehouse(this.almacen.id).pipe(catchError(() => of([] as LevelTool[]))),
            cals:  this.calibSvc.getCalibrations({ limit: 500 }).pipe(catchError(() => of([]))),
        }).pipe(takeUntil(this._destroy$)).subscribe(({ tools, cals }) => {
            this.todasHerramientas = tools;
            this.calibEnCurso = new Set(
                (cals as any[])
                    .filter(c => c.status === 'sent' || c.status === 'in_process')
                    .map(c => (c.tool_code ?? '').toLowerCase())
            );
            this.loadingBusqueda.set(false);
        });
    }

    cerrarBusqueda(): void {
        this.buscarVisible.set(false);
        this.busquedaControl.setValue('');
        this.todasHerramientas = [];
        this.calibEnCurso = new Set();
    }

    isEnCalibracion(t: LevelTool): boolean {
        return this.calibEnCurso.has((t.codigo ?? '').toLowerCase());
    }

    get herramientasBusqueda(): LevelTool[] {
        const q = (this.busquedaControl.value ?? '').toString().trim().toLowerCase();
        if (!q) return this.todasHerramientas;
        return this.todasHerramientas.filter(t =>
            `${t.codigo} ${t.pn} ${t.sn ?? ''} ${t.nombre} ${t.marca ?? ''} ${t.rackCodigo} ${t.levelCodigo}`.toLowerCase().includes(q)
        );
    }

    irAlEstante(t: LevelTool): void {
        const rack = this.estantes.find(r => r.id === t.rackId);
        const nivel = rack?.niveles.find(n => n.id === t.levelId);
        if (!rack || !nivel) {
            this.snackBar.open('Recarga los estantes para navegar a este resultado', 'Cerrar', { duration: 2500 });
            return;
        }
        // Navegar al detalle del estante como contexto y abrir directo la
        // miniventana del nivel con la herramienta resaltada
        this.cerrarBusqueda();
        this.estanteActivoId.set(rack.id);
        this.vistaActiva.set('detalle');
        this.abrirNivel(rack, nivel, t.id);
    }

    cerrar() { this.volver.emit(); }
}
