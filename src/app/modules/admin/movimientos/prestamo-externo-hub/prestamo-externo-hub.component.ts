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
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { PrestamoExternoPdfService, PrestamoExternoPdfData } from './prestamo-externo-pdf.service';

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
              MatDialogModule, MatSnackBarModule, MatTooltipModule, HasPermissionDirective],
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
    private pdfSvc       = inject(PrestamoExternoPdfService);
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
        const items = this.loanItems.filter((i: any) => String(i.loan_id) === String(loan.id_loan));
        const data: PrestamoExternoPdfData = {
            nroPrestamo: loan.loan_number,
            solicitante: loan.delivered_by_name,
            empresa: loan.borrower_name,
            fechaHoraPrestamo: this.formatFecha(loan.loan_date, loan.loan_time),
            observaciones: loan.notes,
            entregadoPor: loan.delivered_by_name,
            devuelto: false,
            items: items.map((it: any) => ({
                codigo: it.code || '', pn: it.part_number || '', sn: it.serial_number || '',
                cantidad: Number(it.quantity) || 1, descripcion: it.description || it.name || '',
                listaContenido: it.content_list || '', hrCosto: Number(it.unit_cost) || 0,
                valorUsd: Number(it.total_cost) || 0, obs: it.notes || '',
            })),
        };
        this.pdfSvc.generarPdf(data);
    }

    pdfDevolucion(loan: ExternalLoanDisplay): void {
        const items = this.loanItems.filter((i: any) => String(i.loan_id) === String(loan.id_loan));
        const condLabel: Record<string,string> = { BUENO:'Bueno', REPARADO:'Reparado', CALIBRADO:'Calibrado', PARCIAL:'Parcial', NO_REPARABLE:'No Reparable' };
        const data: PrestamoExternoPdfData = {
            nroPrestamo: loan.loan_number,
            nroDevolucion: loan.loan_number,
            solicitante: loan.delivered_by_name,
            empresa: loan.borrower_name,
            fechaHoraPrestamo: this.formatFecha(loan.loan_date, loan.loan_time),
            observaciones: loan.notes,
            entregadoPor: loan.delivered_by_name,
            devuelto: true,
            fechaHoraDevolucion: loan.actual_return_date ? new Date(loan.actual_return_date).toLocaleString('es-BO') : '---',
            recibioAlmacen: loan.received_return_by_name || '---',
            items: items.map((it: any) => ({
                codigo: it.code || '', pn: it.part_number || '', sn: it.serial_number || '',
                cantidad: Number(it.quantity) || 1, descripcion: it.description || it.name || '',
                listaContenido: it.content_list || '', hrCosto: Number(it.unit_cost) || 0,
                valorUsd: Number(it.total_cost) || 0, obs: it.notes || '',
                condicionDevolucion: condLabel[it.condition_on_return] || it.condition_on_return || '',
                obsDevolucion: it.notes || loan.return_notes || '',
            })),
        };
        this.pdfSvc.generarPdf(data);
    }

    private showMsg(message: string, type: 'success'|'error'|'warning'|'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: type === 'error' ? 5000 : 3000,
            horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`],
        });
    }
}
