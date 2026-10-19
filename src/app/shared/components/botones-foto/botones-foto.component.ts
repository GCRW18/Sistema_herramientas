import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Botones "Subir archivo" / "Tomar foto" bajo la zona de foto de un formulario.
 * "Tomar foto" usa capture="environment": en celular o tablet abre la cámara trasera
 * (funciona en HTTP); en una PC abre el selector de archivos normal.
 * Emite el mismo Event del <input type="file">, así el padre reutiliza su handler actual.
 */
@Component({
    selector: 'app-botones-foto',
    standalone: true,
    imports: [MatIconModule],
    template: `
        <div class="flex gap-2 w-full mt-2">
            <button type="button" (click)="archivoInput.click()" [disabled]="disabled"
                    class="{{ btnClass }} bg-white dark:bg-slate-800 text-black dark:text-white">
                <mat-icon class="!text-sm !w-4 !h-4">upload_file</mat-icon>
                Subir archivo
            </button>
            <button type="button" (click)="camaraInput.click()" [disabled]="disabled"
                    class="{{ btnClass }} bg-amber-400 text-black">
                <mat-icon class="!text-sm !w-4 !h-4">photo_camera</mat-icon>
                Tomar foto
            </button>
        </div>
        <input #archivoInput type="file" [accept]="accept" class="hidden" (change)="emitir($event)">
        <input #camaraInput type="file" accept="image/*" capture="environment" class="hidden" (change)="emitir($event)">
    `,
})
export class BotonesFotoComponent {
    @Input() accept = 'image/*';
    @Input() disabled = false;
    @Output() seleccion = new EventEmitter<Event>();

    readonly btnClass = 'flex-1 flex items-center justify-center gap-1 h-8 text-[9px] font-black uppercase border-2 border-black rounded-lg shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all disabled:opacity-40 disabled:cursor-not-allowed';

    emitir(event: Event): void {
        this.seleccion.emit(event);
        // Limpia el input para que volver a elegir/tomar la misma foto dispare (change) otra vez.
        (event.target as HTMLInputElement).value = '';
    }
}
