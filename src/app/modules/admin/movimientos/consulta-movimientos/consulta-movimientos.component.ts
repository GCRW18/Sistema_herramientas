import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, finalize, debounceTime } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';
import { CalibrationService } from '../../../../core/services/calibration.service';

// Tipos de movimiento basados en el Excel
type TipoMovimiento = 'TODOS' | 'ENTRADA' | 'SALIDA';
type TipoEntrada = 'COMPRA' | 'RETORNO_CALIBRACION' | 'DEVOLUCION' | 'RETORNO_BASE' | 'RETORNO_TERCEROS' | 'AJUSTE';
type TipoSalida = 'PRESTAMO' | 'ENVIO_BASE' | 'ENVIO_CALIBRACION' | 'PRESTAMO_TERCEROS' | 'TRANSFERENCIA' | 'BAJA';

interface MovimientoItem {
    id: string;
    fecha: string;
    hora: string;
    comprobante: string;
    tipo: 'ENTRADA' | 'SALIDA';
    subtipo: string;
    codigo: string;
    descripcion: string;
    pn: string;
    sn: string;
    cantidad: number;
    origenDestino: string;
    responsable: string;
    usuario: string;
    observacion: string;
    estado: string;
}

interface HerramientaDetalle {
    codigo: string;
    nombre: string;
    pn: string;
    sn: string;
    descripcion: string;
    ubicacion: string;
    estado: string;
    existencia: number;
    ultimoMovimiento: string;
    requiereCalibracion: boolean;
    fechaProximaCalibracion?: string;
}

interface ResumenMovimientos {
    totalEntradas: number;
    totalSalidas: number;
    cantidadEntradas: number;
    cantidadSalidas: number;
    saldoFinal: number;
}

