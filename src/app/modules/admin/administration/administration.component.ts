import { Component, OnDestroy, inject, ViewChild, TemplateRef, signal, Type, Injector } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, of } from 'rxjs';

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

    // Formulario activo inline
    activeFormComponent = signal<Type<any> | null>(null);
    activeFormTab       = signal<number | null>(null);
    formInjector: Injector | null = null;

    displayedColumns: string[] = ['fecha', 'tipo', 'entidad', 'usuario', 'acciones'];
    recentRecords: AdminRecord[] = [
        { fecha: '04/01/2026', tipo: 'CREAR USUARIO',    entidad: 'Carlos Mendoza',  usuario: 'ADMIN' },
        { fecha: '03/01/2026', tipo: 'EDITAR PROVEEDOR', entidad: 'Ferreteria BOA',  usuario: 'SUPERVISOR' },
        { fecha: '02/01/2026', tipo: 'ASIGNAR ROL',      entidad: 'Tecnico Senior',  usuario: 'ADMIN' }
    ];

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

    async openUsuarios(): Promise<void> {
        const { UsuariosComponent } = await import('./usuarios/usuarios.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(UsuariosComponent);
        this.activeFormTab.set(1);
    }

    async openProveedores(): Promise<void> {
        const { ProveedoresComponent } = await import('./proveedores/proveedores.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(ProveedoresComponent);
        this.activeFormTab.set(2);
    }

    async openClientes(): Promise<void> {
        const { ClientesComponent } = await import('./clientes/clientes.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(ClientesComponent);
        this.activeFormTab.set(3);
    }

    async openRoles(): Promise<void> {
        const { RolesComponent } = await import('./roles/roles.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(RolesComponent);
        this.activeFormTab.set(4);
    }

    async openFuncionarios(): Promise<void> {
        const { FuncionariosComponent } = await import('./funcionarios/funcionarios.component');
        this.formInjector = this.createFormInjector();
        this.activeFormComponent.set(FuncionariosComponent);
        this.activeFormTab.set(5);
    }

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
