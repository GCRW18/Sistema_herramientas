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
