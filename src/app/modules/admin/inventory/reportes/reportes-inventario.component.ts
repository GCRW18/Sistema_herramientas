import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-reportes-inventario',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatIconModule],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] font-sans overflow-hidden relative">

        <!-- DECORATIVE -->
        <div class="fixed top-16 right-10 w-40 h-40 bg-indigo-400 rounded-full border-4 border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-24 h-24 bg-amber-300 rotate-12 border-4 border-black opacity-5 pointer-events-none"></div>

        <!-- MAIN -->
        <div class="flex-1 flex flex-col p-2 gap-2 overflow-hidden h-full relative z-10">

            <!-- HEADER -->
            <div class="flex items-center gap-2 shrink-0">
                <mat-icon class="text-black dark:text-white !text-base">bar_chart</mat-icon>
                <h1 class="text-base font-black text-black dark:text-white uppercase tracking-tight leading-none">
                    Reportes Inventario
                </h1>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-sm border border-black bg-indigo-600 text-white uppercase">
                    ANÁLISIS
                </span>
            </div>

            <!-- BODY: 2 COLUMNAS -->
            <div class="flex flex-row gap-2 flex-1 overflow-hidden min-h-0">

                <!-- PANEL IZQUIERDO: Stats -->
                <div class="w-[220px] shrink-0 flex flex-col gap-2">
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="bg-[#0F172AFF] px-3 py-1.5 border-b-2 border-black">
                            <span class="font-black text-xs uppercase text-white">Resumen General</span>
                        </div>
                        <div class="p-2 grid grid-cols-2 gap-2">
                            @for (s of stats; track s.title) {
                                <div class="flex flex-col items-center justify-center p-2 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000]"
                                     [ngClass]="s.bgColor">
                                    <mat-icon class="!text-lg mb-0.5" [ngClass]="s.color">{{ s.icon }}</mat-icon>
                                    <span class="text-xl font-black text-black dark:text-white leading-none">{{ s.value }}</span>
                                    <span class="text-[9px] font-black uppercase text-gray-600 dark:text-gray-300 text-center leading-tight mt-0.5">{{ s.title }}</span>
                                </div>
                            }
                        </div>
                    </div>

                    <!-- Nota -->
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="bg-indigo-600 px-3 py-1.5 border-b-2 border-black flex items-center gap-1.5">
                            <mat-icon class="text-white !text-sm">info</mat-icon>
                            <span class="font-black text-xs uppercase text-white">Información</span>
                        </div>
                        <div class="p-3">
                            <p class="text-[10px] font-bold text-gray-600 dark:text-gray-300 leading-relaxed">
                                Los reportes incluyen todos los movimientos y ajustes registrados hasta la fecha actual.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- PANEL DERECHO: Reportes descargables -->
                <div class="flex-1 flex flex-col">
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="bg-indigo-600 px-3 py-1.5 border-b-2 border-black flex items-center gap-2">
                            <mat-icon class="text-white !text-base">description</mat-icon>
                            <span class="font-black text-xs uppercase text-white">Generar Reportes</span>
                        </div>
                        <div class="p-3 grid grid-cols-2 gap-3">

                            <!-- Stock General -->
                            <div class="border-2 border-black rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20 shadow-[2px_2px_0px_0px_#000]">
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="w-8 h-8 bg-blue-500 border-2 border-black rounded-lg flex items-center justify-center shadow-[1px_1px_0px_0px_#000] shrink-0">
                                        <mat-icon class="text-white !text-sm">inventory</mat-icon>
                                    </div>
                                    <div>
                                        <p class="text-xs font-black uppercase text-black dark:text-white leading-none">Stock General</p>
                                        <p class="text-[9px] font-bold text-gray-500 dark:text-gray-400">Herramientas y ubicaciones</p>
                                    </div>
                                </div>
                                <button (click)="exportarReporte('stock-general')"
                                        class="w-full h-8 bg-blue-500 text-white font-black text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center justify-center gap-1">
                                    <mat-icon class="!text-sm">download</mat-icon> Excel
                                </button>
                            </div>

                            <!-- Movimientos -->
                            <div class="border-2 border-black rounded-lg p-3 bg-emerald-50 dark:bg-emerald-900/20 shadow-[2px_2px_0px_0px_#000]">
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="w-8 h-8 bg-emerald-500 border-2 border-black rounded-lg flex items-center justify-center shadow-[1px_1px_0px_0px_#000] shrink-0">
                                        <mat-icon class="text-white !text-sm">swap_horiz</mat-icon>
                                    </div>
                                    <div>
                                        <p class="text-xs font-black uppercase text-black dark:text-white leading-none">Movimientos</p>
                                        <p class="text-[9px] font-bold text-gray-500 dark:text-gray-400">Historial de ajustes y cambios</p>
                                    </div>
                                </div>
                                <button (click)="exportarReporte('movimientos')"
                                        class="w-full h-8 bg-emerald-500 text-white font-black text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center justify-center gap-1">
                                    <mat-icon class="!text-sm">download</mat-icon> Excel
                                </button>
                            </div>

                            <!-- Bajo Stock -->
                            <div class="border-2 border-black rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20 shadow-[2px_2px_0px_0px_#000]">
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="w-8 h-8 bg-amber-500 border-2 border-black rounded-lg flex items-center justify-center shadow-[1px_1px_0px_0px_#000] shrink-0">
                                        <mat-icon class="text-white !text-sm">warning</mat-icon>
                                    </div>
                                    <div>
                                        <p class="text-xs font-black uppercase text-black dark:text-white leading-none">Bajo Stock</p>
                                        <p class="text-[9px] font-bold text-gray-500 dark:text-gray-400">Herramientas que necesitan reposición</p>
                                    </div>
                                </div>
                                <button (click)="exportarReporte('bajo-stock')"
                                        class="w-full h-8 bg-amber-500 text-white font-black text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center justify-center gap-1">
                                    <mat-icon class="!text-sm">download</mat-icon> Excel
                                </button>
                            </div>

                            <!-- Ubicaciones -->
                            <div class="border-2 border-black rounded-lg p-3 bg-violet-50 dark:bg-violet-900/20 shadow-[2px_2px_0px_0px_#000]">
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="w-8 h-8 bg-violet-500 border-2 border-black rounded-lg flex items-center justify-center shadow-[1px_1px_0px_0px_#000] shrink-0">
                                        <mat-icon class="text-white !text-sm">location_on</mat-icon>
                                    </div>
                                    <div>
                                        <p class="text-xs font-black uppercase text-black dark:text-white leading-none">Ubicaciones</p>
                                        <p class="text-[9px] font-bold text-gray-500 dark:text-gray-400">Ocupación de almacenes y racks</p>
                                    </div>
                                </div>
                                <button (click)="exportarReporte('ubicaciones')"
                                        class="w-full h-8 bg-violet-500 text-white font-black text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center justify-center gap-1">
                                    <mat-icon class="!text-sm">download</mat-icon> Excel
                                </button>
                            </div>

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
    `]
})
export class ReportesInventarioComponent {
    public dialogRef = inject(MatDialogRef<ReportesInventarioComponent>, { optional: true });
    private router   = inject(Router);

    stats = [
        { title: 'Total Items',      value: 1247, icon: 'inventory_2',  color: 'text-blue-600',   bgColor: 'bg-blue-50 dark:bg-blue-900/30' },
        { title: 'Disponible',       value: 987,  icon: 'check_circle', color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30' },
        { title: 'Bajo Stock',       value: 45,   icon: 'warning',      color: 'text-amber-600',  bgColor: 'bg-amber-50 dark:bg-amber-900/30' },
        { title: 'Sin Stock',        value: 12,   icon: 'error',        color: 'text-rose-600',   bgColor: 'bg-rose-50 dark:bg-rose-900/30' },
        { title: 'Ubicaciones',      value: 25,   icon: 'place',        color: 'text-violet-600', bgColor: 'bg-violet-50 dark:bg-violet-900/30' },
        { title: 'Movim. Hoy',       value: 38,   icon: 'sync_alt',     color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-900/30' },
    ];

    exportarReporte(tipo: string): void {
        console.log('Exportar reporte:', tipo);
    }
}
