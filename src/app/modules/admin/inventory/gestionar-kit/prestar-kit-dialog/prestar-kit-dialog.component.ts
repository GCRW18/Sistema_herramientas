import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, Subscription, of, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize, mergeMap, map } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service';
import { KitsService }     from '../../../../../core/services/kits.service';

@Component({
    selector: 'app-prestar-kit-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatIconModule, DragDropModule, MatDialogModule],
    styles: [`:host { display: flex; flex-direction: column; }`],
    template: `
<div class="bg-stone-100 dark:bg-slate-900 border-2 border-black flex flex-col w-full max-h-[88vh] rounded-2xl overflow-hidden"
>

    <!-- HEADER -->
    <div class="bg-[#0F172A] px-5 py-3 flex items-center gap-3 shrink-0 select-none"
         cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragHandle style="cursor:grab">
        <div class="w-9 h-9 rounded bg-blue-500 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#000] shrink-0">
            <mat-icon class="!text-lg text-white">send</mat-icon>
        </div>
        <div>
            <p class="text-[9px] text-slate-400 font-bold uppercase tracking-[0.18em] leading-none mb-0.5">Gestión de Kits</p>
            <h2 class="text-sm text-white font-black uppercase tracking-tight leading-none">Prestar Kit</h2>
        </div>
    </div>

    <!-- KIT BANNER -->
    <div class="bg-[#0F172A]/5 dark:bg-slate-800 border-b-2 border-black px-5 py-2.5 flex items-center gap-3 shrink-0">
        <mat-icon class="!text-base text-amber-500 shrink-0">inventory_2</mat-icon>
        <div class="min-w-0">
            <p class="text-xs font-black text-black dark:text-white uppercase truncate">{{ kit.name }}</p>
            <p class="text-[9px] font-mono font-bold text-stone-400 dark:text-slate-400">{{ kit.code }}</p>
        </div>
        <span class="ml-auto px-2 py-0.5 text-[9px] font-black uppercase border-2 border-black rounded text-white shrink-0"
              [ngClass]="categoriaClass">{{ kit.category }}</span>
    </div>

    <!-- FORM -->
    <form [formGroup]="form" class="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 neo-scrollbar">

        <!-- ── Responsable / Prestatario ── -->
        <div class="relative">
            <label class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-1 flex items-center justify-between">
                <span>Responsable / Prestatario *</span>
                <span *ngIf="funcLoading" class="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
            </label>
            <input type="text" formControlName="borrower_name" placeholder="Buscar funcionario..."
                   autocomplete="off"
                   (input)="onBorrowerInput($event)"
                   (focus)="showBorrower = borrowerSug.length > 0"
                   (blur)="hideBorrower()"
                   class="w-full h-9 text-sm font-bold bg-white dark:bg-slate-800 dark:text-white border-2 rounded-xl px-3 outline-none transition-all placeholder:text-stone-300 placeholder:font-normal dark:placeholder:text-slate-600 hover:border-stone-400 focus:border-black focus:shadow-[3px_3px_0_#000]"
                   [ngClass]="form.get('borrower_name')?.invalid && form.get('borrower_name')?.touched
                       ? 'border-red-400' : 'border-stone-300 dark:border-slate-600'">
            <p *ngIf="form.get('borrower_name')?.invalid && form.get('borrower_name')?.touched"
               class="text-[8px] font-bold text-red-500 mt-0.5">Campo requerido.</p>
            <div *ngIf="showBorrower"
                 class="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border-2 border-black rounded-xl shadow-[3px_3px_0_#000] overflow-hidden max-h-40 overflow-y-auto">
                <button *ngFor="let f of borrowerSug" type="button"
                        (mousedown)="selectBorrower(f)"
                        class="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-slate-700 border-b-2 border-stone-100 dark:border-slate-700 last:border-0 transition-colors">
                    <p class="text-[11px] font-black text-black dark:text-white leading-none mb-0.5 truncate">{{ f.nombre ?? f.full_name }}</p>
                    <p class="text-[9px] font-bold text-stone-400 dark:text-slate-400">{{ f.cargo }} · {{ f.area }}</p>
                </button>
            </div>
        </div>

        <!-- ── Departamento + Orden de trabajo ── -->
        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-1 block">Departamento</label>
                <input type="text" formControlName="department" placeholder="Ej: Mantenimiento"
                       class="w-full h-9 text-sm font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-xl px-3 outline-none transition-all placeholder:text-stone-300 placeholder:font-normal dark:placeholder:text-slate-600 hover:border-stone-400 focus:border-black focus:shadow-[3px_3px_0_#000]">
            </div>
            <div>
                <label class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-1 block">Orden de trabajo</label>
                <input type="text" formControlName="work_order_number" placeholder="Auto-generado al guardar"
                       class="w-full h-9 text-sm font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-xl px-3 outline-none transition-all placeholder:text-stone-300 placeholder:font-normal dark:placeholder:text-slate-600 hover:border-stone-400 focus:border-black focus:shadow-[3px_3px_0_#000] uppercase">
            </div>
        </div>

        <!-- ── Fecha devolución + Entregado por ── -->
        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-1 block">Fecha devolución esperada</label>
                <input type="date" formControlName="expected_return_date"
                       class="w-full h-9 text-sm font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-xl px-3 outline-none transition-all hover:border-stone-400 focus:border-black focus:shadow-[3px_3px_0_#000]">
            </div>
            <!-- Entregado por con autocomplete -->
            <div class="relative">
                <label class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-1 flex items-center justify-between">
                    <span>Entregado por</span>
                    <span *ngIf="deliverLoading" class="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                </label>
                <input type="text" formControlName="delivered_by_name" placeholder="Buscar funcionario..."
                       autocomplete="off"
                       (input)="onDeliverInput($event)"
                       (focus)="showDeliver = deliverSug.length > 0"
                       (blur)="hideDeliver()"
                       class="w-full h-9 text-sm font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-xl px-3 outline-none transition-all placeholder:text-stone-300 placeholder:font-normal dark:placeholder:text-slate-600 hover:border-stone-400 focus:border-black focus:shadow-[3px_3px_0_#000]">
                <div *ngIf="showDeliver"
                     class="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border-2 border-black rounded-xl shadow-[3px_3px_0_#000] overflow-hidden max-h-40 overflow-y-auto">
                    <button *ngFor="let f of deliverSug" type="button"
                            (mousedown)="selectDeliver(f)"
                            class="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-slate-700 border-b-2 border-stone-100 dark:border-slate-700 last:border-0 transition-colors">
                        <p class="text-[11px] font-black text-black dark:text-white leading-none mb-0.5 truncate">{{ f.nombre ?? f.full_name }}</p>
                        <p class="text-[9px] font-bold text-stone-400 dark:text-slate-400">{{ f.cargo }} · {{ f.area }}</p>
                    </button>
                </div>
            </div>
        </div>

        <!-- ── Notas ── -->
        <div>
            <label class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-1 block">Notas / Observaciones</label>
            <textarea formControlName="notes" rows="3" placeholder="Observaciones sobre el préstamo..."
                      class="w-full text-sm font-normal bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none transition-all resize-none placeholder:text-stone-300 dark:placeholder:text-slate-600 hover:border-stone-400 focus:border-black focus:shadow-[3px_3px_0_#000]"
                      style="min-height:72px"></textarea>
        </div>

    </form>

    <!-- FOOTER -->
    <div class="border-t-2 border-black bg-stone-200 dark:bg-slate-800 px-4 py-2.5 flex flex-col gap-1.5 shrink-0">
        <p *ngIf="errorMsg" class="text-[9px] font-black text-red-600 text-center uppercase">{{ errorMsg }}</p>
        <div class="flex justify-between items-center gap-2">
            <button type="button" (click)="cerrar()" [disabled]="saving"
                    class="px-4 py-2 bg-[#FF1414] text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all uppercase disabled:opacity-40">
                Cancelar
            </button>
            <button type="button" (click)="onSubmit()" [disabled]="!form.valid || saving"
                    class="flex items-center gap-2 px-5 py-2 bg-blue-500 text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[3px_3px_0_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all uppercase disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none">
                <span *ngIf="saving" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <mat-icon *ngIf="!saving" class="!text-white">send</mat-icon>
                {{ saving ? 'Registrando...' : 'Registrar Préstamo' }}
            </button>
        </div>
    </div>

</div>
    `
})
export class PrestarKitDialogComponent implements OnInit, OnDestroy {

