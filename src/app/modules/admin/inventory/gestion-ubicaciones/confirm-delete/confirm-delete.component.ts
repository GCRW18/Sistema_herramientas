import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';

export interface ConfirmDeleteData {
    title?:    string;
    itemKind?: string;   // "almacén", "estante", "nivel", etc.
    itemName?: string;   // nombre o descripción visible
    itemCode?: string;   // código mostrado en negrita
    warning?:  string;   // texto de advertencia adicional ("y sus N niveles")
    confirmLabel?: string;
}

@Component({
    selector: 'app-confirm-delete',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatIconModule, DragDropModule],
    templateUrl: './confirm-delete.component.html',
    styles: [`
        :host { display: block; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
        .shake-icon { animation: shake .6s ease-in-out infinite; }
    `]
})
export class ConfirmDeleteComponent {
    dialogRef = inject(MatDialogRef<ConfirmDeleteComponent>);
    data      = inject<ConfirmDeleteData>(MAT_DIALOG_DATA) ?? {};

    get title()        { return this.data.title        ?? 'CONFIRMAR ELIMINACIÓN'; }
    get itemKind()     { return this.data.itemKind     ?? 'elemento'; }
    get itemName()     { return this.data.itemName     ?? ''; }
    get itemCode()     { return this.data.itemCode     ?? ''; }
    get warning()      { return this.data.warning      ?? ''; }
    get confirmLabel() { return this.data.confirmLabel ?? 'Eliminar'; }

    cancel()  { this.dialogRef.close(false); }
    confirm() { this.dialogRef.close(true); }
}
