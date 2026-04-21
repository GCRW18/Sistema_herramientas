import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';

@Component({
    selector: 'app-anular-envio',
    standalone: true,
    imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule],
    templateUrl: './anular-envio.component.html'
})
export class AnularEnvioComponent {
    calibracion: any;
    motivo: string = '';

    constructor(
        public dialogRef: MatDialogRef<AnularEnvioComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { calibracion: any }
    ) {
        this.calibracion = data.calibracion;
    }

    confirmar(): void {
        if (this.motivo.trim().length === 0) return;
        this.dialogRef.close(this.motivo.trim());
    }
}
