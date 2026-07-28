import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { RoleService } from '../../../../../../core/services/role.service';

/**
 * Ficha de usuario/funcionario — solo lectura para los datos personales/técnicos
 * (patrón módulo Funcionarios: la cuenta de login vive en segu, no se edita aquí).
 * Única acción de escritura: asignar/cambiar el rol del módulo (he.roles), que se
 * guarda como fila espejo en he.tusuarios vinculada por id_usuario.
 */
@Component({
    selector: 'app-ver-usuario',
    standalone: true,
    imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule, MatSnackBarModule],
    template: `
    <div class="bg-stone-100 dark:bg-slate-900 border-2 border-black rounded-2xl overflow-hidden flex flex-col"
         style="width:100%; max-height:90vh">

        <!-- Header -->
        <div class="bg-[#0F172A] px-4 py-3 flex items-center gap-3 shrink-0">
            <div class="w-11 h-11 rounded-xl bg-amber-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#000] shrink-0">
                <span class="text-black font-black text-sm">{{ iniciales }}</span>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-[8px] text-slate-400 font-bold uppercase tracking-[0.18em] leading-none mb-0.5">Ficha de Usuario</p>
                <h2 class="text-sm text-white font-black uppercase tracking-tight leading-tight truncate">{{ f.full_name || f.cuenta }}</h2>
                <p class="text-[10px] text-amber-400 font-black font-mono mt-0.5 truncate">{{ f.cuenta }}</p>
            </div>
            <button type="button" (click)="cerrar()"
                    class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/10 shrink-0">
                <mat-icon class="text-white !text-base">close</mat-icon>
            </button>
        </div>

        <!-- Chips de estado -->
        <div class="px-4 py-2.5 bg-white dark:bg-slate-800 border-b-2 border-black flex items-center gap-1.5 flex-wrap shrink-0">
            <span class="px-2 py-0.5 text-[9px] font-black uppercase border-2 border-black rounded shadow-[1px_1px_0_#000]"
                  [ngClass]="f.active ? 'bg-green-600 text-white' : 'bg-stone-400 text-black'">
                {{ f.active ? 'Activo' : 'Inactivo' }}
            </span>
            <span *ngIf="f.license_number"
                  class="px-2 py-0.5 text-[9px] font-black uppercase border-2 border-black rounded bg-blue-900 text-white shadow-[1px_1px_0_#000]">
                Lic. {{ f.license_number }}
            </span>
            <span *ngIf="f.base_code"
                  class="px-2 py-0.5 text-[9px] font-black uppercase border-2 border-black rounded bg-amber-400 text-black shadow-[1px_1px_0_#000]">
                {{ f.base_name || f.base_code }}
            </span>
            <span *ngIf="!f.id_employee"
                  class="px-2 py-0.5 text-[9px] font-black uppercase border-2 border-dashed border-stone-400 rounded text-stone-500 dark:text-slate-400">
                Sin registro técnico
            </span>
        </div>

        <!-- Cuerpo -->
        <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

            <!-- Datos técnicos -->
            <div>
                <p class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-1.5">Información Técnica</p>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div *ngFor="let c of cardsTecnicos"
                         class="bg-white dark:bg-slate-800 border-2 border-black rounded-xl p-2.5 shadow-[2px_2px_0_#000]">
                        <p class="text-[8px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 flex items-center gap-1">
                            <mat-icon class="!text-[11px] !w-3 !h-3 text-amber-500">{{ c.icon }}</mat-icon>
                            {{ c.label }}
                        </p>
                        <p class="text-[11px] font-black text-black dark:text-white mt-1 break-words leading-tight">{{ c.value || '—' }}</p>
                    </div>
                </div>
            </div>

            <!-- Datos personales / contacto -->
            <div>
                <p class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 mb-1.5">Datos Personales</p>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div *ngFor="let c of cardsPersonales"
                         class="bg-white dark:bg-slate-800 border-2 border-black rounded-xl p-2.5 shadow-[2px_2px_0_#000]">
                        <p class="text-[8px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 flex items-center gap-1">
                            <mat-icon class="!text-[11px] !w-3 !h-3 text-amber-500">{{ c.icon }}</mat-icon>
                            {{ c.label }}
                        </p>
                        <p class="text-[11px] font-black text-black dark:text-white mt-1 break-words leading-tight">{{ c.value || '—' }}</p>
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
                    <button type="button" (click)="guardarRol()" [disabled]="guardandoRol || loadingRoles"
                            class="shrink-0 px-3 h-9 bg-[#FFC501FF] text-black font-black text-[10px] uppercase border-2 border-black rounded-lg shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-40">
                        {{ guardandoRol ? 'Guardando…' : 'Guardar' }}
                    </button>
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
