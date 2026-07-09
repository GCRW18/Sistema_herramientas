import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { SupplierService } from '../../../../../../core/services/supplier.service';

@Component({
    selector: 'app-detalle-proveedor',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './detalle-proveedor.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }
    `]
})
export class DetalleProveedorComponent {
    private dialogRef      = inject(MatDialogRef<DetalleProveedorComponent>);
    private dialog         = inject(MatDialog);
    private supplierService = inject(SupplierService);

    constructor(@Inject(MAT_DIALOG_DATA) public data: { proveedor: any }) {}

    async editarProveedor(): Promise<void> {
        const { FormProveedorComponent } = await import('../form-proveedor/form-proveedor.component');
        const ref = this.dialog.open(FormProveedorComponent, {
            width: '560px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: false,
            data: { proveedor: this.data.proveedor, mode: 'edit' }
        });

        ref.afterClosed().subscribe(result => {
            if (result) {
                this.supplierService.updateSupplier(
                    this.data.proveedor.id,
                    this.mapFormToBackend(result)
                ).subscribe({
                    next: () => this.dialogRef.close('updated'),
                    error: (err) => console.error('Error al actualizar proveedor:', err)
                });
            }
        });
    }

    private mapFormToBackend(formData: any): any {
        const typeReverseMap: Record<string, string> = {
            'HERRAMIENTAS': 'tools',
            'CALIBRACION':  'calibration',
            'REPARACION':   'maintenance',
            'MIXTO':        'general'
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
            // conservar el estado actual del proveedor (el form no edita 'active')
            active:        formData.active !== undefined ? formData.active : (this.data.proveedor?.active ?? true)
        };
    }

    cerrar(): void {
        this.dialogRef.close();
    }

    getEstrellas(calificacion: number): string {
        return '⭐'.repeat(Math.floor(calificacion));
    }
}
