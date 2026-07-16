import { AfterViewInit, Component, ElementRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Warehouse, Rack, Level, LevelTool, LevelKit, LevelMiscelaneo } from '../interfaces';
import { GestionUbicacionesService } from '../gestion-ubicaciones.service';
import { ConfirmDeleteComponent, ConfirmDeleteData } from '../confirm-delete/confirm-delete.component';
import { MoverResult } from '../mover-herramientas/mover-herramientas.component';

export interface NivelHerramientasData {
    almacen:           Warehouse;
    todosLosAlmacenes: Warehouse[];
    estantes:          Rack[];
    rack:              Rack;
    level:             Level;
    /** id de herramienta a resaltar (cuando se llega desde el buscador global) */
    highlightToolId?:  number;
}

@Component({
    selector: 'app-nivel-herramientas-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
        @keyframes pulse-ring { 0%, 100% { box-shadow: 0 0 0 3px rgba(251,191,36,.9), 3px 3px 0 0 #000; } 50% { box-shadow: 0 0 0 6px rgba(251,191,36,.35), 3px 3px 0 0 #000; } }
        .tool-highlight { animation: pulse-ring 1.2s ease-in-out 3; }
    `],
    template: `
    <div class="flex flex-col max-h-[85vh] bg-[#f8f9fc] dark:bg-slate-900 border-[3px] border-black rounded-2xl overflow-hidden font-sans shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">

        <!-- Header -->
        <div class="bg-[#0F172AFF] text-white px-3 sm:px-4 py-2.5 flex items-center gap-2.5 sm:gap-3 border-b-2 border-black shrink-0">
            <div class="w-10 h-10 sm:w-11 sm:h-11 shrink-0 bg-amber-400 text-black border-2 border-black rounded-lg flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_0px_#000]">
                <ng-container *ngIf="!level.isFloor; else floorIcon">N{{ level.numero }}</ng-container>
                <ng-template #floorIcon><mat-icon class="!text-[20px] text-black">foundation</mat-icon></ng-template>
            </div>
            <div class="flex-1 min-w-0">
                <h2 class="text-[13px] sm:text-sm font-black uppercase tracking-tight leading-none truncate">
                    {{ level.isFloor ? 'Nivel Suelo' : ('Nivel ' + level.numero) }} · <span class="text-amber-400">{{ level.nombre }}</span>
                </h2>
                <p class="text-[9px] sm:text-[10px] text-gray-300 font-bold uppercase mt-1 truncate">
                    {{ data.almacen.codigo }} · Estante {{ rack.nombre }} · <span class="font-mono">{{ level.codigo }}</span>
                </p>
            </div>
            <span class="hidden sm:flex px-2 py-1 text-[10px] font-black uppercase border-2 border-black rounded-lg bg-white text-black items-center gap-1 shrink-0 shadow-[2px_2px_0px_0px_#000]">
                <mat-icon class="!text-[13px] !w-3.5 !h-3.5">handyman</mat-icon>
                {{ herramientas.length }}
            </span>
            <span *ngIf="kits.length" class="hidden sm:flex px-2 py-1 text-[10px] font-black uppercase border-2 border-black rounded-lg bg-blue-100 text-blue-800 items-center gap-1 shrink-0 shadow-[2px_2px_0px_0px_#000]">
                <mat-icon class="!text-[13px] !w-3.5 !h-3.5">inventory_2</mat-icon>
                {{ kits.length }}
            </span>
            <span *ngIf="miscelaneos.length" class="hidden sm:flex px-2 py-1 text-[10px] font-black uppercase border-2 border-black rounded-lg bg-purple-100 text-purple-800 items-center gap-1 shrink-0 shadow-[2px_2px_0px_0px_#000]">
                <mat-icon class="!text-[13px] !w-3.5 !h-3.5">category</mat-icon>
                {{ miscelaneos.length }}
            </span>
            <button (click)="cerrar()" matTooltip="Cerrar"
                    class="w-9 h-9 flex items-center justify-center bg-[#FF1414FF] border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all shrink-0">
                <mat-icon class="text-white !text-base">close</mat-icon>
            </button>
        </div>

        <!-- Toolbar -->
        <div class="px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 border-b-2 border-black flex items-center gap-2 shrink-0">
            <div class="relative flex-1 min-w-0">
                <input type="text" [formControl]="filtroControl" placeholder="Buscar en este nivel..."
                       class="w-full h-9 pl-8 pr-3 bg-[#f8f9fc] dark:bg-slate-900 text-black dark:text-white border-2 border-black rounded-lg font-bold text-[11px] focus:outline-none focus:shadow-[2px_2px_0px_0px_#000] transition-all">
                <mat-icon class="absolute left-2 top-2 text-black dark:text-white !text-base">search</mat-icon>
            </div>
            <button (click)="agregarHerramienta()"
                    class="shrink-0 px-3 py-2 bg-amber-400 text-black font-black text-[10px] border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all uppercase flex items-center gap-1.5">
                <mat-icon class="!text-base text-black">add</mat-icon>
                <span class="hidden sm:inline">Agregar</span>
            </button>
        </div>

        <!-- Lista de herramientas -->
        <div class="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 min-h-[220px]">
            <div class="flex flex-col gap-2 sm:gap-2.5">

                <div *ngFor="let t of herramientasFiltradas"
                     [attr.id]="'nivel-tool-' + t.id"
                     [class.tool-highlight]="t.id === highlightId()"
                     class="group relative bg-white dark:bg-slate-800 border-2 border-black rounded-xl p-2 sm:p-3 shadow-[3px_3px_0px_0px_#000] hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all flex items-center gap-2">

                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1 sm:gap-2 mb-0.5 flex-wrap">
                            <span class="font-mono text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.5 bg-gray-200 dark:bg-slate-700 border border-black rounded text-black dark:text-white">
                                {{ t.codigo }}
                            </span>
                            <span [ngClass]="[estadoBadge(t.estado).bg, estadoBadge(t.estado).tx]"
                                  class="px-1 sm:px-1.5 py-0.5 text-[7px] sm:text-[8px] font-black uppercase border border-black rounded">
                                {{ t.estado }}
                            </span>
                        </div>
                        <p class="font-black text-[11px] sm:text-[12px] leading-tight text-black dark:text-white truncate mt-0.5">{{ t.nombre }}</p>
                        <p class="text-[9px] sm:text-[10px] font-bold text-gray-500 truncate mt-0.5">
                            PN: <span class="text-gray-700 dark:text-gray-300">{{ t.pn }}</span>
                            <span *ngIf="t.sn"> | SN: <span class="text-gray-700 dark:text-gray-300">{{ t.sn }}</span></span>
                            <span *ngIf="t.marca"> | <span class="text-gray-700 dark:text-gray-300">{{ t.marca }}</span></span>
                        </p>
                    </div>

                    <div class="text-right shrink-0 px-2 sm:px-3 border-r-2 border-gray-200 dark:border-slate-700">
                        <p class="text-sm sm:text-lg font-black text-black dark:text-white leading-none">{{ t.cantidad }}</p>
                        <p class="text-[7px] sm:text-[8px] font-bold text-gray-500 uppercase mt-0.5">{{ t.um }}</p>
                    </div>

                    <div class="flex items-center justify-center gap-1 shrink-0">
                        <button (click)="editarHerramienta(t)" matTooltip="Editar"
                                class="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center bg-amber-400 border-2 border-black rounded shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-none transition-all">
                            <mat-icon class="!text-[12px] sm:!text-[14px] text-black">edit</mat-icon>
                        </button>
                        <button (click)="moverHerramienta(t)" matTooltip="Mover"
                                class="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center bg-blue-500 border-2 border-black rounded shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-none transition-all">
                            <mat-icon class="!text-[12px] sm:!text-[14px] text-white">swap_horiz</mat-icon>
                        </button>
                        <button (click)="quitarHerramienta(t)" matTooltip="Quitar del nivel"
                                class="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center bg-[#FF1414FF] border-2 border-black rounded shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-none transition-all">
                            <mat-icon class="!text-[12px] sm:!text-[14px] text-white">remove_circle</mat-icon>
                        </button>
                    </div>
                </div>

                <div *ngIf="!herramientasFiltradas.length"
                     class="text-center py-10 sm:py-12 bg-white dark:bg-slate-800 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-xl">
                    <mat-icon class="!text-5xl text-gray-300 dark:text-gray-600">handyman</mat-icon>
                    <p class="text-xs font-black uppercase text-gray-500 mt-3">
                        {{ herramientas.length === 0 ? 'Nivel sin herramientas' : 'Sin resultados para la búsqueda' }}
                    </p>
                    <button *ngIf="herramientas.length === 0" (click)="agregarHerramienta()"
                            class="mt-4 px-4 py-2 bg-amber-400 text-black font-black text-[10px] border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-none transition-all uppercase inline-flex items-center gap-1.5">
                        <mat-icon class="!text-base text-black">add</mat-icon>
                        Agregar la primera
                    </button>
                </div>

                <!-- Kits asignados a este nivel -->
                <ng-container *ngIf="kitsFiltrados.length">
                    <div class="flex items-center gap-2 mt-2 mb-0.5">
                        <mat-icon class="!text-[14px] !w-3.5 !h-3.5 text-blue-700">inventory_2</mat-icon>
                        <span class="text-[10px] font-black uppercase text-gray-500">Kits en este nivel</span>
                    </div>

                    <div *ngFor="let k of kitsFiltrados"
                         class="group relative bg-blue-50 dark:bg-slate-800 border-2 border-black rounded-xl p-2 sm:p-3 shadow-[3px_3px_0px_0px_#000] hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all flex items-center gap-2">

                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1 sm:gap-2 mb-0.5 flex-wrap">
                                <span class="font-mono text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.5 bg-blue-200 dark:bg-slate-700 border border-black rounded text-black dark:text-white">
                                    {{ k.codigo }}
                                </span>
                                <span class="px-1 sm:px-1.5 py-0.5 text-[7px] sm:text-[8px] font-black uppercase border border-black rounded"
                                      [ngClass]="k.isComplete ? 'bg-green-500 text-white' : 'bg-[#FF1414FF] text-white'">
                                    {{ k.isComplete ? 'COMPLETO' : 'INCOMPLETO' }}
                                </span>
                            </div>
                            <p class="font-black text-[11px] sm:text-[12px] leading-tight text-black dark:text-white truncate mt-0.5">{{ k.nombre }}</p>
                            <p class="text-[9px] sm:text-[10px] font-bold text-gray-500 truncate mt-0.5">
                                {{ k.presentComponents }}/{{ k.totalComponents }} componentes
                                <span *ngIf="k.funcionarioNombre"> · {{ k.funcionarioNombre }}</span>
                            </p>
                        </div>

                        <div class="flex items-center justify-center gap-1 shrink-0">
                            <button (click)="moverKit(k)" matTooltip="Mover kit"
                                    class="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center bg-blue-500 border-2 border-black rounded shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-none transition-all">
                                <mat-icon class="!text-[12px] sm:!text-[14px] text-white">swap_horiz</mat-icon>
                            </button>
                        </div>
                    </div>
                </ng-container>

                <!-- Misceláneos asignados a este nivel -->
                <ng-container *ngIf="miscelaneosFiltrados.length">
                    <div class="flex items-center gap-2 mt-2 mb-0.5">
                        <mat-icon class="!text-[14px] !w-3.5 !h-3.5 text-purple-700">category</mat-icon>
                        <span class="text-[10px] font-black uppercase text-gray-500">Misceláneos en este nivel</span>
                    </div>

                    <div *ngFor="let m of miscelaneosFiltrados"
                         class="group relative bg-purple-50 dark:bg-slate-800 border-2 border-black rounded-xl p-2 sm:p-3 shadow-[3px_3px_0px_0px_#000] hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all flex items-center gap-2">

                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1 sm:gap-2 mb-0.5 flex-wrap">
                                <span class="font-mono text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.5 bg-purple-200 dark:bg-slate-700 border border-black rounded text-black dark:text-white">
                                    {{ m.codigo }}
                                </span>
                                <span *ngIf="m.itemType" class="px-1 sm:px-1.5 py-0.5 text-[7px] sm:text-[8px] font-black uppercase border border-black rounded bg-gray-200 text-black">
                                    {{ m.itemType }}
                                </span>
                            </div>
                            <p class="font-black text-[11px] sm:text-[12px] leading-tight text-black dark:text-white truncate mt-0.5">{{ m.nombre }}</p>
                        </div>

                        <div class="text-right shrink-0 px-2 sm:px-3 border-r-2 border-gray-200 dark:border-slate-700">
                            <p class="text-sm sm:text-lg font-black text-black dark:text-white leading-none">{{ m.quantityInStock }}</p>
                            <p class="text-[7px] sm:text-[8px] font-bold text-gray-500 uppercase mt-0.5">{{ m.unitOfMeasure }}</p>
                        </div>

                        <div class="flex items-center justify-center gap-1 shrink-0">
                            <button (click)="moverMiscelaneo(m)" matTooltip="Mover misceláneo"
                                    class="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center bg-blue-500 border-2 border-black rounded shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-none transition-all">
                                <mat-icon class="!text-[12px] sm:!text-[14px] text-white">swap_horiz</mat-icon>
                            </button>
                        </div>
                    </div>
                </ng-container>
            </div>
        </div>
    </div>
    `,
})
export class NivelHerramientasDialogComponent implements AfterViewInit {

    dialogRef        = inject(MatDialogRef<NivelHerramientasDialogComponent>);
    data             = inject<NivelHerramientasData>(MAT_DIALOG_DATA);
    private dialog   = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private svc      = inject(GestionUbicacionesService);
    private host     = inject(ElementRef);

    rack  = this.data.rack;
    level = this.data.level;

    filtroControl = new FormControl('');
    highlightId   = signal<number | null>(this.data.highlightToolId ?? null);

    /** true si hubo algún cambio (el padre recarga al cerrar) */
    private changed = false;

    get herramientas(): LevelTool[] {
        return this.level.tools ?? [];
    }

    get herramientasFiltradas(): LevelTool[] {
        const q = (this.filtroControl.value ?? '').toString().trim().toLowerCase();
        if (!q) return this.herramientas;
        return this.herramientas.filter(t =>
            `${t.codigo} ${t.pn} ${t.sn ?? ''} ${t.nombre} ${t.marca ?? ''}`.toLowerCase().includes(q)
        );
    }

    get kits(): LevelKit[] {
        return this.level.kits ?? [];
    }

    get kitsFiltrados(): LevelKit[] {
        const q = (this.filtroControl.value ?? '').toString().trim().toLowerCase();
        if (!q) return this.kits;
        return this.kits.filter(k => `${k.codigo} ${k.nombre}`.toLowerCase().includes(q));
    }

    get miscelaneos(): LevelMiscelaneo[] {
        return this.level.miscelaneos ?? [];
    }

    get miscelaneosFiltrados(): LevelMiscelaneo[] {
        const q = (this.filtroControl.value ?? '').toString().trim().toLowerCase();
        if (!q) return this.miscelaneos;
        return this.miscelaneos.filter(m => `${m.codigo} ${m.nombre}`.toLowerCase().includes(q));
    }

    ngAfterViewInit(): void {
        const id = this.highlightId();
        if (id == null) return;
        setTimeout(() => {
            const el = (this.host.nativeElement as HTMLElement).querySelector(`#nivel-tool-${id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
    }

    cerrar(): void {
        this.dialogRef.close(this.changed);
    }

    estadoBadge(estado: string): { bg: string; tx: string } {
        switch (estado) {
            case 'NUEVO':           return { bg: 'bg-green-500',   tx: 'text-white' };
            case 'REACONDICIONADO': return { bg: 'bg-blue-700',    tx: 'text-white' };
            case 'USADO':           return { bg: 'bg-[#FF1414FF]', tx: 'text-white' };
            default:                return { bg: 'bg-gray-200',    tx: 'text-gray-900' };
        }
    }

    /* ════════ Acciones ════════ */

    async agregarHerramienta() {
        const { FormHerramientaNivelComponent } = await import('../form-herramienta-nivel/form-herramienta-nivel.component');
        const ref = this.dialog.open(FormHerramientaNivelComponent, {
            width: '720px', maxWidth: '95vw', panelClass: 'no-padding-dialog',
            data: { mode: 'new', rack: this.rack, level: this.level }
        });
        ref.afterClosed().subscribe((tool: LevelTool | null) => {
            if (!tool) return;
            this.svc.findToolByCode(tool.codigo).subscribe({
                next: (existing) => {
                    if (existing?.levelId) {
                        const rack  = existing.rackCodigo  ?? `#${existing.rackId}`;
                        const nivel = existing.levelCodigo ?? `#${existing.levelId}`;
                        this.snackBar.open(
                            `"${tool.codigo}" ya está asignada en Estante ${rack} · Nivel ${nivel}. Desasígnala primero o usa Traspaso.`,
                            'Cerrar',
                            { duration: 7000 }
                        );
                        return;
                    }
                    this.doInsertTool(tool);
                },
                error: () => this.doInsertTool(tool),
            });
        });
    }

    private doInsertTool(tool: LevelTool): void {
        this.svc.insertLevelTool(tool, this.data.almacen.id).subscribe({
            next: (res: any) => {
                if (res?.error) {
                    this.snackBar.open(res.message ?? 'Error al agregar herramienta', 'Cerrar', { duration: 6000 });
                    return;
                }
                this.changed = true;
                this.snackBar.open('Herramienta agregada al nivel', 'Cerrar', { duration: 2500 });
                this.refrescarNivel();
            },
            error: (err: any) => {
                const msg = typeof err === 'string' ? err
                    : err?.message ?? err?.error?.message ?? 'Error al agregar herramienta';
                this.snackBar.open(msg, 'Cerrar', { duration: 6000 });
            },
        });
    }

    /** Recarga solo las herramientas de este nivel (1 request al rack) */
    private refrescarNivel(): void {
        this.svc.getLevelTools(this.rack.id).subscribe({
            next: (tools) => { this.level.tools = tools.filter(t => t.levelId === this.level.id); },
            error: () => { /* la recarga completa ocurre al cerrar el diálogo */ },
        });
    }

    async editarHerramienta(tool: LevelTool) {
        const { FormHerramientaNivelComponent } = await import('../form-herramienta-nivel/form-herramienta-nivel.component');
        const ref = this.dialog.open(FormHerramientaNivelComponent, {
            width: '720px', maxWidth: '95vw', panelClass: 'no-padding-dialog',
            data: { mode: 'edit', rack: this.rack, level: this.level, tool }
        });
        ref.afterClosed().subscribe((updated: LevelTool | null) => {
            if (!updated) return;
            const payload: LevelTool = { ...updated, id: tool.id, levelId: tool.levelId, rackId: tool.rackId };
            this.svc.updateLevelTool(payload).subscribe({
                next: () => {
                    Object.assign(tool, payload);
                    this.changed = true;
                    this.snackBar.open('Herramienta actualizada', 'Cerrar', { duration: 2500 });
                },
                error: () => this.snackBar.open('Error al actualizar herramienta', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    async moverHerramienta(tool: LevelTool) {
        const racksByAlmacen: Record<number, Rack[]> = {};
        racksByAlmacen[this.data.almacen.id] = this.data.estantes;

        const { MoverHerramientasComponent } = await import('../mover-herramientas/mover-herramientas.component');
        const ref = this.dialog.open(MoverHerramientasComponent, {
            width: '600px', maxWidth: '95vw', panelClass: 'no-padding-dialog',
            data: {
                count: 1,
                almacenes: this.data.todosLosAlmacenes,
                racksByAlmacen,
                currentLevelId:   tool.levelId,
                currentRackCode:  tool.rackCodigo,
                currentAlmacenId: this.data.almacen.id,
            }
        });
        ref.afterClosed().subscribe((res: MoverResult | undefined) => {
            if (!res) return;
            this.svc.moveLevelTool(tool.id, res.rackId, res.levelId).subscribe({
                next: () => {
                    this.level.tools = (this.level.tools ?? []).filter(t => t.id !== tool.id);
                    this.changed = true;
                    this.snackBar.open(`Herramienta movida a ${res.levelCodigo}`, 'Cerrar', { duration: 3000 });
                },
                error: () => this.snackBar.open('Error al mover herramienta', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    async moverKit(kit: LevelKit) {
        const racksByAlmacen: Record<number, Rack[]> = {};
        racksByAlmacen[this.data.almacen.id] = this.data.estantes;

        const { MoverHerramientasComponent } = await import('../mover-herramientas/mover-herramientas.component');
        const ref = this.dialog.open(MoverHerramientasComponent, {
            width: '600px', maxWidth: '95vw', panelClass: 'no-padding-dialog',
            data: {
                count: 1,
                almacenes: this.data.todosLosAlmacenes,
                racksByAlmacen,
                currentLevelId:   kit.levelId,
                currentRackCode:  kit.rackCodigo,
                currentAlmacenId: this.data.almacen.id,
            }
        });
        ref.afterClosed().subscribe((res: MoverResult | undefined) => {
            if (!res) return;
            this.svc.moveKit(kit.id, res.rackId, res.levelId).subscribe({
                next: () => {
                    this.level.kits = (this.level.kits ?? []).filter(k => k.id !== kit.id);
                    this.changed = true;
                    this.snackBar.open(`Kit movido a ${res.levelCodigo}`, 'Cerrar', { duration: 3000 });
                },
                error: () => this.snackBar.open('Error al mover kit', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    async moverMiscelaneo(item: LevelMiscelaneo) {
        const racksByAlmacen: Record<number, Rack[]> = {};
        racksByAlmacen[this.data.almacen.id] = this.data.estantes;

        const { MoverHerramientasComponent } = await import('../mover-herramientas/mover-herramientas.component');
        const ref = this.dialog.open(MoverHerramientasComponent, {
            width: '600px', maxWidth: '95vw', panelClass: 'no-padding-dialog',
            data: {
                count: 1,
                almacenes: this.data.todosLosAlmacenes,
                racksByAlmacen,
                currentLevelId:   item.levelId,
                currentRackCode:  item.rackCodigo,
                currentAlmacenId: this.data.almacen.id,
            }
        });
        ref.afterClosed().subscribe((res: MoverResult | undefined) => {
            if (!res) return;
            this.svc.moveMiscelaneo(item.id, res.rackId, res.levelId).subscribe({
                next: () => {
                    this.level.miscelaneos = (this.level.miscelaneos ?? []).filter(m => m.id !== item.id);
                    this.changed = true;
                    this.snackBar.open(`Misceláneo movido a ${res.levelCodigo}`, 'Cerrar', { duration: 3000 });
                },
                error: () => this.snackBar.open('Error al mover misceláneo', 'Cerrar', { duration: 3500 }),
            });
        });
    }

    quitarHerramienta(tool: LevelTool) {
        const data: ConfirmDeleteData = {
            itemKind: 'herramienta',
            itemCode: tool.codigo,
            itemName: 'Será desasignada del nivel actual',
            warning: 'La herramienta seguirá existiendo en inventario sin ubicación asignada.',
        };
        this.dialog.open(ConfirmDeleteComponent, { width: '420px', maxWidth: '95vw', panelClass: 'no-padding-dialog', data, hasBackdrop: true })
            .afterClosed().subscribe(ok => {
                if (!ok) return;
                this.svc.unassignLevelTool(tool.id).subscribe({
                    next: () => {
                        this.level.tools = (this.level.tools ?? []).filter(t => t.id !== tool.id);
                        this.changed = true;
                        this.snackBar.open('Herramienta desasignada', 'Cerrar', { duration: 2500 });
                    },
                    error: () => this.snackBar.open('Error al desasignar', 'Cerrar', { duration: 3500 }),
                });
            });
    }
}