    form:     FormGroup;
    saving    = false;
    otLoading = false;
    errorMsg  = '';

    // Autocomplete Responsable
    borrowerSug:  any[] = [];
    funcLoading         = false;
    showBorrower        = false;
    private _borrower$  = new Subject<string>();

    // Autocomplete Entregado por
    deliverSug:     any[] = [];
    deliverLoading        = false;
    showDeliver           = false;
    private _deliver$     = new Subject<string>();

    private _subs           = new Subscription();
    private fb              = inject(FormBuilder);
    public  dialogRef       = inject(MatDialogRef<PrestarKitDialogComponent>);
    public  kit             = inject<any>(MAT_DIALOG_DATA);
    private movementService = inject(MovementService);
    private kitsService     = inject(KitsService);

    get categoriaClass(): string {
        const m: Record<string, string> = {
            'MANTENIMIENTO': 'bg-[#0F172A]',
            'LUBRICACION':   'bg-green-600',
            'FRENOS':        'bg-red-600',
            'CALIBRACION':   'bg-purple-600',
            'GENERAL':       'bg-gray-600'
        };
        return m[this.kit?.category ?? ''] ?? 'bg-gray-600';
    }

    constructor() {
        this.form = inject(FormBuilder).group({
            borrower_name:        ['', Validators.required],
            department:           [''],
            work_order_number:    [''],
            expected_return_date: [''],
            delivered_by_name:    [''],
            notes:                ['']
        });
    }

