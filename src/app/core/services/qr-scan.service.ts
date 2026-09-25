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
 *   1. Si es una URL de etiqueta QR (o una versión "garbled" de la misma, ver
 *      más abajo) → `herramientas/DetalleQr/descencriptarIdQR` (servicio
 *      oficial) descifra la URL y devuelve el `id_tool`.
 *   2. Con ese id se consulta `herramientas/tools/listTools` para obtener `code`.
 *   - Cualquier otra cosa (código tecleado, o lector que ya entrega el código)
 *     se devuelve tal cual, sin llamar al backend.
 *
 * Lectores con idioma de teclado distinto al del sistema operativo:
 * el lector emula un teclado y, si su idioma configurado no coincide con el
 * del equipo, las LETRAS y NÚMEROS salen bien (misma posición en casi todos los
 * layouts QWERTY) pero los SÍMBOLOS (":" "/" "-" "_" "=") salen cambiados por
 * otro carácter fijo por sesión/equipo (ej. ":" -> "Ñ"). Esto rompe el
 * reconocimiento estricto de la URL. Para no perder el escaneo, `_extractGarbledToken`
 * aprende en el momento qué carácter reemplazó a "-" y a "/" comparando contra el
 * trozo fijo y conocido "qr-code/" de la propia URL, y aplica esa sustitución al
 * resto del token. El id_tool cifrado casi siempre termina en 1-2 "=" de padding
 * base64 (RCodigoQRTools solo traduce "+/" a "-_", nunca toca "="); como no hay
 * ancla fija para aprender ESE símbolo, se reconoce por descarte: si el resto tras
 * el último alfanumérico son 1-2 símbolos iguales que completan el token a un largo
 * múltiplo de 4, se reconstruyen como "=". El causante real es un problema de
 * configuración del lector (idioma de teclado no coincide con el del equipo) —
 * esto es solo un mejor esfuerzo para que el escaneo funcione igual mientras se
 * corrige eso.
 *
 * Nunca lanza: ante token ilegible o error de red devuelve '' para que cada
 * pantalla muestre su propio mensaje de "herramienta no encontrada".
 */
@Injectable({ providedIn: 'root' })
export class QrScanService {
    private _api = inject(ErpApiService);

