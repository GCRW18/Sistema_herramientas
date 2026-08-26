import { Injectable } from '@angular/core';
import { TraspasoItem, ToolEnvioItem, MovimientoActivo } from './retorno-traspaso.types';

export interface RetornoPdfForm {
    fechaRetorno: string;
    nroDocumento: string;
    origenNombre: string;
    responsableRecibe: string;
    observaciones: string;
}

const CONDICION_LABEL: Record<string, string> = {
    BUENO: 'Bueno', DAÑADO: 'Dañado', REQUIERE_CALIBRACION: 'Req. Calibración', FALTANTE: 'Faltante'
};

/**
 * Acta genérica de RETORNO (base RB / traspaso RTR) + Reporte de Discrepancia (MGH-101) —
 * extraído de _pdfRetorno()/_abrirPdf()/_pdfDiscrepancia() en retorno-traspaso.component.ts
 * (código legacy, nunca migrado cuando el flujo de retorno se extrajo a RetornoDialogComponent)
 * para que el diálogo standalone pueda generar el PDF directamente al guardar, igual que
 * EnvioDialogComponent hace con EnvioBasePdfService.
 */
@Injectable({ providedIn: 'root' })
export class RetornoPdfService {
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

    /** Escribe el HTML en `win` si ya está abierta (evita el bloqueo de pop-ups del
     *  navegador: la ventana se abrió sincrónicamente en el gesto de clic del usuario,
     *  antes del guardado async) — si no hay ventana (bloqueada o no soportado), cae al
     *  patrón anterior de blob + <a target="_blank">. */
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

    async generarPdfRetorno(nro: string, tipoOrigen: 'BASE' | 'TRASPASO', items: TraspasoItem[], form: RetornoPdfForm, win?: Window | null): Promise<void> {
        const tipo = tipoOrigen === 'BASE' ? 'RETORNO DE BASE' : 'RETORNO DE TRASPASO';
        const filas = items.map((it, i) => `
            <tr><td style="text-align:center">${i + 1}</td><td>${it.codigo}</td>
            <td>${it.descripcion}</td><td>${it.pn || '---'}</td><td>${it.sn || '---'}</td>
            <td style="text-align:center">${it.cantidadRetorna} / ${it.cantidadEnviada}</td>
            <td style="font-weight:bold;text-align:center">${CONDICION_LABEL[it.condicion] || '---'}</td>
            <td>${it.observacionItem || '---'}</td></tr>`).join('');

        await this._abrirActa(nro, tipo, filas, [
            ['Fecha Retorno', form.fechaRetorno], ['Nro. Documento', form.nroDocumento || '---'],
            ['Base/Almacén Origen', form.origenNombre || '---'], ['Recibido por', form.responsableRecibe || '---'],
            ['Observaciones', form.observaciones || '---']
        ], [['#','3%'],['Código BOA','8%'],['Descripción','24%'],['P/N','13%'],['S/N','11%'],
            ['Cant. Ret/Env','10%'],['Condición','12%'],['Observación','19%']],
            [form.origenNombre || '---', form.responsableRecibe || '---'], win);
    }

    /** "RETORNO DE TRASPASO ÁREA" — retorno acotado a un solo traspaso técnico/área (mov singular). */
    async generarPdfRetornoArea(
        nro: string, items: TraspasoItem[],
        form: { fechaRetorno: string; recibeAlmacen: string; observaciones: string },
        mov: Pick<MovimientoActivo, 'movement_number' | 'destination_warehouse_name' | 'source_warehouse_name'>,
        win?: Window | null
    ): Promise<void> {
        const fecha   = new Date(form.fechaRetorno).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const origen  = mov.destination_warehouse_name || '---';
        const destino = mov.source_warehouse_name || '---';
        const recibe  = form.recibeAlmacen || '---';
        const movNro  = mov.movement_number || '---';
        const condLabel: Record<string, string> = {
            'BUENO': 'BUENO', 'DAÑADO': 'DAÑADO',
            'REQUIERE_CALIBRACION': 'REQUIERE CALIB.', 'FALTANTE': 'FALTANTE'
        };
        const filas = items.map((it, i) => `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${it.codigo || '---'}</td>
                <td>${it.descripcion || '---'}</td>
                <td>${it.pn || '---'}</td>
                <td>${it.sn || '---'}</td>
                <td style="text-align:center;font-weight:700">${it.cantidadRetorna} / ${it.cantidadEnviada}</td>
                <td style="font-weight:bold;text-align:center">${condLabel[it.condicion] || '---'}</td>
                <td>${it.observacionItem || '---'}</td>
            </tr>`).join('');

        await this._abrirActa(nro, 'RETORNO DE TRASPASO ÁREA', filas, [
            ['Traspaso Origen', movNro], ['Desde (Área / Almacén)', origen],
            ['Retorna a (Almacén)', destino], ['Fecha Retorno', fecha],
            ['Recibe en Almacén', recibe], ['Observaciones', form.observaciones || '---'],
        ], [['#','3%'],['Código BOA','8%'],['Descripción','22%'],['P/N','12%'],['S/N','12%'],
            ['Cant. Ret/Env','10%'],['Condición','12%'],['Obs. Ítem','21%']],
            [origen, recibe], win);
    }

