import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

export interface UbicacionContactoData {
    ciudad?: string;
    pais?: string;
    direccion?: string;
    contacto_principal?: string;
    telefono_contacto?: string;
    email_contacto?: string;
    sitio_web?: string;
}

@Component({
    selector: 'app-ubicacion-contacto-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatDialogModule, DragDropModule],
    template: `
    <div class="bg-stone-100 dark:bg-slate-900 border-2 border-black rounded-2xl overflow-hidden flex flex-col"
         style="width: 420px;">

        <!-- Header -->
        <div class="bg-[#0F172A] px-4 py-2.5 flex items-center gap-2.5 shrink-0 select-none"
             cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragHandle style="cursor:grab">
            <div class="w-7 h-7 rounded-lg bg-amber-500 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#000] shrink-0">
                <mat-icon class="!text-sm text-white">location_on</mat-icon>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-[8px] text-slate-400 font-bold uppercase tracking-[0.18em] leading-none mb-0.5">Proveedor</p>
                <h2 class="text-xs text-white font-black uppercase tracking-tight leading-none">Ubicación y Contacto</h2>
            </div>
            <button type="button" (click)="cerrar()" (mousedown)="$event.stopPropagation()"
                    class="w-6 h-6 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/10 shrink-0">
                <mat-icon class="text-white !text-xs">close</mat-icon>
            </button>
        </div>

        <!-- Form -->
        <form [formGroup]="form" class="px-4 py-3 flex flex-col gap-2.5">

            <!-- Sección ubicación -->
            <div class="flex items-center gap-2">
                <mat-icon class="!text-xs text-[#FFC501FF]">location_on</mat-icon>
                <p class="text-[7px] font-black uppercase tracking-[0.2em] text-stone-400 dark:text-slate-500 whitespace-nowrap">Ubicación</p>
                <div class="flex-1 h-px bg-stone-200 dark:bg-slate-700"></div>
            </div>

            <div class="grid grid-cols-3 gap-2">
                <div>
                    <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Ciudad</label>
                    <div class="relative">
                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">location_city</mat-icon>
                        <input formControlName="ciudad" type="text"
                               class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all">
                    </div>
                </div>
                <div>
                    <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">País</label>
                    <div class="relative">
                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">public</mat-icon>
                        <input formControlName="pais" type="text"
                               class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all">
                    </div>
                </div>
                <div>
                    <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Dirección</label>
                    <div class="relative">
                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">pin_drop</mat-icon>
                        <input formControlName="direccion" type="text" placeholder="Av. Principal #123"
                               class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all placeholder:font-normal placeholder:text-stone-300">
                    </div>
                </div>
            </div>

            <!-- Sección contacto -->
            <div class="flex items-center gap-2 mt-0.5">
                <mat-icon class="!text-xs text-[#FFC501FF]">badge</mat-icon>
                <p class="text-[7px] font-black uppercase tracking-[0.2em] text-stone-400 dark:text-slate-500 whitespace-nowrap">Persona de Contacto</p>
                <div class="flex-1 h-px bg-stone-200 dark:bg-slate-700"></div>
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Nombre</label>
                    <div class="relative">
                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">badge</mat-icon>
                        <input formControlName="contacto_principal" type="text" placeholder="Nombre del contacto"
                               class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all placeholder:font-normal placeholder:text-stone-300">
                    </div>
                </div>
                <div>
                    <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Celular</label>
                    <div class="relative">
                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">smartphone</mat-icon>
                        <input formControlName="telefono_contacto" type="text"
                               class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all">
                    </div>
                </div>
                <div>
                    <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Email Contacto</label>
                    <div class="relative">
                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">alternate_email</mat-icon>
                        <input formControlName="email_contacto" type="email"
                               class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all">
                    </div>
                </div>
                <div>
                    <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Sitio Web</label>
                    <div class="relative">
                        <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">language</mat-icon>
                        <input formControlName="sitio_web" type="text" placeholder="https://..."
                               class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all placeholder:font-normal placeholder:text-stone-300">
                    </div>
                </div>
            </div>

        </form>

        <!-- Footer -->
        <div class="border-t-2 border-black bg-stone-200 dark:bg-slate-800 px-4 py-2 flex justify-between items-center gap-2 shrink-0">
            <button type="button" (click)="cerrar()"
                    class="px-3 py-1.5 bg-stone-300 dark:bg-slate-700 text-black dark:text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all uppercase">
                Cancelar
            </button>
            <button type="button" (click)="aplicar()"
                    class="flex items-center gap-1.5 px-4 py-1.5 bg-[#0F172A] text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[3px_3px_0_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all uppercase">
                <mat-icon class="!text-white !text-sm">check</mat-icon>
                Aplicar
            </button>
        </div>

    </div>
    `
})
export class UbicacionContactoDialogComponent {
    form: FormGroup;

    constructor(
        private fb: FormBuilder,
        private dialogRef: MatDialogRef<UbicacionContactoDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: UbicacionContactoData
    ) {
        this.form = this.fb.group({
            ciudad:             [data.ciudad             || ''],
            pais:               [data.pais               || 'Bolivia'],
            direccion:          [data.direccion          || ''],
            contacto_principal: [data.contacto_principal || ''],
            telefono_contacto:  [data.telefono_contacto  || ''],
            email_contacto:     [data.email_contacto     || ''],
            sitio_web:          [data.sitio_web          || '']
        });
    }

    aplicar(): void {
        this.dialogRef.close(this.form.value);
    }

    cerrar(): void {
        this.dialogRef.close(null);
    }
}
