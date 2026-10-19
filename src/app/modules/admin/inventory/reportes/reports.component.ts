import { PaginadorCompactoComponent } from 'app/shared/components/paginador-compacto/paginador-compacto.component';
import {
    Component, OnInit, inject, signal, computed, effect, ViewEncapsulation
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ReportesService } from './reportes.service';
import { REPORTE_CONFIGS, ColDef, FilterField, STATUS_LABELS } from './reporte-configs';
import { localDateStr } from '../../../../core/utils/date.utils';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

/* ── Opciones de sub-reporte por tab ───────────────────────────────────────── */
export interface SubReporteOpt {
    id:     string;
    codigo: string;
    label:  string;
}

const TAB_OPTS: Record<string, SubReporteOpt[]> = {
    inventario: [
        { id: 'inv-1', codigo: 'MGH-108',  label: 'Listado general'         },
        { id: 'inv-2', codigo: 'R-INV-02', label: 'Por estado / condición'  },
        { id: 'inv-4', codigo: 'MGH-112',  label: 'En cuarentena'           },
        { id: 'inv-5', codigo: 'MGH-105',  label: 'Fabricación local'       },
        { id: 'inv-6', codigo: 'MGH-115',  label: 'Listado por base'        },
    ],
    movimientos: [
        { id: 'mov-4', codigo: 'MGH-114',  label: 'Herramientas ingresadas'  },
        { id: 'mov-3', codigo: 'MGH-110',  label: 'Herramientas traspasadas' },
        { id: 'mov-5', codigo: 'MGH-113',  label: 'Compra internacional'     },
        { id: 'mov-1', codigo: 'R-MOV-01', label: 'Notas de entrada'         },
        { id: 'mov-2', codigo: 'R-MOV-02', label: 'Notas de salida'          },
    ],
    calibracion: [
        { id: 'cal-1', codigo: 'MGH-102',  label: 'Sujetas a calibración'       },
        { id: 'cal-5', codigo: 'MGH-103',  label: 'Reporte mensual'             },
        { id: 'cal-7', codigo: 'MGH-107',  label: 'Calibración por base'        },
        { id: 'cal-2', codigo: 'MGH-104',  label: 'Próximas a vencer'           },
        { id: 'cal-3', codigo: 'R-CAL-03', label: 'Calibración vencida'         },
        { id: 'cal-4', codigo: 'MGH-111',  label: 'Enviadas a calibración / reparación' },
    ],
    prestamos: [
        { id: 'pre-1', codigo: 'R-PRE-01', label: 'Préstamos activos'      },
        { id: 'pre-2', codigo: 'MGH-106',  label: 'Deudores'               },
        { id: 'pre-4', codigo: 'R-PRE-04', label: 'Historial de préstamos' },
    ],
    kits: [
        { id: 'kit-1', codigo: 'R-KIT-01', label: 'Todos los kits'      },
        { id: 'kit-2', codigo: 'R-KIT-02', label: 'Kits incompletos'    },
        { id: 'kit-3', codigo: 'R-KIT-03', label: 'En uso / Prestados'  },
    ],
    miscelaneos: [
        { id: 'mis-1', codigo: 'MGH-120',  label: 'Stock de misceláneos'      },
        { id: 'mis-2', codigo: 'R-MIS-02', label: 'Bajo stock mínimo'         },
        { id: 'mis-3', codigo: 'R-MIS-03', label: 'Entradas de materiales'    },
        { id: 'mis-4', codigo: 'MGH-121',  label: 'Salidas de materiales'     },
    ],
};

/* ─────────────────────────────────────────────────────────────────────────── */

