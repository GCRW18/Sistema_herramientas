import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, startWith, catchError } from 'rxjs/operators';
import { ParametrosService, ParametrosConfig } from '../../../../core/services/parametros.service';
import { AlertRecipientsService, AlertRecipient } from '../../../../core/services/alert-recipients.service';

export type ParamSection = 'calibracion' | 'prestamos' | 'inventario';

const DEFAULTS: ParametrosConfig = {
    dias_alerta_calibracion:      30,
    intervalo_calibracion_defecto: 365,
    dias_max_prestamo:            15,
    dias_alerta_vencimiento:      3,
    stock_minimo_defecto:         5,
    permitir_stock_negativo:      false,
    validar_calibracion_prestamo: true,
    requiere_aprobacion_externo:  true,
};

@Component({
    selector: 'app-parametros',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatIconModule,
        MatDialogModule,
        MatSnackBarModule,
    ],
    templateUrl: './parametros.component.html',
    styles: [`:host { display: flex; flex-direction: column; height: 100%; }`]
})
export class ParametrosComponent implements OnInit, OnDestroy {
    public dialogRef  = inject(MatDialogRef<ParametrosComponent>, { optional: true });
    private _paramSvc = inject(ParametrosService);
    private _alertSvc = inject(AlertRecipientsService);
    private _dialog   = inject(MatDialog);
    private _snack    = inject(MatSnackBar);
    private _destroy$ = new Subject<void>();

    // ── PARÁMETROS ──
    paramConfig: ParametrosConfig = { ...DEFAULTS };
    loadingParam = false;

    // ── DESTINATARIOS ──
    searchCtrl   = new FormControl('');
    loadingDest  = false;
    recipients:  AlertRecipient[] = [];
    filtered:    AlertRecipient[] = [];

    get totalActivos()   { return this.recipients.filter(r => r.activo).length; }
    get totalInactivos() { return this.recipients.filter(r => !r.activo).length; }

    ngOnInit(): void {
        this.loadParam();
        this.searchCtrl.valueChanges.pipe(
            startWith(''),
            debounceTime(300),
            distinctUntilChanged(),
            takeUntil(this._destroy$)
        ).subscribe(q => this._applyFilter(q ?? ''));
        this.loadDest();
    }

    // ── PARÁMETROS ──
    loadParam(): void {
        this.loadingParam = true;
        this._paramSvc.getParametros().pipe(
            catchError(() => of(null)),
            takeUntil(this._destroy$)
        ).subscribe(data => {
            if (data) this.paramConfig = data;
            this.loadingParam = false;
        });
    }

    async openParamCard(section: ParamSection): Promise<void> {
        const { FormParametrosComponent } = await import('./dialogs/form-parametros/form-parametros.component');
        const ref = this._dialog.open(FormParametrosComponent, {
            width: '420px',
            maxWidth: '95vw',
            panelClass: 'neo-dialog',
            data: { section, values: { ...this.paramConfig } },
            disableClose: true,
        });
        ref.afterClosed().subscribe((partial: Partial<ParametrosConfig> | undefined) => {
            if (!partial) return;
            const merged = { ...this.paramConfig, ...partial };
            this._paramSvc.saveParametros(merged).pipe(
                catchError(() => {
                    this._snack.open('Error al guardar parámetros', 'Cerrar', { duration: 4000, panelClass: ['snackbar-error'] });
                    return of(null);
                }),
                takeUntil(this._destroy$)
            ).subscribe(res => {
                if (res === null) return;
                this.paramConfig = merged;
                this._snack.open('Parámetros guardados correctamente', 'Cerrar', { duration: 3000, panelClass: ['snackbar-success'] });
            });
        });
    }

    // ── DESTINATARIOS ──
    loadDest(): void {
        this.loadingDest = true;
        this._alertSvc.getRecipients().pipe(
            catchError(() => of([])),
            takeUntil(this._destroy$)
        ).subscribe(data => {
            this.recipients = data;
            this._applyFilter(this.searchCtrl.value ?? '');
            this.loadingDest = false;
        });
    }

    private _applyFilter(q: string): void {
        const lower = q.toLowerCase();
        this.filtered = this.recipients.filter(r =>
            r.nombre.toLowerCase().includes(lower) ||
            r.email.toLowerCase().includes(lower)
        );
    }

    async openDestForm(destinatario?: AlertRecipient): Promise<void> {
        const { FormAlertaDestinatarioComponent } = await import('../alertas-destinatarios/dialogs/form-alerta-destinatario/form-alerta-destinatario.component');
        const ref = this._dialog.open(FormAlertaDestinatarioComponent, {
            width: '520px',
            maxWidth: '95vw',
            panelClass: 'neo-dialog',
            data: { destinatario, mode: destinatario ? 'edit' : 'create' },
            autoFocus: false,
            disableClose: false,
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            const obs$ = destinatario
                ? this._alertSvc.updateRecipient(destinatario.id_destinatario, result)
                : this._alertSvc.createRecipient(result);
            obs$.pipe(catchError(() => {
                this._snack.open('Error al guardar destinatario', 'Cerrar', { duration: 4000, panelClass: ['snackbar-error'] });
                return of(null);
            })).subscribe(res => {
                if (res === null) return;
                this._snack.open(destinatario ? 'Destinatario actualizado' : 'Destinatario creado', 'Cerrar', { duration: 3000, panelClass: ['snackbar-success'] });
                this.loadDest();
            });
        });
    }

    deleteDest(r: AlertRecipient): void {
        if (!confirm(`¿Eliminar a "${r.nombre}"?`)) return;
        this._alertSvc.deleteRecipient(r.id_destinatario).pipe(
            catchError(() => {
                this._snack.open('Error al eliminar', 'Cerrar', { duration: 4000, panelClass: ['snackbar-error'] });
                return of(undefined);
            })
        ).subscribe(() => {
            this._snack.open('Destinatario eliminado', 'Cerrar', { duration: 3000, panelClass: ['snackbar-success'] });
            this.loadDest();
        });
    }

    cfgVal(key: keyof ParametrosConfig): any { return this.paramConfig[key]; }

    ngOnDestroy(): void { this._destroy$.next(); this._destroy$.complete(); }
}
