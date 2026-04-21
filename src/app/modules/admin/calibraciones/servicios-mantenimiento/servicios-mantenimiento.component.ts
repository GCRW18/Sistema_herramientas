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
import { CalibrationService } from '../../../../core/services/calibration.service';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { FormServicioComponent } from './form-servicio/form-servicio.component';

interface MaintenanceDisplay {
    id_maintenance: number;
    record_number: string;
    tool_code: string;
    tool_name: string;
    tool_serial: string;
    provider: string;
    type: string;
    status: string;
    send_date: string;
    expected_return_date: string | null;
    base: string;
    cost: number;
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
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .transition-all { transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1); }
        tbody tr:hover { background-color: #fff7ed; }
        .dark tbody tr:hover { background-color: #1e293b; }
    `]
})
export class ServiciosMantenimientoComponent implements OnInit, OnDestroy {

    private router = inject(Router);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private cdr = inject(ChangeDetectorRef);
    private calibrationService = inject(CalibrationService);
    private maintenanceService = inject(MaintenanceService);
    private _destroy$ = new Subject<void>();

    searchControl = new FormControl('');
    filterEstado = new FormControl('');
    fechaDesde = new FormControl('');
    fechaHasta = new FormControl('');
    tipoServicio = new FormControl('');

    isLoading = signal(false);
    mantenimientos: MaintenanceDisplay[] = [];
    filteredMantenimientos: MaintenanceDisplay[] = [];

    estadosFiltro = [
        { value: '', label: 'Todos los estados' },
        { value: 'sent', label: 'En Taller' },
        { value: 'returned', label: 'Completados' },
    ];

    tiposServicio = [
        { value: '', label: 'Todos' },
        { value: 'PREVENTIVO', label: 'Preventivo' },
        { value: 'CORRECTIVO', label: 'Correctivo' },
        { value: 'SEMESTRAL', label: 'Semestral' },
        { value: 'ANUAL', label: 'Anual' },
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
            catchError((err) => {
                console.error('Error cargando mantenimientos:', err);
                return of([]);
            }),
            finalize(() => {
                this.isLoading.set(false);
                this.cdr.detectChanges();
            }),
        ).subscribe({
            next: (records: any[]) => {
                if (records && Array.isArray(records) && records.length > 0) {
                    this.mantenimientos = records.map(r => ({
                        id_maintenance:       r.id_maintenance ?? 0,
                        record_number:        r.record_number  ?? '—',
                        tool_code:            r.tool_code      ?? '—',
                        tool_name:            r.tool_name      ?? '—',
                        tool_serial:          r.tool_serial    ?? '',
                        provider:             r.provider       ?? '—',
                        type:                 r.type           ?? 'PREVENTIVO',
                        status:               r.status         ?? 'sent',
                        send_date:            r.send_date      ?? '—',
                        expected_return_date: r.expected_return_date ?? null,
                        base:                 r.base           ?? '—',
                        cost:                 r.cost           ?? 0,
                        notes:                r.notes          ?? '',
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
        let list = [...this.mantenimientos];

        const q = this.searchControl.value?.toLowerCase().trim() ?? '';
        if (q) {
            list = list.filter(m =>
                m.tool_code.toLowerCase().includes(q) ||
                m.tool_name.toLowerCase().includes(q) ||
                m.record_number.toLowerCase().includes(q) ||
                m.provider.toLowerCase().includes(q) ||
                m.base.toLowerCase().includes(q)
            );
        }

        const estado = this.filterEstado.value;
        if (estado) {
            list = list.filter(m => m.status === estado);
        }

        const desde = this.fechaDesde.value;
        if (desde) {
            list = list.filter(m => m.send_date >= desde);
        }
        const hasta = this.fechaHasta.value;
        if (hasta) {
            list = list.filter(m => m.send_date <= hasta);
        }

        const tipo = this.tipoServicio.value;
        if (tipo) {
            list = list.filter(m => m.type === tipo);
        }

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

    getEnTallerCount(): number {
        return this.mantenimientos.filter(m => m.status === 'sent').length;
    }

    getRetrasadasCount(): number {
        return this.mantenimientos.filter(m => this.isOverdue(m)).length;
    }

    getATiempoCount(): number {
        return Math.max(0, this.getEnTallerCount() - this.getRetrasadasCount());
    }

    getCompletadosCount(): number {
        return this.mantenimientos.filter(m => m.status === 'returned').length;
    }

    isOverdue(mnt: MaintenanceDisplay): boolean {
        if (!mnt.expected_return_date || mnt.status === 'returned') return false;
        try {
            const expectedDate = new Date(mnt.expected_return_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return expectedDate < today;
        } catch {
            return false;
        }
    }

    getDiasRetrasado(mnt: MaintenanceDisplay): number {
        if (!mnt.expected_return_date) return 0;
        try {
            const expectedDate = new Date(mnt.expected_return_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return Math.floor((today.getTime() - expectedDate.getTime()) / 86400000);
        } catch {
            return 0;
        }
    }

    getStatusLabel(s: string): string {
        const labels: Record<string, string> = {
            'sent': 'EN TALLER',
            'returned': 'COMPLETADO'
        };
        return labels[s] ?? s.toUpperCase();
    }

    getStatusChipClass(s: string): string {
        const classes: Record<string, string> = {
            'sent': 'bg-amber-100 text-amber-800 border-amber-200',
            'returned': 'bg-green-100 text-green-800 border-green-200'
        };
        return classes[s] ?? 'bg-gray-100 text-gray-700 border-gray-200';
    }

    getTypeChipClass(type: string): string {
        const classes: Record<string, string> = {
            'PREVENTIVO': 'bg-blue-100 text-blue-800 border-blue-200',
            'CORRECTIVO': 'bg-red-100 text-red-800 border-red-200',
            'SEMESTRAL': 'bg-purple-100 text-purple-800 border-purple-200',
            'ANUAL': 'bg-green-100 text-green-800 border-green-200'
        };
        return classes[type] ?? 'bg-gray-100 text-gray-700 border-gray-200';
    }

    getTypeLabel(type: string): string {
        if (type === 'PREVENTIVO') return 'PREV.';
        if (type === 'CORRECTIVO') return 'CORR.';
        if (type === 'SEMESTRAL') return 'SEM.';
        if (type === 'ANUAL') return 'ANU.';
        return type || '—';
    }

    getTipoNota(recordNumber: string): string {
        if (recordNumber.startsWith('EM-')) return 'MANT';
        return '—';
    }

    nuevoEnvio(): void {
        const ref = this.dialog.open(FormServicioComponent, {
            width: '900px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            disableClose: false,
            data: { mode: 'envio' }
        });
        ref.afterClosed().subscribe(ok => {
            if (ok) {
                this.loadMantenimientos();
                this.showMsg('Envío registrado exitosamente', 'success');
            }
        });
    }

    registrarRetorno(mnt: MaintenanceDisplay): void {
        const ref = this.dialog.open(FormServicioComponent, {
            width: '900px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            disableClose: false,
            data: { mode: 'retorno', maintenance: mnt }
        });
        ref.afterClosed().subscribe(ok => {
            if (ok) {
                this.loadMantenimientos();
                this.showMsg('Retorno registrado exitosamente', 'success');
            }
        });
    }

    // ===================================================================
    // MÉTODOS DE PDF PARA MANTENIMIENTO
    // ===================================================================

    /**
     * Imprime la Nota de Envío a Mantenimiento usando PDF del backend
     * NOTA: El backend necesita implementar generarPdfEnvioMantenimiento()
     */
    printNota(mnt: MaintenanceDisplay): void {
        if (!mnt.id_maintenance) {
            this.showMsg('No se puede imprimir: ID de mantenimiento no válido', 'error');
            return;
        }

        this.isLoading.set(true);

        // TODO: Cuando el backend tenga el método para mantenimiento
        // this.maintenanceService.generarYVerPdfEnvioMantenimiento(mnt.id_maintenance);

        // Por ahora, usar fallback HTML
        this.printNotaFallback(mnt);

        setTimeout(() => {
            this.isLoading.set(false);
        }, 1500);
    }

    /**
     * Imprime el Certificado de Retorno de Mantenimiento usando PDF del backend
     */
    printCertificadoMantenimiento(mnt: MaintenanceDisplay): void {
        if (!mnt.id_maintenance) {
            this.showMsg('No se puede imprimir: ID de mantenimiento no válido', 'error');
            return;
        }

        if (mnt.status !== 'returned') {
            this.showMsg('Este mantenimiento aún no ha sido completado', 'warning');
            return;
        }

        this.isLoading.set(true);

        // TODO: Cuando el backend tenga el método para mantenimiento
        // this.maintenanceService.generarYVerPdfRetornoMantenimiento(mnt.id_maintenance);

        // Por ahora, usar fallback HTML
        this.printCertificadoFallback(mnt);

        setTimeout(() => {
            this.isLoading.set(false);
        }, 1500);
    }

    /**
     * Descarga la Nota de Envío a Mantenimiento como PDF
     */
    descargarNotaPdf(mnt: MaintenanceDisplay): void {
        if (!mnt.id_maintenance) {
            this.showMsg('ID de mantenimiento no válido', 'error');
            return;
        }

        this.isLoading.set(true);

        // TODO: Implementar cuando el backend tenga el endpoint
        this.showMsg('Funcionalidad en desarrollo - Próximamente disponible', 'info');

        setTimeout(() => {
            this.isLoading.set(false);
        }, 1500);
    }

    /**
     * Descarga el Certificado de Retorno de Mantenimiento como PDF
     */
    descargarCertificadoPdf(mnt: MaintenanceDisplay): void {
        if (!mnt.id_maintenance) {
            this.showMsg('ID de mantenimiento no válido', 'error');
            return;
        }

        if (mnt.status !== 'returned') {
            this.showMsg('Este mantenimiento aún no ha sido completado', 'warning');
            return;
        }

        this.isLoading.set(true);

        // TODO: Implementar cuando el backend tenga el endpoint
        this.showMsg('Funcionalidad en desarrollo - Próximamente disponible', 'info');

        setTimeout(() => {
            this.isLoading.set(false);
        }, 1500);
    }

    /**
     * Fallback: Imprime nota usando HTML (cuando el backend no está listo)
     */
    private printNotaFallback(mnt: MaintenanceDisplay): void {
        const today = new Date().toLocaleDateString('es-BO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const html = this.generatePrintHtml(mnt, today);
        const w = window.open('', '_blank', 'width=900,height=750');
        if (w) { w.document.write(html); w.document.close(); }
        else { this.showMsg('No se pudo abrir la ventana de impresión', 'warning'); }
    }

    /**
     * Fallback: Imprime certificado usando HTML
     */
    private printCertificadoFallback(mnt: MaintenanceDisplay): void {
        const today = new Date().toLocaleDateString('es-BO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const html = this.generateCertificadoHtml(mnt, today);
        const w = window.open('', '_blank', 'width=900,height=750');
        if (w) { w.document.write(html); w.document.close(); }
        else { this.showMsg('No se pudo abrir la ventana de impresión', 'warning'); }
    }

    /**
     * Genera HTML para certificado de retorno de mantenimiento
     */
    private generateCertificadoHtml(mnt: MaintenanceDisplay, today: string): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Certificado Mantenimiento ${mnt.record_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#1e293b}
.header{border:3px solid #0f172a;padding:14px;margin-bottom:16px;background:#0f172a;color:#fff;display:flex;justify-content:space-between}
.title{font-size:16px;font-weight:900;text-transform:uppercase}
.nota{font-size:26px;font-weight:900;color:#f97316;font-family:monospace;margin:6px 0}
.section{border:2px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:12px}
.section-title{font-size:10px;font-weight:900;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.field{margin-bottom:4px}
.label{font-weight:700;color:#64748b;font-size:9px;text-transform:uppercase}
.value{font-weight:900;font-size:12px}
.result-box{text-align:center;padding:15px;background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;margin:12px 0}
.result-approved{font-size:18px;font-weight:900;color:#16a34a}
.footer{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:16px;padding-top:14px;border-top:2px solid #e2e8f0}
.sign-line{border-top:1px solid #94a3b8;margin-top:30px;padding-top:5px;text-align:center;font-size:9px}
.meta{margin-top:12px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between}
</style></head><body>
<div class="header">
    <div><div class="title">CERTIFICADO DE RETORNO - MANTENIMIENTO</div><div class="nota">${mnt.record_number}</div></div>
    <div style="text-align:right"><div>${today}</div><div style="font-size:14px;font-weight:900;margin-top:4px">${mnt.tool_code}</div></div>
</div>
<div class="result-box">
    <div class="result-approved">✅ TRABAJO COMPLETADO</div>
    <div style="margin-top:5px">Tipo: ${this.getTypeLabel(mnt.type)}</div>
</div>
<div class="section">
    <div class="section-title">Datos de la Herramienta</div>
    <div class="grid">
        <div><div class="label">Código BOA</div><div class="value">${mnt.tool_code}</div></div>
        <div><div class="label">N° Serie</div><div class="value">${mnt.tool_serial || '—'}</div></div>
        <div style="grid-column:1/-1"><div class="label">Nombre</div><div class="value">${mnt.tool_name}</div></div>
    </div>
</div>
<div class="section">
    <div class="section-title">Datos del Servicio</div>
    <div class="grid">
        <div><div class="label">Taller / Empresa</div><div class="value">${mnt.provider}</div></div>
        <div><div class="label">Tipo Servicio</div><div class="value">${mnt.type}</div></div>
        <div><div class="label">Fecha Envío</div><div class="value">${mnt.send_date}</div></div>
        <div><div class="label">Fecha Retorno</div><div class="value">${today}</div></div>
    </div>
    ${mnt.notes ? `<div style="margin-top:8px"><div class="label">Observaciones</div><div class="value">${mnt.notes}</div></div>` : ''}
</div>
<div class="footer">
    <div><div class="sign-line">Técnico receptor</div></div>
    <div><div class="sign-line">Jefe de mantenimiento</div></div>
    <div><div class="sign-line">Sello del taller</div></div>
</div>
<div class="meta"><span>BOA — MGH-109 · ${mnt.record_number}</span><span>${today}</span></div>
<script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
</body></html>`;
    }

    imprimirReporte(): void {
        const filtros = [];
        if (this.searchControl.value) filtros.push(`Búsqueda: ${this.searchControl.value}`);
        if (this.filterEstado.value) filtros.push(`Estado: ${this.filterEstado.value}`);
        if (this.fechaDesde.value) filtros.push(`Desde: ${this.fechaDesde.value}`);
        if (this.fechaHasta.value) filtros.push(`Hasta: ${this.fechaHasta.value}`);
        if (this.tipoServicio.value) filtros.push(`Tipo: ${this.tipoServicio.value}`);

        const reportHtml = this.generateReportHtml(filtros);
        const w = window.open('', '_blank', 'width=1200,height=800');
        if (w) { w.document.write(reportHtml); w.document.close(); }
    }

    private generateReportHtml(filtros: string[]): string {
        const fechaGeneracion = new Date().toLocaleString('es-BO');
        const total = this.filteredMantenimientos.length;
        const completados = this.filteredMantenimientos.filter(m => m.status === 'returned').length;
        const enTaller = this.filteredMantenimientos.filter(m => m.status === 'sent').length;
        const retrasados = this.filteredMantenimientos.filter(m => this.isOverdue(m)).length;

        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Reporte de Auditoría - Mantenimiento</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
h1{font-size:18px;margin-bottom:5px}
h2{font-size:14px;margin:15px 0 10px}
.header{border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px}
.filtros{background:#f3f4f6;padding:10px;border-radius:6px;margin-bottom:15px}
.resumen{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center}
.card .number{font-size:24px;font-weight:bold}
.card .label{font-size:10px;color:#666}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#0f172a;color:white;font-size:10px}
tr:nth-child(even){background:#f9fafb}
.footer{margin-top:20px;padding-top:10px;border-top:1px solid #ccc;font-size:9px;text-align:center}
</style></head><body>
<div class="header">
    <h1>REPORTE DE AUDITORÍA - MANTENIMIENTO</h1>
    <p>BOA — Sistema de Gestión Técnica | MGH-109</p>
    <p>Fecha de generación: ${fechaGeneracion}</p>
</div>
<div class="filtros"><strong>Filtros aplicados:</strong><br>${filtros.length ? filtros.join(' | ') : 'Ninguno (todos los registros)'}</div>
<div class="resumen">
    <div class="card"><div class="number">${total}</div><div class="label">Total Envíos</div></div>
    <div class="card"><div class="number">${completados}</div><div class="label">Completados</div></div>
    <div class="card"><div class="number">${enTaller}</div><div class="label">En Taller</div></div>
    <div class="card"><div class="number">${retrasados}</div><div class="label">Retrasados</div></div>
</div>
<h2>Detalle de Envíos</h2>
<table>
<thead><tr><th>N° Nota</th><th>Tipo</th><th>Código BOA</th><th>Herramienta</th><th>Empresa</th><th>Fecha Envío</th><th>Retorno Est.</th><th>Estado</th></tr></thead>
<tbody>${this.filteredMantenimientos.map(m => `<tr><td>${m.record_number}</td><td>${this.getTipoNota(m.record_number)}</td><td>${m.tool_code}</td><td>${m.tool_name.substring(0, 40)}</td><td>${m.provider}</td><td>${m.send_date}</td><td>${m.expected_return_date || '—'}</td><td>${this.getStatusLabel(m.status)}</td></tr>`).join('')}</tbody>
</table>
<div class="footer"><p>Reporte generado por: Usuario BOA | Firma y sello: ____________________</p></div>
</body></html>`;
    }

    private generatePrintHtml(mnt: MaintenanceDisplay, today: string): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Nota de Envío ${mnt.record_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#1e293b}
.header{border:3px solid #0f172a;padding:14px;margin-bottom:16px;background:#0f172a;color:#fff;display:flex;justify-content:space-between}
.title{font-size:16px;font-weight:900;text-transform:uppercase}
.nota{font-size:26px;font-weight:900;color:#f97316;font-family:monospace;margin:6px 0}
.subtitle{font-size:10px;opacity:.7;margin-top:4px}
.section{border:2px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:12px}
.section-title{font-size:10px;font-weight:900;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.field{margin-bottom:4px}
.label{font-weight:700;color:#64748b;font-size:9px;text-transform:uppercase}
.value{font-weight:900;font-size:12px}
.dates{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f8fafc;padding:10px;margin-top:10px;border-radius:6px}
.date-card{text-align:center}
.date-label{font-size:8px;font-weight:700;text-transform:uppercase;color:#94a3b8}
.date-val{font-size:12px;font-weight:900}
.footer{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:16px;padding-top:14px;border-top:2px solid #e2e8f0}
.sign-line{border-top:1px solid #94a3b8;margin-top:30px;padding-top:5px;text-align:center;font-size:9px}
.meta{margin-top:12px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between}
@media print{body{padding:0}}
</style></head><body>
<div class="header">
    <div><div class="title">NOTA DE ENVÍO A MANTENIMIENTO</div><div class="nota">${mnt.record_number}</div><div class="subtitle">Sistema de Gestión Técnica · BOA</div></div>
    <div style="text-align:right"><div>${today}</div><div style="font-size:14px;font-weight:900;margin-top:4px">${mnt.tool_code}</div></div>
</div>
<div class="section">
    <div class="section-title">Datos de la Herramienta</div>
    <div class="grid">
        <div><div class="label">Código BOA</div><div class="value">${mnt.tool_code}</div></div>
        <div><div class="label">N° Serie</div><div class="value">${mnt.tool_serial || '—'}</div></div>
        <div style="grid-column:1/-1"><div class="label">Nombre</div><div class="value">${mnt.tool_name}</div></div>
    </div>
</div>
<div class="section">
    <div class="section-title">Datos del Envío</div>
    <div class="grid">
        <div><div class="label">Empresa / Taller</div><div class="value">${mnt.provider}</div></div>
        <div><div class="label">Tipo Servicio</div><div class="value">${mnt.type}</div></div>
        <div><div class="label">Base Origen</div><div class="value">${mnt.base}</div></div>
        <div><div class="label">Costo Estimado</div><div class="value">$${mnt.cost.toFixed(2)}</div></div>
    </div>
    <div class="dates">
        <div class="date-card"><div class="date-label">Envío</div><div class="date-val">${mnt.send_date}</div></div>
        <div class="date-card"><div class="date-label">Retorno Est.</div><div class="date-val">${mnt.expected_return_date || '—'}</div></div>
        <div class="date-card"><div class="date-label">Estado</div><div class="date-val">${this.getStatusLabel(mnt.status)}</div></div>
    </div>
    ${mnt.notes ? `<div style="margin-top:8px"><div class="label">Notas</div><div class="value">${mnt.notes}</div></div>` : ''}
</div>
<div class="footer">
    <div><div class="sign-line">Técnico emisor</div></div>
    <div><div class="sign-line">Jefe de almacén</div></div>
    <div><div class="sign-line">Recibido por taller</div></div>
</div>
<div class="meta"><span>BOA — MGH-109 · ${mnt.record_number}</span><span>${today}</span></div>
<script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
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
