import { Component, Inject, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize, takeUntil } from 'rxjs/operators';
import { RoleService } from '../../../../../../core/services/role.service';
import { EmployeeService } from '../../../../../../core/services/employee.service';
import { HasPermissionDirective } from '../../../../../../core/directives/has-permission.directive';

/**
 * Ficha de usuario/funcionario — solo lectura para los datos personales/técnicos
 * (patrón módulo Funcionarios: la cuenta de login vive en segu, no se edita aquí).
 * Única acción de escritura: asignar/cambiar el rol del módulo (he.roles), que se
 * guarda como fila espejo en he.tusuarios vinculada por id_usuario.
 */
@Component({
    selector: 'app-ver-usuario',
    standalone: true,
    imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, MatDialogModule, MatSnackBarModule, DragDropModule, HasPermissionDirective],
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
    `],
    template: `
    <div class="bg-stone-100 dark:bg-slate-900 border-2 border-black overflow-hidden flex flex-col w-full"
         style="max-height:90vh">

        <!-- HEADER -->
        <div class="bg-[#0F172A] px-4 sm:px-5 py-3 flex items-center gap-3 shrink-0 select-none flex-wrap sm:flex-nowrap"
             cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragHandle style="cursor:grab">
            <div class="w-8 h-8 rounded bg-amber-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#fbbf24] shrink-0">
                <mat-icon class="!text-base text-black">badge</mat-icon>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-[9px] text-slate-400 font-bold uppercase tracking-[0.15em] leading-none mb-0.5 hidden sm:block">Ficha de Usuario · Solo lectura</p>
                <h2 class="text-xs text-white font-black uppercase tracking-tight leading-none truncate">{{ f.full_name || f.cuenta }}</h2>
            </div>

            <!-- Buscador de técnicos -->
            <div class="relative w-full sm:w-auto sm:shrink-0">
                <input type="text"
                       [value]="buscarTecnicoValue"
                       (input)="onBuscarTecnicoInput($any($event.target).value)"
                       (blur)="hideBuscarTecnicoDropdown()"
                       (focus)="onBuscarTecnicoInput(buscarTecnicoValue)"
                       autocomplete="off"
                       placeholder="Buscar técnico..."
                       class="w-full sm:w-56 md:w-64 h-8 text-xs font-bold border-2 border-white/20 rounded-xl px-3 pr-8 uppercase bg-white/10 text-white placeholder:text-white/40 placeholder:normal-case focus:outline-none focus:border-amber-400 focus:bg-white/20 transition-all">
                <mat-spinner *ngIf="buscarTecnicoLoading" diameter="12" class="absolute right-2 top-2"></mat-spinner>
                <mat-icon *ngIf="!buscarTecnicoLoading" class="absolute right-2 top-1.5 text-white/40 !text-base pointer-events-none">search</mat-icon>

                <!-- Dropdown resultados -->
                <div *ngIf="showBuscarTecnicoDropdown"
                     class="absolute z-[300] w-72 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-600 rounded-xl shadow-[4px_4px_0_#000] max-h-60 overflow-y-auto mt-1 top-full right-0 custom-scrollbar divide-y divide-stone-100 dark:divide-slate-700">
                    <div *ngFor="let t of tecnicosFiltrados"
                         (mousedown)="seleccionarTecnico(t)"
                         class="px-3 py-2 hover:bg-amber-50 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                        <div class="text-[10px] font-black text-black dark:text-white uppercase truncate">{{ t.full_name || t.cuenta }}</div>
                        <div class="text-[9px] font-bold text-stone-400 dark:text-slate-400 uppercase truncate">{{ t.cargo || t.cuenta }}</div>
                    </div>
                    <div *ngIf="!tecnicosFiltrados.length" class="px-3 py-3 text-[9px] text-stone-400 italic text-center">Sin resultados</div>
                </div>
            </div>

            <button type="button" (click)="cerrar()"
                    class="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0">
                <mat-icon class="text-white !text-base">close</mat-icon>
            </button>
        </div>

        <!-- BODY: foto + campos, mismo layout que detalle-herramienta -->
        <div class="flex-1 overflow-hidden">
            <div class="h-full flex flex-col sm:flex-row overflow-hidden min-h-0">

                <!-- ── COLUMNA IZQUIERDA: Foto/Avatar ── -->
                <div class="w-full sm:w-2/5 shrink-0 flex flex-col items-center justify-center px-4 py-4 gap-3">

                    <div class="w-56 h-56 sm:w-64 sm:h-64 border-2 border-dashed border-stone-300 dark:border-slate-600 rounded-xl bg-stone-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-2 shrink-0">
                        <div class="w-24 h-24 rounded-2xl bg-amber-400 border-2 border-black flex items-center justify-center shadow-[3px_3px_0_#000] shrink-0">
                            <mat-icon class="!text-4xl text-black">engineering</mat-icon>
                        </div>
                        <h2 class="text-black dark:text-white font-black text-sm uppercase tracking-tight leading-tight text-center break-words px-3">{{ f.full_name || f.cuenta }}</h2>
                        <p class="text-amber-600 dark:text-amber-400 font-black font-mono text-[10px] text-center break-all">{{ f.cuenta }}</p>
                    </div>
                </div>

                <!-- ── COLUMNA DERECHA: Campos ── -->
                <div class="flex-1 min-w-0 overflow-y-auto custom-scrollbar px-4 py-3 flex flex-col gap-2">

                    <!-- Fila 1: Cuenta · CI · Cód. Funcionario -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Cuenta</label>
                            <input type="text" readonly [value]="f.cuenta || '—'"
                                   class="w-full h-8 text-xs font-black uppercase bg-stone-100 dark:bg-slate-700 dark:text-slate-300 border-2 border-stone-200 dark:border-slate-600 rounded-lg px-2.5 outline-none cursor-not-allowed">
                        </div>
                        <div>
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">CI</label>
                            <input type="text" readonly [value]="f.ci || '—'"
                                   class="w-full h-8 text-xs font-black uppercase bg-stone-100 dark:bg-slate-700 dark:text-slate-300 border-2 border-stone-200 dark:border-slate-600 rounded-lg px-2.5 outline-none cursor-not-allowed">
                        </div>
                        <div>
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Cód. Funcionario</label>
                            <input type="text" readonly [value]="f.codigo_funcionario || '—'"
                                   class="w-full h-8 text-xs font-black uppercase bg-stone-100 dark:bg-slate-700 dark:text-slate-300 border-2 border-stone-200 dark:border-slate-600 rounded-lg px-2.5 outline-none cursor-not-allowed">
                        </div>
                    </div>

                    <!-- Fila 2: Nombre completo -->
                    <div>
                        <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Nombre Completo</label>
                        <input type="text" readonly [value]="f.full_name || f.cuenta || '—'"
                               class="w-full h-8 text-xs font-bold bg-stone-100 dark:bg-slate-700 dark:text-slate-300 border-2 border-stone-200 dark:border-slate-600 rounded-lg px-2.5 outline-none cursor-not-allowed">
                    </div>

                    <!-- Fila 3: Cargo · Tipo · Área -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Cargo</label>
                            <input type="text" readonly [value]="f.cargo || '—'"
                                   class="w-full h-8 text-xs font-bold uppercase bg-stone-100 dark:bg-slate-700 dark:text-slate-300 border-2 border-stone-200 dark:border-slate-600 rounded-lg px-2.5 outline-none cursor-not-allowed">
                        </div>
                        <div>
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Tipo</label>
                            <input type="text" readonly [value]="f.employee_type || '—'"
                                   class="w-full h-8 text-xs font-bold uppercase bg-stone-100 dark:bg-slate-700 dark:text-slate-300 border-2 border-stone-200 dark:border-slate-600 rounded-lg px-2.5 outline-none cursor-not-allowed">
                        </div>
                        <div>
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Área</label>
                            <input type="text" readonly [value]="f.area || '—'"
                                   class="w-full h-8 text-xs font-bold uppercase bg-stone-100 dark:bg-slate-700 dark:text-slate-300 border-2 border-stone-200 dark:border-slate-600 rounded-lg px-2.5 outline-none cursor-not-allowed">
                        </div>
                    </div>

                    <!-- Fila 4: Licencia · Sello · Base -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Licencia</label>
                            <input type="text" readonly [value]="f.license_number || '—'"
                                   class="w-full h-8 text-xs font-black uppercase bg-stone-100 dark:bg-slate-700 dark:text-slate-300 border-2 border-stone-200 dark:border-slate-600 rounded-lg px-2.5 outline-none cursor-not-allowed">
                        </div>
                        <div>
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Sello</label>
                            <input type="text" readonly [value]="f.seal_number || '—'"
                                   class="w-full h-8 text-xs font-black uppercase bg-stone-100 dark:bg-slate-700 dark:text-slate-300 border-2 border-stone-200 dark:border-slate-600 rounded-lg px-2.5 outline-none cursor-not-allowed">
                        </div>
                        <div>
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Base</label>
                            <input type="text" readonly [value]="f.base_name || f.base_code || '—'"
                                   class="w-full h-8 text-xs font-bold uppercase bg-stone-100 dark:bg-slate-700 dark:text-slate-300 border-2 border-stone-200 dark:border-slate-600 rounded-lg px-2.5 outline-none cursor-not-allowed">
                        </div>
                    </div>

                    <!-- Fila 5: Teléfono · Email -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Teléfono</label>
                            <input type="text" readonly [value]="f.phone || f.telefono_ofi || '—'"
                                   class="w-full h-8 text-xs font-bold bg-stone-100 dark:bg-slate-700 dark:text-slate-300 border-2 border-stone-200 dark:border-slate-600 rounded-lg px-2.5 outline-none cursor-not-allowed">
                        </div>
                        <div>
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Email</label>
                            <input type="text" readonly [value]="f.email_empresa || f.email_personal || '—'"
                                   class="w-full h-8 text-xs font-bold bg-stone-100 dark:bg-slate-700 dark:text-slate-300 border-2 border-stone-200 dark:border-slate-600 rounded-lg px-2.5 outline-none cursor-not-allowed">
                        </div>
                    </div>

                    <!-- Rol del módulo -->
                    <div>
                        <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-1 block">Rol del Módulo</label>
                        <div class="bg-white dark:bg-slate-800 border-2 border-black rounded-xl p-3 flex items-center gap-2.5 shadow-[2px_2px_0_#000]">
                            <mat-icon class="!text-lg text-[#7113CF] shrink-0">shield</mat-icon>
                            <select [(ngModel)]="selectedRoleId" [disabled]="loadingRoles"
                                    class="flex-1 h-9 min-w-0 text-xs font-bold bg-stone-100 dark:bg-slate-700 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 outline-none focus:border-black">
                                <option [ngValue]="null">Sin rol asignado</option>
                                <option *ngFor="let r of roles" [ngValue]="r.id_role">{{ r.name }}</option>
                            </select>
                            <button *appHasPermission="'admin_usuarios.assign_role'" type="button" (click)="guardarRol()" [disabled]="guardandoRol || loadingRoles"
                                    class="shrink-0 px-3 h-9 bg-[#FFC501FF] text-black font-black text-[10px] uppercase border-2 border-black rounded-lg shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-40">
                                {{ guardandoRol ? 'Guardando…' : 'Guardar' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="border-t-2 border-black bg-stone-200 dark:bg-slate-800 px-4 py-2 flex justify-end shrink-0">
            <button type="button" (click)="cerrar()"
                    class="flex items-center gap-1 px-3 py-1.5 bg-[#0F172A] text-white font-black text-[10px] border-2 border-black rounded-lg shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all uppercase">
                <mat-icon class="!text-xs">close</mat-icon>Cerrar
            </button>
        </div>
    </div>
    `,
})
export class VerUsuarioComponent implements OnInit, OnDestroy {
    f: any;

    private roleSvc     = inject(RoleService);
    private employeeSvc = inject(EmployeeService);
    private snackBar    = inject(MatSnackBar);
    private _destroy$   = new Subject<void>();

    // Filas crudas de herramientas/roles/listarRoles (id_role, name, ...) — no coinciden
    // con el shape del interface Role (id/name), por eso van sin tipar como RolesComponent
    // hace también con su propio mapeo local.
    roles: any[] = [];
    loadingRoles  = false;
    guardandoRol  = false;
    // string, no number: así vienen los id_role del backend (PHP serializa enteros de
    // Postgres como string) y así quedan las [ngValue] de las <option> — si no coinciden
    // los tipos, Angular nunca marca ninguna opción como seleccionada.
    selectedRoleId: string | null = null;

    // ── Buscador de técnicos (header) — permite cambiar de ficha sin cerrar el diálogo ──
    buscarTecnicoValue         = '';
    buscarTecnicoLoading       = false;
    showBuscarTecnicoDropdown  = false;
    tecnicosFiltrados: any[]   = [];
    private _buscarTecnico$    = new Subject<string>();

    constructor(
        private dialogRef: MatDialogRef<VerUsuarioComponent>,
        @Inject(MAT_DIALOG_DATA) data: { funcionario: any }
    ) {
        this.f = data.funcionario || {};
    }

    ngOnInit(): void {
        this._cargarRolDeFicha();
        this._setupBuscarTecnico();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    /** Carga la lista de roles (una vez) y el rol asignado a la ficha actual (this.f). */
    private _cargarRolDeFicha(): void {
        if (!this.f.id_usuario) return;
        this.loadingRoles = true;
        this.selectedRoleId = null;
        const idUsuario = this.f.id_usuario;
        const cargarAsignacion = () => {
            this.roleSvc.getUserRoleAssignment(idUsuario).subscribe({
                next: (res) => {
                    this.selectedRoleId = res.id_role;
                    this.loadingRoles = false;
                },
                error: () => { this.loadingRoles = false; }
            });
        };
        if (this.roles.length) { cargarAsignacion(); return; }
        this.roleSvc.getRoles().subscribe({
            next: (rows: any[]) => {
                this.roles = rows || [];
                cargarAsignacion();
            },
            error: () => { this.loadingRoles = false; }
        });
    }

    /** Búsqueda en vivo de técnicos/funcionarios (herramientas/employees/listarFuncionarios),
     *  mismo mecanismo que los buscadores de herramienta/persona del resto del sistema. */
    private _setupBuscarTecnico(): void {
        this._buscarTecnico$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                const q = term.trim();
                if (q.length < 2) { this.showBuscarTecnicoDropdown = false; return of([]); }
                this.buscarTecnicoLoading = true;
                return this.employeeSvc.getFuncionarios({ search: q }).pipe(
                    catchError(() => of([])),
                    finalize(() => this.buscarTecnicoLoading = false)
                );
            }),
            takeUntil(this._destroy$)
        ).subscribe((tecnicos: any[]) => {
            this.tecnicosFiltrados = (tecnicos || []).slice(0, 8);
            this.showBuscarTecnicoDropdown = this.tecnicosFiltrados.length > 0;
        });
    }

    onBuscarTecnicoInput(value: string): void {
        this.buscarTecnicoValue = value;
        this._buscarTecnico$.next(value);
    }

    hideBuscarTecnicoDropdown(): void {
        setTimeout(() => { this.showBuscarTecnicoDropdown = false; }, 200);
    }

    /** Cambia la ficha mostrada al técnico elegido en el buscador, sin cerrar el diálogo. */
    seleccionarTecnico(t: any): void {
        this.f = t;
        this.buscarTecnicoValue        = '';
        this.tecnicosFiltrados         = [];
        this.showBuscarTecnicoDropdown = false;
        // this.roles (lista de roles del módulo) no depende de la ficha, se reusa;
        // solo se recarga cuál rol tiene asignado esta nueva ficha.
        this._cargarRolDeFicha();
    }

    guardarRol(): void {
        if (!this.f.id_usuario || this.guardandoRol) return;
        this.guardandoRol = true;
        this.roleSvc.assignRoleToUser({
            idUsuario: this.f.id_usuario,
            idRole:    this.selectedRoleId,
            username:  this.f.cuenta || '',
            nombres:   this.f.first_name || '',
            apellidos: [this.f.paternal_last_name, this.f.maternal_last_name].filter(Boolean).join(' '),
            email:     this.f.email_empresa || this.f.email_personal || ''
        }).subscribe({
            next: () => {
                this.guardandoRol = false;
                this.snackBar.open('Rol actualizado', 'Cerrar', { duration: 2500 });
            },
            error: (err: any) => {
                this.guardandoRol = false;
                this.snackBar.open(err?.message || 'Error al asignar el rol', 'Cerrar', { duration: 4000 });
            }
        });
    }

    cerrar(): void {
        this.dialogRef.close();
    }
}
