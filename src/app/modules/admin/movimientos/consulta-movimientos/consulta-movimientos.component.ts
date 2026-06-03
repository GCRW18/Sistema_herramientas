import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil, finalize } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';

// ── Tipos ──────────────────────────────────────────────────────────────────
type TipoFiltro = 'TODOS' | 'ENTRADA' | 'SALIDA' | 'ENVIO_BASE' | 'TRASPASO' | 'CALIBRACION' | 'PRESTAMO' | 'BAJA';

interface MovimientoItem {
    id: string;
    numero: string;
    tipo: 'ENTRADA' | 'SALIDA';
    subtipo: string;
    tipoRaw: string;
    fecha: string;
    hora: string;
    origen: string;
    destino: string;
    responsableEnvia: string;
    responsableRecibe: string;
    departamento: string;
    notas: string;
    estado: string;
}

// ── Componente ─────────────────────────────────────────────────────────────
@Component({
    selector: 'app-consulta-movimientos',
    standalone: true,
    imports: [
        CommonModule, RouterModule, ReactiveFormsModule, FormsModule,
        MatDialogModule, MatSnackBarModule, MatIconModule, MatTooltipModule
    ],
    templateUrl: './consulta-movimientos.component.html',
    styles: [`:host { display: block; height: 100%; }`]
})
export class ConsultaMovimientosComponent implements OnInit, OnDestroy {

    public dialogRef = inject(MatDialogRef<ConsultaMovimientosComponent>, { optional: true });
    private fb              = inject(FormBuilder);
    private router          = inject(Router);
    private snackBar        = inject(MatSnackBar);
    private movSvc          = inject(MovementService);
    private _unsub$         = new Subject<void>();

    // ── Form ─────────────────────────────────────────────────────────────
    filtroForm!: FormGroup;
    tipoActivo: TipoFiltro = 'TODOS';

    tiposFiltro: { value: TipoFiltro; label: string; icon: string }[] = [
        { value: 'TODOS',       label: 'Todos',       icon: 'list' },
        { value: 'ENTRADA',     label: 'Entradas',    icon: 'move_to_inbox' },
        { value: 'SALIDA',      label: 'Salidas',     icon: 'outbox' },
        { value: 'ENVIO_BASE',  label: 'Envío Base',  icon: 'send' },
        { value: 'TRASPASO',    label: 'Traspasos',   icon: 'transform' },
        { value: 'CALIBRACION', label: 'Calibración', icon: 'speed' },
        { value: 'PRESTAMO',    label: 'Préstamos',   icon: 'badge' },
        { value: 'BAJA',        label: 'Bajas',       icon: 'delete_forever' },
    ];

    gestionOptions: number[] = [];

    // ── Estado ───────────────────────────────────────────────────────────
    isSearching  = false;
    hasSearched  = false;

    // ── Datos ────────────────────────────────────────────────────────────
    allMovimientos: MovimientoItem[] = [];
    dataSource:     MovimientoItem[] = [];
    totalRecords = 0;
    pageIndex    = 0;
    pageSize     = 20;

    // ── Resumen ──────────────────────────────────────────────────────────
    get resumen() {
        const e = this.allMovimientos.filter(m => m.tipo === 'ENTRADA');
        const s = this.allMovimientos.filter(m => m.tipo === 'SALIDA');
        return { entradas: e.length, salidas: s.length, total: this.allMovimientos.length };
    }


    // ─────────────────────────────────────────────────────────────────────
    ngOnInit(): void {
        const today = new Date();
        const currentYear = today.getFullYear();
        for (let y = currentYear; y >= currentYear - 5; y--) this.gestionOptions.push(y);

        this.filtroForm = this.fb.group({
            busqueda:   [''],
            fechaDesde: [new Date(currentYear, 0, 1).toISOString().split('T')[0]],
            fechaHasta: [today.toISOString().split('T')[0]],
            gestion:    [currentYear]
        });
    }

    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    // ── Filtro tipo ───────────────────────────────────────────────────────

    setTipo(t: TipoFiltro): void {
        this.tipoActivo = t;
        if (this.hasSearched) this._aplicarFiltroLocal();
    }

