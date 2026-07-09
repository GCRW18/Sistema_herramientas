import { Component, OnInit, OnDestroy, inject, signal, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap, startWith } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

interface ToolSuggestion { tool_id: number; tool_code: string; tool_name: string; is_calibratable?: boolean; }
interface TranscriptionRecord { id: string | number; tool_id: string | number; fecha: string; codigo: string; nombre: string; certificado: string; resultado: string; laboratorio: string; }

@Component({
    selector: 'app-transcripcion-manual',
    standalone: true,
    imports: [
        CommonModule, FormsModule, ReactiveFormsModule,
        MatDialogModule, MatButtonModule, MatIconModule,
        MatTableModule, MatProgressSpinnerModule,
        MatSnackBarModule, MatTooltipModule, DragDropModule
    ],
    templateUrl: './transcripcion-manual.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 0; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0); }
        :host-context(.dark) input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
    `]
})
export class TranscripcionManualComponent implements OnInit, OnDestroy {

    private calibrationService = inject(CalibrationService);
    private dialog             = inject(MatDialog);
    private snackBar           = inject(MatSnackBar);

    private _destroy$      = new Subject<void>();
    private _toolSearch$   = new Subject<string>();

    @ViewChild('formDialogTemplate') formDialogTemplate!: TemplateRef<any>;
    private activeDialogRef: MatDialogRef<any> | null = null;

    // ── Estado de la Tabla y Filtros ──────────────────────────────────────────
    searchControl = new FormControl('');
    transcriptions: TranscriptionRecord[] = [];
    filteredTranscriptions: TranscriptionRecord[] = [];

    isLoading = false;
    pageSize  = 10;
    pageIndex = 0;

    get totalRecords(): number { return this.filteredTranscriptions.length; }
    get totalPages():   number { return Math.ceil(this.totalRecords / this.pageSize) || 1; }
    get startIndex():   number { return this.totalRecords === 0 ? 0 : this.pageIndex * this.pageSize + 1; }
    get endIndex():     number { return Math.min((this.pageIndex + 1) * this.pageSize, this.totalRecords); }
    get paginatedTranscriptions(): TranscriptionRecord[] {
        const s = this.pageIndex * this.pageSize;
        return this.filteredTranscriptions.slice(s, s + this.pageSize);
    }
    nextPage(): void { if (this.pageIndex < this.totalPages - 1) this.pageIndex++; }
    prevPage(): void { if (this.pageIndex > 0) this.pageIndex--; }

    // ── Estado del Modal Formulario ───────────────────────────────────────────
    isProcessing  = signal(false);
    showConfirm   = signal(false);
    laboratories: any[] = [];

    selectedTool: ToolSuggestion | null = null;
    toolSearch  = 'BOA-H-';
    toolSuggestions: ToolSuggestion[] = [];
    showToolDropdown  = false;
    toolSearchLoading = false;

    certificateNumber    = '';
    calibrationDateStr   = '';
    nextCalibrationDate  = '';
    labId: number | null = null;
    labNameOverride      = '';
    result: 'approved' | 'conditional' | 'rejected' = 'approved';
    selectedFile: File | null = null;

    showCertError    = signal(false);
    showDateError    = signal(false);
    showToolError    = signal(false);

    readonly todayStr = new Date().toISOString().split('T')[0];

    ngOnInit(): void {
        this.loadTranscriptions();
        this.loadLaboratorios();
        this.setupToolSearch();
        this.setupFilters();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    // ── Métodos de Tabla y Filtros ────────────────────────────────────────────
    loadTranscriptions(): void {
        this.isLoading = true;
        // Transcripciones históricas = flag is_historical o cualquiera de los dos
        // marcadores de internal_notes (form manual y baseline DAT-10/MGH-102).
        // El filtro anterior (igualdad exacta con el marcador acentuado) dejaba
        // fuera las 487 transcripciones del baseline.
        this.calibrationService.getCalibrations({
            limit: 1000,
            sort: 'id_calibration', dir: 'desc',
            filtro: "(COALESCE(cls.is_historical, false) = true"
                + " OR cls.internal_notes LIKE '[TRANSCRIPCION HISTORICA%'"
                + " OR cls.internal_notes LIKE '[TRANSCRIPCIÓN HISTÓRICA%')"
                + " and cls.estado_reg = 'activo'",
        }).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (records: any[]) => {
                this.transcriptions = records.map(r => ({
                    id: r.id_calibration ?? r.id ?? 0,
                    tool_id: r.tool_id ?? r.id_tool ?? 0,
                    fecha: r.calibration_date ?? r.date ?? '—',
                    codigo: r.tool_code ?? r.code ?? '—',
                    nombre: r.tool_name ?? r.name ?? '—',
                    certificado: r.certificate_number ?? r.record_number ?? '—',
                    resultado: r.result ?? r.status ?? '—',
                    laboratorio: r.supplier_name ?? r.laboratory_name ?? '—'
                }));
                this.applyFilters();
            },
            error: (err) => {
                console.error('Error cargando transcripciones:', err);
                this.showMessage('Error al cargar el historial.', 'error');
            }
        });
    }

    setupFilters(): void {
        this.searchControl.valueChanges.pipe(
            startWith(''),
            debounceTime(300),
            takeUntil(this._destroy$)
        ).subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        this.pageIndex = 0;
        let list = [...this.transcriptions];
        const q = this.searchControl.value?.toLowerCase().trim() ?? '';

        if (q) {
            list = list.filter(t =>
                t.codigo.toLowerCase().includes(q) ||
                t.nombre.toLowerCase().includes(q) ||
                t.certificado.toLowerCase().includes(q) ||
                t.laboratorio.toLowerCase().includes(q)
            );
        }

        this.filteredTranscriptions = list;
    }

    getResultLabel(estado: string): string {
        switch (estado.toLowerCase()) {
            case 'approved':    return 'APROBADO';
            case 'conditional': return 'CONDICIONAL';
            case 'rejected':    return 'RECHAZADO';
            case 'sent':        return 'ENVIADO';
            case 'returned':    return 'RETORNADO';
            case 'in_process':  return 'EN PROCESO';
            default:            return estado.toUpperCase();
        }
    }

    getResultClass(estado: string): string {
        switch (estado.toLowerCase()) {
            case 'approved':
            case 'aprobado':    return 'bg-green-600 text-white border-black';
            case 'conditional':
            case 'condicional': return 'bg-amber-500 text-white border-black';
            case 'sent':
            case 'enviado':     return 'bg-blue-700 text-white border-black';
            case 'rejected':
            case 'rechazado':
            case 'cancelled':
            case 'cancelado':   return 'bg-red-600 text-white border-black';
            default:            return 'bg-gray-500 text-white border-black';
        }
    }


    // ── Control del Modal ─────────────────────────────────────────────────────
    openFormDialog(): void {
        this.resetForm();
        this.activeDialogRef = this.dialog.open(this.formDialogTemplate, {
            width: '660px',
            maxWidth: '95vw',
            height: '88vh',
            panelClass: 'no-padding-dialog',
            hasBackdrop: true,
            disableClose: true,
            autoFocus: false
        });
    }

    closeDialog(): void {
        if (this.activeDialogRef) {
            this.activeDialogRef.close();
            this.activeDialogRef = null;
        }
    }

    resetForm(): void {
        this.selectedTool = null;
        this.toolSearch = 'BOA-H-';
        this.certificateNumber = '';
        this.calibrationDateStr = '';
        this.nextCalibrationDate = '';
        this.labId = null;
        this.labNameOverride = '';
        this.result = 'approved';
        this.selectedFile = null;
        this.showConfirm.set(false);
        this.isProcessing.set(false);
        this.showToolError.set(false);
        this.showCertError.set(false);
        this.showDateError.set(false);
    }

    // ── Lógica del Formulario ─────────────────────────────────────────────────
    loadLaboratorios(): void {
        this.calibrationService.getLaboratories().pipe(takeUntil(this._destroy$)).subscribe({
            next: (labs: any[]) => {
                this.laboratories = labs.map(l => ({ id_laboratory: l.id_laboratory || l.id || 0, name: l.laboratory_name || l.name || '—' }));
            },
            error: () => {}
        });
    }

    onLabChange(): void { if (this.labId) this.labNameOverride = ''; }

    selectedLabName(): string {
        if (this.labNameOverride) return this.labNameOverride;
        if (this.labId) {
            const l = this.laboratories.find(x => x.id_laboratory === this.labId);
            return l ? l.name : '';
        }
        return '';
    }

    private setupToolSearch(): void {
        this._toolSearch$.pipe(
            debounceTime(350), distinctUntilChanged(),
            switchMap(term => {
                this.toolSearchLoading = true;
                return this.calibrationService.searchToolsAutocomplete(term).pipe(finalize(() => this.toolSearchLoading = false));
            }),
            takeUntil(this._destroy$)
        ).subscribe(results => {
            this.toolSuggestions = results.map((r: any) => ({
                tool_id: r.id_tool ?? r.tool_id ?? r.id, tool_code: r.tool_code ?? r.code, tool_name: r.tool_name ?? r.name
            }));
            this.showToolDropdown = this.toolSuggestions.length > 0;
        });
    }

    onToolInput(value: string): void {
        this.selectedTool = null;
        this.showToolError.set(false);
        if (value.length >= 2) this._toolSearch$.next(value);
        else { this.toolSuggestions = []; this.showToolDropdown = false; }
    }

    selectTool(tool: ToolSuggestion): void {
        this.selectedTool = tool;
        this.toolSearch = `${tool.tool_code} - ${tool.tool_name}`;
        this.showToolDropdown = false;
        this.toolSuggestions = [];
    }

    hideToolDropdown(): void { setTimeout(() => this.showToolDropdown = false, 200); }

    clearTool(): void {
        this.selectedTool = null;
        this.toolSearch = 'BOA-H-';
        this.showToolDropdown = false;
    }

    isFechaFutura(): boolean {
        if (!this.calibrationDateStr) return false;
        return new Date(this.calibrationDateStr + 'T00:00:00') > new Date();
    }

    autoCalcNextDate(): void {
        if (!this.calibrationDateStr) { this.nextCalibrationDate = ''; return; }
        try {
            const d = new Date(this.calibrationDateStr + 'T00:00:00');
            d.setFullYear(d.getFullYear() + 1);
            this.nextCalibrationDate = d.toISOString().split('T')[0];
        } catch { this.nextCalibrationDate = ''; }
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;
        const file = input.files[0];
        if (file.type !== 'application/pdf') { this.showMessage('Solo se permiten archivos PDF.', 'warning'); return; }
        this.selectedFile = file;
        input.value = '';
    }

    removeFile(): void { this.selectedFile = null; }

    // Validación unificada para habilitar el botón superior
    canSubmit(): boolean {
        return !!(this.selectedTool && this.certificateNumber.trim() && this.calibrationDateStr && !this.isFechaFutura() && !this.isProcessing());
    }

    save(): void {
        this.showToolError.set(!this.selectedTool);
        this.showCertError.set(!this.certificateNumber.trim());
        this.showDateError.set(!this.calibrationDateStr || this.isFechaFutura());

        if (!this.canSubmit()) {
            this.showMessage('Complete los campos obligatorios (*).', 'warning');
            return;
        }
        this.showConfirm.set(true);
    }

    confirmSave(): void {
        this.isProcessing.set(true);

        const params: any = {
            tool_id: this.selectedTool!.tool_id,
            certificate_number: this.certificateNumber.trim(),
            calibration_date: this.calibrationDateStr,
            next_calibration_date: this.nextCalibrationDate || undefined,
            result: this.result,
            is_historical: true,
        };

        if (this.labId) {
            params.supplier_id = this.labId;
            const lab = this.laboratories.find(x => x.id_laboratory === this.labId);
            if (lab) params.supplier_name = lab.name;
        }
        if (this.labNameOverride) params.supplier_name = this.labNameOverride.trim();

        this.calibrationService.createHistoricalCalibration(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isProcessing.set(false))
        ).subscribe({
            next: (res: any) => {
                this.showMessage('Transcripción registrada exitosamente.', 'success');
                this.closeDialog();
                this.loadTranscriptions();
            },
            error: () => {
                this.showMessage('Error al registrar la transcripción.', 'error');
                this.showConfirm.set(false);
            }
        });
    }

    cancelConfirm(): void { this.showConfirm.set(false); }

    // ── Historial de Herramienta (miniventana) ────────────────────────────────
    async openHistorial(record: TranscriptionRecord): Promise<void> {
        const { HistorialHerramientaComponent } = await import('../historial-herramienta/historial-herramienta.component');
        this.dialog.open(HistorialHerramientaComponent, {
            width: '640px', maxWidth: '95vw', maxHeight: '85vh',
            panelClass: 'no-padding-dialog',
            autoFocus: false,
            data: { toolId: String(record.tool_id), code: record.codigo, name: record.nombre },
        });
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
