import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MovementService } from 'app/core/services';

interface Voucher {
    id: string;
    movementId: string;
    voucherNumber: string;
    date: Date;
    type: string;
    toolCode: string;
    toolName: string;
}

@Component({
    selector: 'app-vouchers',
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
    templateUrl: './vouchers.component.html',
    styleUrl: './vouchers.component.scss'
})
export default class VouchersComponent implements OnInit {
    private _movementService = inject(MovementService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['voucherNumber', 'date', 'type', 'toolCode', 'toolName', 'actions'];
    dataSource = new MatTableDataSource<Voucher>();
    loading = false;

    ngOnInit(): void {
        this.loadVouchers();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadVouchers(): void {
        this.loading = true;
        // TODO: Replace with actual service call
        this.dataSource.data = [];
        this.loading = false;
    }

    applyFilter(event: Event): void {
        const filterValue = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }

    downloadVoucher(id: string): void {
        // TODO: Implement voucher download
        console.log('Download voucher:', id);
    }

    printVoucher(id: string): void {
        // TODO: Implement voucher print
        console.log('Print voucher:', id);
    }

    getMovementTypeLabel(type: string): string {
        const labels: Record<string, string> = {
            entry_purchase: 'Compra',
            entry_return: 'Devolución',
            exit_loan: 'Préstamo',
            exit_calibration: 'Calibración',
            exit_maintenance: 'Mantenimiento',
            transfer: 'Transferencia'
        };
        return labels[type] || type;
    }
}
