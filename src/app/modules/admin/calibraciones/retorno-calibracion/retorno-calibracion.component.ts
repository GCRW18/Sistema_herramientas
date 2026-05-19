import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule }                              from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule }              from '@angular/forms';
import { Subject, combineLatest }                        from 'rxjs';
import { debounceTime, startWith, takeUntil, finalize }  from 'rxjs/operators';
import { CalibrationService }                            from '../../../../core/services/calibration.service';

interface CalibrationDisplay {
    id_calibration:       number;
    tool_id:              number;
    tool_code:            string;
    tool_name:            string;
    tool_serial?:         string;
    supplier_name:        string;
    supplier_id?:         number;
    record_number:        string;
    send_date:            string;
    expected_return_date: string | null;
    work_type:            string;
    base:                 string;
    almacen:              string;
    status:               string;
}

@Component({
    selector: 'app-retorno-calibracion',
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
    templateUrl: './retorno-calibracion.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    `]
})
export class RetornoCalibracionComponent implements OnInit, OnDestroy {

    private dialog             = inject(MatDialog);
    private snackBar           = inject(MatSnackBar);
    private calibrationService = inject(CalibrationService);
    private _destroy$          = new Subject<void>();

    searchControl = new FormControl('');
    filterEstado  = new FormControl('sent');

    isLoading             = signal(false);
    calibraciones:         CalibrationDisplay[] = [];
    filteredCalibraciones: CalibrationDisplay[] = [];

    estadosFiltro = [
        { value: '',         label: 'TODOS' },
        { value: 'sent',     label: 'EN LABORATORIO' },
        { value: 'returned', label: 'COMPLETADOS' },
    ];

    ngOnInit(): void {
        this.loadCalibraciones();
        this.setupFilters();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    loadCalibraciones(): void {
        this.isLoading.set(true);
        this.calibrationService.getCalibrations({ limit: 500 }).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading.set(false)),
        ).subscribe({
            next: (records: any[]) => {
                this.calibraciones = (records || []).map(r => ({
                    id_calibration:       r.id_calibration ?? r.id ?? 0,
                    tool_id:              r.tool_id ?? r.id_tool ?? 0,
                    tool_code:            r.tool_code ?? r.code ?? '—',
                    tool_name:            r.tool_name ?? r.name ?? '—',
                    tool_serial:          r.tool_serial ?? r.serial_number ?? '—',
                    supplier_name:        r.supplier_name ?? r.laboratory_name ?? '—',
                    supplier_id:          r.supplier_id ?? r.id_laboratory ?? 0,
                    record_number:        r.record_number ?? '—',
                    send_date:            r.send_date ?? '—',
                    expected_return_date: r.expected_return_date ?? null,
                    work_type:            r.work_type ?? 'CALIBRACIÓN',
                    base:                 r.base ?? '—',
                    almacen:              r.almacen ?? '—',
                    status:               r.status ?? 'sent',
                }));
                this.applyFilters();
            },
            error: (err) => {
                console.error('Error loadCalibraciones:', err);
                this.showMsg('Error al sincronizar con el servidor', 'error');
            },
        });
    }

    setupFilters(): void {
        combineLatest([
            this.searchControl.valueChanges.pipe(startWith('')),
            this.filterEstado.valueChanges.pipe(startWith('sent')),
        ]).pipe(
            debounceTime(250),
            takeUntil(this._destroy$),
        ).subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        let list = [...this.calibraciones];

        const query = this.searchControl.value?.toLowerCase().trim() ?? '';
        if (query) {
            list = list.filter(c =>
                c.tool_code.toLowerCase().includes(query) ||
                c.tool_name.toLowerCase().includes(query) ||
                c.record_number.toLowerCase().includes(query) ||
                c.supplier_name.toLowerCase().includes(query)
            );
        }

        const estado = this.filterEstado.value;
        if (estado) {
            if (estado === 'sent') {
                list = list.filter(c => c.status === 'sent' || c.status === 'in_process');
            } else if (estado === 'returned') {
                list = list.filter(c => c.status === 'returned' || c.status === 'completed');
            } else {
                list = list.filter(c => c.status === estado);
            }
        }

        this.filteredCalibraciones = list;
    }

    getEnLabCount(): number {
        return this.calibraciones.filter(c => c.status === 'sent' || c.status === 'in_process').length;
    }

    getRetrasadasCount(): number {
        return this.calibraciones.filter(c => this.isRetrasado(c)).length;
    }

    getATiempoCount(): number {
        return Math.max(0, this.getEnLabCount() - this.getRetrasadasCount());
    }

    isRetrasado(cal: CalibrationDisplay): boolean {
        if (!cal.expected_return_date || cal.status === 'returned' || cal.status === 'completed') return false;
        try {
            const dateStr = cal.expected_return_date.includes('T') ? cal.expected_return_date : cal.expected_return_date + 'T00:00:00';
            const expectedDate = new Date(dateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return expectedDate < today;
        } catch { return false; }
    }

    getDiasRetrasado(cal: CalibrationDisplay): number {
        if (!cal.expected_return_date) return 0;
        try {
            const dateStr = cal.expected_return_date.includes('T') ? cal.expected_return_date : cal.expected_return_date + 'T00:00:00';
            const expectedDate = new Date(dateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return Math.floor((today.getTime() - expectedDate.getTime()) / 86_400_000);
        } catch { return 0; }
    }

    async abrirConfirmarRetorno(cal: CalibrationDisplay): Promise<void> {
        try {
            const { FormRetornoComponent } = await import('./form-retorno/form-retorno.component');
            const ref = this.dialog.open(FormRetornoComponent, {
                width: '680px',
                maxWidth: '96vw',
                height: '82vh',
                panelClass: 'no-padding-dialog',
                disableClose: true,
                data: { calibration: cal }
            });
            ref.afterClosed().subscribe(success => {
                if (success) this.loadCalibraciones();
            });
        } catch (e) {
            this.showMsg('Error al inicializar el módulo de retorno', 'error');
        }
    }

    formatDateDisplay(isoStr: string | null | undefined): string {
        if (!isoStr || isoStr === '—') return '—';
        const parts = isoStr.split('T')[0].split('-');
        if (parts.length !== 3) return isoStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    printNota(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) return;
        this.isLoading.set(true);
        this.calibrationService.generarPdfEnvioCalibracion(cal.id_calibration).pipe(
            finalize(() => this.isLoading.set(false))
        ).subscribe({
            next: (res) => {
                if (res?.pdf_base64) {
                    this.calibrationService.abrirPdf(res.pdf_base64, res.nombre_archivo);
                }
            },
            error: () => this.showMsg('No se pudo generar la Nota de Envío', 'error')
        });
    }

    visualizarRetorno(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) return;
        this.isLoading.set(true);
        this.calibrationService.generarPdfRetornoCalibracion(cal.id_calibration).pipe(
            finalize(() => this.isLoading.set(false))
        ).subscribe({
            next: (res) => {
                if (res?.pdf_base64) {
                    this.calibrationService.abrirPdf(res.pdf_base64, res.nombre_archivo);
                }
            },
            error: () => this.showMsg('Certificado no disponible o error de generación', 'error')
        });
    }

    private showMsg(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration:           type === 'error' ? 5000 : 3500,
            horizontalPosition: 'end',
            verticalPosition:   'top',
            panelClass:         [`snackbar-${type}`],
        });
    }
}
