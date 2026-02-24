import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { filter } from 'rxjs/operators';

// --- INTERFACES ---
interface ReportItem {
    id: string;
    nombre: string;
    descripcion: string;
    tipo: 'PDF' | 'EXCEL' | 'AMBOS';
    codigo: string;
    frecuencia?: number;
    preview?: boolean;
}

interface ReportCategory {
    id: string;
    nombre: string;
    codigo: string;
    icono: string;
    color: 'info' | 'danger' | 'success' | 'warning';
    headerBgClass: string;
    gradientClasses: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
    descripcion: string;
    reportes: ReportItem[];
}

@Component({
    selector: 'app-reports',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule
    ],
    templateUrl: './reports.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        /* --- CLASE MAESTRA NEO-BRUTALISTA --- */
        .neo-card-base {
            background-color: white;
            border: 3px solid black;
            border-radius: 12px;
            box-shadow: 6px 6px 0px 0px rgba(0, 0, 0, 1);
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
            position: relative;
            overflow: hidden;
        }

        .neo-card-base:hover {
            transform: translate(-2px, -2px);
            box-shadow: 8px 8px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .neo-card-base {
            background-color: #1e293b;
            border-color: #000;
            box-shadow: 6px 6px 0px 0px rgba(71, 85, 105, 1);
        }

        :host-context(.dark) .neo-card-base:hover {
            box-shadow: 8px 8px 0px 0px rgba(71, 85, 105, 1);
        }

        /* Animaciones */
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
        .animate-pop-up { animation: popUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes popUp {
            from { opacity: 0; transform: scale(0.9) translateY(20px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* Scrollbar */
        .overflow-y-auto::-webkit-scrollbar { width: 8px; }
        .overflow-y-auto::-webkit-scrollbar-track { background: #000; }
        .overflow-y-auto::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; border: 1px solid white; }
    `]
})
export class ReportsComponent implements OnInit {
    private router = inject(Router);

    // Signals
    showCards = signal(true);
    searchTerm = signal('');
    selectedCategory = signal<ReportCategory | null>(null);

    // Estadísticas
    stats = signal({
        totalReportes: 0,
        reportesHoy: 12,
        reportesMes: 156,
        masUsado: 'Listado Herramientas'
    });

    // DATA
    allCategorias: ReportCategory[] = [
        {
            id: 'calibracion',
            nombre: 'CALIBRACIÓN',
            codigo: 'CAL',
            icono: 'heroicons_outline:adjustments-horizontal',
            color: 'info',
            headerBgClass: 'bg-[#111A43]',
            gradientClasses: '',
            textClass: 'text-white',
            bgClass: '',
            borderClass: '',
            descripcion: 'Control y seguimiento de herramientas y equipos sujetos a calibración periódica',
            reportes: [
                { id: 'cal-1', nombre: 'Listado Herramientas y equipos sujetos a calibración', descripcion: 'Inventario general sujeto a control', tipo: 'EXCEL', codigo: 'R-CAL-01', frecuencia: 150 },
                { id: 'cal-2', nombre: 'Reporte Mensual de herramientas y equipos a calibrar', descripcion: 'Programación mensual', tipo: 'PDF', codigo: 'R-CAL-02', frecuencia: 85, preview: true },
                { id: 'cal-3', nombre: 'Herramientas y equipos próximos a vencer', descripcion: 'Alertas de vencimiento', tipo: 'AMBOS', codigo: 'R-CAL-03', frecuencia: 210, preview: true },
                { id: 'cal-4', nombre: 'Herramientas y equipos sujetos a calibración por Base', descripcion: 'Control distribuido por ubicación', tipo: 'EXCEL', codigo: 'R-CAL-04', frecuencia: 45 }
            ]
        },
        {
            id: 'salidas',
            nombre: 'SALIDAS',
            codigo: 'SAL',
            icono: 'heroicons_outline:arrow-up-tray',
            color: 'danger',
            headerBgClass: 'bg-[#ff0000]',
            gradientClasses: '',
            textClass: 'text-white',
            bgClass: '',
            borderClass: '',
            descripcion: 'Control de salidas, préstamos y deudores de herramientas y equipos',
            reportes: [
                { id: 'sal-1', nombre: 'Reporte de deudores', descripcion: 'Personal con herramientas pendientes', tipo: 'PDF', codigo: 'R-SAL-01', frecuencia: 320, preview: true },
                { id: 'sal-2', nombre: 'Reporte Herramientas traspasadas', descripcion: 'Movimientos entre áreas', tipo: 'AMBOS', codigo: 'R-SAL-02', frecuencia: 60 },
                { id: 'sal-3', nombre: 'Herramientas y equipos enviados a calibración y/o reparación', descripcion: 'Salidas externas por mantenimiento', tipo: 'AMBOS', codigo: 'R-SAL-03', frecuencia: 95 }
            ]
        },
        {
            id: 'ingresos',
            nombre: 'INGRESOS',
            codigo: 'ING',
            icono: 'heroicons_outline:arrow-down-tray',
            color: 'success',
            headerBgClass: 'bg-[#05f65d]',
            gradientClasses: '',
            textClass: 'text-black',
            bgClass: '',
            borderClass: '',
            descripcion: 'Registro de entradas y recepciones de herramientas al almacén',
            reportes: [
                { id: 'ing-1', nombre: 'Listado de herramientas, bancos de prueba y equipos de apoyo ingresados', descripcion: 'Bitácora completa de recepciones', tipo: 'AMBOS', codigo: 'R-ING-01', frecuencia: 180, preview: true }
            ]
        },
        {
            id: 'inventario',
            nombre: 'INVENTARIO',
            codigo: 'INV',
            icono: 'heroicons_outline:clipboard-document-list',
            color: 'warning',
            headerBgClass: 'bg-[#ffcc00]',
            gradientClasses: '',
            textClass: 'text-black',
            bgClass: '',
            borderClass: '',
            descripcion: 'Listados generales, estados y control de inventario de herramientas',
            reportes: [
                { id: 'inv-1', nombre: 'Listados de herramientas, equipos y bancos de prueba', descripcion: 'Inventario maestro', tipo: 'EXCEL', codigo: 'R-INV-01', frecuencia: 400 },
                { id: 'inv-2', nombre: 'Listado de Herramientas y equipos Fabricación local', descripcion: 'Items fabricados internamente', tipo: 'AMBOS', codigo: 'R-INV-02', frecuencia: 30 },
                { id: 'inv-3', nombre: 'Listado Herramientas y equipos en cuarentena', descripcion: 'Items observados o dañados', tipo: 'PDF', codigo: 'R-INV-03', frecuencia: 45 },
                { id: 'inv-4', nombre: 'Listado Herramientas, equipos y bancos de prueba de Bases/Unidades', descripcion: 'Inventario descentralizado', tipo: 'EXCEL', codigo: 'R-INV-04', frecuencia: 120 }
            ]
        }
    ];

    categoriasFiltradas = computed(() => {
        const term = this.searchTerm().toLowerCase();
        if (!term) return this.allCategorias;

        return this.allCategorias.filter(cat =>
            cat.nombre.toLowerCase().includes(term) ||
            cat.codigo.toLowerCase().includes(term)
        );
    });

    ngOnInit(): void {
        this.checkRoute(this.router.url);
        this.calculateStats();

        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe((event: any) => {
            this.checkRoute(event.url);
        });
    }

    private checkRoute(url: string): void {
        this.showCards.set(url.includes('/inventario/reportes') || url === '/reportes' || url === '/reportes/');
    }

    private calculateStats(): void {
        const total = this.allCategorias.reduce((acc, cat) => acc + cat.reportes.length, 0);
        this.stats.update(s => ({ ...s, totalReportes: total }));
    }

    selectCategory(categoria: ReportCategory): void {
        this.selectedCategory.set(categoria);
    }

    closeModal(): void {
        this.selectedCategory.set(null);
    }

    handleModalClick(event: MouseEvent): void {
        event.stopPropagation();
    }

    generateReport(reporte: ReportItem, formato: 'PDF' | 'EXCEL'): void {
        console.log(`Generando ${formato}:`, reporte);
    }

    previewReport(reporte: ReportItem): void {
        if (reporte.preview) {
            console.log('Vista previa:', reporte);
        }
    }

    getIconColor(color: string): string {
        const map: any = {
            info: 'text-[#111A43] text-black dark:text-black',
            danger: 'text-[#ff0000] text-black dark:text-black',
            success: 'text-[#05f65d] text-black dark:text-black',
            warning: 'text-[#ffcc00] text-black dark:text-black'
        };
        return map[color] || 'text-black dark:text-white';
    }
}
