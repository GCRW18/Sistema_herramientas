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
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { MovementService } from '../../../../../core/services/movement.service';

interface HerramientaOption {
    id_tool?: number;
    codigo: string;
    nombre: string;
    pn: string;
    sn: string;
    base: string;
    existencia: number;
    estadoFisico: string;
    imagen?: string;
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
        MatProgressSpinnerModule
    ],
    templateUrl: './herramienta-a-baja.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
    `]
})
export class HerramientaABajaComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<HerramientaABajaComponent>, { optional: true });
    public data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);

    private _unsubscribeAll = new Subject<void>();

    bajaForm!: FormGroup;

    selectedImage = signal<string | null>(null);
    buscarTermino = signal<string>('');

    isLoading = false;
    showSuggestions = false;
    private id_tool_actual = 0;

    herramientas: HerramientaOption[] = [];
    herramientasFiltradas = signal<HerramientaOption[]>(this.herramientas);

    ngOnInit(): void {
        this.initForm();
        this.setupSearchListener();
        this.cargarHerramientas();

        if (this.data && this.data.codigo) {
            setTimeout(() => {
                const herramienta = this.herramientas.find(h => h.codigo === this.data.codigo);
                if (herramienta) {
                    this.loadHerramientaData(herramienta);
                }
            }, 500);
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
                                base:             t.warehouse_name ?? t.base_code ?? t.base ?? '',
                                existencia:       t.quantity_in_stock ?? t.existencia ?? 0,
                                estadoFisico:     conditionMap[rawCond] ?? 'REGULAR',
                            };
                        });
                        this.herramientasFiltradas.set(this.herramientas);
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
            codigo: [''],
            nombre: [''],
            pn: [''],
            sn: [''],
            base: [''],
            existencia: [0],
            estadoFisico: ['INSERVIBLE', Validators.required],
            cantidad: [1, [Validators.required, Validators.min(1)]],
            observacion: ['', Validators.required],
        });

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
        const searchControl = this.fb.control('');
        searchControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll), debounceTime(300), distinctUntilChanged())
            .subscribe(term => {
                this.buscarTermino.set(term || '');
                this.filtrarHerramientas(term || '');
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
        this.bajaForm.reset({ cantidad: 1, estadoFisico: 'INSERVIBLE', existencia: 0 });
        this.id_tool_actual = 0;
        this.selectedImage.set(null);
    }

    private filtrarHerramientas(term: string): void {
        if (!term || term.trim() === '') {
            this.herramientasFiltradas.set(this.herramientas);
            return;
        }
        const searchTerm = term.toLowerCase().trim();
        const filtered = this.herramientas.filter(h =>
            h.codigo.toLowerCase().includes(searchTerm) ||
            h.nombre.toLowerCase().includes(searchTerm) ||
            h.pn.toLowerCase().includes(searchTerm) ||
            h.sn.toLowerCase().includes(searchTerm)
        );
        this.herramientasFiltradas.set(filtered);
    }

    private loadHerramientaData(herramienta: HerramientaOption): void {
        this.bajaForm.patchValue({
            codigo: herramienta.codigo,
            nombre: herramienta.nombre,
            pn: herramienta.pn,
            sn: herramienta.sn,
            base: herramienta.base,
            existencia: herramienta.existencia,
            estadoFisico: 'INSERVIBLE',
            cantidad: 1,
            observacion: `Baja de herramienta: ${herramienta.codigo} - ${herramienta.nombre}`
        });

        this.selectedImage.set(herramienta.imagen ?? null);
        this.showMessage(`Ítem seleccionado correctamente`, 'success');
    }

    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            this.showMessage('La imagen no debe superar 5MB', 'error');
            return;
        }

        this.isLoading = true;
        const reader = new FileReader();

        reader.onload = () => {
            this.selectedImage.set(reader.result as string);
            this.isLoading = false;
            (event.target as HTMLInputElement).value = '';
        };
        reader.readAsDataURL(file);
    }

    isFormValid(): boolean {
        if (this.bajaForm.invalid || !this.bajaForm.get('codigo')?.value) return false;
        const cantidad = this.bajaForm.get('cantidad')?.value;
        const existencia = this.bajaForm.get('existencia')?.value;
        if (existencia > 0 && cantidad > existencia) return false;
        return true;
    }

    agregar(): void {
        if (this.bajaForm.invalid || !this.bajaForm.get('codigo')?.value) {
            this.bajaForm.markAllAsTouched();
            this.showMessage(`Debe buscar y seleccionar una herramienta`, 'error');
            return;
        }

        const formValue = this.bajaForm.value;

        const toolData = {
            ...formValue,
            id_tool: this.id_tool_actual,
            imagen: this.selectedImage(),
            modoIngreso: 'SISTEMA',
            fechaRegistro: new Date().toISOString(),
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
        };

        this.dialogRef?.close({ action: 'agregar', data: toolData, success: true });
    }

    cerrar(): void {
        this.dialogRef?.close();
    }

    hasError(field: string, error: string): boolean {
        const control = this.bajaForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'OK', { duration: 3000, panelClass: [`snackbar-${type}`], horizontalPosition: 'center', verticalPosition: 'top' });
    }
}
