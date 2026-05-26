import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReportesService, DashboardStats, FiltrosReporte } from './reportes.service';
import { REPORTE_CONFIGS } from './reporte-visor-dialog.component';

/* ── Interfaces ─────────────────────────────────────────────────────────── */

export interface ReporteDescarga {
    id:          string;
    codigo:      string;   // R-INV-01, R-CAL-01, etc.
    nombre:      string;
    descripcion: string;
    icon:        string;
    bgCard:      string;   // clase Tailwind para el chip de categoría
    tieneExcel:  boolean;
    tienePdf:    boolean;
}

export interface ResumenInventario {
    totalHerramientas: number;
    disponibles:       number;
    enUso:             number;
    enCalibracion:     number;
    bajas:             number;
    kitsActivos:       number;
}

/* ─────────────────────────────────────────────────────────────────────────── */

/** Mapeo de IDs locales → IDs de REPORTE_CONFIGS para loaders de Excel */
const ID_MAP: Record<string, string> = {
    'inv-maestro':    'inv-1', 'inv-estado':      'inv-2',
    'inv-cuarentena': 'inv-4', 'inv-historial':   'inv-5',
    'mov-entradas':   'mov-1', 'mov-salidas':      'mov-2', 'mov-traspasos': 'mov-3',
    'cal-listado':    'cal-1', 'cal-proximas':     'cal-2', 'cal-vencidas':  'cal-3',
    'pre-activos':    'pre-1', 'pre-deudores':     'pre-2', 'pre-reparacion':'pre-4',
    'kit-listado':    'kit-1', 'kit-incompletos':  'kit-2', 'kit-en-uso':    'kit-3',
};

