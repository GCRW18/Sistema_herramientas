import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError, throwError, switchMap } from 'rxjs';
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
        // Las fotos se comprimen en el navegador antes de subir: un JPEG de celular
        // (3-8 MB) suele pasarse del post_max_size / upload_max_filesize del server y
        // eso devuelve una página de error 500 en vez de JSON. Tras el resize quedan
        // muy por debajo del límite.
        const prepared$ = folder === 'Imagenes'
            ? from(this._compressImage(file))
            : from(Promise.resolve(file));

        return prepared$.pipe(
            switchMap((toSend: File) => {
                const fd = new FormData();
                fd.append('sistema', 'Herramientas');
                fd.append('folder', folder);
                fd.append('id', String(id ?? ''));
                fd.append('archivo', toSend, toSend.name);
                return from(this._api.postRaw('herramientas/SubirArchivosBs/uploadFileBlobStorage', fd, { type: 'upload' }));
            }),
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

    /**
     * Reduce una imagen a un tamaño razonable (lado máx. 1600 px, JPEG calidad 0.82)
     * usando un <canvas>. Si el archivo no es una imagen, ya es chico, o el navegador
     * no puede procesarlo, devuelve el archivo original sin tocar.
     */
    private async _compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
        if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
            return file;
        }
        try {
            const dataUrl: string = await new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result as string);
                r.onerror = () => reject(r.error);
                r.readAsDataURL(file);
            });
            const img: HTMLImageElement = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = () => reject(new Error('no se pudo leer la imagen'));
                i.src = dataUrl;
            });

            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            if (scale === 1 && file.size <= 1_500_000) return file;

            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) return file;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const blob: Blob | null = await new Promise((resolve) =>
                canvas.toBlob(resolve, 'image/jpeg', quality),
            );
            if (!blob || blob.size >= file.size) return file;

            const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
            return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
        } catch {
            return file;
        }
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
