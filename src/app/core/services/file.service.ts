import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap } from 'rxjs';
import { ErpApiService } from '../api/api.service';
import { Archivo } from '../models/archivo.types'; // Assuming you'll create this type

@Injectable({ providedIn: 'root' })
export class FileService {
    private _api = inject(ErpApiService);

    /**
     * Get files by tool ID
     */
    getFilesByToolId(toolId: string): Observable<Archivo[]> {
        return from(this._api.post('herramientas/Archivo/listArchivo', {
            tool_id: toolId,
            start: 0,
            limit: 100 // Adjust limit as needed
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Upload a file
     */
    uploadFile(file: File, toolId: string, type: 'image' | 'document', description: string = ''): Observable<Archivo> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tool_id', toolId);
        formData.append('tipo', type);
        formData.append('descripcion', description);

        // This assumes your PxpClient can handle FormData directly or that the backend expects multipart/form-data
        // You might need to adjust ErpApiService or backend to handle file uploads properly.
        return from(this._api.post('herramientas/Archivo/insertArchivo', formData)).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Delete a file
     */
    deleteFile(fileId: string): Observable<void> {
        return from(this._api.post('herramientas/Archivo/deleteArchivo', {
            id_archivo: fileId
        })).pipe(
            switchMap(() => {
                return of(undefined);
            })
        );
    }
}
