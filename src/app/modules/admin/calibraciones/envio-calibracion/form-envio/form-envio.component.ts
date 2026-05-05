import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule }                                                              from '@angular/common';
import { FormsModule }                                                               from '@angular/forms';
import { MatDialogModule, MatDialogRef }                                             from '@angular/material/dialog';
import { MatButtonModule }                                                           from '@angular/material/button';
import { MatIconModule }                                                             from '@angular/material/icon';
import { MatProgressSpinnerModule }                                                  from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule }                                            from '@angular/material/snack-bar';
import { MatTooltipModule }                                                          from '@angular/material/tooltip';
import { Subject, lastValueFrom, of }                                                from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap }        from 'rxjs/operators';

// Servicios del Core
import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MovementService }    from '../../../../../core/services/movement.service';
import { ScanToolResult }     from '../../../../../core/models';

interface Funcionario { id: number; nombre: string; cargo: string; area?: string; }
interface Warehouse   { id: number; name: string; code: string; }
interface BaseOpt     { id: number; name: string; code: string; }

interface MultiToolItem {
    tool:            ScanToolResult & { location?: string; shelf?: string; nivel?: string; tool_code?: string; tool_name?: string };
    status:          'pending' | 'sending' | 'done' | 'error';
    nota?:           string;
    error?:          string;
    images?:         string[] | null;
    imagesLoaded?:   boolean;
    id_calibration?: number;
}

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
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class FormEnvioComponent implements OnInit, OnDestroy {

    private calibrationService = inject(CalibrationService);
    private movementService    = inject(MovementService);
    public  dialogRef          = inject(MatDialogRef<FormEnvioComponent>);
    private snackBar           = inject(MatSnackBar);
    private cdr                = inject(ChangeDetectorRef);

    private _destroy$          = new Subject<void>();
    private _toolSearch$       = new Subject<string>();
    private _reqSearch$        = new Subject<string>();
    private _delSearch$        = new Subject<string>();

    @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

    // Configuración
    laboratories:    any[]         = [];
    selectedLabId:   number | null = null;
    selectedLabName  = '';
    almacen          = '';
    base             = '';
    baseId: number | null = null;
    workType         = 'calibration';
    repairDescription = '';
    sendNotes        = '';

    warehouses: Warehouse[] = [];
    bases:      BaseOpt[]   = [];

    viewingPhoto      = signal<{ code: string; name: string; url: string } | null>(null);
    photoLoadingIndex = signal<number | null>(null);

    workTypeOptions = [
        { value: 'calibration',        label: 'CALIBRACIÓN' },
        { value: 'repair',             label: 'REPARACIÓN'  },
        { value: 'calibration_repair', label: 'CAL/REP'     },
    ];

    requestedByName            = '';
    deliveredByName            = '';
    requestedByFuncionarios:  Funcionario[] = [];
    deliveredByFuncionarios:  Funcionario[] = [];
    requestedByLoading         = false;
    deliveredByLoading         = false;
    showRequestedByDropdown    = false;
    showDeliveredByDropdown    = false;

    barcodeValue   = 'BOA-H-';
    isScanning     = signal(false);
    toolSuggestions: any[]  = [];
    showToolDropdown         = false;
    toolSearchLoading        = false;

    toolList: MultiToolItem[] = [];

    isProcessing   = signal(false);
    processedCount = 0;

    readonly fechaEnvioDisplay   = this._fmt(new Date());
    readonly fechaRetornoDisplay = this._fmt(this._addDays(new Date(), 7));

    ngOnInit(): void {
        this.loadLaboratorios();
        this.loadWarehouses();
        this.loadBases();
        this._setupToolSearch();
        this._setupFuncionarioSearch();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    loadLaboratorios(): void {
        this.calibrationService.getActiveLaboratoriesPxp().pipe(takeUntil(this._destroy$)).subscribe({
            next: (labs) => {
                this.laboratories = (labs || []).filter((l: any) => l.estado_reg !== 'inactivo');
            },
            error: () => this.showMsg('Error al cargar laboratorios', 'error'),
        });
    }

    loadWarehouses(): void {
        this.movementService.getWarehouses().pipe(takeUntil(this._destroy$)).subscribe({
            next: (rows: any[]) => {
                this.warehouses = (rows || []).map(w => ({
                    id: w.id_warehouse || w.id,
                    name: w.nombre || w.name,
                    code: w.codigo || w.code || 'ALM'
                }));
            },
            error: () => this.showMsg('Error al cargar almacenes', 'error')
        });
    }

    loadBases(): void {
        this.movementService.getBases().pipe(takeUntil(this._destroy$)).subscribe({
            next: (rows: any[]) => {
                this.bases = (rows || []).map(b => ({
                    id: b.id_base || b.id,
                    name: b.nombre || b.codigo,
                    code: b.codigo || 'BASE'
                }));
            },
            error: () => this.showMsg('Error al cargar bases', 'error')
        });
    }

    onLabChange(labId: number): void {
        const lab = this.laboratories.find(l => l.id_laboratory === labId);
        this.selectedLabName = lab?.name ?? '';
    }

    onBaseChange(code: string): void {
        const found = this.bases.find(b => b.code === code);
        this.baseId = found?.id ?? null;
    }

    private _setupToolSearch(): void {
        this._toolSearch$.pipe(
            debounceTime(350),
            distinctUntilChanged(),
            switchMap(term => {
                if (term.length < 2) {
                    this.showToolDropdown = false;
                    return of([]);
                }
                this.toolSearchLoading = true;
                return this.calibrationService.searchToolsAutocomplete(term).pipe(
                    finalize(() => this.toolSearchLoading = false)
                );
            }),
            takeUntil(this._destroy$)
        ).subscribe(results => {
            this.toolSuggestions = results || [];
            this.showToolDropdown = this.toolSuggestions.length > 0;
        });
    }

    private _setupFuncionarioSearch(): void {
        this._reqSearch$.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            switchMap(t => {
                this.requestedByLoading = true;
                return this.movementService.getFuncionarios(t).pipe(finalize(() => this.requestedByLoading = false));
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.requestedByFuncionarios = (res || []).map((f: any) => ({
                id: f.id_funcionario || f.id,
                nombre: f.nombre_completo || f.nombre,
                cargo: f.cargo || '',
                area: f.area || ''
            }));
            this.showRequestedByDropdown = this.requestedByFuncionarios.length > 0;
        });

        this._delSearch$.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            switchMap(t => {
                this.deliveredByLoading = true;
                return this.movementService.getFuncionarios(t).pipe(finalize(() => this.deliveredByLoading = false));
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.deliveredByFuncionarios = (res || []).map((f: any) => ({
                id: f.id_funcionario || f.id,
                nombre: f.nombre_completo || f.nombre,
                cargo: f.cargo || '',
                area: f.area || ''
            }));
            this.showDeliveredByDropdown = this.deliveredByFuncionarios.length > 0;
        });
    }

    onToolInput(value: string): void { this._toolSearch$.next(value.trim()); }

    selectToolSuggestion(tool: any): void {
        this.barcodeValue = tool.code ?? tool.tool_code;
        this.showToolDropdown = false;
        this.scanAndAdd();
    }

    hideToolDropdown(): void { setTimeout(() => this.showToolDropdown = false, 180); }

    onReqInput(v: string): void { if (v.length >= 2) this._reqSearch$.next(v); else this.showRequestedByDropdown = false; }
    onDelInput(v: string): void { if (v.length >= 2) this._delSearch$.next(v); else this.showDeliveredByDropdown = false; }

    selectReq(f: Funcionario): void { this.requestedByName = f.nombre; this.showRequestedByDropdown = false; }
    selectDel(f: Funcionario): void { this.deliveredByName = f.nombre; this.showDeliveredByDropdown = false; }

    hideReqDropdown(): void { setTimeout(() => this.showRequestedByDropdown = false, 200); }
    hideDelDropdown(): void { setTimeout(() => this.showDeliveredByDropdown = false, 200); }

    scanAndAdd(): void {
        const barcode = this.barcodeValue.trim();
        if (!barcode) return;
        this.isScanning.set(true);
        this.calibrationService.scanToolForCalibration(barcode).pipe(
            finalize(() => this.isScanning.set(false))
        ).subscribe(result => {
            if (result && !this.toolList.some(t => t.tool.id_tool === result.id_tool)) {
                this.toolList.push({ tool: result, status: 'pending' });
                this.barcodeValue = 'BOA-H-';
                this.cdr.detectChanges();
                this.scanInputRef.nativeElement.focus();
            }
        });
    }

    removeTool(index: number): void { if (!this.isProcessing()) this.toolList.splice(index, 1); }

    viewToolPhoto(item: MultiToolItem, index: number): void {
        if (item.imagesLoaded) {
            this.viewingPhoto.set({ code: item.tool.code, name: item.tool.name || '', url: item.images?.[0] || '' });
            return;
        }
        this.photoLoadingIndex.set(index);
        this.calibrationService.getToolImages(item.tool.id_tool).pipe(
            finalize(() => this.photoLoadingIndex.set(null))
        ).subscribe(urls => {
            item.images = urls;
            item.imagesLoaded = true;
            if (urls.length) this.viewingPhoto.set({ code: item.tool.code, name: item.tool.name || '', url: urls[0] });
        });
    }

    closePhoto(): void { this.viewingPhoto.set(null); }

    canSubmit(): boolean {
        return this.toolList.some(t => t.status !== 'done') && !!this.selectedLabId && !!this.almacen && !!this.base;
    }

    private readonly _workTypeMap: Record<string, string> = {
        'calibration':        'CALIBRACIÓN',
        'repair':             'REPARACIÓN',
        'calibration_repair': 'CALIBRACIÓN Y REPARACIÓN',
    };

    async submitAll(): Promise<void> {
        if (!this.canSubmit()) return;
        this.isProcessing.set(true);
        this.processedCount = 0;

        // Fallback con año actual; se sobreescribe con el número real del servidor.
        let notaCompartida = `EC-${new Date().getFullYear()}/S-N`;
        try {
            // getNextRecordNumber() ya normaliza la respuesta y devuelve un string directo.
            const respNota = await lastValueFrom(this.calibrationService.getNextRecordNumber('EC'));
            if (typeof respNota === 'string' && respNota) notaCompartida = respNota;

            for (const item of this.toolList) {
                if (item.status === 'done') continue;
                item.status = 'sending';
                this.cdr.detectChanges();

                const payload = {
                    tool_id:              item.tool.id_tool,
                    work_type:            this._workTypeMap[this.workType] ?? this.workType,
                    supplier_id:          this.selectedLabId,
                    supplier_name:        this.selectedLabName,
                    send_date:            new Date().toISOString().split('T')[0],
                    expected_return_date: new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0],
                    almacen:              this.almacen,
                    base:                 this.base,
                    base_id:              this.baseId ?? 0,
                    notes:                this.sendNotes,
                    record_number:        notaCompartida,
                    requested_by_name:    this.requestedByName,
                    delivered_by_name:    this.deliveredByName,
                    observations:         this.workType === 'calibration_repair' ? this.repairDescription : '',
                };

                try {
                    const res: any = await lastValueFrom(this.calibrationService.sendToCalibrationPxp(payload));
                    const hasError = res?.error === true || res?.ROOT?.error === true;

                    if (!hasError) {
                        item.status         = 'done';
                        item.nota           = notaCompartida;
                        item.id_calibration = res?.id_calibration ?? undefined;
                    } else {
                        item.status = 'error';
                        item.error  = res?.ROOT?.detalle?.mensaje || res?.detalle?.mensaje || 'Error en servidor';
                    }
                } catch (e) {
                    item.status = 'error';
                    item.error  = 'Error de conexión';
                }
                this.processedCount++;
                this.cdr.detectChanges();
            }

            if (this.toolList.every(t => t.status === 'done')) {
                this.showMsg('Envíos registrados — imprimiendo nota de envío…', 'success');
                // Imprimir la nota del primer item procesado (todos comparten el mismo record_number).
                const firstId = this.toolList.find(t => t.id_calibration)?.id_calibration;
                if (firstId) this.calibrationService.generarYVerPdfEnvio(firstId);
                setTimeout(() => this.dialogRef.close(true), 1800);
            }
        } catch (err) {
            this.showMsg('Error durante el proceso de envío', 'error');
        } finally {
            this.isProcessing.set(false);
            this.cdr.detectChanges();
        }
    }

    getDoneCount(): number { return this.toolList.filter(t => t.status === 'done').length; }
    getErrorCount(): number { return this.toolList.filter(t => t.status === 'error').length; }
    private _fmt(d: Date): string { return d.toLocaleDateString('es-BO'); }
    private _addDays(d: Date, n: number): Date { d.setDate(d.getDate() + n); return d; }
    showMsg(m: string, t: any) { this.snackBar.open(m, 'OK', { duration: 3000, panelClass: [`snackbar-${t}`] }); }
}
