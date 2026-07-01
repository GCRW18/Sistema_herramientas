import {
    Component, OnInit, inject, signal, computed, ViewEncapsulation, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ToolService }        from 'app/core/services/tool.service';
import { KitsService }        from 'app/core/services/kits.service';
import { MiscelaneosService } from 'app/core/services/miscelaneos.service';
import { WarehouseService }   from 'app/core/services/warehouse.service';
import { MovementService }    from 'app/core/services/movement.service';
import { GestionUbicacionesService } from '../gestion-ubicaciones/gestion-ubicaciones.service';
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
    unidad?:              string;
    // Ubicación descompuesta
    ubicacion:            string;
    almacen?:             string;
    nivelFisico?:         string;
    // Stock
    stockActual:          number;
    stockMinimo?:         number;
    stockMaximo?:         number;
    // Estado
    estado:               UnifiedStatus;
    condicion?:           string;
    // Extras herramientas
    requiresCalibration?: boolean;
    fechaCalibracion?:    Date;
    proximaCalibracion?:  Date;
    estadoFisico?:        string;
    nivelCriticidad?:     string;
    fabricacion?:         string;
    intervaloCalibracion?: number;
    nroCertificado?:      string;
    imagen?:              string;
    valorUnitario?:       number;
    proveedor?:           string;
    fechaCompra?:         Date;
    notas?:               string;
    // Extras kits
    totalComponentes?:    number;
    responsable?:         string;
    // Extras misceláneos
    tipoItem?:            string;
    // Metadatos
    ultimoMovimiento?:    Date;
    fechaRegistro:        Date;
    activo:               boolean;
    _raw?:                any;
}

