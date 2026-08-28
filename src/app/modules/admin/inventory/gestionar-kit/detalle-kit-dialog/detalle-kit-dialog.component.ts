import { Component, Inject, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';

@Component({
    selector: 'app-detalle-kit-dialog',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatIconModule, DragDropModule],
    encapsulation: ViewEncapsulation.None,
    templateUrl: './detalle-kit-dialog.component.html',
    styles: [`
        app-detalle-kit-dialog { display: block; }

        app-detalle-kit-dialog ::-webkit-scrollbar { width: 8px; }
        app-detalle-kit-dialog ::-webkit-scrollbar-track { background: #e7e5e4; border-left: 2px solid #000; }
        app-detalle-kit-dialog ::-webkit-scrollbar-thumb { background: #0F172A; border: 2px solid #000; border-radius: 4px; }
        app-detalle-kit-dialog ::-webkit-scrollbar-thumb:hover { background: #000; }
        .dark app-detalle-kit-dialog ::-webkit-scrollbar-track { background: #1e293b; }
        .dark app-detalle-kit-dialog ::-webkit-scrollbar-thumb { background: #fbbf24; border-color: #000; }
    `]
})
export class DetalleKitDialogComponent {
    private dialog = inject(MatDialog);

    constructor(
        public dialogRef: MatDialogRef<DetalleKitDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public kit: any
    ) {}

    // Abre la ficha de la herramienta (solo-lectura), misma que usa Ajuste de Herramienta
    // y el préstamo técnico. Los datos vienen de getKitComponents (HE_KCS_SEL) mapeados en
    // lista-kits.component.ts#verDetalle.
    async verHerramienta(item: any): Promise<void> {
        if (!item?.tool_id) return;
        const { DetalleHerramientaComponent } = await import(
            '../../../movimientos/ingresos-hub/detalle-herramienta/detalle-herramienta.component'
        );
        this.dialog.open(DetalleHerramientaComponent, {
            width: '800px', maxWidth: '96vw', height: '560px',
            panelClass: 'no-padding-dialog', hasBackdrop: true, autoFocus: false,
            data: {
                viewOnly: true,
                editItem: {
                    toolId:       item.tool_id,
                    codigoBoa:    item.codigoBoamm || item.codigo,
                    pn:           item.part_number,
                    sn:           item.serial_number,
                    descripcion:  item.descripcion,
                    marca:        item.brand,
                    tipo:         'HERRAMIENTA',
                    cantidad:     item.quantity,
                    um:           item.unit_of_measure,
                    estado:       item.tool_status,
                    obs:          item.tool_notes,
                    imagenMaster: item.location_photo,
                    warehouseId:  item.warehouse_id,
                    rackId:       item.rack_id,
                    levelId:      item.level_id,
                }
            }
        });
    }

    get categoriaClass(): string {
        const m: Record<string, string> = {
            'MANTENIMIENTO': 'bg-[#0F172A]',
            'LUBRICACION':   'bg-green-600',
            'FRENOS':        'bg-red-600',
            'CALIBRACION':   'bg-purple-600',
            'GENERAL':       'bg-gray-600'
        };
        return m[this.kit?.categoria ?? ''] ?? 'bg-gray-600';
    }

    get estadoClass(): string {
        const m: Record<string, string> = {
            'COMPLETO':       'bg-green-100 text-green-800 border-green-700',
            'INCOMPLETO':     'bg-yellow-100 text-yellow-800 border-yellow-700',
            'EN USO':         'bg-blue-100 text-blue-800 border-blue-700',
            'EN CALIBRACIÓN': 'bg-purple-100 text-purple-800 border-purple-700',
            'BAJA':           'bg-gray-100 text-gray-600 border-gray-400'
        };
        return m[this.kit?.estado ?? ''] ?? 'bg-gray-100 text-gray-600 border-gray-400';
    }

    cerrar(): void { this.dialogRef.close(); }

