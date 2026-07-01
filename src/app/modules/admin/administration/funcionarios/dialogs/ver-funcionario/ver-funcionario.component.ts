import { Component, inject, Optional, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';

@Component({
    selector: 'app-ver-funcionario',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatIconModule, DragDropModule],
    templateUrl: './ver-funcionario.component.html',
    styles: [`:host { display: flex; flex-direction: column; }`]
})
export class VerFuncionarioComponent {
    public dialogRef = inject(MatDialogRef<VerFuncionarioComponent>, { optional: true });

    constructor(@Optional() @Inject(MAT_DIALOG_DATA) public emp: any) {}

    get initials(): string {
        const name = this.emp?.full_name || '?';
        return name.split(' ').slice(0, 2).map((n: string) => n.charAt(0).toUpperCase()).join('');
    }

    get areaColor(): string {
        const map: Record<string, string> = {
            'LINEA':          'bg-blue-100 text-blue-800',
            'MANTENIMIENTO':  'bg-orange-100 text-orange-800',
            'AVIONICOS':      'bg-purple-100 text-purple-800',
            'ESTRUCTURAS':    'bg-green-100 text-green-800',
            'MOTORES':        'bg-red-100 text-red-800',
            'ALMACEN':        'bg-gray-200 text-gray-700',
            'CENTRO CONTROL': 'bg-cyan-100 text-cyan-800',
        };
        return map[this.emp?.area] ?? 'bg-stone-100 text-stone-700';
    }

    close(): void { this.dialogRef?.close(); }
}
