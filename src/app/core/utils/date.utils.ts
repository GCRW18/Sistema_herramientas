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
