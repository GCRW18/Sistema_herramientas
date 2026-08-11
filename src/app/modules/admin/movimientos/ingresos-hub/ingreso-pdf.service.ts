import { Injectable } from '@angular/core';

export interface IngresoPdfItem {
    codigo: string;
    pn: string;
    proveedor: string;
    factura: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    /** Ya formateada (dd/mm/yyyy) o '' si no aplica. */
    fechaVencimiento: string;
    /** Columna A del Excel: E = Exterior, L = Local. */
    origenAB: string;
    /** Columna B del Excel: C = Consumible, H = Herramienta, N = No Aeronáutico. */
    tipoAB: string;
    lote: string;
}

export interface IngresoPdfData {
    nroNota: string;
    fechaIngreso: string;
    observaciones: string;
    /** ENTREGUE CONFORME — lado Abastecimientos / proveedor. */
    entregadoPor: string;
    /** RECIBI CONFORME ALMACEN HERRAMIENTAS. */
    recibidoPor: string;
    items: IngresoPdfItem[];
}

/**
 * PDF de "Nota de Ingreso de Materiales, Herramientas y Equipos" (MGH-116) — formato
 * oficial calcado de "Sistema Herramientas con Macros/Formularios.xlsx", hoja "INGRESOS".
 * Único punto de generación para el flujo de Compra/Nueva Herramienta de ingresos-hub
 * (ver `_abrirImpresionIngreso` justo después de guardar, y `pdfHistorialItem` al
 * reimprimir un registro tipo COMPRA desde el historial). Alcance de esta pasada:
 * solo Compra — Ajuste Ingreso sigue con su propio layout (ya calcado aparte contra la
 * hoja "AJUSTE INGRESO"), fuera de esta consolidación.
 */
@Injectable({ providedIn: 'root' })
export class IngresoPdfService {
    private _logoBoaDataUri: Promise<string> | null = null;

    /** Columna A: E = Exterior, L = Local (deriva de manufacture_origin / "fabricación"). */
    static origenAB(fabricacion?: string | null): string {
        return (fabricacion || '').toUpperCase() === 'INTERNACIONAL' ? 'E' : 'L';
    }

    /** Columna B: C = Consumible, H = Herramienta, N = No Aeronáutico (deriva del tipo/categoría). */
    static tipoAB(tipoCode?: string | null): string {
        const t = (tipoCode || '').toUpperCase();
        if (t.includes('CONSUM')) return 'C';
        if (t.includes('NO_AERO') || t.includes('NO AERO')) return 'N';
        return 'H';
    }

