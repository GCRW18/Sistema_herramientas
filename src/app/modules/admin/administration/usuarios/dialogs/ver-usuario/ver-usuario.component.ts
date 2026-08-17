import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { RoleService } from '../../../../../../core/services/role.service';
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
    imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule, MatSnackBarModule, HasPermissionDirective],
    template: `
    <div class="bg-stone-100 dark:bg-slate-900 border-2 border-black rounded-2xl overflow-hidden flex flex-col"
         style="width:100%; max-height:90vh">

        <!-- Cuerpo: sidebar de perfil + panel de datos -->
        <div class="flex-1 flex min-h-0">

            <!-- ═══ SIDEBAR · Perfil ═══ -->
            <div class="w-56 shrink-0 bg-[#0F172A] px-5 py-6 flex flex-col items-center gap-1 overflow-y-auto border-r-2 border-black">
                <div class="w-16 h-16 rounded-2xl bg-amber-400 border-2 border-black flex items-center justify-center shadow-[3px_3px_0_#000] shrink-0 mb-3">
                    <span class="text-black font-black text-lg">{{ iniciales }}</span>
                </div>
                <h2 class="text-white font-black text-sm uppercase tracking-tight leading-tight text-center break-words">{{ f.full_name || f.cuenta }}</h2>
                <p class="text-amber-400 font-black font-mono text-[10px] text-center break-all">{{ f.cuenta }}</p>

                <div class="w-full h-px bg-white/10 my-3"></div>

                <div class="w-full flex flex-col gap-1.5">
                    <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border-2 border-black shadow-[1px_1px_0_#000]"
                         [ngClass]="f.active ? 'bg-green-600' : 'bg-white/10'">
                        <mat-icon class="!text-sm text-white shrink-0">{{ f.active ? 'check_circle' : 'cancel' }}</mat-icon>
                        <span class="text-[9px] font-black uppercase text-white truncate">{{ f.active ? 'Activo' : 'Inactivo' }}</span>
                    </div>
                    <div *ngIf="f.license_number" class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-900 border-2 border-black shadow-[1px_1px_0_#000]">
                        <mat-icon class="!text-sm text-white shrink-0">badge</mat-icon>
                        <span class="text-[9px] font-black uppercase text-white truncate">Lic. {{ f.license_number }}</span>
                    </div>
                    <div *ngIf="f.base_code" class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-400 border-2 border-black shadow-[1px_1px_0_#000]">
                        <mat-icon class="!text-sm text-black shrink-0">flight_takeoff</mat-icon>
                        <span class="text-[9px] font-black uppercase text-black truncate">{{ f.base_name || f.base_code }}</span>
                    </div>
                    <div *ngIf="!f.id_employee" class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border-2 border-dashed border-white/20">
                        <mat-icon class="!text-sm text-slate-400 shrink-0">info</mat-icon>
                        <span class="text-[9px] font-black uppercase text-slate-400 truncate">Sin registro técnico</span>
                    </div>
                </div>
            </div>

            <!-- ═══ PANEL · Datos ═══ -->
            <div class="flex-1 min-w-0 flex flex-col">

                <!-- Barra superior -->
                <div class="px-4 py-2.5 bg-white dark:bg-slate-800 border-b-2 border-black flex items-center justify-between shrink-0">
                    <p class="text-[8px] font-black uppercase tracking-[0.2em] text-stone-400 dark:text-slate-400">Ficha de Usuario</p>
                    <button type="button" (click)="cerrar()"
                            class="w-7 h-7 flex items-center justify-center rounded-lg bg-stone-100 dark:bg-slate-700 hover:bg-stone-200 dark:hover:bg-slate-600 transition-colors border border-stone-300 dark:border-slate-600 shrink-0">
                        <mat-icon class="text-stone-500 dark:text-slate-300 !text-base">close</mat-icon>
                    </button>
                </div>

                <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

                    <!-- Datos técnicos + personales lado a lado, en formato ficha -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">

                        <div class="bg-white dark:bg-slate-800 border-2 border-black rounded-xl shadow-[2px_2px_0_#000] overflow-hidden">
                            <p class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 px-3 pt-2.5 pb-1.5">Información Técnica</p>
                            <div class="px-3 pb-1">
                                <div *ngFor="let c of cardsTecnicos; trackBy: trackByLabel"
                                     class="flex items-center justify-between gap-2 py-1.5 border-t border-stone-100 dark:border-slate-700">
                                    <span class="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-500 shrink-0">
                                        <mat-icon class="!text-sm text-amber-500 shrink-0">{{ c.icon }}</mat-icon>
                                        {{ c.label }}
                                    </span>
                                    <span class="text-[11px] font-black text-black dark:text-white text-right truncate">{{ c.value || '—' }}</span>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white dark:bg-slate-800 border-2 border-black rounded-xl shadow-[2px_2px_0_#000] overflow-hidden">
                            <p class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 px-3 pt-2.5 pb-1.5">Datos Personales</p>
                            <div class="px-3 pb-1">
                                <div *ngFor="let c of cardsPersonales; trackBy: trackByLabel"
                                     class="flex items-center justify-between gap-2 py-1.5 border-t border-stone-100 dark:border-slate-700">
                                    <span class="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-500 shrink-0">
                                        <mat-icon class="!text-sm text-amber-500 shrink-0">{{ c.icon }}</mat-icon>
                                        {{ c.label }}
                                    </span>
                                    <span class="text-[11px] font-black text-black dark:text-white text-right truncate">{{ c.value || '—' }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Rol del módulo -->
                    <div>
                        <p class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-1.5">Rol del Módulo</p>
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
        <div class="border-t-2 border-black bg-stone-200 dark:bg-slate-800 px-4 py-2.5 flex justify-end shrink-0">
            <button type="button" (click)="cerrar()"
                    class="px-5 py-2 bg-[#0F172A] text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all uppercase">
                Cerrar
            </button>
        </div>
    </div>
    `,
})
export class VerUsuarioComponent implements OnInit {
    f: any;