    /** "DEVOLUCIÓN MGH-109" — devolución de un traspaso técnico (mov singular) al almacén de origen. */
    async generarPdfDevolucionTecnico(
        nro: string, items: TraspasoItem[],
        form: { fechaDevolucion: string; recibeAlmacen: string; nroDocumento: string; observaciones: string },
        mov: Pick<MovimientoActivo, 'movement_number' | 'received_by_name' | 'department'>,
        win?: Window | null
    ): Promise<void> {
        const condLabel: Record<string, string> = {
            BUENO: 'Bueno', DAÑADO: 'Dañado', REQUIERE_CALIBRACION: 'Req. Calibración', FALTANTE: 'Faltante'
        };
        const filas = items.map((item, i) => `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${item.codigo || '---'}</td>
                <td>${item.descripcion || '---'}</td>
                <td>${item.pn || '---'}</td>
                <td>${item.sn || '---'}</td>
                <td style="text-align:center;font-weight:700">${item.cantidadRetorna} / ${item.cantidadEnviada}</td>
                <td style="font-weight:bold;text-align:center">${condLabel[item.condicion] || '---'}</td>
                <td>${item.observacionItem || '---'}</td>
            </tr>`).join('');

        await this._abrirActa(nro, 'DEVOLUCIÓN MGH-109', filas, [
            ['Traspaso Original', mov.movement_number || '---'], ['Técnico / Responsable', mov.received_by_name || '---'],
            ['Unidad / Área', mov.department || '---'], ['Fecha Devolución', form.fechaDevolucion || '---'],
            ['Recibe en Almacén', form.recibeAlmacen || '---'], ['Nro. Documento', form.nroDocumento || '---'],
            ['Observaciones', form.observaciones || '---'],
        ], [['#','3%'],['Código BOA','9%'],['Descripción','22%'],['P/N','11%'],['S/N','10%'],
            ['Dev/Env','10%'],['Condición','10%'],['Observaciones','25%']],
            [mov.received_by_name || '---', form.recibeAlmacen || '---'], win);
    }

    /** "MGH-109 — NOTA DE TRASPASO" — lado de envío del flujo Traspaso Técnico (Devolución MGH-109 — RTR TÉC). */
    async generarPdfMGH109(
        nro: string,
        fv: { nombreCompletoInput?: string; nroLicencia?: string; fecha?: string; cargo?: string; base?: { codigo?: string; nombre?: string } | null; tipoTraspaso?: string; unidad?: string; observaciones?: string; responsableEntrega?: string },
        items: ToolEnvioItem[],
        win?: Window | null
    ): Promise<void> {
        const baseText = fv.base?.codigo
            ? `${fv.base.codigo} — ${fv.base.nombre}`
            : (fv.base?.nombre || '---');
        const nombreCompleto = fv.nombreCompletoInput || '---';

        const filas = items.map((item, i) => `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${item.codigo || '---'}</td>
                <td>${item.pn || '---'}</td>
                <td>${item.sn || '---'}</td>
                <td style="text-align:center">PZA</td>
                <td style="text-align:center;font-weight:700">${item.cantidad}</td>
                <td>${item.nombre || '---'}</td>
                <td>${item.notas || '---'}</td>
            </tr>`).join('');

        await this._abrirActa(nro, 'MGH-109 — NOTA DE TRASPASO', filas, [
            ['Nombre Completo', nombreCompleto], ['Nro. Licencia / CI', fv.nroLicencia || '---'],
            ['Fecha', fv.fecha || '---'], ['Cargo', fv.cargo || '---'],
            ['Base', baseText], ['Tipo de Traspaso', fv.tipoTraspaso || '---'],
            ['Unidad / Área', fv.unidad || '---'], ['Observaciones', fv.observaciones || '---'],
        ], [['#','3%'],['Código BOA','9%'],['P/N','11%'],['S/N','10%'],['Unid.','5%'],
            ['Cant.','6%'],['Descripción','30%'],['Observaciones','26%']],
            [fv.responsableEntrega || 'Almacén', nombreCompleto], win);
    }

    private async _abrirActa(
        nro: string, tipo: string, filas: string,
        campos: [string, string][],
        columnas: [string, string][],
        firmas: [string, string] | [string, string, string],
        win?: Window | null
    ): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();

