import { UnifiedItem } from '../consultar-inventario.component';

export interface FichaPdfDetail {
    movements:  any[];
    components: any[];
    loans:      any[];
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
    // Se toma la parte de fecha del string tal cual.
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

/** Escapa `< > & "` para inyectar de forma segura en el HTML del PDF. */
function escHtml(v: unknown): string {
    return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** Valor de campo crudo: '—' si viene vacío. El escape se aplica al renderizar. */
function esc(v: unknown): string {
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
}

/** Grilla de campos "Etiqueta / Valor" según el tipo de ítem. */
function buildCampos(item: UnifiedItem): [string, string][] {
    const base: [string, string][] = [
        ['Código',    item.codigo],
        ['Nombre',    item.nombre],
    ];

    if (item.tipo === 'HERRAMIENTA') {
        // Mismo set de campos que la ficha en pantalla (alineado a
        // ingresos-hub/detalle-herramienta) — sin Estado/Condición/calibración/compra.
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

/** Construye el HTML standalone (A4 vertical) de la ficha individual, listo para window.print(). */
export function buildFichaPdfHtml(item: UnifiedItem, detail: FichaPdfDetail): string {
    const fecha = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora  = new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

    const tipoLabel: Record<string, string> = { HERRAMIENTA: 'HERRAMIENTA', KIT: 'KIT', MISCELANEO: 'MISCELÁNEO' };
    const campos = buildCampos(item);

    const camposHtml = campos.map(([label, value]) => `
        <div class="campo">
            <span class="campo-lbl">${escHtml(label)}</span>
            <span class="campo-val">${escHtml(value)}</span>
        </div>`).join('');

    let seccionExtra = '';
    if (item.tipo === 'KIT' && detail.components.length > 0) {
        seccionExtra = `
        <div class="section-title">Componentes del kit</div>
        <table>
            <thead><tr><th style="width:32px">#</th><th style="width:110px">Código</th><th>Herramienta</th><th style="width:100px">Estado</th></tr></thead>
            <tbody>
                ${detail.components.map((c, i) => `
                <tr>
                    <td style="text-align:center">${i + 1}</td>
                    <td style="font-family:monospace">${escHtml(getCompCode(c))}</td>
                    <td>${escHtml(getCompName(c))}</td>
                    <td>${escHtml(getCompStatus(c))}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    }

    let seccionMovimientos = '';
    if (item.tipo === 'KIT' && detail.loans.length > 0) {
        seccionMovimientos = `
        <div class="section-title">Últimos préstamos</div>
        <table>
            <thead><tr><th style="width:80px">Fecha</th><th style="width:110px">N° Orden</th><th>Prestado a</th><th style="width:80px">Devolución</th></tr></thead>
            <tbody>
                ${detail.loans.slice(0, 10).map(l => `
                <tr>
                    <td>${escHtml(getLoanDate(l))}</td>
                    <td style="font-family:monospace">${escHtml(getLoanWO(l))}</td>
                    <td>${escHtml(getLoanBorrower(l))}</td>
                    <td>${escHtml(getLoanReturn(l))}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    } else if (item.tipo !== 'KIT' && detail.movements.length > 0) {
        seccionMovimientos = `
        <div class="section-title">Últimos movimientos</div>
        <table>
            <thead><tr><th style="width:80px">Fecha</th><th style="width:80px">Tipo</th><th>Descripción</th><th style="width:130px">Responsable</th></tr></thead>
            <tbody>
                ${detail.movements.slice(0, 10).map(m => `
                <tr>
                    <td>${escHtml(formatFecha(m.fecha || m.date || ''))}</td>
                    <td>${escHtml(getMovTipo(m))}</td>
                    <td>${escHtml(getMovDescripcion(m))}</td>
                    <td>${escHtml(getMovResponsable(m))}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    }

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Ficha de Inventario — ${escHtml(item.codigo)} — ${fecha}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111827; background: #fff; }

  .page-header { background: #0F172A; color: #fff; padding: 16px 24px; display: flex; align-items: flex-start; justify-content: space-between; }
  .page-header-title { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.3px; }
  .page-header-sub   { font-size: 10px; font-weight: 700; background: #FFC501; color: #000; display: inline-block; padding: 2px 8px; border-radius: 4px; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; }
  .page-header-meta  { text-align: right; font-size: 10px; color: #94a3b8; line-height: 1.6; }
  .page-header-meta strong { color: #FFC501; }

  .campos-wrap { padding: 16px 24px; }
  .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .8px; color: #374151; margin: 14px 0 10px; display: flex; align-items: center; gap: 8px; }
  .section-title::after { content: ''; flex: 1; height: 2px; background: #e5e7eb; }

  .campos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
  .campo { border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; display: flex; flex-direction: column; gap: 2px; }
  .campo-lbl { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; color: #9ca3af; }
  .campo-val { font-size: 12px; font-weight: 700; color: #111827; word-break: break-word; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  thead th { background: #0F172A; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .5px; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
  tbody tr:nth-child(even) { background: #f9fafb; }

  .page-footer { margin: 16px 24px 0; padding: 10px 0; border-top: 2px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
  .page-footer p { font-size: 9px; color: #9ca3af; }

  @media print {
    @page { margin: 12mm 10mm; size: A4 portrait; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead { display: table-header-group; }
    tbody tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>

  <div class="page-header">
    <div>
      <div class="page-header-title">FICHA DE INVENTARIO</div>
      <span class="page-header-sub">${escHtml(tipoLabel[item.tipo])} · ${escHtml(item.codigo)}</span>
    </div>
    <div class="page-header-meta">
      <strong>Fecha:</strong> ${fecha} ${hora}<br>
      <strong>${escHtml(item.nombre)}</strong><br>
      <strong>Sistema de Herramientas — BOA</strong>
    </div>
  </div>

  <div class="campos-wrap">
    <div class="section-title">Datos generales</div>
    <div class="campos-grid">
      ${camposHtml}
    </div>

    ${seccionExtra}
    ${seccionMovimientos}
  </div>

  <div class="page-footer">
    <p>Sistema de Gestión de Herramientas · BOA</p>
    <p>Generado el ${fecha} a las ${hora}</p>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
}
