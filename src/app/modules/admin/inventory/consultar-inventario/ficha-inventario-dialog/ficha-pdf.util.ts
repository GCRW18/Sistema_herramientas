import { UnifiedItem } from '../consultar-inventario.component';

export interface FichaPdfDetail {
    movements:  any[];
    components: any[];
    loans:      any[];
}

export interface FichaPdfPayload {
    subtitulo: string;
    campos:    [string, string][];
    tablas:    { titulo: string; columnas: any[]; filas: any[][] }[];
}

// ─── Helpers de formato (mismos criterios que ficha-panel-dialog, como funciones puras) ───

function getMovTipo(mov: any): string {
    if (mov._tipoMov) return mov._tipoMov;
    const t = mov.movement_type || mov.tipo || '';
    if (t === 'entry' || t === 'ENTRADA') return 'ENTRADA';
    if (t === 'exit'  || t === 'SALIDA')  return 'SALIDA';
    return t || '—';
}
function getMovDescripcion(mov: any): string {
    return mov.description || mov.subtipo || mov.loan_number || mov.nroNota || mov.movement_number || mov.notes || '—';
}
function getMovResponsable(mov: any): string {
    return mov.borrower_name || mov.responsable || mov.name || mov.recibidoPor || mov.authorized_by || '—';
}
function formatFecha(raw: string): string {
    if (!raw) return '—';
    // 'YYYY-MM-DD' se parsea como medianoche UTC → en UTC-4 corre un día atrás.
    const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-BO');
}
function getCompCode(comp: any): string   { return comp.tool_code   || comp.code   || '—'; }
function getCompName(comp: any): string   { return comp.tool_name   || comp.name   || comp.herramienta_nombre || '—'; }
function getCompStatus(comp: any): string { return comp.tool_status || comp.status || '—'; }
function getLoanBorrower(loan: any): string { return loan.borrower_name || loan.responsable || '—'; }
function getLoanDate(loan: any): string     { return formatFecha(loan.loan_date || loan.fecha || ''); }
function getLoanWO(loan: any): string       { return loan.work_order_number || loan.loan_number || '—'; }
function getLoanReturn(loan: any): string   { return formatFecha(loan.expected_return_date || loan.return_date || ''); }

/** Valor de campo crudo: '—' si viene vacío. */
function esc(v: unknown): string {
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
}

/** Grilla de campos "Etiqueta / Valor" según el tipo de ítem. */
function buildCampos(item: UnifiedItem): [string, string][] {
    const base: [string, string][] = [
        ['Código', item.codigo],
        ['Nombre', item.nombre],
    ];

    if (item.tipo === 'HERRAMIENTA') {
        return [
            ...base,
            ['Marca', esc(item.marca)], ['Part N°', esc(item.partNumber)], ['Serial N°', esc(item.serialNumber)],
            ['Categoría', esc(item.categoria)],
            ['Criticidad', esc(item.nivelCriticidad)], ['Fabricación', esc(item.fabricacion)],
            ['Ubicación', item.ubicacion], ['Stock', `${item.stockActual} ${item.unidad ?? ''}`.trim()],
            ['Notas', esc(item.notas)],
        ];
    }

    if (item.tipo === 'KIT') {
        return [
            ...base,
            ['Categoría', esc(item.categoria)], ['Estado', item.estado], ['Responsable', esc(item.responsable)],
            ['Ubicación', item.ubicacion], ['Total componentes', String(item.totalComponentes ?? 0)],
            ['Descripción', esc(item.descripcion)],
        ];
    }

    // MISCELANEO
    return [
        ...base,
        ['Tipo', esc(item.tipoItem)], ['Marca', esc(item.marca)], ['Part N°', esc(item.partNumber)],
        ['Unidad', esc(item.unidad)], ['Ubicación', item.ubicacion],
        ['Stock actual', `${item.stockActual} ${item.unidad ?? ''}`.trim()],
        ['Stock mínimo', item.stockMinimo != null ? String(item.stockMinimo) : '—'],
        ['Stock máximo', item.stockMaximo != null ? String(item.stockMaximo) : '—'],
        ['Descripción', esc(item.descripcion)],
    ];
}

/** Payload para ACTreportes::generarPDFFichaInventario (RReporteFichaInventario, TCPDF real). */
export function buildFichaPdfPayload(item: UnifiedItem, detail: FichaPdfDetail): FichaPdfPayload {
    const tipoLabel: Record<string, string> = { HERRAMIENTA: 'HERRAMIENTA', KIT: 'KIT', MISCELANEO: 'MISCELÁNEO' };
    const tablas: FichaPdfPayload['tablas'] = [];

    if (item.tipo === 'KIT' && detail.components.length > 0) {
        tablas.push({
            titulo: 'Componentes del kit',
            columnas: [
                { header: '#',           w: 6,  align: 'center' },
                { header: 'Código',      w: 16 },
                { header: 'Herramienta' },
                { header: 'Estado',      w: 16 },
            ],
            filas: detail.components.map((c, i) => [i + 1, getCompCode(c), getCompName(c), getCompStatus(c)]),
        });
    }

    if (item.tipo === 'KIT' && detail.loans.length > 0) {
        tablas.push({
            titulo: 'Últimos préstamos',
            columnas: [
                { header: 'Fecha',      w: 14, align: 'center' },
                { header: 'N° Orden',   w: 18 },
                { header: 'Prestado a' },
                { header: 'Devolución', w: 14, align: 'center' },
            ],
            filas: detail.loans.slice(0, 10).map(l => [getLoanDate(l), getLoanWO(l), getLoanBorrower(l), getLoanReturn(l)]),
        });
    } else if (item.tipo !== 'KIT' && detail.movements.length > 0) {
        tablas.push({
            titulo: 'Últimos movimientos',
            columnas: [
                { header: 'Fecha',       w: 12, align: 'center' },
                { header: 'Tipo',        w: 12, align: 'center' },
                { header: 'Descripción' },
                { header: 'Responsable', w: 24 },
            ],
            filas: detail.movements.slice(0, 10).map(m => [
                formatFecha(m.fecha || m.date || ''), getMovTipo(m), getMovDescripcion(m), getMovResponsable(m),
            ]),
        });
    }

    return {
        subtitulo: tipoLabel[item.tipo] ?? item.tipo,
        campos: buildCampos(item),
        tablas,
    };
}