        const metaFilas: string[] = [];
        for (let i = 0; i < campos.length; i += 2) {
            const [l0, v0] = campos[i];
            const par1 = campos[i + 1];
            metaFilas.push(`<tr>
                <td style="width:16%"><b>${l0.toUpperCase()}:</b></td><td style="width:${par1 ? '34%' : '84%'}" ${par1 ? '' : 'colspan="3"'}>${v0}</td>
                ${par1 ? `<td style="width:16%"><b>${par1[0].toUpperCase()}:</b></td><td style="width:34%">${par1[1]}</td>` : ''}
            </tr>`);
        }

        const thHtml = columnas.map(([l, w]) => `<th style="width:${w}">${l}</th>`).join('');

        const f0 = firmas[0], f1 = firmas[1], f2 = (firmas as any)[2];
        const firmaCeldas = [
            ['ENTREGA CONFORME', f0],
            ['RECIBE CONFORME', f1],
            ...(f2 ? [['AUTORIZADO POR', f2]] : []),
        ];
        const footHtml = firmaCeldas.map(([lbl, val]) => `
            <td style="width:${f2 ? '33%' : '50%'}">
              <div class="firma-lbl">${lbl}</div>
              <div class="firma-line"></div>
              <div class="firma-sub">${val}</div>
            </td>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${tipo} ${nro}</title>
<style>
  @page { size: A4; margin: 8mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }

  table.head-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 6px; }
  table.head-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: middle; }
  .logo-cell { width: 22%; text-align: center; }
  .logo-cell img { max-width: 100%; max-height: 34px; }
  .logo-cell .oam { font-size: 8px; font-weight: 900; margin-top: 2px; }
  .title-cell { width: 58%; text-align: center; }
  .title-cell h1 { font-size: 13px; font-weight: 900; text-transform: uppercase; }
  .code-cell { width: 20%; text-align: center; }
  .code-cell .nro { font-size: 13px; font-weight: 900; }

  table.meta-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.meta-table td { border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; height: 20px; }
  table.meta-table td b { font-weight: 900; }

  .detalle-bar { background: #fff; border: 2px solid #000; border-top: none; text-align: center; font-weight: 900; font-size: 11px; text-transform: uppercase; padding: 3px; }

  table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.items th { border: 1px solid #000; background: #e5e7eb; font-size: 7.7px; font-weight: 900; text-transform: uppercase; padding: 4px 2px; }
  table.items td { border: 1px solid #000; padding: 4px 3px; font-size: 8.7px; }
  table.items tbody tr { height: 20px; }

  table.foot-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; }
  table.foot-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 9.5px; }
  .firma-lbl { font-weight: 900; }
  .firma-line { border-bottom: 1px solid #000; height: 28px; margin-top: 14px; }
  .firma-sub { text-align: center; font-size: 8.5px; font-weight: 700; margin-top: 2px; }

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
      <h1>Acta de ${tipo}</h1>
    </td>
    <td class="code-cell"><div class="nro">N° ${nro}</div></td>
  </tr>
</table>

<table class="meta-table">${metaFilas.join('')}</table>

<div class="detalle-bar">DETALLE</div>
<table class="items">
  <thead><tr>${thHtml}</tr></thead>
  <tbody>${filas || `<tr><td colspan="${columnas.length}" style="text-align:center">Sin ítems</td></tr>`}</tbody>
</table>

<table class="foot-table"><tr>${footHtml}</tr></table>

</body></html>`;
        this._abrirBlob(html, win);
    }

