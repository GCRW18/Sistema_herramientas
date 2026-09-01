import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

export interface ConfirmarAjusteData {
    resumen: {
        realizadoPor: string;
        aprobadoPor: string;
        tipoLabel: string;
        fecha: string;
        documento: string;
        descripcion: string;
        totalLineas: number;
        totalCantidad: number;
        porTipo: { label: string; icon: string; count: number }[];
    };
}

export interface ConfirmarAjusteResult {
    action: 'revisar' | 'confirmar';
}

@Component({
    selector: 'app-confirmar-ajuste',
    standalone: true,
    imports: [CommonModule, MatIconModule, DragDropModule],
    templateUrl: './confirmar-ajuste.component.html',
    styles: [`
        :host { display: block; width: 100%; }
        .custom-scrollbar-ing::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ing::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ing::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
    `]
})
export class ConfirmarAjusteComponent {
    public dialogRef = inject(MatDialogRef<ConfirmarAjusteComponent>, { optional: true });
    public data = inject<ConfirmarAjusteData>(MAT_DIALOG_DATA, { optional: true });

    revisar(): void {
        const result: ConfirmarAjusteResult = { action: 'revisar' };
        this.dialogRef?.close(result);
    }

    confirmar(): void {
        const result: ConfirmarAjusteResult = { action: 'confirmar' };
        this.dialogRef?.close(result);
    }
}
