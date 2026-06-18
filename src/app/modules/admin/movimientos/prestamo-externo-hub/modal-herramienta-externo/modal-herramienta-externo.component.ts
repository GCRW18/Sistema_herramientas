import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service';

@Component({
    selector: 'app-modal-herramienta-externo',
    standalone: true,
    imports: [
        CommonModule, MatIconModule, MatProgressSpinnerModule,
        MatDialogModule, FormsModule, ReactiveFormsModule, DragDropModule
    ],
    templateUrl: './modal-herramienta-externo.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class ModalHerramientaExternoComponent implements OnInit, OnDestroy {

    private dialogRef     = inject(MatDialogRef<ModalHerramientaExternoComponent>);
    private fb            = inject(FormBuilder);
    private movementSvc   = inject(MovementService);
    private destroy$      = new Subject<void>();

    prestarForm!: FormGroup;
    coincidencias    = signal<number>(0);
    isSearching      = signal<boolean>(false);
    selectedImage    = signal<string>('');
    imagenOriginal   = signal<string>('');
    totalMonto       = signal<number>(0);

    showToolsSuggestions  = false;
    herramientas:         any[] = [];
    filteredHerramientas: any[] = [];

    estados = [
        { value: 'SERVICEABLE',    label: 'SERVICEABLE'    },
        { value: 'EN_CALIBRACION', label: 'EN CALIBRACIÓN' },
    ];

    ngOnInit(): void {
        this.prestarForm = this.fb.group({
            buscar:          [''],
            id_tool:         [null],
            codigo:          ['', Validators.required],
            nombre:          ['', Validators.required],
            pn:              [''],
            sn:              [''],
            marca:           [''],
            existencia:      [{ value: 0, disabled: true }],
            unidad:          ['PZA'],
            estado:          ['SERVICEABLE', Validators.required],
            cantidad:        [1, [Validators.required, Validators.min(1)]],
            horas:           [1, [Validators.required, Validators.min(1)]],
            costoHora:       [0, [Validators.required, Validators.min(0)]],
            fechaVencimiento:[''],
            content_list:    [''],
            observacion:     [''],
        });

        this.prestarForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(v => {
            this.totalMonto.set((v.horas || 0) * (v.costoHora || 0));
            const existencia = this.prestarForm.getRawValue().existencia;
            if (existencia && v.cantidad > existencia) {
                this.prestarForm.get('cantidad')?.setErrors({ excedeStock: true });
            }
        });

        this.cargarHerramientas();
    }

    ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

    private cargarHerramientas(): void {
        this.movementSvc.getHerramientasDisponibles({}).pipe(
            takeUntil(this.destroy$), catchError(() => of([]))
        ).subscribe((tools: any[]) => {
            this.herramientas = Array.isArray(tools) ? tools : [];
        });
    }

    onBuscarChange(value: string): void {
        if (!value || value.length < 2) { this.filteredHerramientas = []; this.showToolsSuggestions = false; return; }
        this.isSearching.set(true);
        const term = value.toLowerCase().trim();
        this.filteredHerramientas = this.herramientas.filter(h =>
            (h.code || h.codigo || '').toLowerCase().includes(term) ||
            (h.name || h.nombre || '').toLowerCase().includes(term) ||
            (h.part_number || h.pn || '').toLowerCase().includes(term)
        ).slice(0, 15);
        this.coincidencias.set(this.filteredHerramientas.length);
        this.showToolsSuggestions = this.filteredHerramientas.length > 0;
        this.isSearching.set(false);
    }

    hideToolsSuggestions(): void { setTimeout(() => { this.showToolsSuggestions = false; }, 200); }

    selectHerramienta(h: any): void {
        const imagen = h.image_url || h.foto || h.imagen || '';
        this.selectedImage.set(imagen);
        this.imagenOriginal.set(imagen);
        this.prestarForm.patchValue({
            buscar:           `${h.code || h.codigo} — ${h.name || h.nombre}`,
            id_tool:          h.id_tool ?? h.id,
            codigo:           h.code    || h.codigo || '',
            nombre:           h.name    || h.nombre || '',
            pn:               h.part_number || h.pn || '',
            sn:               h.serial_number || h.sn || '',
            marca:            h.brand   || h.marca || '',
            existencia:       h.quantity_in_stock || h.existencia || 0,
            unidad:           h.unit_of_measure  || h.unidad || 'PZA',
            fechaVencimiento: h.next_calibration_date || h.calibration_due_date || '',
            content_list:     h.content_list || '',
            estado:           'SERVICEABLE',
            cantidad:         1,
            horas:            1,
            costoHora:        0,
        });
        this.filteredHerramientas = [];
        this.showToolsSuggestions = false;
    }

    validarCantidadState(): boolean {
        const c = this.prestarForm.get('cantidad')?.value || 0;
        const e = this.prestarForm.getRawValue().existencia || 0;
        return e === 0 ? true : (c > 0 && c <= e);
    }

    hasError(field: string, error: string): boolean {
        const c = this.prestarForm.get(field);
        return c ? c.hasError(error) && c.touched : false;
    }

    agregar(): void {
        this.prestarForm.markAllAsTouched();
        if (this.prestarForm.invalid || !this.validarCantidadState()) return;
        this.dialogRef.close({ action: 'agregar', data: this.prestarForm.getRawValue() });
    }

    cerrar(): void { this.dialogRef.close(); }
}
