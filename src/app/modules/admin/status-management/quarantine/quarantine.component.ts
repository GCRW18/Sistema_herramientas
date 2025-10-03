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
import { QuarantineService } from 'app/core/services';
import { QuarantineRecord } from 'app/core/models';

@Component({
    selector: 'app-quarantine',
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
    templateUrl: './quarantine.component.html',
    styleUrl: './quarantine.component.scss'
})
export default class QuarantineComponent implements OnInit {
    private _router = inject(Router);
    private _quarantineService = inject(QuarantineService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['toolCode', 'toolName', 'reason', 'startDate', 'status', 'actions'];
    dataSource = new MatTableDataSource<QuarantineRecord>();
    loading = false;

    ngOnInit(): void {
        this.loadQuarantines();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadQuarantines(): void {
        this.loading = true;
        this._quarantineService.getActiveQuarantines().subscribe({
            next: (quarantines) => {
                this.dataSource.data = quarantines;
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

    addQuarantine(): void {
        this._router.navigate(['/status-management/quarantine/new']);
    }

    viewDetail(id: string): void {
        this._router.navigate(['/status-management/quarantine', id]);
    }

    resolveQuarantine(id: string): void {
        this._router.navigate(['/status-management/quarantine', id, 'resolve']);
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            active: 'warn',
            resolved: 'primary',
            escalated: '',
        };
        return colors[status] || '';
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            active: 'Activa',
            resolved: 'Resuelta',
            escalated: 'Escalada',
        };
        return labels[status] || status;
    }
}