    // Imprime SOLO un listado en tabla (no la interfaz): abre una ventana con HTML limpio
    // — mismo patrón que consultar-inventario.
    imprimir(): void {
        const k = this.kit ?? {};
        const esc = (v: any) => String(v ?? '').replace(/[&<>"]/g,
            c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
        const now   = new Date();
        const fecha = now.toLocaleDateString('es-BO');
        const hora  = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
        const items: any[] = k.items ?? [];

        const rows = items.length
            ? items.map((it, i) => `
                <tr>
                  <td style="text-align:center">${i + 1}</td>
                  <td>${esc(it.descripcion || it.tool_name || '—')}</td>
                  <td>${esc(it.codigoBoamm || it.codigo || '—')}</td>
                  <td>${esc(it.part_number || '—')}</td>
                  <td>${esc(it.serial_number || '—')}</td>
                  <td>${esc(it.brand || '—')}</td>
                </tr>`).join('')
            : `<tr><td colspan="6" style="text-align:center;color:#6b7280">Sin herramientas registradas</td></tr>`;

        const meta = [
            ['Código',      k._raw?.code || k.codigo],
            ['Categoría',   k.categoria],
            ['Estado',      k.estado],
            ['Responsable', k.responsable],
            ['Ubicación',   k.ubicacion || 'Sin asignar'],
            ['Descripción', k.descripcion],
        ].filter(([, v]) => v)
         .map(([l, v]) => `<div><b>${l}:</b> ${esc(v)}</div>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Kit ${esc(k._raw?.code || k.codigo || '')} — ${fecha}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#111827; }
  .page-header { background:#0F172A; color:#fff; padding:14px 24px; display:flex; align-items:flex-start; justify-content:space-between; }
  .page-header-title { font-size:16px; font-weight:900; text-transform:uppercase; }
  .page-header-sub { font-size:10px; font-weight:700; background:#FFC501; color:#000; display:inline-block; padding:2px 8px; border-radius:4px; margin-top:4px; }
  .page-header-meta { text-align:right; font-size:10px; color:#94a3b8; line-height:1.6; }
  .meta { padding:12px 24px; font-size:11px; line-height:1.7; background:#f8f9fc; border-bottom:2px solid #e5e7eb; }
  .meta b { display:inline-block; min-width:90px; }
  .table-wrap { padding:16px 24px; }
  .section-title { font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.6px; color:#374151; margin-bottom:8px; }
  table { width:100%; border-collapse:collapse; }
  thead th { background:#0F172A; color:#fff; padding:7px 9px; text-align:left; font-size:9px; font-weight:900; text-transform:uppercase; }
  tbody td { border:1px solid #d1d5db; padding:5px 9px; }
  .page-footer { margin:0 24px; padding:10px 0; border-top:2px solid #e5e7eb; font-size:9px; color:#9ca3af; display:flex; justify-content:space-between; }
  @media print {
    @page { margin:12mm 10mm; size:A4 portrait; }
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    tbody tr { page-break-inside:avoid; }
  }
</style></head><body>
  <div class="page-header">
    <div>
      <div class="page-header-title">${esc(k.nombre || 'Kit')}</div>
      <span class="page-header-sub">Kit de herramientas</span>
    </div>
    <div class="page-header-meta">
      <div>Fecha: ${fecha} ${hora}</div>
      <div>Herramientas: ${items.length}</div>
      <div>Sistema de Herramientas — BOA</div>
    </div>
  </div>
  <div class="meta">${meta}</div>
  <div class="table-wrap">
    <div class="section-title">Listado de herramientas del kit</div>
    <table>
      <thead><tr><th style="width:32px;text-align:center">#</th><th>Herramienta</th><th style="width:110px">Código</th><th style="width:100px">P/N</th><th style="width:100px">S/N</th><th style="width:90px">Marca</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="page-footer">
    <span>Sistema de Gestión de Herramientas · BOA</span>
    <span>Generado el ${fecha} a las ${hora}</span>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

        const win = window.open('', '_blank', 'width=900,height=650');
        if (win) { win.document.write(html); win.document.close(); }
    }
}
