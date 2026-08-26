import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { localDateStr } from '../../../../core/utils/date.utils';

export interface AuditRow {
    id: number;
    record_number: string;
    tipo_registro: 'calibracion' | 'mantenimiento';
    tool_code: string;
    tool_name: string;
    tool_serial: string;
    provider: string;
    type: string;
    status: string;
    send_date: string;
    return_date: string | null;
    expected_return_date: string | null;
    result: string;
    cost: number;
    notes: string;
    certificate_number: string;
    next_calibration_date: string | null;
}

export interface LaboratorioSimple {
    id_laboratory: number;
    name: string;
}

@Component({
    selector: 'app-consulta-auditoria',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatIconModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        HasPermissionDirective,
    ],
    templateUrl: './consulta-auditoria.component.html',
    styles: [`
        :host { display: block; height: 100%; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        .transition-all {
            transition-property: all;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            transition-duration: 150ms;
        }
    `]
})
export class ConsultaAuditoriaComponent implements OnInit, OnDestroy {

    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private calibrationService = inject(CalibrationService);
    private maintenanceService = inject(MaintenanceService);
    private _destroy$ = new Subject<void>();

    isLoading = signal(false);
    rows = signal<AuditRow[]>([]);
    laboratorios = signal<LaboratorioSimple[]>([]);

    // Filtros
    filterTipo = 'todos';
    filterCode = '';
    filterTool = '';
    filterStatus = '';
    filterEmpresa = '';
    filterDateFrom = '';
    filterDateTo = '';
    is90DaysActive = false;

    // Paginación
    pageSize  = 10;
    pageIndex = 0;

    get totalRecords(): number { return this.rows().length; }
    get totalPages():   number { return Math.ceil(this.totalRecords / this.pageSize) || 1; }
    get startIndex():   number { return this.totalRecords === 0 ? 0 : this.pageIndex * this.pageSize + 1; }
    get endIndex():     number { return Math.min((this.pageIndex + 1) * this.pageSize, this.totalRecords); }

    get paginatedRows(): AuditRow[] {
        const s = this.pageIndex * this.pageSize;
        return this.rows().slice(s, s + this.pageSize);
    }

    nextPage(): void { if (this.pageIndex < this.totalPages - 1) this.pageIndex++; }
    prevPage(): void { if (this.pageIndex > 0) this.pageIndex--; }

    // Stats para los chips de cabecera
    statCerrados = 0;
    statFuera = 0;
    statMora = 0;

    estadosFiltro = [
        { value: 'sent', label: 'Enviado' },
        { value: 'in_process', label: 'En Proceso' },
        { value: 'completed', label: 'Completado' },
        { value: 'returned', label: 'Retornado' },
    ];

