import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { Warehouse, Rack, Level, LevelTool } from '../interfaces';
import { ConfirmDeleteComponent, ConfirmDeleteData } from '../confirm-delete/confirm-delete.component';
import { MoverResult } from '../mover-herramientas/mover-herramientas.component';
import { GestionUbicacionesService } from '../gestion-ubicaciones.service';

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

        /* Estante 3D */
        .estante-3d { perspective: 1000px; }
        .estante-3d-inner {
            transform: rotateX(8deg) rotateY(-8deg);
            transform-style: preserve-3d;
            transition: transform 0.3s ease;
        }
        .estante-3d-inner:hover { transform: rotateX(5deg) rotateY(-5deg); }
        .nivel-3d {
            transform: translateZ(0);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .nivel-3d:hover { transform: translateZ(10px); }
        .nivel-3d.activo { transform: translateZ(16px); }
    `]
})
export class GestionEstantesComponent implements OnInit, OnChanges {

    private dialog   = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private svc      = inject(GestionUbicacionesService);

    @Input({ required: true }) almacen!: Warehouse;
    @Input() todosLosAlmacenes: Warehouse[] = [];
    @Output() volver = new EventEmitter<void>();

    vistaActiva = signal<'tabla' | 'detalle'>('tabla');

    estantes: Rack[] = [];
    estanteActivoId = signal<number | null>(null);
    nivelActivoId   = signal<number | null>(null);

    selectedToolIds = signal<Set<number>>(new Set());

    searchControl     = new FormControl('');
    toolSearchControl = new FormControl('');

    get estanteActivo(): Rack | undefined {
        return this.estantes.find(r => r.id === this.estanteActivoId());
    }

    get nivelActivo(): Level | undefined {
        const estante = this.estanteActivo;
        if (!estante || !this.nivelActivoId()) return undefined;
        return estante.niveles.find(n => n.id === this.nivelActivoId());
    }

    ngOnInit() {
        if (!this.todosLosAlmacenes.length) this.todosLosAlmacenes = [this.almacen];
        this.cargarEstantes();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['almacen'] && !changes['almacen'].isFirstChange()) {
            this.estantes = [];
            this.vistaActiva.set('tabla');
            this.estanteActivoId.set(null);
            this.nivelActivoId.set(null);
            this.selectedToolIds.set(new Set());
            this.cargarEstantes();
        }
    }

    cargarEstantes() {
        this.svc.getRacks(this.almacen.id).subscribe({
            next: (racks) => {
                if (!racks || racks.length === 0) {
                    this.estantes = [];
                    return;
                }
                forkJoin(racks.map(r =>
                    this.svc.getLevels(r.id).pipe(
                        map(levels => ({ ...r, niveles: levels })),
                        catchError(() => of({ ...r, niveles: [] as Level[] })),
                    )
                )).subscribe(racksFull => {
                    forkJoin(racksFull.map(r =>
                        this.svc.getLevelTools(r.id).pipe(
                            map(tools => {
                                const niveles = r.niveles.map(lv => ({
                                    ...lv,
                                    tools: tools.filter(t => t.levelId === lv.id),
                                }));
                                return { ...r, niveles };
                            }),
                            catchError(() => of({ ...r, niveles: r.niveles.map(lv => ({ ...lv, tools: [] as LevelTool[] })) })),
                        )
                    )).subscribe(racksWithTools => {
                        this.estantes = racksWithTools;
                    });
                });
            },
            error: (err) => {
                console.error('Error cargando estantes', err);
                this.estantes = [];
                this.snackBar.open('No se pudieron cargar los estantes', 'Cerrar', { duration: 3500 });
            }
        });
    }

    get estantesFiltrados(): Rack[] {
        const q = (this.searchControl.value ?? '').toString().trim().toLowerCase();
        if (!q) return this.estantes;
        return this.estantes.filter(r => `${r.codigo} ${r.nombre} ${r.descripcion}`.toLowerCase().includes(q));
    }

    verDetalleEstante(r: Rack) {
        this.estanteActivoId.set(r.id);
        this.nivelActivoId.set(null);
        this.selectedToolIds.set(new Set());
        this.vistaActiva.set('detalle');
    }

    volverAEstantes() {
        this.vistaActiva.set('tabla');
        this.estanteActivoId.set(null);
        this.nivelActivoId.set(null);
        this.selectedToolIds.set(new Set());
    }

    seleccionarNivel(l: Level) {
        this.nivelActivoId.set(this.nivelActivoId() === l.id ? null : l.id);
        this.selectedToolIds.set(new Set());
    }

    get herramientasVisibles(): LevelTool[] {
        const r = this.estanteActivo;
        if (!r) return [];
        const niveles = this.nivelActivoId()
            ? r.niveles.filter(n => n.id === this.nivelActivoId())
            : r.niveles;
        const all = niveles.flatMap(n => n.tools ?? []);
        const q = (this.toolSearchControl.value ?? '').toString().trim().toLowerCase();
        if (!q) return all;
        return all.filter(t => `${t.codigo} ${t.pn} ${t.sn ?? ''} ${t.nombre} ${t.marca ?? ''}`.toLowerCase().includes(q));
    }

    /* ════════ Acciones Inline Herramientas ════════ */

    canAdd(): boolean { return !!this.nivelActivoId(); }

    async agregarHerramienta() {
        const r = this.estanteActivo;
        const lvl = r?.niveles.find(n => n.id === this.nivelActivoId());
        if (!r || !lvl) return;

        const { FormHerramientaNivelComponent } = await import('../form-herramienta-nivel/form-herramienta-nivel.component');
        const ref = this.dialog.open(FormHerramientaNivelComponent, {
            data: { mode: 'new', rack: r, level: lvl }
        });
        ref.afterClosed().subscribe((tool: LevelTool | null) => {
            if (!tool) return;
            this.svc.insertLevelTool(tool, this.almacen.id).subscribe({
                next: () => {
                    this.snackBar.open('Herramienta agregada al nivel', 'Cerrar', { duration: 2500 });
                    this.cargarEstantes();
                },
                error: () => this.snackBar.open('Error al agregar herramienta', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    async editarHerramientaInline(tool: LevelTool, ev: Event) {
        ev.stopPropagation();
        const found = this.findToolById(tool.id);
        if (!found) return;
        const { rack, level } = found;

        const { FormHerramientaNivelComponent } = await import('../form-herramienta-nivel/form-herramienta-nivel.component');
        const ref = this.dialog.open(FormHerramientaNivelComponent, {
            data: { mode: 'edit', rack, level, tool }
        });
        ref.afterClosed().subscribe((updated: LevelTool | null) => {
            if (!updated) return;
            const payload: LevelTool = { ...updated, id: tool.id, levelId: tool.levelId, rackId: tool.rackId };
            this.svc.updateLevelTool(payload).subscribe({
                next: () => {
                    Object.assign(tool, payload);
                    this.snackBar.open('Herramienta actualizada', 'Cerrar', { duration: 2500 });
                },
                error: () => this.snackBar.open('Error al actualizar herramienta', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    async moverHerramientaInline(tool: LevelTool, ev: Event) {
        ev.stopPropagation();

        const racksByAlmacen: Record<number, Rack[]> = {};
        racksByAlmacen[this.almacen.id] = this.estantes;

        const { MoverHerramientasComponent } = await import('../mover-herramientas/mover-herramientas.component');
        const ref = this.dialog.open(MoverHerramientasComponent, {
            data: {
                count: 1,
                almacenes: this.todosLosAlmacenes,
                racksByAlmacen,
                currentLevelId:  tool.levelId,
                currentRackCode: tool.rackCodigo,
            }
        });
        ref.afterClosed().subscribe((res: MoverResult | undefined) => {
            if (!res) return;
            this.svc.moveLevelTool(tool.id, res.rackId, res.levelId).subscribe({
                next: () => {
                    this.snackBar.open(`Herramienta movida a ${res.levelCodigo}`, 'Cerrar', { duration: 3000 });
                    if (res.warehouseId === this.almacen.id) {
                        this.cargarEstantes();
                    }
                },
                error: () => this.snackBar.open('Error al mover herramienta', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    quitarHerramientaInline(tool: LevelTool, ev: Event) {
        ev.stopPropagation();

        const data: ConfirmDeleteData = {
            itemKind: 'herramienta',
            itemCode: tool.codigo,
            itemName: 'Será desasignada del nivel actual',
            warning: 'La herramienta seguirá existiendo en inventario sin ubicación asignada.',
        };
        this.dialog.open(ConfirmDeleteComponent, {data, hasBackdrop: true })
            .afterClosed().subscribe(ok => {
            if (!ok) return;
            this.svc.unassignLevelTool(tool.id).subscribe({
                next: () => {
                    const f = this.findToolById(tool.id);
                    if (f) f.level.tools = (f.level.tools ?? []).filter(t => t.id !== tool.id);
                    this.snackBar.open('Herramienta desasignada', 'Cerrar', { duration: 2500 });
                },
                error: () => this.snackBar.open('Error al desasignar', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    /* ════════ Helpers ════════ */

    private nextToolId(): number {
        let max = 0;
        this.estantes.forEach(r => r.niveles.forEach(n => (n.tools ?? []).forEach(t => { if (t.id > max) max = t.id; })));
        return max + 1;
    }

    private findToolById(id: number): { tool: LevelTool; level: Level; rack: Rack } | null {
        for (const rack of this.estantes) {
            for (const level of rack.niveles) {
                const tool = (level.tools ?? []).find(t => t.id === id);
                if (tool) return { tool, level, rack };
            }
        }
        return null;
    }

    nivelClass(l: Level): string {
        return this.nivelActivoId() === l.id ? 'activo' : '';
    }

    contarHerramientas(r: Rack): number {
        return r.niveles.reduce((acc, n) => acc + (n.tools?.length ?? 0), 0);
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
        const ref = this.dialog.open(FormEstanteComponent, { width: '750px', maxWidth: '95vw', data: { mode: 'new', warehouse: this.almacen } });
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
        const ref = this.dialog.open(FormEstanteComponent, { width: '750px', maxWidth: '95vw', data: { mode: 'edit', warehouse: this.almacen, rack: r } });
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
        this.dialog.open(ConfirmDeleteComponent, { data, hasBackdrop: true }).afterClosed().subscribe(ok => {
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
        const regularCount = r.niveles.filter(n => !n.isFloor).length;
        const ref = this.dialog.open(FormNivelComponent, { width: '610px', maxWidth: '95vw', data: { mode: 'new', rack: r, suggestedNumero: regularCount } });
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
        const ref = this.dialog.open(FormNivelComponent, { width: '610px', maxWidth: '95vw', data: { mode: 'edit', rack: r, level: l } });
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
        this.dialog.open(ConfirmDeleteComponent, { data, hasBackdrop: true }).afterClosed().subscribe(ok => {
            if (!ok) return;
            this.svc.deleteLevel(l.id).subscribe({
                next: () => {
                    r.niveles = r.niveles.filter(n => n.id !== l.id);
                    if (this.nivelActivoId() === l.id) this.nivelActivoId.set(null);
                    this.snackBar.open('Nivel eliminado', 'Cerrar', { duration: 2500 });
                },
                error: () => this.snackBar.open('Error al eliminar nivel', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    cerrar() { this.volver.emit(); }
}
