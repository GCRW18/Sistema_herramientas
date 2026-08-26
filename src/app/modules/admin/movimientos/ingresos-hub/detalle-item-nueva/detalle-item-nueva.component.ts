import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import type { HerramientaItem } from '../ingresos-hub.component';

export interface DetalleItemNuevaData {
    item: HerramientaItem;
}

@Component({
    selector: 'app-detalle-item-nueva',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatDialogModule],
    templateUrl: './detalle-item-nueva.component.html',
    styles: [`
        :host { display: block; width: 100%; }
        .custom-scrollbar-ing::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ing::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ing::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
    `]
})
export class DetalleItemNuevaComponent {
    public data = inject<DetalleItemNuevaData>(MAT_DIALOG_DATA, { optional: true });
}
