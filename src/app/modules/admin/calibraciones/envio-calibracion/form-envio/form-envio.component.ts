import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule }                                                              from '@angular/common';
import { FormsModule }                                                               from '@angular/forms';
import { MatDialogModule, MatDialogRef }                                             from '@angular/material/dialog';
import { MatButtonModule }                                                           from '@angular/material/button';
import { MatIconModule }                                                             from '@angular/material/icon';
import { MatProgressSpinnerModule }                                                  from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule }                                            from '@angular/material/snack-bar';
import { MatTooltipModule }                                                          from '@angular/material/tooltip';
import { CdkDrag, CdkDragHandle }                                                    from '@angular/cdk/drag-drop';
import { Subject, lastValueFrom, of }                                                from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap, map, catchError } from 'rxjs/operators';

import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MovementService }    from '../../../../../core/services/movement.service';
import { ScanToolResult }     from '../../../../../core/models';

interface Funcionario { id: number; nombre: string; cargo: string; area?: string; }
interface Warehouse   { id: number; name: string; code: string; }
interface BaseOpt     { id: number; name: string; code: string; }

interface MultiToolItem {
    tool:               ScanToolResult & { location?: string; shelf?: string; nivel?: string; tool_code?: string; tool_name?: string };
    status:             'pending' | 'sending' | 'done' | 'error';
    // Parámetros por herramienta
    supplierId:         number | null;
    supplierName:       string;
    workType:           string;
    expectedReturnDate: string;
    notes:              string;
    repairDescription:  string;
    discrepancyReport:  string;
    // Resultado
    nota?:              string;
    error?:             string;
    images?:            string[] | null;
    imagesLoaded?:      boolean;
    id_calibration?:    number;
}

