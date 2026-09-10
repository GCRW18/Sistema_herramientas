import {
    Component, OnInit, inject, signal, computed, ViewEncapsulation, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { ToolService }        from 'app/core/services/tool.service';
import { QrScanService }      from 'app/core/services/qr-scan.service';
import { KitsService }        from 'app/core/services/kits.service';
import { MiscelaneosService } from 'app/core/services/miscelaneos.service';
import { WarehouseService }   from 'app/core/services/warehouse.service';
import { MovementService }    from 'app/core/services/movement.service';
import { BlobStorageService } from 'app/core/services/blob-storage.service';
import { GestionUbicacionesService } from '../gestion-ubicaciones/gestion-ubicaciones.service';
import { ReportesService } from '../reportes/reportes.service';
import { FichaInventarioDialogComponent } from './ficha-inventario-dialog/ficha-inventario-dialog.component';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ItemType = 'HERRAMIENTA' | 'KIT' | 'MISCELANEO';

export type UnifiedStatus =
    | 'DISPONIBLE' | 'BAJO STOCK' | 'SIN STOCK'
    | 'EN CALIBRACION' | 'EN PRESTAMO' | 'CUARENTENA'
    | 'EN MANTENIMIENTO' | 'EN USO' | 'COMPLETO' | 'INCOMPLETO' | 'BAJA';

export type TabId = 'todos' | 'herramientas' | 'kits' | 'miscelaneos' | 'critico' | 'prestados';

// ─── Interfaz unificada ───────────────────────────────────────────────────────

export interface UnifiedItem {
    internalId:           string;     // `${tipo}-${id}` — clave única
    id:                   number;
    tipo:                 ItemType;
    codigo:               string;
    nombre:               string;
    // Especificaciones
    partNumber?:          string;
    serialNumber?:        string;
    marca?:               string;
    descripcion?:         string;
    categoria?:           string;
    subCategoria?:        string;
    unidad?:              string;
    // Ubicación descompuesta
    ubicacion:            string;
    almacen?:             string;
    estante?:             string;    // shelf libre (independiente de rack_id/level_id)
    // Stock
    stockActual:          number;
    stockMinimo?:         number;
    stockMaximo?:         number;
    // Estado
    estado:               UnifiedStatus;
    // Extras herramientas
    nivelCriticidad?:     string;
    fabricacion?:         string;
    enLaboratorio?:       boolean;   // sent_to_calibration
    imagen?:              string;
    notas?:               string;
    // Extras kits
    totalComponentes?:    number;
    responsable?:         string;
    // Extras misceláneos
    tipoItem?:            string;
    tipoCompra?:          string;
    // Metadatos
    ultimoMovimiento?:    Date;
    fechaRegistro:        Date;
    activo:               boolean;
    _raw?:                any;
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
    selector:      'app-consultar-inventario',
    standalone:    true,
    imports: [
        CommonModule, FormsModule,
        MatIconModule, MatTooltipModule, MatSnackBarModule
    ],
    encapsulation: ViewEncapsulation.None,
    templateUrl:  './consultar-inventario.component.html',
    styles: [`
        :host { display: block; height: 100%; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

    `]
})
export class ConsultarInventarioComponent implements OnInit {

    // ── Servicios ─────────────────────────────────────────────────────────────
    private dialog            = inject(MatDialog);
    private snackBar          = inject(MatSnackBar);
    private toolService       = inject(ToolService);
    private _qrScan           = inject(QrScanService);
    private kitsService       = inject(KitsService);
    private miscelaneosService = inject(MiscelaneosService);
    private warehouseService  = inject(WarehouseService);
    private movementService   = inject(MovementService);
    private _blobStorage      = inject(BlobStorageService);
    private ubicacionesService = inject(GestionUbicacionesService);
    private reportesSvc       = inject(ReportesService);

    // ── Estado principal ──────────────────────────────────────────────────────
    inventoryData = signal<UnifiedItem[]>([]);
    isLoading     = signal(false);
    generandoPdf  = signal(false);
    resolviendoQr = signal(false);

    // ── Vista: tabla o tarjetas ────────────────────────────────────────────────
    viewMode = signal<'tabla' | 'tarjetas'>('tabla');
    setViewMode(v: 'tabla' | 'tarjetas'): void { this.viewMode.set(v); }