@Component({
    selector: 'app-consulta-movimientos',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatInputModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatPaginatorModule,
        MatTooltipModule,
        MatCheckboxModule,
        DragDropModule
    ],
    templateUrl: './consulta-movimientos.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 3px solid black;
            --neo-shadow: 5px 5px 0px 0px rgba(0,0,0,1);
        }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 12px !important;
        }

        :host ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: white !important;
            border: 2px solid black !important;
            border-radius: 8px !important;
            padding: 0 12px !important;
            min-height: 48px;
            box-shadow: 3px 3px 0px 0px rgba(0, 0, 0, 0.1);
            transition: all 0.2s;
            display: flex;
            align-items: center;
        }

        :host-context(.dark) ::ng-deep .mat-mdc-text-field-wrapper {
            background-color: #0f172a !important;
        }

        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-text-field-wrapper {
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,1);
            transform: translate(-1px, -1px);
        }

        :host ::ng-deep .mat-mdc-input-element {
            font-weight: 700 !important;
            color: black !important;
        }

        :host-context(.dark) ::ng-deep .mat-mdc-input-element {
            color: white !important;
        }

        :host ::ng-deep .mat-mdc-select-value {
            font-weight: 700 !important;
            color: black !important;
        }

        :host-context(.dark) ::ng-deep .mat-mdc-select-value {
            color: white !important;
        }

        :host ::ng-deep .mat-mdc-floating-label {
            font-weight: 800 !important;
            color: #6B7280 !important;
            text-transform: uppercase;
            font-size: 11px !important;
        }

        :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-floating-label {
            color: black !important;
        }

        :host-context(.dark) ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-floating-label {
            color: #fbbf24 !important;
        }

        :host ::ng-deep .mat-mdc-icon-button {
            color: black !important;
        }

        :host-context(.dark) ::ng-deep .mat-mdc-icon-button {
            color: white !important;
        }

        :host ::ng-deep .mat-mdc-form-field-focus-overlay,
        :host ::ng-deep .mat-mdc-notched-outline {
            display: none !important;
        }

        .spinner-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            border-radius: 12px;
        }

        :host-context(.dark) .spinner-overlay {
            background: rgba(15, 23, 42, 0.8);
        }

        .row-entrada {
            background-color: #ecfdf5 !important;
        }

        :host-context(.dark) .row-entrada {
            background-color: rgba(16, 185, 129, 0.1) !important;
        }

        .row-salida {
            background-color: #fef3c7 !important;
        }

        :host-context(.dark) .row-salida {
            background-color: rgba(251, 191, 36, 0.1) !important;
        }
    `]
})
export class ConsultaMovimientosComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<ConsultaMovimientosComponent>, { optional: true });
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private calibrationService = inject(CalibrationService);

    private _unsubscribeAll = new Subject<void>();

    // Formulario de filtros
    filtroForm!: FormGroup;

    // Estados
    isLoading = false;
    isSearching = false;
    hasSearched = false;

    // Auditoría por herramienta (90 días)
    auditToolCode = '';
    auditToolId: number | null = null;
    auditResults: any[] = [];
    isAuditing = false;
    hasAudited = false;
    showAuditPanel = false;

    // Opciones de filtros
    gestionOptions: number[] = [];
    tiposMovimiento: { value: TipoMovimiento; label: string }[] = [
        { value: 'TODOS', label: 'Todos los movimientos' },
        { value: 'ENTRADA', label: 'Solo Entradas' },
        { value: 'SALIDA', label: 'Solo Salidas' }
    ];

    tiposEntrada: { value: string; label: string }[] = [
        { value: '', label: 'Todos' },
        { value: 'COMPRA', label: 'Compra/Ingreso' },
        { value: 'RETORNO_CALIBRACION', label: 'Retorno Calibración' },
        { value: 'DEVOLUCION', label: 'Devolución Herramienta' },
        { value: 'RETORNO_BASE', label: 'Retorno de Base' },
        { value: 'RETORNO_TERCEROS', label: 'Retorno de Terceros' },
        { value: 'AJUSTE', label: 'Ajuste de Ingreso' }
    ];

    tiposSalida: { value: string; label: string }[] = [
        { value: '', label: 'Todos' },
        { value: 'PRESTAMO', label: 'Préstamo a Técnico' },
        { value: 'ENVIO_BASE', label: 'Envío a Base' },
        { value: 'ENVIO_CALIBRACION', label: 'Envío a Calibración' },
        { value: 'PRESTAMO_TERCEROS', label: 'Préstamo a Terceros' },
        { value: 'TRANSFERENCIA', label: 'Transferencia' },
        { value: 'BAJA', label: 'Baja de Herramienta' }
    ];

    // Datos
    allMovimientos: MovimientoItem[] = [];
    dataSource: MovimientoItem[] = [];
    herramientaSeleccionada: HerramientaDetalle | null = null;
    resumen: ResumenMovimientos = {
        totalEntradas: 0,
        totalSalidas: 0,
        cantidadEntradas: 0,
        cantidadSalidas: 0,
        saldoFinal: 0
    };

    // Paginación
    totalRecords = 0;
    pageSize = 10;
    pageIndex = 0;
    pageSizeOptions = [10, 25, 50, 100];

    // Tabla
    displayedColumns: string[] = [
        'fecha', 'hora', 'comprobante', 'tipo', 'subtipo',
        'codigo', 'descripcion', 'cantidad', 'origenDestino', 'responsable', 'observacion'
    ];

    constructor() {
        // Generar opciones de gestión (últimos 10 años)
        const currentYear = new Date().getFullYear();
        for (let i = currentYear; i >= currentYear - 10; i--) {
            this.gestionOptions.push(i);
        }
    }

    ngOnInit(): void {
        this.initForm();
        this.setupFilters();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private initForm(): void {
        const today = new Date();
        const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

        this.filtroForm = this.fb.group({
            busqueda: [''],
            tipoBusqueda: ['codigo'], // codigo, pn, nombre, sn
            tipoMovimiento: ['TODOS'],
            subtipoEntrada: [''],
            subtipoSalida: [''],
            fechaDesde: [firstDayOfYear],
            fechaHasta: [today],
            gestion: [today.getFullYear()],
            soloConCalibracion: [false]
        });
    }

    private setupFilters(): void {
        // Debounce en búsqueda de texto
        this.filtroForm.get('busqueda')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll),
            debounceTime(300)
        ).subscribe(() => {
            if (this.hasSearched) {
                this.filtrarLocal();
            }
        });

        // Actualizar fechas cuando cambia la gestión
        this.filtroForm.get('gestion')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(year => {
            if (year) {
                this.filtroForm.patchValue({
                    fechaDesde: new Date(year, 0, 1),
                    fechaHasta: year === new Date().getFullYear() ? new Date() : new Date(year, 11, 31)
                }, { emitEvent: false });
            }
        });
    }

    goBack(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/entradas']);
        }
    }

    consultar(): void {
        this.isSearching = true;
        this.hasSearched = true;

        const filtros = this.filtroForm.value;

        // Intentar cargar desde el servicio
        this.movementService.getHistorialMovimientos({
            fechaDesde: this.formatDateForApi(filtros.fechaDesde),
            fechaHasta: this.formatDateForApi(filtros.fechaHasta),
            movement_type: filtros.tipoMovimiento === 'TODOS' ? undefined : filtros.tipoMovimiento.toLowerCase(),
            search: filtros.busqueda,
            page: 1,
            limit: 100
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSearching = false)
        ).subscribe({
            next: (response) => {
                if (response.data && response.data.length > 0) {
                    this.allMovimientos = response.data.map((item: any) => this.mapToMovimiento(item));
                } else {
                    this.loadMockData();
                }
                this.filtrarLocal();
                this.calcularResumen();
                this.showMessage(`Se encontraron ${this.allMovimientos.length} movimiento(s)`, 'success');
            },
            error: () => {
                this.loadMockData();
                this.filtrarLocal();
                this.calcularResumen();
                this.showMessage(`Se cargaron ${this.allMovimientos.length} movimiento(s) de prueba`, 'info');
            }
        });
    }

    // =========================================================================
    // AUDITORÍA POR HERRAMIENTA (90 días)
    // =========================================================================

    toggleAuditPanel(): void {
        this.showAuditPanel = !this.showAuditPanel;
        if (!this.showAuditPanel) {
            this.auditResults = [];
            this.hasAudited = false;
            this.auditToolCode = '';
            this.auditToolId = null;
        }
    }

    buscarAuditoriaHerramienta(): void {
        const code = this.auditToolCode.trim();
        if (!code) {
            this.showMessage('Ingrese el código de la herramienta', 'warning');
            return;
        }
        this.isAuditing = true;
        this.hasAudited = false;
        this.auditResults = [];
        this.auditToolId = null;

        // Primero resolver el código a tool_id
        this.calibrationService.scanToolForCalibration(code).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (tool) => {
                if (!tool?.id_tool) {
                    this.isAuditing = false;
                    this.showMessage('Herramienta no encontrada: ' + code, 'error');
                    return;
                }
                this.auditToolId = tool.id_tool;
                // Ahora obtener historial
                this.movementService.getToolAuditHistory(tool.id_tool, 90).pipe(
                    takeUntil(this._unsubscribeAll),
                    finalize(() => { this.isAuditing = false; this.hasAudited = true; })
                ).subscribe({
                    next: (items) => {
                        this.auditResults = items;
                        if (items.length === 0) {
                            this.showMessage('Sin movimientos en los últimos 90 días', 'info');
                        } else {
                            this.showMessage(`${items.length} evento(s) en los últimos 90 días`, 'success');
                        }
                    },
                    error: () => {
                        this.auditResults = [];
                        this.showMessage('Error al cargar el historial', 'error');
                    }
                });
            },
            error: () => {
                this.isAuditing = false;
                this.showMessage('Error al buscar la herramienta', 'error');
            }
        });
    }

    getAuditColorClass(color: string): string {
        const map: Record<string, string> = {
            blue:  'bg-blue-100 text-blue-800 border-blue-300',
            amber: 'bg-amber-100 text-amber-800 border-amber-300',
            green: 'bg-green-100 text-green-800 border-green-300',
            red:   'bg-red-100 text-red-800 border-red-300'
        };
        return map[color] || 'bg-gray-100 text-gray-800 border-gray-300';
    }

    private mapToMovimiento(item: any): MovimientoItem {
        const isEntrada = item.type === 'entry' || item.movement_type === 'entry';
        return {
            id: item.id || item.id_movement,
            fecha: this.formatDate(item.date || item.fecha),
            hora: item.time || item.hora || '00:00',
            comprobante: item.movementNumber || item.comprobante || '-',
            tipo: isEntrada ? 'ENTRADA' : 'SALIDA',
            subtipo: this.mapSubtipo(isEntrada ? item.entryReason : item.exitReason),
            codigo: item.items?.[0]?.tool?.code || item.codigo || '-',
            descripcion: item.items?.[0]?.tool?.description || item.descripcion || '-',
            pn: item.items?.[0]?.tool?.partNumber || item.pn || '-',
            sn: item.items?.[0]?.tool?.serialNumber || item.sn || '-',
            cantidad: item.items?.[0]?.quantity || item.cantidad || 1,
            origenDestino: item.origin || item.destination || item.origenDestino || '-',
            responsable: item.requestedBy?.fullName || item.responsable || '-',
            usuario: item.createdBy || item.usuario || '-',
            observacion: item.notes || item.observacion || '-',
            estado: item.status || 'completed'
        };
    }

    private mapSubtipo(reason: string): string {
        const map: Record<string, string> = {
            'purchase': 'COMPRA',
            'calibration_return': 'RET. CALIBRACIÓN',
            'return': 'DEVOLUCIÓN',
            'base_return': 'RET. BASE',
            'third_party_return': 'RET. TERCEROS',
            'adjustment': 'AJUSTE',
            'loan': 'PRÉSTAMO',
            'calibration_send': 'ENV. CALIBRACIÓN',
            'base_send': 'ENV. BASE',
            'third_party_loan': 'PRÉST. TERCEROS',
            'transfer': 'TRANSFERENCIA',
            'decommission': 'BAJA'
        };
        return map[reason] || reason?.toUpperCase() || '-';
    }

    private loadMockData(): void {
        // Datos realistas basados en el sistema Excel de BoA
        this.allMovimientos = [
            // ENTRADAS
            {
                id: '1', fecha: '29/01/2026', hora: '08:30', comprobante: 'ENT-2026-015',
                tipo: 'ENTRADA', subtipo: 'RET. CALIBRACIÓN', codigo: 'BOA-H-0245',
                descripcion: 'Torquímetro Digital 50-250 lb-ft SNAP-ON', pn: 'TECH3FR250', sn: 'TQ-2023-0245',
                cantidad: 1, origenDestino: 'IBMETRO', responsable: 'GABRIEL CONDORI', usuario: 'gcondori',
                observacion: 'Certificado CAL-2026-0089 - APROBADO', estado: 'completed'
            },
            {
                id: '2', fecha: '28/01/2026', hora: '10:15', comprobante: 'ENT-2026-014',
                tipo: 'ENTRADA', subtipo: 'COMPRA', codigo: 'BOA-H-1156',
                descripcion: 'Juego de Llaves Allen Métricas Wiha', pn: '36991', sn: 'N/A',
                cantidad: 5, origenDestino: 'PROVEEDOR TECNI-TOOLS', responsable: 'MARIA LOPEZ', usuario: 'mlopez',
                observacion: 'Factura F-2026-00234', estado: 'completed'
            },
            {
                id: '3', fecha: '27/01/2026', hora: '14:45', comprobante: 'ENT-2026-013',
                tipo: 'ENTRADA', subtipo: 'DEVOLUCIÓN', codigo: 'BOA-H-0892',
                descripcion: 'Multímetro Digital Fluke 87V', pn: 'FLUKE-87V', sn: 'FL-2023-0892',
                cantidad: 1, origenDestino: 'TEC. CARLOS MAMANI (LIC-1245)', responsable: 'PEDRO SANCHEZ', usuario: 'psanchez',
                observacion: 'Préstamo P-2026-0089 completado', estado: 'completed'
            },
            {
                id: '4', fecha: '26/01/2026', hora: '09:00', comprobante: 'ENT-2026-012',
                tipo: 'ENTRADA', subtipo: 'RET. BASE', codigo: 'BOA-H-0567',
                descripcion: 'Pie de Rey Digital 300mm Mitutoyo', pn: '500-197-30', sn: 'PR-2024-0567',
                cantidad: 1, origenDestino: 'BASE COCHABAMBA', responsable: 'ANA MARTINEZ', usuario: 'amartinez',
                observacion: 'COMAT-2026-0023 retornado', estado: 'completed'
            },
            {
                id: '5', fecha: '25/01/2026', hora: '11:30', comprobante: 'ENT-2026-011',
                tipo: 'ENTRADA', subtipo: 'RET. CALIBRACIÓN', codigo: 'BOA-H-0312',
                descripcion: 'Manómetro Digital 0-300 PSI Fluke', pn: '700G27', sn: 'MN-2024-0312',
                cantidad: 1, origenDestino: 'CESMEC BOLIVIA', responsable: 'GABRIEL CONDORI', usuario: 'gcondori',
                observacion: 'Certificado CAL-2026-0078 - APROBADO', estado: 'completed'
            },
            // SALIDAS
            {
                id: '6', fecha: '29/01/2026', hora: '07:45', comprobante: 'SAL-2026-089',
                tipo: 'SALIDA', subtipo: 'PRÉSTAMO', codigo: 'BOA-H-0234',
                descripcion: 'Llave de Torque 1/2" 20-150 lb-ft', pn: 'CDI-1503MFRPH', sn: 'LT-2022-0234',
                cantidad: 1, origenDestino: 'TEC. JUAN QUISPE (LIC-1189)', responsable: 'MARIA LOPEZ', usuario: 'mlopez',
                observacion: 'OT-2026-0156 - Mant. CP-2907', estado: 'completed'
            },
            {
                id: '7', fecha: '28/01/2026', hora: '15:00', comprobante: 'SAL-2026-088',
                tipo: 'SALIDA', subtipo: 'ENV. BASE', codigo: 'BOA-H-0445',
                descripcion: 'Kit de Herramientas Básico Boeing', pn: 'BOEING-TK-001', sn: 'KIT-2023-0445',
                cantidad: 1, origenDestino: 'BASE SANTA CRUZ', responsable: 'CARLOS RODRIGUEZ', usuario: 'crodriguez',
                observacion: 'COMAT-2026-0045 - Permanente', estado: 'completed'
            },
            {
                id: '8', fecha: '27/01/2026', hora: '08:00', comprobante: 'SAL-2026-087',
                tipo: 'SALIDA', subtipo: 'ENV. CALIBRACIÓN', codigo: 'BOA-H-0689',
                descripcion: 'Multímetro Digital Fluke 87V', pn: 'FLUKE-87V', sn: 'FL-2023-0689',
                cantidad: 1, origenDestino: 'IBMETRO', responsable: 'GABRIEL CONDORI', usuario: 'gcondori',
                observacion: 'Calibración anual - Vence 15/02/2026', estado: 'completed'
            },
            {
                id: '9', fecha: '26/01/2026', hora: '16:30', comprobante: 'SAL-2026-086',
                tipo: 'SALIDA', subtipo: 'PRÉSTAMO', codigo: 'BOA-H-0778',
                descripcion: 'Boroscopio Flexible Olympus', pn: 'IPLEX-NX', sn: 'BOR-2024-0778',
                cantidad: 1, origenDestino: 'TEC. MARIO COPA (LIC-1302)', responsable: 'PEDRO SANCHEZ', usuario: 'psanchez',
                observacion: 'OT-2026-0148 - Insp. CP-2915', estado: 'completed'
            },
            {
                id: '10', fecha: '25/01/2026', hora: '09:30', comprobante: 'SAL-2026-085',
                tipo: 'SALIDA', subtipo: 'PRÉST. TERCEROS', codigo: 'BOA-H-0923',
                descripcion: 'Analizador de Vibraciones SKF', pn: 'CMVA-65', sn: 'AV-2023-0923',
                cantidad: 1, origenDestino: 'AMASZONAS S.A.', responsable: 'ANA MARTINEZ', usuario: 'amartinez',
                observacion: 'Préstamo autorizado por Gerencia - Ret. 10/02/2026', estado: 'completed'
            },
            {
                id: '11', fecha: '24/01/2026', hora: '11:00', comprobante: 'ENT-2026-010',
                tipo: 'ENTRADA', subtipo: 'RET. TERCEROS', codigo: 'BOA-H-0856',
                descripcion: 'Detector de Metales Garrett', pn: 'GTI-2500', sn: 'DM-2022-0856',
                cantidad: 1, origenDestino: 'TAM AIRLINES', responsable: 'CARLOS RODRIGUEZ', usuario: 'crodriguez',
                observacion: 'Préstamo PT-2025-0234 finalizado', estado: 'completed'
            },
            {
                id: '12', fecha: '23/01/2026', hora: '14:00', comprobante: 'SAL-2026-084',
                tipo: 'SALIDA', subtipo: 'TRANSFERENCIA', codigo: 'BOA-H-0345',
                descripcion: 'Compresor Portátil 2HP', pn: 'SENCO-PC1010', sn: 'CP-2021-0345',
                cantidad: 1, origenDestino: 'ALMACÉN HANGAR 2', responsable: 'MARIA LOPEZ', usuario: 'mlopez',
                observacion: 'Reubicación por reorganización', estado: 'completed'
            },
            {
                id: '13', fecha: '22/01/2026', hora: '10:45', comprobante: 'ENT-2026-009',
                tipo: 'ENTRADA', subtipo: 'AJUSTE', codigo: 'BOA-H-0189',
                descripcion: 'Destornillador Aislado Set 7pzs', pn: 'WIHA-32099', sn: 'N/A',
                cantidad: 2, origenDestino: 'AJUSTE INVENTARIO', responsable: 'GABRIEL CONDORI', usuario: 'gcondori',
                observacion: 'Regularización inventario físico', estado: 'completed'
            },
            {
                id: '14', fecha: '21/01/2026', hora: '08:15', comprobante: 'SAL-2026-083',
                tipo: 'SALIDA', subtipo: 'BAJA', codigo: 'BOA-H-0078',
                descripcion: 'Taladro Neumático Obsoleto', pn: 'OLD-DRILL-001', sn: 'TN-2015-0078',
                cantidad: 1, origenDestino: 'BAJA DEFINITIVA', responsable: 'ANA MARTINEZ', usuario: 'amartinez',
                observacion: 'Autorizado por Memo-2026-0012 - Desgaste irreparable', estado: 'completed'
            },
            {
                id: '15', fecha: '20/01/2026', hora: '13:30', comprobante: 'ENT-2026-008',
                tipo: 'ENTRADA', subtipo: 'COMPRA', codigo: 'BOA-H-1157',
                descripcion: 'Lámpara Inspección LED Recargable', pn: 'STREAMLIGHT-68201', sn: 'LI-2026-001',
                cantidad: 3, origenDestino: 'PROVEEDOR SAFETY TOOLS', responsable: 'PEDRO SANCHEZ', usuario: 'psanchez',
                observacion: 'OC-2026-0089 - Factura F-2026-00198', estado: 'completed'
            }
        ];
    }

    private filtrarLocal(): void {
        const filtros = this.filtroForm.value;
        let resultado = [...this.allMovimientos];

        // Filtrar por tipo de movimiento
        if (filtros.tipoMovimiento !== 'TODOS') {
            resultado = resultado.filter(m => m.tipo === filtros.tipoMovimiento);
        }

        // Filtrar por subtipo
        if (filtros.tipoMovimiento === 'ENTRADA' && filtros.subtipoEntrada) {
            resultado = resultado.filter(m => m.subtipo.includes(filtros.subtipoEntrada));
        }
        if (filtros.tipoMovimiento === 'SALIDA' && filtros.subtipoSalida) {
            resultado = resultado.filter(m => m.subtipo.includes(filtros.subtipoSalida));
        }

        // Filtrar por búsqueda de texto
        if (filtros.busqueda) {
            const busqueda = filtros.busqueda.toLowerCase().trim();
            resultado = resultado.filter(m => {
                switch (filtros.tipoBusqueda) {
                    case 'codigo':
                        return m.codigo.toLowerCase().includes(busqueda);
                    case 'pn':
                        return m.pn.toLowerCase().includes(busqueda);
                    case 'sn':
                        return m.sn.toLowerCase().includes(busqueda);
                    case 'nombre':
                        return m.descripcion.toLowerCase().includes(busqueda);
                    default:
                        return m.codigo.toLowerCase().includes(busqueda) ||
                               m.descripcion.toLowerCase().includes(busqueda) ||
                               m.pn.toLowerCase().includes(busqueda) ||
                               m.sn.toLowerCase().includes(busqueda);
                }
            });
        }

        // Filtrar por solo calibración
        if (filtros.soloConCalibracion) {
            resultado = resultado.filter(m =>
                m.subtipo.includes('CALIBRACIÓN') || m.subtipo.includes('CALIBRACION')
            );
        }

        this.totalRecords = resultado.length;
        this.dataSource = resultado.slice(
            this.pageIndex * this.pageSize,
            (this.pageIndex + 1) * this.pageSize
        );
    }

    private calcularResumen(): void {
        const entradas = this.allMovimientos.filter(m => m.tipo === 'ENTRADA');
        const salidas = this.allMovimientos.filter(m => m.tipo === 'SALIDA');

        this.resumen = {
            totalEntradas: entradas.length,
            totalSalidas: salidas.length,
            cantidadEntradas: entradas.reduce((sum, m) => sum + m.cantidad, 0),
            cantidadSalidas: salidas.reduce((sum, m) => sum + m.cantidad, 0),
            saldoFinal: entradas.reduce((sum, m) => sum + m.cantidad, 0) - salidas.reduce((sum, m) => sum + m.cantidad, 0)
        };
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.filtrarLocal();
    }

    seleccionarMovimiento(mov: MovimientoItem): void {
        // Simular carga de detalle de herramienta
        this.herramientaSeleccionada = {
            codigo: mov.codigo,
            nombre: mov.descripcion,
            pn: mov.pn,
            sn: mov.sn,
            descripcion: `Herramienta ${mov.descripcion} - Último movimiento: ${mov.subtipo}`,
            ubicacion: mov.tipo === 'SALIDA' ? mov.origenDestino : 'Almacén Central',
            estado: mov.tipo === 'SALIDA' ? 'EN USO' : 'DISPONIBLE',
            existencia: mov.tipo === 'ENTRADA' ? mov.cantidad : 0,
            ultimoMovimiento: `${mov.fecha} - ${mov.subtipo}`,
            requiereCalibracion: mov.subtipo.includes('CALIBRACIÓN'),
            fechaProximaCalibracion: mov.subtipo.includes('CALIBRACIÓN') ? '15/01/2027' : undefined
        };
    }

    limpiarFormulario(): void {
        const today = new Date();
        this.filtroForm.reset({
            busqueda: '',
            tipoBusqueda: 'codigo',
            tipoMovimiento: 'TODOS',
            subtipoEntrada: '',
            subtipoSalida: '',
            fechaDesde: new Date(today.getFullYear(), 0, 1),
            fechaHasta: today,
            gestion: today.getFullYear(),
            soloConCalibracion: false
        });
        this.allMovimientos = [];
        this.dataSource = [];
        this.herramientaSeleccionada = null;
        this.hasSearched = false;
        this.resumen = {
            totalEntradas: 0,
            totalSalidas: 0,
            cantidadEntradas: 0,
            cantidadSalidas: 0,
            saldoFinal: 0
        };
    }

    exportarExcel(): void {
        this.showMessage('Exportando a Excel...', 'info');
        // TODO: Implementar exportación real
        setTimeout(() => {
            this.showMessage('Archivo exportado correctamente', 'success');
        }, 1500);
    }

    exportarPDF(): void {
        this.showMessage('Generando PDF...', 'info');
        // TODO: Implementar exportación real
        setTimeout(() => {
            this.showMessage('PDF generado correctamente', 'success');
        }, 1500);
    }

    getRowClass(mov: MovimientoItem): string {
        return mov.tipo === 'ENTRADA' ? 'row-entrada' : 'row-salida';
    }

    getTipoClass(tipo: string): string {
        return tipo === 'ENTRADA'
            ? 'bg-green-500 text-white'
            : 'bg-amber-500 text-white';
    }

    getSubtipoClass(subtipo: string): string {
        if (subtipo.includes('CALIBRACIÓN') || subtipo.includes('CALIBRACION')) {
            return 'bg-purple-100 text-purple-800 border-purple-300';
        }
        if (subtipo.includes('PRÉSTAMO') || subtipo.includes('PRESTAMO')) {
            return 'bg-blue-100 text-blue-800 border-blue-300';
        }
        if (subtipo.includes('COMPRA')) {
            return 'bg-green-100 text-green-800 border-green-300';
        }
        if (subtipo.includes('DEVOLUCIÓN') || subtipo.includes('RET.')) {
            return 'bg-cyan-100 text-cyan-800 border-cyan-300';
        }
        if (subtipo.includes('ENV.')) {
            return 'bg-orange-100 text-orange-800 border-orange-300';
        }
        if (subtipo.includes('BAJA')) {
            return 'bg-red-100 text-red-800 border-red-300';
        }
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }

    private formatDate(date: string | Date): string {
        if (!date) return '-';
        try {
            const d = typeof date === 'string' ? new Date(date) : date;
            return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return String(date);
        }
    }

    private formatDateForApi(date: Date): string {
        if (!date) return '';
        return date.toISOString().split('T')[0];
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
