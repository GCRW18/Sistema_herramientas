import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

// Interfaces
interface Kit {
    id: number;
    nombre: string;
    descripcion: string;
    cantidadItems: number;
    ubicacion?: string;
    ultimaActualizacion: Date;
    items?: KitItem[];
    categoria: 'MANTENIMIENTO' | 'LUBRICACION' | 'FRENOS' | 'CALIBRACION' | 'GENERAL';
    modelo?: string;
    estado: 'COMPLETO' | 'INCOMPLETO' | 'EN USO' | 'MANTENIMIENTO';
    responsable?: string;
    cantidadUsos?: number;
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
    imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule, MatTooltipModule],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] font-sans overflow-hidden relative">

        <!-- DECORATIVE -->
        <div class="fixed top-16 right-10 w-40 h-40 bg-yellow-400 rounded-full border-4 border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-24 h-24 bg-[#111A43] rotate-12 border-4 border-black opacity-5 pointer-events-none"></div>

        <!-- MAIN -->
        <div class="flex-1 flex flex-col p-2 gap-2 overflow-hidden h-full relative z-10">

            <!-- HEADER -->
            <div class="flex items-center justify-between gap-2 shrink-0">
                <div class="flex items-center gap-2">
                    <mat-icon class="text-black dark:text-white !text-base">construction</mat-icon>
                    <h1 class="text-base font-black text-black dark:text-white uppercase tracking-tight leading-none">Gestión de Kits</h1>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-sm border border-black bg-[#111A43] text-white uppercase">
                        {{ kitsFiltrados().length }} KITS
                    </span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <!-- Toggle vista -->
                    <div class="flex gap-0.5 bg-gray-200 dark:bg-slate-700 p-0.5 rounded-lg border-2 border-black">
                        <button (click)="viewMode.set('grid')"
                                class="w-7 h-7 rounded flex items-center justify-center transition-all"
                                [ngClass]="viewMode() === 'grid' ? 'bg-[#111A43] text-white' : 'text-gray-500'">
                            <mat-icon class="!text-sm">grid_view</mat-icon>
                        </button>
                        <button (click)="viewMode.set('list')"
                                class="w-7 h-7 rounded flex items-center justify-center transition-all"
                                [ngClass]="viewMode() === 'list' ? 'bg-[#111A43] text-white' : 'text-gray-500'">
                            <mat-icon class="!text-sm">view_list</mat-icon>
                        </button>
                    </div>
                    <button (click)="exportarExcel()"
                            class="px-3 py-1.5 bg-emerald-500 text-white font-black text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-1">
                        <mat-icon class="!text-sm">table_view</mat-icon> Excel
                    </button>
                    <button (click)="crearNuevoKit()"
                            class="px-3 py-1.5 bg-yellow-400 text-black font-black text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-1">
                        <mat-icon class="!text-sm">add_circle</mat-icon> Nuevo Kit
                    </button>
                </div>
            </div>

            <!-- BODY: 2 COLUMNAS -->
            <div class="flex flex-row gap-2 flex-1 overflow-hidden min-h-0">

                <!-- PANEL IZQUIERDO: Stats + Filtros -->
                <div class="w-[220px] shrink-0 flex flex-col gap-2">

                    <!-- Stats -->
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="bg-[#111A43] px-3 py-1.5 border-b-2 border-black">
                            <span class="font-black text-xs uppercase text-white">Resumen</span>
                        </div>
                        <div class="p-2 grid grid-cols-2 gap-2">
                            <div class="flex flex-col items-center justify-center p-2 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000]">
                                <mat-icon class="text-yellow-600 !text-lg">inventory_2</mat-icon>
                                <span class="text-xl font-black text-black dark:text-white leading-none">{{ stats().totalKits }}</span>
                                <span class="text-[9px] font-black uppercase text-gray-500 text-center leading-tight mt-0.5">Total Kits</span>
                            </div>
                            <div class="flex flex-col items-center justify-center p-2 bg-green-50 dark:bg-green-900/20 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000]">
                                <mat-icon class="text-green-600 !text-lg">check_circle</mat-icon>
                                <span class="text-xl font-black text-black dark:text-white leading-none">{{ stats().kitsCompletos }}</span>
                                <span class="text-[9px] font-black uppercase text-gray-500 text-center leading-tight mt-0.5">Completos</span>
                            </div>
                            <div class="flex flex-col items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000]">
                                <mat-icon class="text-blue-600 !text-lg">engineering</mat-icon>
                                <span class="text-xl font-black text-black dark:text-white leading-none">{{ stats().kitsEnUso }}</span>
                                <span class="text-[9px] font-black uppercase text-gray-500 text-center leading-tight mt-0.5">En Uso</span>
                            </div>
                            <div class="flex flex-col items-center justify-center p-2 bg-orange-50 dark:bg-orange-900/20 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000]">
                                <mat-icon class="text-orange-600 !text-lg">build</mat-icon>
                                <span class="text-xl font-black text-black dark:text-white leading-none">{{ stats().totalItems }}</span>
                                <span class="text-[9px] font-black uppercase text-gray-500 text-center leading-tight mt-0.5">Herram.</span>
                            </div>
                        </div>
                    </div>

                    <!-- Filtros -->
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="bg-[#111A43] px-3 py-1.5 border-b-2 border-black flex items-center justify-between">
                            <span class="font-black text-xs uppercase text-white">Filtros</span>
                            <button (click)="limpiarFiltros()" matTooltip="Limpiar"
                                    class="w-5 h-5 flex items-center justify-center bg-red-500 rounded border border-black hover:bg-red-400 transition-all">
                                <mat-icon class="text-white !text-xs">close</mat-icon>
                            </button>
                        </div>
                        <div class="p-2 flex flex-col gap-2">
                            <!-- Búsqueda -->
                            <div class="relative">
                                <input type="text" [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)"
                                       placeholder="Buscar..."
                                       class="w-full h-8 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-7 pr-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                <mat-icon class="absolute left-1.5 top-1 text-gray-400 !text-sm pointer-events-none">search</mat-icon>
                            </div>
                            <!-- Categoría -->
                            <select [ngModel]="selectedCategoria()" (ngModelChange)="selectedCategoria.set($event)"
                                    class="w-full h-8 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                <option value="todas">CATEGORÍA: TODAS</option>
                                @for (c of categorias; track c) { <option [value]="c">{{ c }}</option> }
                            </select>
                            <!-- Modelo -->
                            <select [ngModel]="selectedModelo()" (ngModelChange)="selectedModelo.set($event)"
                                    class="w-full h-8 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                <option value="todos">MODELO: TODOS</option>
                                @for (m of modelos; track m) { <option [value]="m">{{ m }}</option> }
                            </select>
                            <!-- Estado -->
                            <select [ngModel]="selectedEstado()" (ngModelChange)="selectedEstado.set($event)"
                                    class="w-full h-8 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                <option value="todos">ESTADO: TODOS</option>
                                @for (e of estados; track e) { <option [value]="e">{{ e }}</option> }
                            </select>
                        </div>
                    </div>

                </div>

                <!-- PANEL DERECHO: Lista/Grid de kits -->
                <div class="flex-1 flex flex-col overflow-hidden h-full">
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-full">

                        <div class="bg-[#111A43] px-3 py-1.5 border-b-2 border-black shrink-0 flex items-center gap-2">
                            <mat-icon class="text-white !text-base">list_alt</mat-icon>
                            <span class="font-black text-xs uppercase text-white">Kits Disponibles</span>
                        </div>

                        <div class="overflow-y-auto flex-1 custom-scrollbar p-2 bg-[#f8f9fc] dark:bg-slate-900/50">

                            @if (kitsFiltrados().length === 0) {
                                <div class="flex flex-col items-center justify-center h-full opacity-50 py-12">
                                    <mat-icon class="!text-6xl text-gray-400">search_off</mat-icon>
                                    <p class="text-sm font-black mt-2 uppercase text-gray-500">Sin resultados</p>
                                    <button (click)="limpiarFiltros()" class="mt-2 text-xs font-bold text-blue-600 hover:underline uppercase">Limpiar filtros</button>
                                </div>
                            }

                            <!-- VISTA GRID -->
                            @if (viewMode() === 'grid') {
                                <div class="grid grid-cols-2 xl:grid-cols-3 gap-2">
                                    @for (kit of kitsFiltrados(); track kit.id) {
                                        <div (click)="verDetalle(kit)"
                                             class="bg-white dark:bg-slate-800 border-2 border-black rounded-lg overflow-hidden shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_#000] transition-all cursor-pointer flex flex-col">
                                            <!-- Header coloreado -->
                                            <div class="px-3 py-2 border-b-2 border-black flex items-center justify-between" [ngClass]="getCategoriaClass(kit.categoria)">
                                                <span class="text-[10px] font-black font-mono text-white opacity-80">#{{ kit.id }}</span>
                                                <span class="text-[9px] font-black uppercase px-1.5 py-0.5 bg-black/20 text-white border border-white/30 rounded">{{ kit.categoria }}</span>
                                            </div>
                                            <!-- Body -->
                                            <div class="p-2 flex-1 flex flex-col gap-1">
                                                <p class="text-xs font-black uppercase text-black dark:text-white leading-tight line-clamp-2">{{ kit.nombre }}</p>
                                                <div class="flex items-center gap-1 text-[9px] font-bold text-gray-500">
                                                    <mat-icon class="!text-xs">place</mat-icon> {{ kit.ubicacion }}
                                                </div>
                                                <div class="flex items-center justify-between mt-auto pt-1 border-t border-dashed border-gray-200 dark:border-slate-600">
                                                    <span class="px-1.5 py-0.5 text-[9px] font-black uppercase rounded border border-black" [ngClass]="getEstadoClass(kit.estado)">{{ kit.estado }}</span>
                                                    <span class="text-xs font-black text-gray-500">{{ kit.cantidadItems }} itm.</span>
                                                </div>
                                            </div>
                                        </div>
                                    }
                                </div>
                            }

                            <!-- VISTA LISTA -->
                            @if (viewMode() === 'list') {
                                <div class="flex flex-col gap-1">
                                    @for (kit of kitsFiltrados(); track kit.id) {
                                        <div (click)="verDetalle(kit)"
                                             class="bg-white dark:bg-[#0F172AFF] border-2 border-black rounded-lg px-3 py-2 flex items-center gap-3 shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] transition-all cursor-pointer">
                                            <div class="w-9 h-9 flex-shrink-0 flex items-center justify-center text-white border-2 border-black rounded-md font-black text-xs shadow-sm" [ngClass]="getCategoriaClass(kit.categoria)">
                                                {{ kit.id }}
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <p class="text-xs font-black uppercase text-black dark:text-white truncate">{{ kit.nombre }}</p>
                                                <div class="flex items-center gap-3 text-[9px] font-bold text-gray-500 uppercase">
                                                    <span class="flex items-center gap-0.5"><mat-icon class="!text-xs">place</mat-icon> {{ kit.ubicacion }}</span>
                                                    <span class="flex items-center gap-0.5"><mat-icon class="!text-xs">person</mat-icon> {{ kit.responsable }}</span>
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-2 shrink-0">
                                                <span class="px-1.5 py-0.5 text-[9px] font-black uppercase rounded border border-black whitespace-nowrap" [ngClass]="getEstadoClass(kit.estado)">{{ kit.estado }}</span>
                                                <span class="text-xs font-black text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-black font-mono">{{ kit.cantidadItems }} itm.</span>
                                            </div>
                                        </div>
                                    }
                                </div>
                            }

                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
    `,
    styles: [`
        :host { display: block; height: 100%; --neo-border: 2px solid black; --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1); }
        :host-context(.dark) { color-scheme: dark; }
        .neo-card-base { border: var(--neo-border) !important; box-shadow: var(--neo-shadow) !important; border-radius: 8px !important; background-color: white; }
        :host-context(.dark) .neo-card-base { background-color: #1e293b !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class ListaKitsComponent implements OnInit {
    private dialog   = inject(MatDialog);
    private router   = inject(Router);
    public dialogRef = inject(MatDialogRef<ListaKitsComponent>, { optional: true });

    // Signals
    searchTerm = signal('');
    selectedCategoria = signal<string>('todas');
    selectedModelo = signal<string>('todos');
    selectedEstado = signal<string>('todos');
    viewMode = signal<'grid' | 'list'>('grid');
    showFilters = signal(true);

    kits: Kit[] = [];
    categorias = ['MANTENIMIENTO', 'LUBRICACION', 'FRENOS', 'CALIBRACION', 'GENERAL'];
    modelos = ['737-300', 'NG', '767', 'TODOS'];
    estados = ['COMPLETO', 'INCOMPLETO', 'EN USO', 'MANTENIMIENTO'];

    // Computed
    kitsFiltrados = computed(() => {
        let data = this.kits;
        const term = this.searchTerm().toLowerCase();
        const categoria = this.selectedCategoria();
        const modelo = this.selectedModelo();
        const estado = this.selectedEstado();

        if (term) {
            data = data.filter(kit =>
                kit.nombre.toLowerCase().includes(term) ||
                kit.descripcion.toLowerCase().includes(term) ||
                kit.ubicacion?.toLowerCase().includes(term)
            );
        }
        if (categoria !== 'todas') {
            data = data.filter(kit => kit.categoria === categoria);
        }
        if (modelo !== 'todos') {
            data = data.filter(kit => kit.modelo?.includes(modelo));
        }
        if (estado !== 'todos') {
            data = data.filter(kit => kit.estado === estado);
        }
        return data;
    });

    stats = computed(() => {
        const data = this.kitsFiltrados();
        const totalItems = data.reduce((sum, kit) => sum + kit.cantidadItems, 0);

        return {
            totalKits: data.length,
            kitsCompletos: data.filter(k => k.estado === 'COMPLETO').length,
            kitsEnUso: data.filter(k => k.estado === 'EN USO').length,
            totalItems: totalItems
        };
    });

    ngOnInit(): void {
        this.cargarKits();
    }

    private cargarKits(): void {
        this.kits = [];
    }

    async verDetalle(kit: Kit): Promise<void> {
        const { DetalleKitDialogComponent } = await import('./detalle-kit-dialog/detalle-kit-dialog.component');
        this.dialog.open(DetalleKitDialogComponent, {
            width: '1400px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: kit
        });
    }

    toggleFilters(): void {
        this.showFilters.set(!this.showFilters());
    }

    limpiarFiltros(): void {
        this.searchTerm.set('');
        this.selectedCategoria.set('todas');
        this.selectedModelo.set('todos');
        this.selectedEstado.set('todos');
    }

    getEstadoClass(estado: string): string {
        const classes: Record<string, string> = {
            'COMPLETO': 'bg-green-100 text-green-800 border-green-800',
            'INCOMPLETO': 'bg-yellow-100 text-yellow-800 border-yellow-800',
            'EN USO': 'bg-blue-100 text-blue-800 border-blue-800',
            'MANTENIMIENTO': 'bg-purple-100 text-purple-800 border-purple-800'
        };
        return classes[estado] || 'bg-gray-200 text-black border-black';
    }

    getCategoriaClass(categoria: string): string {
        const classes: Record<string, string> = {
            'MANTENIMIENTO': 'bg-[#111A43] text-white',
            'LUBRICACION': 'bg-green-600 text-white',
            'FRENOS': 'bg-red-600 text-white',
            'CALIBRACION': 'bg-purple-600 text-white',
            'GENERAL': 'bg-gray-600 text-white'
        };
        return classes[categoria] || 'bg-gray-600 text-white';
    }

    async crearNuevoKit(): Promise<void> {
        const { GestionarKitComponent } = await import('../gestionar-kit/gestionar-kit.component');
        const dialogRef = this.dialog.open(GestionarKitComponent, {
            width: '1200px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                const nuevoKit: Kit = {
                    id: this.kits.length + 1,
                    nombre: result.nombreKit,
                    descripcion: result.descripcionKit,
                    cantidadItems: result.items.length,
                    ultimaActualizacion: new Date(),
                    items: result.items,
                    categoria: 'GENERAL',
                    estado: 'COMPLETO',
                    cantidadUsos: 0
                };
                this.kits.unshift(nuevoKit);
            }
        });
    }

    exportarExcel(): void {
        alert('Exportando kits a Excel...');
    }
}
