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
import { MovementService } from 'app/core/services';
import { Movement } from 'app/core/models';

@Component({
    selector: 'app-entries',
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
    ],
    templateUrl: './entries.component.html',
    styleUrl: './entries.component.scss'
})
export default class EntriesComponent implements OnInit {
    private _router = inject(Router);
    private _movementService = inject(MovementService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['date', 'type', 'toolCode', 'quantity', 'aircraft', 'department', 'responsiblePerson', 'actions'];
    dataSource = new MatTableDataSource<Movement>();
    loading = false;

    ngOnInit(): void {
        this.loadEntries();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadEntries(): void {
        this.loading = true;
        this._movementService.getEntries().subscribe({
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

    createEntry(): void {
        this._router.navigate(['/movements/entries/new']);
    }

    viewDetail(id: string): void {
        this._router.navigate(['/movements/detail', id]);
    }
}
