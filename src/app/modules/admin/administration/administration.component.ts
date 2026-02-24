import { Component, OnInit, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { filter } from 'rxjs/operators';

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
        RouterModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './administration.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 3px solid #1a1a1a;
            --neo-shadow: 4px 4px 0px 0px rgba(0, 0, 0, 1);
        }

        /* ===== ADMIN CARDS ===== */
        .neo-card-admin {
            border: var(--neo-border);
            box-shadow: var(--neo-shadow);
            border-radius: 20px;
            background-color: #ffffff;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .neo-card-admin:hover {
            transform: translate(-3px, -3px);
            box-shadow: 8px 8px 0px 0px rgba(0, 0, 0, 1);
        }

        .neo-card-admin:active {
            transform: translate(0px, 0px);
            box-shadow: 2px 2px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .neo-card-admin {
            background-color: #203f77;
            border-color: #000000;
            box-shadow: 4px 4px 0px 0px rgb(0, 0, 0);
        }

        :host-context(.dark) .neo-card-admin:hover {
            box-shadow: 8px 8px 0px 0px rgb(0, 0, 0);
        }

        :host-context(.dark) .neo-card-admin:active {
            box-shadow: 2px 2px 0px 0px rgba(30, 41, 59, 1);
        }

        /* ===== CARD NUMBERS ===== */
        .admin-number {
            font-size: 4rem;
            font-weight: 900;
            line-height: 1;
            color: #1a1a1a;
            letter-spacing: -0.03em;
        }

        :host-context(.dark) .admin-number {
            color: #fff6f6;
        }

        /* ===== CARD LABELS ===== */
        .admin-label {
            font-size: 0.95rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.01em;
            line-height: 1.25;
            color: #1a1a1a;
        }

        .admin-label-lg {
            font-size: 1.35rem;
        }

        :host-context(.dark) .admin-label {
            color: #c2cee6;
        }

        /* ===== CARD ICONS ===== */
        .admin-icon-lg {
            width: 70px !important;
            height: 70px !important;
            font-size: 70px !important;
            color: #1a1a1a;
        }

        .admin-icon-xl {
            width: 130px !important;
            height: 130px !important;
            font-size: 130px !important;
            color: #1a1a1a;
        }

        :host-context(.dark) .admin-icon-lg,
        :host-context(.dark) .admin-icon-xl {
            color: #ffffff;
        }

        /* ===== SIDEBAR BUTTONS ===== */
        .admin-sidebar-btn {
            width: 100%;
            padding: 14px 20px;
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

        .admin-sidebar-btn:hover {
            transform: translate(-2px, -2px);
            box-shadow: 5px 5px 0px 0px rgba(0, 0, 0, 1);
            color: #ffffff;
        }

        .admin-sidebar-btn:active {
            transform: translate(0, 0);
            box-shadow: 1px 1px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .admin-sidebar-btn {
            background-color: #203f77;
            color: #ffffff;
            border-color: #000000;
            box-shadow: 3px 3px 0px 0px rgb(30, 41, 59);
        }

        /* ===== TABLE STYLES ===== */
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

        /* ===== DIALOG: Neo Card Base ===== */
        .neo-card-base-admin {
            border: 2px solid black !important;
            box-shadow: 4px 4px 0px 0px rgba(0,0,0,1) !important;
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base-admin {
            background-color: #1e293b !important;
        }

        /* ===== DIALOG: Custom Scrollbar ===== */
        .custom-scrollbar-admin::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-admin::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-admin::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar-admin::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class AdministrationComponent implements OnInit {
    private router = inject(Router);
    private dialog = inject(MatDialog);

    @ViewChild('actividadRecienteDialog') actividadRecienteDialog!: TemplateRef<any>;

    showCards = true;

    displayedColumns: string[] = ['fecha', 'tipo', 'entidad', 'usuario', 'acciones'];
    recentRecords: AdminRecord[] = [
        { fecha: '04/01/2026', tipo: 'CREAR USUARIO', entidad: 'Carlos Mendoza', usuario: 'ADMIN' },
        { fecha: '03/01/2026', tipo: 'EDITAR PROVEEDOR', entidad: 'Ferreteria BOA', usuario: 'SUPERVISOR' },
        { fecha: '02/01/2026', tipo: 'ASIGNAR ROL', entidad: 'Tecnico Senior', usuario: 'ADMIN' }
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
        this.showCards = url === '/administration' || url === '/administration/' || url.endsWith('/administration');
    }

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
}
