import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter } from 'rxjs/operators';

/* ── Interfaces del Sistema de Herramientas BOA ─────────────────────────── */

export interface ReporteItem {
    id:          string;
    codigo:      string;           // Ej: R-CAL-01
    nombre:      string;
    descripcion: string;
    tipo:        'PDF' | 'EXCEL' | 'AMBOS';
    activo:      boolean;
    preview?:    boolean;
    frecuencia?: number;           // veces generado (para ordenamiento)
}

export interface CategoriaReporte {
    id:          string;
    codigo:      string;           // CAL, SAL, ING, INV
    nombre:      string;
    descripcion: string;
    icono:       string;           // nombre del mat-icon
    bgHeader:    string;           // clase Tailwind para el encabezado de la card
    bgBadge:     string;           // clase para el badge de código
    reportes:    ReporteItem[];
}

export type FormatoReporte = 'PDF' | 'EXCEL';

/* ─────────────────────────────────────────────────────────────────────────── */

@Component({
    selector: 'app-reports',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        MatIconModule,
        MatTooltipModule
    ],
    templateUrl: './reports.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        :host-context(.dark) { color-scheme: dark; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        .animate-fade-in  { animation: fadeIn  0.15s ease-out forwards; }
        .animate-pop-up   { animation: popUp   0.25s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes popUp  { from{opacity:0;transform:scale(0.93) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
    `]
})
export class ReportsComponent implements OnInit {
    private router = inject(Router);

    showCards        = signal(true);
    searchTerm       = signal('');
    selectedCategory = signal<CategoriaReporte | null>(null);

    /* ── Estadísticas globales ─ */
    get totalReportes(): number {
        return this.allCategorias.reduce((a, c) => a + c.reportes.length, 0);
    }
    get reportesActivos(): number {
        return this.allCategorias.reduce((a, c) => a + c.reportes.filter(r => r.activo).length, 0);
    }
    get reportesPdf(): number {
        return this.allCategorias.reduce((a, c) =>
            a + c.reportes.filter(r => r.tipo === 'PDF' || r.tipo === 'AMBOS').length, 0);
    }
    get reportesExcel(): number {
        return this.allCategorias.reduce((a, c) =>
            a + c.reportes.filter(r => r.tipo === 'EXCEL' || r.tipo === 'AMBOS').length, 0);
    }

    /* ── Catálogo de reportes ─── */
    allCategorias: CategoriaReporte[] = [
        {
            id: 'inventario', codigo: 'INV', nombre: 'INVENTARIO',
            descripcion: 'Inventario maestro de herramientas, equipos y bancos de prueba. Estados, condiciones y ubicaciones por almacén.',
            icono: 'inventory_2', bgHeader: 'bg-amber-600', bgBadge: 'bg-white text-amber-700',
            reportes: [
                { id: 'inv-1', codigo: 'R-INV-01', nombre: 'Inventario maestro de herramientas y equipos',     descripcion: 'Listado completo con código, P/N, S/N, estado, ubicación y condición',        tipo: 'EXCEL', activo: true,  frecuencia: 400 },
                { id: 'inv-2', codigo: 'R-INV-02', nombre: 'Herramientas por estado y condición',              descripcion: 'Agrupado por NUEVO · USADO · EN REPARACIÓN · BAJA',                          tipo: 'AMBOS', activo: true,  frecuencia: 180, preview: true },
                { id: 'inv-3', codigo: 'R-INV-03', nombre: 'Herramientas por almacén y ubicación',             descripcion: 'Distribución por almacén, estante y nivel de cada base',                      tipo: 'EXCEL', activo: true,  frecuencia: 120 },
                { id: 'inv-4', codigo: 'R-INV-04', nombre: 'Herramientas en cuarentena u observadas',          descripcion: 'Items dañados, retenidos o con baja registrada',                              tipo: 'PDF',   activo: true,  frecuencia: 45  },
                { id: 'inv-5', codigo: 'R-INV-05', nombre: 'Herramientas de fabricación local',                descripcion: 'Items fabricados internamente en talleres BOA',                               tipo: 'AMBOS', activo: true,  frecuencia: 30  },
                { id: 'inv-6', codigo: 'R-INV-06', nombre: 'Historial de cambios de estado',                   descripcion: 'Auditoría completa de transiciones con responsable, motivo y documento',      tipo: 'AMBOS', activo: true,  frecuencia: 95, preview: true }
            ]
        },
        {
            id: 'movimientos', codigo: 'MOV', nombre: 'MOVIMIENTOS',
            descripcion: 'Entradas, salidas, traspasos entre bases y ajustes de stock. Trazabilidad completa de cada movimiento.',
            icono: 'swap_horiz', bgHeader: 'bg-blue-700', bgBadge: 'bg-white text-blue-700',
            reportes: [
                { id: 'mov-1', codigo: 'R-MOV-01', nombre: 'Registro de entradas al almacén',                  descripcion: 'Recepciones con N° nota, fecha, responsable, P/N y factura',                  tipo: 'AMBOS', activo: true,  frecuencia: 180, preview: true },
                { id: 'mov-2', codigo: 'R-MOV-02', nombre: 'Registro de salidas del almacén',                  descripcion: 'Despachos con licencia, área, orden de trabajo y aeronave',                   tipo: 'AMBOS', activo: true,  frecuencia: 320, preview: true },
                { id: 'mov-3', codigo: 'R-MOV-03', nombre: 'Traspasos entre almacenes y bases',                descripcion: 'Movimientos internos entre bases aeronáuticas y almacenes',                    tipo: 'AMBOS', activo: true,  frecuencia: 60  },
                { id: 'mov-4', codigo: 'R-MOV-04', nombre: 'Ajustes de stock',                                 descripcion: 'Aumentos, reducciones, correcciones y mermas con motivo registrado',           tipo: 'EXCEL', activo: true,  frecuencia: 40  },
                { id: 'mov-5', codigo: 'R-MOV-05', nombre: 'Historial completo de movimientos',                descripcion: 'Vista unificada de todos los movimientos: INVENTARIO y KITS',                  tipo: 'EXCEL', activo: true,  frecuencia: 75  }
            ]
        },
        {
            id: 'calibracion', codigo: 'CAL', nombre: 'CALIBRACIÓN',
            descripcion: 'Control y seguimiento de herramientas y equipos sujetos a calibración periódica. Vencimientos y certificados.',
            icono: 'tune', bgHeader: 'bg-[#0F172AFF]', bgBadge: 'bg-[#FFC501FF] text-black',
            reportes: [
                { id: 'cal-1', codigo: 'R-CAL-01', nombre: 'Herramientas sujetas a calibración',               descripcion: 'Inventario con frecuencia en meses, proveedor y N° certificado',               tipo: 'EXCEL', activo: true,  frecuencia: 150 },
                { id: 'cal-2', codigo: 'R-CAL-02', nombre: 'Herramientas próximas a vencer',                   descripcion: 'Vencimientos en los próximos 30 días con alerta de prioridad',                tipo: 'AMBOS', activo: true,  frecuencia: 210, preview: true },
                { id: 'cal-3', codigo: 'R-CAL-03', nombre: 'Herramientas con calibración vencida',             descripcion: 'Equipos fuera de plazo que requieren acción inmediata',                       tipo: 'PDF',   activo: true,  frecuencia: 90, preview: true  },
                { id: 'cal-4', codigo: 'R-CAL-04', nombre: 'Herramientas actualmente en calibración',          descripcion: 'Equipos fuera del almacén enviados a calibración externa',                    tipo: 'PDF',   activo: true,  frecuencia: 55  },
                { id: 'cal-5', codigo: 'R-CAL-05', nombre: 'Herramientas calibradas por período',              descripcion: 'Histórico de calibraciones realizadas con fechas y proveedores',               tipo: 'AMBOS', activo: true,  frecuencia: 45  },
                { id: 'cal-6', codigo: 'R-CAL-06', nombre: 'Herramientas sujetas a calibración por base',      descripcion: 'Control distribuido por base aeronáutica (CBBA, SCZ, LPZ)',                   tipo: 'EXCEL', activo: true,  frecuencia: 40  }
            ]
        },
        {
            id: 'prestamos', codigo: 'PRE', nombre: 'PRÉSTAMOS',
            descripcion: 'Herramientas en préstamo, deudores, equipos en reparación externa y kits prestados al personal.',
            icono: 'assignment_return', bgHeader: 'bg-red-700', bgBadge: 'bg-white text-red-700',
            reportes: [
                { id: 'pre-1', codigo: 'R-PRE-01', nombre: 'Herramientas en préstamo activo',                  descripcion: 'Herramientas fuera del almacén con responsable y fecha de salida',            tipo: 'AMBOS', activo: true,  frecuencia: 260, preview: true },
                { id: 'pre-2', codigo: 'R-PRE-02', nombre: 'Deudores — personal con herramientas pendientes',  descripcion: 'Personal con herramientas no devueltas, ordenado por días de mora',           tipo: 'PDF',   activo: true,  frecuencia: 320, preview: true },
                { id: 'pre-3', codigo: 'R-PRE-03', nombre: 'Herramientas enviadas a reparación externa',       descripcion: 'Salidas por mantenimiento con proveedor, estado y fecha estimada',            tipo: 'AMBOS', activo: true,  frecuencia: 95  },
                { id: 'pre-4', codigo: 'R-PRE-04', nombre: 'Historial de préstamos y devoluciones',            descripcion: 'Registro histórico de todos los préstamos con resultado',                     tipo: 'EXCEL', activo: true,  frecuencia: 50  }
            ]
        },
        {
            id: 'kits', codigo: 'KIT', nombre: 'KITS',
            descripcion: 'Gestión de kits de herramientas: composición, estado, préstamos y usos registrados.',
            icono: 'cases', bgHeader: 'bg-violet-700', bgBadge: 'bg-white text-violet-700',
            reportes: [
                { id: 'kit-1', codigo: 'R-KIT-01', nombre: 'Listado completo de kits',                         descripcion: 'Todos los kits con cantidad de ítems, categoría, estado y responsable',       tipo: 'AMBOS', activo: true,  frecuencia: 110, preview: true },
                { id: 'kit-2', codigo: 'R-KIT-02', nombre: 'Kits incompletos o con faltantes',                 descripcion: 'Kits con ítems faltantes o en estado INCOMPLETO',                            tipo: 'PDF',   activo: true,  frecuencia: 65  },
                { id: 'kit-3', codigo: 'R-KIT-03', nombre: 'Kits actualmente en uso o prestados',              descripcion: 'Kits asignados a personal con fecha, área y orden de trabajo',               tipo: 'AMBOS', activo: true,  frecuencia: 80, preview: true  },
                { id: 'kit-4', codigo: 'R-KIT-04', nombre: 'Kits por categoría y estado',                      descripcion: 'Clasificación por MANTENIMIENTO · LUBRICACIÓN · FRENOS · CALIBRACIÓN',      tipo: 'EXCEL', activo: true,  frecuencia: 35  }
            ]
        },
        {
            id: 'miscelaneos', codigo: 'MIS', nombre: 'MISCELÁNEOS',
            descripcion: 'Consumibles, repuestos, materiales y químicos. Entradas, salidas y control de stock mínimo.',
            icono: 'category', bgHeader: 'bg-emerald-700', bgBadge: 'bg-white text-emerald-700',
            reportes: [
                { id: 'mis-1', codigo: 'R-MIS-01', nombre: 'Inventario de consumibles y materiales',           descripcion: 'Listado con código BOA-M, tipo, P/N, stock actual y stock mínimo',            tipo: 'EXCEL', activo: true,  frecuencia: 200 },
                { id: 'mis-2', codigo: 'R-MIS-02', nombre: 'Consumibles bajo stock mínimo',                    descripcion: 'Ítems que requieren reposición urgente por tipo y ubicación',                 tipo: 'AMBOS', activo: true,  frecuencia: 140, preview: true },
                { id: 'mis-3', codigo: 'R-MIS-03', nombre: 'Registro de entradas de materiales',               descripcion: 'Recepciones con N° nota, recibido por, marca y factura',                     tipo: 'AMBOS', activo: true,  frecuencia: 90  },
                { id: 'mis-4', codigo: 'R-MIS-04', nombre: 'Registro de salidas de materiales',                descripcion: 'Despachos con N° licencia, área, orden de trabajo y aeronave',                tipo: 'AMBOS', activo: true,  frecuencia: 110 }
            ]
        }
    ];

    categoriasFiltradas = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        if (!term) return this.allCategorias;
        return this.allCategorias.filter(c =>
            c.nombre.toLowerCase().includes(term) ||
            c.codigo.toLowerCase().includes(term) ||
            c.reportes.some(r => r.nombre.toLowerCase().includes(term))
        );
    });

    ngOnInit(): void {
        this.checkRoute(this.router.url);
        this.router.events.pipe(filter(e => e instanceof NavigationEnd))
            .subscribe((e: any) => this.checkRoute(e.url));
    }

    private checkRoute(url: string): void {
        this.showCards.set(url.includes('/inventario/reportes') || url === '/reportes' || url === '/reportes/');
    }

    selectCategory(cat: CategoriaReporte): void { this.selectedCategory.set(cat); }
    closeModal():                           void { this.selectedCategory.set(null); }
    handleModalClick(e: MouseEvent):        void { e.stopPropagation(); }

    generateReport(reporte: ReporteItem, formato: FormatoReporte): void {
        console.log(`Generando ${formato}:`, reporte.codigo);
    }

    previewReport(reporte: ReporteItem): void {
        console.log('Vista previa:', reporte.codigo);
    }

    getTipoClass(tipo: string): string {
        const m: Record<string, string> = {
            'PDF':   'bg-red-100 text-red-800 border-red-800',
            'EXCEL': 'bg-green-100 text-green-800 border-green-800',
            'AMBOS': 'bg-purple-100 text-purple-800 border-purple-800'
        };
        return m[tipo] ?? 'bg-gray-100 text-gray-700 border-gray-500';
    }
}
