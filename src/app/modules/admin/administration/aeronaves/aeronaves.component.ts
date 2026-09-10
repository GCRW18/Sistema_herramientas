import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, startWith } from 'rxjs/operators';
import { FleetService } from '../../../../core/services/fleet.service';

/**
 * Módulo Aeronaves — CRUD contra he.taircraft; alimenta el autocompletado de
 * "Aeronave" en Préstamo Técnico (prestamo-tecnico-hub).
 */
interface AeronaveDisplay {
    id: string;
    matricula: string;
    fabricante: string;
    modelo: string;
    tipo: string;
    estado: string;
    base: string;
    activo: boolean;
    raw: any;
}

const TIPO_LABELS: Record<string, string> = { passenger: 'Pasajeros', cargo: 'Carga', mixed: 'Mixto' };
const ESTADO_LABELS: Record<string, string> = {
    active: 'ACTIVA', maintenance: 'MANTENIMIENTO', grounded: 'EN TIERRA', decommissioned: 'FUERA DE SERVICIO'
};
const ESTADO_CLASSES: Record<string, string> = {
    active: 'bg-green-500 text-white', maintenance: 'bg-amber-400 text-black',
    grounded: 'bg-stone-400 text-black', decommissioned: 'bg-red-500 text-white'
};

@Component({
    selector: 'app-aeronaves',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule
    ],
    templateUrl: './aeronaves.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
    `]
})
export class AeronavesComponent implements OnInit {
    private snackBar = inject(MatSnackBar);
    private dialog   = inject(MatDialog);
    private fleetSvc = inject(FleetService);

    searchControl = new FormControl('');

    aeronaves: AeronaveDisplay[] = [];
    filteredAeronaves: AeronaveDisplay[] = [];
    isLoading = false;

    readonly pageSize = 10;
    pagina = signal(1);

    ngOnInit(): void {
        this.loadAeronaves();
        this.setupFilters();
    }

    loadAeronaves(): void {
        this.isLoading = true;
        this.fleetSvc.getAircraft({ limit: 1000 } as any).subscribe({
            next: (rows: any[]) => {
                this.aeronaves = (rows || []).map(a => this.mapToDisplay(a));
                this.applyFilters();
                this.isLoading = false;
            },
            error: () => {
                this.aeronaves = [];
                this.applyFilters();
                this.isLoading = false;
                this.snackBar.open('Error al cargar aeronaves', 'Cerrar', { duration: 5000, verticalPosition: 'top' });
            }
        });
    }

    private mapToDisplay(a: any): AeronaveDisplay {
        return {
            id:         String(a.id_aircraft ?? ''),
            matricula:  a.registration || '',
            fabricante: a.manufacturer || '',
            modelo:     a.model || '',
            tipo:       a.type || 'passenger',
            estado:     a.status || 'active',
            base:       a.base_location || '',
            activo:     this.parseActivo(a.active),
            raw:        a
        };
    }

    private parseActivo(val: any): boolean {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return ['true', 't', '1', 'activo', 'si'].includes(val.toLowerCase());
        return val === undefined || val === null ? true : !!val;
    }

    tipoLabel(t: string): string { return TIPO_LABELS[t] || t; }
    estadoLabel(e: string): string { return ESTADO_LABELS[e] || e.toUpperCase(); }
    estadoClass(e: string): string { return ESTADO_CLASSES[e] || 'bg-stone-300 text-black'; }

    /** he.ft_aircraft_ime HE_AIR_MOD sobrescribe todos los campos → mandar el registro completo. */
    private mapToBackend(a: AeronaveDisplay, form: any, activoOverride?: boolean): any {
        const r = a.raw || {};
        return {
            registration:     r.registration || '',
            manufacturer:     form.manufacturer ?? r.manufacturer ?? '',
            model:            form.model ?? r.model ?? '',
            serial_number:    form.serial_number ?? r.serial_number ?? '',
            type:             form.type ?? r.type ?? 'passenger',
            status:           form.status ?? r.status ?? 'active',
            base_location:    form.base_location ?? r.base_location ?? '',
            fleet_name:       form.fleet_name ?? r.fleet_name ?? '',
            notes:            form.notes ?? r.notes ?? '',
            active:           activoOverride !== undefined ? activoOverride : a.activo
        };
    }

    private newToBackend(form: any): any {
        return {
            registration:  form.registration || '',
            manufacturer:  form.manufacturer || '',
            model:         form.model || '',
            serial_number: form.serial_number || '',
            type:          form.type || 'passenger',
            status:        form.status || 'active',
            base_location: form.base_location || '',
            fleet_name:    form.fleet_name || '',
            notes:         form.notes || '',
            active:        true
        };
    }

    private toForm(a: AeronaveDisplay): any {
        const r = a.raw || {};
        return {
            registration:  r.registration || '',
            manufacturer:  r.manufacturer || '',
            model:         r.model || '',
            serial_number: r.serial_number || '',
            type:          r.type || 'passenger',
            status:        r.status || 'active',
            base_location: r.base_location || '',
            fleet_name:    r.fleet_name || '',
            notes:         r.notes || ''
        };
    }

    /* ── CRUD ── */

    async nuevaAeronave(): Promise<void> {
        const { FormAeronaveDialogComponent } = await import('./form-aeronave-dialog.component');
        const ref = this.dialog.open(FormAeronaveDialogComponent, {
            maxWidth: '95vw', maxHeight: '90vh',
            panelClass: 'no-padding-dialog',
            data: { mode: 'create' }
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.fleetSvc.createAircraft(this.newToBackend(result)).subscribe({
                next: () => { this.snackBar.open('Aeronave registrada', 'Cerrar', { duration: 2500 }); this.loadAeronaves(); },
                error: (err: any) => this.snackBar.open(err?.message || 'Error al registrar aeronave', 'Cerrar', { duration: 4000 })
            });
        });
    }

    async editarAeronave(a: AeronaveDisplay, ev: Event): Promise<void> {
        ev.stopPropagation();
        const { FormAeronaveDialogComponent } = await import('./form-aeronave-dialog.component');
        const ref = this.dialog.open(FormAeronaveDialogComponent, {
            maxWidth: '95vw', maxHeight: '90vh',
            panelClass: 'no-padding-dialog',
            data: { mode: 'edit', aeronave: this.toForm(a) }
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.fleetSvc.updateAircraft(a.id, this.mapToBackend(a, result)).subscribe({
                next: () => { this.snackBar.open('Aeronave actualizada', 'Cerrar', { duration: 2500 }); this.loadAeronaves(); },
                error: (err: any) => this.snackBar.open(err?.message || 'Error al actualizar aeronave', 'Cerrar', { duration: 4000 })
            });
        });
    }

    toggleEstado(a: AeronaveDisplay, ev: Event): void {
        ev.stopPropagation();
        const nuevo = !a.activo;
        this.fleetSvc.updateAircraft(a.id, this.mapToBackend(a, this.toForm(a), nuevo)).subscribe({
            next: () => { this.snackBar.open(`Aeronave ${nuevo ? 'activada' : 'desactivada'}`, 'Cerrar', { duration: 2500 }); this.loadAeronaves(); },
            error: (err: any) => this.snackBar.open(err?.message || 'Error al cambiar estado', 'Cerrar', { duration: 4000 })
        });
    }

    eliminarAeronave(a: AeronaveDisplay, ev: Event): void {
        ev.stopPropagation();
        if (!confirm(`¿Eliminar la aeronave ${a.matricula}? Esta acción no se puede deshacer.`)) return;
        this.fleetSvc.deleteAircraft(a.id).subscribe({
            next: () => { this.snackBar.open('Aeronave eliminada', 'Cerrar', { duration: 2500 }); this.loadAeronaves(); },
            error: (err: any) => this.snackBar.open(err?.message || 'Error al eliminar aeronave', 'Cerrar', { duration: 4500 })
        });
    }

    /* ── Filtros ── */

    setupFilters(): void {
        this.searchControl.valueChanges.pipe(startWith(''), debounceTime(300))
            .subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        const term = this.searchControl.value?.toLowerCase() || '';
        this.filteredAeronaves = term
            ? this.aeronaves.filter(a =>
                a.matricula.toLowerCase().includes(term) ||
                a.fabricante.toLowerCase().includes(term) ||
                a.modelo.toLowerCase().includes(term))
            : [...this.aeronaves];
        this.pagina.set(1);
    }

    /* ── Paginación ── */

    get totalPaginas(): number {
        return Math.max(1, Math.ceil(this.filteredAeronaves.length / this.pageSize));
    }

    get aeronavesPagina(): AeronaveDisplay[] {
        const p = Math.min(this.pagina(), this.totalPaginas);
        const inicio = (p - 1) * this.pageSize;
        return this.filteredAeronaves.slice(inicio, inicio + this.pageSize);
    }

    get rangoPagina(): { desde: number; hasta: number } {
        const total = this.filteredAeronaves.length;
        if (!total) return { desde: 0, hasta: 0 };
        const p = Math.min(this.pagina(), this.totalPaginas);
        return { desde: (p - 1) * this.pageSize + 1, hasta: Math.min(p * this.pageSize, total) };
    }

    paginasVisibles(): number[] {
        const total = this.totalPaginas;
        const actual = Math.min(this.pagina(), total);
        const inicio = Math.max(1, Math.min(actual - 2, total - 4));
        const fin = Math.min(total, inicio + 4);
        const out: number[] = [];
        for (let i = inicio; i <= fin; i++) out.push(i);
        return out;
    }

    irAPagina(p: number): void {
        this.pagina.set(Math.min(Math.max(1, p), this.totalPaginas));
    }

    /* ── KPIs ── */

    getActivas(): number { return this.aeronaves.filter(a => a.activo).length; }
    getInactivas(): number { return this.aeronaves.filter(a => !a.activo).length; }
}
