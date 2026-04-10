import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

interface JackItem {
    tool_id: number;
    tool_code: string;
    tool_name: string;
    serial_number: string;
    warehouse: string;
    calibration_status: string;
    calibration_expiry: string;
    last_semiannual: string;
    next_semiannual: string;
    semi_status: string;
    last_annual: string;
    next_annual: string;
    annual_status: string;
}

@Component({
    selector: 'app-servicios-gatas',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatIconModule,
        MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule
    ],
    template: `
    <div class="flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0F172AFF] font-sans overflow-hidden relative">

        <!-- SPINNER OVERLAY -->
        @if (isSaving) {
            <div class="spinner-overlay z-[100]">
                <div class="neo-card-base p-6 flex flex-col items-center gap-3 bg-white dark:bg-slate-800">
                    <mat-spinner diameter="40"></mat-spinner>
                    <span class="font-black text-sm uppercase tracking-wider text-black dark:text-white">Registrando servicio...</span>
                </div>
            </div>
        }

        <!-- DECORATIVE -->
        <div class="fixed top-16 right-10 w-48 h-48 bg-[#FF6A00] rounded-full border-4 border-black opacity-5 pointer-events-none"></div>
        <div class="fixed bottom-10 left-10 w-28 h-28 bg-[#FF6A00] rotate-12 border-4 border-black opacity-5 pointer-events-none"></div>

        <!-- MAIN -->
        <div class="flex-1 flex flex-col p-2 gap-2 overflow-hidden h-full relative z-10">

            <!-- HEADER -->
            <div class="flex items-center justify-between gap-2 shrink-0">
                <div class="flex items-center gap-2">
                    <mat-icon class="text-black dark:text-white !text-base">build</mat-icon>
                    <h1 class="text-base font-black text-black dark:text-white uppercase tracking-tight leading-none">
                        Servicios de Gatas
                    </h1>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-sm border border-black bg-[#FF6A00] text-white uppercase">
                        JACKS
                    </span>
                </div>
                <button (click)="loadJacks()" [disabled]="isLoading"
                        class="px-3 py-1.5 bg-slate-600 text-white font-bold text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-1 disabled:opacity-50">
                    <mat-icon class="!w-4 !h-4 !text-sm">refresh</mat-icon>
                    <span class="hidden sm:inline">Actualizar</span>
                </button>
            </div>

            <!-- BODY: 2 COLUMNAS -->
            <div class="flex flex-row gap-2 flex-1 overflow-hidden min-h-0">

                <!-- ============================================================ -->
                <!-- PANEL IZQUIERDO                                               -->
                <!-- ============================================================ -->
                <div class="w-[260px] shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar">

                    <!-- Resumen 2x2 -->
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="bg-[#FF6A00] px-3 py-1.5 border-b-2 border-black">
                            <span class="font-black text-xs uppercase text-white">Resumen de Estado</span>
                        </div>
                        <div class="p-1.5 grid grid-cols-2 gap-1.5">
                            <div class="rounded-lg border-2 border-black p-1.5 bg-red-100 shadow-[2px_2px_0px_0px_#000]">
                                <p class="text-xl font-black text-red-800 leading-none">{{ countSemiExpired() }}</p>
                                <p class="text-[9px] font-black uppercase text-red-600 leading-tight mt-0.5">Semi. Vencidos</p>
                            </div>
                            <div class="rounded-lg border-2 border-black p-1.5 bg-orange-100 shadow-[2px_2px_0px_0px_#000]">
                                <p class="text-xl font-black text-orange-800 leading-none">{{ countSemiExpiring() }}</p>
                                <p class="text-[9px] font-black uppercase text-orange-600 leading-tight mt-0.5">Semi. Próx. 30d</p>
                            </div>
                            <div class="rounded-lg border-2 border-black p-1.5 bg-red-100 shadow-[2px_2px_0px_0px_#000]">
                                <p class="text-xl font-black text-red-800 leading-none">{{ countAnnualExpired() }}</p>
                                <p class="text-[9px] font-black uppercase text-red-600 leading-tight mt-0.5">Anual Vencidos</p>
                            </div>
                            <div class="rounded-lg border-2 border-black p-1.5 bg-yellow-100 shadow-[2px_2px_0px_0px_#000]">
                                <p class="text-xl font-black text-yellow-800 leading-none">{{ countAnnualExpiring() }}</p>
                                <p class="text-[9px] font-black uppercase text-yellow-600 leading-tight mt-0.5">Anual Próx. 30d</p>
                            </div>
                        </div>
                    </div>

                    <!-- Formulario de servicio -->
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden">
                        <div class="px-3 py-1.5 border-b-2 border-black flex items-center justify-between"
                             [ngClass]="showServiceForm ? 'bg-[#FF6A00]' : 'bg-[#0F172AFF]'">
                            <div class="flex items-center gap-2">
                                <mat-icon class="text-white !text-base">{{ showServiceForm ? 'build_circle' : 'build' }}</mat-icon>
                                <span class="font-black text-xs uppercase text-white">
                                    {{ showServiceForm ? 'Registrar Servicio' : 'Formulario' }}
                                </span>
                            </div>
                            @if (showServiceForm) {
                                <button (click)="showServiceForm = false; selectedJack = null"
                                        class="w-5 h-5 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded border border-white/30 transition-all">
                                    <mat-icon class="text-white !text-xs">close</mat-icon>
                                </button>
                            }
                        </div>

                        @if (!showServiceForm) {
                            <div class="p-4 flex flex-col items-center justify-center gap-2 opacity-40">
                                <mat-icon class="!text-4xl text-black dark:text-white">build</mat-icon>
                                <p class="text-[10px] font-black uppercase text-center text-black dark:text-white">
                                    Presione "SERVICIO" en una gata para registrar
                                </p>
                            </div>
                        }

                        @if (showServiceForm && selectedJack) {
                            <div class="p-2 flex flex-col gap-1.5">

                                <!-- Info de la gata seleccionada -->
                                <div class="rounded-lg border-2 border-[#FF6A00] bg-orange-50 dark:bg-orange-900/20 px-2 py-1.5">
                                    <p class="font-black text-xs text-black dark:text-white truncate">{{ selectedJack.tool_name }}</p>
                                    <p class="text-[10px] font-bold text-orange-700 dark:text-orange-400">
                                        {{ selectedJack.tool_code }} · S/N: {{ selectedJack.serial_number || '—' }}
                                    </p>
                                </div>

                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Tipo de Servicio</label>
                                    <select [(ngModel)]="serviceType"
                                            class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                        <option value="semiannual">Semestral (180 días)</option>
                                        <option value="annual">Anual (365 días)</option>
                                        <option value="both">Ambos</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Fecha de Servicio</label>
                                    <input type="date" [(ngModel)]="serviceDateStr"
                                           class="w-full h-7 text-xs font-bold border-2 border-black dark:border-slate-600 rounded-lg px-2 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none">
                                </div>

                                <div class="form-group">
                                    <label class="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 mb-0.5 block">Observaciones</label>
                                    <textarea [(ngModel)]="serviceNotes" rows="2" placeholder="Notas del servicio..."
                                              class="w-full text-xs font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-[#0F172AFF] text-black dark:text-white outline-none resize-none placeholder:text-gray-400 focus:shadow-[2px_2px_0px_0px_#ccc] transition-shadow"></textarea>
                                </div>

                                <div class="flex gap-1 pt-1 border-t border-gray-200 dark:border-slate-600">
                                    <button type="button" (click)="showServiceForm = false; selectedJack = null"
                                            class="flex-1 py-1.5 bg-white dark:bg-slate-700 text-black dark:text-white font-bold text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase">
                                        Cancelar
                                    </button>
                                    <button type="button" (click)="registerService()"
                                            class="flex-1 py-1.5 bg-[#FF6A00] text-white font-black text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center justify-center gap-1">
                                        <mat-icon class="!text-sm !h-4">save</mat-icon>
                                        Registrar
                                    </button>
                                </div>
                            </div>
                        }
                    </div>

                </div>

                <!-- ============================================================ -->
                <!-- PANEL DERECHO: Tabla de gatas                                 -->
                <!-- ============================================================ -->
                <div class="flex-1 flex flex-col overflow-hidden h-full">
                    <div class="neo-card-base bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-full">

                        <!-- Header tabla -->
                        <div class="bg-[#0F172AFF] px-3 py-1.5 border-b-2 border-black flex items-center justify-between shrink-0 h-10">
                            <div class="flex items-center gap-2">
                                <mat-icon class="text-white !text-xl">build</mat-icon>
                                <span class="font-black text-xs md:text-sm uppercase text-white">Registro de Gatas (Jacks)</span>
                            </div>
                            <span class="bg-white text-black px-2 py-0.5 rounded text-xs font-black border border-black shadow-[2px_2px_0px_0px_#000]">
                                Total: {{ jacks.length }}
                            </span>
                        </div>

                        @if (isLoading) {
                            <div class="flex flex-col items-center justify-center flex-1">
                                <mat-spinner diameter="40"></mat-spinner>
                                <p class="text-xs font-bold mt-3 uppercase animate-pulse text-black dark:text-white">Cargando gatas...</p>
                            </div>
                        }

                        @if (!isLoading) {
                            <!-- Cabecera fija -->
                            <div class="grid grid-cols-12 gap-1 px-3 py-1.5 bg-white dark:bg-[#111A43] border-b-2 border-black shrink-0">
                                <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Código</div>
                                <div class="col-span-3 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Nombre</div>
                                <div class="col-span-1 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">S/N</div>
                                <div class="col-span-1 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 text-center">Cal.</div>
                                <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Semestral</div>
                                <div class="col-span-2 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">Anual</div>
                                <div class="col-span-1 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 text-right">Acción</div>
                            </div>

                            <div class="overflow-y-auto flex-1 custom-scrollbar bg-[#f8f9fc] dark:bg-slate-900/50">

                                @if (jacks.length === 0) {
                                    <div class="flex flex-col items-center justify-center h-full opacity-50">
                                        <mat-icon class="!text-6xl text-black dark:text-gray-500">build</mat-icon>
                                        <p class="text-sm font-black mt-2 uppercase text-black dark:text-gray-500">No hay gatas registradas</p>
                                    </div>
                                }

                                @for (jack of jacks; track jack.tool_id) {
                                    <div class="grid grid-cols-12 gap-1 px-3 py-2 items-center border-b border-gray-200 dark:border-slate-700 transition-all cursor-pointer"
                                         [ngClass]="selectedJack?.tool_id === jack.tool_id
                                             ? 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-l-[#FF6A00]'
                                             : 'bg-white dark:bg-[#0F172AFF] hover:bg-gray-50 dark:hover:bg-slate-800'"
                                         (click)="openServiceForm(jack)">

                                        <!-- Código -->
                                        <div class="col-span-2">
                                            <span class="font-mono font-black text-xs text-black dark:text-white">{{ jack.tool_code }}</span>
                                        </div>

                                        <!-- Nombre -->
                                        <div class="col-span-3 leading-tight">
                                            <span class="font-bold text-xs text-black dark:text-white truncate block">{{ jack.tool_name }}</span>
                                            <span class="text-[9px] text-gray-400">{{ jack.warehouse }}</span>
                                        </div>

                                        <!-- S/N -->
                                        <div class="col-span-1">
                                            <span class="font-mono text-[10px] text-gray-500 dark:text-gray-400 truncate block">{{ jack.serial_number || '—' }}</span>
                                        </div>

                                        <!-- Calibración -->
                                        <div class="col-span-1 flex justify-center">
                                            <span class="inline-block px-1 py-0.5 rounded text-[9px] font-black border border-black uppercase"
                                                  [ngClass]="getStatusBadgeClass(jack.calibration_status)">
                                                {{ getStatusShort(jack.calibration_status) }}
                                            </span>
                                        </div>

                                        <!-- Semestral -->
                                        <div class="col-span-2 leading-tight">
                                            <span class="inline-block px-1 py-0.5 rounded text-[9px] font-black border border-black uppercase"
                                                  [ngClass]="getStatusBadgeClass(jack.semi_status)">
                                                {{ getStatusShort(jack.semi_status) }}
                                            </span>
                                            <span class="text-[9px] text-gray-400 block mt-0.5">{{ jack.next_semiannual }}</span>
                                        </div>

                                        <!-- Anual -->
                                        <div class="col-span-2 leading-tight">
                                            <span class="inline-block px-1 py-0.5 rounded text-[9px] font-black border border-black uppercase"
                                                  [ngClass]="getStatusBadgeClass(jack.annual_status)">
                                                {{ getStatusShort(jack.annual_status) }}
                                            </span>
                                            <span class="text-[9px] text-gray-400 block mt-0.5">{{ jack.next_annual }}</span>
                                        </div>

                                        <!-- Acción -->
                                        <div class="col-span-1 flex justify-end">
                                            <button (click)="openServiceForm(jack); $event.stopPropagation()"
                                                    matTooltip="Registrar Servicio"
                                                    class="px-2 py-1 bg-[#FF6A00] text-white font-black text-[9px] border-2 border-black rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none transition-all uppercase">
                                                SVC
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
export class ServiciosGatasComponent implements OnInit, OnDestroy {
    private calibrationService = inject(CalibrationService);
    private snackBar           = inject(MatSnackBar);
    private _unsubscribeAll    = new Subject<void>();

    isLoading       = false;
    isSaving        = false;
    showServiceForm = false;
    jacks: JackItem[] = [];

    selectedJack:   JackItem | null = null;
    serviceType     = 'semiannual';
    serviceDateStr  = new Date().toISOString().split('T')[0];
    serviceNotes    = '';

    ngOnInit(): void { this.loadJacks(); }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadJacks(): void {
        this.isLoading = true;
        this.calibrationService.getJackServiceStatus({ start: 0, limit: 100 }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (res: any) => {
                this.jacks = Array.isArray(res) ? res : (res?.datos || []);
            },
            error: () => {
                this.jacks = [];
                this.snackBar.open('Error al cargar gatas', 'Cerrar', { duration: 3000, panelClass: ['snackbar-error'] });
            }
        });
    }

    countSemiExpired():  number { return this.jacks.filter(j => j.semi_status === 'VENCIDO').length; }
    countSemiExpiring(): number { return this.jacks.filter(j => j.semi_status === 'CRITICO' || j.semi_status === 'PROXIMO').length; }
    countAnnualExpired():  number { return this.jacks.filter(j => j.annual_status === 'VENCIDO').length; }
    countAnnualExpiring(): number { return this.jacks.filter(j => j.annual_status === 'CRITICO' || j.annual_status === 'PROXIMO').length; }

    getStatusBadgeClass(status: string): string {
        switch (status?.toUpperCase()) {
            case 'VIGENTE': case 'VALID':   return 'bg-green-500 text-white';
            case 'POR VENCER': case 'PROXIMO': return 'bg-yellow-400 text-black';
            case 'CRITICO': case 'CRITICAL':   return 'bg-orange-500 text-white';
            case 'VENCIDO': case 'VENCIDA': case 'EXPIRED': return 'bg-red-500 text-white';
            case 'EN LAB': case 'IN_LAB':   return 'bg-purple-500 text-white';
            default: return 'bg-gray-200 text-black';
        }
    }

    getStatusShort(status: string): string {
        switch (status?.toUpperCase()) {
            case 'VIGENTE': case 'VALID':   return 'OK';
            case 'POR VENCER': case 'PROXIMO': return 'PRÓX.';
            case 'CRITICO': case 'CRITICAL':   return 'CRIT.';
            case 'VENCIDO': case 'VENCIDA': case 'EXPIRED': return 'VENC.';
            case 'EN LAB': case 'IN_LAB':   return 'LAB';
            default: return status || '—';
        }
    }

    openServiceForm(jack: JackItem): void {
        this.selectedJack  = jack;
        this.serviceType   = 'semiannual';
        this.serviceDateStr = new Date().toISOString().split('T')[0];
        this.serviceNotes  = '';
        this.showServiceForm = true;
    }

    registerService(): void {
        if (!this.selectedJack) return;
        this.isSaving = true;
        this.calibrationService.registerJackService({
            tool_id:      this.selectedJack.tool_id,
            service_type: this.serviceType as any,
            service_date: this.serviceDateStr,
            notes:        this.serviceNotes
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSaving = false)
        ).subscribe({
            next: () => {
                this.snackBar.open('Servicio registrado exitosamente', 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-success'] });
                this.showServiceForm = false;
                this.selectedJack   = null;
                this.loadJacks();
            },
            error: () => {
                this.snackBar.open('Error al registrar servicio', 'Cerrar', { duration: 3000, panelClass: ['snackbar-error'] });
            }
        });
    }
}
