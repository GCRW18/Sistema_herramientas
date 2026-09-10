import {
    Component, OnInit, inject, signal, ViewEncapsulation
} from '@angular/core';
import { CommonModule }        from '@angular/common';
import { MatIconModule }       from '@angular/material/icon';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule }    from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DragDropModule }      from '@angular/cdk/drag-drop';
import { forkJoin, of }        from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { KitsService }         from 'app/core/services/kits.service';
import { MiscelaneosService }  from 'app/core/services/miscelaneos.service';
import { MovementService }          from 'app/core/services/movement.service';
import { ToolService }              from 'app/core/services/tool.service';
import { UnifiedItem }               from '../consultar-inventario.component';
import { buildFichaPdfPayload }      from './ficha-pdf.util';
import { ReportesService }           from '../../reportes/reportes.service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type FichaTab = 'ficha' | 'componentes' | 'prestamos';

interface TabDef { id: FichaTab; label: string; icon: string; }

// Herramienta, Kit y Misceláneo son de solo lectura acá — la edición de cada uno vive en
// su propio módulo (Ingresos, Gestión de Kits, catálogo de Misceláneos).

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
    selector:      'app-ficha-inventario-dialog',
    standalone:    true,
    imports: [
        CommonModule, MatIconModule, MatDialogModule,
        MatTooltipModule, MatSnackBarModule, DragDropModule,
    ],
    encapsulation: ViewEncapsulation.None,
    styles: [`
        .neo-scroll::-webkit-scrollbar { width: 4px; }
        .neo-scroll::-webkit-scrollbar-track { background: transparent; }
        .neo-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        .neo-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        .spin { animation: _fi_spin 0.9s linear infinite; }
        @keyframes _fi_spin { to { transform: rotate(360deg); } }

        /* ── Etiqueta pequeña arriba + caja de valor debajo (ficha 100% solo lectura) ──
           Tamaño y colores alineados a ingresos-hub/detalle-herramienta (label 9px, caja
           32px/12px, borde 2px). Kit conserva tarjetas de sección (.df-card); Herramienta
           y Misceláneo usan filas sueltas, igual que detalle-herramienta. */
        .df-lbl {
            display: block;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.025em;
            color: #a8a29e;
            margin-bottom: 4px;
        }
        :host-context(.dark) .df-lbl { color: #94a3b8; }

        .df-box {
            width: 100%;
            height: 32px;
            min-height: 32px;
            font-size: 12px;
            font-weight: 700;
            background: white;
            border: 2px solid #d6d3d1;
            border-radius: 8px;
            padding: 0 10px;
            display: flex;
            align-items: center;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #0c0a09;
        }
        :host-context(.dark) .df-box {
            background: #0f172a;
            border-color: #475569;
            color: #ffffff;
        }
        textarea.df-box { height: auto; min-height: 56px; padding: 8px 10px; white-space: normal; }

        /* ── Tarjeta de sección: separa visualmente cada bloque de campos del
           fondo general del diálogo, en vez de solo una línea bajo el título ── */
        .df-card {
            background: #ffffff;
            border: 1.5px solid #eae6e1;
            border-radius: 14px;
            padding: 14px;
        }
        :host-context(.dark) .df-card {
            background: #101c33;
            border-color: #263049;
        }

        @media (max-width: 640px) {
            .fi-root { width: 100vw !important; max-height: 100dvh !important; border-radius: 0 !important; }
        }
    `],
    templateUrl: './ficha-inventario-dialog.component.html',
})
export class FichaInventarioDialogComponent implements OnInit {

    private dialogRef          = inject(MatDialogRef<FichaInventarioDialogComponent>);
    private data               = inject<{ item: UnifiedItem }>(MAT_DIALOG_DATA);
    private kitsService        = inject(KitsService);
    private miscelaneosService = inject(MiscelaneosService);
    private movementService    = inject(MovementService);
    private toolService        = inject(ToolService);
    private snackBar           = inject(MatSnackBar);
    private reportesSvc        = inject(ReportesService);

    item!: UnifiedItem;

    // ── Tabs ──────────────────────────────────────────────────────────────
    activeTab = signal<FichaTab>('ficha');
    tabs: TabDef[] = [];

    isGeneratingQR = signal(false);
    isExporting    = signal(false);

    // ── Detalle (movimientos / componentes / préstamos) ───────────────────
    isLoadingDetail   = signal(false);
    detailMovements   = signal<any[]>([]);
    detailComponents  = signal<any[]>([]);
    detailLoans       = signal<any[]>([]);

