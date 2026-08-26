import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

export interface DetalleAjusteData {
    resumen: {
        documento: string;
        tipoLabel: string;
        fecha: string;
        descripcion: string;
        realizadoPor: string;
        aprobadoPor: string;
        isValido: boolean;
    };
}

export interface DetalleAjusteResult {
    action: 'edit';
}

@Component({
    selector: 'app-detalle-ajuste',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatDialogModule, DragDropModule],
    templateUrl: './detalle-ajuste.component.html',
    styles: [`
        :host { display: block; width: 100%; }
        .custom-scrollbar-ing::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ing::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ing::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
    `]
})
export class DetalleAjusteComponent {
    public dialogRef = inject(MatDialogRef<DetalleAjusteComponent>, { optional: true });
    public data = inject<DetalleAjusteData>(MAT_DIALOG_DATA, { optional: true });

    editar(): void {
        const result: DetalleAjusteResult = { action: 'edit' };
        this.dialogRef?.close(result);
    }
}
