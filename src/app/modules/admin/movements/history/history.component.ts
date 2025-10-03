import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MovementService } from 'app/core/services';
import { Movement } from 'app/core/models';

@Component({
    selector: 'app-history',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatChipsModule,
        MatTooltipModule,
        MatDatepickerModule,
    ],
    templateUrl: './history.component.html',
    styleUrl: './history.component.scss'
})
export default class HistoryComponent implements OnInit {
    private _router = inject(Router);
    private _movementService = inject(MovementService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['date', 'type', 'toolCode', 'toolName', 'user', 'status', 'actions'];
    dataSource = new MatTableDataSource<Movement>();
    loading = false;

    movementTypes = [
        { value: '', label: 'Todos' },
        { value: 'entry', label: 'Entradas' },
        { value: 'exit', label: 'Salidas' },
        { value: 'transfer', label: 'Transferencias' }
    ];

    selectedType = '';
    startDate: Date | null = null;
    endDate: Date | null = null;

    ngOnInit(): void {
        this.loadHistory();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadHistory(): void {
        this.loading = true;
        const filters: any = {};

        if (this.selectedType) {
            filters.type = this.selectedType;
        }
        if (this.startDate) {
            filters.startDate = this.startDate.toISOString();
        }
        if (this.endDate) {
            filters.endDate = this.endDate.toISOString();
        }

        this._movementService.getMovements(filters).subscribe({
            next: (movements) => {
                this.dataSource.data = movements;
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

    applyFilters(): void {
        this.loadHistory();
    }

    clearFilters(): void {
        this.selectedType = '';
        this.startDate = null;
        this.endDate = null;
        this.loadHistory();
    }

    viewDetail(id: string): void {
        this._router.navigate(['/movements', id]);
    }

    getMovementTypeLabel(type: string): string {
        // Determine base type
        if (type.startsWith('entry')) {
            return 'Entrada';
        } else if (type.startsWith('exit')) {
            return 'Salida';
        } else if (type === 'transfer') {
            return 'Transferencia';
        }

        // Fallback for specific types
        const labels: Record<string, string> = {
            entry: 'Entrada',
            exit: 'Salida',
            transfer: 'Transferencia',
            loan: 'Préstamo',
            return: 'Devolución',
            adjustment: 'Ajuste'
        };
        return labels[type] || type;
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

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            pending: 'Pendiente',
            approved: 'Aprobado',
            completed: 'Completado',
            cancelled: 'Cancelado'
        };
        return labels[status] || status;
    }
}
