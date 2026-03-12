import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef, signal, Type, Injector } from '@angular/core';
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

    // Formulario activo inline
    activeFormComponent = signal<Type<any> | null>(null);
    activeFormTab       = signal<number | null>(null);
    formInjector: Injector | null = null;

    // ── Inline form helpers ──────────────────────────────────────────────────

    private createFormInjector(): Injector {
        const self = this;
        const fakeRef = {
            close:            (result?: any) => { self.closeActiveForm(); },
            afterClosed:      () => of(null),
            beforeClosed:     () => of(null),
            backdropClick:    () => of(null),
            keydownEvents:    () => of(null),
            updatePosition:   () => {},
            updateSize:       () => {},
            addPanelClass:    () => {},
            removePanelClass: () => {},
            disableClose: false,
            id: 'inline-form',
            componentInstance: null,
        };
        return Injector.create({
            providers: [{ provide: MatDialogRef, useValue: fakeRef }],
            parent: this.injector
        });
    }

    closeActiveForm(): void {
        this.activeFormComponent.set(null);
        this.activeFormTab.set(null);
        this.formInjector = null;
    }

    // ── Form openers (inline) ────────────────────────────────────────────────

    async openGestionUbicaciones(): Promise<void> {
        const { GestionUbicacionesComponent } = await import('./gestion-ubicaciones/gestion-ubicaciones.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(GestionUbicacionesComponent);
        this.activeFormTab.set(1);
    }

    async openCrearMaterial(): Promise<void> {
        const { CrearMaterialComponent } = await import('./crear-material/crear-material.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(CrearMaterialComponent);
        this.activeFormTab.set(2);
    }

    async openEntradaMaterial(): Promise<void> {
        const { EntradaMaterialComponent } = await import('./entrada-material/entrada-material.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(EntradaMaterialComponent);
        this.activeFormTab.set(3);
    }

    async openSalidaMaterial(): Promise<void> {
        const { SalidaMaterialComponent } = await import('./salida-material/salida-material.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(SalidaMaterialComponent);
        this.activeFormTab.set(4);
    }

    async openHistorialEstados(): Promise<void> {
        const { HistorialEstadosComponent } = await import('./historial-estados/historial-estados.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(HistorialEstadosComponent);
        this.activeFormTab.set(5);
    }

    async openMigracionExcel(): Promise<void> {
        const { MigracionExcelComponent } = await import('./migracion-excel/migracion-excel.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(MigracionExcelComponent);
        this.activeFormTab.set(6);
    }

    async openListaKits(): Promise<void> {
        const { ListaKitsComponent } = await import('./lista-kits/lista-kits.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(ListaKitsComponent);
        this.activeFormTab.set(7);
    }

    async openReportes(): Promise<void> {
        const { ReportesInventarioComponent } = await import('./reportes/reportes-inventario.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(ReportesInventarioComponent);
        this.activeFormTab.set(8);
    }

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
