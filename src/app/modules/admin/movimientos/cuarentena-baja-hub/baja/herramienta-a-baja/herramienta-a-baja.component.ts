import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, of, takeUntil, debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs';
import { ToolService } from '../../../../../../core/services/tool.service';
import { MovementService } from '../../../../../../core/services/movement.service';

interface HerramientaOption {
    id_tool?: number;
    codigo: string;
    nombre: string;
    pn: string;
    sn: string;
    base: string;
    marca: string;
    existencia: number;
    imagen?: string;
    warehouseId?: number | null;
    rackId?: number | null;
    levelId?: number | null;
    notesTool?: string;
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
    private fb = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private toolSvc = inject(ToolService);
    private movementSvc = inject(MovementService);

    private _unsubscribeAll = new Subject<void>();
    private _search$ = new Subject<string>();

    bajaForm!: FormGroup;

    selectedImage = signal<string | null>(null);
    buscarTermino = signal<string>('');

    isLoading = false;
    showSuggestions = false;
    private id_tool_actual = 0;
    private warehouseId_actual: number | null = null;
    private rackId_actual: number | null = null;
    private levelId_actual: number | null = null;
    // Notas reales de la herramienta (ttools.notes) — para el detalle de solo-lectura, no
    // confundir con "observacion" del form (motivo de ESTA baja, dato distinto).
    private notesTool_actual: string = '';
    private warehouses: any[] = [];

    herramientasFiltradas = signal<HerramientaOption[]>([]);

    ngOnInit(): void {
        this.initForm();
        this.setupSearchListener();
        this.movementSvc.getWarehouses().pipe(takeUntil(this._unsubscribeAll))
            .subscribe({ next: (w: any[]) => { this.warehouses = w; } });
    }

    // Búsqueda en vivo contra el backend (ToolService.getTools con query → searchToolsAutocomplete),
    // el mismo mecanismo que usa el buscador de detalle-herramienta.component.ts (Ajuste de
    // Herramienta), en vez de precargar todas las herramientas y filtrar en el cliente.
    // "base" se resuelve en el cliente contra el listado de almacenes (getWarehouses) porque
    // searchToolsAutocomplete solo devuelve warehouse_id, no el nombre/código del almacén.
    private setupSearchListener(): void {
        this._search$.pipe(
            takeUntil(this._unsubscribeAll),
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                const q = (term || '').trim();
                if (q.length < 2) { return of([]); }
                return this.toolSvc.getTools({ query: q }).pipe(catchError(() => of([])));
            })
        ).subscribe((tools: any[]) => {
            const mapped: HerramientaOption[] = (tools || []).map((t: any) => ({
                id_tool:    t.id_tool ?? t.id ?? 0,
                codigo:     t.code          ?? t.codigo        ?? '',
                nombre:     t.name          || t.description   || t.nombre || '',
                pn:         t.part_number   ?? t.pn            ?? '',
                sn:         t.serial_number ?? t.sn             ?? '',
                base:       this._resolverBase(t.warehouse_id),
                marca:      t.brand ?? t.marca ?? '',
                existencia: t.quantity_in_stock ?? t.existencia ?? 0,
                imagen:     t.location_photo ?? null,
                warehouseId: t.warehouse_id != null ? Number(t.warehouse_id) : null,
                rackId:      t.rack_id      != null ? Number(t.rack_id)      : null,
                levelId:     t.level_id     != null ? Number(t.level_id)     : null,
                notesTool:   t.notes ?? '',
            }));
            this.herramientasFiltradas.set(mapped);
            this.showSuggestions = mapped.length > 0;
        });
    }

    private _resolverBase(warehouseId: any): string {
        if (warehouseId == null) return '';
        const w = this.warehouses.find(x => x.id === warehouseId);
        return w ? (w.codigo ? `${w.codigo} — ${w.nombre}` : w.nombre) : '';
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
            marca: [''],
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

    onBuscarChange(value: string): void {
        this.buscarTermino.set(value);
        if (value.trim().length < 2) { this.showSuggestions = false; this.herramientasFiltradas.set([]); }
        this._search$.next(value);
    }

    selectHerramienta(herramienta: HerramientaOption): void {
        this.id_tool_actual = herramienta.id_tool ?? 0;
        this.warehouseId_actual = herramienta.warehouseId ?? null;
        this.rackId_actual      = herramienta.rackId ?? null;
        this.levelId_actual     = herramienta.levelId ?? null;
        this.notesTool_actual   = herramienta.notesTool ?? '';
        this.loadHerramientaData(herramienta);
        this.buscarTermino.set(`${herramienta.codigo} - ${herramienta.nombre}`);
        this.showSuggestions = false;
    }

    ocultarSugerencias(): void {
        setTimeout(() => { this.showSuggestions = false; }, 200);
    }

    limpiarBusqueda(): void {
        this.buscarTermino.set('');
        this.herramientasFiltradas.set([]);
        this.showSuggestions = false;
        this.bajaForm.reset({ cantidad: 1, estadoFisico: 'INSERVIBLE', existencia: 0 });
        this.id_tool_actual = 0;
        this.warehouseId_actual = null;
        this.rackId_actual      = null;
        this.levelId_actual     = null;
        this.notesTool_actual   = '';
        this.selectedImage.set(null);
    }

    private loadHerramientaData(herramienta: HerramientaOption): void {
        this.bajaForm.patchValue({
            codigo: herramienta.codigo,
            nombre: herramienta.nombre,
            pn: herramienta.pn,
            sn: herramienta.sn,
            base: herramienta.base,
            marca: herramienta.marca,
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
            warehouseId: this.warehouseId_actual,
            rackId: this.rackId_actual,
            levelId: this.levelId_actual,
            notesTool: this.notesTool_actual,
            imagen: this.selectedImage(),
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
