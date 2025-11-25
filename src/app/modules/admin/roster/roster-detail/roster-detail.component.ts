import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RosterService, NotificationService } from 'app/core/services';
import { RosterAssignment, RosterStatus, ShiftType } from 'app/core/models';
import { ErpConfirmationService } from '@erp/services/confirmation';

@Component({
    selector: 'app-roster-detail',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatChipsModule,
        MatDividerModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './roster-detail.component.html',
    styleUrl: './roster-detail.component.scss'
})
export default class RosterDetailComponent implements OnInit {
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _rosterService = inject(RosterService);
    private _confirmationService = inject(ErpConfirmationService);
    private _notificationService = inject(NotificationService);

    assignment: RosterAssignment | null = null;
    loading = true;

    ngOnInit(): void {
        this.loadAssignment();
    }

    loadAssignment(): void {
        const id = this._route.snapshot.paramMap.get('id');
        if (!id) {
            this._router.navigate(['/roster']);
            return;
        }

        this.loading = true;
        this._rosterService.getAssignmentById(id).subscribe({
            next: (assignment) => {
                this.assignment = assignment;
                this.loading = false;
            },
            error: () => {
                this._notificationService.error('Error al cargar la asignación');
                this.loading = false;
                this._router.navigate(['/roster']);
            },
        });
    }

    goBack(): void {
        this._router.navigate(['/roster']);
    }

    editAssignment(): void {
        if (this.assignment) {
            this._router.navigate(['/roster', this.assignment.id, 'edit']);
        }
    }

    returnAssignment(): void {
        if (!this.assignment) return;

        const confirmation = this._confirmationService.open({
            title: 'Devolver Asignación',
            message: `¿Confirmar la devolución de <strong>${this.getItemName()}</strong>?`,
            icon: {
                show: true,
                name: 'heroicons_outline:arrow-uturn-left',
                color: 'primary',
            },
            actions: {
                confirm: {
                    show: true,
                    label: 'Confirmar Devolución',
                    color: 'primary',
                },
                cancel: {
                    show: true,
                    label: 'Cancelar',
                },
            },
        });

        confirmation.afterClosed().subscribe((result) => {
            if (result === 'confirmed' && this.assignment) {
                this._rosterService.returnAssignment({
                    assignmentId: this.assignment.id,
                    actualReturnDate: new Date().toISOString(),
                }).subscribe({
                    next: () => {
                        this._notificationService.success('Asignación devuelta correctamente');
                        this.loadAssignment();
                    },
                    error: () => {
                        this._notificationService.error('Error al devolver asignación');
                    },
                });
            }
        });
    }

    deleteAssignment(): void {
        if (!this.assignment) return;

        const confirmation = this._confirmationService.open({
            title: 'Eliminar Asignación',
            message: `¿Está seguro de eliminar esta asignación? Esta acción no se puede deshacer.`,
            icon: {
                show: true,
                name: 'heroicons_outline:exclamation-triangle',
                color: 'warn',
            },
            actions: {
                confirm: {
                    show: true,
                    label: 'Eliminar',
                    color: 'warn',
                },
                cancel: {
                    show: true,
                    label: 'Cancelar',
                },
            },
        });

        confirmation.afterClosed().subscribe((result) => {
            if (result === 'confirmed' && this.assignment) {
                this._rosterService.deleteAssignment(this.assignment.id).subscribe({
                    next: () => {
                        this._notificationService.success('Asignación eliminada correctamente');
                        this._router.navigate(['/roster']);
                    },
                    error: () => {
                        this._notificationService.error('Error al eliminar asignación');
                    },
                });
            }
        });
    }

    getItemName(): string {
        if (!this.assignment) return '';
        return this.assignment.assignmentType === 'tool'
            ? this.assignment.toolName || 'Herramienta'
            : this.assignment.kitName || 'Kit';
    }

    getItemCode(): string {
        if (!this.assignment) return '';
        return this.assignment.assignmentType === 'tool'
            ? this.assignment.toolCode || '-'
            : this.assignment.kitCode || '-';
    }

    getStatusInfo(): { label: string; color: string; bgColor: string } {
        if (!this.assignment) return { label: '', color: '', bgColor: '' };

        const statusMap: Record<RosterStatus, { label: string; color: string; bgColor: string }> = {
            active: { label: 'Activo', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-800' },
            returned: { label: 'Devuelto', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-800' },
            overdue: { label: 'Vencido', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-800' },
            extended: { label: 'Extendido', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-800' }
        };

        return statusMap[this.assignment.status] || { label: this.assignment.status, color: 'text-gray-600', bgColor: 'bg-gray-100' };
    }

    getShiftLabel(): string {
        if (!this.assignment?.shift) return 'N/A';

        const shiftMap: Record<ShiftType, string> = {
            morning: 'Mañana (07:00 - 15:00)',
            afternoon: 'Tarde (15:00 - 23:00)',
            night: 'Noche (23:00 - 07:00)',
            all_day: 'Todo el día'
        };

        return shiftMap[this.assignment.shift] || this.assignment.shift;
    }

    getAssignmentTypeLabel(): string {
        if (!this.assignment) return '';
        return this.assignment.assignmentType === 'tool' ? 'Herramienta' : 'Kit';
    }

    formatDate(date: string | undefined): string {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDateShort(date: string | undefined): string {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    canReturn(): boolean {
        return this.assignment?.status === 'active' || this.assignment?.status === 'overdue';
    }

    canEdit(): boolean {
        return this.assignment?.status === 'active' || this.assignment?.status === 'overdue';
    }

    isOverdue(): boolean {
        if (!this.assignment?.expectedReturnDate || this.assignment.status === 'returned') {
            return false;
        }
        return new Date(this.assignment.expectedReturnDate) < new Date();
    }

    getDaysOverdue(): number {
        if (!this.isOverdue() || !this.assignment?.expectedReturnDate) return 0;
        const today = new Date();
        const expectedReturn = new Date(this.assignment.expectedReturnDate);
        const diffTime = Math.abs(today.getTime() - expectedReturn.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}
