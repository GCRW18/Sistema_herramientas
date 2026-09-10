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
import { CustomerService } from '../../../../../core/services/customer.service';
import { QrScanService } from '../../../../../core/services/qr-scan.service';

type CondicionExt = 'BUENO' | 'REPARADO' | 'CALIBRADO' | 'PARCIAL' | 'NO_REPARABLE';

/** Ítem del carrito de devolución externa: sale de escanear una herramienta y
 *  resolver su préstamo externo abierto (he.tloan_items.returned = false). */
interface DevolucionExternoItem {
    idLoanItem: number;
    idLoan: number;
    loanNumber: string;
    empresa: string;          // "Prestado a" — la empresa/tercero
    borrowerLicense: string;
    loanDate: string;
    diasFuera: number;
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
    condicionDevolucion: CondicionExt;
    observacionItem: string;
}

@Component({
    selector: 'app-form-devolucion-externo-dialog',
    standalone: true,
    imports: [
        CommonModule, DatePipe, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule, MatSnackBarModule, MatProgressSpinnerModule
    ],
    templateUrl: './form-devolucion-externo-dialog.component.html',
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
export class FormDevolucionExternoDialogComponent implements OnInit, OnDestroy {

    @ViewChild('confirmDevModal') confirmDevModal!: TemplateRef<any>;
    @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

    dialogRef       = inject(MatDialogRef<FormDevolucionExternoDialogComponent>);
    private _confirmRef: any = null;

    private dialog     = inject(MatDialog);
    private fb         = inject(FormBuilder);
    private snackBar   = inject(MatSnackBar);
    private movementSvc = inject(MovementService);
    private customerSvc = inject(CustomerService);
    private qrScan      = inject(QrScanService);
    private destroy$   = new Subject<void>();

    isSaving     = false;
    loadingIndex = false;
    indexReady   = false;

    devForm!: FormGroup;

    /** Carrito: herramientas escaneadas listas para devolver. */
    cart: DevolucionExternoItem[] = [];

    private _openLoanIndex = new Map<string, DevolucionExternoItem[]>();

    // ── Escaneo ──
    scanValue = '';
    scanSuggestions: DevolucionExternoItem[] = [];
    showScanDropdown = false;

    // ── "Devuelto por" — conectado a la empresa / cliente (he.tcustomers) ──
    private _returnedBySearch$ = new Subject<string>();
    returnedByName        = '';
    returnedByFuncionarios: any[] = [];   // ahora: clientes/empresas { nombre, cargo }
    returnedByLoading      = false;
    showReturnedByDropdown = false;
    private _clientesCache: any[] = [];

    // ── "Recibido por (Almacén)" ──
    private _responsableSearch$ = new Subject<string>();
    responsablesFiltrados:  any[] = [];
    responsableLoading      = false;
    showResponsableDropdown = false;
    private _personalCache: any[] = [];

    condiciones: { value: CondicionExt; label: string; bgColor: string; icon: string }[] = [
        { value: 'BUENO',        label: 'Bueno',        bgColor: 'bg-green-500', icon: 'check_circle'  },
        { value: 'REPARADO',     label: 'Reparado',     bgColor: 'bg-blue-500',  icon: 'build'         },
        { value: 'CALIBRADO',    label: 'Calibrado',    bgColor: 'bg-cyan-500',  icon: 'tune'          },
        { value: 'PARCIAL',      label: 'Parcial',      bgColor: 'bg-yellow-500',icon: 'construction'  },
        { value: 'NO_REPARABLE', label: 'No Reparable', bgColor: 'bg-red-700',   icon: 'dangerous'     },
    ];

    ngOnInit(): void {
        this.initForm();
        this._setupResponsableSearch();
        this._setupReturnedBySearch();

        const currentUser = this._currentUserName();
        if (currentUser) this.devForm.patchValue({ responsableRecibe: currentUser });

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

    private initForm(): void {
        const now = new Date();
        const hora = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        this.devForm = this.fb.group({
            fechaDevolucion:   [this._localDateStr(), Validators.required],
            horaDevolucion:    [hora, Validators.required],
            responsableRecibe: ['', Validators.required],
            observaciones:     ['']
        });
    }

    // ── Índice de préstamos externos abiertos ──────────────────────────────
    private _buildOpenLoanIndex(): void {
        this.loadingIndex = true;
        // 1º ítems sin devolver (filtro sin comillas, set chico), 2º sus préstamos
        //    por id (filtro numérico exacto, sin tope de antigüedad).
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
                const loanById = new Map<string, any>();
                (loans || [])
                    .filter((l: any) => l.status === 'active' && (l.loan_type || '') === 'external')
                    .forEach((l: any) => loanById.set(String(l.id_loan), l));

                this._openLoanIndex.clear();
                (items || []).forEach((it: any) => {
                    const loan = loanById.get(String(it.loan_id));
                    if (!loan) return;
                    const codigo = (it.code || '').trim();
                    if (!codigo) return;
                    const di = this._toItem(loan, it);
                    const key = codigo.toUpperCase();
                    const arr = this._openLoanIndex.get(key) || [];
                    arr.push(di);
                    this._openLoanIndex.set(key, arr);
                });
            });
    }

    private _toItem(loan: any, it: any): DevolucionExternoItem {
        const loanDate = loan.loan_date || '';
        const diasFuera = loanDate
            ? Math.ceil(Math.abs(Date.now() - new Date(loanDate).getTime()) / 86400000)
            : 0;
        const qty = Number(it.quantity) || 1;
        return {
            idLoanItem:      Number(it.id_loan_item),
            idLoan:          Number(it.loan_id),
            loanNumber:      loan.loan_number || `PTT-${loan.id_loan}`,
            empresa:         loan.borrower_name || '—',
            borrowerLicense: loan.borrower_license || '',
            loanDate,
            diasFuera,
            loanNotes:       (loan.loan_notes || '').trim(),
            toolId:          Number(it.tool_id) || 0,
            codigo:          it.code || '',
            descripcion:     it.description || it.name || '',
            pn:              it.part_number || '',
            sn:              it.serial_number || '',
            und:             it.unit_of_measure || 'UND',
            marca:           it.brand || '',
            listaContenido:  it.content_list || '',
            fechaCalibracion: it.next_calibration_date || '',
            estadoAlPrestar: it.condition_on_loan || 'good',
            cantidadPrestada: qty,
            cantidadDevolver: qty,
            condicionDevolucion: 'BUENO',
            observacionItem: ''
        };
    }

    // ── Escaneo ────────────────────────────────────────────────────────────
    private _focusScan(): void {
        try { this.scanInputRef?.nativeElement.focus(); } catch { /* vista no lista */ }
    }

    onScanInput(v: string): void {
        this.scanValue = v;
        const q = v.trim().toLowerCase();
        if (!q) { this.scanSuggestions = []; this.showScanDropdown = false; return; }
        const vistos = new Set<string>();
        const ranked: { di: DevolucionExternoItem; rank: number }[] = [];
        this._openLoanIndex.forEach(arr => arr.forEach(di => {
            if (this.cart.some(c => c.idLoanItem === di.idLoanItem)) return;
            if (vistos.has(String(di.idLoanItem))) return;
            const code = (di.codigo || '').toLowerCase();
            let rank = -1;
            if (code === q) rank = 0;
            else if (code.startsWith(q)) rank = 1;
            else if (code.includes(q)) rank = 2;
            else if (`${di.descripcion} ${di.pn} ${di.sn} ${di.empresa} ${di.loanNumber}`.toLowerCase().includes(q)) rank = 3;
            if (rank >= 0) { vistos.add(String(di.idLoanItem)); ranked.push({ di, rank }); }
        }));
        ranked.sort((a, b) => a.rank - b.rank || a.di.codigo.localeCompare(b.di.codigo));
        this.scanSuggestions = ranked.slice(0, 12).map(r => r.di);
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
        if (!this.indexReady) { this.showMsg('warning', 'Cargando préstamos activos, espere un momento'); return; }
        const exactas = this._openLoanIndex.get(code.toUpperCase());
        if (exactas && exactas.length > 0) { this._agregarItem(exactas); return; }
        if (this.scanSuggestions.length === 1) { this._agregarItem([this.scanSuggestions[0]]); return; }
        if (this.scanSuggestions.length > 1) {
            this.showScanDropdown = true;
            this.showMsg('info', `${this.scanSuggestions.length} coincidencias — elija de la lista`);
            return;
        }
        this.showMsg('warning', `"${code}" no tiene un préstamo externo abierto para devolver`);
        this._clearScan();
    }

    pickScanSuggestion(di: DevolucionExternoItem): void {
        this.showScanDropdown = false;
        this._agregarItem([di]);
    }

    private _agregarItem(candidatos: DevolucionExternoItem[]): void {
        const libre = candidatos.find(di => !this.cart.some(c => c.idLoanItem === di.idLoanItem));
        if (!libre) {
            this.showMsg('info', `"${candidatos[0].codigo}" ya está en la lista de devolución`);
            this._clearScan();
            return;
        }
        this.cart = [...this.cart, { ...libre }];
        // "Devuelto por" arranca con la empresa/cliente del préstamo (editable).
        if (!this.returnedByName.trim() && libre.empresa && libre.empresa !== '—') {
            this.returnedByName = libre.empresa;
        }
        this.showMsg('success', `"${libre.descripcion}" — prestada a ${libre.empresa}`);
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

    // ── "Devuelto por" — autocompletado desde el catálogo de clientes/empresas ──
    private _setupReturnedBySearch(): void {
        // Cache local de clientes (he.tcustomers) — el mismo catálogo del módulo
        // "Clientes / Terceros" y del form de préstamo externo.
        this.returnedByLoading = true;
        this.customerSvc.getCustomers({ limit: 1000 }).pipe(
            takeUntil(this.destroy$),
            finalize(() => this.returnedByLoading = false),
            catchError(() => of([]))
        ).subscribe((cs: any[]) => {
            this._clientesCache = (cs || [])
                .filter(c => c.active !== false && c.active !== 'f' && c.active !== 'false')
                .map(c => ({
                    nombre: c.name || c.company_name || '',
                    cargo:  [c.tax_id ? 'NIT ' + c.tax_id : '', c.contact_person].filter(Boolean).join(' · ')
                }))
                .filter(c => c.nombre);
        });

        this._returnedBySearch$.pipe(
            debounceTime(150), distinctUntilChanged(), takeUntil(this.destroy$)
        ).subscribe(t => {
            const q = (t || '').trim().toLowerCase();
            if (q.length < 1) { this.returnedByFuncionarios = []; this.showReturnedByDropdown = false; return; }
            this.returnedByFuncionarios = this._clientesCache
                .filter(c => `${c.nombre} ${c.cargo}`.toLowerCase().includes(q))
                .slice(0, 10);
            this.showReturnedByDropdown = this.returnedByFuncionarios.length > 0;
        });
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

    /** Atajo: usar la empresa del préstamo escaneado como "devuelto por". */
    usarEmpresaComoDevuelve(): void {
        if (!this.cart.length) return;
        this.returnedByName = this.cart[0].empresa;
    }

    // ── "Recibido por (Almacén)" ───────────────────────────────────────────
    private _setupResponsableSearch(): void {
        this.movementSvc.getPersonal().pipe(
            takeUntil(this.destroy$), catchError(() => of([]))
        ).subscribe((lista: any[]) => {
            this._personalCache = (lista || []).map(f => ({
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
        this.devForm.patchValue({ responsableRecibe: val });
        this._responsableSearch$.next(val);
    }
    selectResponsable(r: any): void {
        this.devForm.patchValue({ responsableRecibe: r.nombre });
        this.showResponsableDropdown = false;
    }
    hideResponsableDropdown(): void { setTimeout(() => this.showResponsableDropdown = false, 150); }

    // ── Ítems del carrito ──────────────────────────────────────────────────
    hasError(field: string, error: string): boolean {
        const c = this.devForm.get(field);
        return c ? c.hasError(error) && c.touched : false;
    }

    private readonly _condicionLabelMap: Record<string, string> = {
        'good': 'ACTIVO', 'new': 'NUEVO', 'excellent': 'EXCELENTE',
        'fair': 'REGULAR', 'poor': 'MALO', 'damaged': 'DAÑADO',
        'serviceable': 'ACTIVO', 'bueno': 'ACTIVO',
    };
    getEstadoPrestarLabel(est: string): string {
        return this._condicionLabelMap[(est || '').toLowerCase()] || (est || '—').toUpperCase();
    }

    getCondicionIcon(c: string): string { return this.condiciones.find(x => x.value === c)?.icon || 'help_outline'; }
    validateCantidad(item: DevolucionExternoItem): void {
        if (item.cantidadDevolver < 1) item.cantidadDevolver = 1;
        if (item.cantidadDevolver > item.cantidadPrestada) item.cantidadDevolver = item.cantidadPrestada;
    }

    private _validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!this.cart.length) { errors.push('Escanee al menos una herramienta'); return { valid: false, errors }; }
        if (!this.returnedByName.trim()) errors.push('Indique quién devuelve la herramienta');
        if (!this.devForm.get('responsableRecibe')?.value?.trim()) errors.push('Indique quién recibe en el almacén');
        this.cart.forEach(i => {
            if (i.cantidadDevolver <= 0 || i.cantidadDevolver > i.cantidadPrestada) errors.push(`${i.codigo}: cantidad inválida`);
            if ((i.condicionDevolucion === 'PARCIAL' || i.condicionDevolucion === 'NO_REPARABLE') && !i.observacionItem.trim()) errors.push(`${i.codigo}: falta observación`);
        });
        return { valid: errors.length === 0, errors };
    }

    getResumen(): { condicion: string; cantidad: number; bgColor: string }[] {
        const mapa: Record<string, number> = {};
        this.cart.forEach(i => { mapa[i.condicionDevolucion] = (mapa[i.condicionDevolucion] || 0) + 1; });
        return Object.entries(mapa).map(([k, v]) => {
            const cfg = this.condiciones.find(c => c.value === k);
            return { condicion: cfg?.label || k, cantidad: v, bgColor: cfg?.bgColor || 'bg-gray-500' };
        });
    }
    trackByCondicion = (_: number, r: { condicion: string }): string => r.condicion;

    get empresasCarrito(): string[] {
        return [...new Set(this.cart.map(i => i.empresa).filter(Boolean))];
    }

    abrirConfirm(): void {
        const val = this._validate();
        if (!val.valid) { val.errors.forEach(e => this.showMsg('error', e)); return; }
        this._confirmRef = this.dialog.open(this.confirmDevModal, {
            width: 'min(920px, 95vw)', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true
        });
    }
    cerrarConfirm(): void { this._confirmRef?.close(); }

    finalizar(): void {
        const val = this._validate();
        if (!val.valid) { val.errors.forEach(e => this.showMsg('error', e)); return; }
        this.cerrarConfirm();
        this.isSaving = true;
        const notaWin = this.movementSvc.preAbrirVentanaPdf();
        const fv = this.devForm.value;
        const empresa = this.empresasCarrito[0] || '';
        const itemsJson = JSON.stringify(this.cart.map(i => ({
            tool_id: i.toolId, id_loan_item: i.idLoanItem,
            quantity: i.cantidadDevolver, condicion: i.condicionDevolucion,
            unit_of_measure: i.und || '', content_list: i.listaContenido || '',
            estado_al_prestar: i.estadoAlPrestar || '', notes: i.observacionItem || ''
        })));
        this.movementSvc.registrarDevolucionPrestamo({
            type: 'DEVOLUCION_PRESTAMO_EXTERNO',
            date: fv.fechaDevolucion,
            time: fv.horaDevolucion || new Date().toTimeString().slice(0, 5),
            requested_by_name:  this.returnedByName.trim(),
            responsible_person: fv.responsableRecibe,
            returned_by_name:   this.returnedByName.trim(),
            recipient:          empresa,
            customer:           empresa,
            notes:              fv.observaciones || '',
            items_json:         itemsJson
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.showMsg('success', `Devolución registrada: ${nro}`);
                const loanIds = [...new Set(this.cart.map(i => i.idLoan).filter(Boolean))];
                loanIds.forEach((id, i) => this.movementSvc.verNotaPrestamo(id, 'mgh100', true, i === 0 ? notaWin : null));
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