    /** Regex de la URL de etiqueta, sin corromper: `.../qr-code/<token>`. */
    private static readonly QR_LABEL_RE = /\/qr-code\/([^\s/?#]+)/i;
    /** Ancla tolerante a símbolos cambiados: "qr" + code" con separadores de 1-3 símbolos cualquiera. */
    private static readonly GARBLED_RE = /qr([^a-z0-9]{1,3})code([^a-z0-9]{1,3})(.+)$/i;
    /** Sniff liviano de "http(s)" tolerante a símbolos cambiados entre letras. Sin ancla al
     *  inicio: el campo de escaneo puede traer un prefijo fijo (ej. "BOA-H-" precargado) que
     *  el lector no reemplaza sino que antepone, así que "http" puede no estar en la posición 0. */
    private static readonly HTTP_SNIFF_RE = /h.{0,2}t.{0,2}t.{0,2}p/i;
    /** Alfabeto válido de un token (base64 url-safe: letras, dígitos, "-", "_", "=" de padding). */
    private static readonly TOKEN_CHAR_RE = /[a-z0-9_=-]/i;
    /** Largo mínimo de token para considerarlo una etiqueta real y no ruido. */
    private static readonly MIN_TOKEN_LEN = 8;

    /** true si el texto escaneado es (o parece ser) una URL de etiqueta QR de herramienta. */
    isQrLabel(raw: string): boolean {
        const s = (raw || '').trim();
        if (QrScanService.QR_LABEL_RE.test(s)) return true;
        return this._extractGarbledToken(s).length >= QrScanService.MIN_TOKEN_LEN;
    }

    /**
     * Devuelve el código plano de la herramienta a partir de lo escaneado.
     * Para entradas que no son una URL de etiqueta el observable emite de
     * inmediato el mismo texto (sin round-trip al backend).
     */
    toToolCode(raw: string): Observable<string> {
        const scanned = (raw || '').trim();

        const strict = QrScanService.QR_LABEL_RE.exec(scanned);
        if (strict) {
            // Aun con URL reconocida, el terminador del lector (Enter) puede
            // llegar mal mapeado y pegado al token (ver cabecera) — se recorta.
            return this._decryptLabelUrl(`/qr-code/${this._trimTokenNoise(strict[1])}`);
        }

        const garbled = this._extractGarbledToken(scanned);
        if (garbled.length >= QrScanService.MIN_TOKEN_LEN) {
            return this._decryptLabelUrl(`/qr-code/${garbled}`);
        }

        return of(scanned);
    }

    /** Quita caracteres finales fuera del alfabeto del token (ruido del terminador del lector). */
    private _trimTokenNoise(token: string): string {
        let t = token;
        while (t.length && !QrScanService.TOKEN_CHAR_RE.test(t[t.length - 1])) t = t.slice(0, -1);
        return t;
    }

    /** Ver cabecera de la clase: reconstruye el token de una URL con símbolos cambiados por teclado. */
    private _extractGarbledToken(raw: string): string {
        if (raw.length < 25 || !QrScanService.HTTP_SNIFF_RE.test(raw)) return '';
        const m = QrScanService.GARBLED_RE.exec(raw);
        if (!m) return '';

        const dashSub  = m[1].length === 1 ? m[1] : '';
        const slashSub = m[2].length === 1 ? m[2] : '';
        const tail     = m[3];

        let token = '';
        let otherSub: string | null = null;
        for (let i = 0; i < tail.length; i++) {
            const c = tail[i];
            if (/[a-z0-9]/i.test(c)) { token += c; continue; }
            if (dashSub && c === dashSub) { token += '-'; continue; }
            if (slashSub && c === slashSub) break; // no debería aparecer dentro del token
            if (otherSub === null) {
                if (!/[a-z0-9]/i.test(tail.slice(i + 1))) {
                    // Sin más alfanuméricos detrás: puede ser ruido del terminador del
                    // lector, o el padding "=" real del base64 (el id_tool cifrado casi
                    // siempre termina en 1-2 "=", ver cabecera). Si el resto encaja
                    // matemáticamente como padding, se reconstruye; si no, se descarta.
                    const padLen = this._padLenForBase64(token, tail.slice(i));
                    if (padLen > 0) token += '='.repeat(padLen);
                    break;
                }
                otherSub = c;
                token += '_';
                continue;
            }
            if (c === otherSub) { token += '_'; continue; }
            break; // un tercer símbolo distinto ya es ruido del terminador
        }
        return this._trimTokenNoise(token);
    }

    /** Si `trailing` (1-2 símbolos, todos iguales) completa a `tokenSoFar` a un
     *  múltiplo de 4 (largo válido de base64), devuelve cuántos "=" agregar; si no
     *  encaja, 0 (se trata como ruido del terminador, no como padding). */
    private _padLenForBase64(tokenSoFar: string, trailing: string): number {
        if (trailing.length < 1 || trailing.length > 2) return 0;
        if (trailing.length === 2 && trailing[0] !== trailing[1]) return 0;
        const need = (4 - (tokenSoFar.length % 4)) % 4;
        return need === trailing.length ? need : 0;
    }

    private _decryptLabelUrl(url: string): Observable<string> {
        return from(this._api.post('herramientas/DetalleQr/descencriptarIdQR', { url })).pipe(
            switchMap((resp: any) => {
                const root  = resp?.ROOT ?? resp;
                if (!root || root.error === true) return of('');
                const datos = root.datos ?? root.data ?? null;
                const row   = Array.isArray(datos) ? datos[0] : datos;
                const idTool = String(row?.id ?? row?.id_tool ?? '').trim();
                if (!idTool || idTool === '0') return of('');

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
