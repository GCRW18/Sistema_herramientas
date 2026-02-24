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
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

interface HerramientaOption {
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
    imagen?: string;
    descripcion?: string;
}

interface DialogData {
    mode: 'add' | 'edit';
    item?: any;
    baseDestino?: string;
    tipoEnvio?: string;
}

@Component({
    selector: 'app-herramienta-a-enviar',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatInputModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDialogModule,
        FormsModule,
        ReactiveFormsModule,
        DragDropModule,
        MatAutocompleteModule,
        MatTooltipModule,
        MatSnackBarModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './herramienta-a-enviar.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 2px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
        }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 12px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base {
            background-color: #1e293b !important;
        }

        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #000;
            border-radius: 3px;
        }

        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
        }

        input:read-only {
            background-color: #f3f4f6;
            border-color: #9ca3af;
            cursor: not-allowed;
        }

        :host-context(.dark) input:read-only {
            background-color: #1f2937;
            border-color: #4b5563;
            color: #9ca3af;
        }

        :host-context(.dark) select option {
            background-color: #0F172A;
            color: white;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .animate-fadeIn {
            animation: fadeIn 0.2s ease-out forwards;
        }

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            pointer-events: none;
        }
    `]
})
export class HerramientaAEnviarComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<HerramientaAEnviarComponent>, { optional: true });
    public data = inject<DialogData>(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);

    private _unsubscribeAll = new Subject<void>();

    // Formulario
    enviarForm!: FormGroup;

    // Signals
    selectedImage = signal<string | null>(null);
    coincidencias = signal<number>(0);
    isEditMode = computed(() => this.data?.mode === 'edit');

    // Prioridades de envío
    prioridades = [
        { value: 'NORMAL', label: 'Normal', icon: 'schedule' },
        { value: 'URGENTE', label: 'Urgente', icon: 'priority_high' },
        { value: 'AOG', label: 'AOG - Aircraft On Ground', icon: 'warning' }
    ];

    // Motivos de envío
    motivosEnvio = [
        { value: 'APOYO_OPERACIONAL', label: 'Apoyo Operacional' },
        { value: 'MANTENIMIENTO_PROGRAMADO', label: 'Mantenimiento Programado' },
        { value: 'MANTENIMIENTO_NO_PROGRAMADO', label: 'Mantenimiento No Programado' },
        { value: 'AOG_EMERGENCIA', label: 'AOG - Emergencia' },
        { value: 'TRASPASO_DEFINITIVO', label: 'Traspaso Definitivo' },
        { value: 'CALIBRACION_EXTERNA', label: 'Calibración Externa' },
        { value: 'REPARACION', label: 'Reparación' },
        { value: 'PRESTAMO_TEMPORAL', label: 'Préstamo Temporal' },
        { value: 'DEVOLUCION', label: 'Devolución a Base Origen' }
    ];

    // Estados de herramientas
    estados = [
        { value: 'SERVICEABLE', label: 'Serviceable' },
        { value: 'EN_CALIBRACION', label: 'En Calibración' },
        { value: 'UNSERVICEABLE', label: 'Unserviceable' },
        { value: 'NUEVO', label: 'Nuevo' }
    ];

    // Unidades de medida
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

    // Mock data - Herramientas disponibles
    herramientas: HerramientaOption[] = [
        { codigo: 'BOA-H-0001', nombre: 'TORQUÍMETRO DIGITAL 50-250 IN-LB', pn: 'TRQ-2502D', sn: 'TRQ-2024-001', marca: 'SNAP-ON', ubicacion: 'VVI-EST-A1', existencia: 2, fechaCalibracion: '2025-06-15', unidad: 'PZA', estado: 'SERVICEABLE', descripcion: 'Torquímetro digital de alta precisión para aplicaciones aeronáuticas' },
        { codigo: 'BOA-H-0002', nombre: 'TORQUÍMETRO CLICK 150-750 IN-LB', pn: 'QC3R750A', sn: 'TRQ-2024-002', marca: 'SNAP-ON', ubicacion: 'VVI-EST-A1', existencia: 3, fechaCalibracion: '2025-08-20', unidad: 'PZA', estado: 'SERVICEABLE', descripcion: 'Torquímetro mecánico con sistema de clic audible' },
        { codigo: 'BOA-H-0003', nombre: 'CALIBRADOR DIGITAL 0-6"', pn: '500-196-30', sn: 'CAL-2024-001', marca: 'MITUTOYO', ubicacion: 'VVI-EST-A2', existencia: 5, fechaCalibracion: '2025-04-10', unidad: 'PZA', estado: 'SERVICEABLE', descripcion: 'Calibrador digital con resolución 0.01mm/0.0005"' },
        { codigo: 'BOA-H-0004', nombre: 'MICRÓMETRO EXTERIOR 0-1"', pn: '293-340-30', sn: 'MIC-2024-001', marca: 'MITUTOYO', ubicacion: 'VVI-EST-A2', existencia: 3, fechaCalibracion: '2025-05-22', unidad: 'PZA', estado: 'SERVICEABLE', descripcion: 'Micrómetro digital con salida de datos SPC' },
        { codigo: 'BOA-H-0005', nombre: 'INDICADOR DE CARÁTULA 0.001"', pn: '2416S', sn: 'IND-2024-001', marca: 'STARRETT', ubicacion: 'VVI-EST-A3', existencia: 4, fechaCalibracion: '2025-07-30', unidad: 'PZA', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0006', nombre: 'JUEGO GALGAS ESPESORES 32 HOJAS', pn: 'GFS-32', sn: 'N/A', marca: 'STARRETT', ubicacion: 'VVI-EST-A3', existencia: 6, fechaCalibracion: 'N/A', unidad: 'JGO', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0007', nombre: 'GATO HIDRÁULICO TRIPODE 10T', pn: 'MJ-10T-TP', sn: 'GAT-2024-001', marca: 'MALABAR', ubicacion: 'VVI-HAN-B1', existencia: 2, fechaCalibracion: '2025-12-01', unidad: 'PZA', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0008', nombre: 'GATO AXIAL COLA 15T', pn: 'MJ-15T-AX', sn: 'GAT-2024-002', marca: 'MALABAR', ubicacion: 'VVI-HAN-B1', existencia: 1, fechaCalibracion: '2025-11-15', unidad: 'PZA', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0009', nombre: 'BOROSCOPIO ARTICULADO 6MM', pn: 'VBS-6000A', sn: 'BOR-2024-001', marca: 'OLYMPUS', ubicacion: 'VVI-EST-C1', existencia: 1, fechaCalibracion: '2025-09-10', unidad: 'PZA', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0010', nombre: 'MULTÍMETRO DIGITAL FLUKE 87V', pn: 'FLUKE-87V', sn: 'FLK-2024-001', marca: 'FLUKE', ubicacion: 'VVI-EST-C2', existencia: 4, fechaCalibracion: '2025-10-05', unidad: 'PZA', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0011', nombre: 'PINZA AMPERIMÉTRICA 1000A', pn: 'FLUKE-376FC', sn: 'FLK-2024-002', marca: 'FLUKE', ubicacion: 'VVI-EST-C2', existencia: 3, fechaCalibracion: '2025-08-18', unidad: 'PZA', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0012', nombre: 'DETECTOR DE FUGAS ULTRASONIDO', pn: 'SDT-270', sn: 'SDT-2024-001', marca: 'SDT', ubicacion: 'VVI-EST-C3', existencia: 1, fechaCalibracion: '2025-07-25', unidad: 'PZA', estado: 'EN_CALIBRACION' },
        { codigo: 'BOA-H-0013', nombre: 'BOMBA HIDRÁULICA MANUAL 10000PSI', pn: 'P-462', sn: 'ENG-2024-001', marca: 'ENERPAC', ubicacion: 'VVI-HAN-B2', existencia: 2, fechaCalibracion: '2025-06-30', unidad: 'PZA', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0014', nombre: 'CILINDRO HIDRÁULICO 25T', pn: 'RC-256', sn: 'ENG-2024-002', marca: 'ENERPAC', ubicacion: 'VVI-HAN-B2', existencia: 2, fechaCalibracion: '2025-12-20', unidad: 'PZA', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0015', nombre: 'MEDIDOR DE ESPESOR ULTRASONIDO', pn: '38DL PLUS', sn: 'OLY-2024-001', marca: 'OLYMPUS', ubicacion: 'VVI-EST-C1', existencia: 2, fechaCalibracion: '2025-11-01', unidad: 'PZA', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0016', nombre: 'LÁMPARA UV PARA NDT', pn: 'UVS-40', sn: 'SPE-2024-001', marca: 'SPECTROLINE', ubicacion: 'VVI-EST-C4', existencia: 3, fechaCalibracion: '2026-02-15', unidad: 'PZA', estado: 'NUEVO' },
        { codigo: 'BOA-H-0017', nombre: 'JUEGO LLAVES MIXTAS 6-32MM', pn: 'GKMT-26', sn: 'N/A', marca: 'SNAP-ON', ubicacion: 'VVI-EST-D1', existencia: 8, fechaCalibracion: 'N/A', unidad: 'JGO', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0018', nombre: 'JUEGO DADOS 1/2" 10-36MM', pn: 'SWM-36', sn: 'N/A', marca: 'SNAP-ON', ubicacion: 'VVI-EST-D1', existencia: 6, fechaCalibracion: 'N/A', unidad: 'JGO', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0019', nombre: 'PISTOLA NEUMÁTICA 1/2"', pn: 'MG725', sn: 'ING-2024-001', marca: 'INGERSOLL RAND', ubicacion: 'VVI-HAN-B3', existencia: 4, fechaCalibracion: '2025-05-15', unidad: 'PZA', estado: 'SERVICEABLE' },
        { codigo: 'BOA-H-0020', nombre: 'REMACHADORA NEUMÁTICA', pn: 'CP-0351', sn: 'CP-2024-001', marca: 'CHICAGO PNEUMATIC', ubicacion: 'VVI-HAN-B3', existencia: 3, fechaCalibracion: '2025-04-20', unidad: 'PZA', estado: 'SERVICEABLE' }
    ];

    filteredHerramientas: HerramientaOption[] = [];

    ngOnInit(): void {
        this.initForm();
        this.setupSearchListener();

        // Inicializar lista filtrada
        this.filteredHerramientas = [...this.herramientas];
        this.coincidencias.set(this.herramientas.length);

        // Si está en modo edición, cargar los datos
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
            buscar: [''],
            codigo: ['', Validators.required],
            nombre: ['', Validators.required],
            pn: [''],
            sn: [''],
            marca: [''],
            ubicacion: [{ value: '', disabled: true }],
            existencia: [{ value: 0, disabled: true }],
            fechaCalibracion: [{ value: '', disabled: true }],
            unidad: ['PZA'],
            estado: ['SERVICEABLE'],
            cantidad: [1, [Validators.required, Validators.min(1)]],
            prioridad: ['NORMAL'],
            motivo: ['APOYO_OPERACIONAL'],
            observacion: ['']
        });

        // Validar cantidad vs existencia
        this.enviarForm.get('cantidad')?.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => {
                this.validateCantidad();
            });
    }

    private setupSearchListener(): void {
        this.enviarForm.get('buscar')?.valueChanges
            .pipe(
                takeUntil(this._unsubscribeAll),
                debounceTime(300),
                distinctUntilChanged()
            )
            .subscribe(value => {
                this.onBuscarChange(value);
            });
    }

    onBuscarChange(value: string): void {
        if (!value || value.trim() === '') {
            this.filteredHerramientas = [...this.herramientas];
            this.coincidencias.set(this.herramientas.length);
            return;
        }

        const searchTerm = value.toLowerCase().trim();
        this.filteredHerramientas = this.herramientas.filter(h =>
            h.codigo.toLowerCase().includes(searchTerm) ||
            h.nombre.toLowerCase().includes(searchTerm) ||
            h.pn.toLowerCase().includes(searchTerm) ||
            h.marca.toLowerCase().includes(searchTerm) ||
            (h.sn && h.sn.toLowerCase().includes(searchTerm))
        );

        this.coincidencias.set(this.filteredHerramientas.length);
    }

    limpiarBusqueda(): void {
        this.enviarForm.patchValue({ buscar: '' });
        this.filteredHerramientas = [...this.herramientas];
        this.coincidencias.set(this.herramientas.length);
    }

    private validateCantidad(): void {
        const cantidad = this.enviarForm.get('cantidad')?.value;
        const existencia = this.enviarForm.get('existencia')?.value;

        if (existencia && cantidad && cantidad > existencia) {
            this.enviarForm.get('cantidad')?.setErrors({ excedeStock: true });
        } else if (cantidad < 1) {
            this.enviarForm.get('cantidad')?.setErrors({ min: true });
        }
    }

    selectHerramienta(herramienta: HerramientaOption): void {
        this.enviarForm.patchValue({
            codigo: herramienta.codigo,
            nombre: herramienta.nombre,
            pn: herramienta.pn,
            sn: herramienta.sn,
            marca: herramienta.marca,
            ubicacion: herramienta.ubicacion,
            existencia: herramienta.existencia,
            fechaCalibracion: herramienta.fechaCalibracion,
            unidad: herramienta.unidad,
            estado: herramienta.estado,
            cantidad: 1
        });

        this.coincidencias.set(1);
        this.enviarForm.patchValue({ buscar: '' });
        this.filteredHerramientas = [...this.herramientas];

        this.showMessage(`Herramienta ${herramienta.codigo} seleccionada`, 'success');
    }

    loadEditData(item: any): void {
        this.enviarForm.patchValue({
            codigo: item.codigo,
            nombre: item.descripcion || item.nombre,
            pn: item.partNumber || item.pn,
            sn: item.serialNumber || item.sn,
            marca: item.marca || '',
            ubicacion: item.ubicacion || '',
            existencia: item.existencia || 0,
            fechaCalibracion: item.fechaCalibracion || '',
            unidad: item.unidad || 'PZA',
            estado: item.estado || 'SERVICEABLE',
            cantidad: item.cantidad || 1,
            prioridad: item.prioridad || 'NORMAL',
            motivo: item.motivo || 'APOYO_OPERACIONAL',
            observacion: item.observaciones || ''
        });

        if (item.imagen) {
            this.selectedImage.set(item.imagen);
        }
    }

    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        // Validar tamaño (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showMessage('La imagen no debe superar 5MB', 'error');
            return;
        }

        // Validar tipo
        if (!file.type.match('image/(jpeg|png|jpg|webp)')) {
            this.showMessage('Formato no válido. Use PNG, JPG o WEBP', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            this.selectedImage.set(reader.result as string);
            this.showMessage('Imagen cargada exitosamente', 'success');

            // Resetear el input file
            (event.target as HTMLInputElement).value = '';
        };

        reader.onerror = () => {
            this.showMessage('Error al cargar la imagen', 'error');
        };

        reader.readAsDataURL(file);
    }

    removeImage(): void {
        this.selectedImage.set(null);
        this.showMessage('Imagen removida', 'info');
    }

    validarCantidad(): boolean {
        const cantidad = this.enviarForm.get('cantidad')?.value || 0;
        const existencia = this.enviarForm.get('existencia')?.value || 0;

        if (existencia === 0) return true; // Si no hay existencia definida, no validamos
        return cantidad <= existencia;
    }

    getValidationMessage(): string {
        if (!this.enviarForm.get('codigo')?.value) return 'Seleccione una herramienta';
        if (!this.enviarForm.get('cantidad')?.value) return 'Ingrese la cantidad a enviar';
        if (this.enviarForm.get('cantidad')?.errors?.['excedeStock'])
            return `La cantidad excede el stock disponible (${this.enviarForm.get('existencia')?.value})`;
        if (this.enviarForm.invalid) return 'Complete los campos requeridos';
        return 'Completo - Listo para enviar';
    }

    procesar(): void {
        // Validar formulario
        if (this.enviarForm.invalid) {
            this.enviarForm.markAllAsTouched();

            if (!this.enviarForm.get('codigo')?.value) {
                this.showMessage('Seleccione una herramienta', 'error');
            } else if (!this.enviarForm.get('cantidad')?.value) {
                this.showMessage('Ingrese la cantidad a enviar', 'error');
            } else {
                this.showMessage('Complete todos los campos requeridos', 'error');
            }
            return;
        }

        // Validar cantidad vs stock
        if (!this.validarCantidad()) {
            this.showMessage('La cantidad excede el stock disponible', 'error');
            return;
        }

        const formValue = this.enviarForm.getRawValue();

        const data = {
            // Datos de la herramienta
            codigo: formValue.codigo,
            descripcion: formValue.nombre,
            partNumber: formValue.pn,
            serialNumber: formValue.sn,
            marca: formValue.marca,
            ubicacion: formValue.ubicacion,
            existencia: formValue.existencia,
            fechaCalibracion: formValue.fechaCalibracion,

            // Datos del envío
            cantidad: formValue.cantidad,
            unidad: formValue.unidad,
            estado: formValue.estado,
            prioridad: formValue.prioridad,
            motivo: formValue.motivo,
            observaciones: formValue.observacion,

            // Metadatos
            imagen: this.selectedImage(),
            fechaSeleccion: new Date().toISOString(),
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            baseDestino: this.data?.baseDestino || 'No especificada',
            tipoEnvio: this.data?.tipoEnvio || 'standard'
        };

        console.log('✅ Herramienta preparada para envío:', data);

        const action = this.isEditMode() ? 'editar' : 'agregar';

        this.dialogRef?.close({
            action,
            data,
            success: true
        });

        this.showMessage(
            `Herramienta ${formValue.codigo} ${this.isEditMode() ? 'actualizada' : 'agregada'} exitosamente`,
            'success'
        );
    }

    cerrar(): void {
        if (this.enviarForm.dirty && !this.isEditMode()) {
            if (!confirm('Hay cambios sin guardar. ¿Desea salir?')) {
                return;
            }
        }
        this.dialogRef?.close();
    }

    // Helpers para validación visual
    hasError(field: string, error: string): boolean {
        const control = this.enviarForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'OK', {
            duration: 3000,
            panelClass: [`snackbar-${type}`],
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
        });
    }
}
