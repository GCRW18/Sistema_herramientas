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
    ],
    templateUrl: './consulta-auditoria.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #0F172AFF; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #1e293b; }
        .dark .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #fbbf24; }

        .transition-all {
            transition-property: all;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            transition-duration: 150ms;
        }

        @keyframes pulse-fast {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }
        .animate-pulse-fast {
            animation: pulse-fast 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
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
        this.filterDateTo = new Date().toISOString().split('T')[0];
        this.is90DaysActive = false;
    }

    apply90DaysFilter(): void {
        const today = new Date();
        const from = new Date(today);
        from.setDate(from.getDate() - 90);
        this.filterDateFrom = from.toISOString().split('T')[0];
        this.filterDateTo = today.toISOString().split('T')[0];
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
        this.isLoading.set(true);

        const params: any = { limit: 250 };
        if (this.filterCode) params.record_number = this.filterCode;
        if (this.filterTool) params.tool_search = this.filterTool;
        if (this.filterStatus) params.status = this.filterStatus;
        if (this.filterEmpresa) params.id_laboratory = this.filterEmpresa;
        if (this.filterDateFrom) params.date_from = this.filterDateFrom;
        if (this.filterDateTo) params.date_to = this.filterDateTo;

        const includeCal = this.filterTipo === 'todos' || this.filterTipo === 'calibracion';
        const includeMnt = this.filterTipo === 'todos' || this.filterTipo === 'mantenimiento';

        try {
            let combined: AuditRow[] = [];

            if (includeCal) {
                const cals = await this.calibrationService.getCalibrations(params).toPromise();
                const mappedCals = (cals as any[] || []).map(r => this.mapToAuditRow(r, 'calibracion'));
                combined = [...combined, ...mappedCals];
            }

            if (includeMnt) {
                const mnts = await this.maintenanceService.getMaintenances(params).toPromise();
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
            result: r.result ?? '',
            cost: r.cost ?? 0,
            notes: r.notes ?? '',
            certificate_number: r.certificate_number ?? '',
            next_calibration_date: r.next_calibration_date ?? null
        };
    }

    private updateStats(data: AuditRow[]): void {
        this.statCerrados = data.filter(r => ['completed', 'returned'].includes(r.status)).length;
        this.statFuera = data.filter(r => ['sent', 'in_process'].includes(r.status)).length;
        this.statMora = data.filter(r =>
            ['sent', 'in_process'].includes(r.status) &&
            r.return_date && new Date(r.return_date) < new Date()
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
            'completed': 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
            'returned':  'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
            'sent':      'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700',
            'in_process':'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700',
            'rejected':  'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700'
        };
        return map[status] || 'bg-gray-100 text-gray-700 border-gray-300';
    }

    getStatusLabel = (s: string) => ({
        'sent': 'ENVIADO', 'in_process': 'EN TRÁNSITO', 'completed': 'FINALIZADO', 'returned': 'RETORNADO'
    }[s] || s.toUpperCase());

    getTipoLabel = (t: string) => t === 'calibracion' ? 'CAL' : 'MNT';

    getTipoClass(t: string): string {
        return t === 'calibracion' ? 'bg-indigo-200 text-indigo-900 border-indigo-400' : 'bg-orange-200 text-orange-900 border-orange-400';
    }

    formatDate(d: string): string {
        if (!d || d === '—') return '—';
        return new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    printNota(row: AuditRow): void {
        this.isLoading.set(true);
        if (row.tipo_registro === 'calibracion') {
            this.calibrationService.generarYVerPdfEnvio(row.id);
        } else {
            this.snackBar.open('Módulo de impresión MNT en desarrollo', 'OK', { panelClass: ['snackbar-warning'] });
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
