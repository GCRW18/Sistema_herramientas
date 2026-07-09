import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

/**
 * Miniventana del "Lote a Enviar" del form de envío a calibración.
 * Recibe el componente padre (FormEnvioComponent) por referencia: como toolList
 * se muta in-place (push/splice), lo que se agrega desde el buscador del form
 * aparece aquí en vivo, y lo que se configura aquí (lab, trabajo, fechas, notas)
 * queda directamente en los items que enviará submitAll() del form.
 * Se abre sin backdrop y es arrastrable para trabajar con el form a la vez.
 * Tipado estructural del host para evitar import circular con FormEnvioComponent.
 */
interface FormEnvioHost {
    toolList: any[];
    laboratories: any[];
    workTypeOptions: { value: string; label: string }[];
    isProcessing: () => boolean;
    getPendingWithoutLab: () => number;
    onItemLabChange: (item: any, labId: number) => void;
    viewToolPhoto: (item: any, index: number) => void;
    removeTool: (index: number) => void;
}

@Component({
    selector: 'app-lote-envio-dialog',
    standalone: true,
    imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule, DragDropModule],
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `],
    template: `
<div class="bg-white dark:bg-slate-800 border-2 border-black rounded-2xl overflow-hidden flex flex-col"
     style="width:100%; max-height:82vh; box-shadow:6px 6px 0 #000">

    <!-- Header (arrastrable) -->
    <div class="flex items-center justify-between px-4 py-3 shrink-0 border-b-2 border-black bg-[#0F172A] select-none"
         cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragHandle style="cursor:grab">
        <h3 class="text-[11px] font-black uppercase text-white flex items-center gap-2 tracking-widest">
            <mat-icon class="!text-sm text-amber-400">list</mat-icon>
            Lote a Enviar
            <span class="px-2 py-0.5 bg-amber-400 text-black border-2 border-black rounded font-mono text-[10px] shadow-[1px_1px_0_#000]">{{ host.toolList.length }}</span>
        </h3>
        <div class="flex items-center gap-2">
            <span *ngIf="host.getPendingWithoutLab() > 0"
                  class="text-[9px] font-black text-amber-400 flex items-center gap-1">
                <mat-icon class="!text-sm">warning</mat-icon>
                {{ host.getPendingWithoutLab() }} sin lab
            </span>
            <button type="button" (click)="cerrar()" (mousedown)="$event.stopPropagation()"
                    class="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/10 shrink-0">
                <mat-icon class="text-white !text-sm">close</mat-icon>
            </button>
        </div>
    </div>

    <!-- Listado Items -->
    <div *ngIf="host.toolList.length > 0" class="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-3 min-h-0">

        <div *ngFor="let item of host.toolList; let i = index"
             class="border-2 transition-all duration-150 rounded-lg"
             [ngClass]="{
                 'border-stone-300 bg-stone-50 dark:bg-slate-800': item.status === 'pending',
                 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 animate-pulse': item.status === 'sending',
                 'border-green-500 bg-green-50 dark:bg-green-900/20': item.status === 'done',
                 'border-red-400 bg-red-50 dark:bg-red-900/20': item.status === 'error'
             }">

            <!-- Cabecera del item -->
            <div class="flex items-start gap-2 p-2.5">
                <div class="shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2 border-stone-300 dark:border-slate-500 bg-stone-100 dark:bg-slate-700 text-[10px] font-black text-stone-500 dark:text-slate-300 mt-0.5">
                    {{ i + 1 }}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span class="font-black text-xs text-black dark:text-white font-mono">{{ item.tool.code ?? item.tool.tool_code }}</span>
                        <span *ngIf="item.status === 'done'" class="text-[8px] font-black px-1.5 py-0.5 bg-green-500 text-white rounded uppercase">✓ REGISTRADO</span>
                        <span *ngIf="item.status === 'error'" class="text-[8px] font-black px-1.5 py-0.5 bg-red-500 text-white rounded uppercase">✗ ERROR</span>
                        <span *ngIf="item.status === 'sending'" class="text-[8px] font-black px-1.5 py-0.5 bg-amber-400 text-black border border-black rounded uppercase">ENVIANDO…</span>
                    </div>
                    <div class="text-[10px] font-bold text-stone-400 dark:text-slate-300 leading-tight truncate uppercase">{{ item.tool.name ?? item.tool.tool_name }}</div>
                    <div class="flex items-center flex-wrap gap-1 mt-1">
                        <span *ngIf="item.tool.location"
                              class="flex items-center gap-0.5 px-1.5 py-0.5 border border-stone-200 dark:border-slate-600 rounded text-[8px] font-black text-stone-400 dark:text-slate-400 uppercase">
                            <mat-icon class="!text-[10px] w-3 h-3 leading-none">place</mat-icon> {{ item.tool.location }}
                        </span>
                        <span *ngIf="item.tool.shelf"
                              class="flex items-center gap-0.5 px-1.5 py-0.5 border border-stone-200 dark:border-slate-600 rounded text-[8px] font-black text-stone-400 dark:text-slate-400 uppercase">
                            <mat-icon class="!text-[10px] w-3 h-3 leading-none">shelves</mat-icon> {{ item.tool.shelf }}
                        </span>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button (click)="host.viewToolPhoto(item, i)"
                            class="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 border-2 border-stone-300 dark:border-slate-500 rounded shadow-[1px_1px_0_#000] hover:border-black dark:hover:border-slate-300 hover:shadow-[2px_2px_0_#000] hover:-translate-y-px transition-all">
                        <mat-icon class="!text-xs text-stone-500 dark:text-slate-300">photo_camera</mat-icon>
                    </button>
                    <button (click)="host.removeTool(i)" [disabled]="host.isProcessing()"
                            class="w-7 h-7 flex items-center justify-center bg-[#FF1414] text-white border-2 border-black rounded shadow-[2px_2px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-40">
                        <mat-icon class="!text-xs">close</mat-icon>
                    </button>
                </div>
            </div>

            <!-- Config por herramienta (solo editable cuando pending/error) -->
            <div *ngIf="item.status === 'pending' || item.status === 'error'"
                 class="border-t-2 border-dashed border-stone-200 dark:border-slate-600 mx-2.5 pt-2.5 pb-2.5 flex flex-col gap-2">

                <!-- Laboratorio -->
                <div class="flex items-center gap-2">
                    <label class="text-[8px] font-black uppercase tracking-wider text-stone-400 w-16 shrink-0">Lab *</label>
                    <select [(ngModel)]="item.supplierId" [ngModelOptions]="{standalone:true}"
                            (ngModelChange)="host.onItemLabChange(item, $event)"
                            class="flex-1 h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 rounded-lg px-2 outline-none transition-all duration-150"
                            [ngClass]="item.supplierId ? 'border-stone-300 dark:border-slate-500 focus:border-black dark:focus:border-white' : 'border-amber-400 focus:border-amber-500'">
                        <option [ngValue]="null">-- Seleccionar laboratorio --</option>
                        <option *ngFor="let lab of host.laboratories" [ngValue]="lab.id_laboratory">{{ lab.name }}</option>
                    </select>
                </div>

                <!-- Tipo de trabajo -->
                <div class="flex items-center gap-2">
                    <label class="text-[8px] font-black uppercase tracking-wider text-stone-400 w-16 shrink-0">Trabajo</label>
                    <div class="flex gap-1 flex-1">
                        <button *ngFor="let opt of host.workTypeOptions" type="button"
                                (click)="item.workType = opt.value"
                                class="flex-1 h-7 text-[8px] font-black border-2 rounded-lg transition-all duration-150"
                                [ngClass]="item.workType === opt.value
                                    ? (opt.value === 'calibration_repair' ? 'bg-[#FF1414] text-white border-black shadow-[1px_1px_0_#000]' : 'bg-amber-400 text-black border-black shadow-[1px_1px_0_#000]')
                                    : 'bg-white dark:bg-slate-700 border-stone-300 dark:border-slate-500 text-stone-400 dark:text-slate-300 hover:border-stone-400 dark:hover:border-slate-400'">
                            {{ opt.label }}
                        </button>
                    </div>
                </div>

                <!-- Retorno + Notas -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div class="flex flex-col gap-1">
                        <label class="text-[8px] font-black uppercase tracking-wider text-stone-400">Retorno Est.</label>
                        <input type="date" [(ngModel)]="item.expectedReturnDate" [ngModelOptions]="{standalone:true}"
                               class="h-8 text-xs font-black bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-500 rounded-lg px-2 outline-none focus:border-black dark:focus:border-white cursor-pointer">
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[8px] font-black uppercase tracking-wider text-stone-400">Notas</label>
                        <input type="text" [(ngModel)]="item.notes" [ngModelOptions]="{standalone:true}"
                               placeholder="Notas opcionales..."
                               class="h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-500 rounded-lg px-2 outline-none focus:border-black dark:focus:border-white placeholder:text-stone-300 dark:placeholder:text-slate-500">
                    </div>
                </div>

                <!-- Campos adicionales para CAL/REP -->
                <ng-container *ngIf="item.workType === 'calibration_repair'">
                    <div class="flex flex-col gap-1">
                        <label class="text-[8px] font-black uppercase tracking-wider text-red-500">Descripción de Reparación *</label>
                        <textarea [(ngModel)]="item.repairDescription" [ngModelOptions]="{standalone:true}" rows="2"
                                  placeholder="Describa el problema de esta herramienta..."
                                  class="text-xs font-normal bg-white dark:bg-slate-800 dark:text-white border-2 border-red-400 rounded-lg px-2 py-1.5 outline-none resize-none focus:border-red-500 focus:shadow-[2px_2px_0_#f87171] placeholder:text-red-300 dark:placeholder:text-slate-600 custom-scrollbar"></textarea>
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[8px] font-black uppercase tracking-wider text-red-500 flex items-center gap-1">
                            <mat-icon class="!text-[10px]">report_problem</mat-icon> Rep. Discrepancia
                        </label>
                        <textarea [(ngModel)]="item.discrepancyReport" [ngModelOptions]="{standalone:true}" rows="2"
                                  placeholder="Descripción de discrepancia..."
                                  class="text-xs font-normal bg-red-50 dark:bg-slate-800 dark:text-white border-2 border-red-400 rounded-lg px-2 py-1.5 outline-none resize-none focus:border-red-500 focus:shadow-[2px_2px_0_#f87171] placeholder:text-red-300 dark:placeholder:text-slate-600 custom-scrollbar"></textarea>
                    </div>
                </ng-container>
            </div>

            <!-- Resumen cuando está registrado -->
            <div *ngIf="item.status === 'done'"
                 class="border-t border-green-200 dark:border-green-800 mx-2.5 py-2 flex items-center gap-2 flex-wrap">
                <span class="text-[9px] font-black text-green-700 dark:text-green-400">{{ item.nota }}</span>
                <span class="text-[8px] font-bold text-stone-400">·</span>
                <span class="text-[9px] font-bold text-stone-500 dark:text-slate-300 uppercase">{{ item.supplierName }}</span>
                <span class="text-[8px] font-bold text-stone-400">·</span>
                <span class="text-[9px] font-bold text-stone-500 dark:text-slate-300 uppercase">{{ item.workType }}</span>
            </div>

            <!-- Error -->
            <div *ngIf="item.status === 'error'"
                 class="border-t border-red-200 dark:border-red-800 mx-2.5 py-1.5">
                <span class="text-[9px] font-black text-red-500">✗ {{ item.error }}</span>
            </div>
        </div>
    </div>

    <!-- Estado vacío -->
    <div *ngIf="host.toolList.length === 0" class="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
        <div class="w-16 h-16 border-2 border-dashed border-stone-300 dark:border-slate-500 rounded-xl flex items-center justify-center">
            <mat-icon class="!text-3xl text-stone-300 dark:text-slate-500">add_box</mat-icon>
        </div>
        <p class="text-[9px] font-black uppercase text-stone-400 dark:text-slate-400 tracking-[0.18em]">
            Busca y agrega herramientas desde el formulario
        </p>
    </div>

    <!-- Pie informativo -->
    <div class="shrink-0 border-t-2 border-black bg-stone-100 dark:bg-slate-900 px-4 py-2 flex items-center gap-1.5">
        <mat-icon class="!text-[13px] !w-3.5 !h-3.5 text-amber-500">info</mat-icon>
        <span class="text-[8px] font-black uppercase text-stone-400 dark:text-slate-400 tracking-wide">
            El envío se ejecuta con "Enviar Lote" en el formulario principal
        </span>
    </div>
</div>
    `,
})
export class LoteEnvioDialogComponent {

    host: FormEnvioHost;

    constructor(
        private dialogRef: MatDialogRef<LoteEnvioDialogComponent>,
        @Inject(MAT_DIALOG_DATA) data: { host: FormEnvioHost }
    ) {
        this.host = data.host;
    }

    cerrar(): void { this.dialogRef.close(); }
}
