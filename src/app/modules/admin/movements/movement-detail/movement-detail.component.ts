import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MovementService } from 'app/core/services';
import { Movement } from 'app/core/models';

@Component({
    selector: 'app-movement-detail',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatDividerModule,
    ],
    templateUrl: './movement-detail.component.html',
    styleUrl: './movement-detail.component.scss'
})
export default class MovementDetailComponent implements OnInit {
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _movementService = inject(MovementService);

    movement: Movement | null = null;
    loading = false;

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('id');
        if (id) {
            this.loadMovement(id);
        }
    }

    loadMovement(id: string): void {
        this.loading = true;
        this._movementService.getMovementById(id).subscribe({
            next: (movement) => {
                this.movement = movement;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    back(): void {
        this._router.navigate(['/movements/history']);
    }

    getMovementTypeLabel(type: string): string {
        const labels: Record<string, string> = {
            entry_purchase: 'Compra',
            entry_return: 'Devolución',
            entry_transfer: 'Transferencia Entrada',
            exit_loan: 'Préstamo',
            exit_calibration: 'Calibración',
            exit_maintenance: 'Mantenimiento',
            exit_disposal: 'Baja',
            transfer: 'Transferencia'
        };
        return labels[type] || type;
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            pending: 'Pendiente',
            approved: 'Aprobado',
            completed: 'Completado',
            cancelled: 'Cancelado'
        };
        return labels[status] || status;
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            pending: 'warn',
            approved: 'accent',
            completed: 'primary',
            cancelled: ''
        };
        return colors[status] || '';
    }

    approveMovement(): void {
        if (this.movement && this.movement.id) {
            this._movementService.approveMovement(this.movement.id).subscribe({
                next: (updated) => {
                    this.movement = updated;
                },
            });
        }
    }

    completeMovement(): void {
        if (this.movement && this.movement.id) {
            this._movementService.completeMovement(this.movement.id).subscribe({
                next: (updated) => {
                    this.movement = updated;
                },
            });
        }
    }

    cancelMovement(): void {
        if (this.movement && this.movement.id) {
            const reason = prompt('Ingrese la razón de cancelación:');
            if (reason) {
                this._movementService.cancelMovement(this.movement.id, reason).subscribe({
                    next: (updated) => {
                        this.movement = updated;
                    },
                });
            }
        }
    }
}