    /** Reporte de Discrepancia (MGH-101) para ítems retornados DAÑADOS o FALTANTES. */
    async generarPdfDiscrepancia(nro: string, items: TraspasoItem[], form: RetornoPdfForm, win?: Window | null): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();
        const fecha = form.fechaRetorno
            ? new Date(form.fechaRetorno).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : new Date().toLocaleDateString('es-BO');
        const responsable = form.responsableRecibe || '---';
        const condLabel: Record<string, string> = {
            DAÑADO: 'DAÑADO / NO SERVICIABLE', FALTANTE: 'FALTANTE',
            BUENO: 'Bueno', REQUIERE_CALIBRACION: 'Req. Calibración'
        };
        const filas = items.map((it, i) => `
            <tr>
                <td class="tc">${i + 1}</td>
                <td class="mono">${it.codigo || '---'}</td>
                <td>${it.descripcion || '---'}</td>
                <td class="mono">${it.pn || '---'}</td>
                <td class="mono">${it.sn || '---'}</td>
                <td class="tc" style="font-weight:900;color:#dc2626">${condLabel[it.condicion] || it.condicion || '---'}</td>
                <td>${it.observacionItem || '---'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte de Discrepancia ${nro}</title>
<style>
  @page { size: A4; margin: 8mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }

  table.head-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 6px; }
  table.head-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: middle; }
  .logo-cell { width: 22%; text-align: center; }
  .logo-cell img { max-width: 100%; max-height: 34px; }
  .logo-cell .oam { font-size: 8px; font-weight: 900; margin-top: 2px; }
  .title-cell { width: 58%; text-align: center; }
  .title-cell h1 { font-size: 12.5px; font-weight: 900; text-transform: uppercase; }
  .code-cell { width: 20%; text-align: center; padding: 0; }
  .code-cell .mgh { font-size: 15px; font-weight: 900; padding: 6px 0; border-bottom: 1px solid #000; }
  .code-cell .rev-fecha { display: flex; font-size: 9px; font-weight: 700; }
  .code-cell .rev-fecha > div { flex: 1; padding: 3px 0; }
  .code-cell .rev-fecha > div:first-child { border-right: 1px solid #000; }

  .alert { background: #fef2f2; border: 2px solid #dc2626; border-top: none; padding: 6px 10px; margin-bottom: 0; font-size: 9px; font-weight: 700; color: #991b1b; line-height: 1.5; }

  table.meta-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.meta-table td { border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; height: 20px; }
  table.meta-table td b { font-weight: 900; }

  .detalle-bar { background: #fff; border: 2px solid #000; border-top: none; text-align: center; font-weight: 900; font-size: 11px; text-transform: uppercase; padding: 3px; }

  table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; margin-bottom: 0; }
  table.items th { border: 1px solid #000; background: #e5e7eb; font-size: 7.7px; font-weight: 900; text-transform: uppercase; padding: 4px 2px; }
  table.items td { border: 1px solid #000; padding: 4px 3px; font-size: 8.7px; }
  table.items tbody tr { height: 20px; }
  .tc { text-align: center; }
  .mono { font-family: monospace; }

  table.foot-table { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; }
  table.foot-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 9.5px; width: 33.3%; }
  .firma-lbl { font-weight: 900; }
  .firma-line { border-bottom: 1px solid #000; height: 26px; margin-top: 12px; }
  .firma-sub { text-align: center; font-size: 8.5px; font-weight: 700; margin-top: 2px; }

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
      <h1>Reporte Discrepancia de Herramienta</h1>
    </td>
    <td class="code-cell">
      <div class="mgh">MGH-101</div>
      <div class="rev-fecha"><div>REV. 0</div><div>2016-10-13</div></div>
    </td>
  </tr>
</table>

<div class="alert">⚠ Este documento certifica el retorno de herramientas en condición NO SERVICIABLE (Dañada/Faltante). Requiere investigación, acción correctiva y firmas de los responsables antes de archivarse.</div>

<table class="meta-table">
  <tr>
    <td style="width:20%"><b>NRO. DOCUMENTO RETORNO:</b></td><td style="width:30%">${nro}</td>
    <td style="width:20%"><b>FECHA DE RETORNO:</b></td><td style="width:30%">${fecha}</td>
  </tr>
  <tr>
    <td><b>RESPONSABLE:</b></td><td>${responsable}</td>
    <td><b>NRO. REFERENCIA (COMAT/TRP):</b></td><td>${form.nroDocumento || '---'}</td>
  </tr>
  <tr>
    <td><b>ORIGEN / BASE:</b></td><td>${form.origenNombre || '---'}</td>
    <td><b>OBSERVACIONES GENERALES:</b></td><td>${form.observaciones || '---'}</td>
  </tr>
</table>

<div class="detalle-bar">DETALLE DE HERRAMIENTAS CON NOVEDAD</div>
<table class="items">
  <thead><tr>
    <th style="width:4%">#</th><th style="width:9%">Código BOA</th><th style="width:27%">Descripción</th>
    <th style="width:12%">P/N</th><th style="width:10%">S/N</th><th style="width:13%">Condición</th>
    <th style="width:25%">Descripción de Avería / Novedades</th>
  </tr></thead>
  <tbody>${filas || '<tr><td colspan="7" class="tc">Sin ítems</td></tr>'}</tbody>
</table>

<table class="foot-table">
  <tr>
    <td>
      <div class="firma-lbl">ENTREGA CONFORME</div>
      <div class="firma-line"></div>
      <div class="firma-sub">${responsable}</div>
    </td>
    <td>
      <div class="firma-lbl">RECIBE — ALMACÉN</div>
      <div class="firma-line"></div>
      <div class="firma-sub">&nbsp;</div>
    </td>
    <td>
      <div class="firma-lbl">AUTORIZADO / JEFE ALMACÉN</div>
      <div class="firma-line"></div>
      <div class="firma-sub">&nbsp;</div>
    </td>
  </tr>
</table>

</body></html>`;
        this._abrirBlob(html, win);
    }
}
