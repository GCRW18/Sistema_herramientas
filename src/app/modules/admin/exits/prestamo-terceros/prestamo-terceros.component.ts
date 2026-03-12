import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, forkJoin, finalize } from 'rxjs';

// Material Modules
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MovementService } from '../../../../core/services/movement.service';

interface InternalLoanItem {
    toolId: number;       // id_tool real de la BD
    id: number;           // identificador de fila (Date.now)
    codigo: string;
    pn: string;
    descripcion: string;
    sn: string;
    marca: string;
    fechaCalibracion: string;
    cantidad: number;
    unidad: string;
    estado: string;
    contenido: string;
}

interface ExternalLoanItem {
    id: number;
    codigo: string;
    pn: string;
    descripcion: string;
    sn: string;
    marca: string;
    fechaCalibracion: string;
    cantidad: number;
    horas: number;
    estado: string;
    contenido: string;
    costoHora: number;
    precioTotal: number;
}

interface Tecnico {
    id: string;
    nroLicencia: string;
    apPaterno: string;
    apMaterno: string;
    nombres: string;
    cargo: string;
    area: string;
    base: string;
}

interface Aeronave {
    matricula: string;
    tipo: string;
    modelo: string;
    msn: string;
}

type ViewMode = 'internal' | 'external';

@Component({
    selector: 'app-prestamo-terceros',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatSelectModule,
        MatCheckboxModule,
        MatDialogModule,
        MatAutocompleteModule,
        MatTooltipModule,
        DragDropModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './prestamo-terceros.component.html',
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

        .compact-form-field ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: white !important;
            border: 2px solid black !important;
            border-radius: 8px !important;
            padding: 0 12px !important;
            height: 42px !important;
            min-height: unset !important;
            display: flex; align-items: center;
            box-shadow: 2px 2px 0px 0px rgba(0,0,0,0.1);
            transition: all 0.2s;
        }

        .compact-form-field.mat-focused ::ng-deep .mat-mdc-text-field-wrapper,
        .compact-form-field:hover ::ng-deep .mat-mdc-text-field-wrapper {
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);
            transform: translate(-1px,-1px);
        }

        .compact-form-field ::ng-deep .mat-mdc-input-element { color: black !important; font-weight: 600; }
        .compact-form-field ::ng-deep .mat-mdc-input-element::placeholder { color: rgba(0,0,0,0.6) !important; }
        .compact-form-field ::ng-deep .mat-icon { color: black !important; }

        :host-context(.dark) .compact-form-field ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: #0F172AFF !important;
            border-color: #475569 !important; box-shadow: none !important;
        }
        :host-context(.dark) .compact-form-field ::ng-deep .mat-mdc-input-element { color: white !important; }
        :host-context(.dark) .compact-form-field ::ng-deep .mat-mdc-input-element::placeholder { color: rgba(255,255,255,0.5) !important; }
        :host-context(.dark) .compact-form-field ::ng-deep .mat-icon { color: white !important; }

        ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none !important; }
        ::ng-deep .mat-mdc-form-field-infix { padding-top: 6px !important; padding-bottom: 6px !important; min-height: unset !important; }

        :host ::ng-deep .mat-mdc-autocomplete-panel {
            border: 2px solid black !important; border-radius: 8px !important;
            box-shadow: 4px 4px 0px 0px rgba(0,0,0,1) !important; margin-top: 4px !important;
        }

        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center; z-index: 9999;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
    `]
})
export class PrestamoTercerosComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<PrestamoTercerosComponent>, { optional: true });
    private dialog          = inject(MatDialog);
    private fb              = inject(FormBuilder);
    private router          = inject(Router);
    private movementService = inject(MovementService);
    private destroy$        = new Subject<void>();

    currentView = signal<ViewMode>('internal');
    internalForm!: FormGroup;
    externalForm!: FormGroup;
    externalToolForm!: FormGroup;
    isSaving = false;

    message = signal<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);

    nroNotaInterno = signal<string>('PT-?/2026');
    nroNotaExterno = signal<string>('PTT-?/2026');

    internalDataSource  = signal<InternalLoanItem[]>([]);
    externalDataSource  = signal<ExternalLoanItem[]>([]);
    importeTotal        = signal<number>(0);

    selectedImageExternal = signal<string | null>(null);
    coincidenciasExternal = signal<number>(0);
    precioTotalExternal   = signal<number>(0);

    // Personal de la API (mapeado a forma Tecnico para el autocomplete)
    private personalCache: Tecnico[] = [];
    filteredTecnicos: Tecnico[] = [];

    // Aeronaves (estáticas por ahora)
    aeronaves: Aeronave[] = [
        { matricula: 'CP-2880', tipo: 'Boeing 737-800',   modelo: 'B738', msn: '41561' },
        { matricula: 'CP-2881', tipo: 'Boeing 737-800',   modelo: 'B738', msn: '41562' },
        { matricula: 'CP-2882', tipo: 'Boeing 737-800',   modelo: 'B738', msn: '41563' },
        { matricula: 'CP-3100', tipo: 'Boeing 737 MAX 8', modelo: 'B38M', msn: '44512' },
        { matricula: 'N/A',    tipo: 'No Aplica',         modelo: 'N/A',  msn: 'N/A'   }
    ];

    destinos = ['Servicios', 'Línea', 'Taller', 'Hangar', 'Rampa'];
    filteredEmpresas: any[] = [];

    ngOnInit(): void {
        this.initInternalForm();
        this.initExternalForm();
        this.initExternalToolForm();
        this.cargarPersonal();
        this.setupFormListeners();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // ── Init forms ───────────────────────────────────────────────────────────

    private initInternalForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const now   = new Date();
        const hh    = now.getHours().toString().padStart(2, '0');
        const mm    = now.getMinutes().toString().padStart(2, '0');

        this.internalForm = this.fb.group({
            buscarTecnico:    [''],
            nombreCompleto:   ['', Validators.required],
            nroLicencia:      ['', Validators.required],
            cargo:            [''],
            fecha:            [today, Validators.required],
            hora:             [`${hh}:${mm}`, Validators.required],
            matriculaAeronave:['N/A'],
            ordenTrabajo:     [''],
            destino:          [''],
            trabajoEspecial:  [false],
            observaciones:    ['']
        });
    }

    private initExternalForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const now   = new Date();
        const hh    = now.getHours().toString().padStart(2, '0');
        const mm    = now.getMinutes().toString().padStart(2, '0');

        this.externalForm = this.fb.group({
            buscarEmpresa:       [''],
            empresaSeleccionada: [null, Validators.required],
            nombreEmpresa:       ['', Validators.required],
            nit:                 [''],
            contacto:            [''],
            telefono:            [''],
            fecha:               [today, Validators.required],
            hora:                [`${hh}:${mm}`, Validators.required],
            motivoPrestamo:      ['', Validators.required],
            autorizado:          [''],
            observaciones:       ['']
        });
    }

    private initExternalToolForm(): void {
        this.externalToolForm = this.fb.group({
            buscar:          [''],
            codigo:          [''],
            nombre:          [''],
            pn:              [''],
            sn:              [''],
            marca:           [''],
            ubicacion:       [''],
            existencia:      [{ value: 0, disabled: true }],
            fechaVencimiento:[''],
            unidad:          [''],
            estado:          [''],
            costoHora:       [0],
            horas:           [1, [Validators.required, Validators.min(1)]],
            cantidad:        [1, [Validators.required, Validators.min(1)]],
            observacion:     ['']
        });
    }

    private setupFormListeners(): void {
        this.internalForm.get('buscarTecnico')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(200), distinctUntilChanged())
            .subscribe(value => this.filterTecnicos(value));

        this.externalToolForm.get('horas')?.valueChanges.subscribe(() => this.calcularPrecioTotalExternal());
        this.externalToolForm.get('costoHora')?.valueChanges.subscribe(() => this.calcularPrecioTotalExternal());
    }

    // ── Personal desde API ───────────────────────────────────────────────────

    private cargarPersonal(): void {
        this.movementService.getPersonal().pipe(takeUntil(this.destroy$)).subscribe({
            next: (personal) => {
                // Mapear al shape Tecnico que usa el Material Autocomplete del HTML
                this.personalCache = personal.map((p: any) => ({
                    id:          String(p.id_employee ?? p.id ?? ''),
                    nroLicencia: p.licencia ?? p.nro_licencia ?? '',
                    apPaterno:   p.apellido_paterno ?? '',
                    apMaterno:   p.apellido_materno ?? '',
                    nombres:     p.nombre ?? p.nombreCompleto ?? '',
                    cargo:       p.cargo ?? '',
                    area:        p.area ?? '',
                    base:        'VVI'
                }));
                this.filteredTecnicos = [...this.personalCache];
            }
        });
    }

    private filterTecnicos(value: string): void {
        if (!value || typeof value !== 'string') {
            this.filteredTecnicos = [...this.personalCache];
            return;
        }
        const term = value.toLowerCase();
        this.filteredTecnicos = this.personalCache.filter(t =>
            t.nombres.toLowerCase().includes(term) ||
            t.apPaterno.toLowerCase().includes(term) ||
            t.nroLicencia.toLowerCase().includes(term)
        );
    }

    displayTecnico(tecnico: Tecnico): string {
        return tecnico ? `${tecnico.nombres} ${tecnico.apPaterno} ${tecnico.apMaterno}`.trim() : '';
    }

    selectTecnico(tecnico: Tecnico): void {
        const nombreCompleto = `${tecnico.nombres} ${tecnico.apPaterno} ${tecnico.apMaterno}`.trim();
        this.internalForm.patchValue({
            nombreCompleto,
            nroLicencia: tecnico.nroLicencia,
            cargo:        tecnico.cargo
        });
    }

    // ── Empresa / externa (stub) ──────────────────────────────────────────────

    displayEmpresa(empresa: any): string {
        return empresa ? `${empresa.nombre}` : '';
    }

    selectEmpresa(empresa: any): void {
        this.externalForm.patchValue({
            empresaSeleccionada: empresa,
            nombreEmpresa:       empresa.nombre,
            nit:                 empresa.nit ?? '',
            contacto:            empresa.contacto ?? '',
            telefono:            empresa.telefono ?? ''
        });
    }

    // ── Items ────────────────────────────────────────────────────────────────

    eliminarItemInterno(index: number): void {
        const item = this.internalDataSource()[index];
        this.internalDataSource.update(items => items.filter((_, i) => i !== index));
        this.showMessage('info', `Herramienta "${item.descripcion}" eliminada`);
    }

    eliminarItemExterno(index: number): void {
        const item = this.externalDataSource()[index];
        this.externalDataSource.update(items => items.filter((_, i) => i !== index));
        this.calcularImporteTotal();
        this.showMessage('info', `Herramienta "${item.descripcion}" eliminada`);
    }

    agregarHerramientaExternal(): void {
        const fv = this.externalToolForm.getRawValue();
        if (!fv.codigo) { this.showMessage('error', 'Seleccione una herramienta'); return; }

        const newItem: ExternalLoanItem = {
            id: Date.now(),
            codigo: fv.codigo, pn: fv.pn, descripcion: fv.nombre, sn: fv.sn,
            marca: fv.marca, fechaCalibracion: fv.fechaVencimiento,
            cantidad: fv.cantidad || 1, horas: fv.horas || 0, estado: fv.estado,
            contenido: fv.observacion, costoHora: fv.costoHora,
            precioTotal: this.precioTotalExternal()
        };
        this.externalDataSource.update(items => [...items, newItem]);
        this.calcularImporteTotal();
        this.showMessage('success', `Herramienta "${newItem.descripcion}" agregada`);
    }

    getTotalItemsInterno(): number {
        return this.internalDataSource().reduce((s, i) => s + i.cantidad, 0);
    }

    getTotalItemsExterno(): number {
        return this.externalDataSource().reduce((s, i) => s + i.cantidad, 0);
    }

    calcularPrecioTotalExternal(): void {
        const costo = this.externalToolForm.get('costoHora')?.value || 0;
        const horas  = this.externalToolForm.get('horas')?.value || 0;
        this.precioTotalExternal.set(costo * horas);
    }

    calcularImporteTotal(): void {
        this.importeTotal.set(this.externalDataSource().reduce((s, i) => s + (i.precioTotal || 0), 0));
    }

    onImageSelectedExternal(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => this.selectedImageExternal.set(reader.result as string);
            reader.readAsDataURL(file);
        }
    }

    // ── Navegación ───────────────────────────────────────────────────────────

    switchView(view: ViewMode): void { this.currentView.set(view); }

    goBack(): void {
        if (this.dialogRef) { this.dialogRef.close(); }
        else { this.router.navigate(['/salidas']); }
    }

    // ── Procesamiento INTERNO ─────────────────────────────────────────────────

    async procesar(): Promise<void> {
        if (this.internalDataSource().length === 0) {
            this.showMessage('error', 'Agregue al menos una herramienta');
            return;
        }
        if (!this.internalForm.valid) {
            this.internalForm.markAllAsTouched();
            this.showMessage('error', 'Complete los campos requeridos');
            return;
        }

        this.isSaving = true;
        const fv    = this.internalForm.getRawValue();
        const items = this.internalDataSource();

        const calls = items.map(item =>
            this.movementService.registrarPrestamo({
                id_tool:           item.toolId,
                type:              'PRESTAMO_INTERNO',
                quantity:          item.cantidad,
                date:              fv.fecha,
                time:              fv.hora,
                requested_by_name: fv.nombreCompleto,
                technician:        fv.nombreCompleto,
                authorized_by:     fv.nroLicencia,
                department:        fv.destino || '',
                aircraft:          fv.matriculaAeronave || '',
                work_order_number: fv.ordenTrabajo || '',
                notes:             item.contenido || fv.observaciones || ''
            })
        );

        forkJoin(calls).pipe(
            finalize(() => { this.isSaving = false; }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (results: any[]) => {
                const numeros = results.map((r: any) => r?.movement_number).filter(Boolean).join(', ');
                this.showMessage('success', `Préstamo registrado: ${numeros}`);
                this.internalDataSource.set([]);
                this.initInternalForm();
            },
            error: (err: any) => {
                this.showMessage('error', err?.message || 'Error al registrar el préstamo');
            }
        });
    }

    // ── Procesamiento EXTERNO (stub) ──────────────────────────────────────────

    async procesarExterno(): Promise<void> {
        if (this.externalDataSource().length === 0) {
            this.showMessage('error', 'Agregue al menos una herramienta');
            return;
        }
        if (!this.externalForm.valid) {
            this.externalForm.markAllAsTouched();
            this.showMessage('error', 'Complete los campos requeridos');
            return;
        }
        this.isSaving = true;
        setTimeout(() => {
            this.isSaving = false;
            this.showMessage('success', `Préstamo externo ${this.nroNotaExterno()} procesado`);
        }, 1000);
    }

    // ── Dialog herramientas ──────────────────────────────────────────────────

    async openHerramientasAPrestar(): Promise<void> {
        const { HerramientasAPrestarComponent } = await import('./herramientas-a-prestar/herramientas-a-prestar.component');

        const dialogRef = this.dialog.open(HerramientasAPrestarComponent, {
            width: '900px',
            maxWidth: '95vw',
            height: '85vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false,
            data: { mode: 'add' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                const d = result.data;
                const newItem: InternalLoanItem = {
                    toolId:          d.id_tool ?? 0,
                    id:              Date.now(),
                    codigo:          d.codigo   || '',
                    pn:              d.pn       || '',
                    descripcion:     d.nombre   || '',
                    sn:              d.sn       || '',
                    marca:           d.marca    || '',
                    fechaCalibracion:d.fechaVencimiento || '',
                    cantidad:        d.cantidad || 1,
                    unidad:          d.unidad   || 'PZA',
                    estado:          d.estado   || 'SERVICEABLE',
                    contenido:       d.observacion || ''
                };
                this.internalDataSource.update(items => [...items, newItem]);
                this.showMessage('success', `Herramienta "${newItem.descripcion}" agregada`);
            }
        });
    }

    // ── Validaciones ────────────────────────────────────────────────────────

    hasErrorInternal(field: string, error: string): boolean {
        const control = this.internalForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    hasErrorExternal(field: string, error: string): boolean {
        const control = this.externalForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    getFormErrorsInternal(): string[] {
        const errors: string[] = [];
        const f = this.internalForm;
        if (!f.get('nombreCompleto')?.value) errors.push('Nombre Completo');
        if (!f.get('nroLicencia')?.value)    errors.push('Nro. Licencia');
        if (!f.get('fecha')?.value)          errors.push('Fecha');
        if (!f.get('hora')?.value)           errors.push('Hora');
        return errors;
    }

    // ── Mensajes ─────────────────────────────────────────────────────────────

    private showMessage(type: 'success' | 'error' | 'info' | 'warning', text: string): void {
        this.message.set({ type, text });
        setTimeout(() => this.message.set(null), 4000);
    }
}
