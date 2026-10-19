/**
 * Fecha local (YYYY-MM-DD) a partir de los componentes locales del Date, sin pasar por UTC.
 * `Date.toISOString()` convierte a UTC, lo que en zonas horarias detrás de UTC (ej. Bolivia,
 * UTC-4) hace que el resultado se adelante un día durante la noche local.
 */
export function localDateStr(d: Date = new Date()): string {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * 'YYYY-MM-DD' (o 'YYYY-MM-DDTHH:mm:ss...') a 'DD/MM/YYYY' para mostrar en UI.
 * Manipula el string directamente — no pasa por Date/toISOString para evitar el mismo
 * corrimiento de día por zona horaria que describe localDateStr().
 */
export function formatDateDMY(iso: string | null | undefined): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('T')[0].split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
}

/**
 * 'YYYY-MM-DD[ HH:mm[:ss]]' del backend a Date en hora LOCAL. `new Date('YYYY-MM-DD')` lo toma
 * como UTC y en Bolivia (UTC-4) cae en el día anterior (y el día 1 en el mes anterior).
 */
export function parseLocalDate(v: string | null | undefined): Date | null {
    if (!v) return null;
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
}

/**
 * Días de calendario entre dos fechas del backend ('YYYY-MM-DD[ HH:mm...]'); `hasta` vacío = hoy.
 * Antes se hacía ceil((ahora - new Date(fecha)) / 1 día): la fecha leída como UTC (20:00 del día
 * anterior en Bolivia) sumaba un día de más.
 */
export function diasDesde(desde: string | null | undefined, hasta?: string | null): number {
    const a = parseLocalDate(desde);
    const b = hasta ? parseLocalDate(hasta) : new Date();
    if (!a || !b) return 0;
    const d0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    const d1 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return Math.max(0, Math.round((d1 - d0) / 86400000));
}
