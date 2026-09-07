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

    private readonly _condicionLabel: Record<string,string> = {
        'good':'ACTIVO','new':'NUEVO','fair':'REGULAR','poor':'MALO',
        'damaged':'DAÑADO','serviceable':'ACTIVO','bueno':'ACTIVO','nuevo':'NUEVO',
    };

    getCondicionLabel(est: string): string {
        return this._condicionLabel[(est||'').toLowerCase()] || (est||'—').toUpperCase();
    }

    async abrirFormPrestamo(): Promise<void> {
        const { FormPrestamoExternoDialogComponent } = await import('./prestamo/form-prestamo-externo-dialog.component');
        this.dialog.open(FormPrestamoExternoDialogComponent, {
            width: 'min(1240px, 96vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false
        }).afterClosed().subscribe(r => {
            if (r?.success) { this.showMsg('Préstamo externo registrado', 'success'); this.loadData(); }
        });
    }

    async abrirFormDevolucion(): Promise<void> {
        const { FormDevolucionExternoDialogComponent } = await import('./devolucion/form-devolucion-externo-dialog.component');
        this.dialog.open(FormDevolucionExternoDialogComponent, {
            width: 'min(1240px, 96vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false
        }).afterClosed().subscribe(r => {
            if (r?.success) { this.showMsg('Devolución registrada', 'success'); this.loadData(); }
        });
    }

    /** Nota MGH-100 (nota de préstamo - devolución terceros) — PDF real TCPDF backend. */
    verNotaTerceros(loan: ExternalLoanDisplay): void {
        if (!loan?.id_loan) { this.showMsg('No se pudo identificar el préstamo', 'error'); return; }
        const win = this.movementSvc.preAbrirVentanaPdf();
        this.movementSvc.generarPdfNotaPrestamo(loan.id_loan, 'mgh100', true).pipe(takeUntil(this.destroy$)).subscribe({
            next: (r) => this.movementSvc.abrirPdfNota(r.pdf_base64, r.nombre_archivo, win),
            error: (e) => { try { win?.close(); } catch { /* noop */ } this.showMsg('Error al generar la nota MGH-100: ' + (e?.message || ''), 'error'); }
        });
    }

    /** Control MGH-100-1 (hoja de control) de un préstamo externo — PDF real TCPDF backend. */
    verControlTerceros(loan: ExternalLoanDisplay): void {
        if (!loan?.id_loan) { this.showMsg('No se pudo identificar el préstamo', 'error'); return; }
        const win = this.movementSvc.preAbrirVentanaPdf();
        this.movementSvc.generarPdfNotaPrestamo(loan.id_loan, 'mgh100_1', true).pipe(takeUntil(this.destroy$)).subscribe({
            next: (r) => this.movementSvc.abrirPdfNota(r.pdf_base64, r.nombre_archivo, win),
            error: (e) => { try { win?.close(); } catch { /* noop */ } this.showMsg('Error al generar el control MGH-100-1: ' + (e?.message || ''), 'error'); }
        });
    }

    private showMsg(message: string, type: 'success'|'error'|'warning'|'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: type === 'error' ? 5000 : 3000,
            horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`],
        });
    }
}
