import { Injectable } from '@angular/core';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import { Warehouse, Location } from 'app/core/models';
import PxpClient from 'pxp-client';

/**
 * WarehouseService
 * Servicio para gestión de almacenes y ubicaciones usando PxpClient
 * CORREGIDO: 14-11-2025 - URLs corregidas a herramientas/warehouses
 */
@Injectable({
    providedIn: 'root'
})
export class WarehouseService {

    constructor() {
        console.log(' WarehouseService inicializado');
    }

    // ============================================
    // WAREHOUSES CRUD
    // ============================================

    getWarehouses(): Observable<Warehouse[]> {
        console.log(' Obteniendo lista de almacenes...');

        return from(
            PxpClient.doRequest({
                url: 'herramientas/warehouses/listWarehouses',
                params: {
                    start: 0,
                    limit: 1000
                }
            })
        ).pipe(
            map((response: any) => {
                console.log(' Respuesta getWarehouses:', response);

                if (response?.data) {
                    return response.data;
                }
                if (response?.data) {
                    return response.data;
                }
                return [];
            }),
            catchError((error) => {
                console.error(' Error en getWarehouses:', error);
                return throwError(() => error);
            })
        );
    }

    getWarehouseById(id: string): Observable<Warehouse> {
        console.log(' Obteniendo almacén por ID:', id);

        return from(
            PxpClient.doRequest({
                url: 'herramientas/warehouses/listWarehouses',
                params: {
                    start: 0,
                    limit: 1,
                    filtro: `whs.id_warehouse = ${id}`
                }
            })
        ).pipe(
            map((response: any) => {
                console.log(' Respuesta getWarehouseById:', response);

                const data = response?.data || response?.data;
                if (data && data.length > 0) {
                    return data[0];
                }
                throw new Error('Almacén no encontrado');
            }),
            catchError((error) => {
                console.error(' Error en getWarehouseById:', error);
                return throwError(() => error);
            })
        );
    }

    createWarehouse(warehouse: Partial<Warehouse>): Observable<any> {
        console.log(' Creando almacén:', warehouse);

        return from(
            PxpClient.doRequest({
                url: 'herramientas/warehouses/insertWarehouse',
                params: warehouse
            })
        ).pipe(
            map((response: any) => {
                console.log(' Respuesta createWarehouse:', response);
                return response;
            }),
            catchError((error) => {
                console.error(' Error en createWarehouse:', error);
                return throwError(() => error);
            })
        );
    }

    updateWarehouse(id: string, warehouse: Partial<Warehouse>): Observable<any> {
        console.log('✏ Actualizando almacén:', id, warehouse);

        return from(
            PxpClient.doRequest({
                url: 'herramientas/warehouses/insertWarehouse',
                params: {
                    ...warehouse,
                    id_warehouse: parseInt(id)
                }
            })
        ).pipe(
            map((response: any) => {
                console.log(' Respuesta updateWarehouse:', response);
                return response;
            }),
            catchError((error) => {
                console.error(' Error en updateWarehouse:', error);
                return throwError(() => error);
            })
        );
    }

    deleteWarehouse(id: string): Observable<any> {
        console.log(' Eliminando almacén:', id);

        return from(
            PxpClient.doRequest({
                url: 'herramientas/warehouses/deleteWarehouse',
                params: {
                    id_warehouse: parseInt(id)
                }
            })
        ).pipe(
            map((response: any) => {
                console.log(' Respuesta deleteWarehouse:', response);
                return response;
            }),
            catchError((error) => {
                console.error(' Error en deleteWarehouse:', error);
                return throwError(() => error);
            })
        );
    }

    // ============================================
    // LOCATIONS CRUD
    // ============================================

    getLocations(warehouseId: string): Observable<Location[]> {
        console.log(' Obteniendo ubicaciones del almacén:', warehouseId);

        return from(
            PxpClient.doRequest({
                url: 'herramientas/locations/listLocations',
                params: {
                    start: 0,
                    limit: 1000,
                    filtro: `loc.warehouse_id = ${warehouseId}`
                }
            })
        ).pipe(
            map((response: any) => {
                console.log(' Respuesta getLocations:', response);

                if (response?.data) {
                    return response.data;
                }
                if (response?.data) {
                    return response.data;
                }
                return [];
            }),
            catchError((error) => {
                console.error(' Error en getLocations:', error);
                return throwError(() => error);
            })
        );
    }

    getLocationById(id: string): Observable<Location> {
        console.log(' Obteniendo ubicación por ID:', id);

        return from(
            PxpClient.doRequest({
                url: 'herramientas/locations/listLocations',
                params: {
                    start: 0,
                    limit: 1,
                    filtro: `loc.id_location = ${id}`
                }
            })
        ).pipe(
            map((response: any) => {
                console.log(' Respuesta getLocationById:', response);

                const data = response?.data || response?.data;
                if (data && data.length > 0) {
                    return data[0];
                }
                throw new Error('Ubicación no encontrada');
            }),
            catchError((error) => {
                console.error(' Error en getLocationById:', error);
                return throwError(() => error);
            })
        );
    }

    createLocation(location: Partial<Location>): Observable<any> {
        console.log(' Creando ubicación:', location);

        return from(
            PxpClient.doRequest({
                url: 'herramientas/locations/insertLocation',
                params: location
            })
        ).pipe(
            map((response: any) => {
                console.log(' Respuesta createLocation:', response);
                return response;
            }),
            catchError((error) => {
                console.error(' Error en createLocation:', error);
                return throwError(() => error);
            })
        );
    }

    updateLocation(id: string, location: Partial<Location>): Observable<any> {
        console.log(' Actualizando ubicación:', id, location);

        return from(
            PxpClient.doRequest({
                url: 'herramientas/locations/insertLocation',
                params: {
                    ...location,
                    id_location: parseInt(id)
                }
            })
        ).pipe(
            map((response: any) => {
                console.log(' Respuesta updateLocation:', response);
                return response;
            }),
            catchError((error) => {
                console.error(' Error en updateLocation:', error);
                return throwError(() => error);
            })
        );
    }

    deleteLocation(id: string): Observable<any> {
        console.log('🗑 Eliminando ubicación:', id);

        return from(
            PxpClient.doRequest({
                url: 'herramientas/locations/deleteLocation',
                params: {
                    id_location: parseInt(id)
                }
            })
        ).pipe(
            map((response: any) => {
                console.log(' Respuesta deleteLocation:', response);
                return response;
            }),
            catchError((error) => {
                console.error(' Error en deleteLocation:', error);
                return throwError(() => error);
            })
        );
    }
}
