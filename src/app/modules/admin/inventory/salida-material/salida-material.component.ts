import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
    selector: 'app-salida-material',
    standalone: true,
    imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatSnackBarModule],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] font-sans overflow-hidden relative">

        <!-- DECORATIVE -->
        <div class="fixed top-16 right-10 w-40 h-40 bg-orange-400 rounded-full border-4 border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-24 h-24 bg-yellow-300 rotate-12 border-4 border-black opacity-5 pointer-events-none"></div>

        <!-- MAIN -->
        <div class="flex-1 flex flex-col p-2 gap-2 overflow-hidden h-full relative z-10">

            <!-- HEADER -->
            <div class="flex items-center justify-between gap-2 shrink-0">
                <div class="flex items-center gap-2">
                    <mat-icon class="text-black dark:text-white !text-base">arrow_upward</mat-icon>
                    <h1 class="text-base font-black text-black dark:text-white uppercase tracking-tight leading-none">
                        Salida Misceláneos
                    </h1>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-sm border border-black bg-orange-500 text-white uppercase">
                        SALIDA MATERIAL
                    </span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button (click)="onSubmit()" [disabled]="!isValid()"
                            class="px-4 py-1.5 bg-yellow-400 text-black font-black text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed">
                        ACEPTAR
                    </button>
                    <button (click)="onCancel()"
                            class="px-4 py-1.5 bg-[#0F172AFF] text-white font-black text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase">
                        CANCELAR
                    </button>
                </div>
            </div>

            <!-- BODY: 2 COLUMNAS -->
            <div class="flex flex-row gap-2 flex-1 overflow-hidden min-h-0">

                <!-- PANEL IZQUIERDO: Identificación -->
                <div class="w-[220px] shrink-0 flex flex-col gap-2">
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="bg-[#0F172AFF] px-3 py-1.5 border-b-2 border-black">
                            <span class="font-black text-xs uppercase text-white">Identificación</span>
                        </div>
                        <div class="p-3 flex flex-col gap-3">
                            <div class="form-group">
                                <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Nro. Nota</label>
                                <input type="text" [(ngModel)]="form.nroNota" placeholder="000000"
                                       class="w-full h-9 text-sm font-black border-2 border-black dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white text-center focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-300">
                            </div>
                            <div class="form-group">
                                <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Fecha *</label>
                                <input type="date" [(ngModel)]="form.fecha"
                                       class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none">
                            </div>
                            <div class="form-group">
                                <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Hora *</label>
                                <input type="time" [(ngModel)]="form.hora"
                                       class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- PANEL DERECHO: 2 tarjetas en columnas -->
                <div class="flex-1 flex flex-row gap-2 overflow-hidden min-h-0">

                    <!-- Tarjeta Solicitante -->
                    <div class="flex-1 neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="bg-orange-500 px-3 py-1.5 border-b-2 border-black flex items-center gap-2">
                            <mat-icon class="text-white !text-base">person</mat-icon>
                            <span class="font-black text-xs uppercase text-white">Datos del Solicitante</span>
                        </div>
                        <div class="p-3 flex flex-col gap-3">

                            <!-- Fila 1: Nro. Licencia + Nro -->
                            <div class="grid grid-cols-2 gap-3">
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Nro. Licencia *</label>
                                    <div class="relative">
                                        <input type="text" [(ngModel)]="form.nroLicencia" placeholder="LIC-000"
                                               class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                        <mat-icon class="absolute right-2 top-1.5 text-gray-400 !text-base pointer-events-none">badge</mat-icon>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Nro *</label>
                                    <input type="text" [(ngModel)]="form.nro" placeholder="000"
                                           class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                </div>
                            </div>

                            <!-- Fila 2: Ap. Paterno + Ap. Materno -->
                            <div class="grid grid-cols-2 gap-3">
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Ap. Paterno *</label>
                                    <input type="text" [(ngModel)]="form.apellidoPaterno" placeholder="Apellido paterno"
                                           class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                </div>
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Ap. Materno *</label>
                                    <input type="text" [(ngModel)]="form.apellidoMaterno" placeholder="Apellido materno"
                                           class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                </div>
                            </div>

                            <!-- Fila 3: Nombre + Área -->
                            <div class="grid grid-cols-2 gap-3">
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Nombre *</label>
                                    <div class="relative">
                                        <input type="text" [(ngModel)]="form.nombre" placeholder="Nombre"
                                               class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                        <mat-icon class="absolute right-2 top-1.5 text-gray-400 !text-base pointer-events-none">person</mat-icon>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Área *</label>
                                    <div class="relative">
                                        <input type="text" [(ngModel)]="form.area" placeholder="Área / Dep."
                                               class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                        <mat-icon class="absolute right-2 top-1.5 text-gray-400 !text-base pointer-events-none">business</mat-icon>
                                    </div>
                                </div>
                            </div>

                            <!-- Fila 4: Despachado por -->
                            <div class="form-group">
                                <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Despachado por *</label>
                                <div class="relative">
                                    <input type="text" [(ngModel)]="form.despachadoPor" placeholder="Nombre del despachador"
                                           class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                    <mat-icon class="absolute right-2 top-1.5 text-gray-400 !text-base pointer-events-none">person_outline</mat-icon>
                                </div>
                            </div>

                        </div>
                    </div>

                    <!-- Tarjeta Material -->
                    <div class="flex-1 neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="bg-[#0F172AFF] px-3 py-1.5 border-b-2 border-black flex items-center gap-2">
                            <mat-icon class="text-white !text-base">inventory_2</mat-icon>
                            <span class="font-black text-xs uppercase text-white">Datos del Material</span>
                        </div>
                        <div class="p-3 flex flex-col gap-3">

                            <!-- Fila 1: Código/Nombre + Producto -->
                            <div class="grid grid-cols-2 gap-3">
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Código o Nombre *</label>
                                    <div class="relative">
                                        <input type="text" [(ngModel)]="form.codigoNombre" placeholder="BOA-H-XXXX"
                                               class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                        <mat-icon class="absolute right-2 top-1.5 text-gray-400 !text-base pointer-events-none">qr_code</mat-icon>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Producto *</label>
                                    <div class="relative">
                                        <input type="text" [(ngModel)]="form.producto" placeholder="Descripción"
                                               class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                        <mat-icon class="absolute right-2 top-1.5 text-gray-400 !text-base pointer-events-none">inventory_2</mat-icon>
                                    </div>
                                </div>
                            </div>

                            <!-- Fila 2: Unidad + Cantidad -->
                            <div class="grid grid-cols-2 gap-3">
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Unidad *</label>
                                    <div class="relative">
                                        <input type="text" [(ngModel)]="form.unidad" placeholder="PZA / KG / MT"
                                               class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                        <mat-icon class="absolute right-2 top-1.5 text-gray-400 !text-base pointer-events-none">straighten</mat-icon>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Cantidad *</label>
                                    <div class="relative">
                                        <input type="number" [(ngModel)]="form.cantidad" placeholder="0" min="1"
                                               class="w-full h-9 text-sm font-bold border-2 border-black dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none">
                                        <mat-icon class="absolute right-2 top-1.5 text-gray-400 !text-base pointer-events-none">numbers</mat-icon>
                                    </div>
                                </div>
                            </div>

                            <!-- Fila 3: Stock + Orden Trabajo -->
                            <div class="grid grid-cols-2 gap-3">
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Stock</label>
                                    <div class="relative">
                                        <input type="text" [(ngModel)]="form.stock" placeholder="Cantidad en almacén"
                                               class="w-full h-9 text-sm font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                        <mat-icon class="absolute right-2 top-1.5 text-gray-400 !text-base pointer-events-none">inventory</mat-icon>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Orden Trabajo</label>
                                    <div class="relative">
                                        <input type="text" [(ngModel)]="form.ordenTrabajo" placeholder="OT-000"
                                               class="w-full h-9 text-sm font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                        <mat-icon class="absolute right-2 top-1.5 text-gray-400 !text-base pointer-events-none">assignment</mat-icon>
                                    </div>
                                </div>
                            </div>

                            <!-- Fila 4: Aeronave + Autorizado -->
                            <div class="grid grid-cols-2 gap-3">
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Aeronave</label>
                                    <div class="relative">
                                        <input type="text" [(ngModel)]="form.buscadorAeronave" placeholder="Matrícula / Tipo"
                                               class="w-full h-9 text-sm font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                        <mat-icon class="absolute right-2 top-1.5 text-gray-400 !text-base pointer-events-none">flight</mat-icon>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Autorizado</label>
                                    <div class="relative">
                                        <input type="text" [(ngModel)]="form.buscadorAutorizado" placeholder="Nombre autorizado"
                                               class="w-full h-9 text-sm font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg pl-3 pr-8 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                        <mat-icon class="absolute right-2 top-1.5 text-gray-400 !text-base pointer-events-none">verified_user</mat-icon>
                                    </div>
                                </div>
                            </div>

                            <!-- Separador -->
                            <div class="border-t-2 border-dashed border-gray-200 dark:border-slate-600"></div>

                            <!-- Observaciones -->
                            <div class="form-group">
                                <label class="text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1 block">Observaciones</label>
                                <textarea [(ngModel)]="form.observaciones" rows="2" placeholder="Notas de la salida, condición, destino, etc."
                                          class="w-full text-sm font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none resize-none placeholder:text-gray-400"></textarea>
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
export class SalidaMaterialComponent {
    public dialogRef = inject(MatDialogRef<SalidaMaterialComponent>, { optional: true });
    private router   = inject(Router);
    private snackBar = inject(MatSnackBar);

    form: Record<string, any> = {
        nroNota: '', nroLicencia: '', nro: '',
        apellidoPaterno: '', apellidoMaterno: '', nombre: '',
        area: '', despachadoPor: '',
        codigoNombre: '', producto: '', unidad: '', cantidad: '',
        stock: '', ordenTrabajo: '', observaciones: '',
        buscadorAeronave: '', buscadorAutorizado: '',
        fecha: new Date().toISOString().split('T')[0],
        hora: '08:00'
    };

    requiredFields = [
        { key: 'nroLicencia',     label: 'Nro. Licencia' },
        { key: 'nro',             label: 'Nro' },
        { key: 'apellidoPaterno', label: 'Ap. Paterno' },
        { key: 'apellidoMaterno', label: 'Ap. Materno' },
        { key: 'nombre',          label: 'Nombre' },
        { key: 'area',            label: 'Área' },
        { key: 'despachadoPor',   label: 'Despachado por' },
        { key: 'codigoNombre',    label: 'Código o nombre' },
        { key: 'producto',        label: 'Producto' },
        { key: 'unidad',          label: 'Unidad' },
        { key: 'cantidad',        label: 'Cantidad' },
        { key: 'fecha',           label: 'Fecha' },
        { key: 'hora',            label: 'Hora' },
    ];

    isValid(): boolean {
        return this.requiredFields.every(f => !!this.form[f.key]);
    }

    onSubmit(): void {
        if (!this.isValid()) return;
        console.log('Salida registrada:', this.form);
        this.snackBar.open('Salida registrada exitosamente', 'Cerrar', {
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
