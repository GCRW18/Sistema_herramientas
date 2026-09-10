import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef, ElementRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, forkJoin, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, finalize, map, catchError } from 'rxjs/operators';

import { MovementService } from '../../../../../../core/services/movement.service';
import { QrScanService } from '../../../../../../core/services/qr-scan.service';
import { localDateStr } from '../../../../../../core/utils/date.utils';
import { Ubicacion, CondRetorno, CONDICIONES_RETORNO } from '../../retorno-traspaso.types';

export interface RetornoDialogData {
    almacenes: Ubicacion[];
    bases:     Ubicacion[];
    movimiento?: any;
    tipoOrigen?: 'BASE' | 'TRASPASO';
}

/** Ítem del carrito de retorno: sale de escanear una herramienta y resolver la
 *  nota de salida (envío a base / traspaso a área) abierta que la tiene fuera. */
interface RetornoScanItem {
    srcMovementId: number;
    srcMovementNumber: string;
    exitReason: string;            // 'base_send' | 'area_transfer'
    tipoOrigen: 'BASE' | 'TRASPASO';
    destWarehouseId: number | null;
    destWarehouseName: string;
    fechaEnvio: string;
    diasFuera: number;
    toolId: number;
    codigo: string;
    descripcion: string;
    pn: string;
    sn: string;
    marca: string;
    und: string;
    fechaCalibracion: string;
    cantidadEnviada: number;
    // editable
    cantidadRetorna: number;
    condicion: CondRetorno;
    observacionItem: string;
}

