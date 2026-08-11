import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule, DatePipe }   from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule }            from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule }         from '@angular/material/tooltip';
import { Subject, forkJoin }        from 'rxjs';
import { debounceTime, startWith, takeUntil, finalize, catchError } from 'rxjs/operators';
import { of }                       from 'rxjs';
import { MovementService }          from '../../../../core/services/movement.service';
import { HasPermissionDirective }   from '../../../../core/directives/has-permission.directive';
import { PrestamoPdfService, PrestamoPdfData } from './prestamo-pdf.service';

interface LoanDisplay {
    id_loan:                 number;
    loan_number:             string;
    loan_type:               string;
    borrower_name:           string;
    borrower_license:        string;
    loan_date:               string;
    loan_time:               string;
    expected_return_date:    string;
    status:                  string;
    loan_notes:              string;
    aircraft:                string;
    work_order_number:       string;
    department:              string;
    special_work:            boolean;
    delivered_by_name:       string;
    diasFuera:               number;
    actual_return_date:      string;
    received_return_by_name: string;
    return_notes:            string;
}

interface PendingItem {
    loanNumber:       string;
    id_loan:          number;
    borrowerName:     string;
    borrowerLicense:  string;
    loanDate:         string;
    diasFuera:        number;
    codigo:           string;
    descripcion:      string;
    pn:               string;
    sn:               string;
    cantidad:         number;
    und:              string;
    estadoAlPrestar:  string;
    fechaCalibracion: string;
    aeronave:         string;
    ordenTrabajo:     string;
}

