import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { KitsService } from '../../../../core/services/kits.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

interface Kit {
    id: number;
    nombre: string;
    descripcion: string;
    cantidadItems: number;
    ubicacion?: string;
    ultimaActualizacion: Date;
    items?: KitItem[];
    categoria: string;
    modelo?: string;
    estado: string;
    responsable?: string;
    cantidadUsos?: number;
    activo: boolean;
    _raw?: any;
}

interface KitItem {
    nroArt: string;
    descripcion: string;
    codigoBoamm: string;
    ubicacion: string;
    estado?: 'DISPONIBLE' | 'EN USO' | 'CALIBRACION';
}

@Component({
    selector: 'app-lista-kits',
    standalone: true,
    imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule, MatTooltipModule, HasPermissionDirective],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] transition-colors duration-300 font-sans overflow-hidden">

        <div class="fixed top-20 right-10 w-40 h-40 bg-[#0F172AFF] rounded-full border-[3px] border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-24 h-24 bg-[#FFC501FF] rotate-12 border-[3px] border-black opacity-5 pointer-events-none"></div>

        <div class="flex-1 flex flex-col p-4 gap-3 overflow-hidden relative z-10">

            <!-- Banner de éxito préstamo -->
            <div *ngIf="prestamoMsg()"
                 class="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-green-100 border-2 border-green-700 rounded-xl shadow-[2px_2px_0_#15803d] text-green-800 font-black text-xs uppercase">
                <mat-icon class="!text-base text-green-700 shrink-0">check_circle</mat-icon>
                {{ prestamoMsg() }}
            </div>

            <!-- ══════════ HEADER ══════════ -->
            <div class="flex flex-col gap-3 shrink-0">

                <!-- Título principal -->
                <div class="flex items-center gap-4">
                    <div class="flex items-center justify-center w-10 h-10 bg-white dark:bg-[#0F172AFF] border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-xl shrink-0">
                        <mat-icon class="text-black dark:text-[#FFC501FF] !text-base">construction</mat-icon>
                    </div>
                    <div>
                        <h1 class="text-xl font-black text-black dark:text-white uppercase tracking-tighter leading-none">
                            GESTIÓN DE KITS
                        </h1>
                        <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p class="text-[10px] font-bold bg-[#FFC501FF] text-black px-2 py-0.5 inline-block border-2 border-black rounded uppercase tracking-wider">
                                Inventario de Kits · Herramientas
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Botones debajo del título -->
                <div class="flex items-center gap-3 flex-wrap">
                    <div class="relative">
                        <input type="text" [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)"
                               placeholder="Buscar kit, responsable..."
                               class="w-52 h-9 pl-9 pr-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white
                                      border-[2px] border-black rounded-lg font-black text-xs uppercase
                                      focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-y-[1px] transition-all
                                      placeholder:font-bold placeholder:normal-case">
                        <mat-icon class="absolute left-2.5 top-2 text-black dark:text-white !text-sm">search</mat-icon>
                    </div>

                    <select [ngModel]="selectedCategoria()" (ngModelChange)="selectedCategoria.set($event)"
                            class="h-9 px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white
                                   border-[2px] border-black rounded-lg font-black text-xs uppercase
                                   focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] transition-all cursor-pointer">
                        <option value="todas">Todas las categorías</option>
                        <option *ngFor="let c of categorias" [value]="c">{{ c }}</option>
                    </select>

                    <select [ngModel]="selectedEstado()" (ngModelChange)="selectedEstado.set($event)"
                            class="h-9 px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white
                                   border-[2px] border-black rounded-lg font-black text-xs uppercase
                                   focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] transition-all cursor-pointer">
                        <option value="todos">Todos los estados</option>
                        <option *ngFor="let e of estados" [value]="e">{{ e }}</option>
                    </select>

                    <button (click)="abrirCategorias()"
                            class="h-9 px-3 font-black text-xs bg-white dark:bg-[#0F172AFF] text-black dark:text-white
                                   border-[2px] border-black rounded-xl
                                   shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px]
                                   hover:shadow-none transition-all uppercase flex items-center gap-2">
                        <mat-icon class="!text-sm">category</mat-icon>
                        <span class="hidden sm:inline">Categorías</span>
                    </button>

                    <button *appHasPermission="'kits.create'" (click)="crearNuevoKit()"
                            class="px-5 py-2 bg-[#FFC501FF] text-black font-black text-xs
                                   border-[2px] border-black rounded-xl
                                   shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px]
                                   hover:shadow-none transition-all uppercase flex items-center gap-2">
                        <mat-icon class="!text-sm text-black">add_circle</mat-icon>
                        <span class="hidden sm:inline">Nuevo Kit</span>
                    </button>
                </div>
            </div>


            <!-- ══════════ CARD TABLA ══════════ -->
            <div class="flex-1 flex flex-col overflow-hidden border-[3px] border-black bg-white dark:bg-[#0F172AFF] rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">

                <!-- Cabecera oscura con chips -->
                <div class="px-4 py-2.5 bg-[#0F172AFF] border-b-[3px] border-black flex items-center justify-between shrink-0 flex-wrap gap-2">
                    <h2 class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <mat-icon class="!text-base text-[#FFC501FF]">construction</mat-icon>
                        KITS REGISTRADOS ({{ kitsFiltrados().length }})
                    </h2>

                    <div class="flex items-center gap-3">
                        <div class="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5 border border-black">
                            <div class="w-5 h-5 bg-[#0F172AFF] border border-black rounded flex items-center justify-center">
                                <mat-icon class="!text-xs text-[#FFC501FF]">inventory_2</mat-icon>
                            </div>
                            <div>
                                <div class="text-[8px] font-black uppercase text-white leading-none">Total</div>
                                <div class="text-sm font-black text-white leading-none">{{ kits().length }}</div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 bg-green-600/30 rounded-lg px-3 py-1.5 border border-black">
                            <div class="w-5 h-5 bg-green-600 border border-black rounded flex items-center justify-center">
                                <mat-icon class="!text-xs text-black">check_circle</mat-icon>
                            </div>
                            <div>
                                <div class="text-[8px] font-black uppercase text-white leading-none">Completos</div>
                                <div class="text-sm font-black text-white leading-none">{{ stats().kitsCompletos }}</div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 bg-blue-500/30 rounded-lg px-3 py-1.5 border border-black">
                            <div class="w-5 h-5 bg-blue-500 border border-black rounded flex items-center justify-center">
                                <mat-icon class="!text-xs text-black">engineering</mat-icon>
                            </div>
                            <div>
                                <div class="text-[8px] font-black uppercase text-white leading-none">En Uso</div>
                                <div class="text-sm font-black text-white leading-none">{{ stats().kitsEnUso }}</div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 bg-amber-500/30 rounded-lg px-3 py-1.5 border border-black">
                            <div class="w-5 h-5 bg-amber-500 border border-black rounded flex items-center justify-center">
                                <mat-icon class="!text-xs text-black">build</mat-icon>
                            </div>
                            <div>
                                <div class="text-[8px] font-black uppercase text-white leading-none">Herram.</div>
                                <div class="text-sm font-black text-white leading-none">{{ stats().totalItems }}</div>
                            </div>
                        </div>

                        <button (click)="cargarKits()" matTooltip="Recargar lista"
                                class="w-7 h-7 flex items-center justify-center rounded-lg border border-white/30 text-white hover:bg-white/20 transition-all disabled:opacity-40">
                            <mat-icon class="!text-base text-[#FFC501FF]">refresh</mat-icon>
                        </button>
                    </div>
                </div>

                <!-- TABLA -->
                <div class="flex-1 overflow-auto custom-scrollbar">
                    <table class="w-full">
                        <thead class="bg-gray-100 dark:bg-slate-800 border-b-[2px] border-black sticky top-0 z-10">
                        <tr class="text-left text-[10px] font-black uppercase tracking-wider text-black dark:text-white">
                            <th class="px-4 py-3">#</th>
                            <th class="px-4 py-3">Kit</th>
                            <th class="px-4 py-3 text-center">Categoría</th>
                            <th class="px-4 py-3">Ubicación / Resp.</th>
                            <th class="px-4 py-3 text-center">Items</th>
                            <th class="px-4 py-3 text-center">Estado</th>
                            <th class="px-4 py-3 text-center">Acciones</th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr *ngFor="let kit of (isLoading() ? [] : kitsPagina())"
                            (click)="verDetalle(kit)"
                            class="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer transition-all">

                            <td class="px-4 py-3 font-mono text-xs font-black text-black dark:text-white whitespace-nowrap">
                                #{{ kit.id }}
                            </td>

                            <td class="px-4 py-3">
                                <div class="font-bold text-sm text-black dark:text-white">{{ kit.nombre }}</div>
                                <div class="text-[10px] text-gray-500 mt-0.5 line-clamp-1" *ngIf="kit.descripcion">{{ kit.descripcion }}</div>
                            </td>

                            <td class="px-4 py-3 text-center">
                                <span class="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black rounded text-white"
                                      [ngClass]="getCategoriaClass(kit.categoria)">
                                    {{ kit.categoria }}
                                </span>
                            </td>

                            <td class="px-4 py-3 text-xs text-black dark:text-white">
                                <div class="font-bold flex items-center gap-1">
                                    <mat-icon class="!text-xs shrink-0">place</mat-icon>
                                    {{ kit.ubicacion || '—' }}
                                </div>
                                <div class="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5" *ngIf="kit.responsable">
                                    <mat-icon class="!text-xs shrink-0">person</mat-icon>
                                    {{ kit.responsable }}
                                </div>
                            </td>

                            <td class="px-4 py-3 text-center">
                                <div class="inline-flex items-center gap-1 px-2 py-0.5 border-2 border-black rounded bg-white dark:bg-slate-700">
                                    <mat-icon class="!text-[12px] !w-3 !h-3 text-black dark:text-white">build</mat-icon>
                                    <span class="text-[10px] font-black text-black dark:text-white">{{ kit.cantidadItems }}</span>
                                </div>
                            </td>

                            <td class="px-4 py-3 text-center">
                                <span class="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black rounded"
                                      [ngClass]="getEstadoClass(kit.estado)">
                                    {{ kit.estado }}
                                </span>
                            </td>

                            <td class="px-4 py-3" (click)="$event.stopPropagation()">
                                <div class="flex gap-1.5 justify-center">
                                    <button (click)="verDetalle(kit)"
                                            matTooltip="Ver ficha técnica"
                                            class="w-7 h-7 flex items-center justify-center bg-blue-950 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                                        <mat-icon class="!text-sm text-white">visibility</mat-icon>
                                    </button>
                                    <button *appHasPermission="'kits.edit'" (click)="editarKit(kit)"
                                            matTooltip="Editar kit"
                                            class="w-7 h-7 flex items-center justify-center bg-[#FFC501FF] border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                                        <mat-icon class="!text-sm text-black">edit</mat-icon>
                                    </button>
                                    <!-- Prestar: visible cuando el kit no está EN USO y está activo -->
                                    <ng-container *appHasPermission="'kits.prestar'">
                                        <button *ngIf="kit.estado !== 'EN USO' && kit.activo"
                                                (click)="prestarKit(kit)"
                                                matTooltip="Prestar kit"
                                                class="w-7 h-7 flex items-center justify-center bg-blue-500 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                                            <mat-icon class="!text-sm text-white">send</mat-icon>
                                        </button>
                                    </ng-container>
                                    <!-- Devolver: visible cuando el kit está EN USO -->
                                    <ng-container *appHasPermission="'kits.devolver'">
                                        <button *ngIf="kit.estado === 'EN USO'"
                                                (click)="devolverKit(kit)"
                                                matTooltip="Registrar devolución"
                                                class="w-7 h-7 flex items-center justify-center bg-orange-500 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                                            <mat-icon class="!text-sm text-white">assignment_return</mat-icon>
                                        </button>
                                    </ng-container>
                                    <button *appHasPermission="'kits.toggle'" (click)="toggleActivo(kit, $event)"
                                            [matTooltip]="kit.activo ? 'Desactivar kit' : 'Activar kit'"
                                            [class]="kit.activo
                                                ? 'w-7 h-7 flex items-center justify-center bg-green-600 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all'
                                                : 'w-7 h-7 flex items-center justify-center bg-stone-400 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all'">
                                        <mat-icon class="!text-sm text-white">{{ kit.activo ? 'toggle_on' : 'toggle_off' }}</mat-icon>
                                    </button>
                                </div>
                            </td>
                        </tr>

                        <tr *ngIf="isLoading()">
                            <td colspan="7" class="px-4 py-12 text-center">
                                <div class="flex flex-col items-center gap-2">
                                    <div class="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                                    <p class="text-[10px] font-black uppercase text-gray-500">Cargando kits...</p>
                                </div>
                            </td>
                        </tr>
                        <tr *ngIf="!isLoading() && kitsFiltrados().length === 0">
                            <td colspan="7" class="px-4 py-12 text-center">
                                <mat-icon class="!text-5xl text-gray-300 dark:text-gray-600">inbox</mat-icon>
                                <p class="text-xs font-bold uppercase text-gray-500 mt-2">Sin resultados</p>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>

                <!-- PAGINADOR -->
                <div *ngIf="!isLoading() && kitsFiltrados().length > pageSize"
                     class="shrink-0 border-t-2 border-black bg-white dark:bg-slate-800 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
                    <span class="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">
                        {{ rangoPagina().desde }}–{{ rangoPagina().hasta }} de {{ kitsFiltrados().length }} kits
                    </span>
                    <div class="flex items-center gap-1">
                        <button (click)="irAPagina(pagina() - 1)" [disabled]="pagina() <= 1"
                                class="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-[2px_2px_0px_0px_#000]">
                            <mat-icon class="!text-sm text-black dark:text-white">chevron_left</mat-icon>
                        </button>
                        <button *ngFor="let p of paginasVisibles()" (click)="irAPagina(p)"
                                class="w-7 h-7 flex items-center justify-center border-2 border-black rounded-lg text-[10px] font-black transition-all"
                                [ngClass]="p === pagina()
                                    ? 'bg-amber-400 text-black shadow-none translate-y-[1px]'
                                    : 'bg-white dark:bg-slate-700 text-black dark:text-white shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-none'">
                            {{ p }}
                        </button>
                        <button (click)="irAPagina(pagina() + 1)" [disabled]="pagina() >= totalPaginas()"
                                class="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-[2px_2px_0px_0px_#000]">
                            <mat-icon class="!text-sm text-black dark:text-white">chevron_right</mat-icon>
                        </button>
                    </div>
                </div>
            </div>

        </div>
    </div>
    `,
    styles: [`
        :host { display: block; height: 100%; }
        :host-context(.dark) { color-scheme: dark; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class ListaKitsComponent implements OnInit {
    private dialog      = inject(MatDialog);
    public  dialogRef   = inject(MatDialogRef<ListaKitsComponent>, { optional: true });
    private kitsService = inject(KitsService);

    isLoading = signal(false);
    prestamoMsg = signal('');

    searchTerm        = signal('');
    selectedCategoria = signal<string>('todas');
    selectedEstado    = signal<string>('todos');

    kits          = signal<Kit[]>([]);
    kitCategories: { id_kit_category: number; name: string; active: boolean }[] = [];
    get categorias(): string[] { return this.kitCategories.map(c => c.name); }

    estados = ['COMPLETO', 'INCOMPLETO', 'EN USO', 'MANTENIMIENTO'];

    kitsFiltrados = computed(() => {
        let data = this.kits();
        const term      = this.searchTerm().toLowerCase();
        const categoria = this.selectedCategoria();
        const estado    = this.selectedEstado();

        if (term)       data = data.filter(k => k.nombre.toLowerCase().includes(term) || k.ubicacion?.toLowerCase().includes(term));
        if (categoria !== 'todas') data = data.filter(k => k.categoria === categoria);
        if (estado    !== 'todos') data = data.filter(k => k.estado    === estado);
        return data;
    });

    stats = computed(() => {
        const data = this.kitsFiltrados();
        return {
            kitsCompletos: data.filter(k => k.estado === 'COMPLETO').length,
            kitsEnUso:     data.filter(k => k.estado === 'EN USO').length,
            totalItems:    data.reduce((s, k) => s + k.cantidadItems, 0)
        };
    });

    /* ── Paginación ── */
    readonly pageSize = 10;
    pagina = signal(1);

    totalPaginas = computed(() => Math.max(1, Math.ceil(this.kitsFiltrados().length / this.pageSize)));

    kitsPagina = computed(() => {
        const p = Math.min(this.pagina(), this.totalPaginas());
        const inicio = (p - 1) * this.pageSize;
        return this.kitsFiltrados().slice(inicio, inicio + this.pageSize);
    });

    rangoPagina = computed(() => {
        const total = this.kitsFiltrados().length;
        if (!total) return { desde: 0, hasta: 0 };
        const p = Math.min(this.pagina(), this.totalPaginas());
        return { desde: (p - 1) * this.pageSize + 1, hasta: Math.min(p * this.pageSize, total) };
    });

    paginasVisibles(): number[] {
        const total  = this.totalPaginas();
        const actual = Math.min(this.pagina(), total);
        const inicio = Math.max(1, Math.min(actual - 2, total - 4));
        const fin    = Math.min(total, inicio + 4);
        const out: number[] = [];
        for (let i = inicio; i <= fin; i++) out.push(i);
        return out;
    }

    irAPagina(p: number): void {
        this.pagina.set(Math.min(Math.max(1, p), this.totalPaginas()));
    }

    constructor() {
        // Cualquier cambio de filtro vuelve a la página 1
        effect(() => {
            this.searchTerm(); this.selectedCategoria(); this.selectedEstado();
            Promise.resolve().then(() => this.pagina.set(1));
        }, { allowSignalWrites: true });
    }

    private readonly _statusMap: Record<string, string> = {
        complete:       'COMPLETO',
        incomplete:     'INCOMPLETO',
        in_use:         'EN USO',
        in_calibration: 'EN CALIBRACIÓN',
        decommissioned: 'BAJA'
    };

    ngOnInit(): void { this.cargarKits(); this.cargarCategorias(); }

    cargarKits(): void {
        this.isLoading.set(true);
        this.kitsService.getKits({ limit: 1000 }).pipe(
            finalize(() => this.isLoading.set(false)),
            catchError(() => of([]))
        ).subscribe(data => {
            this.kits.set(data.map(k => this._mapKit(k)));
        });
    }

    private _mapKit(k: any): Kit {
        return {
            id:                  k.id_kit,
            nombre:              k.name         ?? '',
            descripcion:         k.description  ?? '',
            cantidadItems:       Number(k.total_components ?? 0),
            ubicacion:           k.location_name ?? undefined,
            ultimaActualizacion: k.fecha_reg ? new Date(k.fecha_reg) : new Date(),
            categoria:           k.category      ?? 'GENERAL',
            estado:              this._statusMap[k.status] ?? k.status ?? 'COMPLETO',
            responsable:         k.funcionario_nombre ?? undefined,
            activo:              k.active === true || k.active === 't' || k.active === 'true',
            _raw:                k
        };
    }

    async verDetalle(kit: Kit): Promise<void> {
        const { DetalleKitDialogComponent } = await import('./detalle-kit-dialog/detalle-kit-dialog.component');
        this.kitsService.getKitComponents(kit.id).subscribe(components => {
            const kitCompleto = {
                ...kit,
                items: components.map(c => ({
                    descripcion:  c.tool_name ?? c.name ?? '',
                    codigoBoamm:  c.tool_code ?? c.code ?? '',
                    codigo:       c.tool_code ?? c.code ?? '',
                    tool_id:      c.tool_id ?? null
                }))
            };
            this.dialog.open(DetalleKitDialogComponent, {
                width: '640px', maxWidth: '95vw', height: 'auto', maxHeight: '88vh',
                panelClass: 'neo-dialog', data: kitCompleto
            });
        });
    }

    toggleActivo(kit: Kit, event: Event): void {
        event.stopPropagation();
        const id_kit = kit._raw?.id_kit ?? kit.id;
        const raw    = kit._raw ?? {};
        const nuevoActivo = !kit.activo;
        this.kitsService.updateKit(id_kit, { ...raw, active: nuevoActivo }).subscribe({
            // Solo cambió "active" — actualizar en memoria en vez de recargar la tabla completa.
            next: () => this.kits.update(list => list.map(k =>
                k.id === kit.id ? { ...k, activo: nuevoActivo, _raw: { ...k._raw, active: nuevoActivo } } : k
            )),
            error: () => {}
        });
    }

    async editarKit(kit: Kit): Promise<void> {
        const { GestionarKitComponent } = await import('./gestionar-kit.component');
        const ref = this.dialog.open(GestionarKitComponent, {
            width: '920px', maxWidth: '95vw', height: '640px', maxHeight: '88vh',
            panelClass: 'neo-dialog', data: { mode: 'edit', kit: kit._raw ?? kit }
        });
        ref.afterClosed().subscribe(result => {
            if (result?.saved) this.cargarKits();
        });
    }

    async crearNuevoKit(): Promise<void> {
        const { GestionarKitComponent } = await import('./gestionar-kit.component');
        const ref = this.dialog.open(GestionarKitComponent, {
            width: '920px', maxWidth: '95vw', height: '640px', maxHeight: '88vh',
            panelClass: 'neo-dialog'
        });
        ref.afterClosed().subscribe(result => {
            if (result?.saved) this.cargarKits();
        });
    }

    cargarCategorias(): void {
        this.kitsService.getKitCategories().subscribe(cats => {
            this.kitCategories = cats.filter(c => c.active);
        });
    }

    async prestarKit(kit: Kit): Promise<void> {
        const { PrestarKitDialogComponent } = await import('./prestar-kit-dialog/prestar-kit-dialog.component');
        const ref = this.dialog.open(PrestarKitDialogComponent, {
            width: '520px', maxWidth: '95vw', height: 'auto', maxHeight: '88vh',
            panelClass: 'neo-dialog', data: kit._raw ?? kit
        });
        ref.afterClosed().subscribe(result => {
            if (result?.prestado) {
                this.cargarKits();
                const ot = result.work_order_number ? ` · OT: ${result.work_order_number}` : '';
                this.prestamoMsg.set(`Préstamo registrado${ot}`);
                setTimeout(() => this.prestamoMsg.set(''), 6000);
            }
        });
    }

    async devolverKit(kit: Kit): Promise<void> {
        const { DevolverKitDialogComponent } = await import('./devolver-kit-dialog/devolver-kit-dialog.component');
        const ref = this.dialog.open(DevolverKitDialogComponent, {
            width: '560px', maxWidth: '95vw', height: 'auto', maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: {
                kit:          kit._raw ?? kit,
                id_kit_loan:  kit._raw?.current_loan_id ?? null,
                loan_number:  kit._raw?.loan_number ?? null
            }
        });
        ref.afterClosed().subscribe(result => {
            if (result?.devuelto) this.cargarKits();
        });
    }

    async abrirCategorias(): Promise<void> {
        const { CategoriaManagerDialogComponent } = await import('./categoria-manager-dialog/categoria-manager-dialog.component');
        const ref = this.dialog.open(CategoriaManagerDialogComponent, {
            panelClass: 'neo-dialog',
            disableClose: false
        });
        ref.afterClosed().subscribe(result => {
            if (result?.recargar) this.cargarCategorias();
        });
    }

    getEstadoClass(estado: string): string {
        const m: Record<string, string> = {
            'COMPLETO':        'bg-green-100 text-green-800 border-green-800',
            'INCOMPLETO':      'bg-yellow-100 text-yellow-800 border-yellow-800',
            'EN USO':          'bg-blue-100 text-blue-800 border-blue-800',
            'EN CALIBRACIÓN':  'bg-purple-100 text-purple-800 border-purple-800',
            'BAJA':            'bg-gray-100 text-gray-600 border-gray-400'
        };
        return m[estado] ?? 'bg-gray-200 text-black border-black';
    }

    getCategoriaClass(categoria: string): string {
        const m: Record<string, string> = {
            'MANTENIMIENTO': 'bg-[#0F172AFF]',
            'LUBRICACION':   'bg-green-600',
            'FRENOS':        'bg-red-600',
            'CALIBRACION':   'bg-purple-600',
            'GENERAL':       'bg-gray-600'
        };
        return m[categoria] ?? 'bg-gray-600';
    }
}
