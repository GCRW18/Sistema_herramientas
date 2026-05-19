import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, combineLatest, of } from 'rxjs';
import { debounceTime, startWith, takeUntil, finalize, catchError } from 'rxjs/operators';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { FormServicioComponent } from './form-servicio/form-servicio.component';
import { FormLoteMantenimientoComponent } from './form-lote-mantenimiento/form-lote.component';

interface MaintenanceDisplay {
    id_maintenance: number;
    tool_id: number;
    record_number: string;
    tool_code: string;
    tool_name: string;
    tool_serial: string;
    tool_brand: string;
    tool_model: string;
    provider: string;
    provider_contact: string;
    type: string;
    status: string;
    send_date: string;
    expected_return_date: string | null;
    base: string;
    cost: number;
    description: string;
    notes: string;
}

@Component({
    selector: 'app-servicios-mantenimiento',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        ReactiveFormsModule,
    ],
    templateUrl: './servicios-mantenimiento.component.html',
    styles: [`
        :host { display: block; height: 100%; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .transition-all { transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1); }

        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.6; cursor: pointer; }
        :host-context(.dark) input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.8; }
    `]
})
export class ServiciosMantenimientoComponent implements OnInit, OnDestroy {

    private router = inject(Router);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private cdr = inject(ChangeDetectorRef);
    private maintenanceService = inject(MaintenanceService);
    private _destroy$ = new Subject<void>();

    searchControl = new FormControl('');
    filterEstado  = new FormControl('');
    fechaDesde    = new FormControl('');
    fechaHasta    = new FormControl('');
    tipoServicio  = new FormControl('');

    isLoading = signal(false);
    mantenimientos: MaintenanceDisplay[]         = [];
    filteredMantenimientos: MaintenanceDisplay[] = [];

    // Paginación
    pageSize  = 10;
    pageIndex = 0;

    get totalRecords(): number { return this.filteredMantenimientos.length; }
    get totalPages():   number { return Math.ceil(this.totalRecords / this.pageSize) || 1; }
    get startIndex():   number { return this.totalRecords === 0 ? 0 : this.pageIndex * this.pageSize + 1; }
    get endIndex():     number { return Math.min((this.pageIndex + 1) * this.pageSize, this.totalRecords); }

    get paginatedMantenimientos(): MaintenanceDisplay[] {
        const s = this.pageIndex * this.pageSize;
        return this.filteredMantenimientos.slice(s, s + this.pageSize);
    }

    nextPage(): void { if (this.pageIndex < this.totalPages - 1) this.pageIndex++; }
    prevPage(): void { if (this.pageIndex > 0) this.pageIndex--; }

    estadosFiltro = [
        { value: '',         label: 'Todos los estados' },
        { value: 'sent',     label: 'En Taller' },
        { value: 'returned', label: 'Completados' },
    ];

    tiposServicio = [
        { value: '',           label: 'Todos' },
        { value: 'preventive', label: 'Preventivo' },
        { value: 'corrective', label: 'Correctivo' },
    ];

