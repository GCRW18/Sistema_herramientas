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
    tool_id: number;
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
    filterEstado  = new FormControl('');
    fechaDesde    = new FormControl('');
    fechaHasta    = new FormControl('');
    tipoServicio  = new FormControl('');

    isLoading = signal(false);
    mantenimientos: MaintenanceDisplay[]         = [];
    filteredMantenimientos: MaintenanceDisplay[] = [];

    estadosFiltro = [
        { value: '',         label: 'Todos los estados' },
        { value: 'sent',     label: 'En Taller' },
        { value: 'returned', label: 'Completados' },
    ];

    tiposServicio = [
        { value: '',           label: 'Todos' },
        { value: 'preventive', label: 'Preventivo' },
        { value: 'corrective', label: 'Correctivo' },
        { value: 'predictive', label: 'Predictivo' },
        { value: 'emergency',  label: 'Emergencia' },
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
                        id_maintenance:       r.id_maintenance      ?? 0,
                        tool_id:              r.tool_id             ?? 0,
                        record_number:        r.record_number       ?? '—',
                        tool_code:            r.tool_code           ?? '—',
                        tool_name:            r.tool_name           ?? '—',
                        tool_serial:          r.tool_serial         ?? '',
                        provider:             r.provider            ?? '—',
                        type:                 r.type                ?? 'preventive',
                        status:               r.status              ?? 'sent',
                        send_date:            r.send_date           ?? '—',
                        expected_return_date: r.expected_return_date ?? null,
                        base:                 r.base                ?? '—',
                        cost:                 r.cost                ?? 0,
                        notes:                r.notes               ?? '',
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
            const expectedDate = new Date(mnt.expected_return_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return expectedDate < today;
        } catch { return false; }
    }

    getDiasRetrasado(mnt: MaintenanceDisplay): number {
        if (!mnt.expected_return_date) return 0;
        try {
            const expectedDate = new Date(mnt.expected_return_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return Math.floor((today.getTime() - expectedDate.getTime()) / 86400000);
        } catch { return 0; }
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
            'sent':     'bg-amber-100 text-amber-800 border-amber-200',
            'returned': 'bg-green-100 text-green-800 border-green-200',
        };
        return classes[s] ?? 'bg-gray-100 text-gray-700 border-gray-200';
    }

    getTypeChipClass(type: string): string {
        const classes: Record<string, string> = {
            'preventive': 'bg-blue-100 text-blue-800 border-blue-200',
            'corrective': 'bg-red-100 text-red-800 border-red-200',
            'predictive': 'bg-purple-100 text-purple-800 border-purple-200',
            'emergency':  'bg-orange-100 text-orange-800 border-orange-200',
        };
        return classes[type] ?? 'bg-gray-100 text-gray-700 border-gray-200';
    }

    getTypeLabel(type: string): string {
        const labels: Record<string, string> = {
            'preventive': 'PREV.',
            'corrective': 'CORR.',
            'predictive': 'PRED.',
            'emergency':  'EMER.',
        };
        return labels[type] ?? type?.toUpperCase() ?? '—';
    }

    getTipoNota(recordNumber: string): string {
        return recordNumber.startsWith('EM-') ? 'MANT' : '—';
    }

    nuevoEnvio(): void {
        const ref = this.dialog.open(FormServicioComponent, {
            width: '900px', maxWidth: '95vw',
            height: 'auto', maxHeight: '90vh',
            panelClass: 'neo-dialog', disableClose: false,
            data: { mode: 'envio' }
        });
        ref.afterClosed().subscribe(ok => {
            if (ok) { this.loadMantenimientos(); this.showMsg('Envío registrado exitosamente', 'success'); }
        });
    }

    registrarRetorno(mnt: MaintenanceDisplay): void {
        const ref = this.dialog.open(FormServicioComponent, {
            width: '900px', maxWidth: '95vw',
            height: 'auto', maxHeight: '90vh',
            panelClass: 'neo-dialog', disableClose: false,
            data: { mode: 'retorno', maintenance: mnt }
        });
        ref.afterClosed().subscribe(ok => {
            if (ok) { this.loadMantenimientos(); this.showMsg('Retorno registrado exitosamente', 'success'); }
        });
    }

    // ===================================================================
    // PDFs - LÓGICA DE DESCARGA DIRECTA
    // ===================================================================

    printNota(mnt: MaintenanceDisplay): void {
        if (!mnt.id_maintenance) {
            this.showMsg('No se puede imprimir: ID de mantenimiento no válido', 'error');
            return;
        }

        this.isLoading.set(true);
        this.maintenanceService.generarPdfEnvioMantenimiento(mnt.id_maintenance).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading.set(false))
        ).subscribe({
            next: (result: any) => {
                console.log('Respuesta del servidor (Envío):', result);
                const b64 = result?.ROOT?.datos?.pdf_base64 || result?.datos?.pdf_base64 || result?.pdf_base64;
                const name = result?.ROOT?.datos?.nombre_archivo || result?.datos?.nombre_archivo || result?.nombre_archivo || `nota_mantenimiento_${mnt.record_number}.pdf`;

                if(b64) {
                    this._descargarPdfDirecto(b64, name);
                } else {
                    this.showMsg('El servidor no devolvió el documento', 'error');
                }
            },
            error: () => this.showMsg('Error al generar la nota de envío', 'error')
        });
    }

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
        this.maintenanceService.generarPdfRetornoMantenimiento(mnt.id_maintenance).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading.set(false))
        ).subscribe({
            next: (result: any) => {
                console.log('Respuesta del servidor (Retorno):', result);
                const b64 = result?.ROOT?.datos?.pdf_base64 || result?.datos?.pdf_base64 || result?.pdf_base64;
                const name = result?.ROOT?.datos?.nombre_archivo || result?.datos?.nombre_archivo || result?.nombre_archivo || `certificado_${mnt.record_number}.pdf`;

                if(b64) {
                    this._descargarPdfDirecto(b64, name);
                } else {
                    this.showMsg('El servidor no devolvió el documento', 'error');
                }
            },
            error: () => this.showMsg('Error al generar el certificado de retorno', 'error')
        });
    }

    // Como ahora siempre forzamos la descarga, estas funciones simplemente llaman a las de arriba
    descargarNotaPdf(mnt: MaintenanceDisplay): void {
        this.printNota(mnt);
    }

    descargarCertificadoPdf(mnt: MaintenanceDisplay): void {
        this.printCertificadoMantenimiento(mnt);
    }

    /**
     * Procesamiento blindado: Toma el Base64 y lo convierte en una descarga automática
     */
    private _descargarPdfDirecto(base64: string, filename: string): void {
        try {
            // 1. Limpiar cadena por si trae saltos de línea del JSON
            const cleanBase64 = base64.replace(/\s/g, '');

            // 2. Decodificar
            const byteCharacters = atob(cleanBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);

            // 3. Crear Blob
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);

            // 4. Crear enlace invisible y forzar clic para descargar
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();

            // 5. Limpieza del DOM y la memoria
            document.body.removeChild(a);
            setTimeout(() => window.URL.revokeObjectURL(url), 10000);

            this.showMsg('Documento procesado correctamente', 'success');

        } catch (error) {
            console.error('Error decodificando el PDF Base64:', error);
            this.showMsg('Error al procesar el archivo PDF localmente', 'error');
        }
    }

    imprimirReporte(): void {
        const filtros: string[] = [];
        if (this.searchControl.value) filtros.push(`Búsqueda: ${this.searchControl.value}`);
        if (this.filterEstado.value)  filtros.push(`Estado: ${this.filterEstado.value}`);
        if (this.fechaDesde.value)    filtros.push(`Desde: ${this.fechaDesde.value}`);
        if (this.fechaHasta.value)    filtros.push(`Hasta: ${this.fechaHasta.value}`);
        if (this.tipoServicio.value)  filtros.push(`Tipo: ${this.tipoServicio.value}`);

        const w = window.open('', '_blank', 'width=1200,height=800');
        if (w) { w.document.write(this.generateReportHtml(filtros)); w.document.close(); }
    }

    private generateReportHtml(filtros: string[]): string {
        const fechaGeneracion = new Date().toLocaleString('es-BO');
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
    <h1>REPORTE DE AUDITORÍA - MANTENIMIENTO</h1>
    <p>BOA — Sistema de Gestión Técnica | MGH-109</p>
    <p>Fecha de generación: ${fechaGeneracion}</p>
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
    <td>${m.send_date}</td>
    <td>${m.expected_return_date || '—'}</td>
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
