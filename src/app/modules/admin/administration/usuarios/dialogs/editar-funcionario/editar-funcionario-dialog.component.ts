import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { EmployeeService, EmployeeUpsertData } from '../../../../../../core/services/employee.service';

/** Tipos/áreas tal cual los CHECK constraints de he.temployees (patch000001.sql) — no la
 *  interfaz Employee vieja de employee.types, que no incluye "Almacenero"/"ALMACEN". */
const TIPOS_EMPLEADO = ['Tecnico MM I', 'Tecnico MM II', 'Inspector', 'Supervisor', 'Jefe de Linea', 'Jefe de Mantenimiento', 'Almacenero'];
const AREAS_EMPLEADO = ['LINEA', 'MANTENIMIENTO', 'CENTRO CONTROL', 'AVIONICOS', 'ESTRUCTURAS', 'MOTORES', 'ALMACEN'];

/**
 * Alta/edición de los datos propios de Herramientas (he.temployees) para un funcionario
 * que ya existe en el ERP (segu.tusuario). Se abre desde "Ver Usuario" — data.funcionario
 * trae lo que ya devuelve listarFuncionarios (id_usuario siempre; id_employee solo si ya
 * tiene fila en he.temployees, en cuyo caso esto es edición, no alta).
 */
@Component({
    selector: 'app-editar-funcionario-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatDialogModule, MatSnackBarModule],
    template: `
    <div class="bg-stone-100 dark:bg-slate-900 border-2 border-black overflow-hidden flex flex-col w-full" style="max-height:90vh">

        <div class="bg-[#0F172A] px-4 py-3 flex items-center gap-3 shrink-0">
            <div class="w-8 h-8 rounded bg-amber-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#fbbf24] shrink-0">
                <mat-icon class="!text-base text-black">badge</mat-icon>
            </div>
            <div class="min-w-0">
                <p class="text-[9px] text-slate-400 font-bold uppercase tracking-[0.15em] leading-none mb-0.5">
                    {{ esEdicion ? 'Editar Datos de Herramientas' : 'Alta en Herramientas' }}
                </p>
                <h2 class="text-xs text-white font-black uppercase tracking-tight leading-none truncate">{{ f.full_name || f.cuenta }}</h2>
            </div>
            <button type="button" (click)="cerrar()" class="ml-auto w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0">
                <mat-icon class="text-white !text-base">close</mat-icon>
            </button>
        </div>

        <form [formGroup]="form" class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">

            <p class="text-[10px] font-bold text-stone-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-xl px-3 py-2">
                Estos datos son específicos de Herramientas (licencia, cargo, área) y no existen en el resto del ERP —
                por eso hay que cargarlos aquí una vez por funcionario.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                    <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Nro. Licencia <span class="text-red-500">*</span></label>
                    <input formControlName="license_number" type="text"
                           class="w-full h-8 text-xs font-bold uppercase bg-white dark:bg-slate-800 dark:text-white border-2 rounded-lg px-2.5 outline-none"
                           [ngClass]="hasError('license_number','required') ? 'border-red-500' : 'border-stone-300 dark:border-slate-600 focus:border-black'">
                    <p *ngIf="hasError('license_number','required')" class="text-[9px] text-red-500 font-black mt-1">Requerido</p>
                </div>
                <div>
                    <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Nro. Sello</label>
                    <input formControlName="seal_number" type="text"
                           class="w-full h-8 text-xs font-bold uppercase bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2.5 outline-none focus:border-black">
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                    <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">CI</label>
                    <input formControlName="ci" type="text"
                           class="w-full h-8 text-xs font-bold uppercase bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2.5 outline-none focus:border-black">
                </div>
                <div>
                    <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Cargo</label>
                    <input formControlName="cargo" type="text"
                           class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2.5 outline-none focus:border-black">
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                    <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Tipo</label>
                    <select formControlName="employee_type"
                            class="w-full h-8 px-2.5 bg-white dark:bg-slate-800 text-black dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg text-xs font-bold outline-none cursor-pointer appearance-none">
                        <option value="">— Sin definir —</option>
                        <option *ngFor="let t of tiposEmpleado" [value]="t">{{ t }}</option>
                    </select>
                </div>
                <div>
                    <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Área</label>
                    <select formControlName="area"
                            class="w-full h-8 px-2.5 bg-white dark:bg-slate-800 text-black dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg text-xs font-bold outline-none cursor-pointer appearance-none">
                        <option value="">— Sin definir —</option>
                        <option *ngFor="let a of areasEmpleado" [value]="a">{{ a }}</option>
                    </select>
                </div>
            </div>

            <div>
                <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 flex items-center gap-1">
                    Base
                    <span *ngIf="loadingBases" class="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin inline-block"></span>
                </label>
                <select formControlName="id_lugar"
                        class="w-full h-8 px-2.5 bg-white dark:bg-slate-800 text-black dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg text-xs font-bold outline-none cursor-pointer appearance-none">
                    <option [ngValue]="null">— Sin definir —</option>
                    <option *ngFor="let b of bases" [ngValue]="b.id_lugar">{{ b.nombre }}{{ b.codigo ? ' (' + b.codigo + ')' : '' }}</option>
                </select>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                    <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Email</label>
                    <input formControlName="email" type="email"
                           class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2.5 outline-none focus:border-black">
                </div>
                <div>
                    <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Teléfono</label>
                    <input formControlName="phone" type="text"
                           class="w-full h-8 text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2.5 outline-none focus:border-black">
                </div>
            </div>

            <label class="h-8 flex items-center gap-2 px-3 bg-white dark:bg-slate-800 border-2 border-stone-300 dark:border-slate-600 rounded-lg cursor-pointer w-fit">
                <input type="checkbox" formControlName="active" class="w-4 h-4">
                <span class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400">Activo</span>
            </label>
        </form>

        <div class="border-t-2 border-black bg-stone-200 dark:bg-slate-800 px-4 py-2 flex justify-between items-center shrink-0">
            <button type="button" (click)="cerrar()"
                    class="flex items-center gap-1 px-3 py-1.5 bg-[#FF1414] text-white font-black text-[10px] uppercase border-2 border-black rounded-lg shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
                <mat-icon class="!text-xs">close</mat-icon>Cancelar
            </button>
            <button type="button" (click)="guardar()" [disabled]="isSaving"
                    class="flex items-center gap-1 px-3 py-1.5 bg-amber-400 text-black font-black text-[10px] uppercase border-2 border-black rounded-lg shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-40">
                <mat-icon class="!text-xs">save</mat-icon>{{ isSaving ? 'Guardando…' : 'Guardar' }}
            </button>
        </div>
    </div>
    `,
})
export class EditarFuncionarioDialogComponent implements OnInit {
    f: any;
    form!: FormGroup;
    isSaving = false;
    loadingBases = false;
    bases: any[] = [];
    tiposEmpleado = TIPOS_EMPLEADO;
    areasEmpleado = AREAS_EMPLEADO;

