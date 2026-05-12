import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';

@Component({
    selector: 'app-detalle-kit-dialog',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatIconModule, DragDropModule],
    encapsulation: ViewEncapsulation.None,
    templateUrl: './detalle-kit-dialog.component.html',
    styles: [`
        app-detalle-kit-dialog { display: block; }

        app-detalle-kit-dialog ::-webkit-scrollbar { width: 8px; }
        app-detalle-kit-dialog ::-webkit-scrollbar-track { background: #e7e5e4; border-left: 2px solid #000; }
        app-detalle-kit-dialog ::-webkit-scrollbar-thumb { background: #0F172A; border: 2px solid #000; border-radius: 4px; }
        app-detalle-kit-dialog ::-webkit-scrollbar-thumb:hover { background: #000; }
        .dark app-detalle-kit-dialog ::-webkit-scrollbar-track { background: #1e293b; }
        .dark app-detalle-kit-dialog ::-webkit-scrollbar-thumb { background: #fbbf24; border-color: #000; }
    `]
})
export class DetalleKitDialogComponent {
    constructor(
        public dialogRef: MatDialogRef<DetalleKitDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public kit: any
    ) {}

    cerrar() {
        this.dialogRef.close();
    }

    imprimir() {
        window.print();
    }
}
