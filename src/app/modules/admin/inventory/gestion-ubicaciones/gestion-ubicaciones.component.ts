import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

interface Ubicacion {
    id: number;
    codigo: string;
    nombre: string;
    tipo: string;
    capacidad: number;
    ocupacion: number;
    estado: string;
    descripcion?: string;
}

@Component({
    selector: 'app-gestion-ubicaciones',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatIconModule,
        MatProgressSpinnerModule, MatTooltipModule
    ],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] font-sans overflow-hidden relative">

        <!-- DECORATIVE -->
        <div class="fixed top-16 right-10 w-48 h-48 bg-[#FF6A00] rounded-full border-4 border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-28 h-28 bg-yellow-300 rotate-12 border-4 border-black opacity-5 pointer-events-none"></div>

        <!-- MAIN -->
        <div class="flex-1 flex flex-col p-3 gap-3 overflow-hidden h-full relative z-10">

            <!-- HEADER -->
            <div class="flex items-center justify-between gap-3 shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-[#FF6A00] border-[3px] border-black shadow-[3px_3px_0px_0px_#000] rounded-xl flex items-center justify-center shrink-0">
                        <mat-icon class="text-white !text-xl">map</mat-icon>
                    </div>
                    <div>
                        <h1 class="text-lg font-black text-black dark:text-white uppercase tracking-tight leading-none">Almacén y Ubicaciones</h1>
                        <span class="text-[10px] font-bold bg-[#FF6A00] text-white px-2 py-0.5 inline-block border border-black uppercase tracking-wide mt-0.5">
                            GESTIÓN DE ESPACIOS
                        </span>
                    </div>
                </div>

                <!-- Stats rápidas -->
                <div class="flex items-center gap-2">
                    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000]">
                        <mat-icon class="!text-sm text-[#FF6A00]">location_on</mat-icon>
                        <span class="text-xs font-black text-black dark:text-white">{{ ubicaciones.length }}</span>
                        <span class="text-[9px] font-bold text-gray-400 uppercase">ubicaciones</span>
                    </div>
                    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000]">
                        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span class="text-xs font-black text-black dark:text-white">{{ getTotalDisponible() }}</span>
                        <span class="text-[9px] font-bold text-gray-400 uppercase">disponibles</span>
                    </div>
                    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000]">
                        <span class="w-2 h-2 rounded-full bg-orange-400"></span>
                        <span class="text-xs font-black text-black dark:text-white">{{ getTotalOcupacion() }}</span>
                        <span class="text-[9px] font-bold text-gray-400 uppercase">ocupados</span>
                    </div>
                </div>
            </div>

            <!-- BODY: 2 COLUMNAS -->
            <div class="flex flex-row gap-3 flex-1 overflow-hidden min-h-0">

                <!-- ====================================================== -->
                <!-- PANEL IZQUIERDO: Formulario                             -->
                <!-- ====================================================== -->
                <div class="w-[280px] shrink-0 flex flex-col">
                    <div class="neo-card-base overflow-hidden flex flex-col h-full"
                         [ngClass]="editingId !== null ? 'bg-yellow-50 dark:bg-yellow-900/10' : 'bg-white dark:bg-slate-800'">

                        <!-- Header dinámico -->
                        <div class="px-3 py-2 border-b-2 border-black flex items-center justify-between shrink-0"
                             [ngClass]="editingId !== null ? 'bg-yellow-400' : 'bg-[#FF6A00]'">
                            <div class="flex items-center gap-2">
                                <div class="w-6 h-6 rounded-lg flex items-center justify-center"
                                     [ngClass]="editingId !== null ? 'bg-black/10' : 'bg-white/20'">
                                    <mat-icon class="!text-sm" [ngClass]="editingId !== null ? 'text-black' : 'text-white'">
                                        {{ editingId !== null ? 'edit_location' : 'add_location_alt' }}
                                    </mat-icon>
                                </div>
                                <span class="font-black text-xs uppercase" [ngClass]="editingId !== null ? 'text-black' : 'text-white'">
                                    {{ editingId !== null ? 'Editando Ubicación' : 'Nueva Ubicación' }}
                                </span>
                            </div>
                            @if (editingId !== null) {
                                <button (click)="cancelEdit()"
                                        class="w-6 h-6 flex items-center justify-center bg-black/15 hover:bg-black/25 rounded border border-black/20 transition-all">
                                    <mat-icon class="text-black !text-sm">close</mat-icon>
                                </button>
                            }
                        </div>

                        <div class="p-3 flex flex-col gap-2.5 flex-1">

                            <!-- Código + Tipo -->
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 block">Código <span class="text-red-500">*</span></label>
                                    <input type="text" [(ngModel)]="form.codigo" placeholder="13-SUELO"
                                           class="w-full h-9 text-sm font-black border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#FF6A00] transition-shadow outline-none placeholder:text-gray-300 tracking-wide">
                                </div>
                                <div>
                                    <label class="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 block">Tipo <span class="text-red-500">*</span></label>
                                    <select [(ngModel)]="form.tipo"
                                            class="w-full h-9 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                        <option value="">Tipo...</option>
                                        @for (t of tiposUbicacion; track t) {
                                            <option [value]="t">{{ t }}</option>
                                        }
                                    </select>
                                </div>
                            </div>

                            <!-- Nombre -->
                            <div>
                                <label class="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 block">Nombre <span class="text-red-500">*</span></label>
                                <input type="text" [(ngModel)]="form.nombre" placeholder="Nombre descriptivo"
                                       class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#FF6A00] transition-shadow outline-none placeholder:text-gray-300">
                            </div>

                            <!-- Capacidad + Ocupación -->
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 block">Capacidad <span class="text-red-500">*</span></label>
                                    <input type="number" [(ngModel)]="form.capacidad" min="1" placeholder="100"
                                           class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#FF6A00] transition-shadow outline-none text-center">
                                </div>
                                <div>
                                    <label class="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 block">Ocupación</label>
                                    <input type="number" [(ngModel)]="form.ocupacion" min="0" placeholder="0"
                                           class="w-full h-9 text-sm font-bold border-2 border-gray-200 dark:border-slate-600 rounded-lg px-3 bg-gray-50 dark:bg-[#0F172AFF] text-gray-600 dark:text-gray-400 focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none text-center">
                                </div>
                            </div>

                            <!-- Preview barra si editando -->
                            @if (form.capacidad > 0) {
                                <div class="bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg p-2">
                                    <div class="flex justify-between text-[9px] font-black mb-1">
                                        <span class="text-gray-500 uppercase">Vista previa ocupación</span>
                                        <span [ngClass]="(form.ocupacion/form.capacidad*100) < 70 ? 'text-emerald-600' : (form.ocupacion/form.capacidad*100) < 90 ? 'text-yellow-600' : 'text-red-600'">
                                            {{ (form.ocupacion/form.capacidad*100) | number:'1.0-0' }}%
                                        </span>
                                    </div>
                                    <div class="h-2 w-full bg-gray-200 border border-black rounded-full overflow-hidden">
                                        <div class="h-full transition-all duration-300"
                                             [style.width.%]="(form.ocupacion/form.capacidad*100)"
                                             [ngClass]="(form.ocupacion/form.capacidad*100) < 70 ? 'bg-emerald-400' : (form.ocupacion/form.capacidad*100) < 90 ? 'bg-yellow-400' : 'bg-red-500'">
                                        </div>
                                    </div>
                                </div>
                            }

                            <!-- Descripción -->
                            <div>
                                <label class="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 block">Descripción</label>
                                <input type="text" [(ngModel)]="form.descripcion" placeholder="Notas opcionales"
                                       class="w-full h-9 text-sm font-bold border-2 border-gray-200 dark:border-slate-600 rounded-lg px-3 bg-gray-50 dark:bg-[#0F172AFF] text-gray-600 dark:text-gray-400 focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-300">
                            </div>

                            <div class="flex-1"></div>

                            <!-- Botones -->
                            <div class="flex gap-2 border-t-2 border-dashed border-gray-200 dark:border-slate-600 pt-2">
                                @if (editingId !== null) {
                                    <button type="button" (click)="cancelEdit()"
                                            class="flex-1 py-2 bg-white dark:bg-slate-700 text-black dark:text-white font-bold text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase">
                                        Cancelar
                                    </button>
                                }
                                <button type="button" (click)="guardar()" [disabled]="!form.codigo || !form.nombre || !form.tipo || !form.capacidad"
                                        class="flex-1 py-2 font-black text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                        [ngClass]="editingId !== null ? 'bg-yellow-400 text-black' : 'bg-[#FF6A00] text-white'">
                                    <mat-icon class="!text-sm">{{ editingId !== null ? 'save' : 'add_location_alt' }}</mat-icon>
                                    {{ editingId !== null ? 'Actualizar' : 'Agregar' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ====================================================== -->
                <!-- PANEL DERECHO: Lista de ubicaciones                     -->
                <!-- ====================================================== -->
                <div class="flex-1 flex flex-col">
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-full">

                        <!-- Header -->
                        <div class="bg-[#0F172AFF] px-3 py-2 border-b-2 border-black flex items-center justify-between shrink-0">
                            <div class="flex items-center gap-2">
                                <mat-icon class="text-[#FF6A00] !text-xl">location_on</mat-icon>
                                <span class="font-black text-sm uppercase text-white">Ubicaciones Registradas</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="bg-[#FF6A00] text-white px-2.5 py-0.5 rounded-full text-xs font-black border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                                    {{ ubicaciones.length }} total
                                </span>
                            </div>
                        </div>

                        <!-- Cabecera columnas -->
                        <div class="grid grid-cols-12 gap-1 px-3 py-2 bg-gray-50 dark:bg-slate-700 border-b-2 border-black shrink-0">
                            <div class="col-span-2 text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">Código</div>
                            <div class="col-span-3 text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">Nombre</div>
                            <div class="col-span-1 text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 text-center">Tipo</div>
                            <div class="col-span-1 text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 text-center">Cap.</div>
                            <div class="col-span-3 text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">Ocupación</div>
                            <div class="col-span-1 text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 text-center">Estado</div>
                            <div class="col-span-1 text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 text-right">Acc.</div>
                        </div>

                        <!-- Filas -->
                        <div class="flex-1 overflow-y-auto custom-scrollbar">

                            @if (ubicaciones.length === 0) {
                                <div class="flex flex-col items-center justify-center h-full py-12 opacity-40">
                                    <mat-icon class="!text-6xl text-gray-400">location_off</mat-icon>
                                    <p class="text-sm font-black mt-2 uppercase text-gray-400">Sin ubicaciones registradas</p>
                                </div>
                            }

                            @for (u of ubicaciones; track u.id) {
                                <div class="grid grid-cols-12 gap-1 px-3 py-2.5 items-center border-b border-gray-100 dark:border-slate-700 transition-all"
                                     [ngClass]="editingId === u.id
                                         ? 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-l-yellow-400'
                                         : 'bg-white dark:bg-[#0F172AFF] hover:bg-orange-50 dark:hover:bg-slate-800'">

                                    <!-- Código -->
                                    <div class="col-span-2">
                                        <span class="font-mono font-black text-xs px-2 py-0.5 rounded-lg border-2 border-black shadow-[1px_1px_0px_0px_#000]"
                                              [ngClass]="getTipoColor(u.tipo)">
                                            {{ u.codigo }}
                                        </span>
                                    </div>

                                    <!-- Nombre -->
                                    <div class="col-span-3 leading-tight">
                                        <span class="font-black text-xs text-black dark:text-white truncate block">{{ u.nombre }}</span>
                                        @if (u.descripcion) {
                                            <span class="text-[9px] text-gray-400 truncate block">{{ u.descripcion }}</span>
                                        }
                                    </div>

                                    <!-- Tipo -->
                                    <div class="col-span-1 flex justify-center">
                                        <span class="inline-block px-1.5 py-0.5 rounded-lg border-2 border-black text-[9px] font-black uppercase shadow-[1px_1px_0px_0px_#000]"
                                              [ngClass]="getTipoColor(u.tipo)">
                                            {{ u.tipo.slice(0,3) }}
                                        </span>
                                    </div>

                                    <!-- Capacidad -->
                                    <div class="col-span-1 text-center">
                                        <span class="font-black text-xs text-gray-700 dark:text-gray-300">{{ u.capacidad }}</span>
                                    </div>

                                    <!-- Barra de ocupación -->
                                    <div class="col-span-3">
                                        <div class="flex justify-between text-[9px] font-bold mb-1">
                                            <span class="text-gray-600 dark:text-gray-400">{{ u.ocupacion }}/{{ u.capacidad }}</span>
                                            <span class="font-black"
                                                  [ngClass]="getPct(u) < 70 ? 'text-emerald-600' : getPct(u) < 90 ? 'text-yellow-600' : 'text-red-600'">
                                                {{ getPct(u) | number:'1.0-0' }}%
                                            </span>
                                        </div>
                                        <div class="h-2.5 w-full bg-gray-100 dark:bg-slate-700 border-2 border-black rounded-full overflow-hidden">
                                            <div class="h-full transition-all duration-500"
                                                 [style.width.%]="getPct(u)"
                                                 [ngClass]="getPct(u) < 70 ? 'bg-emerald-400' : getPct(u) < 90 ? 'bg-yellow-400' : 'bg-red-500'">
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Estado -->
                                    <div class="col-span-1 flex justify-center">
                                        <span class="inline-block px-1.5 py-0.5 text-[9px] font-black uppercase border-2 border-black rounded-lg shadow-[1px_1px_0px_0px_#000]"
                                              [ngClass]="{
                                                  'bg-emerald-100 text-emerald-900': u.estado === 'ACTIVO',
                                                  'bg-yellow-100 text-yellow-900':   u.estado === 'CASI LLENO',
                                                  'bg-red-100 text-red-900':         u.estado === 'LLENO'
                                              }">
                                            {{ u.estado === 'ACTIVO' ? 'OK' : u.estado === 'CASI LLENO' ? '~LLN' : 'LLENO' }}
                                        </span>
                                    </div>

                                    <!-- Acciones -->
                                    <div class="col-span-1 flex justify-end gap-1">
                                        <button (click)="editarUbicacion(u)"
                                                matTooltip="Editar"
                                                class="w-7 h-7 flex items-center justify-center border-2 border-black bg-yellow-300 hover:bg-yellow-400 rounded-lg shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all">
                                            <mat-icon class="text-black !text-xs">edit</mat-icon>
                                        </button>
                                        <button (click)="eliminarUbicacion(u)"
                                                matTooltip="Eliminar"
                                                class="w-7 h-7 flex items-center justify-center border-2 border-black bg-red-500 hover:bg-red-400 rounded-lg shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all">
                                            <mat-icon class="text-white !text-xs">delete</mat-icon>
                                        </button>
                                    </div>

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
        :host {
            display: block;
            height: 100%;
            --neo-border: 2px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
        }
        :host-context(.dark) { color-scheme: dark; }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 8px !important;
            background-color: white;
        }
        :host-context(.dark) .neo-card-base { background-color: #1e293b !important; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class GestionUbicacionesComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<GestionUbicacionesComponent>, { optional: true });

    editingId: number | null = null;

    form = this.getEmptyForm();

    tiposUbicacion = ['PISO', 'RACK', 'ESTANTE', 'GABINETE', 'CAJÓN', 'CONTENEDOR'];

    ubicaciones: Ubicacion[] = [];

    private nextId = 1;

    ngOnInit(): void {}

    private getEmptyForm() {
        return { codigo: '', nombre: '', tipo: '', capacidad: 0, ocupacion: 0, descripcion: '' };
    }

    guardar(): void {
        if (!this.form.codigo || !this.form.nombre || !this.form.tipo || !this.form.capacidad) return;

        if (this.editingId !== null) {
            const idx = this.ubicaciones.findIndex(u => u.id === this.editingId);
            if (idx >= 0) {
                this.ubicaciones[idx] = { ...this.ubicaciones[idx], ...this.form, estado: this.calcEstado(this.form.ocupacion, this.form.capacidad) };
                this.ubicaciones = [...this.ubicaciones];
            }
            this.editingId = null;
        } else {
            const nueva: Ubicacion = {
                id: this.nextId++,
                codigo: this.form.codigo,
                nombre: this.form.nombre,
                tipo: this.form.tipo,
                capacidad: this.form.capacidad,
                ocupacion: this.form.ocupacion || 0,
                estado: this.calcEstado(this.form.ocupacion, this.form.capacidad),
                descripcion: this.form.descripcion
            };
            this.ubicaciones = [...this.ubicaciones, nueva];
        }
        this.form = this.getEmptyForm();
    }

    editarUbicacion(u: Ubicacion): void {
        this.editingId = u.id;
        this.form = { codigo: u.codigo, nombre: u.nombre, tipo: u.tipo, capacidad: u.capacidad, ocupacion: u.ocupacion, descripcion: u.descripcion || '' };
    }

    cancelEdit(): void {
        this.editingId = null;
        this.form = this.getEmptyForm();
    }

    eliminarUbicacion(u: Ubicacion): void {
        if (!confirm(`¿Eliminar ubicación "${u.codigo}"?`)) return;
        this.ubicaciones = this.ubicaciones.filter(x => x.id !== u.id);
    }

    getPct(u: Ubicacion): number {
        if (!u.capacidad || u.capacidad === 0) return 0;
        return Math.min(100, (u.ocupacion / u.capacidad) * 100);
    }

    getTotalOcupacion(): number {
        return this.ubicaciones.reduce((sum, u) => sum + (u.ocupacion || 0), 0);
    }

    getTotalDisponible(): number {
        return this.ubicaciones.reduce((sum, u) => sum + Math.max(0, u.capacidad - u.ocupacion), 0);
    }

    getTipoColor(tipo: string): string {
        const map: Record<string, string> = {
            'PISO':       'bg-blue-100 text-blue-900',
            'RACK':       'bg-orange-100 text-orange-900',
            'ESTANTE':    'bg-green-100 text-green-900',
            'GABINETE':   'bg-purple-100 text-purple-900',
            'CAJÓN':      'bg-yellow-100 text-yellow-900',
            'CONTENEDOR': 'bg-cyan-100 text-cyan-900',
        };
        return map[tipo] || 'bg-gray-100 text-gray-700';
    }

    private calcEstado(ocupacion: number, capacidad: number): string {
        const pct = capacidad > 0 ? (ocupacion / capacidad) * 100 : 0;
        if (pct >= 90) return 'LLENO';
        if (pct >= 70) return 'CASI LLENO';
        return 'ACTIVO';
    }

    cerrar(): void {
        if (this.dialogRef) this.dialogRef.close();
    }
}
