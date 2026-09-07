import { Component, OnInit, OnDestroy, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, catchError, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { MaintenanceService } from '../../../../../core/services/maintenance.service';
import { MovementService } from '../../../../../core/services/movement.service';
import { localDateStr } from '../../../../../core/utils/date.utils';

interface Funcionario { id: number; nombre: string; cargo: string; }

interface MaintenanceData {
    id_maintenance: number;
    tool_id: number;
    record_number: string;
    tool_code: string;
    tool_name: string;
    tool_serial?: string;
    provider: string;
    type: string;
    status: string;
    send_date: string;
    expected_return_date: string | null;
    base: string;
    cost: number;
    notes: string;
}

@Component({
    selector: 'app-form-servicio',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
        CdkDrag, CdkDragHandle,
    ],
    templateUrl: './form-servicio.component.html',
})
export class FormServicioComponent implements OnInit, OnDestroy {

    private maintenanceService = inject(MaintenanceService);
    public dialogRef = inject(MatDialogRef<FormServicioComponent>);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private _destroy$ = new Subject<void>();
    private _receivedBySearch$ = new Subject<string>();

    constructor(@Inject(MAT_DIALOG_DATA) public data: { mode?: string; maintenance?: MaintenanceData }) {
        this.actualReturnDateStr = this.getTodayStr();
        if (data?.maintenance) {
            this.maintenance = data.maintenance;
            if (data.maintenance.type) this.tipoMantenimientoRealizado = data.maintenance.type;
        }
    }

    maintenance: MaintenanceData | null = null;
    isSaving = signal(false);

    // ── Campos del retorno ─────────────────────────────────
    actualReturnDateStr: string;
    tipoMantenimientoRealizado: string = 'preventive';
    descripcionTrabajo = '';
    pruebaFuncionamiento = false;
    nextMaintenanceDateStr = '';
    proximoMantenimientoPeriodo: 'semiannual' | 'annual' = 'semiannual';
    showDescError = false;

    // Funcionario "recibido por"
    receivedByName               = '';
    receivedByFuncionarios: Funcionario[] = [];
    receivedByLoading            = false;
    showReceivedByDropdown       = false;

    get currentUser(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || 'BOA';
        } catch { return 'BOA'; }
    }

    canSubmit(): boolean {
        return !!(
            this.maintenance &&
            this.actualReturnDateStr &&
            this.tipoMantenimientoRealizado &&
            this.descripcionTrabajo.trim()
        );
    }

    getTypeLabel(type: string): string {
        const labels: Record<string, string> = { 'preventive': 'PREVENTIVO', 'corrective': 'CORRECTIVO' };
        return labels[type] ?? type?.toUpperCase() ?? '—';
    }

    fmtDate(d: string | null | undefined): string {
        if (!d || d === '—') return '—';
        const p = d.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
    }

    getTodayStr(): string {
        return localDateStr();
    }

    // ── Lifecycle ──────────────────────────────────────────
    ngOnInit(): void {
        this._setupReceivedBySearch();
        // Prellena "Recibido por" con el usuario logueado (editable).
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            if (auth.nombre_usuario) this.receivedByName = auth.nombre_usuario;
        } catch { /* ignore */ }
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    // ── Funcionario "recibido por" ─────────────────────────
    private _setupReceivedBySearch(): void {
        this._receivedBySearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showReceivedByDropdown = false; return of([]); }
                this.receivedByLoading = true;
                const q = t.toLowerCase();
                return this.movementService.getPersonal().pipe(
                    map(lista => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map((f: any) => ({ id: f.id_employee || f.id, nombre: f.nombreCompleto || f.nombre, cargo: f.cargo || '' }))
                    ),
                    finalize(() => this.receivedByLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.receivedByFuncionarios = res || [];
            this.showReceivedByDropdown = this.receivedByFuncionarios.length > 0;
        });
    }

    onReceivedByInput(v: string): void {
        this.receivedByName = v;
        if (v.length >= 2) this._receivedBySearch$.next(v);
        else this.showReceivedByDropdown = false;
    }

    selectReceivedBy(f: Funcionario): void {
        this.receivedByName = f.nombre;
        this.showReceivedByDropdown = false;
    }

    hideReceivedByDropdown(): void { setTimeout(() => this.showReceivedByDropdown = false, 200); }

    // ── Cálculo del próximo mantenimiento ──────────────────
    onTipoMantChange(): void {
        if (!this.actualReturnDateStr) return;
        if (this.tipoMantenimientoRealizado === 'preventive') {
            const base = new Date(this.actualReturnDateStr + 'T00:00:00');
            base.setMonth(base.getMonth() + 6);
            this.nextMaintenanceDateStr = localDateStr(base);
            this.proximoMantenimientoPeriodo = 'semiannual';
        } else {
            this.nextMaintenanceDateStr = '';
        }
    }

    onRetornoFechaChange(): void {
        if (this.tipoMantenimientoRealizado) this.onTipoMantChange();
    }

    onProximoPeriodoChange(): void {
        if (!this.actualReturnDateStr) return;
        const base = new Date(this.actualReturnDateStr + 'T00:00:00');
        base.setMonth(base.getMonth() + (this.proximoMantenimientoPeriodo === 'annual' ? 12 : 6));
        this.nextMaintenanceDateStr = localDateStr(base);
    }

    // ── Envío del retorno ──────────────────────────────────
    submitRetorno(): void {
        if (!this.canSubmit()) {
            if (!this.descripcionTrabajo.trim()) {
                this.showDescError = true;
                this.showMessage('La descripción del trabajo es obligatoria', 'error');
            }
            return;
        }
        this.isSaving.set(true);

        const params: any = {
            id_maintenance:     this.maintenance!.id_maintenance,
            tool_id:            this.maintenance!.tool_id,
            type:               this.tipoMantenimientoRealizado,
            actual_return_date: this.actualReturnDateStr,
            completion_date:    this.actualReturnDateStr,
            solution:           this.descripcionTrabajo.trim(),
            recommendations:    this.pruebaFuncionamiento
                ? 'Prueba de funcionamiento: REALIZADA - OK'
                : 'Prueba de funcionamiento: NO REALIZADA',
            received_by_name:   this.receivedByName.trim() || this.currentUser,
        };
        if (this.tipoMantenimientoRealizado === 'preventive') {
            params.next_maintenance_period = this.proximoMantenimientoPeriodo;
        }
        if (this.nextMaintenanceDateStr) params.next_maintenance_date = this.nextMaintenanceDateStr;

        this.maintenanceService.returnMaintenancePxp(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: () => {
                this.showMessage('Retorno de mantenimiento procesado exitosamente', 'success');
                setTimeout(() => this.dialogRef.close(true), 500);
            },
            error: (err) => this.showMessage(err?.message || 'Error al procesar el retorno', 'error')
        });
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 4000, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
