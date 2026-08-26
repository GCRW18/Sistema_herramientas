import {
    Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { EnvioBasePdfService, EnvioBasePdfData } from './envio-base-pdf.service';

// ── Types ─────────────────────────────────────────────────────────────────────
// Compartidos con los diálogos (dialogs/*) — misma fuente que ellos ya usan.
import { Ubicacion, ToolEnvioItem, MovimientoActivo, HistorialRecord } from './retorno-traspaso.types';

// ─────────────────────────────────────────────────────────────────────────────

@Component({
    selector: 'app-retorno-traspaso',
    standalone: true,
    imports: [
        CommonModule, MatIconModule, MatPaginatorModule,
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
    private envioBasePdfSvc = inject(EnvioBasePdfService);
    private _unsub$  = new Subject<void>();
    private _logoBoaDataUri: Promise<string> | null = null;
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
    loadingCompletados                  = false;
    filterActivos: 'TODOS' | 'ENVIO_BASE' | 'TRASPASO' | 'MGH109' | 'COMPLETADOS' = 'TODOS';
    activeTabView: 'activos' | 'envios' | 'traspasos' | 'tecnico' = 'activos';
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
            width: 'min(780px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
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
            width: 'min(860px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases, defaultAlmacen }
        });
        this._traspasoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    abrirFormRetorno(): void {
        this._retornoDialogRef = this.dialog.open(RetornoDialogComponent, {
            width: 'min(700px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
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
        this.loadingActivos    = true;
        this.loadingCompletados = true;
        forkJoin({
            activos:     this.movSvc.listarEnviosActivos({ limit: 200 }),
            completados: this.movSvc.listarMovimientosCompletados({ limit: 200 })
        }).pipe(
            takeUntil(this._unsub$),
            finalize(() => { this.loadingActivos = false; this.loadingCompletados = false; })
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

    setFilterActivos(f: 'TODOS' | 'ENVIO_BASE' | 'TRASPASO' | 'MGH109' | 'COMPLETADOS'): void {
        this.filterActivos = f;
        if (f === 'COMPLETADOS' && this.movCompletados.length === 0 && !this.loadingCompletados) {
            this.loadMovCompletados();
        } else {
            this._applyFilterActivos();
        }
    }

    setTabView(tab: 'activos' | 'envios' | 'traspasos' | 'tecnico'): void {
        this.activeTabView = tab;
        const map: Record<string, 'TODOS' | 'ENVIO_BASE' | 'TRASPASO' | 'MGH109'> = {
            'activos':   'TODOS',
            'envios':    'ENVIO_BASE',
            'traspasos': 'TRASPASO',
            'tecnico':   'MGH109'
        };
        this.setFilterActivos(map[tab] || 'TODOS');
        if (tab === 'activos') this.loadMovActivos();
    }

    private _applyFilterActivos(): void {
        if (this.filterActivos === 'COMPLETADOS') {
            this.movActivosFiltrados = [...this.movCompletados];
        } else if (this.filterActivos === 'TODOS') {
            this.movActivosFiltrados = [...this.movActivos, ...this.movCompletados];
        } else if (this.filterActivos === 'MGH109') {
            this.movActivosFiltrados = this.movActivos.filter(m => m.movement_type_label === 'MGH_109');
        } else if (this.filterActivos === 'TRASPASO') {
            // Solo traspasos de área (TRP) — MGH-109 (técnico) tiene su propio filtro
            this.movActivosFiltrados = this.movActivos.filter(m => m.movement_type_label === 'TRASPASO');
        } else {
            this.movActivosFiltrados = this.movActivos.filter(m => m.movement_type_label === this.filterActivos);
        }
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

    getActivosStats() {
        const a = this.movActivos;
        return {
            total:    a.length,
            vencidos: a.filter(m => m.alert_status === 'VENCIDO' || m.alert_status === 'VENCE_HOY').length,
            proximos: a.filter(m => m.alert_status === 'PROXIMO').length,
            enPlazo:  a.filter(m => m.alert_status === 'EN_PLAZO').length,
            sinFecha: a.filter(m => m.alert_status === 'SIN_FECHA').length,
        };
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
            width: 'min(860px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases, defaultAlmacen }
        });
        this._tecnicoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    abrirFormDevolucionTecnico(): void {
        this._devTecnicoDialogRef = this.dialog.open(DevolucionTecnicoDialogComponent, {
            width: 'min(900px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { movTecnicosActivos: this.movTecnicosActivos }
        });
        this._devTecnicoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    abrirFormRetornoArea(): void {
        this._retornoAreaDialogRef = this.dialog.open(RetornoAreaDialogComponent, {
            width: 'min(820px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
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
            width: 'min(700px, 100vw)', maxWidth: '100vw', maxHeight: '100dvh',
            panelClass: 'neo-dialog-transparent', disableClose: false, autoFocus: false,
            data: { almacenes: this.almacenes, bases: this.bases, movimiento: mov, tipoOrigen: 'BASE' as const }
        });
        this._retornoDialogRef.afterClosed().subscribe((r: any) => {
            if (r?.refreshActivos) this.loadMovActivos();
        });
    }

    verPdfActivo(mov: MovimientoActivo): void {
        this.loadingPdfActivo = mov.id_movement;
        // Se abre en el mismo tick del clic (gesto de usuario) para que el navegador no
        // bloquee la pestaña nueva cuando el PDF se genera después de las llamadas async.
        const pdfWin = window.open('', '_blank');
        forkJoin({
            rawItems: this.movSvc.getMovementItems(Number(mov.id_movement)),
            personal: this.movSvc.getPersonal().pipe(catchError(() => of([] as any[])))
        })
            .pipe(takeUntil(this._unsub$), finalize(() => this.loadingPdfActivo = null))
            .subscribe({
                next: ({ rawItems, personal }) => {
                    const items: ToolEnvioItem[] = (rawItems || []).map((item: any) => ({
                        toolId:    Number(item.tool_id || item.toolId || 0),
                        codigo:    item.tool?.code || item.code || '',
                        nombre:    item.tool?.description || item.tool?.name || item.name || item.description || '',
                        pn:        item.tool?.part_number || item.part_number || '',
                        sn:        item.tool?.serial_number || item.serial_number || '',
                        marca:     item.tool?.brand || item.brand || '',
                        fechaVencCal: item.tool?.calibration_expiry_date || item.calibration_expiry_date || '',
                        cantidad:  Number(item.quantity) || 1,
                        condicion: item.condition_state || 'good',
                        notas:     item.notes || '',
                        unidad:         item.unit_of_measure || '',
                        listaContenido: item.content_list    || '',
                    }));
                    // Cruza nombre contra el padrón de funcionarios (mismo origen que usan los
                    // autocompletados del form) para completar Licencia/Cargo, que el movimiento
                    // en sí no guarda — solo el nombre en texto libre.
                    const buscarFuncionario = (nombre: string): any => {
                        const q = (nombre || '').trim().toLowerCase();
                        if (!q) return null;
                        return (personal || []).find((f: any) => (f.nombreCompleto || '').trim().toLowerCase() === q) || null;
                    };
                    const solicitante = buscarFuncionario(mov.requested_by_name);
                    const autorizado  = buscarFuncionario(mov.authorized_by || '');

                    const tipo = mov.movement_type_label === 'TRASPASO' ? 'TRASPASO DEFINITIVO' : 'ENVÍO A BASE';
                    const fakeForm = {
                        fechaEnvio:           mov.send_date,
                        fechaTraspaso:        mov.send_date,
                        baseOrigen:           { nombre: mov.source_warehouse_name },
                        baseDestino:          { nombre: mov.destination_warehouse_name },
                        areaDepartamento:     mov.destination_warehouse_name,
                        department:           mov.department,
                        departamentoDestino:  mov.destination_department,
                        unidadDestino:        mov.destination_unit,
                        responsableEnvia:     mov.requested_by_name,
                        responsableTraspaso:  mov.requested_by_name,
                        licenciaSolicitante:  solicitante?.licencia || '',
                        cargoSolicitante:     solicitante?.cargo    || '',
                        recibeEnDestino:      mov.received_by_name,
                        tipoTraspaso:         mov.transfer_type,
                        autorizadoPor:        mov.authorized_by || '',
                        cargoAutorizado:      autorizado?.cargo || '',
                        nroDocumento:         mov.document_number,
                        fechaEsperadaRetorno: mov.expected_return_date || 'N/A',
                        notas: mov.notes || '',
                    };
                    this._pdfEnvio(mov.movement_number, items, fakeForm, tipo, pdfWin);
                },
                error: () => { pdfWin?.close(); this._showMsg('Error al generar PDF', 'error'); },
            });
    }

    loadMovCompletados(): void {
        this.loadingCompletados = true;
        this.movSvc.listarMovimientosCompletados({ limit: 200 }).pipe(
            takeUntil(this._unsub$), finalize(() => { this.loadingCompletados = false; this._applyFilterActivos(); })
        ).subscribe({
            next: (data: any[]) => {
                this.movCompletados = (data || []).map((m: any) => {
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
            },
            error: () => this._showMsg('Error al cargar completados', 'error')
        });
    }

    verPdfRetornoCompletado(mov: MovimientoActivo): void {
        if (!mov.return_id_movement) return;
        this.loadingPdfActivo = mov.id_movement;
        // Se abre en el mismo tick del clic (gesto de usuario) para que el navegador no
        // bloquee la pestaña nueva cuando el PDF se genera después de la llamada async.
        const pdfWin = window.open('', '_blank');
        this.movSvc.getMovementItems(mov.return_id_movement)
            .pipe(takeUntil(this._unsub$), finalize(() => this.loadingPdfActivo = null))
            .subscribe({
                next: (rawItems: any[]) => {
                    const items: ToolEnvioItem[] = (rawItems || []).map((item: any) => ({
                        toolId:    Number(item.tool_id || 0),
                        codigo:    item.code || '',
                        nombre:    item.description || item.name || '',
                        pn:        item.part_number || '',
                        sn:        item.serial_number || '',
                        marca:     item.brand || '',
                        fechaVencCal: item.calibration_expiry_date || '',
                        cantidad:  Number(item.quantity) || 1,
                        condicion: item.condition_on_movement || item.condition_state || 'good',
                        notas:     item.notes || '',
                    }));
                    this._pdfRetornoSimple(
                        mov.return_movement_number || '---',
                        mov.movement_number,
                        mov.source_warehouse_name,
                        mov.destination_warehouse_name,
                        mov.received_by_name || mov.requested_by_name,
                        items,
                        pdfWin
                    );
                },
                error: () => { pdfWin?.close(); this._showMsg('Error al generar PDF de retorno', 'error'); },
            });
    }

    /** Reimpresión de la nota de retorno desde "Movimientos Completados" — mismo
     *  renderer que la impresión en vivo (_pdfRetorno → _abrirPdf), para que ambas
     *  se vean idénticas en vez de mantener una plantilla vieja duplicada. */
    private _pdfRetornoSimple(rtrNro: string, originalNro: string, almacen: string, origen: string, recibePor: string, items: ToolEnvioItem[], win?: Window | null): void {
        const ahora = new Date().toLocaleString('es-BO');
        const filas = items.map((item, i) => `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${item.codigo || '---'}</td>
                <td>${item.nombre || '---'}</td>
                <td>${item.pn || '---'}</td>
                <td>${item.sn || '---'}</td>
                <td style="text-align:center;font-weight:700">${item.cantidad}</td>
                <td style="text-align:center">${item.condicion || '---'}</td>
            </tr>`).join('');
        this._abrirPdf(rtrNro, 'RETORNO', filas, [
            ['Nro. Retorno', rtrNro], ['Movimiento Original', originalNro],
            ['Almacén Receptor', almacen || '---'], ['Origen / Técnico', origen || '---'],
            ['Recibido Por', recibePor || '---'], ['Fecha Impresión', ahora],
        ], [['#','4%'],['Código BOA','12%'],['Descripción','32%'],['P/N','14%'],['S/N','14%'],
            ['Cant.','8%'],['Condición','16%']],
            [origen || '---', almacen || '---'], win);
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

    // ── PDF GENERATION (reimpresión desde tabla Activos / Completados) ─────────

    private _pdfEnvio(nro: string, items: ToolEnvioItem[], form: any, tipo: string, win?: Window | null): void {
        if (tipo === 'TRASPASO DEFINITIVO') { this._pdfTraspasoOficial(nro, items, form, win); return; }
        const data: EnvioBasePdfData = {
            nroNota: nro,
            origen: form.baseOrigen?.nombre || '---',
            destino: form.baseDestino?.nombre || form.areaDepartamento || '---',
            fechaEnvio: new Date(form.fechaEnvio || form.fechaTraspaso || new Date()).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            responsable: form.responsableEnvia || form.responsableTraspaso || '',
            recibe: form.recibeEnDestino || '',
            tipoEnvio: form.tipoEnvio || 'EVENTUAL',
            fechaEsperadaRetorno: form.fechaEsperadaRetorno || '',
            nroDocumento: form.nroDocumento || '',
            nroVuelo: form.nroVuelo || '',
            aeronave: form.aeronave || '',
            observaciones: form.notas || '',
            items: items.map(it => ({ descripcion: it.nombre, pn: it.pn, sn: it.sn })),
        };
        this.envioBasePdfSvc.generarPdf(data, win);
    }

    /** Carga el logo de BoA como data-URI (una sola vez, cacheado) para poder incrustarlo
     *  en el HTML que se abre en una pestaña nueva vía Blob — esa pestaña no comparte el
     *  árbol de assets de la app, así que una ruta relativa /images/... no es confiable ahí. */
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

    /** Nota de Traspaso — formato oficial MGH-109 (BoAMM OAM145# N-014), calcado del
     *  formulario Excel/impreso real. Piloto: por ahora solo se usa para TRASPASO DEFINITIVO. */
    private async _pdfTraspasoOficial(nro: string, items: ToolEnvioItem[], form: any, win?: Window | null): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();
        const now     = new Date();
        const fecha   = new Date(form.fechaTraspaso || now).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora    = form.horaTraspaso || now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

        const solicitante = form.responsableTraspaso || form.responsableEnvia || '---';
        const destino     = form.baseDestino?.nombre || form.areaDepartamento || '---';
        const recibe      = form.recibeEnDestino || '---';
        const autorizado  = form.autorizadoPor || '---';
        const tipoTrp     = this.getTransferTypeLabel(form.tipoTraspaso || '') || '---';
        // Licencia/Cargo no se guardan en el movimiento — se cruzan por nombre contra el
        // padrón de funcionarios (he.employees) al momento de generar el PDF, ver verPdfActivo().
        const licencia        = form.licenciaSolicitante || '---';
        const cargo           = form.cargoSolicitante     || '---';
        const cargoAutorizado = form.cargoAutorizado      || '---';
        // Desglose organizativo del destino (SCP-41) — texto libre, no hay catalogo.
        // Sin fallback a form.department (Gerencia Destino): son campos deliberadamente
        // separados, mostrar la Gerencia acá disfrazaría un destination_department vacío.
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

    /**
     * Acta genérica de RETORNO (base RB / traspaso RTR) — sin equivalente en el Excel
     * (la hoja "TRASPASO" no tiene sección de retorno, y "ENV HH BASES" solo calza
     * cuando el retorno es de una sola nota, cosa que este flujo no garantiza: busca
     * por ubicación de origen y puede juntar ítems de varias notas de envío distintas
     * en una sola impresión — mismo problema que la devolución en lote de Terceros).
     * Solo se restyleó el logo/paleta para que se vea consistente con el resto de PDFs,
     * sin forzarla al formato de una sola nota.
     */
    private async _abrirPdf(
        nro: string, tipo: string, filas: string,
        campos: [string, string][],
        columnas: [string, string][],
        firmas: [string, string] | [string, string, string],
        win?: Window | null
    ): Promise<void> {
        const logoUri = await this._loadLogoBoaDataUri();

        // Meta-table: 2 pares label/value por fila, mismo maquetado que los formularios calcados
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
}