    private roleSvc  = inject(RoleService);
    private snackBar = inject(MatSnackBar);

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

    constructor(
        private dialogRef: MatDialogRef<VerUsuarioComponent>,
        @Inject(MAT_DIALOG_DATA) data: { funcionario: any }
    ) {
        this.f = data.funcionario || {};
    }

    ngOnInit(): void {
        if (!this.f.id_usuario) return;
        this.loadingRoles = true;
        this.roleSvc.getRoles().subscribe({
            next: (rows: any[]) => {
                this.roles = rows || [];
                this.roleSvc.getUserRoleAssignment(this.f.id_usuario).subscribe({
                    next: (res) => {
                        this.selectedRoleId = res.id_role;
                        this.loadingRoles = false;
                    },
                    error: () => { this.loadingRoles = false; }
                });
            },
            error: () => { this.loadingRoles = false; }
        });
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
            error: () => {
                this.guardandoRol = false;
                this.snackBar.open('Error al asignar el rol', 'Cerrar', { duration: 4000 });
            }
        });
    }

    get iniciales(): string {
        const palabras = (this.f.full_name || this.f.cuenta || '?').trim().split(/\s+/);
        return palabras.slice(0, 2).map((p: string) => p.charAt(0).toUpperCase()).join('');
    }

    /* trackBy — cardsTecnicos/cardsPersonales arman objetos nuevos en cada
       llamada; sin esto el *ngFor los recrearía en cada CD (mismo origen del
       congelamiento de Misceláneos). */
    trackByLabel = (_: number, c: { label: string }): string => c.label;

    get cardsTecnicos(): { icon: string; label: string; value: string | null }[] {
        return [
            { icon: 'badge',          label: 'Licencia',  value: this.f.license_number },
            { icon: 'verified',       label: 'Sello',     value: this.f.seal_number },
            { icon: 'engineering',    label: 'Tipo',      value: this.f.employee_type },
            { icon: 'work',           label: 'Cargo',     value: this.f.cargo },
            { icon: 'apartment',      label: 'Área',      value: this.f.area },
            { icon: 'flight_takeoff', label: 'Base',      value: this.f.base_name || this.f.base_code },
        ];
    }

    get cardsPersonales(): { icon: string; label: string; value: string | null }[] {
        return [
            { icon: 'fingerprint', label: 'CI',            value: this.f.ci },
            { icon: 'person',      label: 'Ap. Paterno',   value: this.f.paternal_last_name },
            { icon: 'person',      label: 'Ap. Materno',   value: this.f.maternal_last_name },
            { icon: 'call',        label: 'Teléfono',      value: this.f.phone || this.f.telefono_ofi },
            { icon: 'mail',        label: 'Email',         value: this.f.email_empresa || this.f.email_personal },
            { icon: 'tag',         label: 'Cód. Func.',    value: this.f.codigo_funcionario },
        ];
    }

    cerrar(): void {
        this.dialogRef.close();
    }
}
