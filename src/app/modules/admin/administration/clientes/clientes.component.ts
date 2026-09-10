import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, startWith } from 'rxjs/operators';
import { CustomerService } from '../../../../core/services/customer.service';

/**
 * Módulo Clientes / Empresas de Terceros — CRUD contra he.tcustomers; alimenta el
 * autocompletado de "empresa" en Préstamo a Terceros (prestamo-externo-hub).
 */
interface ClienteDisplay {
    id: string;
    codigo: string;
    nombre: string;
    nit: string;
    contacto: string;
    telefono: string;
    email: string;
    ciudad: string;
    activo: boolean;
    raw: any;
}

@Component({
    selector: 'app-clientes',
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
    templateUrl: './clientes.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
    `]
})
export class ClientesComponent implements OnInit {
    private snackBar    = inject(MatSnackBar);
    private dialog      = inject(MatDialog);
    private customerSvc = inject(CustomerService);

    searchControl = new FormControl('');

    clientes: ClienteDisplay[] = [];
    filteredClientes: ClienteDisplay[] = [];
    isLoading = false;

    readonly pageSize = 10;
    pagina = signal(1);

    ngOnInit(): void {
        this.loadClientes();
        this.setupFilters();
    }

    loadClientes(): void {
        this.isLoading = true;
        this.customerSvc.getCustomers({ limit: 1000 }).subscribe({
            next: (rows: any[]) => {
                this.clientes = (rows || []).map(c => this.mapToDisplay(c));
                this.applyFilters();
                this.isLoading = false;
            },
            error: () => {
                this.clientes = [];
                this.applyFilters();
                this.isLoading = false;
                this.snackBar.open('Error al cargar clientes', 'Cerrar', { duration: 5000, verticalPosition: 'top' });
            }
        });
    }

    private mapToDisplay(c: any): ClienteDisplay {
        return {
            id:       String(c.id_customer ?? ''),
            codigo:   c.code || '',
            nombre:   c.name || c.company_name || '',
            nit:      c.tax_id || '',
            contacto: c.contact_person || '',
            telefono: c.phone || '',
            email:    c.email || '',
            ciudad:   c.city || '',
            activo:   this.parseActivo(c.active),
            raw:      c
        };
    }

    private parseActivo(val: any): boolean {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return ['true', 't', '1', 'activo', 'si'].includes(val.toLowerCase());
        return val === undefined || val === null ? true : !!val;
    }

    /** he.ft_customers_ime HE_CUS_MOD sobrescribe todos los campos → mandar el registro completo. */
    private mapToBackend(c: ClienteDisplay, form: any, activoOverride?: boolean): any {
        const r = c.raw || {};
        return {
            code:           r.code || '',
            name:           form.name ?? r.name ?? '',
            customer_type:  r.customer_type || 'terceros',
            company_name:   form.name ?? r.company_name ?? '',
            contact_person: form.contact_person ?? r.contact_person ?? '',
            email:          form.email ?? r.email ?? '',
            phone:          form.phone ?? r.phone ?? '',
            city:           form.city ?? r.city ?? '',
            country:        r.country || 'Bolivia',
            address:        form.address ?? r.address ?? '',
            tax_id:         form.tax_id ?? r.tax_id ?? '',
            fiscal_registry: r.fiscal_registry || '',
            phone_contact:  r.phone_contact || '',
            email_contact:  r.email_contact || '',
            notes:          form.notes ?? r.notes ?? '',
            estado_reg:     'activo',
            active:         activoOverride !== undefined ? activoOverride : c.activo
        };
    }

    private newToBackend(form: any): any {
        return {
            name:           form.name || '',
            customer_type:  'terceros',
            company_name:   form.name || '',
            contact_person: form.contact_person || '',
            email:          form.email || '',
            phone:          form.phone || '',
            city:           form.city || '',
            country:        'Bolivia',
            address:        form.address || '',
            tax_id:         form.tax_id || '',
            notes:          form.notes || '',
            estado_reg:     'activo',
            active:         true
        };
    }

    private toForm(c: ClienteDisplay): any {
        const r = c.raw || {};
        return {
            name:           r.name || r.company_name || '',
            tax_id:         r.tax_id || '',
            contact_person: r.contact_person || '',
            phone:          r.phone || '',
            email:          r.email || '',
            city:           r.city || '',
            address:        r.address || '',
            notes:          r.notes || ''
        };
    }

    /* ── CRUD ── */

    async nuevoCliente(): Promise<void> {
        const { FormClienteDialogComponent } = await import('./form-cliente-dialog.component');
        const ref = this.dialog.open(FormClienteDialogComponent, {
            maxWidth: '95vw', maxHeight: '90vh',
            panelClass: 'no-padding-dialog',
            data: { mode: 'create' }
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.customerSvc.createCustomer(this.newToBackend(result)).subscribe({
                next: () => { this.snackBar.open('Cliente creado', 'Cerrar', { duration: 2500 }); this.loadClientes(); },
                error: (err: any) => this.snackBar.open(err?.message || 'Error al crear cliente', 'Cerrar', { duration: 4000 })
            });
        });
    }

    async editarCliente(c: ClienteDisplay, ev: Event): Promise<void> {
        ev.stopPropagation();
        const { FormClienteDialogComponent } = await import('./form-cliente-dialog.component');
        const ref = this.dialog.open(FormClienteDialogComponent, {
            maxWidth: '95vw', maxHeight: '90vh',
            panelClass: 'no-padding-dialog',
            data: { mode: 'edit', cliente: this.toForm(c) }
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.customerSvc.updateCustomer(c.id, this.mapToBackend(c, result)).subscribe({
                next: () => { this.snackBar.open('Cliente actualizado', 'Cerrar', { duration: 2500 }); this.loadClientes(); },
                error: (err: any) => this.snackBar.open(err?.message || 'Error al actualizar cliente', 'Cerrar', { duration: 4000 })
            });
        });
    }

    toggleEstado(c: ClienteDisplay, ev: Event): void {
        ev.stopPropagation();
        const nuevo = !c.activo;
        this.customerSvc.updateCustomer(c.id, this.mapToBackend(c, this.toForm(c), nuevo)).subscribe({
            next: () => { this.snackBar.open(`Cliente ${nuevo ? 'activado' : 'desactivado'}`, 'Cerrar', { duration: 2500 }); this.loadClientes(); },
            error: (err: any) => this.snackBar.open(err?.message || 'Error al cambiar estado', 'Cerrar', { duration: 4000 })
        });
    }

    /* ── Filtros ── */

    setupFilters(): void {
        this.searchControl.valueChanges.pipe(startWith(''), debounceTime(300))
            .subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        const term = this.searchControl.value?.toLowerCase() || '';
        this.filteredClientes = term
            ? this.clientes.filter(c =>
                c.nombre.toLowerCase().includes(term) ||
                c.codigo.toLowerCase().includes(term) ||
                c.nit.toLowerCase().includes(term) ||
                c.email?.toLowerCase().includes(term))
            : [...this.clientes];
        this.pagina.set(1);
    }

    /* ── Paginación ── */

    get totalPaginas(): number {
        return Math.max(1, Math.ceil(this.filteredClientes.length / this.pageSize));
    }

    get clientesPagina(): ClienteDisplay[] {
        const p = Math.min(this.pagina(), this.totalPaginas);
        const inicio = (p - 1) * this.pageSize;
        return this.filteredClientes.slice(inicio, inicio + this.pageSize);
    }

    get rangoPagina(): { desde: number; hasta: number } {
        const total = this.filteredClientes.length;
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

    getActivos(): number { return this.clientes.filter(c => c.activo).length; }
    getInactivos(): number { return this.clientes.filter(c => !c.activo).length; }
}