    ngOnInit(): void {
        // Autocomplete Responsable
        this._subs.add(
            this._borrower$.pipe(
                debounceTime(200), distinctUntilChanged(),
                switchMap(term => {
                    if (term.length < 2) { this.borrowerSug = []; this.showBorrower = false; return of([]); }
                    this.funcLoading = true;
                    const q = term.toLowerCase();
                    return this.movementService.getPersonal().pipe(
                        map(lista => lista
                            .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                                .filter(Boolean).join(' ').toLowerCase().includes(q))
                            .slice(0, 10)
                            .map(f => ({ ...f, nombre: f.nombreCompleto || f.nombre }))
                        ),
                        finalize(() => this.funcLoading = false),
                        catchError(() => of([]))
                    );
                })
            ).subscribe(lista => { this.borrowerSug = lista; this.showBorrower = lista.length > 0; })
        );

        // Autocomplete Entregado por
        this._subs.add(
            this._deliver$.pipe(
                debounceTime(200), distinctUntilChanged(),
                switchMap(term => {
                    if (term.length < 2) { this.deliverSug = []; this.showDeliver = false; return of([]); }
                    this.deliverLoading = true;
                    const q = term.toLowerCase();
                    return this.movementService.getPersonal().pipe(
                        map(lista => lista
                            .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                                .filter(Boolean).join(' ').toLowerCase().includes(q))
                            .slice(0, 10)
                            .map(f => ({ ...f, nombre: f.nombreCompleto || f.nombre }))
                        ),
                        finalize(() => this.deliverLoading = false),
                        catchError(() => of([]))
                    );
                })
            ).subscribe(lista => { this.deliverSug = lista; this.showDeliver = lista.length > 0; })
        );
    }

    ngOnDestroy(): void { this._subs.unsubscribe(); }

    onBorrowerInput(e: Event): void { this._borrower$.next((e.target as HTMLInputElement).value); }
    onDeliverInput(e: Event):  void { this._deliver$.next((e.target as HTMLInputElement).value); }

    selectBorrower(f: any): void {
        this.form.get('borrower_name')?.setValue(f.nombre ?? f.full_name ?? '');
        if (!this.form.get('department')?.value && f.area) {
            this.form.get('department')?.setValue(f.area);
        }
        this.borrowerSug  = [];
        this.showBorrower = false;
    }

    selectDeliver(f: any): void {
        this.form.get('delivered_by_name')?.setValue(f.nombre ?? f.full_name ?? '');
        this.deliverSug  = [];
        this.showDeliver = false;
    }

    hideBorrower(): void { setTimeout(() => this.showBorrower = false, 150); }
    hideDeliver():  void { setTimeout(() => this.showDeliver  = false, 150); }

    cerrar(): void { this.dialogRef.close(); }

    onSubmit(): void {
        if (!this.form.valid || this.saving) return;
        this.saving   = true;
        this.errorMsg = '';
        const v = this.form.value;

        // Si ya hay OT visible (generado al seleccionar prestatario o escrito manual), usarlo.
        // Si no (usuario escribió nombre sin autocomplete), generarlo ahora.
        const ot$: Observable<string> = v.work_order_number
            ? of(v.work_order_number as string)
            : this.kitsService.getNextWorkOrderNumber();

        this._subs.add(
            ot$.pipe(
                mergeMap(ot => this.kitsService.prestarKit({
                    kit_id:               this.kit.id_kit ?? this.kit.id,
                    borrower_name:        v.borrower_name,
                    department:           v.department           || undefined,
                    work_order_number:    ot                     || undefined,
                    expected_return_date: v.expected_return_date || undefined,
                    delivered_by_name:    v.delivered_by_name    || undefined,
                    notes:                v.notes                || undefined
                }), (ot, res) => ({ ot, res })),
                finalize(() => this.saving = false)
            ).subscribe({
                next: ({ ot, res }) => {
                    this.dialogRef.close({ prestado: true, loan_number: res.loan_number, work_order_number: ot });
                },
                error: (e) => {
                    this.errorMsg = e?.message ?? 'Error al registrar el préstamo';
                }
            })
        );
    }
}
