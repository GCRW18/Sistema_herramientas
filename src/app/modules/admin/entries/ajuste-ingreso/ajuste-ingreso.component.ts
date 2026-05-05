import { Component, inject, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, finalize } from 'rxjs/operators';
import { MovementService } from '../../../../core/services/movement.service';

interface AjusteItem {
    id: number;
    toolId: number;
    pn: string;
    descripcion: string;
    marca: string;
    sn: string;
    codigoBoa: string;
    cantidad: number;
    um: string;
    estado: string;
    ubicacion: string;
    tipoAjuste: string;
    documentos: string;
    obs: string;
    selected?: boolean;
}

interface Funcionario {
    id: number;
    nombre: string;
    cargo: string;
    area: string;
}

@Component({
    selector: 'app-ajuste-ingreso',
    standalone: true,
    imports: [
        CommonModule, RouterModule, MatCardModule, MatIconModule, MatButtonModule,
        MatTableModule, MatInputModule, MatFormFieldModule, MatDialogModule,
        MatSelectModule, MatAutocompleteModule, MatTooltipModule, MatCheckboxModule,
        MatProgressSpinnerModule, MatSnackBarModule, FormsModule, ReactiveFormsModule, DragDropModule
    ],
    templateUrl: './ajuste-ingreso.component.html',
    styles: [`
      :host { display: block; height: 100%; }
      .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }

      .spinner-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;
      }
      :host-context(.dark) .spinner-overlay { background: rgba(15, 23, 42, 0.8); }

      .row-selected { background-color: #fef3c7 !important; }
      :host-context(.dark) .row-selected { background-color: rgba(251, 191, 36, 0.2) !important; }

      @keyframes pulse-border {
        0%, 100% { border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        50% { border-color: #f87171; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
      }
      .animate-pulse-border { animation: pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    `]
})
export class AjusteIngresoComponent implements OnInit, OnDestroy {
    @ViewChild('datosAjusteModal') datosAjusteModal!: TemplateRef<any>;
    @ViewChild('confirmacionModal') confirmacionModal!: TemplateRef<any>;

