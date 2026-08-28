import { Injectable } from '@angular/core';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import { Warehouse, Location } from 'app/core/models';
import PxpClient from 'pxp-client';

/**
 * WarehouseService
 * Solo lectura de almacenes y ubicaciones. La gestión (crear/editar/eliminar)
 * vive en GestionUbicacionesService (módulo gestion-ubicaciones). Las ubicaciones
 * (he.tlocations) ya no se crean/editan desde ningún lado — solo se listan aquí
 * para consultar-inventario.
 */
@Injectable({
    providedIn: 'root'
})
export class WarehouseService {

    getWarehouses(): Observable<Warehouse[]> {
        return from(
            PxpClient.doRequest({
                url: 'herramientas/warehouses/listWarehouses',
                params: { start: 0, limit: 1000 }
            })
        ).pipe(
            map((response: any) => response?.datos || response?.data || []),
            catchError((error) => {
                console.error('Error en getWarehouses:', error);
                return throwError(() => error);
            })
        );
    }

    getAllLocations(): Observable<Location[]> {
        return from(
            PxpClient.doRequest({
                url: 'herramientas/locations/listLocations',
                params: { start: 0, limit: 5000 }
            })
        ).pipe(
            map((response: any) => response?.datos || response?.data || []),
            catchError((error) => {
                console.error('Error en getAllLocations:', error);
                return throwError(() => error);
            })
        );
    }
}
