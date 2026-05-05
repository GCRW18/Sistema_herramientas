import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { Subject, combineLatest } from 'rxjs';
import { startWith, takeUntil, debounceTime } from 'rxjs/operators';

import { Herramienta } from './interfaces';

@Component({
    selector: 'app-registrar-herramienta',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatIconModule,
        MatSnackBarModule,
        MatTooltipModule,
        MatMenuModule,
    ],
    templateUrl: './registrar-herramienta.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class RegistrarHerramientaComponent implements OnInit, OnDestroy {

    private dialog    = inject(MatDialog);
    private snackBar  = inject(MatSnackBar);
    private _destroy$ = new Subject<void>();

    searchControl   = new FormControl('');
    filterCategoria = new FormControl('');
    filterEstado    = new FormControl('');

    isLoading = signal(false);
    herramientas:         Herramienta[] = [];
    filteredHerramientas: Herramienta[] = [];

    categorias = [
        { value: '',           label: 'Todas las categorías' },
        { value: 'general',    label: 'General'              },
        { value: 'consumible', label: 'Consumible'           },
        { value: 'miscelaneo', label: 'Misceláneo'           },
    ];

    estados = [
        { value: '',              label: 'Todos los estados' },
        { value: 'NUEVO',         label: 'Nuevo'             },
        { value: 'USADO',         label: 'Usado'             },
        { value: 'EN_REPARACION', label: 'En reparación'     },
        { value: 'BAJA',          label: 'Baja'              },
    ];

    ngOnInit() {
        this.cargar();

        combineLatest([
            this.searchControl.valueChanges.pipe(startWith(''), debounceTime(150)),
            this.filterCategoria.valueChanges.pipe(startWith('')),
            this.filterEstado.valueChanges.pipe(startWith('')),
        ])
        .pipe(takeUntil(this._destroy$))
        .subscribe(() => this.applyFilters());
    }

    ngOnDestroy() {
        this._destroy$.next();
        this._destroy$.complete();
    }

    cargar() {
        this.isLoading.set(true);
        // Mock
        this.herramientas = [
            { id: 1, codigo: 'HER-001', pn: 'TQ-200', sn: 'A123', descripcion: 'Torquímetro 20-200 Nm',
              categoria: 'general', cantidad: 1, unidad: 'UN', estado: 'NUEVO',
              ubicacionLabel: 'ALM-CBBA-01 / EST-01 / N1',
              sujetaCalibracion: true,
              calibracion: { frecuenciaMeses: 12, ultimaCalibracion: '2026-01-10', proximaCalibracion: '2027-01-10', proveedor: 'CalibraLab' },
              fechaRegistro: '2026-01-15' },
            { id: 2, codigo: 'HER-002', pn: 'BR-08', descripcion: 'Broca HSS 8mm',
              categoria: 'consumible', cantidad: 50, unidad: 'UN', estado: 'NUEVO',
              ubicacionLabel: 'ALM-CBBA-01 / EST-01 / N2',
              sujetaCalibracion: false,
              consumible: { stockMinimo: 10, stockActual: 50, unidadConsumo: 'UN' },
              fechaRegistro: '2026-02-20' },
            { id: 3, codigo: 'HER-003', pn: 'GU-01', descripcion: 'Guantes de seguridad',
              categoria: 'miscelaneo', cantidad: 25, unidad: 'PAR', estado: 'NUEVO',
              ubicacionLabel: 'ALM-SCZ-01 / EST-02 / N1',
              sujetaCalibracion: false,
              miscelaneo: { notas: 'Talla L' },
              fechaRegistro: '2026-03-05' },
        ];
        this.applyFilters();
        this.isLoading.set(false);
    }

    private applyFilters() {
        const q   = (this.searchControl.value ?? '').toString().trim().toLowerCase();
        const cat = this.filterCategoria.value ?? '';
        const est = this.filterEstado.value    ?? '';

        this.filteredHerramientas = this.herramientas.filter(h => {
            if (cat && h.categoria !== cat) return false;
            if (est && h.estado    !== est) return false;
            if (q) {
                const blob = `${h.codigo} ${h.pn} ${h.sn ?? ''} ${h.descripcion}`.toLowerCase();
                if (!blob.includes(q)) return false;
            }
            return true;
        });
    }

    countCalibracion() { return this.herramientas.filter(h => h.sujetaCalibracion).length; }
    countConsumibles() { return this.herramientas.filter(h => h.categoria === 'consumible').length; }
    countMisc()        { return this.herramientas.filter(h => h.categoria === 'miscelaneo').length; }

    async nueva() {
        const { FormHerramientaComponent } = await import('./form-herramienta/form-herramienta.component');
        const ref = this.dialog.open(FormHerramientaComponent, {
            width: '950px', maxWidth: '95vw', height: 'auto', maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: { mode: 'new' }
        });
        ref.afterClosed().subscribe(ok => { if (ok) this.recargar('Herramienta registrada'); });
    }

    async editar(h: Herramienta, ev: Event) {
        ev.stopPropagation();
        const { FormHerramientaComponent } = await import('./form-herramienta/form-herramienta.component');
        const ref = this.dialog.open(FormHerramientaComponent, {
            width: '950px', maxWidth: '95vw', height: 'auto', maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: { mode: 'edit', herramienta: h }
        });
        ref.afterClosed().subscribe(ok => { if (ok) this.recargar('Herramienta actualizada'); });
    }

    async ver(h: Herramienta) {
        const { FormHerramientaComponent } = await import('./form-herramienta/form-herramienta.component');
        this.dialog.open(FormHerramientaComponent, {
            width: '950px', maxWidth: '95vw', height: 'auto', maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: { mode: 'view', herramienta: h }
        });
    }

    async eliminar(h: Herramienta, ev: Event) {
        ev.stopPropagation();
        const { ConfirmDeleteComponent } = await import('../gestion-ubicaciones/confirm-delete/confirm-delete.component');
        const ref = this.dialog.open(ConfirmDeleteComponent, {
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            data: {
                itemKind: 'herramienta',
                itemCode: h.codigo,
                itemName: `${h.descripcion} (PN: ${h.pn})`,
            }
        });
        ref.afterClosed().subscribe(ok => {
            if (!ok) return;
            this.herramientas = this.herramientas.filter(x => x.id !== h.id);
            this.applyFilters();
            this.snackBar.open('Herramienta eliminada', 'Cerrar', { duration: 2500 });
        });
    }

    private recargar(msg: string) {
        this.cargar();
        this.snackBar.open(msg, 'Cerrar', { duration: 2500 });
    }

    getEstadoBadge(est: string): { bg: string; tx: string } {
        switch (est) {
            case 'NUEVO':         return { bg: 'bg-green-200',  tx: 'text-green-900' };
            case 'USADO':         return { bg: 'bg-blue-200',   tx: 'text-blue-900'  };
            case 'EN_REPARACION': return { bg: 'bg-amber-200',  tx: 'text-amber-900' };
            case 'BAJA':          return { bg: 'bg-red-200',    tx: 'text-red-900'   };
            default:              return { bg: 'bg-gray-200',   tx: 'text-gray-900'  };
        }
    }

    getCategoriaIcon(cat: string): string {
        return cat === 'consumible' ? 'inventory_2'
             : cat === 'miscelaneo' ? 'category'
             :                        'build';
    }
}
