import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

export interface DetalleRecepcionData {
    recepcion: {
        nroCmr: string;
        tipoDe: string;
        fechaIngreso: string;
        proveedor: any;
        funcionarioRecibe: string;
        recibiConforme: string;
        nroFactura: string;
        ordenCompra: string;
        observaciones: string;
    };
}

export interface DetalleRecepcionResult {
    action: 'edit';
}

@Component({
    selector: 'app-detalle-recepcion',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatDialogModule, DragDropModule],
    templateUrl: './detalle-recepcion.component.html',
    styles: [`
        :host { display: block; width: 100%; }
        .custom-scrollbar-ing::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ing::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ing::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
    `]
})
export class DetalleRecepcionComponent {
    public dialogRef = inject(MatDialogRef<DetalleRecepcionComponent>, { optional: true });
    public data = inject<DetalleRecepcionData>(MAT_DIALOG_DATA, { optional: true });

    editar(): void {
        const result: DetalleRecepcionResult = { action: 'edit' };
        this.dialogRef?.close(result);
    }
}
