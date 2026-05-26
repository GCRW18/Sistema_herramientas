import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize, map } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service';
import { KitsService }     from '../../../../../core/services/kits.service';

interface CompState {
    tool_id:   number;
    tool_name: string;
    tool_code: string;
    state:     'present' | 'damaged' | 'missing';
}

@Component({
    selector: 'app-devolver-kit-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatIconModule, DragDropModule, MatDialogModule],
    styles: [`:host { display: flex; flex-direction: column; }`],
    template: `
<div class="bg-stone-100 dark:bg-slate-900 border-2 border-black flex flex-col w-full max-h-[90vh] rounded-2xl overflow-hidden"
     style="box-shadow: 6px 6px 0 #000">

    <!-- HEADER -->
    <div class="bg-[#0F172A] px-5 py-3 flex items-center gap-3 shrink-0 select-none"
         cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragHandle style="cursor:grab">
        <div class="w-9 h-9 rounded bg-orange-500 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#000] shrink-0">
            <mat-icon class="!text-lg text-white">assignment_return</mat-icon>
        </div>
        <div>
            <p class="text-[9px] text-slate-400 font-bold uppercase tracking-[0.18em] leading-none mb-0.5">Gestión de Kits</p>
            <h2 class="text-sm text-white font-black uppercase tracking-tight leading-none">Registrar Devolución</h2>
        </div>
    </div>

    <!-- KIT BANNER -->
    <div class="bg-[#0F172A]/5 dark:bg-slate-800 border-b-2 border-black px-5 py-2.5 flex items-center gap-3 shrink-0">
        <mat-icon class="!text-base text-amber-500 shrink-0">inventory_2</mat-icon>
        <div class="min-w-0">
            <p class="text-xs font-black text-black dark:text-white uppercase truncate">{{ kit.name }}</p>
            <p class="text-[9px] font-mono font-bold text-stone-400 dark:text-slate-400">{{ kit.code }}</p>
        </div>
        <div class="ml-auto flex items-center gap-2 shrink-0">
            <span class="px-2 py-0.5 text-[9px] font-black uppercase border-2 border-black rounded text-white"
                  [ngClass]="categoriaClass">{{ kit.category }}</span>
            <span *ngIf="data.loan_number"
                  class="px-2 py-0.5 text-[9px] font-mono font-black uppercase border-2 border-orange-500 rounded text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30">
                {{ data.loan_number }}
            </span>
        </div>
    </div>

    <!-- FORM + CHECKLIST -->
    <form [formGroup]="form" class="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 neo-scrollbar">

        <!-- Verificado por (autocomplete) -->
        <div class="relative">
            <label class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-1 flex items-center justify-between">
                <span>Entrega / Responsable * (editable)</span>
                <span *ngIf="funcLoading" class="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
            </label>
            <input type="text" formControlName="verified_by_name" placeholder="Cargando prestatario..."
                   autocomplete="off"
                   (input)="onFuncInput($event)"
                   (focus)="showSuggestions = suggestions.length > 0"
                   (blur)="hideSuggestions()"
                   class="w-full h-9 text-sm font-bold bg-white dark:bg-slate-800 dark:text-white border-2 rounded-xl px-3 outline-none transition-all placeholder:text-stone-300 placeholder:font-normal dark:placeholder:text-slate-600 hover:border-stone-400 focus:border-black focus:shadow-[3px_3px_0_#000]"
                   [ngClass]="form.get('verified_by_name')?.invalid && form.get('verified_by_name')?.touched
                       ? 'border-red-400' : 'border-stone-300 dark:border-slate-600'">
            <p *ngIf="form.get('verified_by_name')?.invalid && form.get('verified_by_name')?.touched"
               class="text-[8px] font-bold text-red-500 mt-0.5">Campo requerido.</p>
            <div *ngIf="showSuggestions"
                 class="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border-2 border-black rounded-xl shadow-[3px_3px_0_#000] overflow-hidden max-h-40 overflow-y-auto">
                <button *ngFor="let f of suggestions" type="button"
                        (mousedown)="selectFunc(f)"
                        class="w-full text-left px-3 py-2 hover:bg-orange-50 dark:hover:bg-slate-700 border-b-2 border-stone-100 dark:border-slate-700 last:border-0 transition-colors">
                    <p class="text-[11px] font-black text-black dark:text-white leading-none mb-0.5 truncate">{{ f.nombre ?? f.full_name }}</p>
                    <p class="text-[9px] font-bold text-stone-400 dark:text-slate-400">{{ f.cargo }} · {{ f.area }}</p>
                </button>
            </div>
        </div>

        <!-- CHECKLIST DE COMPONENTES -->
        <div>
            <div class="flex items-center justify-between mb-2">
                <label class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">
                    Verificación de componentes ({{ compStates.length }})
                </label>
                <div class="flex items-center gap-2 text-[8px] font-bold">
                    <span class="flex items-center gap-1 text-green-600"><span class="w-2 h-2 rounded-full bg-green-500 border border-green-700 inline-block"></span>{{ presentCount }} ok</span>
                    <span class="flex items-center gap-1 text-amber-600"><span class="w-2 h-2 rounded-full bg-amber-400 border border-amber-700 inline-block"></span>{{ damagedCount }} dañ</span>
                    <span class="flex items-center gap-1 text-red-600"><span class="w-2 h-2 rounded-full bg-red-500 border border-red-700 inline-block"></span>{{ missingCount }} falt</span>
                </div>
            </div>

            <!-- Loading spinner -->
            <div *ngIf="compLoading" class="flex items-center justify-center py-6">
                <div class="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                <span class="ml-2 text-[10px] font-bold text-stone-400 uppercase">Cargando componentes...</span>
            </div>

            <!-- Empty state -->
            <div *ngIf="!compLoading && compStates.length === 0"
                 class="border-2 border-dashed border-stone-300 dark:border-slate-600 rounded-xl py-6 text-center">
                <mat-icon class="!text-3xl text-stone-300 dark:text-slate-600">build_circle</mat-icon>
                <p class="text-[10px] font-bold text-stone-400 dark:text-slate-500 mt-1 uppercase">Sin componentes registrados</p>
            </div>

            <!-- Component list -->
            <div *ngIf="!compLoading && compStates.length > 0"
                 class="border-2 border-black rounded-xl overflow-hidden shadow-[2px_2px_0_#000]">
                <div *ngFor="let comp of compStates; let i = index"
                     class="flex items-center gap-3 px-3 py-2 border-b-2 border-stone-200 dark:border-slate-700 last:border-0 bg-white dark:bg-slate-800 hover:bg-stone-50 dark:hover:bg-slate-750 transition-colors">
                    <!-- Dot indicator -->
                    <span class="w-2.5 h-2.5 rounded-full border-2 border-black shrink-0 transition-colors"
                          [ngClass]="{
                              'bg-green-400': comp.state === 'present',
                              'bg-amber-400': comp.state === 'damaged',
                              'bg-red-500':   comp.state === 'missing'
                          }"></span>
                    <!-- Tool info -->
                    <div class="flex-1 min-w-0">
                        <p class="text-[11px] font-black text-black dark:text-white leading-none truncate">{{ comp.tool_name }}</p>
                        <p class="text-[9px] font-mono font-bold text-stone-400 dark:text-slate-400">{{ comp.tool_code }}</p>
                    </div>
                    <!-- State buttons -->
                    <div class="flex gap-1 shrink-0">
                        <button type="button" (click)="setState(i, 'present')"
                                class="px-2 py-0.5 text-[8px] font-black uppercase border-2 rounded transition-all"
                                [ngClass]="comp.state === 'present'
                                    ? 'bg-green-500 border-green-700 text-white shadow-[1px_1px_0_#000]'
                                    : 'bg-white dark:bg-slate-700 border-stone-300 dark:border-slate-600 text-stone-400 dark:text-slate-400 hover:border-green-500'">
                            <mat-icon class="!text-[10px] !w-3 !h-3">check</mat-icon>
                        </button>
                        <button type="button" (click)="setState(i, 'damaged')"
                                class="px-2 py-0.5 text-[8px] font-black uppercase border-2 rounded transition-all"
                                [ngClass]="comp.state === 'damaged'
                                    ? 'bg-amber-400 border-amber-600 text-black shadow-[1px_1px_0_#000]'
                                    : 'bg-white dark:bg-slate-700 border-stone-300 dark:border-slate-600 text-stone-400 dark:text-slate-400 hover:border-amber-500'">
                            <mat-icon class="!text-[10px] !w-3 !h-3">warning</mat-icon>
                        </button>
                        <button type="button" (click)="setState(i, 'missing')"
                                class="px-2 py-0.5 text-[8px] font-black uppercase border-2 rounded transition-all"
                                [ngClass]="comp.state === 'missing'
                                    ? 'bg-red-500 border-red-700 text-white shadow-[1px_1px_0_#000]'
                                    : 'bg-white dark:bg-slate-700 border-stone-300 dark:border-slate-600 text-stone-400 dark:text-slate-400 hover:border-red-500'">
                            <mat-icon class="!text-[10px] !w-3 !h-3">close</mat-icon>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Completeness badge -->
            <div *ngIf="!compLoading && compStates.length > 0"
                 class="mt-2 flex items-center gap-2">
                <span class="px-3 py-1 text-[9px] font-black uppercase border-2 border-black rounded"
                      [ngClass]="isComplete ? 'bg-green-100 text-green-800 border-green-700' : 'bg-red-100 text-red-700 border-red-600'">
                    {{ isComplete ? '✓ Kit completo' : '✗ Kit incompleto' }}
                </span>
                <span *ngIf="damagedCount > 0"
                      class="text-[9px] font-bold text-amber-700 dark:text-amber-400 truncate">
                    Dañados: {{ damagedList }}
                </span>
                <span *ngIf="missingCount > 0 && damagedCount === 0"
                      class="text-[9px] font-bold text-red-600 dark:text-red-400 truncate">
                    Faltantes: {{ missingList }}
                </span>
            </div>
        </div>

        <!-- Acciones tomadas + Notas -->
        <div class="grid grid-cols-1 gap-3">
            <div>
                <label class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-1 block">Acciones tomadas</label>
                <textarea formControlName="actions_taken" rows="2" placeholder="Ej: Limpieza de piezas, reportar daño a supervisor..."
                          class="w-full text-sm font-normal bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none transition-all resize-none placeholder:text-stone-300 dark:placeholder:text-slate-600 hover:border-stone-400 focus:border-black focus:shadow-[3px_3px_0_#000]"
                          style="min-height:56px"></textarea>
            </div>
            <div>
                <label class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-1 block">Notas / Observaciones</label>
                <textarea formControlName="notes" rows="2" placeholder="Observaciones sobre el estado del kit..."
                          class="w-full text-sm font-normal bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none transition-all resize-none placeholder:text-stone-300 dark:placeholder:text-slate-600 hover:border-stone-400 focus:border-black focus:shadow-[3px_3px_0_#000]"
                          style="min-height:56px"></textarea>
            </div>
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
                    class="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[3px_3px_0_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all uppercase disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none">
                <span *ngIf="saving" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <mat-icon *ngIf="!saving" class="!text-white">assignment_return</mat-icon>
                {{ saving ? 'Registrando...' : 'Confirmar Devolución' }}
            </button>
        </div>
    </div>

</div>
    `
})
export class DevolverKitDialogComponent implements OnInit, OnDestroy {