    ngOnInit(): void {
        this.item = this.data.item;
        this.tabs = this.buildTabs();
        this.loadDetail();
    }

    private buildTabs(): TabDef[] {
        switch (this.item.tipo) {
            case 'KIT':
                return [
                    { id: 'ficha',       label: 'Ficha',       icon: 'badge' },
                    { id: 'componentes', label: 'Componentes', icon: 'inventory' },
                    { id: 'prestamos',   label: 'Préstamos',   icon: 'swap_horiz' },
                ];
            default: // HERRAMIENTA / MISCELANEO — un único formulario, sin pestañas de Especificaciones/Movimientos/Ubicación
                return [
                    { id: 'ficha', label: 'Ficha', icon: 'badge' },
                ];
        }
    }

    setActiveTab(tab: FichaTab): void { this.activeTab.set(tab); }

    cerrar(): void { this.dialogRef.close(); }

    // ── Stock helpers ─────────────────────────────────────────────────────
    stockBajo(): boolean {
        return (this.item.stockMinimo ?? 0) > 0 && this.item.stockActual <= (this.item.stockMinimo ?? 0);
    }

    // ── Imagen ───────────────────────────────────────────────────────────
    // item.imagen ya trae la foto real (mapTool la resuelve desde t.location_photo).
    imagenSrc(): string | null {
        return this.item.imagen || null;
    }

    // ── Badge classes ─────────────────────────────────────────────────────
    getStatusBadgeClass(estado: string): string {
        const m: Record<string,string> = {
            'DISPONIBLE':     'bg-green-700 text-white border-green-900',
            'BAJO STOCK':     'bg-yellow-100 text-yellow-800 border-yellow-300',
            'SIN STOCK':      'bg-red-100 text-red-800 border-red-300',
            'EN CALIBRACION': 'bg-purple-100 text-purple-800 border-purple-300',
            'EN PRESTAMO':    'bg-blue-100 text-blue-800 border-blue-300',
            'CUARENTENA':     'bg-orange-100 text-orange-800 border-orange-300',
            'EN USO':         'bg-blue-100 text-blue-800 border-blue-300',
            'COMPLETO':       'bg-green-700 text-white border-green-900',
            'INCOMPLETO':     'bg-yellow-100 text-yellow-800 border-yellow-300',
            'BAJA':           'bg-stone-200 text-stone-600 border-stone-400',
        };
        return m[estado] || 'bg-stone-100 text-stone-600 border-stone-300';
    }
    getStatusDotClass(estado: string): string {
        const m: Record<string,string> = {
            'BAJO STOCK':     'bg-yellow-500', 'SIN STOCK':      'bg-red-500',
            'EN CALIBRACION': 'bg-purple-500', 'EN PRESTAMO':    'bg-blue-500',
            'CUARENTENA':     'bg-orange-500', 'EN USO':         'bg-blue-500',
            'INCOMPLETO':     'bg-yellow-500', 'BAJA':           'bg-stone-400',
        };
        return m[estado] || 'bg-stone-400';
    }
    getCompStatusClass(s: string): string {
        if (s === 'available' || s === 'DISPONIBLE') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (s === 'in_use'    || s === 'EN USO')     return 'bg-blue-100 text-blue-800 border-blue-300';
        return 'bg-stone-100 text-stone-600 border-stone-300';
    }

    // ── Formato de fecha ─────────────────────────────────────────────────
    formatDateShort(dateStr: string): string {
        if (!dateStr) return '—';
        // El backend manda 'YYYY-MM-DD[ HH:mm:ss]'. new Date() lo lee como UTC → en UTC-4
        // devuelve el día anterior; se toma la parte de fecha del string directamente.
        const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }

    // ── Kit helpers (usados en las pestañas Componentes/Préstamos) ──
    getCompStatus(comp: any): string     { return comp.tool_status || comp.status || ''; }
    getCompName(comp: any): string       { return comp.tool_name || comp.name || comp.herramienta_nombre || '—'; }
    getCompCode(comp: any): string       { return comp.tool_code || comp.code || '—'; }
    getLoanBorrower(loan: any): string   { return loan.borrower_name || loan.responsable || '—'; }
    getLoanDate(loan: any): string       { return this.formatDateShort(loan.loan_date || loan.fecha || ''); }
    getLoanReturnDate(loan: any): string { return this.formatDateShort(loan.expected_return_date || loan.return_date || ''); }
    getLoanWO(loan: any): string         { return loan.work_order_number || loan.loan_number || '—'; }

