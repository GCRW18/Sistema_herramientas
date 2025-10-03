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

interface Customer {
    id: string;
    code: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    active: boolean;
}

@Component({
    selector: 'app-customers',
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
    templateUrl: './customers.component.html',
    styleUrl: './customers.component.scss'
})
export default class CustomersComponent implements OnInit {
    private _router = inject(Router);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = ['code', 'name', 'email', 'phone', 'active', 'actions'];
    dataSource = new MatTableDataSource<Customer>();
    loading = false;

    ngOnInit(): void {
        this.loadCustomers();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadCustomers(): void {
        this.loading = true;
        // TODO: Replace with actual service call
        // this._customerService.getCustomers().subscribe({
        //     next: (customers) => {
        //         this.dataSource.data = customers;
        //         this.loading = false;
        //     },
        //     error: () => {
        //         this.loading = false;
        //     },
        // });
        this.dataSource.data = [];
        this.loading = false;
    }

    applyFilter(event: Event): void {
        const filterValue = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }

    createCustomer(): void {
        this._router.navigate(['/administration/customers/new']);
    }

    editCustomer(id: string): void {
        this._router.navigate(['/administration/customers', id, 'edit']);
    }

    deleteCustomer(id: string): void {
        // TODO: Implement delete with confirmation dialog
        console.log('Delete customer:', id);
    }
}
