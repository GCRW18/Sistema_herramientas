import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

// Material Imports
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, finalize } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';
import { QuarantineService } from '../../../../core/services/quarantine.service';

type ViewMode = 'quarantine' | 'calibration';

@Component({
    selector: 'app-poner-cuarentena',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatSelectModule,
        MatCardModule,
        MatCheckboxModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        DragDropModule,
        DatePipe
    ],
    templateUrl: './poner-cuarentena.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 2px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
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

        .spinner-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        :host-context(.dark) .spinner-overlay {
            background: rgba(0,0,0,0.7);
        }

        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #000;
            border-radius: 3px;
        }

        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
        }

        .form-group {
            display: flex;
            flex-direction: column;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .animate-fadeIn {
            animation: fadeIn 0.2s ease-out forwards;
        }

        input:read-only {
            background-color: #f3f4f6;
            border-color: #9ca3af;
            cursor: not-allowed;
        }

        :host-context(.dark) input:read-only {
            background-color: #1f2937;
            border-color: #4b5563;
            color: #9ca3af;
        }

        :host-context(.dark) select option {
            background-color: #0F172A;
            color: white;
        }

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            pointer-events: none;
        }
    `]
})
export class PonerCuarentenaComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<PonerCuarentenaComponent>, { optional: true });
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private quarantineService = inject(QuarantineService);

    private _unsubscribeAll = new Subject<void>();

    // Signals
    currentView = signal<ViewMode>('quarantine');
    selectedImage = signal<string | null>(null);

    // Estados
    isLoading = false;

    // Caché de herramientas y personal para búsqueda local
    private personalCache: any[] = [];
    herramientasCache: any[] = [];
    toolsFiltradas: any[] = [];
    showToolSuggestions = false;
    private toolIdActual = 0;
    private employeeIdActual = 0;

    // Formularios
    quarantineForm!: FormGroup;
    calibrationForm!: FormGroup;

    ngOnInit(): void {
        this.initQuarantineForm();
        this.initCalibrationForm();
        this.setupFormListeners();
        this.cargarPersonal();
        this.cargarHerramientas();
    }

    private cargarPersonal(): void {
        this.movementService.getPersonal()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({ next: (personal) => { this.personalCache = personal; } });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private initQuarantineForm(): void {
        const today = new Date().toISOString().split('T')[0];

        this.quarantineForm = this.fb.group({
            // Datos de la herramienta
            codigo: ['', Validators.required],
            nombre: ['', Validators.required],
            partNumber: ['', Validators.required],
            serialNumber: ['', Validators.required],
            ubicacion: ['', Validators.required],
            existencia: [1, [Validators.required, Validators.min(1)]],
            unidad: ['PZA'],
            base: [''],
            fechaVencimiento: [''],
            estadoFisico: [null, Validators.required],
            listaContenido: [''],

            // Detalles del reporte
            motivo: ['other', Validators.required],
            nroReporteDiscrepancia: ['', Validators.required],
            cantidad: [1, [Validators.required, Validators.min(1)]],
            fecha: [today, Validators.required],
            descripcion: ['', Validators.required],

            // Personal reportante
            buscar: [''],
            nroLicencia: [''],
            nombreReportado: [''],
            nombreApellido: [''],
            realizadoPor: ['Admin Sistema']
        });

        // Validar que la fecha no sea futura
        this.quarantineForm.get('fecha')?.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(value => {
                if (value) {
                    const selectedDate = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (selectedDate > today) {
                        this.quarantineForm.get('fecha')?.setErrors({ futureDate: true });
                        this.showMessage('La fecha del reporte no puede ser futura', 'warning');
                    }
                }
            });
    }

    private initCalibrationForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);

        this.calibrationForm = this.fb.group({
            tipoTrabajo: ['CALIBRACION', Validators.required],
            nroCertificado: ['', Validators.required],
            fechaCalibracion: [today, Validators.required],
            fechaVencimiento: [nextYear.toISOString().split('T')[0], Validators.required],
            observacion: [''],
            recibidoPor: ['', Validators.required],
            fechaRecepcion: [today, Validators.required],

            // Reparación / Baja
            casoReparacion: [''],
            sePudoReparar: [''],
            nroInformeTecnico: [''],
            descripcionBaja: ['']
        });
    }

    private setupFormListeners(): void {
        // Validación de fechas de calibración
        this.calibrationForm.get('fechaCalibracion')?.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => {
                this.validateCalibrationDates();
            });

        this.calibrationForm.get('fechaVencimiento')?.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => {
                this.validateCalibrationDates();
            });

        // Validación de cantidad vs existencia
        this.quarantineForm.get('cantidad')?.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => {
                this.validateCantidadVsExistencia();
            });

        // Si no se pudo reparar, los campos de baja son obligatorios
        this.calibrationForm.get('sePudoReparar')?.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(value => {
                this.updateBajaValidators(value);
            });
    }

    private validateCalibrationDates(): void {
        const fechaCalibracion = this.calibrationForm.get('fechaCalibracion')?.value;
        const fechaVencimiento = this.calibrationForm.get('fechaVencimiento')?.value;

        if (fechaCalibracion && fechaVencimiento) {
            const calDate = new Date(fechaCalibracion);
            const vencDate = new Date(fechaVencimiento);
            calDate.setHours(0, 0, 0, 0);
            vencDate.setHours(0, 0, 0, 0);

            if (vencDate <= calDate) {
                this.calibrationForm.get('fechaVencimiento')?.setErrors({ invalidDate: true });
            }
        }
    }

    private validateCantidadVsExistencia(): void {
        const cantidad = this.quarantineForm.get('cantidad')?.value;
        const existencia = this.quarantineForm.get('existencia')?.value;

        if (existencia && cantidad && cantidad > existencia) {
            this.quarantineForm.get('cantidad')?.setErrors({ excedeExistencia: true });
        }
    }

    private updateBajaValidators(value: string): void {
        const nroInformeControl = this.calibrationForm.get('nroInformeTecnico');
        const descripcionBajaControl = this.calibrationForm.get('descripcionBaja');

        if (value === 'NO') {
            nroInformeControl?.setValidators([Validators.required]);
            descripcionBajaControl?.setValidators([Validators.required]);
        } else {
            nroInformeControl?.clearValidators();
            descripcionBajaControl?.clearValidators();
            nroInformeControl?.setErrors(null);
            descripcionBajaControl?.setErrors(null);
        }

        nroInformeControl?.updateValueAndValidity();
        descripcionBajaControl?.updateValueAndValidity();
    }

    switchView(view: ViewMode): void {
        if (view === 'calibration' && !this.quarantineForm.valid) {
            this.showMessage('Complete primero el formulario de cuarentena', 'error');
            this.quarantineForm.markAllAsTouched();
            return;
        }
        this.currentView.set(view);
        this.showMessage(`Vista cambiada a: ${view === 'calibration' ? 'Calibración' : 'Cuarentena'}`, 'info');
    }

    private cargarHerramientas(): void {
        this.movementService.getHerramientasDisponibles()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({ next: (tools) => { this.herramientasCache = tools; } });
    }

    filtrarHerramientas(event: Event): void {
        const query = (event.target as HTMLInputElement).value.trim().toLowerCase();
        if (query.length < 2) {
            this.toolsFiltradas = [];
            this.showToolSuggestions = false;
            return;
        }
        this.toolsFiltradas = this.herramientasCache.filter(t =>
            (t.code ?? t.codigo ?? '').toLowerCase().includes(query) ||
            (t.name ?? t.nombre ?? '').toLowerCase().includes(query)
        ).slice(0, 8);
        this.showToolSuggestions = this.toolsFiltradas.length > 0;
    }

    selectTool(tool: any): void {
        const conditionMap: Record<string, string> = {
            available: 'S', serviceable: 'S',
            repairable: 'R', repair: 'R',
            unserviceable: 'M', bad: 'M',
            transitional: 'T', transit: 'T'
        };
        const rawCond = (tool.condition ?? tool.status ?? '').toLowerCase();
        const estadoFisico = conditionMap[rawCond] ?? tool.condition ?? tool.status ?? null;

        this.toolIdActual = tool.id_tool ?? tool.id ?? 0;
        this.quarantineForm.patchValue({
            codigo:           tool.code          ?? tool.codigo       ?? '',
            nombre:           tool.name          ?? tool.nombre       ?? '',
            partNumber:       tool.part_number   ?? '',
            serialNumber:     tool.serial_number ?? '',
            ubicacion:        tool.location      ?? tool.location_name ?? '',
            existencia:       tool.quantity_in_stock ?? 1,
            unidad:           tool.unit_of_measure ?? 'PZA',
            base:             tool.warehouse_name ?? tool.base_code ?? tool.warehouse_id?.toString() ?? '',
            fechaVencimiento: tool.next_calibration_date ?? '',
            listaContenido:   tool.content_list  ?? '',
            estadoFisico
        });
        this.showToolSuggestions = false;
        this.showMessage(`Herramienta ${tool.code ?? tool.codigo} cargada`, 'success');
    }

    ocultarSugerencias(): void {
        setTimeout(() => { this.showToolSuggestions = false; }, 200);
    }

    buscarPersona(): void {
        const termino = (this.quarantineForm.get('buscar')?.value ?? '').trim().toLowerCase();

        if (!termino) {
            this.showMessage('Ingrese un término de búsqueda', 'warning');
            return;
        }

        const found = this.personalCache.find(p =>
            (p.licencia     ?? '').toLowerCase().includes(termino) ||
            (p.nro_licencia ?? '').toLowerCase().includes(termino) ||
            (p.nombreCompleto ?? '').toLowerCase().includes(termino)
        );

        if (found) {
            this.employeeIdActual = found.id_employee ?? found.id ?? 0;
            this.quarantineForm.patchValue({
                nroLicencia:    found.licencia ?? found.nro_licencia ?? '',
                nombreReportado: found.cargo  ?? '',
                nombreApellido:  found.nombreCompleto ?? ''
            });
            this.showMessage('Persona encontrada y cargada exitosamente', 'success');
        } else {
            this.showMessage('No se encontró la persona', 'error');
        }
    }

    onImageSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files?.[0]) return;

        const file = input.files[0];

        // Validar tamaño (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showMessage('La imagen no debe superar 5MB', 'error');
            return;
        }

        // Validar tipo
        if (!file.type.match('image/(jpeg|png|jpg|webp)')) {
            this.showMessage('Formato no válido. Use PNG, JPG o WEBP', 'error');
            return;
        }

        this.isLoading = true;
        const reader = new FileReader();

        reader.onload = () => {
            this.selectedImage.set(reader.result as string);
            this.isLoading = false;
            this.showMessage('Evidencia fotográfica cargada exitosamente', 'success');

            // Resetear el input file
            input.value = '';
        };

        reader.onerror = () => {
            this.isLoading = false;
            this.showMessage('Error al cargar la imagen', 'error');
        };

        reader.readAsDataURL(file);
    }

    removeImage(): void {
        this.selectedImage.set(null);
        this.showMessage('Evidencia fotográfica removida', 'info');
    }

    isCalibrationValid(): boolean {
        if (this.calibrationForm.invalid) return false;

        // Validar fechas
        if (this.calibrationForm.get('fechaVencimiento')?.errors?.['invalidDate']) {
            return false;
        }

        return true;
    }

    getValidacionMensaje(): string {
        if (!this.quarantineForm.valid) return 'FALTAN CAMPOS REQUERIDOS';
        if (!this.selectedImage()) return 'FALTA EVIDENCIA FOTOGRÁFICA';
        return 'REPORTE COMPLETO';
    }

    saveCalibrationData(): void {
        if (!this.isCalibrationValid()) {
            this.calibrationForm.markAllAsTouched();
            this.showMessage('Complete los campos requeridos en calibración', 'error');
            return;
        }

        this.showMessage('Datos de calibración guardados exitosamente', 'success');
        this.switchView('quarantine');
    }

    agregar(): void {
        // Validar formulario de cuarentena
        if (this.quarantineForm.invalid) {
            this.quarantineForm.markAllAsTouched();

            // Mensaje específico según el campo faltante
            if (!this.quarantineForm.get('codigo')?.value) {
                this.showMessage('Complete el código de la herramienta', 'error');
            } else if (!this.quarantineForm.get('nombre')?.value) {
                this.showMessage('Complete el nombre de la herramienta', 'error');
            } else if (!this.quarantineForm.get('partNumber')?.value) {
                this.showMessage('Complete el número de parte (P/N)', 'error');
            } else if (!this.quarantineForm.get('serialNumber')?.value) {
                this.showMessage('Complete el número de serie (S/N)', 'error');
            } else if (!this.quarantineForm.get('estadoFisico')?.value) {
                this.showMessage('Seleccione el estado físico', 'error');
            } else if (!this.quarantineForm.get('nroReporteDiscrepancia')?.value) {
                this.showMessage('Complete el número de reporte', 'error');
            } else if (!this.quarantineForm.get('descripcion')?.value) {
                this.showMessage('Complete la descripción del problema', 'error');
            } else {
                this.showMessage('Complete todos los campos requeridos', 'error');
            }

            return;
        }

        // Validar evidencia fotográfica (requerida)
        if (!this.selectedImage()) {
            this.showMessage('La evidencia fotográfica es obligatoria', 'error');
            return;
        }

        // Validar cantidad vs existencia
        if (this.quarantineForm.get('cantidad')?.errors?.['excedeExistencia']) {
            this.showMessage('La cantidad excede la existencia disponible', 'error');
            return;
        }

        this.isLoading = true;

        const fv = this.quarantineForm.getRawValue();

        const payload: any = {
            record_number:      fv.nroReporteDiscrepancia,
            report_number:      fv.nroReporteDiscrepancia,
            status:             'active',
            reason:             fv.motivo         ?? 'other',
            reason_description: fv.descripcion    ?? '',
            start_date:         fv.fecha,
            reported_by_name:   fv.nombreApellido || fv.realizadoPor || 'Admin Sistema'
        };

        if (this.toolIdActual > 0)     payload['tool_id']          = this.toolIdActual;
        if (this.employeeIdActual > 0) payload['reported_by_id']   = this.employeeIdActual;

        this.quarantineService.createQuarantine(payload).pipe(
            finalize(() => { this.isLoading = false; }),
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (result: any) => {
                const idQua = result?.id_quarantine ?? '';
                console.log('✅ Cuarentena registrada:', result);
                this.showMessage(`Herramienta ${fv.codigo} enviada a cuarentena`, 'success');

                if (this.dialogRef) {
                    this.dialogRef.close({ success: true, id_quarantine: idQua });
                } else {
                    setTimeout(() => { this.router.navigate(['/salidas']); }, 1500);
                }
            },
            error: (err: any) => {
                this.showMessage(err?.message || 'Error al registrar la cuarentena', 'error');
            }
        });
    }

    cerrar(): void {
        if (this.quarantineForm.dirty || this.calibrationForm.dirty || this.selectedImage()) {
            if (!confirm('Hay cambios sin guardar. ¿Desea salir?')) {
                return;
            }
        }

        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/salidas']);
        }
    }

    goBack(): void {
        if (this.currentView() === 'calibration') {
            this.switchView('quarantine');
        } else {
            this.cerrar();
        }
    }

    // Helpers para validación visual
    hasError(field: string, error: string): boolean {
        const control = this.quarantineForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    hasCalibrationError(field: string, error: string): boolean {
        const control = this.calibrationForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    getEstadoFisicoLabel(estado: string): string {
        const estados: { [key: string]: string } = {
            'S': 'Serviciable',
            'R': 'Reparable',
            'M': 'Malo/Inservible',
            'T': 'Transitorio'
        };
        return estados[estado] || 'No definido';
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'OK', {
            duration: 3500,
            panelClass: [`snackbar-${type}`],
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
        });
    }
}
