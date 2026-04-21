import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

export interface JackItem {
    tool_id: number;
    tool_code: string;
    tool_name: string;
    serial_number: string;
    warehouse: string;
    calibration_status: string;
    calibration_expiry: string;
    last_semiannual: string;
    next_semiannual: string;
    semi_status: string;
    last_annual: string;
    next_annual: string;
    annual_status: string;
}

@Component({
    selector: 'app-servicios-gatas',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatSnackBarModule
    ],
    templateUrl: './servicios-gatas.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #0F172AFF; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #1e293b; }
        .dark .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #fbbf24; }

        .transition-all {
            transition-property: all;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            transition-duration: 150ms;
        }

        @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
            animation: spin-slow 3s linear infinite;
        }

        .modal-enter {
            animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes modalIn {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
    `]
})
export class ServiciosGatasComponent implements OnInit, OnDestroy {
    private calibrationService = inject(CalibrationService);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    isLoading = false;
    isSaving = false;
    showServiceForm = false;
    jacks: JackItem[] = [];

    // Paginación ajustada a 5 filas por página
    currentPage = 1;
    pageSize = 5;

    selectedJack: JackItem | null = null;
    serviceType = 'semiannual';
    serviceDateStr = new Date().toISOString().split('T')[0];
    serviceNotes = '';

    ngOnInit(): void {
        this.loadJacks();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadJacks(): void {
        this.isLoading = true;
        this.selectedJack = null;
        this.currentPage = 1;
        this.calibrationService.getJackServiceStatus({ start: 0, limit: 1000 }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (res: any) => {
                this.jacks = Array.isArray(res) ? res : (res?.datos || []);
            },
            error: () => {
                this.jacks = [];
                this.snackBar.open('Error al cargar gatas', 'Cerrar', { duration: 3000, panelClass: ['snackbar-error'] });
            }
        });
    }

    // --- LÓGICA DE PAGINACIÓN ---
    get totalPages(): number {
        return Math.ceil(this.jacks.length / this.pageSize) || 1;
    }

    get paginatedJacks(): JackItem[] {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.jacks.slice(start, start + this.pageSize);
    }

    get startIndex(): number {
        return this.jacks.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    }

    get endIndex(): number {
        return Math.min(this.currentPage * this.pageSize, this.jacks.length);
    }

    nextPage(): void {
        if (this.currentPage < this.totalPages) this.currentPage++;
    }

    prevPage(): void {
        if (this.currentPage > 1) this.currentPage--;
    }
    // ----------------------------

    countSemiExpired(): number {
        return this.jacks.filter(j => j.semi_status === 'VENCIDO').length;
    }

    countSemiExpiring(): number {
        return this.jacks.filter(j => j.semi_status === 'CRITICO' || j.semi_status === 'PROXIMO').length;
    }

    countAnnualExpired(): number {
        return this.jacks.filter(j => j.annual_status === 'VENCIDO').length;
    }

    countAnnualExpiring(): number {
        return this.jacks.filter(j => j.annual_status === 'CRITICO' || j.annual_status === 'PROXIMO').length;
    }

    getStatusBadgeClass(status: string): string {
        switch (status?.toUpperCase()) {
            case 'VIGENTE':
            case 'VALID':
                return 'border-[2px] border-black bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
            case 'POR VENCER':
            case 'PROXIMO':
                return 'border-[2px] border-black bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
            case 'CRITICO':
            case 'CRITICAL':
                return 'border-[2px] border-black bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
            case 'VENCIDO':
            case 'VENCIDA':
            case 'EXPIRED':
                return 'border-[2px] border-black bg-red-500 text-white';
            case 'EN LAB':
            case 'IN_LAB':
                return 'border-[2px] border-black bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300';
            default:
                return 'border-[2px] border-black bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
        }
    }

    getStatusShort(status: string): string {
        switch (status?.toUpperCase()) {
            case 'VIGENTE':
            case 'VALID':
                return 'OK';
            case 'POR VENCER':
            case 'PROXIMO':
                return 'PRÓX.';
            case 'CRITICO':
            case 'CRITICAL':
                return 'CRIT.';
            case 'VENCIDO':
            case 'VENCIDA':
            case 'EXPIRED':
                return 'VENC.';
            case 'EN LAB':
            case 'IN_LAB':
                return 'LAB';
            default:
                return status || '—';
        }
    }

    selectJack(jack: JackItem): void {
        this.selectedJack = jack;
    }

    openServiceForm(jack?: JackItem): void {
        if (jack) {
            this.selectedJack = jack;
        }
        if (!this.selectedJack) return;

        this.serviceType = 'semiannual';
        this.serviceDateStr = new Date().toISOString().split('T')[0];
        this.serviceNotes = '';
        this.showServiceForm = true;
    }

    closeForm(): void {
        this.showServiceForm = false;
    }

    registerService(): void {
        if (!this.selectedJack) return;

        this.isSaving = true;
        this.calibrationService.registerJackService({
            tool_id: this.selectedJack.tool_id,
            service_type: this.serviceType as any,
            service_date: this.serviceDateStr,
            notes: this.serviceNotes
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSaving = false)
        ).subscribe({
            next: () => {
                this.snackBar.open('Servicio registrado exitosamente', 'Cerrar', {
                    duration: 3000,
                    horizontalPosition: 'end',
                    verticalPosition: 'top',
                    panelClass: ['snackbar-success']
                });
                this.closeForm();
                this.selectedJack = null;
                this.loadJacks();
            },
            error: () => {
                this.snackBar.open('Error al registrar servicio', 'Cerrar', {
                    duration: 3000,
                    panelClass: ['snackbar-error']
                });
            }
        });
    }
}
