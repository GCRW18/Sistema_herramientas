import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

interface HerramientaOption {
    codigo: string;
    nombre: string;
    pn: string;
    sn: string;
    ubicacion: string;
    existencia: number;
    fechaVencimiento: string;
    unidad: string;
    estadoFisico: string;
    marca: string;
}

@Component({
    selector: 'app-traspaso-herramienta',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        FormsModule,
        ReactiveFormsModule,
        DragDropModule
    ],
    templateUrl: './traspaso-herramienta.component.html',
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
export class TraspasoHerramientaComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<TraspasoHerramientaComponent>, { optional: true });
    public data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);

    traspasoForm!: FormGroup;
    selectedImage = signal<string | null>(null);
    coincidencias = signal<number>(0);

    // Mock data for autocomplete
    herramientas: HerramientaOption[] = [
        { codigo: 'BOA-H-70001', nombre: 'JUEGO DE LLAVES MIXTAS', pn: 'JL-8-24', sn: 'SN-JL001', ubicacion: '20-A', existencia: 10, fechaVencimiento: 'N/A', unidad: 'SET', estadoFisico: 'BUENO', marca: 'STANLEY' },
        { codigo: 'BOA-H-70002', nombre: 'TALADRO PERCUTOR', pn: 'TP-750W', sn: 'SN-TP002', ubicacion: '21-B', existencia: 4, fechaVencimiento: '2026-01-15', unidad: 'PZA', estadoFisico: 'BUENO', marca: 'BOSCH' },
        { codigo: 'BOA-H-70003', nombre: 'MULTIMETRO DIGITAL', pn: 'MD-FLUKE', sn: 'SN-MD003', ubicacion: '22-C', existencia: 6, fechaVencimiento: '2025-06-30', unidad: 'EA', estadoFisico: 'REGULAR', marca: 'FLUKE' },
    ];

    filteredHerramientas: HerramientaOption[] = [];

    ngOnInit(): void {
        this.traspasoForm = this.fb.group({
            buscar: [''],
            codigo: [''],
            nombre: [''],
            pn: [''],
            sn: [''],
            ubicacion: [''],
            existencia: [''],
            fechaVencimiento: [''],
            unidad: [''],
            estadoFisico: [''],
            marca: [''],
            cantidad: [1],
            observacion: ['']
        });

        this.filteredHerramientas = [...this.herramientas];
    }

    onSelectHerramienta(event: Event): void {
        const codigo = (event.target as HTMLSelectElement).value;
        if (!codigo) return;

        const herramienta = this.herramientas.find(h => h.codigo === codigo);
        if (herramienta) {
            this.selectHerramienta(herramienta);
        }
    }

    onSelectByCodigo(event: Event): void {
        const codigo = (event.target as HTMLSelectElement).value;
        if (!codigo) return;

        const herramienta = this.herramientas.find(h => h.codigo === codigo);
        if (herramienta) {
            this.selectHerramienta(herramienta);
        }
    }

    selectHerramienta(herramienta: HerramientaOption): void {
        this.traspasoForm.patchValue({
            codigo: herramienta.codigo,
            nombre: herramienta.nombre,
            pn: herramienta.pn,
            sn: herramienta.sn,
            ubicacion: herramienta.ubicacion,
            existencia: herramienta.existencia,
            fechaVencimiento: herramienta.fechaVencimiento,
            unidad: herramienta.unidad,
            estadoFisico: herramienta.estadoFisico,
            marca: herramienta.marca
        });
        this.coincidencias.set(1);
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

    agregar(): void {
        if (this.traspasoForm.valid) {
            const data = this.traspasoForm.value;
            console.log('Agregar herramienta para traspaso:', data);
            this.dialogRef?.close({ action: 'agregar', data });
        }
    }

    cerrar(): void {
        this.dialogRef?.close();
    }
}
