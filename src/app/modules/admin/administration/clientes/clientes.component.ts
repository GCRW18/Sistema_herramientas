import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, startWith } from 'rxjs/operators';
import { combineLatest } from 'rxjs';
import { CustomerService } from '../../../../core/services/customer.service';

interface ClienteDisplay {
    id: string;
    tipo_cliente: string;
    nombre: string;
    razon_social: string;
    nit: string;
    registro_fiscal: string;
    contacto_principal: string;
    telefono: string;
    email: string;
    ciudad: string;
    pais: string;
    direccion: string;
    telefono_contacto: string;
    email_contacto: string;
    observaciones: string;
    estado: string;
    active: boolean;
}

@Component({
    selector: 'app-clientes',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatDialogModule,
        MatSnackBarModule,
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
    private router = inject(Router);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private customerService = inject(CustomerService);

    searchControl = new FormControl('');
    filterTipo = new FormControl('');

    displayedColumns: string[] = ['tipo', 'nombre', 'nit', 'contacto', 'telefono', 'email', 'estado', 'acciones'];

    clientes: ClienteDisplay[] = [];
    filteredClientes: ClienteDisplay[] = [];

    tiposCliente = [
        { value: '', label: 'Todos los tipos' },
        { value: 'EMPRESA', label: 'Empresa' },
        { value: 'PERSONA', label: 'Persona Natural' }
    ];

    ngOnInit(): void {
        this.loadClientes();
        this.setupFilters();
    }

    loadClientes(): void {
        this.customerService.getCustomers().subscribe({
            next: (data) => {
                this.clientes = this.mapToDisplay(data);
                this.applyFilters();
            },
            error: (err) => this.handleError(err)
        });
    }

    private mapToDisplay(customers: any[]): ClienteDisplay[] {
        return customers.map(c => ({
            id:                 c.id_customer?.toString() || c.id,
            tipo_cliente:       c.customer_type || 'EMPRESA',
            nombre:             c.name || '',
            razon_social:       c.company_name || '',
            nit:                c.tax_id || '-',
            registro_fiscal:    c.fiscal_registry || '',
            contacto_principal: c.contact_person || '-',
            telefono:           c.phone || '-',
            email:              c.email || '-',
            ciudad:             c.city || '-',
            pais:               c.country || 'Bolivia',
            direccion:          c.address || '',
            telefono_contacto:  c.phone_contact || '',
            email_contacto:     c.email_contact || '',
            observaciones:      c.notes || '',
            estado:             c.active ? 'ACTIVO' : 'INACTIVO',
            active:             c.active ?? true
        }));
    }

    private mapFormToBackend(formData: any): any {
        return {
            name:             formData.nombre,
            customer_type:    formData.tipo_cliente,
            company_name:     formData.razon_social,
            tax_id:           formData.nit,
            fiscal_registry:  formData.registro_fiscal,
            city:             formData.ciudad,
            country:          formData.pais,
            address:          formData.direccion,
            email:            formData.email,
            phone:            formData.telefono,
            contact_person:   formData.contacto_principal,
            phone_contact:    formData.telefono_contacto,
            email_contact:    formData.email_contacto,
            notes:            formData.observaciones,
            active:           true
        };
    }

    setupFilters(): void {
        combineLatest([
            this.searchControl.valueChanges.pipe(startWith('')),
            this.filterTipo.valueChanges.pipe(startWith(''))
        ]).pipe(debounceTime(300)).subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        let filtered = [...this.clientes];
        const searchTerm = this.searchControl.value?.toLowerCase() || '';
        if (searchTerm) {
            filtered = filtered.filter(c =>
                c.nombre.toLowerCase().includes(searchTerm) ||
                c.razon_social?.toLowerCase().includes(searchTerm) ||
                c.nit?.toLowerCase().includes(searchTerm) ||
                c.contacto_principal?.toLowerCase().includes(searchTerm) ||
                c.email?.toLowerCase().includes(searchTerm) ||
                c.ciudad?.toLowerCase().includes(searchTerm)
            );
        }
        const tipo = this.filterTipo.value;
        if (tipo) {
            filtered = filtered.filter(c => c.tipo_cliente === tipo);
        }
        this.filteredClientes = filtered;
    }

    async nuevoCliente(): Promise<void> {
        const { FormClienteComponent } = await import('./dialogs/form-cliente/form-cliente.component');
        const dialogRef = this.dialog.open(FormClienteComponent, {
            width: '560px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: false,
            disableClose: false
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) this.createCliente(result);
        });
    }

    async editarCliente(cliente: ClienteDisplay): Promise<void> {
        const { FormClienteComponent } = await import('./dialogs/form-cliente/form-cliente.component');
        const dialogRef = this.dialog.open(FormClienteComponent, {
            width: '560px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            data: { cliente: this.mapDisplayToForm(cliente), mode: 'edit' },
            panelClass: 'neo-dialog',
            hasBackdrop: false
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) this.updateCliente(cliente.id, result);
        });
    }

    async verDetalles(cliente: ClienteDisplay): Promise<void> {
        const { DetalleClienteComponent } = await import('./dialogs/detalle-cliente/detalle-cliente.component');
        this.dialog.open(DetalleClienteComponent, {
            width: '560px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            data: { cliente },
            panelClass: 'neo-dialog',
            hasBackdrop: false
        });
    }

    async toggleEstado(cliente: ClienteDisplay): Promise<void> {
        const nuevoEstado = !cliente.active;
        const mensaje = nuevoEstado ? 'activar' : 'desactivar';

        if (confirm(`¿Está seguro de ${mensaje} al cliente ${cliente.nombre}?`)) {
            const payload = this.mapDisplayToForm(cliente);
            this.customerService.updateCustomer(cliente.id, {
                ...this.mapFormToBackend(payload),
                active: nuevoEstado
            }).subscribe({
                next: () => {
                    this.showSuccess(`Cliente ${nuevoEstado ? 'activado' : 'desactivado'} exitosamente`);
                    this.loadClientes();
                },
                error: (err) => this.handleError(err)
            });
        }
    }

    createCliente(formData: any): void {
        this.customerService.createCustomer(this.mapFormToBackend(formData)).subscribe({
            next: () => {
                this.showSuccess('Cliente creado exitosamente');
                this.loadClientes();
            },
            error: (err) => this.handleError(err)
        });
    }

    updateCliente(id: string, formData: any): void {
        this.customerService.updateCustomer(id, this.mapFormToBackend(formData)).subscribe({
            next: () => {
                this.showSuccess('Cliente actualizado exitosamente');
                this.loadClientes();
            },
            error: (err) => this.handleError(err)
        });
    }

    private mapDisplayToForm(cliente: ClienteDisplay): any {
        const clean = (v: string) => (v === '-' ? '' : v);
        return {
            tipo_cliente:       cliente.tipo_cliente,
            nombre:             cliente.nombre,
            razon_social:       cliente.razon_social,
            nit:                clean(cliente.nit),
            registro_fiscal:    cliente.registro_fiscal,
            ciudad:             clean(cliente.ciudad),
            pais:               cliente.pais || 'Bolivia',
            direccion:          cliente.direccion,
            email:              clean(cliente.email),
            telefono:           clean(cliente.telefono),
            contacto_principal: clean(cliente.contacto_principal),
            telefono_contacto:  cliente.telefono_contacto,
            email_contacto:     cliente.email_contacto,
            observaciones:      cliente.observaciones
        };
    }

    volver(): void {
        this.router.navigate(['/administration']);
    }

    getClientesActivos(): number {
        return this.clientes.filter(c => c.active).length;
    }

    getClientesInactivos(): number {
        return this.clientes.filter(c => !c.active).length;
    }

    private showSuccess(message: string): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: ['snackbar-success']
        });
    }

    private handleError(error: any): void {
        let message = 'Ocurrió un error inesperado';
        if (error.error?.message) message = error.error.message;
        else if (error.status === 404) message = 'El recurso no fue encontrado';
        else if (error.status === 403) message = 'No tiene permisos para realizar esta acción';
        else if (error.status === 500) message = 'Error en el servidor. Intente nuevamente';
        this.snackBar.open(message, 'Cerrar', {
            duration: 5000, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: ['snackbar-error']
        });
    }
}
