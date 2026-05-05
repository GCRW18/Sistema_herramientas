import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service'; // Ajusta la ruta

export interface HerramientaOption {
    id_tool: number;
    codigo: string;
    nombre: string;
    pn: string;
    sn: string;
    ubicacion: string;
    base: string;
    existencia: number;
    fechaVencimiento: string;
    unidad: string;
    estado: string;
    marca: string;
    imagen?: string;
}

@Component({
    selector: 'app-modal-herramienta-interno',
    standalone: true,
    imports: [
        CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
        MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
        FormsModule, ReactiveFormsModule, DragDropModule
    ],
    templateUrl: './modal-herramienta-interno.component.html',
    styles: [`
      :host { display: block; width: 100%; height: 100%; }
      .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 0; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 0; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
      :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class ModalHerramientaInternoComponent implements OnInit, OnDestroy {
    private dialogRef = inject(MatDialogRef<ModalHerramientaInternoComponent>);
    private data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);
    private movementService = inject(MovementService);
    private destroy$ = new Subject<void>();

    prestarForm!: FormGroup;
    selectedImage = signal<string | null>(null);
    imagenOriginal = signal<string | null>(null);
    coincidencias = signal<number>(0);
    isLoading = false;
    isSearching = signal<boolean>(false);
    showToolsSuggestions = false;

    isEditMode = computed(() => this.data?.mode === 'edit');
    herramientas: HerramientaOption[] = [];
    filteredHerramientas: HerramientaOption[] = [];

    estados = [
        { value: 'SERVICEABLE', label: 'SERVICEABLE' },
        { value: 'EN CALIBRACION', label: 'EN CALIBRACION' },
        { value: 'CUARENTENA', label: 'CUARENTENA' }
    ];

    ngOnInit(): void {
        this.prestarForm = this.fb.group({
            buscar:           ['BOA-H-'],
            id_tool:          [null],
            codigo:           ['', Validators.required],
            nombre:           ['', Validators.required],
            pn:               [''],
            sn:               [''],
            marca:            [''],
            ubicacion:        [''],
            base:             [''],
            existencia:       [{ value: 0, disabled: true }],
            fechaVencimiento: [''],
            unidad:           [''],
            estado:           ['SERVICEABLE', Validators.required],
            cantidad:         [1, [Validators.required, Validators.min(1)]],
            observacion:      ['']
        });

        this.setupSearchListener();
        this.setupCantidadListener();
        this.cargarHerramientas();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private setupSearchListener(): void {
        this.prestarForm.get('buscar')?.valueChanges.pipe(
            takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged()
        ).subscribe(value => {
            if (value !== undefined && value !== null) this.onBuscarChange(value);
        });
    }

    private setupCantidadListener(): void {
        this.prestarForm.get('cantidad')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.validateCantidad());
    }

    private cargarHerramientas(): void {
        this.isLoading = true;
        this.movementService.getHerramientasDisponibles({ status: 'DISPONIBLE' }).pipe(
            takeUntil(this.destroy$),
            catchError(err => { this.isLoading = false; return of([]); })
        ).subscribe({
            next: (tools) => {
                if (tools && Array.isArray(tools)) {
                    this.herramientas = tools.map((t: any) => ({
                        id_tool: t.id_tool ?? t.id, codigo: t.code ?? t.codigo ?? '', nombre: t.name ?? t.nombre ?? '',
                        pn: t.part_number ?? t.pn ?? '', sn: t.serial_number ?? t.sn ?? '', marca: t.brand ?? t.marca ?? '',
                        ubicacion: t.location ?? t.ubicacion ?? '', base: t.warehouse_code ?? t.base ?? 'VVI',
                        existencia: t.quantity_in_stock ?? t.existencia ?? 0, fechaVencimiento: t.calibration_due_date ?? t.fechaVencimiento ?? '',
                        unidad: t.unit_of_measure ?? t.unidad ?? 'PZA', estado: t.status ?? 'SERVICEABLE', imagen: t.image_url || null
                    }));
                }
                this.isLoading = false;
            }
        });
    }

    onBuscarChange(value: string): void {
        if (!value || value.length <= 6 || value === 'BOA-H-') {
            this.filteredHerramientas = []; this.coincidencias.set(0); this.showToolsSuggestions = false; return;
        }
        this.isSearching.set(true);
        const term = value.toLowerCase().trim();
        this.filteredHerramientas = this.herramientas.filter(h =>
            h.codigo.toLowerCase().includes(term) || h.nombre.toLowerCase().includes(term) || h.pn.toLowerCase().includes(term)
        ).slice(0, 15);
        this.coincidencias.set(this.filteredHerramientas.length);
        this.showToolsSuggestions = this.filteredHerramientas.length > 0;
        this.isSearching.set(false);
    }

    hideToolsSuggestions(): void { setTimeout(() => { this.showToolsSuggestions = false; }, 200); }

    selectHerramienta(h: HerramientaOption): void {
        this.prestarForm.patchValue({
            buscar: `${h.codigo} - ${h.nombre}`, id_tool: h.id_tool, codigo: h.codigo, nombre: h.nombre,
            pn: h.pn, sn: h.sn, marca: h.marca, ubicacion: h.ubicacion, base: h.base, existencia: h.existencia,
            unidad: h.unidad, estado: h.estado, fechaVencimiento: h.fechaVencimiento, cantidad: 1
        });
        this.imagenOriginal.set(h.imagen || null);
        this.selectedImage.set(h.imagen || null);
        this.coincidencias.set(1);
        this.filteredHerramientas = [];
        this.showToolsSuggestions = false;
        this.validateCantidad();
    }

    private validateCantidad(): void {
        const cantidad = this.prestarForm.get('cantidad')?.value;
        const existencia = this.prestarForm.getRawValue().existencia;
        if (existencia && cantidad && cantidad > existencia) {
            this.prestarForm.get('cantidad')?.setErrors({ excedeStock: true });
        } else if (cantidad < 1) {
            this.prestarForm.get('cantidad')?.setErrors({ min: true });
        } else {
            this.prestarForm.get('cantidad')?.setErrors(null);
        }
    }

    validarCantidadState(): boolean {
        const cantidad = this.prestarForm.get('cantidad')?.value || 0;
        const existencia = this.prestarForm.getRawValue().existencia || 0;
        if (existencia === 0) return true;
        return cantidad > 0 && cantidad <= existencia;
    }

    agregar(): void {
        this.prestarForm.markAllAsTouched();
        if (this.prestarForm.invalid || !this.validarCantidadState()) return;
        const v = this.prestarForm.getRawValue();
        this.dialogRef.close({ action: this.isEditMode() ? 'editar' : 'agregar', data: { ...v, imagen: this.selectedImage() } });
    }

    cerrar(): void { this.dialogRef.close(); }

    hasError(field: string, error: string): boolean {
        const control = this.prestarForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }
}
