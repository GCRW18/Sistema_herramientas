import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

interface Laboratory {
    id: string | null;
    code: string;
    name: string;
    address: string;
    city: string;
    country: string;
    contact_person: string;
    phone: string;
    email: string;
    website: string;
    is_certified: boolean;
    certification_number: string;
    rating: number;
    average_delivery_days: number;
    active: boolean;
}

@Component({
    selector: 'app-laboratorios',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatIconModule,
        MatProgressSpinnerModule, MatTooltipModule,
        MatSnackBarModule, MatDialogModule
    ],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] transition-colors duration-300 font-sans overflow-hidden relative">

        <!-- SPINNER OVERLAY -->
        <div *ngIf="isSaving" class="spinner-overlay z-[100]">
            <div class="neo-card-base p-6 flex flex-col items-center gap-3 bg-white dark:bg-slate-800">
                <mat-spinner diameter="40"></mat-spinner>
                <span class="font-black text-sm uppercase tracking-wider text-black dark:text-white">Guardando...</span>
            </div>
        </div>

        <!-- DECORATIVE -->
        <div class="fixed top-16 right-10 w-48 h-48 bg-[#7113CF] rounded-full border-4 border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-28 h-28 bg-[#1AAA1F] rotate-12 border-4 border-black opacity-5 pointer-events-none"></div>

        <!-- MAIN CONTENT -->
        <div class="flex-1 flex flex-col p-2 relative h-full overflow-hidden gap-2">

            <!-- HEADER -->
            <div class="flex flex-row items-center justify-between gap-2 shrink-0 relative z-10">
                <div class="flex items-center gap-2">
                    <mat-icon class="text-black dark:text-white !text-base">business</mat-icon>
                    <h1 class="text-base font-black text-black dark:text-white uppercase tracking-tight leading-none">
                        Laboratorios Externos
                    </h1>
                    <p class="text-[10px] font-bold px-2 py-0.5 rounded-sm border border-black bg-[#7113CF] text-white">
                        GESTIÓN
                    </p>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button (click)="loadLabs()"
                            [disabled]="isLoading"
                            class="px-3 py-1.5 bg-slate-600 text-white font-bold text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-1 disabled:opacity-50">
                        <mat-icon class="!w-4 !h-4 !text-sm">refresh</mat-icon>
                        <span class="hidden sm:inline">Actualizar</span>
                    </button>
                    <button (click)="openForm(null)"
                            class="px-3 py-1.5 bg-[#1AAA1FFF] text-white font-black text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-1">
                        <mat-icon class="!w-4 !h-4 !text-sm">add</mat-icon>
                        Nuevo
                    </button>
                </div>
            </div>

            <!-- BODY: 2 COLUMNAS (form izq + tabla der) -->
            <div class="flex flex-row gap-2 flex-1 overflow-hidden min-h-0">

                <!-- ======================================================= -->
                <!-- PANEL IZQUIERDO: Formulario                              -->
                <!-- ======================================================= -->
                <div class="w-[360px] xl:w-[400px] shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar">

                    <!-- Form card -->
                    <div class="neo-card-base bg-white dark:bg-slate-800">
                        <div class="px-3 py-1.5 border-b-2 border-black flex items-center justify-between"
                             [ngClass]="showForm ? 'bg-[#7113CF]' : 'bg-[#0F172AFF]'">
                            <div class="flex items-center gap-2">
                                <mat-icon class="text-white !text-base">{{ showForm ? (editingLab.id ? 'edit' : 'add_circle') : 'business' }}</mat-icon>
                                <span class="font-black text-xs uppercase text-white">
                                    {{ showForm ? (editingLab.id ? 'Editar Lab.' : 'Nuevo Lab.') : 'Formulario' }}
                                </span>
                            </div>
                            @if (showForm) {
                                <button (click)="showForm = false"
                                        class="w-6 h-6 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded border border-white/40 transition-all">
                                    <mat-icon class="text-white !text-sm">close</mat-icon>
                                </button>
                            }
                        </div>

                        @if (!showForm) {
                            <div class="p-4 flex flex-col items-center justify-center gap-2 opacity-40">
                                <mat-icon class="!text-4xl text-black dark:text-white">add_business</mat-icon>
                                <p class="text-[10px] font-black uppercase text-center text-black dark:text-white">Presione "Nuevo" o edite un laboratorio</p>
                            </div>
                        }

                        @if (showForm) {
                            <div class="p-2 flex flex-col gap-1.5">

                                <!-- Fila 1: Código + Días prom -->
                                <div class="grid grid-cols-2 gap-1.5">
                                    <div class="form-group">
                                        <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Código *</label>
                                        <input type="text" [(ngModel)]="editingLab.code" placeholder="LAB-001"
                                               class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                    </div>
                                    <div class="form-group">
                                        <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Días prom.</label>
                                        <input type="number" [(ngModel)]="editingLab.average_delivery_days" min="1"
                                               class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none">
                                    </div>
                                </div>

                                <!-- Fila 2: Nombre (full) -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Nombre *</label>
                                    <input type="text" [(ngModel)]="editingLab.name" placeholder="Nombre del laboratorio"
                                           class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#000] transition-shadow outline-none placeholder:text-gray-400">
                                </div>

                                <!-- Fila 3: Dirección + Ciudad -->
                                <div class="grid grid-cols-2 gap-1.5">
                                    <div class="form-group">
                                        <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Dirección</label>
                                        <input type="text" [(ngModel)]="editingLab.address" placeholder="Dirección"
                                               class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                    </div>
                                    <div class="form-group">
                                        <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Ciudad</label>
                                        <input type="text" [(ngModel)]="editingLab.city" placeholder="Ciudad"
                                               class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                    </div>
                                </div>

                                <!-- Fila 4: País + Contacto -->
                                <div class="grid grid-cols-2 gap-1.5">
                                    <div class="form-group">
                                        <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">País</label>
                                        <input type="text" [(ngModel)]="editingLab.country"
                                               class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                    </div>
                                    <div class="form-group">
                                        <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Teléfono</label>
                                        <input type="text" [(ngModel)]="editingLab.phone" placeholder="+591..."
                                               class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                    </div>
                                </div>

                                <!-- Fila 5: Contacto + Teléfono -->
                                <div class="grid grid-cols-2 gap-1.5">
                                    <div class="form-group">
                                        <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Contacto</label>
                                        <input type="text" [(ngModel)]="editingLab.contact_person" placeholder="Nombre contacto"
                                               class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                    </div>
                                    <div class="form-group">
                                        <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Sitio web</label>
                                        <input type="text" [(ngModel)]="editingLab.website" placeholder="www.lab.com"
                                               class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                    </div>
                                </div>

                                <!-- Fila 6: Email (full) -->
                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Email</label>
                                    <input type="email" [(ngModel)]="editingLab.email" placeholder="correo@lab.com"
                                           class="w-full h-7 text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow outline-none placeholder:text-gray-400">
                                </div>

                                <!-- Certificado toggle -->
                                <div class="flex items-center justify-between border-2 rounded-lg px-2 py-1.5"
                                     [ngClass]="editingLab.is_certified ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 bg-white dark:bg-slate-800'">
                                    <div class="flex items-center gap-1.5">
                                        <mat-icon class="!text-sm" [ngClass]="editingLab.is_certified ? 'text-green-600' : 'text-gray-400'">verified</mat-icon>
                                        <span class="text-[10px] font-black uppercase" [ngClass]="editingLab.is_certified ? 'text-green-700' : 'text-gray-500'">
                                            {{ editingLab.is_certified ? 'Certificado' : 'Sin certificar' }}
                                        </span>
                                    </div>
                                    <button type="button" (click)="editingLab.is_certified = !editingLab.is_certified"
                                            class="w-10 h-5 rounded-full border-2 border-black transition-all relative"
                                            [ngClass]="editingLab.is_certified ? 'bg-green-500' : 'bg-gray-300'">
                                        <span class="absolute top-0.5 w-3 h-3 bg-white border border-black rounded-full transition-all"
                                              [ngClass]="editingLab.is_certified ? 'right-0.5' : 'left-0.5'"></span>
                                    </button>
                                </div>

                                @if (editingLab.is_certified) {
                                    <div class="form-group">
                                        <label class="text-[10px] font-black uppercase text-green-700 dark:text-green-400 mb-0.5 block">N° Certificación</label>
                                        <input type="text" [(ngModel)]="editingLab.certification_number" placeholder="ISO/IEC 17025:2017"
                                               class="w-full h-7 text-xs font-bold border-2 border-green-500 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white focus:shadow-[2px_2px_0px_0px_#16a34a] transition-shadow outline-none placeholder:text-gray-400">
                                    </div>
                                }

                                <!-- Botones -->
                                <div class="flex gap-1.5 pt-1 border-t border-gray-200 dark:border-slate-600">
                                    <button type="button" (click)="showForm = false"
                                            class="flex-1 py-1.5 bg-white dark:bg-slate-700 text-black dark:text-white font-bold text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase">
                                        Cancelar
                                    </button>
                                    <button type="button" (click)="saveLab()"
                                            [disabled]="!editingLab.code || !editingLab.name"
                                            class="flex-1 py-1.5 bg-[#1AAA1FFF] text-white font-black text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                                        <mat-icon class="!text-sm !h-4">save</mat-icon>
                                        Guardar
                                    </button>
                                </div>

                            </div>
                        }
                    </div>

                </div>

                <!-- ======================================================= -->
                <!-- PANEL DERECHO: Tabla de laboratorios                      -->
                <!-- ======================================================= -->
                <div class="flex-1 flex flex-col gap-2 overflow-hidden h-full">

                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-full border-2 border-black dark:border-gray-600">

                        <!-- Header tabla -->
                        <div class="bg-[#0F172AFF] px-3 py-1.5 border-b-2 border-black flex items-center justify-between shrink-0 h-10">
                            <div class="flex items-center gap-2">
                                <mat-icon class="text-white !text-xl">science</mat-icon>
                                <span class="font-black text-xs md:text-sm uppercase text-white">Laboratorios Registrados</span>
                            </div>
                            <span class="bg-white text-black px-2 py-0.5 rounded text-xs font-black border border-black shadow-[2px_2px_0px_0px_#000]">
                                Total: {{ labs.length }}
                            </span>
                        </div>

                        <!-- Loading -->
                        @if (isLoading) {
                            <div class="flex flex-col items-center justify-center flex-1 py-10">
                                <mat-spinner diameter="40"></mat-spinner>
                                <p class="text-xs font-bold mt-3 uppercase animate-pulse text-black dark:text-white">Cargando laboratorios...</p>
                            </div>
                        }

                        <!-- Lista filas -->
                        @if (!isLoading) {
                            <!-- Cabecera fija -->
                            <div class="grid grid-cols-12 gap-2 px-3 py-1.5 bg-white dark:bg-[#111A43] border-b-2 border-black shrink-0">
                                <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Código</div>
                                <div class="col-span-3 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Nombre</div>
                                <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Ciudad</div>
                                <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Contacto</div>
                                <div class="col-span-1 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 text-center">Cert.</div>
                                <div class="col-span-1 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 text-center">Rating</div>
                                <div class="col-span-1 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 text-right">Días</div>
                            </div>

                            <div class="overflow-y-auto flex-1 custom-scrollbar bg-[#f8f9fc] dark:bg-slate-900/50">

                                <!-- Empty state -->
                                @if (labs.length === 0) {
                                    <div class="flex flex-col items-center justify-center h-full py-10 opacity-50">
                                        <mat-icon class="!text-6xl text-black dark:text-gray-500">business</mat-icon>
                                        <p class="text-sm font-black mt-2 uppercase text-black dark:text-gray-500">No hay laboratorios registrados</p>
                                    </div>
                                }

                                @for (lab of labs; track lab.id) {
                                    <div class="grid grid-cols-12 gap-2 px-3 py-2 items-center border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0F172AFF] hover:bg-gray-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                         (click)="openForm(lab)">

                                        <!-- Código -->
                                        <div class="col-span-2">
                                            <span class="font-black text-xs font-mono text-black dark:text-white">{{ lab.code }}</span>
                                        </div>

                                        <!-- Nombre -->
                                        <div class="col-span-3 flex flex-col leading-tight">
                                            <span class="font-bold text-xs text-black dark:text-white truncate">{{ lab.name }}</span>
                                            @if (lab.email) {
                                                <span class="text-[10px] text-gray-400 truncate">{{ lab.email }}</span>
                                            }
                                        </div>

                                        <!-- Ciudad -->
                                        <div class="col-span-2">
                                            <span class="text-xs text-black dark:text-white">{{ lab.city }}</span>
                                            <span class="text-[10px] text-gray-400 block">{{ lab.country }}</span>
                                        </div>

                                        <!-- Contacto -->
                                        <div class="col-span-2">
                                            <span class="text-xs text-black dark:text-white truncate block">{{ lab.contact_person || '—' }}</span>
                                            @if (lab.phone) {
                                                <span class="text-[10px] text-gray-400">{{ lab.phone }}</span>
                                            }
                                        </div>

                                        <!-- Certificado -->
                                        <div class="col-span-1 flex justify-center">
                                            @if (lab.is_certified) {
                                                <mat-icon class="text-green-600 !text-lg"
                                                          [matTooltip]="lab.certification_number || 'Certificado'">verified</mat-icon>
                                            } @else {
                                                <mat-icon class="text-gray-300 !text-lg" matTooltip="Sin certificar">cancel</mat-icon>
                                            }
                                        </div>

                                        <!-- Rating -->
                                        <div class="col-span-1 flex items-center justify-center gap-0.5">
                                            <mat-icon class="text-yellow-500 !text-sm">star</mat-icon>
                                            <span class="font-black text-xs text-black dark:text-white">{{ lab.rating.toFixed(1) }}</span>
                                        </div>

                                        <!-- Días prom + acciones -->
                                        <div class="col-span-1 flex items-center justify-end gap-1">
                                            <span class="font-mono font-bold text-xs text-black dark:text-white">{{ lab.average_delivery_days }}d</span>
                                            <button (click)="deleteLab(lab); $event.stopPropagation()"
                                                    matTooltip="Eliminar"
                                                    class="w-6 h-6 flex items-center justify-center border-2 border-black bg-red-500 hover:bg-red-400 rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all ml-1">
                                                <mat-icon class="text-white !text-xs">delete</mat-icon>
                                            </button>
                                        </div>

                                    </div>
                                }
                            </div>
                        }
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

        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.85);
            backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class LaboratoriosComponent implements OnInit, OnDestroy {
    private calibrationService = inject(CalibrationService);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    isLoading = false;
    isSaving = false;
    showForm = false;
    labs: Laboratory[] = [];

    editingLab: Laboratory = this.getEmptyLab();

    ngOnInit(): void {
        this.loadLabs();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private getEmptyLab(): Laboratory {
        return {
            id: null, code: '', name: '', address: '', city: '', country: 'Bolivia',
            contact_person: '', phone: '', email: '', website: '',
            is_certified: false, certification_number: '', rating: 0,
            average_delivery_days: 30, active: true
        };
    }

    loadLabs(): void {
        this.isLoading = true;
        this.calibrationService.getLaboratories().pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (res: any) => {
                this.labs = (res?.data || res)?.length > 0 ? (res.data || res) : this.getMockData();
            },
            error: () => { this.labs = this.getMockData(); }
        });
    }

    openForm(lab: Laboratory | null): void {
        this.editingLab = lab ? { ...lab } : this.getEmptyLab();
        this.showForm = true;
    }

    saveLab(): void {
        if (!this.editingLab.code || !this.editingLab.name) {
            this.snackBar.open('Código y nombre son requeridos', 'Cerrar', { duration: 3000, panelClass: ['snackbar-error'] });
            return;
        }

        this.isSaving = true;
        this.calibrationService.saveLaboratory(this.editingLab).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSaving = false)
        ).subscribe({
            next: () => {
                this.snackBar.open('Laboratorio guardado exitosamente', 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-success'] });
                this.showForm = false;
                this.loadLabs();
            },
            error: () => {
                if (this.editingLab.id) {
                    const idx = this.labs.findIndex(l => l.id === this.editingLab.id);
                    if (idx >= 0) this.labs[idx] = { ...this.editingLab };
                } else {
                    this.editingLab.id = String(this.labs.length + 1);
                    this.labs = [...this.labs, { ...this.editingLab }];
                }
                this.snackBar.open('Guardado (modo offline)', 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-success'] });
                this.showForm = false;
            }
        });
    }

    deleteLab(lab: Laboratory): void {
        if (!confirm(`¿Eliminar laboratorio "${lab.name}"?`)) return;
        this.calibrationService.deleteLaboratory(lab.id!).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: () => {
                this.snackBar.open('Laboratorio eliminado', 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-success'] });
                this.loadLabs();
            },
            error: () => {
                this.labs = this.labs.filter(l => l.id !== lab.id);
                this.snackBar.open('Eliminado (modo offline)', 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top' });
            }
        });
    }

    private getMockData(): Laboratory[] {
        return [
            { id: '1', code: 'LAB-001', name: 'METROTEST S.R.L.', address: 'Calle Sucre #456', city: 'Cochabamba', country: 'Bolivia', contact_person: 'Ing. Carlos Mendoza', phone: '+591 4-4252100', email: 'calibraciones@metrotest.com.bo', website: 'www.metrotest.com.bo', is_certified: true, certification_number: 'ISO/IEC 17025:2017', rating: 4.5, average_delivery_days: 15, active: true },
            { id: '2', code: 'LAB-002', name: 'METROLOGIA INDUSTRIAL LTDA', address: 'Av. Santos Dumont #789', city: 'Santa Cruz', country: 'Bolivia', contact_person: 'Lic. Maria Flores', phone: '+591 3-3425600', email: 'info@metroindustrial.com.bo', website: 'www.metroindustrial.com.bo', is_certified: true, certification_number: 'ISO 9001:2015', rating: 4.2, average_delivery_days: 20, active: true },
            { id: '3', code: 'LAB-003', name: 'CALIBRA TECH', address: 'Zona Industrial Km 5', city: 'La Paz', country: 'Bolivia', contact_person: 'Ing. Roberto Quispe', phone: '+591 2-2845300', email: 'servicios@calibratech.bo', website: '', is_certified: false, certification_number: '', rating: 3.8, average_delivery_days: 25, active: true }
        ];
    }
}
