import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, catchError, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service';
import { CalibrationService } from '../../../../../core/services/calibration.service';

type CondicionExt = 'BUENO' | 'REPARADO' | 'CALIBRADO' | 'PARCIAL' | 'NO_REPARABLE';

interface DevolucionExternoItem {
    toolId: string; codigo: string; pn: string; sn: string; descripcion: string;
    nroNotaSalida: string; id_loan: number; fechaSalida: string; diasFuera: number;
    cantidad: number; und: string; estadoAlPrestar: string;
    condicionDevolucion: CondicionExt | ''; observaciones: string; selected: boolean;
}

@Component({
    selector: 'app-form-devolucion-externo-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatCheckboxModule, MatDialogModule, MatSnackBarModule
    ],
    templateUrl: './form-devolucion-externo-dialog.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class FormDevolucionExternoDialogComponent implements OnInit, OnDestroy {

    @ViewChild('confirmDevModal') confirmDevModal!: TemplateRef<any>;

    dialogRef         = inject(MatDialogRef<FormDevolucionExternoDialogComponent>);
    private _confirmRef: any = null;

    private dialog      = inject(MatDialog);
    private fb          = inject(FormBuilder);
    private snackBar    = inject(MatSnackBar);
    private movementSvc    = inject(MovementService);
    private calibrationSvc = inject(CalibrationService);
    private destroy$    = new Subject<void>();

    isSaving    = false;
    isSearching = false;

    busquedaForm!: FormGroup;
    dataSource: DevolucionExternoItem[] = [];

    private _tercerosList: any[] = [];
    tercerosFiltrados:   any[] = [];
    showTercerosDropdown = false;
    _terceroSeleccionado: any = null;

    private _responsableSearch$ = new Subject<string>();
    responsablesFiltrados:  any[] = [];
    responsableLoading      = false;
    showResponsableDropdown = false;
    private _personalCache: any[] = [];

    condiciones: { value: CondicionExt; label: string; bgColor: string; icon: string }[] = [
        { value: 'BUENO',       label: 'Bueno',       bgColor: 'bg-green-500', icon: 'check_circle'   },
        { value: 'REPARADO',    label: 'Reparado',    bgColor: 'bg-blue-500',  icon: 'build'          },
        { value: 'CALIBRADO',   label: 'Calibrado',   bgColor: 'bg-cyan-500',  icon: 'tune'           },
        { value: 'PARCIAL',     label: 'Parcial',     bgColor: 'bg-yellow-500',icon: 'construction'   },
        { value: 'NO_REPARABLE',label: 'No Reparable',bgColor: 'bg-red-700',   icon: 'dangerous'      },
    ];

    ngOnInit(): void {
        this.initForm();
        this._cargarTerceros();
        this._setupResponsableSearch();
    }

    ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

    private _localDateStr(d = new Date()): string {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    private initForm(): void {
        const now = new Date();
        this.busquedaForm = this.fb.group({
            empresa:          ['', Validators.required],
            codigoFiltro:     [''],
            fechaDevolucion:  [this._localDateStr(), Validators.required],
            horaDevolucion:   [`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`, Validators.required],
            responsableRecibe:['', Validators.required],
            observaciones:    [''],
        });
    }

    private _cargarTerceros(): void {
        this.calibrationSvc.getLaboratories().pipe(
            takeUntil(this.destroy$), catchError(() => of([]))
        ).subscribe((labs: any[]) => {
            this._tercerosList = (labs || []).map((l: any) => ({
                razonSocial:    l.name                               || '',
                nit:            l.rut_nit    || l.code               || '',
                nombreContacto: l.contact_person || l.contactPerson  || '',
                tipoEmpresa:    l.tipo_servicio                      || '',
            }));
        });
    }

    onTerceroInput(val: string): void {
        this.busquedaForm.patchValue({ empresa: val }, { emitEvent: false });
        this._terceroSeleccionado = null;
        const q = val.trim().toLowerCase();
        this.tercerosFiltrados = q.length < 2 ? [] :
            this._tercerosList.filter(t => t.razonSocial.toLowerCase().includes(q) || t.nit.toLowerCase().includes(q)).slice(0,10);
        this.showTercerosDropdown = this.tercerosFiltrados.length > 0;
    }
    selectTercero(t: any): void {
        this._terceroSeleccionado = t;
        this.busquedaForm.patchValue({ empresa: t.razonSocial });
        this.showTercerosDropdown = false;
    }
    hideTercerosDropdown(): void { setTimeout(() => this.showTercerosDropdown = false, 150); }

    private _setupResponsableSearch(): void {
        this.movementSvc.getPersonal().pipe(
            takeUntil(this.destroy$), catchError(() => of([]))
        ).subscribe((lista: any[]) => {
            this._personalCache = (lista||[]).map(f => ({
                nombre: f.nombreCompleto || `${f.nombre||''} ${f.apellido_paterno||''}`.trim(),
                cargo: f.cargo || '',
            }));
        });
        this._responsableSearch$.pipe(
            debounceTime(150), distinctUntilChanged(), takeUntil(this.destroy$)
        ).subscribe(t => {
            if (t.length < 2) { this.showResponsableDropdown = false; this.responsablesFiltrados = []; return; }
            const q = t.toLowerCase();
            this.responsablesFiltrados = this._personalCache.filter(f => f.nombre.toLowerCase().includes(q)).slice(0,10);
            this.showResponsableDropdown = this.responsablesFiltrados.length > 0;
        });
    }

    onResponsableInput(val: string): void {
        this.busquedaForm.patchValue({ responsableRecibe: val }, { emitEvent: false });
        this._responsableSearch$.next(val);
    }
    selectResponsable(r: any): void {
        this.busquedaForm.patchValue({ responsableRecibe: r.nombre });
        this.showResponsableDropdown = false;
    }
    hideResponsableDropdown(): void { setTimeout(() => this.showResponsableDropdown = false, 150); }

    consultar(): void {
        if (!this._terceroSeleccionado) { this.showMsg('warning', 'Seleccione una empresa válida de la lista'); return; }
        this.isSearching = true;
        this.dataSource = [];
        const razon  = (this._terceroSeleccionado.razonSocial||'').replace(/'/g,"''");
        const filtro = `status = 'active' AND loan_type = 'external' AND borrower_name ILIKE '%${razon}%'`;

        this.movementSvc.getActiveLoans({ filtro_adicional: filtro }).pipe(
            switchMap((loans: any[]) => {
                if (!loans?.length) return of({ loans: [] as any[], items: [] as any[] });
                const loanIds = (loans as any[]).map((l: any) => l.id_loan).filter(Boolean);
                const itemsFiltro = `returned = false AND loan_id IN (${loanIds.join(',')})`;
                return forkJoin({
                    loans: of(loans),
                    items: this.movementSvc.getActiveLoanItems({ filtro_adicional: itemsFiltro })
                });
            }),
            takeUntil(this.destroy$), finalize(() => this.isSearching = false)
        ).subscribe({
            next: ({ loans, items }: any) => {
                if (!loans?.length) { this.showMsg('info', `Sin préstamos activos para ${this._terceroSeleccionado.razonSocial}`); return; }
                const loanMap: Record<string,any> = {};
                (loans as any[]).forEach(l => loanMap[String(l.id_loan)] = l);
                const loanIds = new Set(Object.keys(loanMap));

                let resultado: DevolucionExternoItem[] = (items as any[])
                    .filter(it => loanIds.has(String(it.loan_id)) && !this._isReturned(it.returned))
                    .map(it => {
                        const loan = loanMap[String(it.loan_id)];
                        return {
                            toolId: String(it.tool_id||''), codigo: it.code||'',
                            pn: it.part_number||'', sn: it.serial_number||'',
                            descripcion: it.description||it.name||'',
                            nroNotaSalida: loan?.loan_number||'', id_loan: Number(loan?.id_loan||0),
                            fechaSalida: loan?.loan_date||'',
                            diasFuera: loan?.loan_date ? this._calcDias(loan.loan_date) : 0,
                            cantidad: Number(it.quantity)||1, und: it.unit_of_measure||'UND',
                            estadoAlPrestar: it.condition_on_loan||'',
                            condicionDevolucion: '' as CondicionExt|'', observaciones: '', selected: false,
                        };
                    });

                const cod = (this.busquedaForm.get('codigoFiltro')?.value||'').trim().toLowerCase();
                if (cod) resultado = resultado.filter(i => i.codigo.toLowerCase().includes(cod) || i.pn.toLowerCase().includes(cod));

                if (!resultado.length) { this.showMsg('info', 'Sin herramientas con ese criterio'); return; }
                this.dataSource = resultado;
                this.showMsg('success', `${resultado.length} herramienta(s) cargadas`);
            },
            error: (err: any) => this.showMsg('error', 'Error al consultar: ' + (err?.message||''))
        });
    }

    private _isReturned(val: any): boolean { return val === true || val === 'true' || val === 't'; }
    private _calcDias(fecha: string): number {
        return Math.ceil(Math.abs(new Date().getTime() - new Date(fecha).getTime()) / 86400000);
    }

    toggleSel(item: DevolucionExternoItem): void { item.selected = !item.selected; }
    toggleAll(e: any): void { this.dataSource.forEach(i => i.selected = e.checked); }
    isAllSel(): boolean { return this.dataSource.length > 0 && this.dataSource.every(i => i.selected); }
    isSomeSel(): boolean { return this.dataSource.some(i => i.selected) && !this.isAllSel(); }
    getSelCount(): number { return this.dataSource.filter(i => i.selected).length; }
    getSelItems(): DevolucionExternoItem[] { return this.dataSource.filter(i => i.selected); }

    updateCondicion(item: DevolucionExternoItem, c: CondicionExt): void { item.condicionDevolucion = c; item.selected = true; }
    getCondicionIcon(c: string): string { return this.condiciones.find(x => x.value === c)?.icon || 'help_outline'; }
    getCondicionBg(c: string): string { return this.condiciones.find(x => x.value === c)?.bgColor || 'bg-gray-500'; }

    getDiasFueraClass(dias: number): string {
        if (dias <= 7)  return 'bg-green-100 text-green-800 border-green-300';
        if (dias <= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        if (dias <= 60) return 'bg-orange-100 text-orange-800 border-orange-300';
        return 'bg-red-100 text-red-800 border-red-400';
    }

    hasError(field: string, error: string): boolean {
        const c = this.busquedaForm.get(field);
        return c ? c.hasError(error) && c.touched : false;
    }

    abrirConfirm(): void {
        const sel = this.getSelItems();
        if (!sel.length) { this.showMsg('warning', 'Seleccione al menos una herramienta'); return; }
        const sinCondicion = sel.filter(i => !i.condicionDevolucion);
        if (sinCondicion.length) { this.showMsg('warning', 'Asigne condición a todos los ítems seleccionados'); return; }
        this.busquedaForm.markAllAsTouched();
        if (this.busquedaForm.invalid) { this.showMsg('error', 'Complete los campos requeridos'); return; }
        this._confirmRef = this.dialog.open(this.confirmDevModal, {
            width: '650px', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true
        });
    }
    cerrarConfirm(): void { this._confirmRef?.close(); }

    getResumen(): { condicion: string; cantidad: number; bgColor: string }[] {
        const mapa: Record<string,number> = {};
        this.getSelItems().forEach(i => { mapa[i.condicionDevolucion] = (mapa[i.condicionDevolucion]||0)+1; });
        return Object.entries(mapa).map(([k,v]) => {
            const cfg = this.condiciones.find(c => c.value === k);
            return { condicion: cfg?.label||k, cantidad: v, bgColor: cfg?.bgColor||'bg-gray-500' };
        });
    }

    /* trackBy — getResumen() arma objetos nuevos en cada llamada; sin esto
       el *ngFor los recrearía en cada CD (mismo origen del congelamiento
       de Misceláneos). */
    trackByCondicion = (_: number, r: { condicion: string }): string => r.condicion;

    finalizar(): void {
        const sel = this.getSelItems();
        this.cerrarConfirm();
        this.isSaving = true;
        const fv = this.busquedaForm.getRawValue();
        const itemsJson = JSON.stringify(sel.map(i => ({
            tool_id: Number(i.toolId), quantity: i.cantidad,
            condicion: i.condicionDevolucion, notes: i.observaciones||'',
        })));
        this.movementSvc.registrarDevolucionPrestamo({
            type: 'DEVOLUCION_PRESTAMO_EXTERNO',
            date: fv.fechaDevolucion,
            time: fv.horaDevolucion || new Date().toTimeString().slice(0,5),
            requested_by_name: this._terceroSeleccionado?.razonSocial||'',
            responsible_person: fv.responsableRecibe,
            recipient: this._terceroSeleccionado?.razonSocial||'',
            customer: this._terceroSeleccionado?.razonSocial||'',
            notes: fv.observaciones||'', items_json: itemsJson,
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._imprimir(nro, sel, fv).catch(() => {});
                this.showMsg('success', `Devolución registrada: ${nro}`);
                this.dataSource = this.dataSource.filter(i => !i.selected);
                this.dialogRef.close({ success: true, movement_number: nro });
            },
            error: (err: any) => this.showMsg('error', 'Error al registrar: ' + (err?.message||''))
        });
    }

    cerrar(): void { this.dialogRef.close(); }

    private _logoBoaDataUri: Promise<string> | null = null;
    private _loadLogoBoaDataUri(): Promise<string> {
        if (!this._logoBoaDataUri) {
            this._logoBoaDataUri = fetch('/images/logo-boa.png')
                .then(r => r.blob())
                .then(blob => new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload  = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                }))
                .catch(() => '');
        }
        return this._logoBoaDataUri;
    }

    /**
     * Recibo interno de devolución en lote — puede juntar ítems de varias notas de
     * préstamo distintas (columna NOTA SALIDA por fila), no tiene equivalente en el
     * Excel oficial (ver PrestamoExternoPdfService para la Nota de Préstamo-Devolución
     * de una sola nota, que sí está calcada de la hoja "PRESTAMO A TERCEROS 2"). Solo
     * se restyleó el logo/paleta para que se vea consistente con el resto de PDFs.
     */
    private async _imprimir(nro: string, items: DevolucionExternoItem[], fv: any): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();
        const condLabel: Record<string,string> = { BUENO:'Bueno', REPARADO:'Reparado', CALIBRADO:'Calibrado', PARCIAL:'Parcial', NO_REPARABLE:'No Reparable' };
        const rows = items.map(it => {
            const color = ['NO_REPARABLE','PARCIAL'].includes(it.condicionDevolucion) ? '#dc2626' : '#166534';
            return `<tr><td><span style="font-family:monospace;font-weight:700">${it.codigo||'-'}</span></td><td style="font-family:monospace;font-size:9px">${it.pn||'-'}</td><td style="font-family:monospace;font-size:9px">${it.sn||'-'}</td><td style="text-align:center;font-weight:700">${it.cantidad}</td><td>${it.descripcion||'-'}</td><td>${it.nroNotaSalida||'-'}</td><td>${it.fechaSalida||'-'}</td><td style="text-align:center">${it.diasFuera}d</td><td style="font-weight:700;color:${color}">${condLabel[it.condicionDevolucion]||it.condicionDevolucion}</td><td>${it.observaciones||''}</td></tr>`;
        }).join('');
        const css = `<style>@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:0}.top{display:flex;align-items:center;gap:10px;margin-bottom:5px}.top img{max-height:30px}h1{text-align:center;font-size:12px;font-weight:900;text-transform:uppercase;background:#111A43;color:white;padding:7px 10px;margin:0 0 7px;border:1px solid #000}.info-tbl{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:7px}.info-tbl td{border:1px solid #ddd;padding:3px 6px}.lbl{background:#f0f0f0;font-weight:700;font-size:9px;width:120px}.nro-cell{background:#f0f0f0;text-align:center;font-weight:900;font-size:15px;vertical-align:middle;width:120px}.sec{background:#111A43;color:white;padding:3px 8px;font-weight:900;font-size:10px;text-transform:uppercase;border:1px solid #000}table.det{width:100%;border-collapse:collapse;border:1px solid #000}table.det th{background:#111A43;color:white;padding:4px 3px;font-size:8px;font-weight:900;text-transform:uppercase;border:1px solid #000;text-align:center}table.det td{padding:3px 4px;border:1px solid #ddd;font-size:9px}table.det tr:nth-child(even) td{background:#f9f9f9}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.sig{border:1px solid #000;padding:6px 8px;text-align:center}.sig-ttl{font-weight:900;font-size:9px;text-transform:uppercase;margin-bottom:26px}.sig-line{border-top:1px solid #000;padding-top:3px;font-size:8.5px}.footer{text-align:center;margin-top:10px;font-size:7.5px;color:#888;border-top:1px dotted #ccc;padding-top:4px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Devolución Terceros ${nro}</title>${css}</head><body>
<div class="top">${logoUri ? `<img src="${logoUri}" alt="BoA">` : '<div style="font-weight:900;font-size:16px">BoA</div>'}<div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145# N-114</div></div>
<h1>NOTA DE DEVOLUCIÓN A TERCEROS</h1>
<table class="info-tbl">
<tr><td class="lbl">EMPRESA / ENTIDAD:</td><td style="font-weight:700">${this._terceroSeleccionado?.razonSocial||''}</td><td class="lbl">NIT:</td><td>${this._terceroSeleccionado?.nit||''}</td><td class="nro-cell" rowspan="3"><div style="font-size:8px;font-weight:400">N° NOTA</div>${nro}</td></tr>
<tr><td class="lbl">RECIBIDO EN ALMACÉN:</td><td style="font-weight:700">${fv.responsableRecibe||''}</td><td class="lbl">FECHA DEVOLUCIÓN:</td><td>${fv.fechaDevolucion||''} ${fv.horaDevolucion||''}</td></tr>
<tr><td class="lbl">OBSERVACIONES:</td><td colspan="3">${fv.observaciones||''}</td></tr>
</table>
<div class="sec">DETALLE DE HERRAMIENTAS RECIBIDAS</div>
<table class="det"><thead><tr><th>CÓDIGO</th><th>P/N</th><th>S/N</th><th>CANT.</th><th>DESCRIPCIÓN</th><th>NOTA SALIDA</th><th>F. SALIDA</th><th>DÍAS FUERA</th><th>CONDICIÓN</th><th>OBS</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sigs"><div class="sig"><div class="sig-ttl">DEVUELTO POR</div><div style="font-size:9px;margin-bottom:16px">${this._terceroSeleccionado?.razonSocial||'_____'}</div><div class="sig-line">Firma Representante Tercero</div></div><div class="sig"><div class="sig-ttl">RECIBIDO EN ALMACÉN</div><div style="font-size:9px;margin-bottom:16px">${fv.responsableRecibe||''}</div><div class="sig-line">Firma Almacén Herramientas BOA</div></div><div class="sig"><div class="sig-ttl">AUTORIZADO POR</div><div class="sig-line">Firma Autorizada BOA</div></div></div>
<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${new Date().toLocaleString('es-BO')}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
</body></html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    private showMsg(type: 'success'|'error'|'info'|'warning', text: string): void {
        this.snackBar.open(text, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
