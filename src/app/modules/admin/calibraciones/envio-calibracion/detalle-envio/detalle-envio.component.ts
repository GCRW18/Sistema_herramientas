import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
    selector: 'app-detalle-envio',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatDialogModule, MatTooltipModule],
    templateUrl: './detalle-envio.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #0F172AFF; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #1e293b; }
    `]
})
export class DetalleEnvioComponent {
    calibracion: any;

    constructor(
        public dialogRef: MatDialogRef<DetalleEnvioComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { calibracion: any }
    ) {
        this.calibracion = data.calibracion;
    }

    getWorkTypeLabel(w: string): string {
        if (w === 'CALIBRACIÓN Y REPARACIÓN') return 'CAL + REP.';
        if (w === 'CALIBRACIÓN') return 'CALIB.';
        if (w === 'REPARACIÓN') return 'REPAR.';
        return w || '—';
    }

    getStatusLabel(s: string): string {
        const labels: Record<string, string> = {
            'sent': 'ENVIADO',
            'in_process': 'EN PROCESO',
            'returned': 'RETORNADO',
            'cancelled': 'ANULADO'
        };
        return labels[s] ?? s.toUpperCase();
    }

    getStatusChipClass(s: string): string {
        const classes: Record<string, string> = {
            'sent': 'bg-blue-100 text-blue-800 border-blue-200',
            'in_process': 'bg-amber-100 text-amber-800 border-amber-200',
            'returned': 'bg-green-100 text-green-800 border-green-200',
            'cancelled': 'bg-red-100 text-red-800 border-red-200'
        };
        return classes[s] ?? 'bg-gray-100 text-gray-700 border-gray-200';
    }
}
