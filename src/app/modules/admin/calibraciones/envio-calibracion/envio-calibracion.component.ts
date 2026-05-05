import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule }                                  from '@angular/common';
import { Router }                                        from '@angular/router';
import { MatIconModule }                                 from '@angular/material/icon';
import { MatDialog, MatDialogModule }                    from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule }                from '@angular/material/snack-bar';
import { MatProgressSpinnerModule }                      from '@angular/material/progress-spinner';
import { MatTooltipModule }                              from '@angular/material/tooltip';
import { MatMenuModule }                                 from '@angular/material/menu';
import { FormControl, ReactiveFormsModule }              from '@angular/forms';
import { Subject }                                       from 'rxjs';
import { debounceTime, takeUntil, finalize }              from 'rxjs/operators';
import { CalibrationService }                            from '../../../../core/services/calibration.service';

// ─────────────────────────────────────────────
//  Interface de display
// ─────────────────────────────────────────────
interface CalibrationDisplay {
    id_calibration:       number;
    tool_code:            string;
    tool_name:            string;
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
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
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
    ],
    templateUrl: './envio-calibracion.component.html',
    styles: [`
        :host { display: block; height: 100%; }

        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
            border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #000;
            border-radius: 3px;
        }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .animate-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

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

        .row-selected { background-color: #fef3c7 !important; border-left: 4px solid #fbbf24 !important; }
        :host-context(.dark) .row-selected { background-color: rgba(251, 191, 36, 0.1) !important; border-left: 4px solid #fbbf24 !important; }
    `]
})
export class EnvioCalibracionComponent implements OnInit, OnDestroy {

    // ── DI ──────────────────────────────────────
    private router             = inject(Router);
    private dialog             = inject(MatDialog);
    private snackBar           = inject(MatSnackBar);
    private calibrationService = inject(CalibrationService);
    private _destroy$          = new Subject<void>();

    // ── Form Controls ───────────────────────────
    searchControl = new FormControl('');
    filterEstado  = new FormControl('');

    // ── State ────────────────────────────────────
    isLoading             = signal(false);
    calibraciones:         CalibrationDisplay[] = [];
    filteredCalibraciones: CalibrationDisplay[] = [];

    estadosFiltro = [
        { value: '',           label: 'Todos los estados' },
        { value: 'sent',       label: 'Enviados'         },
        { value: 'in_process', label: 'En Proceso'       },
        { value: 'returned',   label: 'Completados'      },
        { value: 'cancelled',  label: 'Anulados'         },
    ];

    private isCompleted(s: string): boolean {
        return s === 'returned' || s === 'completed';
    }

    // ── Lifecycle ────────────────────────────────
    ngOnInit(): void {
        this.setupFilters();
        this.loadCalibraciones();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    // Refresca al volver el foco a la pestaña (por si retornó en otra pestaña)
    @HostListener('window:focus')
    onWindowFocus(): void {
        if (!this.isLoading()) {
            this.loadCalibraciones();
        }
    }

    // ── Data Loading ──────────────────────────────

    /**
     * Carga calibraciones desde el servidor.
     * El filtro de status se envía al backend para que la SP lo aplique correctamente.
     * El filtro de texto se aplica localmente en applyFilters() sobre los datos ya cargados.
     */
    loadCalibraciones(): void {
        this.isLoading.set(true);

        const estado = this.filterEstado.value;
        const params: any = {
            limit: 200,
            filtro: "(cls.internal_notes IS NULL OR cls.internal_notes != '[TRANSCRIPCIÓN HISTÓRICA]')",
        };

        // FIX: pasar el status al backend en todos los casos excepto '' (todos).
        // 'returned' cubre también 'completed' — el backend devuelve ambos y
        // applyFilters() los filtra en cliente con isCompleted().
        if (estado) {
            params.status = estado;
        }

        this.calibrationService.getCalibrations(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading.set(false)),
        ).subscribe({
            next: (records: any[]) => {
                this.calibraciones = records.map(r => ({
                    id_calibration:       r.id_calibration ?? r.id ?? 0,
                    tool_code:            r.tool_code       ?? r.code          ?? '—',
                    tool_name:            r.tool_name       ?? r.name          ?? '—',
                    supplier_name:        r.supplier_name   ?? r.laboratory_name ?? '—',
                    record_number:        r.record_number   ?? '—',
                    send_date:            r.send_date       ?? '—',
                    expected_return_date: r.expected_return_date ?? null,
                    work_type:            r.work_type       ?? 'CALIBRACIÓN',
                    base:                 r.base            ?? '—',
                    almacen:              r.almacen         ?? '—',
                    status:               r.status          ?? 'sent',
                    is_jack:              r.is_jack         ?? false,
                    has_certificate_file: !!(r.has_certificate_file || r.certificate_file),
                    certificate_number:   r.certificate_number ?? null,
                }));
                this.applyFilters();
            },
            error: (err) => {
                console.error('Error loading calibrations:', err);
                this.showMsg('Error al cargar las calibraciones', 'error');
            },
        });
    }

