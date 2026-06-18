import { Component, OnInit, OnDestroy, inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, combineLatest, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap, startWith, catchError } from 'rxjs/operators';
import { AlertRecipientsService, AlertRecipient } from '../../../../core/services/alert-recipients.service';
import { FormAlertaDestinatarioComponent } from './dialogs/form-alerta-destinatario/form-alerta-destinatario.component';

@Component({
    selector: 'app-alertas-destinatarios',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
    ],
    templateUrl: './alertas-destinatarios.component.html',
    styles: [`:host { display: flex; flex-direction: column; height: 100%; }`]
})
export class AlertasDestinatariosComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<AlertasDestinatariosComponent>, { optional: true });
    private _svc   = inject(AlertRecipientsService);
    private _dialog = inject(MatDialog);
    private _snack  = inject(MatSnackBar);
    private _destroy$ = new Subject<void>();

    searchCtrl = new FormControl('');
    loading    = false;
    recipients: AlertRecipient[] = [];
    filtered:   AlertRecipient[] = [];

    get totalActivos()   { return this.recipients.filter(r => r.activo).length; }
    get totalInactivos() { return this.recipients.filter(r => !r.activo).length; }

    ngOnInit(): void {
        this.searchCtrl.valueChanges.pipe(
            startWith(''),
            debounceTime(300),
            distinctUntilChanged(),
            takeUntil(this._destroy$)
        ).subscribe(q => this._applyFilter(q ?? ''));

        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        this._svc.getRecipients().pipe(
            catchError(() => of([])),
            takeUntil(this._destroy$)
        ).subscribe(data => {
            this.recipients = data;
            this._applyFilter(this.searchCtrl.value ?? '');
            this.loading = false;
        });
    }

    private _applyFilter(q: string): void {
        const lower = q.toLowerCase();
        this.filtered = this.recipients.filter(r =>
            r.nombre.toLowerCase().includes(lower) ||
            r.email.toLowerCase().includes(lower)
        );
    }

    openForm(destinatario?: AlertRecipient): void {
        const ref = this._dialog.open(FormAlertaDestinatarioComponent, {
            width: '520px',
            maxWidth: '95vw',
            panelClass: ['neo-dialog', 'no-padding-dialog'],
            data: { destinatario, mode: destinatario ? 'edit' : 'create' },
            autoFocus: false,
            disableClose: false,
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            const obs$ = destinatario
                ? this._svc.updateRecipient(destinatario.id_destinatario, result)
                : this._svc.createRecipient(result);

            obs$.pipe(catchError(() => {
                this._snack.open('Error al guardar el destinatario', '✕', { duration: 4000, panelClass: ['error-snackbar'] });
                return of(null);
            })).subscribe(res => {
                if (res === null) return;
                this._snack.open(destinatario ? 'Destinatario actualizado' : 'Destinatario creado', '✓', { duration: 3000, panelClass: ['success-snackbar'] });
                this.loadData();
            });
        });
    }

    deleteRecipient(r: AlertRecipient): void {
        if (!confirm(`¿Eliminar a "${r.nombre}"?`)) return;
        this._svc.deleteRecipient(r.id_destinatario).pipe(
            catchError(() => {
                this._snack.open('Error al eliminar', '✕', { duration: 4000, panelClass: ['error-snackbar'] });
                return of(undefined);
            })
        ).subscribe(() => {
            this._snack.open('Destinatario eliminado', '✓', { duration: 3000, panelClass: ['success-snackbar'] });
            this.loadData();
        });
    }

    close(): void { this.dialogRef?.close(); }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }
}
