import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { Material, DialogMode } from '../interfaces';
import { GestionUbicacionesService } from '../../gestion-ubicaciones/gestion-ubicaciones.service';
import { Warehouse, Rack, Level } from '../../gestion-ubicaciones/interfaces';

@Component({
    selector: 'app-form-material',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatIconModule,
        MatSnackBarModule,
        MatTooltipModule,
        DragDropModule,
    ],
    templateUrl: './form-material.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
    `]
})
export class FormMaterialComponent implements OnInit {
    dialogRef = inject(MatDialogRef<FormMaterialComponent>);
    private fb       = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private data     = inject<{ mode: DialogMode; material?: Material }>(MAT_DIALOG_DATA);

    mode: DialogMode = this.data?.mode ?? 'new';

    private ubicSvc = inject(GestionUbicacionesService);

    tiposItem   = ['CONSUMIBLE', 'MATERIAL'];
    tiposCompra = ['COMPRA DIRECTA', 'LICITACIÓN', 'DONACIÓN', 'TRANSFERENCIA'];
    unidades    = ['UND', 'LT', 'KG', 'MTS', 'GAL', 'CAJA', 'ROLLO', 'JUEGO'];

    // ── Picker de ubicación ───────────────────────────
    pickerOpen    = false;
    pickerLoading = false;
    pickerTop     = 0;
    pickerLeft    = 0;
    warehouses:   Warehouse[] = [];
    racks:        Rack[]      = [];
    levels:       Level[]     = [];
    selWarehouse: Warehouse | null = null;
    selRack:      Rack | null      = null;

    form: FormGroup = this.fb.group({
        codigoBoaM: ['', [Validators.required, Validators.maxLength(40)]],
        producto:   ['', [Validators.required, Validators.maxLength(200)]],
        tipoItem:   ['CONSUMIBLE', Validators.required],
        tipoCompra: ['COMPRA DIRECTA', Validators.required],
        marca:      [''],
        pn:         [''],
        unidad:     ['UND', Validators.required],
        stock:      [0, [Validators.required, Validators.min(0)]],
        stockMin:   [0, Validators.min(0)],
        stockMax:   [0, Validators.min(0)],
        ubicacion:  [''],
        activo:     [true],
        recibidoPor:[''],
        fecha:      [new Date().toISOString().split('T')[0]],
        hora:       [new Date().toTimeString().slice(0, 5)],
        observacion:[''],
    });

    ngOnInit(): void {
        if (this.data?.material) {
            this.form.patchValue(this.data.material);
        }
        if (this.readOnly) {
            this.form.disable();
        }
    }

    get titulo(): string {
        return this.mode === 'new'  ? 'Nuevo Ítem de Catálogo'
             : this.mode === 'edit' ? 'Editar Ítem'
             :                        'Detalle del Ítem';
    }

    get subtitulo(): string {
        return this.mode === 'new'  ? 'Registro en catálogo misceláneos'
             : this.mode === 'edit' ? 'Modificación de datos del ítem'
             :                        'Información de solo lectura';
    }

    get readOnly(): boolean { return this.mode === 'view'; }

    hasError(field: string, error: string): boolean {
        const c = this.form.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    openPicker(event: MouseEvent): void {
        if (this.readOnly) return;
        const btn  = event.currentTarget as HTMLElement;
        const rect = btn.getBoundingClientRect();
        const panelW = 420;
        let left = rect.left;
        if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
        this.pickerTop  = rect.bottom + 6;
        this.pickerLeft = Math.max(8, left);
        this.pickerOpen    = true;
        this.pickerLoading = true;
        this.racks         = [];
        this.levels        = [];
        this.selWarehouse  = null;
        this.selRack       = null;
        this.ubicSvc.getWarehouses().subscribe({
            next:  ws => { this.warehouses = ws.filter(w => w.estado === 'ACTIVO'); this.pickerLoading = false; },
            error: () => { this.pickerLoading = false; }
        });
    }

    selectWarehouse(w: Warehouse): void {
        this.selWarehouse = w;
        this.selRack      = null;
        this.levels       = [];
        this.ubicSvc.getRacks(w.id).subscribe(rs => { this.racks = rs.filter(r => r.activo); });
    }

    selectRack(r: Rack): void {
        this.selRack = r;
        this.levels  = [];
        this.ubicSvc.getLevels(r.id).subscribe(ls => { this.levels = ls.filter(l => l.activo && !l.isFloor); });
    }

    selectLevel(l: Level): void {
        const etiqueta = `${this.selWarehouse!.nombre} › ${this.selRack!.nombre} › ${l.nombre}`;
        this.form.patchValue({ ubicacion: etiqueta });
        this.pickerOpen = false;
    }

    clearUbicacion(): void {
        this.form.patchValue({ ubicacion: '' });
        this.selWarehouse = null;
        this.selRack      = null;
        this.racks        = [];
        this.levels       = [];
    }

    save(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.snackBar.open('Complete los campos requeridos', 'Cerrar', { duration: 2500 });
            return;
        }
        const v = this.form.getRawValue();
        const out: Partial<Material> = {
            ...(this.data.material ?? {}),
            codigoBoaM:  v.codigoBoaM.trim().toUpperCase(),
            producto:    v.producto.trim(),
            tipoItem:    v.tipoItem,
            tipoCompra:  v.tipoCompra,
            marca:       v.marca?.trim() || '',
            pn:          v.pn?.trim()    || '',
            unidad:      v.unidad,
            stock:       Number(v.stock),
            stockMin:    Number(v.stockMin),
            stockMax:    Number(v.stockMax),
            ubicacion:   v.ubicacion?.trim() || '',
            activo:      v.activo,
            recibidoPor: v.recibidoPor?.trim() || '',
            fecha:       v.fecha,
            hora:        v.hora,
            observacion: v.observacion?.trim() || undefined,
        };
        this.dialogRef.close(out);
    }
}
