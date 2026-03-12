import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { MovementService } from '../../../../../core/services/movement.service';

interface HerramientaOption {
    id_tool?: number;
    codigo: string;
    nombre: string;
    pn: string;
    sn: string;
    ubicacion: string;
    base: string;
    existencia: number;
    fechaVencimiento: string;
    unidad: string;
    estadoFisico: string;
    contenido: string;
    marca: string;
    imagen?: string;
    descripcion?: string;
}

@Component({
    selector: 'app-herramienta-a-baja',
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
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatCheckboxModule
    ],
    templateUrl: './herramienta-a-baja.component.html',
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
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base {
            background-color: #1e293b !important;
        }

        .spinner-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        :host-context(.dark) .spinner-overlay {
            background: rgba(0,0,0,0.7);
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

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .animate-fadeIn {
            animation: fadeIn 0.2s ease-out forwards;
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
    `]
})
export class HerramientaABajaComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<HerramientaABajaComponent>, { optional: true });
    public data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);

    private _unsubscribeAll = new Subject<void>();

    // Formulario
    bajaForm!: FormGroup;

    // Signals
    selectedImage = signal<string | null>(null);
    coincidencias = signal<number>(0);
    herramientaNoEnSistema = signal<boolean>(false);
    descripcionHerramienta = signal<string>('');
    buscarTermino = signal<string>('');

    // Estados
    isLoading = false;
    showSuggestions = false;
    private id_tool_actual = 0;

    // Datos de herramientas (cargados desde backend)
    herramientas: HerramientaOption[] = [
        {
            codigo: 'BOA-H-80001',
            nombre: 'COMPRESSOR DE ALTA',
            pn: 'CP-2002',
            sn: 'SN-001A',
            ubicacion: '10-A',
            base: 'CBB',
            existencia: 3,
            fechaVencimiento: '2025-12-31',
            unidad: 'PZA',
            estadoFisico: 'BUENO',
            contenido: 'COMPRESOR',
            marca: 'ATLAS COPCO',
            descripcion: 'Compresor de alta presión para uso aeronáutico, capacidad 20 BAR. Incluye mangueras y conectores. Mantenimiento preventivo cada 6 meses.'
        },
        {
            codigo: 'BOA-H-80002',
            nombre: 'BOMBA HIDRAULICA',
            pn: 'BH-3003',
            sn: 'SN-002B',
            ubicacion: '11-B',
            base: 'LPB',
            existencia: 2,
            fechaVencimiento: '2025-08-15',
            unidad: 'EA',
            estadoFisico: 'REGULAR',
            contenido: 'BOMBA',
            marca: 'PARKER',
            descripcion: 'Bomba hidráulica de presión, flujo 5 GPM. Presenta desgaste en sellos. Recomendada para mantenimiento mayor.'
        },
        {
            codigo: 'BOA-H-80003',
            nombre: 'GATO NEUMATICO 20T',
            pn: 'GN-4004',
            sn: 'SN-003C',
            ubicacion: '12-C',
            base: 'SRZ',
            existencia: 5,
            fechaVencimiento: '2026-03-20',
            unidad: 'PZA',
            estadoFisico: 'BUENO',
            contenido: 'GATO',
            marca: 'HEIN-WERNER',
            descripcion: 'Gato neumático industrial de 20 toneladas de capacidad. Ideal para hangares. Cumple con normativa ASME PASE-2019.'
        },
        {
            codigo: 'BOA-H-80004',
            nombre: 'MULTIMETRO DIGITAL',
            pn: 'FLUKE-87V',
            sn: 'SN-004D',
            ubicacion: '15-F',
            base: 'CBB',
            existencia: 8,
            fechaVencimiento: '2025-11-10',
            unidad: 'EA',
            estadoFisico: 'BUENO',
            contenido: 'MULTIMETRO',
            marca: 'FLUKE',
            descripcion: 'Multímetro digital True RMS. Precisión 0.05%. Incluye puntas de prueba y estuche.'
        },
        {
            codigo: 'BOA-H-80005',
            nombre: 'TORQUIMETRO DIGITAL',
            pn: 'TECH3FR250',
            sn: 'SN-005E',
            ubicacion: '08-G',
            base: 'TJA',
            existencia: 4,
            fechaVencimiento: '2026-01-25',
            unidad: 'PZA',
            estadoFisico: 'MALO',
            contenido: 'TORQUIMETRO',
            marca: 'SNAP-ON',
            descripcion: 'Torquímetro digital 50-250 lb-ft. Presenta falla en pantalla LCD. Requiere reparación o baja.'
        }
    ];

    bases: string[] = ['CBB', 'LPB', 'SRE', 'TJA', 'SRZ', 'CIJ', 'TDD', 'GYA', 'RIB', 'BYC'];

    // Herramientas filtradas para el select
    herramientasFiltradas = signal<HerramientaOption[]>(this.herramientas);

    ngOnInit(): void {
        this.initForm();
        this.setupSearchListener();
        this.coincidencias.set(this.herramientas.length);
        this.cargarHerramientas();

        // Si hay datos iniciales, cargarlos
        if (this.data) {
            this.loadInitialData(this.data);
        }
    }

    private cargarHerramientas(): void {
        const conditionMap: Record<string, string> = {
            available: 'BUENO', serviceable: 'BUENO', good: 'BUENO',
            repairable: 'REGULAR', repair: 'REGULAR', transitional: 'REGULAR',
            unserviceable: 'MALO', bad: 'MALO',
            damaged: 'INSERVIBLE', scrapped: 'INSERVIBLE'
        };

        this.movementService.getHerramientasDisponibles()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (tools: any[]) => {
                    if (tools.length > 0) {
                        this.herramientas = tools.map((t: any) => {
                            const rawCond = (t.condition ?? t.status ?? '').toLowerCase();
                            return {
                                id_tool:          t.id_tool ?? 0,
                                codigo:           t.code          ?? t.codigo        ?? '',
                                nombre:           t.name          ?? t.nombre        ?? '',
                                pn:               t.part_number   ?? t.pn            ?? '',
                                sn:               t.serial_number ?? t.sn            ?? '',
                                ubicacion:        t.location      ?? t.ubicacion     ?? '',
                                base:             t.warehouse_name ?? t.base_code ?? t.warehouse_id?.toString() ?? t.base ?? '',
                                existencia:       t.quantity_in_stock ?? t.existencia ?? 0,
                                fechaVencimiento: t.next_calibration_date ?? t.fechaVencimiento ?? '',
                                unidad:           t.unit_of_measure ?? t.unidad ?? 'PZA',
                                estadoFisico:     conditionMap[rawCond] ?? 'REGULAR',
                                contenido:        t.content_list  ?? t.contenido ?? '',
                                marca:            t.brand         ?? t.marca ?? '',
                                descripcion:      t.description   ?? t.descripcion ?? ''
                            };
                        });
                        this.herramientasFiltradas.set(this.herramientas);
                        this.coincidencias.set(this.herramientas.length);
                    }
                }
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private initForm(): void {
        this.bajaForm = this.fb.group({
            codigo: ['', Validators.required],
            nombre: ['', Validators.required],
            pn: [''],
            sn: [''],
            ubicacion: [''],
            base: [null],
            existencia: [0],
            fechaVencimiento: [''],
            unidad: [''],
            estadoFisico: [null, Validators.required],
            cantidad: [1, [Validators.required, Validators.min(1)]],
            observacion: ['', Validators.required],
            contenido: [''],
            marca: ['']
        });

        // Validación de cantidad vs existencia
        this.bajaForm.get('cantidad')?.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(cantidad => {
                const existencia = this.bajaForm.get('existencia')?.value;
                if (existencia > 0 && cantidad > existencia) {
                    this.bajaForm.get('cantidad')?.setErrors({ excedeExistencia: true });
                }
            });
    }

    private setupSearchListener(): void {
        // Creamos un control independiente para la búsqueda
        const searchControl = this.fb.control('');

        searchControl.valueChanges
            .pipe(
                takeUntil(this._unsubscribeAll),
                debounceTime(300),
                distinctUntilChanged()
            )
            .subscribe(term => {
                this.buscarTermino.set(term || '');
                this.filtrarHerramientas(term);
            });
    }

    onBuscarChange(value: string): void {
        this.buscarTermino.set(value);
        this.filtrarHerramientas(value);
        this.showSuggestions = value.length >= 2 && this.herramientasFiltradas().length > 0;
    }

    selectHerramienta(herramienta: HerramientaOption): void {
        this.id_tool_actual = herramienta.id_tool ?? 0;
        this.loadHerramientaData(herramienta);
        this.herramientaNoEnSistema.set(false);
        this.buscarTermino.set(`${herramienta.codigo} - ${herramienta.nombre}`);
        this.showSuggestions = false;
    }

    ocultarSugerencias(): void {
        setTimeout(() => { this.showSuggestions = false; }, 200);
    }

    limpiarBusqueda(): void {
        this.buscarTermino.set('');
        this.filtrarHerramientas('');
        this.showSuggestions = false;
    }

    private filtrarHerramientas(term: string): void {
        if (!term || term.trim() === '') {
            this.herramientasFiltradas.set(this.herramientas);
            this.coincidencias.set(this.herramientas.length);
            return;
        }

        const searchTerm = term.toLowerCase().trim();
        const filtered = this.herramientas.filter(h =>
            h.codigo.toLowerCase().includes(searchTerm) ||
            h.nombre.toLowerCase().includes(searchTerm) ||
            h.pn.toLowerCase().includes(searchTerm) ||
            h.sn.toLowerCase().includes(searchTerm) ||
            h.marca.toLowerCase().includes(searchTerm)
        );

        this.herramientasFiltradas.set(filtered);
        this.coincidencias.set(filtered.length);
    }

    private loadInitialData(data: any): void {
        if (data.codigo) {
            const herramienta = this.herramientas.find(h => h.codigo === data.codigo);
            if (herramienta) {
                this.loadHerramientaData(herramienta);
            } else {
                // Si no está en el sistema, activar modo manual
                this.herramientaNoEnSistema.set(true);
                this.bajaForm.patchValue(data);

                if (data.imagen) {
                    this.selectedImage.set(data.imagen);
                }
            }
        }
    }

    onCodigoSelect(codigo: string): void {
        if (!codigo) return;

        const herramienta = this.herramientas.find(h => h.codigo === codigo);
        if (herramienta) {
            this.id_tool_actual = herramienta.id_tool ?? 0;
            this.loadHerramientaData(herramienta);
            this.herramientaNoEnSistema.set(false);
        }
    }

    private loadHerramientaData(herramienta: HerramientaOption): void {
        this.bajaForm.patchValue({
            codigo: herramienta.codigo,
            nombre: herramienta.nombre,
            pn: herramienta.pn,
            sn: herramienta.sn,
            ubicacion: herramienta.ubicacion,
            base: herramienta.base,
            existencia: herramienta.existencia,
            fechaVencimiento: herramienta.fechaVencimiento,
            unidad: herramienta.unidad,
            estadoFisico: herramienta.estadoFisico,
            contenido: herramienta.contenido,
            marca: herramienta.marca,
            cantidad: 1,
            observacion: `Baja de herramienta: ${herramienta.codigo} - ${herramienta.nombre}`
        });

        this.selectedImage.set(herramienta.imagen ?? null);
        this.descripcionHerramienta.set(herramienta.descripcion || '');
        this.showMessage(`Herramienta ${herramienta.codigo} cargada correctamente`, 'success');
    }

    toggleHerramientaNoEnSistema(): void {
        const newValue = !this.herramientaNoEnSistema();
        this.herramientaNoEnSistema.set(newValue);

        if (newValue) {
            // Modo manual: limpiar y habilitar todo
            this.bajaForm.reset({
                cantidad: 1,
                estadoFisico: 'INSERVIBLE'
            });
            this.selectedImage.set(null);
            this.descripcionHerramienta.set('');
            this.coincidencias.set(this.herramientas.length);
            this.herramientasFiltradas.set(this.herramientas);
            this.buscarTermino.set('');
            this.showMessage('Modo ingreso manual activado - Complete los datos', 'info');
        } else {
            // Volver al modo normal
            this.showMessage('Modo selección del sistema activado', 'info');
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

        this.isLoading = true;
        const reader = new FileReader();

        reader.onload = () => {
            this.selectedImage.set(reader.result as string);
            this.isLoading = false;
            this.showMessage('Imagen cargada exitosamente', 'success');

            // Resetear el input file para poder subir la misma imagen nuevamente
            (event.target as HTMLInputElement).value = '';
        };

        reader.onerror = () => {
            this.isLoading = false;
            this.showMessage('Error al cargar la imagen', 'error');
        };

        reader.readAsDataURL(file);
    }

    removeImage(): void {
        this.selectedImage.set(null);
        this.showMessage('Imagen removida', 'info');
    }

    isFormValid(): boolean {
        if (this.bajaForm.invalid) return false;

        const cantidad = this.bajaForm.get('cantidad')?.value;
        const existencia = this.bajaForm.get('existencia')?.value;

        // Validar que la cantidad no exceda la existencia (solo si hay existencia definida)
        if (existencia > 0 && cantidad > existencia) return false;

        return true;
    }

    getCamposFaltantes(): string[] {
        const faltantes: string[] = [];

        if (!this.bajaForm.get('codigo')?.value) faltantes.push('Código');
        if (!this.bajaForm.get('nombre')?.value) faltantes.push('Nombre');
        if (!this.bajaForm.get('estadoFisico')?.value) faltantes.push('Estado Físico');
        if (!this.bajaForm.get('cantidad')?.value || this.bajaForm.get('cantidad')?.value < 1) faltantes.push('Cantidad');
        if (!this.bajaForm.get('observacion')?.value) faltantes.push('Motivo de Baja');

        return faltantes;
    }

    agregar(): void {
        // Validar formulario
        if (this.bajaForm.invalid) {
            this.bajaForm.markAllAsTouched();

            const camposFaltantes = this.getCamposFaltantes();
            if (camposFaltantes.length > 0) {
                this.showMessage(`Campos requeridos: ${camposFaltantes.join(', ')}`, 'error');
            } else {
                this.showMessage('Complete todos los campos requeridos', 'error');
            }
            return;
        }

        const formValue = this.bajaForm.value;

        // Validar cantidad
        if (formValue.cantidad < 1) {
            this.showMessage('La cantidad debe ser al menos 1', 'error');
            return;
        }

        // Validar cantidad vs existencia
        if (formValue.existencia > 0 && formValue.cantidad > formValue.existencia) {
            this.showMessage(`La cantidad (${formValue.cantidad}) excede la existencia disponible (${formValue.existencia})`, 'error');
            return;
        }

        // Preparar datos para enviar
        const toolData = {
            ...formValue,
            id_tool:      this.id_tool_actual,
            imagen: this.selectedImage(),
            descripcion: this.descripcionHerramienta(),
            modoIngreso: this.herramientaNoEnSistema() ? 'MANUAL' : 'SISTEMA',
            fechaRegistro: new Date().toISOString(),
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
        };

        console.log('✅ Herramienta preparada para baja:', toolData);

        this.dialogRef?.close({
            action: 'agregar',
            data: toolData,
            success: true
        });

        this.showMessage(`Herramienta ${toolData.codigo} agregada para baja`, 'success');
    }

    cerrar(): void {
        if (this.bajaForm.dirty) {
            if (!confirm('Hay cambios sin guardar. ¿Desea salir?')) {
                return;
            }
        }
        this.dialogRef?.close();
    }

    // Helpers para validación visual
    hasError(field: string, error: string): boolean {
        const control = this.bajaForm.get(field);
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