    ngOnInit(): void {
        this.loadMantenimientos();
        this.setupFilters();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    loadMantenimientos(): void {
        this.isLoading.set(true);
        this.maintenanceService.getActiveMaintenancesPxp().pipe(
            takeUntil(this._destroy$),
            catchError(() => of([])),
            finalize(() => { this.isLoading.set(false); this.cdr.detectChanges(); }),
        ).subscribe({
            next: (records: any[]) => {
                if (records && Array.isArray(records) && records.length > 0) {
                    this.mantenimientos = records.map(r => ({
                        id_maintenance:       r.id_maintenance       ?? 0,
                        tool_id:              r.tool_id              ?? 0,
                        record_number:        r.record_number        ?? '—',
                        tool_code:            r.tool_code            ?? '—',
                        tool_name:            r.tool_name            ?? '—',
                        tool_serial:          r.tool_serial          ?? '',
                        tool_brand:           r.tool_brand           ?? '',
                        tool_model:           r.tool_model           ?? '',
                        provider:             r.provider             || '—',
                        provider_contact:     r.provider_contact     ?? '',
                        type:                 r.type                 ?? 'preventive',
                        status:               r.status               ?? 'sent',
                        send_date:            r.send_date            ?? '—',
                        expected_return_date: r.expected_return_date ?? null,
                        base:                 r.base                 ?? '—',
                        cost:                 r.cost                 ?? 0,
                        description:          r.description          ?? '',
                        notes:                r.notes                ?? '',
                    }));
                } else {
                    this.mantenimientos = [];
                }
                this.applyFilters();
            },
        });
    }

    setupFilters(): void {
        combineLatest([
            this.searchControl.valueChanges.pipe(startWith('')),
            this.filterEstado.valueChanges.pipe(startWith('')),
            this.fechaDesde.valueChanges.pipe(startWith('')),
            this.fechaHasta.valueChanges.pipe(startWith('')),
            this.tipoServicio.valueChanges.pipe(startWith('')),
        ]).pipe(
            debounceTime(300),
            takeUntil(this._destroy$),
        ).subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        this.pageIndex = 0;
        let list = [...this.mantenimientos];

        const q = this.searchControl.value?.toLowerCase().trim() ?? '';
        if (q) {
            list = list.filter(m =>
                m.tool_code.toLowerCase().includes(q)     ||
                m.tool_name.toLowerCase().includes(q)     ||
                m.record_number.toLowerCase().includes(q) ||
                m.provider.toLowerCase().includes(q)      ||
                m.base.toLowerCase().includes(q)
            );
        }

        const estado = this.filterEstado.value;
        if (estado) list = list.filter(m => m.status === estado);

        const desde = this.fechaDesde.value;
        if (desde) list = list.filter(m => m.send_date >= desde);

        const hasta = this.fechaHasta.value;
        if (hasta) list = list.filter(m => m.send_date <= hasta);

        const tipo = this.tipoServicio.value;
        if (tipo) list = list.filter(m => m.type === tipo);

        this.filteredMantenimientos = list;
        this.cdr.detectChanges();
    }

    limpiarFiltros(): void {
        this.fechaDesde.setValue('');
        this.fechaHasta.setValue('');
        this.tipoServicio.setValue('');
        this.filterEstado.setValue('');
        this.searchControl.setValue('');
    }

    getEnTallerCount(): number    { return this.mantenimientos.filter(m => m.status === 'sent').length; }
    getRetrasadasCount(): number  { return this.mantenimientos.filter(m => this.isOverdue(m)).length; }
    getATiempoCount(): number     { return Math.max(0, this.getEnTallerCount() - this.getRetrasadasCount()); }
    getCompletadosCount(): number { return this.mantenimientos.filter(m => m.status === 'returned').length; }

    isOverdue(mnt: MaintenanceDisplay): boolean {
        if (!mnt.expected_return_date || mnt.status === 'returned') return false;
        try {
            const expected = new Date(mnt.expected_return_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return expected < today;
        } catch { return false; }
    }

    getDiasRetrasado(mnt: MaintenanceDisplay): number {
        if (!mnt.expected_return_date) return 0;
        try {
            const expected = new Date(mnt.expected_return_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return Math.floor((today.getTime() - expected.getTime()) / 86400000);
        } catch { return 0; }
    }

    // Formato dd/MM/yyyy sin problemas de zona horaria
    fmtDate(d: string | null | undefined): string {
        if (!d || d === '—') return '—';
        const p = d.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
    }

    getStatusLabel(s: string): string {
        const labels: Record<string, string> = {
            'sent':     'EN TALLER',
            'returned': 'COMPLETADO',
        };
        return labels[s] ?? s.toUpperCase();
    }

    getStatusChipClass(s: string): string {
        const classes: Record<string, string> = {
            'sent':     'bg-amber-500 text-black border-black',
            'returned': 'bg-green-600 text-black border-black',
        };
        return classes[s] ?? 'bg-gray-100 text-gray-700 border-gray-500';
    }

    getTypeChipClass(type: string): string {
        const classes: Record<string, string> = {
            'preventive': 'bg-blue-700 text-gray-100 border-black',
            'corrective': 'bg-red-600 text-gray-100 border-black',
        };
        return classes[type] ?? 'bg-gray-100 text-gray-700 border-gray-500';
    }

    getTypeLabel(type: string): string {
        const labels: Record<string, string> = {
            'preventive': 'PREV.',
            'corrective': 'CORR.',
        };
        return labels[type] ?? type?.toUpperCase() ?? '—';
    }

    getTipoNota(recordNumber: string): string {
        return recordNumber.startsWith('EM-') || recordNumber.startsWith('LM-') ? 'MANT' : '—';
    }

    // ============================================================
    // ACCIONES DE DIÁLOGO
    // ============================================================

    nuevoLote(): void {
        const ref = this.dialog.open(FormLoteMantenimientoComponent, {
            width: '1000px', maxWidth: '98vw', height: '88vh',
            panelClass: 'no-padding-dialog', disableClose: false,
        });
        ref.afterClosed().subscribe(ok => {
            if (ok) { this.loadMantenimientos(); this.showMsg('Lote procesado exitosamente', 'success'); }
        });
    }

    registrarRetorno(mnt: MaintenanceDisplay): void {
        const ref = this.dialog.open(FormServicioComponent, {
            width: '560px', maxWidth: '96vw', height: 'auto', maxHeight: '90vh',
            panelClass: 'no-padding-dialog', disableClose: false,
            data: { mode: 'retorno', maintenance: mnt }
        });
        ref.afterClosed().subscribe(ok => {
            if (ok) { this.loadMantenimientos(); this.showMsg('Retorno registrado exitosamente', 'success'); }
        });
    }

    // ============================================================
    // PDFs
    // ============================================================

    printNota(mnt: MaintenanceDisplay): void {
        const html = this._buildNotaHtml(mnt);
        const w = window.open('about:blank', '_blank');
        if (!w) { this.showMsg('Permite ventanas emergentes para este sitio', 'error'); return; }
        w.document.open();
        w.document.write(html);
        w.document.close();
    }

    private _pdfDate(d: string | null | undefined): string {
        if (!d) return '—';
        const p = d.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
    }
    private _pdfType(t: string | null | undefined): string {
        const map: Record<string, string> = {
            preventive: 'PREVENTIVO', corrective: 'CORRECTIVO',
            predictive: 'PREDICTIVO', emergency: 'EMERGENCIA',
        };
        return map[(t ?? '').toLowerCase()] ?? ((t ?? '').toUpperCase() || '—');
    }
    private _pdfToday(): string {
        const d = new Date();
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }
    private _esc(s: any): string {
        return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    private _buildNotaHtml(mnt: MaintenanceDisplay): string {
        const today   = this._pdfToday();
        const rn      = this._esc(mnt.record_number || 'N/A');
        const code    = this._esc(mnt.tool_code     || 'N/A');
        const name    = this._esc(mnt.tool_name     || 'N/A');
        const serial  = this._esc(mnt.tool_serial   || '—');
        const brand   = this._esc(mnt.tool_brand        || '');
        const model   = this._esc(mnt.tool_model        || '');
        const prov    = this._esc(mnt.provider           || 'N/A');
        const type    = this._esc(this._pdfType(mnt.type));
        const send    = this._esc(this._pdfDate(mnt.send_date));
        const retEst  = this._esc(this._pdfDate(mnt.expected_return_date));
        const notes   = this._esc(mnt.notes   || '').replace(/\n/g, '<br>');
        const problem = this._esc(mnt.description          || '').replace(/\n/g, '<br>');
        const CSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#1e293b}.header{background:#0f172a;color:#fff;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start}.title{font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.5px}.nota{font-size:24px;font-weight:900;color:#f97316;font-family:monospace;margin:5px 0}.sub{font-size:9px;opacity:.7}.date-block{text-align:right;font-size:11px}.section{border:1.5px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:12px}.section-title{font-size:9px;font-weight:900;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px;letter-spacing:.5px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px}.field .label{font-size:8px;font-weight:700;text-transform:uppercase;color:#94a3b8}.field .value{font-size:12px;font-weight:700}.dates{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;background:#f8fafc;padding:10px;border-radius:6px;margin-top:8px;text-align:center}.date-card .dlabel{font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase}.date-card .dval{font-size:12px;font-weight:900}.sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:18px;padding-top:12px;border-top:1.5px solid #e2e8f0}.sig-line{border-top:1px solid #94a3b8;margin-top:32px;padding-top:4px;text-align:center;font-size:9px;color:#64748b}.meta{margin-top:10px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px;display:flex;justify-content:space-between}@media print{body{padding:0}}`;
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Nota Envio Mantenimiento ${rn}</title><style>${CSS}</style></head><body>
<div class="header"><div><div class="title">NOTA DE ENVIO A MANTENIMIENTO</div><div class="nota">${rn}</div><div class="sub">Sistema de Gestion Tecnica &middot; BOA</div></div><div class="date-block"><div>Fecha: ${today}</div><div style="font-size:13px;font-weight:900;margin-top:4px">${code}</div></div></div>
<div class="section"><div class="section-title">Datos de la Herramienta</div><div class="grid">
  <div class="field"><div class="label">Codigo BOA</div><div class="value">${code}</div></div>
  <div class="field"><div class="label">N&deg; Serie</div><div class="value">${serial}</div></div>
  <div class="field" style="grid-column:1/-1"><div class="label">Nombre</div><div class="value">${name}</div></div>
  ${brand ? `<div class="field"><div class="label">Marca</div><div class="value">${brand}</div></div>` : ''}
  ${model ? `<div class="field"><div class="label">Modelo</div><div class="value">${model}</div></div>` : ''}
</div></div>
<div class="section"><div class="section-title">Datos del Envio</div><div class="grid">
  <div class="field"><div class="label">Empresa / Taller</div><div class="value">${prov}</div></div>
  <div class="field"><div class="label">Tipo de Servicio</div><div class="value">${type}</div></div>
</div>
<div class="dates">
  <div class="date-card"><div class="dlabel">Fecha Envio</div><div class="dval">${send}</div></div>
  <div class="date-card"><div class="dlabel">Retorno Estimado</div><div class="dval">${retEst}</div></div>
  <div class="date-card"><div class="dlabel">Estado</div><div class="dval">EN TALLER</div></div>
</div>
${problem ? `<div style="margin-top:8px"><div class="label" style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase">Descripcion del Problema</div><div style="margin-top:3px;font-size:11px">${problem}</div></div>` : ''}
${notes   ? `<div style="margin-top:8px"><div class="label" style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase">Notas</div><div style="margin-top:3px;font-size:11px">${notes}</div></div>` : ''}
</div>
<div class="sigs"><div><div class="sig-line">Tecnico emisor</div></div><div><div class="sig-line">Jefe de almacen</div></div><div><div class="sig-line">Recibido por taller</div></div></div>
<div class="meta"><span>BOA &mdash; MGH-109 &middot; ${rn}</span><span>${today}</span></div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    }

    // ============================================================
    // REPORTE DE AUDITORÍA
    // ============================================================

    imprimirReporte(): void {
        const filtros: string[] = [];
        if (this.searchControl.value) filtros.push(`Búsqueda: ${this.searchControl.value}`);
        if (this.filterEstado.value)  filtros.push(`Estado: ${this.filterEstado.value}`);
        if (this.fechaDesde.value)    filtros.push(`Desde: ${this.fmtDate(this.fechaDesde.value)}`);
        if (this.fechaHasta.value)    filtros.push(`Hasta: ${this.fmtDate(this.fechaHasta.value)}`);
        if (this.tipoServicio.value)  filtros.push(`Tipo: ${this.tipoServicio.value}`);

        const w = window.open('', '_blank', 'width=1200,height=800');
        if (w) { w.document.write(this.generateReportHtml(filtros)); w.document.close(); }
    }

    private generateReportHtml(filtros: string[]): string {
        const fechaGen    = new Date().toLocaleDateString('es-BO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
        const total       = this.filteredMantenimientos.length;
        const completados = this.filteredMantenimientos.filter(m => m.status === 'returned').length;
        const enTaller    = this.filteredMantenimientos.filter(m => m.status === 'sent').length;
        const retrasados  = this.filteredMantenimientos.filter(m => this.isOverdue(m)).length;

        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Reporte de Auditoría - Mantenimiento</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
h1{font-size:18px;margin-bottom:5px}h2{font-size:14px;margin:15px 0 10px}
.header{border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px}
.filtros{background:#f3f4f6;padding:10px;border-radius:6px;margin-bottom:15px}
.resumen{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center}
.card .number{font-size:24px;font-weight:bold}.card .label{font-size:10px;color:#666}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#0f172a;color:white;font-size:10px}
tr:nth-child(even){background:#f9fafb}
.footer{margin-top:20px;padding-top:10px;border-top:1px solid #ccc;font-size:9px;text-align:center}
</style></head><body>
<div class="header">
    <h1>REPORTE DE AUDITORÍA — MANTENIMIENTO</h1>
    <p>BOA — Sistema de Gestión Técnica | MGH-109</p>
    <p>Fecha de generación: ${fechaGen}</p>
</div>
<div class="filtros"><strong>Filtros aplicados:</strong><br>
    ${filtros.length ? filtros.join(' | ') : 'Ninguno (todos los registros)'}
</div>
<div class="resumen">
    <div class="card"><div class="number">${total}</div><div class="label">Total Envíos</div></div>
    <div class="card"><div class="number">${completados}</div><div class="label">Completados</div></div>
    <div class="card"><div class="number">${enTaller}</div><div class="label">En Taller</div></div>
    <div class="card"><div class="number">${retrasados}</div><div class="label">Retrasados</div></div>
</div>
<h2>Detalle de Envíos</h2>
<table>
<thead><tr><th>N° Nota</th><th>Tipo</th><th>Código BOA</th><th>Herramienta</th><th>Empresa</th><th>Fecha Envío</th><th>Retorno Est.</th><th>Estado</th></tr></thead>
<tbody>${this.filteredMantenimientos.map(m => `<tr>
    <td>${m.record_number}</td>
    <td>${this.getTypeLabel(m.type)}</td>
    <td>${m.tool_code}</td>
    <td>${m.tool_name.substring(0, 40)}</td>
    <td>${m.provider}</td>
    <td>${this.fmtDate(m.send_date)}</td>
    <td>${this.fmtDate(m.expected_return_date)}</td>
    <td>${this.getStatusLabel(m.status)}</td>
</tr>`).join('')}</tbody>
</table>
<div class="footer"><p>Reporte generado por: Usuario BOA | Firma y sello: ____________________</p></div>
</body></html>`;
    }

    private showMsg(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: type === 'error' ? 5000 : 3000,
            horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`],
        });
    }
}
