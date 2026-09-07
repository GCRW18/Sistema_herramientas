import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef, ElementRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, switchMap, map, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service';

type CondicionDevolucion = 'BUENO' | 'DAÑADO' | 'IRREPARABLE' | 'REQUIERE_CALIBRACION' | 'FALTANTE';

/** Ítem del carrito de devolución: cada fila sale de escanear una herramienta y
 *  resolver su préstamo abierto (he.tloan_items.returned = false). */
interface DevolucionItem {
    idLoanItem: number;
    idLoan: number;
    loanNumber: string;
    borrowerName: string;       // "Prestado a" — el prestatario original
    borrowerLicense: string;
    loanDate: string;
    diasFuera: number;
    aircraft: string;
    workOrder: string;
    loanNotes: string;
    toolId: number;
    codigo: string;
    descripcion: string;
    pn: string;
    sn: string;
    und: string;
    marca: string;
    listaContenido: string;
    fechaCalibracion: string;
    estadoAlPrestar: string;
    cantidadPrestada: number;
    cantidadDevolver: number;
    condicionDevolucion: CondicionDevolucion;
    observacionItem: string;
}

@Component({
    selector: 'app-form-devolucion-dialog',
    standalone: true,
    imports: [
        CommonModule, DatePipe, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule,
        MatSnackBarModule, MatProgressSpinnerModule
    ],
    templateUrl: './form-devolucion-dialog.component.html',
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
export class FormDevolucionDialogComponent implements OnInit, OnDestroy {

    @ViewChild('confirmDevolucionModal') confirmDevolucionModal!: TemplateRef<any>;
    @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

    dialogRef         = inject(MatDialogRef<FormDevolucionDialogComponent>);
    private _confirmDialogRef: any = null;

    private dialog        = inject(MatDialog);
    private fb            = inject(FormBuilder);
    private snackBar      = inject(MatSnackBar);
    private movementSvc   = inject(MovementService);
    private destroy$      = new Subject<void>();

    isSaving      = false;
    loadingIndex  = false;
    indexReady    = false;

    devolucionForm!: FormGroup;

    /** Carrito: herramientas escaneadas listas para devolver. */
    cart: DevolucionItem[] = [];

    // ── Índice de préstamos abiertos: code (mayúsculas) → ítems resueltos ──
    private _openLoanIndex = new Map<string, DevolucionItem[]>();

    // ── Escaneo ──
    scanValue = '';
    scanSuggestions: DevolucionItem[] = [];
    showScanDropdown = false;

    // ── "Devuelto por" (técnico que físicamente trae la herramienta) ──
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

    condiciones: { value: CondicionDevolucion; label: string; bgColor: string; icon: string }[] = [
        { value: 'BUENO',                label: 'Bueno',       bgColor: 'bg-green-500',  icon: 'check_circle'   },
        { value: 'DAÑADO',               label: 'Dañado',      bgColor: 'bg-red-500',    icon: 'report_problem' },
        { value: 'REQUIERE_CALIBRACION', label: 'Req. Calib.', bgColor: 'bg-yellow-500', icon: 'build'          },
        { value: 'IRREPARABLE',          label: 'Irreparable', bgColor: 'bg-gray-800',   icon: 'delete_forever' },
        { value: 'FALTANTE',             label: 'Faltante',    bgColor: 'bg-red-700',    icon: 'help_outline'   }
    ];

    ngOnInit(): void {
        this.initDevolucionForm();
        this._setupResponsableSearch();
        this._setupReturnedBySearch();

        // Prellena "Recibido por (Almacén)" con el usuario logueado (editable).
        const currentUser = this._currentUserName();
        if (currentUser) this.devolucionForm.patchValue({ responsableRecibe: currentUser });

        this._buildOpenLoanIndex();
    }

    ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

    private _currentUserName(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || '';
        } catch { return ''; }
    }

    private _localDateStr(d = new Date()): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    private initDevolucionForm(): void {
        const now = new Date();
        const hora = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        this.devolucionForm = this.fb.group({
            fechaDevolucion:   [this._localDateStr(), Validators.required],
            horaDevolucion:    [hora, Validators.required],
            responsableRecibe: ['', Validators.required],
            observaciones:     ['']
        });
    }

    // ── Índice de préstamos abiertos ───────────────────────────────────────
    private _buildOpenLoanIndex(): void {
        this.loadingIndex = true;
        // 1º los ítems sin devolver (filtro sin comillas → confiable, y el set es
        //    chico: sólo lo que está prestado). 2º los préstamos de ESOS ítems por
        //    id (filtro numérico, exacto, sin límite de antigüedad).
        this.movementSvc.getActiveLoanItems({ filtro_adicional: 'returned = false' })
            .pipe(
                catchError(() => of([] as any[])),
                switchMap((items: any[]) => {
                    const abiertos = (items || []).filter(it =>
                        !(it.returned === true || it.returned === 'true' || it.returned === 't'));
                    const loanIds = [...new Set(abiertos.map(it => Number(it.loan_id)).filter(Boolean))];
                    if (!loanIds.length) return of({ items: abiertos, loans: [] as any[] });
                    return this.movementSvc.getActiveLoans({ filtro_adicional: `loa.id_loan IN (${loanIds.join(',')})` })
                        .pipe(catchError(() => of([] as any[])), map((loans: any[]) => ({ items: abiertos, loans })));
                }),
                takeUntil(this.destroy$),
                finalize(() => { this.loadingIndex = false; this.indexReady = true; setTimeout(() => this._focusScan(), 100); })
            )
            .subscribe(({ items, loans }) => {
                // Sólo préstamos activos e internos (por si el filtro numérico trajo alguno cerrado).
                const loanById = new Map<string, any>();
                (loans || [])
                    .filter((l: any) => l.status === 'active' && (l.loan_type || 'internal') !== 'external')
                    .forEach((l: any) => loanById.set(String(l.id_loan), l));

                this._openLoanIndex.clear();
                (items || []).forEach((it: any) => {
                    const loan = loanById.get(String(it.loan_id));
                    if (!loan) return;
                    const codigo = (it.code || '').trim();
                    if (!codigo) return;
                    const di = this._toDevolucionItem(loan, it);
                    const key = codigo.toUpperCase();
                    const arr = this._openLoanIndex.get(key) || [];
                    arr.push(di);
                    this._openLoanIndex.set(key, arr);
                });
            });
    }

    private _toDevolucionItem(loan: any, it: any): DevolucionItem {
        const loanDate = loan.loan_date || '';
        const diasFuera = loanDate
            ? Math.ceil(Math.abs(Date.now() - new Date(loanDate).getTime()) / 86400000)
            : 0;
        const qty = Number(it.quantity) || 1;
        return {
            idLoanItem:       Number(it.id_loan_item),
            idLoan:           Number(it.loan_id),
            loanNumber:       loan.loan_number || `PT-${loan.id_loan}`,
            borrowerName:     loan.borrower_name || '—',
            borrowerLicense:  loan.borrower_license || '',
            loanDate,
            diasFuera,
            aircraft:         loan.aircraft || '',
            workOrder:        loan.work_order_number || '',
            loanNotes:        (loan.loan_notes || '').trim(),
            toolId:           Number(it.tool_id) || 0,
            codigo:           it.code || '',
            descripcion:      it.description || it.name || '',
            pn:               it.part_number || '',
            sn:               it.serial_number || '',
            und:              it.unit_of_measure || 'UND',
            marca:            it.brand || '',
            listaContenido:   it.content_list || '',
            fechaCalibracion: it.next_calibration_date || '',
            estadoAlPrestar:  it.condition_on_loan || 'good',
            cantidadPrestada: qty,
            cantidadDevolver: qty,
            condicionDevolucion: 'BUENO',
            observacionItem:  ''
        };
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
        // rank: 0 = código exacto, 1 = código empieza con, 2 = código contiene, 3 = descripción/PN
        const ranked: { di: DevolucionItem; rank: number }[] = [];
        this._openLoanIndex.forEach(arr => arr.forEach(di => {
            if (this.cart.some(c => c.idLoanItem === di.idLoanItem)) return;
            if (vistos.has(String(di.idLoanItem))) return;
            const code = (di.codigo || '').toLowerCase();
            let rank = -1;
            if (code === q) rank = 0;
            else if (code.startsWith(q)) rank = 1;
            else if (code.includes(q)) rank = 2;
            else if (`${di.descripcion} ${di.pn} ${di.sn} ${di.borrowerName} ${di.loanNumber}`.toLowerCase().includes(q)) rank = 3;
            if (rank >= 0) { vistos.add(String(di.idLoanItem)); ranked.push({ di, rank }); }
        }));
        ranked.sort((a, b) => a.rank - b.rank || a.di.codigo.localeCompare(b.di.codigo));
        this.scanSuggestions = ranked.slice(0, 12).map(r => r.di);
        this.showScanDropdown = this.scanSuggestions.length > 0;
    }

    hideScanDropdown(): void { setTimeout(() => this.showScanDropdown = false, 150); }

    /** Enter en el input / lector físico wedge: código exacto → agrega directo;
     *  si no hay exacto pero la búsqueda dejó una sola coincidencia, agrega esa. */
    scanAndAdd(): void {
        const code = this.scanValue.trim();
        if (!code) return;
        if (!this.indexReady) { this.showMsg('warning', 'Cargando préstamos activos, espere un momento'); return; }
        const exactas = this._openLoanIndex.get(code.toUpperCase());
        if (exactas && exactas.length > 0) { this._agregarItem(exactas); return; }
        if (this.scanSuggestions.length === 1) { this._agregarItem([this.scanSuggestions[0]]); return; }
        if (this.scanSuggestions.length > 1) {
            this.showScanDropdown = true;
            this.showMsg('info', `${this.scanSuggestions.length} coincidencias — elija de la lista`);
            return;
        }
        this.showMsg('warning', `"${code}" no tiene un préstamo abierto para devolver`);
        this._clearScan();
    }

    pickScanSuggestion(di: DevolucionItem): void {
        this.showScanDropdown = false;
        this._agregarItem([di]);
    }

    private _agregarItem(candidatos: DevolucionItem[]): void {
        const libre = candidatos.find(di => !this.cart.some(c => c.idLoanItem === di.idLoanItem));
        if (!libre) {
            this.showMsg('info', `"${candidatos[0].codigo}" ya está en la lista de devolución`);
            this._clearScan();
            return;
        }
        // Copia para no mutar el índice
        this.cart = [...this.cart, { ...libre }];
        this.showMsg('success', `"${libre.descripcion}" — prestada a ${libre.borrowerName}`);
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
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({ id: String(f.id_employee || f.id), nombre: f.nombreCompleto || `${f.nombre||''} ${f.apellido_paterno||''}`.trim(), cargo: f.cargo || '' }))
                    ),
                    finalize(() => this.returnedByLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { this.returnedByFuncionarios = res || []; this.showReturnedByDropdown = this.returnedByFuncionarios.length > 0; });
    }

    onReturnedByInput(v: string): void {
        this.returnedByName = v;
        this._returnedBySearch$.next(v);
    }
    selectReturnedBy(f: any): void {
        this.returnedByName = f.nombre;
        this.showReturnedByDropdown = false;
    }
    hideReturnedByDropdown(): void { setTimeout(() => this.showReturnedByDropdown = false, 150); }

    /** Atajo: usar el prestatario del primer ítem del carrito como "devuelto por". */
    usarPrestatarioComoDevuelve(): void {
        if (!this.cart.length) return;
        this.returnedByName = this.cart[0].borrowerName;
    }

    // ── "Recibido por (Almacén)" ───────────────────────────────────────────
    private _setupResponsableSearch(): void {
        this.movementSvc.getPersonal().pipe(
            takeUntil(this.destroy$), catchError(() => of([]))
        ).subscribe((lista: any[]) => {
            this._personalCache = (lista || []).map(f => ({
                id:     String(f.id_employee || f.id),
                nombre: f.nombreCompleto || `${f.nombre||''} ${f.apellido_paterno||''}`.trim(),
                cargo:  f.cargo || ''
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
        this.devolucionForm.patchValue({ responsableRecibe: val });
        this._responsableSearch$.next(val);
    }
    selectResponsable(r: any): void {
        this.devolucionForm.patchValue({ responsableRecibe: r.nombre });
        this.showResponsableDropdown = false;
    }
    hideResponsableDropdown(): void { setTimeout(() => this.showResponsableDropdown = false, 150); }

    // ── Ítems del carrito ──────────────────────────────────────────────────
    hasError(field: string, error: string): boolean {
        const c = this.devolucionForm.get(field);
        return c ? c.hasError(error) && c.touched : false;
    }

    private readonly _condicionLabelMap: Record<string, string> = {
        'good': 'ACTIVO', 'new': 'NUEVO', 'excellent': 'EXCELENTE',
        'fair': 'REGULAR', 'poor': 'MALO', 'damaged': 'DAÑADO',
        'reconditioned': 'REACONDICIONADO', 'serviceable': 'ACTIVO',
        'bueno': 'ACTIVO', 'nuevo': 'NUEVO', 'en_calibracion': 'EN CALIBRACIÓN',
        'unserviceable': 'NO SERVICEABLE',
    };
    getEstadoPrestarLabel(est: string): string {
        return this._condicionLabelMap[(est || '').toLowerCase()] || (est || '—').toUpperCase();
    }

    onCondicionChange(item: DevolucionItem): void { if (item.condicionDevolucion === 'BUENO') item.observacionItem = ''; }
    getCondicionIcon(cond: CondicionDevolucion): string { return this.condiciones.find(c => c.value === cond)?.icon || 'help_outline'; }
    validateCantidad(item: DevolucionItem): void {
        if (item.cantidadDevolver < 1) item.cantidadDevolver = 1;
        if (item.cantidadDevolver > item.cantidadPrestada) item.cantidadDevolver = item.cantidadPrestada;
    }

    private _validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!this.cart.length) { errors.push('Escanee al menos una herramienta'); return { valid: false, errors }; }
        if (!this.returnedByName.trim()) errors.push('Indique quién devuelve la herramienta');
        if (!this.devolucionForm.get('responsableRecibe')?.value?.trim()) errors.push('Indique quién recibe en el almacén');
        this.cart.forEach(i => {
            if (i.cantidadDevolver <= 0 || i.cantidadDevolver > i.cantidadPrestada) errors.push(`${i.codigo}: cantidad inválida`);
            if ((i.condicionDevolucion === 'DAÑADO' || i.condicionDevolucion === 'FALTANTE') && !i.observacionItem.trim()) errors.push(`${i.codigo}: falta observación`);
        });
        return { valid: errors.length === 0, errors };
    }

    getResumenCondicion(): { condicion: string; cantidad: number; color: string }[] {
        const mapa: Record<string, number> = {};
        this.cart.forEach(i => { mapa[i.condicionDevolucion] = (mapa[i.condicionDevolucion] || 0) + 1; });
        return Object.entries(mapa).map(([k, v]) => {
            const cfg = this.condiciones.find(c => c.value === k);
            return { condicion: cfg?.label || k, cantidad: v, color: cfg?.bgColor || '' };
        });
    }
    trackByCondicion = (_: number, r: { condicion: string }): string => r.condicion;

    /** Prestatarios distintos representados en el carrito. */
    get prestatariosCarrito(): string[] {
        return [...new Set(this.cart.map(i => i.borrowerName).filter(Boolean))];
    }

    abrirConfirmDevolucion(): void {
        const val = this._validate();
        if (!val.valid) { val.errors.forEach(e => this.showMsg('error', e)); return; }
        this._confirmDialogRef = this.dialog.open(this.confirmDevolucionModal, {
            width: 'min(920px, 95vw)', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true
        });
    }
    cerrarConfirmDevolucion(): void { this._confirmDialogRef?.close(); }

    finalizarDevolucion(): void {
        const val = this._validate();
        if (!val.valid) { val.errors.forEach(e => this.showMsg('error', e)); return; }
        this.cerrarConfirmDevolucion();
        this.isSaving = true;
        // Pestaña reservada en el gesto (click "Registrar devolución") para la nota MGH-100.
        const notaWin = this.movementSvc.preAbrirVentanaPdf();
        const fv = this.devolucionForm.value;
        const itemsJson = JSON.stringify(this.cart.map(i => ({
            tool_id: i.toolId, id_loan_item: i.idLoanItem,
            quantity: i.cantidadDevolver, condicion: i.condicionDevolucion,
            unit_of_measure: i.und || '', content_list: i.listaContenido || '',
            estado_al_prestar: i.estadoAlPrestar || '', notes: i.observacionItem || ''
        })));
        this.movementSvc.registrarDevolucionPrestamo({
            type: 'DEVOLUCION_PRESTAMO_INTERNO',
            date: fv.fechaDevolucion,
            time: fv.horaDevolucion || new Date().toTimeString().slice(0, 5),
            requested_by_name:  this.returnedByName.trim(),
            responsible_person: fv.responsableRecibe,
            returned_by_name:   this.returnedByName.trim(),
            recipient:          this.returnedByName.trim(),
            work_order_number:  this.cart[0]?.workOrder || '',
            notes:              fv.observaciones || '',
            items_json:         itemsJson
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.showMsg('success', `Devolución registrada: ${nro}`);
                // Nota PDF real MGH-100 (REV. 2, TCPDF backend): una por cada préstamo tocado.
                const loanIds = [...new Set(this.cart.map(i => i.idLoan).filter(Boolean))];
                loanIds.forEach((id, i) => this.movementSvc.verNotaPrestamo(id, 'mgh100', false, i === 0 ? notaWin : null));
                if (!loanIds.length) { try { notaWin?.close(); } catch { /* noop */ } }
                this.dialogRef.close({ success: true, movement_number: nro });
            },
            error: (err: any) => { try { notaWin?.close(); } catch { /* noop */ } this.showMsg('error', 'Error al registrar: ' + (err?.message || '')); }
        });
    }

    cerrar(): void {
        if (this.cart.length > 0 &&
            !confirm(`¿Cancelar la devolución? Se perderán los ${this.cart.length} ítem(s) escaneado(s).`)) return;
        this.dialogRef.close();
    }

    private showMsg(type: 'success' | 'error' | 'info' | 'warning', text: string): void {
        this.snackBar.open(text, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