    // ── Pestañas internas ─────────────────────────────────────────────────────
    activeTab = signal<TabId>('todos');

    readonly TABS: { id: TabId; label: string; icon: string }[] = [
        { id: 'todos',        label: 'Todos',        icon: 'inventory_2'   },
        { id: 'herramientas', label: 'Herramientas', icon: 'construction'  },
        { id: 'kits',         label: 'Kits',         icon: 'cases'         },
        { id: 'miscelaneos',  label: 'Misceláneos',  icon: 'category'      },
        { id: 'critico',      label: 'Stock Crítico', icon: 'warning'      },
        { id: 'prestados',    label: 'Prestados',    icon: 'assignment_ind'},
    ];

    // ── Filtros clásicos ──────────────────────────────────────────────────────
    searchTerm        = signal('');
    selectedTipo      = signal<string>('todos');
    selectedCategoria = signal<string>('todas');
    selectedEstado    = signal<string>('todos');
    // Ubicación — autocomplete (reemplaza el select)
    ubicacionSearch   = signal('');
    showUbicacionDrop = signal(false);
    filteredUbicList  = computed(() => {
        const q = this.ubicacionSearch().toLowerCase().trim();
        return q
            ? this.ubicaciones.filter(u => u.toLowerCase().includes(q))
            : this.ubicaciones;
    });
    periodoMovimiento = signal<string>('todo');

    // ── Paginación ────────────────────────────────────────────────────────────
    readonly pageSize = 50;
    currentPage = signal(1);

    // ── Detalle de ítem (abre como MatDialog) ────────────────────────────────
    // Los signals de detalle ya no viven aquí — los gestiona FichaInventarioDialogComponent
    selectedItemId = signal<string | null>(null);   // internalId de la fila activa (gris)

    // ── Selección múltiple (para imprimir varios códigos QR en un solo PDF) ───
    selectedIds     = signal<Set<number>>(new Set());
    selectedCount   = computed(() => this.selectedIds().size);
    isGeneratingQR  = signal(false);

    // ── Listas de filtros (dinámicas desde datos) ─────────────────────────────
    ubicaciones: string[] = [];
    categorias:  string[] = [];

    readonly estados: UnifiedStatus[] = [
        'DISPONIBLE','BAJO STOCK','SIN STOCK','EN CALIBRACION',
        'EN PRESTAMO','EN USO','EN MANTENIMIENTO','CUARENTENA',
        'COMPLETO','INCOMPLETO','BAJA'
    ];

    // ── Computed: pestañas filtradas ──────────────────────────────────────────

    tabFilteredData = computed<UnifiedItem[]>(() => {
        let data = this.inventoryData();

        // 1. Filtro por pestaña activa
        switch (this.activeTab()) {
            case 'herramientas':
                data = data.filter(i => i.tipo === 'HERRAMIENTA'); break;
            case 'kits':
                data = data.filter(i => i.tipo === 'KIT'); break;
            case 'miscelaneos':
                data = data.filter(i => i.tipo === 'MISCELANEO'); break;
            case 'critico':
                data = data.filter(i =>
                    i.stockActual === 0 ||
                    (i.stockMinimo != null && i.stockActual <= i.stockMinimo)
                ); break;
            case 'prestados':
                data = data.filter(i =>
                    i.estado === 'EN PRESTAMO' || i.estado === 'EN USO'
                ); break;
        }

        // 2. Filtros clásicos
        const term = this.searchTerm().toLowerCase().trim();
        if (term) {
            data = data.filter(i =>
                i.codigo.toLowerCase().includes(term) ||
                i.nombre.toLowerCase().includes(term) ||
                (i.partNumber   || '').toLowerCase().includes(term) ||
                (i.serialNumber || '').toLowerCase().includes(term) ||
                (i.marca        || '').toLowerCase().includes(term) ||
                (i.categoria    || '').toLowerCase().includes(term) ||
                (i.ubicacion    || '').toLowerCase().includes(term) ||
                (i.responsable  || '').toLowerCase().includes(term)
            );
        }
        if (this.selectedTipo() !== 'todos') {
            data = data.filter(i => i.tipo === this.selectedTipo());
        }
        if (this.selectedCategoria() !== 'todas') {
            data = data.filter(i => i.categoria === this.selectedCategoria());
        }
        if (this.selectedEstado() !== 'todos') {
            data = data.filter(i => i.estado === this.selectedEstado());
        }
        const ubQ = this.ubicacionSearch().trim().toLowerCase();
        if (ubQ) {
            data = data.filter(i => (i.ubicacion ?? '').toLowerCase().includes(ubQ));
        }
        if (this.periodoMovimiento() !== 'todo') {
            const dias    = parseInt(this.periodoMovimiento(), 10);
            const cutoff  = new Date();
            cutoff.setDate(cutoff.getDate() - dias);
            data = data.filter(i => i.ultimoMovimiento && i.ultimoMovimiento >= cutoff);
        }

        return data;
    });

