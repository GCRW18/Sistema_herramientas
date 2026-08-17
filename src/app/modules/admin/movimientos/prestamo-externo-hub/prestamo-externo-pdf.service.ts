import { Injectable } from '@angular/core';

export interface PrestamoExternoPdfItem {
    codigo: string;
    pn: string;
    sn: string;
    cantidad: number;
    descripcion: string;
    listaContenido: string;
    hrCosto: number;
    valorUsd: number;
    obs: string;
    /** Solo se completan si el préstamo ya tiene devolución registrada. */
    condicionDevolucion?: string;
    obsDevolucion?: string;
}

export interface PrestamoExternoPdfData {
    nroPrestamo: string;
    nroDevolucion?: string;
    /** NOMBRE SOLICITANTE — se reutiliza el contacto de la empresa tercera, no existe un campo de persona+CI dedicado. */
    solicitante: string;
    empresa: string;
    fechaHoraPrestamo: string;
    observaciones: string;
    /** ENTREGADO POR (Firma Almacén Herramientas) — funcionario BOA que autoriza/entrega. */
    entregadoPor: string;
    items: PrestamoExternoPdfItem[];
    /** true cuando ya se registró la devolución (llena la sección DATOS DEVOLUCIÓN). */
    devuelto: boolean;
    fechaHoraDevolucion?: string;
    recibioAlmacen?: string;
}

/**
 * PDF de "Nota de Préstamo - Devolución a Terceros" — formato oficial calcado de
 * "Sistema Herramientas con Macros/Formularios.xlsx", hoja "PRESTAMO A TERCEROS 2"
 * (confirmada como vigente frente a la variante "PRESTAMO A TERCEROS", que es un
 * formulario distinto de renta de equipo por horas). El código de documento en la
 * fuente está incompleto ("MOM-", sin número asignado) — se imprime tal cual.
 *
 * Punto único que reemplaza 3 de las 4 implementaciones casi duplicadas que existían
 * en prestamo-externo-hub (préstamo + reimpresión préstamo/devolución) y
 * form-prestamo-externo-dialog. El 4to call-site (form-devolucion-externo-dialog)
 * queda fuera: es una devolución en lote que puede mezclar ítems de varias notas de
 * préstamo distintas y no tiene equivalente en el Excel.
 */
@Injectable({ providedIn: 'root' })
export class PrestamoExternoPdfService {
    private _logoBoaDataUri: Promise<string> | null = null;

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

    async generarPdf(data: PrestamoExternoPdfData): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();

        const solicitante       = data.solicitante || '---';
        const empresa           = data.empresa || '---';
        const fechaHoraPrestamo = data.fechaHoraPrestamo || '---';
        const observaciones     = data.observaciones || '---';
        const entregadoPor      = data.entregadoPor || '---';
        const total = data.items.reduce((s, it) => s + (it.valorUsd || 0), 0);

        const nroNota = data.devuelto
            ? `<div style="font-size:8px;font-weight:400">N° PRÉSTAMO</div><div>${data.nroPrestamo}</div><div style="font-size:8px;font-weight:400;margin-top:6px">N° DEVOLUCIÓN</div><div>${data.nroDevolucion || '---'}</div>`
            : `<div style="font-size:8px;font-weight:400">N° NOTA</div><div>${data.nroPrestamo}</div>`;

        const filasPrestamo = data.items.map(it => `
            <tr>
                <td class="mono">${it.codigo || '---'}</td>
                <td class="mono">${it.pn || '---'}</td>
                <td class="mono">${it.sn || '---'}</td>
                <td class="tc">${it.cantidad}</td>
                <td>${it.descripcion || '---'}</td>
                <td>${it.listaContenido || '---'}</td>
                <td class="tc">$${(it.hrCosto || 0).toFixed(2)}</td>
                <td class="tc">$${(it.valorUsd || 0).toFixed(2)}</td>
                <td>${it.obs || '---'}</td>
            </tr>`).join('');

