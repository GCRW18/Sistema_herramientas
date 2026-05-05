import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { Herramienta } from '../interfaces';

type Mode = 'new' | 'edit' | 'view';
type TabKey = 'general' | 'calibracion' | 'consumibles' | 'misc';

@Component({
    selector: 'app-form-herramienta',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatIconModule,
        MatSnackBarModule,
        MatSlideToggleModule,
        MatTooltipModule,
        DragDropModule,
    ],
    templateUrl: './form-herramienta.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
    `]
})
export class FormHerramientaComponent implements OnInit {

    dialogRef = inject(MatDialogRef<FormHerramientaComponent>);
    private fb       = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private data     = inject<{ mode: Mode; herramienta?: Herramienta }>(MAT_DIALOG_DATA);

    mode: Mode = this.data.mode;
    activeTab: TabKey = 'general';

    unidades   = ['UN', 'PAR', 'CAJA', 'JGO', 'KG', 'LT', 'MT', 'BOLSA', 'ROLLO'];
    estados    = ['NUEVO', 'USADO', 'EN_REPARACION', 'BAJA'];
    categorias: { value: 'general'|'consumible'|'miscelaneo'; label: string; icon: string }[] = [
        { value: 'general',    label: 'General',    icon: 'build' },
        { value: 'consumible', label: 'Consumible', icon: 'inventory_2' },
        { value: 'miscelaneo', label: 'Misceláneo', icon: 'category' },
    ];

    // Mock — luego se cargan desde el servicio de almacenes
    almacenes = [
        { id: 1, codigo: 'ALM-CBBA-01', nombre: 'Almacén Central Aero' },
        { id: 2, codigo: 'ALM-SCZ-01',  nombre: 'Depósito Santa Cruz'  },
        { id: 3, codigo: 'ALM-LPZ-01',  nombre: 'Centro Logístico LP'  },
    ];

    form!: FormGroup;

    ngOnInit() {
        this.form = this.fb.group({
            // GENERAL
            codigo:      ['', [Validators.required, Validators.maxLength(40)]],
            pn:          ['', [Validators.required, Validators.maxLength(60)]],
            sn:          [''],
            descripcion: ['', [Validators.required, Validators.maxLength(200)]],
            categoria:   ['general', Validators.required],
            cantidad:    [1, [Validators.required, Validators.min(1)]],
            unidad:      ['UN', Validators.required],
            estado:      ['NUEVO', Validators.required],
            warehouseId: [null],
            rackId:      [null],
            levelId:     [null],

            // TOGGLE CALIBRACIÓN
            sujetaCalibracion:  [false],
            calFrecuenciaMeses: [12],
            calUltima:          [''],
            calProxima:         [''],
            calProveedor:       [''],
            calCertificado:     [''],

            // CONSUMIBLE
            stockMinimo:   [0],
            stockActual:   [0],
            unidadConsumo: ['UN'],

            // MISC
            notas: [''],
        });

        if (this.data.herramienta) {
            const h = this.data.herramienta;
            this.form.patchValue({
                codigo: h.codigo, pn: h.pn, sn: h.sn ?? '',
                descripcion: h.descripcion, categoria: h.categoria,
                cantidad: h.cantidad, unidad: h.unidad, estado: h.estado,
                warehouseId: h.warehouseId ?? null, rackId: h.rackId ?? null, levelId: h.levelId ?? null,
                sujetaCalibracion:  h.sujetaCalibracion,
                calFrecuenciaMeses: h.calibracion?.frecuenciaMeses ?? 12,
                calUltima:          h.calibracion?.ultimaCalibracion ?? '',
                calProxima:         h.calibracion?.proximaCalibracion ?? '',
                calProveedor:       h.calibracion?.proveedor ?? '',
                calCertificado:     h.calibracion?.certificado ?? '',
                stockMinimo:   h.consumible?.stockMinimo ?? 0,
                stockActual:   h.consumible?.stockActual ?? 0,
                unidadConsumo: h.consumible?.unidadConsumo ?? 'UN',
                notas: h.miscelaneo?.notas ?? '',
            });
        }

        this.applyCalibrationValidators(this.form.value.sujetaCalibracion);
        this.form.get('sujetaCalibracion')?.valueChanges.subscribe(v => this.applyCalibrationValidators(!!v));

        if (this.mode === 'view') this.form.disable();
    }

    private applyCalibrationValidators(active: boolean) {
        const fields = ['calFrecuenciaMeses', 'calProxima'] as const;
        fields.forEach(f => {
            const c = this.form.get(f);
            if (!c) return;
            if (active) {
                c.setValidators([Validators.required]);
                if (f === 'calFrecuenciaMeses') c.addValidators(Validators.min(1));
            } else {
                c.clearValidators();
            }
            c.updateValueAndValidity({ emitEvent: false });
        });
    }

    get titulo(): string {
        return this.mode === 'new'  ? 'Nueva Herramienta'
             : this.mode === 'edit' ? 'Editar Herramienta'
             :                        'Detalle de Herramienta';
    }

    get subtitulo(): string {
        return this.mode === 'new'  ? 'Registro en el inventario'
             : this.mode === 'edit' ? 'Modificación de datos'
             :                        'Información de solo lectura';
    }

    get readOnly(): boolean { return this.mode === 'view'; }

    hasError(field: string, error: string): boolean {
        const c = this.form?.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    get sujetaCalibracion(): boolean { return !!this.form?.value?.sujetaCalibracion; }
    get esConsumible():     boolean { return this.form?.value?.categoria === 'consumible'; }

    setTab(t: TabKey) { this.activeTab = t; }

    canShowTab(t: TabKey): boolean {
        if (t === 'calibracion') return this.sujetaCalibracion;
        if (t === 'consumibles') return this.esConsumible;
        return true;
    }

    save() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.snackBar.open('Complete los campos requeridos en cada pestaña', 'Cerrar', { duration: 3000 });
            // Saltar al primer tab con error
            if (this.formHasErrorIn('general'))     this.activeTab = 'general';
            else if (this.formHasErrorIn('calibracion') && this.sujetaCalibracion) this.activeTab = 'calibracion';
            return;
        }

        const v = this.form.getRawValue();
        const out: Herramienta = {
            id:          this.data.herramienta?.id ?? 0,
            codigo:      v.codigo.trim(),
            pn:          v.pn.trim(),
            sn:          v.sn?.trim() || undefined,
            descripcion: v.descripcion.trim(),
            categoria:   v.categoria,
            cantidad:    Number(v.cantidad),
            unidad:      v.unidad,
            estado:      v.estado,
            warehouseId: v.warehouseId ?? undefined,
            rackId:      v.rackId ?? undefined,
            levelId:     v.levelId ?? undefined,
            sujetaCalibracion: !!v.sujetaCalibracion,
            calibracion: v.sujetaCalibracion ? {
                frecuenciaMeses:    Number(v.calFrecuenciaMeses),
                ultimaCalibracion:  v.calUltima  || undefined,
                proximaCalibracion: v.calProxima || undefined,
                proveedor:          v.calProveedor?.trim() || undefined,
                certificado:        v.calCertificado?.trim() || undefined,
            } : undefined,
            consumible: v.categoria === 'consumible' ? {
                stockMinimo:   Number(v.stockMinimo),
                stockActual:   Number(v.stockActual),
                unidadConsumo: v.unidadConsumo,
            } : undefined,
            miscelaneo: v.categoria === 'miscelaneo' ? {
                notas: v.notas?.trim() || undefined,
            } : undefined,
            fechaRegistro: this.data.herramienta?.fechaRegistro ?? new Date().toISOString().slice(0, 10),
        };

        // TODO: conectar al servicio de herramientas
        this.dialogRef.close(out);
    }

    private formHasErrorIn(tab: TabKey): boolean {
        const groups: Record<TabKey, string[]> = {
            general:      ['codigo', 'pn', 'descripcion', 'categoria', 'cantidad', 'unidad', 'estado'],
            calibracion:  ['calFrecuenciaMeses', 'calProxima'],
            consumibles:  ['stockMinimo', 'stockActual'],
            misc:         [],
        };
        return groups[tab].some(f => this.form.get(f)?.invalid);
    }
}
