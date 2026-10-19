import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Paginador compacto (mismo diseño que el de Calibraciones): "1–10 de N" + anterior / "1 / P" / siguiente.
 * El padre recorta la lista con `| slice: pagina * pageSize : pagina * pageSize + pageSize`
 * y vuelve `pagina` a 0 cuando cambia el filtro.
 */
@Component({
    selector: 'app-paginador-compacto',
    standalone: true,
    imports: [MatIconModule],
    template: `
        <div class="flex items-center justify-between px-3 py-1.5 border-t-[2px] border-black bg-stone-200 dark:bg-[#020617] shrink-0">
            <span class="text-[10px] font-black text-black dark:text-slate-300 uppercase">
                {{ desde }}–{{ hasta }} de {{ total }}
            </span>
            <div class="flex items-center gap-1">
                <button type="button" (click)="ir(pageIndex - 1)" [disabled]="pageIndex === 0" [class]="btnClass">
                    <mat-icon class="!text-xs text-black dark:text-white">chevron_left</mat-icon>
                </button>
                <span class="text-[10px] font-black text-black dark:text-slate-300 px-1.5 uppercase">
                    {{ pageIndex + 1 }} / {{ totalPaginas }}
                </span>
                <button type="button" (click)="ir(pageIndex + 1)" [disabled]="pageIndex >= totalPaginas - 1" [class]="btnClass">
                    <mat-icon class="!text-xs text-black dark:text-white">chevron_right</mat-icon>
                </button>
            </div>
        </div>
    `,
})
export class PaginadorCompactoComponent {
    @Input() total     = 0;
    @Input() pageSize  = 10;
    @Input() pageIndex = 0;
    @Output() pageIndexChange = new EventEmitter<number>();

    readonly btnClass = 'w-6 h-6 flex items-center justify-center border-[2px] border-black rounded-full bg-white dark:bg-slate-800 shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0px_0px_#000]';

    get totalPaginas(): number { return Math.ceil(this.total / this.pageSize) || 1; }
    get desde(): number { return this.total === 0 ? 0 : this.pageIndex * this.pageSize + 1; }
    get hasta(): number { return Math.min((this.pageIndex + 1) * this.pageSize, this.total); }

    ir(pagina: number): void {
        if (pagina < 0 || pagina > this.totalPaginas - 1) return;
        this.pageIndex = pagina;
        this.pageIndexChange.emit(pagina);
    }
}