    private dialogRefActual: MatDialogRef<any> | null = null;
    public dialogRef = inject(MatDialogRef<AjusteIngresoComponent>, { optional: true });
    private dialog   = inject(MatDialog);
    private fb       = inject(FormBuilder);
    private router   = inject(Router);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);

    private destroy$ = new Subject<void>();

    ajusteForm!: FormGroup;

    isLoading = false;
    isSaving  = false;

    tiposAjuste = [
        { value: 'INVENTARIO',  label: 'Ajuste Inventario',  color: 'bg-blue-100 text-blue-800 border-blue-400',     icon: 'inventory_2' },
        { value: 'REUBICACION', label: 'Reubicación',        color: 'bg-purple-100 text-purple-800 border-purple-400', icon: 'swap_horiz' },
        { value: 'DONACION',    label: 'Donación Recibida',  color: 'bg-green-100 text-green-800 border-green-400',   icon: 'card_giftcard' },
        { value: 'ENCONTRADO',  label: 'Item Encontrado',    color: 'bg-amber-100 text-amber-800 border-amber-400',   icon: 'search' },
        { value: 'SOBRANTE',    label: 'Sobrante',           color: 'bg-cyan-100 text-cyan-800 border-cyan-400',       icon: 'add_box' },
        { value: 'CORRECCION',  label: 'Corrección Sistema', color: 'bg-red-100 text-red-800 border-red-400',           icon: 'build' }
    ];

    estados = [
        { value: 'SERVICEABLE',    label: 'Serviceable',    color: 'bg-green-100 text-green-800 border-green-400' },
        { value: 'UNSERVICEABLE',  label: 'Unserviceable',  color: 'bg-red-100 text-red-800 border-red-400' },
        { value: 'EN_CALIBRACION', label: 'En Calibración', color: 'bg-yellow-100 text-yellow-800 border-yellow-400' },
        { value: 'REPARACION',     label: 'En Reparación',  color: 'bg-orange-100 text-orange-800 border-orange-400' },
        { value: 'NUEVO',          label: 'Nuevo',          color: 'bg-blue-100 text-blue-800 border-blue-400' }
    ];

    funcionarios: Funcionario[]      = [];
    filteredFuncionarios: Funcionario[] = [];
    filteredAprobadores: Funcionario[]  = [];

    displayedColumns: string[] = [
        'select', 'fila', 'identificacion', 'descripcion',
        'cantEstado', 'ubicacion', 'tipoAjuste', 'acciones'
    ];

    dataSource: AjusteItem[] = [];
    itemIdCounter = 1;

    ngOnInit(): void {
        this.initForm();
        this.setupFilters();
        this.loadInitialData();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initForm(): void {
        const today = new Date().toISOString().split('T')[0];
        this.ajusteForm = this.fb.group({
            realizadoPor:      ['', Validators.required],
            realizadoPorInput: [''],
            aprobadoPor:       ['', Validators.required],
            aprobadoPorInput:  [''],
            tipoAjuste:        ['INVENTARIO', Validators.required],
            documento:         [''],
            fecha:             [today, Validators.required],
            descripcion:       ['']
        });
    }

    private setupFilters(): void {
        this.ajusteForm.get('realizadoPorInput')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(200))
            .subscribe(value => {
                this.filteredFuncionarios = this.doFilterFuncionarios(value);
            });

        this.ajusteForm.get('aprobadoPorInput')?.valueChanges
            .pipe(takeUntil(this.destroy$), debounceTime(200))
            .subscribe(value => {
                this.filteredAprobadores = this.doFilterFuncionarios(value);
            });
    }

    private loadInitialData(): void {
        this.isLoading = true;
        this.movementService.getPersonal().pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (data) => {
                this.funcionarios = data.map((p: any) => ({
                    id:     p.id || p.id_employee,
                    nombre: p.nombreCompleto || p.nombre || '',
                    cargo:  p.cargo || '',
                    area:   p.area || ''
                }));
                this.filteredFuncionarios = [...this.funcionarios];
                this.filteredAprobadores  = [...this.funcionarios];
            },
            error: () => {
                this.funcionarios = [];
                this.showMessage('Error al cargar el personal', 'error');
            }
        });
    }

    private doFilterFuncionarios(value: string): Funcionario[] {
        if (!value) return [...this.funcionarios];
        const f = value.toLowerCase();
        return this.funcionarios.filter(p =>
            p.nombre.toLowerCase().includes(f) || p.cargo.toLowerCase().includes(f)
        );
    }

    selectFuncionario(func: Funcionario): void {
        this.ajusteForm.patchValue({ realizadoPor: func.nombre, realizadoPorInput: func.nombre });
    }

    selectAprobador(func: Funcionario): void {
        this.ajusteForm.patchValue({ aprobadoPor: func.nombre, aprobadoPorInput: func.nombre });
    }

    // --- MANEJO DE MODALES (DATOS GENERALES) ---
    abrirModalDatosAjuste(): void {
        this.dialogRefActual = this.dialog.open(this.datosAjusteModal, {
            width: '700px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalDatosAjuste(): void {
        this.dialogRefActual?.close();
    }

    isDatosAjusteValido(): boolean {
        return this.ajusteForm.valid;
    }

    // --- ACCIONES DE TABLA ---
    toggleSelection(item: AjusteItem): void { item.selected = !item.selected; }
    toggleAllSelection(event: any): void { const checked = event.checked; this.dataSource.forEach(item => item.selected = checked); }
    isAllSelected(): boolean { return this.dataSource.length > 0 && this.dataSource.every(item => item.selected); }
    isSomeSelected(): boolean { return this.dataSource.some(item => item.selected) && !this.isAllSelected(); }
    getSelectedCount(): number { return this.dataSource.filter(item => item.selected).length; }
    getSelectedItems(): AjusteItem[] { return this.dataSource.filter(item => item.selected); }

    getTotalCantidad(): number { return this.dataSource.reduce((sum, item) => sum + item.cantidad, 0); }

    getResumenPorTipo(): any {
        const resumen: { [key: string]: number } = {};
        this.dataSource.forEach(item => { resumen[item.tipoAjuste] = (resumen[item.tipoAjuste] || 0) + 1; });
        return resumen;
    }

    // --- AYUDAS VISUALES ---
    getRealizadoPorNombre(): string { return this.ajusteForm.value.realizadoPorInput || 'No seleccionado'; }
    getAprobadoPorNombre(): string  { return this.ajusteForm.value.aprobadoPorInput  || 'No seleccionado'; }
    getDocumentoText(): string      { return this.ajusteForm.value.documento || 'S/D'; }
    getFechaText(): string          { return this.ajusteForm.value.fecha || ''; }

    getTipoAjusteClass(tipo: string): string { return this.tiposAjuste.find(t => t.value === tipo)?.color || 'bg-gray-100 text-gray-800 border-gray-400'; }
    getTipoAjusteLabel(tipo: string): string { return this.tiposAjuste.find(t => t.value === tipo)?.label || tipo; }
    getEstadoClass(estado: string): string { return this.estados.find(e => e.value === estado)?.color || 'bg-gray-100 text-gray-800 border-gray-400'; }
    getEstadoLabel(estado: string): string { return this.estados.find(e => e.value === estado)?.label || estado; }

    generarDocumento(): void {
        const tipo = this.ajusteForm.get('tipoAjuste')?.value;
        const prefijos: { [key: string]: string } = {
            'INVENTARIO': 'INV', 'REUBICACION': 'REUB', 'DONACION': 'DON',
            'ENCONTRADO': 'AJU', 'SOBRANTE': 'SOB',    'CORRECCION': 'CORR'
        };
        const prefijo = prefijos[tipo] || 'AJU';
        const year = new Date().getFullYear();
        const num  = Math.floor(Math.random() * 900) + 100;
        this.ajusteForm.patchValue({ documento: `${prefijo}-${year}-${num}` });
    }

    // --- PROCESAMIENTO ---
    abrirModalConfirmacion(): void {
        this.ajusteForm.markAllAsTouched();
        if (this.ajusteForm.invalid) {
            this.showMessage('Complete los datos generales del ajuste', 'error');
            this.abrirModalDatosAjuste();
            return;
        }
        if (this.dataSource.length === 0) {
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

    finalizar(): void {
        const fv = this.ajusteForm.value;

        if (!fv.aprobadoPor) { this.showMessage('Debe seleccionar un aprobador', 'error'); return; }
        if (this.dataSource.length === 0) { this.showMessage('No hay items', 'error'); return; }

        const sinId = this.dataSource.filter(i => !i.toolId || isNaN(i.toolId));
        if (sinId.length > 0) {
            this.showMessage(`${sinId.length} herramienta(s) sin ID de sistema`, 'error');
            return;
        }

        this.cerrarModalConfirmacion();
        this.isSaving = true;

        const itemsJson = JSON.stringify(this.dataSource.map(item => ({
            tool_id:  Number(item.toolId),
            quantity: item.cantidad,
            condicion: item.estado || 'SERVICEABLE',
            notes:    item.obs || ''
        })));

        this.movementService.registrarAjusteIngreso({
            date:               fv.fecha,
            time:               new Date().toTimeString().slice(0, 8),
            responsible_person: fv.realizadoPorInput || fv.realizadoPor,
            authorized_by:      fv.aprobadoPorInput  || fv.aprobadoPor,
            document_number:    fv.documento  || '',
            notes:              fv.descripcion || '',
            items_json:         itemsJson
        }).pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isSaving = false)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.abrirImpresionAjuste(nro, this.dataSource, fv);
                this.showMessage(`Ajuste registrado exitosamente: ${nro}`, 'success');
                this.dataSource = [];
                this.ajusteForm.reset({
                    tipoAjuste: 'INVENTARIO', fecha: new Date().toISOString().split('T')[0]
                });
                if (this.dialogRef) this.dialogRef.close({ success: true, data: result });
            },
            error: (err) => {
                this.showMessage('Error al registrar el ajuste: ' + (err?.message || ''), 'error');
            }
        });
    }

    removeItem(item: AjusteItem): void {
        if (confirm(`¿Está seguro de eliminar el item ${item.codigoBoa}?`)) {
            this.dataSource = this.dataSource.filter(i => i.id !== item.id);
            this.showMessage(`Item ${item.codigoBoa} eliminado`, 'info');
        }
    }

    editItem(item: AjusteItem): void { this.openDetalleHerramienta(item); }

    async openDetalleHerramienta(editItem?: AjusteItem): Promise<void> {
        const { DetalleHerramientaComponent } = await import('./detalle-herramienta/detalle-herramienta.component');
        const dialogRef = this.dialog.open(DetalleHerramientaComponent, {
            width: '700px', maxWidth: '95vw', height: 'auto', maxHeight: '90vh', hasBackdrop: true, disableClose: false, autoFocus: false,
            data: { tipoAjuste: this.ajusteForm.get('tipoAjuste')?.value, editItem }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action !== 'procesar') return;

            if (editItem) {
                const index = this.dataSource.findIndex(i => i.id === editItem.id);
                if (index !== -1) {
                    this.dataSource[index] = {
                        ...this.dataSource[index],
                        toolId:      result.data.toolId      || this.dataSource[index].toolId,
                        pn:          result.data.pn           || '',
                        descripcion: result.data.nombre       || '',
                        marca:       result.data.marca        || '',
                        sn:          result.data.sn           || '',
                        codigoBoa:   result.data.codigo       || '',
                        cantidad:    result.data.cantidad     || 1,
                        um:          result.data.um           || '',
                        estado:      result.data.estado       || '',
                        ubicacion:   result.data.ubicacion    || '',
                        tipoAjuste:  result.data.tipoAjuste   || this.ajusteForm.get('tipoAjuste')?.value,
                        documentos:  result.data.documento    || '',
                        obs:         result.data.observaciones || ''
                    };
                    this.dataSource = [...this.dataSource];
                    this.showMessage(`Item ${result.data.codigo} actualizado`, 'success');
                }
            } else {
                const newItem: AjusteItem = {
                    id:          this.itemIdCounter++,
                    toolId:      result.data.toolId      || 0,
                    pn:          result.data.pn           || '',
                    descripcion: result.data.nombre       || '',
                    marca:       result.data.marca        || '',
                    sn:          result.data.sn           || '',
                    codigoBoa:   result.data.codigo       || '',
                    cantidad:    result.data.cantidad     || 1,
                    um:          result.data.um           || '',
                    estado:      result.data.estado       || '',
                    ubicacion:   result.data.ubicacion    || '',
                    tipoAjuste:  result.data.tipoAjuste   || this.ajusteForm.get('tipoAjuste')?.value,
                    documentos:  result.data.documento    || '',
                    obs:         result.data.observaciones || '',
                    selected:    false
                };
                this.dataSource = [...this.dataSource, newItem];
                this.showMessage(`Item ${result.data.codigo} agregado`, 'success');
            }
        });
    }

    hasError(field: string, error: string): boolean {
        const control = this.ajusteForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    private showMessage(msg: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(msg, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }

    // ── PDF / Impresión Comprobante Ajuste por Ingreso ────────────────────────
    private abrirImpresionAjuste(nro: string, items: AjusteItem[], fv: any): void {
        const w = window.open('', '_blank');
        if (!w) return;
        const now = new Date().toLocaleString('es-BO');

        const rows = items.map((item, idx) => `
            <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td><span style="font-family:monospace;font-weight:700;background:#0f172a;color:white;padding:1px 5px;border-radius:3px;font-size:9px">${item.codigoBoa || '-'}</span></td>
                <td style="font-family:monospace;font-size:9px">${item.pn || '-'}</td>
                <td style="font-family:monospace;font-size:9px">${item.sn || '-'}</td>
                <td style="text-align:center;font-weight:700">${item.cantidad}</td>
                <td style="font-size:9px">${item.descripcion || '-'}</td>
                <td style="text-align:center"><span style="padding:2px 5px;border:1px solid #000;font-size:8px;font-weight:700">${item.estado || '-'}</span></td>
                <td style="font-size:8.5px">${item.documentos || '-'}</td>
                <td style="font-size:8.5px">${item.ubicacion || '-'}</td>
                <td style="font-size:8.5px">${item.obs || ''}</td>
            </tr>`).join('');

        const tipoLabel = this.getTipoAjusteLabel(fv.tipoAjuste || 'INVENTARIO');

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Ajuste Ingreso ${nro}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
  .code-box { border: 2px solid #000; padding: 3px 10px; font-weight: 900; font-size: 13px; display: inline-block; }
  h1 { text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase;
       background: #111A43; color: white; padding: 7px 10px; margin: 0 0 7px; border: 1px solid #000; }
  .info-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 7px; }
  .info-tbl td { border: 1px solid #ddd; padding: 3px 6px; }
  .lbl { background: #f0f0f0; font-weight: 700; font-size: 9px; width: 130px; }
  .nro-cell { background: #f0f0f0; text-align: center; font-weight: 900; font-size: 15px; vertical-align: middle; width: 120px; }
  .sec { background: #111A43; color: white; padding: 3px 8px; font-weight: 900; font-size: 10px;
         text-transform: uppercase; border: 1px solid #000; margin-bottom: 0; }
  table.det { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.det th { background: #111A43; color: white; padding: 4px 3px; font-size: 8px; font-weight: 900;
                 text-transform: uppercase; border: 1px solid #000; text-align: center; }
  table.det td { padding: 3px 4px; border: 1px solid #ddd; font-size: 9px; }
  table.det tr:nth-child(even) td { background: #f9f9f9; }
  .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
  .sig { border: 1px solid #000; padding: 6px 8px; text-align: center; }
  .sig-ttl { font-weight: 900; font-size: 9px; text-transform: uppercase; margin-bottom: 26px; }
  .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 8.5px; }
  .footer { text-align: center; margin-top: 10px; font-size: 7.5px; color: #888; border-top: 1px dotted #ccc; padding-top: 4px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
<script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); };</script>
</head><body>
  <div class="top">
    <div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145# N-114</div>
    <div style="text-align:right">
      <div class="code-box">API</div><br>
      <span style="font-size:9px">AJUSTE POR INGRESO</span>
    </div>
  </div>
  <h1>COMPROBANTE AJUSTE POR INGRESO<br>
    <span style="font-size:10px;font-weight:400">HERRAMIENTAS, BANCOS DE PRUEBA Y EQUIPOS DE APOYO</span>
  </h1>
  <table class="info-tbl">
    <tr>
      <td class="lbl">DOCUMENTO REF.:</td>
      <td>${fv.documento || '—'}</td>
      <td class="lbl">TIPO AJUSTE:</td>
      <td><strong>${tipoLabel}</strong></td>
      <td class="nro-cell" rowspan="3"><div style="font-size:8px;font-weight:400">N° AJUSTE</div>${nro}</td>
    </tr>
    <tr>
      <td class="lbl">ELABORÓ AJUSTE:</td>
      <td>${fv.realizadoPorInput || fv.realizadoPor || '—'}</td>
      <td class="lbl">AUTORIZÓ:</td>
      <td>${fv.aprobadoPorInput || fv.aprobadoPor || '—'}</td>
    </tr>
    <tr>
      <td class="lbl">FECHA:</td>
      <td>${fv.fecha || '—'}</td>
      <td class="lbl">OBSERVACIÓN:</td>
      <td>${fv.descripcion || '—'}</td>
    </tr>
  </table>
  <div class="sec">DETALLE DE HERRAMIENTAS AJUSTADAS</div>
  <table class="det">
    <thead><tr>
      <th style="width:25px">ITEM</th>
      <th>CÓDIGO BOA</th>
      <th>P/N</th>
      <th>S/N</th>
      <th style="width:35px">CANT.</th>
      <th>DESCRIPCIÓN</th>
      <th>ESTADO</th>
      <th>LISTA CONT.</th>
      <th>UBICACIÓN</th>
      <th>OBS</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sigs">
    <div class="sig">
      <div class="sig-ttl">ELABORÓ AJUSTE</div>
      <div style="font-size:9px;margin-bottom:16px">${fv.realizadoPorInput || fv.realizadoPor || '____________________'}</div>
      <div class="sig-line">Firma / Cargo</div>
    </div>
    <div class="sig">
      <div class="sig-ttl">AUTORIZÓ</div>
      <div style="font-size:9px;margin-bottom:16px">${fv.aprobadoPorInput || fv.aprobadoPor || '____________________'}</div>
      <div class="sig-line">Firma / Cargo</div>
    </div>
    <div class="sig">
      <div class="sig-ttl">RECIBIÓ ALMACÉN</div>
      <div class="sig-line">Firma Almacén Herramientas</div>
    </div>
  </div>
  <div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div>
</body></html>`;

        w.document.write(html);
        w.document.close();
    }
}
