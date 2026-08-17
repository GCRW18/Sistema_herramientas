import { Injectable } from '@angular/core';

export interface EnvioBasePdfItem {
    descripcion: string;
    pn: string;
    sn: string;
}

export interface EnvioBasePdfData {
    nroNota: string;
    origen: string;
    destino: string;
    fechaEnvio: string;
    responsable: string;
    recibe: string;
    tipoEnvio: string;
    fechaEsperadaRetorno: string;
    nroDocumento: string;
    nroVuelo: string;
    aeronave: string;
    observaciones: string;
    items: EnvioBasePdfItem[];
}

/**
 * PDF de "Registro de Herramientas en Otras Bases" — formato oficial calcado de
 * "Sistema Herramientas con Macros/Formularios.xlsx", hoja "ENV HH BASES". El código
 * de documento en la fuente está incompleto ("MOM-", sin número asignado, igual que
 * PRESTAMO A TERCEROS 2) — se imprime tal cual. A diferencia de los demás formularios
 * calcados, este no tiene estado "devuelto": el retorno de base (RB) puede juntar
 * ítems de varias notas de envío distintas en una sola impresión (mismo problema que
 * la devolución en lote de Terceros), así que no se fuerza al formato de una sola
 * nota — ver _pdfRetorno()/_abrirPdf() en retorno-traspaso.component.ts, que atiende
 * tanto RB como RTR con su propia tabla multi-nota, solo restyleada visualmente.
 * Las columnas FECHA RETORNO / FIRMA ALMACÉN siempre se imprimen en blanco para
 * completar a mano cuando la herramienta vuelva.
 *
 * Punto único usado por los 2 call-sites reales de la nota de envío: EnvioDialogComponent
 * (recién guardado) y la reimpresión desde historial en retorno-traspaso.component.ts.
 */
@Injectable({ providedIn: 'root' })
export class EnvioBasePdfService {
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

    async generarPdf(data: EnvioBasePdfData): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();

        const origen      = data.origen || '---';
        const destino     = data.destino || '---';
        const fechaEnvio  = data.fechaEnvio || '---';
        const responsable = data.responsable || '---';
        const recibe      = data.recibe || '---';
        const tipoEnvio   = data.tipoEnvio || 'EVENTUAL';
        const observaciones = data.observaciones || '---';
        const fechaRetornoEsperada = tipoEnvio === 'PERMANENTE' ? (data.fechaEsperadaRetorno || '---') : 'No aplica (Eventual)';
        const vueloAeronave = (data.nroVuelo || data.aeronave)
            ? `${data.nroVuelo || '---'} / ${data.aeronave || '---'}` : '---';

        const filas = data.items.map((it, i) => `
            <tr>
                <td class="tc">${i + 1}</td>
                <td>${it.descripcion || '---'}</td>
                <td class="mono">${it.pn || '---'}</td>
                <td class="mono">${it.sn || '---'}</td>
                <td class="tc" style="font-size:8.5px">${fechaEnvio}</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Registro de Herramientas en Otras Bases ${data.nroNota}</title>
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
  .code-cell { width: 20%; text-align: center; padding: 0; }
  .code-cell .mgh { font-size: 15px; font-weight: 900; padding: 6px 0; border-bottom: 1px solid #000; }
  .code-cell .rev-fecha { display: flex; font-size: 9px; font-weight: 700; }
  .code-cell .rev-fecha > div { flex: 1; padding: 3px 0; }
  .code-cell .rev-fecha > div:first-child { border-right: 1px solid #000; }

  table.meta-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.meta-table td { border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; height: 20px; }
  table.meta-table td b { font-weight: 900; }
  .nnota-cell { text-align: center; font-weight: 900; }

  .detalle-bar { background: #fff; border: 2px solid #000; border-top: none; text-align: center; font-weight: 900; font-size: 11px; text-transform: uppercase; padding: 3px; }

  table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.items th { border: 1px solid #000; background: #e5e7eb; font-size: 7.7px; font-weight: 900; text-transform: uppercase; padding: 4px 2px; }
  table.items td { border: 1px solid #000; padding: 4px 3px; font-size: 8.7px; min-height: 16px; }
  table.items tbody tr { height: 22px; }
  .tc { text-align: center; }
  .mono { font-family: monospace; }

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
      <h1>Registro de Herramientas en Otras Bases</h1>
    </td>
    <td class="code-cell">
      <div class="mgh">MOM-</div>
      <div class="rev-fecha"><div>REV. 0</div><div>2016-10-25</div></div>
    </td>
  </tr>
</table>

<table class="meta-table">
  <tr>
    <td style="width:16%"><b>ORIGEN:</b></td><td style="width:26%">${origen}</td>
    <td style="width:16%"><b>DESTINO:</b></td><td style="width:22%">${destino}</td>
    <td rowspan="4" class="nnota-cell" style="width:20%"><div style="font-size:8px;font-weight:400">N° NOTA</div><div style="font-size:12px">${data.nroNota}</div></td>
  </tr>
  <tr>
    <td><b>FECHA DE ENVÍO:</b></td><td>${fechaEnvio}</td>
    <td><b>TIPO ENVÍO:</b></td><td>${tipoEnvio}</td>
  </tr>
  <tr>
    <td><b>RESPONSABLE / ENVÍA:</b></td><td>${responsable}</td>
    <td><b>RECIBE EN DESTINO:</b></td><td>${recibe}</td>
  </tr>
  <tr>
    <td><b>FECHA RETORNO ESPERADA:</b></td><td>${fechaRetornoEsperada}</td>
    <td><b>N° VUELO / AERONAVE:</b></td><td>${vueloAeronave}</td>
  </tr>
</table>
${data.nroDocumento || data.observaciones ? `
<table class="meta-table">
  <tr>
    <td style="width:16%"><b>N° DOCUMENTO:</b></td><td style="width:34%">${data.nroDocumento || '---'}</td>
    <td style="width:16%"><b>OBSERVACIONES:</b></td><td style="width:34%">${observaciones}</td>
  </tr>
</table>` : ''}

<div class="detalle-bar">DETALLE</div>
<table class="items">
  <thead><tr>
    <th style="width:4%">ITEM</th>
    <th style="width:25%">DESCRIPCIÓN</th><th style="width:13%">PART NUMBER</th><th style="width:13%">SERIAL NUMBER</th>
    <th style="width:11%">FECHA DE ENVÍO</th><th style="width:11%">FIRMA ALMACÉN</th>
    <th style="width:11%">FECHA RETORNO</th><th style="width:11%">FIRMA ALMACÉN</th>
  </tr></thead>
  <tbody>${filas || '<tr><td colspan="8" class="tc">Sin ítems</td></tr>'}</tbody>
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
