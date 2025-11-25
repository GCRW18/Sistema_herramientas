import { Injectable, inject } from '@angular/core';
import { from, Observable, of, BehaviorSubject, switchMap } from 'rxjs';
import { Maintenance, MaintenanceFormData, MaintenanceCompletionData } from '../models/maintenance.types';
import { ErpApiService } from '../api/api.service';

@Injectable({
    providedIn: 'root'
})
export class MaintenanceService {
    private _api = inject(ErpApiService);
    private _maintenances = new BehaviorSubject<Maintenance[]>([]);

    /**
     * Getter for maintenances
     */
    get maintenances$(): Observable<Maintenance[]> {
        return this._maintenances.asObservable();
    }

    /**
     * Get all maintenance records
     */
    getMaintenances(filters?: any): Observable<Maintenance[]> {
        const params: any = {
            start: 0,
            limit: 50,
            sort: 'id_maintenance',
            dir: 'desc',
            ...filters
        };

        return from(this._api.post('herramientas/maintenances/listMaintenances', params)).pipe(
            switchMap((response: any) => {
                const maintenances = (response?.datos || []).map((item: any) => ({
                    id: item.id_maintenance,
                    id_maintenance: item.id_maintenance,
                    toolId: item.tool_id,
                    toolCode: item.tool_code || '',
                    toolName: item.tool_name || '',
                    type: item.type,
                    status: item.status,
                    scheduledDate: item.scheduled_date ? new Date(item.scheduled_date) : new Date(),
                    completedDate: item.completion_date ? new Date(item.completion_date) : undefined,
                    technician: item.technician,
                    cost: item.cost,
                    description: item.description,
                    notes: item.notes,
                    createdAt: item.created_at ? new Date(item.created_at) : undefined,
                    updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
                }));
                this._maintenances.next(maintenances);
                return of(maintenances);
            })
        );
    }

    /**
     * Get maintenance by ID
     */
    getMaintenanceById(id: string): Observable<Maintenance> {
        return from(this._api.post('herramientas/maintenances/listMaintenances', {
            start: 0,
            limit: 1,
            id_maintenance: id
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || null);
            })
        );
    }

    /**
     * Get maintenance records for a specific tool
     */
    getMaintenancesByTool(toolId: string): Observable<Maintenance[]> {
        return from(this._api.post('herramientas/maintenances/listMaintenances', {
            start: 0,
            limit: 100,
            tool_id: toolId,
            sort: 'request_date',
            dir: 'desc'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Create a new maintenance record
     */
    createMaintenance(data: MaintenanceFormData): Observable<Maintenance> {
        // Transformar datos de camelCase a snake_case para el backend
        // Formatear fecha a 'YYYY-MM-DD' para PostgreSQL
        let formattedDate = null;
        if (data.scheduledDate) {
            const date = new Date(data.scheduledDate);
            formattedDate = date.toISOString().split('T')[0];
        }

        const backendData = {
            type: data.type,
            scheduled_date: formattedDate,
            description: data.description,
            technician: data.technician,
            notes: data.notes,
            cost: data.estimatedCost || 0
        };

        return from(this._api.post('herramientas/maintenances/insertMaintenance', backendData)).pipe(
            switchMap((response: any) => {
                // El backend devuelve el id en response.datos.id_maintenance
                const newMaintenance = {
                    ...data,
                    id: response?.datos?.id_maintenance || response?.datos?.id,
                    status: 'scheduled' as const,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                const currentMaintenances = this._maintenances.value;
                this._maintenances.next([newMaintenance, ...currentMaintenances]);
                return of(newMaintenance);
            })
        );
    }

    /**
     * Update an existing maintenance record
     */
    updateMaintenance(id: string, data: Partial<Maintenance>): Observable<Maintenance> {
        // Transformar datos de camelCase a snake_case para el backend
        let formattedDate = null;
        if (data.scheduledDate) {
            const date = new Date(data.scheduledDate);
            formattedDate = date.toISOString().split('T')[0];
        }

        const backendData: any = {
            id_maintenance: id
        };

        if (data.type) backendData.type = data.type;
        if (formattedDate) backendData.scheduled_date = formattedDate;
        if (data.description) backendData.description = data.description;
        if (data.technician) backendData.technician = data.technician;
        if (data.notes !== undefined) backendData.notes = data.notes;
        if (data.cost !== undefined) backendData.cost = data.cost;

        return from(this._api.post('herramientas/maintenances/updateMantenimiento', backendData)).pipe(
            switchMap((response: any) => {
                const updatedMaintenance = {
                    ...data,
                    id: id,
                    id_maintenance: id
                } as Maintenance;
                const currentMaintenances = this._maintenances.value;
                const index = currentMaintenances.findIndex((m: any) => m.id_maintenance === id || m.id === id);
                if (index !== -1) {
                    currentMaintenances[index] = updatedMaintenance;
                    this._maintenances.next(currentMaintenances);
                }
                return of(updatedMaintenance);
            })
        );
    }

    /**
     * Complete a maintenance record
     */
    completeMaintenance(id: string, data: MaintenanceCompletionData): Observable<Maintenance> {
        return from(this._api.post('herramientas/maintenances/completeMantenimiento', {
            id_maintenance: id,
            ...data
        })).pipe(
            switchMap((response: any) => {
                const completedMaintenance = response?.datos || {};
                const currentMaintenances = this._maintenances.value;
                const index = currentMaintenances.findIndex((m: any) => m.id_maintenance === id);
                if (index !== -1) {
                    currentMaintenances[index] = completedMaintenance;
                    this._maintenances.next(currentMaintenances);
                }
                return of(completedMaintenance);
            })
        );
    }

    /**
     * Change maintenance status
     */
    changeMaintenanceStatus(id: string, status: 'in_progress' | 'cancelled'): Observable<Maintenance> {
        return from(this._api.post('herramientas/maintenances/cambiarEstadoMantenimiento', {
            id_maintenance: id,
            status: status
        })).pipe(
            switchMap((response: any) => {
                const updatedMaintenance = response?.datos || {};
                const currentMaintenances = this._maintenances.value;
                const index = currentMaintenances.findIndex((m: any) => m.id_maintenance === id);
                if (index !== -1) {
                    currentMaintenances[index] = updatedMaintenance;
                    this._maintenances.next(currentMaintenances);
                }
                return of(updatedMaintenance);
            })
        );
    }

    /**
     * Delete a maintenance record
     */
    deleteMaintenance(id: string): Observable<void> {
        return from(this._api.post('herramientas/maintenances/deleteMaintenance', {
            id_maintenance: id
        })).pipe(
            switchMap(() => {
                const currentMaintenances = this._maintenances.value;
                const filteredMaintenances = currentMaintenances.filter((m: any) => m.id_maintenance !== id);
                this._maintenances.next(filteredMaintenances);
                return of(undefined);
            })
        );
    }
}
