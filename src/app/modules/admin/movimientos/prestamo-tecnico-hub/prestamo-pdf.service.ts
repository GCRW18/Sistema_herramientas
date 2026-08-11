import { Injectable } from '@angular/core';

export interface PrestamoPdfItem {
    codigo: string;
    pn: string;
    sn: string;
    cantidad: number;
    unidad: string;
    descripcion: string;
    listaContenido: string;
    fechaCalibracion: string;
    estado: string;
    obs: string;
    /** Solo se completan si el préstamo ya tiene devolución registrada. */
    condicionDevolucion?: string;
    obsDevolucion?: string;
}

export interface PrestamoPdfData {
    nroPrestamo: string;
    nroDevolucion?: string;
    solicitante: string;
    licencia: string;
    matriculaAeronave: string;
    fechaHoraPrestamo: string;
    unidadDestino: string;
    ordenTrabajo: string;
    trabajoEspecial: boolean;
    observaciones: string;
    entregadoPor: string;
    items: PrestamoPdfItem[];
    /** true cuando ya se registró la devolución (llena la sección DATOS DEVOLUCION). */
    devuelto: boolean;
    fechaHoraDevolucion?: string;
    recibioAlmacen?: string;
}

/**
 * PDF de "Nota de Préstamo - Devolución" (MGH-100) — formato oficial calcado de
 * "Sistema Herramientas con Macros/Formularios.xlsx", hoja "PRESTAMO - DEVOLUCION".
 * Punto único que reemplaza las 4 implementaciones casi duplicadas que existían en
 * form-prestamo-dialog, form-devolucion-dialog y prestamo-tecnico-hub (préstamo +
 * devolución), mismo criterio que _pdfTraspasoOficial() en retorno-traspaso.component.ts.
 */
@Injectable({ providedIn: 'root' })
export class PrestamoPdfService {
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

    async generarPdf(data: PrestamoPdfData): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();
        const fecha   = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const solicitante       = data.solicitante || '---';
        const licencia          = data.licencia || '---';
        const matricula         = data.matriculaAeronave || '---';
        const fechaHoraPrestamo = data.fechaHoraPrestamo || '---';
        const unidadDestino     = data.unidadDestino || '---';
        const ordenTrabajo      = data.ordenTrabajo || '---';
        const trabajoEspecial   = data.trabajoEspecial ? 'SÍ' : 'NO';
        const observaciones     = data.observaciones || '---';
        const entregadoPor      = data.entregadoPor || '---';

        const nroNota = data.devuelto
            ? `<div style="font-size:8px;font-weight:400">N° PRÉSTAMO</div><div>${data.nroPrestamo}</div><div style="font-size:8px;font-weight:400;margin-top:6px">N° DEVOLUCIÓN</div><div>${data.nroDevolucion || '---'}</div>`
            : `<div style="font-size:8px;font-weight:400">N° NOTA</div><div>${data.nroPrestamo}</div>`;

        const filasPrestamo = data.items.map(it => `
            <tr>
                <td class="mono">${it.codigo || '---'}</td>
                <td class="mono">${it.pn || '---'}</td>
                <td class="mono">${it.sn || '---'}</td>
                <td class="tc">${it.cantidad}</td>
                <td class="tc">${it.unidad || '---'}</td>
                <td>${it.descripcion || '---'}</td>
                <td>${it.listaContenido || '---'}</td>
                <td class="tc" style="font-size:8.5px">${it.fechaCalibracion || '---'}</td>
                <td class="tc">${it.estado || '---'}</td>
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
<title>Nota de Préstamo - Devolución ${data.nroPrestamo}</title>
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

  table.foot-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; }
  table.foot-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 9.5px; }
  .firma-lbl { font-weight: 900; }
  .firma-line { border-bottom: 1px solid #000; height: 30px; margin-top: 14px; }
  .firma-sub { text-align: center; font-size: 8.5px; font-weight: 700; margin-top: 2px; }
  .nota-importante { font-size: 8.5px; }
  .nota-importante ul { margin: 4px 0 0 12px; }
  .nota-importante li { margin-bottom: 4px; }

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
      <h2>Herramientas, Bancos de Prueba y Equipos de Apoyo</h2>
    </td>
    <td class="code-cell">
      <div class="mgh">MGH-100</div>
      <div class="rev-fecha"><div>REV. 0</div><div>${fecha}</div></div>
    </td>
  </tr>
</table>

<table class="meta-table">
  <tr>
    <td style="width:16%"><b>NOMBRE DE SOLICITANTE:</b></td><td style="width:26%">${solicitante}</td>
    <td style="width:16%"><b>UNIDAD DE DESTINO:</b></td><td style="width:22%">${unidadDestino}</td>
    <td rowspan="4" class="nnota-cell" style="width:20%">${nroNota}</td>
  </tr>
  <tr>
    <td><b>LICENCIA:</b></td><td>${licencia}</td>
    <td><b>ORDEN DE TRABAJO:</b></td><td>${ordenTrabajo}</td>
  </tr>
  <tr>
    <td><b>MATRÍCULA AERONAVE:</b></td><td>${matricula}</td>
    <td><b>TRABAJO ESPECIAL:</b></td><td>${trabajoEspecial}</td>
  </tr>
  <tr>
    <td><b>FECHA Y HORA:</b></td><td>${fechaHoraPrestamo}</td>
    <td><b>OBSERVACIONES:</b></td><td>${observaciones}</td>
  </tr>
</table>

<div class="detalle-bar">DATOS PRÉSTAMO</div>
<table class="items">
  <thead><tr>
    <th style="width:9%">CÓDIGO</th><th style="width:9%">P/N ó MODELO</th><th style="width:9%">S/N</th>
    <th style="width:5%">CANT.</th><th style="width:6%">UND</th><th style="width:18%">DESCRIPCIÓN</th>
    <th style="width:14%">LISTA DE CONTENIDO</th><th style="width:10%">FECHA CALIBRACIÓN</th>
    <th style="width:8%">ESTADO</th><th style="width:12%">OBS</th>
  </tr></thead>
  <tbody>${filasPrestamo || '<tr><td colspan="10" class="tc">Sin ítems</td></tr>'}</tbody>
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
      <th>NOMBRE TÉC. O INSP.</th><th>FIRMA</th>
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
      <div class="firma-sub">Firma Téc. o Insp. — ${solicitante}</div>
    </td>
    <td style="width:34%" class="nota-importante">
      <b>NOTA IMPORTANTE:</b>
      <ul>
        <li>Las herramientas deben devolverse en las mismas condiciones en las que fueron prestadas.</li>
        <li>Cada herramienta prestada se encuentra en condición SERVICIABLE a menos que se indique lo contrario en la casilla de observaciones.</li>
        <li>En caso de avería, registrar en el formulario REPORTE DE DISCREPANCIA DE HERRAMIENTA. Solicitarlo al encargado del almacén de herramientas de turno.</li>
      </ul>
      La firma de la presente nota implica que se está en conformidad con toda la información detallada.
    </td>
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
