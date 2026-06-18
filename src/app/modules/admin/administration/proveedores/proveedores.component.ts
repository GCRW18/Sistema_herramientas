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
import { SupplierService } from '../../../../core/services/supplier.service';
import { Supplier } from '../../../../core/models/user.types';

interface ProveedorDisplay {
    id: string;
    codigo: string;
    nombre_comercial: string;
    razon_social: string;
    nit: string;
    tipo_proveedor: string;
    contacto_principal: string;
    telefono: string;
    email: string;
    direccion: string;
    ciudad: string;
    pais: string;
    sitio_web: string;
    telefono_contacto: string;
    email_contacto: string;
    calificacion: number;
    condiciones_pago: string;
    tiempo_entrega_dias: number;
    observaciones: string;
    estado: string;
    active: boolean;
}

@Component({
    selector: 'app-proveedores',
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
    templateUrl: './proveedores.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
    `]
})
export class ProveedoresComponent implements OnInit {
    private router = inject(Router);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private supplierService = inject(SupplierService);

    searchControl = new FormControl('');
    filterTipo = new FormControl('');

    displayedColumns: string[] = ['codigo', 'nombre', 'tipo', 'contacto', 'telefono', 'email', 'ciudad', 'calificacion', 'estado', 'acciones'];

    proveedores: ProveedorDisplay[] = [];
    filteredProveedores: ProveedorDisplay[] = [];

    tiposProveedor = [
        { value: '', label: 'Todos los tipos' },
        { value: 'HERRAMIENTAS', label: 'Herramientas' },
        { value: 'CALIBRACION', label: 'Calibración' },
        { value: 'REPARACION', label: 'Reparación' },
        { value: 'MIXTO', label: 'Mixto' }
    ];

    ngOnInit(): void {
        this.loadProveedores();
        this.setupFilters();
    }

    loadProveedores(): void {
        this.supplierService.getSuppliers().subscribe({
            next: (data) => {
                this.proveedores = this.mapToDisplay(data);
                this.applyFilters();
            },
            error: (err) => this.handleError(err)
        });
    }

    private mapToDisplay(suppliers: any[]): ProveedorDisplay[] {
        return suppliers.map(s => ({
            id:                  s.id_supplier?.toString() || s.id?.toString() || '',
            codigo:              s.code           || '',
            nombre_comercial:    s.name           || '',
            razon_social:        s.name           || '',
            nit:                 s.tax_id         || '',
            tipo_proveedor:      this.mapType(s.type),
            contacto_principal:  s.contact_person || '',
            telefono:            s.phone          || '',
            email:               s.email          || '',
            direccion:           s.address        || '',
            ciudad:              s.city           || '',
            pais:                'Bolivia',
            sitio_web:           s.website        || '',
            telefono_contacto:   s.phone_contact  || '',
            email_contacto:      s.email_contact  || '',
            calificacion:        parseFloat(s.rating)      || 0,
            condiciones_pago:    s.payment_terms  || '',
            tiempo_entrega_dias: parseInt(s.delivery_days) || 0,
            observaciones:       s.notes          || '',
            estado:              (s.active === true || s.active === 'true' || s.active === 't') ? 'ACTIVO' : 'INACTIVO',
            active:              s.active === true || s.active === 'true' || s.active === 't'
        }));
    }

    private mapType(type: string | undefined): string {
        const typeMap: any = {
            'tools': 'HERRAMIENTAS',
            'calibration': 'CALIBRACION',
            'maintenance': 'REPARACION',
            'general': 'MIXTO'
        };
        return typeMap[type || ''] || 'MIXTO';
    }

    private mapFormToBackend(formData: any): any {
        const typeReverseMap: any = {
            'HERRAMIENTAS': 'tools',
            'CALIBRACION': 'calibration',
            'REPARACION': 'maintenance',
            'MIXTO': 'general'
        };
        return {
            code:          formData.codigo,
            name:          formData.nombre_comercial,
            contact_person:formData.contacto_principal,
            email:         formData.email,
            phone:         formData.telefono,
            address:       formData.direccion,
            city:          formData.ciudad,
            website:       formData.sitio_web,
            type:          typeReverseMap[formData.tipo_proveedor] || 'general',
            tax_id:        formData.nit,
            notes:         formData.observaciones,
            phone_contact: formData.telefono_contacto,
            email_contact: formData.email_contacto,
            delivery_days: formData.tiempo_entrega_dias || 0,
            payment_terms: formData.condiciones_pago,
            rating:        formData.calificacion || 0,
            active:        true
        };
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
        let filtered = [...this.proveedores];

        // Filtro de búsqueda
        const searchTerm = this.searchControl.value?.toLowerCase() || '';
        if (searchTerm) {
            filtered = filtered.filter(p =>
                p.nombre_comercial.toLowerCase().includes(searchTerm) ||
                p.codigo.toLowerCase().includes(searchTerm) ||
                p.contacto_principal?.toLowerCase().includes(searchTerm) ||
                p.email?.toLowerCase().includes(searchTerm)
            );
        }

        // Filtro por tipo
        const tipo = this.filterTipo.value;
        if (tipo) {
            filtered = filtered.filter(p => p.tipo_proveedor === tipo);
        }

        this.filteredProveedores = filtered;
    }

    async nuevoProveedor(): Promise<void> {
        const { FormProveedorComponent } = await import('./dialogs/form-proveedor/form-proveedor.component');
        const dialogRef = this.dialog.open(FormProveedorComponent, {
            width: '560px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: false,
            disableClose: false
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.createProveedor(result);
            }
        });
    }

    async editarProveedor(proveedor: ProveedorDisplay): Promise<void> {
        const { FormProveedorComponent } = await import('./dialogs/form-proveedor/form-proveedor.component');
        const dialogRef = this.dialog.open(FormProveedorComponent, {
            width: '560px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            data: { proveedor, mode: 'edit' },
            panelClass: 'neo-dialog',
            hasBackdrop: false
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.updateProveedor(proveedor.id, result);
            }
        });
    }

    async verDetalles(proveedor: ProveedorDisplay): Promise<void> {
        const { DetalleProveedorComponent } = await import('./dialogs/detalle-proveedor/detalle-proveedor.component');
        const ref = this.dialog.open(DetalleProveedorComponent, {
            width: '560px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            data: { proveedor },
            panelClass: 'neo-dialog'
        });
        ref.afterClosed().subscribe(result => {
            if (result === 'updated') this.loadProveedores();
        });
    }

    async toggleEstado(proveedor: ProveedorDisplay): Promise<void> {
        const nuevoEstado = !proveedor.active;

        const { ConfirmToggleDialogComponent } = await import('./dialogs/confirm-toggle-dialog.component');
        const ref = this.dialog.open(ConfirmToggleDialogComponent, {
            panelClass: 'neo-mini-dialog',
            hasBackdrop: true,
            backdropClass: 'bg-black/20',
            data: { nombre: proveedor.nombre_comercial, activar: nuevoEstado }
        });

        ref.afterClosed().subscribe(confirmed => {
            if (confirmed) {
                this.supplierService.updateSupplier(proveedor.id, { active: nuevoEstado }).subscribe({
                    next: () => {
                        this.showSuccess(`Proveedor ${nuevoEstado ? 'activado' : 'desactivado'} exitosamente`);
                        this.loadProveedores();
                    },
                    error: (err) => this.handleError(err)
                });
            }
        });
    }

    createProveedor(formData: any): void {
        const supplierData = this.mapFormToBackend(formData);
        this.supplierService.createSupplier(supplierData).subscribe({
            next: () => {
                this.showSuccess('Proveedor creado exitosamente');
                this.loadProveedores();
            },
            error: (err) => this.handleError(err)
        });
    }

    updateProveedor(id: string, formData: any): void {
        const supplierData = this.mapFormToBackend(formData);
        this.supplierService.updateSupplier(id, supplierData).subscribe({
            next: () => {
                this.showSuccess('Proveedor actualizado exitosamente');
                this.loadProveedores();
            },
            error: (err) => this.handleError(err)
        });
    }

    volver(): void {
        this.router.navigate(['/administration']);
    }

    getProveedoresActivos(): number {
        return this.proveedores.filter(p => p.active).length;
    }

    getProveedoresInactivos(): number {
        return this.proveedores.filter(p => !p.active).length;
    }

    getEstrellas(calificacion: number): string {
        return '⭐'.repeat(Math.floor(calificacion));
    }

    private showSuccess(message: string): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-success']
        });
    }

    private showWarning(message: string): void {
        this.snackBar.open(message, 'Entendido', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-warning']
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