    // Página actual (slice de tabFilteredData)
    pagedData = computed<UnifiedItem[]>(() => {
        const start = (this.currentPage() - 1) * this.pageSize;
        return this.tabFilteredData().slice(start, start + this.pageSize);
    });

    totalPages = computed(() =>
        Math.max(1, Math.ceil(this.tabFilteredData().length / this.pageSize))
    );

    // KPI cards — sobre TODOS los datos (sin filtros)
    kpiStats = computed(() => {
        const all = this.inventoryData();
        const cutoff90 = new Date();
        cutoff90.setDate(cutoff90.getDate() - 90);
        return {
            total:     all.length,
            critico:   all.filter(i =>
                i.stockActual === 0 ||
                (i.stockMinimo != null && i.stockActual <= i.stockMinimo)
            ).length,
            prestados: all.filter(i =>
                i.estado === 'EN PRESTAMO' || i.estado === 'EN USO'
            ).length,
            sinMov90:  all.filter(i =>
                !i.ultimoMovimiento || i.ultimoMovimiento < cutoff90
            ).length,
        };
    });

    // Counts por pestaña (para badges en tabs)
    tabCounts = computed(() => {
        const all = this.inventoryData();
        return {
            todos:        all.length,
            herramientas: all.filter(i => i.tipo === 'HERRAMIENTA').length,
            kits:         all.filter(i => i.tipo === 'KIT').length,
            miscelaneos:  all.filter(i => i.tipo === 'MISCELANEO').length,
            critico:      all.filter(i =>
                i.stockActual === 0 ||
                (i.stockMinimo != null && i.stockActual <= i.stockMinimo)
            ).length,
            prestados:    all.filter(i =>
                i.estado === 'EN PRESTAMO' || i.estado === 'EN USO'
            ).length,
        };
    });

    // ¿Hay filtros activos? (para mostrar indicador)
    hasActiveFilters = computed(() =>
        this.searchTerm()          !== '' ||
        this.selectedTipo()        !== 'todos' ||
        this.selectedCategoria()   !== 'todas' ||
        this.selectedEstado()      !== 'todos' ||
        this.ubicacionSearch()     !== ''      ||
        this.periodoMovimiento()   !== 'todo'
    );

    // ── Ciclo de vida ─────────────────────────────────────────────────────────

    constructor() {
        // Resetear página cuando cambia cualquier filtro o pestaña
        effect(() => {
            // Leer todos los signals de filtro para que el effect se re-ejecute cuando cambien
            this.searchTerm();
            this.selectedTipo(); this.selectedCategoria();
            this.selectedEstado(); this.ubicacionSearch();
            this.periodoMovimiento(); this.activeTab();
            // Resetear sin untracked para evitar loop — usamos un timeout micro
            Promise.resolve().then(() => this.currentPage.set(1));
        }, { allowSignalWrites: true });
    }

    ngOnInit(): void {
        this.loadInventory();
    }

    // ── Búsqueda libre (acepta etiqueta QR) ──────────────────────────────────
    // El buscador filtra en el cliente; si lo escaneado es la URL de una etiqueta QR
    // (`.../qr-code/<token>`) se descifra a código plano con QrScanService antes de filtrar.
    onSearchInput(v: string): void {
        const raw = (v ?? '').trim();
        if (!this._qrScan.isQrLabel(raw)) { this.searchTerm.set(v); return; }

        this.resolviendoQr.set(true);
        this._qrScan.toToolCode(raw).pipe(
            finalize(() => this.resolviendoQr.set(false))
        ).subscribe(code => {
            if (code) {
                if (this.activeTab() === 'kits' || this.activeTab() === 'miscelaneos') {
                    this.activeTab.set('herramientas');
                }
                this.searchTerm.set(code);
            } else {
                this.snackBar.open('Etiqueta QR no reconocida', 'OK', { duration: 3000 });
                this.searchTerm.set('');
            }
        });
    }