@Component({
    selector: 'app-reportes-inventario',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatIconModule, MatTooltipModule],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] transition-colors duration-300 font-sans overflow-hidden">

        <div class="fixed top-20 right-10 w-40 h-40 bg-[#0F172AFF] rounded-full border-[3px] border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-24 h-24 bg-[#FFC501FF] rotate-12 border-[3px] border-black opacity-5 pointer-events-none"></div>

        <div class="flex-1 flex flex-col p-4 gap-3 overflow-hidden relative z-10">

            <!-- ══════════ HEADER ══════════ -->
            <div class="flex items-center justify-between gap-4 shrink-0 flex-wrap">
                <div class="flex items-center gap-4">
                    <div class="flex items-center justify-center w-10 h-10 bg-white dark:bg-[#0F172AFF] border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-xl shrink-0">
                        <mat-icon class="text-black dark:text-[#FFC501FF] !text-base">bar_chart</mat-icon>
                    </div>
                    <div>
                        <h1 class="text-xl font-black text-black dark:text-white uppercase tracking-tighter leading-none">
                            REPORTES INVENTARIO
                        </h1>
                        <div class="flex items-center gap-2 mt-0.5">
                            <p class="text-[10px] font-bold bg-[#FFC501FF] text-black px-2 py-0.5 inline-block border-2 border-black rounded uppercase tracking-wider">
                                Inventario · Calibración · Movimientos · Kits
                            </p>
                        </div>
                    </div>
                </div>

                <button (click)="exportarTodo()"
                        class="px-5 py-2 bg-emerald-500 text-white font-black text-xs
                               border-[2px] border-black rounded-xl
                               shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px]
                               hover:shadow-none transition-all uppercase flex items-center gap-2">
                    <mat-icon class="!text-sm">download</mat-icon>
                    <span class="hidden sm:inline">Exportar Todo</span>
                </button>
            </div>

            <!-- ══════════ CARD PRINCIPAL ══════════ -->
            <div class="flex-1 flex flex-col overflow-hidden border-[3px] border-black bg-white dark:bg-[#0F172AFF] rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">

                <!-- Cabecera oscura con chips del resumen -->
                <div class="px-4 py-2.5 bg-[#0F172AFF] border-b-[3px] border-black flex items-center justify-between shrink-0 flex-wrap gap-2">
                    <h2 class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <mat-icon class="!text-base text-[#FFC501FF]">bar_chart</mat-icon>
                        REPORTES DISPONIBLES ({{ reportes.length }})
                    </h2>

                    <div class="flex items-center gap-2 flex-wrap">

                        <div class="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5 border border-black">
                            <div class="w-5 h-5 bg-[#0F172AFF] border border-black rounded flex items-center justify-center">
                                <mat-icon class="!text-xs text-[#FFC501FF]">inventory_2</mat-icon>
                            </div>
                            <div>
                                <div class="text-[8px] font-black uppercase text-white leading-none">Herramientas</div>
                                <div class="text-sm font-black text-white leading-none">{{ resumen.totalHerramientas }}</div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 bg-green-600/30 rounded-lg px-3 py-1.5 border border-black">
                            <div class="w-5 h-5 bg-green-600 border border-black rounded flex items-center justify-center">
                                <mat-icon class="!text-xs text-black">check_circle</mat-icon>
                            </div>
                            <div>
                                <div class="text-[8px] font-black uppercase text-white leading-none">Disponibles</div>
                                <div class="text-sm font-black text-white leading-none">{{ resumen.disponibles }}</div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 bg-blue-500/30 rounded-lg px-3 py-1.5 border border-black">
                            <div class="w-5 h-5 bg-blue-500 border border-black rounded flex items-center justify-center">
                                <mat-icon class="!text-xs text-black">assignment_return</mat-icon>
                            </div>
                            <div>
                                <div class="text-[8px] font-black uppercase text-white leading-none">En Uso</div>
                                <div class="text-sm font-black text-white leading-none">{{ resumen.enUso }}</div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 bg-amber-500/30 rounded-lg px-3 py-1.5 border border-black">
                            <div class="w-5 h-5 bg-amber-500 border border-black rounded flex items-center justify-center">
                                <mat-icon class="!text-xs text-black">tune</mat-icon>
                            </div>
                            <div>
                                <div class="text-[8px] font-black uppercase text-white leading-none">Calibración</div>
                                <div class="text-sm font-black text-white leading-none">{{ resumen.enCalibracion }}</div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 bg-red-500/30 rounded-lg px-3 py-1.5 border border-black">
                            <div class="w-5 h-5 bg-red-600 border border-black rounded flex items-center justify-center">
                                <mat-icon class="!text-xs text-black">remove_circle</mat-icon>
                            </div>
                            <div>
                                <div class="text-[8px] font-black uppercase text-white leading-none">Bajas</div>
                                <div class="text-sm font-black text-white leading-none">{{ resumen.bajas }}</div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 bg-violet-500/30 rounded-lg px-3 py-1.5 border border-black">
                            <div class="w-5 h-5 bg-violet-600 border border-black rounded flex items-center justify-center">
                                <mat-icon class="!text-xs text-black">cases</mat-icon>
                            </div>
                            <div>
                                <div class="text-[8px] font-black uppercase text-white leading-none">Kits</div>
                                <div class="text-sm font-black text-white leading-none">{{ resumen.kitsActivos }}</div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- TABLA DE REPORTES -->
                <div class="flex-1 overflow-auto custom-scrollbar">
                    <table class="w-full">
                        <thead class="bg-gray-100 dark:bg-slate-800 border-b-[2px] border-black sticky top-0 z-10">
                        <tr class="text-left text-[10px] font-black uppercase tracking-wider text-black dark:text-white">
                            <th class="px-4 py-3 w-24">Código</th>
                            <th class="px-4 py-3">Reporte</th>
                            <th class="px-4 py-3 hidden md:table-cell">Descripción</th>
                            <th class="px-4 py-3 text-center w-28">Acciones</th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr *ngFor="let r of reportes"
                            class="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">

                            <td class="px-4 py-3">
                                <span class="font-mono text-[10px] font-black bg-gray-100 dark:bg-slate-700 px-2 py-0.5 border-2 border-black rounded text-black dark:text-white whitespace-nowrap">
                                    {{ r.codigo }}
                                </span>
                            </td>

                            <td class="px-4 py-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 border-2 border-black rounded-lg flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]"
                                         [ngClass]="r.bgCard">
                                        <mat-icon class="!text-sm text-white">{{ r.icon }}</mat-icon>
                                    </div>
                                    <span class="text-sm font-black text-black dark:text-white leading-tight">{{ r.nombre }}</span>
                                </div>
                            </td>

                            <td class="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 hidden md:table-cell">
                                {{ r.descripcion }}
                            </td>

                            <td class="px-4 py-3">
                                <div class="flex gap-1.5 justify-center">
                                    <button *ngIf="r.tieneExcel" (click)="exportar(r.id, 'EXCEL')"
                                            matTooltip="Descargar Excel"
                                            class="w-7 h-7 flex items-center justify-center bg-emerald-500 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                                        <mat-icon class="!text-sm text-white">table_view</mat-icon>
                                    </button>
                                    <button *ngIf="r.tienePdf" (click)="exportar(r.id, 'PDF')"
                                            matTooltip="Descargar PDF"
                                            class="w-7 h-7 flex items-center justify-center bg-[#FF1414FF] border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                                        <mat-icon class="!text-sm text-white">picture_as_pdf</mat-icon>
                                    </button>
                                </div>
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
export class ReportesInventarioComponent implements OnInit {
    public dialogRef     = inject(MatDialogRef<ReportesInventarioComponent>, { optional: true });
    private reportesSvc  = inject(ReportesService);

