import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

@Component({
    selector: 'app-detalle-cliente',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './detalle-cliente.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }
    `]
})
export class DetalleClienteComponent {
    private dialogRef = inject(MatDialogRef<DetalleClienteComponent>);
    private dialog = inject(MatDialog);

    constructor(@Inject(MAT_DIALOG_DATA) public data: { cliente: any }) {}

    async editarCliente(): Promise<void> {
        this.dialogRef.close();
        const { FormClienteComponent } = await import('../form-cliente/form-cliente.component');
        this.dialog.open(FormClienteComponent, {
            width: '1200px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: { cliente: this.data.cliente, mode: 'edit' }
        });
    }

    cerrar(): void {
        this.dialogRef.close();
    }
}
