import { Component, OnInit, OnDestroy, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, finalize, timeout } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';

interface ExitItem {
    id: number;
    toolId?: number;
    item: number;
    codigo: string;
    descripcion: string;
    marca: string;
    partNumber: string;
    serialNumber: string;
    cantidad: number;
    um: string;
    estado: string;
    prioridad: string;
    motivo: string;
    observaciones: string;
}

interface Funcionario {
    nombre: string;
    Base: string;
    id: number;
    nombreCompleto: string;
    cargo: string;
    licencia: string;
}

interface Base {
    id: number;
    codigo: string;
    nombre: string;
    ciudad: string;
}

@Component({
    selector: 'app-envio-otras-bases',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatSelectModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatCheckboxModule,
        MatAutocompleteModule,
        MatTooltipModule,
        DragDropModule
    ],
    templateUrl: './envio-otras-bases.component.html',
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
            border-radius: 8px;
        }

        :host-context(.dark) .spinner-overlay {
            background: rgba(15, 23, 42, 0.8);
        }

        .row-selected {
            background-color: #fef3c7 !important;
        }

        :host-context(.dark) .row-selected {
            background-color: rgba(251, 191, 36, 0.2) !important;
        }
    `]
})
export class EnvioOtrasBasesComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<EnvioOtrasBasesComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private cdRef = inject(ChangeDetectorRef);
    private destroy$ = new Subject<void>();

    // Formulario reactivo
    exitForm!: FormGroup;

    // Estados
    isSaving = false;
    isLoading = false;
    showConfirmation = false;

    // Contador para IDs
    private itemIdCounter = 1;

    // Datos desde el backend
    bases: Base[] = [];
    personal: Funcionario[] = [];

    filteredFuncionariosEntrega: Funcionario[] = [];
    filteredFuncionariosRecibo: Funcionario[] = [];

    // Tipos de envío
    tiposEnvio = [
        { value: 'TRASPASO', label: 'Traspaso Definitivo', color: 'bg-purple-100 text-purple-800 border-2 border-purple-500' },
        { value: 'APOYO', label: 'Apoyo Temporal', color: 'bg-blue-100 text-blue-800 border-2 border-blue-500' },
        { value: 'AOG', label: 'AOG (Aircraft on Ground)', color: 'bg-red-100 text-red-800 border-2 border-red-500' },
        { value: 'PRESTAMO', label: 'Préstamo Inter-Base', color: 'bg-green-100 text-green-800 border-2 border-green-500' },
        { value: 'MANTENIMIENTO', label: 'Para Mantenimiento', color: 'bg-orange-100 text-orange-800 border-2 border-orange-500' }
    ];

    // Prioridades
    prioridades = [
        { value: 'NORMAL', label: 'Normal', color: 'bg-gray-100 text-gray-800 border-2 border-gray-500' },
        { value: 'URGENTE', label: 'Urgente', color: 'bg-yellow-100 text-yellow-800 border-2 border-yellow-500' },
        { value: 'AOG', label: 'AOG', color: 'bg-red-100 text-red-800 border-2 border-red-500' }
    ];

    // Columnas de la tabla - Mismo estilo que devolución
    displayedColumns: string[] = [
        'item', 'codigo', 'descripcion', 'pn', 'sn',
        'cantidad', 'estado', 'prioridad', 'acciones'
    ];

    // Data source con signal
    dataSource = signal<ExitItem[]>([]);

    constructor() {}

    ngOnInit(): void {
        this.initForm();
        this.cargarDatosIniciales();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initForm(): void {
        const today = new Date();
        const timeStr = today.toTimeString().slice(0, 5);

        this.exitForm = this.fb.group({
            baseOrigen: [''],
            baseDestino: ['', Validators.required],
            tipoEnvio: ['APOYO', Validators.required],
            prioridad: ['NORMAL', Validators.required],
            entregadoPor: ['', Validators.required],
            entregadoPorInput: [''],
            recibidoPor: ['', Validators.required],
            recibidoPorInput: [{ value: '', disabled: true }],
            nroGuia: [{ value: 'Se generará automáticamente', disabled: true }],
            nroVuelo: ['', Validators.required],
            fecha: [today.toISOString().split('T')[0], Validators.required],
            hora: [timeStr, Validators.required],
            aeronave: [''],
            ordenTrabajo: [''],
            observaciones: ['']
        });
    }

    private cargarDatosIniciales(): void {
        this.isLoading = true;
        this.dataSource.set([]);

        this.movementService.getPersonal().pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (personal) => {
                this.personal = personal;
                this.filteredFuncionariosEntrega = [...personal];
                this.filteredFuncionariosRecibo = [...personal];
                this.setupFilters();
                this.cdRef.detectChanges();
            },
            error: () => this.showMessage('Error al cargar personal', 'error')
        });
    }

    private setupFilters(): void {
        // Habilitar/deshabilitar recibidoPorInput según si hay base destino seleccionada
        this.exitForm.get('baseDestino')?.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(value => {
                const ctrl = this.exitForm.get('recibidoPorInput');
                if (value) {
                    ctrl?.enable();
                } else {
                    ctrl?.disable();
                    this.exitForm.patchValue({ recibidoPor: '', recibidoPorInput: '' });
                    this.filteredFuncionariosRecibo = [...this.personal];
                }
            });

        this.exitForm.get('entregadoPorInput')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged())
            .subscribe(value => {
                if (!value || typeof value !== 'string') {
                    this.filteredFuncionariosEntrega = [...this.personal];
                    return;
                }
                const filtro = value.toLowerCase();
                this.filteredFuncionariosEntrega = this.personal.filter(f =>
                    f.nombreCompleto.toLowerCase().includes(filtro) ||
                    f.cargo.toLowerCase().includes(filtro) ||
                    f.licencia.toLowerCase().includes(filtro)
                );
            });

        this.exitForm.get('recibidoPorInput')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged())
            .subscribe(value => {
                if (!value || typeof value !== 'string') {
                    this.filteredFuncionariosRecibo = [...this.personal];
                    return;
                }
                const filtro = value.toLowerCase();
                this.filteredFuncionariosRecibo = this.personal.filter(f =>
                    f.nombreCompleto.toLowerCase().includes(filtro) ||
                    f.cargo.toLowerCase().includes(filtro) ||
                    f.licencia.toLowerCase().includes(filtro)
                );
            });
    }

    selectFuncionarioEntrega(func: Funcionario): void {
        this.exitForm.patchValue({
            entregadoPor: func.id,
            entregadoPorInput: func.nombreCompleto
        });
    }

    selectFuncionarioRecibo(func: Funcionario): void {
        this.exitForm.patchValue({
            recibidoPor: func.id,
            recibidoPorInput: func.nombreCompleto
        });
    }

    displayFuncionario(func: any): string {
        if (!func) return '';
        if (typeof func === 'string') return func;
        return `${func.nombreCompleto ?? ''} - ${func.cargo ?? ''}`;
    }

    getBaseNombre(codigo: string): string {
        return codigo || '';
    }

    getTipoEnvioLabel(tipo: string): string {
        const tipoObj = this.tiposEnvio.find(t => t.value === tipo);
        return tipoObj ? tipoObj.label : tipo;
    }

    getTipoEnvioClass(tipo: string): string {
        const tipoObj = this.tiposEnvio.find(t => t.value === tipo);
        return tipoObj ? tipoObj.color : 'bg-gray-100 text-gray-800 border-2 border-gray-500';
    }

    getPrioridadClass(prioridad: string): string {
        const prio = this.prioridades.find(p => p.value === prioridad);
        return prio ? prio.color : 'bg-gray-100 text-gray-800 border-2 border-gray-500';
    }

    getEstadoClass(estado: string): string {
        switch (estado) {
            case 'SERVICEABLE':
                return 'bg-green-100 text-green-800 border-2 border-green-500';
            case 'UNSERVICEABLE':
                return 'bg-red-100 text-red-800 border-2 border-red-500';
            case 'EN_CALIBRACION':
                return 'bg-yellow-100 text-yellow-800 border-2 border-yellow-500';
            case 'EN_REPARACION':
                return 'bg-orange-100 text-orange-800 border-2 border-orange-500';
            default:
                return 'bg-gray-100 text-gray-800 border-2 border-gray-500';
        }
    }

    removeItem(item: ExitItem): void {
        const currentItems = this.dataSource();
        const updatedItems = currentItems.filter(i => i.id !== item.id);

        // Re-enumerar items
        updatedItems.forEach((it, idx) => it.item = idx + 1);

        this.dataSource.set(updatedItems);
        this.showMessage(`Herramienta ${item.codigo} eliminada del envío`, 'info');
    }

    getTotalCantidad(): number {
        return this.dataSource().reduce((sum, item) => sum + item.cantidad, 0);
    }

    getResumenPorPrioridadArray(): { prioridad: string; cantidad: number; color: string }[] {
        const items = this.dataSource();
        const resumen: { [key: string]: number } = {
            'NORMAL': 0,
            'URGENTE': 0,
            'AOG': 0
        };

        items.forEach(item => {
            resumen[item.prioridad] = (resumen[item.prioridad] || 0) + 1;
        });

        return Object.entries(resumen)
            .filter(([_, cantidad]) => cantidad > 0)
            .map(([prioridad, cantidad]) => ({
                prioridad: this.prioridades.find(p => p.value === prioridad)?.label || prioridad,
                cantidad,
                color: this.prioridades.find(p => p.value === prioridad)?.color || 'bg-gray-100 text-gray-800 border-2 border-gray-500'
            }));
    }

    hasError(field: string, error: string): boolean {
        const control = this.exitForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    // Validación - Mismo estilo que devolución
    validateEnvio(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (this.dataSource().length === 0) {
            errors.push('Debe agregar al menos una herramienta para enviar');
            return { valid: false, errors };
        }

        if (!this.exitForm.get('baseDestino')?.value) {
            errors.push('Seleccione la base destino');
        }

        if (!this.exitForm.get('nroVuelo')?.value) {
            errors.push('Seleccione el número de vuelo');
        }

        if (!this.exitForm.get('entregadoPor')?.value) {
            errors.push('Seleccione el responsable de entrega');
        }

        if (!this.exitForm.get('recibidoPor')?.value) {
            errors.push('Seleccione el responsable de recepción');
        }

        return { valid: errors.length === 0, errors };
    }

    // Procesar - Prepara confirmación
    procesar(): void {
        console.log('[PROCESAR] Click recibido');
        console.log('[PROCESAR] isSaving:', this.isSaving);
        console.log('[PROCESAR] dataSource length:', this.dataSource().length);
        console.log('[PROCESAR] Form value:', this.exitForm.getRawValue());

        const validation = this.validateEnvio();
        console.log('[PROCESAR] Validación:', validation);

        if (!validation.valid) {
            validation.errors.forEach(err => {
                console.warn('[PROCESAR] Error validación:', err);
                this.showMessage(err, 'error');
            });
            return;
        }

        console.log('[PROCESAR] Abriendo confirmación');
        // Mostrar modal de confirmación
        this.showConfirmation = true;
    }

    // Cancelar confirmación
    cancelarConfirmacion(): void {
        this.showConfirmation = false;
    }

    // Confirmar y finalizar envío
    confirmarEnvio(): void {
        console.log('[CONFIRMAR] Iniciando envío...');
        this.showConfirmation = false;
        this.isSaving = true;

        const fv = this.exitForm.getRawValue();
        const items = this.dataSource();

        const entregadoPorObj = this.personal.find(p => p.id === fv.entregadoPor);
        const recibidoPorObj  = this.personal.find(p => p.id === fv.recibidoPor);
        const baseOrigenObj   = this.bases.find(b => b.codigo === fv.baseOrigen);
        const baseDestinoObj  = this.bases.find(b => b.codigo === fv.baseDestino);

        const conditionMap: Record<string, string> = {
            'SERVICEABLE':    'good',
            'NUEVO':          'new',
            'EN_CALIBRACION': 'fair',
            'UNSERVICEABLE':  'poor',
            'EN_REPARACION':  'poor'
        };
        const itemsJson = JSON.stringify(items.map(i => ({
            tool_id:               i.toolId ?? 0,
            quantity:              i.cantidad,
            condition_on_movement: conditionMap[i.estado] || 'good',
            serial_number:         i.serialNumber || '',
            part_number:           i.partNumber   || '',
            notes:                 i.observaciones || ''
        })));

        // Build payload omitting int fields when null (pxp form-encodes null as string "null" → PostgreSQL cast error)
        const payload: any = {
            date:                  fv.fecha,
            time:                  fv.hora,
            requested_by_name:     entregadoPorObj?.nombreCompleto ?? '',
            received_by_name:      recibidoPorObj?.nombreCompleto ?? '',
            responsible_person:    fv.baseOrigen ?? '',
            department:            fv.baseDestino ?? '',
            document_number:       fv.nroVuelo ?? '',
            notes:                 fv.observaciones ?? '',
            specific_observations: `Tipo: ${fv.tipoEnvio} | Vuelo: ${fv.nroVuelo} | Aeronave: ${fv.aeronave ?? ''} | OT: ${fv.ordenTrabajo ?? ''}`,
            items_json:            itemsJson
        };
        if (baseOrigenObj?.id)           payload['source_warehouse_id']      = baseOrigenObj.id;
        if (baseDestinoObj?.id)          payload['destination_warehouse_id'] = baseDestinoObj.id;
        if (fv.entregadoPor)             payload['requested_by_id']          = Number(fv.entregadoPor);
        if (fv.recibidoPor)              payload['received_by_id']           = Number(fv.recibidoPor);

        console.log('[CONFIRMAR] Payload a enviar:', payload);

        this.movementService.registrarEnvioOtrasBases(payload).pipe(
            timeout(30000),
            finalize(() => { this.isSaving = false; console.log('[CONFIRMAR] finalize ejecutado'); }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (result: any) => {
                console.log('[CONFIRMAR] Respuesta del backend:', result);
                const nroGuia = result?.movement_number ?? result?.datos?.[0]?.movement_number ?? '';
                const entregadoPorObj = this.personal.find(p => p.id === fv.entregadoPor);
                const recibidoPorObj  = this.personal.find(p => p.id === fv.recibidoPor);
                this.abrirImpresionEnvio(nroGuia, fv, items, entregadoPorObj, recibidoPorObj);
                this.showMessage(`Envío ${nroGuia} registrado exitosamente`, 'success');
                this.dataSource.set([]);
                this.itemIdCounter = 1;
                this.exitForm.patchValue({ nroGuia: 'Se generará automáticamente' });

                if (this.dialogRef) {
                    this.dialogRef.close({ success: true, movement_number: nroGuia });
                }
            },
            error: (err: any) => {
                console.error('[CONFIRMAR] Error del backend:', err);
                const msg = err?.name === 'TimeoutError'
                    ? 'El servidor tardó demasiado. Intente de nuevo.'
                    : err?.message || 'Error al registrar el envío';
                this.showMessage(msg, 'error');
            }
        });
    }

    // Finalizar (método original que abre confirmación)
    finalizar(): void {
        this.procesar();
    }

    goBack(): void {
        if (this.dataSource().length > 0) {
            if (!confirm('¿Está seguro de salir? Hay items pendientes de envío.')) {
                return;
            }
        }

        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/salidas']);
        }
    }

    private showMessage(message: string, type: 'success' | 'error' | 'info'): void {
        const config: any = {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        };
        this.snackBar.open(message, 'Cerrar', config);
    }

    async openHerramientaAEnviar(): Promise<void> {
        const { HerramientaAEnviarComponent } = await import('./herramienta-a-enviar/herramienta-a-enviar.component');
        const dialogRef = this.dialog.open(HerramientaAEnviarComponent, {
            width: '1100px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            disableClose: false,
            data: {
                tipoEnvio: this.exitForm.get('tipoEnvio')?.value,
                prioridad: this.exitForm.get('prioridad')?.value,
                baseDestino: this.exitForm.get('baseDestino')?.value
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                const currentItems = this.dataSource();
                const newItem: ExitItem = {
                    id: this.itemIdCounter++,
                    toolId: result.data.toolId ?? result.data.id_tool,
                    item: currentItems.length + 1,
                    codigo: result.data.codigo || '',
                    descripcion: result.data.nombre || result.data.descripcion || '',
                    marca: result.data.marca || '',
                    partNumber: result.data.pn || result.data.part_number || '',
                    serialNumber: result.data.sn || result.data.serial_number || '',
                    cantidad: result.data.cantidad || 1,
                    um: result.data.unidad || result.data.unit_of_measure || 'PZA',
                    estado: result.data.estadoFisico || 'SERVICEABLE',
                    prioridad: result.data.prioridad || this.exitForm.get('prioridad')?.value || 'NORMAL',
                    motivo: result.data.motivo || '',
                    observaciones: result.data.observacion || ''
                };
                this.dataSource.set([...currentItems, newItem]);
                this.showMessage(`Herramienta ${newItem.codigo} agregada al envío`, 'success');
            }
        });
    }

    // ── PDF / Impresión ENV HH BASES ─────────────────────────────────────────

    private abrirImpresionEnvio(nro: string, fv: any, items: ExitItem[], entrega: any, recibe: any): void {
        const w = window.open('', '_blank');
        if (!w) return;
        const now  = new Date().toLocaleString('es-BO');
        const rows = items.map((item, i) => `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${item.descripcion || '-'}</td>
                <td>${item.partNumber  || '-'}</td>
                <td>${item.serialNumber|| '-'}</td>
                <td style="text-align:center">${item.cantidad}</td>
                <td>${item.estado      || '-'}</td>
                <td>${fv.fecha || ''}</td>
                <td style="height:28px">&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Envío Otras Bases ${nro}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
  .code-box { border: 2px solid #000; padding: 3px 10px; font-weight: 900; font-size: 13px; display: inline-block; }
  h1 { text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;
       background: #111A43; color: white; padding: 7px 10px; margin: 0 0 7px; border: 1px solid #000; }
  .info-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 7px; }
  .info-tbl td { border: 1px solid #ddd; padding: 3px 6px; }
  .lbl { background: #f0f0f0; font-weight: 700; font-size: 9px; width: 120px; }
  .nro-cell { background: #000; color: white; text-align: center; font-weight: 900; font-size: 14px; vertical-align: middle; width: 130px; }
  table.det { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.det th { background: #111A43; color: white; padding: 5px 4px; font-size: 8.5px; font-weight: 900;
                 text-transform: uppercase; border: 1px solid #000; text-align: center; }
  table.det td { padding: 4px; border: 1px solid #ddd; font-size: 9px; }
  table.det tr:nth-child(even) td { background: #f9f9f9; }
  .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  .sig { border: 1px solid #000; padding: 6px 10px; text-align: center; }
  .sig-ttl { font-weight: 900; font-size: 10px; text-transform: uppercase; margin-bottom: 26px; }
  .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 9px; }
  .footer { text-align: center; margin-top: 10px; font-size: 7.5px; color: #888; border-top: 1px dotted #ccc; padding-top: 4px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
<script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); };</script>
</head><body>
  <div class="top">
    <div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145#114 &nbsp; N-114</div>
    <div style="text-align:right">
      <div class="code-box">ENV-${nro || '___'}</div><br><span style="font-size:9px">REV. 0 &nbsp; 2016-10-25</span>
    </div>
  </div>
  <h1>REGISTRO DE HERRAMIENTAS ENVIADAS A OTRAS BASES</h1>
  <table class="info-tbl">
    <tr>
      <td class="lbl">BASE ORIGEN:</td><td>${fv.baseOrigen || ''}</td>
      <td class="lbl">BASE DESTINO:</td><td>${fv.baseDestino || ''}</td>
      <td class="nro-cell" rowspan="3">N° GUÍA<br>${nro || '___________'}</td>
    </tr>
    <tr>
      <td class="lbl">TIPO ENVÍO:</td><td>${fv.tipoEnvio || ''}</td>
      <td class="lbl">NRO. VUELO:</td><td>${fv.nroVuelo || ''}</td>
    </tr>
    <tr>
      <td class="lbl">FECHA Y HORA:</td><td>${fv.fecha || ''} ${fv.hora || ''}</td>
      <td class="lbl">AERONAVE:</td><td>${fv.aeronave || ''}</td>
    </tr>
    <tr>
      <td class="lbl">OBSERVACIONES:</td><td colspan="4">${fv.observaciones || ''}</td>
    </tr>
  </table>
  <table class="det">
    <thead><tr>
      <th>#</th><th>DESCRIPCIÓN</th><th>PART NUMBER</th><th>SERIAL NUMBER</th>
      <th>CANT.</th><th>ESTADO</th><th>FECHA ENVÍO</th><th>FIRMA ALMACÉN</th>
      <th>FECHA RETORNO</th><th>FIRMA ALMACÉN RETORNO</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sigs">
    <div class="sig">
      <div class="sig-ttl">ENTREGADO POR</div>
      <div style="font-size:9px;margin-bottom:14px">${entrega?.nombreCompleto || '____________________'}<br>${entrega?.cargo || ''}</div>
      <div class="sig-line">Firma Almacén Herramientas Origen</div>
    </div>
    <div class="sig">
      <div class="sig-ttl">RECIBIDO POR</div>
      <div style="font-size:9px;margin-bottom:14px">${recibe?.nombreCompleto || '____________________'}<br>${recibe?.cargo || ''}</div>
      <div class="sig-line">Firma Almacén Herramientas Destino</div>
    </div>
  </div>
  <div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div>
</body></html>`;

        w.document.write(html);
        w.document.close();
    }
}
