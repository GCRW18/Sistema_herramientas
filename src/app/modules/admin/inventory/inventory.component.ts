import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { filter } from 'rxjs/operators';

@Component({
    selector: 'app-inventory',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule
    ],
    templateUrl: './inventory.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 3px solid #1a1a1a;
            --neo-shadow: 4px 4px 0px 0px rgba(0, 0, 0, 1);
        }

        /* ===== INVENTORY CARDS ===== */
        .neo-card-inv {
            border: var(--neo-border);
            box-shadow: var(--neo-shadow);
            border-radius: 20px;
            background-color: #ffffff;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .neo-card-inv:hover {
            transform: translate(-3px, -3px);
            box-shadow: 8px 8px 0px 0px rgba(0, 0, 0, 1);
        }

        .neo-card-inv:active {
            transform: translate(0px, 0px);
            box-shadow: 2px 2px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .neo-card-inv {
            background-color: #203f77;
            border-color: #000000;
            box-shadow: 4px 4px 0px 0px rgb(0, 0, 0);
        }

        :host-context(.dark) .neo-card-inv:hover {
            box-shadow: 8px 8px 0px 0px rgb(0, 0, 0);
        }

        :host-context(.dark) .neo-card-inv:active {
            box-shadow: 2px 2px 0px 0px rgba(30, 41, 59, 1);
        }

        /* ===== CARD NUMBERS ===== */
        .inv-number {
            font-size: 3rem;
            font-weight: 900;
            line-height: 1;
            color: #1a1a1a;
            letter-spacing: -0.03em;
        }

        .inv-number-sm {
            font-size: 1.8rem;
        }

        :host-context(.dark) .inv-number {
            color: #fff6f6;
        }

        /* ===== CARD LABELS ===== */
        .inv-label {
            font-size: 0.85rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.01em;
            line-height: 1.25;
            color: #1a1a1a;
        }

        .inv-label-lg {
            font-size: 1.15rem;
        }

        .inv-label-sm {
            font-size: 0.8rem;
        }

        :host-context(.dark) .inv-label {
            color: #c2cee6;
        }

        /* ===== CARD ICONS ===== */
        .inv-icon-lg {
            width: 50px !important;
            height: 50px !important;
            font-size: 50px !important;
            color: #1a1a1a;
        }

        .inv-icon-md {
            width: 36px !important;
            height: 36px !important;
            font-size: 36px !important;
            color: #1a1a1a;
        }

        .inv-icon-xl {
            width: 90px !important;
            height: 90px !important;
            font-size: 90px !important;
            color: #1a1a1a;
        }

        :host-context(.dark) .inv-icon-lg,
        :host-context(.dark) .inv-icon-md,
        :host-context(.dark) .inv-icon-xl {
            color: #ffffff;
        }

        /* ===== SIDEBAR BUTTONS ===== */
        .inv-sidebar-btn {
            width: 100%;
            padding: 12px 18px;
            font-weight: 900;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            background-color: #ffffff;
            color: #1a1a1a;
            border: 3px solid #1a1a1a;
            border-radius: 14px;
            box-shadow: 3px 3px 0px 0px rgba(0, 0, 0, 1);
            cursor: pointer;
            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .inv-sidebar-btn:hover {
            transform: translate(-2px, -2px);
            box-shadow: 5px 5px 0px 0px rgba(0, 0, 0, 1);
            color: #ffffff;
        }

        .inv-sidebar-btn:active {
            transform: translate(0, 0);
            box-shadow: 1px 1px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .inv-sidebar-btn {
            background-color: #203f77;
            color: #ffffff;
            border-color: #000000;
            box-shadow: 3px 3px 0px 0px rgb(30, 41, 59);
        }
    `]
})
export class InventoryComponent implements OnInit {
    private router = inject(Router);
    private dialog = inject(MatDialog);
    showCards = true;

    ngOnInit(): void {
        this.updateCardVisibility(this.router.url);
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe((event: any) => {
            this.updateCardVisibility(event.url);
        });
    }

    private updateCardVisibility(url: string): void {
        this.showCards = url === '/inventario' || url === '/inventario/' || url.endsWith('/inventario');
    }

    // --- Inventory Modal Openers ---
    async openGestionUbicaciones(): Promise<void> {
        const { GestionUbicacionesComponent } = await import('./gestion-ubicaciones/gestion-ubicaciones.component');
        this.openDialog(GestionUbicacionesComponent);
    }

    async openConsultarInventario(): Promise<void> {
        const { ConsultarInventarioComponent } = await import('./consultar-inventario/consultar-inventario.component');
        this.openDialog(ConsultarInventarioComponent);
    }

    // --- Kits Modal Openers ---
    async openCrearMaterial(): Promise<void> {
        const { CrearMaterialComponent } = await import('./crear-material/crear-material.component');
        this.openDialog(CrearMaterialComponent);
    }

    async openEntradaMaterial(): Promise<void> {
        const { EntradaMaterialComponent } = await import('./entrada-material/entrada-material.component');
        this.openDialog(EntradaMaterialComponent);
    }

    async openSalidaMaterial(): Promise<void> {
        const { SalidaMaterialComponent } = await import('./salida-material/salida-material.component');
        this.openDialog(SalidaMaterialComponent);
    }

    async openHistorialEstados(): Promise<void> {
        const { HistorialEstadosComponent } = await import('./historial-estados/historial-estados.component');
        this.openDialog(HistorialEstadosComponent);
    }

    async openMigracionExcel(): Promise<void> {
        const { MigracionExcelComponent } = await import('./migracion-excel/migracion-excel.component');
        this.openDialog(MigracionExcelComponent);
    }

    private openDialog(component: any): void {
        const dialogRef = this.dialog.open(component, {
            width: '1200px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                console.log('Operacion finalizada:', result);
            }
        });
    }
}
