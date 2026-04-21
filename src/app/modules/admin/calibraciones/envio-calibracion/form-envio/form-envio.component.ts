import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MovementService } from '../../../../../core/services/movement.service';
import { ScanToolResult } from '../../../../../core/models';
import { generateCode128Svg } from '../../../../../shared/barcode/code128';

interface Funcionario { id: number; nombre: string; cargo: string; area: string; }

@Component({
    selector: 'app-form-envio',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    ],
    templateUrl: './form-envio.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
    `]
})
export class FormEnvioComponent implements OnInit, OnDestroy {

    private calibrationService = inject(CalibrationService);
    private movementService = inject(MovementService);
    public dialogRef = inject(MatDialogRef<FormEnvioComponent>);
    private snackBar = inject(MatSnackBar);
    private _destroy$ = new Subject<void>();
    private _requestedBySearch$ = new Subject<string>();
    private _deliveredBySearch$ = new Subject<string>();
    private _toolSearch$ = new Subject<string>();

    @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

    readonly Math = Math;

    // Signals de estado
    isScanning = signal(false);
    isSaving = signal(false);
    isGeneratingNota = signal(false);
    scannedTool = signal<ScanToolResult | null>(null);
    generatedNota = signal<string | null>(null);
    lastCreatedCalibrationId = signal<number | null>(null);

    // Formulario
    searchMethod: 'manual' | 'scan' = 'manual';
    barcodeValue = 'BOA-H-';

    laboratories: any[] = [];
    selectedLabId: number | null = null;
    selectedLabName = '';

    // FIX APLICADO: Valor compatible exactamente con el CHECK de la BD
    workType = 'calibration';
    almacen = '';
    base = '';
    cantidad = 1;
    sendNotes = '';

    // Autocomplete herramienta
    toolSuggestions: any[] = [];
    showToolDropdown = false;
    toolSearchLoading = false;

    // Funcionario fields
    requestedByName = '';
    deliveredByName = '';
    requestedByFuncionarios: Funcionario[] = [];
    deliveredByFuncionarios: Funcionario[] = [];
    requestedByLoading = false;
    deliveredByLoading = false;
    showRequestedByDropdown = false;
    showDeliveredByDropdown = false;

    // FIX APLICADO: Opciones en inglés minúsculas tal como exige PostgreSQL
    workTypeOptions = [
        { value: 'calibration', label: 'CALIBRACIÓN' },
        { value: 'repair', label: 'REPARACIÓN' }
    ];

    // Fechas auto-calculadas
    readonly fechaEnvioDisplay = this.formatDate(new Date());
    readonly fechaRetornoDisplay = this.formatDate(this.addDays(new Date(), 7));
    readonly fechaProxCalDisplay = this.formatDate(this.addYear(this.addDays(new Date(), 7)));

    ngOnInit(): void {
        this.loadLaboratorios();
        this.setupFuncionarioSearch();
        this.setupToolSearch();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    // Tool autocomplete
    private setupToolSearch(): void {
        this._toolSearch$.pipe(
            debounceTime(350),
            distinctUntilChanged(),
            switchMap(term => {
                if (term.length < 3) { this.toolSuggestions = []; this.showToolDropdown = false; return of([]); }
                this.toolSearchLoading = true;
                return this.calibrationService.searchToolsAutocomplete(term).pipe(
                    finalize(() => this.toolSearchLoading = false)
                );
            }),
            takeUntil(this._destroy$),
        ).subscribe(results => {
            this.toolSuggestions = results || [];
            this.showToolDropdown = this.toolSuggestions.length > 0;
        });
    }

    onToolInput(value: string): void {
        if (this.searchMethod !== 'manual') return;
        this.scannedTool.set(null);
        this.generatedNota.set(null);
        const term = value.trim();
        this._toolSearch$.next(term);
    }

    selectToolSuggestion(tool: any): void {
        this.barcodeValue = tool.code;
        this.showToolDropdown = false;
        this.toolSuggestions = [];
        setTimeout(() => this.scanTool(), 50);
    }

    hideToolDropdown(): void {
        setTimeout(() => this.showToolDropdown = false, 180);
    }

    // Funcionario autocomplete
    private setupFuncionarioSearch(): void {
        this._requestedBySearch$.pipe(
            debounceTime(400), distinctUntilChanged(),
            switchMap(term => {
                this.requestedByLoading = true;
                return this.movementService.getFuncionarios(term).pipe(finalize(() => this.requestedByLoading = false));
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.requestedByFuncionarios = (res || []).map((f: any) => ({ id: f.id_funcionario ?? f.id, nombre: f.nombre_completo ?? f.nombre, cargo: f.cargo ?? '', area: f.area ?? '' }));
            this.showRequestedByDropdown = this.requestedByFuncionarios.length > 0;
        });

        this._deliveredBySearch$.pipe(
            debounceTime(400), distinctUntilChanged(),
            switchMap(term => {
                this.deliveredByLoading = true;
                return this.movementService.getFuncionarios(term).pipe(finalize(() => this.deliveredByLoading = false));
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.deliveredByFuncionarios = (res || []).map((f: any) => ({ id: f.id_funcionario ?? f.id, nombre: f.nombre_completo ?? f.nombre, cargo: f.cargo ?? '', area: f.area ?? '' }));
            this.showDeliveredByDropdown = this.deliveredByFuncionarios.length > 0;
        });
    }

    onRequestedByInput(value: string): void {
        if (value.length >= 2) this._requestedBySearch$.next(value);
        else { this.requestedByFuncionarios = []; this.showRequestedByDropdown = false; }
    }

    onDeliveredByInput(value: string): void {
        if (value.length >= 2) this._deliveredBySearch$.next(value);
        else { this.deliveredByFuncionarios = []; this.showDeliveredByDropdown = false; }
    }

    selectRequestedBy(func: Funcionario): void {
        this.requestedByName = func.nombre;
        this.showRequestedByDropdown = false;
    }

    selectDeliveredBy(func: Funcionario): void {
        this.deliveredByName = func.nombre;
        this.showDeliveredByDropdown = false;
    }

    hideRequestedByDropdown(): void { setTimeout(() => this.showRequestedByDropdown = false, 150); }
    hideDeliveredByDropdown(): void { setTimeout(() => this.showDeliveredByDropdown = false, 150); }

    // Computed
    diasRemanentes(): number | null {
        const tool = this.scannedTool();
        if (!tool?.next_calibration_date) return null;
        try {
            const venc = new Date(tool.next_calibration_date);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            return Math.floor((venc.getTime() - hoy.getTime()) / 86400000);
        } catch {
            return null;
        }
    }

    isToolBlocked(): boolean {
        const tool = this.scannedTool();
        if (!tool) return false;
        const w = tool.scan_warning ?? '';
        return w.toLowerCase().includes('calibraci') && w.toLowerCase().includes('proceso');
    }

    canSubmit(): boolean {
        return !!(
            this.scannedTool() &&
            !this.isToolBlocked() &&
            this.selectedLabId &&
            this.almacen &&
            this.base &&
            this.generatedNota() &&
            this.cantidad >= 1
        );
    }

    // FIX APLICADO: Retorna los nombres cortos basados en los nuevos values
    getWorkTypeShort(): string {
        if (this.workType === 'calibration') return 'CALIB';
        if (this.workType === 'repair') return 'REPAR';
        return this.workType;
    }

    // FIX APLICADO: Busca el label original para mostrarlo en el PDF
    private getWorkTypeLabel(): string {
        const opt = this.workTypeOptions.find(o => o.value === this.workType);
        return opt ? opt.label : this.workType;
    }

    // Data loading
    loadLaboratorios(): void {
        this.calibrationService.getActiveLaboratoriesPxp().pipe(takeUntil(this._destroy$)).subscribe({
            next: (labs) => {
                if (labs && labs.length > 0) {
                    this.laboratories = labs;
                } else {
                    this.loadFallbackLaboratories();
                }
            },
            error: () => this.loadFallbackLaboratories(),
        });
    }

    private loadFallbackLaboratories(): void {
        this.calibrationService.getLaboratories().pipe(takeUntil(this._destroy$)).subscribe({
            next: (all) => this.laboratories = all as any[],
            error: () => this.showMessage('Error al cargar empresas de calibración', 'error'),
        });
    }

    // Acciones
    scanTool(): void {
        const barcode = this.barcodeValue.trim();
        if (!barcode) {
            this.showMessage('Ingrese un código de barras o código BOA', 'warning');
            return;
        }

        this.isScanning.set(true);
        this.scannedTool.set(null);
        this.generatedNota.set(null);

        this.calibrationService.scanToolForCalibration(barcode).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isScanning.set(false)),
        ).subscribe({
            next: (result) => {
                if (!result) {
                    this.showMessage('Herramienta no encontrada. Verifique el código.', 'error');
                    return;
                }
                this.scannedTool.set(result);
                if (result.scan_warning) {
                    this.showMessage(result.scan_warning, 'warning');
                }
                if (this.isToolBlocked()) {
                    this.showMessage('Esta herramienta ya está en proceso de calibración', 'error');
                }
            },
            error: () => this.showMessage('Error al buscar la herramienta', 'error'),
        });
    }

    setSearchMethod(method: 'manual' | 'scan'): void {
        this.searchMethod = method;
        this.barcodeValue = method === 'manual' ? 'BOA-H-' : '';
        setTimeout(() => {
            const input = this.searchInputRef?.nativeElement;
            if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
        }, 50);
    }

    clearScan(): void {
        this.scannedTool.set(null);
        this.barcodeValue = this.searchMethod === 'manual' ? 'BOA-H-' : '';
        this.generatedNota.set(null);
        this.selectedLabId = null;
        this.selectedLabName = '';
        this.almacen = '';
        this.base = '';
        this.sendNotes = '';
        setTimeout(() => {
            const input = this.searchInputRef?.nativeElement;
            if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
        }, 100);
    }

    onLabChange(labId: number): void {
        const lab = this.laboratories.find(l => l.id_laboratory === labId);
        this.selectedLabName = lab?.name ?? '';
    }

    generarNota(): void {
        if (!this.scannedTool()) {
            this.showMessage('Identifique una herramienta primero', 'warning');
            return;
        }
        if (this.isToolBlocked()) {
            this.showMessage('La herramienta está bloqueada, no se puede generar nota', 'error');
            return;
        }
        this.isGeneratingNota.set(true);
        this.calibrationService.getNextRecordNumber('EC').pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isGeneratingNota.set(false)),
        ).subscribe({
            next: (nota) => {
                this.generatedNota.set(nota);
                this.showMessage(`N° de Nota generado: ${nota}`, 'success');
            },
            error: () => this.showMessage('Error al generar el número de nota', 'error'),
        });
    }

    submitEnvio(): void {
        if (!this.canSubmit()) {
            this.validateAndShowError();
            return;
        }

        const tool = this.scannedTool()!;
        this.isSaving.set(true);

        const payload: any = {
            tool_id: tool.id_tool,
            work_type: this.workType, // Acá se envía el value compatible ('calibration' o 'repair')
            supplier_id: this.selectedLabId,
            supplier_name: this.selectedLabName,
            send_date: this.todayIso(),
            expected_return_date: this.addDaysIso(7),
            almacen: this.almacen,
            base: this.base,
            cantidad: this.cantidad,
            record_number: this.generatedNota(),
            notes: this.sendNotes.trim(),
            requested_by_name: this.requestedByName.trim(),
            delivered_by_name: this.deliveredByName.trim(),
        };

        this.calibrationService.sendToCalibrationPxp(payload).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false)),
        ).subscribe({
            next: (result) => {
                const nota = result?.record_number ?? this.generatedNota() ?? '';
                const id_calibration = result?.id_calibration;

                if (id_calibration) {
                    this.lastCreatedCalibrationId.set(id_calibration);
                }

                this.showMessage(`Envío registrado correctamente: ${nota}`, 'success');

                setTimeout(() => {
                    if (id_calibration) {
                        this.calibrationService.generarYVerPdfEnvio(id_calibration);
                    } else {
                        this.printNotaPreviewFallback();
                    }
                    this.dialogRef.close(true);
                }, 500);
            },
            error: (err) => {
                console.error('Error en envío:', err);
                this.showMessage(err?.message || 'Error al registrar el envío', 'error');
            },
        });
    }

    printNotaPdf(): void {
        const id = this.lastCreatedCalibrationId();
        if (!id) {
            this.showMessage('No hay un envío reciente para imprimir', 'warning');
            return;
        }
        this.isGeneratingNota.set(true);
        this.calibrationService.generarYVerPdfEnvio(id);
        setTimeout(() => this.isGeneratingNota.set(false), 1500);
    }

    printNotaPreview(): void {
        const tool = this.scannedTool();
        const nota = this.generatedNota();
        if (!tool || !nota) return;

        const today = new Date().toLocaleDateString('es-BO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });

        const html = this.generatePrintHtml(tool, nota, today);
        const w = window.open('', '_blank', 'width=900,height=750');
        if (w) { w.document.write(html); w.document.close(); }
        else { this.showMessage('No se pudo abrir la ventana de impresión', 'warning'); }
    }

    descargarNotaPdf(): void {
        const id = this.lastCreatedCalibrationId();
        if (!id) {
            this.showMessage('No hay un envío reciente para descargar', 'warning');
            return;
        }

        this.isGeneratingNota.set(true);
        this.calibrationService.generarPdfEnvioCalibracion(id).subscribe({
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
                this.isGeneratingNota.set(false);
                this.showMessage('PDF descargado correctamente', 'success');
            },
            error: (error) => {
                console.error('Error al descargar PDF:', error);
                this.isGeneratingNota.set(false);
                this.showMessage('Error al generar el PDF', 'error');
            }
        });
    }

    private printNotaPreviewFallback(): void {
        const tool = this.scannedTool();
        const nota = this.generatedNota();
        if (!tool || !nota) return;

        const today = new Date().toLocaleDateString('es-BO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });

        const html = this.generatePrintHtml(tool, nota, today);
        const w = window.open('', '_blank', 'width=900,height=750');
        if (w) { w.document.write(html); w.document.close(); }
    }

    private generatePrintHtml(tool: any, nota: string, today: string): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Nota de Envío ${nota}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#1e293b}
.header{border:3px solid #0f172a;padding:14px;margin-bottom:16px;background:#0f172a;color:#fff;display:flex;justify-content:space-between}
.title{font-size:16px;font-weight:900;text-transform:uppercase}
.nota{font-size:26px;font-weight:900;color:#f97316;font-family:monospace;margin:6px 0}
.subtitle{font-size:10px;opacity:.7;margin-top:4px}
.section{border:2px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:12px}
.section-title{font-size:10px;font-weight:900;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.field{margin-bottom:4px}
.label{font-weight:700;color:#64748b;font-size:9px;text-transform:uppercase}
.value{font-weight:900;font-size:12px}
.dates{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f8fafc;padding:10px;margin-top:10px;border-radius:6px}
.date-card{text-align:center}
.date-label{font-size:8px;font-weight:700;text-transform:uppercase;color:#94a3b8}
.date-val{font-size:12px;font-weight:900}
.footer{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:16px;padding-top:14px;border-top:2px solid #e2e8f0}
.sign-line{border-top:1px solid #94a3b8;margin-top:30px;padding-top:5px;text-align:center;font-size:9px}
.meta{margin-top:12px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between}
@media print{body{padding:0}}
</style></head><body>
<div class="header">
    <div><div class="title">NOTA DE ENVÍO A CALIBRACIÓN</div><div class="nota">${nota}</div><div class="subtitle">Sistema de Gestión Técnica · BOA</div></div>
    <div style="text-align:right"><div>${today}</div><div style="font-size:14px;font-weight:900;margin-top:4px">${tool.code}</div></div>
</div>
<div class="section">
    <div class="section-title">Datos de la Herramienta</div>
    <div class="grid">
        <div><div class="label">Código BOA</div><div class="value">${tool.code}</div></div>
        <div><div class="label">N° Serie</div><div class="value">${tool.serial_number || '—'}</div></div>
        <div style="grid-column:1/-1"><div class="label">Nombre</div><div class="value">${tool.name}</div></div>
    </div>
    <div style="text-align:center;margin-top:10px;background:#f8fafc;padding:8px;border-radius:4px">${generateCode128Svg(tool.code, 40, 2)}</div>
</div>
<div class="section">
    <div class="section-title">Datos del Envío</div>
    <div class="grid">
        <div><div class="label">Empresa</div><div class="value">${this.selectedLabName}</div></div>
        <div><div class="label">Tipo trabajo</div><div class="value">${this.getWorkTypeLabel()}</div></div>
        <div><div class="label">Almacén</div><div class="value">${this.almacen}</div></div>
        <div><div class="label">Base origen</div><div class="value">${this.base}</div></div>
        <div><div class="label">Cantidad</div><div class="value">${this.cantidad}</div></div>
    </div>
    <div class="dates">
        <div class="date-card"><div class="date-label">Envío</div><div class="date-val">${this.fechaEnvioDisplay}</div></div>
        <div class="date-card"><div class="date-label">Retorno Est.</div><div class="date-val">${this.fechaRetornoDisplay}</div></div>
        <div class="date-card"><div class="date-label">Próx. Cal.</div><div class="date-val">${this.fechaProxCalDisplay}</div></div>
    </div>
</div>
<div class="footer">
    <div><div class="sign-line">Técnico emisor</div></div>
    <div><div class="sign-line">Jefe de almacén</div></div>
    <div><div class="sign-line">Recibido por empresa</div></div>
</div>
<div class="meta"><span>BOA — MGH-109 · ${nota}</span><span>${today}</span></div>
<script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
</body></html>`;
    }

    // Validación
    private validateAndShowError(): void {
        if (!this.scannedTool()) this.showMessage('Identifique una herramienta', 'error');
        else if (this.isToolBlocked()) this.showMessage('Herramienta bloqueada', 'error');
        else if (!this.selectedLabId) this.showMessage('Seleccione una empresa', 'error');
        else if (!this.almacen) this.showMessage('Seleccione un almacén', 'error');
        else if (!this.base) this.showMessage('Seleccione una base', 'error');
        else if (!this.generatedNota()) this.showMessage('Genere una nota', 'warning');
        else if (this.cantidad < 1) this.showMessage('Cantidad mínima 1', 'error');
    }

    // Helpers de fecha
    private todayIso(): string { return new Date().toISOString().split('T')[0]; }
    private addDaysIso(n: number): string { return this.addDays(new Date(), n).toISOString().split('T')[0]; }
    private addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
    private addYear(d: Date): Date { const r = new Date(d); r.setFullYear(r.getFullYear() + 1); return r; }
    private formatDate(d: Date): string { return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', { duration: type === 'error' ? 5000 : 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
