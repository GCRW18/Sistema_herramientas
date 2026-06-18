import { Component, OnInit, signal, inject, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop'; // <--- OBLIGATORIO PARA ARRASTRAR EL MODAL
import { Subject, forkJoin, finalize, takeUntil, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, map, catchError } from 'rxjs/operators';

import { MovementService } from '../../../../../core/services/movement.service';
import { QuarantineService } from '../../../../../core/services/quarantine.service';

@Component({
    selector: 'app-poner-cuarentena',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatIconModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatDialogModule, // <--- Necesario para ng-template modales
        DragDropModule   // <--- Necesario para cdkDrag
    ],
    templateUrl: './poner-cuarentena.component.html',
})
export class PonerCuarentenaComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<PonerCuarentenaComponent>, { optional: true });
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private dialog = inject(MatDialog); // <--- Inyectamos el servicio de modales
    private movementService = inject(MovementService);
    private quarantineService = inject(QuarantineService);

    private _unsubscribeAll = new Subject<void>();

    @ViewChild('reporteModal') reporteModal!: TemplateRef<any>;
    @ViewChild('herramientaModal') herramientaModal!: TemplateRef<any>;

    private activeDialog: MatDialogRef<any> | null = null;

    isLoading = false;
    toolList: any[] = [];
    selectedToolImage = signal<string | null>(null);

    unidades: string[] = ['CBB', 'LPB', 'VVI', 'SRE', 'TJA', 'SRZ', 'CIJ', 'TDD', 'GYA', 'RIB', 'BYC'];

    estadosFisicos = [
        { value: 'S', label: 'SERVICEABLE' },
        { value: 'R', label: 'REPAIRABLE' },
        { value: 'M', label: 'MALO' },
        { value: 'T', label: 'TRANS.' }
    ];

    motivosCuarentena = [
        { value: 'quality_issue', label: 'CALIDAD' },
        { value: 'calibration_failed', label: 'FALLA CALIB.' },
        { value: 'damage_suspected', label: 'DAÑO SOSP.' },
        { value: 'investigation', label: 'INVESTIGACIÓN' },
        { value: 'contamination', label: 'CONTAMINA.' },
        { value: 'expired_calibration', label: 'CAL. VENC.' },
        { value: 'operational_failure', label: 'FALLA OPER.' },
        { value: 'physical_damage', label: 'DAÑO FÍSICO' },
        { value: 'other', label: 'OTRO' }
    ];

    herramientasCache: any[] = [];
    toolSuggestions: any[] = [];
    showToolDropdown = false;
    toolSearchLoading = false;
    buscarValue = '';
    private toolIdActual = 0;
    private employeeIdActual = 0;
    private _toolSearch$ = new Subject<string>();

    private _personaSearch$ = new Subject<string>();
    personasFiltradas: any[] = [];
    showPersonaDropdown = false;
    personaLoading = false;

    reporteForm!: FormGroup;
    toolForm!: FormGroup;

    ngOnInit(): void {
        this.initForms();
        this.cargarHerramientas();
        this._setupPersonaSearch();
        this._setupToolSearch();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private cargarHerramientas(): void {
        this.movementService.getHerramientasDisponibles().pipe(takeUntil(this._unsubscribeAll)).subscribe({
            next: (t) => { this.herramientasCache = t; }
        });
    }

    private initForms(): void {
        const today = new Date().toISOString().split('T')[0];

        const auth = JSON.parse(localStorage.getItem('aut') || '{}');
        this.reporteForm = this.fb.group({
            nroReporteDiscrepancia: ['', Validators.required],
            fecha: [today, Validators.required],
            motivo: [null, Validators.required],
            descripcion: ['', Validators.required],
            nombreApellido: [''],
            realizadoPor: [auth?.nombre_usuario || '']
        });

        this.toolForm = this.fb.group({
            id_tool: [0],
            codigo: ['', Validators.required],
            nombre: [''],
            partNumber: [''],
            serialNumber: [''],
            base: ['CBB', Validators.required],
            fechaVencimiento: [''],
            existencia: [0],
            cantidad: [1, [Validators.required, Validators.min(1)]],
            estadoFisico: ['S', Validators.required]
        });
    }

    // -------------------------------------------------------------------------
    // LÓGICA DE APERTURA DE MODALES CON MATDIALOG
    // -------------------------------------------------------------------------
    abrirModalReporte(): void {
        this.activeDialog = this.dialog.open(this.reporteModal, {
            width: '860px', maxWidth: '95vw', height: '88vh',
            panelClass: 'no-padding-dialog', disableClose: true
        });
    }

    guardarYcerrarReporte(): void {
        if (this.reporteForm.invalid) {
            this.reporteForm.markAllAsTouched();
            return;
        }
        this.cerrarModalActivo();
        this.showMessage('Datos de reporte guardados.', 'success');
    }

    abrirModalHerramienta(): void {
        this.toolForm.reset({ existencia: 0, cantidad: 1, estadoFisico: 'S', base: 'CBB' });
        this.selectedToolImage.set(null);
        this.showToolDropdown = false;
        this.buscarValue = '';
        this.toolSuggestions = [];

        this.activeDialog = this.dialog.open(this.herramientaModal, {
            width: '800px', maxWidth: '96vw', height: '560px',
            panelClass: 'no-padding-dialog', disableClose: true, autoFocus: false
        });
    }

    cerrarModalActivo(): void {
        if (this.activeDialog) {
            this.activeDialog.close();
            this.activeDialog = null;
        }
    }
    // -------------------------------------------------------------------------

    isReporteValido(): boolean { return this.reporteForm.valid; }

    private _setupToolSearch(): void {
        this._toolSearch$.pipe(
            debounceTime(250),
            distinctUntilChanged(),
            takeUntil(this._unsubscribeAll)
        ).subscribe(q => {
            const query = q.trim().toLowerCase();
            if (query.length < 2) {
                this.toolSuggestions  = [];
                this.showToolDropdown = false;
                this.toolSearchLoading = false;
                return;
            }
            this.toolSuggestions = this.herramientasCache
                .filter(t => {
                    const nombre = (t.name || t.description || '').toLowerCase();
                    return (t.code           ?? '').toLowerCase().includes(query) ||
                           nombre.includes(query) ||
                           (t.part_number   ?? '').toLowerCase().includes(query) ||
                           (t.serial_number ?? '').toLowerCase().includes(query);
                })
                .slice(0, 8);
            this.showToolDropdown  = this.toolSuggestions.length > 0;
            this.toolSearchLoading = false;
        });
    }

    onBuscarToolInput(value: string): void {
        this.buscarValue    = value;
        this.toolSearchLoading = value.trim().length >= 2;
        this._toolSearch$.next(value);
    }

    hideBuscarToolDropdown(): void { setTimeout(() => { this.showToolDropdown = false; }, 180); }

    limpiarBuscarTool(): void {
        this.buscarValue      = '';
        this.toolSuggestions  = [];
        this.showToolDropdown = false;
        this.toolForm.patchValue({ id_tool: 0, codigo: '', nombre: '', partNumber: '', serialNumber: '', existencia: 0 });
    }

    selectTool(tool: any): void {
        this.toolIdActual = tool.id_tool ?? tool.id ?? 0;
        this.buscarValue  = `${tool.code ?? ''} · ${tool.name ?? ''}`;
        this.toolForm.patchValue({
            id_tool:      this.toolIdActual,
            codigo:       tool.code              ?? '',
            nombre:       tool.name              ?? '',
            partNumber:   tool.part_number       ?? '',
            serialNumber: tool.serial_number     ?? '',
            existencia:   tool.quantity_in_stock ?? 0,
            cantidad:     1,
            estadoFisico: 'S'
        });
        this.showToolDropdown = false;
    }

    ocultarSugerencias(): void { setTimeout(() => { this.showToolDropdown = false; }, 180); }

    onToolImageSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files?.[0]) return;
        const reader = new FileReader();
        reader.onload = () => { this.selectedToolImage.set(reader.result as string); };
        reader.readAsDataURL(input.files[0]);
    }

    addToolToList(): void {
        if (this.toolForm.invalid || !this.toolForm.get('codigo')?.value || !this.selectedToolImage()) {
            this.toolForm.markAllAsTouched();
            this.showMessage('Complete los datos obligatorios y asigne una foto referencial.', 'warning');
            return;
        }

        const fv = this.toolForm.value;
        if (this.toolList.find(t => t.id_tool === fv.id_tool && fv.id_tool !== 0)) {
            this.showMessage('Esta herramienta ya está en la lista.', 'warning');
            return;
        }

        if (fv.cantidad > fv.existencia) {
            this.showMessage(`Solo hay ${fv.existencia} unidades en stock de almacén principal.`, 'error');
            return;
        }

        this.toolList.push({ ...fv, foto: this.selectedToolImage() });
        this.cerrarModalActivo();
        this.showMessage('Herramienta preparada para cuarentena.', 'success');
    }

    removerDeLista(index: number): void {
        this.toolList.splice(index, 1);
    }

    private _setupPersonaSearch(): void {
        this._personaSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showPersonaDropdown = false; return of([]); }
                this.personaLoading = true;
                const q = t.toLowerCase();
                return this.movementService.getPersonal().pipe(
                    map(lista => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map((f: any) => ({ id: f.id_employee || f.id, nombre: f.nombreCompleto || f.nombre, cargo: f.cargo || '' }))
                    ),
                    finalize(() => this.personaLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this._unsubscribeAll)
        ).subscribe(res => {
            this.personasFiltradas = res || [];
            this.showPersonaDropdown = this.personasFiltradas.length > 0;
        });
    }

    onPersonaInput(v: string): void {
        this.reporteForm.patchValue({ nombreApellido: v }, { emitEvent: false });
        if (v.length >= 2) this._personaSearch$.next(v);
        else this.showPersonaDropdown = false;
    }

    selectPersona(p: any): void {
        this.employeeIdActual = p.id;
        this.reporteForm.patchValue({ nombreApellido: p.nombre });
        this.showPersonaDropdown = false;
    }

    hidePersonaDropdown(): void { setTimeout(() => this.showPersonaDropdown = false, 200); }

    submitQuarantine(): void {
        if (!this.isReporteValido() || this.toolList.length === 0) return;
        this.isLoading = true;
        const rep = this.reporteForm.getRawValue();

        const requests = this.toolList.map(tool => {
            const notesExtra = `Cant: ${tool.cantidad}. Base: ${tool.base || '-'}.` +
                               (tool.fechaVencimiento ? ` Vence: ${tool.fechaVencimiento}.` : '');
            const payload: any = {
                report_number:      rep.nroReporteDiscrepancia,
                record_number:      rep.nroReporteDiscrepancia,
                tool_id:            tool.id_tool,
                start_date:         rep.fecha,
                reported_by_name:   rep.nombreApellido || rep.realizadoPor,
                reason:             rep.motivo,
                reason_description: rep.descripcion,
                status:             'active',
                notes:              notesExtra
            };

            if (this.employeeIdActual > 0) payload.reported_by_id = this.employeeIdActual;
            return this.quarantineService.createQuarantine(payload);
        });

        forkJoin(requests).pipe(
            finalize(() => { this.isLoading = false; }),
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: () => {
                this.showMessage('Cuarentena procesada correctamente.', 'success');
                if (this.dialogRef) {
                    this.dialogRef.close({ success: true });
                } else {
                    setTimeout(() => { this.router.navigate(['/salidas']); }, 1000);
                }
            },
            error: () => this.showMessage('Error al procesar el flujo.', 'error')
        });
    }

    getEstadoFisicoLabel(val: string): string {
        return this.estadosFisicos.find(e => e.value === val)?.label || val;
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'CERRAR', {
            duration: 3500,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
