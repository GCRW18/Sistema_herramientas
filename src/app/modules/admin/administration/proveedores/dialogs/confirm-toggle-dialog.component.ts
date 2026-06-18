import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

export interface ConfirmToggleData {
    nombre: string;
    activar: boolean;
}

@Component({
    selector: 'app-confirm-toggle-dialog',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatDialogModule, DragDropModule],
    template: `
    <div class="bg-stone-100 dark:bg-slate-900 border-2 border-black rounded-2xl overflow-hidden flex flex-col"
         style="width: 360px;">

        <!-- Header -->
        <div class="bg-[#0F172A] px-4 py-2.5 flex items-center gap-2.5 shrink-0 select-none"
             cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragHandle style="cursor:grab">
            <div class="w-7 h-7 rounded-lg border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#000] shrink-0"
                 [ngClass]="data.activar ? 'bg-green-500' : 'bg-red-500'">
                <mat-icon class="!text-sm text-white">{{ data.activar ? 'check_circle' : 'block' }}</mat-icon>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-[8px] text-slate-400 font-bold uppercase tracking-[0.18em] leading-none mb-0.5">Proveedores · Estado</p>
                <h2 class="text-xs text-white font-black uppercase tracking-tight leading-none">
                    {{ data.activar ? 'Activar Proveedor' : 'Desactivar Proveedor' }}
                </h2>
            </div>
            <button type="button" (click)="cerrar()" (mousedown)="$event.stopPropagation()"
                    class="w-6 h-6 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/10 shrink-0">
                <mat-icon class="text-white !text-xs">close</mat-icon>
            </button>
        </div>

        <!-- Body -->
        <div class="px-5 py-5 flex flex-col items-center gap-3.5">

            <div class="w-14 h-14 rounded-xl border-2 border-black flex items-center justify-center shadow-[3px_3px_0_#000]"
                 [ngClass]="data.activar ? 'bg-green-100' : 'bg-red-100'">
                <mat-icon class="!text-3xl" [ngClass]="data.activar ? 'text-green-600' : 'text-red-600'">
                    {{ data.activar ? 'check_circle' : 'block' }}
                </mat-icon>
            </div>

            <div class="text-center">
                <p class="text-sm font-black text-black dark:text-white uppercase tracking-tight">
                    ¿{{ data.activar ? 'Activar' : 'Desactivar' }} proveedor?
                </p>
                <p class="text-[11px] font-bold text-stone-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    <span class="text-black dark:text-white font-black">"{{ data.nombre }}"</span>
                    {{ data.activar
                        ? ' quedará marcado como activo y visible en el sistema.'
                        : ' quedará inactivo y no aparecerá en nuevas selecciones.' }}
                </p>
            </div>

        </div>

        <!-- Footer -->
        <div class="border-t-2 border-black bg-stone-200 dark:bg-slate-800 px-4 py-2.5 flex justify-between items-center gap-2 shrink-0">
            <button type="button" (click)="cerrar()"
                    class="px-3 py-1.5 bg-stone-300 dark:bg-slate-700 text-black dark:text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all uppercase">
                Cancelar
            </button>
            <button type="button" (click)="confirmar()"
                    class="flex items-center gap-1.5 px-4 py-1.5 text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[3px_3px_0_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all uppercase"
                    [ngClass]="data.activar ? 'bg-green-600' : 'bg-red-600'">
                <mat-icon class="!text-white !text-sm">{{ data.activar ? 'check_circle' : 'block' }}</mat-icon>
                {{ data.activar ? 'Sí, activar' : 'Sí, desactivar' }}
            </button>
        </div>

    </div>
    `
})
export class ConfirmToggleDialogComponent {
    constructor(
        private dialogRef: MatDialogRef<ConfirmToggleDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ConfirmToggleData
    ) {}

    confirmar(): void { this.dialogRef.close(true); }
    cerrar(): void    { this.dialogRef.close(false); }
}