    loadingResumen = false;

    resumen: ResumenInventario = {
        totalHerramientas: 0,
        disponibles:       0,
        enUso:             0,
        enCalibracion:     0,
        bajas:             0,
        kitsActivos:       0
    };

    reportes: ReporteDescarga[] = [
        /* ── INVENTARIO ─────────────────────────────────── */
        {
            id: 'inv-maestro', codigo: 'R-INV-01',
            nombre:      'Inventario maestro de herramientas y equipos',
            descripcion: 'Listado completo con código, P/N, S/N, estado, ubicación y condición',
            icon: 'inventory_2', bgCard: 'bg-amber-600',
            tieneExcel: true,  tienePdf: false
        },
        {
            id: 'inv-estado', codigo: 'R-INV-02',
            nombre:      'Herramientas por estado y condición',
            descripcion: 'Agrupado por: NUEVO · USADO · EN REPARACIÓN · BAJA',
            icon: 'rule', bgCard: 'bg-amber-700',
            tieneExcel: true,  tienePdf: true
        },
        {
            id: 'inv-ubicacion', codigo: 'R-INV-03',
            nombre:      'Herramientas por almacén y ubicación',
            descripcion: 'Distribución por almacén, estante y nivel',
            icon: 'shelves', bgCard: 'bg-amber-800',
            tieneExcel: true,  tienePdf: false
        },
        {
            id: 'inv-cuarentena', codigo: 'R-INV-04',
            nombre:      'Herramientas en cuarentena o dadas de baja',
            descripcion: 'Items observados, dañados, retenidos o con baja registrada',
            icon: 'do_not_disturb_on', bgCard: 'bg-red-700',
            tieneExcel: false, tienePdf: true
        },
        {
            id: 'inv-historial', codigo: 'R-INV-05',
            nombre:      'Historial de cambios de estado',
            descripcion: 'Auditoría completa de transiciones de estado con responsable y motivo',
            icon: 'history', bgCard: 'bg-slate-600',
            tieneExcel: true,  tienePdf: true
        },
        /* ── MOVIMIENTOS ─────────────────────────────────── */
        {
            id: 'mov-entradas', codigo: 'R-MOV-01',
            nombre:      'Registro de entradas al almacén',
            descripcion: 'Recepciones con N° nota, fecha, responsable, P/N y factura',
            icon: 'arrow_downward', bgCard: 'bg-emerald-700',
            tieneExcel: true,  tienePdf: true
        },
        {
            id: 'mov-salidas', codigo: 'R-MOV-02',
            nombre:      'Registro de salidas del almacén',
            descripcion: 'Despachos con licencia, área, orden de trabajo y aeronave',
            icon: 'arrow_upward', bgCard: 'bg-red-700',
            tieneExcel: true,  tienePdf: true
        },
        {
            id: 'mov-traspasos', codigo: 'R-MOV-03',
            nombre:      'Traspasos entre almacenes y bases',
            descripcion: 'Movimientos internos entre bases aeronáuticas y almacenes',
            icon: 'swap_horiz', bgCard: 'bg-blue-700',
            tieneExcel: true,  tienePdf: true
        },
        {
            id: 'mov-ajustes', codigo: 'R-MOV-04',
            nombre:      'Ajustes de stock',
            descripcion: 'Aumentos, reducciones, correcciones y mermas con motivo',
            icon: 'tune', bgCard: 'bg-violet-700',
            tieneExcel: true,  tienePdf: false
        },
        /* ── CALIBRACIÓN ─────────────────────────────────── */
        {
            id: 'cal-listado', codigo: 'R-CAL-01',
            nombre:      'Herramientas sujetas a calibración',
            descripcion: 'Inventario general con frecuencia, proveedor y certificado',
            icon: 'tune', bgCard: 'bg-[#0F172AFF]',
            tieneExcel: true,  tienePdf: false
        },
        {
            id: 'cal-proximas', codigo: 'R-CAL-02',
            nombre:      'Herramientas próximas a vencer calibración',
            descripcion: 'Vencimientos en los próximos 30 días con alerta de prioridad',
            icon: 'timer', bgCard: 'bg-[#0F172AFF]',
            tieneExcel: true,  tienePdf: true
        },
        {
            id: 'cal-vencidas', codigo: 'R-CAL-03',
            nombre:      'Herramientas con calibración vencida',
            descripcion: 'Equipos fuera de plazo que requieren acción inmediata',
            icon: 'alarm_off', bgCard: 'bg-[#0F172AFF]',
            tieneExcel: false, tienePdf: true
        },
        /* ── PRÉSTAMOS ───────────────────────────────────── */
        {
            id: 'pre-activos', codigo: 'R-PRE-01',
            nombre:      'Herramientas en préstamo activo',
            descripcion: 'Herramientas fuera del almacén con responsable y fecha de salida',
            icon: 'assignment_return', bgCard: 'bg-sky-700',
            tieneExcel: true,  tienePdf: true
        },
        {
            id: 'pre-deudores', codigo: 'R-PRE-02',
            nombre:      'Deudores — personal con herramientas pendientes',
            descripcion: 'Personal con herramientas no devueltas, ordenado por días de mora',
            icon: 'person_off', bgCard: 'bg-red-800',
            tieneExcel: false, tienePdf: true
        },
        {
            id: 'pre-reparacion', codigo: 'R-PRE-03',
            nombre:      'Herramientas enviadas a reparación externa',
            descripcion: 'Salidas por mantenimiento o calibración con proveedor y estado',
            icon: 'build', bgCard: 'bg-sky-800',
            tieneExcel: true,  tienePdf: true
        },
        /* ── KITS ────────────────────────────────────────── */
        {
            id: 'kit-listado', codigo: 'R-KIT-01',
            nombre:      'Listado completo de kits',
            descripcion: 'Todos los kits con cantidad de ítems, estado y responsable',
            icon: 'cases', bgCard: 'bg-violet-700',
            tieneExcel: true,  tienePdf: true
        },
        {
            id: 'kit-incompletos', codigo: 'R-KIT-02',
            nombre:      'Kits incompletos o con faltantes',
            descripcion: 'Kits con ítems faltantes o en estado INCOMPLETO',
            icon: 'playlist_remove', bgCard: 'bg-violet-800',
            tieneExcel: false, tienePdf: true
        },
        {
            id: 'kit-en-uso', codigo: 'R-KIT-03',
            nombre:      'Kits actualmente en uso o prestados',
            descripcion: 'Kits asignados a personal con fecha y área receptora',
            icon: 'outbox', bgCard: 'bg-violet-900',
            tieneExcel: true,  tienePdf: true
        }
    ];

