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
    selector: 'app-exits',
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
    templateUrl: './exits.component.html',
    styleUrl: './exits.component.scss'
})
export default class ExitsComponent implements OnInit {
    private _router = inject(Router);
    private _movementService = inject(MovementService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['date', 'type', 'toolCode', 'recipient', 'responsiblePerson', 'actions'];
    dataSource = new MatTableDataSource<Movement>();
    loading = false;

    ngOnInit(): void {
        this.loadExits();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadExits(): void {
        this.loading = true;
        this._movementService.getExits().subscribe({
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

    createExit(): void {
        this._router.navigate(['/movements/exits/new']);
    }

    viewDetail(id: string): void {
        this._router.navigate(['/movements/detail', id]);
    }
}
