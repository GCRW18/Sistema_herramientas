import { Injectable, inject } from '@angular/core';
import { from, Observable, of, BehaviorSubject, switchMap, catchError } from 'rxjs';
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
                const maintenances = (response?.data || []).map((item: any) => ({
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
                return of(response?.data?.[0] || null);
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
                return of(response?.data || []);
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
                // El backend devuelve el id en response.data.id_maintenance
                const newMaintenance = {
                    ...data,
                    id: response?.data?.id_maintenance || response?.data?.id,
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
                const completedMaintenance = response?.data || {};
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
                const updatedMaintenance = response?.data || {};
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

    // ── PXP Backend: Flujo de Mantenimiento ─────────────────────────────────

    /**
     * Listar mantenimientos activos (en taller) – HE_MAI_ACTIVE_SEL
     */
    getActiveMaintenancesPxp(): Observable<any[]> {
        return from(this._api.post('herramientas/maintenances/listarMaintenancesActivos', {
            start: 0, limit: 100, sort: 'send_date', dir: 'desc'
        })).pipe(
            switchMap((response: any) => of(response?.datos || []))
        );
    }

    /**
     * Enviar herramienta a mantenimiento – HE_MAI_SEND
     * Genera correlativo EM-NNNN/YYYY, cambia status tool a 'maintenance'
     */
    sendMaintenancePxp(params: {
        tool_id: number;
        type: string;
        request_date?: string;
        send_date?: string;
        expected_return_date?: string;
        provider?: string;
        provider_contact?: string;
        technician?: string;
        description?: string;
        problem?: string;
        requested_by_name?: string;
        cost?: number;
        notes?: string;
    }): Observable<any> {
        return from(this._api.post('herramientas/maintenances/enviarMantenimiento', params)).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response?.mensaje || 'Error al enviar a mantenimiento');
                return of(response?.datos?.[0] || response?.datos || response);
            })
        );
    }

    /**
     * Retornar herramienta de mantenimiento – HE_MAI_RETURN
     * Actualiza status tool a 'available', guarda next_maintenance_date
     */
    returnMaintenancePxp(params: {
        id_maintenance: number;
        tool_id: number;
        result: string;
        actual_return_date?: string;
        completion_date?: string;
        solution?: string;
        recommendations?: string;
        received_by_name?: string;
        cost?: number;
        labor_cost?: number;
        parts_cost?: number;
        parts_replaced?: string;
        next_maintenance_date?: string;
        notes?: string;
    }): Observable<any> {
        return from(this._api.post('herramientas/maintenances/retornarMantenimiento', params)).pipe(
            switchMap((response: any) => {
                if (response?.error) throw new Error(response?.mensaje || 'Error al retornar mantenimiento');
                return of(response?.datos?.[0] || response?.datos || response);
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

    // ===================================================================
    // GENERACIÓN DE PDFs para MANTENIMIENTO
    // ===================================================================

    /**
     * Genera PDF de Nota de Envío a Mantenimiento
     * @param id_maintenance - ID del registro de mantenimiento
     * @returns Observable con el PDF en base64
     */
    generarPdfEnvioMantenimiento(id_maintenance: number): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return from(this._api.post('herramientas/maintenances/generarPdfEnvioMantenimiento', {
            id_maintenance: id_maintenance
        })).pipe(
            switchMap((response: any) => {
                if (response?.error) {
                    throw new Error(response?.mensaje || 'Error al generar PDF');
                }
                const data = response?.datos || response;
                return of({
                    pdf_base64: data?.pdf_base64,
                    nombre_archivo: data?.nombre_archivo || `nota_mantenimiento_${id_maintenance}.pdf`
                });
            }),
            catchError((error) => {
                console.error('Error en generarPdfEnvioMantenimiento:', error);
                throw error;
            })
        );
    }

    /**
     * Genera PDF de Certificado de Retorno de Mantenimiento
     * @param id_maintenance - ID del registro de mantenimiento
     * @returns Observable con el PDF en base64
     */
    generarPdfRetornoMantenimiento(id_maintenance: number): Observable<{ pdf_base64: string; nombre_archivo: string }> {
        return from(this._api.post('herramientas/maintenances/generarPdfRetornoMantenimiento', {
            id_maintenance: id_maintenance
        })).pipe(
            switchMap((response: any) => {
                if (response?.error) {
                    throw new Error(response?.mensaje || 'Error al generar PDF');
                }
                const data = response?.datos || response;
                return of({
                    pdf_base64: data?.pdf_base64,
                    nombre_archivo: data?.nombre_archivo || `retorno_mantenimiento_${id_maintenance}.pdf`
                });
            }),
            catchError((error) => {
                console.error('Error en generarPdfRetornoMantenimiento:', error);
                throw error;
            })
        );
    }

    /**
     * Genera y abre PDF de Nota de Envío a Mantenimiento directamente
     * @param id_maintenance - ID del registro de mantenimiento
     */
    generarYVerPdfEnvioMantenimiento(id_maintenance: number): void {
        this.generarPdfEnvioMantenimiento(id_maintenance).subscribe({
            next: (result) => {
                this.abrirPdf(result.pdf_base64, result.nombre_archivo);
            },
            error: (error) => {
                console.error('Error al generar PDF de envío de mantenimiento:', error);
            }
        });
    }

    /**
     * Genera y abre PDF de Certificado de Retorno de Mantenimiento directamente
     * @param id_maintenance - ID del registro de mantenimiento
     */
    generarYVerPdfRetornoMantenimiento(id_maintenance: number): void {
        this.generarPdfRetornoMantenimiento(id_maintenance).subscribe({
            next: (result) => {
                this.abrirPdf(result.pdf_base64, result.nombre_archivo);
            },
            error: (error) => {
                console.error('Error al generar PDF de retorno de mantenimiento:', error);
            }
        });
    }

    /**
     * Abre un PDF en nueva pestaña a partir de base64
     * @param pdfBase64 - String en base64 del PDF
     * @param filename - Nombre del archivo (opcional)
     */
    private abrirPdf(pdfBase64: string, filename?: string): void {
        if (!pdfBase64) {
            console.error('No se recibió contenido PDF');
            return;
        }

        // Convertir base64 a blob
        const byteCharacters = atob(pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        // Crear URL y abrir en nueva pestaña
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');

        // Limpiar URL después de un tiempo
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Descarga el PDF de Nota de Envío a Mantenimiento
     * @param id_maintenance - ID del registro de mantenimiento
     */
    descargarPdfEnvioMantenimiento(id_maintenance: number): Observable<void> {
        return this.generarPdfEnvioMantenimiento(id_maintenance).pipe(
            switchMap((result) => {
                const byteCharacters = atob(result.pdf_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.nombre_archivo;
                a.click();
                window.URL.revokeObjectURL(url);

                return of(undefined);
            })
        );
    }

    /**
     * Descarga el PDF de Certificado de Retorno de Mantenimiento
     * @param id_maintenance - ID del registro de mantenimiento
     */
    descargarPdfRetornoMantenimiento(id_maintenance: number): Observable<void> {
        return this.generarPdfRetornoMantenimiento(id_maintenance).pipe(
            switchMap((result) => {
                const byteCharacters = atob(result.pdf_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.nombre_archivo;
                a.click();
                window.URL.revokeObjectURL(url);

                return of(undefined);
            })
        );
    }
}