@Component({
    selector: 'app-retorno-dialog',
    standalone: true,
    imports: [
        CommonModule, DatePipe, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule, MatSnackBarModule, MatProgressSpinnerModule
    ],
    templateUrl: './retorno-dialog.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        @keyframes pulse-border {
            0%,100% { border-color:#ef4444; box-shadow:0 0 0 0 rgba(239,68,68,.4); }
            50% { border-color:#f87171; box-shadow:0 0 0 4px rgba(239,68,68,0); }
        }
        .animate-pulse-border { animation: pulse-border 2s cubic-bezier(.4,0,.6,1) infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
    `]
})
export class RetornoDialogComponent implements OnInit, OnDestroy {

    @ViewChild('confirmRetornoModal') confirmRetornoModal!: TemplateRef<any>;
    @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

    private dialogRef = inject(MatDialogRef<RetornoDialogComponent>);
    data              = inject<RetornoDialogData>(MAT_DIALOG_DATA);
    private dialog     = inject(MatDialog);
    private fb        = inject(FormBuilder);
    private snackBar  = inject(MatSnackBar);
    private movSvc    = inject(MovementService);
    private qrScan    = inject(QrScanService);
    private destroy$  = new Subject<void>();
    private _confirmDialogRef: any = null;

    isSaving      = false;
    loadingIndex  = false;
    indexReady    = false;

    retornoForm!: FormGroup;
    condiciones = CONDICIONES_RETORNO;

    /** Carrito: herramientas escaneadas listas para retornar. */
    cart: RetornoScanItem[] = [];

    // ── Índice de notas de salida abiertas: code (mayúsculas) → ítems ──
    private _openSendIndex = new Map<string, RetornoScanItem[]>();

    // ── Escaneo ──
    scanValue = '';
    scanSuggestions: RetornoScanItem[] = [];
    showScanDropdown = false;

    // ── "Devuelto por" (quien físicamente trae las herramientas de la base) ──
    private _returnedBySearch$ = new Subject<string>();
    returnedByName        = '';
    returnedByFuncionarios: any[] = [];
    returnedByLoading      = false;
    showReturnedByDropdown = false;

    // ── "Recibido por (Almacén)" ──
    private _responsableSearch$ = new Subject<string>();
    responsablesFiltrados:  any[] = [];
    responsableLoading      = false;
    showResponsableDropdown = false;
    private _personalCache: any[] = [];

    ngOnInit(): void {
        const now = new Date();
        const hora = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        this.retornoForm = this.fb.group({
            fechaRetorno:      [localDateStr(), Validators.required],
            horaRetorno:       [hora, Validators.required],
            nroDocumento:      [''],
            responsableRecibe: ['', Validators.required],
            observaciones:     ['']
        });

        const currentUser = this._currentUserName();
        if (currentUser) this.retornoForm.patchValue({ responsableRecibe: currentUser });

        this._setupResponsableSearch();
        this._setupReturnedBySearch();
        this._buildOpenSendIndex();
    }

    ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

    private _currentUserName(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || '';
        } catch { return ''; }
    }

    // ── Índice de notas de salida abiertas ─────────────────────────────────
    private _buildOpenSendIndex(): void {
        this.loadingIndex = true;
        this.movSvc.listarEnviosActivos({ limit: 500 }).pipe(
            catchError(() => of([] as any[])),
            switchMap((movs: any[]) => {
                const abiertos = (movs || []).filter((m: any) =>
                    (m.exit_reason === 'base_send' || m.exit_reason === 'area_transfer') &&
                    (m.status || 'active') !== 'returned');
                if (!abiertos.length) return of([] as { mov: any; items: any[] }[]);
                return forkJoin(abiertos.map((mov: any) =>
                    this.movSvc.getMovementItems(Number(mov.id_movement)).pipe(
                        catchError(() => of([] as any[])),
                        map((items: any[]) => ({ mov, items }))
                    )
                ));
            }),
            takeUntil(this.destroy$),
            finalize(() => { this.loadingIndex = false; this.indexReady = true; setTimeout(() => this._focusScan(), 100); })
        ).subscribe((results: { mov: any; items: any[] }[]) => {
            this._openSendIndex.clear();
            (results || []).forEach(({ mov, items }) => {
                (items || []).forEach((it: any) => {
                    const si = this._toScanItem(mov, it);
                    if (!si.codigo) return;
                    const key = si.codigo.toUpperCase();
                    const arr = this._openSendIndex.get(key) || [];
                    arr.push(si);
                    this._openSendIndex.set(key, arr);
                });
            });
            // Abierto desde la tabla Activos: precarga los ítems de ese movimiento.
            if (this.data.movimiento) this._precargarMovimiento(this.data.movimiento);
        });
    }

    private _toScanItem(mov: any, it: any): RetornoScanItem {
        const fechaEnvio = mov.date || mov.send_date || '';
        const diasFuera  = fechaEnvio
            ? Math.ceil(Math.abs(Date.now() - new Date(fechaEnvio).getTime()) / 86400000) : 0;
        const qty = Number(it?.quantity) || 1;
        return {
            srcMovementId:     Number(mov.id_movement) || 0,
            srcMovementNumber: mov.movement_number || '',
            exitReason:        mov.exit_reason || 'base_send',
            tipoOrigen:        mov.exit_reason === 'area_transfer' ? 'TRASPASO' : 'BASE',
            destWarehouseId:   mov.destination_warehouse_id != null ? Number(mov.destination_warehouse_id) : null,
            destWarehouseName: mov.destination_warehouse_name || '',
            fechaEnvio,
            diasFuera,
            toolId:            Number(it?.tool_id ?? it?.tool?.id) || 0,
            codigo:            it?.tool?.code || it?.code || it?.codigo || '',
            descripcion:       it?.tool?.description || it?.description || it?.descripcion || it?.name || '',
            pn:                it?.tool?.part_number || it?.part_number || '',
            sn:                it?.tool?.serial_number || it?.serial_number || '',
            marca:             it?.tool?.brand || it?.brand || '',
            und:               it?.unit_of_measure || 'UND',
            fechaCalibracion:  it?.next_calibration_date || it?.tool?.next_calibration_date || '',
            cantidadEnviada:   qty,
            cantidadRetorna:   qty,
            condicion:         'BUENO' as CondRetorno,
            observacionItem:   ''
        };
    }

    private _precargarMovimiento(mov: any): void {
        const id = Number(mov.id_movement);
        const yaEn = this.cart.some(c => c.srcMovementId === id);
        if (yaEn) return;
        // Toma los ítems de ese movimiento del índice ya construido.
        const items: RetornoScanItem[] = [];
        this._openSendIndex.forEach(arr => arr.forEach(si => { if (si.srcMovementId === id) items.push(si); }));
        if (!items.length) { this.showMsg('warning', `Sin herramientas pendientes en ${mov.movement_number || id}`); return; }
        this.cart = [...this.cart, ...items.map(si => ({ ...si }))];
        this.showMsg('success', `${items.length} herramienta(s) de ${mov.movement_number} cargada(s)`);
    }

    // ── Escaneo ────────────────────────────────────────────────────────────
    private _focusScan(): void {
        try { this.scanInputRef?.nativeElement.focus(); } catch { /* view not ready */ }
    }

    onScanInput(v: string): void {
        this.scanValue = v;
        const q = v.trim().toLowerCase();
        if (!q) { this.scanSuggestions = []; this.showScanDropdown = false; return; }
        const vistos = new Set<string>();
        const ranked: { si: RetornoScanItem; rank: number }[] = [];
        this._openSendIndex.forEach(arr => arr.forEach(si => {
            if (this._enCarrito(si)) return;
            const dedupe = `${si.srcMovementId}:${si.toolId}`;
            if (vistos.has(dedupe)) return;
            const code = (si.codigo || '').toLowerCase();
            let rank = -1;
            if (code === q) rank = 0;
            else if (code.startsWith(q)) rank = 1;
            else if (code.includes(q)) rank = 2;
            else if (`${si.descripcion} ${si.pn} ${si.sn} ${si.srcMovementNumber} ${si.destWarehouseName}`.toLowerCase().includes(q)) rank = 3;
            if (rank >= 0) { vistos.add(dedupe); ranked.push({ si, rank }); }
        }));
        ranked.sort((a, b) => a.rank - b.rank || a.si.codigo.localeCompare(b.si.codigo));
        this.scanSuggestions = ranked.slice(0, 12).map(r => r.si);
        this.showScanDropdown = this.scanSuggestions.length > 0;
    }

    hideScanDropdown(): void { setTimeout(() => this.showScanDropdown = false, 150); }

    scanAndAdd(): void {
        const code = this.scanValue.trim();
        if (!code) return;
        // Etiqueta QR (URL `.../qr-code/<token>`): descifra a código plano y reintenta.
        if (this.qrScan.isQrLabel(code)) {
            this.loadingIndex = true;
            this.qrScan.toToolCode(code).pipe(takeUntil(this.destroy$)).subscribe(real => {
                this.loadingIndex = false;
                if (!real) { this.showMsg('warning', 'Etiqueta QR no reconocida'); this._clearScan(); return; }
                this.scanValue = real;
                this.scanAndAdd();
            });
            return;
        }
        if (!this.indexReady) { this.showMsg('warning', 'Cargando notas de salida activas, espere un momento'); return; }
        const exactas = this._openSendIndex.get(code.toUpperCase());
        if (exactas && exactas.length > 0) { this._agregarItem(exactas); return; }
        if (this.scanSuggestions.length === 1) { this._agregarItem([this.scanSuggestions[0]]); return; }
        if (this.scanSuggestions.length > 1) {
            this.showScanDropdown = true;
            this.showMsg('info', `${this.scanSuggestions.length} coincidencias — elija de la lista`);
            return;
        }
        this.showMsg('warning', `"${code}" no tiene una nota de salida abierta para retornar`);
        this._clearScan();
    }

    pickScanSuggestion(si: RetornoScanItem): void {
        this.showScanDropdown = false;
        this._agregarItem([si]);
    }

    private _enCarrito(si: RetornoScanItem): boolean {
        return this.cart.some(c => c.srcMovementId === si.srcMovementId && c.toolId === si.toolId);
    }

    private _agregarItem(candidatos: RetornoScanItem[]): void {
        const libre = candidatos.find(si => !this._enCarrito(si));
        if (!libre) {
            this.showMsg('info', `"${candidatos[0].codigo}" ya está en la lista de retorno`);
            this._clearScan();
            return;
        }
        this.cart = [...this.cart, { ...libre }];
        this.showMsg('success', `"${libre.descripcion}" — de ${libre.srcMovementNumber} (${libre.destWarehouseName})`);
        this._clearScan();
    }

    private _clearScan(): void {
        this.scanValue = '';
        this.scanSuggestions = [];
        this.showScanDropdown = false;
        setTimeout(() => this._focusScan(), 50);
    }

    removeItem(idx: number): void {
        const it = this.cart[idx];
        this.cart = this.cart.filter((_, i) => i !== idx);
        if (it) this.showMsg('info', `"${it.descripcion}" quitada`);
    }

    // ── "Devuelto por" ─────────────────────────────────────────────────────
    private _setupReturnedBySearch(): void {
        this._returnedBySearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showReturnedByDropdown = false; return of([]); }
                this.returnedByLoading = true;
                const q = t.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({ id: String(f.id_employee || f.id), nombre: f.nombreCompleto || `${f.nombre || ''} ${f.apellido_paterno || ''}`.trim(), cargo: f.cargo || '' }))
                    ),
                    finalize(() => this.returnedByLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { this.returnedByFuncionarios = res || []; this.showReturnedByDropdown = this.returnedByFuncionarios.length > 0; });
    }

    onReturnedByInput(v: string): void { this.returnedByName = v; this._returnedBySearch$.next(v); }
    selectReturnedBy(f: any): void { this.returnedByName = f.nombre; this.showReturnedByDropdown = false; }
    hideReturnedByDropdown(): void { setTimeout(() => this.showReturnedByDropdown = false, 150); }

    // ── "Recibido por (Almacén)" ───────────────────────────────────────────
    private _setupResponsableSearch(): void {
        this.movSvc.getPersonal().pipe(takeUntil(this.destroy$), catchError(() => of([])))
            .subscribe((lista: any[]) => {
                this._personalCache = (lista || []).map(f => ({
                    id: String(f.id_employee || f.id),
                    nombre: f.nombreCompleto || `${f.nombre || ''} ${f.apellido_paterno || ''}`.trim(),
                    cargo: f.cargo || ''
                }));
            });

        this._responsableSearch$.pipe(
            debounceTime(150), distinctUntilChanged(), takeUntil(this.destroy$)
        ).subscribe(t => {
            if (t.length < 2) { this.showResponsableDropdown = false; this.responsablesFiltrados = []; return; }
            const q = t.toLowerCase();
            this.responsablesFiltrados = this._personalCache
                .filter(f => f.nombre.toLowerCase().includes(q) || f.cargo.toLowerCase().includes(q))
                .slice(0, 10);
            this.showResponsableDropdown = this.responsablesFiltrados.length > 0;
        });
    }

    onResponsableInput(val: string): void {
        this.retornoForm.patchValue({ responsableRecibe: val });
        this._responsableSearch$.next(val);
    }
    selectResponsable(r: any): void {
        this.retornoForm.patchValue({ responsableRecibe: r.nombre });
        this.showResponsableDropdown = false;
    }
    hideResponsableDropdown(): void { setTimeout(() => this.showResponsableDropdown = false, 150); }

    // ── Ítems del carrito ──────────────────────────────────────────────────
    hasError(field: string, error: string): boolean {
        const c = this.retornoForm.get(field);
        return c ? c.hasError(error) && c.touched : false;
    }

    onCondicionChange(item: RetornoScanItem): void { if (item.condicion === 'BUENO') item.observacionItem = ''; }
    getCondicionIcon(cond: CondRetorno): string { return this.condiciones.find(c => c.value === cond)?.icon || 'help_outline'; }
    validateCantidad(item: RetornoScanItem): void {
        if (item.condicion === 'FALTANTE') return;
        if (item.cantidadRetorna < 1) item.cantidadRetorna = 1;
        if (item.cantidadRetorna > item.cantidadEnviada) item.cantidadRetorna = item.cantidadEnviada;
    }

    /** Orígenes (notas de salida) representados en el carrito. */
    get origenesCarrito(): string[] {
        return [...new Set(this.cart.map(i => `${i.srcMovementNumber} · ${i.destWarehouseName}`).filter(Boolean))];
    }

    getResumenCondicion(): { condicion: string; cantidad: number; color: string }[] {
        const mapa: Record<string, number> = {};
        this.cart.forEach(i => { mapa[i.condicion] = (mapa[i.condicion] || 0) + 1; });
        return Object.entries(mapa).map(([k, v]) => {
            const cfg = this.condiciones.find(c => c.value === k);
            return { condicion: cfg?.label || k, cantidad: v, color: cfg?.bgColor || '' };
        });
    }
    trackByCondicion = (_: number, r: { condicion: string }): string => r.condicion;

    private _validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!this.cart.length) { errors.push('Escanee al menos una herramienta'); return { valid: false, errors }; }
        if (!this.returnedByName.trim()) errors.push('Indique quién devuelve las herramientas');
        if (!this.retornoForm.get('responsableRecibe')?.value?.trim()) errors.push('Indique quién recibe en el almacén');
        if (!this.retornoForm.get('fechaRetorno')?.value) errors.push('Falta la fecha de retorno');
        this.cart.forEach(i => {
            if (i.condicion !== 'FALTANTE' && (i.cantidadRetorna <= 0 || i.cantidadRetorna > i.cantidadEnviada))
                errors.push(`${i.codigo}: cantidad inválida`);
            if ((i.condicion === 'DAÑADO' || i.condicion === 'FALTANTE') && !i.observacionItem.trim())
                errors.push(`${i.codigo}: falta observación`);
        });
        return { valid: errors.length === 0, errors };
    }

    abrirConfirmRetorno(): void {
        const v = this._validate();
        if (!v.valid) { v.errors.forEach(e => this.showMsg('error', e)); return; }
        this._confirmDialogRef = this.dialog.open(this.confirmRetornoModal, {
            width: 'min(920px, 95vw)', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true
        });
    }
    cerrarConfirmRetorno(): void { this._confirmDialogRef?.close(); }

    finalizarRetorno(): void {
        const v = this._validate();
        if (!v.valid) { v.errors.forEach(e => this.showMsg('error', e)); return; }
        this.cerrarConfirmRetorno();
        this.isSaving = true;
        // Pestaña reservada en el gesto (click) para la Acta de Retorno.
        const notaWin = this.movSvc.preAbrirVentanaPdf();
        const fv = this.retornoForm.value;

        // Un retorno por origen distinto (mismo exit_reason + mismo almacén de origen).
        const grupos = new Map<string, RetornoScanItem[]>();
        this.cart.forEach(i => {
            const k = `${i.exitReason}|${i.destWarehouseId ?? 0}`;
            const arr = grupos.get(k) || [];
            arr.push(i);
            grupos.set(k, arr);
        });

        const calls = [...grupos.values()].map(items => {
            const g0 = items[0];
            const itemsJson = JSON.stringify(items.map(i => ({
                tool_id:       i.toolId,
                quantity:      i.condicion === 'FALTANTE' ? 0 : i.cantidadRetorna,
                condicion:     i.condicion,
                notes:         i.observacionItem || '',
                serial_number: i.sn || '',
                part_number:   i.pn || ''
            })));
            const srcIds = [...new Set(items.map(i => i.srcMovementId).filter(Boolean))];
            return this.movSvc.registrarRetornoBase({
                type:               g0.tipoOrigen === 'TRASPASO' ? 'RETORNO_TRASPASO' : 'RETORNO_BASE',
                date:               fv.fechaRetorno,
                time:               (fv.horaRetorno || new Date().toTimeString().slice(0, 5)) + ':00',
                requested_by_name:  this.returnedByName.trim(),
                responsible_person: fv.responsableRecibe || '',
                document_number:    fv.nroDocumento || '',
                destination_warehouse_id: g0.destWarehouseId ?? undefined,
                notes:              fv.observaciones || '',
                items_json:         itemsJson,
                source_movement_ids_json: JSON.stringify(srcIds)
            });
        });

        forkJoin(calls).pipe(
            finalize(() => this.isSaving = false),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (results: any[]) => {
                const nros = results.map(r => r?.movement_number || '---').join(', ');
                this.showMsg('success', `Retorno registrado: ${nros}`);
                results.forEach((r, idx) => {
                    const id = Number(r?.id_movement);
                    if (id) this.movSvc.verNotaRetorno(id, idx === 0 ? notaWin : null);
                });
                if (!results.some(r => Number(r?.id_movement))) { try { notaWin?.close(); } catch { /* noop */ } }
                this.dialogRef.close({ refreshActivos: true });
            },
            error: (e: any) => {
                try { notaWin?.close(); } catch { /* noop */ }
                this.showMsg('error', 'Error al registrar retorno: ' + (e?.message || ''));
            }
        });
    }

    cerrar(): void {
        if (this.cart.length > 0 &&
            !confirm(`¿Cancelar el retorno? Se perderán los ${this.cart.length} ítem(s) escaneado(s).`)) return;
        this.dialogRef.close();
    }

    private showMsg(type: 'success' | 'error' | 'info' | 'warning', text: string): void {
        this.snackBar.open(text, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
