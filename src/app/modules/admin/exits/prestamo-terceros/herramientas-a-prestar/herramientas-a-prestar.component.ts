import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';
import { MovementService } from '../../../../../core/services/movement.service';

@Component({
    selector: 'app-herramientas-a-prestar',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatDialogModule,
        FormsModule,
        ReactiveFormsModule,
        DragDropModule
    ],
    templateUrl: './herramientas-a-prestar.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 2px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
        }

        :host-context(.dark) { color-scheme: dark; }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base { background-color: #1e293b !important; }

        .btn-icon-circle {
            width: 48px; height: 48px;
            background: white; border: 2px solid black;
            border-radius: 12px;
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s; cursor: pointer;
        }

        :host-context(.dark) .btn-icon-circle { background: #1e293b; }

        .btn-icon-circle:hover { box-shadow: 2px 2px 0px 0px #000; transform: translate(1px,1px); }
        .btn-icon-circle:active { box-shadow: none; transform: translate(3px,3px); }

        .badge { padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid;
                 font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
        .badge-warning { background: #f97316; color: white; border-color: #9a3412; box-shadow: 2px 2px 0px 0px rgba(0,0,0,0.5); }

        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }

        .neo-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .neo-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .neo-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .neo-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        .form-group { display: flex; flex-direction: column; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
    `]
})
export class HerramientasAPrestarComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<HerramientasAPrestarComponent>, { optional: true });
    public data = inject(MAT_DIALOG_DATA, { optional: true });
    private fb = inject(FormBuilder);
    private movementService = inject(MovementService);
    private destroy$ = new Subject<void>();

    prestarForm!: FormGroup;
    selectedImage = signal<string | null>(null);
    coincidencias = signal<number>(0);
    isLoading = false;

    // Lista completa cargada de la API
    herramientas: any[] = [];

    ngOnInit(): void {
        const today = new Date().toISOString().split('T')[0];

        this.prestarForm = this.fb.group({
            buscar:           [''],
            id_tool:          [null],
            codigo:           ['', Validators.required],
            nombre:           ['', Validators.required],
            pn:               [''],
            sn:               [''],
            ubicacion:        [''],
            base:             [''],
            existencia:       [0],
            fechaVencimiento: [''],
            unidad:           [''],
            estado:           ['', Validators.required],
            cantidad:         [1, [Validators.required, Validators.min(1)]],
            fechaIngreso:     [today, Validators.required],
            documentoIngreso: ['', Validators.required],
            observacion:      ['']
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
                    id_tool:      t.id_tool,
                    codigo:       t.code          ?? t.codigo,
                    nombre:       t.name          ?? t.nombre,
                    pn:           t.part_number   ?? t.pn ?? '',
                    sn:           t.serial_number ?? t.sn ?? '',
                    ubicacion:    t.location      ?? t.ubicacion ?? '',
                    base:         t.base          ?? t.warehouse_code ?? 'VVI',
                    existencia:   t.quantity_in_stock ?? t.existencia ?? 0,
                    unidad:       t.unit_of_measure ?? t.unidad ?? 'PZA',
                    estado:       t.status        ?? 'SERVICEABLE',
                    fechaVencimiento: t.next_calibration_date ?? t.fechaVencimiento ?? ''
                }));
                this.coincidencias.set(this.herramientas.length);
                this.isLoading = false;
            },
            error: () => { this.isLoading = false; }
        });
    }

    onBuscarChange(value: string): void {
        if (!value) {
            this.coincidencias.set(this.herramientas.length);
            return;
        }
        const term = value.toLowerCase();
        const filtered = this.herramientas.filter(h =>
            h.codigo.toLowerCase().includes(term) ||
            h.nombre.toLowerCase().includes(term) ||
            h.pn.toLowerCase().includes(term)
        );
        this.coincidencias.set(filtered.length);
    }

    onCodigoSelect(codigo: string): void {
        const h = this.herramientas.find(t => t.codigo === codigo);
        if (h) {
            this.prestarForm.patchValue({
                id_tool:          h.id_tool,
                codigo:           h.codigo,
                nombre:           h.nombre,
                pn:               h.pn,
                sn:               h.sn,
                ubicacion:        h.ubicacion,
                base:             h.base,
                existencia:       h.existencia,
                unidad:           h.unidad,
                estado:           h.estado,
                fechaVencimiento: h.fechaVencimiento
            });
            this.coincidencias.set(1);
        }
    }

    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return;
        const reader = new FileReader();
        reader.onload = () => { this.selectedImage.set(reader.result as string); };
        reader.readAsDataURL(file);
    }

    procesarDevolucion(): void {
        // Pendiente de implementar
    }

    agregar(): void {
        if (this.prestarForm.invalid) {
            this.prestarForm.markAllAsTouched();
            return;
        }
        const v = this.prestarForm.value;
        if ((v.cantidad || 0) > (v.existencia || 0)) {
            return; // cantidad excede stock
        }
        this.dialogRef?.close({
            action: 'agregar',
            data: { ...v, imagen: this.selectedImage() }
        });
    }

    cerrar(): void {
        this.dialogRef?.close();
    }

    hasError(field: string, error: string): boolean {
        const control = this.prestarForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }
}