    ngOnInit(): void {
        this.loadingResumen = true;
        this.reportesSvc.getDashboardStats().subscribe({
            next: (s: DashboardStats) => {
                this.resumen = {
                    totalHerramientas: s.total_herramientas       ?? 0,
                    disponibles:       s.herramientas_disponibles  ?? 0,
                    enUso:             s.herramientas_prestadas     ?? 0,
                    enCalibracion:     s.enviadas_calibracion       ?? 0,
                    bajas:             s.bajas_mes                  ?? 0,
                    kitsActivos:       s.kits_activos               ?? 0,
                };
                this.loadingResumen = false;
            },
            error: () => { this.loadingResumen = false; }
        });
    }

    exportar(id: string, formato: 'EXCEL' | 'PDF'): void {
        if (formato === 'PDF') {
            this.reportesSvc.exportarPDF(id, {});
            return;
        }
        // EXCEL: obtener datos via REPORTE_CONFIGS y exportar CSV
        const configId = ID_MAP[id];
        const config   = configId ? REPORTE_CONFIGS[configId] : null;
        if (!config) { console.warn('Sin config Excel para:', id); return; }
        config.loader(this.reportesSvc, {} as FiltrosReporte).subscribe((data: any[]) => {
            const cols = config.columnas.map((c: any) => ({ key: c.key, header: c.header }));
            this.reportesSvc.exportarExcel(data, cols, id.replace(/-/g, '_'));
        });
    }

    exportarTodo(): void {
        // Exportar resumen general de herramientas
        this.reportesSvc.exportarPDF('inv-maestro', {});
    }
}
