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
import { KitService } from 'app/core/services';
import { Kit } from 'app/core/models';

@Component({
    selector: 'app-calibration-status',
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
    ],
    templateUrl: './calibration-status.component.html',
    styleUrl: './calibration-status.component.scss'
})
export default class CalibrationStatusComponent implements OnInit {
    private _router = inject(Router);
    private _kitService = inject(KitService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['code', 'name', 'totalTools', 'calibrationStatus', 'nextCalibration', 'actions'];
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
                // Filter only kits that require calibration
                this.dataSource.data = kits.filter(kit => kit.requiresCalibration);
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

    viewKit(id: string): void {
        this._router.navigate(['/kits', id]);
    }

    getCalibrationStatus(kit: Kit): string {
        if (!kit.nextCalibrationDate) return 'N/A';

        const today = new Date();
        const nextDate = new Date(kit.nextCalibrationDate);
        const daysUntil = Math.floor((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil < 0) return 'Vencido';
        if (daysUntil <= 7) return 'Crítico';
        if (daysUntil <= 30) return 'Próximo';
        return 'Vigente';
    }

    getStatusColor(kit: Kit): string {
        const status = this.getCalibrationStatus(kit);
        const colors: Record<string, string> = {
            'Vencido': '',
            'Crítico': 'warn',
            'Próximo': 'accent',
            'Vigente': 'primary',
            'N/A': '',
        };
        return colors[status] || '';
    }
}