interface CommandFilters {
    tipo?:       string;
    stockDesde?: number;
    stockHasta?: number;
    estado?:     string;
    categoria?:  string;
    ubicacion?:  string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
    selector:      'app-consultar-inventario',
    standalone:    true,
    imports: [
        CommonModule, RouterModule, FormsModule,
        MatIconModule, MatTooltipModule
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
    private router            = inject(Router);
    private dialog            = inject(MatDialog);
    private toolService       = inject(ToolService);
    private kitsService       = inject(KitsService);
    private miscelaneosService = inject(MiscelaneosService);
    private warehouseService  = inject(WarehouseService);
    private movementService   = inject(MovementService);
    private ubicacionesService = inject(GestionUbicacionesService);
    public  dialogRef         = inject(MatDialogRef<ConsultarInventarioComponent>, { optional: true });

    // ── Estado principal ──────────────────────────────────────────────────────
    inventoryData = signal<UnifiedItem[]>([]);
    isLoading     = signal(false);

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
    commandSearch     = signal('');
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
    stockDesde        = signal<number | null>(null);
    stockHasta        = signal<number | null>(null);
    periodoMovimiento = signal<string>('todo');

    // ── Paginación ────────────────────────────────────────────────────────────
    readonly pageSize = 50;
    currentPage = signal(1);

    // ── Detalle de ítem (abre como MatDialog) ────────────────────────────────
    // Los signals de detalle ya no viven aquí — los gestiona FichaInventarioDialogComponent
    selectedItemId = signal<string | null>(null);   // internalId de la fila activa (gris)

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

        // 2. Filtros por comandos (parseados)
        const cmd = this.parseCommand(this.commandSearch());
        if (cmd.tipo) {
            data = data.filter(i => i.tipo === cmd.tipo);
        }
        if (cmd.estado) {
            data = data.filter(i => i.estado === cmd.estado);
        }
        if (cmd.categoria) {
            data = data.filter(i =>
                (i.categoria || '').toLowerCase().includes(cmd.categoria!.toLowerCase())
            );
        }
        if (cmd.ubicacion) {
            data = data.filter(i =>
                (i.ubicacion || '').toLowerCase().includes(cmd.ubicacion!.toLowerCase())
            );
        }
        if (cmd.stockDesde != null) {
            data = data.filter(i => i.stockActual >= cmd.stockDesde!);
        }
        if (cmd.stockHasta != null) {
            data = data.filter(i => i.stockActual <= cmd.stockHasta!);
        }

        // 3. Filtros clásicos
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
        if (this.stockDesde() != null) {
            data = data.filter(i => i.stockActual >= this.stockDesde()!);
        }
        if (this.stockHasta() != null) {
            data = data.filter(i => i.stockActual <= this.stockHasta()!);
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
        this.commandSearch()       !== '' ||
        this.selectedTipo()        !== 'todos' ||
        this.selectedCategoria()   !== 'todas' ||
        this.selectedEstado()      !== 'todos' ||
        this.ubicacionSearch()     !== ''      ||
        this.stockDesde()          !== null  ||
        this.stockHasta()          !== null  ||
        this.periodoMovimiento()   !== 'todo'
    );

    // ── Ciclo de vida ─────────────────────────────────────────────────────────

    constructor() {
        // Resetear página cuando cambia cualquier filtro o pestaña
        effect(() => {
            // Leer todos los signals de filtro para que el effect se re-ejecute cuando cambien
            this.searchTerm(); this.commandSearch();
            this.selectedTipo(); this.selectedCategoria();
            this.selectedEstado(); this.ubicacionSearch();
            this.stockDesde(); this.stockHasta();
            this.periodoMovimiento(); this.activeTab();
            // Resetear sin untracked para evitar loop — usamos un timeout micro
            Promise.resolve().then(() => this.currentPage.set(1));
        }, { allowSignalWrites: true });
    }

    ngOnInit(): void {
        this.loadInventory();
    }

    // ── Carga de datos ────────────────────────────────────────────────────────

    loadInventory(): void {
        this.isLoading.set(true);
        this.inventoryData.set([]);

        forkJoin({
            tools:      this.toolService.getTools().pipe(catchError(() => of([]))),
            kits:       this.kitsService.getKits({ limit: 1000 }).pipe(catchError(() => of([]))),
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
        // Ubicación real (rack/nivel), la misma que gestion-ubicaciones — tiene
        // prioridad porque es lo que mover-herramientas efectivamente actualiza.
        // ttools.location_id (lMap) es un esquema paralelo que nunca se sincroniza
        // con los movimientos de estante/nivel, así que solo se usa como fallback.
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

        const condicionMap: Record<string, string> = {
            new: 'EXCELENTE', excellent: 'EXCELENTE',
            good: 'BUENO', fair: 'REGULAR', poor: 'MALO', damaged: 'MALO',
        };
        const estadoFisicoMap: Record<string, string> = {
            new: 'NUEVO', reconditioned: 'REACONDICIONADO', good: 'USADO',
        };

        let imagen: string | undefined;
        if (t.image_url)     imagen = t.image_url;
        else if (t.image_base64) imagen = `data:image/jpeg;base64,${t.image_base64}`;

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
            unidad:              t.unit_of_measure || 'UNIDAD',
            ubicacion,
            almacen:             wName,
            nivelFisico:         lName,
            stockActual:         t.quantity_in_stock ?? 0,
            stockMinimo:         0,
            stockMaximo:         undefined,
            estado,
            condicion:            condicionMap[t.condition] || 'BUENO',
            requiresCalibration:  !!t.requires_calibration,
            fechaCalibracion:     t.last_calibration_date  ? new Date(t.last_calibration_date)  : undefined,
            proximaCalibracion:   t.next_calibration_date  ? new Date(t.next_calibration_date)  : undefined,
            estadoFisico:         estadoFisicoMap[t.condition] || undefined,
            nivelCriticidad:      t.criticality_level        || undefined,
            fabricacion:          t.manufacture_origin        || undefined,
            intervaloCalibracion: t.calibration_interval      ?? undefined,
            nroCertificado:       t.calibration_certificate   || undefined,
            imagen,
            valorUnitario:       t.purchase_price  ?? undefined,
            proveedor:           t.supplier         || undefined,
            fechaCompra:         t.purchase_date    ? new Date(t.purchase_date) : undefined,
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
            descripcion:      k.description  || undefined,
            categoria:        k.category     || undefined,
            unidad:           'Kit',
            ubicacion,
            almacen:          k.location_name || undefined,
            stockActual:      k.available_quantity ?? 1,   // kits disponibles
            stockMinimo:      1,
            totalComponentes: k.total_components   ?? 0,
            responsable:      k.funcionario_nombre  || undefined,
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
        // getMiscelaneos() retorna objetos Material ya mapeados:
        //   m.id, m.codigoBoaM, m.producto, m.pn, m.marca,
        //   m.tipoItem, m.stock, m.stockMin, m.stockMax, m.ubicacion, m.activo
        // Se soportan también los campos raw por compatibilidad.
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
            unidad:       (m.unidad      || m.unit_of_measure)?.trim() || 'UND',
            ubicacion,
            almacen:      ubicacion !== 'Sin ubicación' ? ubicacion : undefined,
            stockActual:  stock,
            stockMinimo:  stockMin || undefined,
            stockMaximo:  Number(m.stockMax ?? m.stock_max ?? 0) || undefined,
            estado,
            ultimoMovimiento: m.fecha
                ? new Date(m.fecha)
                : m.fecha_mod
                    ? new Date(m.fecha_mod)
                    : m.fecha_reg ? new Date(m.fecha_reg) : undefined,
            fechaRegistro:    m.fecha
                ? new Date(m.fecha)
                : m.fecha_reg ? new Date(m.fecha_reg) : new Date(),
            activo: m.activo ?? (m.active === true || m.active === 't' || m.active === 'true'),
            _raw:   m,
        };
    }

    // ── Parser de comandos ────────────────────────────────────────────────────

    parseCommand(cmd: string): CommandFilters {
        if (!cmd.trim()) return {};
        const result: CommandFilters = {};

        const tipoMatch = cmd.match(/tipo:(\w+)/i);
        if (tipoMatch) {
            const t = tipoMatch[1].toUpperCase();
            const tipoMap: Record<string, string> = {
                HERRAMIENTA: 'HERRAMIENTA', HERRAMIENTAS: 'HERRAMIENTA',
                KIT: 'KIT', KITS: 'KIT',
                MISCELANEO: 'MISCELANEO', MISCELANEOS: 'MISCELANEO',
                MISC: 'MISCELANEO',
            };
            result.tipo = tipoMap[t] as ItemType;
        }

        const stockLtMatch = cmd.match(/stock[<≤](\d+)/i);
        if (stockLtMatch) result.stockHasta = parseInt(stockLtMatch[1], 10);

        const stockGtMatch = cmd.match(/stock[>≥](\d+)/i);
        if (stockGtMatch) result.stockDesde = parseInt(stockGtMatch[1], 10);

        const estadoMatch = cmd.match(/estado:(\w+)/i);
        if (estadoMatch) {
            const estadoMap: Record<string, UnifiedStatus> = {
                disponible:    'DISPONIBLE',
                prestado:      'EN PRESTAMO',
                uso:           'EN USO',
                agotado:       'SIN STOCK',
                sinstock:      'SIN STOCK',
                critico:       'SIN STOCK',
                calibracion:   'EN CALIBRACION',
                mantenimiento: 'EN MANTENIMIENTO',
                cuarentena:    'CUARENTENA',
                completo:      'COMPLETO',
                incompleto:    'INCOMPLETO',
                baja:          'BAJA',
                bajostock:     'BAJO STOCK',
            };
            result.estado = estadoMap[estadoMatch[1].toLowerCase()];
        }

        const catMatch = cmd.match(/categoria:["']?([^"'\s]+)["']?/i);
        if (catMatch) result.categoria = catMatch[1];

        const ubMatch = cmd.match(/ubicacion:["']([^"']+)["']|ubicacion:(\S+)/i);
        if (ubMatch) result.ubicacion = ubMatch[1] || ubMatch[2];

        return result;
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
        this.commandSearch.set('');
        this.selectedTipo.set('todos');
        this.selectedCategoria.set('todas');
        this.selectedEstado.set('todos');
        this.ubicacionSearch.set('');
        this.showUbicacionDrop.set(false);
        this.stockDesde.set(null);
        this.stockHasta.set(null);
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
        ref.afterClosed().subscribe(() => this.selectedItemId.set(null));
    }

    // ── Imprimir / Guardar como PDF ───────────────────────────────────────────

    imprimirListado(): void {
        const data  = this.tabFilteredData();
        const fecha = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora  = new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

        const tabLabels: Record<string, string> = {
            todos: 'Todos los ítems', herramientas: 'Herramientas',
            kits: 'Kits', miscelaneos: 'Misceláneos',
            critico: 'Stock Crítico', prestados: 'En uso / Prestados',
        };
        const tabLabel = tabLabels[this.activeTab()] ?? 'Inventario';

        const tipoColors: Record<string, string> = {
            HERRAMIENTA: '#92400e',   // amber-800
            KIT:         '#1e3a8a',   // blue-900
            MISCELANEO:  '#c2410c',   // orange-700
        };
        const estadoColors: Record<string, string> = {
            'DISPONIBLE':       '#065f46',
            'BAJO STOCK':       '#854d0e',
            'SIN STOCK':        '#991b1b',
            'EN CALIBRACION':   '#581c87',
            'EN PRESTAMO':      '#1e40af',
            'EN USO':           '#0e7490',
            'EN MANTENIMIENTO': '#92400e',
            'CUARENTENA':       '#9a3412',
            'COMPLETO':         '#065f46',
            'INCOMPLETO':       '#854d0e',
            'BAJA':             '#44403c',
        };

        const rows = data.map((i, idx) => {
            const tipoC   = tipoColors[i.tipo]      ?? '#374151';
            const estadoC = estadoColors[i.estado]  ?? '#374151';
            const stockColor =
                i.stockActual === 0                                                  ? '#991b1b' :
                (i.stockMinimo != null && i.stockActual <= i.stockMinimo)             ? '#854d0e' :
                                                                                       '#111827';
            const bg = idx % 2 === 0 ? '#fff' : '#f9fafb';
            return `
            <tr style="background:${bg}; page-break-inside: avoid;">
                <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; vertical-align:middle;">
                    <span style="display:inline-block; padding:2px 6px; background:${tipoC}; color:#fff; font-size:9px; font-weight:900; border-radius:3px; text-transform:uppercase; letter-spacing:.5px;">
                        ${i.tipo === 'HERRAMIENTA' ? 'HERR.' : i.tipo === 'MISCELANEO' ? 'MISC.' : i.tipo}
                    </span>
                </td>
                <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-family:monospace; font-size:10px; font-weight:700;">
                    ${i.codigo}
                    ${i.partNumber   ? `<br><span style="color:#6b7280; font-size:9px;">P/N ${i.partNumber}</span>`   : ''}
                    ${i.serialNumber ? `<br><span style="color:#6b7280; font-size:9px;">S/N ${i.serialNumber}</span>` : ''}
                </td>
                <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; max-width:200px;">
                    <div style="font-size:11px; font-weight:700;">${i.nombre}</div>
                    ${i.marca ? `<div style="font-size:9px; color:#6b7280;">${i.marca}</div>` : ''}
                </td>
                <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-size:10px; color:#374151;">${i.categoria || '—'}</td>
                <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-size:10px; max-width:140px;">${i.ubicacion}</td>
                <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:900; font-size:14px; color:${stockColor};">
                    ${i.stockActual}
                    ${(i.stockMinimo ?? 0) > 0 ? `<br><span style="font-size:8px; color:#9ca3af; font-weight:400;">mín ${i.stockMinimo}</span>` : ''}
                    <br><span style="font-size:8px; color:#9ca3af; font-weight:400;">${i.unidad ?? ''}</span>
                </td>
                <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; text-align:center;">
                    <span style="display:inline-block; padding:2px 6px; background:${estadoC}20; color:${estadoC}; border:1px solid ${estadoC}60; font-size:8px; font-weight:900; border-radius:3px; text-transform:uppercase; white-space:nowrap;">
                        ${i.estado}
                    </span>
                </td>
                <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-size:9px; color:#6b7280; text-align:center;">
                    ${i.ultimoMovimiento ? i.ultimoMovimiento.toLocaleDateString('es-BO') : '—'}
                </td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Inventario Unificado — ${tabLabel} — ${fecha}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111827; background: #fff; }

  /* ── Encabezado ── */
  .page-header { background: #0F172A; color: #fff; padding: 16px 24px; display: flex; align-items: flex-start; justify-content: space-between; }
  .page-header-title { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; }
  .page-header-sub   { font-size: 10px; font-weight: 700; background: #FFC501; color: #000; display: inline-block; padding: 2px 8px; border-radius: 4px; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; }
  .page-header-meta  { text-align: right; font-size: 10px; color: #94a3b8; line-height: 1.6; }
  .page-header-meta strong { color: #FFC501; }

  /* ── Resumen KPIs ── */
  .kpi-row { display: flex; gap: 12px; padding: 12px 24px; background: #f8f9fc; border-bottom: 2px solid #e5e7eb; }
  .kpi-chip { display: flex; flex-direction: column; align-items: center; padding: 8px 16px; border: 2px solid #000; border-radius: 8px; background: #fff; min-width: 80px; }
  .kpi-chip .kpi-val { font-size: 20px; font-weight: 900; line-height: 1; }
  .kpi-chip .kpi-lbl { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-top: 2px; letter-spacing: .5px; }
  .kpi-chip.critico .kpi-val { color: #991b1b; }
  .kpi-chip.prestado .kpi-val { color: #1e40af; }

  /* ── Tabla ── */
  .table-wrap { padding: 16px 24px; }
  .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .8px; color: #374151; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
  .section-title::after { content: ''; flex: 1; height: 2px; background: #e5e7eb; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #0F172A; color: #fff; padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .6px; }
  thead th:nth-child(6), thead th:nth-child(7), thead th:nth-child(8) { text-align: center; }
  tbody tr:hover { background: #f0fdf4; }

  /* ── Pie de página ── */
  .page-footer { margin: 0 24px; padding: 10px 0; border-top: 2px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
  .page-footer p { font-size: 9px; color: #9ca3af; }

  /* ── Print ── */
  @media print {
    @page { margin: 12mm 10mm; size: A4 landscape; }
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead { display: table-header-group; }
    tbody tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>

  <!-- Encabezado -->
  <div class="page-header">
    <div>
      <div class="page-header-title">INVENTARIO UNIFICADO</div>
      <span class="page-header-sub">${tabLabel}</span>
    </div>
    <div class="page-header-meta">
      <strong>Fecha:</strong> ${fecha} ${hora}<br>
      <strong>Total de ítems:</strong> ${data.length}<br>
      <strong>Sistema de Herramientas — BOA</strong>
    </div>
  </div>

  <!-- KPIs -->
  <div class="kpi-row">
    <div class="kpi-chip">
      <span class="kpi-val">${data.length}</span>
      <span class="kpi-lbl">Total</span>
    </div>
    <div class="kpi-chip">
      <span class="kpi-val">${data.filter(i => i.tipo === 'HERRAMIENTA').length}</span>
      <span class="kpi-lbl">Herramientas</span>
    </div>
    <div class="kpi-chip">
      <span class="kpi-val">${data.filter(i => i.tipo === 'KIT').length}</span>
      <span class="kpi-lbl">Kits</span>
    </div>
    <div class="kpi-chip">
      <span class="kpi-val">${data.filter(i => i.tipo === 'MISCELANEO').length}</span>
      <span class="kpi-lbl">Misceláneos</span>
    </div>
    <div class="kpi-chip critico">
      <span class="kpi-val">${data.filter(i => i.stockActual === 0 || ((i.stockMinimo ?? 0) > 0 && i.stockActual <= (i.stockMinimo ?? 0))).length}</span>
      <span class="kpi-lbl">Stock crítico</span>
    </div>
    <div class="kpi-chip prestado">
      <span class="kpi-val">${data.filter(i => i.estado === 'EN PRESTAMO' || i.estado === 'EN USO').length}</span>
      <span class="kpi-lbl">Prestados</span>
    </div>
  </div>

  <!-- Tabla -->
  <div class="table-wrap">
    <div class="section-title">Listado de inventario — ${tabLabel}</div>
    <table>
      <thead>
        <tr>
          <th style="width:60px">Tipo</th>
          <th style="width:110px">Código / P·N</th>
          <th>Nombre · Marca</th>
          <th style="width:90px">Categoría</th>
          <th style="width:130px">Ubicación</th>
          <th style="width:65px; text-align:center">Stock</th>
          <th style="width:100px; text-align:center">Estado</th>
          <th style="width:80px; text-align:center">Últ. mov.</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>

  <!-- Pie -->
  <div class="page-footer">
    <p>Sistema de Gestión de Herramientas · BOA</p>
    <p>Generado el ${fecha} a las ${hora} · ${data.length} ítems</p>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=1200,height=800');
        if (win) {
            win.document.write(html);
            win.document.close();
        }
    }

    // ── Helpers de navegación ─────────────────────────────────────────────────

    cerrar(): void {
        if (this.dialogRef) this.dialogRef.close();
        else                this.router.navigate(['/dashboard']);
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
            'DISPONIBLE':       'bg-green-700   text-white        border-green-900',
            'BAJO STOCK':       'bg-yellow-100  text-yellow-800   border-yellow-300',
            'SIN STOCK':        'bg-red-100     text-red-800      border-red-300',
            'EN CALIBRACION':   'bg-purple-100  text-purple-800   border-purple-300',
            'EN PRESTAMO':      'bg-blue-100    text-blue-800     border-blue-300',
            'EN USO':           'bg-cyan-100    text-cyan-800     border-cyan-300',
            'EN MANTENIMIENTO': 'bg-amber-100   text-amber-800    border-amber-400',
            'CUARENTENA':       'bg-orange-100  text-orange-800   border-orange-300',
            'COMPLETO':         'bg-green-700   text-white        border-green-900',
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

    getCondicionBadgeClass(condicion: string): string {
        const m: Record<string, string> = {
            'EXCELENTE': 'bg-green-100  text-green-800  border-green-300',
            'BUENO':     'bg-blue-100   text-blue-800   border-blue-300',
            'REGULAR':   'bg-yellow-100 text-yellow-800 border-yellow-300',
            'MALO':      'bg-red-100    text-red-800    border-red-300',
        };
        return m[condicion] || 'bg-stone-100 text-stone-600 border-stone-300';
    }

    getMovBadgeClass(tipo: string): string {
        return tipo === 'ENTRADA'
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-red-100     text-red-700     border-red-200';
    }

}
