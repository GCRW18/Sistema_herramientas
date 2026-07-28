import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, startWith } from 'rxjs/operators';
import { SupplierService } from '../../../../core/services/supplier.service';

/**
 * Módulo Proveedores — CRUD completo contra he.tsuppliers (herramientas/suppliers/*),
 * los mismos proveedores que consume ingresos-hub para las compras.
 */
interface ProveedorDisplay {
    id: string;
    codigo: string;
    tipo: string;        // valor backend: tools|calibration|maintenance|general
    tipoLabel: string;
    nombre: string;
    nit: string;
    ciudad: string;
    telefono: string;
    email: string;
    activo: boolean;
    raw: any;
}

const TYPE_LABELS: Record<string, string> = {
    tools:       'HERRAMIENTAS',
    calibration: 'CALIBRACIÓN',
    maintenance: 'REPARACIÓN',
    general:     'MIXTO',
};

@Component({
    selector: 'app-proveedores',
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
    templateUrl: './proveedores.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
    `]
})
export class ProveedoresComponent implements OnInit {
    private snackBar    = inject(MatSnackBar);
    private dialog      = inject(MatDialog);
    private supplierSvc = inject(SupplierService);

    searchControl = new FormControl('');

    proveedores: ProveedorDisplay[] = [];
    filteredProveedores: ProveedorDisplay[] = [];
    isLoading = false;

    /* ── Paginación ── */
    readonly pageSize = 10;
    pagina = signal(1);

    ngOnInit(): void {
        this.loadProveedores();
        this.setupFilters();
    }

    loadProveedores(): void {
        this.isLoading = true;
        this.supplierSvc.getSuppliers({ limit: 1000 }).subscribe({
            next: (rows: any[]) => {
                this.proveedores = (rows || []).map(s => this.mapToDisplay(s));
                this.applyFilters();
                this.isLoading = false;
            },
            error: () => {
                this.proveedores = [];
                this.applyFilters();
                this.isLoading = false;
                this.snackBar.open('Error al cargar proveedores', 'Cerrar', { duration: 5000, verticalPosition: 'top' });
            }
        });
    }

    private mapToDisplay(s: any): ProveedorDisplay {
        const tipo = (s.type || 'general').toLowerCase();
        return {
            id:        String(s.id_supplier ?? ''),
            codigo:    s.code || '',
            tipo,
            tipoLabel: TYPE_LABELS[tipo] || tipo.toUpperCase(),
            nombre:    s.name || '',
            nit:       s.tax_id || '',
            ciudad:    s.city || '',
            telefono:  s.phone || '',
            email:     s.email || '',
            activo:    this.parseActivo(s.active),
            raw:       s
        };
    }

    private parseActivo(val: any): boolean {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return ['true', 't', '1', 'activo', 'si'].includes(val.toLowerCase());
        return !!val;
    }

    /* ── Mapeos form (español) ↔ backend (he.tsuppliers, inglés) ── */

    private mapToForm(p: ProveedorDisplay): any {
        const s = p.raw;
        return {
            id:                 p.id,
            codigo:             s.code || '',
            nombre_comercial:   s.name || '',
            razon_social:       s.name || '',
            nit:                s.tax_id || '',
            tipo_proveedor:     TYPE_LABELS[p.tipo] || 'MIXTO',
            direccion:          s.address || '',
            ciudad:             s.city || '',
            pais:               'Bolivia',
            telefono:           s.phone || '',
            email:              s.email || '',
            contacto_principal: s.contact_person || '',
            telefono_contacto:  s.phone_contact || '',
            email_contacto:     s.email_contact || '',
            sitio_web:          s.website || '',
            calificacion:       Number(s.rating ?? 0),
            condiciones_pago:   s.payment_terms || '',
            tiempo_entrega_dias: Number(s.delivery_days ?? 0),
            observaciones:      s.notes || '',
            active:             p.activo,
            // alias en inglés que usa detalle-proveedor.html
            name:               s.name || '',
            type:               p.tipoLabel,
            tax:                s.tax_id || '',
            contact:            s.contact_person || '',
            phone:              s.phone || '',
            address:            s.address || '',
            notes:              s.notes || '',
            estado:             p.activo ? 'ACTIVO' : 'INACTIVO',
        };
    }

    private mapFormToBackend(formData: any): any {
        const typeReverseMap: Record<string, string> = {
            'HERRAMIENTAS': 'tools',
            'CALIBRACION':  'calibration',
            'CALIBRACIÓN':  'calibration',
            'REPARACION':   'maintenance',
            'REPARACIÓN':   'maintenance',
            'MIXTO':        'general'
        };
        return {
            code:           formData.codigo || '',
            name:           formData.nombre_comercial,
            contact_person: formData.contacto_principal || '',
            email:          formData.email,
            phone:          formData.telefono,
            address:        formData.direccion || '',
            city:           formData.ciudad || '',
            website:        formData.sitio_web || '',
            type:           typeReverseMap[formData.tipo_proveedor] || 'general',
            tax_id:         formData.nit,
            notes:          formData.observaciones || '',
            phone_contact:  formData.telefono_contacto || '',
            email_contact:  formData.email_contacto || '',
            delivery_days:  formData.tiempo_entrega_dias || 0,
            payment_terms:  formData.condiciones_pago || '',
            rating:         formData.calificacion || 0,
            active:         formData.active !== undefined ? formData.active : true
        };
    }

    /* ── Acciones CRUD ── */

    async nuevoProveedor(): Promise<void> {
        const { FormProveedorComponent } = await import('./dialogs/form-proveedor/form-proveedor.component');
        const ref = this.dialog.open(FormProveedorComponent, {
            width: '560px', maxWidth: '95vw', maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: { mode: 'create' }
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.supplierSvc.createSupplier(this.mapFormToBackend(result)).subscribe({
                next: () => {
                    this.snackBar.open('Proveedor creado', 'Cerrar', { duration: 2500 });
                    this.loadProveedores();
                },
                error: () => this.snackBar.open('Error al crear proveedor', 'Cerrar', { duration: 4000 }),
            });
        });
    }

    async editarProveedor(p: ProveedorDisplay, ev: Event): Promise<void> {
        ev.stopPropagation();
        const { FormProveedorComponent } = await import('./dialogs/form-proveedor/form-proveedor.component');
        const ref = this.dialog.open(FormProveedorComponent, {
            width: '560px', maxWidth: '95vw', maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: { mode: 'edit', proveedor: this.mapToForm(p) }
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.supplierSvc.updateSupplier(p.id, this.mapFormToBackend({ ...result, active: p.activo })).subscribe({
                next: () => {
                    this.snackBar.open('Proveedor actualizado', 'Cerrar', { duration: 2500 });
                    this.loadProveedores();
                },
                error: () => this.snackBar.open('Error al actualizar proveedor', 'Cerrar', { duration: 4000 }),
            });
        });
    }

    async verDetalle(p: ProveedorDisplay): Promise<void> {
        const { DetalleProveedorComponent } = await import('./dialogs/detalle-proveedor/detalle-proveedor.component');
        const ref = this.dialog.open(DetalleProveedorComponent, {
            width: '560px', maxWidth: '95vw', maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: { proveedor: this.mapToForm(p) }
        });
        ref.afterClosed().subscribe(result => {
            if (result === 'updated') this.loadProveedores();
        });
    }

    async toggleEstado(p: ProveedorDisplay, ev: Event): Promise<void> {
        ev.stopPropagation();
        const { ConfirmToggleDialogComponent } = await import('./dialogs/confirm-toggle-dialog.component');
        const ref = this.dialog.open(ConfirmToggleDialogComponent, {
            maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            data: { nombre: p.nombre, activar: !p.activo }
        });
        ref.afterClosed().subscribe(ok => {
            if (!ok) return;
            // HE_SUP_MOD sobrescribe todos los campos: enviar el registro completo
            const payload = this.mapFormToBackend({ ...this.mapToForm(p), active: !p.activo });
            this.supplierSvc.updateSupplier(p.id, payload).subscribe({
                next: () => {
                    this.snackBar.open(`Proveedor ${!p.activo ? 'activado' : 'desactivado'}`, 'Cerrar', { duration: 2500 });
                    this.loadProveedores();
                },
                error: () => this.snackBar.open('Error al cambiar estado', 'Cerrar', { duration: 4000 }),
            });
        });
    }

    /* ── Filtros ── */

    setupFilters(): void {
        this.searchControl.valueChanges.pipe(
            startWith(''),
            debounceTime(300)
        ).subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        const term = this.searchControl.value?.toLowerCase() || '';
        this.filteredProveedores = term
            ? this.proveedores.filter(p =>
                p.nombre.toLowerCase().includes(term) ||
                p.codigo.toLowerCase().includes(term) ||
                p.nit.toLowerCase().includes(term) ||
                p.email?.toLowerCase().includes(term))
            : [...this.proveedores];
        this.pagina.set(1);
    }

    /* ── Paginación ── */

    get totalPaginas(): number {
        return Math.max(1, Math.ceil(this.filteredProveedores.length / this.pageSize));
    }

    get proveedoresPagina(): ProveedorDisplay[] {
        const p = Math.min(this.pagina(), this.totalPaginas);
        const inicio = (p - 1) * this.pageSize;
        return this.filteredProveedores.slice(inicio, inicio + this.pageSize);
    }

    get rangoPagina(): { desde: number; hasta: number } {
        const total = this.filteredProveedores.length;
        if (!total) return { desde: 0, hasta: 0 };
        const p = Math.min(this.pagina(), this.totalPaginas);
        const desde = (p - 1) * this.pageSize + 1;
        return { desde, hasta: Math.min(p * this.pageSize, total) };
    }

    paginasVisibles(): number[] {
        const total  = this.totalPaginas;
        const actual = Math.min(this.pagina(), total);
        const inicio = Math.max(1, Math.min(actual - 2, total - 4));
        const fin    = Math.min(total, inicio + 4);
        const out: number[] = [];
        for (let i = inicio; i <= fin; i++) out.push(i);
        return out;
    }

    irAPagina(p: number): void {
        this.pagina.set(Math.min(Math.max(1, p), this.totalPaginas));
    }

    /* ── KPIs ── */

    getProveedoresActivos(): number {
        return this.proveedores.filter(p => p.activo).length;
    }

    getProveedoresInactivos(): number {
        return this.proveedores.filter(p => !p.activo).length;
    }
}
