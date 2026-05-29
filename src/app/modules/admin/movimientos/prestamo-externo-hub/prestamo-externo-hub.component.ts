import { Component, OnInit, OnDestroy, signal, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, catchError } from 'rxjs/operators';
import { MovementService } from '../../../../core/services/movement.service';
import { ModalHerramientaExternoComponent } from '../prestamo-terceros/modal-herramienta-externo/modal-herramienta-externo.component';

// ── Interfaces ───────────────────────────────────────────────────────────────
interface ExternalLoanItem {
    toolId: number; id: number; codigo: string; pn: string; descripcion: string; sn: string;
    marca: string; fechaCalibracion: string; cantidad: number; horas: number; estado: string;
    contenido: string; costoHora: number; precioTotal: number; selected?: boolean;
}

interface DevolucionTerceroItem {
    id: number; fila: number; toolId?: string; codigo: string; pn: string; sn: string;
    descripcion: string; marca: string; fechaSalida: string; diasFuera: number; cantidad: number;
    nroNotaSalida: string; tipoContrato: string; proyecto: string; estado: string;
    condicionDevolucion: string; observaciones: string; selected?: boolean;
}

type TabType = 'prestamo' | 'devolucion';

// ── Component ────────────────────────────────────────────────────────────────
@Component({
    selector: 'app-prestamo-externo-hub',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatTableModule, MatCheckboxModule, MatDialogModule,
        MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule
    ],
    templateUrl: './prestamo-externo-hub.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar-ext::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ext::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ext::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar-ext::-webkit-scrollbar-thumb { background: #cbd5e1; }
        [hidden] { display: none !important; }
        .row-selected { background-color: #f3e8ff !important; }
        :host-context(.dark) .row-selected { background-color: rgba(113,19,207,0.15) !important; }
        @keyframes pulse-border {
            0%,100% { border-color:#ef4444; box-shadow:0 0 0 0 rgba(239,68,68,.4); }
            50% { border-color:#f87171; box-shadow:0 0 0 4px rgba(239,68,68,0); }
        }
        .animate-pulse-border { animation: pulse-border 2s cubic-bezier(.4,0,.6,1) infinite; }
    `]
})
export class PrestamoExternoHubComponent implements OnInit, OnDestroy {

    @ViewChild('datosExternoModal')      datosExternoModal!:      TemplateRef<any>;
    @ViewChild('confirmExternoModal')    confirmExternoModal!:    TemplateRef<any>;
    @ViewChild('busquedaModal')          busquedaModal!:          TemplateRef<any>;
    @ViewChild('confirmDevolucionModal') confirmDevolucionModal!: TemplateRef<any>;

    public  dialogRef      = inject(MatDialogRef<PrestamoExternoHubComponent>, { optional: true });
    private dialogRefActual: MatDialogRef<any> | null = null;
    private dialog         = inject(MatDialog);
    private fb             = inject(FormBuilder);
    private snackBar       = inject(MatSnackBar);
    private movementSvc    = inject(MovementService);
    private destroy$       = new Subject<void>();

    // ── Tab
    activeTab = signal<TabType>('prestamo');

    // ── Estado general
    isSaving    = false;
    isSearching = false;

    // ── Terceros (shared between both tabs)
    private _tercerosList: any[] = [];
    nroNotaExterno = signal<string>('---');

    // ─────────────── PRÉSTAMO EXTERNO ───────────────
    externalForm!: FormGroup;
    externalDataSource = signal<ExternalLoanItem[]>([]);
    importeTotal       = signal<number>(0);

    _empresaSeleccionada: any = null;
    empresasFiltradas:    any[] = [];
    showEmpresasDropdown  = false;

    tiposMotivoPrestamo = [
        { value: 'ALQUILER',          label: 'Alquiler por Contrato' },
        { value: 'APOYO_MUTUO',       label: 'Apoyo Mutuo Operacional' },
        { value: 'REPARACION_EXTERNA',label: 'Reparación Externa' },
        { value: 'CALIBRACION',       label: 'Calibración Externa' }
    ];

    displayedExternalColumns = ['select','codigo','pn','descripcion','sn','cantidad','horas','total','acciones'];

    private readonly conditionMap: Record<string,string> = {
        'SERVICEABLE':'good','NUEVO':'new','NEW':'new','EN_CALIBRACION':'fair',
        'UNSERVICEABLE':'damaged','EN_REPARACION':'poor','BUENO':'good','REGULAR':'fair','MALO':'poor'
    };

    // ─────────────── DEVOLUCIÓN TERCEROS ───────────────
    devolucionForm!: FormGroup;
    dataSourceDevolucion: DevolucionTerceroItem[] = [];
    private _itemIdCounter = 1;

    _terceroSeleccionado: any = null;
    tercerosFiltrados:    any[] = [];
    showTercerosDropdown  = false;

    tiposEmpresa = [
        { value: 'CALIBRACION',   label: 'Calibración',  color: 'bg-blue-100 text-blue-800 border-blue-400' },
        { value: 'REPARACION',    label: 'Reparación',   color: 'bg-orange-100 text-orange-800 border-orange-400' },
        { value: 'MANTENIMIENTO', label: 'Mantenimiento',color: 'bg-purple-100 text-purple-800 border-purple-400' },
        { value: 'PROVEEDOR',     label: 'Proveedor',    color: 'bg-green-100 text-green-800 border-green-400' }
    ];

    condicionesDevolucion = [
        { value: 'BUENO',        label: 'Bueno',       bgColor: 'bg-green-500',  icon: 'check_circle' },
        { value: 'REPARADO',     label: 'Reparado',    bgColor: 'bg-blue-500',   icon: 'build' },
        { value: 'CALIBRADO',    label: 'Calibrado',   bgColor: 'bg-cyan-500',   icon: 'tune' },
        { value: 'PARCIAL',      label: 'Parcial',     bgColor: 'bg-yellow-500', icon: 'construction' },
        { value: 'NO_REPARABLE', label: 'No Reparable',bgColor: 'bg-red-700',    icon: 'dangerous' }
    ];

    displayedDevolucionColumns = [
        'select','fila','identificacion','descripcion','tipoContrato','fechaSalida','diasFuera','cantidad','condicion','observaciones'
    ];

    // ── Lifecycle
    ngOnInit(): void {
        this.initExternalForm();
        this.initDevolucionForm();
        this._cargarTerceros();
    }

    ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

    setTab(tab: TabType): void { this.activeTab.set(tab); }

    // ── Form init
    private initExternalForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const now   = new Date();
        const hh    = now.getHours().toString().padStart(2,'0');
        const mm    = now.getMinutes().toString().padStart(2,'0');
        this.externalForm = this.fb.group({
            buscarEmpresa:       [''],
            nombreEmpresa:       ['', Validators.required],
            nit:                 [''],
            contacto:            [''],
            telefono:            [''],
            fecha:               [today,        Validators.required],
            hora:                [`${hh}:${mm}`, Validators.required],
            motivoPrestamo:      ['', Validators.required],
            autorizado:          [''],
            observaciones:       ['']
        });
    }

    private initDevolucionForm(): void {
        this.devolucionForm = this.fb.group({
            tercero:           ['', Validators.required],
            codigoHerramienta: [''],
            fechaDevolucion:   [new Date().toISOString().split('T')[0], Validators.required],
            observaciones:     ['']
        });
    }

    // ── Terceros (shared)
    private _cargarTerceros(): void {
        this.movementSvc.getTerceros().pipe(
            takeUntil(this.destroy$), catchError(() => of([]))
        ).subscribe((data: any[]) => {
            this._tercerosList = (data || []).map((t: any) => ({
                id:             t.id          || t.id_customer   || '',
                nit:            t.nit         || t.tax_id        || '',
                razonSocial:    t.razonSocial || t.nombre        || t.name || '',
                nombreContacto: t.nombreContacto || t.contact_name || '',
                telefono:       t.telefono   || t.phone          || '',
                tipoEmpresa:    t.tipoEmpresa || t.type          || 'PROVEEDOR'
            }));
            this.empresasFiltradas  = [...this._tercerosList];
            this.tercerosFiltrados  = [...this._tercerosList];
        });
    }

    // ── Empresa autocomplete (Préstamo)
    onEmpresaInput(val: string): void {
        this.externalForm.patchValue({ buscarEmpresa: val, nombreEmpresa: val }, { emitEvent: false });
        this._empresaSeleccionada = null;
        const q = val.trim().toLowerCase();
        this.empresasFiltradas = q.length < 2 ? [] : this._tercerosList
            .filter(e => e.razonSocial.toLowerCase().includes(q) || e.nit.toLowerCase().includes(q))
            .slice(0, 10);
        this.showEmpresasDropdown = this.empresasFiltradas.length > 0;
    }
    selectEmpresa(e: any): void {
        this._empresaSeleccionada = e;
        this.externalForm.patchValue({ buscarEmpresa: e.razonSocial, nombreEmpresa: e.razonSocial, nit: e.nit || '', contacto: e.nombreContacto || '', telefono: e.telefono || '' });
        this.showEmpresasDropdown = false;
    }
    hideEmpresasDropdown(): void { setTimeout(() => this.showEmpresasDropdown = false, 150); }

    // ── Tercero autocomplete (Devolución)
    onTerceroInput(val: string): void {
        this.devolucionForm.patchValue({ tercero: val });
        this._terceroSeleccionado = null;
        const q = val.trim().toLowerCase();
        this.tercerosFiltrados = q.length < 2 ? [] : this._tercerosList
            .filter(t => t.razonSocial.toLowerCase().includes(q) || t.nit.toLowerCase().includes(q))
            .slice(0, 10);
        this.showTercerosDropdown = this.tercerosFiltrados.length > 0;
    }
    selectTercero(t: any): void {
        this._terceroSeleccionado = t;
        this.devolucionForm.patchValue({ tercero: t.razonSocial });
        this.showTercerosDropdown = false;
    }
    hideTercerosDropdown(): void { setTimeout(() => this.showTercerosDropdown = false, 150); }

    // ── Modales préstamo
    abrirModalDatosExterno(): void { this.dialogRefActual = this.dialog.open(this.datosExternoModal, { width:'650px', maxWidth:'95vw', panelClass:'no-padding-dialog', disableClose:true }); }
    cerrarModalDatosExterno(): void { this.dialogRefActual?.close(); }

    isExternalDataValid(): boolean { return this.externalForm.valid; }
    hasErrorExternal(field: string, error: string): boolean { const c = this.externalForm.get(field); return c ? c.hasError(error) && c.touched : false; }

    procesarExterno(): void {
        this.externalForm.markAllAsTouched();
        if (this.externalForm.invalid) { this.showMsg('error', 'Complete los datos de la empresa'); this.abrirModalDatosExterno(); return; }
        if (this.externalDataSource().length === 0) { this.showMsg('warning', 'Agregue al menos una herramienta'); return; }
        this.dialogRefActual = this.dialog.open(this.confirmExternoModal, { width:'650px', maxWidth:'95vw', panelClass:'no-padding-dialog', disableClose:true });
    }
    cerrarModalConfirmExterno(): void { this.dialogRefActual?.close(); }

    finalizarExterno(): void {
        this.cerrarModalConfirmExterno();
        this.isSaving = true;
        const fv    = this.externalForm.getRawValue();
        const items = this.externalDataSource();
        const itemsJson = JSON.stringify(items.map(i => ({
            tool_id: i.toolId, quantity: i.cantidad, notes: i.contenido || '',
            condition: this.conditionMap[i.estado?.toUpperCase()] || 'good',
            unit_cost: i.costoHora || 0, total_cost: i.precioTotal || 0
        })));
        this.movementSvc.registrarPrestamoMultiple({
            type: 'PRESTAMO_EXTERNO', date: fv.fecha, time: fv.hora,
            requested_by_name: fv.nombreEmpresa, customer: fv.nombreEmpresa,
            authorized_by: fv.autorizado || '', recipient: fv.contacto || '',
            notes: fv.motivoPrestamo || '', specific_observations: fv.observaciones || '',
            items_json: itemsJson
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.nroNotaExterno.set(nro);
                this._imprimirPrestamoExterno(nro, fv, items);
                this.showMsg('success', `Préstamo externo registrado: ${nro}`);
                this.externalDataSource.set([]);
                this.importeTotal.set(0);
                this.initExternalForm();
                this._empresaSeleccionada = null;
                if (this.dialogRef) this.dialogRef.close({ success: true, movement_number: nro });
            },
            error: (err: any) => this.showMsg('error', err?.message || 'Error al registrar')
        });
    }

    // ── Items préstamo externo
    openHerramientasAPrestar(): void {
        const ref = this.dialog.open(ModalHerramientaExternoComponent, { width:'850px', maxWidth:'95vw', panelClass:'no-padding-dialog', disableClose:true });
        ref.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                const d = result.data;
                const item: ExternalLoanItem = {
                    toolId: d.id_tool ?? 0, id: Date.now(), codigo: d.codigo || '', pn: d.pn || '',
                    descripcion: d.nombre || '', sn: d.sn || '', marca: d.marca || '',
                    fechaCalibracion: d.fechaVencimiento || '', cantidad: d.cantidad || 1,
                    horas: d.horas || 1, estado: d.estado || 'SERVICEABLE', contenido: d.observacion || '',
                    costoHora: d.costoHora || 0, precioTotal: (d.horas || 1) * (d.costoHora || 0), selected: false
                };
                this.externalDataSource.update(list => [...list, item]);
                this.calcularImporteTotal();
                this.showMsg('success', `"${item.descripcion}" agregada`);
            }
        });
    }

    toggleSelExternal(item: ExternalLoanItem): void { item.selected = !item.selected; this.externalDataSource.set([...this.externalDataSource()]); }
    toggleAllExternal(e: any): void { this.externalDataSource.set(this.externalDataSource().map(i => ({ ...i, selected: e.checked }))); }
    isAllSelExternal(): boolean { return this.externalDataSource().length > 0 && this.externalDataSource().every(i => i.selected); }
    isSomeSelExternal(): boolean { return this.externalDataSource().some(i => i.selected) && !this.isAllSelExternal(); }
    getSelCountExternal(): number { return this.externalDataSource().filter(i => i.selected).length; }
    calcularImporteTotal(): void { this.importeTotal.set(this.externalDataSource().reduce((s, i) => s + (i.precioTotal || 0), 0)); }
    eliminarItemExterno(idx: number): void {
        const item = this.externalDataSource()[idx];
        this.externalDataSource.update(list => list.filter((_, i) => i !== idx));
        this.calcularImporteTotal();
        this.showMsg('info', `"${item.descripcion}" eliminada`);
    }
    eliminarSeleccionadosExterno(): void {
        this.externalDataSource.set(this.externalDataSource().filter(i => !i.selected));
        this.calcularImporteTotal();
    }

    // ── Modales devolución
    abrirModalBusqueda(): void { this.dialogRefActual = this.dialog.open(this.busquedaModal, { width:'650px', maxWidth:'95vw', panelClass:'no-padding-dialog', disableClose:true }); }
    cerrarModalBusqueda(): void { this.dialogRefActual?.close(); }

    hasError(field: string, error: string): boolean { const c = this.devolucionForm.get(field); return c ? c.hasError(error) && c.touched : false; }
    isBusquedaValida(): boolean { return !!this._terceroSeleccionado && !!this.devolucionForm.value.fechaDevolucion; }

    buscarHerramientas(): void {
        if (!this._terceroSeleccionado) { this.showMsg('warning', 'Seleccione un tercero válido de la lista'); return; }
        this.isSearching = true;
        this.dataSourceDevolucion = [];
        const razon = (this._terceroSeleccionado.razonSocial || '').replace(/'/g, "''");
        const filtro = `loa.status = 'ACTIVO' AND loa.loan_type = 'EXTERNO' AND loa.borrower_name ILIKE '%${razon}%'`;

        forkJoin({
            loans: this.movementSvc.getActiveLoans({ filtro_adicional: filtro }),
            items: this.movementSvc.getActiveLoanItems()
        }).pipe(takeUntil(this.destroy$), finalize(() => this.isSearching = false)).subscribe({
            next: ({ loans, items }) => {
                if (!loans?.length) {
                    this.showMsg('info', `Sin préstamos activos para ${this._terceroSeleccionado.razonSocial}`);
                    this.cerrarModalBusqueda();
                    return;
                }
                const loanMap: Record<string,any> = {};
                loans.forEach((l: any) => loanMap[String(l.id_loan)] = l);
                const loanIds = new Set(Object.keys(loanMap));

                let resultado: DevolucionTerceroItem[] = (items || [])
                    .filter((it: any) => loanIds.has(String(it.id_loan)))
                    .map((it: any) => {
                        const loan = loanMap[String(it.id_loan)];
                        return {
                            id: this._itemIdCounter++, fila: 0,
                            toolId: String(it.tool_id || ''), codigo: it.code || '',
                            pn: it.part_number || '', sn: it.serial_number || '',
                            descripcion: it.description || '', marca: it.brand || '',
                            fechaSalida: loan?.loan_date || '',
                            diasFuera: loan?.loan_date ? this._calcDiasFuera(loan.loan_date) : 0,
                            cantidad: Number(it.quantity) || 1, nroNotaSalida: loan?.loan_number || '',
                            tipoContrato: this._terceroSeleccionado.tipoEmpresa || 'PROVEEDOR',
                            proyecto: loan?.work_order_number || '', estado: 'EN_TERCERO',
                            condicionDevolucion: '', observaciones: it.notes || '', selected: false
                        };
                    });

                const cod = (this.devolucionForm.get('codigoHerramienta')?.value || '').trim().toLowerCase();
                if (cod) resultado = resultado.filter(i => i.codigo.toLowerCase().includes(cod) || i.pn.toLowerCase().includes(cod));

                if (!resultado.length) { this.showMsg('info', 'Sin herramientas con ese criterio'); return; }
                this.dataSourceDevolucion = resultado;
                this.dataSourceDevolucion.forEach((item, idx) => item.fila = idx + 1);
                this.showMsg('success', `${resultado.length} herramienta(s) cargadas`);
                this.cerrarModalBusqueda();
            },
            error: (err) => this.showMsg('error', 'Error al consultar: ' + (err?.message || ''))
        });
    }

    abrirConfirmDevolucion(): void {
        const sel = this.getSelDevolucionItems();
        if (!sel.length) { this.showMsg('warning', 'Seleccione al menos una herramienta'); return; }
        const sinCondicion = sel.filter(i => !i.condicionDevolucion);
        if (sinCondicion.length) { this.showMsg('warning', 'Asigne condición a todos los ítems seleccionados'); return; }
        this.dialogRefActual = this.dialog.open(this.confirmDevolucionModal, { width:'650px', maxWidth:'95vw', panelClass:'no-padding-dialog', disableClose:true });
    }
    cerrarConfirmDevolucion(): void { this.dialogRefActual?.close(); }

    toggleSelDevolucion(item: DevolucionTerceroItem): void { item.selected = !item.selected; }
    toggleAllDevolucion(e: any): void { this.dataSourceDevolucion.forEach(i => i.selected = e.checked); }
    isAllSelDevolucion(): boolean { return this.dataSourceDevolucion.length > 0 && this.dataSourceDevolucion.every(i => i.selected); }
    isSomeSelDevolucion(): boolean { return this.dataSourceDevolucion.some(i => i.selected) && !this.isAllSelDevolucion(); }
    getSelCountDevolucion(): number { return this.dataSourceDevolucion.filter(i => i.selected).length; }
    getSelDevolucionItems(): DevolucionTerceroItem[] { return this.dataSourceDevolucion.filter(i => i.selected); }
    updateCondicion(item: DevolucionTerceroItem, condicion: string): void { item.condicionDevolucion = condicion; if (condicion) item.selected = true; }

    getDiasFueraClass(dias: number): string {
        if (dias <= 7)  return 'bg-green-100 text-green-800 border-green-300';
        if (dias <= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        if (dias <= 60) return 'bg-orange-100 text-orange-800 border-orange-300';
        return 'bg-red-100 text-red-800 border-red-400';
    }
    getTipoEmpresaClass(tipo: string): string { return this.tiposEmpresa.find(t => t.value === tipo)?.color || 'bg-gray-100 text-gray-800'; }
    getTipoEmpresaLabel(tipo: string): string { return this.tiposEmpresa.find(t => t.value === tipo)?.label || tipo; }
    getCondicionClass(c: string): string { return this.condicionesDevolucion.find(x => x.value === c)?.bgColor || 'bg-gray-500'; }
    getCondicionLabel(c: string): string { return this.condicionesDevolucion.find(x => x.value === c)?.label || c; }
    getCondicionIcon(c: string): string { return this.condicionesDevolucion.find(x => x.value === c)?.icon || 'help_outline'; }

    getResumenPorCondicion(): { condicion: string; cantidad: number; bgColor: string }[] {
        const mapa: Record<string,number> = {};
        this.getSelDevolucionItems().forEach(i => { mapa[i.condicionDevolucion] = (mapa[i.condicionDevolucion] || 0) + 1; });
        return Object.entries(mapa).map(([k, v]) => {
            const cfg = this.condicionesDevolucion.find(c => c.value === k);
            return { condicion: cfg?.label || k, cantidad: v, bgColor: cfg?.bgColor || 'bg-gray-500' };
        });
    }

    finalizarDevolucion(): void {
        const sel = this.getSelDevolucionItems();
        this.cerrarConfirmDevolucion();
        this.isSaving = true;
        const itemsJson = JSON.stringify(sel.map(i => ({
            tool_id: Number(i.toolId), quantity: i.cantidad,
            condicion: i.condicionDevolucion, notes: i.observaciones || ''
        })));
        this.movementSvc.registrarDevolucionPrestamo({
            type: 'DEVOLUCION_PRESTAMO_EXTERNO',
            date: this.devolucionForm.value.fechaDevolucion,
            time: new Date().toTimeString().slice(0,8),
            requested_by_name: this._terceroSeleccionado?.razonSocial || '',
            responsible_person: '', recipient: this._terceroSeleccionado?.razonSocial || '',
            customer: this._terceroSeleccionado?.razonSocial || '',
            notes: this.devolucionForm.value.observaciones || '', items_json: itemsJson
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._imprimirDevolucionTercero(nro, sel, this._terceroSeleccionado, this.devolucionForm.value);
                this.showMsg('success', `Devolución registrada: ${nro}`);
                this.dataSourceDevolucion = this.dataSourceDevolucion.filter(i => !i.selected);
                this.dataSourceDevolucion.forEach((item, idx) => item.fila = idx + 1);
            },
            error: (err) => this.showMsg('error', 'Error al registrar: ' + (err?.message || ''))
        });
    }

    private _calcDiasFuera(fecha: string): number {
        return Math.ceil(Math.abs(new Date().getTime() - new Date(fecha).getTime()) / 86400000);
    }

    // ── Impresión préstamo externo
    private _imprimirPrestamoExterno(nro: string, fv: any, items: ExternalLoanItem[]): void {
        const w = window.open('', '_blank');
        if (!w) return;
        const now   = new Date().toLocaleString('es-BO');
        const total = items.reduce((s, i) => s + (i.precioTotal || 0), 0);
        const rows  = items.map(i => `<tr><td>${i.codigo||'-'}</td><td>${i.pn||'-'}</td><td>${i.sn||'-'}</td><td style="text-align:center;font-weight:700">${i.cantidad}</td><td>${i.descripcion||'-'}</td><td>${i.contenido||'-'}</td><td style="text-align:right">${i.costoHora?'$'+i.costoHora.toFixed(2):'-'}</td><td style="text-align:right">${i.precioTotal?'$'+i.precioTotal.toFixed(2):'-'}</td><td>&nbsp;</td></tr>`).join('');
        const css = `<style>@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:0}.top{display:flex;justify-content:space-between;margin-bottom:5px}.code-box{border:2px solid #000;padding:3px 10px;font-weight:900;font-size:13px;display:inline-block}h1{text-align:center;font-size:12px;font-weight:900;text-transform:uppercase;background:#111A43;color:white;padding:7px 10px;margin:0 0 7px;border:1px solid #000}.info-tbl{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:7px}.info-tbl td{border:1px solid #ddd;padding:3px 6px}.lbl{background:#f0f0f0;font-weight:700;font-size:9px;width:130px}.nro-cell{background:#f0f0f0;text-align:center;font-weight:900;font-size:15px;vertical-align:middle;width:120px}.sec{background:#111A43;color:white;padding:3px 8px;font-weight:900;font-size:10px;text-transform:uppercase;border:1px solid #000}table.det{width:100%;border-collapse:collapse;border:1px solid #000}table.det th{background:#111A43;color:white;padding:5px 4px;font-size:8.5px;font-weight:900;text-transform:uppercase;border:1px solid #000;text-align:center}table.det td{padding:4px;border:1px solid #ddd;font-size:9px}table.det tr:nth-child(even) td{background:#f9f9f9}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.sig{border:1px solid #000;padding:6px 8px;text-align:center}.sig-ttl{font-weight:900;font-size:9px;text-transform:uppercase;margin-bottom:26px;line-height:1.4}.sig-line{border-top:1px solid #000;padding-top:3px;font-size:8.5px}.footer{text-align:center;margin-top:10px;font-size:7.5px;color:#888;border-top:1px dotted #ccc;padding-top:4px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MGH-100 ${nro}</title>${css}</head><body>
<div class="top"><div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145#114 &nbsp; N-114</div><div style="text-align:right"><div class="code-box">MGH-100</div><br><span style="font-size:9px">REV. 0 &nbsp; 2016-10-13</span></div></div>
<h1>NOTA DE PRÉSTAMO - DEVOLUCIÓN A TERCEROS</h1>
<table class="info-tbl">
<tr><td class="lbl">EMPRESA / SOLICITANTE:</td><td>${fv.nombreEmpresa||''}</td><td class="lbl">NIT:</td><td>${fv.nit||''}</td><td class="nro-cell" rowspan="3"><div style="font-size:8px;font-weight:400">N° NOTA</div>${nro}</td></tr>
<tr><td class="lbl">CONTACTO:</td><td>${fv.contacto||''}</td><td class="lbl">MOTIVO:</td><td>${fv.motivoPrestamo||''}</td></tr>
<tr><td class="lbl">FECHA Y HORA:</td><td>${fv.fecha||''} ${fv.hora||''}</td><td class="lbl">PRECIO $US TOTAL:</td><td style="font-weight:700">$${total.toFixed(2)}</td></tr>
</table>
<div class="sec">DATOS PRÉSTAMO</div>
<table class="det"><thead><tr><th>CÓDIGO</th><th>P/N ó MODELO</th><th>S/N</th><th>CANT.</th><th>DESCRIPCIÓN</th><th>LISTA CONTENIDO</th><th>HR. $US</th><th>VALOR $US</th><th>OBS</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sec" style="margin-top:6px">DATOS DEVOLUCIÓN</div>
<table class="det"><thead><tr><th>FECHA/HORA</th><th colspan="2">ENTREGUE CONFORME (NOMBRE/FIRMA)</th><th colspan="2">RECIBI CONFORME (NOMBRE/FIRMA)</th><th>CONDICIÓN DEVOLUCIÓN</th><th>NRO. REPORTE AVERÍA</th><th>OBS</th></tr></thead><tbody>${items.map(()=>`<tr><td style="height:28px">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('')}</tbody></table>
<div class="sigs"><div class="sig"><div class="sig-ttl">ENTREGADO POR<br>FIRMA ALMACÉN</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">RECIBIDO POR</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">AUTORIZADO POR<br>FIRMA BOA</div><div class="sig-line">&nbsp;</div></div></div>
<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},500);};</script>
</body></html>`);
        w.document.close();
    }

    // ── Impresión devolución tercero
    private _imprimirDevolucionTercero(nro: string, items: DevolucionTerceroItem[], tercero: any, fv: any): void {
        const w = window.open('', '_blank');
        if (!w) return;
        const now  = new Date().toLocaleString('es-BO');
        const rows = items.map(i => `<tr><td><span style="font-family:monospace;font-weight:700;background:#0f172a;color:white;padding:1px 4px;border-radius:2px;font-size:9px">${i.codigo||'-'}</span></td><td style="font-family:monospace;font-size:9px">${i.pn||'-'}</td><td style="font-family:monospace;font-size:9px">${i.sn||'-'}</td><td style="text-align:center;font-weight:700">${i.cantidad}</td><td>${i.descripcion||'-'}</td><td>${i.nroNotaSalida||'-'}</td><td>${i.fechaSalida||'-'}</td><td style="text-align:center">${i.diasFuera}</td><td><span style="padding:2px 4px;border:1px solid #000;font-size:8.5px;font-weight:700">${i.condicionDevolucion}</span></td><td>${i.observaciones||''}</td></tr>`).join('');
        const css = `<style>@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:0}.top{display:flex;justify-content:space-between;margin-bottom:5px}.code-box{border:2px solid #000;padding:3px 10px;font-weight:900;font-size:13px;display:inline-block}h1{text-align:center;font-size:12px;font-weight:900;text-transform:uppercase;background:#111A43;color:white;padding:7px 10px;margin:0 0 7px;border:1px solid #000}.info-tbl{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:7px}.info-tbl td{border:1px solid #ddd;padding:3px 6px}.lbl{background:#f0f0f0;font-weight:700;font-size:9px;width:120px}.nro-cell{background:#f0f0f0;text-align:center;font-weight:900;font-size:15px;vertical-align:middle;width:120px}.sec{background:#111A43;color:white;padding:3px 8px;font-weight:900;font-size:10px;text-transform:uppercase;border:1px solid #000}table.det{width:100%;border-collapse:collapse;border:1px solid #000}table.det th{background:#111A43;color:white;padding:4px 3px;font-size:8px;font-weight:900;text-transform:uppercase;border:1px solid #000;text-align:center}table.det td{padding:3px 4px;border:1px solid #ddd;font-size:9px}table.det tr:nth-child(even) td{background:#f9f9f9}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.sig{border:1px solid #000;padding:6px 8px;text-align:center}.sig-ttl{font-weight:900;font-size:9px;text-transform:uppercase;margin-bottom:26px}.sig-line{border-top:1px solid #000;padding-top:3px;font-size:8.5px}.footer{text-align:center;margin-top:10px;font-size:7.5px;color:#888;border-top:1px dotted #ccc;padding-top:4px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Devolución Terceros ${nro}</title>${css}</head><body>
<div class="top"><div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145# N-114</div><div style="text-align:right"><div class="code-box">MGH-100</div><br><span style="font-size:9px">REV. 0 &nbsp; 2016-10-13</span></div></div>
<h1>NOTA DE DEVOLUCIÓN A TERCEROS</h1>
<table class="info-tbl">
<tr><td class="lbl">EMPRESA / ENTIDAD:</td><td>${tercero?.razonSocial||''}</td><td class="lbl">NIT:</td><td>${tercero?.nit||''}</td><td class="nro-cell" rowspan="3"><div style="font-size:8px;font-weight:400">N° NOTA</div>${nro}</td></tr>
<tr><td class="lbl">CONTACTO:</td><td>${tercero?.nombreContacto||''}</td><td class="lbl">FECHA DEVOLUCIÓN:</td><td>${fv.fechaDevolucion||''}</td></tr>
<tr><td class="lbl">OBSERVACIONES:</td><td colspan="3">${fv.observaciones||''}</td></tr>
</table>
<div class="sec">DETALLE DE HERRAMIENTAS RECIBIDAS</div>
<table class="det"><thead><tr><th>CÓDIGO</th><th>P/N</th><th>S/N</th><th>CANT.</th><th>DESCRIPCIÓN</th><th>NOTA SALIDA</th><th>F. SALIDA</th><th>DÍAS FUERA</th><th>CONDICIÓN</th><th>OBS</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sigs"><div class="sig"><div class="sig-ttl">DEVUELTO POR</div><div style="font-size:9px;margin-bottom:16px">${tercero?.razonSocial||'_____'}</div><div class="sig-line">Firma Representante Tercero</div></div><div class="sig"><div class="sig-ttl">RECIBIDO POR</div><div class="sig-line">Firma Almacén Herramientas BOA</div></div><div class="sig"><div class="sig-ttl">AUTORIZADO POR</div><div class="sig-line">Firma Autorizada BOA</div></div></div>
<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},500);};</script>
</body></html>`);
        w.document.close();
    }

    private showMsg(type: 'success'|'error'|'info'|'warning', text: string): void {
        this.snackBar.open(text, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
