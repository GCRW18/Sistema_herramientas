import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface HerramientaOption {
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
    fechaIngreso: string;
    documentoIngreso: string;
    imagen?: string;
}

@Component({
    selector: 'app-herramientas-a-prestar',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatInputModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDialogModule,
        MatDatepickerModule,
        MatNativeDateModule,
        FormsModule,
        ReactiveFormsModule,
        DragDropModule,
        MatProgressSpinnerModule,
        MatSnackBarModule
    ],
    templateUrl: './herramientas-a-prestar.component.html',
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

        .btn-icon-circle {
            width: 48px;
            height: 48px;
            background: white;
            border: 2px solid black;
            border-radius: 12px;
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            cursor: pointer;
        }

        :host-context(.dark) .btn-icon-circle {
            background: #1e293b;
        }

        .btn-icon-circle:hover {
            box-shadow: 2px 2px 0px 0px #000;
            transform: translate(1px, 1px);
        }

        .btn-icon-circle:active {
            box-shadow: none;
            transform: translate(3px, 3px);
        }

        .badge {
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            border: 1px solid;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .badge-warning {
            background: #f97316;
            color: white;
            border-color: #9a3412;
            box-shadow: 2px 2px 0px 0px rgba(0,0,0,0.5);
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

        .neo-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        .neo-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }

        .neo-scrollbar::-webkit-scrollbar-thumb {
            background: #000;
            border-radius: 3px;
        }

        :host-context(.dark) .neo-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
        }

        .form-group {
            display: flex;
            flex-direction: column;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(-5px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .animate-fadeIn {
            animation: fadeIn 0.2s ease-out forwards;
        }
    `]
})
export class HerramientasAPrestarComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<HerramientasAPrestarComponent>, { optional: true });
    public data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);

    prestarForm!: FormGroup;
    selectedImage = signal<string | null>(null);
    coincidencias = signal<number>(0);
    isLoading = false;

    herramientas: HerramientaOption[] = [
        {
            codigo: 'BOA-H-90001',
            nombre: 'TALADRO NEUMATICO',
            pn: 'PN-TAL-001',
            sn: 'SN-001',
            ubicacion: '15-A',
            base: 'LPB',
            existencia: 5,
            fechaVencimiento: '2025-12-31',
            unidad: 'PZA',
            estado: 'SERVICEABLE',
            fechaIngreso: '2024-01-15',
            documentoIngreso: 'CMR-001',
            imagen: 'assets/images/taladro.jpg'
        },
        {
            codigo: 'BOA-H-90002',
            nombre: 'TORQUIMETRO DIGITAL',
            pn: 'PN-TOR-002',
            sn: 'SN-002',
            ubicacion: '16-B',
            base: 'CBB',
            existencia: 3,
            fechaVencimiento: '2025-06-30',
            unidad: 'PZA',
            estado: 'EN CALIBRACION',
            fechaIngreso: '2024-02-20',
            documentoIngreso: 'CMR-002',
            imagen: 'assets/images/torquimetro.jpg'
        },
        {
            codigo: 'BOA-H-90003',
            nombre: 'MULTIMETRO FLUKE',
            pn: 'PN-MUL-003',
            sn: 'SN-003',
            ubicacion: '17-C',
            base: 'SCZ',
            existencia: 8,
            fechaVencimiento: '2025-09-15',
            unidad: 'EA',
            estado: 'SERVICEABLE',
            fechaIngreso: '2024-03-10',
            documentoIngreso: 'CMR-003',
            imagen: 'assets/images/multimetro.jpg'
        },
    ];

    ngOnInit(): void {
        this.initForm();
        this.coincidencias.set(this.herramientas.length);
    }

    private initForm(): void {
        const today = new Date().toISOString().split('T')[0];

        this.prestarForm = this.fb.group({
            buscar: [''],
            codigo: ['', Validators.required],
            nombre: ['', Validators.required],
            pn: [''],
            sn: [''],
            ubicacion: [''],
            base: [''],
            existencia: [0],
            fechaVencimiento: [''],
            unidad: [''],
            estado: ['', Validators.required],
            cantidad: [1, [Validators.required, Validators.min(1)]],
            observacion: [''],
            fechaIngreso: [today, Validators.required],
            documentoIngreso: ['', Validators.required]
        });

        // Watch for estado changes to update visual feedback
        this.prestarForm.get('estado')?.valueChanges.subscribe(value => {
            // Puedes agregar lógica adicional aquí si es necesario
        });

        // Watch for cantidad vs existencia
        this.prestarForm.get('cantidad')?.valueChanges.subscribe(cantidad => {
            const existencia = this.prestarForm.get('existencia')?.value;
            if (cantidad > existencia) {
                this.showMessage(`Cantidad (${cantidad}) excede existencia (${existencia})`, 'warning');
            }
        });
    }

    onBuscarChange(value: string): void {
        if (!value) {
            this.coincidencias.set(this.herramientas.length);
            return;
        }

        const searchTerm = value.toLowerCase();
        const filtered = this.herramientas.filter(h =>
            h.codigo.toLowerCase().includes(searchTerm) ||
            h.nombre.toLowerCase().includes(searchTerm) ||
            h.pn.toLowerCase().includes(searchTerm)
        );
        this.coincidencias.set(filtered.length);
    }

    onCodigoSelect(codigo: string): void {
        const herramienta = this.herramientas.find(h => h.codigo === codigo);
        if (herramienta) {
            this.loadHerramientaData(herramienta);
        }
    }

    private loadHerramientaData(herramienta: HerramientaOption): void {
        this.isLoading = true;

        // Simular carga de datos
        setTimeout(() => {
            this.prestarForm.patchValue({
                codigo: herramienta.codigo,
                nombre: herramienta.nombre,
                pn: herramienta.pn,
                sn: herramienta.sn,
                ubicacion: herramienta.ubicacion,
                base: herramienta.base,
                existencia: herramienta.existencia,
                fechaVencimiento: herramienta.fechaVencimiento,
                unidad: herramienta.unidad,
                estado: herramienta.estado,
                fechaIngreso: herramienta.fechaIngreso,
                documentoIngreso: herramienta.documentoIngreso
            });

            // Cargar imagen si existe
            if (herramienta.imagen) {
                this.selectedImage.set(herramienta.imagen);
            } else {
                this.selectedImage.set(null);
            }

            this.isLoading = false;
            this.showMessage(`Herramienta "${herramienta.codigo}" cargada`, 'success');
        }, 300);
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
        };
        reader.readAsDataURL(file);
    }

    procesarDevolucion(): void {
        this.showMessage('Función de procesar devolución en desarrollo', 'info');
    }

    agregar(): void {
        if (this.prestarForm.invalid) {
            this.prestarForm.markAllAsTouched();
            this.showMessage('Complete los campos requeridos', 'error');
            return;
        }

        const formValue = this.prestarForm.value;

        // Validar cantidad vs existencia
        if (formValue.cantidad > formValue.existencia) {
            this.showMessage(`No hay suficiente stock. Disponible: ${formValue.existencia}`, 'error');
            return;
        }

        // Validar fecha de vencimiento (si existe)
        if (formValue.fechaVencimiento) {
            const fechaVencimiento = new Date(formValue.fechaVencimiento);
            const hoy = new Date();
            if (fechaVencimiento < hoy) {
                if (!confirm('La herramienta está vencida. ¿Desea continuar?')) {
                    return;
                }
            }
        }

        const toolData = {
            ...formValue,
            imagen: this.selectedImage(),
            fechaRegistro: new Date().toISOString()
        };

        console.log('Agregar herramienta:', toolData);
        this.dialogRef?.close({
            action: 'agregar',
            data: toolData,
            success: true
        });

        this.showMessage('Herramienta agregada al préstamo', 'success');
    }

    cerrar(): void {
        if (this.prestarForm.dirty) {
            if (!confirm('Hay cambios sin guardar. ¿Desea salir?')) {
                return;
            }
        }
        this.dialogRef?.close();
    }

    private showMessage(message: string, type: string): void {
        this.snackBar.open(message, 'OK', {
            duration: 3000,
            panelClass: [`snackbar-${type}`]
        });
    }

    // Helper para mostrar errores de validación
    hasError(field: string, error: string): boolean {
        const control = this.prestarForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }
}