@Component({
    selector:      'app-reports',
    standalone:    true,
    encapsulation: ViewEncapsulation.None,
    imports: [PaginadorCompactoComponent, 
        CommonModule, FormsModule,
        MatIconModule, MatTooltipModule,
        MatProgressSpinnerModule, MatSnackBarModule,
        HasPermissionDirective,
    ],
    templateUrl: './reports.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
    `]
})
export class ReportsComponent implements OnInit {

    private snackBar    = inject(MatSnackBar);
    private reportesSvc = inject(ReportesService);

    /* ── Tab / sub-reporte activo ── */
    activeTab    = signal<string>('inventario');
    activeReport = signal<string>('inv-1');

    /* ── Datos cargados desde el API ── */
    rows      = signal<any[]>([]);
    loading   = signal(false);
    generando = signal(false);

    /* ── Búsqueda y paginación ── */
    searchTerm = signal('');
    pageIndex  = signal(0);
    readonly pageSize = 25;

    /* ── Tabs principales ── */
    readonly TABS = [
        { id: 'inventario',  label: 'Inventario',  icon: 'inventory_2'      },
        { id: 'movimientos', label: 'Movimientos', icon: 'swap_horiz'       },
        { id: 'calibracion', label: 'Calibración', icon: 'tune'             },
        { id: 'prestamos',   label: 'Préstamos',   icon: 'assignment_return'},
        { id: 'kits',        label: 'Kits',        icon: 'cases'            },
        { id: 'miscelaneos', label: 'Misceláneos', icon: 'category'         },
    ];

    /* ── Computed ── */
    readonly currentOpts   = computed<SubReporteOpt[]>(() => TAB_OPTS[this.activeTab()] ?? []);
    readonly currentConfig = computed(() => REPORTE_CONFIGS[this.activeReport()]);
    readonly currentCols   = computed<ColDef[]>(() => this.currentConfig()?.columnas ?? []);
    readonly currentFiltros = computed<FilterField[]>(() => this.currentConfig()?.filtros ?? []);

    /* ── Filtros del sub-reporte activo (van igual a la grilla y al PDF) ── */
    filtros = signal<Record<string, any>>({});

    /** Bases con herramientas registradas (opciones del filtro Base). */
    private bases = signal<string[]>([]);

    readonly filteredRows = computed(() => {
        const s = this.searchTerm().toLowerCase().trim();
        if (!s) return this.rows();
        return this.rows().filter(row =>
            Object.values(row).some(v => String(v ?? '').toLowerCase().includes(s))
        );
    });

    readonly pagedRows = computed(() => {
        const start = this.pageIndex() * this.pageSize;
        return this.filteredRows().slice(start, start + this.pageSize);
    });

    readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize))
    );

    get pageStart(): number {
        return this.filteredRows().length === 0 ? 0 : this.pageIndex() * this.pageSize + 1;
    }
    get pageEnd(): number {
        return Math.min((this.pageIndex() + 1) * this.pageSize, this.filteredRows().length);
    }

    /* ─────────────────────────────────────────────────────────────────────── */

    constructor() {
        effect(() => {
            this.searchTerm();
            Promise.resolve().then(() => this.pageIndex.set(0));
        }, { allowSignalWrites: true });
    }

    ngOnInit(): void {
        this._resetFiltros();
        this.loadData();
        this.reportesSvc.getReporte('bases').subscribe({
            next:  rows => this.bases.set((rows ?? []).map(r => r.base).filter(Boolean)),
            error: () => this.bases.set([]),
        });
    }

    /** Opciones de un filtro select (fijas o cargadas del backend). */
    opcionesDe(f: FilterField): { value: any; label: string }[] {
        if (f.opcionesDe === 'bases') {
            return [{ value: '', label: 'Todas' }, ...this.bases().map(b => ({ value: b, label: b }))];
        }
        return f.options ?? [];
    }

    /** Valores iniciales de los filtros del sub-reporte activo. */
    private _resetFiltros(): void {
        const hoy = new Date();
        const valores: Record<string, any> = {};
        for (const f of this.currentFiltros()) {
            let v = f.default ?? '';
            if (v === 'hoy')       v = localDateStr(hoy);
            if (v === 'inicioMes') v = localDateStr(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
            if (v === 'finMes')    v = localDateStr(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
            valores[f.key] = v;
        }
        this.filtros.set(valores);
    }

    setFiltro(key: string, value: any): void {
        this.filtros.update(f => ({ ...f, [key]: value }));
        this.pageIndex.set(0);
        this.loadData();
    }

    limpiarFiltros(): void {
        this._resetFiltros();
        this.pageIndex.set(0);
        this.loadData();
    }

    /* ── Cambio de tab ── */
    setTab(tabId: string): void {
        const opts = TAB_OPTS[tabId];
        if (!opts?.length) return;
        this.activeTab.set(tabId);
        this.activeReport.set(opts[0].id);
        this.searchTerm.set('');
        this.pageIndex.set(0);
        this._resetFiltros();
        this.loadData();
    }

    /* ── Cambio de sub-reporte ── */
    setReport(id: string): void {
        if (this.activeReport() === id) return;
        this.activeReport.set(id);
        this.searchTerm.set('');
        this.pageIndex.set(0);
        this._resetFiltros();
        this.loadData();
    }

    /* ── Carga de datos desde el API ── */
    loadData(): void {
        if (!REPORTE_CONFIGS[this.activeReport()]) return;
        this.loading.set(true);
        this.rows.set([]);
        this.reportesSvc.getReporte(this.activeReport(), this.filtros()).subscribe({
            next:  (data: any[]) => { this.rows.set(data ?? []); this.loading.set(false); },
            error: (e) => {
                this.rows.set([]);
                this.loading.set(false);
                this.snackBar.open(e?.message || 'Error al cargar el reporte', 'OK', { duration: 6000 });
            }
        });
    }

    /* ── Paginación ── */
    prevPage(): void { if (this.pageIndex() > 0) this.pageIndex.update(p => p - 1); }
    nextPage(): void { if (this.pageIndex() < this.totalPages() - 1) this.pageIndex.update(p => p + 1); }

    /* ── Helpers de celda ── */
    /** Formatea fechas del backend; 'YYYY-MM-DD' se toma tal cual (new Date lo leería como UTC). */
    fmtDate(v: any, year: '2-digit' | 'numeric' = '2-digit'): string {
        if (v == null || v === '') return '—';
        const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return year === 'numeric' ? `${m[3]}/${m[2]}/${m[1]}` : `${m[3]}/${m[2]}/${m[1].slice(2)}`;
        const d = new Date(v);
        return isNaN(d.getTime())
            ? String(v)
            : d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year });
    }

    /** Booleano de pXP: true o texto 't'/'true'. */
    esVerdadero(v: any): boolean { return v === true || v === 't' || v === 'true'; }

    /** Texto de celda; vacío/null como guion. */
    texto(v: any): string { return v == null || v === '' ? '—' : String(v); }

    badgeClass(col: ColDef, v: any): string {
        return col.badge?.[String(v ?? '').toLowerCase()] ?? 'bg-gray-100 dark:bg-slate-700 border-gray-400';
    }

    /** Traduce el valor crudo de un badge (status/condición) al español. */
    badgeLabel(v: any): string {
        if (v == null || v === '') return '';
        return STATUS_LABELS[v] ?? STATUS_LABELS[String(v).toLowerCase()] ?? String(v);
    }

    getCellText(row: any, col: ColDef): string {
        const v = row[col.key];
        if (v == null || v === '') return '—';
        if (col.tipo === 'date') return this.fmtDate(v);
        if (col.tipo === 'days') return `${v}d`;
        if (col.tipo === 'bool') return this.esVerdadero(v) ? '✔' : '—';
        return String(v);
    }

    /* ── Parámetros para el PDF real (TCPDF backend) ── */
    private _pdfParams(): Record<string, string> {
        const config = this.currentConfig();
        const opt    = this.currentOpts().find(o => o.id === this.activeReport());
        const cols   = (config?.columnas ?? []).map(c => ({
            header: c.header,
            key:    c.key,
            tipo:   c.tipo ?? 'text',
            align:  c.align ?? null,
        }));
        const filtros: Record<string, string> = {};
        for (const [k, v] of Object.entries(this.filtros())) {
            if (v !== undefined && v !== null && v !== '') filtros[k] = String(v);
        }
        return {
            ...filtros,
            titulo:   opt?.label ?? config?.mghCode ?? 'Reporte',
            mgh_code: opt?.codigo ?? config?.mghCode ?? '',
            columnas: JSON.stringify(cols),
            generado_por: this._currentUser(),
        };
    }

    private _currentUser(): string {
        try { return JSON.parse(localStorage.getItem('aut') || '{}')?.nombre_usuario || ''; } catch { return ''; }
    }

    /* ── Generar reporte: PDF real (TCPDF backend), se abre en el visor ── */
    generarReporte(): void {
        if (!this.currentConfig() || !this.rows().length) {
            this.snackBar.open('Sin datos para el reporte', 'OK', { duration: 3000 });
            return;
        }
        if (this.generando()) return;

        // Se reserva la pestaña YA, dentro del gesto del click (si no, el bloqueador
        // de pop-ups la mata al volver de la petición async).
        const win = window.open('', '_blank');
        this.generando.set(true);

        this.reportesSvc.exportarPDF(this.activeReport(), this._pdfParams()).subscribe({
            next: (r) => {
                this.generando.set(false);
                try {
                    const bytes = Uint8Array.from(atob(r.pdf_base64), c => c.charCodeAt(0));
                    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
                    if (win) {
                        win.location.href = url;
                    } else {
                        const a = document.createElement('a');
                        a.href = url; a.download = r.nombre_archivo;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    }
                    setTimeout(() => URL.revokeObjectURL(url), 30000);
                } catch {
                    try { win?.close(); } catch { /* noop */ }
                    this.snackBar.open('No se pudo abrir el PDF generado', 'OK', { duration: 4000 });
                }
            },
            error: (e) => {
                this.generando.set(false);
                try { win?.close(); } catch { /* noop */ }
                this.snackBar.open(e?.message || 'Error al generar el reporte', 'OK', { duration: 5000 });
            },
        });
    }
}
