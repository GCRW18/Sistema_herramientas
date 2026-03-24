import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

@Component({
    selector: 'app-entrada-material',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatIconModule, MatSnackBarModule
    ],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] font-sans overflow-hidden relative">

        <!-- DECORATIVE -->
        <div class="fixed top-16 right-10 w-48 h-48 bg-[#1AAA1F] rounded-full border-4 border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-28 h-28 bg-cyan-400 rotate-12 border-4 border-black opacity-5 pointer-events-none"></div>

        <!-- MAIN -->
        <div class="flex-1 flex flex-col p-3 gap-3 overflow-hidden h-full relative z-10">

            <!-- HEADER -->
            <div class="flex items-center justify-between gap-3 shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-[#1AAA1F] border-[3px] border-black shadow-[3px_3px_0px_0px_#000] rounded-xl flex items-center justify-center shrink-0">
                        <mat-icon class="text-white !text-xl">arrow_downward</mat-icon>
                    </div>
                    <div>
                        <h1 class="text-lg font-black text-black dark:text-white uppercase tracking-tight leading-none">Entrada Misceláneos</h1>
                        <span class="text-[10px] font-bold bg-[#1AAA1F] text-white px-2 py-0.5 inline-block border border-black uppercase tracking-wide mt-0.5">
                            INGRESO DE MATERIAL AL ALMACÉN
                        </span>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <!-- Progreso -->
                    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000]">
                        <span class="w-2 h-2 rounded-full" [class.bg-[#1AAA1F]]="isValid()" [class.bg-gray-300]="!isValid()"></span>
                        <span class="text-xs font-black" [class.text-[#1AAA1F]]="isValid()" [class.text-gray-500]="!isValid()">
                            {{ getFilledCount() }}/{{ requiredFields.length }} campos
                        </span>
                    </div>
                    <button (click)="onSubmit()" [disabled]="!isValid()"
                            class="px-5 py-2 bg-yellow-400 text-black font-black text-xs border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
                        <mat-icon class="!text-sm">check</mat-icon> ACEPTAR ENTRADA
                    </button>
                    <button (click)="onCancel()"
                            class="px-5 py-2 bg-[#0F172AFF] text-white font-black text-xs border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-1.5">
                        <mat-icon class="!text-sm">close</mat-icon> CANCELAR
                    </button>
                </div>
            </div>

            <!-- BODY: 2 COLUMNAS -->
            <div class="flex flex-row gap-3 flex-1 overflow-hidden min-h-0">

                <!-- ====================================================== -->
                <!-- PANEL IZQUIERDO: Identificación del documento           -->
                <!-- ====================================================== -->
                <div class="w-[230px] shrink-0 flex flex-col">
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-full">

                        <div class="bg-[#0F172AFF] px-3 py-2 border-b-2 border-black flex items-center gap-2 shrink-0">
                            <mat-icon class="text-[#1AAA1F] !text-base">assignment</mat-icon>
                            <span class="font-black text-xs uppercase text-white tracking-wide">Documento</span>
                        </div>

                        <!-- Nro. Nota como "sello de documento" -->
                        <div class="px-3 pt-3 pb-3 border-b-2 border-dashed border-gray-200 dark:border-slate-600 shrink-0">
                            <label class="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 mb-1.5 block tracking-widest">Nro. Nota de Ingreso</label>
                            <input type="text" [(ngModel)]="form.nroNota" placeholder="000000"
                                   class="w-full h-12 text-2xl font-black border-[3px] border-black dark:border-slate-500 rounded-xl px-3 bg-[#f0fdf4] dark:bg-[#0c1a0c] text-[#1AAA1F] dark:text-green-400 text-center tracking-[0.2em] focus:shadow-[3px_3px_0px_0px_#1AAA1F] transition-shadow outline-none placeholder:text-gray-300 placeholder:text-xl placeholder:font-normal placeholder:tracking-normal">
                        </div>

                        <div class="p-3 flex flex-col gap-2.5 flex-1">
                            <div>
                                <label class="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 block">Fecha <span class="text-red-500">*</span></label>
                                <input type="date" [(ngModel)]="form.fecha"
                                       class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#1AAA1F] transition-shadow outline-none">
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 block">Hora <span class="text-red-500">*</span></label>
                                <input type="time" [(ngModel)]="form.hora"
                                       class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#1AAA1F] transition-shadow outline-none">
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 block">Nro. Factura</label>
                                <input type="text" [(ngModel)]="form.factura" placeholder="Opcional"
                                       class="w-full h-9 text-sm font-bold border-2 border-gray-200 dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-300">
                            </div>

                            <!-- Spacer + info -->
                            <div class="flex-1"></div>
                            <div class="bg-[#f0fdf4] dark:bg-green-900/20 border-2 border-[#1AAA1F]/40 rounded-xl p-2.5">
                                <div class="flex items-center gap-1.5 mb-1">
                                    <mat-icon class="text-[#1AAA1F] !text-sm">info</mat-icon>
                                    <span class="text-[9px] font-black uppercase text-[#1AAA1F] tracking-wider">Tipo de Movimiento</span>
                                </div>
                                <p class="text-[10px] font-bold text-gray-600 dark:text-gray-300 leading-tight">Ingreso de materiales misceláneos y consumibles al almacén general</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ====================================================== -->
                <!-- PANEL DERECHO: Detalles del ingreso                     -->
                <!-- ====================================================== -->
                <div class="flex-1 flex flex-col">
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-full">

                        <div class="bg-[#1AAA1F] px-3 py-2 border-b-2 border-black flex items-center gap-2 shrink-0">
                            <div class="w-6 h-6 bg-white/20 border border-white/40 rounded-lg flex items-center justify-center">
                                <mat-icon class="text-white !text-sm">inventory_2</mat-icon>
                            </div>
                            <span class="font-black text-sm uppercase text-white tracking-wide">Detalles del Ingreso</span>
                            <span class="ml-auto text-[9px] font-black text-white/60 uppercase tracking-wider flex items-center gap-1">
                                <span class="text-red-300">*</span> Campos obligatorios
                            </span>
                        </div>

                        <div class="p-3 flex flex-col gap-3 flex-1">

                            <!-- ── Sección 1: Receptor y Material ── -->
                            <div>
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="w-1.5 h-4 bg-[#1AAA1F] rounded-full"></span>
                                    <span class="text-[9px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-widest">Receptor y Material</span>
                                    <div class="h-px flex-1 bg-gray-100 dark:bg-slate-700"></div>
                                </div>
                                <div class="grid grid-cols-3 gap-3">
                                    <div>
                                        <label class="text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1 block">Recibido por <span class="text-red-500">*</span></label>
                                        <div class="relative">
                                            <input type="text" [(ngModel)]="form.recibidoPor" placeholder="Nombre del receptor"
                                                   class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#1AAA1F] transition-shadow outline-none placeholder:text-gray-300">
                                            <mat-icon class="absolute right-2 top-1.5 text-gray-300 !text-base pointer-events-none">person</mat-icon>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1 block">Código / Nombre <span class="text-red-500">*</span></label>
                                        <div class="relative">
                                            <input type="text" [(ngModel)]="form.codigoNombre" placeholder="BOA-H-XXXX o descripción"
                                                   class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#1AAA1F] transition-shadow outline-none placeholder:text-gray-300">
                                            <mat-icon class="absolute right-2 top-1.5 text-gray-300 !text-base pointer-events-none">qr_code</mat-icon>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1 block">Producto <span class="text-red-500">*</span></label>
                                        <div class="relative">
                                            <input type="text" [(ngModel)]="form.producto" placeholder="Descripción del producto"
                                                   class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#1AAA1F] transition-shadow outline-none placeholder:text-gray-300">
                                            <mat-icon class="absolute right-2 top-1.5 text-gray-300 !text-base pointer-events-none">inventory_2</mat-icon>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- ── Sección 2: Cantidades y Referencia ── -->
                            <div>
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="w-1.5 h-4 bg-cyan-500 rounded-full"></span>
                                    <span class="text-[9px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-widest">Cantidades y Referencia</span>
                                    <div class="h-px flex-1 bg-gray-100 dark:bg-slate-700"></div>
                                </div>
                                <div class="grid grid-cols-4 gap-3">
                                    <div>
                                        <label class="text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1 block">Cantidad <span class="text-red-500">*</span></label>
                                        <div class="relative">
                                            <input type="number" [(ngModel)]="form.cantidad" placeholder="0" min="1"
                                                   class="w-full h-9 text-sm font-black border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#1AAA1F] transition-shadow outline-none text-center">
                                            <mat-icon class="absolute right-1.5 top-1.5 text-gray-300 !text-base pointer-events-none">numbers</mat-icon>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1 block">Unidad <span class="text-red-500">*</span></label>
                                        <div class="relative">
                                            <input type="text" [(ngModel)]="form.unidad" placeholder="PZA / KG"
                                                   class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#1AAA1F] transition-shadow outline-none placeholder:text-gray-300">
                                            <mat-icon class="absolute right-1.5 top-1.5 text-gray-300 !text-base pointer-events-none">straighten</mat-icon>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1 block">Stock Actual</label>
                                        <div class="relative">
                                            <input type="text" [(ngModel)]="form.stock" placeholder="En almacén"
                                                   class="w-full h-9 text-sm font-bold border-2 border-gray-200 dark:border-slate-600 rounded-lg pl-3 pr-8 bg-gray-50 dark:bg-[#0F172AFF] text-gray-600 dark:text-gray-400 focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-300">
                                            <mat-icon class="absolute right-1.5 top-1.5 text-gray-200 !text-base pointer-events-none">inventory</mat-icon>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1 block">Part Number</label>
                                        <input type="text" [(ngModel)]="form.pn" placeholder="P/N fabricante"
                                               class="w-full h-9 text-sm font-bold border-2 border-gray-200 dark:border-slate-600 rounded-lg px-3 bg-gray-50 dark:bg-[#0F172AFF] text-gray-600 dark:text-gray-400 focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-300">
                                    </div>
                                </div>
                            </div>

                            <!-- ── Sección 3: Datos del Fabricante ── -->
                            <div>
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="w-1.5 h-4 bg-gray-300 rounded-full"></span>
                                    <span class="text-[9px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-widest">Fabricante (Opcional)</span>
                                    <div class="h-px flex-1 bg-gray-100 dark:bg-slate-700"></div>
                                </div>
                                <div class="grid grid-cols-3 gap-3">
                                    <div>
                                        <label class="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 block">Marca</label>
                                        <div class="relative">
                                            <input type="text" [(ngModel)]="form.marca" placeholder="Fabricante / Marca"
                                                   class="w-full h-9 text-sm font-bold border-2 border-gray-200 dark:border-slate-600 rounded-lg pl-3 pr-8 bg-gray-50 dark:bg-[#0F172AFF] text-gray-600 dark:text-gray-400 focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-300">
                                            <mat-icon class="absolute right-1.5 top-1.5 text-gray-200 !text-base pointer-events-none">branding_watermark</mat-icon>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Divider -->
                            <div class="border-t-2 border-dashed border-gray-100 dark:border-slate-700"></div>

                            <!-- ── Observación ── -->
                            <div class="flex-1 flex flex-col">
                                <label class="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1 block flex items-center gap-1.5">
                                    <mat-icon class="!text-xs text-gray-400">notes</mat-icon>
                                    Observaciones / Notas
                                </label>
                                <textarea [(ngModel)]="form.observacion" rows="3" placeholder="Condición del material, notas del ingreso, referencias adicionales..."
                                          class="flex-1 w-full min-h-[60px] text-sm font-bold border-2 border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-[#0F172AFF] text-gray-700 dark:text-gray-300 focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none resize-none placeholder:text-gray-300"></textarea>
                            </div>

                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
    `,
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 2px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
        }
        :host-context(.dark) { color-scheme: dark; }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 8px !important;
            background-color: white;
        }
        :host-context(.dark) .neo-card-base { background-color: #1e293b !important; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class EntradaMaterialComponent {
    public dialogRef = inject(MatDialogRef<EntradaMaterialComponent>, { optional: true });
    private router   = inject(Router);
    private snackBar = inject(MatSnackBar);

    form: Record<string, any> = {
        nroNota: '', recibidoPor: '', codigoNombre: '', producto: '',
        cantidad: '', unidad: '', pn: '', stock: '', marca: '',
        factura: '', fecha: new Date().toISOString().split('T')[0],
        hora: '08:00', observacion: ''
    };

    requiredFields = [
        { key: 'recibidoPor',  label: 'Recibido por' },
        { key: 'codigoNombre', label: 'Código o nombre' },
        { key: 'producto',     label: 'Producto' },
        { key: 'cantidad',     label: 'Cantidad' },
        { key: 'unidad',       label: 'Unidad' },
        { key: 'fecha',        label: 'Fecha ingreso' },
        { key: 'hora',         label: 'Hora' },
    ];

    isValid(): boolean {
        return this.requiredFields.every(f => !!this.form[f.key]);
    }

    getFilledCount(): number {
        return this.requiredFields.filter(f => !!this.form[f.key]).length;
    }

    onSubmit(): void {
        if (!this.isValid()) return;
        console.log('Entrada creada:', this.form);
        this.snackBar.open('Entrada registrada exitosamente', 'Cerrar', {
            duration: 3000, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: ['snackbar-success']
        });
        this.closeOrNavigate(this.form);
    }

    onCancel(): void { this.closeOrNavigate(); }

    private closeOrNavigate(result?: any): void {
        if (this.dialogRef) { this.dialogRef.close(result); }
        else { this.router.navigate(['/inventario']); }
    }
}