    private _loadLogoBoaDataUri(): Promise<string> {
        if (!this._logoBoaDataUri) {
            this._logoBoaDataUri = fetch('/images/logo-boa.png')
                .then(r => r.blob())
                .then(blob => new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload  = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                }))
                .catch(() => '');
        }
        return this._logoBoaDataUri;
    }

    async generarPdf(data: IngresoPdfData): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();
        const fecha   = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const fechaIngreso  = data.fechaIngreso  || '---';
        const observaciones = data.observaciones || '---';
        const entregadoPor  = data.entregadoPor  || '---';
        const recibidoPor   = data.recibidoPor   || '---';

        const filas = data.items.map((it, idx) => `
            <tr>
                <td class="tc">${idx + 1}</td>
                <td class="mono">${it.codigo || '---'}</td>
                <td class="mono">${it.pn || '---'}</td>
                <td>${it.proveedor || '---'}</td>
                <td>${it.factura || '---'}</td>
                <td>${it.descripcion || '---'}</td>
                <td class="tc">${it.unidad || '---'}</td>
                <td class="tc">${it.cantidad}</td>
                <td class="tc" style="font-size:8.5px">${it.fechaVencimiento || '---'}</td>
                <td class="tc">${it.origenAB}</td>
                <td class="tc">${it.tipoAB}</td>
                <td class="mono">${it.lote || '---'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Nota de Ingreso ${data.nroNota}</title>
<style>
  @page { size: A4 landscape; margin: 8mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }

  table.head-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 6px; }
  table.head-table td { border: 1px solid #000; padding: 4px 8px; vertical-align: middle; }
  .logo-cell { width: 18%; text-align: center; padding: 6px 8px; }
  .logo-cell img { max-width: 100%; max-height: 34px; }
  .logo-cell .oam { font-size: 8px; font-weight: 900; margin-top: 2px; }
  .title-cell { width: 62%; text-align: center; }
  .title-cell h1 { font-size: 12.5px; font-weight: 900; text-transform: uppercase; }
  .code-cell { width: 20%; text-align: center; padding: 0; }
  .code-cell .mgh { font-size: 15px; font-weight: 900; padding: 6px 0; border-bottom: 1px solid #000; }
  .code-cell .rev-fecha { display: flex; font-size: 9px; font-weight: 700; }
  .code-cell .rev-fecha > div { flex: 1; padding: 3px 0; }
  .code-cell .rev-fecha > div:first-child { border-right: 1px solid #000; }

  table.meta-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.meta-table td { border: 1px solid #000; padding: 4px 8px; font-size: 9.5px; height: 22px; }
  table.meta-table td b { font-weight: 900; }

  table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.items th { border: 1px solid #000; background: #e5e7eb; font-size: 7.5px; font-weight: 900; text-transform: uppercase; padding: 4px 2px; }
  table.items td { border: 1px solid #000; padding: 4px 3px; font-size: 8.5px; min-height: 16px; }
  table.items tbody tr { height: 20px; }
  .tc { text-align: center; }
  .mono { font-family: monospace; }

  table.obs-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.obs-table td { border: 1px solid #000; padding: 5px 8px; font-size: 9.5px; min-height: 24px; }
  table.obs-table .lbl { font-weight: 900; white-space: nowrap; width: 1%; }

  table.foot-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; }
  table.foot-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 9.5px; text-align: center; }
  .firma-lbl { font-weight: 900; }
  .firma-line { border-bottom: 1px solid #000; height: 26px; margin-top: 12px; }
  .firma-sub { font-size: 8.5px; font-weight: 700; margin-top: 2px; }
  .firma-cargo { font-size: 8px; margin-top: 4px; }

  .legend { font-size: 7px; margin-top: 4px; display: flex; gap: 16px; }

  @media print { body { padding: 0; } }
</style>
<script>window.onload = () => window.print();</script>
</head><body>

<table class="head-table">
  <tr>
    <td class="logo-cell" rowspan="2">
      ${logoUri ? `<img src="${logoUri}" alt="BoA">` : '<div style="font-weight:900;font-size:16px">BoA</div>'}
      <div class="oam">BoAMM &nbsp; OAM145# N-114</div>
    </td>
    <td class="title-cell" rowspan="2">
      <h1>Nota de Ingreso de Materiales, Herramientas y Equipos<br>Para Servicio en Aeronaves</h1>
    </td>
    <td class="code-cell">
      <div class="mgh">MGH-116</div>
      <div class="rev-fecha"><div>REV. 0</div><div>${fecha}</div></div>
    </td>
  </tr>
</table>

<table class="meta-table">
  <tr>
    <td style="width:50%"><b>FECHA INGRESO:</b> ${fechaIngreso}</td>
    <td style="width:50%"><b>N° NOTA INGRESO:</b> ${data.nroNota}</td>
  </tr>
</table>

<table class="items">
  <thead><tr>
    <th style="width:3%">IT</th><th style="width:9%">CÓDIGO BOA</th><th style="width:9%">PART NUMBER</th>
    <th style="width:12%">PROVEEDOR</th><th style="width:8%">Nro FACTURA</th><th style="width:20%">DESCRIPCIÓN</th>
    <th style="width:6%">UNIDAD</th><th style="width:7%">CANTIDAD INGRESO</th><th style="width:9%">FECHA VENCIMIENTO</th>
    <th style="width:3%">A</th><th style="width:3%">B</th><th style="width:11%">Nro LOTE</th>
  </tr></thead>
  <tbody>${filas || '<tr><td colspan="12" class="tc">Sin ítems</td></tr>'}</tbody>
</table>

<table class="obs-table">
  <tr><td class="lbl">OBSERVACIONES:</td><td>${observaciones}</td></tr>
</table>

<table class="foot-table">
  <tr>
    <td style="width:34%">
      <div class="firma-lbl">ENTREGUE CONFORME:</div>
      <div class="firma-line"></div>
      <div class="firma-sub">Firma Abastecimientos — ${entregadoPor}</div>
      <div class="firma-cargo">Cargo:</div>
    </td>
    <td style="width:32%">
      <div class="firma-lbl">VISTO BUENO</div>
      <div class="firma-line"></div>
    </td>
    <td style="width:34%">
      <div class="firma-lbl">RECIBI CONFORME ALMACÉN HERRAMIENTAS:</div>
      <div class="firma-line"></div>
      <div class="firma-sub">Firma Almacén Herramientas — ${recibidoPor}</div>
      <div class="firma-cargo">Cargo:</div>
    </td>
  </tr>
</table>
<div class="legend">
  <span><b>COLUMNA A:</b> E = Exterior ; L = Local</span>
  <span><b>COLUMNA B:</b> C = Consumible ; H = Herramienta ; N = No Aeronáutico</span>
</div>

</body></html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
}
