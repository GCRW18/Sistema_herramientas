/**
 * Booleano de pXP: llega como true/false o como texto 't'/'f'/'true'/'false'.
 * `x.active !== false` o `filter(c => c.active)` fallan con 'f' (texto no vacío = verdadero).
 * Vacío/null se toma como activo (columnas con DEFAULT true).
 */
export function esActivo(v: any): boolean {
    return !(v === false || v === 'f' || v === 'false' || v === 0 || v === '0');
}
