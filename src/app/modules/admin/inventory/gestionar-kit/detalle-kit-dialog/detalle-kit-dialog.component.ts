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

    get categoriaClass(): string {
        const m: Record<string, string> = {
            'MANTENIMIENTO': 'bg-[#0F172A]',
            'LUBRICACION':   'bg-green-600',
            'FRENOS':        'bg-red-600',
            'CALIBRACION':   'bg-purple-600',
            'GENERAL':       'bg-gray-600'
        };
        return m[this.kit?.categoria ?? ''] ?? 'bg-gray-600';
    }

    get estadoClass(): string {
        const m: Record<string, string> = {
            'COMPLETO':       'bg-green-100 text-green-800 border-green-700',
            'INCOMPLETO':     'bg-yellow-100 text-yellow-800 border-yellow-700',
            'EN USO':         'bg-blue-100 text-blue-800 border-blue-700',
            'EN CALIBRACIÓN': 'bg-purple-100 text-purple-800 border-purple-700',
            'BAJA':           'bg-gray-100 text-gray-600 border-gray-400'
        };
        return m[this.kit?.estado ?? ''] ?? 'bg-gray-100 text-gray-600 border-gray-400';
    }

    cerrar(): void  { this.dialogRef.close(); }
    imprimir(): void { window.print(); }
}
