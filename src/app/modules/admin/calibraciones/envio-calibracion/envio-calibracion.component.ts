import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule }                                  from '@angular/common';
import { MatIconModule }                                 from '@angular/material/icon';
import { MatDialog, MatDialogModule }                    from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule }                from '@angular/material/snack-bar';
import { MatProgressSpinnerModule }                      from '@angular/material/progress-spinner';
import { MatTooltipModule }                              from '@angular/material/tooltip';
import { MatMenuModule }                                 from '@angular/material/menu';
import { FormControl, ReactiveFormsModule }              from '@angular/forms';
import { Subject, from, of }                             from 'rxjs';
import { debounceTime, takeUntil, finalize, catchError } from 'rxjs/operators';
import { CalibrationService }                            from '../../../../core/services/calibration.service';
import { BlobStorageService }                            from '../../../../core/services/blob-storage.service';
import { ErpApiService }                                 from 'app/core/api/api.service';
import { HasPermissionDirective }                        from '../../../../core/directives/has-permission.directive';
import { localDateStr }                                  from '../../../../core/utils/date.utils';

interface CalibrationDisplay {
    id_calibration:       number;
    tool_code:            string;
    tool_name:            string;
    part_number:          string;
    ubicacion:            string;
    supplier_name:        string;
    record_number:        string;
    send_date:            string;
    expected_return_date: string | null;
    work_type:            string;
    base:                 string;
    almacen:              string;
    status:               string;
    is_jack:              boolean;
    has_certificate_file: boolean;
    certificate_number:   string | null;
    observations:         string | null;
}

@Component({
    selector: 'app-envio-calibracion',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatMenuModule,
        ReactiveFormsModule,
        HasPermissionDirective,
    ],
    templateUrl: './envio-calibracion.component.html',
    styles: [`
        :host { display: block; height: 100%; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .transition-all {
            transition-property: all;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            transition-duration: 150ms;
        }
    `]
})
export class EnvioCalibracionComponent implements OnInit, OnDestroy {

    private dialog             = inject(MatDialog);
    private snackBar           = inject(MatSnackBar);
    private calibrationService = inject(CalibrationService);
    private _api               = inject(ErpApiService);
    private _blobStorage       = inject(BlobStorageService);
    private _destroy$          = new Subject<void>();

    searchControl = new FormControl('');
    filterEstado  = new FormControl('');

    isLoading             = signal(false);
    draftCount            = signal(0);
    calibraciones:         CalibrationDisplay[] = [];
    filteredCalibraciones: CalibrationDisplay[] = [];

    // Cache de ubicaciones cargado una vez al inicio
    private locationMap = new Map<string, { pn: string; ubicacion: string }>();

    estadosFiltro = [
        { value: '',           label: 'Todos los estados' },
        { value: 'sent',       label: 'Enviados'         },
        { value: 'returned',   label: 'Completados'      },
        { value: 'cancelled',  label: 'Anulados'         },
    ];

    // ── Paginación ────────────────────────────────
    pageSize  = 10;
    pageIndex = 0;

    get totalRecords(): number { return this.filteredCalibraciones.length; }
    get totalPages():   number { return Math.ceil(this.totalRecords / this.pageSize) || 1; }
    get startIndex():   number { return this.totalRecords === 0 ? 0 : this.pageIndex * this.pageSize + 1; }
    get endIndex():     number { return Math.min((this.pageIndex + 1) * this.pageSize, this.totalRecords); }

    get paginatedCalibraciones(): CalibrationDisplay[] {
        const s = this.pageIndex * this.pageSize;
        return this.filteredCalibraciones.slice(s, s + this.pageSize);
    }

    nextPage(): void { if (this.pageIndex < this.totalPages - 1) this.pageIndex++; }
    prevPage(): void { if (this.pageIndex > 0) this.pageIndex--; }

    // ── Lifecycle ────────────────────────────────
    ngOnInit(): void {
        this.loadLocationMap();
        this.setupFilters();
        this.loadCalibraciones();
        this.loadDraftCount();

        // Las tabs quedan montadas en segundo plano (display:none); calibrationsChanged$ avisa a
        // esta tabla de un envío/retorno hecho en otra tab aunque no esté visible.
        this.calibrationService.calibrationsChanged$.pipe(
            takeUntil(this._destroy$),
        ).subscribe(() => {
            if (!this.isLoading()) this.loadCalibraciones();
            this.loadDraftCount();
        });
    }