    /**
     * Configura los observables de filtros.
     *
     * - filterEstado: dispara una recarga desde el servidor (server-side).
     *   El status se manda como parámetro al backend para que la SP lo aplique.
     *
     * - searchControl: filtra localmente sobre los datos ya cargados (client-side).
     *   No genera llamadas de red, responde instantáneamente.
     */
    setupFilters(): void {
        // Filtro de texto → client-side, no genera llamadas de red
        this.searchControl.valueChanges.pipe(
            debounceTime(300),
            takeUntil(this._destroy$),
        ).subscribe(() => this.applyFilters());

        // Filtro de estado → server-side, recarga datos desde el backend
        // Sin startWith: la carga inicial la hace ngOnInit explícitamente para
        // evitar dos peticiones concurrentes al mismo endpoint (PXP descarta la
        // segunda con token ya consumido → { error: true, message: null }).
        this.filterEstado.valueChanges.pipe(
            debounceTime(400),
            takeUntil(this._destroy$),
        ).subscribe(() => this.loadCalibraciones());
    }

    /**
     * Aplica filtros locales sobre los datos ya cargados.
     *
     * Solo aplica:
     * 1. Búsqueda de texto (código, nombre, nota, proveedor, base).
     * 2. Caso especial 'returned': cubre dos valores del backend ('returned' y 'completed').
     *    El backend los devuelve mezclados cuando se filtra por status='returned',
     *    aquí nos aseguramos de mostrar solo los que isCompleted() reconoce.
     */
    applyFilters(): void {
        let list = [...this.calibraciones];

        // 1. Filtro de texto (client-side)
        const q = this.searchControl.value?.toLowerCase().trim() ?? '';
        if (q) {
            list = list.filter(c =>
                c.tool_code.toLowerCase().includes(q)     ||
                c.tool_name.toLowerCase().includes(q)     ||
                c.record_number.toLowerCase().includes(q) ||
                c.supplier_name.toLowerCase().includes(q) ||
                c.base.toLowerCase().includes(q),
            );
        }

        // 2. Caso especial: 'returned' engloba 'returned' y 'completed' del backend.
        //    Para el resto de estados el backend ya filtra correctamente.
        const estado = this.filterEstado.value;
        if (estado === 'returned') {
            list = list.filter(c => this.isCompleted(c.status));
        }

        this.filteredCalibraciones = list;
    }

    // ── KPI Getters ───────────────────────────────
    getEnLabCount(): number {
        return this.calibraciones.filter(c => c.status === 'sent' || c.status === 'in_process').length;
    }

    getRetrasadasCount(): number {
        return this.calibraciones.filter(c => this.isRetrasado(c)).length;
    }

    getATiempoCount(): number {
        return Math.max(0, this.getEnLabCount() - this.getRetrasadasCount());
    }

    getCountByStatus(status: string): number {
        return this.calibraciones.filter(c => c.status === status).length;
    }

