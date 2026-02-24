import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { filter, takeUntil, finalize } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { MovementService } from '../../../core/services/movement.service';

interface ExitRecord {
    id: string;
    fecha: string;
    tipo: string;
    estado: string;
    responsable: string;
    nroComprobante?: string;
    items?: number;
}

@Component({
    selector: 'app-exits',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatPaginatorModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        DragDropModule
    ],
    templateUrl: './exits.component.html',

    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 3px solid #1a1a1a;
            --neo-shadow: 4px 4px 0px 0px rgba(0, 0, 0, 1);
        }

        /* ===== EXIT CARDS ===== */
        .neo-card-exit {
            border: var(--neo-border);
            box-shadow: var(--neo-shadow);
            border-radius: 20px;
            background-color: #ffffff;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .neo-card-exit:hover {
            transform: translate(-3px, -3px);
            box-shadow: 8px 8px 0px 0px rgba(0, 0, 0, 1);
        }

        .neo-card-exit:active {
            transform: translate(0px, 0px);
            box-shadow: 2px 2px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .neo-card-exit {
            background-color: #203f77;
            border-color: #000000;
            box-shadow: 4px 4px 0px 0px rgb(0, 0, 0);
        }

        :host-context(.dark) .neo-card-exit:hover {
            box-shadow: 8px 8px 0px 0px rgb(0, 0, 0);
        }

        :host-context(.dark) .neo-card-exit:active {
            box-shadow: 2px 2px 0px 0px rgba(30, 41, 59, 1);
        }

        /* ===== CARD NUMBERS ===== */
        .exit-number {
            font-size: 4rem;
            font-weight: 900;
            line-height: 1;
            color: #1a1a1a;
            letter-spacing: -0.03em;
        }

        .exit-number-sm {
            font-size: 2.5rem;
        }

        :host-context(.dark) .exit-number {
            color: #fff6f6;
        }

        /* ===== CARD LABELS ===== */
        .exit-label {
            font-size: 0.95rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.01em;
            line-height: 1.25;
            color: #1a1a1a;
        }

        .exit-label-lg {
            font-size: 1.35rem;
        }

        .exit-label-sm {
            font-size: 0.85rem;
        }

        :host-context(.dark) .exit-label {
            color: #c2cee6;
        }

        /* ===== CARD ICONS ===== */
        .exit-icon-lg {
            width: 70px !important;
            height: 70px !important;
            font-size: 70px !important;
            color: #1a1a1a;
        }

        .exit-icon-md {
            width: 48px !important;
            height: 48px !important;
            font-size: 48px !important;
            color: #1a1a1a;
        }

        .exit-icon-xl {
            width: 130px !important;
            height: 130px !important;
            font-size: 130px !important;
            color: #1a1a1a;
        }

        :host-context(.dark) .exit-icon-lg,
        :host-context(.dark) .exit-icon-md,
        :host-context(.dark) .exit-icon-xl {
            color: #ffffff;
        }

        /* ===== SIDEBAR BUTTONS ===== */
        .exit-sidebar-btn {
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

        .exit-sidebar-btn:hover {
            transform: translate(-2px, -2px);
            box-shadow: 5px 5px 0px 0px rgba(0, 0, 0, 1);
            color: #ffffff;
        }

        .exit-sidebar-btn:active {
            transform: translate(0, 0);
            box-shadow: 1px 1px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .exit-sidebar-btn {
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
        .neo-card-base-exit {
            border: 2px solid black !important;
            box-shadow: 4px 4px 0px 0px rgba(0,0,0,1) !important;
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base-exit {
            background-color: #1e293b !important;
        }

        /* ===== DIALOG: Spinner Overlay ===== */
        .spinner-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
        }

        :host-context(.dark) .spinner-overlay {
            background: rgba(0,0,0,0.7);
        }

        /* ===== DIALOG: Custom Scrollbar ===== */
        .custom-scrollbar-exit::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-exit::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-exit::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar-exit::-webkit-scrollbar-thumb { background: #cbd5e1; }

    `]
})
export class ExitsComponent implements OnInit, OnDestroy {
    private router = inject(Router);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);

    private _unsubscribeAll = new Subject<void>();

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild('salidasRecientesDialog') salidasRecientesDialog!: TemplateRef<any>;

    showCards = true;
    isLoading = false;

    // Paginación
    totalRecords = 0;
    pageSize = 10;
    pageIndex = 0;
    pageSizeOptions = [5, 10, 25, 50];

    displayedColumns: string[] = ['fecha', 'tipo', 'nroComprobante', 'estado', 'responsable', 'acciones'];
    recentExits: ExitRecord[] = [];

    ngOnInit(): void {
        this.updateCardVisibility(this.router.url);
        this.loadRecentExits();

        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            takeUntil(this._unsubscribeAll)
        ).subscribe((event: any) => {
            this.updateCardVisibility(event.url);
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private updateCardVisibility(url: string): void {
        this.showCards = url === '/salidas' || url === '/salidas/' || url.endsWith('/salidas');
    }

    loadRecentExits(): void {
        this.isLoading = true;

        this.movementService.getHistorialMovimientos({
            movement_type: 'exit',
            page: this.pageIndex + 1,
            limit: this.pageSize
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (response) => {
                if (response.data && response.data.length > 0) {
                    this.recentExits = response.data.map((item: any) => ({
                        id: item.id || item.id_movement,
                        fecha: this.formatDate(item.date || item.fecha),
                        tipo: this.mapExitType(item.exitReason || item.tipo),
                        estado: this.mapStatus(item.status || item.estado),
                        responsable: item.requestedBy?.fullName || item.responsable || 'N/A',
                        nroComprobante: item.movementNumber || item.nroComprobante || '-',
                        items: item.items?.length || 0
                    }));
                    this.totalRecords = response.total || this.recentExits.length;
                } else {
                    this.loadMockData();
                }
            },
            error: () => {
                this.loadMockData();
            }
        });
    }

    private loadMockData(): void {
        this.recentExits = [
            { id: '1', fecha: '28/01/2026', tipo: 'ENVÍO A BASE', estado: 'COMPLETADO', responsable: 'GABRIEL CRUZ', nroComprobante: 'SAL-2026-001', items: 3 },
            { id: '2', fecha: '27/01/2026', tipo: 'ENVÍO A CALIBRACIÓN', estado: 'COMPLETADO', responsable: 'MARIA LOPEZ', nroComprobante: 'SAL-2026-002', items: 5 },
            { id: '3', fecha: '26/01/2026', tipo: 'PRÉSTAMO A TERCEROS', estado: 'PENDIENTE', responsable: 'CARLOS RODRIGUEZ', nroComprobante: 'SAL-2026-003', items: 2 },
            { id: '4', fecha: '25/01/2026', tipo: 'TRASPASO A OTRA ÁREA', estado: 'REVISIÓN', responsable: 'ANA MARTINEZ', nroComprobante: 'SAL-2026-004', items: 1 },
            { id: '5', fecha: '24/01/2026', tipo: 'BAJA DE ACTIVO', estado: 'COMPLETADO', responsable: 'PEDRO SANCHEZ', nroComprobante: 'SAL-2026-005', items: 4 }
        ];
        this.totalRecords = 25;
    }

    private formatDate(date: string): string {
        if (!date) return '-';
        try {
            const d = new Date(date);
            return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return date;
        }
    }

    private mapExitType(type: string): string {
        const typeMap: Record<string, string> = {
            'send_to_base': 'ENVÍO A BASE',
            'send_to_calibration': 'ENVÍO A CALIBRACIÓN',
            'transfer': 'TRASPASO A OTRA ÁREA',
            'loan': 'PRÉSTAMO A TERCEROS',
            'quarantine': 'CUARENTENA',
            'decommission': 'BAJA DE ACTIVO'
        };
        return typeMap[type] || type?.toUpperCase() || 'N/A';
    }

    private mapStatus(status: string): string {
        const statusMap: Record<string, string> = {
            'pending': 'PENDIENTE',
            'approved': 'APROBADO',
            'completed': 'COMPLETADO',
            'cancelled': 'CANCELADO',
            'review': 'REVISIÓN'
        };
        return statusMap[status] || status?.toUpperCase() || 'N/A';
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadRecentExits();
    }

    verDetalle(exit: ExitRecord): void {
        this.showMessage(`Ver detalle de salida ${exit.nroComprobante}`, 'info');
        // TODO: Abrir diálogo de detalle
    }

    editarSalida(exit: ExitRecord): void {
        this.showMessage(`Editar salida ${exit.nroComprobante}`, 'info');
        // TODO: Abrir diálogo de edición
    }

    getStatusClass(estado: string): string {
        switch (estado) {
            case 'COMPLETADO':
                return 'bg-[#177f0f] text-black';
            case 'PENDIENTE':
                return 'bg-[#F8B400FF] text-black';
            case 'REVISIÓN':
                return 'bg-[#203F77FF] text-black';
            case 'CANCELADO':
                return 'bg-red-800 text-black';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }

    openSalidasRecientes(): void {
        this.loadRecentExits();
        this.dialog.open(this.salidasRecientesDialog, {
            width: '1100px',
            maxWidth: '95vw',
            height: '85vh',
            maxHeight: '90vh',
            panelClass: 'neo-dialog-salidas',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });
    }

    // Dialog Openers
    async openEnvioOtrasBases(): Promise<void> {
        const { EnvioOtrasBasesComponent } = await import('./envio-otras-bases/envio-otras-bases.component');
        this.openDialog(EnvioOtrasBasesComponent);
    }

    async openTraspasoOtraArea(): Promise<void> {
        const { TraspasoOtraAreaComponent } = await import('./traspaso-otra-area/traspaso-otra-area.component');
        this.openDialog(TraspasoOtraAreaComponent);
    }

    async openPrestamoTerceros(): Promise<void> {
        const { PrestamoTercerosComponent } = await import('./prestamo-terceros/prestamo-terceros.component');
        this.openDialog(PrestamoTercerosComponent);
    }

    async openPonerCuarentena(): Promise<void> {
        const { PonerCuarentenaComponent } = await import('./poner-cuarentena/poner-cuarentena.component');
        this.openDialog(PonerCuarentenaComponent);
    }

    async openBaja(): Promise<void> {
        const { BajaComponent } = await import('./baja/baja.component');
        const dialogRef = this.dialog.open(BajaComponent, {
            width: '1200px',
            maxWidth: '95vw',
            height: '90vh',
            maxHeight: '95vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.success) {
                this.showMessage('Operación completada exitosamente', 'success');
                this.loadRecentExits();
            }
        });
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
            if (result?.success) {
                this.showMessage('Operación completada exitosamente', 'success');
                this.loadRecentExits();
            }
        });
    }
}
