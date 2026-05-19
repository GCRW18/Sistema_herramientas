import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

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
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] transition-colors duration-300 font-sans overflow-hidden">

        <div class="fixed top-20 right-10 w-40 h-40 bg-[#0F172AFF] rounded-full border-[3px] border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-24 h-24 bg-[#FFC501FF] rotate-12 border-[3px] border-black opacity-5 pointer-events-none"></div>

        <div class="flex-1 flex flex-col p-4 gap-3 overflow-hidden relative z-10">

            <!-- ══════════ HEADER ══════════ -->
            <div class="flex items-center justify-between gap-4 shrink-0 flex-wrap">

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

                    <button (click)="crearNuevoKit()"
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
                                <div class="text-sm font-black text-white leading-none">{{ kits.length }}</div>
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
                        <tr *ngFor="let kit of kitsFiltrados()"
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
                                            matTooltip="Ver detalle"
                                            class="w-7 h-7 flex items-center justify-center bg-blue-950 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                                        <mat-icon class="!text-sm text-white">visibility</mat-icon>
                                    </button>
                                    <button (click)="editarKit(kit)"
                                            matTooltip="Editar kit"
                                            class="w-7 h-7 flex items-center justify-center bg-[#FFC501FF] border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                                        <mat-icon class="!text-sm text-black">edit</mat-icon>
                                    </button>
                                </div>
                            </td>
                        </tr>

                        <tr *ngIf="kitsFiltrados().length === 0">
                            <td colspan="7" class="px-4 py-12 text-center">
                                <mat-icon class="!text-5xl text-gray-300 dark:text-gray-600">inbox</mat-icon>
                                <p class="text-xs font-bold uppercase text-gray-500 mt-2">Sin resultados</p>
                            </td>
                        </tr>
                        </tbody>
                    </table>
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
    private dialog   = inject(MatDialog);
    public dialogRef = inject(MatDialogRef<ListaKitsComponent>, { optional: true });

    searchTerm        = signal('');
    selectedCategoria = signal<string>('todas');
    selectedEstado    = signal<string>('todos');

    kits: Kit[] = [];
    categorias = ['MANTENIMIENTO', 'LUBRICACION', 'FRENOS', 'CALIBRACION', 'GENERAL'];
    estados    = ['COMPLETO', 'INCOMPLETO', 'EN USO', 'MANTENIMIENTO'];

    kitsFiltrados = computed(() => {
        let data = this.kits;
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

    ngOnInit(): void { this.cargarKits(); }

    cargarKits(): void { this.kits = []; }

    async verDetalle(kit: Kit): Promise<void> {
        const { DetalleKitDialogComponent } = await import('./detalle-kit-dialog/detalle-kit-dialog.component');
        this.dialog.open(DetalleKitDialogComponent, {
            width: '1400px', maxWidth: '95vw', height: 'auto', maxHeight: '90vh',
            panelClass: 'neo-dialog', data: kit
        });
    }

    async editarKit(kit: Kit): Promise<void> {
        const { GestionarKitComponent } = await import('./gestionar-kit.component');
        this.dialog.open(GestionarKitComponent, {
            width: '800px', maxWidth: '95vw', height: 'auto', maxHeight: '88vh',
            panelClass: 'neo-dialog', data: { mode: 'edit', kit }
        });
    }

    async crearNuevoKit(): Promise<void> {
        const { GestionarKitComponent } = await import('./gestionar-kit.component');
        const ref = this.dialog.open(GestionarKitComponent, {
            width: '800px', maxWidth: '95vw', height: 'auto', maxHeight: '88vh',
            panelClass: 'neo-dialog'
        });
        ref.afterClosed().subscribe(result => {
            if (result) {
                const nuevoKit: Kit = {
                    id: this.kits.length + 1,
                    nombre:              result.nombreKit,
                    descripcion:         result.descripcionKit,
                    cantidadItems:       result.items?.length ?? 0,
                    ultimaActualizacion: new Date(),
                    items:               result.items,
                    categoria:           result.categoria   ?? 'GENERAL',
                    estado:              result.estado      ?? 'COMPLETO',
                    responsable:         result.responsable || undefined,
                    ubicacion:           result.ubicacion   || undefined,
                    cantidadUsos:        0
                };
                this.kits = [nuevoKit, ...this.kits];
            }
        });
    }

    getEstadoClass(estado: string): string {
        const m: Record<string, string> = {
            'COMPLETO':      'bg-green-100 text-green-800 border-green-800',
            'INCOMPLETO':    'bg-yellow-100 text-yellow-800 border-yellow-800',
            'EN USO':        'bg-blue-100 text-blue-800 border-blue-800',
            'MANTENIMIENTO': 'bg-purple-100 text-purple-800 border-purple-800'
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