    // ── Row Helpers ───────────────────────────────
    isRetrasado(cal: CalibrationDisplay): boolean {
        if (!cal.expected_return_date || this.isCompleted(cal.status) || cal.status === 'cancelled') return false;
        try {
            const expectedDate = new Date(cal.expected_return_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return expectedDate < today;
        } catch {
            return false;
        }
    }

    getDiasRetrasado(cal: CalibrationDisplay): number {
        if (!cal.expected_return_date) return 0;
        try {
            const expectedDate = new Date(cal.expected_return_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return Math.floor(
                (today.getTime() - expectedDate.getTime()) / 86_400_000
            );
        } catch {
            return 0;
        }
    }

    getWorkTypeLabel(w: string): string {
        if (w === 'CALIBRACIÓN Y REPARACIÓN') return 'CAL + REP.';
        if (w === 'CALIBRACIÓN') return 'CALIB.';
        if (w === 'REPARACIÓN') return 'REPAR.';
        return w || '—';
    }

    getStatusLabel(s: string): string {
        const labels: Record<string, string> = {
            'sent': 'ENVIADO',
            'in_process': 'EN PROCESO',
            'returned': 'COMPLETADO',
            'completed': 'COMPLETADO',
            'cancelled': 'ANULADO'
        };
        return labels[s] ?? s.toUpperCase();
    }

    getStatusChipClass(s: string): string {
        const classes: Record<string, string> = {
            'sent': 'bg-blue-100 text-blue-800 border-blue-500',
            'in_process': 'bg-amber-100 text-amber-800 border-amber-500',
            'returned': 'bg-green-100 text-green-800 border-green-500',
            'completed': 'bg-green-100 text-green-800 border-green-500',
            'cancelled': 'bg-red-100 text-red-800 border-red-500'
        };
        return classes[s] ?? 'bg-gray-100 text-gray-700 border-gray-500';
    }

    // ── Actions ──────────────────────────────────

    // NUEVO ENVÍO (individual o múltiple)
    async nuevoEnvio(): Promise<void> {
        try {
            const { FormEnvioComponent } = await import('./form-envio/form-envio.component');
            const ref = this.dialog.open(FormEnvioComponent, {
                width:        '980px',
                maxWidth:     '98vw',
                height:       'auto',
                maxHeight:    '92vh',
                disableClose: false,
                panelClass:   'neo-dialog-transparent'
            });
            ref.afterClosed().subscribe(ok => {
                if (ok) {
                    this.loadCalibraciones();
                    this.showMsg('Envío registrado exitosamente', 'success');
                }
            });
        } catch (error) {
            console.error('Error loading form component:', error);
            this.showMsg('Error al abrir el formulario de envío', 'error');
        }
    }

    // 2. VER DETALLES
    async verDetalles(cal: CalibrationDisplay): Promise<void> {
        try {
            const { DetalleEnvioComponent } = await import('./detalle-envio/detalle-envio.component');
            this.dialog.open(DetalleEnvioComponent, {
                width: '600px',
                maxWidth: '95vw',
                panelClass: 'neo-dialog-transparent',
                data: { calibracion: cal }
            });
        } catch (error) {
            console.error('Error al cargar modal de detalles:', error);
            this.showMsg('Error al abrir detalles', 'error');
        }
    }

    // 3. ANULAR ENVÍO
    async anularEnvio(cal: CalibrationDisplay): Promise<void> {
        try {
            const { AnularEnvioComponent } = await import('./anular-envio/anular-envio.component');
            const ref = this.dialog.open(AnularEnvioComponent, {
                width: '500px',
                panelClass: 'neo-dialog-transparent',
                disableClose: true,
                data: { calibracion: cal }
            });

            ref.afterClosed().subscribe(reason => {
                if (!reason) return;

                this.isLoading.set(true);
                this.calibrationService.cancelCalibration(cal.id_calibration.toString(), reason).subscribe({
                    next: () => {
                        this.showMsg(`Envío ${cal.record_number} anulado exitosamente`, 'success');
                        this.loadCalibraciones();
                    },
                    error: (err) => {
                        console.error('Error anulando:', err);
                        this.showMsg(err.message || 'Error al intentar anular el envío', 'error');
                        this.isLoading.set(false);
                    }
                });
            });
        } catch (error) {
            console.error('Error al cargar modal de anulación:', error);
            this.showMsg('Error al abrir modal de anulación', 'error');
        }
    }

    /**
     * Imprime la Nota de Envío a Calibración usando el PDF generado por el backend
     */
    printNota(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) {
            this.showMsg('No se puede imprimir: ID de calibración no válido', 'error');
            return;
        }
        this.isLoading.set(true);
        this.calibrationService.generarYVerPdfEnvio(cal.id_calibration);
        setTimeout(() => { this.isLoading.set(false); }, 1500);
    }

    /**
     * Imprime el Certificado de Retorno de Calibración
     */
    printCertificado(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) {
            this.showMsg('No se puede imprimir: ID de calibración no válido', 'error');
            return;
        }
        this.isLoading.set(true);
        this.calibrationService.generarYVerPdfRetorno(cal.id_calibration);
        setTimeout(() => { this.isLoading.set(false); }, 1500);
    }

