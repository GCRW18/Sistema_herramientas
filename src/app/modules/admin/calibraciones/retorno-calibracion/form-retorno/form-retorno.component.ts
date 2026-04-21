import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MovementService } from '../../../../../core/services/movement.service';

interface Funcionario { id: number; nombre: string; cargo: string; area: string; }

@Component({
    selector: 'app-form-retorno',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    ],
    templateUrl: './form-retorno.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #0F172AFF; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #1e293b; }
    `]
})
export class FormRetornoComponent implements OnInit, OnDestroy {

    // ── Inyecciones de Dependencias ──
    private calibrationService = inject(CalibrationService);
    private movementService = inject(MovementService);
    public dialogRef = inject(MatDialogRef<FormRetornoComponent>);
    private snackBar = inject(MatSnackBar);

    // Forma correcta de inyectar datos del modal en Angular moderno
    public dialogData = inject(MAT_DIALOG_DATA, { optional: true }) as any;

    private _destroy$ = new Subject<void>();
    private _receivedBySearch$ = new Subject<string>();

    isProcessing = signal(false);
    laboratories: any[] = [];

    // ── Estado de la Herramienta Activa ──
    activeCalibration: any = null;

    // Form fields
    searchCode = '';
    certificateNumber = '';
    fechaCalStr = '';
    empresaIdOverride: number | null = null;
    observations = '';
    receivedByName = '';

    // Manejo de archivo (PDF)
    selectedFile: File | null = null;

    // Funcionario autocomplete
    receivedByFuncionarios: Funcionario[] = [];
    receivedByLoading = false;
    showReceivedByDropdown = false;

    // Validation state
    showCertError = signal(false);
    duplicateError = signal('');
    showFechaWarning = signal(false);

    readonly todayStr = new Date().toISOString().split('T')[0];

    // GETTERS
    get calibration(): any | undefined {
        return this.activeCalibration;
    }

    get fechaVencimientoDisplay(): string {
        if (!this.fechaCalStr) return '';
        try {
            const d = new Date(this.fechaCalStr + 'T00:00:00');
            d.setFullYear(d.getFullYear() + 1); // Regla de BOA: +1 año automático
            return d.toISOString().split('T')[0];
        } catch { return ''; }
    }

    get selectedLabName(): string {
        if (this.empresaIdOverride) {
            const lab = this.laboratories.find(l => l.id_laboratory === this.empresaIdOverride);
            return lab?.name || '';
        }
        return this.calibration?.supplier_name || '';
    }

    getDiasRetrasado(): number {
        const cal = this.calibration;
        if (!cal?.expected_return_date) return 0;
        try {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const ret = new Date(cal.expected_return_date + 'T00:00:00');
            return Math.max(0, Math.floor((today.getTime() - ret.getTime()) / 86400000));
        } catch { return 0; }
    }

    isRetrasado(): boolean {
        return this.getDiasRetrasado() > 0;
    }

    isFechaFutura(): boolean {
        if (!this.fechaCalStr) return false;
        try {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            return new Date(this.fechaCalStr + 'T00:00:00') > today;
        } catch { return false; }
    }

    isFechaAntesDeEnvio(): boolean {
        const cal = this.calibration;
        if (!cal?.send_date || !this.fechaCalStr) return false;
        try {
            return new Date(this.fechaCalStr + 'T00:00:00') < new Date(cal.send_date + 'T00:00:00');
        } catch { return false; }
    }

    canSubmit(): boolean {
        return !!(this.certificateNumber?.trim() && this.fechaCalStr && !this.isFechaFutura());
    }

    ngOnInit(): void {
        // Inicializamos la calibración con los datos enviados desde la tabla (si existen)
        this.activeCalibration = this.dialogData?.calibration || null;

        this.fechaCalStr = this.todayStr;
        this.loadLaboratorios();
        this.setupFuncionarioSearch();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    // ── BÚSQUEDA CUANDO SE ABRE DESDE EL BOTÓN GLOBAL ──
    buscarEnvioPendiente(): void {
        const term = this.searchCode?.trim().toLowerCase();
        if (!term) return;

        this.isProcessing.set(true);
        this.calibrationService.getCalibrations({ status: 'sent', limit: 200 }).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isProcessing.set(false))
        ).subscribe({
            next: (records) => {
                // Buscamos una herramienta que esté enviada y cuyo código o nota coincida
                const found = records.find((r: any) =>
                    (r.status === 'sent' || r.status === 'in_process') &&
                    (r.record_number?.toLowerCase() === term ||
                        r.tool_code?.toLowerCase() === term ||
                        (r.code && r.code.toLowerCase() === term))
                );

                if (found) {
                    this.activeCalibration = found; // Seteamos la herramienta encontrada
                    this.searchCode = ''; // Limpiamos el buscador
                } else {
                    this.showMessage('No se encontró un envío pendiente con ese código o número de nota.', 'warning');
                }
            },
            error: () => this.showMessage('Error al buscar la herramienta', 'error')
        });
    }

    private setupFuncionarioSearch(): void {
        this._receivedBySearch$.pipe(
            debounceTime(400), distinctUntilChanged(),
            switchMap(term => {
                this.receivedByLoading = true;
                return this.movementService.getFuncionarios(term).pipe(finalize(() => this.receivedByLoading = false));
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.receivedByFuncionarios = (res || []).map((f: any) => ({ id: f.id_funcionario ?? f.id, nombre: f.nombre_completo ?? f.nombre, cargo: f.cargo ?? '', area: f.area ?? '' }));
            this.showReceivedByDropdown = this.receivedByFuncionarios.length > 0;
        });
    }

    onReceivedByInput(value: string): void {
        if (value.length >= 2) this._receivedBySearch$.next(value);
        else { this.receivedByFuncionarios = []; this.showReceivedByDropdown = false; }
    }

    selectReceivedBy(func: Funcionario): void {
        this.receivedByName = func.nombre;
        this.showReceivedByDropdown = false;
    }

    hideReceivedByDropdown(): void { setTimeout(() => this.showReceivedByDropdown = false, 150); }

    loadLaboratorios(): void {
        this.calibrationService.getLaboratories().pipe(takeUntil(this._destroy$)).subscribe({
            next: (labs: any[]) => {
                this.laboratories = labs.map(l => ({
                    id_laboratory: l.id_laboratory || l.id || 0,
                    name: l.laboratory_name || l.name || '—'
                }));
            },
            error: () => {}
        });
    }

    // ── MANEJO DE ARCHIVOS PDF (ADJUNTAR) ──
    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;

        if (input.files && input.files.length > 0) {
            const file = input.files[0];

            if (file.type !== 'application/pdf') {
                this.showMessage('Error: Solo se permiten archivos en formato PDF.', 'error');
                input.value = '';
                return;
            }

            if (file.size > 5242880) { // 5MB
                this.showMessage('Error: El archivo es muy pesado. El máximo permitido es 5MB.', 'error');
                input.value = '';
                return;
            }

            this.selectedFile = file;
            input.value = '';
        }
    }

    removeFile(): void {
        this.selectedFile = null;
    }

    onCertChange(): void {
        this.showCertError.set(false);
        this.duplicateError.set('');
    }

    onFechaCalChange(): void {
        this.showFechaWarning.set(this.isFechaAntesDeEnvio());
    }

    save(): void {
        if (!this.canSubmit()) {
            this.showCertError.set(true);
            this.showMessage('Complete los campos obligatorios correctamente', 'error');
            return;
        }

        if (this.isFechaAntesDeEnvio()) {
            const confirmMsg = `⚠️ ADVERTENCIA\n\nLa fecha de calibración (${this.fechaCalStr}) es anterior a la fecha de envío (${this.calibration?.send_date}).\n\n¿Desea continuar de todas formas?`;
            if (!confirm(confirmMsg)) return;
        }

        this.processReturn();
    }

    processReturn(): void {
        const cal = this.calibration;
        if (!cal) return;

        this.isProcessing.set(true);

        const params: any = {
            id_calibration: cal.id_calibration,
            tool_id: cal.tool_id,
            result: 'approved',
            certificate_number: this.certificateNumber.trim(),
            calibration_date: this.fechaCalStr,
            next_calibration_date: this.fechaVencimientoDisplay,
            observations: this.observations || '',
            received_by_name: this.receivedByName.trim(),
        };
        if (this.empresaIdOverride) params.supplier_id = this.empresaIdOverride;

        this.calibrationService.processCalibrationReturnPxp(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isProcessing.set(false))
        ).subscribe({
            next: (res: any) => {
                if (res?.error === 'DUPLICATE_CERTIFICATE' || res?.ROOT?.error) {
                    this.duplicateError.set(res?.message || res?.ROOT?.detalle?.mensaje || 'Error de duplicidad');
                    this.showMessage(this.duplicateError(), 'error');
                    return;
                }

                if (this.selectedFile) {
                    console.log('PDF Listo para subir al servidor:', this.selectedFile.name);
                    // this.calibrationService.uploadCertificatePDF(cal.id_calibration, this.selectedFile).subscribe(...)
                }

                this.showMessage('Retorno procesado exitosamente', 'success');

                setTimeout(() => {
                    this.calibrationService.generarYVerPdfRetorno(cal.id_calibration);
                    this.dialogRef.close(true);
                }, 500);
            },
            error: (err) => {
                console.error('Error:', err);
                this.showMessage('Error al procesar el retorno', 'error');
            }
        });
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: type === 'error' ? 5000 : 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
