import {
    Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil, finalize, forkJoin, of, map, catchError } from 'rxjs';

import { MovementService } from '../../../../core/services/movement.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

// Dialog components (standalone subfolders)
import { EnvioDialogComponent } from './dialogs/envio/envio-dialog.component';
import { TraspasoDialogComponent } from './dialogs/traspaso/traspaso-dialog.component';
import { RetornoDialogComponent } from './dialogs/retorno/retorno-dialog.component';
import { TraspasoTecnicoDialogComponent } from './dialogs/traspaso-tecnico/traspaso-tecnico-dialog.component';
import { DevolucionTecnicoDialogComponent } from './dialogs/devolucion-tecnico/devolucion-tecnico-dialog.component';
import { RetornoAreaDialogComponent } from './dialogs/retorno-area/retorno-area-dialog.component';

// ── Types ─────────────────────────────────────────────────────────────────────
// Compartidos con los diálogos (dialogs/*) — misma fuente que ellos ya usan.
import { Ubicacion, MovimientoActivo, HistorialRecord } from './retorno-traspaso.types';

// ─────────────────────────────────────────────────────────────────────────────

@Component({
    selector: 'app-retorno-traspaso',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatIconModule, MatPaginatorModule,
        MatDialogModule, MatSnackBarModule, MatTooltipModule,
        HasPermissionDirective,
    ],
    templateUrl: './retorno-traspaso.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.85); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center; z-index: 9999;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.75); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
    `]
})
export class RetornoTraspasoComponent implements OnInit, OnDestroy {

    @ViewChild('historialDialog') historialDialog!: TemplateRef<any>;
    @ViewChild(MatPaginator) paginator!: MatPaginator;

    public dialogRef = inject(MatDialogRef<RetornoTraspasoComponent>, { optional: true });
    private dialog   = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private movSvc   = inject(MovementService);
    private _unsub$  = new Subject<void>();
    private _envioDialogRef: any          = null;
    private _traspasoDialogRef: any       = null;
    private _retornoDialogRef: any        = null;
    private _tecnicoDialogRef: any        = null;
    private _devTecnicoDialogRef: any     = null;
    private _retornoAreaDialogRef: any    = null;

    // ── Shared data ───────────────────────────────────────────────────────────
    bases: Ubicacion[]    = [];
    almacenes: Ubicacion[] = [];
    isLoading = false;

    // Historial dialog
    historialRecords: HistorialRecord[]     = [];
    selectedHistorialEntry: HistorialRecord | null = null;
    isLoadingHistorial = false;
    totalHistorial     = 0;
    pageSize           = 10;
    pageIndex          = 0;
    pageSizeOptions    = [5, 10, 25];

    // ── ACTIVOS tab ───────────────────────────────────────────────────────────
    movActivos: MovimientoActivo[]      = [];
    movActivosFiltrados: MovimientoActivo[] = [];
    movCompletados: MovimientoActivo[]  = [];
    loadingActivos                      = false;
    activeTabView: 'envios' | 'traspasos' | 'tecnico' = 'envios';

    // ── Filtro Activos/Devueltos/Todos (mismo patrón + mismo <select> que Préstamo
    //    Técnico: estadosFiltro + filterStatus) — vive en la cabecera junto a las tabs.
    //    El tipo (Envío/Traspaso/MGH-109) ya lo define la tab activa; este filtro solo
    //    decide el estado dentro de ese tipo.
    filterEstado: 'active' | 'returned' | '' = 'active';
    estadosFiltro: { value: 'active' | 'returned' | ''; label: string }[] = [
        { value: 'active',   label: 'Activos'   },
        { value: 'returned', label: 'Devueltos' },
        { value: '',         label: 'Todos'     },
    ];
    loadingPdfActivo: number | null     = null;
    activosPageIndex        = 0;
    activosPageSize         = 15;
    activosPageSizeOptions  = [10, 15, 25, 50];

    // ─────────────────────────────────────────────────────────────────────────
    ngOnInit(): void {
        this._loadUbicaciones();
        this.loadMovActivos();
    }

    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    // ── Open form dialogs ─────────────────────────────────────────────────────

    abrirFormEnvio(): void {
        this._envioDialogRef = this.dialog.open(EnvioDialogComponent, {
            width: 'min(1240px, 96vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases }
        });
        this._envioDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    abrirFormTraspaso(): void {
        const defaultAlmacen = this.almacenes.find(u => u.codigo?.toUpperCase() === 'ALM-CBB-0001') ?? this.almacenes[0] ?? null;
        this._traspasoDialogRef = this.dialog.open(TraspasoDialogComponent, {
            width: 'min(1240px, 96vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases, defaultAlmacen }
        });
        this._traspasoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    abrirFormRetorno(): void {
        this._retornoDialogRef = this.dialog.open(RetornoDialogComponent, {
            width: 'min(1240px, 96vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases }
        });
        this._retornoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    // ── SHARED ────────────────────────────────────────────────────────────────

    private _loadUbicaciones(): void {
        this.isLoading = true;
        this.movSvc.getBases().pipe(takeUntil(this._unsub$)).subscribe({
            next: (data) => {
                this.bases = data.map((b: any) => ({
                    id: String(b.id ?? b.id_base), nombre: b.nombre ?? b.name ?? '',
                    codigo: b.codigo ?? b.code ?? '', ciudad: b.ciudad ?? b.city ?? ''
                }));
            }
        });
        this.movSvc.getWarehouses().pipe(
            takeUntil(this._unsub$), finalize(() => this.isLoading = false)
        ).subscribe({
            next: (data) => {
                this.almacenes = data.map((w: any) => ({
                    id: String(w.id ?? w.id_warehouse), nombre: w.nombre ?? w.name ?? '',
                    codigo: w.codigo ?? w.code ?? ''
                }));
            }
        });
    }

    private _showMsg(msg: string, type: string): void {
        this.snackBar.open(msg, 'OK', {
            duration: 3500, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }

    // ── ACTIVOS tab ───────────────────────────────────────────────────────────

    loadMovActivos(): void {
        this.loadingActivos = true;
        forkJoin({
            activos:     this.movSvc.listarEnviosActivos({ limit: 200 }),
            completados: this.movSvc.listarMovimientosCompletados({ limit: 200 })
        }).pipe(
            takeUntil(this._unsub$),
            finalize(() => { this.loadingActivos = false; })
        ).subscribe({
            next: ({ activos, completados }) => {
                this.movActivos = (activos || []).map((m: any) => {
                    const isMgh109 = !!(m.specific_observations?.includes('MGH109'));
                    const rawType  = m.movement_type_label || m.type || '';
                    return {
                        id_movement:                Number(m.id_movement),
                        movement_number:            m.movement_number  || '',
                        movement_type_label:        isMgh109 ? 'MGH_109' : rawType,
                        transfer_type:              m.transfer_type    || '',
                        send_date:                  m.send_date  || m.date  || '',
                        expected_return_date:       m.expected_return_date || null,
                        days_remaining:             m.days_remaining != null ? Number(m.days_remaining) : null,
                        alert_status:               m.alert_status || 'SIN_FECHA',
                        source_warehouse_id:        m.source_warehouse_id,
                        destination_warehouse_id:   m.destination_warehouse_id,
                        source_warehouse_name:      m.source_warehouse_name      || '',
                        destination_warehouse_name: m.destination_warehouse_name || '',
                        requested_by_name:          m.requested_by_name  || m.responsible_person || '',
                        received_by_name:           m.received_by_name   || '',
                        department:                 m.department         || '',
                        authorized_by:              m.authorized_by      || '',
                        destination_department:     m.destination_department || '',
                        destination_unit:           m.destination_unit       || '',
                        document_number:            m.document_number    || '',
                        notes:                      m.notes              || '',
                        specific_observations:      m.specific_observations      || '',
                        items_count:                Number(m.items_count) || 0,
                        expanded:                   false,
                        isCompleted:                m.status === 'returned',
                        return_movement_number:     m.return_movement_number || '',
                        return_id_movement:         Number(m.return_id_movement) || 0,
                    };
                });
                this.movCompletados = (completados || []).map((m: any) => {
                    const isMgh109 = !!(m.specific_observations?.includes('MGH109'));
                    const rawType  = m.movement_type_label || m.type || '';
                    return {
                        id_movement:                Number(m.id_movement),
                        movement_number:            m.movement_number  || '',
                        movement_type_label:        isMgh109 ? 'MGH_109' : rawType,
                        transfer_type:              m.transfer_type    || '',
                        send_date:                  m.send_date  || m.date  || '',
                        expected_return_date:       m.expected_return_date || null,
                        days_remaining:             null,
                        alert_status:               'DEVUELTO',
                        source_warehouse_id:        m.source_warehouse_id,
                        destination_warehouse_id:   m.destination_warehouse_id,
                        source_warehouse_name:      m.source_warehouse_name      || '',
                        destination_warehouse_name: m.destination_warehouse_name || '',
                        requested_by_name:          m.requested_by_name  || m.responsible_person || '',
                        received_by_name:           m.received_by_name   || '',
                        department:                 m.department         || '',
                        authorized_by:              m.authorized_by      || '',
                        destination_department:     m.destination_department || '',
                        destination_unit:           m.destination_unit       || '',
                        document_number:            m.document_number    || '',
                        notes:                      m.notes              || '',
                        specific_observations:      m.specific_observations || '',
                        items_count:                Number(m.items_count) || 0,
                        expanded:                   false,
                        isCompleted:                true,
                        return_movement_number:     m.return_movement_number || '',
                        return_id_movement:         Number(m.return_id_movement) || 0,
                    };
                });
                this._applyFilterActivos();
            },
            error: () => this._showMsg('Error al cargar movimientos', 'error')
        });
    }

    setTabView(tab: 'envios' | 'traspasos' | 'tecnico'): void {
        this.activeTabView = tab;
        // Cada tab arranca en "Activos", igual que Préstamo Técnico (filterStatus por
        // defecto 'active') — evita que quede pegado un filtro Devueltos/Todos de otra tab.
        this.filterEstado = 'active';
        this._applyFilterActivos();
    }

    /** Activos/Devueltos/Todos — mismo <select> y mismo estadosFiltro que Préstamo Técnico.
     *  El tipo de movimiento ya lo define la tab activa (ver _tipoDeTab). */
    setFilterEstado(v: 'active' | 'returned' | ''): void {
        this.filterEstado = v;
        this._applyFilterActivos();
    }

    private _tipoDeTab(): string {
        return this.activeTabView === 'envios'    ? 'ENVIO_BASE' :
               this.activeTabView === 'traspasos' ? 'TRASPASO'   : 'MGH_109';
    }

    private _applyFilterActivos(): void {
        const tipo = this._tipoDeTab();
        const activosDeTipo     = this.movActivos.filter(m => m.movement_type_label === tipo);
        const completadosDeTipo = this.movCompletados.filter(m => m.movement_type_label === tipo);
        this.movActivosFiltrados =
            this.filterEstado === 'active'   ? activosDeTipo :
            this.filterEstado === 'returned' ? completadosDeTipo :
            [...activosDeTipo, ...completadosDeTipo];
        this.activosPageIndex = 0;
    }

    get movActivosPaginados(): MovimientoActivo[] {
        const start = this.activosPageIndex * this.activosPageSize;
        return this.movActivosFiltrados.slice(start, start + this.activosPageSize);
    }

    onActivosPageChange(event: PageEvent): void {
        this.activosPageIndex = event.pageIndex;
        this.activosPageSize  = event.pageSize;
    }

    /** Texto del estado vacío, según el filtro Activos/Devueltos/Todos de la tab actual. */
    getEmptyLabelActivos(): string {
        return this.filterEstado === 'returned' ? 'Sin movimientos devueltos' :
               this.filterEstado === ''         ? 'Sin movimientos registrados' :
               'Sin movimientos activos';
    }

    getAlertBadgeClass(s: string): string {
        return 'bg-white dark:bg-slate-800 text-black dark:text-white border-black';
    }

    getAlertLabel(s: string): string {
        return {
            'VENCIDO':   'VENCIDO',
            'VENCE_HOY': 'VENCE HOY',
            'PROXIMO':   'PRÓXIMO',
            'EN_PLAZO':  'EN PLAZO',
            'SIN_FECHA': 'SIN FECHA',
        }[s] || s;
    }

    getAlertRowClass(s: string): string {
        return {
            'VENCIDO':   'border-l-4 border-l-black',
            'VENCE_HOY': 'border-l-4 border-l-red-600',
            'PROXIMO':   'border-l-4 border-l-orange-500',
            'EN_PLAZO':  'border-l-4 border-l-green-500',
            'SIN_FECHA': 'border-l-4 border-l-gray-400',
        }[s] || '';
    }

    /** Etiqueta corta del tipo de traspaso */
    getTransferTypeLabel(tt: string): string {
        const map: Record<string, string> = {
            'TEMPORAL':     'Temporal',
            'PERMANENTE':   'Permanente',
            'REASIGNACION': 'Reasignación',
            'PRESTAMO':     'Préstamo',
        };
        return map[tt] || tt;
    }

    /**
     * Helper: un TRASPASO es "técnico" (MGH-109) cuando el destino es una PERSONA
     * (destination_warehouse_id === 0 / "0" / nulo), no un almacén físico.
     */
    private _esTraspasoTecnico(m: MovimientoActivo): boolean {
        // Marcado explícitamente con 'MGH109' en specific_observations al registrar
        // (traspaso-tecnico-dialog SIEMPRE lo manda). NO usar heurística por
        // destination_warehouse_id: traspaso-tecnico-dialog SÍ manda ese campo (la
        // "Base destino"), y traspaso-dialog (TRP) NUNCA lo manda (usa "department"
        // en su lugar) — así que "sin warehouse destino" identificaba TRP, no MGH-109,
        // y enviaba los TRP por error a Devolución Técnica.
        return m.movement_type_label === 'MGH_109';
    }

    /**
     * Helper: un TRASPASO es "de área" (TRP) cuando NO es MGH-109 — independientemente
     * de si tiene destination_warehouse_id, ya que TRP registra el destino como
     * "department" (texto libre), no como almacén.
     */
    private _esTraspasoArea(m: MovimientoActivo): boolean {
        return m.movement_type_label === 'TRASPASO' && !this._esTraspasoTecnico(m);
    }

    /** TRASPASOs técnicos activos → Dev. TÉC. (MGH-109): destino = persona, warehouse_id = 0 */
    get movTecnicosActivos(): MovimientoActivo[] {
        return this.movActivos.filter(m => this._esTraspasoTecnico(m));
    }

    /** TRASPASOs de área activos → Ret. ÁREA: destino = almacén real (warehouse_id > 0) */
    get movTraspasosActivos(): MovimientoActivo[] {
        return this.movActivos.filter(m => this._esTraspasoArea(m));
    }

    abrirFormTraspasoTecnico(): void {
        const defaultAlmacen = this.almacenes.find(u => u.codigo?.toUpperCase() === 'ALM-CBB-0001') ?? this.almacenes[0] ?? null;
        this._tecnicoDialogRef = this.dialog.open(TraspasoTecnicoDialogComponent, {
            width: 'min(1240px, 96vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases, defaultAlmacen }
        });
        this._tecnicoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    abrirFormDevolucionTecnico(): void {
        this._devTecnicoDialogRef = this.dialog.open(DevolucionTecnicoDialogComponent, {
            width: 'min(1240px, 96vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { movTecnicosActivos: this.movTecnicosActivos }
        });
        this._devTecnicoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    abrirFormRetornoArea(): void {
        this._retornoAreaDialogRef = this.dialog.open(RetornoAreaDialogComponent, {
            width: 'min(1240px, 96vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { movTraspasosActivos: this.movTraspasosActivos }
        });
        this._retornoAreaDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    registrarRetornoDesdeActivo(mov: MovimientoActivo): void {
        if (this._esTraspasoTecnico(mov)) {
            // Traspaso técnico MGH-109 (destino = persona, sin almacén) → Dev. TÉC.
            this.abrirFormDevolucionTecnico();
            return;
        }

        if (this._esTraspasoArea(mov)) {
            // Traspaso de área (destino = almacén real) → Ret. ÁREA
            this.abrirFormRetornoArea();
            return;
        }

        // Flujo BASE (ENVIO_BASE)
        this._showMsg(`Registrando retorno de ${mov.movement_number}`, 'info');
        this._retornoDialogRef = this.dialog.open(RetornoDialogComponent, {
            width: 'min(1240px, 96vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases, movimiento: mov, tipoOrigen: 'BASE' as const }
        });
        this._retornoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    verPdfActivo(mov: MovimientoActivo): void {
        this.loadingPdfActivo = mov.id_movement;
        // Pestaña reservada en el gesto (click) para que el navegador no la bloquee
        // cuando el PDF real (TCPDF backend) responde después.
        const pdfWin = this.movSvc.preAbrirVentanaPdf();
        const idMov = Number(mov.id_movement);
        const gen$ = mov.movement_type_label === 'MGH_109'
            ? this.movSvc.generarPdfNotaTraspasoTecnico(idMov)
            : mov.movement_type_label === 'TRASPASO'
                ? this.movSvc.generarPdfNotaTraspaso(idMov)
                : this.movSvc.generarPdfNotaEnvio(idMov);
        gen$.pipe(takeUntil(this._unsub$), finalize(() => this.loadingPdfActivo = null)).subscribe({
            next: (r) => this.movSvc.abrirPdfNota(r.pdf_base64, r.nombre_archivo, pdfWin),
            error: () => { try { pdfWin?.close(); } catch { /* noop */ } this._showMsg('Error al generar PDF', 'error'); },
        });
    }

    /** Reimpresión de la Acta de Retorno desde "Movimientos Completados" — mismo
     *  reporte TCPDF compartido (RReporteRetornoNota) que la impresión en vivo de
     *  Retorno de Base/Traspaso, Retorno de Área y Devolución Técnica. */
    verPdfRetornoCompletado(mov: MovimientoActivo): void {
        if (!mov.return_id_movement) return;
        this.loadingPdfActivo = mov.id_movement;
        // Pestaña reservada en el gesto (click) para que el navegador no la bloquee
        // cuando el PDF real (TCPDF backend) responde después.
        const pdfWin = this.movSvc.preAbrirVentanaPdf();
        this.movSvc.generarPdfNotaRetorno(mov.return_id_movement)
            .pipe(takeUntil(this._unsub$), finalize(() => this.loadingPdfActivo = null))
            .subscribe({
                next: (r) => this.movSvc.abrirPdfNota(r.pdf_base64, r.nombre_archivo, pdfWin),
                error: () => { try { pdfWin?.close(); } catch { /* noop */ } this._showMsg('Error al generar PDF de retorno', 'error'); },
            });
    }

    // ── HISTORIAL ─────────────────────────────────────────────────────────────

    abrirModalHistorial(): void {
        this.selectedHistorialEntry = null;
        this.loadHistorial();
        this.dialog.open(this.historialDialog, {
            width: '900px', maxWidth: '95vw', height: 'auto', maxHeight: '90vh',
            panelClass: 'neo-dialog-transparent', hasBackdrop: true, disableClose: false, autoFocus: false
        });
    }

    cerrarModalHistorial(): void { this.dialog.closeAll(); }

    loadHistorial(): void {
        this.isLoadingHistorial = true;
        this.movSvc.getHistorialMovimientos({ movement_type: 'entry', page: this.pageIndex + 1, limit: this.pageSize }).pipe(
            takeUntil(this._unsub$), finalize(() => this.isLoadingHistorial = false)
        ).subscribe({
            next: (response) => {
                if (response?.data?.length) {
                    const retornos = response.data.filter((item: any) =>
                        item.entry_reason === 'base_return' || item.entry_reason === 'transfer_return' ||
                        item.type === 'RETORNO_BASE' || item.type === 'RETORNO_TRASPASO'
                    );
                    this.historialRecords = retornos.map((item: any) => ({
                        id: item.id_movement || item.id,
                        fecha: new Date(item.date || item.fecha).toLocaleDateString('es-BO'),
                        tipo: item.entry_reason === 'base_return' || item.type === 'RETORNO_BASE'
                            ? 'RETORNO DE BASE' : 'RETORNO TRASPASO',
                        documento:    item.document_number || item.movement_number || '-',
                        responsable:  item.requested_by_name || '-',
                        estado:       (item.status || 'N/A').toUpperCase(),
                        raw: item
                    }));
                    this.totalHistorial = response.total || this.historialRecords.length;
                } else { this.historialRecords = []; }
            },
            error: () => this._showMsg('Error al cargar historial', 'error')
        });
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex; this.pageSize = event.pageSize; this.loadHistorial();
    }

    verDetalleHistorial(e: HistorialRecord): void { this.selectedHistorialEntry = e; }
    cerrarDetalleHistorial(): void { this.selectedHistorialEntry = null; }

}
