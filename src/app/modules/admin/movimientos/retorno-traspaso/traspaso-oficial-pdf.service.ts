import { Injectable } from '@angular/core';
import { ToolEnvioItem } from './retorno-traspaso.types';

export interface TraspasoOficialPdfForm {
    responsableTraspaso?: string;
    fechaTraspaso?: string;
    horaTraspaso?: string;
    baseDestino?: string;
    recibeEnDestino?: string;
    autorizadoPor?: string;
    tipoTraspasoLabel?: string;
    licenciaSolicitante?: string;
    cargoSolicitante?: string;
    cargoAutorizado?: string;
    departamentoDestino?: string;
    unidadDestino?: string;
    notas?: string;
}

/**
 * Nota de Traspaso — formato oficial MGH-109 (BoAMM OAM145# N-014), calcado del
 * formulario Excel/impreso real. Extraído de _pdfTraspasoOficial() en
 * retorno-traspaso.component.ts (código legacy, nunca migrado cuando el flujo de
 * traspaso se extrajo a TraspasoDialogComponent). Único call-site real hoy:
 * TraspasoDialogComponent.guardarTraspaso() (pestaña "Nuevo Traspaso — TRP").
 */
@Injectable({ providedIn: 'root' })
export class TraspasoOficialPdfService {
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

