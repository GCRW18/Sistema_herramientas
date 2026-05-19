import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';

import { MovementService } from '../../../../../core/services/movement.service';
import { Salida, DialogMode } from '../interfaces';

interface Funcionario { id: number; nombre: string; cargo: string; area?: string; }

@Component({
    selector: 'app-form-salida',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatTooltipModule,
        DragDropModule,
    ],
    templateUrl: './form-salida.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ea580c; border-radius: 3px; }
    `]
})
export class FormSalidaComponent implements OnInit, OnDestroy {
    dialogRef        = inject(MatDialogRef<FormSalidaComponent>);
    private fb             = inject(FormBuilder);
    private snackBar       = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private data           = inject<{ mode: DialogMode; salida?: Salida }>(MAT_DIALOG_DATA);

    mode: DialogMode = this.data?.mode ?? 'new';

    private _destroy$        = new Subject<void>();
    private _reqSearch$      = new Subject<string>();
    private _despachadoSearch$ = new Subject<string>();

    // Funcionario solicitante
    funcionarioName            = '';
    funcionarioId: number | null = null;
    funcionarios: Funcionario[] = [];
    funcionarioLoading         = false;
    showFuncionarioDropdown    = false;

    // Funcionario despachado por
    despachadoPorName              = '';
    despachadoPorId: number | null  = null;
    despachadoPorFuncionarios: Funcionario[] = [];
    despachadoPorLoading           = false;
    showDespachadoPorDropdown      = false;

    unidades = ['UND', 'LT', 'KG', 'MTS', 'GAL', 'CAJA', 'ROLLO', 'JUEGO'];

    areas = [
        'MANTENIMIENTO',
        'OPERACIONES',
        'INGENIERÍA',
        'ALMACÉN',
        'ADMINISTRACIÓN',
        'SEGURIDAD OPERACIONAL',
        'COMERCIAL',
        'RAMPA',
        'TRIPULACIÓN CABINA',
        'TRIPULACIÓN TÉCNICA',
        'SISTEMAS / TI',
        'FINANZAS',
        'RECURSOS HUMANOS',
    ];

    form: FormGroup = this.fb.group({
        nroNota:           ['', Validators.required],
        fecha:             [new Date().toISOString().split('T')[0], Validators.required],
        hora:              [new Date().toTimeString().slice(0, 5)],
        nroLicencia:       [''],
        nro:               [''],
        area:              ['', Validators.required],
        codigoNombre:      ['', Validators.required],
        producto:          ['', Validators.required],
        unidad:            ['UND', Validators.required],
        cantidad:          [1,  [Validators.required, Validators.min(1)]],
        stock:             [''],
        ordenTrabajo:      [''],
        buscadorAeronave:  [''],
        buscadorAutorizado:[''],
        observaciones:     [''],
    });

    ngOnInit(): void {
        if (this.data?.salida) {
            this.form.patchValue(this.data.salida);
            const s = this.data.salida;
            if (s.nombre) {
                const apellidos = [s.apellidoPaterno, s.apellidoMaterno].filter(Boolean).join(' ');
                this.funcionarioName = apellidos ? `${s.nombre} ${apellidos}`.trim() : s.nombre;
            }
            if (s.despachadoPor) this.despachadoPorName = s.despachadoPor;
        }
        if (this.readOnly) this.form.disable();
        this._setupFuncionarioSearch();
        this._setupDespachadoSearch();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    private _setupFuncionarioSearch(): void {
        this._reqSearch$.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            switchMap(t => {
                this.funcionarioLoading = true;
                return this.movementService.getFuncionarios(t).pipe(finalize(() => this.funcionarioLoading = false));
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.funcionarios = (res || []).map((f: any) => ({
                id:     f.id_funcionario || f.id,
                nombre: f.nombre_completo || f.nombre,
                cargo:  f.cargo || '',
                area:   f.area  || ''
            }));
            this.showFuncionarioDropdown = this.funcionarios.length > 0;
        });
    }

    private _setupDespachadoSearch(): void {
        this._despachadoSearch$.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            switchMap(t => {
                this.despachadoPorLoading = true;
                return this.movementService.getFuncionarios(t).pipe(finalize(() => this.despachadoPorLoading = false));
            }),
            takeUntil(this._destroy$)
        ).subscribe(res => {
            this.despachadoPorFuncionarios = (res || []).map((f: any) => ({
                id:     f.id_funcionario || f.id,
                nombre: f.nombre_completo || f.nombre,
                cargo:  f.cargo || '',
                area:   f.area  || ''
            }));
            this.showDespachadoPorDropdown = this.despachadoPorFuncionarios.length > 0;
        });
    }

    onFuncionarioInput(v: string): void {
        if (v.length >= 2) this._reqSearch$.next(v);
        else this.showFuncionarioDropdown = false;
    }
    selectFuncionario(f: Funcionario): void {
        this.funcionarioName = f.nombre;
        this.funcionarioId   = f.id;
        this.showFuncionarioDropdown = false;
    }
    hideFuncionarioDropdown(): void { setTimeout(() => this.showFuncionarioDropdown = false, 200); }

    onDespachadoInput(v: string): void {
        if (v.length >= 2) this._despachadoSearch$.next(v);
        else this.showDespachadoPorDropdown = false;
    }
    selectDespachado(f: Funcionario): void {
        this.despachadoPorName = f.nombre;
        this.despachadoPorId   = f.id;
        this.showDespachadoPorDropdown = false;
    }
    hideDespachadoDropdown(): void { setTimeout(() => this.showDespachadoPorDropdown = false, 200); }

    get titulo(): string {
        return this.mode === 'new' ? 'Nueva Salida de Material' : 'Detalle de Salida';
    }
    get subtitulo(): string {
        return this.mode === 'new' ? 'Registro de despacho del almacén' : 'Información de solo lectura';
    }
    get readOnly(): boolean { return this.mode === 'view'; }

    hasError(field: string, error: string): boolean {
        const c = this.form.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    save(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.snackBar.open('Complete los campos requeridos', 'Cerrar', { duration: 2500 });
            return;
        }
        if (!this.funcionarioName.trim()) {
            this.snackBar.open('Seleccione un funcionario solicitante', 'Cerrar', { duration: 2500 });
            return;
        }
        if (!this.despachadoPorName.trim()) {
            this.snackBar.open('Seleccione el funcionario que despacha', 'Cerrar', { duration: 2500 });
            return;
        }
        const v = this.form.getRawValue();
        const out: Partial<Salida> = {
            ...(this.data.salida ?? {}),
            nroNota:           v.nroNota.trim(),
            fecha:             v.fecha,
            hora:              v.hora,
            nroLicencia:       v.nroLicencia?.trim()        || '',
            nro:               v.nro?.trim()                || '',
            nombre:            this.funcionarioName.trim(),
            apellidoPaterno:   '',
            apellidoMaterno:   '',
            area:              v.area,
            despachadoPor:     this.despachadoPorName.trim(),
            codigoNombre:      v.codigoNombre.trim(),
            producto:          v.producto.trim(),
            unidad:            v.unidad,
            cantidad:          Number(v.cantidad),
            stock:             v.stock?.trim()              || undefined,
            ordenTrabajo:      v.ordenTrabajo?.trim()       || undefined,
            buscadorAeronave:  v.buscadorAeronave?.trim()   || undefined,
            buscadorAutorizado:v.buscadorAutorizado?.trim() || undefined,
            observaciones:     v.observaciones?.trim()      || undefined,
        };
        this.dialogRef.close(out);
    }
}
