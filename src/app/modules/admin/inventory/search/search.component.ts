import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { ToolService, CategoryService, WarehouseService } from 'app/core/services';
import { Tool, Category, Warehouse } from 'app/core/models';

@Component({
    selector: 'app-search',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatTableModule,
        MatPaginatorModule,
        MatChipsModule,
    ],
    templateUrl: './search.component.html',
    styleUrl: './search.component.scss'
})
export default class SearchComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _toolService = inject(ToolService);
    private _categoryService = inject(CategoryService);
    private _warehouseService = inject(WarehouseService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;

    searchForm!: FormGroup;
    displayedColumns: string[] = ['code', 'name', 'category', 'warehouse', 'status', 'actions'];
    dataSource = new MatTableDataSource<Tool>();
    loading = false;

    categories: Category[] = [];
    warehouses: Warehouse[] = [];

    statusOptions = [
        { value: '', label: 'Todos' },
        { value: 'available', label: 'Disponible' },
        { value: 'in_use', label: 'En Uso' },
        { value: 'in_calibration', label: 'En Calibración' },
        { value: 'in_maintenance', label: 'En Mantenimiento' },
        { value: 'quarantine', label: 'Cuarentena' },
    ];

    ngOnInit(): void {
        this.initForm();
        this.loadFilters();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
    }

    initForm(): void {
        this.searchForm = this._fb.group({
            query: [''],
            categoryId: [''],
            warehouseId: [''],
            status: [''],
        });
    }

    loadFilters(): void {
        this._categoryService.getCategories().subscribe({
            next: (categories) => {
                this.categories = categories;
            },
        });

        this._warehouseService.getWarehouses().subscribe({
            next: (warehouses) => {
                this.warehouses = warehouses;
            },
        });
    }

    search(): void {
        this.loading = true;
        const filters = this.searchForm.value;

        this._toolService.getTools(filters).subscribe({
            next: (tools) => {
                this.dataSource.data = tools;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    clearFilters(): void {
        this.searchForm.reset();
        this.dataSource.data = [];
    }

    viewDetail(id: string): void {
        this._router.navigate(['/inventory/tools', id]);
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            available: 'Disponible',
            in_use: 'En Uso',
            in_calibration: 'En Calibración',
            in_maintenance: 'En Mantenimiento',
            quarantine: 'Cuarentena',
            decommissioned: 'Dado de Baja',
        };
        return labels[status] || status;
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            available: 'primary',
            in_use: 'accent',
            in_calibration: 'accent',
            in_maintenance: 'warn',
            quarantine: 'warn',
            decommissioned: '',
        };
        return colors[status] || '';
    }
}
