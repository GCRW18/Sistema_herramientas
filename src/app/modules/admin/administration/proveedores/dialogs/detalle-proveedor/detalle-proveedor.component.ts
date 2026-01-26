import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

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
    private dialogRef = inject(MatDialogRef<DetalleProveedorComponent>);
    private dialog = inject(MatDialog);

    constructor(@Inject(MAT_DIALOG_DATA) public data: { proveedor: any }) {}

    async editarProveedor(): Promise<void> {
        this.dialogRef.close();
        const { FormProveedorComponent } = await import('../form-proveedor/form-proveedor.component');
        this.dialog.open(FormProveedorComponent, {
            width: '1200px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: { proveedor: this.data.proveedor, mode: 'edit' }
        });
    }

    cerrar(): void {
        this.dialogRef.close();
    }

    getEstrellas(calificacion: number): string {
        return '⭐'.repeat(Math.floor(calificacion));
    }
}