@Component({
    selector: 'app-form-envio',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
        CdkDrag, CdkDragHandle,
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

    private _destroy$    = new Subject<void>();
    private _toolSearch$ = new Subject<string>();
    private _reqSearch$  = new Subject<string>();

    @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

    // Campos compartidos por toda la nota
    almacen            = '';
    base               = '';
    baseId:            number | null = null;
    sendDate           = '';
    requestedByName    = '';

    laboratories:   any[]         = [];
    warehouses:     Warehouse[]   = [];
    bases:          BaseOpt[]     = [];

    requestedByFuncionarios:  Funcionario[] = [];
    requestedByLoading        = false;
    showRequestedByDropdown   = false;

    barcodeValue      = 'BOA-H-';
    isScanning        = signal(false);
    toolSuggestions:  any[] = [];
    showToolDropdown  = false;
    toolSearchLoading = false;

    toolList:      MultiToolItem[] = [];
    isProcessing   = signal(false);
    processedCount = 0;

    viewingPhoto   = signal<{ code: string; name: string; url: string } | null>(null);
    photoLoadingIndex = signal<number | null>(null);

    readonly workTypeOptions = [
        { value: 'calibration',        label: 'CALIBRACIÓN' },
        { value: 'repair',             label: 'REPARACIÓN'  },
        { value: 'calibration_repair', label: 'CAL/REP'     },
    ];

    private readonly _workTypeMap: Record<string, string> = {
        'calibration':        'CALIBRACIÓN',
        'repair':             'REPARACIÓN',
        'calibration_repair': 'CALIBRACIÓN Y REPARACIÓN',
    };

    ngOnInit(): void {
        this.sendDate = this._toIso(new Date());
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
            next: (labs) => { this.laboratories = (labs || []).filter((l: any) => l.estado_reg !== 'inactivo'); },
            error: () => this.showMsg('Error al cargar laboratorios', 'error'),
        });
    }

    loadWarehouses(): void {
        this.movementService.getWarehouses().pipe(takeUntil(this._destroy$)).subscribe({
            next: (rows: any[]) => {
                this.warehouses = (rows || []).map(w => ({
                    id:   w.id_warehouse || w.id,
                    name: w.nombre       || w.name,
                    code: w.codigo       || w.code || 'ALM'
                }));
                const def = this.warehouses.find(w => w.code === 'ALM-CBB');
                if (def) {
                    this.almacen = def.name;
                    this._autoSelectBase(def.code);
                }
            },
            error: () => this.showMsg('Error al cargar almacenes', 'error')
        });
    }

    loadBases(): void {
        this.movementService.getBases().pipe(takeUntil(this._destroy$)).subscribe({
            next: (rows: any[]) => {
                this.bases = (rows || []).map(b => ({
                    id:   b.id_base || b.id,
                    name: b.nombre  || b.codigo,
                    code: b.codigo  || 'BASE'
                }));
                const wh = this.warehouses.find(w => w.name === this.almacen);
                if (wh) this._autoSelectBase(wh.code);
            },
            error: () => this.showMsg('Error al cargar bases', 'error')
        });
    }

    onWarehouseChange(warehouseName: string): void {
        const wh = this.warehouses.find(w => w.name === warehouseName);
        if (wh) this._autoSelectBase(wh.code);
    }

    private _autoSelectBase(warehouseCode: string): void {
        const baseCode = warehouseCode.split('-').pop() ?? '';
        const matched  = this.bases.find(b => b.code === baseCode);
        if (matched) {
            this.base   = matched.code;
            this.baseId = matched.id;
        }
    }

    onBaseChange(code: string): void {
        const found = this.bases.find(b => b.code === code);
        this.baseId = found?.id ?? null;
    }

    onItemLabChange(item: MultiToolItem, labId: number): void {
        const lab = this.laboratories.find(l => l.id_laboratory === labId);
        item.supplierName = lab?.name ?? '';
    }

    private _setupToolSearch(): void {
        this._toolSearch$.pipe(
            debounceTime(350),
            distinctUntilChanged(),
            switchMap(term => {
                if (term.length < 2) { this.showToolDropdown = false; return of([]); }
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
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showRequestedByDropdown = false; return of([]); }
                this.requestedByLoading = true;
                const q = t.toLowerCase();
                return this.movementService.getPersonal().pipe(
                    map(lista => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map((f: any) => ({
                            id:     f.id_employee || f.id,
                            nombre: f.nombreCompleto || f.nombre,
                            cargo:  f.cargo || '',
                            area:   f.area  || ''
                        }))
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

    onToolInput(value: string): void { this._toolSearch$.next(value.trim()); }

    selectToolSuggestion(tool: any): void {
        this.barcodeValue = tool.code ?? tool.tool_code;
        this.showToolDropdown = false;
        this.scanAndAdd();
    }

    hideToolDropdown(): void { setTimeout(() => this.showToolDropdown = false, 180); }

    onReqInput(v: string): void { if (v.length >= 2) this._reqSearch$.next(v); else this.showRequestedByDropdown = false; }
    selectReq(f: Funcionario): void { this.requestedByName = f.nombre; this.showRequestedByDropdown = false; }
    hideReqDropdown(): void { setTimeout(() => this.showRequestedByDropdown = false, 200); }

    scanAndAdd(): void {
        const barcode = this.barcodeValue.trim();
        if (!barcode) return;
        this.isScanning.set(true);
        this.calibrationService.scanToolForCalibration(barcode).pipe(
            finalize(() => this.isScanning.set(false))
        ).subscribe(result => {
            if (result && !this.toolList.some(t => t.tool.id_tool === result.id_tool)) {
                // Copia parámetros del último tool como default
                const last = this.toolList[this.toolList.length - 1];
                const defaultReturnDate = (() => {
                    const d = new Date(); d.setDate(d.getDate() + 7); return this._toIso(d);
                })();
                this.toolList.push({
                    tool:               result,
                    status:             'pending',
                    supplierId:         last?.supplierId         ?? null,
                    supplierName:       last?.supplierName       ?? '',
                    workType:           last?.workType           ?? 'calibration',
                    expectedReturnDate: last?.expectedReturnDate ?? defaultReturnDate,
                    notes:              '',
                    repairDescription:  '',
                    discrepancyReport:  '',
                });
                this.barcodeValue     = 'BOA-H-';
                this.toolSuggestions  = [];
                this.showToolDropdown = false;
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
            item.images       = urls;
            item.imagesLoaded = true;
            if (urls.length) this.viewingPhoto.set({ code: item.tool.code, name: item.tool.name || '', url: urls[0] });
        });
    }

    closePhoto(): void { this.viewingPhoto.set(null); }

    canSubmit(): boolean {
        if (!this.almacen || !this.base) return false;
        const pending = this.toolList.filter(t => t.status !== 'done');
        if (pending.length === 0) return false;
        return pending.every(t => !!t.supplierId);
    }

    async submitAll(): Promise<void> {
        if (!this.canSubmit()) return;
        this.isProcessing.set(true);
        this.processedCount = 0;

        let notaCompartida = `EC-${new Date().getFullYear()}/S-N`;
        try {
            const respNota = await lastValueFrom(this.calibrationService.getNextRecordNumber('EC'));
            if (typeof respNota === 'string' && respNota) notaCompartida = respNota;

            for (const item of this.toolList) {
                if (item.status === 'done') continue;
                item.status = 'sending';
                this.cdr.detectChanges();

                const calTypeMap: Record<string, string> = {
                    calibration:        'calibration',
                    repair:             'repair',
                    calibration_repair: 'calibration',
                    verification:       'verification',
                };
                const payload = {
                    tool_id:              item.tool.id_tool,
                    calibration_type:     calTypeMap[item.workType] ?? 'calibration',
                    work_type:            this._workTypeMap[item.workType] ?? item.workType,
                    supplier_id:          item.supplierId,
                    supplier_name:        item.supplierName,
                    send_date:            this.sendDate,
                    expected_return_date: item.expectedReturnDate,
                    almacen:              this.almacen,
                    base:                 this.base,
                    base_id:              this.baseId ?? 0,
                    notes:                item.notes,
                    record_number:        notaCompartida,
                    requested_by_name:    this.requestedByName,
                    observations:         item.workType === 'calibration_repair' ? item.repairDescription : '',
                    discrepancy_report:   item.workType === 'calibration_repair' ? item.discrepancyReport : '',
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
                } catch {
                    item.status = 'error';
                    item.error  = 'Error de conexión';
                }
                this.processedCount++;
                this.cdr.detectChanges();
            }

            if (this.toolList.every(t => t.status === 'done')) {
                this.showMsg('Envíos registrados — imprimiendo nota de envío…', 'success');
                const firstId = this.toolList.find(t => t.id_calibration)?.id_calibration;
                if (firstId) this.calibrationService.generarYVerPdfEnvio(firstId);
                setTimeout(() => this.dialogRef.close(true), 1800);
            }
        } catch {
            this.showMsg('Error durante el proceso de envío', 'error');
        } finally {
            this.isProcessing.set(false);
            this.cdr.detectChanges();
        }
    }

    getDoneCount(): number  { return this.toolList.filter(t => t.status === 'done').length; }
    getErrorCount(): number { return this.toolList.filter(t => t.status === 'error').length; }
    getPendingWithoutLab(): number { return this.toolList.filter(t => t.status === 'pending' && !t.supplierId).length; }

    private _toIso(d: Date): string { return d.toISOString().split('T')[0]; }
    showMsg(m: string, t: any) { this.snackBar.open(m, 'OK', { duration: 3000, panelClass: [`snackbar-${t}`] }); }
}
