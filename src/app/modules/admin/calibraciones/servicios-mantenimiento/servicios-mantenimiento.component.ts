import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, combineLatest, of } from 'rxjs';
import { debounceTime, startWith, takeUntil, finalize, catchError } from 'rxjs/operators';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { CalibrationService } from '../../../../core/services/calibration.service';
import { FormServicioComponent } from './form-servicio/form-servicio.component';
import { FormLoteMantenimientoComponent } from './form-lote-mantenimiento/form-lote.component';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

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
        HasPermissionDirective,
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

    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private cdr = inject(ChangeDetectorRef);
    private maintenanceService = inject(MaintenanceService);
    private calibrationService = inject(CalibrationService);
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
            'sent':     'bg-amber-100 text-amber-800 border-amber-200',
            'returned': 'bg-green-100 text-green-800 border-green-200',
        };
        return classes[s] ?? 'bg-gray-100 text-gray-700 border-gray-200';
    }

    getTypeChipClass(type: string): string {
        const classes: Record<string, string> = {
            'preventive': 'bg-blue-100 text-blue-800 border-blue-200',
            'corrective': 'bg-red-100 text-red-800 border-red-200',
        };
        return classes[type] ?? 'bg-gray-100 text-gray-700 border-gray-200';
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

    // ── Acciones de diálogo ──

    nuevoLote(): void {
        const ref = this.dialog.open(FormLoteMantenimientoComponent, {
            width: 'min(1240px, 96vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: true, autoFocus: false,
        });
        ref.afterClosed().subscribe(ok => {
            if (ok) { this.loadMantenimientos(); this.showMsg('Lote procesado exitosamente', 'success'); }
        });
    }

    registrarRetorno(mnt: MaintenanceDisplay): void {
        const ref = this.dialog.open(FormServicioComponent, {
            width: '560px', maxWidth: '96vw', height: 'auto', maxHeight: '90vh',
            panelClass: 'no-padding-dialog', disableClose: true,
            data: { mode: 'retorno', maintenance: mnt }
        });
        ref.afterClosed().subscribe(ok => {
            if (ok) { this.loadMantenimientos(); this.showMsg('Retorno registrado exitosamente', 'success'); }
        });
    }

    // ── PDFs ──

    // MGH-103 — Nota de Envío a Mantenimiento (PDF real vía backend).
    printNota(mnt: MaintenanceDisplay): void {
        const win = this.maintenanceService.preAbrirVentanaPdf();
        this.maintenanceService.generarPdfEnvioMantenimiento(mnt.id_maintenance).pipe(
            takeUntil(this._destroy$),
        ).subscribe({
            next: (r) => this.maintenanceService.abrirNota(r, win),
            error: (e) => { try { win?.close(); } catch { /* noop */ } this.showMsg(e?.message || 'Error al generar la nota de mantenimiento', 'error'); },
        });
    }

    // MGH-103 — Nota de Retorno de Mantenimiento (PDF real vía backend, solo si ya retornó).
    printNotaRetorno(mnt: MaintenanceDisplay): void {
        const win = this.maintenanceService.preAbrirVentanaPdf();
        this.maintenanceService.generarPdfRetornoMantenimiento(mnt.id_maintenance).pipe(
            takeUntil(this._destroy$),
        ).subscribe({
            next: (r) => this.maintenanceService.abrirNota(r, win),
            error: (e) => { try { win?.close(); } catch { /* noop */ } this.showMsg(e?.message || 'Error al generar la nota de retorno de mantenimiento', 'error'); },
        });
    }

    // MGH-125 — Listado de Gatas Hidráulicas (PDF real vía backend).
    printGatasHidraulicas(): void {
        this.isLoading.set(true);
        this.maintenanceService.generarPdfGatasHidraulicas().pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading.set(false)),
        ).subscribe({
            next: (result) => {
                try {
                    const bytes = new Uint8Array(atob(result.pdf_base64).split('').map(c => c.charCodeAt(0)));
                    const url = window.URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
                    window.open(url, '_blank');
                    setTimeout(() => window.URL.revokeObjectURL(url), 30000);
                } catch {
                    this.showMsg('No se pudo abrir el PDF generado', 'error');
                }
            },
            error: (error) => {
                console.error('Error al generar el listado de gatas hidráulicas:', error);
                const msg = error?.message || error?.ROOT?.detalle?.mensaje || 'Error al generar el listado de gatas hidráulicas';
                this.showMsg(msg, 'error');
            },
        });
    }

    // ── Reporte de auditoría ──

    // R-AUD-01 — Registro Histórico de Auditoría Técnica (solo mantenimiento), PDF real vía backend.
    imprimirReporte(): void {
        this.isLoading.set(true);
        const params: any = { tipo: 'mantenimiento', subtitulo: 'Solo mantenimiento' };
        if (this.searchControl.value) params.tool_search   = this.searchControl.value;
        if (this.filterEstado.value)  params.filter_status = this.filterEstado.value;
        if (this.tipoServicio.value)  params.mnt_type      = this.tipoServicio.value;
        if (this.fechaDesde.value)    params.date_from      = this.fechaDesde.value;
        if (this.fechaHasta.value)    params.date_to        = this.fechaHasta.value;

        this.calibrationService.generarPdfAuditoriaTecnica(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading.set(false)),
        ).subscribe({
            next: (r) => this.calibrationService.abrirPdf(r.pdf_base64, r.nombre_archivo),
            error: (e) => this.showMsg(e?.message || 'Error al generar el reporte de auditoría', 'error'),
        });
    }

    private showMsg(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: type === 'error' ? 5000 : 3000,
            horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`],
        });
    }
}
