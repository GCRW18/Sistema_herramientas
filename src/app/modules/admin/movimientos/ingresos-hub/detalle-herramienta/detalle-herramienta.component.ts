import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ToolService } from '../../../../../core/services/tool.service';

interface HerramientaOption {
    id_tool: number;
    codigo: string;
    pn: string;
    nombre: string;
    marca: string;
    tipo: string;
    sn: string;
    estado: string;
    ubicacion: string;
    um: string;
    imagen?: string;
}

@Component({
    selector: 'app-detalle-herramienta',
    standalone: true,
    imports: [
        CommonModule, MatIconModule, MatButtonModule, MatInputModule,
        MatFormFieldModule, MatSelectModule, MatDialogModule, MatAutocompleteModule,
        MatTooltipModule, MatProgressSpinnerModule, FormsModule, ReactiveFormsModule,
        DragDropModule
    ],
    templateUrl: './detalle-herramienta.component.html',
    styles: [`
        :host { display: block; width: 100%; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 0; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 0; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #fff; }
    `]
})
export class DetalleHerramientaComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<DetalleHerramientaComponent>, { optional: true });
    public data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);
    private toolService = inject(ToolService);
    private destroy$ = new Subject<void>();

    detalleForm!: FormGroup;
    isEditMode = signal<boolean>(false);
    isSearching = signal<boolean>(false);

    imagenOriginal = signal<string | null>(null);
    imagenNueva = signal<string | null>(null);

    estados = [
        { value: 'SERVICEABLE',    label: 'Serviceable' },
        { value: 'UNSERVICEABLE',  label: 'Unserviceable' },
        { value: 'EN_CALIBRACION', label: 'En Calibración' },
        { value: 'REPARACION',     label: 'En Reparación' },
        { value: 'NUEVO',          label: 'Nuevo' }
    ];

    unidades = [
        { value: 'PZA', label: 'Pieza' },
        { value: 'SET', label: 'Set/Juego' },
        { value: 'KIT', label: 'Kit' },
        { value: 'PAR', label: 'Par' },
        { value: 'UND', label: 'Unidad' },
        { value: 'MTS', label: 'Metros' },
        { value: 'LTS', label: 'Litros' }
    ];

    filteredHerramientas: HerramientaOption[] = [];

    ngOnInit(): void {
        this.initForm();

        if (this.data?.editItem) {
            this.isEditMode.set(true);
            this.loadEditData(this.data.editItem);
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initForm(): void {
        this.detalleForm = this.fb.group({
            buscar:        ['BOA-H-'], // Pre-escrito
            toolId:        [null, Validators.required],
            // Campos Maestro (Ocultos/Internos)
            codigo:        [''],
            pn:            [''],
            sn:            [''],
            nombre:        [''],
            marca:         [''],
            // Campos Ajuste
            cantidad:      [1, [Validators.required, Validators.min(1)]],
            um:            ['UND', Validators.required],
            estado:        ['SERVICEABLE', Validators.required],
            estante:       [''],
            nivelUbicacion:[''],
            observaciones: [''],
            tipoAjuste:    [this.data?.tipoAjuste || 'INVENTARIO']
        });

        // Forzar que el buscador siempre tenga BOA-H-
        this.detalleForm.get('buscar')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(val => {
            if (!val || !val.startsWith('BOA-H-')) {
                this.detalleForm.patchValue({ buscar: 'BOA-H-' }, { emitEvent: false });
            }
        });
    }

    private loadEditData(item: any): void {
        this.detalleForm.patchValue({
            toolId:        item.toolId,
            buscar:        item.codigoBoa + ' - ' + item.descripcion,
            codigo:        item.codigoBoa,
            pn:            item.pn,
            sn:            item.sn,
            nombre:        item.descripcion,
            marca:         item.marca,
            estado:        item.estado || 'SERVICEABLE',
            estante:       item.ubicacion ? item.ubicacion.split(' / ')[0] : '',
            nivelUbicacion:item.ubicacion ? item.ubicacion.split(' / ')[1] : '',
            um:            item.um || 'UND',
            cantidad:      item.cantidad || 1,
            observaciones: item.obs || '',
            tipoAjuste:    item.tipoAjuste || 'INVENTARIO'
        });
        if (item.imagenMaster) this.imagenOriginal.set(item.imagenMaster);
        if (item.imagenNueva) this.imagenNueva.set(item.imagenNueva);
    }

    displayHerramienta = (h: any): string => h ? (h.codigo || '') : 'BOA-H-';

    onBuscarChange(value: string): void {
        if (!value || value.length <= 6) {
            this.filteredHerramientas = [];
            return;
        }

        this.isSearching.set(true);
        this.toolService.getTools({ query: value }).pipe(
            takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged()
        ).subscribe({
            next: (tools: any[]) => {
                this.filteredHerramientas = tools.map(t => ({
                    id_tool:   t.id_tool,
                    codigo:    t.code || '',
                    pn:        t.part_number || '',
                    nombre:    t.name || t.description || '',
                    marca:     t.brand || '',
                    tipo:      t.category || '',
                    sn:        t.serial_number || '',
                    estado:    t.status || '',
                    ubicacion: t.location || t.location_id || '',
                    um:        t.unit_of_measure || 'UND',
                    imagen:    t.image_url || null
                }));
                this.isSearching.set(false);
            },
            error: () => {
                this.filteredHerramientas = [];
                this.isSearching.set(false);
            }
        });
    }

    selectHerramienta(herramienta: HerramientaOption): void {
        this.detalleForm.patchValue({
            toolId:    herramienta.id_tool,
            buscar:    `${herramienta.codigo} - ${herramienta.nombre}`,
            codigo:    herramienta.codigo,
            pn:        herramienta.pn,
            sn:        herramienta.sn,
            nombre:    herramienta.nombre,
            marca:     herramienta.marca,
            estado:    this.estados.some(e => e.value === herramienta.estado) ? herramienta.estado : 'SERVICEABLE',
            um:        this.unidades.some(u => u.value === herramienta.um) ? herramienta.um : 'UND'
        });
        this.imagenOriginal.set(herramienta.imagen || null);
        this.filteredHerramientas = [];
    }

    clearSearch(): void {
        this.detalleForm.reset({
            buscar: 'BOA-H-', toolId: null, codigo: '', pn: '', sn: '', nombre: '', marca: '',
            estado: 'SERVICEABLE', estante: '', nivelUbicacion: '', um: 'UND', cantidad: 1, observaciones: '',
            tipoAjuste: this.data?.tipoAjuste || 'INVENTARIO'
        });
        this.filteredHerramientas = [];
        this.imagenOriginal.set(null);
        this.imagenNueva.set(null);
    }

    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => { this.imagenNueva.set(reader.result as string); };
            reader.readAsDataURL(file);
        }
    }

    procesar(): void {
        this.detalleForm.markAllAsTouched();
        if (!this.detalleForm.get('toolId')?.value) {
            this.detalleForm.get('buscar')?.markAsTouched();
            return;
        }
        if (this.detalleForm.invalid) return;

        const rawData = this.detalleForm.getRawValue();
        const estante = rawData.estante?.trim();
        const nivel = rawData.nivelUbicacion?.trim();
        const ubicacionFinal = (estante && nivel) ? `${estante} / ${nivel}` : (estante || nivel || '');

        const finalData = {
            ...rawData,
            ubicacion: ubicacionFinal,
            imagenMaster: this.imagenOriginal(),
            imagenNueva: this.imagenNueva()
        };

        this.dialogRef?.close({ action: 'procesar', data: finalData });
    }

    cerrar(): void {
        this.dialogRef?.close();
    }

    // --- CORRECCIÓN: Método agregado para evitar el error de compilación ---
    hasError(field: string, error: string): boolean {
        const control = this.detalleForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }
}
