import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule }                                  from '@angular/common';
import { Router }                                        from '@angular/router';
import { MatIconModule }                                 from '@angular/material/icon';
import { MatDialog, MatDialogModule }                    from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule }                from '@angular/material/snack-bar';
import { MatProgressSpinnerModule }                      from '@angular/material/progress-spinner';
import { MatTooltipModule }                              from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule }              from '@angular/forms';
import { Subject, combineLatest }                        from 'rxjs';
import { debounceTime, startWith, takeUntil, finalize }  from 'rxjs/operators';
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
        ReactiveFormsModule,
    ],
    templateUrl: './envio-calibracion.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #e2e8f0;
            border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #FF6A00;
            border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #e55a00;
        }
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
        tbody tr:hover {
            background-color: #fff7ed;
        }
        .dark tbody tr:hover {
            background-color: #1e293b;
        }
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
        { value: 'returned',   label: 'Retornados'       },
        { value: 'cancelled',  label: 'Anulados'         },
    ];

    // ── Lifecycle ────────────────────────────────
    ngOnInit(): void {
        this.loadCalibraciones();
        this.setupFilters();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    // ── Data Loading ──────────────────────────────
    loadCalibraciones(): void {
        this.isLoading.set(true);
        this.calibrationService.getCalibrations({ limit: 200 }).pipe(
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
                }));
                this.applyFilters();
            },
            error: (err) => {
                console.error('Error loading calibrations:', err);
                this.showMsg('Error al cargar las calibraciones', 'error');
                this.isLoading.set(false);
            },
        });
    }

    setupFilters(): void {
        combineLatest([
            this.searchControl.valueChanges.pipe(startWith('')),
            this.filterEstado.valueChanges.pipe(startWith('')),
        ]).pipe(
            debounceTime(300),
            takeUntil(this._destroy$),
        ).subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        let list = [...this.calibraciones];

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

        const estado = this.filterEstado.value;
        if (estado) {
            list = list.filter(c => c.status === estado);
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
        if (!cal.expected_return_date || cal.status === 'returned' || cal.status === 'cancelled') return false;
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
            'returned': 'RETORNADO',
            'cancelled': 'ANULADO'
        };
        return labels[s] ?? s.toUpperCase();
    }

    getStatusChipClass(s: string): string {
        const classes: Record<string, string> = {
            'sent': 'bg-blue-100 text-blue-800 border-blue-200',
            'in_process': 'bg-amber-100 text-amber-800 border-amber-200',
            'returned': 'bg-green-100 text-green-800 border-green-200',
            'cancelled': 'bg-red-100 text-red-800 border-red-200'
        };
        return classes[s] ?? 'bg-gray-100 text-gray-700 border-gray-200';
    }

    // ── Actions ──────────────────────────────────

    // 1. NUEVO ENVÍO
    async nuevoEnvio(): Promise<void> {
        try {
            const { FormEnvioComponent } = await import('./form-envio/form-envio.component');
            const ref = this.dialog.open(FormEnvioComponent, {
                width:       '900px',
                maxWidth:    '95vw',
                height:      'auto',
                maxHeight:   '90vh',
                panelClass:  'neo-dialog',
                disableClose: false,
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

    // 2. VER DETALLES (Abre el nuevo componente modal de Detalle)
    async verDetalles(cal: CalibrationDisplay): Promise<void> {
        try {
            const { DetalleEnvioComponent } = await import('./detalle-envio/detalle-envio.component');

            this.dialog.open(DetalleEnvioComponent, {
                width: '600px',
                maxWidth: '95vw',
                panelClass: 'neo-dialog',
                data: { calibracion: cal }
            });
        } catch (error) {
            console.error('Error al cargar modal de detalles:', error);
            this.showMsg('Error al abrir detalles', 'error');
        }
    }

    // 3. ANULAR ENVÍO (Abre el nuevo componente modal de Anulación)
    async anularEnvio(cal: CalibrationDisplay): Promise<void> {
        try {
            const { AnularEnvioComponent } = await import('./anular-envio/anular-envio.component');

            const ref = this.dialog.open(AnularEnvioComponent, {
                width: '500px',
                panelClass: 'neo-dialog',
                disableClose: true,
                data: { calibracion: cal }
            });

            ref.afterClosed().subscribe(reason => {
                if (!reason) return; // Se canceló o cerró el modal

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

        setTimeout(() => {
            this.isLoading.set(false);
        }, 1500);
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

        setTimeout(() => {
            this.isLoading.set(false);
        }, 1500);
    }

    /**
     * Descarga el PDF de Nota de Envío
     */
    descargarNotaPdf(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) {
            this.showMsg('ID de calibración no válido', 'error');
            return;
        }

        this.isLoading.set(true);

        this.calibrationService.generarPdfEnvioCalibracion(cal.id_calibration).subscribe({
            next: (result) => {
                const byteCharacters = atob(result.pdf_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.nombre_archivo;
                a.click();
                window.URL.revokeObjectURL(url);

                this.isLoading.set(false);
                this.showMsg('PDF descargado correctamente', 'success');
            },
            error: (error) => {
                console.error('Error al descargar PDF:', error);
                this.isLoading.set(false);
                this.showMsg('Error al generar el PDF', 'error');
            }
        });
    }

    /**
     * Descarga el PDF de Certificado de Retorno
     */
    descargarCertificadoPdf(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) {
            this.showMsg('ID de calibración no válido', 'error');
            return;
        }

        this.isLoading.set(true);

        this.calibrationService.generarPdfRetornoCalibracion(cal.id_calibration).subscribe({
            next: (result) => {
                const byteCharacters = atob(result.pdf_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.nombre_archivo;
                a.click();
                window.URL.revokeObjectURL(url);

                this.isLoading.set(false);
                this.showMsg('PDF descargado correctamente', 'success');
            },
            error: (error) => {
                console.error('Error al descargar PDF:', error);
                this.isLoading.set(false);
                this.showMsg('Error al generar el PDF', 'error');
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
