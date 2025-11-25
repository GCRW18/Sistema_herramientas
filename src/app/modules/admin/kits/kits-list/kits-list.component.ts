import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { KitService, NotificationService } from 'app/core/services';
import { Kit } from 'app/core/models';
import { ErpConfirmationService } from '@erp/services/confirmation';

@Component({
    selector: 'app-kits-list',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatFormFieldModule,
        MatInputModule,
        MatChipsModule,
        MatTooltipModule,
    ],
    templateUrl: './kits-list.component.html',
    styleUrl: './kits-list.component.scss'
})
export default class KitsListComponent implements OnInit {
    private _router = inject(Router);
    private _kitService = inject(KitService);
    private _confirmationService = inject(ErpConfirmationService);
    private _notificationService = inject(NotificationService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['code', 'name', 'category', 'totalTools', 'status', 'actions'];
    dataSource = new MatTableDataSource<Kit>();
    loading = false;

    ngOnInit(): void {
        this.loadKits();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadKits(): void {
        this.loading = true;
        this._kitService.getKits().subscribe({
            next: (kits) => {
                this.dataSource.data = kits;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    applyFilter(event: Event): void {
        const filterValue = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }

    createKit(): void {
        this._router.navigate(['/kits/create']);
    }

    viewKit(id: string): void {
        this._router.navigate(['/kits', id]);
    }

    editKit(id: string): void {
        this._router.navigate(['/kits', id, 'edit']);
    }

    deleteKit(kit: Kit): void {
        const confirmation = this._confirmationService.open({
            title: 'Eliminar Kit',
            message: `¿Está seguro de eliminar el kit <strong>${kit.code} - ${kit.name}</strong>? Esta acción no se puede deshacer.`,
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
            dismissible: true,
        });

        confirmation.afterClosed().subscribe((result) => {
            if (result === 'confirmed') {
                this._kitService.deleteKit(kit.id).subscribe({
                    next: () => {
                        this._notificationService.success(`Kit ${kit.code} eliminado correctamente`);
                        this.loadKits();
                    },
                    error: (error) => {
                        this._notificationService.error('Error al eliminar el kit');
                        console.error('Error deleting kit:', error);
                    },
                });
            }
        });
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            complete: 'primary',
            incomplete: 'warn',
            in_use: 'accent',
            in_calibration: 'warn',
        };
        return colors[status] || '';
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            complete: 'Completo',
            incomplete: 'Incompleto',
            in_use: 'En Uso',
            in_calibration: 'En Calibración',
        };
        return labels[status] || status;
    }
}
