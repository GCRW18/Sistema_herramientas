import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule }                                                              from '@angular/common';
import { FormsModule }                                                               from '@angular/forms';
import { MatDialogModule, MatDialogRef }                                             from '@angular/material/dialog';
import { MatIconModule }                                                             from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule }                                            from '@angular/material/snack-bar';
import { Subject, interval, of }                                                     from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap, map, catchError } from 'rxjs/operators';

import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MovementService }    from '../../../../../core/services/movement.service';
import { ScanToolResult }     from '../../../../../core/models';
import { localDateStr }       from '../../../../../core/utils/date.utils';

interface Funcionario { id: number; nombre: string; cargo: string; area?: string; }
interface Warehouse   { id: number; name: string; code: string; }
interface BaseOpt     { id: number; name: string; code: string; }

interface DraftToolItem {
    id_draft_item:      number;
    tool:               ScanToolResult & { location?: string; shelf?: string; nivel?: string; tool_code?: string; tool_name?: string; part_number?: string };
    // Parámetros por herramienta
    supplierId:         number | null;
    supplierName:       string;
    workType:           string;
    expectedReturnDate: string;
    cost:               number | null;
    notes:              string;
    repairDescription:  string;
    discrepancyReport:  string;
    // Metadata del borrador
    addedByName:        string;
    toolEnCalibracion:  boolean;
    // Foto
    images?:            string[] | null;
    imagesLoaded?:      boolean;
}

