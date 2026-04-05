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
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
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
}

@Component({
    selector: 'app-detalle-herramienta',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatInputModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDialogModule,
        MatAutocompleteModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        FormsModule,
        ReactiveFormsModule,
        DragDropModule
    ],
    templateUrl: './detalle-herramienta.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 2px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
        }

        :host-context(.dark) {
            color-scheme: dark;
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

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class DetalleHerramientaComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<DetalleHerramientaComponent>, { optional: true });
    public data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);
    private toolService = inject(ToolService);
    private destroy$ = new Subject<void>();

    detalleForm!: FormGroup;
    crearNuevaForm!: FormGroup;
    selectedImage = signal<string | null>(null);
    coincidencias = signal<number>(0);
    isEditMode = signal<boolean>(false);
    isSearching = signal<boolean>(false);
    // Siempre false: ajuste ingreso solo trabaja con herramientas existentes
    showCrearNueva = signal<boolean>(false);

    // Listas estáticas requeridas por el template
    marcas: string[] = [
        'SNAP-ON', 'TOHNICHI', 'MITUTOYO', 'MALABAR', 'CLEVELAND', 'AIRBUS GSE',
        'BOEING GSE', 'ATLAS COPCO', 'INGERSOLL RAND', 'FACOM', 'STAHLWILLE',
        'HAZET', 'PROTO', 'WIHA', 'WERA', 'KNIPEX', 'GEDORE', 'BAHCO'
    ];
    tiposHerramienta: string[] = [
        'HERRAMIENTA MANUAL', 'HERRAMIENTA ELECTRICA', 'HERRAMIENTA NEUMATICA',
        'EQUIPO MEDICION', 'EQUIPO CALIBRACION', 'HERRAMIENTA ESPECIAL',
        'GSE AVIACION', 'EQUIPO PRUEBA', 'CONSUMIBLE'
    ];
    fabricaciones: string[] = [
        'NACIONAL', 'IMPORTADA', 'OEM', 'AFTERMARKET', 'CERTIFICADA FAA', 'CERTIFICADA EASA', 'CUSTOM'
    ];
    nivelesHerramienta: string[] = [
        'NIVEL 1 - BASICO', 'NIVEL 2 - INTERMEDIO', 'NIVEL 3 - AVANZADO',
        'NIVEL 4 - ESPECIALIZADO', 'NIVEL 5 - CRITICO'
    ];

    // Tipos de ajuste (estático)
    tiposAjuste = [
        { value: 'INVENTARIO',  label: 'Ajuste Inventario' },
        { value: 'REUBICACION', label: 'Reubicacion' },
        { value: 'DONACION',    label: 'Donacion Recibida' },
        { value: 'ENCONTRADO',  label: 'Item Encontrado' },
        { value: 'SOBRANTE',    label: 'Sobrante' },
        { value: 'CORRECCION',  label: 'Correccion Sistema' }
    ];

    // Estados de herramienta (estático)
    estados = [
        { value: 'SERVICEABLE',    label: 'Serviceable' },
        { value: 'UNSERVICEABLE',  label: 'Unserviceable' },
        { value: 'EN_CALIBRACION', label: 'En Calibracion' },
        { value: 'REPARACION',     label: 'En Reparacion' },
        { value: 'NUEVO',          label: 'Nuevo' }
    ];

    // Unidades de medida (estático)
    unidades = [
        { value: 'PZA', label: 'Pieza' },
        { value: 'SET', label: 'Set/Juego' },
        { value: 'KIT', label: 'Kit' },
        { value: 'PAR', label: 'Par' },
        { value: 'UND', label: 'Unidad' },
        { value: 'MTS', label: 'Metros' },
        { value: 'LTS', label: 'Litros' }
    ];

    // Resultados de búsqueda reales
    filteredHerramientas: HerramientaOption[] = [];

    ngOnInit(): void {
        this.initForm();
        this.setupSearch();

        if (this.data?.editItem) {
            this.isEditMode.set(true);
            this.loadEditData(this.data.editItem);
        }

        if (this.data?.tipoAjuste) {
            this.detalleForm.patchValue({ tipoAjuste: this.data.tipoAjuste });
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initForm(): void {
        this.crearNuevaForm = this.fb.group({
            codigoBoaMM: [''], fabricacion: [''], nombreNueva: [''],
            nivelHerramienta: [''], pnModelo: [''], snNueva: [''],
            marcaNueva: [''], tipoNueva: [''], accesorios: [''],
            requiereCalibracion: ['NO'], fechaVencimientoCalibracion: [''],
            fechaVencimiento: [''], unidadMedida: ['PZA'],
            costoHora: [0], costoServicio: [0], estante: [''], nivelUbicacion: ['']
        });

        this.detalleForm = this.fb.group({
            buscar:        [''],
            toolId:        [null],
            codigo:        [''],
            pn:            [''],
            nombre:        [''],
            marca:         [''],
            tipo:          [''],
            sn:            [''],
            estado:        ['SERVICEABLE'],
            ubicacion:     [''],
            um:            ['PZA'],
            cantidad:      [1],
            tipoAjuste:    ['INVENTARIO'],
            documento:     [''],
            observaciones: ['']
        });
    }

    private setupSearch(): void {
        this.detalleForm.get('buscar')?.valueChanges.pipe(
            takeUntil(this.destroy$),
            debounceTime(300),
            distinctUntilChanged()
        ).subscribe(value => {
            this.onBuscarChange(value);
        });
    }

    private loadEditData(item: any): void {
        this.detalleForm.patchValue({
            toolId:        item.toolId     || null,
            codigo:        item.codigoBoa  || '',
            pn:            item.pn         || '',
            nombre:        item.descripcion || '',
            marca:         item.marca      || '',
            sn:            item.sn         || '',
            estado:        item.estado     || 'SERVICEABLE',
            ubicacion:     item.ubicacion  || '',
            um:            item.um         || 'PZA',
            cantidad:      item.cantidad   || 1,
            tipoAjuste:    item.tipoAjuste || 'INVENTARIO',
            documento:     item.documentos || '',
            observaciones: item.obs        || ''
        });
    }

    onBuscarChange(value: string): void {
        if (!value || value.length < 2) {
            this.filteredHerramientas = [];
            this.coincidencias.set(0);
            return;
        }

        this.isSearching.set(true);
        this.toolService.getTools({ query: value }).pipe(
            takeUntil(this.destroy$)
        ).subscribe({
            next: (tools: any[]) => {
                this.filteredHerramientas = tools.map(t => ({
                    id_tool:   t.id_tool,
                    codigo:    t.code            || '',
                    pn:        t.part_number     || '',
                    nombre:    t.name            || t.description || '',
                    marca:     t.brand           || '',
                    tipo:      t.category        || '',
                    sn:        t.serial_number   || '',
                    estado:    t.status          || '',
                    ubicacion: t.location        || t.location_id || '',
                    um:        t.unit_of_measure || 'PZA'
                }));
                this.coincidencias.set(this.filteredHerramientas.length);
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
            codigo:    herramienta.codigo,
            pn:        herramienta.pn,
            nombre:    herramienta.nombre,
            marca:     herramienta.marca,
            tipo:      herramienta.tipo,
            sn:        herramienta.sn,
            estado:    herramienta.estado,
            ubicacion: herramienta.ubicacion,
            um:        herramienta.um
        });
        this.coincidencias.set(1);
        this.filteredHerramientas = [];
    }

    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => { this.selectedImage.set(reader.result as string); };
            reader.readAsDataURL(file);
        }
    }

    // Stubs — sección "Crear Nueva" deshabilitada (solo herramientas existentes)
    crearItem(): void {}
    volverADetalle(): void { this.showCrearNueva.set(false); }
    registrarNueva(): void {}
    finalizarNueva(): void {}
    generarCodigo(): void {}
    generarCodigoNueva(): void {}

    procesar(): void {
        const data = this.detalleForm.value;
        if (!data.toolId) {
            return;
        }
        this.dialogRef?.close({ action: 'procesar', data });
    }

    cerrar(): void {
        this.dialogRef?.close();
    }

    getEstadoClass(estado: string): string {
        switch (estado) {
            case 'SERVICEABLE':    return 'text-green-600';
            case 'UNSERVICEABLE':  return 'text-red-600';
            case 'EN_CALIBRACION': return 'text-yellow-600';
            case 'REPARACION':     return 'text-orange-600';
            case 'NUEVO':          return 'text-blue-600';
            default:               return 'text-gray-600';
        }
    }
}
