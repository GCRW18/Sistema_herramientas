import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';

/**
 * Ficha de usuario/funcionario — SOLO LECTURA (patrón módulo Funcionarios).
 * Muestra los datos de la cuenta PXP y, si el usuario tiene registro técnico
 * en he.temployees (id_employee), su información de licencia/sello/cargo/área/base.
 * Sin acciones de edición: únicamente botón Cerrar.
 */
@Component({
    selector: 'app-ver-usuario',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatDialogModule],
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
export class VerUsuarioComponent {
    f: any;

    constructor(
        private dialogRef: MatDialogRef<VerUsuarioComponent>,
        @Inject(MAT_DIALOG_DATA) data: { funcionario: any }
    ) {
        this.f = data.funcionario || {};
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
