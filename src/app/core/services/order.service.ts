import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map, tap, switchMap, take } from 'rxjs';
import {
    Order,
    OrderFilters,
    OrderStats,
    OrderCreateForm,
    OrderApprovalForm,
    OrderReceiveForm,
    OrderHistory,
    OrderSummary
} from '../models/order.types';

@Injectable({
    providedIn: 'root'
})
export class OrderService {
    private _orders: BehaviorSubject<Order[]> = new BehaviorSubject<Order[]>([]);
    private _order: BehaviorSubject<Order | null> = new BehaviorSubject<Order | null>(null);
    private _stats: BehaviorSubject<OrderStats | null> = new BehaviorSubject<OrderStats | null>(null);

    constructor(private _httpClient: HttpClient) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for orders
     */
    get orders$(): Observable<Order[]> {
        return this._orders.asObservable();
    }

    /**
     * Getter for order
     */
    get order$(): Observable<Order | null> {
        return this._order.asObservable();
    }

    /**
     * Getter for stats
     */
    get stats$(): Observable<OrderStats | null> {
        return this._stats.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all orders
     */
    getOrders(filters?: OrderFilters): Observable<Order[]> {
        return this._httpClient.get<Order[]>('api/orders', { params: filters as any }).pipe(
            tap((orders) => {
                this._orders.next(orders);
            })
        );
    }

    /**
     * Get order by id
     */
    getOrderById(id: string): Observable<Order> {
        return this._httpClient.get<Order>(`api/orders/${id}`).pipe(
            tap((order) => {
                this._order.next(order);
            })
        );
    }

    /**
     * Get order by order number
     */
    getOrderByNumber(orderNumber: string): Observable<Order> {
        return this._httpClient.get<Order>(`api/orders/number/${orderNumber}`).pipe(
            tap((order) => {
                this._order.next(order);
            })
        );
    }

    /**
     * Create order
     */
    createOrder(orderData: OrderCreateForm): Observable<Order> {
        return this.orders$.pipe(
            take(1),
            switchMap(orders =>
                this._httpClient.post<Order>('api/orders', orderData).pipe(
                    map((newOrder) => {
                        // Update the orders with the new order
                        this._orders.next([newOrder, ...orders]);

                        // Return the new order
                        return newOrder;
                    })
                )
            )
        );
    }

    /**
     * Update order
     */
    updateOrder(id: string, orderData: Partial<Order>): Observable<Order> {
        return this.orders$.pipe(
            take(1),
            switchMap(orders =>
                this._httpClient.patch<Order>(`api/orders/${id}`, orderData).pipe(
                    map((updatedOrder) => {
                        // Find the index of the updated order
                        const index = orders.findIndex(item => item.id === id);

                        // Update the order
                        orders[index] = updatedOrder;

                        // Update the orders
                        this._orders.next(orders);

                        // Return the updated order
                        return updatedOrder;
                    })
                )
            )
        );
    }

    /**
     * Approve order
     */
    approveOrder(approvalData: OrderApprovalForm): Observable<Order> {
        return this._httpClient.post<Order>(`api/orders/${approvalData.orderId}/approve`, approvalData).pipe(
            tap((updatedOrder) => {
                this._order.next(updatedOrder);
                this._updateOrderInList(updatedOrder);
            })
        );
    }

    /**
     * Reject order
     */
    rejectOrder(orderId: string, reason: string): Observable<Order> {
        return this._httpClient.post<Order>(`api/orders/${orderId}/reject`, { reason }).pipe(
            tap((updatedOrder) => {
                this._order.next(updatedOrder);
                this._updateOrderInList(updatedOrder);
            })
        );
    }

    /**
     * Receive order
     */
    receiveOrder(receiveData: OrderReceiveForm): Observable<Order> {
        return this._httpClient.post<Order>(`api/orders/${receiveData.orderId}/receive`, receiveData).pipe(
            tap((updatedOrder) => {
                this._order.next(updatedOrder);
                this._updateOrderInList(updatedOrder);
            })
        );
    }

    /**
     * Cancel order
     */
    cancelOrder(id: string, reason: string): Observable<Order> {
        return this._httpClient.post<Order>(`api/orders/${id}/cancel`, { reason }).pipe(
            tap((updatedOrder) => {
                this._order.next(updatedOrder);
                this._updateOrderInList(updatedOrder);
            })
        );
    }

    /**
     * Delete order
     */
    deleteOrder(id: string): Observable<boolean> {
        return this.orders$.pipe(
            take(1),
            switchMap(orders =>
                this._httpClient.delete<boolean>(`api/orders/${id}`).pipe(
                    map((isDeleted) => {
                        // Find the index of the deleted order
                        const index = orders.findIndex(item => item.id === id);

                        // Delete the order
                        orders.splice(index, 1);

                        // Update the orders
                        this._orders.next(orders);

                        // Return the deleted status
                        return isDeleted;
                    })
                )
            )
        );
    }

    /**
     * Get order history
     */
    getOrderHistory(orderId: string): Observable<OrderHistory[]> {
        return this._httpClient.get<OrderHistory[]>(`api/orders/${orderId}/history`);
    }

    /**
     * Get order statistics
     */
    getOrderStats(filters?: OrderFilters): Observable<OrderStats> {
        return this._httpClient.get<OrderStats>('api/orders/stats', { params: filters as any }).pipe(
            tap((stats) => {
                this._stats.next(stats);
            })
        );
    }

    /**
     * Get pending orders
     */
    getPendingOrders(): Observable<Order[]> {
        return this.getOrders({ status: 'pending' });
    }

    /**
     * Get urgent orders
     */
    getUrgentOrders(): Observable<Order[]> {
        return this.getOrders({ priority: 'urgent' });
    }

    /**
     * Get orders by user
     */
    getOrdersByUser(userId: string): Observable<Order[]> {
        return this.getOrders({ requestedById: userId });
    }

    /**
     * Get orders requiring approval
     */
    getOrdersRequiringApproval(): Observable<Order[]> {
        return this.getOrders({ status: 'pending' });
    }

    /**
     * Search orders
     */
    searchOrders(query: string): Observable<Order[]> {
        return this.getOrders({ search: query });
    }

    /**
     * Export orders to Excel
     */
    exportToExcel(filters?: OrderFilters): Observable<Blob> {
        return this._httpClient.get('api/orders/export', {
            params: filters as any,
            responseType: 'blob'
        });
    }

    /**
     * Get order summaries
     */
    getOrderSummaries(filters?: OrderFilters): Observable<OrderSummary[]> {
        return this._httpClient.get<OrderSummary[]>('api/orders/summaries', { params: filters as any });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Update order in the list
     */
    private _updateOrderInList(updatedOrder: Order): void {
        this.orders$.pipe(take(1)).subscribe(orders => {
            const index = orders.findIndex(item => item.id === updatedOrder.id);
            if (index !== -1) {
                orders[index] = updatedOrder;
                this._orders.next(orders);
            }
        });
    }
}
