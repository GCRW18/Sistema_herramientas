import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize, takeUntil } from 'rxjs/operators';
import { ToolService } from '../../../../../core/services/tool.service';

export interface CatalogoHerramientasResult {
    action: 'select' | 'new';
    tool?: any;
}

@Component({
    selector: 'app-catalogo-herramientas',
    standalone: true,
    imports: [CommonModule, MatIconModule, DragDropModule],
    templateUrl: './catalogo-herramientas.component.html',
    styles: [`
        :host { display: block; width: 100%; height: 100%; }
        .custom-scrollbar-ing::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ing::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ing::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
    `]
})
export class CatalogoHerramientasComponent implements OnDestroy {
    public dialogRef = inject(MatDialogRef<CatalogoHerramientasComponent>, { optional: true });
    private toolSvc  = inject(ToolService);
    private destroy$ = new Subject<void>();

    catalogSearch  = '';
    catalogItems:  any[] = [];
    catalogLoading = false;
    private catalog$ = new Subject<string>();

    constructor() {
        this.catalog$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(term => {
                if (term.trim().length < 2) {
                    this.catalogItems   = [];
                    this.catalogLoading = false;
                    return of([]);
                }
                this.catalogLoading = true;
                return this.toolSvc.getTools({ query: term.trim() }).pipe(
                    catchError(() => of([])),
                    finalize(() => this.catalogLoading = false)
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(tools => { this.catalogItems = tools as any[]; });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onCatalogSearch(term: string): void {
        this.catalogSearch = term;
        this.catalog$.next(term);
    }

    selectFromCatalog(tool: any): void {
        const result: CatalogoHerramientasResult = { action: 'select', tool };
        this.dialogRef?.close(result);
    }

    ingresarNueva(): void {
        const result: CatalogoHerramientasResult = { action: 'new' };
        this.dialogRef?.close(result);
    }

    cerrar(): void { this.dialogRef?.close(); }
}