@Component({
    selector: 'app-prestamo-tecnico-hub',
    standalone: true,
    imports: [CommonModule, DatePipe, ReactiveFormsModule, MatIconModule,
              MatDialogModule, MatSnackBarModule, MatTooltipModule, HasPermissionDirective],
    templateUrl: './prestamo-tecnico-hub.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class PrestamoTecnicoHubComponent implements OnInit, OnDestroy {

    private movementSvc   = inject(MovementService);
    private dialog        = inject(MatDialog);
    private snackBar      = inject(MatSnackBar);
    private prestamoPdfSvc = inject(PrestamoPdfService);
    private destroy$      = new Subject<void>();

    isLoading = signal(false);
    activeTab: 'prestamo' | 'devolucion' = 'prestamo';

    searchControl  = new FormControl('');
    filterStatus   = new FormControl('active');

    estadosFiltro = [
        { value: 'active',   label: 'Activos'   },
        { value: 'returned', label: 'Devueltos' },
        { value: '',         label: 'Todos'     },
    ];

    // ── Datos crudos
    private loans:    LoanDisplay[]  = [];
    private loanItems: any[]         = [];

    // ── Datos filtrados
    filteredLoans:   LoanDisplay[]  = [];
    pendingItems:    PendingItem[]  = [];
    filteredPending: PendingItem[]  = [];


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
        // Devoluciones siempre muestra ítems de préstamos activos
        if (tab === 'devolucion' && this.filterStatus.value !== 'active') {
            this.filterStatus.setValue('active', { emitEvent: false });
            this.loadData();
        }
    }

    // ── Carga unificada de préstamos + items ──────────────────────────────
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
                .filter((l: any) => l.loan_type !== 'external' && (!status || l.status === status))
                .map((l: any): LoanDisplay => ({
                id_loan:           Number(l.id_loan),
                loan_number:       l.loan_number       || `PT-${l.id_loan}`,
                loan_type:         l.loan_type          || 'internal',
                borrower_name:     l.borrower_name      || '—',
                borrower_license:  l.borrower_license   || '—',
                loan_date:            l.loan_date           || '',
                loan_time:            l.loan_time           || '',
                expected_return_date: l.expected_return_date || '',
                status:               l.status              || 'active',
                loan_notes:        l.loan_notes          || '',
                aircraft:          l.aircraft            || '—',
                work_order_number: l.work_order_number   || '—',
                department:        l.department          || '—',
                special_work:      !!l.special_work,
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
                .map((item: any): PendingItem => ({
                    loanNumber:       loan.loan_number,
                    id_loan:          loan.id_loan,
                    borrowerName:     loan.borrower_name,
                    borrowerLicense:  loan.borrower_license,
                    loanDate:         loan.loan_date,
                    diasFuera:        loan.diasFuera,
                    codigo:           item.code          || item.codigo || '—',
                    descripcion:      item.description   || item.name   || '—',
                    pn:               item.part_number   || item.pn     || '—',
                    sn:               item.serial_number || item.sn     || '—',
                    cantidad:         Number(item.quantity) || 1,
                    und:              item.unit_of_measure || 'UND',
                    estadoAlPrestar:  item.condition_on_loan || '—',
                    fechaCalibracion: item.next_calibration_date || item.calibration_date || '—',
                    aeronave:         loan.aircraft,
                    ordenTrabajo:     loan.work_order_number,
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
                l.loan_number.toLowerCase().includes(q)      ||
                l.borrower_name.toLowerCase().includes(q)    ||
                l.borrower_license.toLowerCase().includes(q) ||
                l.aircraft.toLowerCase().includes(q)         ||
                l.work_order_number.toLowerCase().includes(q)
            );
            this.filteredPending = this.pendingItems.filter(i =>
                i.loanNumber.toLowerCase().includes(q)      ||
                i.borrowerName.toLowerCase().includes(q)    ||
                i.codigo.toLowerCase().includes(q)          ||
                i.descripcion.toLowerCase().includes(q)     ||
                i.pn.toLowerCase().includes(q)
            );
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private _calcDias(fecha: string, hasta?: string): number {
        if (!fecha) return 0;
        const end = hasta ? new Date(hasta) : new Date();
        return Math.ceil(Math.abs(end.getTime() - new Date(fecha).getTime()) / 86400000);
    }

    calcDias(fecha: string): number { return this._calcDias(fecha); }

    formatFecha(loan_date: string, loan_time: string): string {
        if (!loan_date) return '—';
        const d = loan_date.substring(8, 10) + '/' + loan_date.substring(5, 7) + '/' + loan_date.substring(0, 4);
        const t = loan_time ? loan_time.substring(0, 5) : '';
        return t ? d + ' ' + t : d;
    }

    getDiasFueraClass(dias: number): string {
        if (dias <= 3)  return 'bg-green-100 text-green-800 border-green-300';
        if (dias <= 7)  return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        if (dias <= 15) return 'bg-orange-100 text-orange-800 border-orange-300';
        return 'bg-red-100 text-red-800 border-red-400';
    }

    private readonly _condicionLabel: Record<string, string> = {
        'good':'ACTIVO','new':'NUEVO','excellent':'EXCELENTE','fair':'REGULAR',
        'poor':'MALO','damaged':'DAÑADO','reconditioned':'REACONDICIONADO',
        'serviceable':'ACTIVO','bueno':'ACTIVO','nuevo':'NUEVO',
        'en_calibracion':'EN CALIBRACIÓN','unserviceable':'NO SERVICEABLE',
    };

    getCondicionLabel(est: string): string {
        return this._condicionLabel[(est || '').toLowerCase()] || (est || '—').toUpperCase();
    }

    getEstadoClass(est: string): string {
        const e = (est || '').toLowerCase();
        if (['good','serviceable','bueno','nuevo','new','excellent'].includes(e)) return 'bg-green-500 text-white';
        if (['fair','en_calibracion','reconditioned'].includes(e))                return 'bg-yellow-400 text-black';
        if (['damaged','poor','unserviceable'].includes(e))                       return 'bg-red-500 text-white';
        return 'bg-stone-400 text-white';
    }

    // ── Acciones ─────────────────────────────────────────────────────────
    async abrirFormPrestamo(): Promise<void> {
        const { FormPrestamoDialogComponent } = await import('./prestamo/form-prestamo-dialog.component');
        this.dialog.open(FormPrestamoDialogComponent, {
            width: 'min(820px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false
        }).afterClosed().subscribe(r => { if (r?.success) { this.showMsg('Préstamo registrado', 'success'); this.loadData(); } });
    }

    async abrirFormDevolucion(): Promise<void> {
        const { FormDevolucionDialogComponent } = await import('./devolucion/form-devolucion-dialog.component');
        this.dialog.open(FormDevolucionDialogComponent, {
            width: 'min(820px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false
        }).afterClosed().subscribe(r => { if (r?.success) { this.showMsg('Devolución registrada', 'success'); this.loadData(); } });
    }

    // ── PDF MGH-100 desde la fila de la tabla ────────────────────────────
    pdfPrestamo(loan: LoanDisplay): void {
        const items = this.loanItems.filter((i: any) => String(i.loan_id) === String(loan.id_loan));
        const data: PrestamoPdfData = {
            nroPrestamo: loan.loan_number,
            solicitante: loan.borrower_name,
            licencia: loan.borrower_license,
            matriculaAeronave: loan.aircraft,
            fechaHoraPrestamo: this.formatFecha(loan.loan_date, loan.loan_time),
            unidadDestino: loan.department,
            ordenTrabajo: loan.work_order_number,
            trabajoEspecial: !!loan.special_work,
            observaciones: loan.loan_notes,
            entregadoPor: loan.delivered_by_name,
            devuelto: false,
            items: items.map((it: any) => ({
                codigo: it.code, pn: it.part_number, sn: it.serial_number, cantidad: it.quantity || 1,
                unidad: it.unit_of_measure || 'UND', descripcion: it.description || it.name,
                listaContenido: it.content_list, fechaCalibracion: it.next_calibration_date,
                estado: this.getCondicionLabel(it.condition_on_loan || ''), obs: '',
            })),
        };
        this.prestamoPdfSvc.generarPdf(data);
    }

    pdfDevolucion(loan: LoanDisplay): void {
        const items = this.loanItems.filter((i: any) => String(i.loan_id) === String(loan.id_loan));
        const condLabel: Record<string, string> = {
            BUENO:'Bueno', bueno:'Bueno', good:'Bueno',
            DAÑADO:'Dañado', damaged:'Dañado',
            REQUIERE_CALIBRACION:'Req. Calib.', fair:'Req. Calib.',
            IRREPARABLE:'Irreparable', poor:'Irreparable',
            FALTANTE:'Faltante'
        };
        const estadoLabel: Record<string, string> = {
            good:'SERVICEABLE', new:'NUEVO', fair:'REGULAR', poor:'MALO', damaged:'DAÑADO',
            bueno:'SERVICEABLE', nuevo:'NUEVO'
        };
        const fechaDev  = loan.actual_return_date ? new Date(loan.actual_return_date).toLocaleString('es-BO') : '—';
        const recibePor = loan.received_return_by_name || '—';

        const data: PrestamoPdfData = {
            nroPrestamo: loan.loan_number,
            nroDevolucion: loan.loan_number,
            solicitante: loan.borrower_name,
            licencia: loan.borrower_license,
            matriculaAeronave: loan.aircraft,
            fechaHoraPrestamo: this.formatFecha(loan.loan_date, loan.loan_time),
            unidadDestino: loan.department,
            ordenTrabajo: loan.work_order_number,
            trabajoEspecial: !!loan.special_work,
            observaciones: loan.loan_notes,
            entregadoPor: loan.delivered_by_name,
            devuelto: true,
            fechaHoraDevolucion: fechaDev,
            recibioAlmacen: recibePor,
            items: items.map((it: any) => {
                const cond = it.condition_on_return || '';
                return {
                    codigo: it.code, pn: it.part_number, sn: it.serial_number, cantidad: it.quantity || 1,
                    unidad: it.unit_of_measure || 'UND', descripcion: it.description || it.name,
                    listaContenido: it.content_list, fechaCalibracion: it.next_calibration_date,
                    estado: estadoLabel[(it.condition_on_loan || '').toLowerCase()] || it.condition_on_loan || '',
                    obs: '',
                    condicionDevolucion: condLabel[cond] || condLabel[cond.toLowerCase()] || cond || '—',
                    obsDevolucion: it.notes || loan.return_notes || '',
                };
            }),
        };
        this.prestamoPdfSvc.generarPdf(data);
    }

    private showMsg(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: type === 'error' ? 5000 : 3000,
            horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`],
        });
    }
}
