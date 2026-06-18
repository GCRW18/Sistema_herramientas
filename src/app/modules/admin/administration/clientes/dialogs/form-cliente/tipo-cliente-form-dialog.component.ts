import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

export interface TipoClienteFormData {
    tipo: 'EMPRESA' | 'PERSONA';
    nombre?: string;
    nit?: string;
    razon_social?: string;
    registro_fiscal?: string;
    ciudad?: string;
    pais?: string;
    direccion?: string;
    email?: string;
    telefono?: string;
    contacto_principal?: string;
    telefono_contacto?: string;
    email_contacto?: string;
    observaciones?: string;
}

@Component({
    selector: 'app-tipo-cliente-form-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatDialogModule, DragDropModule],
    template: `
<div class="bg-stone-100 dark:bg-slate-900 border-2 border-black rounded-2xl overflow-hidden flex flex-col"
     style="width:500px">

    <!-- Header -->
    <div class="bg-[#0F172A] px-4 py-2.5 flex items-center gap-2.5 shrink-0 select-none"
         cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragHandle style="cursor:grab">
        <div class="w-7 h-7 rounded-lg border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#000] shrink-0"
             [ngClass]="tipo === 'EMPRESA' ? 'bg-blue-500' : 'bg-green-500'">
            <mat-icon class="!text-sm text-white">{{ tipo === 'EMPRESA' ? 'business' : 'person' }}</mat-icon>
        </div>
        <div class="flex-1 min-w-0">
            <p class="text-[8px] text-slate-400 font-bold uppercase tracking-[0.18em] leading-none mb-0.5">
                Cliente · {{ tipo === 'EMPRESA' ? 'Empresa' : 'Persona Natural' }}
            </p>
            <h2 class="text-xs text-white font-black uppercase tracking-tight leading-none">Datos del Cliente</h2>
        </div>
        <button type="button" (click)="cerrar()" (mousedown)="$event.stopPropagation()"
                class="w-6 h-6 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/10 shrink-0">
            <mat-icon class="text-white !text-xs">close</mat-icon>
        </button>
    </div>

    <!-- Form -->
    <form [formGroup]="form" class="px-4 py-3 flex flex-col gap-2.5 overflow-y-auto" style="max-height:70vh">

        <!-- Identificación -->
        <div class="flex items-center gap-2">
            <mat-icon class="!text-xs text-[#FFC501FF]">badge</mat-icon>
            <p class="text-[7px] font-black uppercase tracking-[0.2em] text-stone-400 dark:text-slate-500 whitespace-nowrap">Identificación</p>
            <div class="flex-1 h-px bg-stone-200 dark:bg-slate-700"></div>
        </div>

        <div class="grid grid-cols-3 gap-2">
            <div class="col-span-2">
                <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Nombre *</label>
                <div class="relative">
                    <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">person_outline</mat-icon>
                    <input formControlName="nombre" type="text" placeholder="Nombre del cliente o empresa"
                           class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all placeholder:font-normal placeholder:text-stone-300 dark:placeholder:text-slate-600"
                           [ngClass]="form.get('nombre')?.invalid && form.get('nombre')?.touched ? 'border-red-400' : 'border-stone-300 dark:border-slate-600'">
                </div>
                <p *ngIf="form.get('nombre')?.invalid && form.get('nombre')?.touched" class="text-[7px] font-bold text-red-500 mt-0.5">Campo requerido.</p>
            </div>
            <div>
                <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">NIT / CI</label>
                <div class="relative">
                    <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">tag</mat-icon>
                    <input formControlName="nit" type="text" placeholder="0000000"
                           class="w-full h-8 text-xs font-bold font-mono bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all placeholder:font-normal placeholder:text-stone-300 dark:placeholder:text-slate-600">
                </div>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-2" *ngIf="tipo === 'EMPRESA'">
            <div>
                <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Razón Social *</label>
                <div class="relative">
                    <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">domain</mat-icon>
                    <input formControlName="razon_social" type="text" placeholder="Nombre legal registrado"
                           class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all placeholder:font-normal placeholder:text-stone-300 dark:placeholder:text-slate-600"
                           [ngClass]="form.get('razon_social')?.invalid && form.get('razon_social')?.touched ? 'border-red-400' : 'border-stone-300 dark:border-slate-600'">
                </div>
                <p *ngIf="form.get('razon_social')?.invalid && form.get('razon_social')?.touched" class="text-[7px] font-bold text-red-500 mt-0.5">Requerido para empresas.</p>
            </div>
            <div>
                <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Registro Fiscal</label>
                <div class="relative">
                    <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">receipt_long</mat-icon>
                    <input formControlName="registro_fiscal" type="text" placeholder="Opcional"
                           class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all placeholder:font-normal placeholder:text-stone-300 dark:placeholder:text-slate-600">
                </div>
            </div>
        </div>

        <!-- Ubicación -->
        <div class="flex items-center gap-2 mt-0.5">
            <mat-icon class="!text-xs text-[#FFC501FF]">location_on</mat-icon>
            <p class="text-[7px] font-black uppercase tracking-[0.2em] text-stone-400 dark:text-slate-500 whitespace-nowrap">Ubicación</p>
            <div class="flex-1 h-px bg-stone-200 dark:bg-slate-700"></div>
        </div>

        <div class="grid grid-cols-3 gap-2">
            <div>
                <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Ciudad *</label>
                <div class="relative">
                    <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">location_city</mat-icon>
                    <input formControlName="ciudad" type="text"
                           class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all"
                           [ngClass]="form.get('ciudad')?.invalid && form.get('ciudad')?.touched ? 'border-red-400' : 'border-stone-300 dark:border-slate-600'">
                </div>
                <p *ngIf="form.get('ciudad')?.invalid && form.get('ciudad')?.touched" class="text-[7px] font-bold text-red-500 mt-0.5">Requerido.</p>
            </div>
            <div>
                <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">País *</label>
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
                           class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all placeholder:font-normal placeholder:text-stone-300 dark:placeholder:text-slate-600">
                </div>
            </div>
        </div>

        <!-- Contacto -->
        <div class="flex items-center gap-2 mt-0.5">
            <mat-icon class="!text-xs text-[#FFC501FF]">mail</mat-icon>
            <p class="text-[7px] font-black uppercase tracking-[0.2em] text-stone-400 dark:text-slate-500 whitespace-nowrap">Contacto</p>
            <div class="flex-1 h-px bg-stone-200 dark:bg-slate-700"></div>
        </div>

        <div class="grid grid-cols-2 gap-2">
            <div>
                <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Email Principal *</label>
                <div class="relative">
                    <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">mail</mat-icon>
                    <input formControlName="email" type="email" placeholder="correo@empresa.com"
                           class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all placeholder:font-normal placeholder:text-stone-300 dark:placeholder:text-slate-600"
                           [ngClass]="form.get('email')?.invalid && form.get('email')?.touched ? 'border-red-400' : 'border-stone-300 dark:border-slate-600'">
                </div>
                <p *ngIf="form.get('email')?.invalid && form.get('email')?.touched" class="text-[7px] font-bold text-red-500 mt-0.5">Email inválido.</p>
            </div>
            <div>
                <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Teléfono *</label>
                <div class="relative">
                    <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">call</mat-icon>
                    <input formControlName="telefono" type="text" placeholder="+591 ..."
                           class="w-full h-8 text-xs font-bold font-mono bg-white dark:bg-slate-800 dark:text-white border-2 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all placeholder:font-normal placeholder:text-stone-300 dark:placeholder:text-slate-600"
                           [ngClass]="form.get('telefono')?.invalid && form.get('telefono')?.touched ? 'border-red-400' : 'border-stone-300 dark:border-slate-600'">
                </div>
                <p *ngIf="form.get('telefono')?.invalid && form.get('telefono')?.touched" class="text-[7px] font-bold text-red-500 mt-0.5">Requerido.</p>
            </div>
        </div>

        <!-- Persona de Contacto -->
        <div class="flex items-center gap-2 mt-0.5">
            <mat-icon class="!text-xs text-[#FFC501FF]">groups</mat-icon>
            <p class="text-[7px] font-black uppercase tracking-[0.2em] text-stone-400 dark:text-slate-500 whitespace-nowrap">Persona de Contacto</p>
            <div class="flex-1 h-px bg-stone-200 dark:bg-slate-700"></div>
        </div>

        <div class="grid grid-cols-3 gap-2">
            <div>
                <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Nombre *</label>
                <div class="relative">
                    <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">badge</mat-icon>
                    <input formControlName="contacto_principal" type="text" placeholder="Nombre contacto"
                           class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all placeholder:font-normal placeholder:text-stone-300 dark:placeholder:text-slate-600"
                           [ngClass]="form.get('contacto_principal')?.invalid && form.get('contacto_principal')?.touched ? 'border-red-400' : 'border-stone-300 dark:border-slate-600'">
                </div>
                <p *ngIf="form.get('contacto_principal')?.invalid && form.get('contacto_principal')?.touched" class="text-[7px] font-bold text-red-500 mt-0.5">Requerido.</p>
            </div>
            <div>
                <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Celular Directo</label>
                <div class="relative">
                    <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">smartphone</mat-icon>
                    <input formControlName="telefono_contacto" type="text"
                           class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all">
                </div>
            </div>
            <div>
                <label class="text-[7px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-0.5 block">Email Directo</label>
                <div class="relative">
                    <mat-icon class="absolute left-2 top-1/2 -translate-y-1/2 text-stone-300 dark:text-slate-600 pointer-events-none !text-sm">alternate_email</mat-icon>
                    <input formControlName="email_contacto" type="email"
                           class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all">
                </div>
            </div>
        </div>

        <!-- Notas -->
        <div class="flex items-center gap-2 mt-0.5">
            <mat-icon class="!text-xs text-[#FFC501FF]">notes</mat-icon>
            <p class="text-[7px] font-black uppercase tracking-[0.2em] text-stone-400 dark:text-slate-500 whitespace-nowrap">Notas</p>
            <div class="flex-1 h-px bg-stone-200 dark:bg-slate-700"></div>
        </div>

        <div>
            <textarea formControlName="observaciones" rows="2"
                      placeholder="Historial, preferencias, notas importantes..."
                      class="w-full text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-3 py-1.5 outline-none focus:border-black focus:shadow-[2px_2px_0_#000] transition-all placeholder:font-normal placeholder:text-stone-300 dark:placeholder:text-slate-600 resize-none"></textarea>
        </div>

    </form>

    <!-- Footer -->
    <div class="border-t-2 border-black bg-stone-200 dark:bg-slate-800 px-4 py-2 flex justify-between items-center gap-2 shrink-0">
        <button type="button" (click)="cerrar()"
                class="px-3 py-1.5 bg-stone-300 dark:bg-slate-700 text-black dark:text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all uppercase">
            Cancelar
        </button>
        <button type="button" (click)="guardar()"
                class="flex items-center gap-1.5 px-4 py-1.5 bg-[#0F172A] text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[3px_3px_0_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all uppercase">
            <mat-icon class="!text-white !text-sm">check</mat-icon>
            Guardar
        </button>
    </div>

</div>
    `
})
export class TipoClienteFormDialogComponent {
    form: FormGroup;
    tipo: 'EMPRESA' | 'PERSONA';

    constructor(
        private fb: FormBuilder,
        private dialogRef: MatDialogRef<TipoClienteFormDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TipoClienteFormData
    ) {
        this.tipo = data.tipo;
        this.form = this.fb.group({
            nombre:             [data.nombre             || '', Validators.required],
            nit:                [data.nit                || ''],
            razon_social:       [data.razon_social       || '', data.tipo === 'EMPRESA' ? [Validators.required] : []],
            registro_fiscal:    [data.registro_fiscal    || ''],
            ciudad:             [data.ciudad             || '', Validators.required],
            pais:               [data.pais               || 'Bolivia', Validators.required],
            direccion:          [data.direccion          || ''],
            email:              [data.email              || '', [Validators.required, Validators.email]],
            telefono:           [data.telefono           || '', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]+$/)]],
            contacto_principal: [data.contacto_principal || '', Validators.required],
            telefono_contacto:  [data.telefono_contacto  || ''],
            email_contacto:     [data.email_contacto     || '', Validators.email],
            observaciones:      [data.observaciones      || '']
        });
    }

    guardar(): void {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        } else {
            this.form.markAllAsTouched();
        }
    }

    cerrar(): void {
        this.dialogRef.close(null);
    }
}
