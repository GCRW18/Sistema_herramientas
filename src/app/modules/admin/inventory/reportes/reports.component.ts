import {
    Component, OnInit, inject, signal, computed, effect, ViewEncapsulation
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ReportesService, DashboardStats } from './reportes.service';
import { REPORTE_CONFIGS, ColDef } from './reporte-visor-dialog.component';

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

interface KpiCard {
    label: string;
    value: number | string;
    icon:  string;
    color: string;
    bg:    string;
}

/* ─────────────────────────────────────────────────────────────────────────── */

@Component({
    selector:      'app-reports',
    standalone:    true,
    encapsulation: ViewEncapsulation.None,
    imports: [
        CommonModule, FormsModule,
        MatIconModule, MatTooltipModule,
        MatProgressSpinnerModule, MatSnackBarModule,
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

    /* ── KPI stats ── */
    stats        = signal<Partial<DashboardStats>>({});
    loadingStats = signal(false);

    /* ── Tab / sub-reporte activo ── */
    activeTab    = signal<string>('inventario');
    activeReport = signal<string>('inv-1');

    /* ── Datos cargados desde el API ── */
    rows    = signal<any[]>([]);
    loading = signal(false);

    /* ── Búsqueda y paginación ── */
    searchTerm = signal('');
    pageIndex  = signal(0);
    readonly pageSize = 25;

    /* ── Tabs principales ── */
    readonly TABS = [
        { id: 'todos',       label: 'KPI',         icon: 'dashboard'        },
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

    readonly kpiCards = computed<KpiCard[]>(() => {
        const s = this.stats();
        return [
            { label: 'Total herramientas',  value: s.total_herramientas       ?? '—', icon: 'construction',      color: 'text-amber-800',  bg: 'bg-amber-50   border-amber-400'  },
            { label: 'Disponibles',         value: s.herramientas_disponibles  ?? '—', icon: 'check_circle',      color: 'text-green-800',  bg: 'bg-green-50   border-green-400'  },
            { label: 'Prestadas',           value: s.herramientas_prestadas    ?? '—', icon: 'assignment_return', color: 'text-blue-800',   bg: 'bg-blue-50    border-blue-400'   },
            { label: 'En cuarentena',       value: s.herramientas_cuarentena   ?? '—', icon: 'do_not_disturb_on', color: 'text-red-800',    bg: 'bg-red-50     border-red-400'    },
            { label: 'Cal. vencen ≤30 d',   value: s.herramientas_vencen_30    ?? '—', icon: 'schedule',          color: 'text-amber-700',  bg: 'bg-amber-50   border-amber-400'  },
            { label: 'En calibración',      value: s.enviadas_calibracion      ?? '—', icon: 'tune',              color: 'text-violet-800', bg: 'bg-violet-50  border-violet-400' },
            { label: 'Deudores activos',    value: s.deudores_activos          ?? '—', icon: 'person_off',        color: 'text-red-800',    bg: 'bg-red-50     border-red-400'    },
            { label: 'Kits activos',        value: s.kits_activos              ?? '—', icon: 'cases',             color: 'text-violet-800', bg: 'bg-violet-50  border-violet-400' },
            { label: 'Misc. bajo stock',    value: s.misc_bajo_stock           ?? '—', icon: 'category',          color: 'text-orange-800', bg: 'bg-orange-50  border-orange-400' },
            { label: 'Bajas del mes',       value: s.bajas_mes                 ?? '—', icon: 'remove_circle',     color: 'text-red-800',    bg: 'bg-red-50     border-red-400'    },
        ];
    });

    /* ─────────────────────────────────────────────────────────────────────── */

    constructor() {
        effect(() => {
            this.searchTerm();
            Promise.resolve().then(() => this.pageIndex.set(0));
        }, { allowSignalWrites: true });
    }

    ngOnInit(): void {
        this._loadStats();
        this.loadData();
    }

    _loadStats(): void {
        this.loadingStats.set(true);
        this.reportesSvc.getDashboardStats().subscribe({
            next:  s => { this.stats.set(s); this.loadingStats.set(false); },
            error: () => this.loadingStats.set(false),
        });
    }

    /* ── Cambio de tab ── */
    setTab(tabId: string): void {
        if (tabId === 'todos') {
            this.activeTab.set('todos');
            this.rows.set([]);
            this.searchTerm.set('');
            return;
        }
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
    getCellText(row: any, col: ColDef): string {
        const v = row[col.key];
        if (v == null || v === '') return '—';
        if (col.tipo === 'date') {
            try { return new Date(v).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
            catch { return String(v); }
        }
        if (col.tipo === 'days') return `${v}d`;
        if (col.tipo === 'bool') return v === true ? '✔' : '—';
        return String(v);
    }

    getBadgeClass(row: any, col: ColDef): string {
        return col.badge?.[row[col.key]] ?? 'bg-stone-100 text-stone-600 border-stone-400';
    }

    private readonly STATUS_LABELS: Record<string, string> = {
        // mayúsculas (herramientas/préstamos desde el visor dialog)
        AVAILABLE:        'Disponible',
        IN_USE:           'En uso',
        MAINTENANCE:      'Mantenimiento',
        QUARANTINE:       'Cuarentena',
        DECOMMISSIONED:   'De baja',
        NEW:              'Nuevo',
        USED:             'Usado',
        RECONDITIONED:    'Reacondicionado',
        ACTIVE:           'Activo',
        RETURNED:         'Devuelto',
        OVERDUE:          'Con mora',
        // minúsculas (valores reales del API según el JSON)
        available:        'Disponible',
        in_use:           'En uso',
        in_maintenance:   'Mantenimiento',
        in_calibration:   'En calibración',
        quarantine:       'Cuarentena',
        decommissioned:   'De baja',
        new:              'Nuevo',
        used:             'Usado',
        reconditioned:    'Reacondicionado',
        good:             'Bueno',
        // Kits
        complete:         'Completo',
        incomplete:       'Incompleto',
        // Préstamos minúsculas
        active:           'Activo',
        returned:         'Devuelto',
        overdue:          'Con mora',
    };

    getStatusLabel(value: string): string {
        return this.STATUS_LABELS[value] ?? value;
    }

    getDaysClass(val: any): string {
        const n = Number(val);
        if (val == null || isNaN(n)) return 'bg-stone-100 text-stone-500 border-stone-400';
        if (n < 0)   return 'bg-red-100    text-red-800    border-red-700';
        if (n <= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-700';
        return 'bg-green-100 text-green-800 border-green-700';
    }

    /* ── Imprimir reporte completo ── */
    imprimirReporte(): void {
        const config = this.currentConfig();
        const data   = this.rows();            // TODOS los registros, no paginados
        if (!config || !data.length) {
            this.snackBar.open('Sin datos para imprimir', 'OK', { duration: 3000 });
            return;
        }
        const win = window.open('', '_blank');
        if (!win) {
            this.snackBar.open('Habilita ventanas emergentes para imprimir', 'OK', { duration: 5000 });
            return;
        }

        const opt    = this.currentOpts().find(o => o.id === this.activeReport());
        const cols   = config.columnas as ColDef[];
        const today  = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const tabLbl = this.TABS.find(t => t.id === this.activeTab())?.label?.toUpperCase() ?? '';

        const headerCells = cols.map(c => `<th>${c.header}</th>`).join('');
        const bodyRows = data.map((row, i) => {
            const cells = cols.map(c => {
                let v: any = row[c.key];
                if (v == null || v === '') return '<td>—</td>';
                if (c.tipo === 'date') {
                    try { v = new Date(v).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch {}
                } else if (c.tipo === 'bool')  { v = v === true ? '✔' : '—'; }
                  else if (c.tipo === 'days')  { v = `${v}d`; }
                return `<td>${String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
            }).join('');
            return `<tr class="${i % 2 === 0 ? 'even' : ''}">${cells}</tr>`;
        }).join('');

        const htmlContent = `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8">
<title>${opt?.codigo ?? ''} — ${opt?.label ?? ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; padding: 18px; color: #0f172a; font-size: 11px; }
  .header { border-bottom: 4px solid #000; padding-bottom: 10px; margin-bottom: 6px;
            display: flex; justify-content: space-between; align-items: flex-end; }
  .title-block h2 { font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; }
  .badges { display: flex; gap: 6px; align-items: center; }
  .badge { display: inline-block; font-weight: 900; font-size: 9px; padding: 2px 8px;
           border: 2px solid #000; text-transform: uppercase; }
  .badge-code { background: #fbbf24; color: #000; }
  .badge-cat  { background: #0f172a; color: #fbbf24; }
  .meta { font-size: 9px; color: #94a3b8; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; border: 3px solid #000; }
  thead tr { background: #0f172a; }
  th { color: #fbbf24; font-weight: 900; text-transform: uppercase; padding: 6px 8px;
       border: 1px solid #334155; text-align: left; font-size: 9px; white-space: nowrap; }
  td { border: 1px solid #e2e8f0; padding: 5px 8px; font-size: 10px;
       vertical-align: top; word-break: break-word; max-width: 220px; }
  tr.even td { background: #f8fafc; }
  .footer { margin-top: 10px; font-size: 9px; color: #94a3b8; text-align: right; }
  @media print { @page { size: landscape; margin: 8mm 10mm; } body { padding: 0; } }
</style>
</head><body>
<div class="header">
  <div class="title-block"><h2>${opt?.label ?? tabLbl}</h2></div>
  <div class="badges">
    <span class="badge badge-code">${opt?.codigo ?? ''}</span>
    <span class="badge badge-cat">${tabLbl}</span>
  </div>
</div>
<div class="meta">Total: ${data.length} registros &nbsp;·&nbsp; Generado: ${today}</div>
<table>
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<div class="footer">SISTEMA DE GESTIÓN DE HERRAMIENTAS · BOA &nbsp;|&nbsp; ${today}</div>
</body></html>`;

        win.document.write(htmlContent);
        win.document.close();
        win.onload = () => win.print();
    }

    /* ── Guardar reporte como PDF (descarga directa) ── */
    guardarPdf(): void {
        const config = this.currentConfig();
        const data   = this.rows();
        if (!config || !data.length) {
            this.snackBar.open('Sin datos para exportar', 'OK', { duration: 3000 });
            return;
        }

        const opt    = this.currentOpts().find(o => o.id === this.activeReport());
        const cols   = config.columnas as ColDef[];
        const today  = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const tabLbl = this.TABS.find(t => t.id === this.activeTab())?.label?.toUpperCase() ?? '';

        const headerCells = cols.map(c => `<th>${c.header}</th>`).join('');
        const bodyRows = data.map((row, i) => {
            const cells = cols.map(c => {
                let v: any = row[c.key];
                if (v == null || v === '') return '<td>—</td>';
                if (c.tipo === 'date') {
                    try { v = new Date(v).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch {}
                } else if (c.tipo === 'bool')  { v = v === true ? '✔' : '—'; }
                  else if (c.tipo === 'days')  { v = `${v}d`; }
                return `<td>${String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
            }).join('');
            return `<tr class="${i % 2 === 0 ? 'even' : ''}">${cells}</tr>`;
        }).join('');

        const htmlContent = `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8">
<title>${opt?.codigo ?? ''} — ${opt?.label ?? ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; padding: 18px; color: #0f172a; font-size: 11px; }
  .header { border-bottom: 4px solid #000; padding-bottom: 10px; margin-bottom: 6px;
            display: flex; justify-content: space-between; align-items: flex-end; }
  .title-block h2 { font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; }
  .badges { display: flex; gap: 6px; align-items: center; }
  .badge { display: inline-block; font-weight: 900; font-size: 9px; padding: 2px 8px;
           border: 2px solid #000; text-transform: uppercase; }
  .badge-code { background: #fbbf24; color: #000; }
  .badge-cat  { background: #0f172a; color: #fbbf24; }
  .meta { font-size: 9px; color: #94a3b8; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; border: 3px solid #000; }
  thead tr { background: #0f172a; }
  th { color: #fbbf24; font-weight: 900; text-transform: uppercase; padding: 6px 8px;
       border: 1px solid #334155; text-align: left; font-size: 9px; white-space: nowrap; }
  td { border: 1px solid #e2e8f0; padding: 5px 8px; font-size: 10px;
       vertical-align: top; word-break: break-word; max-width: 220px; }
  tr.even td { background: #f8fafc; }
  .footer { margin-top: 10px; font-size: 9px; color: #94a3b8; text-align: right; }
  @media print { @page { size: landscape; margin: 8mm 10mm; } body { padding: 0; } }
</style>
</head><body>
<div class="header">
  <div class="title-block"><h2>${opt?.label ?? tabLbl}</h2></div>
  <div class="badges">
    <span class="badge badge-code">${opt?.codigo ?? ''}</span>
    <span class="badge badge-cat">${tabLbl}</span>
  </div>
</div>
<div class="meta">Total: ${data.length} registros &nbsp;·&nbsp; Generado: ${today}</div>
<table>
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<div class="footer">SISTEMA DE GESTIÓN DE HERRAMIENTAS · BOA &nbsp;|&nbsp; ${today}</div>
</body></html>`;

        const blob     = new Blob([htmlContent], { type: 'text/html' });
        const url      = URL.createObjectURL(blob);
        const filename = `${opt?.codigo ?? 'reporte'}_${new Date().toISOString().slice(0,10)}.html`;
        const a        = document.createElement('a');
        a.href = url; a.download = filename; a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        this.snackBar.open(`Descargando "${filename}" — ábrelo en el navegador y usa "Guardar como PDF"`, 'OK', { duration: 6000 });
    }
}