        const filasDevolucion = data.items.map(it => data.devuelto ? `
            <tr>
                <td class="tc" style="font-size:8.5px">${data.fechaHoraDevolucion || '---'}</td>
                <td colspan="2">${data.solicitante || '---'}</td>
                <td colspan="2">${data.recibioAlmacen || '---'}</td>
                <td class="tc" style="font-weight:700">${it.condicionDevolucion || '---'}</td>
                <td class="tc">---</td>
                <td>${it.obsDevolucion || '---'}</td>
            </tr>` : `
            <tr>
                <td style="height:22px">&nbsp;</td><td colspan="2">&nbsp;</td><td colspan="2">&nbsp;</td>
                <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Nota de Préstamo - Devolución a Terceros ${data.nroPrestamo}</title>
<style>
  @page { size: A4; margin: 8mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }

  table.head-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 6px; }
  table.head-table td { border: 1px solid #000; padding: 4px 8px; vertical-align: middle; }
  .logo-cell { width: 22%; text-align: center; padding: 6px 8px; }
  .logo-cell img { max-width: 100%; max-height: 34px; }
  .logo-cell .oam { font-size: 8px; font-weight: 900; margin-top: 2px; }
  .title-cell { width: 58%; text-align: center; }
  .title-cell h1 { font-size: 13px; font-weight: 900; text-transform: uppercase; }
  .title-cell h2 { font-size: 9.5px; font-weight: 900; text-transform: uppercase; margin-top: 2px; }
  .code-cell { width: 20%; text-align: center; padding: 0; }
  .code-cell .mgh { font-size: 15px; font-weight: 900; padding: 6px 0; border-bottom: 1px solid #000; }
  .code-cell .rev-fecha { display: flex; font-size: 9px; font-weight: 700; }
  .code-cell .rev-fecha > div { flex: 1; padding: 3px 0; }
  .code-cell .rev-fecha > div:first-child { border-right: 1px solid #000; }

  table.meta-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.meta-table td { border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; height: 20px; }
  table.meta-table td b { font-weight: 900; }
  .nnota-cell { text-align: center; font-weight: 900; }
  .nnota-cell .val { font-size: 12px; }

  .detalle-bar { background: #fff; border: 2px solid #000; border-top: none; text-align: center; font-weight: 900; font-size: 11px; text-transform: uppercase; padding: 3px; }

  table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.items th { border: 1px solid #000; background: #e5e7eb; font-size: 7.7px; font-weight: 900; text-transform: uppercase; padding: 4px 2px; }
  table.items td { border: 1px solid #000; padding: 4px 3px; font-size: 8.7px; min-height: 16px; }
  table.items tbody tr { height: 20px; }
  .tc { text-align: center; }
  .mono { font-family: monospace; }

  table.foot-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.foot-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 9.5px; }
  .firma-lbl { font-weight: 900; }
  .firma-line { border-bottom: 1px solid #000; height: 30px; margin-top: 14px; }
  .firma-sub { text-align: center; font-size: 8.5px; font-weight: 700; margin-top: 2px; }
  .nota-importante { font-size: 8.5px; }
  .nota-importante ul { margin: 4px 0 0 12px; }
  .nota-importante li { margin-bottom: 4px; }

  table.autoriza-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; }
  table.autoriza-table td { border: 1px solid #000; padding: 6px 8px; font-size: 9.5px; }
  .autoriza-line { display: inline-block; width: 260px; border-bottom: 1px solid #000; height: 26px; margin-left: 8px; vertical-align: bottom; }

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
      <h1>Nota de Préstamo - Devolución</h1>
      <h2>A Terceros</h2>
    </td>
    <td class="code-cell">
      <div class="mgh">MOM-</div>
      <div class="rev-fecha"><div>REV. 0</div><div>2016-10-13</div></div>
    </td>
  </tr>
</table>

<table class="meta-table">
  <tr>
    <td style="width:16%"><b>NOMBRE SOLICITANTE:</b></td><td style="width:26%">${solicitante}</td>
    <td style="width:16%"><b>OBSERVACIONES:</b></td><td style="width:22%">${observaciones}</td>
    <td rowspan="3" class="nnota-cell" style="width:20%">${nroNota}</td>
  </tr>
  <tr>
    <td><b>CI:</b></td><td>---</td>
    <td><b>PRECIO $US:</b></td><td>$${total.toFixed(2)}</td>
  </tr>
  <tr>
    <td><b>EMPRESA:</b></td><td>${empresa}</td>
    <td><b>FECHA Y HORA:</b></td><td>${fechaHoraPrestamo}</td>
  </tr>
</table>

<div class="detalle-bar">DATOS PRÉSTAMO</div>
<table class="items">
  <thead><tr>
    <th style="width:9%">CÓDIGO</th><th style="width:10%">P/N ó MODELO</th><th style="width:9%">S/N</th>
    <th style="width:5%">CANT.</th><th style="width:19%">DESCRIPCIÓN</th>
    <th style="width:16%">LISTA DE CONTENIDO</th><th style="width:8%">HR. $</th><th style="width:9%">VALOR EN$</th>
    <th style="width:15%">OBS</th>
  </tr></thead>
  <tbody>${filasPrestamo || '<tr><td colspan="9" class="tc">Sin ítems</td></tr>'}</tbody>
</table>

<div class="detalle-bar">DATOS DEVOLUCIÓN</div>
<table class="items">
  <thead>
    <tr>
      <th rowspan="2" style="width:9%">FECHA / HORA</th>
      <th colspan="2" style="width:22%">ENTREGUE CONFORME</th>
      <th colspan="2" style="width:22%">RECIBÍ CONFORME</th>
      <th rowspan="2" style="width:13%">CONDICIÓN DE DEVOLUCIÓN</th>
      <th rowspan="2" style="width:12%">NRO. REPORTE AVERÍA</th>
      <th rowspan="2" style="width:12%">OBS</th>
    </tr>
    <tr>
      <th>NOMBRE</th><th>FIRMA</th>
      <th>NOMBRE TÉC. ALM.</th><th>FIRMA</th>
    </tr>
  </thead>
  <tbody>${filasDevolucion || '<tr><td colspan="8" class="tc">Sin ítems</td></tr>'}</tbody>
</table>

<table class="foot-table">
  <tr>
    <td style="width:33%">
      <div class="firma-lbl">ENTREGADO POR:</div>
      <div class="firma-line"></div>
      <div class="firma-sub">Firma Almacén Herramientas — ${entregadoPor}</div>
    </td>
    <td style="width:33%">
      <div class="firma-lbl">RECIBIDO POR:</div>
      <div class="firma-line"></div>
      <div class="firma-sub">Firma ${empresa}</div>
    </td>
    <td style="width:34%" class="nota-importante">
      <b>NOTA IMPORTANTE:</b>
      <ul>
        <li>Para cada herramienta prestada, se encuentra detallada la condición en la que se está prestando en la casilla correspondiente.</li>
        <li>Las herramientas deben devolverse en las mismas condiciones en las que fueron prestadas.</li>
        <li>En caso de ocurrencia de avería, se deberá registrar la misma en el formulario REPORTE DE AVERÍA. Solicitar dicho formulario al encargado del almacén de herramientas de turno.</li>
      </ul>
      La firma de la presente nota implica que se está en conformidad con toda la información detallada.
    </td>
  </tr>
</table>
<table class="autoriza-table">
  <tr>
    <td><b>AUTORIZADO POR:</b><span class="autoriza-line"></span>&nbsp;&nbsp;<span style="font-size:8.5px;font-weight:700">Firma Autorizada BoA</span></td>
  </tr>
</table>

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
