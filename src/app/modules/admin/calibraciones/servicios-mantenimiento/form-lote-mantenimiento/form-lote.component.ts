import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, lastValueFrom, of } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap, map, catchError } from 'rxjs/operators';
import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MaintenanceService } from '../../../../../core/services/maintenance.service';
import { MovementService } from '../../../../../core/services/movement.service';
import { localDateStr } from '../../../../../core/utils/date.utils';

interface Funcionario { id: number; nombre: string; cargo: string; }

interface Proveedor {
    id_laboratory: number;
    name: string;
    contact_person?: string;
}

interface MaintToolItem {
    toolId:               number;
    toolCode:             string;
    toolName:             string;
    toolSerial:           string;
    toolPn:               string;
    toolBrand:            string;
    toolStatus:           string;
    toolCalibration:      string;
    maintenanceType:      'preventive' | 'corrective';
    preventiveSubtype:    'semiannual' | 'annual';
    expectedReturnDate:   string;
    notes:                string;
    discrepancyReportNum: string;
    status:               'pending' | 'sending' | 'done' | 'error';
    error?:               string;
    recordNumber?:        string;
    idMaintenance?:       number;
}

@Component({
    selector: 'app-form-lote-mantenimiento',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatIconModule, MatSnackBarModule,
    ],
    templateUrl: './form-lote.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class FormLoteMantenimientoComponent implements OnInit, OnDestroy {

    private calibrationService = inject(CalibrationService);
    private maintenanceService = inject(MaintenanceService);
    public  dialogRef  = inject(MatDialogRef<FormLoteMantenimientoComponent>);
    private snackBar   = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private cdr        = inject(ChangeDetectorRef);
    private _destroy$  = new Subject<void>();
    private _toolSearch$ = new Subject<string>();
    private _requestedBySearch$ = new Subject<string>();

    @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

    isProcessing = signal(false);
    isScanning   = signal(false);
    processedCount = 0;

    providers: Proveedor[] = [];

    // Campos compartidos
    selectedProviderId:   number | null = null;
    selectedProviderName  = '';
    sendDateStr           = this._today();

    // Funcionario solicitado por
    requestedByName = '';
    requestedByFuncionarios: Funcionario[] = [];
    requestedByLoading = false;
    showRequestedByDropdown = false;

    // Buscador
    barcodeValue      = 'BOA-H-';
    toolSuggestions:  any[] = [];
    showToolDropdown  = false;
    toolSearchLoading = false;

    // Lista de herramientas con config individual
    items: MaintToolItem[] = [];

    readonly serviceTypeOptions = [
        { value: 'preventive', label: 'PREVENTIVO' },
        { value: 'corrective', label: 'CORRECTIVO' },
    ];

    readonly subtypeOptions = [
        { value: 'semiannual', label: '6 MESES' },
        { value: 'annual',     label: '12 MESES' },
    ];

    ngOnInit(): void {
        this.requestedByName = this._currentUser();
        this.loadProviders();
        this._setupToolSearch();
        this._setupRequestedBySearch();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    loadProviders(): void {
        this.calibrationService.getActiveLaboratoriesPxp().pipe(
            takeUntil(this._destroy$)
        ).subscribe({
            next: (labs) => this.providers = labs,
            error: () => this.showMsg('Error al cargar empresas', 'error')
        });
    }

    onProviderChange(id: number): void {
        const p = this.providers.find(p => +p.id_laboratory === +id);
        this.selectedProviderName = p?.name ?? '';
    }

    // ── Búsqueda de herramienta ────────────────────────────
    private _setupToolSearch(): void {
        this._toolSearch$.pipe(
            debounceTime(350), distinctUntilChanged(),
            switchMap(term => {
                if (term.length < 2) { this.showToolDropdown = false; return of([]); }
                this.toolSearchLoading = true;
                return this.calibrationService.searchToolsAutocomplete(term).pipe(
                    finalize(() => this.toolSearchLoading = false)
                );
            }),
            takeUntil(this._destroy$)
        ).subscribe(r => {
            this.toolSuggestions = r || [];
            this.showToolDropdown = this.toolSuggestions.length > 0;
        });
    }

    onToolInput(v: string): void { this._toolSearch$.next(v.trim()); }
    hideToolDropdown(): void { setTimeout(() => this.showToolDropdown = false, 180); }

    // ── Funcionario solicitado por ─────────────────────────
    private _setupRequestedBySearch(): void {
        this._requestedBySearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showRequestedByDropdown = false; return of([]); }
                this.requestedByLoading = true;
                const q = t.toLowerCase();
                return this.movementService.getPersonal().pipe(
                    map(lista => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map((f: any) => ({ id: f.id_employee || f.id, nombre: f.nombreCompleto || f.nombre, cargo: f.cargo || '' }))
                    ),
                    finalize(() => this.requestedByLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.requestedByFuncionarios = res || [];
            this.showRequestedByDropdown = this.requestedByFuncionarios.length > 0;
        });
    }

    onRequestedByInput(v: string): void {
        this.requestedByName = v;
        if (v.length >= 2) this._requestedBySearch$.next(v);
        else this.showRequestedByDropdown = false;
    }

    selectRequestedBy(f: Funcionario): void {
        this.requestedByName = f.nombre;
        this.showRequestedByDropdown = false;
    }

    hideRequestedByDropdown(): void { setTimeout(() => this.showRequestedByDropdown = false, 200); }

    selectToolSuggestion(tool: any): void {
        this.barcodeValue = tool.code ?? tool.tool_code;
        this.showToolDropdown = false;
        this.toolSuggestions = [];
        this.scanAndAdd();
    }

    scanAndAdd(): void {
        const barcode = this.barcodeValue.trim();
        if (!barcode) return;
        if (this.items.some(i => i.toolCode === barcode)) {
            this.showMsg('La herramienta ya está en el lote', 'warning');
            return;
        }
        this.isScanning.set(true);
        this.calibrationService.scanToolForCalibration(barcode).pipe(
            finalize(() => this.isScanning.set(false))
        ).subscribe({
            next: (result) => {
                if (!result) { this.showMsg('Herramienta no encontrada', 'error'); return; }
                if (this.items.some(i => i.toolId === result.id_tool)) {
                    this.showMsg('La herramienta ya está en el lote', 'warning');
                    return;
                }
                const last = this.items[this.items.length - 1];
                const r: any = result;
                const newItem: MaintToolItem = {
                    toolId:               result.id_tool,
                    toolCode:             result.code,
                    toolName:             result.name,
                    toolSerial:           result.serial_number ?? r.sn ?? '',
                    toolPn:               r.part_number ?? r.pn ?? '',
                    toolBrand:            r.brand ?? r.marca ?? '',
                    toolStatus:           String(r.status ?? r.tool_status ?? '').toUpperCase(),
                    toolCalibration:      r.next_calibration_date ?? r.calibration_due_date ?? '',
                    maintenanceType:      last?.maintenanceType   ?? 'preventive',
                    preventiveSubtype:    last?.preventiveSubtype ?? 'semiannual',
                    expectedReturnDate:   last?.expectedReturnDate ?? this._calcReturn('preventive', 'semiannual'),
                    notes:                '',
                    discrepancyReportNum: '',
                    status:               'pending',
                };
                this.items = [...this.items, newItem];
                this.barcodeValue = 'BOA-H-';
                this.showToolDropdown = false;
                this.cdr.detectChanges();
                this.scanInputRef?.nativeElement.focus();
            },
            error: () => this.showMsg('Error al buscar la herramienta', 'error')
        });
    }

    removeTool(index: number): void {
        if (!this.isProcessing()) this.items = this.items.filter((_, i) => i !== index);
    }

    onItemTypeChange(item: MaintToolItem): void {
        if (item.maintenanceType !== 'corrective') item.discrepancyReportNum = '';
        item.expectedReturnDate = this._calcReturn(item.maintenanceType, item.preventiveSubtype);
    }

    onItemSubtypeChange(item: MaintToolItem): void {
        item.expectedReturnDate = this._calcReturn(item.maintenanceType, item.preventiveSubtype);
    }

    canSubmit(): boolean {
        if (!this.selectedProviderId || !this.sendDateStr) return false;
        return this.items.some(i => i.status !== 'done');
    }

    getDoneCount():  number { return this.items.filter(i => i.status === 'done').length; }
    getErrorCount(): number { return this.items.filter(i => i.status === 'error').length; }

    async submitLote(): Promise<void> {
        if (!this.canSubmit() || this.isProcessing()) return;
        // Reservar la pestaña de la nota dentro del gesto (el PDF llega tras el envío).
        const winNota = this.maintenanceService.preAbrirVentanaPdf();
        this.isProcessing.set(true);
        this.processedCount = 0;

        for (const item of this.items) {
            if (item.status === 'done') continue;
            item.status = 'sending';
            this.cdr.detectChanges();

            const params = {
                tool_id:              item.toolId,
                type:                 item.maintenanceType,
                preventive_subtype:   item.maintenanceType === 'preventive' ? item.preventiveSubtype : undefined,
                send_date:            this.sendDateStr,
                expected_return_date: item.expectedReturnDate,
                provider:             this.selectedProviderName,
                discrepancy_report_num: item.maintenanceType === 'corrective' ? item.discrepancyReportNum : '',
                notes:                item.notes,
                requested_by_name:    this.requestedByName.trim() || this._currentUser(),
            };

            try {
                const result = await lastValueFrom(
                    this.maintenanceService.sendMaintenancePxp(params)
                );
                item.status        = 'done';
                item.recordNumber  = result?.record_number ?? '—';
                item.idMaintenance = Number(result?.id_maintenance) || undefined;
            } catch (e: any) {
                item.status = 'error';
                item.error  = e?.message || 'Error de conexión';
            }
            this.processedCount++;
            this.cdr.detectChanges();
        }

        this.isProcessing.set(false);
        this.cdr.detectChanges();

        if (this.items.every(i => i.status === 'done')) {
            this._abrirNotaLote(winNota);
            this.showMsg(`${this.items.length} herramienta(s) enviada(s) a mantenimiento`, 'success');
            setTimeout(() => this.dialogRef.close(true), 1800);
        } else {
            try { winNota?.close(); } catch { /* noop */ }
            if (this.getErrorCount() > 0) {
                this.showMsg(`${this.getErrorCount()} error(es) — revise y reintente`, 'error');
            }
        }
    }

    abrirNotaLoteManual(): void {
        this._abrirNotaLote(this.maintenanceService.preAbrirVentanaPdf());
    }

    /** Cierre con confirmación si hay herramientas cargadas en el lote. */
    cerrar(): void {
        const pend = this.items.filter(i => i.status !== 'done').length;
        if (pend > 0 &&
            !confirm(`¿Cancelar el lote? Se perderán las ${pend} herramienta(s) sin enviar.`)) return;
        this.dialogRef.close(false);
    }

    /**
     * Nota de envío del lote: PDF real vía backend (RReporteMantenimientoLote),
     * una fila por herramienta enviada. Reemplazó a la nota HTML client-side.
     */
    private _abrirNotaLote(ventana?: Window | null): void {
        const ids = this.items
            .filter(i => i.status === 'done' && i.idMaintenance)
            .map(i => i.idMaintenance as number);
        if (ids.length === 0) {
            try { ventana?.close(); } catch { /* noop */ }
            this.showMsg('No hay herramientas enviadas para generar la nota', 'warning');
            return;
        }

        this.maintenanceService.generarPdfEnvioMantenimientoLote(ids).pipe(
            takeUntil(this._destroy$),
        ).subscribe({
            next: (r) => this.maintenanceService.abrirNota(r, ventana),
            error: (e) => { try { ventana?.close(); } catch { /* noop */ } this.showMsg(e?.message || 'Error al generar la nota del lote', 'error'); },
        });
    }

    fmtDate(d: string | null | undefined): string {
        if (!d) return '—';
        const p = d.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
    }

    private _calcReturn(type: 'preventive' | 'corrective', subtype: 'semiannual' | 'annual'): string {
        const base = new Date(this.sendDateStr ? this.sendDateStr + 'T00:00:00' : Date.now());
        if (type === 'preventive') {
            subtype === 'annual'
                ? base.setFullYear(base.getFullYear() + 1)
                : base.setMonth(base.getMonth() + 6);
        } else {
            base.setDate(base.getDate() + 7);
        }
        return localDateStr(base);
    }

    private _today(): string { return localDateStr(); }

    private _currentUser(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || 'BOA';
        } catch { return 'BOA'; }
    }

    private showMsg(msg: string, type: 'success' | 'error' | 'warning'): void {
        this.snackBar.open(msg, 'Cerrar', {
            duration: 4000, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
