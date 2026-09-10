import { Injectable, inject } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ErpApiService } from '../api/api.service';

/**
 * QrScanService
 *
 * La etiqueta QR de herramienta (reporte backend RCodigoQRTools) graba una URL
 * `.../qr-code/<token>` donde `<token>` es el `id_tool` cifrado. Los flujos de
 * escaneo de Movimientos y Calibraciones esperan, en cambio, el CÓDIGO PLANO de
 * la herramienta (t.code).
 *
 * Traducción de lo escaneado al código plano:
 *   1. Si es una URL de etiqueta QR → `herramientas/DetalleQr/descencriptarIdQR`
 *      (servicio oficial) descifra la URL y devuelve el `id_tool`.
 *   2. Con ese id se consulta `herramientas/tools/listTools` para obtener `code`.
 *   - Cualquier otra cosa (código tecleado, o lector que ya entrega el código)
 *     se devuelve tal cual, sin llamar al backend.
 *
 * Nunca lanza: ante token ilegible o error de red devuelve '' para que cada
 * pantalla muestre su propio mensaje de "herramienta no encontrada".
 */
@Injectable({ providedIn: 'root' })
export class QrScanService {
    private _api = inject(ErpApiService);

    /** Regex de la URL de etiqueta: `.../qr-code/<token>`. */
    private static readonly QR_LABEL_RE = /\/qr-code\/([^\s/?#]+)/i;

    /** true si el texto escaneado es una URL de etiqueta QR de herramienta. */
    isQrLabel(raw: string): boolean {
        return QrScanService.QR_LABEL_RE.test((raw || '').trim());
    }

    /**
     * Devuelve el código plano de la herramienta a partir de lo escaneado.
     * Para entradas que no son una URL de etiqueta el observable emite de
     * inmediato el mismo texto (sin round-trip al backend).
     */
    toToolCode(raw: string): Observable<string> {
        const scanned = (raw || '').trim();
        if (!this.isQrLabel(scanned)) return of(scanned);

        // 1) Descifrar la URL → id_tool (servicio oficial).
        return from(this._api.post('herramientas/DetalleQr/descencriptarIdQR', { url: scanned })).pipe(
            switchMap((resp: any) => {
                const root  = resp?.ROOT ?? resp;
                if (!root || root.error === true) return of('');
                const datos = root.datos ?? root.data ?? null;
                const row   = Array.isArray(datos) ? datos[0] : datos;
                const idTool = String(row?.id ?? row?.id_tool ?? '').trim();
                if (!idTool || idTool === '0') return of('');

                // 2) id_tool → code.
                return from(this._api.post('herramientas/tools/listTools', {
                    start: 0, limit: 1, id_tool: idTool,
                })).pipe(
                    switchMap((r: any) => {
                        const d = r?.data ?? r?.datos ?? r?.ROOT?.datos ?? null;
                        const tool = Array.isArray(d) ? d[0] : d;
                        return of(String(tool?.code ?? '').trim());
                    }),
                    catchError(() => of('')),
                );
            }),
            catchError(() => of('')),
        );
    }
}
