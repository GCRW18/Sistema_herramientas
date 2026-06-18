import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, forkJoin, of } from 'rxjs';
import { debounceTime, startWith, takeUntil, finalize, catchError } from 'rxjs/operators';
import { MovementService } from '../../../../core/services/movement.service';

interface ExternalLoanDisplay {
    id_loan:                 number;
    loan_number:             string;
    borrower_name:           string;
    loan_date:               string;
    loan_time:               string;
    status:                  string;
    notes:                   string;
    motivo:                  string;
    delivered_by_name:       string;
    diasFuera:               number;
    actual_return_date:      string;
    received_return_by_name: string;
    return_notes:            string;
}

interface PendingExternalItem {
    loanNumber: string;
    id_loan:    number;
    empresa:    string;
    loanDate:   string;
    diasFuera:  number;
    codigo:     string;
    descripcion:string;
    pn:         string;
    sn:         string;
    cantidad:   number;
    und:        string;
    estadoAlPrestar: string;
}

@Component({
    selector: 'app-prestamo-externo-hub',
    standalone: true,
    imports: [CommonModule, DatePipe, ReactiveFormsModule, MatIconModule,
              MatDialogModule, MatSnackBarModule, MatTooltipModule],
    templateUrl: './prestamo-externo-hub.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class PrestamoExternoHubComponent implements OnInit, OnDestroy {

    private movementSvc = inject(MovementService);
    private dialog      = inject(MatDialog);
    private snackBar    = inject(MatSnackBar);
    private destroy$    = new Subject<void>();

    isLoading  = signal(false);
    activeTab: 'prestamo' | 'devolucion' = 'prestamo';

    searchControl = new FormControl('');
    filterStatus  = new FormControl('active');

    estadosFiltro = [
        { value: 'active',   label: 'Activos'   },
        { value: 'returned', label: 'Devueltos' },
        { value: '',         label: 'Todos'     },
    ];

    private loans:     ExternalLoanDisplay[] = [];
    private loanItems: any[]                 = [];

    filteredLoans:   ExternalLoanDisplay[]  = [];
    pendingItems:    PendingExternalItem[]  = [];
    filteredPending: PendingExternalItem[]  = [];

    ngOnInit(): void {
        this.loadData();
        this.searchControl.valueChanges.pipe(
            debounceTime(250), startWith(''), takeUntil(this.destroy$)
        ).subscribe(() => this.applyFilters());
        this.filterStatus.valueChanges.pipe(
            takeUntil(this.destroy$)
        ).subscribe(() => this.loadData());
    }

    ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

    setTab(tab: 'prestamo' | 'devolucion'): void {
        this.activeTab = tab;
        if (tab === 'devolucion' && this.filterStatus.value !== 'active') {
            this.filterStatus.setValue('active', { emitEvent: false });
            this.loadData();
        }
    }

    loadData(): void {
        this.isLoading.set(true);
        forkJoin({
            loans: this.movementSvc.getActiveLoans(),
            items: this.movementSvc.getActiveLoanItems()
        }).pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isLoading.set(false)),
            catchError(() => of({ loans: [], items: [] }))
        ).subscribe(({ loans, items }: any) => {
            const status = this.filterStatus.value;
            this.loans = ((loans || []) as any[])
                .filter((l: any) => l.loan_type === 'external' && (!status || l.status === status))
                .map((l: any): ExternalLoanDisplay => ({
                    id_loan:                 Number(l.id_loan),
                    loan_number:             l.loan_number      || `PE-${l.id_loan}`,
                    borrower_name:           l.borrower_name    || '—',
                    loan_date:               l.loan_date        || '',
                    loan_time:               l.loan_time        || '',
                    status:                  l.status           || 'active',
                    notes:                   l.loan_notes       || '',
                    motivo:                  l.notes || l.loan_notes || '—',
                    delivered_by_name:       l.delivered_by_name        || '—',
                    diasFuera:               l.status === 'returned'
                                                 ? this._calcDias(l.loan_date, l.actual_return_date || l.loan_date)
                                                 : this._calcDias(l.loan_date),
                    actual_return_date:      l.actual_return_date       || '',
                    received_return_by_name: l.received_return_by_name  || '',
                    return_notes:            l.return_notes             || '',
                }));
            this.loanItems = items || [];
            this._buildPending();
            this.applyFilters();
        });
    }

    private _isReturned(val: any): boolean {
        return val === true || val === 'true' || val === 't';
    }

    private _buildPending(): void {
        this.pendingItems = this.loans.flatMap(loan =>
            this.loanItems
                .filter((i: any) => String(i.loan_id) === String(loan.id_loan) && !this._isReturned(i.returned))
                .map((item: any): PendingExternalItem => ({
                    loanNumber:      loan.loan_number,
                    id_loan:         loan.id_loan,
                    empresa:         loan.borrower_name,
                    loanDate:        loan.loan_date,
                    diasFuera:       loan.diasFuera,
                    codigo:          item.code        || item.codigo || '—',
                    descripcion:     item.description || item.name   || '—',
                    pn:              item.part_number || item.pn     || '—',
                    sn:              item.serial_number || item.sn   || '—',
                    cantidad:        Number(item.quantity) || 1,
                    und:             item.unit_of_measure || 'UND',
                    estadoAlPrestar: item.condition_on_loan || '—',
                }))
        );
    }

    applyFilters(): void {
        const q = (this.searchControl.value || '').toLowerCase().trim();
        if (!q) {
            this.filteredLoans   = [...this.loans];
            this.filteredPending = [...this.pendingItems];
        } else {
            this.filteredLoans = this.loans.filter(l =>
                l.loan_number.toLowerCase().includes(q)   ||
                l.borrower_name.toLowerCase().includes(q) ||
                l.motivo.toLowerCase().includes(q)
            );
            this.filteredPending = this.pendingItems.filter(i =>
                i.loanNumber.toLowerCase().includes(q)   ||
                i.empresa.toLowerCase().includes(q)      ||
                i.codigo.toLowerCase().includes(q)       ||
                i.descripcion.toLowerCase().includes(q)
            );
        }
    }

    private _calcDias(fecha: string, hasta?: string): number {
        if (!fecha) return 0;
        const end = hasta ? new Date(hasta) : new Date();
        return Math.ceil(Math.abs(end.getTime() - new Date(fecha).getTime()) / 86400000);
    }

    formatFecha(loan_date: string, loan_time: string): string {
        if (!loan_date) return '—';
        const d = loan_date.substring(8,10) + '/' + loan_date.substring(5,7) + '/' + loan_date.substring(0,4);
        const t = loan_time ? loan_time.substring(0,5) : '';
        return t ? d + ' ' + t : d;
    }

    getDiasFueraClass(dias: number): string {
        if (dias <= 7)  return 'bg-green-100 text-green-800 border-green-300';
        if (dias <= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        if (dias <= 60) return 'bg-orange-100 text-orange-800 border-orange-300';
        return 'bg-red-100 text-red-800 border-red-400';
    }

    private readonly _condicionLabel: Record<string,string> = {
        'good':'ACTIVO','new':'NUEVO','fair':'REGULAR','poor':'MALO',
        'damaged':'DAÑADO','serviceable':'ACTIVO','bueno':'ACTIVO','nuevo':'NUEVO',
    };

    getCondicionLabel(est: string): string {
        return this._condicionLabel[(est||'').toLowerCase()] || (est||'—').toUpperCase();
    }

    getEstadoClass(est: string): string {
        const e = (est||'').toLowerCase();
        if (['good','serviceable','bueno','nuevo','new'].includes(e)) return 'bg-green-500 text-white';
        if (['fair'].includes(e))                                      return 'bg-yellow-400 text-black';
        if (['damaged','poor','unserviceable'].includes(e))            return 'bg-red-500 text-white';
        return 'bg-stone-400 text-white';
    }

    async abrirFormPrestamo(): Promise<void> {
        const { FormPrestamoExternoDialogComponent } = await import('./prestamo/form-prestamo-externo-dialog.component');
        this.dialog.open(FormPrestamoExternoDialogComponent, {
            width: 'min(820px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false
        }).afterClosed().subscribe(r => {
            if (r?.success) { this.showMsg('Préstamo externo registrado', 'success'); this.loadData(); }
        });
    }

    async abrirFormDevolucion(): Promise<void> {
        const { FormDevolucionExternoDialogComponent } = await import('./devolucion/form-devolucion-externo-dialog.component');
        this.dialog.open(FormDevolucionExternoDialogComponent, {
            width: 'min(820px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false
        }).afterClosed().subscribe(r => {
            if (r?.success) { this.showMsg('Devolución registrada', 'success'); this.loadData(); }
        });
    }

    pdfPrestamo(loan: ExternalLoanDisplay): void {
        const items  = this.loanItems.filter((i: any) => String(i.loan_id) === String(loan.id_loan));
        const total  = items.reduce((s: number, i: any) => s + Number(i.total_cost || 0), 0);
        const rows   = items.map((it: any) =>
            `<tr><td>${it.code||'-'}</td><td>${it.part_number||'-'}</td><td>${it.serial_number||'-'}</td><td style="text-align:center;font-weight:700">${it.quantity||1}</td><td>${it.description||it.name||'-'}</td><td>${it.content_list||'-'}</td><td>${it.notes||'&nbsp;'}</td></tr>`
        ).join('');
        const emptyDevRows = items.map(() =>
            `<tr><td style="height:28px">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`
        ).join('');
        const css   = `<style>@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:0}.top{display:flex;justify-content:space-between;margin-bottom:5px}.code-box{border:2px solid #000;padding:3px 10px;font-weight:900;font-size:13px;display:inline-block}h1{text-align:center;font-size:12px;font-weight:900;text-transform:uppercase;background:#111A43;color:white;padding:7px 10px;margin:0 0 7px;border:1px solid #000}.info-tbl{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:7px}.info-tbl td{border:1px solid #ddd;padding:3px 6px}.lbl{background:#f0f0f0;font-weight:700;font-size:9px;width:130px}.nro-cell{background:#f0f0f0;text-align:center;font-weight:900;font-size:15px;vertical-align:middle;width:120px}.sec{background:#111A43;color:white;padding:3px 8px;font-weight:900;font-size:10px;text-transform:uppercase;border:1px solid #000}table.det{width:100%;border-collapse:collapse;border:1px solid #000}table.det th{background:#111A43;color:white;padding:5px 4px;font-size:8.5px;font-weight:900;text-transform:uppercase;border:1px solid #000;text-align:center}table.det td{padding:4px;border:1px solid #ddd;font-size:9px}table.det tr:nth-child(even) td{background:#f9f9f9}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.sig{border:1px solid #000;padding:6px 8px;text-align:center}.sig-ttl{font-weight:900;font-size:9px;text-transform:uppercase;margin-bottom:26px;line-height:1.4}.sig-line{border-top:1px solid #000;padding-top:3px;font-size:8.5px}.footer{text-align:center;margin-top:10px;font-size:7.5px;color:#888;border-top:1px dotted #ccc;padding-top:4px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
        const fecha  = this.formatFecha(loan.loan_date, loan.loan_time);
        const html   = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MGH-100 ${loan.loan_number}</title>${css}</head><body>
<div class="top"><div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145#114 &nbsp; N-114</div><div style="text-align:right"><div class="code-box">MGH-100</div><br><span style="font-size:9px">REV. 0 &nbsp; 2016-10-13</span></div></div>
<h1>NOTA DE PRÉSTAMO - DEVOLUCIÓN A TERCEROS</h1>
<table class="info-tbl">
<tr><td class="lbl">EMPRESA / SOLICITANTE:</td><td style="font-weight:700">${loan.borrower_name}</td><td class="lbl">MOTIVO:</td><td>${loan.motivo}</td><td class="nro-cell" rowspan="3"><div style="font-size:8px;font-weight:400">N° NOTA</div>${loan.loan_number}</td></tr>
<tr><td class="lbl">ENTREGADO POR (ALMACÉN):</td><td style="font-weight:700">${loan.delivered_by_name}</td><td class="lbl">TOTAL $US:</td><td style="font-weight:700">$${total.toFixed(2)}</td></tr>
<tr><td class="lbl">FECHA Y HORA:</td><td>${fecha}</td><td class="lbl">OBSERVACIONES:</td><td>${loan.notes}</td></tr>
</table>
<div class="sec">DATOS PRÉSTAMO</div>
<table class="det"><thead><tr><th>CÓDIGO</th><th>P/N ó MODELO</th><th>S/N</th><th>CANT.</th><th>DESCRIPCIÓN</th><th>LISTA CONTENIDO</th><th>OBS</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sec" style="margin-top:6px">DATOS DEVOLUCIÓN</div>
<table class="det"><thead><tr><th>FECHA/HORA</th><th colspan="2">ENTREGUE CONFORME (NOMBRE/FIRMA)</th><th colspan="2">RECIBI CONFORME (NOMBRE/FIRMA)</th><th>CONDICIÓN DEVOLUCIÓN</th><th>NRO. REPORTE AVERÍA</th><th>OBS</th></tr></thead><tbody>${emptyDevRows}</tbody></table>
<div class="sigs"><div class="sig"><div class="sig-ttl">ENTREGADO POR<br>FIRMA ALMACÉN BOA</div><div style="font-size:9px;margin-bottom:20px">${loan.delivered_by_name}</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">RECIBIDO POR<br>FIRMA EMPRESA TERCERA</div><div style="font-size:9px;margin-bottom:20px">${loan.borrower_name}</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">AUTORIZADO POR<br>FIRMA BOA</div><div class="sig-line">&nbsp;</div></div></div>
<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${new Date().toLocaleString('es-BO')}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
</body></html>`;
        this._abrirBlob(html);
    }

    pdfDevolucion(loan: ExternalLoanDisplay): void {
        const items     = this.loanItems.filter((i: any) => String(i.loan_id) === String(loan.id_loan));
        const total     = items.reduce((s: number, i: any) => s + Number(i.total_cost || 0), 0);
        const fechaPrest = this.formatFecha(loan.loan_date, loan.loan_time);
        const fechaDev   = loan.actual_return_date ? new Date(loan.actual_return_date).toLocaleString('es-BO') : '—';
        const condLabel: Record<string,string> = { BUENO:'Bueno', REPARADO:'Reparado', CALIBRADO:'Calibrado', PARCIAL:'Parcial', NO_REPARABLE:'No Reparable' };
        const rowsPrest  = items.map((it: any) =>
            `<tr><td>${it.code||'-'}</td><td>${it.part_number||'-'}</td><td>${it.serial_number||'-'}</td><td style="text-align:center;font-weight:700">${it.quantity||1}</td><td>${it.description||it.name||'-'}</td><td>${it.content_list||'-'}</td><td>${it.notes||'&nbsp;'}</td></tr>`
        ).join('');
        const rowsDev = items.map((it: any) => {
            const cond  = it.condition_on_return || '';
            const color = ['NO_REPARABLE','PARCIAL'].includes(cond) ? '#dc2626' : '#166534';
            return `<tr><td>${fechaDev}</td><td>${loan.borrower_name}</td><td>&nbsp;</td><td>${loan.received_return_by_name||'—'}</td><td>&nbsp;</td><td style="font-weight:700;color:${color}">${condLabel[cond]||cond||'—'}</td><td>&nbsp;</td><td>${it.notes||loan.return_notes||''}</td></tr>`;
        }).join('');
        const css = `<style>@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:0}.top{display:flex;justify-content:space-between;margin-bottom:5px}.code-box{border:2px solid #000;padding:3px 10px;font-weight:900;font-size:13px;display:inline-block}h1{text-align:center;font-size:12px;font-weight:900;text-transform:uppercase;background:#111A43;color:white;padding:7px 10px;margin:0 0 7px;border:1px solid #000}.info-tbl{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:7px}.info-tbl td{border:1px solid #ddd;padding:3px 6px}.lbl{background:#f0f0f0;font-weight:700;font-size:9px;width:130px}.nro-cell{background:#f0f0f0;text-align:center;font-weight:900;font-size:13px;vertical-align:middle;width:110px}.sec{background:#111A43;color:white;padding:3px 8px;font-weight:900;font-size:10px;text-transform:uppercase;border:1px solid #000}table.det{width:100%;border-collapse:collapse;border:1px solid #000}table.det th{background:#111A43;color:white;padding:5px 4px;font-size:8.5px;font-weight:900;text-transform:uppercase;border:1px solid #000;text-align:center}table.det td{padding:4px;border:1px solid #ddd;font-size:9px}table.det tr:nth-child(even) td{background:#f9f9f9}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.sig{border:1px solid #000;padding:6px 8px;text-align:center}.sig-ttl{font-weight:900;font-size:9px;text-transform:uppercase;margin-bottom:26px;line-height:1.4}.sig-line{border-top:1px solid #000;padding-top:3px;font-size:8.5px}.footer{text-align:center;margin-top:10px;font-size:7.5px;color:#888;border-top:1px dotted #ccc;padding-top:4px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MGH-100 DEV ${loan.loan_number}</title>${css}</head><body>
<div class="top"><div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145#114 &nbsp; N-114</div><div style="text-align:right"><div class="code-box">MGH-100</div><br><span style="font-size:9px">REV. 0 &nbsp; 2016-10-13</span></div></div>
<h1>NOTA DE PRÉSTAMO - DEVOLUCIÓN A TERCEROS</h1>
<table class="info-tbl">
<tr><td class="lbl">EMPRESA / SOLICITANTE:</td><td style="font-weight:700">${loan.borrower_name}</td><td class="lbl">MOTIVO:</td><td>${loan.motivo}</td><td class="nro-cell" rowspan="4"><div style="font-size:7px;font-weight:400">N° PRÉSTAMO</div><div>${loan.loan_number}</div><div style="font-size:7px;font-weight:400;margin-top:6px;background:#166534;color:white;padding:2px 4px;border-radius:3px">DEVUELTO</div></td></tr>
<tr><td class="lbl">ENTREGADO POR (ALMACÉN):</td><td style="font-weight:700">${loan.delivered_by_name}</td><td class="lbl">TOTAL $US:</td><td style="font-weight:700">$${total.toFixed(2)}</td></tr>
<tr><td class="lbl">FECHA PRÉSTAMO:</td><td>${fechaPrest}</td><td class="lbl">FECHA DEVOLUCIÓN:</td><td>${fechaDev}</td></tr>
<tr><td class="lbl">RECIBIDO EN ALMACÉN:</td><td style="font-weight:700">${loan.received_return_by_name||'—'}</td><td class="lbl">OBSERVACIONES:</td><td>${loan.notes}</td></tr>
</table>
<div class="sec">DATOS PRÉSTAMO</div>
<table class="det"><thead><tr><th>CÓDIGO</th><th>P/N ó MODELO</th><th>S/N</th><th>CANT.</th><th>DESCRIPCIÓN</th><th>LISTA CONTENIDO</th><th>OBS</th></tr></thead><tbody>${rowsPrest}</tbody></table>
<div class="sec" style="margin-top:6px">DATOS DEVOLUCIÓN</div>
<table class="det"><thead><tr><th>FECHA/HORA</th><th colspan="2">ENTREGUE CONFORME (NOMBRE/FIRMA)</th><th colspan="2">RECIBI CONFORME (NOMBRE/FIRMA)</th><th>CONDICIÓN DEVOLUCIÓN</th><th>NRO. REPORTE AVERÍA</th><th>OBS</th></tr></thead><tbody>${rowsDev}</tbody></table>
<div class="sigs"><div class="sig"><div class="sig-ttl">ENTREGADO POR<br>FIRMA ALMACÉN BOA</div><div style="font-size:9px;margin-bottom:20px">${loan.delivered_by_name}</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">RECIBIDO POR<br>FIRMA EMPRESA TERCERA (PRÉSTAMO)</div><div style="font-size:9px;margin-bottom:20px">${loan.borrower_name}</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">DEVUELVE / RECIBE ALMACÉN BOA</div><div style="font-size:9px;margin-bottom:12px">${loan.borrower_name} → ${loan.received_return_by_name||'—'}</div><div class="sig-line">&nbsp;</div></div></div>
<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; Generado: ${new Date().toLocaleString('es-BO')} &nbsp;|&nbsp; Préstamo: ${loan.loan_number}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
</body></html>`;
        this._abrirBlob(html);
    }

    private _abrirBlob(html: string): void {
        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    private showMsg(message: string, type: 'success'|'error'|'warning'|'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: type === 'error' ? 5000 : 3000,
            horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`],
        });
    }
}
