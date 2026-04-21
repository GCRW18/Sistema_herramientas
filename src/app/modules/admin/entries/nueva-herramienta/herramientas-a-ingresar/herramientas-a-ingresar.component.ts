import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { ToolService } from '../../../../../core/services/tool.service';

interface HerramientaOption {
    id_tool:  string;
    codigo:   string;
    pn:       string;
    nombre:   string;
    sn:       string;
    estado:   string;
    ubicacion: string;
    um:       string;
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
        MatAutocompleteModule,
        MatTooltipModule,
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
export class HerramientasAIngresarComponent implements OnInit, OnDestroy {
    public dialogRef  = inject(MatDialogRef<HerramientasAIngresarComponent>, { optional: true });
    public data       = inject(MAT_DIALOG_DATA, { optional: true });
    private fb        = inject(FormBuilder);
    private toolSvc   = inject(ToolService);
    private destroy$  = new Subject<void>();

    ingresoForm!: FormGroup;
    selectedImage  = signal<string | null>(null);
    coincidencias  = signal<number>(0);
    isSearching    = signal<boolean>(false);

    filteredHerramientas: HerramientaOption[] = [];

    ngOnInit(): void {
        this.ingresoForm = this.fb.group({
            buscar:       [''],
            codigo:       [''],
            pn:           [''],
            nombre:       [''],
            sn:           [''],
            estado:       [''],
            ubicacion:    [''],
            um:           [''],
            cantidad:     [1],
            documento:    [''],
            observaciones:['']
        });

        // Búsqueda con debounce sobre el campo buscar
        this.ingresoForm.get('buscar')?.valueChanges.pipe(
            takeUntil(this.destroy$),
            debounceTime(300),
            distinctUntilChanged()
        ).subscribe(value => {
            if (typeof value === 'string') {
                this.onBuscarChange(value);
            }
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // Muestra el código en el input cuando se selecciona una opción
    displayHerramienta = (h: HerramientaOption | null): string =>
        h ? `${h.codigo} — ${h.nombre}` : '';

    onBuscarChange(value: string): void {
        if (!value || value.trim().length < 2) {
            this.filteredHerramientas = [];
            this.coincidencias.set(0);
            return;
        }

        this.isSearching.set(true);
        this.toolSvc.getTools({ query: value.trim() }).pipe(
            takeUntil(this.destroy$)
        ).subscribe({
            next: (tools: any[]) => {
                this.filteredHerramientas = tools.map(t => ({
                    id_tool:   t.id_tool   || '',
                    codigo:    t.code      || t.codigo     || '',
                    pn:        t.part_number || t.pn       || '',
                    nombre:    t.name      || t.descripcion || t.description || '',
                    sn:        t.serial_number || t.sn     || '',
                    estado:    t.status    || t.estado     || '',
                    ubicacion: t.location  || t.ubicacion  || '',
                    um:        t.unit      || t.um         || 'UN'
                }));
                this.coincidencias.set(this.filteredHerramientas.length);
                this.isSearching.set(false);
            },
            error: () => {
                this.filteredHerramientas = [];
                this.coincidencias.set(0);
                this.isSearching.set(false);
            }
        });
    }

    selectHerramienta(herramienta: HerramientaOption): void {
        if (!herramienta) return;
        this.ingresoForm.patchValue({
            codigo:   herramienta.codigo,
            pn:       herramienta.pn,
            nombre:   herramienta.nombre,
            sn:       herramienta.sn,
            estado:   herramienta.estado,
            ubicacion:herramienta.ubicacion,
            um:       herramienta.um
        });
        this.coincidencias.set(1);
    }

    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => this.selectedImage.set(reader.result as string);
            reader.readAsDataURL(file);
        }
    }

    crearItem(): void {
        this.ingresoForm.reset({ cantidad: 1 });
        this.selectedImage.set(null);
        this.coincidencias.set(0);
        this.filteredHerramientas = [];
    }

    procesar(): void {
        const data = this.ingresoForm.value;
        this.dialogRef?.close({ action: 'procesar', data });
    }

    cerrar(): void {
        this.dialogRef?.close();
    }
}
