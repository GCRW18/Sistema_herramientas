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
import { MovementService, NotificationService } from 'app/core/services';

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
    private _notificationService = inject(NotificationService);

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
        this._movementService.getMovements().subscribe({
            next: (movements) => {
                // Convert movements to vouchers
                const vouchers: Voucher[] = movements.map(m => ({
                    id: m.id,
                    movementId: m.id,
                    voucherNumber: m.movementNumber || `VOC-${m.id.substring(0, 8).toUpperCase()}`,
                    date: new Date(m.date),
                    type: m.type,
                    toolCode: '', // Will be populated from movement items
                    toolName: '' // Will be populated from movement items
                }));
                this.dataSource.data = vouchers;
                this.loading = false;
            },
            error: () => {
                this._notificationService.error('Error al cargar comprobantes');
                this.loading = false;
            }
        });
    }

    applyFilter(event: Event): void {
        const filterValue = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }

    downloadVoucher(id: string): void {
        this._movementService.exportMovements({ movementIds: [id] }, 'PDF').subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `voucher-${id}.pdf`;
                link.click();
                window.URL.revokeObjectURL(url);
                this._notificationService.success('Comprobante descargado correctamente');
            },
            error: () => {
                this._notificationService.error('Error al descargar comprobante');
            }
        });
    }

    printVoucher(id: string): void {
        this._movementService.exportMovements({ movementIds: [id] }, 'PDF').subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const printWindow = window.open(url, '_blank');
                if (printWindow) {
                    printWindow.onload = () => {
                        printWindow.print();
                        window.URL.revokeObjectURL(url);
                    };
                }
                this._notificationService.success('Preparando impresión...');
            },
            error: () => {
                this._notificationService.error('Error al preparar impresión');
            }
        });
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
