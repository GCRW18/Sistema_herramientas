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
import { REPORTE_CONFIGS, ColDef, STATUS_LABELS } from './reporte-configs';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

/* ── Opciones de sub-reporte por tab ───────────────────────────────────────── */
export interface SubReporteOpt {
    id:     string;
    codigo: string;
    label:  string;
}

const TAB_OPTS: Record<string, SubReporteOpt[]> = {
    inventario: [
        { id: 'inv-1', codigo: 'MGH-108',  label: 'Inventario maestro'      },
        { id: 'inv-2', codigo: 'R-INV-02', label: 'Por estado / condición'  },
        { id: 'inv-4', codigo: 'MGH-112',  label: 'Cuarentena / Observadas' },
        { id: 'inv-5', codigo: 'MGH-105',  label: 'Fabricación local'       },
    ],
    movimientos: [
        { id: 'mov-1', codigo: 'MGH-114',  label: 'Entradas al almacén'   },
        { id: 'mov-2', codigo: 'R-MOV-02', label: 'Salidas del almacén'   },
        { id: 'mov-3', codigo: 'MGH-110',  label: 'Traspasos entre bases' },
    ],
    calibracion: [
        { id: 'cal-1', codigo: 'MGH-102',  label: 'Sujetas a calibración'       },
        { id: 'cal-2', codigo: 'MGH-104',  label: 'Próximas a vencer (≤60 d)'   },
        { id: 'cal-3', codigo: 'R-CAL-03', label: 'Calibración vencida'         },
        { id: 'cal-4', codigo: 'MGH-111',  label: 'Actualmente en calibración'  },
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
        { id: 'mis-1', codigo: 'MGH-120',  label: 'Inventario de consumibles' },
        { id: 'mis-2', codigo: 'R-MIS-02', label: 'Bajo stock mínimo'         },
        { id: 'mis-3', codigo: 'MGH-118',  label: 'Entradas de materiales'    },
        { id: 'mis-4', codigo: 'MGH-121',  label: 'Salidas de materiales'     },
    ],
};

/* ─────────────────────────────────────────────────────────────────────────── */

@Component({
    selector:      'app-reports',
    standalone:    true,
    encapsulation: ViewEncapsulation.None,
    imports: [
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
        this.loadData();
    }

    /* ── Cambio de sub-reporte ── */
    setReport(id: string): void {
        if (this.activeReport() === id) return;
        this.activeReport.set(id);
        this.searchTerm.set('');
        this.pageIndex.set(0);
        this.loadData();
    }

    /* ── Carga de datos desde el API ── */
    loadData(): void {
        const config = REPORTE_CONFIGS[this.activeReport()];
        if (!config) return;
        this.loading.set(true);
        this.rows.set([]);
        config.loader(this.reportesSvc, {}).subscribe({
            next:  (data: any[]) => { this.rows.set(data ?? []); this.loading.set(false); },
            error: () => { this.rows.set([]); this.loading.set(false); }
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
        if (col.tipo === 'bool') return v === true ? '✔' : '—';
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
        return {
            titulo:   opt?.label ?? config?.mghCode ?? 'Reporte',
            mgh_code: opt?.codigo ?? config?.mghCode ?? '',
            columnas: JSON.stringify(cols),
        };
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