    // ── Carga de datos ────────────────────────────────────────────────────────

    loadInventory(): void {
        this.isLoading.set(true);
        this.inventoryData.set([]);

        forkJoin({
            tools:      this.toolService.getTools().pipe(catchError(() => of([]))),
            kits:       this.kitsService.getKits({ limit: 5000 }).pipe(catchError(() => of([]))),
            miscs:      this.miscelaneosService.getMiscelaneos().pipe(catchError(() => of([]))),
            warehouses: this.warehouseService.getWarehouses().pipe(catchError(() => of([]))),
            locations:  this.warehouseService.getAllLocations().pipe(catchError(() => of([]))),
            categories: this.movementService.getIngresosCategories().pipe(catchError(() => of([]))),
            toolLocations: this.ubicacionesService.getToolLocationsMap().pipe(catchError(() => of(new Map()))),
        }).subscribe({
            next: ({ tools, kits, miscs, warehouses, locations, categories, toolLocations }) => {
                // Maps para resolución rápida de nombres
                const warehouseMap: Record<number, string> = {};
                for (const w of warehouses as any[]) {
                    warehouseMap[w.id_warehouse] = w.name;
                }
                const locationMap: Record<number, string> = {};
                for (const l of locations as any[]) {
                    locationMap[l.id_location] = l.name;
                }
                const categoryMap: Record<number, string> = {};
                for (const c of categories as any[]) {
                    categoryMap[c.id_category] = c.name;
                }

                const toolLocMap = toolLocations as Map<number, { warehouseId: number; rackName: string; levelLabel: string }>;
                const items: UnifiedItem[] = [
                    ...(tools as any[]).map(t => this.mapTool(t, warehouseMap, locationMap, categoryMap, toolLocMap)),
                    ...(kits  as any[]).map(k => this.mapKit(k)),
                    ...(miscs as any[]).map(m => this.mapMisc(m)),
                ];

                this.inventoryData.set(items);

                // Listas únicas para selects de filtro
                this.ubicaciones = [...new Set(
                    items.map(i => i.ubicacion).filter(u => u && u !== 'Sin ubicación')
                )].sort();
                this.categorias = [...new Set(
                    items.map(i => i.categoria).filter((c): c is string => !!c)
                )].sort();

                this.isLoading.set(false);
            },
            error: () => this.isLoading.set(false),
        });
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private mapTool(
        t: any,
        wMap: Record<number, string>,
        lMap: Record<number, string>,
        catMap: Record<number, string> = {},
        toolLocMap: Map<number, { warehouseId: number; rackName: string; levelLabel: string }> = new Map()
    ): UnifiedItem {
        // Ubicación real (rack/nivel), la que actualiza mover-herramientas; ttools.location_id
        // (lMap) es un esquema paralelo que no se sincroniza, solo se usa como fallback.
        const realLoc = toolLocMap.get(Number(t.id_tool));
        const wName = (realLoc ? wMap[realLoc.warehouseId] : undefined) ?? (t.warehouse_id ? wMap[t.warehouse_id] : undefined);
        const lName  = realLoc
            ? [realLoc.rackName, realLoc.levelLabel].filter(Boolean).join(' · ')
            : (t.location_id ? lMap[t.location_id] : undefined);

        let ubicacion = 'Sin ubicación';
        if (wName && lName)  ubicacion = `${wName} / ${lName}`;
        else if (wName)      ubicacion = wName;
        else if (lName)      ubicacion = lName;
        else if (t.notes) {
            const m = (t.notes as string).match(/Ubicacion:\s*(.+)/i);
            if (m) ubicacion = m[1].trim();
        }

        const statusMap: Record<string, UnifiedStatus> = {
            available:        'DISPONIBLE',
            in_calibration:   'EN CALIBRACION',  calibration:    'EN CALIBRACION',
            in_use:           'EN USO',           loaned:         'EN PRESTAMO',
            transferred:      'EN PRESTAMO',
            in_maintenance:   'EN MANTENIMIENTO', maintenance:    'EN MANTENIMIENTO',
            quarantine:       'CUARENTENA',
            decommissioned:   'BAJA',             lost:           'BAJA',
            // valores legados en español
            DISPONIBLE:       'DISPONIBLE',       CALIBRACION:    'EN CALIBRACION',
            PRESTADO:         'EN PRESTAMO',      TRANSFERIDO:    'EN PRESTAMO',
            CUARENTENA:       'CUARENTENA',       BAJA:           'BAJA',
        };
        let estado: UnifiedStatus = statusMap[t.status] || 'DISPONIBLE';
        if (estado === 'DISPONIBLE' && (t.quantity_in_stock ?? 0) <= 0) estado = 'SIN STOCK';

        // Foto real: t.location_photo (subconsulta a he.ttool_files/'location_photo') —
        // ruta_bs del Blob Storage o base64/data-URL heredado.
        let imagen: string | undefined;
        const foto: string | undefined = t.location_photo || undefined;
        if (foto) {
            const resuelta = this._blobStorage.resolveImageSrc(foto);
            imagen = (resuelta === foto && !foto.startsWith('data:') && !foto.startsWith('http'))
                ? `data:image/jpeg;base64,${foto}`
                : (resuelta ?? undefined);
        }

        return {
            internalId:          `HERRAMIENTA-${t.id_tool}`,
            id:                  t.id_tool,
            tipo:                'HERRAMIENTA',
            codigo:              t.code          || '',
            nombre:              t.name          || '',
            partNumber:          t.part_number   || undefined,
            serialNumber:        t.serial_number || undefined,
            marca:               t.brand         || undefined,
            descripcion:         t.description   || undefined,
            categoria:           (t.category_id ? catMap[t.category_id] : undefined) || t.category_name || undefined,
            subCategoria:        (t.subcategory_id ? catMap[t.subcategory_id] : undefined) || undefined,
            unidad:              t.unit_of_measure || 'UNIDAD',
            ubicacion,
            almacen:             wName,
            estante:             t.estante || undefined,
            stockActual:         t.quantity_in_stock ?? 0,
            // he.ttools no tiene stock mínimo → undefined (no 0), para que "Bajo stock" no
            // aplique a herramientas (solo son críticas con stockActual === 0).
            stockMinimo:         undefined,
            stockMaximo:         undefined,
            estado,
            nivelCriticidad:      t.criticality_level        || undefined,
            fabricacion:          t.manufacture_origin        || undefined,
            enLaboratorio:        t.sent_to_calibration === true || t.sent_to_calibration === 't',
            imagen,
            notas:               t.notes            || undefined,
            ultimoMovimiento:    t.fecha_mod
                ? new Date(t.fecha_mod)
                : t.fecha_reg ? new Date(t.fecha_reg) : undefined,
            fechaRegistro:       t.fecha_reg ? new Date(t.fecha_reg) : new Date(),
            activo:              t.active !== false,
            _raw:                t,
        };
    }

    private mapKit(k: any): UnifiedItem {
        const statusMap: Record<string, UnifiedStatus> = {
            complete:       'COMPLETO',
            incomplete:     'INCOMPLETO',
            in_use:         'EN USO',
            in_calibration: 'EN CALIBRACION',
            decommissioned: 'BAJA',
            COMPLETO:       'COMPLETO',
            INCOMPLETO:     'INCOMPLETO',
            'EN USO':       'EN USO',
        };
        const estado: UnifiedStatus = statusMap[k.status] || 'COMPLETO';
        const ubicacion: string     = k.location_name || 'Sin ubicación';

        return {
            internalId:       `KIT-${k.id_kit}`,
            id:               k.id_kit,
            tipo:             'KIT',
            codigo:           k.code         || `KIT-${k.id_kit}`,
            nombre:           k.name         || '',
            descripcion:      k.notes || k.description || undefined,
            categoria:        k.category     || undefined,
            unidad:           'Kit',
            ubicacion,
            almacen:          k.location_name || undefined,
            // Un kit es una unidad física: 1 en almacén, 0 si está prestado (current_loan_id).
            // stockMinimo undefined — no participa de "Bajo stock".
            stockActual:      k.current_loan_id ? 0 : 1,
            stockMinimo:      undefined,
            totalComponentes: k.total_components   ?? 0,
            responsable:      k.funcionario_nombre  || undefined,
            partNumber:          k.part_number   || undefined,
            serialNumber:        k.serial_number || undefined,
            marca:               k.manufacturer  || undefined,
            imagen:              k.image_url     || undefined,
            estado,
            ultimoMovimiento: k.fecha_mod
                ? new Date(k.fecha_mod)
                : k.fecha_reg ? new Date(k.fecha_reg) : undefined,
            fechaRegistro:    k.fecha_reg ? new Date(k.fecha_reg) : new Date(),
            activo:           k.active === true || k.active === 't' || k.active === 'true',
            _raw:             k,
        };
    }

    private mapMisc(m: any): UnifiedItem {
        // getMiscelaneos() retorna objetos Material ya mapeados (id, codigoBoaM, producto, pn,
        // stock, stockMin/Max, ubicacion, lastMovementDate...); también se soportan los raw.
        const stock    = Number(m.stock    ?? m.quantity_in_stock ?? 0);
        const stockMin = Number(m.stockMin ?? m.stock_min         ?? 0);
        let estado: UnifiedStatus = 'DISPONIBLE';
        if (stock === 0)                              estado = 'SIN STOCK';
        else if (stockMin > 0 && stock <= stockMin)   estado = 'BAJO STOCK';

        const ubicacion = m.ubicacion || m.location_name || 'Sin ubicación';

        return {
            internalId:   `MISCELANEO-${m.id ?? m.id_miscelaneo}`,
            id:           m.id            ?? m.id_miscelaneo,
            tipo:         'MISCELANEO',
            codigo:       m.codigoBoaM   || m.code          || '',
            nombre:       m.producto     || m.name          || '',
            marca:        m.marca        || m.brand         || undefined,
            partNumber:   m.pn           || m.part_number   || undefined,
            descripcion:  m.observacion  || m.notes         || undefined,
            categoria:    m.tipoItem     || m.item_type     || undefined,
            tipoItem:     m.tipoItem     || m.item_type     || undefined,
            tipoCompra:   m.tipoCompra   || m.purchase_type || undefined,
            unidad:       (m.unidad      || m.unit_of_measure)?.trim() || 'UND',
            ubicacion,
            almacen:      ubicacion !== 'Sin ubicación' ? ubicacion : undefined,
            stockActual:  stock,
            stockMinimo:  stockMin || undefined,
            stockMaximo:  Number(m.stockMax ?? m.stock_max ?? 0) || undefined,
            estado,
            // "Últ. mov." real = última entrada/salida (he.tmiscelaneo_movimientos), no el alta
            // del catálogo. 'T00:00:00' fuerza hora local (evita el corrimiento de día por UTC).
            ultimoMovimiento: m.lastMovementDate
                ? new Date(`${m.lastMovementDate}T00:00:00`)
                : m.fecha_mod ? new Date(m.fecha_mod) : undefined,
            fechaRegistro:    m.fecha
                ? new Date(`${m.fecha}T00:00:00`)
                : m.fecha_reg ? new Date(m.fecha_reg) : new Date(),
            activo: m.activo ?? (m.active === true || m.active === 't' || m.active === 'true'),
            _raw:   m,
        };
    }

    // ── Acciones de filtros ───────────────────────────────────────────────────

    setActiveTab(tab: TabId): void {
        this.activeTab.set(tab);
    }

    // ── Autocomplete ubicación ────────────────────────────────────────────────
    selectUbicacion(u: string): void {
        this.ubicacionSearch.set(u);
        this.showUbicacionDrop.set(false);
    }
    closeUbicacionDrop(): void {
        // Pequeño delay para que el mousedown del item se procese antes de cerrar
        setTimeout(() => this.showUbicacionDrop.set(false), 150);
    }

    resetFilters(): void {
        this.searchTerm.set('');
        this.selectedTipo.set('todos');
        this.selectedCategoria.set('todas');
        this.selectedEstado.set('todos');
        this.ubicacionSearch.set('');
        this.showUbicacionDrop.set(false);
        this.periodoMovimiento.set('todo');
        this.currentPage.set(1);
    }

    // ── Paginación ────────────────────────────────────────────────────────────

    prevPage(): void {
        if (this.currentPage() > 1) this.currentPage.update(p => p - 1);
    }

    nextPage(): void {
        if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1);
    }

