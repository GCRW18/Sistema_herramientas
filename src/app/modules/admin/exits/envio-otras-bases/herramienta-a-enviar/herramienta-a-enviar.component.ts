import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { MovementService } from '../../../../../core/services/movement.service';

interface HerramientaOption {
    toolId: number;
    codigo: string;
    nombre: string;
    pn: string;
    sn: string;
    marca: string;
    ubicacion: string;
    existencia: number;
    fechaCalibracion: string;
    unidad: string;
    estado: string;
    descripcion?: string;
    imagen?: string;
}

interface DialogData {
    mode: 'add' | 'edit';
    item?: any;
    baseDestino?: string;
    tipoEnvio?: string;
    prioridad?: string;
}

@Component({
    selector: 'app-herramienta-a-enviar',
    standalone: true,
    imports: [
        CommonModule, MatIconModule, MatButtonModule, MatInputModule, MatFormFieldModule,
        MatSelectModule, MatDialogModule, FormsModule, ReactiveFormsModule, DragDropModule,
        MatAutocompleteModule, MatTooltipModule, MatSnackBarModule, MatProgressSpinnerModule
    ],
    templateUrl: './herramienta-a-enviar.component.html',
    styles: [`
        :host { display: block; width: 100%; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 0; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 0; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class HerramientaAEnviarComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<HerramientaAEnviarComponent>, { optional: true });
    public data = inject<DialogData>(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);

    private _unsubscribeAll = new Subject<void>();

    enviarForm!: FormGroup;

    selectedImage = signal<string | null>(null);
    imagenOriginal = signal<string | null>(null);
    coincidencias = signal<number>(0);
    isEditMode = computed(() => this.data?.mode === 'edit');
    isSearching = signal<boolean>(false);
    isLoading = false;

    private _selectedToolId: number | null = null;

    prioridades = [
        { value: 'NORMAL', label: 'Normal', icon: 'schedule' },
        { value: 'URGENTE', label: 'Urgente', icon: 'priority_high' },
        { value: 'AOG', label: 'AOG', icon: 'warning' }
    ];

    motivosEnvio = [
        { value: 'APOYO_OPERACIONAL', label: 'Apoyo Operacional' },
        { value: 'MANTENIMIENTO_PROGRAMADO', label: 'Mantenimiento Programado' },
        { value: 'MANTENIMIENTO_NO_PROGRAMADO', label: 'Mantenimiento No Programado' },
        { value: 'AOG_EMERGENCIA', label: 'AOG - Emergencia' },
        { value: 'TRASPASO_DEFINITIVO', label: 'Traspaso Definitivo' },
        { value: 'CALIBRACION_EXTERNA', label: 'Calibración Externa' },
        { value: 'REPARACION', label: 'Reparación' },
        { value: 'PRESTAMO_TEMPORAL', label: 'Préstamo Temporal' },
        { value: 'DEVOLUCION', label: 'Devolución a Base' }
    ];

    estados = [
        { value: 'SERVICEABLE', label: 'Serviceable' },
        { value: 'EN_CALIBRACION', label: 'En Calibración' },
        { value: 'UNSERVICEABLE', label: 'Unserviceable' },
        { value: 'NUEVO', label: 'Nuevo' }
    ];

    unidades = [
        { value: 'PZA', label: 'Pieza' },
        { value: 'EA', label: 'Each (c/u)' },
        { value: 'JGO', label: 'Juego' },
        { value: 'SET', label: 'Set' },
        { value: 'KIT', label: 'Kit' },
        { value: 'MT', label: 'Metro' },
        { value: 'LT', label: 'Litro' },
        { value: 'GL', label: 'Galón' }
    ];

    herramientas: HerramientaOption[] = [];
    filteredHerramientas: HerramientaOption[] = [];

    ngOnInit(): void {
        this.initForm();
        this.setupSearchListener();
        this.cargarHerramientas();

        if (this.isEditMode() && this.data?.item) {
            this.loadEditData(this.data.item);
        }
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private initForm(): void {
        this.enviarForm = this.fb.group({
            buscar: ['BOA-H-'], // Predeterminado
            codigo: [''],
            nombre: [''],
            pn: [''],
            sn: [''],
            marca: [''],
            existencia: [0],
            ubicacion: [''],
            fechaCalibracion: [''],
            unidad: ['PZA', Validators.required],
            estado: ['SERVICEABLE', Validators.required],
            cantidad: [1, [Validators.required, Validators.min(1)]],
            prioridad: [this.data?.prioridad || 'NORMAL', Validators.required],
            motivo: ['APOYO_OPERACIONAL', Validators.required],
            observacion: ['']
        });

        this.enviarForm.get('buscar')?.valueChanges.pipe(takeUntil(this._unsubscribeAll)).subscribe(val => {
            if (!val || !val.startsWith('BOA-H-')) {
                this.enviarForm.patchValue({ buscar: 'BOA-H-' }, { emitEvent: false });
            }
        });

        this.enviarForm.get('cantidad')?.valueChanges.pipe(takeUntil(this._unsubscribeAll)).subscribe(() => {
            this.validateCantidad();
        });
    }

    private cargarHerramientas(): void {
        this.isLoading = true;
        this.movementService.getHerramientasDisponibles().pipe(
            takeUntil(this._unsubscribeAll), finalize(() => this.isLoading = false)
        ).subscribe({
            next: (tools) => {
                this.herramientas = tools.map((t: any) => ({
                    toolId:          t.id_tool ?? t.id,
                    codigo:          t.code ?? t.codigo ?? '',
                    nombre:          t.name ?? t.nombre ?? '',
                    pn:              t.part_number ?? t.pn ?? '',
                    sn:              t.serial_number ?? t.sn ?? '',
                    marca:           t.brand ?? t.marca ?? '',
                    ubicacion:       t.warehouse_id ? `Almacen ${t.warehouse_id}` : '',
                    existencia:      t.quantity_in_stock ?? 0,
                    fechaCalibracion: t.next_calibration_date ?? '',
                    unidad:          t.unit_of_measure ?? 'PZA',
                    estado:          t.status ?? 'DISPONIBLE',
                    descripcion:     t.description ?? t.descripcion ?? '',
                    imagen:          t.image_url || null
                }));
                this.filteredHerramientas = [];
            },
            error: () => this.showMessage('Error al cargar herramientas', 'error')
        });
    }

    private setupSearchListener(): void {
        this.enviarForm.get('buscar')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll), debounceTime(300), distinctUntilChanged()
        ).subscribe(value => {
            this.onBuscarChange(value);
        });
    }

    onBuscarChange(value: string): void {
        if (!value || value.length <= 6) {
            this.filteredHerramientas = [];
            this.coincidencias.set(0);
            return;
        }

        this.isSearching.set(true);
        const searchTerm = value.toLowerCase().trim();
        this.filteredHerramientas = this.herramientas.filter(h =>
            h.codigo.toLowerCase().includes(searchTerm) ||
            h.nombre.toLowerCase().includes(searchTerm) ||
            h.pn.toLowerCase().includes(searchTerm)
        );
        this.coincidencias.set(this.filteredHerramientas.length);
        this.isSearching.set(false);
    }

    displayHerramienta = (h: any): string => h ? (h.codigo || '') : 'BOA-H-';

    limpiarBusqueda(): void {
        this.enviarForm.reset({
            buscar: 'BOA-H-', codigo: '', nombre: '', pn: '', sn: '', marca: '',
            existencia: 0, ubicacion: '', fechaCalibracion: '', unidad: 'PZA',
            estado: 'SERVICEABLE', cantidad: 1, prioridad: this.data?.prioridad || 'NORMAL',
            motivo: 'APOYO_OPERACIONAL', observacion: ''
        });
        this._selectedToolId = null;
        this.filteredHerramientas = [];
        this.coincidencias.set(0);
        this.imagenOriginal.set(null);
        this.selectedImage.set(null);
    }

    selectHerramienta(herramienta: HerramientaOption): void {
        this._selectedToolId = herramienta.toolId;
        this.enviarForm.patchValue({
            buscar: `${herramienta.codigo} - ${herramienta.nombre}`,
            codigo: herramienta.codigo,
            nombre: herramienta.nombre,
            pn: herramienta.pn,
            sn: herramienta.sn,
            marca: herramienta.marca,
            ubicacion: herramienta.ubicacion,
            existencia: herramienta.existencia,
            fechaCalibracion: herramienta.fechaCalibracion,
            unidad: this.unidades.some(u => u.value === herramienta.unidad) ? herramienta.unidad : 'PZA',
            estado: this.estados.some(e => e.value === herramienta.estado) ? herramienta.estado : 'SERVICEABLE',
            cantidad: 1
        });
        this.imagenOriginal.set(herramienta.imagen || null);
        this.coincidencias.set(1);
        this.filteredHerramientas = [];
        this.validateCantidad();
    }

    private validateCantidad(): void {
        const cantidad = this.enviarForm.get('cantidad')?.value;
        const existencia = this.enviarForm.get('existencia')?.value;

        if (existencia && cantidad && cantidad > existencia) {
            this.enviarForm.get('cantidad')?.setErrors({ excedeStock: true });
        } else if (cantidad < 1) {
            this.enviarForm.get('cantidad')?.setErrors({ min: true });
        } else {
            this.enviarForm.get('cantidad')?.setErrors(null);
        }
    }

    loadEditData(item: any): void {
        this._selectedToolId = item.toolId;
        this.enviarForm.patchValue({
            buscar: `${item.codigo} - ${item.descripcion || item.nombre}`,
            codigo: item.codigo,
            nombre: item.descripcion || item.nombre,
            pn: item.partNumber || item.pn,
            sn: item.serialNumber || item.sn,
            marca: item.marca || '',
            ubicacion: item.ubicacion || '',
            existencia: item.existencia || 0,
            fechaCalibracion: item.fechaCalibracion || '',
            unidad: item.um || item.unidad || 'PZA',
            estado: item.estado || 'SERVICEABLE',
            cantidad: item.cantidad || 1,
            prioridad: item.prioridad || 'NORMAL',
            motivo: item.motivo || 'APOYO_OPERACIONAL',
            observacion: item.observaciones || ''
        });
        if (item.imagenOriginal) this.imagenOriginal.set(item.imagenOriginal);
        if (item.imagen) this.selectedImage.set(item.imagen);
    }

    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { this.selectedImage.set(reader.result as string); };
        reader.readAsDataURL(file);
    }

    procesar(): void {
        this.enviarForm.markAllAsTouched();
        if (!this._selectedToolId) { this.enviarForm.get('buscar')?.markAsTouched(); return; }
        if (this.enviarForm.invalid) return;

        const formValue = this.enviarForm.getRawValue();
        const data = {
            toolId:          this._selectedToolId,
            id_tool:         this._selectedToolId,
            codigo:          formValue.codigo,
            nombre:          formValue.nombre,
            descripcion:     formValue.nombre,
            pn:              formValue.pn,
            part_number:     formValue.pn,
            sn:              formValue.sn,
            serial_number:   formValue.sn,
            marca:           formValue.marca,
            ubicacion:       formValue.ubicacion,
            existencia:      formValue.existencia,
            cantidad:        formValue.cantidad,
            unidad:          formValue.unidad,
            unit_of_measure: formValue.unidad,
            estadoFisico:    formValue.estado,
            prioridad:       formValue.prioridad,
            motivo:          formValue.motivo,
            observacion:     formValue.observacion,
            imagenOriginal:  this.imagenOriginal(),
            imagen:          this.selectedImage()
        };

        this.dialogRef?.close({ action: this.isEditMode() ? 'editar' : 'agregar', data, success: true });
    }

    cerrar(): void { this.dialogRef?.close(); }

    hasError(field: string, error: string): boolean {
        const control = this.enviarForm.get(field); return control ? control.hasError(error) && control.touched : false;
    }

    validarCantidadState(): boolean {
        const cantidad = this.enviarForm.get('cantidad')?.value || 0;
        const existencia = this.enviarForm.get('existencia')?.value || 0;
        if (existencia === 0) return true;
        return cantidad > 0 && cantidad <= existencia;
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'OK', { duration: 3000, panelClass: [`snackbar-${type}`] });
    }
}
