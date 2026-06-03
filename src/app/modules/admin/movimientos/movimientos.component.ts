import {
    Component, OnInit, OnDestroy, inject,
    Type, Injector, TrackByFunction, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, of } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModuleDef {
    type:      number;
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
        .header-btn:hover .header-btn-icon {
            animation: icon-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
    `]
})
export class MovimientosComponent implements OnInit, OnDestroy {

    private injector      = inject(Injector);
    private router        = inject(Router);
    private snackBar      = inject(MatSnackBar);
    private iconRegistry  = inject(MatIconRegistry);
    private sanitizer     = inject(DomSanitizer);
    private cdr           = inject(ChangeDetectorRef);

    private _unsub$ = new Subject<void>();

    // ── Tab system ────────────────────────────────────────────────────────────
    openTabs:    OpenTab[] = [];
    activeTabId: number | null = null;
    showBandeja  = false;
    private tabCounter = 0;

    readonly MODULE_DEFS: ModuleDef[] = [
        {
            type: 10, label: 'INTER-BASES', sublabel: 'ENV·TRP·RB',
            color: '#0F172A', textColor: '#FFC501',
            svgIcon: 'heroicons_outline:arrows-right-left',
            loader: async () => (await import('./retorno-traspaso/retorno-traspaso.component')).RetornoTraspasoComponent
        },
        {
            type: 20, label: 'PRÉSTAMO', sublabel: 'TÉC. BOA',
            color: '#1a3edc', textColor: '#fff',
            svgIcon: 'heroicons_outline:user-circle',
            loader: async () => (await import('./prestamo-tecnico-hub/prestamo-tecnico-hub.component')).PrestamoTecnicoHubComponent
        },
        {
            type: 21, label: 'PRÉSTAMO', sublabel: 'TERCEROS',
            color: '#7113CF', textColor: '#fff',
            svgIcon: 'heroicons_outline:building-storefront',
            loader: async () => (await import('./prestamo-externo-hub/prestamo-externo-hub.component')).PrestamoExternoHubComponent
        },
        {
            type: 22, label: 'INGRESOS', sublabel: 'ALMACÉN',
            color: '#15803d', textColor: '#fff',
            svgIcon: 'heroicons_outline:arrow-up-tray',
            loader: async () => (await import('./ingresos-hub/ingresos-hub.component')).IngresosHubComponent
        },
        {
            type: 33, label: 'CUARENTENA', sublabel: '& BAJA',
            color: '#b91c1c', textColor: '#fff',
            svgIcon: 'heroicons_outline:exclamation-triangle',
            loader: async () => (await import('./cuarentena-baja-hub/cuarentena-baja-hub.component')).CuarentenaBajaHubComponent
        },
    ];

    constructor() {
        this.registerIcons();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    ngOnInit(): void {}
    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    irAReportes(): void {
        this.router.navigate(['/inventario'], { queryParams: { tab: 'reportes' } });
    }

    // ── Bandeja ───────────────────────────────────────────────────────────────
    toggleBandeja(): void {
        this.showBandeja = !this.showBandeja;
        this.cdr.detectChanges();
    }

    closeBandeja(): void {
        this.showBandeja = false;
        this.cdr.detectChanges();
    }

    // ── Tab helpers ───────────────────────────────────────────────────────────
    isTabOpen(type: number): boolean { return this.openTabs.some(t => t.type === type); }

    async openModule(type: number): Promise<void> {
        this.showBandeja = false;

        const existing = this.openTabs.find(t => t.type === type);
        if (existing) {
            this.activeTabId = existing.id;
            this.cdr.detectChanges();
            return;
        }

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
                updatePosition:    () => {},
                updateSize:        () => {},
                addPanelClass:     () => {},
                removePanelClass:  () => {},
                disableClose:      false,
                id:                `tab-${id}`,
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
            this.cdr.detectChanges();
        } catch (e) {
            console.error('Error loading module', e);
            this.snackBar.open('Error al cargar módulo', 'OK', { duration: 3000 });
        }
    }

    setActiveTab(id: number): void {
        this.activeTabId = id;
        this.cdr.detectChanges();
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
        this.cdr.detectChanges();
    }

    trackByTabId: TrackByFunction<OpenTab> = (_, t) => t.id;

    // ── Icon registration ─────────────────────────────────────────────────────
    private registerIcons(): void {
        const icons: Record<string, string> = {
            'heroicons_outline:arrows-right-left':
                `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>`,
            'heroicons_outline:user-circle':
                `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`,
            'heroicons_outline:building-storefront':
                `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016 2.993 2.993 0 0 0 2.25-1.016 3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" /></svg>`,
            'heroicons_outline:arrow-up-tray':
                `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>`,
            'heroicons_outline:exclamation-triangle':
                `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`,
            'heroicons_outline:magnifying-glass':
                `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>`,
            'heroicons_outline:paper-airplane':
                `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>`,
            'heroicons_outline:arrow-uturn-left':
                `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>`,
            'heroicons_outline:building-office':
                `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>`,
            'heroicons_outline:wrench-screwdriver':
                `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.654-4.654m5.292-9.645a3.75 3.75 0 1 1-1.992 7.052l-.055-.02-.008-.003a3.75 3.75 0 0 1 2.055-7.03Z" /></svg>`,
        };
        Object.entries(icons).forEach(([name, svg]) =>
            this.iconRegistry.addSvgIconLiteral(name, this.sanitizer.bypassSecurityTrustHtml(svg))
        );
    }
}
