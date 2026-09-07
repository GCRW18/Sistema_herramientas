import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap, map, finalize, catchError } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service';

export interface DatosAjusteData {
    form: FormGroup;
}

@Component({
    selector: 'app-datos-ajuste',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule,
        MatIconModule, MatTooltipModule, DragDropModule,
    ],
    templateUrl: './datos-ajuste.component.html',
    styles: [`
        :host { display: block; width: 100%; height: 100%; }
        .custom-scrollbar-ing::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ing::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ing::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
    `]
})
export class DatosAjusteComponent implements OnInit, OnDestroy {
    public  dialogRef = inject(MatDialogRef<DatosAjusteComponent>, { optional: true });
    public  data      = inject<DatosAjusteData>(MAT_DIALOG_DATA, { optional: true });
    private movementSvc = inject(MovementService);
    private destroy$  = new Subject<void>();

    ajusteForm!: FormGroup;

    tiposAjuste = [
        { value: 'INVENTARIO',  label: 'Ajuste Inventario',  color: 'bg-blue-100 text-blue-800 border-blue-400',      icon: 'inventory_2'   },
        { value: 'REUBICACION', label: 'Reubicación',        color: 'bg-purple-100 text-purple-800 border-purple-400', icon: 'swap_horiz'    },
        { value: 'DONACION',    label: 'Donación Recibida',  color: 'bg-green-100 text-green-800 border-green-400',    icon: 'card_giftcard' },
        { value: 'ENCONTRADO',  label: 'Item Encontrado',    color: 'bg-amber-100 text-amber-800 border-amber-400',    icon: 'search'        },
        { value: 'SOBRANTE',    label: 'Sobrante',           color: 'bg-cyan-100 text-cyan-800 border-cyan-400',       icon: 'add_box'       },
        { value: 'CORRECCION',  label: 'Corrección Sistema', color: 'bg-red-100 text-red-800 border-red-400',          icon: 'build'         }
    ];

    _realizadoPorSearch$ = new Subject<string>();
    realizadoPorFiltrados: { id: string; nombre: string; cargo: string }[] = [];
    realizadoPorLoading   = false;
    showRealizadoPorDropdown = false;

    _aprobadoPorSearch$ = new Subject<string>();
    aprobadoPorFiltrados: { id: string; nombre: string; cargo: string }[] = [];
    aprobadoPorLoading   = false;
    showAprobadoPorDropdown = false;

    ngOnInit(): void {
        this.ajusteForm = this.data!.form;

        this._crearBuscadorFuncionario(
            this._realizadoPorSearch$,
            v => this.realizadoPorLoading = v,
            v => this.realizadoPorFiltrados = v,
            v => this.showRealizadoPorDropdown = v
        );
        this._crearBuscadorFuncionario(
            this._aprobadoPorSearch$,
            v => this.aprobadoPorLoading = v,
            v => this.aprobadoPorFiltrados = v,
            v => this.showAprobadoPorDropdown = v
        );

        if (!this.ajusteForm.get('documento')?.value) {
            this.generarDocumento();
        }

        // Prellena "Realizado Por" con el usuario logueado (editable) si viene vacío.
        if (!this.ajusteForm.get('realizadoPor')?.value) {
            const currentUser = this._currentUserName();
            if (currentUser) this.ajusteForm.patchValue({ realizadoPor: currentUser, realizadoPorInput: currentUser });
        }
    }

    private _currentUserName(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || '';
        } catch { return ''; }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private _crearBuscadorFuncionario(
        search$: Subject<string>,
        setLoading: (v: boolean) => void,
        setItems:   (v: any[])   => void,
        setShow:    (v: boolean) => void
    ): void {
        search$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { setShow(false); return of([]); }
                setLoading(true);
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({
                            id:     String(f.id_employee || f.id),
                            nombre: f.nombreCompleto || `${f.nombre || ''} ${f.apellido_paterno || ''}`.trim(),
                            cargo:  f.cargo || ''
                        }))),
                    finalize(() => setLoading(false)),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { setItems(res || []); setShow((res || []).length > 0); });
    }

    generarDocumento(): void {
        const tipo = this.ajusteForm.get('tipoAjuste')?.value;
        const prefijos: { [k: string]: string } = {
            'INVENTARIO': 'AI', 'REUBICACION': 'REUB', 'DONACION': 'DON',
            'ENCONTRADO': 'AJU', 'SOBRANTE': 'SOB', 'CORRECCION': 'CORR'
        };
        const prefijo = prefijos[tipo] || 'AI';
        this.movementSvc.getSiguienteCorrelativoPreview(prefijo)
            .pipe(takeUntil(this.destroy$))
            .subscribe(num => this.ajusteForm.patchValue({ documento: num }));
    }

    onRealizadoPorInput(val: string): void {
        this.ajusteForm.patchValue({ realizadoPorInput: val });
        this._realizadoPorSearch$.next(val);
    }

    selectRealizadoPor(f: { id: string; nombre: string; cargo: string }): void {
        this.ajusteForm.patchValue({ realizadoPor: f.nombre, realizadoPorInput: f.nombre });
        this.showRealizadoPorDropdown = false;
    }

    hideRealizadoPorDropdown(): void { setTimeout(() => this.showRealizadoPorDropdown = false, 150); }

    onAprobadoPorInput(val: string): void {
        this.ajusteForm.patchValue({ aprobadoPorInput: val });
        this._aprobadoPorSearch$.next(val);
    }

    selectAprobador(f: { id: string; nombre: string; cargo: string }): void {
        this.ajusteForm.patchValue({ aprobadoPor: f.nombre, aprobadoPorInput: f.nombre });
        this.showAprobadoPorDropdown = false;
    }

    hideAprobadoPorDropdown(): void { setTimeout(() => this.showAprobadoPorDropdown = false, 150); }

    getTipoAjusteLabel(tipo: string): string {
        return this.tiposAjuste.find(t => t.value === tipo)?.label || tipo;
    }

    hasAjusteError(field: string, error: string): boolean {
        const c = this.ajusteForm.get(field);
        return !!(c?.hasError(error) && c?.touched);
    }

    cerrarModalDatosAjuste(): void { this.dialogRef?.close(); }
}
