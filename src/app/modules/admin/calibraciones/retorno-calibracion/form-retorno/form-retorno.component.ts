import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, lastValueFrom, of } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap, map, catchError } from 'rxjs/operators';
import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MovementService } from '../../../../../core/services/movement.service';
import { BlobStorageService } from '../../../../../core/services/blob-storage.service';
import { localDateStr } from '../../../../../core/utils/date.utils';

interface Funcionario { id: number; nombre: string; cargo: string; area: string; }

@Component({
    selector: 'app-form-retorno',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
        DragDropModule,
    ],
    templateUrl: './form-retorno.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class FormRetornoComponent implements OnInit, OnDestroy {

    private calibrationService = inject(CalibrationService);
    private movementService    = inject(MovementService);
    private blobStorage        = inject(BlobStorageService);
    public  dialogRef          = inject(MatDialogRef<FormRetornoComponent>);
    private snackBar           = inject(MatSnackBar);
    private cdr                = inject(ChangeDetectorRef);

    public dialogData = inject(MAT_DIALOG_DATA, { optional: true }) as any;

    private _destroy$          = new Subject<void>();
    private _receivedBySearch$ = new Subject<string>();

    isProcessing = signal(false);
    laboratories: any[] = [];

    certificateNumber = '';
    fechaCalStr = '';
    empresaIdOverride: number | null = null;
    observations = '';
    receivedByName = '';
    costo: number | null = null;
    resultado: 'approved' | 'conditional' | 'rejected' = 'approved';
    selectedFile: File | null = null;
    // El PDF se sube al Blob Storage (no como base64), así que el límite es solo
    // el del servidor de subida.
    private readonly MAX_PDF_BYTES = 8 * 1024 * 1024;

    receivedByFuncionarios: Funcionario[] = [];
    receivedByLoading = false;
    showReceivedByDropdown = false;

    showCertError    = signal(false);
    duplicateError   = signal('');
    showFechaWarning = signal(false);

    readonly todayStr = localDateStr();

    get calibration(): any | undefined { return this.dialogData?.calibration || null; }

    /** Metadatos del retorno guiado por nota ({ pos, total, record_number, hasNext }) o null. */
    get queue(): { pos: number; total: number; record_number: string; hasNext: boolean } | null {
        return this.dialogData?.queue || null;
    }

    formatDateDisplay(isoStr: string | null | undefined): string {
        if (!isoStr) return '—';
        const parts = isoStr.split('T')[0].split('-');
        if (parts.length !== 3) return isoStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    get fechaVencimientoDisplay(): string {
        if (!this.fechaCalStr) return '';
        try {
            const d = new Date(this.fechaCalStr + 'T00:00:00');
            d.setFullYear(d.getFullYear() + 1);
            return localDateStr(d);
        } catch { return ''; }
    }

    ngOnInit(): void {
        this.fechaCalStr = this.todayStr;
        this.receivedByName = this._currentUser();
        const prevCost = this.calibration?.cost;
        this.costo = (prevCost === null || prevCost === undefined || prevCost === '') ? null : Number(prevCost);
        this.loadLaboratorios();
        this.setupFuncionarioSearch();
    }

    private _currentUser(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || '';
        } catch { return ''; }
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    private setupFuncionarioSearch(): void {
        this._receivedBySearch$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                if (term.length < 2) { this.showReceivedByDropdown = false; return of([]); }
                this.receivedByLoading = true;
                const q = term.toLowerCase();
                return this.movementService.getPersonal().pipe(
                    map(lista => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map((f: any) => ({
                            id:     f.id_employee || f.id,
                            nombre: f.nombreCompleto || f.nombre,
                            cargo:  f.cargo ?? '',
                            area:   f.area  ?? ''
                        }))
                    ),
                    finalize(() => this.receivedByLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.receivedByFuncionarios = res || [];
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
        if (!this.calibration || !this.fechaCalStr || this.isFechaFutura()) return false;
        // El certificado es obligatorio salvo cuando la herramienta fue rechazada en calibración.
        if (this.resultado !== 'rejected' && !this.certificateNumber?.trim()) return false;
        return true;
    }

    get isRechazado(): boolean { return this.resultado === 'rejected'; }

    isFechaFutura(): boolean {
        if (!this.fechaCalStr) return false;
        const today = new Date(); today.setHours(0,0,0,0);
        return new Date(this.fechaCalStr + 'T00:00:00') > today;
    }

    isFechaAntesDeEnvio(): boolean {
        const cal = this.calibration;
        if (!cal?.send_date || !this.fechaCalStr) return false;
        const sendDateOnly = String(cal.send_date).split('T')[0];
        return this.fechaCalStr < sendDateOnly;
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
            id_calibration:       cal.id_calibration,
            tool_id:              cal.tool_id,
            result:               this.resultado,
            actual_return_date:   this.todayStr,
            certificate_number:   this.certificateNumber.trim(),
            calibration_date:     this.fechaCalStr,
            // El backend recalcula el vencimiento con el intervalo real de la herramienta;
            // esto va solo como fallback si la herramienta no tiene intervalo configurado.
            next_calibration_date: this.fechaVencimientoDisplay,
            observations:         this.observations || '',
            received_by_name:     this.receivedByName.trim(),
            cost:                 this.costo ?? undefined,
            currency:             'BOB',
        };

        if (this.empresaIdOverride) params.supplier_id = this.empresaIdOverride;
        // El PDF NO va en el payload del retorno: se sube al Blob Storage aparte y se
        // guarda solo la ruta.

        try {
            const res: any = await lastValueFrom(this.calibrationService.processCalibrationReturnPxp(params));
            const isError = res?.error === true || res?.ROOT?.error === true;

            if (isError) {
                const msg = res?.detalle?.mensaje || res?.ROOT?.detalle?.mensaje || 'Error en el servidor';
                this.duplicateError.set(msg);
                this.showMessage(msg, 'error');
                return;
            }

            // El retorno ya quedó registrado; el certificado es secundario.
            if (this.selectedFile) {
                try {
                    const rutaBs = await lastValueFrom(
                        this.blobStorage.upload(this.selectedFile, 'Documentos', cal.id_calibration)
                    );
                    await lastValueFrom(this.calibrationService.saveReturnCertificate(cal.id_calibration, rutaBs));
                } catch (certErr: any) {
                    console.error('Error guardando certificado:', certErr);
                    const detalle = certErr?.message ? ` (${certErr.message})` : '';
                    this.showMessage('Retorno registrado, pero el certificado PDF NO se subió' + detalle + '. Vuelva a adjuntarlo desde la fila del retorno.', 'warning');
                    this.dialogRef.close(true);
                    return;
                }
            }

            this.showMessage('Retorno registrado con éxito', 'success');
            this.dialogRef.close(true);
        } catch (err: any) {
            console.error('Error retorno:', err);
            const msg = err?.message || 'Error de conexión con el servidor';
            this.duplicateError.set(msg);
            this.showMessage(msg, 'error');
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
            this.showMessage('El PDF supera los 8 MB permitidos. Comprímalo o redúzcalo antes de adjuntarlo.', 'warning');
            input.value = '';
            return;
        }

        this.selectedFile = file;
        this.cdr.detectChanges();
    }

    removeFile(): void {
        this.selectedFile = null;
        const fileInput = document.getElementById('pdfInputRetorno') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    }
}
