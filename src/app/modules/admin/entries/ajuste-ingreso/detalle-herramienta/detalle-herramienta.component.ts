import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

interface HerramientaOption {
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

        /* Forzar esquema oscuro para inputs nativos en modo dark */
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
export class DetalleHerramientaComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<DetalleHerramientaComponent>, { optional: true });
    public data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);

    detalleForm!: FormGroup;
    crearNuevaForm!: FormGroup;
    selectedImage = signal<string | null>(null);
    coincidencias = signal<number>(0);
    isEditMode = signal<boolean>(false);
    showCrearNueva = signal<boolean>(false);

    // Tipos de ajuste
    tiposAjuste = [
        { value: 'INVENTARIO', label: 'Ajuste Inventario' },
        { value: 'REUBICACION', label: 'Reubicacion' },
        { value: 'DONACION', label: 'Donacion Recibida' },
        { value: 'ENCONTRADO', label: 'Item Encontrado' },
        { value: 'SOBRANTE', label: 'Sobrante' },
        { value: 'CORRECCION', label: 'Correccion Sistema' }
    ];

    // Estados de herramienta
    estados = [
        { value: 'SERVICEABLE', label: 'Serviceable' },
        { value: 'UNSERVICEABLE', label: 'Unserviceable' },
        { value: 'EN_CALIBRACION', label: 'En Calibracion' },
        { value: 'REPARACION', label: 'En Reparacion' },
        { value: 'NUEVO', label: 'Nuevo' }
    ];

    // Ubicaciones de almacen
    ubicaciones = [
        { value: 'EST-01-1', label: 'Estante 01 - Nivel 1' },
        { value: 'EST-01-2', label: 'Estante 01 - Nivel 2' },
        { value: 'EST-05-1', label: 'Estante 05 - Nivel 1' },
        { value: 'EST-09-3', label: 'Estante 09 - Nivel 3' },
        { value: 'EST-15-6', label: 'Estante 15 - Nivel 6' },
        { value: 'EST-17-4', label: 'Estante 17 - Nivel 4' },
        { value: 'EST-18-2', label: 'Estante 18 - Nivel 2' },
        { value: 'EST-22-1', label: 'Estante 22 - Nivel 1' },
        { value: 'RACK-A1', label: 'Rack A1 - Herramientas Grandes' },
        { value: 'RACK-B2', label: 'Rack B2 - Equipos Especiales' },
        { value: 'CAL-01', label: 'Area Calibracion' },
        { value: 'CUARENTENA', label: 'Cuarentena' }
    ];

    // Unidades de medida
    unidades = [
        { value: 'PZA', label: 'Pieza' },
        { value: 'SET', label: 'Set/Juego' },
        { value: 'KIT', label: 'Kit' },
        { value: 'PAR', label: 'Par' },
        { value: 'UND', label: 'Unidad' },
        { value: 'MTS', label: 'Metros' },
        { value: 'LTS', label: 'Litros' }
    ];

    // Marcas comunes de herramientas de aviacion
    marcas = [
        'SNAP-ON', 'TOHNICHI', 'MITUTOYO', 'MALABAR', 'CLEVELAND', 'AIRBUS GSE',
        'BOEING GSE', 'ATLAS COPCO', 'INGERSOLL RAND', 'FACOM', 'STAHLWILLE',
        'HAZET', 'PROTO', 'WIHA', 'WERA', 'KNIPEX', 'GEDORE', 'BAHCO'
    ];

    // Tipos de herramienta
    tiposHerramienta = [
        'HERRAMIENTA MANUAL', 'HERRAMIENTA ELECTRICA', 'HERRAMIENTA NEUMATICA',
        'EQUIPO MEDICION', 'EQUIPO CALIBRACION', 'HERRAMIENTA ESPECIAL',
        'GSE AVIACION', 'EQUIPO PRUEBA', 'CONSUMIBLE'
    ];

    // Fabricaciones (H1.png)
    fabricaciones = [
        'NACIONAL', 'IMPORTADA', 'OEM', 'AFTERMARKET', 'CERTIFICADA FAA',
        'CERTIFICADA EASA', 'CUSTOM'
    ];

    // Niveles de herramienta (H1.png)
    nivelesHerramienta = [
        'NIVEL 1 - BASICO', 'NIVEL 2 - INTERMEDIO', 'NIVEL 3 - AVANZADO',
        'NIVEL 4 - ESPECIALIZADO', 'NIVEL 5 - CRITICO'
    ];

    // Mock data para autocompletar herramientas BoA
    herramientas: HerramientaOption[] = [
        { codigo: 'BOA-H-0156', pn: 'F27537000', nombre: 'TOOL REMOVAL ASSY MLG BEARING', marca: 'SNAP-ON', tipo: 'HERRAMIENTA ESPECIAL', sn: 'SN-44116', estado: 'SERVICEABLE', ubicacion: 'EST-17-4', um: 'PZA' },
        { codigo: 'BOA-H-0289', pn: 'TRQ-250-1000', nombre: 'TORQUIMETRO DIGITAL 250-1000 LB/FT', marca: 'TOHNICHI', tipo: 'EQUIPO MEDICION', sn: 'TQ-78523', estado: 'EN_CALIBRACION', ubicacion: 'EST-18-2', um: 'PZA' },
        { codigo: 'BOA-H-0412', pn: 'MS21250-05020', nombre: 'BROCAS AVIATION SET 5-20MM', marca: 'CLEVELAND', tipo: 'CONSUMIBLE', sn: 'N/A', estado: 'NUEVO', ubicacion: 'EST-05-1', um: 'SET' },
        { codigo: 'BOA-H-0523', pn: 'DG-CALIPER-6', nombre: 'CALIBRADOR DIGITAL 6 PULGADAS', marca: 'MITUTOYO', tipo: 'EQUIPO MEDICION', sn: 'MIT-112847', estado: 'SERVICEABLE', ubicacion: 'EST-09-3', um: 'PZA' },
        { codigo: 'BOA-H-0634', pn: 'HYD-PRESS-3000', nombre: 'GATO HIDRAULICO 3 TON', marca: 'MALABAR', tipo: 'GSE AVIACION', sn: 'ML-45672', estado: 'SERVICEABLE', ubicacion: 'EST-22-1', um: 'PZA' },
        { codigo: 'BOA-H-0745', pn: 'E32-101-550', nombre: 'EXTRACTOR BEARING NLG A330', marca: 'AIRBUS GSE', tipo: 'HERRAMIENTA ESPECIAL', sn: 'AB-99234', estado: 'UNSERVICEABLE', ubicacion: 'EST-15-6', um: 'PZA' },
        { codigo: 'BOA-H-0856', pn: 'TRQ-50-250', nombre: 'TORQUIMETRO CLICK 50-250 LB/IN', marca: 'SNAP-ON', tipo: 'EQUIPO MEDICION', sn: 'SN-88712', estado: 'SERVICEABLE', ubicacion: 'EST-18-2', um: 'PZA' },
        { codigo: 'BOA-H-0967', pn: 'BORE-GAUGE-SET', nombre: 'BORE GAUGE SET 50-150MM', marca: 'MITUTOYO', tipo: 'EQUIPO MEDICION', sn: 'MIT-334521', estado: 'SERVICEABLE', ubicacion: 'EST-09-3', um: 'SET' },
        { codigo: 'BOA-H-1078', pn: 'RIVET-GUN-3X', nombre: 'PISTOLA REMACHADORA NEUMATICA 3X', marca: 'ATLAS COPCO', tipo: 'HERRAMIENTA NEUMATICA', sn: 'AC-776234', estado: 'SERVICEABLE', ubicacion: 'RACK-A1', um: 'PZA' },
        { codigo: 'BOA-H-1189', pn: 'DRILL-90DEG', nombre: 'TALADRO ANGULAR 90 GRADOS', marca: 'INGERSOLL RAND', tipo: 'HERRAMIENTA NEUMATICA', sn: 'IR-445623', estado: 'REPARACION', ubicacion: 'CUARENTENA', um: 'PZA' },
        { codigo: 'BOA-H-1290', pn: 'MULTIMETER-FLUKE', nombre: 'MULTIMETRO DIGITAL FLUKE 87V', marca: 'FLUKE', tipo: 'EQUIPO PRUEBA', sn: 'FL-998877', estado: 'SERVICEABLE', ubicacion: 'EST-09-3', um: 'PZA' },
        { codigo: 'BOA-H-1401', pn: 'BOROSCOPE-HD', nombre: 'BOROSCOPIO HD 6MM X 3M', marca: 'OLYMPUS', tipo: 'EQUIPO PRUEBA', sn: 'OL-554433', estado: 'SERVICEABLE', ubicacion: 'RACK-B2', um: 'PZA' },
        { codigo: 'BOA-H-1512', pn: 'SAFETY-WIRE-SET', nombre: 'KIT ALAMBRE DE SEGURIDAD', marca: 'SNAP-ON', tipo: 'CONSUMIBLE', sn: 'N/A', estado: 'NUEVO', ubicacion: 'EST-05-1', um: 'KIT' },
        { codigo: 'BOA-H-1623', pn: 'SOCKET-SET-METRIC', nombre: 'JUEGO DADOS METRICOS 1/2"', marca: 'SNAP-ON', tipo: 'HERRAMIENTA MANUAL', sn: 'SN-112233', estado: 'SERVICEABLE', ubicacion: 'EST-01-1', um: 'SET' },
        { codigo: 'BOA-H-1734', pn: 'HEX-KEY-SET-MM', nombre: 'JUEGO LLAVES ALLEN MM', marca: 'WIHA', tipo: 'HERRAMIENTA MANUAL', sn: 'N/A', estado: 'SERVICEABLE', ubicacion: 'EST-01-2', um: 'SET' }
    ];

    filteredHerramientas: HerramientaOption[] = [];

    ngOnInit(): void {
        this.initForm();
        this.initCrearNuevaForm();
        this.filteredHerramientas = [...this.herramientas];

        // Si viene data para edicion
        if (this.data?.editItem) {
            this.isEditMode.set(true);
            this.loadEditData(this.data.editItem);
        }

        // Si viene un tipo de ajuste preseleccionado
        if (this.data?.tipoAjuste) {
            this.detalleForm.patchValue({ tipoAjuste: this.data.tipoAjuste });
        }
    }

    private initForm(): void {
        this.detalleForm = this.fb.group({
            buscar: [''],
            codigo: [''],
            pn: [''],
            nombre: [''],
            marca: [''],
            tipo: [''],
            sn: [''],
            estado: ['SERVICEABLE'],
            ubicacion: [''],
            um: ['PZA'],
            cantidad: [1],
            tipoAjuste: ['INVENTARIO'],
            documento: [''],
            observaciones: ['']
        });
    }

    private initCrearNuevaForm(): void {
        this.crearNuevaForm = this.fb.group({
            codigoBoaMM: [''],
            fabricacion: [''],
            nombreNueva: [''],
            nivelHerramienta: [''],
            pnModelo: [''],
            snNueva: [''],
            marcaNueva: [''],
            tipoNueva: [''],
            accesorios: [''],
            requiereCalibracion: ['NO'],
            fechaVencimientoCalibracion: [''],
            fechaVencimiento: [''],
            unidadMedida: ['PZA'],
            costoHora: [0],
            costoServicio: [0],
            estante: [''],
            nivelUbicacion: ['']
        });
    }

    private loadEditData(item: any): void {
        this.detalleForm.patchValue({
            codigo: item.codigoBoa || '',
            pn: item.pn || '',
            nombre: item.descripcion || '',
            marca: item.marca || '',
            sn: item.sn || '',
            estado: item.estado || 'SERVICEABLE',
            ubicacion: item.ubicacion || '',
            um: item.um || 'PZA',
            cantidad: item.cantidad || 1,
            tipoAjuste: item.tipoAjuste || 'INVENTARIO',
            documento: item.documentos || '',
            observaciones: item.obs || ''
        });
    }

    onBuscarChange(value: string): void {
        if (!value) {
            this.filteredHerramientas = [...this.herramientas];
            this.coincidencias.set(0);
            return;
        }

        const searchTerm = value.toLowerCase();
        this.filteredHerramientas = this.herramientas.filter(h =>
            h.codigo.toLowerCase().includes(searchTerm) ||
            h.pn.toLowerCase().includes(searchTerm) ||
            h.nombre.toLowerCase().includes(searchTerm) ||
            h.marca.toLowerCase().includes(searchTerm)
        );
        this.coincidencias.set(this.filteredHerramientas.length);
    }

    selectHerramienta(herramienta: HerramientaOption): void {
        this.detalleForm.patchValue({
            codigo: herramienta.codigo,
            pn: herramienta.pn,
            nombre: herramienta.nombre,
            marca: herramienta.marca,
            tipo: herramienta.tipo,
            sn: herramienta.sn,
            estado: herramienta.estado,
            ubicacion: herramienta.ubicacion,
            um: herramienta.um
        });
        this.coincidencias.set(1);
    }

    displayHerramienta(h: HerramientaOption): string {
        return h ? `${h.codigo} - ${h.nombre}` : '';
    }

    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                this.selectedImage.set(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    }

    generarCodigo(): void {
        const correlativo = Math.floor(Math.random() * 9000) + 1000;
        const codigo = `BOA-H-${correlativo}`;
        this.detalleForm.patchValue({ codigo });
    }

    generarCodigoNueva(): void {
        const correlativo = Math.floor(Math.random() * 900) + 10;
        const codigo = `BOA-H-${correlativo}`;
        this.crearNuevaForm.patchValue({ codigoBoaMM: codigo });
    }

    crearItem(): void {
        // Cambiar a modo "Crear Nueva Herramienta"
        this.showCrearNueva.set(true);
        this.crearNuevaForm.reset({
            requiereCalibracion: 'NO',
            unidadMedida: 'PZA',
            costoHora: 0,
            costoServicio: 0
        });
        this.selectedImage.set(null);
    }

    volverADetalle(): void {
        this.showCrearNueva.set(false);
    }

    registrarNueva(): void {
        const data = this.crearNuevaForm.value;
        const ubicacion = data.estante && data.nivelUbicacion
            ? `${data.estante}-${data.nivelUbicacion}`
            : '';

        // Cerrar el dialogo con los datos para agregar al ajuste
        this.dialogRef?.close({
            action: 'procesar',
            data: {
                codigo: data.codigoBoaMM,
                pn: data.pnModelo,
                nombre: data.nombreNueva,
                marca: data.marcaNueva,
                sn: data.snNueva,
                estado: 'NUEVO',
                ubicacion: ubicacion,
                um: data.unidadMedida,
                cantidad: 1,
                tipoAjuste: this.data?.tipoAjuste || 'INVENTARIO',
                documento: '',
                observaciones: `Fabricacion: ${data.fabricacion} | Nivel: ${data.nivelHerramienta} | Tipo: ${data.tipoNueva}`,
                // Datos extra de la nueva herramienta
                fabricacion: data.fabricacion,
                nivelHerramienta: data.nivelHerramienta,
                tipo: data.tipoNueva,
                accesorios: data.accesorios,
                requiereCalibracion: data.requiereCalibracion,
                fechaVencimientoCalibracion: data.fechaVencimientoCalibracion,
                fechaVencimiento: data.fechaVencimiento,
                costoHora: data.costoHora,
                costoServicio: data.costoServicio,
                estante: data.estante,
                nivelUbicacion: data.nivelUbicacion
            }
        });
    }

    finalizarNueva(): void {
        // Misma accion que registrar pero con flag de finalizar
        const data = this.crearNuevaForm.value;
        const ubicacion = data.estante && data.nivelUbicacion
            ? `${data.estante}-${data.nivelUbicacion}`
            : '';

        this.dialogRef?.close({
            action: 'procesar',
            finalizar: true,
            data: {
                codigo: data.codigoBoaMM,
                pn: data.pnModelo,
                nombre: data.nombreNueva,
                marca: data.marcaNueva,
                sn: data.snNueva,
                estado: 'NUEVO',
                ubicacion: ubicacion,
                um: data.unidadMedida,
                cantidad: 1,
                tipoAjuste: this.data?.tipoAjuste || 'INVENTARIO',
                documento: '',
                observaciones: `Fabricacion: ${data.fabricacion} | Nivel: ${data.nivelHerramienta} | Tipo: ${data.tipoNueva}`,
                fabricacion: data.fabricacion,
                nivelHerramienta: data.nivelHerramienta,
                tipo: data.tipoNueva,
                accesorios: data.accesorios,
                requiereCalibracion: data.requiereCalibracion,
                fechaVencimientoCalibracion: data.fechaVencimientoCalibracion,
                fechaVencimiento: data.fechaVencimiento,
                costoHora: data.costoHora,
                costoServicio: data.costoServicio,
                estante: data.estante,
                nivelUbicacion: data.nivelUbicacion
            }
        });
    }

    procesar(): void {
        if (this.detalleForm.valid) {
            const data = this.detalleForm.value;
            console.log('Procesar detalle:', data);
            this.dialogRef?.close({ action: 'procesar', data });
        }
    }

    cerrar(): void {
        this.dialogRef?.close();
    }

    getEstadoClass(estado: string): string {
        switch (estado) {
            case 'SERVICEABLE': return 'text-green-600';
            case 'UNSERVICEABLE': return 'text-red-600';
            case 'EN_CALIBRACION': return 'text-yellow-600';
            case 'REPARACION': return 'text-orange-600';
            case 'NUEVO': return 'text-blue-600';
            default: return 'text-gray-600';
        }
    }
}
