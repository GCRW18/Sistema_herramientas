import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ErpApiService } from '../api/api.service';

/**
 * Subida / descarga de archivos al Blob Storage del ERP.
 *
 * Subida  → herramientas/SubirArchivosBs/uploadFileBlobStorage  (multipart, campo "archivo")
 *           devuelve `ruta_bs` (ej. "erp/sis_herramientas/Documentos/<hash>.pdf") — ESO se
 *           guarda en la columna de la tabla, ya no el base64.
 * Descarga → <filesUrl>sis_workflow/control/DescargarArchivoBlobStorage.php?url_blob_storage=<encode(ruta_bs)>
 */
@Injectable({ providedIn: 'root' })
export class BlobStorageService {

    private _api = inject(ErpApiService);

    /**
     * Sube un archivo al Blob Storage.
     * @param file    archivo del <input type="file">
     * @param folder  'Documentos' para PDFs / 'Imagenes' para fotos
     * @param id      id de la entidad dueña (id_calibration, id_tool, …)
     * @returns       la `ruta_bs` a persistir en la BD
     */
    upload(file: File, folder: 'Documentos' | 'Imagenes', id: number | string): Observable<string> {
        const fd = new FormData();
        fd.append('sistema', 'Herramientas');
        fd.append('folder', folder);
        fd.append('id', String(id ?? ''));
        fd.append('archivo', file, file.name);

        return from(this._api.postRaw('herramientas/SubirArchivosBs/uploadFileBlobStorage', fd, { type: 'upload' })).pipe(
            map((resp: any) => {
                const isError = resp?.error === true || resp?.ROOT?.error === true;
                if (isError) {
                    throw new Error(
                        resp?.detail?.message ?? resp?.ROOT?.detalle?.mensaje ?? 'Error al subir el archivo al Blob Storage'
                    );
                }
                const ruta = resp?.data?.ruta_bs ?? resp?.ROOT?.datos?.ruta_bs ?? resp?.datos?.ruta_bs ?? null;
                if (!ruta) throw new Error('El servicio no devolvió la ruta del archivo (ruta_bs)');
                return String(ruta);
            }),
            catchError((e) => throwError(() => (e instanceof Error ? e : new Error('Error al subir el archivo al Blob Storage')))),
        );
    }

    /** URL pública para abrir / descargar un archivo guardado en Blob Storage. */
    downloadUrl(rutaBs: string): string {
        return `${environment.filesUrl}sis_workflow/control/DescargarArchivoBlobStorage.php`
            + `?url_blob_storage=${encodeURIComponent(rutaBs)}`;
    }

    /** Abre el archivo del Blob Storage en una pestaña nueva. */
    open(rutaBs: string): void {
        window.open(this.downloadUrl(rutaBs), '_blank');
    }

    /**
     * Resuelve el valor guardado de una foto a un `src` usable en <img>:
     * ruta_bs → URL de descarga; data:/http(s) heredado → tal cual.
     */
    resolveImageSrc(v: string | null | undefined): string | null {
        if (!v) return null;
        const s = String(v).trim();
        if (!s) return null;
        if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://')) return s;
        if (this.isRutaBs(s)) return this.downloadUrl(s);
        return s;
    }

    /**
     * Heurística para distinguir una `ruta_bs` de un base64 heredado en la misma columna.
     * (ruta_bs es corta, con "/" y extensión; el base64 es largo y sin "/").
     */
    isRutaBs(v: string | null | undefined): boolean {
        if (!v) return false;
        const s = String(v).trim();
        return s.length > 0 && s.length < 400 && !s.startsWith('data:')
            && (s.includes('/') || /\.(pdf|png|jpe?g|webp|gif)$/i.test(s));
    }
}