    get pageStart(): number {
        return (this.currentPage() - 1) * this.pageSize + 1;
    }

    get pageEnd(): number {
        return Math.min(this.currentPage() * this.pageSize, this.tabFilteredData().length);
    }

    // ── Detalle de ítem ───────────────────────────────────────────────────────

    verDetalle(item: UnifiedItem): void {
        this.selectedItemId.set(item.internalId);
        const ref = this.dialog.open(FichaInventarioDialogComponent, {
            data:         { item },
            panelClass:   'no-padding-dialog',
            width:        'auto',
            maxWidth:     '98vw',
            height:       'auto',
            maxHeight:    '98vh',
            autoFocus:    false,
            restoreFocus: false,
        });
        ref.afterClosed().subscribe((saved) => {
            this.selectedItemId.set(null);
            if (saved) this.loadInventory();
        });
    }

    // ── Selección múltiple para impresión de códigos QR ──────────────────────
    // Solo HERRAMIENTA es seleccionable (RCodigoQRTools trabaja sobre id_tool).

    isSelectable(item: UnifiedItem): boolean {
        return item.tipo === 'HERRAMIENTA';
    }

    isSelected(item: UnifiedItem): boolean {
        return this.selectedIds().has(Number(item.id));
    }

    toggleSelect(item: UnifiedItem, event: Event): void {
        event.stopPropagation();
        if (!this.isSelectable(item)) return;
        const id = Number(item.id);
        const next = new Set(this.selectedIds());
        if (next.has(id)) next.delete(id); else next.add(id);
        this.selectedIds.set(next);
    }

