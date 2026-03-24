import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface Material {
    id: number;
    codigoBoaM: string;
    producto: string;
    tipoItem: string;
    tipoCompra: string;
    marca: string;
    pn: string;
    unidad: string;
    stock: number;
    stockMin: number;
    stockMax: number;
    ubicacion: string;
    activo: boolean;
}

@Component({
    selector: 'app-crear-material',
    standalone: true,
    imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatSnackBarModule],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] font-sans overflow-hidden relative">

        <!-- DECORATIVE -->
        <div class="fixed top-16 right-10 w-48 h-48 bg-amber-400 rounded-full border-4 border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-28 h-28 bg-blue-400 rotate-12 border-4 border-black opacity-5 pointer-events-none"></div>

        <!-- MAIN -->
        <div class="flex-1 flex flex-col p-1.5 gap-1.5 overflow-hidden h-full relative z-10">

            <!-- HEADER -->
            <div class="flex items-center justify-between gap-2 shrink-0">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 bg-amber-500 border-[2px] border-black shadow-[2px_2px_0px_0px_#000] rounded-lg flex items-center justify-center shrink-0">
                        <mat-icon class="text-white !text-base">inventory_2</mat-icon>
                    </div>
                    <div>
                        <h1 class="text-base font-black text-black dark:text-white uppercase tracking-tight leading-none">Catálogo de Materiales</h1>
                        <span class="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-px inline-block border border-black uppercase tracking-wide">GESTIÓN DE ÍTEMS</span>
                    </div>
                </div>
                <!-- Stats -->
                <div class="flex items-center gap-1.5">
                    <div class="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border-2 border-black rounded shadow-[2px_2px_0px_0px_#000]">
                        <mat-icon class="!text-xs text-amber-500">inventory_2</mat-icon>
                        <span class="text-xs font-black text-black dark:text-white">{{ materiales.length }}</span>
                        <span class="text-[9px] font-bold text-gray-400 uppercase">ítems</span>
                    </div>
                    <div class="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border-2 border-black rounded shadow-[2px_2px_0px_0px_#000]">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span class="text-xs font-black text-black dark:text-white">{{ getActivos() }}</span>
                        <span class="text-[9px] font-bold text-gray-400 uppercase">activos</span>
                    </div>
                    <div class="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border-2 border-black rounded shadow-[2px_2px_0px_0px_#000]">
                        <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                        <span class="text-xs font-black text-black dark:text-white">{{ getBajoStock() }}</span>
                        <span class="text-[9px] font-bold text-gray-400 uppercase">bajo stock</span>
                    </div>
                </div>
            </div>

            <!-- BODY: 2 COLUMNAS -->
            <div class="flex flex-row gap-1.5 flex-1 overflow-hidden min-h-0">

                <!-- ====================================================== -->
                <!-- PANEL IZQUIERDO: Formulario                             -->
                <!-- ====================================================== -->
                <div class="w-[260px] shrink-0 flex flex-col">
                    <div class="neo-card-base overflow-hidden flex flex-col h-full"
                         [ngClass]="editingId !== null ? 'bg-yellow-50 dark:bg-yellow-900/10' : 'bg-white dark:bg-slate-800'">

                        <!-- Header dinámico -->
                        <div class="px-2 py-1 border-b-2 border-black flex items-center justify-between shrink-0"
                             [ngClass]="editingId !== null ? 'bg-yellow-400' : 'bg-amber-500'">
                            <div class="flex items-center gap-1.5">
                                <mat-icon class="!text-sm text-white">{{ editingId !== null ? 'edit' : 'add_box' }}</mat-icon>
                                <span class="font-black text-[10px] uppercase text-white">
                                    {{ editingId !== null ? 'Editando ítem' : 'Nuevo ítem' }}
                                </span>
                            </div>
                            @if (editingId !== null) {
                                <button (click)="cancelEdit()"
                                        class="w-5 h-5 flex items-center justify-center bg-black/15 hover:bg-black/25 rounded transition-all">
                                    <mat-icon class="text-white !text-xs">close</mat-icon>
                                </button>
                            }
                        </div>

                        <!-- Campos del formulario -->
                        <div class="p-1.5 flex flex-col gap-0.5 flex-1">

                            <!-- Código BOA-M -->
                            <div>
                                <label class="text-[8px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5 block tracking-widest">Código BOA-M <span class="text-red-500">*</span></label>
                                <input type="text" [(ngModel)]="form.codigoBoaM" placeholder="BOA-M-XXXX"
                                       class="w-full h-8 text-sm font-black border-[2px] border-black dark:border-slate-500 rounded-lg px-2 bg-amber-50 dark:bg-[#1a1200] text-amber-700 dark:text-amber-400 text-center tracking-widest uppercase focus:shadow-[2px_2px_0px_0px_#f59e0b] transition-shadow outline-none placeholder:text-amber-300 placeholder:text-[10px] placeholder:font-normal placeholder:tracking-normal placeholder:normal-case">
                            </div>

                            <!-- Tipo ítem + Tipo compra -->
                            <div class="grid grid-cols-2 gap-1">
                                <div>
                                    <label class="text-[8px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5 block">Tipo Ítem <span class="text-red-500">*</span></label>
                                    <select [(ngModel)]="form.tipoItem"
                                            class="w-full h-6 text-[10px] font-bold border-2 border-black dark:border-slate-600 rounded px-1 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                        <option value="">Tipo...</option>
                                        <option value="CONSUMIBLE">Consumible</option>
                                        <option value="REPUESTO">Repuesto</option>
                                        <option value="MATERIAL">Material</option>
                                        <option value="QUIMICO">Químico</option>
                                        <option value="ELECTRICO">Eléctrico</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[8px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5 block">Tipo Compra <span class="text-red-500">*</span></label>
                                    <select [(ngModel)]="form.tipoCompra"
                                            class="w-full h-6 text-[10px] font-bold border-2 border-black dark:border-slate-600 rounded px-1 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                        <option value="">Tipo...</option>
                                        <option value="IMPORTACION">Importación</option>
                                        <option value="NACIONAL">Nacional</option>
                                        <option value="FABRICACION_LOCAL">Fab. Local</option>
                                        <option value="DONACION">Donación</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Producto -->
                            <div>
                                <label class="text-[8px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5 block">Descripción / Producto <span class="text-red-500">*</span></label>
                                <input type="text" [(ngModel)]="form.producto" placeholder="Nombre completo del material"
                                       class="w-full h-6 text-[11px] font-bold border-2 border-black dark:border-slate-600 rounded px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#f59e0b] transition-shadow outline-none placeholder:text-gray-300">
                            </div>

                            <!-- P/N + Marca -->
                            <div class="grid grid-cols-2 gap-1">
                                <div>
                                    <label class="text-[8px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5 block">P/N <span class="text-red-500">*</span></label>
                                    <input type="text" [(ngModel)]="form.pn" placeholder="Part Number"
                                           class="w-full h-6 text-[10px] font-black border-2 border-black dark:border-slate-600 rounded px-1 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#f59e0b] transition-shadow outline-none tracking-wide uppercase placeholder:normal-case placeholder:text-gray-300">
                                </div>
                                <div>
                                    <label class="text-[8px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5 block">Marca <span class="text-red-500">*</span></label>
                                    <input type="text" [(ngModel)]="form.marca" placeholder="Fabricante"
                                           class="w-full h-6 text-[11px] font-bold border-2 border-black dark:border-slate-600 rounded px-1 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#f59e0b] transition-shadow outline-none placeholder:text-gray-300">
                                </div>
                            </div>

                            <!-- Stock inicial + Unidad -->
                            <div>
                                <label class="text-[8px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5 block">Stock Inicial + Unidad <span class="text-red-500">*</span></label>
                                <div class="flex gap-1">
                                    <input type="number" [(ngModel)]="form.stockInicial" placeholder="0" min="0"
                                           class="flex-1 h-6 text-[11px] font-black border-2 border-gray-300 dark:border-slate-600 rounded px-1 bg-gray-50 dark:bg-[#0F172AFF] text-gray-700 dark:text-gray-300 focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none text-center">
                                    <input type="text" [(ngModel)]="form.unidad" placeholder="PZA"
                                           class="w-14 h-6 text-[10px] font-black border-2 border-black dark:border-slate-600 rounded px-1 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#f59e0b] transition-shadow outline-none text-center uppercase placeholder:normal-case">
                                </div>
                            </div>

                            <!-- Stock Mín / Máx + Ubicación -->
                            <div class="grid grid-cols-3 gap-1">
                                <div>
                                    <label class="text-[8px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5 block">Mín.</label>
                                    <input type="number" [(ngModel)]="form.stockMin" placeholder="0" min="0"
                                           class="w-full h-6 text-[11px] font-bold border-2 border-gray-300 dark:border-slate-600 rounded px-1 bg-gray-50 dark:bg-[#0F172AFF] text-gray-600 dark:text-gray-400 outline-none text-center">
                                </div>
                                <div>
                                    <label class="text-[8px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5 block">Máx.</label>
                                    <input type="number" [(ngModel)]="form.stockMax" placeholder="0" min="0"
                                           class="w-full h-6 text-[11px] font-bold border-2 border-gray-300 dark:border-slate-600 rounded px-1 bg-gray-50 dark:bg-[#0F172AFF] text-gray-600 dark:text-gray-400 outline-none text-center">
                                </div>
                                <div>
                                    <label class="text-[8px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5 block">Ubic.</label>
                                    <input type="text" [(ngModel)]="form.ubicacion" placeholder="RACK-A1"
                                           class="w-full h-6 text-[10px] font-black border-2 border-gray-300 dark:border-slate-600 rounded px-1 bg-gray-50 dark:bg-[#0F172AFF] text-gray-600 dark:text-gray-400 outline-none uppercase placeholder:normal-case">
                                </div>
                            </div>

                            <!-- Recibido por -->
                            <div>
                                <label class="text-[8px] font-black uppercase text-gray-500 dark:text-gray-400 mb-0.5 block">Recibido por <span class="text-red-500">*</span></label>
                                <input type="text" [(ngModel)]="form.recibidoPor" placeholder="Nombre del receptor"
                                       class="w-full h-6 text-[11px] font-bold border-2 border-black dark:border-slate-600 rounded px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#f59e0b] transition-shadow outline-none placeholder:text-gray-300">
                            </div>

                            <!-- Fecha -->
                            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded p-1">
                                <div class="flex items-center gap-1 mb-0.5">
                                    <mat-icon class="text-amber-500 !text-xs">schedule</mat-icon>
                                    <span class="text-[8px] font-black uppercase text-amber-600 dark:text-amber-400">Fecha de Alta</span>
                                </div>
                                <div class="flex gap-1">
                                    <input type="date" [(ngModel)]="form.fecha"
                                           class="flex-1 h-6 text-[10px] font-bold border-2 border-black dark:border-slate-600 rounded px-1 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                    <input type="time" [(ngModel)]="form.hora"
                                           class="w-16 h-6 text-[10px] font-bold border-2 border-black dark:border-slate-600 rounded px-1 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                </div>
                            </div>

                            <div class="flex-1"></div>

                            <!-- Botones -->
                            <div class="flex gap-1.5 border-t-2 border-dashed border-gray-200 dark:border-slate-600 pt-1.5">
                                @if (editingId !== null) {
                                    <button type="button" (click)="cancelEdit()"
                                            class="flex-1 h-7 bg-white dark:bg-slate-700 text-black dark:text-white font-bold text-[10px] border-2 border-black rounded shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase">
                                        Cancelar
                                    </button>
                                }
                                <button type="button" (click)="guardar()" [disabled]="!isValid()"
                                        class="flex-1 h-7 font-black text-[10px] border-2 border-black rounded shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                        [ngClass]="editingId !== null ? 'bg-yellow-400 text-black' : 'bg-amber-500 text-white'">
                                    <mat-icon class="!text-xs">{{ editingId !== null ? 'save' : 'add_box' }}</mat-icon>
                                    {{ editingId !== null ? 'Actualizar' : 'Registrar' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ====================================================== -->
                <!-- PANEL DERECHO: Lista de materiales                      -->
                <!-- ====================================================== -->
                <div class="flex-1 flex flex-col">
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-full">

                        <!-- Header lista -->
                        <div class="bg-[#0F172AFF] px-2 py-1 border-b-2 border-black flex items-center justify-between shrink-0">
                            <div class="flex items-center gap-1.5">
                                <mat-icon class="text-amber-400 !text-sm">list_alt</mat-icon>
                                <span class="font-black text-[10px] uppercase text-white tracking-wide">Ítems Registrados</span>
                                <span class="px-1.5 py-px bg-amber-500 border border-amber-300 text-white font-black text-[9px] rounded">
                                    {{ filteredMateriales.length }}
                                </span>
                            </div>
                            <!-- Búsqueda -->
                            <div class="flex items-center gap-1.5">
                                <div class="relative">
                                    <input type="text" [(ngModel)]="searchQ" (ngModelChange)="applyFilter()" placeholder="Buscar código, nombre, P/N..."
                                           class="w-48 h-6 pl-6 pr-2 bg-white/10 text-white placeholder:text-white/40 border border-white/20 rounded text-[10px] font-bold outline-none focus:bg-white/20 transition-all">
                                    <mat-icon class="absolute left-1 top-1 text-white/50 !text-xs">search</mat-icon>
                                </div>
                                <select [(ngModel)]="filterTipo" (ngModelChange)="applyFilter()"
                                        class="h-6 px-1 text-[10px] font-bold bg-white/10 text-white border border-white/20 rounded outline-none">
                                    <option value="">Todos</option>
                                    <option value="CONSUMIBLE">Consumible</option>
                                    <option value="REPUESTO">Repuesto</option>
                                    <option value="MATERIAL">Material</option>
                                    <option value="QUIMICO">Químico</option>
                                    <option value="ELECTRICO">Eléctrico</option>
                                </select>
                            </div>
                        </div>

                        <!-- Tabla -->
                        <div class="overflow-y-auto flex-1 custom-scrollbar">
                            <table class="w-full">
                                <thead class="sticky top-0 z-10">
                                    <tr class="border-b-2 border-black bg-gray-100 dark:bg-slate-700">
                                        <th class="text-left px-2 py-1.5 font-black text-[9px] uppercase text-black dark:text-white w-28">CÓDIGO</th>
                                        <th class="text-left px-2 py-1.5 font-black text-[9px] uppercase text-black dark:text-white">DESCRIPCIÓN</th>
                                        <th class="text-left px-2 py-1.5 font-black text-[9px] uppercase text-black dark:text-white w-20">TIPO</th>
                                        <th class="text-left px-2 py-1.5 font-black text-[9px] uppercase text-black dark:text-white w-24">MARCA / P/N</th>
                                        <th class="text-center px-2 py-1.5 font-black text-[9px] uppercase text-black dark:text-white w-16">STOCK</th>
                                        <th class="text-left px-2 py-1.5 font-black text-[9px] uppercase text-black dark:text-white w-20">UBIC.</th>
                                        <th class="text-center px-2 py-1.5 font-black text-[9px] uppercase text-black dark:text-white w-16">ACC.</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white dark:bg-slate-800">
                                    <tr *ngFor="let m of filteredMateriales; let last = last"
                                        [class.border-b]="!last"
                                        class="border-gray-200 dark:border-slate-600 hover:bg-amber-50 dark:hover:bg-slate-700 transition-colors">

                                        <td class="px-2 py-1.5">
                                            <span class="font-mono font-black text-amber-700 dark:text-amber-400 text-[10px] bg-amber-50 dark:bg-amber-900/30 px-1.5 py-px rounded border border-amber-200 dark:border-amber-800 tracking-wide uppercase">
                                                {{ m.codigoBoaM }}
                                            </span>
                                        </td>

                                        <td class="px-2 py-1.5">
                                            <p class="font-bold text-gray-900 dark:text-white text-xs leading-tight">{{ m.producto }}</p>
                                            <p class="text-[9px] text-gray-400 dark:text-gray-500 font-mono leading-tight">{{ m.pn }}</p>
                                        </td>

                                        <td class="px-2 py-1.5">
                                            <span class="inline-block px-1.5 py-px border border-black rounded text-[8px] font-black uppercase"
                                                  [ngClass]="getTipoColor(m.tipoItem)">
                                                {{ m.tipoItem || 'N/A' }}
                                            </span>
                                        </td>

                                        <td class="px-2 py-1.5">
                                            <p class="text-[11px] font-bold text-gray-700 dark:text-gray-300 leading-tight">{{ m.marca }}</p>
                                            <p class="text-[9px] text-gray-400 font-mono leading-tight">{{ m.tipoCompra }}</p>
                                        </td>

                                        <td class="px-2 py-1.5 text-center">
                                            <span class="text-xs font-black"
                                                  [class.text-emerald-600]="m.stock > m.stockMin"
                                                  [class.text-red-600]="m.stock <= m.stockMin && m.stockMin > 0"
                                                  [class.text-gray-700]="m.stockMin === 0">
                                                {{ m.stock }}
                                            </span>
                                            <span class="text-[9px] text-gray-400 font-bold">{{ m.unidad }}</span>
                                        </td>

                                        <td class="px-2 py-1.5">
                                            <span class="font-mono text-[10px] text-gray-600 dark:text-gray-400 font-bold">{{ m.ubicacion || '-' }}</span>
                                        </td>

                                        <td class="px-2 py-1.5">
                                            <div class="flex gap-1 justify-center">
                                                <button (click)="editar(m)"
                                                        class="w-6 h-6 flex items-center justify-center border-2 border-black bg-yellow-400 hover:bg-yellow-300 rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all"
                                                        title="Editar">
                                                    <mat-icon class="text-black !text-xs">edit</mat-icon>
                                                </button>
                                                <button (click)="eliminar(m)"
                                                        class="w-6 h-6 flex items-center justify-center border-2 border-black bg-red-100 hover:bg-red-200 rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all"
                                                        title="Eliminar">
                                                    <mat-icon class="text-red-700 !text-xs">delete</mat-icon>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    <tr *ngIf="filteredMateriales.length === 0">
                                        <td colspan="7" class="p-10 text-center bg-white dark:bg-slate-800">
                                            <mat-icon class="!text-5xl text-gray-200 dark:text-gray-700 mb-2">inventory_2</mat-icon>
                                            <p class="text-gray-400 dark:text-gray-500 font-bold text-sm">
                                                {{ searchQ || filterTipo ? 'Sin resultados para la búsqueda' : 'No hay materiales registrados' }}
                                            </p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
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

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
    `]
})
export class CrearMaterialComponent {
    public dialogRef = inject(MatDialogRef<CrearMaterialComponent>, { optional: true });
    private router   = inject(Router);
    private snackBar = inject(MatSnackBar);

    searchQ    = '';
    filterTipo = '';
    editingId: number | null = null;
    nextId = 1;

    materiales: Material[] = [];
    filteredMateriales: Material[] = [];

    form: Record<string, any> = {
        nroNota: '', recibidoPor: '', codigoBoaM: '', producto: '',
        unidad: '', tipoCompra: '', tipoItem: '', marca: '', pn: '',
        paisOrigen: '', ubicacion: '', stockInicial: 0, stockMin: 0, stockMax: 0,
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().slice(0, 5), observacion: ''
    };

    requiredFields = [
        { key: 'codigoBoaM',  label: 'Código BOA-M' },
        { key: 'tipoItem',    label: 'Tipo de ítem' },
        { key: 'tipoCompra',  label: 'Tipo de compra' },
        { key: 'unidad',      label: 'Unidad' },
        { key: 'producto',    label: 'Producto' },
        { key: 'pn',          label: 'Part Number' },
        { key: 'marca',       label: 'Marca' },
        { key: 'recibidoPor', label: 'Recibido por' },
        { key: 'fecha',       label: 'Fecha ingreso' },
    ];

    isValid(): boolean {
        return this.requiredFields.every(f => !!this.form[f.key]);
    }

    getFilledCount(): number {
        return this.requiredFields.filter(f => !!this.form[f.key]).length;
    }

    getActivos(): number { return this.materiales.filter(m => m.activo).length; }

    getBajoStock(): number {
        return this.materiales.filter(m => m.stockMin > 0 && m.stock <= m.stockMin).length;
    }

    applyFilter(): void {
        let list = [...this.materiales];
        const q = this.searchQ.toLowerCase();
        if (q) list = list.filter(m =>
            m.codigoBoaM.toLowerCase().includes(q) ||
            m.producto.toLowerCase().includes(q) ||
            m.pn.toLowerCase().includes(q) ||
            m.marca.toLowerCase().includes(q)
        );
        if (this.filterTipo) list = list.filter(m => m.tipoItem === this.filterTipo);
        this.filteredMateriales = list;
    }

    guardar(): void {
        if (!this.isValid()) return;
        if (this.editingId !== null) {
            const idx = this.materiales.findIndex(m => m.id === this.editingId);
            if (idx !== -1) {
                this.materiales[idx] = { ...this.materiales[idx], ...this.mapFormToMaterial() };
                this.showSuccess('Material actualizado');
            }
            this.cancelEdit();
        } else {
            this.materiales.push({ id: this.nextId++, activo: true, ...this.mapFormToMaterial() });
            this.showSuccess('Material registrado exitosamente');
            this.resetForm();
        }
        this.applyFilter();
    }

    editar(m: Material): void {
        this.editingId = m.id;
        this.form = {
            codigoBoaM: m.codigoBoaM, producto: m.producto, tipoItem: m.tipoItem,
            tipoCompra: m.tipoCompra, marca: m.marca, pn: m.pn, unidad: m.unidad,
            stockInicial: m.stock, stockMin: m.stockMin, stockMax: m.stockMax,
            ubicacion: m.ubicacion, recibidoPor: '',
            fecha: new Date().toISOString().split('T')[0],
            hora: new Date().toTimeString().slice(0, 5),
            nroNota: '', paisOrigen: '', observacion: ''
        };
    }

    eliminar(m: Material): void {
        if (!confirm(`¿Eliminar "${m.producto}" del catálogo?`)) return;
        this.materiales = this.materiales.filter(x => x.id !== m.id);
        this.applyFilter();
        this.showSuccess('Material eliminado');
    }

    cancelEdit(): void {
        this.editingId = null;
        this.resetForm();
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

    private mapFormToMaterial(): Omit<Material, 'id' | 'activo'> {
        return {
            codigoBoaM: this.form['codigoBoaM'],
            producto:   this.form['producto'],
            tipoItem:   this.form['tipoItem'],
            tipoCompra: this.form['tipoCompra'],
            marca:      this.form['marca'],
            pn:         this.form['pn'],
            unidad:     this.form['unidad'],
            stock:      this.form['stockInicial'] ?? 0,
            stockMin:   this.form['stockMin'] ?? 0,
            stockMax:   this.form['stockMax'] ?? 0,
            ubicacion:  this.form['ubicacion'],
        };
    }

    private resetForm(): void {
        this.form = {
            nroNota: '', recibidoPor: '', codigoBoaM: '', producto: '',
            unidad: '', tipoCompra: '', tipoItem: '', marca: '', pn: '',
            paisOrigen: '', ubicacion: '', stockInicial: 0, stockMin: 0, stockMax: 0,
            fecha: new Date().toISOString().split('T')[0],
            hora: new Date().toTimeString().slice(0, 5), observacion: ''
        };
    }

    private showSuccess(msg: string): void {
        this.snackBar.open(msg, 'Cerrar', {
            duration: 3000, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: ['snackbar-success']
        });
    }
}
