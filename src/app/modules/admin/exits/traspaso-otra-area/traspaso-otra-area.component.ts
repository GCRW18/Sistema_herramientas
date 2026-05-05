import { Component, OnInit, OnDestroy, signal, inject, ViewChild, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Subject, takeUntil, finalize, timeout, debounceTime, distinctUntilChanged } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';

interface TransferItem {
    toolId: number;
    codigo: string;
    partNumber: string;
    serialNumber: string;
    unidad: string;
    cantidad: number;
    descripcion: string;
    contenido: string;
    marca: string;
    fecha: string;
    estadoFisico: string;
    selected?: boolean;
}

interface Funcionario {
    nombre: string;
    Base: string;
    id: number;
    nombreCompleto: string;
    cargo: string;
    licencia: string;
}

@Component({
    selector: 'app-traspaso-otra-area',
    standalone: true,
    imports: [
        CommonModule, RouterModule, ReactiveFormsModule, FormsModule, MatButtonModule,
        MatIconModule, MatTableModule, MatCheckboxModule, MatTooltipModule,
        MatDialogModule, MatSnackBarModule, DragDropModule, MatProgressSpinnerModule,
        MatAutocompleteModule
    ],
    templateUrl: './traspaso-otra-area.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #fff; }

        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;
            backdrop-filter: blur(4px);
        }
        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }

        .row-selected { background-color: #fef3c7 !important; border-left: 4px solid #fbbf24 !important; }
        :host-context(.dark) .row-selected { background-color: rgba(251, 191, 36, 0.1) !important; border-left: 4px solid #fbbf24 !important; }

        @keyframes pulse-border {
            0%, 100% { border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            50% { border-color: #f87171; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
        }
        .animate-pulse-border { animation: pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        ::ng-deep .white-checkbox .mdc-checkbox__background { border-color: white !important; }
        ::ng-deep .white-checkbox.mat-mdc-checkbox-checked .mdc-checkbox__background { background-color: white !important; border-color: white !important; }
        ::ng-deep .white-checkbox .mdc-checkbox__checkmark { color: #0f172a !important; }
    `]
})
export class TraspasoOtraAreaComponent implements OnInit, OnDestroy {
    @ViewChild('datosTraspasoModal') datosTraspasoModal!: TemplateRef<any>;
    @ViewChild('confirmacionModal') confirmacionModal!: TemplateRef<any>;

    public dialogRef = inject(MatDialogRef<TraspasoOtraAreaComponent>, { optional: true });
    private dialogRefActual: MatDialogRef<any> | null = null;
    private dialog    = inject(MatDialog);
    private fb        = inject(FormBuilder);
    private router    = inject(Router);
    private snackBar  = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private cdRef = inject(ChangeDetectorRef);
    private destroy$  = new Subject<void>();

    transferForm!: FormGroup;
    isSaving      = false;
    isLoading = false;

    // Signal para la imagen de referencia del traspaso
    selectedImage = signal<string | null>(null);

    private personalCache: Funcionario[] = [];
    filteredPersonal: Funcionario[] = [];
    showSuggestions = false;

    tiposTraspaso = [
        { value: 'TEMPORAL', label: 'Temporal', color: 'bg-blue-100 text-blue-800 border-blue-500' },
        { value: 'PERMANENTE', label: 'Permanente', color: 'bg-purple-100 text-purple-800 border-purple-500' },
        { value: 'REASIGNACION', label: 'Reasignación', color: 'bg-green-100 text-green-800 border-green-500' },
        { value: 'PRESTAMO', label: 'Préstamo Interno', color: 'bg-yellow-100 text-yellow-800 border-yellow-500' }
    ];

    displayedColumns: string[] = [
        'select', 'fila', 'identificacion', 'descripcion', 'cantidad', 'estado', 'acciones'
    ];

    dataSource = signal<TransferItem[]>([]);

    ngOnInit(): void {
        this.initForm();
        this.cargarPersonal();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const now   = new Date();
        const hh    = now.getHours().toString().padStart(2, '0');
        const mm    = now.getMinutes().toString().padStart(2, '0');

        this.transferForm = this.fb.group({
            nombreCompletoInput: ['', Validators.required],
            nombreCompleto:      [''],
            nroLicencia:         ['', Validators.required],
            cargo:               ['', Validators.required],
            fecha:               [today, Validators.required],
            hora:                [`${hh}:${mm}`, Validators.required],
            gerencia:            ['', Validators.required],
            unidad:              ['', Validators.required],
            base:                ['VVI', Validators.required],
            tipoTraspaso:        ['TEMPORAL', Validators.required],
            observaciones:       ['']
        });
    }

    private cargarPersonal(): void {
        this.isLoading = true;
        this.movementService.getPersonal().pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (personal) => {
                this.personalCache = personal;
                this.filteredPersonal = [...personal];
                this.setupFilters();
            }
        });
    }

    private setupFilters(): void {
        this.transferForm.get('nombreCompletoInput')?.valueChanges.pipe(
            takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged()
        ).subscribe(value => {
            if (!value || typeof value !== 'string') { this.filteredPersonal = [...this.personalCache]; return; }
            const filtro = value.toLowerCase();
            this.filteredPersonal = this.personalCache.filter(f =>
                (f.nombreCompleto || '').toLowerCase().includes(filtro) ||
                (f.licencia || '').toLowerCase().includes(filtro)
            ).slice(0, 10);
        });
    }

    seleccionarPersona(func: any): void {
        this.transferForm.patchValue({
            nombreCompletoInput: func.nombreCompleto,
            nombreCompleto:      func.nombreCompleto,
            nroLicencia:         func.licencia ?? func.nro_licencia ?? '',
            cargo:               func.cargo ?? ''
        });
        this.filteredPersonal = [];
        this.showSuggestions  = false;
    }

    displayFuncionario(func: any): string {
        return func && typeof func !== 'string' ? `${func.nombreCompleto ?? ''}` : func;
    }

    // ── IMAGEN ───────────────────────────────────────────────────────────────
    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { this.selectedImage.set(reader.result as string); };
        reader.readAsDataURL(file);
    }

    removeImage(): void {
        this.selectedImage.set(null);
    }

    // --- MODALES ---
    abrirModalDatosTraspaso(): void {
        this.dialogRefActual = this.dialog.open(this.datosTraspasoModal, {
            width: '850px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalDatosTraspaso(): void {
        this.dialogRefActual?.close();
    }

    abrirModalConfirmacion(): void {
        this.transferForm.markAllAsTouched();
        if (this.transferForm.invalid) {
            this.showMessage('Complete los datos generales del traspaso', 'error');
            this.abrirModalDatosTraspaso();
            return;
        }
        if (this.dataSource().length === 0) {
            this.showMessage('Agregue al menos una herramienta', 'warning');
            return;
        }
        this.dialogRefActual = this.dialog.open(this.confirmacionModal, {
            width: '800px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalConfirmacion(): void {
        this.dialogRefActual?.close();
    }

    isDatosTraspasoValido(): boolean {
        return this.transferForm.valid;
    }

    // --- ACCIONES TABLA ---
    toggleSelection(item: TransferItem): void {
        const currentItems = this.dataSource();
        const updatedItems = currentItems.map(i => i.toolId === item.toolId ? { ...i, selected: !i.selected } : i);
        this.dataSource.set(updatedItems);
    }

    toggleAllSelection(event: any): void {
        const checked = event.checked;
        const updatedItems = this.dataSource().map(i => ({ ...i, selected: checked }));
        this.dataSource.set(updatedItems);
    }

    isAllSelected(): boolean { return this.dataSource().length > 0 && this.dataSource().every(item => item.selected); }
    isSomeSelected(): boolean { return this.dataSource().some(item => item.selected) && !this.isAllSelected(); }
    getSelectedCount(): number { return this.dataSource().filter(item => item.selected).length; }

    removeItem(item: TransferItem): void {
        const updatedItems = this.dataSource().filter(i => i.toolId !== item.toolId);
        this.dataSource.set(updatedItems);
        this.showMessage(`Herramienta eliminada`, 'info');
    }

    // --- AYUDAS VISUALES ---
    getTipoTraspasoLabel(tipo: string): string { return this.tiposTraspaso.find(t => t.value === tipo)?.label || tipo; }

    getEstadoClass(estado: string): string {
        switch (estado) {
            case 'SERVICEABLE': return 'bg-green-100 text-green-800 border-green-500';
            case 'UNSERVICEABLE': return 'bg-red-100 text-red-800 border-red-500';
            case 'EN_CALIBRACION': return 'bg-yellow-100 text-yellow-800 border-yellow-500';
            default: return 'bg-gray-100 text-gray-800 border-gray-500';
        }
    }

    getTotalCantidad(): number {
        return this.dataSource().reduce((t, i) => t + (i.cantidad || 0), 0);
    }

    hasError(field: string, error: string): boolean {
        const control = this.transferForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    async openTraspasoHerramienta(): Promise<void> {
        const { TraspasoHerramientaComponent } = await import('./traspaso-herramienta/traspaso-herramienta.component');
        const dialogRef = this.dialog.open(TraspasoHerramientaComponent, {
            width: '700px', maxWidth: '95vw', height: 'auto', maxHeight: '90vh',
            panelClass: 'neo-dialog-transparent', disableClose: false,
            data: { mode: 'add' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                const data = result.data;
                const newItem: TransferItem = {
                    toolId:       data.id_tool ?? 0,
                    codigo:       data.codigo || '',
                    partNumber:   data.pn     || '',
                    serialNumber: data.sn     || '',
                    unidad:       data.unidad || 'PZA',
                    cantidad:     data.cantidad || 1,
                    descripcion:  data.nombre  || data.descripcion || '',
                    contenido:    data.observacion || '',
                    marca:        data.marca   || '',
                    fecha:        new Date().toISOString().split('T')[0],
                    estadoFisico: data.estadoFisico || 'SERVICEABLE',
                    selected:     false
                };
                this.dataSource.set([...this.dataSource(), newItem]);
                this.showMessage(`Herramienta agregada`, 'success');
            }
        });
    }

    finalizar(): void {
        this.cerrarModalConfirmacion();
        this.isSaving = true;

        const fv    = this.transferForm.getRawValue();
        const items = this.dataSource();

        const conditionMap: Record<string, string> = {
            'SERVICEABLE':    'good', 'NUEVO': 'new', 'EN_CALIBRACION': 'fair',
            'UNSERVICEABLE':  'poor', 'EN_REPARACION':  'poor'
        };

        const itemsJson = JSON.stringify(items.map(i => ({
            tool_id:               i.toolId,
            quantity:              i.cantidad,
            condition_on_movement: conditionMap[i.estadoFisico] || 'good',
            serial_number:         i.serialNumber || '',
            part_number:           i.partNumber   || '',
            notes:                 i.contenido    || ''
        })));

        const department = `${fv.gerencia} | ${fv.unidad}`.trim();

        const payload: any = {
            date:                 fv.fecha,
            time:                 fv.hora,
            responsible_person:   fv.nombreCompleto,
            department:           department,
            exit_reason:          'area_transfer',
            authorized_by:        fv.nroLicencia,
            notes:                fv.observaciones ?? '',
            general_observations: `Tipo: ${fv.tipoTraspaso} | Base: ${fv.base} | Cargo: ${fv.cargo} | Licencia: ${fv.nroLicencia}`,
            items_json:           itemsJson,
            reference_image:      this.selectedImage() // Si el backend lo soporta, se envía
        };

        this.movementService.registrarTraspasoOtraArea(payload).pipe(
            timeout(30000), finalize(() => { this.isSaving = false; }), takeUntil(this.destroy$)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number ?? '';
                this.abrirVentanaImpresionTraspaso(nro, fv, items);
                this.showMessage(`Traspaso ${nro} registrado exitosamente`, 'success');
                this.dataSource.set([]);
                this.transferForm.reset();
                this.initForm();
                this.selectedImage.set(null);

                if (this.dialogRef) this.dialogRef.close({ success: true, movement_number: nro });
            },
            error: (err: any) => {
                const msg = err?.name === 'TimeoutError' ? 'El servidor tardó demasiado.' : err?.message || 'Error al registrar';
                this.showMessage(msg, 'error');
            }
        });
    }

    private showMessage(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
        this.snackBar.open(message, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }

    private abrirVentanaImpresionTraspaso(nro: string, fv: any, items: TransferItem[]): void {
        const w = window.open('', '_blank');
        if (!w) return;
        const now  = new Date().toLocaleString('es-BO');
        const rows = items.map(item => `
            <tr>
                <td><span style="font-family:monospace;font-weight:700;background:#0f172a;color:white;padding:1px 4px;border-radius:2px;font-size:9px">${item.codigo || '-'}</span></td>
                <td>${item.partNumber  || '-'}</td>
                <td>${item.serialNumber|| '-'}</td>
                <td style="text-align:center">${item.unidad || 'PZA'}</td>
                <td style="text-align:center;font-weight:700">${item.cantidad}</td>
                <td>${item.descripcion || '-'}</td>
                <td>${item.contenido   || '-'}</td>
                <td>${item.marca       || '-'}</td>
                <td>${item.fecha       || '-'}</td>
                <td>&nbsp;</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>MGH-109 Nota de Traspaso ${nro}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
  .code-box { border: 2px solid #000; padding: 3px 10px; font-weight: 900; font-size: 13px; display: inline-block; }
  h1 { text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; background: #111A43; color: white; padding: 7px 10px; margin: 0 0 7px; border: 1px solid #000; }
  .info-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 7px; }
  .info-tbl td { border: 1px solid #ddd; padding: 3px 6px; }
  .lbl { background: #f0f0f0; font-weight: 700; font-size: 9px; width: 130px; }
  .nro-cell { background: #f0f0f0; text-align: center; font-weight: 900; font-size: 15px; vertical-align: middle; width: 120px; }
  .sec { background: #111A43; color: white; padding: 3px 8px; font-weight: 900; font-size: 10px; text-transform: uppercase; border: 1px solid #000; margin: 0 0 0; }
  table.det { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.det th { background: #111A43; color: white; padding: 5px 4px; font-size: 8.5px; font-weight: 900; text-transform: uppercase; border: 1px solid #000; text-align: center; }
  table.det td { padding: 4px; border: 1px solid #ddd; font-size: 9px; }
  table.det tr:nth-child(even) td { background: #f9f9f9; }
  .nota { border: 1px solid #ccc; padding: 5px 8px; margin-top: 8px; font-size: 8.5px; background: #fffde7; line-height: 1.5; }
  .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 18px; }
  .sig { border: 1px solid #000; padding: 6px 8px; text-align: center; }
  .sig-ttl { font-weight: 900; font-size: 9px; text-transform: uppercase; margin-bottom: 28px; }
  .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 8.5px; }
  .footer { text-align: center; margin-top: 10px; font-size: 7.5px; color: #888; border-top: 1px dotted #ccc; padding-top: 4px; }
</style>
<script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); };</script>
</head><body>
  <div class="top">
    <div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145# N-014</div>
    <div style="font-size:13px;font-weight:900;text-align:center">NOTA DE TRASPASO<br><span style="font-size:10px;font-weight:400">HERRAMIENTAS, BANCOS DE PRUEBA Y EQUIPOS DE APOYO</span></div>
    <div style="text-align:right"><div class="code-box">MGH-109</div><br><span style="font-size:9px">REV. 0 &nbsp; 2017-10-03</span></div>
  </div>
  <table class="info-tbl">
    <tr><td class="lbl">NOMBRE SOLICITANTE:</td><td>${fv.nombreCompleto || ''}</td><td class="lbl">GERENCIA DESTINO:</td><td>${fv.gerencia || ''}</td><td class="nro-cell" rowspan="4"><div style="font-size:8px;font-weight:400">N° NOTA</div>${nro || '___________'}</td></tr>
    <tr><td class="lbl">LICENCIA:</td><td>${fv.nroLicencia || ''}</td><td class="lbl">DEPARTAMENTO:</td><td>${fv.departamento || ''}</td></tr>
    <tr><td class="lbl">CARGO:</td><td>${fv.cargo || ''}</td><td class="lbl">UNIDAD:</td><td>${fv.unidad || ''}</td></tr>
    <tr><td class="lbl">FECHA Y HORA:</td><td>${fv.fecha || ''} ${fv.hora || ''}</td><td class="lbl">TIPO TRASPASO:</td><td>${fv.tipoTraspaso || ''}</td></tr>
    <tr><td class="lbl">OBSERVACIONES:</td><td colspan="4">${fv.observaciones || ''}</td></tr>
  </table>
  <div class="sec">DETALLE</div>
  <table class="det">
    <thead><tr><th>CÓDIGO</th><th>P/N ó MODELO</th><th>S/N</th><th>UNIDAD</th><th>CANT.</th><th>NOMBRE</th><th>LISTA DE CONTENIDO</th><th>MARCA</th><th>FECHA CALIBRACIÓN</th><th>OBS</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="nota"><strong>NOTA IMPORTANTE:</strong><br>- Las herramientas descritas en la presente nota se encuentran en condición SERVICIABLE.<br>- La firma de la presente nota implica que se esta en conformidad con toda la informacion detallada.</div>
  <div class="sigs">
    <div class="sig"><div class="sig-ttl">ENTREGADO POR</div><div class="sig-line">Firma Almacén Herramientas</div></div>
    <div class="sig"><div class="sig-ttl">RECIBIDO POR</div><div class="sig-line">Firma Recepción</div></div>
    <div class="sig"><div class="sig-ttl">AUTORIZADO POR</div><div style="margin-top:6px;font-size:9px;text-align:left">Nombre: ___________________<br>Cargo: ____________________</div><div class="sig-line">Firma Autorizada BOA</div></div>
  </div>
  <div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div>
</body></html>`;
        w.document.write(html);
        w.document.close();
    }
}
