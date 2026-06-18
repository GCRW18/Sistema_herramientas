import { Component, OnInit, OnDestroy, signal, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, catchError, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service';
import { CalibrationService } from '../../../../../core/services/calibration.service';
import { ModalHerramientaExternoComponent } from '../modal-herramienta-externo/modal-herramienta-externo.component';

interface ExternalLoanItem {
    toolId: number; id: number; codigo: string; pn: string; descripcion: string; sn: string;
    marca: string; fechaCalibracion: string; listaContenido: string;
    cantidad: number; horas: number; costoHora: number; precioTotal: number;
    contenido: string; estado: string;
}

@Component({
    selector: 'app-form-prestamo-externo-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule, MatSnackBarModule, MatTooltipModule
    ],
    templateUrl: './form-prestamo-externo-dialog.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class FormPrestamoExternoDialogComponent implements OnInit, OnDestroy {

    @ViewChild('confirmExternoModal') confirmExternoModal!: TemplateRef<any>;

    dialogRef        = inject(MatDialogRef<FormPrestamoExternoDialogComponent>);
    private _confirmRef: any = null;

    private dialog      = inject(MatDialog);
    private fb          = inject(FormBuilder);
    private snackBar    = inject(MatSnackBar);
    private movementSvc     = inject(MovementService);
    private calibrationSvc  = inject(CalibrationService);
    private destroy$        = new Subject<void>();

    isSaving = false;
    externalForm!: FormGroup;
    dataSource = signal<ExternalLoanItem[]>([]);
    importeTotal = signal<number>(0);

    private _tercerosList: any[] = [];
    empresasFiltradas:   any[] = [];
    showEmpresasDropdown = false;
    _empresaSeleccionada: any = null;

    private _entregadorSearch$ = new Subject<string>();
    entregadoresFiltrados:  any[] = [];
    entregadorLoading      = false;
    showEntregadorDropdown = false;

    tiposMotivo = [
        { value: 'ALQUILER',           label: 'Alquiler por Contrato'  },
        { value: 'APOYO_MUTUO',        label: 'Apoyo Mutuo Operacional' },
        { value: 'REPARACION_EXTERNA', label: 'Reparación Externa'     },
        { value: 'CALIBRACION',        label: 'Calibración Externa'    },
    ];

    private readonly conditionMap: Record<string,string> = {
        'SERVICEABLE':'good','BUENO':'good','NUEVO':'new','NEW':'new',
        'EN_CALIBRACION':'fair','REGULAR':'fair','RECONDITIONED':'fair',
        'UNSERVICEABLE':'damaged','EN_REPARACION':'poor',
        'MALO':'poor','DAÑADO':'damaged','DAMAGED':'damaged',
    };

    ngOnInit(): void {
        this.initForm();
        this._setupEntregadorSearch();
        this._cargarTerceros();
    }

    ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

    private _localDateStr(d = new Date()): string {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    private initForm(): void {
        const now = new Date();
        this.externalForm = this.fb.group({
            nombreEmpresa:  ['', Validators.required],
            nit:            [''],
            contacto:       [''],
            telefono:       [''],
            motivoPrestamo: ['', Validators.required],
            autorizado:     ['', Validators.required],
            fecha:          [this._localDateStr(), Validators.required],
            hora:           [`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`, Validators.required],
            observaciones:  [''],
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
                telefono:       l.phone                              || '',
                email:          l.email                              || '',
            }));
        });
    }

    onEmpresaInput(val: string): void {
        this.externalForm.patchValue({ nombreEmpresa: val }, { emitEvent: false });
        this._empresaSeleccionada = null;
        const q = val.trim().toLowerCase();
        this.empresasFiltradas = q.length < 2 ? [] :
            this._tercerosList.filter(e => e.razonSocial.toLowerCase().includes(q) || e.nit.toLowerCase().includes(q)).slice(0,10);
        this.showEmpresasDropdown = this.empresasFiltradas.length > 0;
    }
    selectEmpresa(e: any): void {
        this._empresaSeleccionada = e;
        this.externalForm.patchValue({ nombreEmpresa: e.razonSocial, nit: e.nit||'', contacto: e.nombreContacto||'', telefono: e.telefono||'' });
        this.showEmpresasDropdown = false;
    }
    hideEmpresasDropdown(): void { setTimeout(() => this.showEmpresasDropdown = false, 150); }

    private _setupEntregadorSearch(): void {
        this._entregadorSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showEntregadorDropdown = false; return of([]); }
                this.entregadorLoading = true;
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto,f.nombre,f.apellido_paterno,f.apellido_materno].filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0,10).map(f => ({ nombre: f.nombreCompleto || f.nombre, cargo: f.cargo||'' }))
                    ),
                    finalize(() => this.entregadorLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { this.entregadoresFiltrados = res||[]; this.showEntregadorDropdown = (res||[]).length > 0; });
    }

    onEntregadorInput(v: string): void {
        this.externalForm.patchValue({ autorizado: v }, { emitEvent: false });
        if (v.length >= 2) this._entregadorSearch$.next(v); else this.showEntregadorDropdown = false;
    }
    selectEntregador(e: any): void {
        this.externalForm.patchValue({ autorizado: e.nombre });
        this.showEntregadorDropdown = false;
    }
    hideEntregadorSuggestions(): void { setTimeout(() => this.showEntregadorDropdown = false, 200); }

    openHerramientasModal(): void {
        const ref = this.dialog.open(ModalHerramientaExternoComponent, {
            width: 'min(1000px, 98vw)', maxWidth: '98vw', panelClass: 'no-padding-dialog', disableClose: true
        });
        ref.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                const d = result.data;
                if (this.dataSource().some(i => i.codigo === d.codigo)) { this.showMsg('info', `"${d.nombre}" ya está en la lista`); return; }
                const item: ExternalLoanItem = {
                    toolId: d.id_tool ?? 0, id: Date.now(), codigo: d.codigo||'',
                    pn: d.pn||'', descripcion: d.nombre||'', sn: d.sn||'', marca: d.marca||'',
                    fechaCalibracion: d.fechaVencimiento||'', cantidad: d.cantidad||1,
                    horas: d.horas||1, costoHora: d.costoHora||0,
                    precioTotal: (d.horas||1)*(d.costoHora||0),
                    listaContenido: d.content_list || '',
                    contenido: d.observacion||'', estado: d.estado||'SERVICEABLE',
                };
                this.dataSource.update(list => [...list, item]);
                this._recalcTotal();
                this.showMsg('success', `"${item.descripcion}" agregada`);
            }
        });
    }

    updateHoras(item: ExternalLoanItem): void {
        if (item.horas < 0) item.horas = 0;
        item.precioTotal = item.horas * (item.costoHora || 0);
        this._recalcTotal();
    }
    updateCosto(item: ExternalLoanItem): void {
        if (item.costoHora < 0) item.costoHora = 0;
        item.precioTotal = (item.horas || 0) * item.costoHora;
        this._recalcTotal();
    }
    eliminarItem(idx: number): void {
        const item = this.dataSource()[idx];
        this.dataSource.update(list => list.filter((_,i) => i !== idx));
        this._recalcTotal();
        this.showMsg('info', `"${item.descripcion}" eliminada`);
    }
    private _recalcTotal(): void {
        this.importeTotal.set(this.dataSource().reduce((s,i) => s + (i.precioTotal||0), 0));
    }

    hasError(field: string, error: string): boolean {
        const c = this.externalForm.get(field);
        return c ? c.hasError(error) && c.touched : false;
    }

    procesar(): void {
        this.externalForm.markAllAsTouched();
        if (this.externalForm.invalid) { this.showMsg('error', 'Complete los datos requeridos'); return; }
        if (this.dataSource().length === 0) { this.showMsg('warning', 'Agregue al menos una herramienta'); return; }
        this._confirmRef = this.dialog.open(this.confirmExternoModal, {
            width: '620px', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true
        });
    }
    cerrarConfirm(): void { this._confirmRef?.close(); }

    finalizar(): void {
        this.cerrarConfirm();
        this.isSaving = true;
        const fv    = this.externalForm.getRawValue();
        const items = this.dataSource();
        const itemsJson = JSON.stringify(items.map(i => ({
            tool_id: i.toolId, quantity: i.cantidad, notes: i.contenido||'',
            condition: this.conditionMap[i.estado?.toUpperCase()]||'good',
            unit_cost: i.costoHora||0, total_cost: i.precioTotal||0,
        })));
        this.movementSvc.registrarPrestamoMultiple({
            type: 'PRESTAMO_EXTERNO', date: fv.fecha, time: fv.hora,
            requested_by_name: fv.nombreEmpresa, customer: fv.nombreEmpresa,
            authorized_by: fv.autorizado||'', recipient: fv.contacto||'',
            notes: fv.motivoPrestamo||'', specific_observations: fv.observaciones||'',
            responsible_person: fv.autorizado || '',
            items_json: itemsJson,
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._imprimir(nro, fv, items);
                this.showMsg('success', `Préstamo externo registrado: ${nro}`);
                this.dialogRef.close({ success: true, movement_number: nro });
            },
            error: (err: any) => this.showMsg('error', err?.message || 'Error al registrar'),
        });
    }

    cerrar(): void {
        if (this.dataSource().length > 0 &&
            !confirm(`¿Cancelar el préstamo? Se perderán los ${this.dataSource().length} ítem(s) agregado(s).`)) return;
        this.dialogRef.close();
    }

    private _imprimir(nro: string, fv: any, items: ExternalLoanItem[]): void {
        const w = window.open('', '_blank');
        if (!w) return;
        const total = items.reduce((s,i) => s + (i.precioTotal||0), 0);
        const rows  = items.map(i =>
            `<tr><td>${i.codigo||'-'}</td><td>${i.pn||'-'}</td><td>${i.sn||'-'}</td><td style="text-align:center;font-weight:700">${i.cantidad}</td><td>${i.descripcion||'-'}</td><td>${i.listaContenido||'-'}</td><td>${i.contenido||'&nbsp;'}</td></tr>`
        ).join('');
        const css = `<style>@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:0}.top{display:flex;justify-content:space-between;margin-bottom:5px}.code-box{border:2px solid #000;padding:3px 10px;font-weight:900;font-size:13px;display:inline-block}h1{text-align:center;font-size:12px;font-weight:900;text-transform:uppercase;background:#111A43;color:white;padding:7px 10px;margin:0 0 7px;border:1px solid #000}.info-tbl{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:7px}.info-tbl td{border:1px solid #ddd;padding:3px 6px}.lbl{background:#f0f0f0;font-weight:700;font-size:9px;width:130px}.nro-cell{background:#f0f0f0;text-align:center;font-weight:900;font-size:15px;vertical-align:middle;width:120px}.sec{background:#111A43;color:white;padding:3px 8px;font-weight:900;font-size:10px;text-transform:uppercase;border:1px solid #000}table.det{width:100%;border-collapse:collapse;border:1px solid #000}table.det th{background:#111A43;color:white;padding:5px 4px;font-size:8.5px;font-weight:900;text-transform:uppercase;border:1px solid #000;text-align:center}table.det td{padding:4px;border:1px solid #ddd;font-size:9px}table.det tr:nth-child(even) td{background:#f9f9f9}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.sig{border:1px solid #000;padding:6px 8px;text-align:center}.sig-ttl{font-weight:900;font-size:9px;text-transform:uppercase;margin-bottom:26px;line-height:1.4}.sig-line{border-top:1px solid #000;padding-top:3px;font-size:8.5px}.footer{text-align:center;margin-top:10px;font-size:7.5px;color:#888;border-top:1px dotted #ccc;padding-top:4px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MGH-100 ${nro}</title>${css}</head><body>
<div class="top"><div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145#114 &nbsp; N-114</div><div style="text-align:right"><div class="code-box">MGH-100</div><br><span style="font-size:9px">REV. 0 &nbsp; 2016-10-13</span></div></div>
<h1>NOTA DE PRÉSTAMO - DEVOLUCIÓN A TERCEROS</h1>
<table class="info-tbl">
<tr><td class="lbl">EMPRESA / SOLICITANTE:</td><td style="font-weight:700">${fv.nombreEmpresa||''}</td><td class="lbl">NIT:</td><td>${fv.nit||''}</td><td class="nro-cell" rowspan="4"><div style="font-size:8px;font-weight:400">N° NOTA</div>${nro}</td></tr>
<tr><td class="lbl">CONTACTO:</td><td>${fv.contacto||''}</td><td class="lbl">MOTIVO:</td><td>${fv.motivoPrestamo||''}</td></tr>
<tr><td class="lbl">AUTORIZADO POR:</td><td style="font-weight:700">${fv.autorizado||''}</td><td class="lbl">TOTAL $US:</td><td style="font-weight:700">$${total.toFixed(2)}</td></tr>
<tr><td class="lbl">FECHA Y HORA:</td><td>${fv.fecha||''} ${fv.hora||''}</td><td class="lbl">OBSERVACIONES:</td><td>${fv.observaciones||''}</td></tr>
</table>
<div class="sec">DATOS PRÉSTAMO</div>
<table class="det"><thead><tr><th>CÓDIGO</th><th>P/N ó MODELO</th><th>S/N</th><th>CANT.</th><th>DESCRIPCIÓN</th><th>LISTA CONTENIDO</th><th>OBS</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sec" style="margin-top:6px">DATOS DEVOLUCIÓN</div>
<table class="det"><thead><tr><th>FECHA/HORA</th><th colspan="2">ENTREGUE CONFORME (NOMBRE/FIRMA)</th><th colspan="2">RECIBI CONFORME (NOMBRE/FIRMA)</th><th>CONDICIÓN DEVOLUCIÓN</th><th>NRO. REPORTE AVERÍA</th><th>OBS</th></tr></thead><tbody>${items.map(()=>`<tr><td style="height:28px">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('')}</tbody></table>
<div class="sigs"><div class="sig"><div class="sig-ttl">ENTREGADO POR<br>FIRMA ALMACÉN BOA</div><div style="font-size:9px;margin-bottom:20px">${fv.autorizado||''}</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">RECIBIDO POR<br>FIRMA EMPRESA TERCERA</div><div style="font-size:9px;margin-bottom:20px">${fv.nombreEmpresa||''}</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">AUTORIZADO POR<br>FIRMA BOA</div><div class="sig-line">&nbsp;</div></div></div>
<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${new Date().toLocaleString('es-BO')}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
</body></html>`);
        w.document.close();
    }

    private showMsg(type: 'success'|'error'|'info'|'warning', text: string): void {
        this.snackBar.open(text, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