@Component({
    selector: 'app-form-envio',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatIconModule, MatSnackBarModule,
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

    // Auto-refresco del borrador compartido: trae lo que agregaron otros técnicos.
    // Los cambios propios se guardan al instante; esto es solo el "pull".
    private readonly REFRESH_MS = 600000; // 10 min

    @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

    // Campos comunes de la nota (compartidos por todo el borrador)
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

    toolList:      DraftToolItem[] = [];

    // Estado del borrador
    draftLoading   = signal(false);
    savingCount    = signal(0);
    confirming     = signal(false);
    lastSyncAt     = signal<Date | null>(null);

    // Lo que el usuario está editando ahora — el auto-refresco no lo pisa
    editingItemId: number | null = null;
    editingComun = false;

    // Tarjetas colapsadas (por id_draft_item) — sobrevive al auto-refresco
    private collapsedIds = new Set<number>();

    viewingPhoto   = signal<{ code: string; name: string; url: string } | null>(null);
    photoLoadingIndex = signal<number | null>(null);

    readonly workTypeOptions = [
        { value: 'calibration',        label: 'CALIBRACIÓN' },
        { value: 'repair',             label: 'REPARACIÓN'  },
        { value: 'calibration_repair', label: 'CAL/REP'     },
    ];

    ngOnInit(): void {
        this.sendDate = this._toIso(new Date());
        this.requestedByName = this._currentUser();
        this.loadLaboratorios();
        this.loadWarehouses();
        this.loadBases();
        this._setupToolSearch();
        this._setupFuncionarioSearch();

        this.refreshDraft(true);

        // Auto-refresco: refleja lo que agregan/editan otros técnicos entre turnos.
        interval(this.REFRESH_MS).pipe(takeUntil(this._destroy$)).subscribe(() => {
            if (this._isBusy()) return;
            this.refreshDraft();
        });
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    private _isBusy(): boolean {
        return this.savingCount() > 0
            || this.confirming()
            || this.editingItemId !== null
            || this.editingComun
            || this.showToolDropdown
            || this.showRequestedByDropdown
            || this.viewingPhoto() !== null;
    }

    // ── Catálogos ──────────────────────────────────────────
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
                // Solo autoseleccionar si el borrador todavía no fijó un almacén.
                if (!this.almacen) {
                    const def = this.warehouses.find(w => w.code === 'ALM-CBB-0001')
                        ?? this.warehouses.find(w => (w.code || '').startsWith('ALM-CBB'));
                    if (def) {
                        this.almacen = def.name;
                        this._autoSelectBase(def.code);
                    }
                }
            },
            error: () => this.showMsg('Error al cargar almacenes', 'error')
        });
    }

    loadBases(): void {
        this.movementService.getBases().pipe(takeUntil(this._destroy$)).subscribe({
            next: (rows: any[]) => {
                this.bases = (rows || []).map(b => ({
                    id:   b.id_lugar ?? b.id,
                    name: b.nombre   || b.codigo,
                    code: b.codigo   || 'BASE'
                }));
                if (!this.baseId) {
                    const wh = this.warehouses.find(w => w.name === this.almacen);
                    if (wh) this._autoSelectBase(wh.code);
                }
            },
            error: () => this.showMsg('Error al cargar bases', 'error')
        });
    }

    onWarehouseChange(warehouseName: string): void {
        const wh = this.warehouses.find(w => w.name === warehouseName);
        if (wh) this._autoSelectBase(wh.code);
        this.persistComun();
    }

    private _autoSelectBase(warehouseCode: string): void {
        const parts    = warehouseCode.split('-');
        const baseCode = parts.length > 1 ? parts[1] : (parts[0] ?? '');
        const matched  = this.bases.find(b => b.code === baseCode);
        if (matched) {
            this.base   = matched.code;
            this.baseId = matched.id;
        }
    }

    onBaseChange(code: string): void {
        const found = this.bases.find(b => b.code === code);
        this.baseId = found?.id ?? null;
        this.persistComun();
    }

    onItemLabChange(item: DraftToolItem, labId: number): void {
        const lab = this.laboratories.find(l => l.id_laboratory === labId);
        item.supplierName = lab?.name ?? '';
        this.persistItem(item);
    }

    // ── Búsqueda ───────────────────────────────────────────
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
    selectReq(f: Funcionario): void { this.requestedByName = f.nombre; this.showRequestedByDropdown = false; this.persistComun(); }
    hideReqDropdown(): void { setTimeout(() => this.showRequestedByDropdown = false, 200); }

    // ── Borrador: carga / sincronización ───────────────────
    refreshDraft(initial = false): void {
        this.draftLoading.set(true);
        this.calibrationService.getDraftEnvio().pipe(
            takeUntil(this._destroy$),
            finalize(() => this.draftLoading.set(false)),
        ).subscribe({
            next: (rows) => { this._applyDraft(rows || []); this.lastSyncAt.set(new Date()); this.cdr.detectChanges(); },
            error: () => { if (initial) this.showMsg('No se pudo cargar el borrador de envío', 'error'); },
        });
    }

    private _applyDraft(rows: any[]): void {
        if (rows.length && !this.editingComun) {
            const h = rows[0];
            this.almacen         = h.almacen ?? this.almacen;
            this.base            = h.base ?? this.base;
            this.baseId          = h.id_lugar ?? this.baseId;
            this.sendDate        = h.send_date ? String(h.send_date).split('T')[0] : this.sendDate;
            this.requestedByName = h.requested_by_name ?? this.requestedByName;
        }

        this.toolList = rows.map(r => {
            // No pisar la herramienta que el usuario está editando ahora mismo.
            if (r.id_draft_item === this.editingItemId) {
                const keep = this.toolList.find(t => t.id_draft_item === r.id_draft_item);
                if (keep) return keep;
            }
            return this._rowToItem(r);
        });

        // Descarta del set de colapsadas los ids que ya no están en el borrador.
        const vivos = new Set(this.toolList.map(t => t.id_draft_item));
        for (const id of Array.from(this.collapsedIds)) {
            if (!vivos.has(id)) this.collapsedIds.delete(id);
        }
    }

    private _rowToItem(r: any): DraftToolItem {
        return {
            id_draft_item: r.id_draft_item,
            tool: {
                id_tool:       r.tool_id,
                code:          r.tool_code,
                name:          r.tool_name,
                serial_number: r.tool_serial,
                is_jack:       r.is_jack === true || r.is_jack === 't',
                part_number:   r.part_number,
                location:      r.tool_ubicacion || '',
            } as any,
            supplierId:         r.supplier_id != null ? Number(r.supplier_id) : null,
            supplierName:       r.supplier_name ?? '',
            workType:           r.work_type ?? 'calibration',
            expectedReturnDate: r.expected_return_date ? String(r.expected_return_date).split('T')[0] : this._defaultReturn(),
            cost:               (r.cost === null || r.cost === undefined || r.cost === '') ? null : Number(r.cost),
            notes:              r.notes ?? '',
            repairDescription:  r.repair_description ?? '',
            discrepancyReport:  r.discrepancy_report ?? '',
            addedByName:        r.added_by_name || r.usr_reg || '—',
            toolEnCalibracion:  r.tool_en_calibracion === true || r.tool_en_calibracion === 't',
        };
    }

    // ── Borrador: mutaciones ───────────────────────────────
    scanAndAdd(): void {
        const barcode = this.barcodeValue.trim();
        if (!barcode) return;
        this.isScanning.set(true);
        this.calibrationService.scanToolForCalibration(barcode).pipe(
            finalize(() => this.isScanning.set(false))
        ).subscribe(result => {
            if (!result) { this.showMsg('Herramienta no encontrada', 'warning'); return; }
            if (this.toolList.some(t => t.tool.id_tool === result.id_tool)) {
                this.showMsg('La herramienta ya está en el borrador', 'warning');
                return;
            }
            const last = this.toolList[this.toolList.length - 1];
            this.savingCount.update(n => n + 1);
            this.calibrationService.addDraftEnvioItem({
                tool_id:              result.id_tool,
                almacen:              this.almacen || undefined,
                base:                 this.base || undefined,
                id_lugar:             this.baseId ?? undefined,
                send_date:            this.sendDate || undefined,
                requested_by_name:    this.requestedByName || undefined,
                added_by_name:        this._currentUser(),
                supplier_id:          last?.supplierId ?? undefined,
                supplier_name:        last?.supplierName || undefined,
                work_type:            last?.workType ?? 'calibration',
                expected_return_date: last?.expectedReturnDate ?? this._defaultReturn(),
                cost:                 last?.cost ?? undefined,
            }).pipe(
                finalize(() => this.savingCount.update(n => n - 1)),
            ).subscribe({
                next: (res: any) => {
                    // Al agregar, colapsa las herramientas ya cargadas y deja la nueva
                    // desplegada para configurarla.
                    const nuevaId = Number(res?.id_draft_item) || 0;
                    this.toolList.forEach(t => this.collapsedIds.add(t.id_draft_item));
                    if (nuevaId) this.collapsedIds.delete(nuevaId);

                    this.barcodeValue     = 'BOA-H-';
                    this.toolSuggestions  = [];
                    this.showToolDropdown = false;
                    this.refreshDraft();
                    setTimeout(() => this.scanInputRef?.nativeElement.focus(), 0);
                },
                error: (e) => this.showMsg(e?.message || 'No se pudo agregar la herramienta', 'error'),
            });
        });
    }

    removeTool(item: DraftToolItem): void {
        if (this.savingCount() > 0) return;
        this.savingCount.update(n => n + 1);
        this.calibrationService.deleteDraftEnvioItem(item.id_draft_item).pipe(
            finalize(() => this.savingCount.update(n => n - 1)),
        ).subscribe({
            next: () => { this.toolList = this.toolList.filter(t => t.id_draft_item !== item.id_draft_item); this.cdr.detectChanges(); },
            error: (e) => this.showMsg(e?.message || 'No se pudo quitar la herramienta', 'error'),
        });
    }

    /** Guarda la configuración individual de una herramienta del borrador. */
    persistItem(item: DraftToolItem): void {
        this.savingCount.update(n => n + 1);
        this.calibrationService.updateDraftEnvioItem({
            id_draft_item:        item.id_draft_item,
            supplier_id:          item.supplierId ?? undefined,
            supplier_name:        item.supplierName || undefined,
            work_type:            item.workType,
            expected_return_date: item.expectedReturnDate || undefined,
            cost:                 item.cost ?? undefined,
            notes:                item.notes || undefined,
            repair_description:   item.repairDescription || undefined,
            discrepancy_report:   item.discrepancyReport || undefined,
        }).pipe(
            finalize(() => { this.savingCount.update(n => n - 1); this.editingItemId = null; }),
        ).subscribe({
            error: (e) => this.showMsg(e?.message || 'No se pudo guardar el cambio', 'error'),
        });
    }

    /** Guarda los datos comunes de la nota (afecta a todo el borrador). */
    persistComun(): void {
        if (this.toolList.length === 0) return; // sin filas, HE_CDR_HDR no tiene nada que actualizar
        this.savingCount.update(n => n + 1);
        this.calibrationService.saveDraftEnvioComun({
            almacen:           this.almacen || undefined,
            base:              this.base || undefined,
            id_lugar:          this.baseId ?? undefined,
            send_date:         this.sendDate || undefined,
            requested_by_name: this.requestedByName || undefined,
        }).pipe(
            finalize(() => { this.savingCount.update(n => n - 1); this.editingComun = false; }),
        ).subscribe({
            error: (e) => this.showMsg(e?.message || 'No se pudieron guardar los datos comunes', 'error'),
        });
    }

    onItemWorkType(item: DraftToolItem, value: string): void {
        item.workType = value;
        if (value !== 'calibration_repair') { item.repairDescription = ''; item.discrepancyReport = ''; }
        this.persistItem(item);
    }

    markEditing(id: number): void { this.editingItemId = id; }
    markEditingComun(): void { this.editingComun = true; }

    // ── Colapsar / desplegar tarjetas ──────────────────────
    isCollapsed(id: number): boolean { return this.collapsedIds.has(id); }

    toggleCollapse(id: number): void {
        if (this.collapsedIds.has(id)) this.collapsedIds.delete(id);
        else this.collapsedIds.add(id);
    }

    collapseAll(): void { this.toolList.forEach(t => this.collapsedIds.add(t.id_draft_item)); }
    expandAll(): void { this.collapsedIds.clear(); }

    get allCollapsed(): boolean {
        return this.toolList.length > 0 && this.toolList.every(t => this.collapsedIds.has(t.id_draft_item));
    }

    /** Etiqueta legible del tipo de trabajo. */
    workTypeLabel(v: string): string {
        return this.workTypeOptions.find(o => o.value === v)?.label ?? (v || '—');
    }

    /** La herramienta del borrador tiene campos obligatorios sin completar. */
    itemIncompleto(item: DraftToolItem): boolean {
        if (!item.supplierId) return true;
        if (!item.expectedReturnDate) return true;
        if (item.workType === 'calibration_repair' && !item.repairDescription?.trim()) return true;
        return false;
    }

    // ── Foto ───────────────────────────────────────────────
    viewToolPhoto(item: DraftToolItem, index: number): void {
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
            else this.showMsg('La herramienta no tiene fotos', 'info');
        });
    }

    closePhoto(): void { this.viewingPhoto.set(null); }

    // ── Validación / acciones finales ──────────────────────
    getMissingFields(): string[] {
        const missing: string[] = [];
        if (!this.almacen)                  missing.push('Almacén');
        if (!this.base)                     missing.push('Base Origen');
        if (!this.sendDate)                 missing.push('Fecha de Envío');
        if (!this.requestedByName?.trim())  missing.push('Solicitado Por');

        if (this.toolList.length === 0) {
            missing.push('al menos una herramienta en el borrador');
            return missing;
        }
        this.toolList.forEach((t, idx) => {
            const cod = t.tool.code ?? t.tool.tool_code ?? `#${idx + 1}`;
            if (!t.supplierId)         missing.push(`Laboratorio de ${cod}`);
            if (!t.expectedReturnDate) missing.push(`Retorno estimado de ${cod}`);
            if (t.workType === 'calibration_repair' && !t.repairDescription?.trim())
                missing.push(`Descripción de reparación de ${cod}`);
        });
        return missing;
    }

    canConfirm(): boolean {
        return this.getMissingFields().length === 0 && !this.confirming() && this.savingCount() === 0;
    }

    confirmarEnvio(): void {
        const missing = this.getMissingFields();
        if (missing.length > 0) {
            this.showMsg('Complete lo que falta: ' + missing.join(' · '), 'warning');
            return;
        }
        const n = this.toolList.length;
        const ok = confirm(
            `Vas a confirmar el envío de ${n} herramienta${n !== 1 ? 's' : ''} en UNA sola nota de envío.\n\n` +
            `Esto cierra el borrador para todos los turnos y da salida a las herramientas. ¿Continuar?`
        );
        if (!ok) return;

        this.confirming.set(true);
        this.calibrationService.confirmDraftEnvio({
            almacen:           this.almacen,
            base:              this.base,
            id_lugar:          this.baseId ?? undefined,
            send_date:         this.sendDate,
            requested_by_name: this.requestedByName,
            delivered_by_name: this._currentUser(),
        }).pipe(
            finalize(() => this.confirming.set(false)),
        ).subscribe({
            next: (res: any) => {
                const nota = res?.record_number ?? '';
                this.showMsg(`Envío confirmado — nota ${nota}`, 'success');
                const idCal = Number(res?.id_calibration) || 0;
                if (idCal) this.calibrationService.generarYVerPdfEnvio(idCal);
                setTimeout(() => this.dialogRef.close(true), 1600);
            },
            error: (e) => this.showMsg(e?.message || 'Error al confirmar el envío', 'error'),
        });
    }

    descartarBorrador(): void {
        if (this.toolList.length === 0) { this.dialogRef.close(false); return; }
        if (!confirm('¿Descartar el borrador completo? Se quitarán todas las herramientas agrupadas.')) return;
        this.confirming.set(true);
        this.calibrationService.cancelDraftEnvio().pipe(
            finalize(() => this.confirming.set(false)),
        ).subscribe({
            next: () => { this.toolList = []; this.showMsg('Borrador descartado', 'info'); this.dialogRef.close(false); },
            error: (e) => this.showMsg(e?.message || 'No se pudo descartar el borrador', 'error'),
        });
    }

    cerrar(): void { this.dialogRef.close(false); }

    // ── utils ──────────────────────────────────────────────
    private _defaultReturn(): string {
        const d = new Date(); d.setDate(d.getDate() + 7); return this._toIso(d);
    }
    private _toIso(d: Date): string { return localDateStr(d); }

    private _currentUser(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || '';
        } catch { return ''; }
    }

    showMsg(m: string, t: any) { this.snackBar.open(m, 'OK', { duration: 3000, panelClass: [`snackbar-${t}`] }); }
}
