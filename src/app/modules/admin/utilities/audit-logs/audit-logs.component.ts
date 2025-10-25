import { Component, OnInit, ViewChild, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { NotificationService, AuditService } from 'app/core/services';
import { AuditLog } from 'app/core/models';

@Component({
    selector: 'app-audit-logs',
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
        MatSortModule,
        MatDatepickerModule,
        MatTooltipModule,
        MatChipsModule,
    ],
    templateUrl: './audit-logs.component.html',
    styleUrl: './audit-logs.component.scss'
})
export default class AuditLogsComponent implements OnInit, AfterViewInit {
    private _fb = inject(FormBuilder);
    private _notificationService = inject(NotificationService);
    private _auditService = inject(AuditService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    filterForm!: FormGroup;
    dataSource = new MatTableDataSource<AuditLog>();
    displayedColumns = ['timestamp', 'user', 'actionType', 'module', 'entity', 'details', 'actions'];
    loading = false;

    actionTypes = [
        { value: 'create', label: 'Creación' },
        { value: 'update', label: 'Actualización' },
        { value: 'delete', label: 'Eliminación' },
        { value: 'view', label: 'Visualización' },
        { value: 'export', label: 'Exportación' },
        { value: 'import', label: 'Importación' },
        { value: 'login', label: 'Inicio de sesión' },
        { value: 'logout', label: 'Cierre de sesión' },
    ];

    modules = [
        { value: 'inventory', label: 'Inventario' },
        { value: 'movements', label: 'Movimientos' },
        { value: 'kits', label: 'Kits' },
        { value: 'fleet', label: 'Flota' },
        { value: 'calibration', label: 'Calibración' },
        { value: 'status-management', label: 'Gestión de Estado' },
        { value: 'administration', label: 'Administración' },
    ];

    ngOnInit(): void {
        this.initForm();
        this.loadAuditLogs();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    initForm(): void {
        this.filterForm = this._fb.group({
            search: [''],
            actionType: [''],
            module: [''],
            startDate: [''],
            endDate: [''],
            user: [''],
        });
    }

    loadAuditLogs(): void {
        this.loading = true;

        this._auditService.getAuditLogs().subscribe({
            next: (logs) => {
                this.dataSource.data = logs;
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading audit logs:', error);
                this._notificationService.error('Error al cargar logs de auditoría');
                this.loading = false;
                // Load mock data as fallback
                this.loadMockData();
            }
        });
    }

    loadMockData(): void {
        // Mock data for demonstration (fallback)
        const mockLogs: AuditLog[] = [
            {
                id: '1',
                timestamp: new Date('2025-01-15T10:30:00'),
                user: 'admin@sistema.com',
                action: 'Creó nueva herramienta',
                actionType: 'create',
                module: 'Inventario',
                entity: 'Herramienta',
                entityId: 'TOOL-001',
                details: 'Martillo neumático creado',
                ipAddress: '192.168.1.100',
            },
            {
                id: '2',
                timestamp: new Date('2025-01-15T10:15:00'),
                user: 'user@sistema.com',
                action: 'Actualizó aeronave',
                actionType: 'update',
                module: 'Flota',
                entity: 'Aeronave',
                entityId: 'CP-2554',
                details: 'Estado cambiado a Mantenimiento',
                ipAddress: '192.168.1.101',
            },
            {
                id: '3',
                timestamp: new Date('2025-01-15T09:45:00'),
                user: 'admin@sistema.com',
                action: 'Eliminó entrada',
                actionType: 'delete',
                module: 'Movimientos',
                entity: 'Entrada',
                entityId: 'ENT-123',
                details: 'Entrada duplicada eliminada',
                ipAddress: '192.168.1.100',
            },
            {
                id: '4',
                timestamp: new Date('2025-01-15T09:30:00'),
                user: 'tech@sistema.com',
                action: 'Exportó reporte',
                actionType: 'export',
                module: 'Calibración',
                entity: 'Reporte',
                details: 'Reporte de vencimientos exportado',
                ipAddress: '192.168.1.105',
            },
            {
                id: '5',
                timestamp: new Date('2025-01-15T09:00:00'),
                user: 'admin@sistema.com',
                action: 'Inició sesión',
                actionType: 'login',
                module: 'Sistema',
                entity: 'Sesión',
                details: 'Inicio de sesión exitoso',
                ipAddress: '192.168.1.100',
            },
        ];

        this.dataSource.data = mockLogs;
    }

    applyFilters(): void {
        const filters = this.filterForm.value;
        this.loading = true;

        this._auditService.getAuditLogs({
            search: filters.search,
            actionType: filters.actionType,
            module: filters.module,
            startDate: filters.startDate,
            endDate: filters.endDate,
            user: filters.user,
        }).subscribe({
            next: (logs) => {
                this.dataSource.data = logs;
                this.loading = false;
            },
            error: (error) => {
                console.error('Error applying filters:', error);
                this._notificationService.error('Error al aplicar filtros');
                this.loading = false;
            }
        });
    }

    clearFilters(): void {
        this.filterForm.reset();
        this.loadAuditLogs();
    }

    exportLogs(): void {
        this._notificationService.info('Exportando logs de auditoría...');

        const filters = this.filterForm.value;

        this._auditService.exportAuditLogs(filters, 'PDF').subscribe({
            next: (response) => {
                if (response?.datos?.fileUrl) {
                    // Open the file URL in a new window to trigger download
                    window.open(response.datos.fileUrl, '_blank');
                    this._notificationService.success('Logs exportados correctamente');
                } else {
                    this._notificationService.error('Error al exportar logs');
                }
            },
            error: (error) => {
                console.error('Error exporting logs:', error);
                this._notificationService.error('Error al exportar logs');
            }
        });
    }

    viewDetails(log: AuditLog): void {
        this._notificationService.info(`Detalles: ${log.details}`);
    }

    getActionTypeInfo(actionType: string): { label: string; color: string; icon: string } {
        const actionMap: Record<string, { label: string; color: string; icon: string }> = {
            create: { label: 'Creación', color: 'bg-green-600', icon: 'heroicons_outline:plus-circle' },
            update: { label: 'Actualización', color: 'bg-blue-600', icon: 'heroicons_outline:pencil' },
            delete: { label: 'Eliminación', color: 'bg-red-600', icon: 'heroicons_outline:trash' },
            view: { label: 'Visualización', color: 'bg-gray-600', icon: 'heroicons_outline:eye' },
            export: { label: 'Exportación', color: 'bg-purple-600', icon: 'heroicons_outline:arrow-down-tray' },
            import: { label: 'Importación', color: 'bg-indigo-600', icon: 'heroicons_outline:arrow-up-tray' },
            login: { label: 'Inicio sesión', color: 'bg-teal-600', icon: 'heroicons_outline:arrow-right-on-rectangle' },
            logout: { label: 'Cierre sesión', color: 'bg-orange-600', icon: 'heroicons_outline:arrow-left-on-rectangle' },
        };
        return actionMap[actionType] || { label: actionType, color: 'bg-gray-600', icon: 'heroicons_outline:document' };
    }

    formatDate(date: Date): string {
        return new Date(date).toLocaleString('es-BO');
    }
}
