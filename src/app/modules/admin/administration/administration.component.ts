import { Component, OnDestroy, inject, ViewChild, TemplateRef, Type, Injector, TrackByFunction } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { DragDropModule } from '@angular/cdk/drag-drop';
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

interface AdminRecord {
    fecha: string;
    tipo: string;
    entidad: string;
    usuario: string;
}

@Component({
    selector: 'app-administration',
    standalone: true,
    imports: [
        CommonModule,
        NgComponentOutlet,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTableModule,
        DragDropModule
    ],
    templateUrl: './administration.component.html',
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

        .neo-card-base-admin {
            border: 2px solid black !important;
            box-shadow: 4px 4px 0px 0px rgba(0,0,0,1) !important;
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base-admin {
            background-color: #1e293b !important;
        }

        .custom-scrollbar-admin::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-admin::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-admin::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar-admin::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class AdministrationComponent implements OnDestroy {
    private dialog   = inject(MatDialog);
    private injector = inject(Injector);

    private _unsubscribeAll = new Subject<void>();

    @ViewChild('actividadRecienteDialog') actividadRecienteDialog!: TemplateRef<any>;

    // ── Tab system ───────────────────────────────────────────────────────────
    openTabs: OpenTab[] = [];
    activeTabId: number | null = null;
    showBandeja = false;
    private tabCounter = 0;

    private readonly MODULE_DEFS: ModuleDef[] = [
        {
            type: 1, label: 'USUARIOS', sublabel: '',
            color: '#1A3EDC', textColor: '#fff',
            svgIcon: 'heroicons_outline:user-group',
            loader: async () => (await import('./usuarios/usuarios.component')).UsuariosComponent
        },
        {
            type: 2, label: 'PROVEEDORES', sublabel: '',
            color: '#FF6A00', textColor: '#fff',
            svgIcon: 'heroicons_outline:building-office-2',
            loader: async () => (await import('./proveedores/proveedores.component')).ProveedoresComponent
        },
        {
            type: 3, label: 'CLIENTES', sublabel: '',
            color: '#1AAA1F', textColor: '#fff',
            svgIcon: 'heroicons_outline:users',
            loader: async () => (await import('./clientes/clientes.component')).ClientesComponent
        },
        {
            type: 4, label: 'ROLES Y', sublabel: 'PERMISOS',
            color: '#7113CF', textColor: '#fff',
            svgIcon: 'heroicons_outline:shield-check',
            loader: async () => (await import('./roles/roles.component')).RolesComponent
        },
        {
            type: 5, label: 'FUNCIONARIOS', sublabel: 'Y TÉCNICOS',
            color: '#111A43', textColor: '#fff',
            svgIcon: 'heroicons_outline:identification',
            loader: async () => (await import('./funcionarios/funcionarios.component')).FuncionariosComponent
        },
    ];

    displayedColumns: string[] = ['fecha', 'tipo', 'entidad', 'usuario', 'acciones'];
    recentRecords: AdminRecord[] = [
        { fecha: '04/01/2026', tipo: 'CREAR USUARIO',    entidad: 'Carlos Mendoza',  usuario: 'ADMIN' },
        { fecha: '03/01/2026', tipo: 'EDITAR PROVEEDOR', entidad: 'Ferreteria BOA',  usuario: 'SUPERVISOR' },
        { fecha: '02/01/2026', tipo: 'ASIGNAR ROL',      entidad: 'Tecnico Senior',  usuario: 'ADMIN' }
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

    // ── Actividad Reciente (dialog desde header) ─────────────────────────────

    openActividadReciente(): void {
        this.dialog.open(this.actividadRecienteDialog, {
            width: '1100px',
            maxWidth: '95vw',
            height: '85vh',
            maxHeight: '90vh',
            panelClass: 'neo-dialog-admin',
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
