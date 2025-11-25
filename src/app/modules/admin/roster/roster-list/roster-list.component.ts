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
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { RosterService, NotificationService } from 'app/core/services';
import { RosterAssignment, RosterFilters, RosterStatus, ShiftType } from 'app/core/models';
import { ErpConfirmationService } from '@erp/services/confirmation';

@Component({
    selector: 'app-roster-list',
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
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatMenuModule,
        MatCheckboxModule,
        MatDividerModule,
        FormsModule,
        ReactiveFormsModule,
    ],
    templateUrl: './roster-list.component.html',
    styleUrl: './roster-list.component.scss'
})
export default class RosterListComponent implements OnInit {
    private _router = inject(Router);
    private _rosterService = inject(RosterService);
    private _confirmationService = inject(ErpConfirmationService);
    private _notificationService = inject(NotificationService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = [
        'assignmentType',
        'itemCode',
        'itemName',
        'employee',
        'assignmentDate',
        'expectedReturnDate',
        'status',
        'shift',
        'actions'
    ];
    dataSource = new MatTableDataSource<RosterAssignment>();
    loading = false;

    // Filter form
    filterForm = new FormGroup({
        search: new FormControl(''),
        status: new FormControl<RosterStatus | ''>(''),
        shift: new FormControl<ShiftType | ''>(''),
        dateFrom: new FormControl<Date | null>(null),
        dateTo: new FormControl<Date | null>(null),
        overdueOnly: new FormControl(false)
    });

    // Status options
    statusOptions: { value: RosterStatus; label: string }[] = [
        { value: 'active', label: 'Activo' },
        { value: 'returned', label: 'Devuelto' },
        { value: 'overdue', label: 'Vencido' },
        { value: 'extended', label: 'Extendido' }
    ];

    // Shift options
    shiftOptions: { value: ShiftType; label: string }[] = [
        { value: 'morning', label: 'Mañana' },
        { value: 'afternoon', label: 'Tarde' },
        { value: 'night', label: 'Noche' },
        { value: 'all_day', label: 'Todo el día' }
    ];

    // Stats
    stats = {
        totalAssignments: 0,
        activeAssignments: 0,
        overdueAssignments: 0,
        returnedToday: 0
    };

    ngOnInit(): void {
        this.loadAssignments();
        this.loadStats();
        this.setupFilterListener();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    setupFilterListener(): void {
        this.filterForm.valueChanges.subscribe(() => {
            this.applyFilters();
        });
    }

    loadAssignments(filters?: RosterFilters): void {
        this.loading = true;
        this._rosterService.getAssignments(filters).subscribe({
            next: (assignments) => {
                this.dataSource.data = assignments;
                this.loading = false;
            },
            error: (error) => {
                this._notificationService.error('Error al cargar asignaciones');
                this.loading = false;
            },
        });
    }

    loadStats(): void {
        this._rosterService.getStats().subscribe({
            next: (stats) => {
                this.stats = stats;
            },
            error: () => {
                // Silently fail
            }
        });
    }

    applyFilters(): void {
        const formValue = this.filterForm.value;
        const filters: RosterFilters = {};

        if (formValue.search) {
            filters.search = formValue.search;
        }
        if (formValue.status) {
            filters.status = formValue.status as RosterStatus;
        }
        if (formValue.shift) {
            filters.shift = formValue.shift as ShiftType;
        }
        if (formValue.dateFrom) {
            filters.dateFrom = formValue.dateFrom.toISOString();
        }
        if (formValue.dateTo) {
            filters.dateTo = formValue.dateTo.toISOString();
        }
        if (formValue.overdueOnly) {
            filters.overdueOnly = formValue.overdueOnly;
        }

        this.loadAssignments(filters);
    }

    clearFilters(): void {
        this.filterForm.reset();
        this.loadAssignments();
    }

    createAssignment(): void {
        this._router.navigate(['/roster/new']);
    }

    viewAssignment(id: string): void {
        this._router.navigate(['/roster', id]);
    }

    editAssignment(id: string): void {
        this._router.navigate(['/roster', id, 'edit']);
    }

    returnAssignment(assignment: RosterAssignment): void {
        const confirmation = this._confirmationService.open({
            title: 'Devolver Asignación',
            message: `¿Confirmar la devolución de <strong>${this.getItemName(assignment)}</strong> por <strong>${assignment.employeeName}</strong>?`,
            icon: {
                show: true,
                name: 'heroicons_outline:arrow-uturn-left',
                color: 'primary',
            },
            actions: {
                confirm: {
                    show: true,
                    label: 'Confirmar Devolución',
                    color: 'primary',
                },
                cancel: {
                    show: true,
                    label: 'Cancelar',
                },
            },
        });

        confirmation.afterClosed().subscribe((result) => {
            if (result === 'confirmed') {
                this._rosterService.returnAssignment({
                    assignmentId: assignment.id,
                    actualReturnDate: new Date().toISOString(),
                }).subscribe({
                    next: () => {
                        this._notificationService.success('Asignación devuelta correctamente');
                        this.loadAssignments();
                        this.loadStats();
                    },
                    error: () => {
                        this._notificationService.error('Error al devolver asignación');
                    },
                });
            }
        });
    }

    extendAssignment(assignment: RosterAssignment): void {
        this._router.navigate(['/roster', assignment.id, 'extend']);
    }

    deleteAssignment(assignment: RosterAssignment): void {
        const confirmation = this._confirmationService.open({
            title: 'Eliminar Asignación',
            message: `¿Está seguro de eliminar la asignación de <strong>${this.getItemName(assignment)}</strong>? Esta acción no se puede deshacer.`,
            icon: {
                show: true,
                name: 'heroicons_outline:exclamation-triangle',
                color: 'warn',
            },
            actions: {
                confirm: {
                    show: true,
                    label: 'Eliminar',
                    color: 'warn',
                },
                cancel: {
                    show: true,
                    label: 'Cancelar',
                },
            },
        });

        confirmation.afterClosed().subscribe((result) => {
            if (result === 'confirmed') {
                this._rosterService.deleteAssignment(assignment.id).subscribe({
                    next: () => {
                        this._notificationService.success('Asignación eliminada correctamente');
                        this.loadAssignments();
                        this.loadStats();
                    },
                    error: () => {
                        this._notificationService.error('Error al eliminar asignación');
                    },
                });
            }
        });
    }

    getItemName(assignment: RosterAssignment): string {
        return assignment.assignmentType === 'tool'
            ? assignment.toolName || 'Herramienta'
            : assignment.kitName || 'Kit';
    }

    getItemCode(assignment: RosterAssignment): string {
        return assignment.assignmentType === 'tool'
            ? assignment.toolCode || '-'
            : assignment.kitCode || '-';
    }

    getStatusColor(status: RosterStatus): string {
        switch (status) {
            case 'active':
                return 'primary';
            case 'returned':
                return 'accent';
            case 'overdue':
                return 'warn';
            case 'extended':
                return 'basic';
            default:
                return 'basic';
        }
    }

    getStatusLabel(status: RosterStatus): string {
        const option = this.statusOptions.find(opt => opt.value === status);
        return option ? option.label : status;
    }

    getShiftLabel(shift: ShiftType | undefined): string {
        if (!shift) return 'N/A';
        const option = this.shiftOptions.find(opt => opt.value === shift);
        return option ? option.label : shift;
    }

    getAssignmentTypeLabel(type: 'tool' | 'kit'): string {
        return type === 'tool' ? 'Herramienta' : 'Kit';
    }

    isOverdue(assignment: RosterAssignment): boolean {
        if (!assignment.expectedReturnDate || assignment.status === 'returned') {
            return false;
        }
        return new Date(assignment.expectedReturnDate) < new Date();
    }

    exportAssignments(): void {
        const filters = this.buildFiltersFromForm();
        this._rosterService.exportAssignments(filters, 'excel').subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `asignaciones_${new Date().getTime()}.xlsx`;
                link.click();
                window.URL.revokeObjectURL(url);
                this._notificationService.success('Asignaciones exportadas correctamente');
            },
            error: () => {
                this._notificationService.error('Error al exportar asignaciones');
            }
        });
    }

    private buildFiltersFromForm(): RosterFilters {
        const formValue = this.filterForm.value;
        const filters: RosterFilters = {};

        if (formValue.search) filters.search = formValue.search;
        if (formValue.status) filters.status = formValue.status as RosterStatus;
        if (formValue.shift) filters.shift = formValue.shift as ShiftType;
        if (formValue.dateFrom) filters.dateFrom = formValue.dateFrom.toISOString();
        if (formValue.dateTo) filters.dateTo = formValue.dateTo.toISOString();
        if (formValue.overdueOnly) filters.overdueOnly = formValue.overdueOnly;

        return filters;
    }

    formatDate(date: string | undefined): string {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
}