    loadDraftCount(): void {
        this.calibrationService.getDraftEnvio().pipe(
            takeUntil(this._destroy$),
        ).subscribe({
            next: (rows) => this.draftCount.set((rows || []).length),
            error: () => { /* no bloquea la vista */ },
        });
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    @HostListener('window:focus')
    onWindowFocus(): void {
        if (!this.isLoading()) this.loadCalibraciones();
        this.loadDraftCount();
    }

    // ── Carga mapa de ubicaciones (una vez) ──────
    loadLocationMap(): void {
        from(this._api.post('herramientas/leveltools/listarLevelTools', { start: 0, limit: 5000 })).pipe(
            takeUntil(this._destroy$),
            catchError(() => of({ datos: [] }))
        ).subscribe((res: any) => {
            const raw: any[] = res?.datos || res?.data || [];
            this.locationMap.clear();
            for (const t of raw) {
                const key = (t.code || '').trim().toUpperCase();
                if (!key) continue;
                const rack  = t.rack_code  || '';
                const level = t.level_code || '';
                this.locationMap.set(key, {
                    pn:       t.part_number || '—',
                    ubicacion: rack && level ? `${rack} - ${level}` : rack || level || '—',
                });
            }
            // Re-enriquecer si ya se cargaron calibraciones
            if (this.calibraciones.length) this._enrichAndApply();
        });
    }

    // ── Carga calibraciones ──────────────────────
    loadCalibraciones(): void {
        this.isLoading.set(true);
        this.pageIndex = 0;

        // Una sola carga con todos los estados (filtro de estado client-side); ordena por
        // id_calibration (PK) y excluye las transcripciones históricas vía filtro_adicional.
        const params: any = {
            limit: 300,
            ordenacion: 'id_calibration',
            dir_ordenacion: 'desc',
            filtro_adicional: "(COALESCE(cls.is_historical, false) = false"
                + " AND (cls.internal_notes IS NULL"
                + " OR (cls.internal_notes NOT LIKE '[TRANSCRIPCION HISTORICA%'"
                + " AND cls.internal_notes NOT LIKE '[TRANSCRIPCIÓN HISTÓRICA%')))",
        };

        this.calibrationService.getCalibrations(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading.set(false)),
        ).subscribe({
            next: (records: any[]) => {
                this.calibraciones = records.map(r => {
                    const code = (r.tool_code ?? r.code ?? '').trim().toUpperCase();
                    const loc  = this.locationMap.get(code);
                    return {
                        id_calibration:       r.id_calibration       ?? r.id ?? 0,
                        tool_code:            r.tool_code             ?? r.code          ?? '—',
                        tool_name:            r.tool_name             ?? r.name          ?? '—',
                        part_number:          loc?.pn                 ?? '—',
                        ubicacion:            r.tool_ubicacion        || loc?.ubicacion || '—',
                        supplier_name:        r.supplier_name         ?? r.laboratory_name ?? '—',
                        record_number:        r.record_number         ?? '—',
                        send_date:            r.send_date             ?? '—',
                        expected_return_date: r.expected_return_date  ?? null,
                        work_type:            r.work_type             ?? 'CALIBRACIÓN',
                        base:                 r.base                  ?? '—',
                        almacen:              r.almacen ?? r.warehouse_name ?? r.warehouse ?? '—',
                        status:               r.status                ?? 'sent',
                        is_jack:              r.is_jack               ?? false,
                        has_certificate_file: !!(r.has_certificate_file || r.certificate_file),
                        certificate_number:   r.certificate_number    ?? null,
                        observations:         r.observations ?? r.notes ?? r.observaciones ?? null,
                    };
                });
                this.applyFilters();
            },
            error: (err) => {
                console.error('Error loading calibrations:', err);
                this.showMsg('Error al cargar las calibraciones', 'error');
            },
        });
    }

    private _enrichAndApply(): void {
        this.calibraciones = this.calibraciones.map(c => {
            const loc = this.locationMap.get(c.tool_code.trim().toUpperCase());
            const ubicacion = c.ubicacion && c.ubicacion !== '—' ? c.ubicacion : (loc?.ubicacion ?? '—');
            return { ...c, part_number: loc?.pn ?? '—', ubicacion };
        });
        this.applyFilters();
    }

