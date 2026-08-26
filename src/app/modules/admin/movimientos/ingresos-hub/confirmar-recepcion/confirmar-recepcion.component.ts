import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import type { HerramientaItem } from '../ingresos-hub.component';

export interface ConfirmarRecepcionData {
    recepcion: {
        nroCmr: string;
        proveedor: any;
        funcionarioRecibe: string;
        fechaIngreso: string;
    };
    items: HerramientaItem[];
}

export interface ConfirmarRecepcionResult {
    action: 'revisar' | 'confirmar';
}

@Component({
    selector: 'app-confirmar-recepcion',
    standalone: true,
    imports: [CommonModule, MatIconModule, DragDropModule],
    templateUrl: './confirmar-recepcion.component.html',
    styles: [`
        :host { display: block; width: 100%; }
        .custom-scrollbar-ing::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ing::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ing::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
    `]
})
export class ConfirmarRecepcionComponent {
    public dialogRef = inject(MatDialogRef<ConfirmarRecepcionComponent>, { optional: true });
    public data = inject<ConfirmarRecepcionData>(MAT_DIALOG_DATA, { optional: true });

    revisar(): void {
        const result: ConfirmarRecepcionResult = { action: 'revisar' };
        this.dialogRef?.close(result);
    }

    confirmar(): void {
        const result: ConfirmarRecepcionResult = { action: 'confirmar' };
        this.dialogRef?.close(result);
    }
}
