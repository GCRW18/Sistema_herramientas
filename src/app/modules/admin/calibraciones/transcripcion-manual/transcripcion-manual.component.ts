import { Component, OnInit, OnDestroy, inject, signal, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap, startWith } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

interface ToolSuggestion { tool_id: number; tool_code: string; tool_name: string; is_calibratable?: boolean; }
interface TranscriptionRecord { id: string | number; fecha: string; codigo: string; nombre: string; certificado: string; resultado: string; laboratorio: string; }

@Component({
    selector: 'app-transcripcion-manual',
    standalone: true,
    imports: [
        CommonModule, FormsModule, ReactiveFormsModule,
        MatDialogModule, MatButtonModule, MatIconModule,
        MatTableModule, MatPaginatorModule, MatProgressSpinnerModule,
        MatSnackBarModule, MatTooltipModule, DragDropModule
    ],
    templateUrl: './transcripcion-manual.component.html'
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
    totalRecords = 0;
    pageSize = 10;
    pageIndex = 0;

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
        this.calibrationService.getCalibrations({ limit: 200, filtro: "cls.internal_notes = '[TRANSCRIPCIÓN HISTÓRICA]' and cls.estado_reg = 'activo'" }).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (records: any[]) => {
                this.transcriptions = records.map(r => ({
                    id: r.id_calibration ?? r.id ?? 0,
                    fecha: r.calibration_date ?? r.date ?? '—',
                    codigo: r.tool_code ?? r.code ?? '—',
                    nombre: r.tool_name ?? r.name ?? '—',
                    certificado: r.certificate_number ?? r.record_number ?? '—',
                    resultado: r.result ?? r.status ?? '—',
                    laboratorio: r.supplier_name ?? r.laboratory_name ?? '—'
                }));
                this.totalRecords = this.transcriptions.length;
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

        const startIndex = this.pageIndex * this.pageSize;
        this.filteredTranscriptions = list.slice(startIndex, startIndex + this.pageSize);
        this.totalRecords = list.length;
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.applyFilters();
    }

    getResultClass(estado: string): string {
        switch (estado.toLowerCase()) {
            case 'approved':
            case 'aprobado': return 'bg-green-100 text-green-800 border-green-400';
            case 'conditional':
            case 'condicional':  return 'bg-yellow-100 text-yellow-800 border-yellow-400';
            case 'rejected':
            case 'rechazado':  return 'bg-red-100 text-red-800 border-red-400';
            default: return 'bg-gray-100 text-gray-800 border-gray-400';
        }
    }

    // ── Control del Modal ─────────────────────────────────────────────────────
    openFormDialog(): void {
        this.resetForm();
        this.activeDialogRef = this.dialog.open(this.formDialogTemplate, {
            width: '850px', // Ajustado al tamaño de tu nuevo diseño base
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '95vh',
            panelClass: 'neo-dialog-transparent',
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

    private showMessage(message: string, type: 'success' | 'error' | 'warning'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
