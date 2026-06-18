import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, switchMap, map, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service';

type CondicionDevolucion = 'BUENO' | 'DAÑADO' | 'IRREPARABLE' | 'REQUIERE_CALIBRACION' | 'FALTANTE';

interface DevolucionItem {
    toolId?: string; imagen?: string; codigo: string; descripcion: string; pn: string; sn: string;
    und: string; marca?: string; listaContenido: string; fechaCalibracion: string;
    estadoAlPrestar: string; fechaPrestamo: string; cantidadPrestada: number;
    cantidadDevolver: number; aeronave: string; ordenTrabajo?: string;
    diasFuera: number; condicionDevolucion: CondicionDevolucion;
    observacionItem: string; selected: boolean;
}

@Component({
    selector: 'app-form-devolucion-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatCheckboxModule, MatDialogModule,
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

    dialogRef         = inject(MatDialogRef<FormDevolucionDialogComponent>);
    private _confirmDialogRef: any = null;

    private dialog      = inject(MatDialog);
    private fb          = inject(FormBuilder);
    private snackBar    = inject(MatSnackBar);
    private movementSvc = inject(MovementService);
    private destroy$    = new Subject<void>();

    isSaving      = false;
    isSearching   = false;
    sinResultados = false;
    loanNotes     = '';

    private _loanNumber   = '';
    private _loanDate     = '';
    private _aircraft     = '';
    private _department   = '';
    private _deliveredBy  = '';

    devolucionForm!: FormGroup;
    dataSourceDevolucion: DevolucionItem[] = [];

    private _funcionarioSearch$ = new Subject<string>();
    funcionariosFiltrados:  any[] = [];
    funcionarioLoading      = false;
    showFuncionarioDropdown = false;
    _funcionarioNombre   = '';
    _funcionarioLicencia = '';

    private _responsableSearch$ = new Subject<string>();
    responsablesFiltrados:  any[] = [];
    responsableLoading      = false;
    showResponsableDropdown = false;
    _responsableNombre = '';
    private _personalCache: any[] = [];

    private todasLasHerramientas: any[] = [];
    herramientasFiltradas: any[] = [];
    showHerramientaDropdown    = false;
    _herramientaSeleccionada: { codigo: string; nombre: string } | null = null;

    condiciones: { value: CondicionDevolucion; label: string; bgColor: string; icon: string }[] = [
        { value: 'BUENO',                label: 'Bueno',       bgColor: 'bg-green-500',  icon: 'check_circle'   },
        { value: 'DAÑADO',               label: 'Dañado',      bgColor: 'bg-red-500',    icon: 'report_problem' },
        { value: 'REQUIERE_CALIBRACION', label: 'Req. Calib.', bgColor: 'bg-yellow-500', icon: 'build'          },
        { value: 'IRREPARABLE',          label: 'Irreparable', bgColor: 'bg-gray-800',   icon: 'delete_forever' },
        { value: 'FALTANTE',             label: 'Faltante',    bgColor: 'bg-red-700',    icon: 'help_outline'   }
    ];

    private readonly _statusBloqueado = new Set(['decommissioned', 'in_calibration', 'quarantine', 'in_maintenance']);

    ngOnInit(): void {
        this.initDevolucionForm();
        this._setupFuncionarioSearch();
        this._setupResponsableSearch();
        this._cargarHerramientas();
    }

    ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

    private _localDateStr(d = new Date()): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    private initDevolucionForm(): void {
        const now = new Date();
        const hora = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        this.devolucionForm = this.fb.group({
            funcionario:       [''],
            codigoHerramienta: [''],
            unidadDestino:     [''],
            ordenTrabajo:      [''],
            fechaDevolucion:   [this._localDateStr(), Validators.required],
            horaDevolucion:    [hora, Validators.required],
            responsableRecibe: [''],
            observaciones:     ['']
        });
    }

    private _setupFuncionarioSearch(): void {
        this._funcionarioSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showFuncionarioDropdown = false; return of([]); }
                this.funcionarioLoading = true;
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({ id: String(f.id_employee || f.id), nombre: f.nombreCompleto || `${f.nombre||''} ${f.apellido_paterno||''}`.trim(), cargo: f.cargo || '', licencia: f.licencia || f.nro_licencia || '' }))
                    ),
                    finalize(() => this.funcionarioLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { this.funcionariosFiltrados = res || []; this.showFuncionarioDropdown = this.funcionariosFiltrados.length > 0; });
    }

    onFuncionarioInput(val: string): void {
        this.devolucionForm.patchValue({ funcionario: val });
        this._funcionarioNombre   = '';
        this._funcionarioLicencia = '';
        this._funcionarioSearch$.next(val);
    }
    selectFuncionario(f: any): void { this._funcionarioNombre = f.nombre; this._funcionarioLicencia = f.licencia; this.devolucionForm.patchValue({ funcionario: f.nombre }); this.showFuncionarioDropdown = false; }
    hideFuncionarioDropdown(): void { setTimeout(() => this.showFuncionarioDropdown = false, 150); }

    private _setupResponsableSearch(): void {
        // Carga personal una sola vez al iniciar
        this.movementSvc.getPersonal().pipe(
            takeUntil(this.destroy$), catchError(() => of([]))
        ).subscribe((lista: any[]) => {
            this._personalCache = (lista || []).map(f => ({
                id:     String(f.id_employee || f.id),
                nombre: f.nombreCompleto || `${f.nombre||''} ${f.apellido_paterno||''}`.trim(),
                cargo:  f.cargo || '',
                area:   f.area  || f.cargo || ''
            }));
        });

        this._responsableSearch$.pipe(
            debounceTime(150), distinctUntilChanged(),
            takeUntil(this.destroy$)
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
        this._responsableNombre = val;
        this.devolucionForm.patchValue({ responsableRecibe: val });
        this._responsableSearch$.next(val);
    }
    selectResponsable(r: any): void {
        this._responsableNombre = r.nombre;
        this.devolucionForm.patchValue({
            responsableRecibe: r.nombre,
            unidadDestino: r.area || r.cargo || this.devolucionForm.get('unidadDestino')?.value || ''
        });
        this.showResponsableDropdown = false;
    }
    hideResponsableDropdown(): void { setTimeout(() => this.showResponsableDropdown = false, 150); }

    private _toolDisponible(t: any): boolean {
        const status  = (t.status ?? t.tool_status ?? '').toLowerCase();
        const stock   = Number(t.quantity_in_stock ?? t.stock ?? t.existencia ?? 0);
        const expiry  = t.next_calibration_date ?? t.calibration_due_date ?? null;
        return !this._statusBloqueado.has(status) && stock > 0 && !(expiry && expiry < this._localDateStr());
    }

    private _cargarHerramientas(): void {
        this.movementSvc.getHerramientasDisponibles({}).pipe(
            takeUntil(this.destroy$), catchError(() => of([]))
        ).subscribe((tools: any[]) => {
            this.todasLasHerramientas = (tools || [])
                .filter(t => this._toolDisponible(t))
                .map((t: any) => ({
                    id: t.id_tool ?? t.id, codigo: t.code ?? t.codigo ?? '',
                    nombre: t.name ?? t.nombre ?? '', pn: t.part_number ?? t.pn ?? ''
                }));
        });
    }

    onHerramientaInput(val: string): void {
        this.devolucionForm.patchValue({ codigoHerramienta: val });
        this._herramientaSeleccionada = null;
        const term = val.trim().toLowerCase();
        if (term.length < 2) { this.herramientasFiltradas = []; this.showHerramientaDropdown = false; return; }
        this.herramientasFiltradas = this.todasLasHerramientas
            .filter(h => h.codigo.toLowerCase().includes(term) || h.nombre.toLowerCase().includes(term) || h.pn.toLowerCase().includes(term))
            .slice(0, 12);
        this.showHerramientaDropdown = this.herramientasFiltradas.length > 0;
    }
    selectHerramienta(h: any): void { this._herramientaSeleccionada = { codigo: h.codigo, nombre: h.nombre }; this.devolucionForm.patchValue({ codigoHerramienta: h.codigo }); this.herramientasFiltradas = []; this.showHerramientaDropdown = false; }
    clearHerramienta(): void { this._herramientaSeleccionada = null; this.devolucionForm.patchValue({ codigoHerramienta: '' }); this.herramientasFiltradas = []; this.showHerramientaDropdown = false; }
    hideHerramientaDropdown(): void { setTimeout(() => this.showHerramientaDropdown = false, 150); }

    hasError(field: string, error: string): boolean { const c = this.devolucionForm.get(field); return c ? c.hasError(error) && c.touched : false; }
    isBusquedaValida(): boolean { const f = this.devolucionForm.value; return !!(f.funcionario?.trim() || f.codigoHerramienta?.trim()); }

    realizarConsulta(): void {
        const nombre       = (this._funcionarioNombre || this.devolucionForm.get('funcionario')?.value || '').trim();
        const codigoFiltro = (this.devolucionForm.get('codigoHerramienta')?.value || '').trim();

        if (!nombre && !codigoFiltro) { this.showMsg('warning', 'Ingrese técnico o herramienta para buscar'); return; }

        this.isSearching   = true;
        this.sinResultados = false;
        this.dataSourceDevolucion = [];
        this.loanNotes    = '';
        this._loanNumber  = '';
        this._loanDate    = '';
        this._aircraft    = '';
        this._department  = '';
        this._deliveredBy = '';

        let filtro = `status = 'active' AND loan_type = 'internal'`;
        if (nombre) {
            const nombreSafe = nombre.replace(/'/g, "''");
            // Usar licencia solo si el nombre del form coincide con el seleccionado del dropdown
            const licSafe = (nombre === this._funcionarioNombre) ? this._funcionarioLicencia.replace(/'/g, "''") : '';
            filtro += ` AND (borrower_name ILIKE '%${nombreSafe}%'` + (licSafe ? ` OR borrower_license = '${licSafe}'` : '') + `)`;
        }

        // 1. Primero obtener los préstamos filtrados por técnico
        // 2. Luego obtener SOLO los ítems de esos préstamos (returned = false)
        this.movementSvc.getActiveLoans({ filtro_adicional: filtro }).pipe(
            takeUntil(this.destroy$),
            switchMap((loans: any[]) => {
                // Filtro client-side por nombre: garantiza que aunque el backend devuelva
                // préstamos de más (ej: filtro ILIKE no aplicado), solo se muestran
                // los del técnico buscado.
                let loansMatch = loans || [];
                // Filtro client-side: nombre + solo préstamos aún activos.
                // Compensa que el backend a veces ignora el filtro ILIKE o status.
                loansMatch = loansMatch.filter((l: any) => l.status === 'active');
                if (nombre) {
                    const q = nombre.toLowerCase();
                    const lic = (nombre === this._funcionarioNombre) ? this._funcionarioLicencia : '';
                    loansMatch = loansMatch.filter((l: any) =>
                        (l.borrower_name || '').toLowerCase().includes(q) ||
                        (lic && l.borrower_license === lic)
                    );
                }
                if (!loansMatch.length) {
                    this.sinResultados = true;
                    return of({ loans: [] as any[], items: [] as any[] });
                }
                const loanIds = loansMatch.map((l: any) => l.id_loan).filter(Boolean);
                const itemsFiltro = `returned = false AND loan_id IN (${loanIds.join(',')})`;
                return forkJoin({
                    loans: of(loansMatch),
                    items: this.movementSvc.getActiveLoanItems({ filtro_adicional: itemsFiltro })
                });
            }),
            finalize(() => this.isSearching = false),
            takeUntil(this.destroy$)
        ).subscribe({
            next: ({ loans, items }: any) => {
                if (!loans?.length) { this.sinResultados = true; return; }
                const loan0 = loans[0] || {};
                this.loanNotes    = (loan0.loan_notes  || loan0.notes || '').trim();
                this._loanNumber  = (loans as any[]).map((l: any) => l.loan_number).filter(Boolean).join(' / ');
                this._loanDate    = loan0.loan_date    || '';
                this._aircraft    = [...new Set((loans as any[]).map((l: any) => l.aircraft).filter(Boolean))].join(' / ');
                this._department  = [...new Set((loans as any[]).map((l: any) => l.department).filter(Boolean))].join(' / ');
                this._deliveredBy = loan0.delivered_by_name || '';
                let resultado: DevolucionItem[] = loans.flatMap((loan: any) => {
                    const loanItems = (items || []).filter((i: any) => String(i.loan_id) === String(loan.id_loan));
                    return loanItems.map((item: any) => ({
                        toolId: String(item.tool_id || ''), codigo: item.code || '',
                        imagen: item.image_url || null, descripcion: item.description || item.name || '',
                        pn: item.part_number || '', sn: item.serial_number || '',
                        und: item.unit_of_measure || 'UND', marca: item.brand || '',
                        listaContenido: item.content_list || item.lista_contenido || '',
                        fechaCalibracion: item.next_calibration_date || item.calibration_date || '',
                        estadoAlPrestar: item.condition_on_loan || 'BUENO',
                        fechaPrestamo: loan.loan_date || '', cantidadPrestada: Number(item.quantity) || 1,
                        cantidadDevolver: Number(item.quantity) || 1, aeronave: loan.aircraft || '',
                        ordenTrabajo: loan.work_order_number || '',
                        diasFuera: loan.loan_date ? Math.ceil(Math.abs(new Date().getTime() - new Date(loan.loan_date).getTime()) / 86400000) : 0,
                        condicionDevolucion: 'BUENO' as CondicionDevolucion, observacionItem: '', selected: false
                    }));
                });
                if (codigoFiltro) {
                    const q = codigoFiltro.toLowerCase();
                    resultado = resultado.filter(i =>
                        i.codigo.toLowerCase().includes(q) ||
                        i.pn.toLowerCase().includes(q) ||
                        i.descripcion.toLowerCase().includes(q)
                    );
                }
                if (!resultado.length) { this.sinResultados = true; this.showMsg('info', 'Este técnico no tiene herramientas prestadas'); return; }
                this.sinResultados = false;
                this.dataSourceDevolucion = resultado;
                const ots = [...new Set((loans || []).map((l: any) => l.work_order_number).filter(Boolean))];
                if (ots.length === 1 && !this.devolucionForm.get('ordenTrabajo')?.value) {
                    this.devolucionForm.patchValue({ ordenTrabajo: ots[0] });
                }
                this.showMsg('success', `${resultado.length} herramienta(s) prestadas encontradas`);
            },
            error: (err: any) => this.showMsg('error', 'Error al consultar: ' + (err?.message || ''))
        });
    }

    toggleSelDevolucion(item: DevolucionItem): void { item.selected = !item.selected; }
    toggleAllDevolucion(e: any): void { this.dataSourceDevolucion.forEach(i => i.selected = e.checked); }
    isAllSelDevolucion(): boolean { return this.dataSourceDevolucion.length > 0 && this.dataSourceDevolucion.every(i => i.selected); }
    isSomeSelDevolucion(): boolean { return this.dataSourceDevolucion.some(i => i.selected) && !this.isAllSelDevolucion(); }
    getSelCountDevolucion(): number { return this.dataSourceDevolucion.filter(i => i.selected).length; }
    getSelDevolucionItems(): DevolucionItem[] { return this.dataSourceDevolucion.filter(i => i.selected); }

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

    getEstadoPrestarClass(est: string): string {
        const e = (est || '').toLowerCase();
        if (['good','serviceable','bueno','nuevo','new','excellent'].includes(e)) return 'bg-green-500 text-white';
        if (['fair','en_calibracion','reconditioned'].includes(e))                return 'bg-yellow-400 text-black';
        if (['damaged','poor','unserviceable'].includes(e))                       return 'bg-red-500 text-white';
        return 'bg-stone-400 text-white';
    }

    onCondicionChange(item: DevolucionItem): void { if (item.condicionDevolucion === 'BUENO') item.observacionItem = ''; }
    getCondicionIcon(cond: CondicionDevolucion): string { return this.condiciones.find(c => c.value === cond)?.icon || 'help_outline'; }
    validateCantidad(item: DevolucionItem): void { if (item.cantidadDevolver < 1) item.cantidadDevolver = 1; if (item.cantidadDevolver > item.cantidadPrestada) item.cantidadDevolver = item.cantidadPrestada; }

    getDiasFueraClass(dias: number): string {
        if (dias <= 3)  return 'bg-green-100 text-green-800 border-green-300';
        if (dias <= 7)  return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        if (dias <= 15) return 'bg-orange-100 text-orange-800 border-orange-300';
        return 'bg-red-100 text-red-800 border-red-400';
    }

    private _validateDevolucion(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const sel = this.getSelDevolucionItems();
        if (!sel.length) { errors.push('Seleccione al menos una herramienta'); return { valid: false, errors }; }
        sel.forEach(i => {
            if (i.cantidadDevolver <= 0 || i.cantidadDevolver > i.cantidadPrestada) errors.push(`${i.codigo}: Cantidad inválida`);
            if ((i.condicionDevolucion === 'DAÑADO' || i.condicionDevolucion === 'FALTANTE') && !i.observacionItem.trim()) errors.push(`${i.codigo}: Falta observación`);
        });
        return { valid: errors.length === 0, errors };
    }

    getResumenCondicion(): { condicion: string; cantidad: number; color: string }[] {
        const mapa: Record<string, number> = {};
        this.getSelDevolucionItems().forEach(i => { mapa[i.condicionDevolucion] = (mapa[i.condicionDevolucion] || 0) + 1; });
        return Object.entries(mapa).map(([k, v]) => {
            const cfg = this.condiciones.find(c => c.value === k);
            return { condicion: cfg?.label || k, cantidad: v, color: cfg?.bgColor || '' };
        });
    }

    abrirConfirmDevolucion(): void {
        const val = this._validateDevolucion();
        if (!val.valid) { val.errors.forEach(e => this.showMsg('error', e)); return; }
        if (!this.devolucionForm.get('responsableRecibe')?.value?.trim()) {
            this.showMsg('error', 'Ingrese quien recibe la herramienta');
            return;
        }
        this._confirmDialogRef = this.dialog.open(this.confirmDevolucionModal, {
            width: '700px', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true
        });
    }
    cerrarConfirmDevolucion(): void { this._confirmDialogRef?.close(); }

    finalizarDevolucion(): void {
        const val = this._validateDevolucion();
        if (!val.valid) { val.errors.forEach(e => this.showMsg('error', e)); return; }
        this.cerrarConfirmDevolucion();
        this.isSaving = true;
        const sel = this.getSelDevolucionItems();
        const itemsJson = JSON.stringify(sel.map(i => ({
            tool_id: Number(i.toolId), quantity: i.cantidadDevolver, condicion: i.condicionDevolucion,
            unit_of_measure: i.und || '', content_list: i.listaContenido || '',
            estado_al_prestar: i.estadoAlPrestar || '', notes: i.observacionItem || ''
        })));
        this.movementSvc.registrarDevolucionPrestamo({
            type: 'DEVOLUCION_PRESTAMO_INTERNO', date: this.devolucionForm.value.fechaDevolucion,
            time: this.devolucionForm.value.horaDevolucion || new Date().toTimeString().slice(0, 5),
            requested_by_name: this.devolucionForm.value.funcionario,
            responsible_person: this.devolucionForm.value.responsableRecibe,
            recipient: this.devolucionForm.value.funcionario,
            destination_unit: this.devolucionForm.value.unidadDestino || '',
            work_order_number: this.devolucionForm.value.ordenTrabajo || '',
            notes: this.devolucionForm.value.observaciones || '', items_json: itemsJson
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.showMsg('success', `Devolución registrada: ${nro}`);
                this._pdfDevolucion(nro, sel, this.devolucionForm.value);
                this.dataSourceDevolucion = this.dataSourceDevolucion.filter(i => !i.selected || i.cantidadDevolver < i.cantidadPrestada);
                this.dialogRef.close({ success: true, movement_number: nro });
            },
            error: (err: any) => this.showMsg('error', 'Error al registrar: ' + (err?.message || ''))
        });
    }

    cerrar(): void { this.dialogRef.close(); }

    private _pdfDevolucion(nro: string, items: DevolucionItem[], fv: any): void {
        const tecnico      = this._funcionarioNombre  || fv.funcionario    || '---';
        const licencia     = this._funcionarioLicencia || '---';
        const responsable  = fv.responsableRecibe     || '---';
        const fechaPrest   = this._loanDate ? new Date(this._loanDate).toLocaleString('es-BO') : '---';
        const fechaDev     = (fv.fechaDevolucion ? new Date(fv.fechaDevolucion).toLocaleDateString('es-BO', { day:'2-digit', month:'2-digit', year:'numeric' }) : new Date().toLocaleDateString('es-BO')) + (fv.horaDevolucion ? ' ' + fv.horaDevolucion : '');
        const nroPrest     = this._loanNumber  || '---';
        const condLabel: Record<string, string> = { BUENO:'Bueno', DAÑADO:'Dañado', REQUIERE_CALIBRACION:'Req. Calib.', IRREPARABLE:'Irreparable', FALTANTE:'Faltante' };
        const estadoLabel: Record<string, string> = { good:'SERVICEABLE', new:'NUEVO', excellent:'EXCELENTE', fair:'REGULAR', poor:'MALO', damaged:'DAÑADO' };

        const rowsPrest = items.map(it =>
            `<tr><td>${it.codigo||'-'}</td><td>${it.pn||'-'}</td><td>${it.sn||'-'}</td><td style="text-align:center;font-weight:700">${it.cantidadPrestada}</td><td>${it.und||'UND'}</td><td>${it.descripcion||'-'}</td><td>${it.listaContenido||'-'}</td><td>${it.fechaCalibracion||'-'}</td><td>${estadoLabel[(it.estadoAlPrestar||'').toLowerCase()]||it.estadoAlPrestar||'-'}</td><td>${this.loanNotes||''}</td></tr>`
        ).join('');

        const rowsDev = items.map(it =>
            `<tr><td>${fechaDev}</td><td>${tecnico}</td><td>&nbsp;</td><td>${responsable}</td><td>&nbsp;</td><td style="font-weight:700;color:${it.condicionDevolucion==='BUENO'?'#166534':'#dc2626'}">${condLabel[it.condicionDevolucion]||it.condicionDevolucion}</td><td>&nbsp;</td><td>${it.observacionItem||fv.observaciones||''}</td></tr>`
        ).join('');

        const css = `<style>@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:0}.top{display:flex;justify-content:space-between;margin-bottom:5px}.code-box{border:2px solid #000;padding:3px 10px;font-weight:900;font-size:13px;display:inline-block}h1{text-align:center;font-size:12px;font-weight:900;text-transform:uppercase;background:#111A43;color:white;padding:7px 10px;margin:0 0 7px;border:1px solid #000}.info-tbl{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:7px}.info-tbl td{border:1px solid #ddd;padding:3px 6px}.lbl{background:#f0f0f0;font-weight:700;font-size:9px;width:130px}.nro-cell{background:#f0f0f0;text-align:center;font-weight:900;font-size:13px;vertical-align:middle;width:110px}.sec{background:#111A43;color:white;padding:3px 8px;font-weight:900;font-size:10px;text-transform:uppercase;border:1px solid #000}table.det{width:100%;border-collapse:collapse;border:1px solid #000}table.det th{background:#111A43;color:white;padding:5px 4px;font-size:8.5px;font-weight:900;text-transform:uppercase;border:1px solid #000;text-align:center}table.det td{padding:4px;border:1px solid #ddd;font-size:9px}table.det tr:nth-child(even) td{background:#f9f9f9}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.sig{border:1px solid #000;padding:6px 8px;text-align:center}.sig-ttl{font-weight:900;font-size:9px;text-transform:uppercase;margin-bottom:26px;line-height:1.4}.sig-line{border-top:1px solid #000;padding-top:3px;font-size:8.5px}.footer{text-align:center;margin-top:10px;font-size:7.5px;color:#888;border-top:1px dotted #ccc;padding-top:4px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MGH-100 ${nroPrest} / ${nro}</title>${css}</head><body>
<div class="top"><div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145#114 &nbsp; N-114</div><div style="text-align:right"><div class="code-box">MGH-100</div><br><span style="font-size:9px">REV. 0 &nbsp; 2016-10-13</span></div></div>
<h1>NOTA DE PRÉSTAMO - DEVOLUCIÓN<br><span style="font-size:10px;font-weight:400">HERRAMIENTAS, BANCOS DE PRUEBA Y EQUIPOS DE APOYO</span></h1>
<table class="info-tbl">
<tr><td class="lbl">NOMBRE SOLICITANTE:</td><td>${tecnico}</td><td class="lbl">UNIDAD DESTINO:</td><td>${this._department||fv.unidadDestino||''}</td><td class="nro-cell" rowspan="4"><div style="font-size:7px;font-weight:400">N° PRÉSTAMO</div><div>${nroPrest}</div><div style="font-size:7px;font-weight:400;margin-top:6px">N° DEVOLUCIÓN</div><div>${nro}</div></td></tr>
<tr><td class="lbl">LICENCIA:</td><td>${licencia}</td><td class="lbl">ORDEN DE TRABAJO:</td><td>${fv.ordenTrabajo||''}</td></tr>
<tr><td class="lbl">MATRÍCULA AERONAVE:</td><td>${this._aircraft||''}</td><td class="lbl">ENTREGÓ (ALMACÉN):</td><td>${this._deliveredBy||''}</td></tr>
<tr><td class="lbl">FECHA PRÉSTAMO:</td><td>${fechaPrest}</td><td class="lbl">OBSERVACIONES:</td><td>${this.loanNotes||''}</td></tr>
</table>
<div class="sec">DATOS PRÉSTAMO</div>
<table class="det"><thead><tr><th>CÓDIGO</th><th>P/N ó MODELO</th><th>S/N</th><th>CANT.</th><th>UND</th><th>DESCRIPCIÓN</th><th>LISTA CONTENIDO</th><th>FECHA CALIBRACIÓN</th><th>ESTADO</th><th>OBS</th></tr></thead><tbody>${rowsPrest}</tbody></table>
<div class="sec" style="margin-top:6px">DATOS DEVOLUCIÓN</div>
<table class="det"><thead><tr><th>FECHA/HORA</th><th colspan="2">ENTREGUE CONFORME (NOMBRE/FIRMA)</th><th colspan="2">RECIBI CONFORME (NOMBRE/FIRMA)</th><th>CONDICIÓN DEVOLUCIÓN</th><th>NRO. REPORTE AVERÍA</th><th>OBS</th></tr></thead><tbody>${rowsDev}</tbody></table>
<div class="sigs"><div class="sig"><div class="sig-ttl">ENTREGADO POR<br>FIRMA ALMACÉN HERRAMIENTAS</div><div style="font-size:9px;margin-bottom:20px">${this._deliveredBy||responsable}</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">RECIBIDO POR<br>FIRMA TÉC. O INSP. (PRÉSTAMO)</div><div style="font-size:9px;margin-bottom:20px">${tecnico}</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">DEVUELVE CONFORME / RECIBE ALMACÉN</div><div style="font-size:9px;margin-bottom:12px">${tecnico} → ${responsable}</div><div class="sig-line">&nbsp;</div></div></div>
<div class="footer">BOLIVIANA DE AVIACIÓN — Almacén de Herramientas | Generado: ${new Date().toLocaleString('es-BO')} | Préstamo: ${nroPrest} | Devolución: ${nro}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
</body></html>`;
        this._abrirBlob(html);
    }

    private _abrirBlob(html: string): void {
        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    private showMsg(type: 'success' | 'error' | 'info' | 'warning', text: string): void {
        this.snackBar.open(text, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
