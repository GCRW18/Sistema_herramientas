import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap } from 'rxjs';
import { ErpApiService } from '../api/api.service';
import { AuditLog, AuditLogFilters } from '../models';

@Injectable({ providedIn: 'root' })
export class AuditService {
    private _api = inject(ErpApiService);
    private _logs: ReplaySubject<AuditLog[]> = new ReplaySubject<AuditLog[]>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for audit logs
     */
    get logs$(): Observable<AuditLog[]> {
        return this._logs.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all audit logs with optional filters
     */
    getAuditLogs(filters?: AuditLogFilters): Observable<AuditLog[]> {
        const params: any = {
            start: 0,
            limit: 100,
            sort: 'timestamp',
            dir: 'desc',
            ...filters,
        };

        return from(this._api.post('sistema/Auditoria/listarAuditoria', params)).pipe(
            switchMap((response: any) => {
                const logs = response?.datos || [];
                this._logs.next(logs);
                return of(logs);
            })
        );
    }

    /**
     * Get audit log by id
     */
    getAuditLogById(id: string): Observable<AuditLog> {
        return from(this._api.post('sistema/Auditoria/obtenerAuditoria', {
            id_auditoria: id,
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || null);
            })
        );
    }

    /**
     * Create audit log entry
     */
    createAuditLog(log: Partial<AuditLog>): Observable<AuditLog> {
        return from(this._api.post('sistema/Auditoria/registrarAuditoria', {
            usuario: log.user,
            id_usuario: log.userId,
            accion: log.action,
            tipo_accion: log.actionType,
            modulo: log.module,
            entidad: log.entity,
            id_entidad: log.entityId,
            detalles: log.details,
            ip_address: log.ipAddress,
            user_agent: log.userAgent,
            valor_anterior: log.previousValue,
            valor_nuevo: log.newValue,
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || log);
            })
        );
    }

    /**
     * Export audit logs
     */
    exportAuditLogs(filters?: AuditLogFilters, format: 'PDF' | 'EXCEL' = 'PDF'): Observable<any> {
        return from(this._api.post('sistema/Auditoria/exportarAuditoria', {
            filtros: filters,
            formato: format,
        })).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }

    /**
     * Get audit logs by user
     */
    getAuditLogsByUser(userId: string): Observable<AuditLog[]> {
        return this.getAuditLogs({ user: userId });
    }

    /**
     * Get audit logs by entity
     */
    getAuditLogsByEntity(entityType: string, entityId: string): Observable<AuditLog[]> {
        return from(this._api.post('sistema/Auditoria/listarAuditoriaPorEntidad', {
            tipo_entidad: entityType,
            id_entidad: entityId,
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get audit logs by module
     */
    getAuditLogsByModule(module: string): Observable<AuditLog[]> {
        return this.getAuditLogs({ module });
    }

    /**
     * Get audit logs by date range
     */
    getAuditLogsByDateRange(startDate: Date, endDate: Date): Observable<AuditLog[]> {
        return this.getAuditLogs({ startDate, endDate });
    }

    /**
     * Get audit statistics
     */
    getAuditStatistics(filters?: AuditLogFilters): Observable<any> {
        return from(this._api.post('sistema/Auditoria/obtenerEstadisticas', {
            filtros: filters,
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Delete old audit logs
     */
    deleteOldAuditLogs(beforeDate: Date): Observable<void> {
        return from(this._api.post('sistema/Auditoria/eliminarAuditoriasAntiguas', {
            fecha_limite: beforeDate,
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }

    /**
     * Log user action
     */
    logAction(
        action: string,
        actionType: AuditLog['actionType'],
        module: string,
        entity: string,
        entityId?: string,
        details?: string
    ): Observable<AuditLog> {
        return this.createAuditLog({
            action,
            actionType,
            module,
            entity,
            entityId,
            details,
            timestamp: new Date(),
        });
    }

    /**
     * Log create action
     */
    logCreate(module: string, entity: string, entityId: string, details?: string): Observable<AuditLog> {
        return this.logAction(`Creó ${entity}`, 'create', module, entity, entityId, details);
    }

    /**
     * Log update action
     */
    logUpdate(module: string, entity: string, entityId: string, details?: string): Observable<AuditLog> {
        return this.logAction(`Actualizó ${entity}`, 'update', module, entity, entityId, details);
    }

    /**
     * Log delete action
     */
    logDelete(module: string, entity: string, entityId: string, details?: string): Observable<AuditLog> {
        return this.logAction(`Eliminó ${entity}`, 'delete', module, entity, entityId, details);
    }

    /**
     * Log view action
     */
    logView(module: string, entity: string, entityId: string, details?: string): Observable<AuditLog> {
        return this.logAction(`Visualizó ${entity}`, 'view', module, entity, entityId, details);
    }

    /**
     * Log export action
     */
    logExport(module: string, entity: string, details?: string): Observable<AuditLog> {
        return this.logAction(`Exportó ${entity}`, 'export', module, entity, undefined, details);
    }
}