    /**
     * Abre el visor integrado de PDF — Nota de Envío a Calibración.
     */
    async verEnvio(cal: CalibrationDisplay): Promise<void> {
        if (!cal.id_calibration) { this.showMsg('ID de calibración no válido', 'error'); return; }
        try {
            const { PdfViewerDialogComponent } = await import('./pdf-viewer-dialog/pdf-viewer-dialog.component');
            this.dialog.open(PdfViewerDialogComponent, {
                width:      '880px',
                maxWidth:   '95vw',
                height:     '90vh',
                panelClass: 'neo-dialog-transparent',
                data: { tipo: 'envio', id_calibration: cal.id_calibration, record_number: cal.record_number }
            });
        } catch (error) {
            console.error('Error loading PdfViewerDialogComponent:', error);
            this.showMsg('Error al abrir el visor PDF', 'error');
        }
    }

    /**
     * Descarga el certificado PDF adjunto en el retorno y lo abre en una pestaña nueva.
     * Se hace on-demand para no incluir el blob (varios MB) en la respuesta del listado.
     */
    verRetorno(cal: CalibrationDisplay): void {
        if (!cal.has_certificate_file) {
            this.showMsg('No se adjuntó un certificado en este retorno', 'warning');
            return;
        }
        this.isLoading.set(true);
        this.calibrationService.getCertificateFile(cal.id_calibration).subscribe({
            next: (dataUrl) => {
                this.isLoading.set(false);
                if (!dataUrl) {
                    this.showMsg('No se encontró el certificado adjunto', 'warning');
                    return;
                }
                try {
                    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                    const bytes = atob(base64);
                    const arr = new Uint8Array(bytes.length);
                    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                    const blob = new Blob([arr], { type: 'application/pdf' });
                    const url = window.URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => window.URL.revokeObjectURL(url), 300);
                } catch (e) {
                    console.error('Error abriendo certificado:', e);
                    this.showMsg('No se pudo abrir el certificado adjunto', 'error');
                }
            },
            error: () => {
                this.isLoading.set(false);
                this.showMsg('Error al obtener el certificado adjunto', 'error');
            }
        });
    }

    /**
     * Descarga el PDF de Nota de Envío
     */
    descargarNotaPdf(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) { this.showMsg('ID de calibración no válido', 'error'); return; }
        this.isLoading.set(true);
        this.calibrationService.generarPdfEnvioCalibracion(cal.id_calibration).subscribe({
            next: (result) => {
                const byteCharacters = atob(result.pdf_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                const byteArray = new Uint8Array(byteNumbers);
                const isHtml = result.nombre_archivo.toLowerCase().endsWith('.html');
                const blob = new Blob([byteArray], { type: isHtml ? 'text/html' : 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = result.nombre_archivo.replace(/[/\\]/g, '-'); a.click();
                window.URL.revokeObjectURL(url);
                this.isLoading.set(false);
                this.showMsg('Documento descargado correctamente', 'success');
            },
            error: (error) => {
                console.error('Error al descargar documento:', error);
                this.isLoading.set(false);
                this.showMsg('Error al generar el documento', 'error');
            }
        });
    }

    descargarCertificadoPdf(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) { this.showMsg('ID de calibración no válido', 'error'); return; }
        this.isLoading.set(true);
        this.calibrationService.generarPdfRetornoCalibracion(cal.id_calibration).subscribe({
            next: (result) => {
                const byteCharacters = atob(result.pdf_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                const byteArray = new Uint8Array(byteNumbers);
                const isHtml = result.nombre_archivo.toLowerCase().endsWith('.html');
                const blob = new Blob([byteArray], { type: isHtml ? 'text/html' : 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = result.nombre_archivo.replace(/[/\\]/g, '-'); a.click();
                window.URL.revokeObjectURL(url);
                this.isLoading.set(false);
                this.showMsg('Documento descargado correctamente', 'success');
            },
            error: (error) => {
                console.error('Error al descargar documento:', error);
                this.isLoading.set(false);
                this.showMsg('Error al generar el documento', 'error');
            }
        });
    }

    volver(): void {
        this.router.navigate(['/administration']);
    }

    // ── Snackbar Helper ──────────────────────────
    private showMsg(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration:           type === 'error' ? 5000 : 3000,
            horizontalPosition: 'end',
            verticalPosition:   'top',
            panelClass:         [`snackbar-${type}`],
        });
    }
}
