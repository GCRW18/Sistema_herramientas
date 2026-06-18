import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef } from '@angular/material/dialog';
import { MovementService } from '../../../../../core/services/movement.service';
import { finalize } from 'rxjs/operators';

interface Categoria {
    id_category: number;
    name: string;
    code: string;
    active: boolean;
}

@Component({
    selector: 'app-categoria-ingresos-dialog',
    standalone: true,
    imports: [CommonModule, FormsModule, MatIconModule],
    template: `
<div class="bg-stone-100 dark:bg-slate-900 border-2 border-black rounded-2xl overflow-hidden flex flex-col"
     style="width: 640px; max-width: 95vw;">

    <!-- HEADER -->
    <div class="bg-[#0F172A] px-4 py-3 flex items-center gap-3 shrink-0">
        <div class="w-8 h-8 rounded-lg bg-amber-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#000] shrink-0">
            <mat-icon class="!text-sm text-black">category</mat-icon>
        </div>
        <div class="flex-1">
            <p class="text-[8px] text-slate-400 font-bold uppercase tracking-[0.18em] leading-none mb-0.5">Movimientos · Ingresos</p>
            <h2 class="text-sm text-white font-black uppercase tracking-tight leading-none">Gestionar Categorías</h2>
        </div>
        <button (click)="cerrar()"
                class="w-7 h-7 flex items-center justify-center rounded-lg border border-white/20 text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
            <mat-icon class="!text-base">close</mat-icon>
        </button>
    </div>

    <!-- BODY -->
    <div class="p-4 flex flex-col gap-4">

        <!-- Lista de categorías -->
        <div>
            <p class="text-[9px] font-black uppercase tracking-widest text-stone-400 dark:text-slate-400 mb-2">
                Categorías activas ({{ categorias().length }})
            </p>

            <div *ngIf="loading()" class="flex items-center justify-center py-6">
                <div class="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>

            <div *ngIf="!loading()" class="flex flex-wrap gap-1.5 min-h-[36px]">
                <div *ngFor="let cat of categorias()"
                     class="group relative flex items-center gap-1.5 px-3 py-1 border-2 border-black rounded-lg text-[10px] font-black uppercase text-white shadow-[2px_2px_0_#000] transition-all"
                     [ngClass]="confirmDeleteId() === cat.id_category ? 'bg-red-600' : getCategoriaClass(cat.name)">

                    <!-- Estado normal -->
                    <ng-container *ngIf="confirmDeleteId() !== cat.id_category">
                        <span>{{ cat.name }}</span>
                        <button (click)="pedirConfirmacion(cat)"
                                [disabled]="deletingId() === cat.id_category"
                                class="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded-full bg-black/40 hover:bg-red-600 transition-all shrink-0 disabled:opacity-30">
                            <mat-icon class="!text-[10px] !w-3 !h-3 text-white">close</mat-icon>
                        </button>
                    </ng-container>

                    <!-- Estado confirmación -->
                    <ng-container *ngIf="confirmDeleteId() === cat.id_category">
                        <span class="text-[9px]">¿Eliminar?</span>
                        <button (click)="confirmarEliminar(cat)"
                                [disabled]="deletingId() === cat.id_category"
                                class="w-4 h-4 flex items-center justify-center rounded-full bg-white/30 hover:bg-white/50 transition-all shrink-0 disabled:opacity-30">
                            <span *ngIf="deletingId() === cat.id_category"
                                  class="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin"></span>
                            <mat-icon *ngIf="deletingId() !== cat.id_category" class="!text-[10px] !w-3 !h-3 text-white">check</mat-icon>
                        </button>
                        <button (click)="cancelarConfirmacion()"
                                class="w-4 h-4 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition-all shrink-0">
                            <mat-icon class="!text-[10px] !w-3 !h-3 text-white">close</mat-icon>
                        </button>
                    </ng-container>
                </div>

                <div *ngIf="!loading() && categorias().length === 0"
                     class="w-full py-4 flex flex-col items-center gap-1">
                    <mat-icon class="!text-2xl text-stone-300 dark:text-slate-600">category</mat-icon>
                    <p class="text-[9px] font-bold text-stone-400 uppercase">Sin categorías registradas</p>
                </div>
            </div>
        </div>

        <!-- Divisor -->
        <div class="border-t-2 border-dashed border-stone-300 dark:border-slate-700"></div>

        <!-- Agregar nueva -->
        <div>
            <p class="text-[9px] font-black uppercase tracking-widest text-stone-400 dark:text-slate-400 mb-2">
                Nueva Categoría
            </p>
            <div class="flex gap-2">
                <input type="text" [(ngModel)]="newCategoryName"
                       (keydown.enter)="agregarCategoria()"
                       placeholder="Ej: BANCO DE PRUEBA"
                       maxlength="50"
                       class="flex-1 h-9 px-3 text-xs font-black uppercase bg-white dark:bg-slate-800 dark:text-white
                              border-2 border-stone-300 dark:border-slate-600 rounded-xl outline-none transition-all
                              placeholder:normal-case placeholder:font-normal placeholder:text-stone-300 dark:placeholder:text-slate-500
                              hover:border-stone-400 focus:border-black focus:shadow-[3px_3px_0_#000]">
                <button (click)="agregarCategoria()"
                        [disabled]="saving() || !newCategoryName.trim()"
                        class="h-9 px-4 bg-amber-400 text-black font-black text-[10px] border-2 border-black rounded-xl
                               shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]
                               transition-all uppercase flex items-center gap-1.5
                               disabled:opacity-40 disabled:pointer-events-none">
                    <span *ngIf="saving()" class="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                    <mat-icon *ngIf="!saving()" class="!text-sm">add</mat-icon>
                    {{ saving() ? '...' : 'Agregar' }}
                </button>
            </div>
            <p *ngIf="errorMsg()" class="text-[9px] font-bold text-red-600 mt-1.5">{{ errorMsg() }}</p>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="border-t-2 border-black bg-stone-200 dark:bg-slate-800 px-4 py-2.5 flex justify-end shrink-0">
        <button (click)="cerrar()"
                class="px-5 py-1.5 bg-[#0F172A] text-white font-black text-[10px] border-2 border-black rounded-xl
                       shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]
                       transition-all uppercase">
            Cerrar
        </button>
    </div>
</div>
    `,
    styles: [`:host { display: block; }`]
})
export class CategoriaIngresosDialogComponent implements OnInit {

