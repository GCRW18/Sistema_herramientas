import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

interface HerramientaOption {
    codigo: string;
    pn: string;
    nombre: string;
    sn: string;
    estado: string;
    ubicacion: string;
    um: string;
}

@Component({
    selector: 'app-herramientas-a-ingresar',
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
        DragDropModule
    ],
    templateUrl: './herramientas-a-ingresar.component.html',
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
export class HerramientasAIngresarComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<HerramientasAIngresarComponent>, { optional: true });
    public data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);

    ingresoForm!: FormGroup;
    selectedImage = signal<string | null>(null);
    coincidencias = signal<number>(0);

    // Mock data for autocomplete
    herramientas: HerramientaOption[] = [
        { codigo: 'BOA-H-83272', pn: 'BU-2581-AQ BU-2581-KB', nombre: 'REGULADOR DE NITROGENO', sn: 'NONE', estado: 'SERVICEABLE', ubicacion: 'BASE-LPB', um: 'EA' },
        { codigo: 'BOA-H-83273', pn: 'BU-2582-AQ', nombre: 'MANOMETRO DIGITAL', sn: '12345', estado: 'SERVICEABLE', ubicacion: 'BASE-CBB', um: 'EA' },
        { codigo: 'BOA-H-83274', pn: 'BU-2583-KB', nombre: 'LLAVE TORQUE 50-250', sn: '67890', estado: 'EN CALIBRACION', ubicacion: 'BASE-SCZ', um: 'PZA' },
    ];

    filteredHerramientas: HerramientaOption[] = [];

    ngOnInit(): void {
        this.ingresoForm = this.fb.group({
            buscar: [''],
            codigo: [''],
            pn: [''],
            nombre: [''],
            sn: [''],
            estado: [''],
            ubicacion: [''],
            um: [''],
            cantidad: [1],
            documento: [''],
            observaciones: ['']
        });

        this.filteredHerramientas = [...this.herramientas];
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
            h.nombre.toLowerCase().includes(searchTerm)
        );
        this.coincidencias.set(this.filteredHerramientas.length);
    }

    selectHerramienta(codigoValue: string): void {
        if (!codigoValue) {
            this.coincidencias.set(0);
            return;
        }

        const herramienta = this.herramientas.find(h => h.codigo === codigoValue);
        if (herramienta) {
            this.ingresoForm.patchValue({
                codigo: herramienta.codigo,
                pn: herramienta.pn,
                nombre: herramienta.nombre,
                sn: herramienta.sn,
                estado: herramienta.estado,
                ubicacion: herramienta.ubicacion,
                um: herramienta.um
            });
            this.coincidencias.set(1);
        }
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

    crearItem(): void {
        console.log('Crear nuevo item');
        // Limpiar formulario para permitir nuevo item
        this.ingresoForm.reset({
            cantidad: 1
        });
        this.selectedImage.set(null);
        this.coincidencias.set(0);
    }

    procesar(): void {
        if (this.ingresoForm.valid) {
            const data = this.ingresoForm.value;
            console.log('Procesar ingreso:', data);
            this.dialogRef?.close({ action: 'procesar', data });
        }
    }

    cerrar(): void {
        this.dialogRef?.close();
    }
}