    ngOnInit(): void {
        this.resetDateFilters();
        this.loadLaboratorios();
        this.applyFilters();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    private resetDateFilters(): void {
        const year = new Date().getFullYear();
        this.filterDateFrom = `${year}-01-01`;
        this.filterDateTo = localDateStr();
        this.is90DaysActive = false;
    }

    apply90DaysFilter(): void {
        const today = new Date();
        const from = new Date(today);
        from.setDate(from.getDate() - 90);
        this.filterDateFrom = localDateStr(from);
        this.filterDateTo = localDateStr(today);
        this.is90DaysActive = true;
        this.applyFilters();
    }

    loadLaboratorios(): void {
        this.calibrationService.getLaboratories().pipe(
            takeUntil(this._destroy$)
        ).subscribe({
            next: (labs: any[]) => {
                this.laboratorios.set(labs.map(l => ({
                    id_laboratory: l.id_laboratory || l.id || 0,
                    name: l.name || l.laboratory_name || '—'
                })));
            }
        });
    }

    limpiarFiltros(): void {
        this.filterTipo = 'todos';
        this.filterCode = '';
        this.filterTool = '';
        this.filterStatus = '';
        this.filterEmpresa = '';
        this.resetDateFilters();
        this.applyFilters();
    }

    onDateChange(): void {
        this.is90DaysActive = false;
    }

    async applyFilters(): Promise<void> {
        this.pageIndex = 0;
        this.isLoading.set(true);

        const baseParams: any = { limit: 250 };
        if (this.filterCode) baseParams.record_number = this.filterCode;
        if (this.filterTool) baseParams.tool_search = this.filterTool;
        if (this.filterDateFrom) baseParams.date_from = this.filterDateFrom;
        if (this.filterDateTo) baseParams.date_to = this.filterDateTo;

        const includeCal = this.filterTipo === 'todos' || this.filterTipo === 'calibracion';
        const includeMnt = this.filterTipo === 'todos' || this.filterTipo === 'mantenimiento';

        try {
            let combined: AuditRow[] = [];

            if (includeCal) {
                // he.tcalibrations usa 'in_process' y sí tiene id_laboratory (supplier_id).
                const calParams: any = { ...baseParams };
                if (this.filterStatus) calParams.status = this.filterStatus;
                if (this.filterEmpresa) calParams.id_laboratory = this.filterEmpresa;
                const cals = await this.calibrationService.getCalibrations(calParams).toPromise();
                const mappedCals = (cals as any[] || []).map(r => this.mapToAuditRow(r, 'calibracion'));
                combined = [...combined, ...mappedCals];
            }

            if (includeMnt) {
                // he.tmaintenances usa 'in_progress' (no 'in_process') y no tiene id_laboratory
                // (solo 'provider' de texto libre, sin FK a he.tcalibration_laboratories) —
                // ese filtro no se le puede aplicar sin romper la consulta en silencio.
                const mntParams: any = { ...baseParams };
                if (this.filterStatus) {
                    mntParams.status = this.filterStatus === 'in_process' ? 'in_progress' : this.filterStatus;
                }
                const mnts = await this.maintenanceService.getMaintenances(mntParams).toPromise();
                const mappedMnts = (mnts as any[] || []).map(r => this.mapToAuditRow(r, 'mantenimiento'));
                combined = [...combined, ...mappedMnts];
            }

            this.rows.set(combined.sort((a, b) => (b.send_date || '').localeCompare(a.send_date || '')));
            this.updateStats(this.rows());
        } catch (error) {
            this.snackBar.open('Error al sincronizar datos', 'Cerrar', { duration: 3000, panelClass: ['snackbar-error'] });
        } finally {
            this.isLoading.set(false);
        }
    }

    private mapToAuditRow(r: any, type: 'calibracion' | 'mantenimiento'): AuditRow {
        return {
            id: r.id_calibration ?? r.id_maintenance ?? r.id ?? 0,
            record_number: r.record_number ?? '—',
            tipo_registro: type,
            tool_code: r.tool_code ?? r.code ?? '—',
            tool_name: r.tool_name ?? r.name ?? '—',
            tool_serial: r.tool_serial ?? r.serial_number ?? '',
            provider: r.supplier_name ?? r.laboratory_name ?? r.provider ?? '—',
            type: r.work_type ?? r.type ?? '—',
            status: r.status ?? '—',
            send_date: r.send_date ?? '—',
            return_date: r.actual_return_date ?? r.return_date ?? null,
            expected_return_date: r.expected_return_date ?? null,
            result: r.result ?? '',
            cost: r.cost ?? 0,
            notes: r.notes ?? '',
            certificate_number: r.certificate_number ?? '',
            next_calibration_date: r.next_calibration_date ?? null
        };
    }

    private updateStats(data: AuditRow[]): void {
        const pendientes = ['sent', 'in_process', 'in_progress'];
        this.statCerrados = data.filter(r => ['completed', 'returned'].includes(r.status)).length;
        this.statFuera = data.filter(r => pendientes.includes(r.status)).length;
        // "En mora" = pendientes cuya fecha estimada de retorno ya pasó. return_date (retorno
        // REAL) siempre es null para estos, por eso se compara contra expected_return_date.
        // Comparación de texto (YYYY-MM-DD), no new Date(): evita el corrimiento de día por
        // interpretar una fecha "solo fecha" como medianoche UTC (ver envio-calibracion).
        const today = localDateStr();
        this.statMora = data.filter(r =>
            pendientes.includes(r.status) &&
            !!r.expected_return_date &&
            String(r.expected_return_date).split('T')[0] < today
        ).length;
    }

    async verDetalle(row: AuditRow): Promise<void> {
        const { FormDetalleComponent } = await import('./form-detalle/form-detalle.component');
        this.dialog.open(FormDetalleComponent, {
            width: '950px',
            maxWidth: '95vw',
            panelClass: 'neo-dialog',
            data: { row }
        });
    }

    getStatusClass(status: string): string {
        const map: Record<string, string> = {
            'completed':  'bg-green-600 text-black border-black',
            'returned':   'bg-green-600 text-black border-black',
            'sent':       'bg-blue-700 text-gray-100 border-black',
            'in_process': 'bg-amber-500 text-black border-black',
            'in_progress':'bg-amber-500 text-black border-black',
            'rejected':   'bg-red-600 text-gray-100 border-black',
            'cancelled':  'bg-red-600 text-gray-100 border-black',
        };
        return map[status] || 'bg-gray-100 text-gray-700 border-gray-500';
    }

    getStatusLabel = (s: string) => ({
        'sent': 'ENVIADO', 'in_process': 'EN TRÁNSITO', 'in_progress': 'EN TRÁNSITO',
        'completed': 'FINALIZADO', 'returned': 'RETORNADO'
    }[s] || s.toUpperCase());

    getTipoLabel = (t: string) => t === 'calibracion' ? 'CAL' : 'MNT';

    getTipoClass(t: string): string {
        return t === 'calibracion' ? 'bg-indigo-200 text-indigo-900 border-indigo-400' : 'bg-orange-200 text-orange-900 border-orange-400';
    }

    formatDate(d: string): string {
        if (!d || d === '—') return '—';
        // Texto puro (YYYY-MM-DD → DD/MM/YYYY), no new Date(): una fecha "solo fecha" se
        // interpreta como medianoche UTC, que en Bolivia (UTC-4) muestra el día anterior.
        const parts = String(d).split('T')[0].split('-');
        if (parts.length !== 3) return d;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    printNota(row: AuditRow): void {
        this.isLoading.set(true);
        if (row.tipo_registro === 'calibracion') {
            this.calibrationService.generarYVerPdfEnvio(row.id);
        } else {
            this.maintenanceService.generarYVerPdfEnvioMantenimiento(row.id);
        }
        setTimeout(() => this.isLoading.set(false), 1000);
    }

    printCertificado(row: AuditRow): void {
        if (!row.certificate_number) return;
        this.isLoading.set(true);
        this.calibrationService.generarYVerPdfRetorno(row.id);
        setTimeout(() => this.isLoading.set(false), 1000);
    }

    imprimirReporte(): void {
        const win = window.open('', '_blank');
        if (!win) return;
        const titulo = this.is90DaysActive
            ? `Histórico Últimos 90 Días — ${this.formatDate(this.filterDateFrom)} al ${this.formatDate(this.filterDateTo)}`
            : 'Registro Histórico de Auditoría Técnica';
        const rowsHtml = this.rows().map(r => `
            <tr>
                <td><strong>${r.record_number}</strong></td>
                <td>${this.getTipoLabel(r.tipo_registro)}</td>
                <td>${r.tool_name}<br><small style="color:#666">${r.tool_code}</small></td>
                <td>${r.provider}</td>
                <td>${this.formatDate(r.send_date)}</td>
                <td>${r.return_date ? this.formatDate(r.return_date) : '—'}</td>
                <td>${r.certificate_number || '—'}</td>
                <td>${this.getStatusLabel(r.status)}</td>
            </tr>
        `).join('');

        win.document.write(`
            <html><head><style>
                body{font-family:sans-serif; padding:20px; color:#0F172AFF;}
                table{width:100%; border-collapse:collapse; border: 3px solid #000;}
                th,td{border: 2px solid #000; padding:8px; text-align:left; font-size:11px;}
                th{background:#f87171; color:white; font-weight:900; text-transform:uppercase; font-size:10px;}
                h2 { font-weight: 900; text-transform: uppercase; border-bottom: 4px solid #000; padding-bottom: 10px; display:inline-block; }
                .badge { display:inline-block; background:#fbbf24; color:#000; font-weight:900; font-size:10px; padding:2px 8px; border:2px solid #000; text-transform:uppercase; margin-bottom:8px; }
                .meta { font-size:9px; color:#888; margin-top:8px; }
            </style></head>
            <body>
                ${this.is90DaysActive ? '<div class="badge">Últimos 90 días</div>' : ''}
                <h2>${titulo}</h2>
                <div class="meta">Total registros: ${this.rows().length} &nbsp;|&nbsp; Generado: ${new Date().toLocaleDateString('es-BO')}</div>
                <table><thead><tr>
                    <th>N° Registro</th><th>Tipo</th><th>Equipo / Herramienta</th>
                    <th>Proveedor / Lab</th><th>Fecha Envío</th><th>Retorno</th>
                    <th>N° Certificado</th><th>Estado</th>
                </tr></thead>
                <tbody>${rowsHtml}</tbody></table>
                <script>window.print()</script>
            </body></html>
        `);
        win.document.close();
    }
}
