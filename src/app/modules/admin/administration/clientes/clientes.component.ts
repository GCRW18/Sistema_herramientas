import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, startWith } from 'rxjs/operators';
import { combineLatest } from 'rxjs';
import { CustomerService, Customer } from '../../../../core/services/customer.service';

interface ClienteDisplay {
    id: string;
    tipo_cliente: string;
    nombre: string;
    razon_social: string;
    nit: string;
    contacto_principal: string;
    telefono: string;
    email: string;
    ciudad: string;
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
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatSnackBarModule,
        ReactiveFormsModule
    ],
    templateUrl: './clientes.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }
    `]
})
export class ClientesComponent implements OnInit {
    private router = inject(Router);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private customerService = inject(CustomerService);

    searchControl = new FormControl('');
    filterTipo = new FormControl('');

    displayedColumns: string[] = ['tipo', 'nombre', 'nit', 'contacto', 'telefono', 'email', 'ciudad', 'estado', 'acciones'];

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

    private mapToDisplay(customers: Customer[]): ClienteDisplay[] {
        return customers.map(c => ({
            id: c.id,
            tipo_cliente: 'EMPRESA',
            nombre: c.name || '',
            razon_social: c.name || '',
            nit: c.taxId || '-',
            contacto_principal: c.contactName || '-',
            telefono: c.phone || '-',
            email: c.email || '-',
            ciudad: '-',
            estado: 'ACTIVO', // Customer no tiene propiedad active, por defecto ACTIVO
            active: true // Por defecto activo
        }));
    }

    setupFilters(): void {
        combineLatest([
            this.searchControl.valueChanges.pipe(startWith('')),
            this.filterTipo.valueChanges.pipe(startWith(''))
        ]).pipe(
            debounceTime(300)
        ).subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        let filtered = [...this.clientes];

        // Filtro de búsqueda
        const searchTerm = this.searchControl.value?.toLowerCase() || '';
        if (searchTerm) {
            filtered = filtered.filter(c =>
                c.nombre.toLowerCase().includes(searchTerm) ||
                c.nit?.toLowerCase().includes(searchTerm) ||
                c.contacto_principal?.toLowerCase().includes(searchTerm) ||
                c.email?.toLowerCase().includes(searchTerm)
            );
        }

        // Filtro por tipo
        const tipo = this.filterTipo.value;
        if (tipo) {
            filtered = filtered.filter(c => c.tipo_cliente === tipo);
        }

        this.filteredClientes = filtered;
    }

    async nuevoCliente(): Promise<void> {
        const { FormClienteComponent } = await import('./dialogs/form-cliente/form-cliente.component');
        const dialogRef = this.dialog.open(FormClienteComponent, {
            width: '1200px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            disableClose: false
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.createCliente(result);
            }
        });
    }

    async editarCliente(cliente: ClienteDisplay): Promise<void> {
        const { FormClienteComponent } = await import('./dialogs/form-cliente/form-cliente.component');
        const dialogRef = this.dialog.open(FormClienteComponent, {
            width: '1200px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            data: { cliente, mode: 'edit' },
            panelClass: 'neo-dialog'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.updateCliente(cliente.id, result);
            }
        });
    }

    async verDetalles(cliente: ClienteDisplay): Promise<void> {
        const { DetalleClienteComponent } = await import('./dialogs/detalle-cliente/detalle-cliente.component');
        this.dialog.open(DetalleClienteComponent, {
            width: '900px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            data: { cliente },
            panelClass: 'neo-dialog'
        });
    }

    async toggleEstado(cliente: ClienteDisplay): Promise<void> {
        const nuevoEstado = !cliente.active;
        const mensaje = nuevoEstado ? 'activar' : 'desactivar';

        if (confirm(`¿Está seguro de ${mensaje} al cliente ${cliente.nombre}?`)) {
            this.showSuccess(`Cliente ${nuevoEstado ? 'activado' : 'desactivado'} exitosamente`);
            this.loadClientes();
        }
    }

    createCliente(data: Partial<Customer>): void {
        this.customerService.createCustomer(data).subscribe({
            next: () => {
                this.showSuccess('Cliente creado exitosamente');
                this.loadClientes();
            },
            error: (err) => this.handleError(err)
        });
    }

    updateCliente(id: string, data: Partial<Customer>): void {
        this.customerService.updateCustomer(id, data).subscribe({
            next: () => {
                this.showSuccess('Cliente actualizado exitosamente');
                this.loadClientes();
            },
            error: (err) => this.handleError(err)
        });
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
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-success']
        });
    }

    private handleError(error: any): void {
        let message = 'Ocurrió un error inesperado';

        if (error.error?.message) {
            message = error.error.message;
        } else if (error.status === 404) {
            message = 'El recurso no fue encontrado';
        } else if (error.status === 403) {
            message = 'No tiene permisos para realizar esta acción';
        } else if (error.status === 500) {
            message = 'Error en el servidor. Intente nuevamente';
        }

        this.snackBar.open(message, 'Cerrar', {
            duration: 5000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-error']
        });
    }
}
