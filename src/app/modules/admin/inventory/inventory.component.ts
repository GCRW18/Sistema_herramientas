import { Component, OnDestroy, inject, ViewChild, TemplateRef, Type, Injector, TrackByFunction } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';

interface OpenTab {
    id: number;
    type: number;
    label: string;
    sublabel: string;
    color: string;
    textColor: string;
    svgIcon: string;
    component: Type<any>;
    injector: Injector;
}

interface ModuleDef {
    type: number;
    label: string;
    sublabel: string;
    color: string;
    textColor: string;
    svgIcon: string;
    loader: () => Promise<Type<any>>;
}

@Component({
    selector: 'app-inventory',
    standalone: true,
    imports: [
        CommonModule,
        NgComponentOutlet,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatTableModule,
        MatPaginatorModule
    ],
    templateUrl: './inventory.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        .header-neo {
            background-color: white !important;
            color: #111A43 !important;
            font-weight: 900 !important;
            font-size: 14px !important;
            border-bottom: 3px solid black !important;
            padding: 20px !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .cell-neo {
            padding: 18px 20px !important;
            border-bottom: 1px solid #000000 !important;
            font-size: 14px !important;
            color: black;
        }

        :host-context(.dark) .header-neo {
            background-color: #111A43 !important;
            color: white !important;
        }

        :host-context(.dark) .cell-neo {
            color: white;
            border-bottom-color: #333;
        }

        .neo-card-base-inv {
            border: 2px solid black !important;
            box-shadow: 4px 4px 0px 0px rgba(0,0,0,1) !important;
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base-inv {
            background-color: #1e293b !important;
        }

        .spinner-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
        }

        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }

        .custom-scrollbar-inv::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-inv::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-inv::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar-inv::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class InventoryComponent implements OnDestroy {
    private dialog   = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private injector = inject(Injector);

    private _unsubscribeAll = new Subject<void>();

    @ViewChild('consultarInventarioDialog') consultarInventarioDialog!: TemplateRef<any>;

    // ── Tab system ───────────────────────────────────────────────────────────
    openTabs: OpenTab[] = [];
    activeTabId: number | null = null;
    showBandeja = false;
    private tabCounter = 0;

    private readonly MODULE_DEFS: ModuleDef[] = [
        {
            type: 1, label: 'ALMACÉN Y', sublabel: 'UBICACIONES',
            color: '#FF6A00', textColor: '#fff',
            svgIcon: 'heroicons_outline:building-storefront',
            loader: async () => (await import('./gestion-ubicaciones/gestion-ubicaciones.component')).GestionUbicacionesComponent
        },
        {
            type: 2, label: 'CREAR', sublabel: 'MATERIAL',
            color: '#FFC501', textColor: '#000',
            svgIcon: 'heroicons_outline:plus-circle',
            loader: async () => (await import('./crear-material/crear-material.component')).CrearMaterialComponent
        },
        {
            type: 3, label: 'ENTRADA', sublabel: 'MATERIAL',
            color: '#1AAA1F', textColor: '#fff',
            svgIcon: 'heroicons_outline:arrow-down-tray',
            loader: async () => (await import('./entrada-material/entrada-material.component')).EntradaMaterialComponent
        },
        {
            type: 4, label: 'SALIDA', sublabel: 'MATERIAL',
            color: '#e94125', textColor: '#fff',
            svgIcon: 'heroicons_outline:arrow-up-tray',
            loader: async () => (await import('./salida-material/salida-material.component')).SalidaMaterialComponent
        },
        {
            type: 5, label: 'HISTORIAL', sublabel: 'ESTADOS',
            color: '#0891b2', textColor: '#fff',
            svgIcon: 'heroicons_outline:clock',
            loader: async () => (await import('./historial-estados/historial-estados.component')).HistorialEstadosComponent
        },
        {
            type: 6, label: 'MIGRACIÓN', sublabel: 'EXCEL',
            color: '#16a34a', textColor: '#fff',
            svgIcon: 'heroicons_outline:cloud-arrow-up',
            loader: async () => (await import('./migracion-excel/migracion-excel.component')).MigracionExcelComponent
        },
        {
            type: 7, label: 'GESTIÓN', sublabel: 'KITS',
            color: '#1A3EDC', textColor: '#fff',
            svgIcon: 'heroicons_outline:cube',
            loader: async () => (await import('./lista-kits/lista-kits.component')).ListaKitsComponent
        },
        {
            type: 8, label: 'REPORTES', sublabel: '',
            color: '#7113CF', textColor: '#fff',
            svgIcon: 'heroicons_outline:chart-bar',
            loader: async () => (await import('./reportes/reportes-inventario.component')).ReportesInventarioComponent
        },
    ];

    // ── Tab system methods ───────────────────────────────────────────────────

    toggleBandeja(): void {
        this.showBandeja = !this.showBandeja;
    }

    closeBandeja(): void {
        this.showBandeja = false;
    }

    isTabOpen(type: number): boolean {
        return this.openTabs.some(t => t.type === type);
    }

    async openModule(type: number): Promise<void> {
        this.showBandeja = false;

        const existing = this.openTabs.find(t => t.type === type);
        if (existing) {
            this.activeTabId = existing.id;
            return;
        }

        const def = this.MODULE_DEFS.find(d => d.type === type)!;
        const component = await def.loader();
        const id = ++this.tabCounter;

        const self = this;
        const fakeRef = {
            close:            () => self.closeTab(id),
            afterClosed:      () => of(null),
            beforeClosed:     () => of(null),
            backdropClick:    () => of(null),
            keydownEvents:    () => of(null),
            updatePosition:   () => {},
            updateSize:       () => {},
            addPanelClass:    () => {},
            removePanelClass: () => {},
            disableClose: false,
            id: `tab-${id}`,
            componentInstance: null,
        };
        const tabInjector = Injector.create({
            providers: [{ provide: MatDialogRef, useValue: fakeRef }],
            parent: this.injector
        });

        this.openTabs.push({ id, type, label: def.label, sublabel: def.sublabel, color: def.color, textColor: def.textColor, svgIcon: def.svgIcon, component, injector: tabInjector });
        this.activeTabId = id;
    }

    setActiveTab(id: number): void {
        this.activeTabId = id;
    }

    closeTab(id: number): void {
        const idx = this.openTabs.findIndex(t => t.id === id);
        if (idx === -1) return;
        this.openTabs.splice(idx, 1);
        if (this.activeTabId === id) {
            this.activeTabId = this.openTabs.length > 0
                ? this.openTabs[Math.max(0, idx - 1)].id
                : null;
        }
    }

    trackByTabId: TrackByFunction<OpenTab> = (_index, tab) => tab.id;

    // ── Consultar Inventario (dialog desde header) ────────────────────────────

    async openConsultarInventario(): Promise<void> {
        const { ConsultarInventarioComponent } = await import('./consultar-inventario/consultar-inventario.component');
        this.dialog.open(ConsultarInventarioComponent, {
            width: '1200px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }
}
