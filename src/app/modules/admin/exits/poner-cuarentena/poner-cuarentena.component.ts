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
import { Subject, forkJoin, finalize, takeUntil } from 'rxjs';

import { MovementService } from '../../../../core/services/movement.service';
import { QuarantineService } from '../../../../core/services/quarantine.service';

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

    private personalCache: any[] = [];
    herramientasCache: any[] = [];
    toolsFiltradas: any[] = [];
    showToolDropdown = false;
    private toolIdActual = 0;
    private employeeIdActual = 0;

    reporteForm!: FormGroup;
    toolForm!: FormGroup;

    ngOnInit(): void {
        this.initForms();
        this.cargarPersonal();
        this.cargarHerramientas();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private cargarPersonal(): void {
        this.movementService.getPersonal().pipe(takeUntil(this._unsubscribeAll)).subscribe({
            next: (p) => { this.personalCache = p; }
        });
    }

    private cargarHerramientas(): void {
        this.movementService.getHerramientasDisponibles().pipe(takeUntil(this._unsubscribeAll)).subscribe({
            next: (t) => { this.herramientasCache = t; }
        });
    }

    private initForms(): void {
        const today = new Date().toISOString().split('T')[0];

        this.reporteForm = this.fb.group({
            nroReporteDiscrepancia: ['', Validators.required],
            fecha: [today, Validators.required],
            motivo: [null, Validators.required],
            descripcion: ['', Validators.required],
            buscar: [''],
            nombreApellido: [''],
            realizadoPor: ['Admin Sistema']
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
            panelClass: ['!p-0', '!bg-transparent', '!shadow-none'], // Elimina estilos default de Angular Material
            disableClose: true,
            maxWidth: '100vw'
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

        this.activeDialog = this.dialog.open(this.herramientaModal, {
            panelClass: ['!p-0', '!bg-transparent', '!shadow-none'],
            disableClose: true,
            maxWidth: '100vw'
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

    filtrarHerramientas(event: Event): void {
        const query = (event.target as HTMLInputElement).value.trim().toLowerCase();
        if (query.length < 2) {
            this.toolsFiltradas = [];
            this.showToolDropdown = false;
            return;
        }
        this.toolsFiltradas = this.herramientasCache
            .filter(t => (t.code ?? '').toLowerCase().includes(query) || (t.name ?? '').toLowerCase().includes(query))
            .slice(0, 6);
        this.showToolDropdown = this.toolsFiltradas.length > 0;
    }

    selectTool(tool: any): void {
        this.toolIdActual = tool.id_tool ?? tool.id ?? 0;
        this.toolForm.patchValue({
            id_tool: this.toolIdActual,
            codigo: tool.code ?? '',
            nombre: tool.name ?? '',
            partNumber: tool.part_number ?? '',
            serialNumber: tool.serial_number ?? '',
            existencia: tool.quantity_in_stock ?? 0,
            cantidad: 1,
            estadoFisico: 'S'
        });
        this.showToolDropdown = false;
    }

    ocultarSugerencias(): void {
        setTimeout(() => { this.showToolDropdown = false; }, 200);
    }

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

    buscarPersona(): void {
        const termino = (this.reporteForm.get('buscar')?.value ?? '').trim().toLowerCase();
        if (!termino) return;

        const found = this.personalCache.find(p =>
            (p.licencia ?? '').toLowerCase().includes(termino) ||
            (p.nombreCompleto ?? '').toLowerCase().includes(termino)
        );

        if (found) {
            this.employeeIdActual = found.id_employee ?? 0;
            this.reporteForm.patchValue({ nombreApellido: found.nombreCompleto ?? '' });
        } else {
            this.showMessage('Personal no encontrado', 'error');
        }
    }

    submitQuarantine(): void {
        if (!this.isReporteValido() || this.toolList.length === 0) return;
        this.isLoading = true;
        const rep = this.reporteForm.getRawValue();

        const requests = this.toolList.map(tool => {
            const payload: any = {
                reportNumber: rep.nroReporteDiscrepancia,
                toolId: tool.id_tool,
                base: tool.base,
                expirationDate: tool.fechaVencimiento || null,
                quantityInQuarantine: 1,
                entryDate: rep.fecha,
                reportedByName: rep.nombreApellido || rep.realizadoPor,
                reason: rep.motivo,
                reasonDescription: rep.descripcion,
                status: 'active',
                workflowInstructions: {
                    productUpdate: {
                        status: 'CUARENTENA',
                        quarantineFlag: 'SI',
                        stockDeduction: tool.cantidad
                    },
                    movementLog: {
                        type: 'SALIDA_CUARENTENA',
                        reference: rep.nroReporteDiscrepancia,
                        notes: `Traslado a cuarentena. Motivo: ${rep.motivo}`
                    }
                }
            };

            if (this.employeeIdActual > 0) payload.reportedById = this.employeeIdActual;
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
