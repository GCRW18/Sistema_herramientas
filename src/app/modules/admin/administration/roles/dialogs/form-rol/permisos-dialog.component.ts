import { Component, OnInit, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AVAILABLE_PERMISSIONS, Permission } from '../../../../../../core/models/role.types';

export interface PermisosDialogData {
    permissions: string[];
}

interface ModuleGroup {
    name: string;
    permissions: Permission[];
}

@Component({
    selector: 'app-permisos-dialog',
    standalone: true,
    imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule, DragDropModule],
    templateUrl: './permisos-dialog.component.html'
})
export class PermisosDialogComponent implements OnInit {
    private dialogRef = inject(MatDialogRef<PermisosDialogComponent>);
    private dialog    = inject(MatDialog);

    modules: ModuleGroup[] = [];
    localPermissions: string[] = [];
    searchTerm = '';

    readonly moduleIcons: Record<string, string> = {
        'Almacén y Ubicaciones':       'warehouse',
        'Misceláneos':                 'category',
        'Gestión Kits':                'inventory',
        'Reportes Inventario':         'assessment',
        'Consultar Inventario':        'search',
        'Inter-Bases':                 'swap_horiz',
        'Préstamo Técnico BOA':        'engineering',
        'Préstamo Terceros':           'storefront',
        'Ingresos Almacén':            'move_to_inbox',
        'Cuarentena y Baja':           'warning_amber',
        'Envío Calibración':           'send',
        'Retorno Calibración':         'undo',
        'Empresas de Servicio':        'apartment',
        'Consulta y Auditoría':        'fact_check',
        'Servicios de Mantenimiento':  'build',
        'Centro de Control':           'notifications_active',
        'Transcripción Histórico':     'edit_note',
        'Usuarios':                    'people',
        'Proveedores':                 'local_shipping',
        'Roles y Permisos':            'shield',
    };

    get filteredPermissions(): { mod: string; perm: Permission }[] {
        const term = this.searchTerm.toLowerCase().trim();
        if (!term) return [];
        const result: { mod: string; perm: Permission }[] = [];
        this.modules.forEach(mod =>
            mod.permissions
                .filter(p => p.name.toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term))
                .forEach(p => result.push({ mod: mod.name, perm: p }))
        );
        return result;
    }

    /* trackBy — filteredPermissions arma objetos {mod, perm} nuevos en cada
       llamada; sin esto, el *ngFor los recrearía en cada detección de cambios
       (mismo origen del congelamiento de Misceláneos, ver [[project_...]]). */
    trackByPermItem = (_: number, item: { mod: string; perm: Permission }): string => `${item.mod}::${item.perm.id}`;

    get isSearching(): boolean { return this.searchTerm.trim().length > 0; }
    get selectedCount(): number { return this.localPermissions.length; }
    get totalCount(): number { return AVAILABLE_PERMISSIONS.length; }

    constructor(@Inject(MAT_DIALOG_DATA) public data: PermisosDialogData) {}

    ngOnInit(): void {
        this.localPermissions = [...(this.data.permissions || [])];
        const grouped = new Map<string, Permission[]>();
        AVAILABLE_PERMISSIONS.forEach(p => {
            if (!grouped.has(p.module)) grouped.set(p.module, []);
            grouped.get(p.module)!.push(p);
        });
        this.modules = Array.from(grouped.entries()).map(([name, permissions]) => ({ name, permissions }));
    }

    isModuleFullySelected(module: string): boolean {
        const perms = this.modules.find(m => m.name === module)?.permissions || [];
        return perms.length > 0 && perms.every(p => this.localPermissions.includes(p.id));
    }

    isModulePartiallySelected(module: string): boolean {
        const perms = this.modules.find(m => m.name === module)?.permissions || [];
        const count = perms.filter(p => this.localPermissions.includes(p.id)).length;
        return count > 0 && count < perms.length;
    }

    getModuleSelectedCount(module: string): number {
        return (this.modules.find(m => m.name === module)?.permissions || [])
            .filter(p => this.localPermissions.includes(p.id)).length;
    }

    getModuleClass(module: string): string {
        if (this.isModuleFullySelected(module))
            return 'bg-amber-400 border-black shadow-[3px_3px_0_#000] text-black';
        if (this.isModulePartiallySelected(module))
            return 'bg-amber-100 dark:bg-amber-900/30 border-amber-400 text-black dark:text-white shadow-[2px_2px_0_#000]';
        return 'bg-white dark:bg-slate-800 border-stone-300 dark:border-slate-600 text-stone-500 dark:text-slate-400 hover:border-black dark:hover:border-slate-400 hover:shadow-[2px_2px_0_#000]';
    }

    async openModuloDialog(mod: ModuleGroup): Promise<void> {
        const { ModuloPermisosMiniDialogComponent } = await import('./modulo-permisos-mini-dialog.component');
        const moduleIds = mod.permissions.map(p => p.id);
        const currentSelected = this.localPermissions.filter(id => moduleIds.includes(id));

        const ref = this.dialog.open(ModuloPermisosMiniDialogComponent, {
            panelClass:    'neo-mini-dialog',
            hasBackdrop:   true,
            backdropClass: 'bg-black/30',
            data: {
                module:      mod.name,
                icon:        this.moduleIcons[mod.name] || 'lock',
                permissions: mod.permissions,
                selectedIds: currentSelected
            }
        });

        ref.afterClosed().subscribe((result: string[] | null) => {
            if (result !== null && result !== undefined) {
                const ids = new Set(moduleIds);
                this.localPermissions = [
                    ...this.localPermissions.filter(id => !ids.has(id)),
                    ...result
                ];
            }
        });
    }

    toggleInline(id: string): void {
        this.localPermissions = this.localPermissions.includes(id)
            ? this.localPermissions.filter(p => p !== id)
            : [...this.localPermissions, id];
    }

    isSelected(id: string): boolean { return this.localPermissions.includes(id); }

    selectAll(): void { this.localPermissions = AVAILABLE_PERMISSIONS.map(p => p.id); }
    clearAll(): void { this.localPermissions = []; }
    apply(): void { this.dialogRef.close(this.localPermissions); }
    cancel(): void { this.dialogRef.close(null); }
}
