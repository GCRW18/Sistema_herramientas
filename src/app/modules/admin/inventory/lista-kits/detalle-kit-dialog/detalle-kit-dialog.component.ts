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
        /* ESTILOS PARA ARRASTRAR */
        app-detalle-kit-dialog {
            display: block;
            width: 100%;
            height: 100%;
        }

        /* Efecto visual durante el arrastre */
        .cdk-drag-preview {
            opacity: 0.9;
            box-shadow: 12px 12px 0px 0px rgba(0, 0, 0, 0.8) !important;
            border: 3px solid black !important;
            border-radius: 12px !important;
        }

        .cdk-drag-placeholder {
            opacity: 0.3;
        }

        .cdk-drag-animating {
            transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
        }

        /* Indicador de área arrastrable */
        [cdkDragHandle] {
            cursor: move !important;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            touch-action: none;
        }

        [cdkDragHandle]:hover {
            background-color: rgba(255, 229, 0, 0.05);
        }

        [cdkDragHandle]:active {
            cursor: grabbing !important;
        }

        /* SCROLLBAR PERSONALIZADO ESTILO INDUSTRIAL */
        app-detalle-kit-dialog ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }

        app-detalle-kit-dialog ::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-left: 2px solid black;
        }

        app-detalle-kit-dialog ::-webkit-scrollbar-thumb {
            background: #111A43;
            border: 2px solid black;
            border-radius: 4px;
        }

        app-detalle-kit-dialog ::-webkit-scrollbar-thumb:hover {
            background: #000;
        }

        /* Dark mode scrollbar */
        .dark app-detalle-kit-dialog ::-webkit-scrollbar-track {
            background: #1e293b;
            border-left: 2px solid white;
        }

        .dark app-detalle-kit-dialog ::-webkit-scrollbar-thumb {
            background: #FFE500;
            border: 2px solid white;
        }

        @media print {
            app-detalle-kit-dialog ::-webkit-scrollbar {
                display: none;
            }
        }
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