    // ── Año rápido ────────────────────────────────────────────────────────

    setGestion(year: number): void {
        const esActual = year === new Date().getFullYear();
        this.filtroForm.patchValue({
            gestion:    year,
            fechaDesde: `${year}-01-01`,
            fechaHasta: esActual ? new Date().toISOString().split('T')[0] : `${year}-12-31`
        });
    }

    // ── Consultar ─────────────────────────────────────────────────────────

    consultar(): void {
        const f = this.filtroForm.value;
        this.isSearching = true;
        this.hasSearched = false;
        this.pageIndex   = 0;

        const conditions: string[] = [];

        if (f.fechaDesde) conditions.push(`mos.date >= '${f.fechaDesde} 00:00:00'`);
        if (f.fechaHasta) conditions.push(`mos.date <= '${f.fechaHasta} 23:59:59'`);

        // Filtro por tipo (chips)
        switch (this.tipoActivo) {
            case 'ENTRADA':     conditions.push(`mos.entry_reason IS NOT NULL`); break;
            case 'SALIDA':      conditions.push(`mos.exit_reason IS NOT NULL`); break;
            case 'ENVIO_BASE':  conditions.push(`mos.type IN ('ENVIO_BASE','exit') AND mos.exit_reason = 'base_send'`); break;
            case 'TRASPASO':    conditions.push(`mos.type = 'TRASPASO'`); break;
            case 'CALIBRACION': conditions.push(`mos.type IN ('ENVIO_CALIBRACION','RETORNO_CALIBRACION')`); break;
            case 'PRESTAMO':    conditions.push(`mos.type IN ('PRESTAMO','PRESTAMO_TERCERO')`); break;
            case 'BAJA':        conditions.push(`mos.type = 'BAJA'`); break;
        }

        // Búsqueda de texto
        if (f.busqueda?.trim()) {
            const q = f.busqueda.trim().replace(/'/g, "''");
            conditions.push(`(mos.movement_number ILIKE '%${q}%' OR mos.requested_by_name ILIKE '%${q}%' OR mos.received_by_name ILIKE '%${q}%' OR mos.department ILIKE '%${q}%' OR mos.notes ILIKE '%${q}%')`);
        }

        const params: any = { start: 0, limit: 200, sort: 'date', dir: 'desc' };
        if (conditions.length) params.filtro_adicional = conditions.join(' AND ');

        this.movSvc.getMovements(params).pipe(
            takeUntil(this._unsub$),
            finalize(() => this.isSearching = false)
        ).subscribe({
            next: (data: any[]) => {
                this.allMovimientos = (data || []).map(m => this._mapMovimiento(m));
                this.hasSearched    = true;
                this._aplicarFiltroLocal();
                this._showMsg(`${this.allMovimientos.length} movimiento(s) encontrado(s)`, 'success');
            },
            error: () => {
                this.allMovimientos = [];
                this.hasSearched    = true;
                this._aplicarFiltroLocal();
                this._showMsg('Error al consultar movimientos', 'error');
            }
        });
    }

    limpiar(): void {
        const today = new Date();
        this.filtroForm.reset({
            busqueda: '', fechaDesde: `${today.getFullYear()}-01-01`,
            fechaHasta: today.toISOString().split('T')[0], gestion: today.getFullYear()
        });
        this.tipoActivo     = 'TODOS';
        this.allMovimientos = [];
        this.dataSource     = [];
        this.hasSearched    = false;
        this.pageIndex      = 0;
    }

    private _aplicarFiltroLocal(): void {
        const q = (this.filtroForm.value.busqueda || '').toLowerCase().trim();
        let res = [...this.allMovimientos];
        if (q) {
            res = res.filter(m =>
                m.numero.toLowerCase().includes(q) ||
                m.responsableEnvia.toLowerCase().includes(q) ||
                m.responsableRecibe.toLowerCase().includes(q) ||
                m.destino.toLowerCase().includes(q) ||
                m.subtipo.toLowerCase().includes(q) ||
                m.notas.toLowerCase().includes(q)
            );
        }
        this.totalRecords = res.length;
        this.dataSource   = res.slice(this.pageIndex * this.pageSize, (this.pageIndex + 1) * this.pageSize);
    }

    // ── Paginación ────────────────────────────────────────────────────────

    get totalPages(): number { return Math.ceil(this.totalRecords / this.pageSize); }

    prevPage(): void {
        if (this.pageIndex > 0) { this.pageIndex--; this._aplicarFiltroLocal(); }
    }

    nextPage(): void {
        if (this.pageIndex < this.totalPages - 1) { this.pageIndex++; this._aplicarFiltroLocal(); }
    }

    goToPage(p: number): void {
        if (p >= 0 && p < this.totalPages) { this.pageIndex = p; this._aplicarFiltroLocal(); }
    }

    get pageNumbers(): number[] {
        const total = this.totalPages;
        const cur   = this.pageIndex;
        if (total <= 7) return Array.from({ length: total }, (_, i) => i);
        if (cur < 4)   return [0, 1, 2, 3, 4, -1, total - 1];
        if (cur > total - 5) return [0, -1, total-5, total-4, total-3, total-2, total-1];
        return [0, -1, cur - 1, cur, cur + 1, -1, total - 1];
    }

    // ── PDF del resultado actual ──────────────────────────────────────────

    imprimirResultados(): void {
        if (!this.dataSource.length) { this._showMsg('Sin datos para imprimir', 'warning'); return; }
        const f = this.filtroForm.value;
        const rows = this.dataSource.map((m, i) => `
            <tr>
                <td style="text-align:center">${this.pageIndex * this.pageSize + i + 1}</td>
                <td><span style="font-family:monospace;background:#0f172a;color:#fff;padding:1px 5px;border-radius:2px;font-size:8.5px">${m.numero}</span></td>
                <td><span style="background:${m.tipo==='ENTRADA'?'#dcfce7':'#fef3c7'};border:1px solid ${m.tipo==='ENTRADA'?'#16a34a':'#d97706'};color:${m.tipo==='ENTRADA'?'#15803d':'#b45309'};padding:1px 5px;border-radius:3px;font-weight:700;font-size:8.5px">${m.tipo}</span></td>
                <td style="font-size:9px">${m.subtipo}</td>
                <td>${m.fecha}</td>
                <td style="font-size:9px">${m.responsableEnvia || '—'}</td>
                <td style="font-size:9px">${m.destino || '—'}</td>
                <td style="font-size:9px;color:#555">${m.notas?.slice(0,40) || '—'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Consulta Movimientos</title>
<style>
  @page{size:A4 landscape;margin:10mm 12mm}
  body{font-family:Arial,sans-serif;font-size:9.5px}
  h1{font-size:13px;font-weight:900;text-transform:uppercase;background:#0f172a;color:#fff;padding:6px 10px;margin:0 0 6px}
  .meta{display:flex;gap:20px;margin-bottom:6px;font-size:9px;color:#555}
  table{width:100%;border-collapse:collapse}
  th{background:#0f172a;color:#fff;padding:4px;font-size:8.5px;text-align:left;text-transform:uppercase}
  td{padding:3px 4px;border-bottom:1px solid #e5e7eb;font-size:9px}
  tr:nth-child(even) td{background:#f9fafb}
  @media print{body{padding:0}}
</style>
<script>window.onload=()=>window.print()</script>
</head><body>
<h1>Consulta de Movimientos — BOLIVIANA DE AVIACIÓN</h1>
<div class="meta">
  <span>Período: ${f.fechaDesde} → ${f.fechaHasta}</span>
  <span>Tipo: ${this.tipoActivo}</span>
  <span>Total mostrado: ${this.dataSource.length} de ${this.totalRecords}</span>
  <span>Generado: ${new Date().toLocaleString('es-BO')}</span>
</div>
<table>
  <thead><tr><th>#</th><th>Correlativo</th><th>E/S</th><th>Subtipo</th><th>Fecha</th><th>Entrega conforme</th><th>Destino/Recibe</th><th>Notas</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private _mapMovimiento(m: any): MovimientoItem {
        const esEntrada = m.entry_reason != null ||
            ['RETORNO_BASE','RETORNO_TRASPASO','RETORNO_CALIBRACION','DEVOLUCION','DEVOLUCION_TERCERO',
             'AJUSTE_INGRESO','purchase','adjustment','ENTRADA_MISC','COMPRA'].includes(m.type);
        return {
            id:                String(m.id_movement || ''),
            numero:            m.movement_number || '-',
            tipo:              esEntrada ? 'ENTRADA' : 'SALIDA',
            subtipo:           this._mapSubtipo(m.type, m.entry_reason, m.exit_reason),
            tipoRaw:           m.type || '',
            fecha:             this._fmtDate(m.date || m.send_date || ''),
            hora:              String(m.time || '').slice(0, 5),
            origen:            m.source_warehouse_name || m.supplier || '',
            destino:           m.destination_warehouse_name || m.customer || m.department || '',
            responsableEnvia:  m.requested_by_name || m.responsible_person || '-',
            responsableRecibe: m.received_by_name || '-',
            departamento:      m.department || '',
            notas:             m.notes || m.specific_observations || '-',
            estado:            m.status || 'completed'
        };
    }

    private _mapSubtipo(type: string, entry: string, exit: string): string {
        const map: Record<string, string> = {
            ENVIO_BASE: 'Envío a Base', TRASPASO: 'Traspaso', RETORNO_BASE: 'Retorno Base',
            RETORNO_TRASPASO: 'Retorno Traspaso', ENVIO_CALIBRACION: 'Envío Calibración',
            RETORNO_CALIBRACION: 'Retorno Calibración', PRESTAMO: 'Préstamo Técnico',
            PRESTAMO_TERCERO: 'Préstamo Tercero', DEVOLUCION: 'Devolución', DEVOLUCION_TERCERO: 'Dev. Tercero',
            BAJA: 'Baja', CUARENTENA: 'Cuarentena', AJUSTE_INGRESO: 'Ajuste Ingreso',
            purchase: 'Compra', adjustment: 'Ajuste',
            base_send: 'Envío a Base', area_transfer: 'Traspaso',
            calibration_return: 'Ret. Calibración', base_return: 'Ret. Base',
            third_party_return: 'Ret. Tercero', loan: 'Préstamo', third_party_loan: 'Prést. Tercero',
            decommission: 'Baja', calibration_send: 'Env. Calibración'
        };
        return map[type] || map[entry] || map[exit] || type || '-';
    }

    private _fmtDate(d: string): string {
        if (!d) return '-';
        try {
            return new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return d; }
    }

    getTipoBadgeClass(tipo: string): string {
        return tipo === 'ENTRADA'
            ? 'bg-green-100 text-green-800 border-green-400'
            : 'bg-amber-100 text-amber-800 border-amber-400';
    }

    getSubtipoClass(subtipo: string): string {
        if (subtipo.includes('Calibr')) return 'bg-purple-100 text-purple-800 border-purple-300';
        if (subtipo.includes('Préstamo') || subtipo.includes('Prést')) return 'bg-blue-100 text-blue-800 border-blue-300';
        if (subtipo.includes('Compra') || subtipo.includes('Ajuste')) return 'bg-green-100 text-green-800 border-green-300';
        if (subtipo.includes('Retorno') || subtipo.includes('Ret.') || subtipo.includes('Dev')) return 'bg-cyan-100 text-cyan-800 border-cyan-300';
        if (subtipo.includes('Envío') || subtipo.includes('Traspaso')) return 'bg-orange-100 text-orange-800 border-orange-300';
        if (subtipo.includes('Baja') || subtipo.includes('Cuarentena')) return 'bg-red-100 text-red-800 border-red-300';
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }

    goBack(): void {
        if (this.dialogRef) this.dialogRef.close();
        else this.router.navigate(['/movimientos']);
    }

    private _showMsg(msg: string, type: string): void {
        this.snackBar.open(msg, 'OK', {
            duration: 3500, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
