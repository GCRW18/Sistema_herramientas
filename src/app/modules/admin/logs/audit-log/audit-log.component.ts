import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { MatExpansionModule } from '@angular/material/expansion';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { AuditService, NotificationService } from 'app/core/services';
import { AuditLog, AuditLogFilters } from 'app/core/models';

@Component({
    selector: 'app-audit-log',
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
        MatExpansionModule,
        FormsModule,
        ReactiveFormsModule,
    ],
    templateUrl: './audit-log.component.html',
    styleUrl: './audit-log.component.scss'
})
export default class AuditLogComponent implements OnInit {
    private _auditService = inject(AuditService);
    private _notificationService = inject(NotificationService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    displayedColumns: string[] = [
        'timestamp',
        'user',
        'actionType',
        'module',
        'action',
        'entity',
        'ipAddress',
        'details'
    ];
    dataSource = new MatTableDataSource<AuditLog>();
    loading = false;

    // Filter form
    filterForm = new FormGroup({
        search: new FormControl(''),
        actionType: new FormControl(''),
        module: new FormControl(''),
        startDate: new FormControl<Date | null>(null),
        endDate: new FormControl<Date | null>(null),
    });

    // Action type options
    actionTypeOptions = [
        { value: 'create', label: 'Crear', color: 'primary' },
        { value: 'update', label: 'Actualizar', color: 'accent' },
        { value: 'delete', label: 'Eliminar', color: 'warn' },
        { value: 'view', label: 'Ver', color: 'basic' },
        { value: 'export', label: 'Exportar', color: 'basic' },
        { value: 'import', label: 'Importar', color: 'basic' },
        { value: 'login', label: 'Inicio Sesión', color: 'primary' },
        { value: 'logout', label: 'Cierre Sesión', color: 'basic' }
    ];

    // Module options
    moduleOptions = [
        'Herramientas',
        'Inventario',
        'Movimientos',
        'Kits',
        'Calibración',
        'Mantenimiento',
        'Cuarentena',
        'Bajas',
        'Roster',
        'Usuarios',
        'Sistema'
    ];

    // Stats
    stats = {
        totalLogs: 0,
        todayLogs: 0,
        criticalActions: 0,
        activeUsers: 0
    };

    ngOnInit(): void {
        this.loadAuditLogs();
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

    loadAuditLogs(filters?: AuditLogFilters): void {
        this.loading = true;
        this._auditService.getAuditLogs(filters).subscribe({
            next: (logs) => {
                this.dataSource.data = logs;
                this.loading = false;
            },
            error: () => {
                this._notificationService.error('Error al cargar registros de auditoría');
                this.loading = false;
            },
        });
    }

    loadStats(): void {
        this._auditService.getAuditStatistics().subscribe({
            next: (stats) => {
                this.stats.totalLogs = stats.total || 0;
                this.stats.todayLogs = stats.today || 0;
                this.stats.criticalActions = stats.critical || 0;
                this.stats.activeUsers = stats.activeUsers || 0;
            },
            error: () => {
                // Silently fail
            }
        });
    }

    applyFilters(): void {
        const formValue = this.filterForm.value;
        const filters: AuditLogFilters = {};

        if (formValue.search) {
            filters.search = formValue.search;
        }
        if (formValue.actionType) {
            filters.actionType = formValue.actionType;
        }
        if (formValue.module) {
            filters.module = formValue.module;
        }
        if (formValue.startDate) {
            filters.startDate = formValue.startDate;
        }
        if (formValue.endDate) {
            filters.endDate = formValue.endDate;
        }

        this.loadAuditLogs(filters);
    }

    clearFilters(): void {
        this.filterForm.reset();
        this.loadAuditLogs();
    }

    getActionTypeColor(actionType: string): string {
        const option = this.actionTypeOptions.find(opt => opt.value === actionType);
        return option ? option.color : 'basic';
    }

    getActionTypeLabel(actionType: string): string {
        const option = this.actionTypeOptions.find(opt => opt.value === actionType);
        return option ? option.label : actionType;
    }

    formatTimestamp(timestamp: Date | string): string {
        const date = new Date(timestamp);
        return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    viewDetails(log: AuditLog): void {
        // TODO: Implement details view in a dialog
        console.log('View log details:', log);
    }

    exportLogs(): void {
        const filters = this.buildFiltersFromForm();
        this._auditService.exportAuditLogs(filters, 'EXCEL').subscribe({
            next: (response) => {
                if (response.fileUrl) {
                    window.open(response.fileUrl, '_blank');
                }
                this._notificationService.success('Registros exportados correctamente');
            },
            error: () => {
                this._notificationService.error('Error al exportar registros');
            }
        });
    }

    private buildFiltersFromForm(): AuditLogFilters {
        const formValue = this.filterForm.value;
        const filters: AuditLogFilters = {};

        if (formValue.search) filters.search = formValue.search;
        if (formValue.actionType) filters.actionType = formValue.actionType;
        if (formValue.module) filters.module = formValue.module;
        if (formValue.startDate) filters.startDate = formValue.startDate;
        if (formValue.endDate) filters.endDate = formValue.endDate;

        return filters;
    }

    getEntityDisplay(log: AuditLog): string {
        if (log.entityId) {
            return `${log.entity} (ID: ${log.entityId})`;
        }
        return log.entity;
    }

    isCriticalAction(log: AuditLog): boolean {
        return log.actionType === 'delete' || log.actionType === 'update' && log.module === 'Sistema';
    }
}