    private fb          = inject(FormBuilder);
    private employeeSvc = inject(EmployeeService);
    private snackBar    = inject(MatSnackBar);

    get esEdicion(): boolean { return !!this.f?.id_employee; }

    constructor(
        private dialogRef: MatDialogRef<EditarFuncionarioDialogComponent>,
        @Inject(MAT_DIALOG_DATA) data: { funcionario: any }
    ) {
        this.f = data.funcionario || {};
    }

    ngOnInit(): void {
        this.form = this.fb.group({
            license_number: [this.f.license_number || '', Validators.required],
            seal_number:    [this.f.seal_number || ''],
            ci:              [this.f.ci || ''],
            cargo:           [this.f.cargo || ''],
            employee_type:   [this.f.employee_type || ''],
            area:            [this.f.area || ''],
            id_lugar:        [null],
            email:           [this.f.email_personal || ''],
            phone:           [this.f.phone || ''],
            active:          [this.f.active !== false],
        });
        this._cargarBases();
    }

    private _cargarBases(): void {
        this.loadingBases = true;
        this.employeeSvc.getBases().subscribe({
            next: (rows: any[]) => {
                this.bases = (rows || []).map((b: any) => ({
                    id_lugar: b.id_lugar ?? b.id,
                    codigo:   b.codigo ?? b.code ?? '',
                    nombre:   b.nombre ?? b.name ?? ''
                }));
                // he.ft_funcionarios_segu_sel no devuelve id_lugar (solo el codigo/nombre ya
                // resuelto), asi que solo se puede pre-seleccionar por coincidencia de codigo.
                if (this.f.base_code) {
                    const match = this.bases.find(b => (b.codigo || '').toUpperCase() === (this.f.base_code || '').toUpperCase());
                    if (match) this.form.patchValue({ id_lugar: match.id_lugar }, { emitEvent: false });
                }
                this.loadingBases = false;
            },
            error: () => { this.loadingBases = false; }
        });
    }

    hasError(field: string, error: string): boolean {
        const c = this.form.get(field);
        return c ? c.hasError(error) && c.touched : false;
    }

    guardar(): void {
        this.form.markAllAsTouched();
        if (this.form.invalid) {
            this.snackBar.open('Complete los campos requeridos', 'OK', { duration: 3500 });
            return;
        }
        if (!this.f.id_usuario) {
            this.snackBar.open('No se pudo identificar al usuario (falta id_usuario)', 'OK', { duration: 4000 });
            return;
        }
        this.isSaving = true;
        const v = this.form.getRawValue();
        const payload: EmployeeUpsertData = {
            employee_id:    this.f.id_usuario,
            id_lugar:       v.id_lugar,
            license_number: (v.license_number || '').trim(),
            seal_number:    v.seal_number || '',
            ci:              v.ci || '',
            cargo:           v.cargo || '',
            role:            this.f.role || 'tecnico',
            employee_type:   v.employee_type || '',
            area:            v.area || '',
            email:           v.email || '',
            phone:           v.phone || '',
            active:          !!v.active,
        };
        const req$ = this.esEdicion
            ? this.employeeSvc.updateEmployee(this.f.id_employee, payload)
            : this.employeeSvc.createEmployee(payload);

        req$.subscribe({
            next: () => {
                this.isSaving = false;
                this.snackBar.open(this.esEdicion ? 'Datos actualizados' : 'Funcionario dado de alta en Herramientas', 'OK', { duration: 3000 });
                this.dialogRef.close({ success: true, ...payload });
            },
            error: (err: any) => {
                this.isSaving = false;
                const msg = err?.message || '';
                const esDuplicado = /license_number|duplicate key|ya existe/i.test(msg);
                this.snackBar.open(
                    esDuplicado ? 'Ese número de licencia ya está en uso por otro funcionario' : (msg || 'Error al guardar'),
                    'OK', { duration: 4500 }
                );
            }
        });
    }

    cerrar(): void { this.dialogRef.close(); }
}
