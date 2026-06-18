import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Permission } from '../../../../../../core/models/role.types';

export interface ModuloPermisosData {
    module: string;
    icon:   string;
    permissions: Permission[];
    selectedIds: string[];
}

@Component({
    selector: 'app-modulo-permisos-mini-dialog',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatDialogModule, DragDropModule],
    template: `
<div class="bg-stone-100 dark:bg-slate-900 border-2 border-black rounded-2xl overflow-hidden flex flex-col"
     style="width:420px">

    <!-- Header -->
    <div class="bg-[#0F172A] px-4 py-2.5 flex items-center gap-2.5 shrink-0 select-none"
         cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragHandle style="cursor:grab">
        <div class="w-8 h-8 rounded-xl bg-amber-500 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#000] shrink-0">
            <mat-icon class="!text-base text-white">{{ data.icon }}</mat-icon>
        </div>
        <div class="flex-1 min-w-0">
            <p class="text-[8px] text-slate-400 font-bold uppercase tracking-[0.18em] leading-none mb-0.5">Permisos del módulo</p>
            <h2 class="text-xs text-white font-black uppercase tracking-tight leading-none">{{ data.module }}</h2>
        </div>
        <span class="px-2 py-0.5 bg-amber-500 text-black font-black text-[9px] border border-black rounded-lg shrink-0">
            {{ localSelected.length }} / {{ data.permissions.length }}
        </span>
        <button type="button" (click)="cancel()" (mousedown)="$event.stopPropagation()"
                class="w-6 h-6 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/10 shrink-0">
            <mat-icon class="text-white !text-xs">close</mat-icon>
        </button>
    </div>

    <!-- Select-all bar -->
    <div class="px-3 py-2 bg-white dark:bg-slate-800 border-b-2 border-stone-200 dark:border-slate-700 flex items-center justify-between shrink-0">
        <span class="text-[9px] font-black uppercase text-stone-400 dark:text-slate-400">
            {{ localSelected.length === 0 ? 'Sin permisos seleccionados' : localSelected.length + ' permiso(s) activo(s)' }}
        </span>
        <button type="button" (click)="toggleAll()"
                class="flex items-center gap-1 h-7 px-3 rounded-lg border-2 border-black text-[9px] font-black uppercase transition-all"
                [ngClass]="allSelected
                    ? 'bg-stone-200 dark:bg-slate-700 text-black dark:text-white hover:bg-stone-300'
                    : 'bg-[#FFC501FF] text-black hover:shadow-[2px_2px_0_#000]'">
            <mat-icon class="!text-[11px]">{{ allSelected ? 'remove_done' : 'done_all' }}</mat-icon>
            {{ allSelected ? 'Quitar todos' : 'Seleccionar todos' }}
        </button>
    </div>

    <!-- Permissions -->
    <div class="px-3 py-3 flex flex-col gap-2 overflow-y-auto" style="max-height:55vh; scrollbar-width:thin">
        <div *ngFor="let perm of data.permissions"
             (click)="toggle(perm.id)"
             class="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 select-none"
             [ngClass]="isSelected(perm.id)
                 ? 'bg-amber-50 dark:bg-amber-900/20 border-black shadow-[2px_2px_0_#000]'
                 : 'bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-600 hover:border-stone-400 dark:hover:border-slate-400'">
            <div class="w-5 h-5 mt-0.5 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-all"
                 [ngClass]="isSelected(perm.id)
                     ? 'bg-[#FFC501FF] border-black'
                     : 'bg-stone-100 dark:bg-slate-600 border-stone-300 dark:border-slate-500'">
                <mat-icon *ngIf="isSelected(perm.id)" class="!text-[11px] text-black">check</mat-icon>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-[10px] font-black uppercase leading-tight"
                   [ngClass]="isSelected(perm.id) ? 'text-black dark:text-white' : 'text-stone-600 dark:text-slate-300'">
                    {{ perm.name }}
                </p>
                <p class="text-[9px] text-stone-400 dark:text-slate-500 mt-0.5 leading-snug">{{ perm.description }}</p>
            </div>
            <mat-icon *ngIf="isSelected(perm.id)" class="!text-base text-amber-500 shrink-0 mt-0.5">check_circle</mat-icon>
        </div>
    </div>

    <!-- Footer -->
    <div class="border-t-2 border-black bg-stone-200 dark:bg-slate-800 px-4 py-2 flex justify-between items-center gap-2 shrink-0">
        <button type="button" (click)="cancel()"
                class="px-3 py-1.5 bg-stone-300 dark:bg-slate-700 text-black dark:text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all uppercase">
            Cancelar
        </button>
        <button type="button" (click)="apply()"
                class="flex items-center gap-1.5 px-4 py-1.5 bg-[#0F172A] text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[3px_3px_0_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all uppercase">
            <mat-icon class="!text-white !text-sm">check</mat-icon>
            Aplicar ({{ localSelected.length }})
        </button>
    </div>

</div>
    `
})
export class ModuloPermisosMiniDialogComponent {
    localSelected: string[];

    constructor(
        private dialogRef: MatDialogRef<ModuloPermisosMiniDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ModuloPermisosData
    ) {
        this.localSelected = [...data.selectedIds];
    }

    get allSelected(): boolean {
        return this.data.permissions.every(p => this.localSelected.includes(p.id));
    }

    isSelected(id: string): boolean { return this.localSelected.includes(id); }

    toggle(id: string): void {
        this.localSelected = this.localSelected.includes(id)
            ? this.localSelected.filter(p => p !== id)
            : [...this.localSelected, id];
    }

    toggleAll(): void {
        this.localSelected = this.allSelected
            ? []
            : this.data.permissions.map(p => p.id);
    }

    apply(): void { this.dialogRef.close(this.localSelected); }
    cancel(): void { this.dialogRef.close(null); }
}
