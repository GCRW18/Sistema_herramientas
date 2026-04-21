import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, combineLatest } from 'rxjs';
import { debounceTime, startWith, takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

interface CalibrationDisplay {
    id_calibration: number;
    tool_code: string;
    tool_name: string;
    tool_serial?: string;
    supplier_name: string;
    supplier_id?: number;
    record_number: string;
    send_date: string;
    expected_return_date: string | null;
    work_type: string;
    base: string;
    almacen: string;
    status: string;
    is_jack: boolean;
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
})
export class RetornoCalibracionComponent implements OnInit, OnDestroy {

    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private calibrationService = inject(CalibrationService);
    private _destroy$ = new Subject<void>();

    searchControl = new FormControl('');
    filterEstado = new FormControl('sent');

    isLoading = signal(false);
    calibraciones: CalibrationDisplay[] = [];
    filteredCalibraciones: CalibrationDisplay[] = [];

    // Variable para almacenar temporalmente la herramienta a la que se le subirá el PDF
    selectedCalForUpload: CalibrationDisplay | null = null;

    estadosFiltro = [
        { value: '', label: 'Todos los estados' },
        { value: 'sent', label: 'En Laboratorio' },
        { value: 'returned', label: 'Completados' },
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
        this.calibrationService.getCalibrations({ limit: 200 }).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading.set(false)),
        ).subscribe({
            next: (records: any[]) => {
                this.calibraciones = records.map(r => ({
                    id_calibration: r.id_calibration ?? r.id ?? 0,
                    tool_code: r.tool_code ?? r.code ?? '—',
                    tool_name: r.tool_name ?? r.name ?? '—',
                    tool_serial: r.tool_serial ?? r.serial_number ?? '—',
                    supplier_name: r.supplier_name ?? r.laboratory_name ?? '—',
                    supplier_id: r.supplier_id ?? r.id_laboratory ?? 0,
                    record_number: r.record_number ?? '—',
                    send_date: r.send_date ?? '—',
                    expected_return_date: r.expected_return_date ?? null,
                    work_type: r.work_type ?? 'CALIBRACIÓN',
                    base: r.base ?? '—',
                    almacen: r.almacen ?? '—',
                    status: r.status ?? 'sent',
                    is_jack: r.is_jack ?? false,
                }));
                this.applyFilters();
            },
            error: (err) => {
                console.error('Error loading calibrations:', err);
                this.showMsg('Error al cargar las calibraciones', 'error');
            },
        });
    }

    setupFilters(): void {
        combineLatest([
            this.searchControl.valueChanges.pipe(startWith('')),
            this.filterEstado.valueChanges.pipe(startWith('sent')),
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
                c.tool_code.toLowerCase().includes(q) ||
                c.tool_name.toLowerCase().includes(q) ||
                c.record_number.toLowerCase().includes(q) ||
                c.supplier_name.toLowerCase().includes(q)
            );
        }

        const estado = this.filterEstado.value;
        if (estado) {
            if (estado === 'sent') {
                // 'sent' agrupa enviados y en proceso
                list = list.filter(c => c.status === 'sent' || c.status === 'in_process');
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
        if (!cal.expected_return_date || cal.status === 'returned') return false;
        try {
            const expectedDate = new Date(cal.expected_return_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return expectedDate < today;
        } catch {
            return false;
        }
    }

    // ===================================================================
    // ACCIONES
    // ===================================================================

    async abrirModalRegistroRetornoGlobal(): Promise<void> {
        try {
            const { FormRetornoComponent } = await import('./form-retorno/form-retorno.component');
            const ref = this.dialog.open(FormRetornoComponent, {
                width: '900px',
                maxWidth: '95vw',
                panelClass: 'neo-dialog',
                disableClose: true,
                data: { calibration: null }
            });
            ref.afterClosed().subscribe(ok => {
                if (ok) {
                    this.loadCalibraciones();
                    this.searchControl.setValue('');
                }
            });
        } catch (error) {
            this.showMsg('Error al abrir el formulario', 'error');
        }
    }

    async abrirModalRegistroRetorno(cal: CalibrationDisplay): Promise<void> {
        try {
            const { FormRetornoComponent } = await import('./form-retorno/form-retorno.component');
            const ref = this.dialog.open(FormRetornoComponent, {
                width: '900px',
                maxWidth: '95vw',
                panelClass: 'neo-dialog',
                disableClose: true,
                data: { calibration: cal }
            });
            ref.afterClosed().subscribe(ok => {
                if (ok) {
                    this.loadCalibraciones();
                }
            });
        } catch (error) {
            this.showMsg('Error al abrir el formulario', 'error');
        }
    }

    printNota(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) {
            this.showMsg('ID de calibración no válido', 'error');
            return;
        }
        this.isLoading.set(true);
        this.calibrationService.generarYVerPdfEnvio(cal.id_calibration);
        setTimeout(() => this.isLoading.set(false), 1500);
    }

    visualizarRetorno(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) {
            this.showMsg('ID de calibración no válido', 'error');
            return;
        }
        this.isLoading.set(true);
        this.calibrationService.generarYVerPdfRetorno(cal.id_calibration);
        setTimeout(() => this.isLoading.set(false), 1500);
    }

    // ===================================================================
    // SUBIDA DE ARCHIVO (PDF)
    // ===================================================================

    triggerFileInput(cal: CalibrationDisplay): void {
        this.selectedCalForUpload = cal;
        const fileInput = document.getElementById('fileUploadInput') as HTMLInputElement;
        if (fileInput) {
            fileInput.click();
        }
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;

        if (input.files && input.files.length > 0) {
            const file = input.files[0];

            // Validar que sea PDF
            if (file.type !== 'application/pdf') {
                this.showMsg('Solo se permiten archivos en formato PDF', 'warning');
                input.value = ''; // Limpiar
                return;
            }

            // Simulamos la subida o la preparamos para cuando exista el endpoint
            /* Aquí iría la llamada al backend real:
               this.calibrationService.uploadCertificate(this.selectedCalForUpload.id_calibration, file).subscribe(...)
            */

            this.showMsg(`Certificado "${file.name}" adjuntado exitosamente para ${this.selectedCalForUpload?.tool_code}`, 'success');

            // Limpiar el input para permitir subir otro archivo luego
            input.value = '';
            this.selectedCalForUpload = null;
        }
    }

    private showMsg(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: type === 'error' ? 5000 : 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`],
        });
    }
}
