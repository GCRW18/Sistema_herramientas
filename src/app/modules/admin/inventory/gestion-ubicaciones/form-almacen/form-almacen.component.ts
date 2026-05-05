import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { Warehouse, Ciudad, Oficina } from '../interfaces';
import { GestionUbicacionesService } from '../gestion-ubicaciones.service';

type DialogMode = 'new' | 'edit' | 'view';

@Component({
    selector: 'app-form-almacen',
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
    templateUrl: './form-almacen.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
    `]
})
export class FormAlmacenComponent implements OnInit {
    dialogRef = inject(MatDialogRef<FormAlmacenComponent>);
    private fb       = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private svc      = inject(GestionUbicacionesService);
    private data     = inject<{ mode: DialogMode; almacen?: Warehouse }>(MAT_DIALOG_DATA);

    mode: DialogMode = this.data?.mode ?? 'new';

    basesAeronauticas = signal<any[]>([]);
    ciudades          = signal<Ciudad[]>([]);
    oficinas          = signal<Oficina[]>([]);

    tipos = ['Principal', 'Secundario', 'Técnico', 'Herramientas'];

    form: FormGroup = this.fb.group({
        id_base:     [null, Validators.required],
        codigo:      ['',   [Validators.required, Validators.maxLength(40)]],
        nombre:      ['',   [Validators.required, Validators.maxLength(120)]],
        ciudad:      ['',   Validators.required],
        id_oficina:  [null, Validators.required],
        tipo:        ['Principal', Validators.required],
        estado:      ['ACTIVO',    Validators.required],
        descripcion: [''],
    });

    ngOnInit(): void {
        this.cargarCatalogos();
        this.inicializarFormulario();
    }

    private cargarCatalogos(): void {
        this.svc.getBasesAeronauticas().subscribe({
            next: (resp: any) => this.basesAeronauticas.set(resp?.datos || resp?.data || []),
            error: () => this.mostrarError('Error al cargar bases aeronáuticas')
        });

        this.svc.getCiudades().subscribe({
            next: (ciudades: Ciudad[]) => this.ciudades.set(ciudades ?? []),
            error: () => this.mostrarError('Error al cargar catálogo de ciudades')
        });

        this.svc.getOficinas().subscribe({
            next: (oficinas: Oficina[]) => this.oficinas.set(oficinas ?? []),
            error: () => this.mostrarError('Error al cargar catálogo de oficinas')
        });
    }

    private inicializarFormulario(): void {
        if (this.data?.almacen) {
            const a = this.data.almacen;
            this.form.patchValue({
                id_base:     a.id_base,
                codigo:      a.codigo,
                nombre:      a.nombre,
                ciudad:      a.ciudad,
                id_oficina:  a.id_oficina,
                tipo:        a.tipo,
                estado:      a.estado,
                descripcion: a.descripcion ?? '',
            });
        }
        if (this.readOnly) {
            this.form.disable();
        }
    }

    get titulo(): string {
        return this.mode === 'new'  ? 'Nuevo Almacén'
            : this.mode === 'edit' ? 'Editar Almacén'
                :                        'Detalle del Almacén';
    }

    get subtitulo(): string {
        return this.mode === 'new'  ? 'Registro en el sistema'
            : this.mode === 'edit' ? 'Modificación de datos'
                :                        'Información de solo lectura';
    }

    get readOnly(): boolean { return this.mode === 'view'; }

    get nombreOficinaPreview(): string {
        const id = this.form.get('id_oficina')?.value;
        if (!id) return '';
        return this.oficinas().find(o => o.id_oficina === Number(id))?.nombre_oficina ?? '';
    }

    hasError(field: string, error: string): boolean {
        const c = this.form.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    toggleEstado() {
        if (this.readOnly) return;
        const cur = this.form.get('estado')?.value;
        this.form.patchValue({ estado: cur === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' });
    }

    save() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.snackBar.open('Complete los campos requeridos', 'Cerrar', { duration: 2500 });
            return;
        }

        const v = this.form.getRawValue();
        const out: Warehouse = {
            id:            this.data.almacen?.id ?? 0,
            id_base:       Number(v.id_base),
            codigo:        v.codigo.trim(),
            nombre:        v.nombre.trim(),
            ciudad:        v.ciudad,
            id_oficina:    Number(v.id_oficina),
            nombreOficina: this.nombreOficinaPreview,
            tipo:          v.tipo,
            estado:        v.estado,
            descripcion:   v.descripcion?.trim() || undefined,
        };

        const req$ = this.mode === 'new'
            ? this.svc.insertWarehouse(out)
            : this.svc.updateWarehouse(out);

        req$.subscribe({
            next: (resp: any) => {
                if (!resp || resp.tipoRespuesta === 'error' || resp.tipoRespuesta === 'ERROR') {
                    this.mostrarError(resp?.mensaje || 'Error al guardar cambios');
                    return;
                }
                this.snackBar.open(
                    this.mode === 'new' ? 'Almacén creado' : 'Almacén actualizado',
                    'Cerrar', { duration: 2500 }
                );
                this.dialogRef.close(true);
            },
            error: (err) => {
                console.error('Error guardando almacén', err);
                this.mostrarError('Error crítico al conectar con el servidor');
            },
        });
    }

    private mostrarError(msg: string): void {
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
    }
}
