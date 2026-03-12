import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';
import { MovementService } from '../../../../../core/services/movement.service';

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
export class TraspasoHerramientaComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<TraspasoHerramientaComponent>, { optional: true });
    public data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);
    private movementService = inject(MovementService);
    private destroy$ = new Subject<void>();

    traspasoForm!: FormGroup;
    selectedImage = signal<string | null>(null);
    coincidencias = signal<number>(0);
    isLoading = false;

    herramientas: any[] = [];
    filteredHerramientas: any[] = [];

    ngOnInit(): void {
        this.traspasoForm = this.fb.group({
            buscar: [''],
            id_tool: [null],
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

        this.cargarHerramientas();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private cargarHerramientas(): void {
        this.isLoading = true;
        this.movementService.getHerramientasDisponibles({ status: 'DISPONIBLE' }).pipe(
            takeUntil(this.destroy$)
        ).subscribe({
            next: (tools) => {
                this.herramientas = tools.map((t: any) => ({
                    id_tool:          t.id_tool,
                    codigo:           t.code        ?? t.codigo,
                    nombre:           t.name        ?? t.nombre,
                    pn:               t.part_number ?? t.pn ?? '',
                    sn:               t.serial_number ?? t.sn ?? '',
                    ubicacion:        t.location    ?? t.ubicacion ?? '',
                    existencia:       t.quantity_in_stock ?? t.existencia ?? 0,
                    unidad:           t.unit_of_measure ?? t.unidad ?? 'PZA',
                    estadoFisico:     t.status      ?? 'DISPONIBLE',
                    marca:            t.brand       ?? t.marca ?? ''
                }));
                this.filteredHerramientas = [...this.herramientas];
                this.coincidencias.set(this.herramientas.length);
                this.isLoading = false;
            },
            error: () => { this.isLoading = false; }
        });
    }

    onSelectHerramienta(event: Event): void {
        const codigo = (event.target as HTMLSelectElement).value;
        if (!codigo) return;
        const h = this.herramientas.find(t => t.codigo === codigo);
        if (h) this.selectHerramienta(h);
    }

    onSelectByCodigo(event: Event): void {
        const codigo = (event.target as HTMLSelectElement).value;
        if (!codigo) return;
        const h = this.herramientas.find(t => t.codigo === codigo);
        if (h) this.selectHerramienta(h);
    }

    selectHerramienta(h: any): void {
        this.traspasoForm.patchValue({
            id_tool:      h.id_tool,
            codigo:       h.codigo,
            nombre:       h.nombre,
            pn:           h.pn,
            sn:           h.sn,
            ubicacion:    h.ubicacion,
            existencia:   h.existencia,
            unidad:       h.unidad,
            estadoFisico: h.estadoFisico,
            marca:        h.marca
        });
        this.coincidencias.set(1);
    }

    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => { this.selectedImage.set(reader.result as string); };
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