    /** Escribe el HTML en `win` si ya está abierta (evita el bloqueo de pop-ups: la
     *  ventana se abre sincrónicamente en el gesto de clic, antes del guardado async) —
     *  si no hay ventana (bloqueada o no soportado), cae al patrón de blob + <a target="_blank">. */
    private _abrirBlob(html: string, win?: Window | null): void {
        if (win && !win.closed) {
            win.document.open();
            win.document.write(html);
            win.document.close();
            return;
        }
        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    async generarPdf(nro: string, items: ToolEnvioItem[], form: TraspasoOficialPdfForm, win?: Window | null): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();
        const now     = new Date();
        const fecha   = new Date(form.fechaTraspaso || now).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora    = form.horaTraspaso || now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

        const solicitante = form.responsableTraspaso || '---';
        const destino     = form.baseDestino || '---';
        const recibe      = form.recibeEnDestino || '---';
        const autorizado  = form.autorizadoPor || '---';
        const tipoTrp     = form.tipoTraspasoLabel || '---';
        const licencia        = form.licenciaSolicitante || '---';
        const cargo           = form.cargoSolicitante     || '---';
        const cargoAutorizado = form.cargoAutorizado      || '---';
        const departamentoDestino = form.departamentoDestino || '---';
        const unidadDestino       = form.unidadDestino       || '---';

        const filas = items.map(it => `
            <tr>
                <td class="mono">${it.codigo || '---'}</td>
                <td class="mono">${it.pn || '---'}</td>
                <td class="mono">${it.sn || '---'}</td>
                <td class="tc">${it.unidad || '---'}</td>
                <td class="tc">${it.cantidad}</td>
                <td>${it.nombre || '---'}</td>
                <td>${it.listaContenido || '---'}</td>
                <td>${it.marca || '---'}</td>
                <td class="tc" style="font-size:8.5px">${it.fechaVencCal || '---'}</td>
                <td>${it.notas || '---'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Nota de Traspaso ${nro}</title>
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
  .title-cell h1 { font-size: 14px; font-weight: 900; text-transform: uppercase; }
  .title-cell h2 { font-size: 10.5px; font-weight: 900; text-transform: uppercase; margin-top: 2px; }
  .code-cell { width: 20%; text-align: center; padding: 0; }
  .code-cell .mgh { font-size: 15px; font-weight: 900; padding: 6px 0; border-bottom: 1px solid #000; }
  .code-cell .rev-fecha { display: flex; font-size: 9px; font-weight: 700; }
  .code-cell .rev-fecha > div { flex: 1; padding: 3px 0; }
  .code-cell .rev-fecha > div:first-child { border-right: 1px solid #000; }

  table.meta-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.meta-table td { border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; height: 20px; }
  table.meta-table td b { font-weight: 900; }
  .nnota-cell { text-align: center; font-weight: 900; }
  .nnota-cell .lbl { font-size: 8px; text-transform: uppercase; }
  .nnota-cell .val { font-size: 12px; }

  .detalle-bar { background: #fff; border: 2px solid #000; border-top: none; text-align: center; font-weight: 900; font-size: 11px; text-transform: uppercase; padding: 3px; }

  table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.items th { border: 1px solid #000; background: #e5e7eb; font-size: 8px; font-weight: 900; text-transform: uppercase; padding: 4px 3px; }
  table.items td { border: 1px solid #000; padding: 4px 3px; font-size: 9px; min-height: 16px; }
  table.items tbody tr { height: 22px; }
  .tc { text-align: center; }
  .mono { font-family: monospace; }

  table.foot-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; }
  table.foot-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 9.5px; }
  .firma-lbl { font-weight: 900; }
  .firma-line { border-bottom: 1px solid #000; height: 30px; margin-top: 14px; }
  .firma-sub { text-align: center; font-size: 8.5px; font-weight: 700; margin-top: 2px; }
  .nota-importante { font-size: 8.5px; }
  .nota-importante b { font-style: italic; }
  .nota-importante ul { margin: 4px 0 0 12px; }
  .nota-importante li { margin-bottom: 5px; }

  table.autoriza-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 14px; }
  table.autoriza-table td { border: 1px solid #000; padding: 6px 8px; font-size: 9.5px; }

  @media print { body { padding: 0; } }
</style>
<script>window.onload = () => window.print();</script>
</head><body>

<table class="head-table">
  <tr>
    <td class="logo-cell" rowspan="2">
      ${logoUri ? `<img src="${logoUri}" alt="BoA">` : '<div style="font-weight:900;font-size:16px">BoA</div>'}
      <div class="oam">BoAMM &nbsp; OAM145# N-014</div>
    </td>
    <td class="title-cell" rowspan="2">
      <h1>Nota de Traspaso</h1>
      <h2>Herramientas, Bancos de Prueba y Equipos de Apoyo</h2>
    </td>
    <td class="code-cell">
      <div class="mgh">MGH-109</div>
      <div class="rev-fecha"><div>REV. 0</div><div>${fecha}</div></div>
    </td>
  </tr>
</table>

<table class="meta-table">
  <tr>
    <td style="width:16%"><b>NOMBRE DE SOLICITANTE:</b></td><td style="width:26%">${solicitante}</td>
    <td style="width:16%"><b>GERENCIA DESTINO:</b></td><td style="width:22%">${destino}</td>
    <td rowspan="5" class="nnota-cell" style="width:20%"><div class="lbl">N° Nota</div><div class="val">${nro}</div></td>
  </tr>
  <tr>
    <td><b>LICENCIA:</b></td><td>${licencia}</td>
    <td><b>DEPARTAMENTO:</b></td><td>${departamentoDestino}</td>
  </tr>
  <tr>
    <td><b>CARGO:</b></td><td>${cargo}</td>
    <td><b>UNIDAD:</b></td><td>${unidadDestino}</td>
  </tr>
  <tr>
    <td><b>FECHA Y HORA:</b></td><td>${fecha} ${hora}</td>
    <td><b>TIPO TRASPASO:</b></td><td>${tipoTrp}</td>
  </tr>
  <tr>
    <td colspan="1"><b>OBSERVACIONES:</b></td><td colspan="3">${form.notas || '---'}</td>
  </tr>
</table>

<div class="detalle-bar">Detalle</div>
<table class="items">
  <thead><tr>
    <th style="width:8%">Código</th><th style="width:10%">P/N ó Modelo</th><th style="width:9%">S/N</th>
    <th style="width:6%">Unidad</th><th style="width:5%">Cant.</th><th style="width:14%">Nombre</th>
    <th style="width:14%">Lista de Contenido</th><th style="width:9%">Marca</th>
    <th style="width:10%">Fecha de Calibración</th><th style="width:15%">Obs</th>
  </tr></thead>
  <tbody>${filas || '<tr><td colspan="10" class="tc">Sin ítems</td></tr>'}</tbody>
</table>

<table class="foot-table">
  <tr>
    <td style="width:27%">
      <div class="firma-lbl">ENTREGADO POR:</div>
      <div class="firma-line"></div>
      <div class="firma-sub">Firma Almacén Herramientas — ${solicitante}</div>
    </td>
    <td style="width:27%">
      <div class="firma-lbl">RECIBIDO POR:</div>
      <div class="firma-line"></div>
      <div class="firma-sub">Firma recepción — ${recibe}</div>
    </td>
    <td style="width:46%" class="nota-importante">
      <b>NOTA IMPORTANTE:</b>
      <ul>
        <li>Las herramientas descritas en la presente nota se encuentran en condición SERVICIABLE, a menos que se indique lo contrario en la casilla de OBSERVACIONES.</li>
        <li>La firma de la presente nota implica que se está en conformidad con toda la información detallada.</li>
      </ul>
    </td>
  </tr>
</table>

<table class="autoriza-table">
  <tr>
    <td style="width:20%"><b>AUTORIZADO POR</b></td>
    <td style="width:16%"><b>Nombre:</b></td><td style="width:24%">${autorizado}</td>
    <td style="width:12%"><b>Cargo:</b></td><td style="width:28%">${cargoAutorizado}</td>
  </tr>
  <tr>
    <td></td>
    <td colspan="2"><div class="firma-line"></div><div class="firma-sub">Firma</div></td>
    <td colspan="2"></td>
  </tr>
</table>

</body></html>`;
        this._abrirBlob(html, win);
    }
}
