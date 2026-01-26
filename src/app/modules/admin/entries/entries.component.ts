import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { filter } from 'rxjs/operators';

interface EntryRecord {
    fecha: string;
    tipo: string;
    estado: string;
    responsable: string;
}

@Component({
    selector: 'app-entries',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatDialogModule
    ],
    templateUrl: './entries.component.html',

    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 3px solid black;
            --neo-shadow: 5px 5px 0px 0px rgba(0, 0, 0, 1);
        }

        /* CARD ACTION STYLE - TAMAÑO AUMENTADO */
        .neo-card-action {
            border: var(--neo-border);
            box-shadow: var(--neo-shadow);
            border-radius: 16px; /* Borde más redondeado para tarjetas grandes */
            background-color: white;
            padding: 40px; /* Padding masivo */
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .neo-card-action:hover {
            transform: translate(-4px, -4px); /* Movimiento más pronunciado */
            box-shadow: 10px 10px 0px 0px rgba(0, 0, 0, 1); /* Sombra más larga */
        }

        .neo-card-action:active {
            transform: translate(0px, 0px);
            box-shadow: 2px 2px 0px 0px rgba(0, 0, 0, 1);
        }

        /* Dark mode overrides */
        :host-context(.dark) .neo-card-action {
            background-color: #1e293b;
            border-color: #040404;
            box-shadow: 5px 5px 0px 0px rgba(71, 85, 105, 1);
        }

        :host-context(.dark) .neo-card-action:hover {
            box-shadow: 10px 10px 0px 0px rgb(0, 0, 0);
        }

        :host-context(.dark) .neo-card-action:active {
            box-shadow: 2px 2px 0px 0px rgb(9, 9, 9);
        }

        /* TABLE STYLES */
        .neo-card-base {
            border: var(--neo-border);
            box-shadow: var(--neo-shadow);
            border-radius: 12px;
        }

        .header-neo {
            background-color: white !important;
            color: #111A43 !important;
            font-weight: 900 !important;
            font-size: 14px !important; /* Fuente más grande en headers */
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
            color: #000000;
            border-bottom-color: #333;
        }
    `]
})
export class EntriesComponent implements OnInit {
    private router = inject(Router);
    private dialog = inject(MatDialog);
    showCards = true;

    displayedColumns: string[] = ['fecha', 'tipo', 'estado', 'responsable', 'acciones'];
    recentEntries: EntryRecord[] = [
        {
            fecha: '29/12/2025',
            tipo: 'RETORNO CALIBRACION',
            estado: 'REVISION',
            responsable: 'GABRIEL'
        },
        {
            fecha: '28/12/2025',
            tipo: 'NUEVA HERRAMIENTA',
            estado: 'COMPLETADO',
            responsable: 'MARIA'
        },
        {
            fecha: '27/12/2025',
            tipo: 'DEVOLUCION TERCEROS',
            estado: 'PENDIENTE',
            responsable: 'CARLOS'
        }
    ];

    ngOnInit(): void {
        this.updateCardVisibility(this.router.url);

        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe((event: any) => {
            this.updateCardVisibility(event.url);
        });
    }

    private updateCardVisibility(url: string): void {
        this.showCards = url === '/entradas' || url === '/entradas/' || url.endsWith('/entradas');
    }

    // Modal Openers (Dynamic Imports to keep initial bundle small)
    async openRetornoCalibracion(): Promise<void> {
        const { RetornoCalibracionComponent } = await import('./retorno-calibracion/retorno-calibracion.component');
        this.openDialog(RetornoCalibracionComponent);
    }

    async openRetornoTraspaso(): Promise<void> {
        const { RetornoTraspasoComponent } = await import('./retorno-traspaso/retorno-traspaso.component');
        this.openDialog(RetornoTraspasoComponent);
    }

    async openAjusteIngreso(): Promise<void> {
        const { AjusteIngresoComponent } = await import('./ajuste-ingreso/ajuste-ingreso.component');
        this.openDialog(AjusteIngresoComponent);
    }

    async openNuevaHerramienta(): Promise<void> {
        const { NuevaHerramientaComponent } = await import('./nueva-herramienta/nueva-herramienta.component');
        this.openDialog(NuevaHerramientaComponent);
    }

    async openDevolucionHerramienta(): Promise<void> {
        const { DevolucionHerramientaComponent } = await import('./devolucion-herramienta/devolucion-herramienta.component');
        this.openDialog(DevolucionHerramientaComponent);
    }

    async openDevolucionTerceros(): Promise<void> {
        const { DevolucionTercerosComponent } = await import('./devolucion-terceros/devolucion-terceros.component');
        this.openDialog(DevolucionTercerosComponent);
    }

    private openDialog(component: any): void {
        const dialogRef = this.dialog.open(component, {
            width: '1000px',
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
                console.log('Operación guardada:', result);
            }
        });
    }
}