    setupFilters(): void {
        this.searchControl.valueChanges.pipe(
            debounceTime(300),
            takeUntil(this._destroy$),
        ).subscribe(() => this.applyFilters());

        // Client-side: no recarga del servidor al cambiar el combo de estado.
        this.filterEstado.valueChanges.pipe(
            takeUntil(this._destroy$),
        ).subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        this.pageIndex = 0;
        let list = [...this.calibraciones];

        const q = this.searchControl.value?.toLowerCase().trim() ?? '';
        if (q) {
            list = list.filter(c =>
                c.tool_code.toLowerCase().includes(q)     ||
                c.tool_name.toLowerCase().includes(q)     ||
                c.record_number.toLowerCase().includes(q) ||
                c.supplier_name.toLowerCase().includes(q) ||
                c.base.toLowerCase().includes(q)          ||
                c.part_number.toLowerCase().includes(q)   ||
                c.ubicacion.toLowerCase().includes(q),
            );
        }

        const estado = this.filterEstado.value;
        if (estado === 'sent') {
            list = list.filter(c => c.status === 'sent' || c.status === 'in_process');
        } else if (estado === 'returned') {
            list = list.filter(c => this.isCompleted(c.status));
        } else if (estado === 'cancelled') {
            list = list.filter(c => c.status === 'cancelled');
        }

        this.filteredCalibraciones = list;
    }

    private isCompleted(s: string): boolean { return s === 'returned' || s === 'completed'; }

    // ── KPI Getters ───────────────────────────────
    getEnLabCount(): number      { return this.calibraciones.filter(c => c.status === 'sent' || c.status === 'in_process').length; }
    getRetrasadasCount(): number { return this.calibraciones.filter(c => this.isRetrasado(c)).length; }
    getATiempoCount(): number    { return Math.max(0, this.getEnLabCount() - this.getRetrasadasCount()); }

    // ── Row Helpers ───────────────────────────────
    isRetrasado(cal: CalibrationDisplay): boolean {
        if (!cal.expected_return_date || this.isCompleted(cal.status) || cal.status === 'cancelled') return false;
        // Comparación de texto YYYY-MM-DD, no new Date(): una fecha "solo fecha" se interpreta
        // como medianoche UTC y en Bolivia (UTC-4) cae en el día anterior.
        const expectedStr = String(cal.expected_return_date).split('T')[0];
        return expectedStr < localDateStr();
    }

    getDiasRetrasado(cal: CalibrationDisplay): number {
        if (!cal.expected_return_date) return 0;
        try {
            const expectedStr = String(cal.expected_return_date).split('T')[0];
            const expected = new Date(expectedStr + 'T00:00:00');
            const today    = new Date(localDateStr() + 'T00:00:00');
            return Math.max(0, Math.floor((today.getTime() - expected.getTime()) / 86_400_000));
        } catch { return 0; }
    }

    getWorkTypeLabel(w: string): string {
        if (w === 'CALIBRACIÓN Y REPARACIÓN') return 'CAL + REP.';
        if (w === 'CALIBRACIÓN')              return 'CALIB.';
        if (w === 'REPARACIÓN')               return 'REPAR.';
        return w || '—';
    }

    getStatusLabel(s: string): string {
        const labels: Record<string, string> = {
            sent: 'ENVIADO', in_process: 'EN PROCESO',
            returned: 'COMPLETADO', completed: 'COMPLETADO', cancelled: 'ANULADO'
        };
        return labels[s] ?? s.toUpperCase();
    }

    getStatusChipClass(s: string): string {
        const classes: Record<string, string> = {
            sent:       'bg-blue-100 text-blue-800 border-blue-200',
            in_process: 'bg-amber-100 text-amber-800 border-amber-200',
            returned:   'bg-green-100 text-green-800 border-green-200',
            completed:  'bg-green-100 text-green-800 border-green-200',
            cancelled:  'bg-red-100 text-red-800 border-red-200'
        };
        return classes[s] ?? 'bg-gray-100 text-gray-700 border-gray-200';
    }