    form:        FormGroup;
    saving       = false;
    errorMsg     = '';
    compStates:  CompState[] = [];
    compLoading  = false;

    suggestions:       any[] = [];
    funcLoading              = false;
    showSuggestions          = false;
    private _search$         = new Subject<string>();
    private _subs            = new Subscription();

    private fb              = inject(FormBuilder);
    public  dialogRef       = inject(MatDialogRef<DevolverKitDialogComponent>);
    public  data            = inject<{ kit: any; id_kit_loan: number; loan_number?: string }>(MAT_DIALOG_DATA);
    private kitsService     = inject(KitsService);
    private movementService = inject(MovementService);

    get kit(): any { return this.data.kit; }

    get presentCount(): number  { return this.compStates.filter(c => c.state === 'present').length; }
    get damagedCount(): number  { return this.compStates.filter(c => c.state === 'damaged').length; }
    get missingCount(): number  { return this.compStates.filter(c => c.state === 'missing').length; }
    get isComplete():   boolean { return this.compStates.length > 0 && this.missingCount === 0 && this.damagedCount === 0; }
    get missingList():  string  { return this.compStates.filter(c => c.state === 'missing').map(c => c.tool_name).join(', '); }
    get damagedList():  string  { return this.compStates.filter(c => c.state === 'damaged').map(c => c.tool_name).join(', '); }

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
            verified_by_name: ['', Validators.required],
            actions_taken:    [''],
            notes:            ['']
        });
    }

    ngOnInit(): void {
        const kitId = this.kit?.id_kit ?? this.kit?.id;
        if (kitId) {
            // Cargar componentes
            this.compLoading = true;
            this.kitsService.getKitComponents(kitId).pipe(
                finalize(() => this.compLoading = false)
            ).subscribe(comps => {
                this.compStates = comps.map(c => ({
                    tool_id:   c.tool_id,
                    tool_name: c.tool_name ?? c.name ?? '',
                    tool_code: c.tool_code ?? c.code ?? '',
                    state:     'present' as const
                }));
            });

            // Pre-rellenar "Verificado por" con el nombre del prestatario activo
            if (this.data.id_kit_loan) {
                this.kitsService.getKitLoans(kitId).subscribe(loans => {
                    const loan = loans.find(l => +l.id_kit_loan === +this.data.id_kit_loan);
                    if (loan?.borrower_name) {
                        this.form.get('verified_by_name')?.setValue(loan.borrower_name);
                    }
                });
            }
        }

        this._subs.add(
            this._search$.pipe(
                debounceTime(200),
                distinctUntilChanged(),
                switchMap(term => {
                    if (term.length < 2) { this.suggestions = []; this.showSuggestions = false; return of([]); }
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
            ).subscribe(lista => {
                this.suggestions    = lista;
                this.showSuggestions = lista.length > 0;
            })
        );
    }

    ngOnDestroy(): void { this._subs.unsubscribe(); }

    setState(idx: number, state: 'present' | 'damaged' | 'missing'): void {
        this.compStates[idx] = { ...this.compStates[idx], state };
    }

    onFuncInput(e: Event): void {
        this._search$.next((e.target as HTMLInputElement).value);
    }

    selectFunc(f: any): void {
        this.form.get('verified_by_name')?.setValue(f.nombre ?? f.full_name ?? '');
        this.showSuggestions = false;
        this.suggestions     = [];
    }

    hideSuggestions(): void {
        setTimeout(() => this.showSuggestions = false, 150);
    }

    cerrar(): void { this.dialogRef.close(); }

    onSubmit(): void {
        if (!this.form.valid || this.saving) return;
        this.saving   = true;
        this.errorMsg = '';
        const v = this.form.value;
        this.kitsService.devolverKit({
            id_kit_loan:        this.data.id_kit_loan,
            kit_id:             this.kit.id_kit ?? this.kit.id,
            verified_by_name:   v.verified_by_name,
            is_complete:        this.isComplete,
            missing_components: this.missingList  || undefined,
            damaged_components: this.damagedList  || undefined,
            actions_taken:      v.actions_taken   || undefined,
            notes:              v.notes           || undefined
        }).subscribe({
            next: (res) => {
                this.saving = false;
                this.dialogRef.close({ devuelto: true, kit_status: res.kit_status });
            },
            error: (e) => {
                this.saving   = false;
                this.errorMsg = e?.message ?? 'Error al registrar la devolución';
            }
        });
    }
}
