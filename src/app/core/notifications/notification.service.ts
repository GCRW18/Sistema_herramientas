import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';

import {
    Notification,
    NotificationSummary,
    NotificationFilters,
    NotificationPriority,
    NotificationCategory,
    NotificationType,
    NotificationPreferences,
    NotificationEvent
} from './notification.types';

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private baseUrl = '/api/notifications';

    // Señales reactivas para notificaciones
    private notificationsSignal = signal<Notification[]>([]);
    private unreadCountSignal = signal<number>(0);

    // Observables para suscripciones
    private notificationsSubject = new BehaviorSubject<Notification[]>([]);
    private summarySubject = new BehaviorSubject<NotificationSummary | null>(null);

    // Computed signals
    public notifications = this.notificationsSignal.asReadonly();
    public unreadCount = this.unreadCountSignal.asReadonly();

    public criticalNotifications = computed(() =>
        this.notificationsSignal().filter(n => n.priority === 'critical' && n.status === 'unread')
    );

    public highPriorityNotifications = computed(() =>
        this.notificationsSignal().filter(n => n.priority === 'high' && n.status === 'unread')
    );

    // Observables públicos
    public notifications$ = this.notificationsSubject.asObservable();
    public summary$ = this.summarySubject.asObservable();

    constructor(private http: HttpClient) {
        this.initializeNotifications();
        this.startPolling();
    }

    /**
     * Inicializar notificaciones al cargar
     */
    private initializeNotifications(): void {
        this.loadNotifications().subscribe();
    }

    /**
     * Polling cada 30 segundos para nuevas notificaciones
     */
    private startPolling(): void {
        interval(30000) // 30 segundos
            .pipe(
                switchMap(() => this.loadNotifications())
            )
            .subscribe();
    }

    /**
     * Cargar notificaciones del usuario actual
     */
    loadNotifications(filters?: NotificationFilters): Observable<Notification[]> {
        // TODO: Reemplazar con llamada real a API
        return this.getMockNotifications().pipe(
            tap(notifications => {
                this.notificationsSignal.set(notifications);
                this.notificationsSubject.next(notifications);
                this.updateUnreadCount(notifications);
            })
        );

        // Implementación real:
        /*
        const params = this.buildHttpParams(filters);
        return this.http.get<Notification[]>(this.baseUrl, { params }).pipe(
            tap(notifications => {
                this.notificationsSignal.set(notifications);
                this.notificationsSubject.next(notifications);
                this.updateUnreadCount(notifications);
            })
        );
        */
    }

    /**
     * Obtener resumen de notificaciones
     */
    getSummary(): Observable<NotificationSummary> {
        // TODO: Reemplazar con llamada real a API
        return this.loadNotifications().pipe(
            map(notifications => this.calculateSummary(notifications)),
            tap(summary => this.summarySubject.next(summary))
        );
    }

    /**
     * Marcar notificación como leída
     */
    markAsRead(notificationId: string): Observable<void> {
        const notifications = this.notificationsSignal();
        const updated = notifications.map(n =>
            n.id === notificationId
                ? { ...n, status: 'read' as const, readAt: new Date() }
                : n
        );

        this.notificationsSignal.set(updated);
        this.notificationsSubject.next(updated);
        this.updateUnreadCount(updated);

        // TODO: Llamada a API
        return of(void 0);
        // return this.http.patch<void>(`${this.baseUrl}/${notificationId}/read`, {});
    }

    /**
     * Marcar todas como leídas
     */
    markAllAsRead(): Observable<void> {
        const notifications = this.notificationsSignal();
        const updated = notifications.map(n => ({
            ...n,
            status: 'read' as const,
            readAt: new Date()
        }));

        this.notificationsSignal.set(updated);
        this.notificationsSubject.next(updated);
        this.updateUnreadCount(updated);

        // TODO: Llamada a API
        return of(void 0);
        // return this.http.post<void>(`${this.baseUrl}/mark-all-read`, {});
    }

    /**
     * Descartar notificación
     */
    dismiss(notificationId: string): Observable<void> {
        const notifications = this.notificationsSignal();
        const updated = notifications.map(n =>
            n.id === notificationId
                ? { ...n, status: 'dismissed' as const, dismissedAt: new Date() }
                : n
        );

        this.notificationsSignal.set(updated);
        this.notificationsSubject.next(updated);
        this.updateUnreadCount(updated);

        // TODO: Llamada a API
        return of(void 0);
        // return this.http.delete<void>(`${this.baseUrl}/${notificationId}`);
    }

    /**
     * Eliminar notificación
     */
    delete(notificationId: string): Observable<void> {
        const notifications = this.notificationsSignal();
        const updated = notifications.filter(n => n.id !== notificationId);

        this.notificationsSignal.set(updated);
        this.notificationsSubject.next(updated);
        this.updateUnreadCount(updated);

        // TODO: Llamada a API
        return of(void 0);
        // return this.http.delete<void>(`${this.baseUrl}/${notificationId}`);
    }

    /**
     * Crear notificación manual
     */
    create(notification: Partial<Notification>): Observable<Notification> {
        const newNotification: Notification = {
            id: this.generateId(),
            type: notification.type || 'GENERAL',
            category: notification.category || 'SYSTEM',
            priority: notification.priority || 'medium',
            status: 'unread',
            title: notification.title || '',
            message: notification.message || '',
            createdAt: new Date(),
            userId: 1, // TODO: Obtener del usuario actual
            ...notification
        } as Notification;

        const notifications = [...this.notificationsSignal(), newNotification];
        this.notificationsSignal.set(notifications);
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount(notifications);

        // TODO: Llamada a API
        return of(newNotification);
        // return this.http.post<Notification>(this.baseUrl, newNotification);
    }

    /**
     * Obtener preferencias de notificaciones del usuario
     */
    getPreferences(): Observable<NotificationPreferences> {
        // TODO: Implementar llamada a API
        return of({
            userId: 1,
            enableNotifications: true,
            enableEmailNotifications: true,
            enablePushNotifications: false,
            enableSoundAlerts: true,
            categories: {
                CALIBRATION: { enabled: true, minPriority: 'medium', email: true, push: false },
                LOANS: { enabled: true, minPriority: 'high', email: true, push: false },
                INVENTORY: { enabled: true, minPriority: 'low', email: false, push: false },
                MAINTENANCE: { enabled: true, minPriority: 'medium', email: true, push: false },
                SYSTEM: { enabled: true, minPriority: 'low', email: false, push: false },
                USER: { enabled: true, minPriority: 'low', email: false, push: false }
            },
            quietHoursEnabled: false,
            updatedAt: new Date()
        });
    }

    /**
     * Actualizar preferencias
     */
    updatePreferences(preferences: Partial<NotificationPreferences>): Observable<void> {
        // TODO: Implementar llamada a API
        return of(void 0);
        // return this.http.put<void>(`${this.baseUrl}/preferences`, preferences);
    }

    /**
     * Actualizar contador de no leídas
     */
    private updateUnreadCount(notifications: Notification[]): void {
        const count = notifications.filter(n => n.status === 'unread').length;
        this.unreadCountSignal.set(count);
    }

    /**
     * Calcular resumen de notificaciones
     */
    private calculateSummary(notifications: Notification[]): NotificationSummary {
        const unread = notifications.filter(n => n.status === 'unread');

        return {
            total: notifications.length,
            unread: unread.length,
            byPriority: {
                critical: unread.filter(n => n.priority === 'critical').length,
                high: unread.filter(n => n.priority === 'high').length,
                medium: unread.filter(n => n.priority === 'medium').length,
                low: unread.filter(n => n.priority === 'low').length
            },
            byCategory: {
                CALIBRATION: unread.filter(n => n.category === 'CALIBRATION').length,
                LOANS: unread.filter(n => n.category === 'LOANS').length,
                INVENTORY: unread.filter(n => n.category === 'INVENTORY').length,
                MAINTENANCE: unread.filter(n => n.category === 'MAINTENANCE').length,
                SYSTEM: unread.filter(n => n.category === 'SYSTEM').length,
                USER: unread.filter(n => n.category === 'USER').length
            },
            latestNotifications: notifications.slice(0, 5)
        };
    }

    /**
     * Generar ID temporal
     */
    private generateId(): string {
        return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Obtener notificaciones mock para desarrollo
     */
    private getMockNotifications(): Observable<Notification[]> {
        const mockNotifications: Notification[] = [
            {
                id: '1',
                type: 'CALIBRATION_EXPIRED',
                category: 'CALIBRATION',
                priority: 'critical',
                status: 'unread',
                title: 'Calibración Vencida',
                message: 'La herramienta BOA-H-00123 tiene su calibración vencida hace 5 días',
                icon: 'heroicons_outline:exclamation-triangle',
                iconColor: 'error',
                link: '/calibration/tracking',
                relatedEntityId: '123',
                relatedEntityType: 'tool',
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Hace 2 horas
                userId: 1
            },
            {
                id: '2',
                type: 'LOAN_OVERDUE',
                category: 'LOANS',
                priority: 'high',
                status: 'unread',
                title: 'Préstamo Vencido',
                message: 'El técnico Juan Pérez no ha devuelto 3 herramientas',
                icon: 'heroicons_outline:clock',
                iconColor: 'warn',
                link: '/movements/history',
                createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // Hace 5 horas
                userId: 1
            },
            {
                id: '3',
                type: 'STOCK_LOW',
                category: 'INVENTORY',
                priority: 'medium',
                status: 'unread',
                title: 'Stock Bajo',
                message: '5 herramientas están por debajo del stock mínimo',
                icon: 'heroicons_outline:archive-box',
                iconColor: 'primary',
                link: '/inventory/view',
                createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Hace 1 día
                userId: 1
            },
            {
                id: '4',
                type: 'CALIBRATION_EXPIRING_SOON',
                category: 'CALIBRATION',
                priority: 'medium',
                status: 'read',
                title: 'Calibraciones Próximas a Vencer',
                message: '12 herramientas requieren calibración en los próximos 15 días',
                icon: 'heroicons_outline:bell',
                iconColor: 'accent',
                link: '/calibration/alerts',
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Hace 2 días
                readAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                userId: 1
            }
        ];

        return of(mockNotifications);
    }
}