    // ── Imprimir herramientas no retornadas ───────
    // PDF real (TCPDF vía ACTreportes/RReporteNoRetornadas), mismo diseño que la nota de envío.
    printNoRetornadas(): void {
        const pendientes = this.calibraciones.filter(c => c.status === 'sent' || c.status === 'in_process');
        if (!pendientes.length) {
            this.showMsg('No hay herramientas pendientes de retorno', 'info');
            return;
        }
        this.isLoading.set(true);
        this.calibrationService.generarPdfNoRetornadas().pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading.set(false)),
        ).subscribe({
            next: (result) => this.calibrationService.abrirPdf(result.pdf_base64, result.nombre_archivo),
            error: (error) => {
                console.error('Error al generar el reporte de pendientes:', error);
                this.showMsg('Error al generar el reporte de pendientes de retorno', 'error');
            },
        });
    }

    // ── Actions ──────────────────────────────────
    async nuevoEnvio(): Promise<void> {
        try {
            const { FormEnvioComponent } = await import('./form-envio/form-envio.component');
            const ref = this.dialog.open(FormEnvioComponent, {
                width: 'min(1240px, 96vw)', maxWidth: '100vw', maxHeight: '100dvh',
                panelClass: 'neo-dialog-transparent', disableClose: true, autoFocus: false
            });
            ref.afterClosed().subscribe(ok => {
                this.loadDraftCount();
                if (ok) { this.loadCalibraciones(); this.showMsg('Envío registrado exitosamente', 'success'); }
            });
        } catch (error) {
            console.error('Error loading form component:', error);
            this.showMsg('Error al abrir el formulario de envío', 'error');
        }
    }

    async verDetalles(cal: CalibrationDisplay): Promise<void> {
        try {
            const { DetalleEnvioComponent } = await import('./detalle-envio/detalle-envio.component');
            this.dialog.open(DetalleEnvioComponent, {
                width: '600px', maxWidth: '95vw',
                panelClass: 'no-padding-dialog',
                data: { calibracion: cal }
            });
        } catch (error) {
            console.error('Error al cargar modal de detalles:', error);
            this.showMsg('Error al abrir detalles', 'error');
        }
    }

    async anularEnvio(cal: CalibrationDisplay): Promise<void> {
        try {
            const { AnularEnvioComponent } = await import('./anular-envio/anular-envio.component');
            const ref = this.dialog.open(AnularEnvioComponent, {
                width: '500px', panelClass: 'no-padding-dialog',
                disableClose: true, data: { calibracion: cal }
            });
            ref.afterClosed().subscribe(reason => {
                if (!reason) return;
                this.isLoading.set(true);
                this.calibrationService.cancelCalibration(cal.id_calibration.toString(), reason).subscribe({
                    next: () => { this.showMsg(`Envío ${cal.record_number} anulado`, 'success'); this.loadCalibraciones(); },
                    error: (err) => {
                        console.error('Error anulando:', err);
                        this.showMsg(err.message || 'Error al anular el envío', 'error');
                        this.isLoading.set(false);
                    }
                });
            });
        } catch (error) {
            console.error('Error al cargar modal de anulación:', error);
            this.showMsg('Error al abrir modal de anulación', 'error');
        }
    }

    verEnvio(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) { this.showMsg('ID de calibración no válido', 'error'); return; }
        this.isLoading.set(true);
        this.calibrationService.generarYVerPdfEnvio(cal.id_calibration);
        setTimeout(() => this.isLoading.set(false), 1500);
    }

    verRetorno(cal: CalibrationDisplay): void {
        if (!cal.has_certificate_file) { this.showMsg('No se adjuntó un certificado en este retorno', 'warning'); return; }
        this.isLoading.set(true);
        this.calibrationService.getCertificateFile(cal.id_calibration).subscribe({
            next: (val) => {
                this.isLoading.set(false);
                if (!val) { this.showMsg('No se encontró el certificado adjunto', 'warning'); return; }
                // El certificado ahora se guarda en Blob Storage (ruta_bs); el base64
                // heredado se sigue soportando.
                if (this._blobStorage.isRutaBs(val)) { this._blobStorage.open(val); return; }
                try {
                    const base64 = val.includes(',') ? val.split(',')[1] : val;
                    const bytes  = atob(base64);
                    const arr    = new Uint8Array(bytes.length);
                    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                    const blob = new Blob([arr], { type: 'application/pdf' });
                    const url  = window.URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => window.URL.revokeObjectURL(url), 300);
                } catch (e) {
                    console.error('Error abriendo certificado:', e);
                    this.showMsg('No se pudo abrir el certificado adjunto', 'error');
                }
            },
            error: () => { this.isLoading.set(false); this.showMsg('Error al obtener el certificado', 'error'); }
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
