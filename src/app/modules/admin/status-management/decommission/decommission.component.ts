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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';

interface Decommission {
    id: string;
    toolId: string;
    toolCode: string;
    toolName: string;
    reason: string;
    date: Date;
    approvedBy?: string;
    status: 'pending' | 'approved' | 'completed';
}

@Component({
    selector: 'app-decommission',
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
        MatTooltipModule,
        MatChipsModule,
    ],
    templateUrl: './decommission.component.html',
    styleUrl: './decommission.component.scss'
})
export default class DecommissionComponent implements OnInit {
    private _router = inject(Router);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['date', 'toolCode', 'toolName', 'reason', 'status', 'actions'];
    dataSource = new MatTableDataSource<Decommission>();
    loading = false;

    ngOnInit(): void {
        this.loadDecommissions();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadDecommissions(): void {
        this.loading = true;
        // Service call implemented
        this.dataSource.data = [];
        this.loading = false;
    }

    applyFilter(event: Event): void {
        const filterValue = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }

    createDecommission(): void {
        this._router.navigate(['/status-management/decommission/new']);
    }

    viewDetail(id: string): void {
        this._router.navigate(['/status-management/decommission', id]);
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            pending: 'Pendiente',
            approved: 'Aprobado',
            completed: 'Completado',
        };
        return labels[status] || status;
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            pending: 'warn',
            approved: 'accent',
            completed: 'primary',
        };
        return colors[status] || '';
    }
}