    // ── Data loading ──────────────────────────────────────────────────────
    private loadDetail(): void {
        this.isLoadingDetail.set(true);
        const item = this.item;

        if (item.tipo === 'HERRAMIENTA') {
            this.movementService.getMovementsByTool(String(item.id))
                .pipe(catchError(() => of([])), finalize(() => this.isLoadingDetail.set(false)))
                .subscribe((movs: any[]) => {
                    this.detailMovements.set(movs.slice(0, 10));
                    // "Últ. mov." real: la fecha del movimiento más reciente en he.tmovements
                    // (item.ultimoMovimiento venía de fecha_mod, que es la última edición del registro)
                    const fechaUlt = movs[0]?.fecha;
                    if (fechaUlt) this.item.ultimoMovimiento = new Date(fechaUlt);
                });

        } else if (item.tipo === 'KIT') {
            forkJoin({
                components: this.kitsService.getKitComponents(item.id).pipe(catchError(() => of([]))),
                loans:      this.kitsService.getKitLoans(item.id).pipe(catchError(() => of([]))),
            }).pipe(finalize(() => this.isLoadingDetail.set(false)))
                .subscribe(({ components, loans }) => {
                    this.detailComponents.set(components as any[]);
                    this.detailLoans.set((loans as any[]).slice(0, 10));
                });

        } else {
            forkJoin({
                entradas: this.miscelaneosService.getEntradas(item.id).pipe(catchError(() => of([]))),
                salidas:  this.miscelaneosService.getSalidas(item.id).pipe(catchError(() => of([]))),
            }).pipe(finalize(() => this.isLoadingDetail.set(false)))
                .subscribe(({ entradas, salidas }) => {
                    const combined = [
                        ...(entradas as any[]).map((e: any) => ({ ...e, _tipoMov: 'ENTRADA' })),
                        ...(salidas  as any[]).map((s: any) => ({ ...s, _tipoMov: 'SALIDA'  })),
                    ].sort((a, b) => {
                        const fa = new Date(`${a.fecha}T${a.hora || '00:00'}`).getTime();
                        const fb = new Date(`${b.fecha}T${b.hora || '00:00'}`).getTime();
                        return fb - fa;
                    }).slice(0, 10);
                    this.detailMovements.set(combined);
                });
        }
    }

    // ── Exportar ficha individual (PDF real, TCPDF backend) ─────────────────
    exportarPDF(): void {
        if (this.isExporting()) return;
        const p = buildFichaPdfPayload(this.item, {
            movements:  this.detailMovements(),
            components: this.detailComponents(),
            loans:      this.detailLoans(),
        });

        const win = window.open('', '_blank');
        this.isExporting.set(true);
        this.reportesSvc.exportarPdfFicha('Ficha de Inventario', this.item.codigo, p.subtitulo, p.campos, p.tablas)
            .pipe(finalize(() => this.isExporting.set(false)))
            .subscribe({
                next: (r) => {
                    try {
                        const bytes = Uint8Array.from(atob(r.pdf_base64), c => c.charCodeAt(0));
                        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
                        if (win) { win.location.href = url; }
                        else {
                            const a = document.createElement('a');
                            a.href = url; a.download = r.nombre_archivo;
                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        }
                        setTimeout(() => URL.revokeObjectURL(url), 30000);
                    } catch {
                        try { win?.close(); } catch { /* noop */ }
                        this.snackBar.open('No se pudo abrir el PDF generado', 'OK', { duration: 4000 });
                    }
                },
                error: (e) => {
                    try { win?.close(); } catch { /* noop */ }
                    this.snackBar.open(e?.message || 'Error al generar la ficha', 'OK', { duration: 5000 });
                },
            });
    }

    // ── Código QR (etiqueta para impresora Bixolon) ─────────────────────────
    verCodigoQR(): void {
        this.isGeneratingQR.set(true);
        this.toolService.generarCodigoQR(Number(this.item.id)).pipe(
            finalize(() => this.isGeneratingQR.set(false))
        ).subscribe({
            next: ({ pdf_base64 }) => {
                try {
                    const bytes = atob(pdf_base64);
                    const arr   = new Uint8Array(bytes.length);
                    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                    const blob = new Blob([arr], { type: 'application/pdf' });
                    const url  = window.URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => window.URL.revokeObjectURL(url), 300);
                } catch (e) {
                    console.error('Error abriendo código QR:', e);
                    this.snackBar.open('No se pudo abrir el PDF del código QR', 'OK', { duration: 5000 });
                }
            },
            error: (e) => {
                console.error('Error al generar código QR:', e);
                this.snackBar.open(e?.message || 'Error al generar el código QR', 'OK', { duration: 5000 });
            }
        });
    }
}
