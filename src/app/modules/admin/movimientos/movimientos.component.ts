import {
    Component, OnInit, OnDestroy, inject,
    Type, Injector, TrackByFunction
} from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, of } from 'rxjs';

// ── Types ─────────────────────────────────────────────────────────────────────

type CategoryTab = 'inter-bases' | 'entradas' | 'salidas';

interface ModuleDef {
    type:      number;
    category:  CategoryTab;
    label:     string;
    sublabel:  string;
    color:     string;
    textColor: string;
    svgIcon:   string;
    loader:    () => Promise<Type<any>>;
}

interface OpenTab {
    id:        number;
    type:      number;
    label:     string;
    sublabel:  string;
    color:     string;
    textColor: string;
    svgIcon:   string;
    component: Type<any>;
    injector:  Injector;
}

// ─────────────────────────────────────────────────────────────────────────────

@Component({
    selector: 'app-movimientos',
    standalone: true,
    imports: [
        CommonModule, NgComponentOutlet,
        MatIconModule, MatDialogModule, MatSnackBarModule, MatTooltipModule
    ],
    templateUrl: './movimientos.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #fff; }

        @keyframes icon-pop {
            0%   { transform: scale(1)    rotate(0deg); }
            35%  { transform: scale(1.4)  rotate(-14deg); }
            65%  { transform: scale(1.15) rotate(7deg); }
            100% { transform: scale(1)    rotate(0deg); }
        }
        .mod-card:hover .mod-icon { animation: icon-pop 0.4s cubic-bezier(0.34,1.56,0.64,1); }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.15s ease-out; }
    `]
})
export class MovimientosComponent implements OnInit, OnDestroy {

    private injector  = inject(Injector);
    private snackBar  = inject(MatSnackBar);

    private _unsub$ = new Subject<void>();

    // ── Category tabs ─────────────────────────────────────────────────────────
    activeCategory: CategoryTab = 'inter-bases';

    readonly categories: { id: CategoryTab; label: string; svgIcon: string; accentBg: string }[] = [
        { id: 'inter-bases', label: 'INTER-BASES', svgIcon: 'heroicons_outline:arrows-right-left',    accentBg: '#1E40AF' },
        { id: 'entradas',    label: 'ENTRADAS',    svgIcon: 'heroicons_outline:arrow-up-tray',        accentBg: '#15803D' },
        { id: 'salidas',     label: 'SALIDAS',     svgIcon: 'heroicons_outline:arrow-down-tray',      accentBg: '#B91C1C' },
    ];

    // ── Open sub-module tabs ──────────────────────────────────────────────────
    openTabs:    OpenTab[] = [];
    activeTabId: number | null = null;
    private tabCounter = 0;

    // ── Module definitions ────────────────────────────────────────────────────
    readonly MODULE_DEFS: ModuleDef[] = [

        // ── INTER-BASES ───────────────────────────────────────────────────────
        {
            type: 10, category: 'inter-bases',
            label: 'ENV · TRP · RB', sublabel: 'INTER-BASES + MGH-109',
            color: '#0F172A', textColor: '#FFC501',
            svgIcon: 'heroicons_outline:arrows-right-left',
            loader: async () => (await import('./retorno-traspaso/retorno-traspaso.component')).RetornoTraspasoComponent
        },

        // ── ENTRADAS ──────────────────────────────────────────────────────────
        {
            type: 21, category: 'entradas',
            label: 'NUEVA', sublabel: 'HERRAMIENTA',
            color: '#15803d', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:wrench-screwdriver',
            loader: async () => (await import('./nueva-herramienta/nueva-herramienta.component')).NuevaHerramientaComponent
        },
        {
            type: 22, category: 'entradas',
            label: 'AJUSTE', sublabel: 'POR INGRESO',
            color: '#15803d', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:adjustments-horizontal',
            loader: async () => (await import('./ajuste-ingreso/ajuste-ingreso.component')).AjusteIngresoComponent
        },
        {
            type: 23, category: 'entradas',
            label: 'DEVOLUCIÓN', sublabel: 'PRÉSTAMO TÉC.',
            color: '#15803d', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:arrow-uturn-left',
            loader: async () => (await import('./devolucion-herramienta/devolucion-herramienta.component')).DevolucionHerramientaComponent
        },
        {
            type: 24, category: 'entradas',
            label: 'DEVOLUCIÓN', sublabel: 'TERCEROS',
            color: '#15803d', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:user-circle',
            loader: async () => (await import('./devolucion-terceros/devolucion-terceros.component')).DevolucionTercerosComponent
        },

        // ── SALIDAS ───────────────────────────────────────────────────────────
        {
            type: 31, category: 'salidas',
            label: 'PRÉSTAMO', sublabel: 'TÉC. / OTROS',
            color: '#b91c1c', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:building-storefront',
            loader: async () => (await import('./prestamo-terceros/prestamo-terceros.component')).PrestamoTercerosComponent
        },
        {
            type: 32, category: 'salidas',
            label: 'CUARENTENA', sublabel: 'DE ACTIVO',
            color: '#b91c1c', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:exclamation-triangle',
            loader: async () => (await import('./poner-cuarentena/poner-cuarentena.component')).PonerCuarentenaComponent
        },
        {
            type: 33, category: 'salidas',
            label: 'BAJA', sublabel: 'DE ACTIVO',
            color: '#b91c1c', textColor: '#ffffff',
            svgIcon: 'heroicons_outline:trash',
            loader: async () => (await import('./baja/baja.component')).BajaComponent
        },
    ];

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    ngOnInit(): void {}
    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    // ── Helpers ───────────────────────────────────────────────────────────────

    setCategory(cat: CategoryTab): void { this.activeCategory = cat; }

    getModulesForCategory(cat?: CategoryTab): ModuleDef[] {
        return this.MODULE_DEFS.filter(m => m.category === (cat ?? this.activeCategory));
    }

    isTabOpen(type: number): boolean { return this.openTabs.some(t => t.type === type); }

    // ── Tab management ────────────────────────────────────────────────────────

    async openModule(type: number): Promise<void> {
        const existing = this.openTabs.find(t => t.type === type);
        if (existing) { this.activeTabId = existing.id; return; }

        const def = this.MODULE_DEFS.find(d => d.type === type);
        if (!def) return;

        try {
            const component = await def.loader();
            const id = ++this.tabCounter;
            const self = this;
            const fakeRef = {
                close:             () => self.closeTab(id),
                afterClosed:       () => of(null),
                beforeClosed:      () => of(null),
                afterOpened:       () => of(null),
                backdropClick:     () => of(null),
                keydownEvents:     () => of(null),
                updatePosition:    () => fakeRef,
                updateSize:        () => fakeRef,
                addPanelClass:     () => fakeRef,
                removePanelClass:  () => fakeRef,
                disableClose:      false,
                id:                String(id),
                componentInstance: null,
            };

            const childInjector = Injector.create({
                parent: this.injector,
                providers: [{ provide: MatDialogRef, useValue: fakeRef }]
            });

            this.openTabs.push({
                id, type: def.type,
                label: def.label, sublabel: def.sublabel,
                color: def.color, textColor: def.textColor,
                svgIcon: def.svgIcon,
                component, injector: childInjector
            });
            this.activeTabId = id;
        } catch (e) {
            console.error('Error loading module', e);
            this.snackBar.open('Error al cargar módulo', 'OK', { duration: 3000 });
        }
    }

    closeTab(id: number, event?: MouseEvent): void {
        event?.stopPropagation();
        const idx = this.openTabs.findIndex(t => t.id === id);
        if (idx === -1) return;
        this.openTabs.splice(idx, 1);
        if (this.activeTabId === id) {
            this.activeTabId = this.openTabs.length
                ? this.openTabs[Math.max(0, idx - 1)].id
                : null;
        }
    }

    setActiveTab(id: number): void { this.activeTabId = id; }

    trackByTabId: TrackByFunction<OpenTab> = (_, t) => t.id;
}
