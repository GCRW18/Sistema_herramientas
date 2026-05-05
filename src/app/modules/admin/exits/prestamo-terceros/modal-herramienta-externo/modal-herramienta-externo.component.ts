import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service'; // Ajusta la ruta

@Component({
    selector: 'app-modal-herramienta-externo',
    standalone: true,
    imports: [
        CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
        MatDialogModule, MatFormFieldModule, FormsModule, ReactiveFormsModule
    ],
    templateUrl: './modal-herramienta-externo.component.html',
    styles: [`
      :host { display: block; width: 100%; height: 100%; }
      .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; }
      :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class ModalHerramientaExternoComponent implements OnInit, OnDestroy {
    private dialogRef = inject(MatDialogRef<ModalHerramientaExternoComponent>);
    private fb = inject(FormBuilder);
    private movementService = inject(MovementService);
    private destroy$ = new Subject<void>();

    prestarForm!: FormGroup;
    coincidencias = signal<number>(0);
    isSearching = signal<boolean>(false);
    showToolsSuggestions = false;
    herramientas: any[] = [];
    filteredHerramientas: any[] = [];
    totalMonto = signal<number>(0);

    estados = [{ value: 'SERVICEABLE', label: 'SERVICEABLE' }, { value: 'EN CALIBRACION', label: 'EN CALIBRACION' }];

    ngOnInit(): void {
        this.prestarForm = this.fb.group({
            buscar:           ['BOA-H-'],
            id_tool:          [null],
            codigo:           ['', Validators.required],
            nombre:           ['', Validators.required],
            pn:               [''],
            sn:               [''],
            marca:            [''],
            existencia:       [{ value: 0, disabled: true }],
            unidad:           ['PZA'],
            estado:           ['SERVICEABLE', Validators.required],
            cantidad:         [1, [Validators.required, Validators.min(1)]],
            horas:            [1, [Validators.required, Validators.min(1)]],
            costoHora:        [0, [Validators.required, Validators.min(0)]],
            observacion:      ['']
        });

        this.setupListeners();
        this.cargarHerramientas();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private setupListeners(): void {
        this.prestarForm.get('buscar')?.valueChanges.pipe(takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged()).subscribe(v => {
            if (v !== null) this.onBuscarChange(v);
        });

        // Escuchar cambios para calcular el Total Dinámico
        this.prestarForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(values => {
            const h = values.horas || 0;
            const c = values.costoHora || 0;
            this.totalMonto.set(h * c);

            // Validar max stock
            const existencia = this.prestarForm.getRawValue().existencia;
            if (existencia && values.cantidad > existencia) {
                this.prestarForm.get('cantidad')?.setErrors({ excedeStock: true });
            }
        });
    }

    private cargarHerramientas(): void {
        this.movementService.getHerramientasDisponibles({ status: 'DISPONIBLE' }).pipe(
            takeUntil(this.destroy$), catchError(() => of([]))
        ).subscribe(tools => {
            if (Array.isArray(tools)) this.herramientas = tools;
        });
    }

    onBuscarChange(value: string): void {
        if (!value || value.length <= 6 || value === 'BOA-H-') {
            this.filteredHerramientas = []; this.showToolsSuggestions = false; return;
        }
        this.isSearching.set(true);
        const term = value.toLowerCase().trim();
        this.filteredHerramientas = this.herramientas.filter(h =>
            (h.code || h.codigo || '').toLowerCase().includes(term) || (h.name || h.nombre || '').toLowerCase().includes(term)
        ).slice(0, 15);
        this.showToolsSuggestions = this.filteredHerramientas.length > 0;
        this.isSearching.set(false);
    }

    hideToolsSuggestions(): void { setTimeout(() => { this.showToolsSuggestions = false; }, 200); }

    selectHerramienta(h: any): void {
        this.prestarForm.patchValue({
            buscar: `${h.code || h.codigo} - ${h.name || h.nombre}`, id_tool: h.id_tool || h.id, codigo: h.code || h.codigo,
            nombre: h.name || h.nombre, pn: h.part_number || h.pn, sn: h.serial_number || h.sn, marca: h.brand || h.marca,
            existencia: h.quantity_in_stock || h.existencia || 0, unidad: h.unit_of_measure || h.unidad || 'PZA',
            estado: 'SERVICEABLE', cantidad: 1, horas: 1, costoHora: 0
        });
        this.filteredHerramientas = []; this.showToolsSuggestions = false;
    }

    validarCantidadState(): boolean {
        const c = this.prestarForm.get('cantidad')?.value || 0;
        const e = this.prestarForm.getRawValue().existencia || 0;
        return e === 0 ? true : (c > 0 && c <= e);
    }

    agregar(): void {
        this.prestarForm.markAllAsTouched();
        if (this.prestarForm.invalid || !this.validarCantidadState()) return;
        this.dialogRef.close({ action: 'agregar', data: this.prestarForm.getRawValue() });
    }

    cerrar(): void { this.dialogRef.close(); }
}
