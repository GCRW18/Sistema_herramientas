import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, lastValueFrom } from 'rxjs';
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
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    `]
})
export class FormRetornoComponent implements OnInit, OnDestroy {

    private calibrationService = inject(CalibrationService);
    private movementService    = inject(MovementService);
    public  dialogRef          = inject(MatDialogRef<FormRetornoComponent>);
    private snackBar           = inject(MatSnackBar);
    private cdr                = inject(ChangeDetectorRef);

    public dialogData = inject(MAT_DIALOG_DATA, { optional: true }) as any;

    private _destroy$ = new Subject<void>();
    private _receivedBySearch$ = new Subject<string>();

    isProcessing = signal(false);
    laboratories: any[] = [];
    activeCalibration: any = null;

    searchCode = '';
    certificateNumber = '';
    fechaCalStr = '';
    empresaIdOverride: number | null = null;
    observations = '';
    receivedByName = '';
    selectedFile: File | null = null;
    selectedFileBase64: string | null = null;
    private readonly MAX_PDF_BYTES = 5 * 1024 * 1024;

    receivedByFuncionarios: Funcionario[] = [];
    receivedByLoading = false;
    showReceivedByDropdown = false;

    showCertError = signal(false);
    duplicateError = signal('');
    showFechaWarning = signal(false);

    readonly todayStr = new Date().toISOString().split('T')[0];

    get calibration(): any | undefined { return this.activeCalibration; }

    get fechaVencimientoDisplay(): string {
        if (!this.fechaCalStr) return '';
        try {
            const d = new Date(this.fechaCalStr + 'T00:00:00');
            d.setFullYear(d.getFullYear() + 1);
            return d.toISOString().split('T')[0];
        } catch { return ''; }
    }

    ngOnInit(): void {
        this.activeCalibration = this.dialogData?.calibration || null;
        this.fechaCalStr = this.todayStr;
        this.loadLaboratorios();
        this.setupFuncionarioSearch();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    buscarEnvioPendiente(): void {
        const term = this.searchCode?.trim().toLowerCase();
        if (!term) return;

        this.isProcessing.set(true);
        this.calibrationService.getCalibrations({ status: 'sent', limit: 200 }).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isProcessing.set(false))
        ).subscribe({
            next: (records) => {
                const found = records.find((r: any) =>
                    (r.status === 'sent' || r.status === 'in_process') &&
                    (r.record_number?.toLowerCase() === term ||
                        r.tool_code?.toLowerCase() === term ||
                        (r.code && r.code.toLowerCase() === term))
                );

                if (found) {
                    this.activeCalibration = found;
                    this.searchCode = '';
                    this.cdr.detectChanges();
                } else {
                    this.showMessage('No se encontró un envío pendiente con ese código/nota', 'warning');
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
            this.receivedByFuncionarios = (res || []).map((f: any) => ({
                id: f.id_funcionario ?? f.id,
                nombre: f.nombre_completo ?? f.nombre,
                cargo: f.cargo ?? '',
                area: f.area ?? ''
            }));
            this.showReceivedByDropdown = this.receivedByFuncionarios.length > 0;
        });
    }

    onReceivedByInput(v: string): void {
        if (v.length >= 2) this._receivedBySearch$.next(v);
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
            }
        });
    }

    canSubmit(): boolean {
        return !!(this.calibration && this.certificateNumber?.trim() && this.fechaCalStr && !this.isFechaFutura());
    }

    isFechaFutura(): boolean {
        if (!this.fechaCalStr) return false;
        const today = new Date(); today.setHours(0,0,0,0);
        return new Date(this.fechaCalStr + 'T00:00:00') > today;
    }

    isFechaAntesDeEnvio(): boolean {
        const cal = this.calibration;
        if (!cal?.send_date || !this.fechaCalStr) return false;
        return new Date(this.fechaCalStr + 'T00:00:00') < new Date(cal.send_date + 'T00:00:00');
    }

    isRetrasado(): boolean {
        const cal = this.calibration;
        if (!cal?.expected_return_date) return false;
        const today = new Date(); today.setHours(0,0,0,0);
        const exp = new Date(cal.expected_return_date.includes('T') ? cal.expected_return_date : cal.expected_return_date + 'T00:00:00');
        return exp < today;
    }

    save(): void {
        if (!this.canSubmit()) {
            this.showCertError.set(true);
            this.showMessage('Complete los campos obligatorios correctamente', 'error');
            return;
        }
        if (this.isFechaAntesDeEnvio()) {
            if (!confirm(`La fecha de calibración es anterior al envío. ¿Desea continuar?`)) return;
        }
        this.processReturn();
    }

    async processReturn(): Promise<void> {
        const cal = this.calibration;
        if (!cal) return;

        this.isProcessing.set(true);

        const params: any = {
            id_calibration: cal.id_calibration,
            tool_id: cal.tool_id,
            result: 'approved',
            actual_return_date: this.todayStr,
            certificate_number: this.certificateNumber.trim(),
            calibration_date: this.fechaCalStr,
            next_calibration_date: this.fechaVencimientoDisplay,
            observations: this.observations || '',
            received_by_name: this.receivedByName.trim(),
        };

        if (this.empresaIdOverride) params.supplier_id = this.empresaIdOverride;
        if (this.selectedFileBase64) params.certificate_file = this.selectedFileBase64;

        try {
            const res: any = await lastValueFrom(this.calibrationService.processCalibrationReturnPxp(params));

            const isError = res?.error === true || res?.ROOT?.error === true;

            if (!isError) {
                this.showMessage('Retorno registrado — generando certificado…', 'success');
                this.calibrationService.generarYVerPdfRetorno(cal.id_calibration);
                this.dialogRef.close(true);
            } else {
                const msg = res?.detalle?.mensaje || res?.ROOT?.detalle?.mensaje || 'Error en el servidor';
                this.duplicateError.set(msg);
                this.showMessage(msg, 'error');
            }
        } catch (err: any) {
            console.error('Error retorno:', err);
            this.showMessage('Error de conexión con el servidor', 'error');
        } finally {
            this.isProcessing.set(false);
            this.cdr.detectChanges();
        }
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: type === 'error' ? 5000 : 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }

    onCertChange(): void { this.showCertError.set(false); this.duplicateError.set(''); }
    onFechaCalChange(): void { this.showFechaWarning.set(this.isFechaAntesDeEnvio()); }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            this.showMessage('Solo se permiten archivos PDF', 'warning');
            input.value = '';
            return;
        }
        if (file.size > this.MAX_PDF_BYTES) {
            this.showMessage('El PDF supera los 5 MB permitidos', 'warning');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            this.selectedFile = file;
            const result = reader.result as string;
            // Strip "data:...;base64," prefix — the comma breaks pxp key#value serialization
            this.selectedFileBase64 = result.includes(',') ? result.split(',')[1] : result;
            this.cdr.detectChanges();
        };
        reader.onerror = () => this.showMessage('No se pudo leer el archivo', 'error');
        reader.readAsDataURL(file);
    }

    removeFile(): void {
        this.selectedFile = null;
        this.selectedFileBase64 = null;
        const fileInput = document.getElementById('pdfInputRetorno') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    }
}