    clearSelection(): void {
        this.selectedIds.set(new Set());
    }

    imprimirCodigosQRSeleccionados(): void {
        const ids = Array.from(this.selectedIds());
        if (ids.length === 0 || this.isGeneratingQR()) return;

        this.isGeneratingQR.set(true);
        this.toolService.generarCodigoQR(ids).pipe(
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
                    this.clearSelection();
                } catch (e) {
                    console.error('Error abriendo códigos QR:', e);
                    this.snackBar.open('No se pudo abrir el PDF de códigos QR', 'OK', { duration: 5000 });
                }
            },
            error: (e) => {
                console.error('Error al generar códigos QR:', e);
                this.snackBar.open(e?.message || 'Error al generar los códigos QR', 'OK', { duration: 5000 });
            }
        });
    }

    // ── Imprimir / Guardar como PDF ───────────────────────────────────────────

    imprimirListado(): void {
        const data = this.tabFilteredData();
        if (!data.length) { this.snackBar.open('Sin ítems para el reporte', 'OK', { duration: 3000 }); return; }
        if (this.generandoPdf()) return;

        const tabLabels: Record<string, string> = {
            todos: 'Todos los ítems', herramientas: 'Herramientas', kits: 'Kits',
            miscelaneos: 'Misceláneos', critico: 'Stock Crítico', prestados: 'En uso / Prestados',
        };
        const tabLabel = tabLabels[this.activeTab()] ?? 'Inventario';
        const tipoAbbr: Record<string, string> = { HERRAMIENTA: 'HERR.', MISCELANEO: 'MISC.', KIT: 'KIT' };

        const columnas = [
            { header: 'Tipo',       key: 'tipo',      tipo: 'text', align: 'center' },
            { header: 'Código',     key: 'codigo',    tipo: 'text' },
            { header: 'P/N',        key: 'pn',        tipo: 'text' },
            { header: 'S/N',        key: 'sn',        tipo: 'text' },
            { header: 'Nombre',     key: 'nombre',    tipo: 'text' },
            { header: 'Marca',      key: 'marca',     tipo: 'text' },
            { header: 'Categoría',  key: 'categoria', tipo: 'text' },
            { header: 'Ubicación',  key: 'ubicacion', tipo: 'text' },
            { header: 'Stock',      key: 'stock',     tipo: 'text', align: 'center' },
            { header: 'Estado',     key: 'estado',    tipo: 'text', align: 'center' },
            { header: 'Últ. Mov.',  key: 'ultmov',    tipo: 'text', align: 'center' },
        ];
        const filas = data.map(i => ({
            tipo:      tipoAbbr[i.tipo] ?? i.tipo,
            codigo:    i.codigo,
            pn:        i.partNumber ?? '',
            sn:        i.serialNumber ?? '',
            nombre:    i.nombre,
            marca:     i.marca ?? '',
            categoria: i.categoria ?? '',
            ubicacion: i.ubicacion,
            stock:     `${i.stockActual}${(i.stockMinimo ?? 0) > 0 ? ' (min ' + i.stockMinimo + ')' : ''} ${i.unidad ?? ''}`.trim(),
            estado:    i.estado,
            ultmov:    i.ultimoMovimiento ? i.ultimoMovimiento.toLocaleDateString('es-BO') : '',
        }));

        const win = window.open('', '_blank');
        this.generandoPdf.set(true);
        this.reportesSvc.exportarPdfTabular(`Inventario Unificado - ${tabLabel}`, 'R-INV-UNIF', columnas, filas).subscribe({
            next: (r) => { this.generandoPdf.set(false); this._abrirPdf(win, r); },
            error: (e) => {
                this.generandoPdf.set(false);
                try { win?.close(); } catch { /* noop */ }
                this.snackBar.open(e?.message || 'Error al generar el reporte', 'OK', { duration: 5000 });
            },
        });
    }

    /** Vuelca el PDF (base64) a la pestaña reservada; descarga si estaba bloqueada. */
    private _abrirPdf(win: Window | null, r: { pdf_base64: string; nombre_archivo: string }): void {
        try {
            const bytes = Uint8Array.from(atob(r.pdf_base64), c => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
            if (win) {
                win.location.href = url;
            } else {
                const a = document.createElement('a');
                a.href = url; a.download = r.nombre_archivo;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch {
            try { win?.close(); } catch { /* noop */ }
            this.snackBar.open('No se pudo abrir el PDF generado', 'OK', { duration: 4000 });
        }
    }


    // ── Helpers de estilo ─────────────────────────────────────────────────────

    getTipoBadgeClass(tipo: ItemType): string {
        const m: Record<ItemType, string> = {
            HERRAMIENTA: 'bg-amber-400 text-black border-black',
            KIT:         'bg-blue-600 text-white border-black',
            MISCELANEO:  'bg-orange-500 text-white border-black',
        };
        return m[tipo] || 'bg-stone-200 text-black border-black';
    }

    getTipoIcon(tipo: ItemType): string {
        return { HERRAMIENTA: 'construction', KIT: 'cases', MISCELANEO: 'category' }[tipo] || 'help';
    }

    getStatusBadgeClass(estado: string): string {
        const m: Record<string, string> = {
            'DISPONIBLE':       'bg-green-500   text-white        border-green-700',
            'BAJO STOCK':       'bg-yellow-100  text-yellow-800   border-yellow-300',
            'SIN STOCK':        'bg-red-100     text-red-800      border-red-300',
            'EN CALIBRACION':   'bg-purple-100  text-purple-800   border-purple-300',
            'EN PRESTAMO':      'bg-blue-100    text-blue-800     border-blue-300',
            'EN USO':           'bg-cyan-100    text-cyan-800     border-cyan-300',
            'EN MANTENIMIENTO': 'bg-amber-100   text-amber-800    border-amber-400',
            'CUARENTENA':       'bg-orange-100  text-orange-800   border-orange-300',
            'COMPLETO':         'bg-green-500   text-white        border-green-700',
            'INCOMPLETO':       'bg-yellow-100  text-yellow-800   border-yellow-300',
            'BAJA':             'bg-stone-200   text-stone-600    border-stone-400',
        };
        return m[estado] || 'bg-stone-100 text-stone-600 border-stone-300';
    }

    getStatusDotClass(estado: string): string {
        const m: Record<string, string> = {
            'DISPONIBLE':       'bg-emerald-500',
            'BAJO STOCK':       'bg-yellow-500',
            'SIN STOCK':        'bg-red-500',
            'EN CALIBRACION':   'bg-purple-500',
            'EN PRESTAMO':      'bg-blue-500',
            'EN USO':           'bg-cyan-500',
            'EN MANTENIMIENTO': 'bg-amber-500',
            'CUARENTENA':       'bg-orange-500',
            'COMPLETO':         'bg-emerald-500',
            'INCOMPLETO':       'bg-yellow-500',
            'BAJA':             'bg-stone-400',
        };
        return m[estado] || 'bg-stone-400';
    }

}