    private dialogRef    = inject(MatDialogRef<CategoriaIngresosDialogComponent>);
    private movementSvc  = inject(MovementService);

    categorias      = signal<Categoria[]>([]);
    loading         = signal(false);
    saving          = signal(false);
    deletingId      = signal<number | null>(null);
    confirmDeleteId = signal<number | null>(null);
    errorMsg        = signal('');
    newCategoryName = '';

    ngOnInit(): void { this.cargar(); }

    cargar(): void {
        this.loading.set(true);
        this.movementSvc.getIngresosCategories().pipe(
            finalize(() => this.loading.set(false))
        ).subscribe(cats => this.categorias.set(cats));
    }

    agregarCategoria(): void {
        const name = this.newCategoryName.trim().toUpperCase();
        if (!name || this.saving()) return;
        if (this.categorias().some(c => c.name === name)) {
            this.errorMsg.set('Ya existe esa categoría');
            return;
        }
        this.saving.set(true);
        this.errorMsg.set('');
        this.movementSvc.createIngresosCategory(name).subscribe({
            next: () => {
                this.saving.set(false);
                this.newCategoryName = '';
                this.cargar();
            },
            error: () => {
                this.saving.set(false);
                this.errorMsg.set('Error al guardar la categoría');
            }
        });
    }

    pedirConfirmacion(cat: Categoria): void {
        this.errorMsg.set('');
        this.confirmDeleteId.set(cat.id_category);
    }

    cancelarConfirmacion(): void { this.confirmDeleteId.set(null); }

    confirmarEliminar(cat: Categoria): void {
        this.deletingId.set(cat.id_category);
        this.errorMsg.set('');
        this.movementSvc.deleteIngresosCategory(cat.id_category).subscribe({
            next: () => {
                this.deletingId.set(null);
                this.confirmDeleteId.set(null);
                this.categorias.update(list => list.filter(c => c.id_category !== cat.id_category));
            },
            error: () => {
                this.deletingId.set(null);
                this.confirmDeleteId.set(null);
                this.errorMsg.set('No se pudo eliminar. Puede estar en uso.');
            }
        });
    }

    cerrar(): void { this.dialogRef.close({ recargar: true }); }

    getCategoriaClass(name: string): string {
        const map: Record<string, string> = {
            'HERRAMIENTA':       'bg-[#0F172A]',
            'BANCO_DE_PRUEBA':   'bg-blue-700',
            'BANCO DE PRUEBA':   'bg-blue-700',
            'CONSUMIBLE':        'bg-green-600',
            'EQUIPO_DE_MEDICION': 'bg-purple-600',
            'EQUIPO DE MEDICION': 'bg-purple-600',
            'EQUIPO_DE_SOPORTE':  'bg-orange-600',
            'EQUIPO DE SOPORTE EN TIERRA': 'bg-orange-600',
        };
        return map[name] ?? 'bg-gray-600';
    }
}
