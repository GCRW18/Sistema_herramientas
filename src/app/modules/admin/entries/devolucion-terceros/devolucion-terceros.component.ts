import { Component, OnInit, OnDestroy, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MovementService } from '../../../../core/services/movement.service';

interface Tercero {
    id: string;
    nit: string;
    razonSocial: string;
    nombreContacto: string;
    telefono: string;
    email: string;
    tipoEmpresa: string;
}

interface DevolucionTerceroItem {
    id: number;
    fila: number;
    toolId?: string;
    codigo: string;
    pn: string;
    sn: string;
    descripcion: string;
    marca: string;
    fechaSalida: string;
    diasFuera: number;
    cantidad: number;
    nroNotaSalida: string;
    tipoContrato: string;
    proyecto: string;
    estado: string;
    condicionDevolucion: string;
    observaciones: string;
    selected?: boolean;
}

@Component({
    selector: 'app-devolucion-terceros',
    standalone: true,
    imports: [
        CommonModule, RouterModule, ReactiveFormsModule, FormsModule,
        MatCardModule, MatIconModule, MatButtonModule, MatTableModule,
        MatInputModule, MatFormFieldModule, MatSelectModule, MatDialogModule,
        MatSnackBarModule, MatProgressSpinnerModule, MatCheckboxModule,
        MatAutocompleteModule, MatTooltipModule, DragDropModule
    ],
    templateUrl: './devolucion-terceros.component.html',
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
    `]
})
export class DevolucionTercerosComponent implements OnInit, OnDestroy {
    @ViewChild('busquedaModal') busquedaModal!: TemplateRef<any>;
    @ViewChild('confirmacionModal') confirmacionModal!: TemplateRef<any>;

    private dialogRefActual: MatDialogRef<any> | null = null;
    public dialogRef = inject(MatDialogRef<DevolucionTercerosComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);

    private destroy$ = new Subject<void>();

    devolucionForm!: FormGroup;

    isLoading = false;
    isSaving = false;
    isSearching = false;

    displayedColumns: string[] = [
        'select', 'fila', 'identificacion', 'descripcion', 'tipoContrato',
        'fechaSalida', 'diasFuera', 'cantidad', 'proyecto', 'condicion', 'observaciones'
    ];

    terceros: Tercero[] = [];
    tercerosFiltrados: Tercero[] = [];

    tiposEmpresa = [
        { value: 'CALIBRACION', label: 'Calibración', color: 'bg-blue-100 text-blue-800 border-blue-400' },
        { value: 'REPARACION',  label: 'Reparación',  color: 'bg-orange-100 text-orange-800 border-orange-400' },
        { value: 'MANTENIMIENTO',label: 'Mantenimiento',color: 'bg-purple-100 text-purple-800 border-purple-400' },
        { value: 'PROVEEDOR',   label: 'Proveedor',   color: 'bg-green-100 text-green-800 border-green-400' }
    ];

    condicionesDevolucion = [
        { value: 'BUENO',       label: 'Bueno',              color: 'bg-green-500 text-white' },
        { value: 'REPARADO',    label: 'Reparado',           color: 'bg-blue-500 text-white' },
        { value: 'CALIBRADO',   label: 'Calibrado',          color: 'bg-cyan-500 text-white' },
        { value: 'PARCIAL',     label: 'Reparación Parcial', color: 'bg-yellow-500 text-black' },
        { value: 'NO_REPARABLE',label: 'No Reparable',       color: 'bg-red-500 text-white' }
    ];

    dataSource: DevolucionTerceroItem[] = [];
    itemIdCounter = 1;

    ngOnInit(): void {
        this.initForm();
        this.loadTerceros();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadTerceros(): void {
        this.isLoading = true;
        this.movementService.getTerceros().pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (data) => {
                this.terceros = (data || []).map((t: any) => ({
                    id:             t.id            || t.id_customer  || '',
                    nit:            t.nit           || t.tax_id       || '',
                    razonSocial:    t.razonSocial   || t.nombre       || t.name || '',
                    nombreContacto: t.nombreContacto || t.contact_name || t.contact_person || '',
                    telefono:       t.telefono      || t.phone        || '',
                    email:          t.email         || '',
                    tipoEmpresa:    t.tipoEmpresa   || t.type         || 'PROVEEDOR'
                }));
                this.tercerosFiltrados = [...this.terceros];
            },
            error: () => {
                this.showMessage('Error al cargar la lista de terceros', 'error');
            }
        });
    }

    private initForm(): void {
        this.devolucionForm = this.fb.group({
            tercero: ['', Validators.required],
            codigoHerramienta: [''],
            fechaDevolucion: [new Date().toISOString().split('T')[0], Validators.required],
            observaciones: ['']
        });

        this.devolucionForm.get('tercero')?.valueChanges.pipe(
            takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged()
        ).subscribe(value => this.filtrarTerceros(value));
    }

    private filtrarTerceros(valor: string | Tercero): void {
        const strValor = typeof valor === 'string' ? valor : valor?.razonSocial;
        if (!strValor) {
            this.tercerosFiltrados = [...this.terceros];
            return;
        }
        const filtro = strValor.toLowerCase();
        this.tercerosFiltrados = this.terceros.filter(t =>
            t.razonSocial.toLowerCase().includes(filtro) || t.nit.toLowerCase().includes(filtro)
        );
    }

    displayTercero(t: Tercero): string {
        return t ? `${t.nit} - ${t.razonSocial}` : '';
    }

    // --- MODALES ---
    abrirModalBusqueda(): void {
        this.dialogRefActual = this.dialog.open(this.busquedaModal, {
            width: '600px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalBusqueda(): void {
        this.dialogRefActual?.close();
    }

    abrirModalConfirmacion(): void {
        const selectedItems = this.getSelectedItems();
        if (selectedItems.length === 0) {
            this.showMessage('Seleccione al menos una herramienta', 'warning');
            return;
        }
        const sinCondicion = selectedItems.filter(item => !item.condicionDevolucion);
        if (sinCondicion.length > 0) {
            this.showMessage('Asigne condición de devolución a todos los items seleccionados', 'warning');
            return;
        }
        this.dialogRefActual = this.dialog.open(this.confirmacionModal, {
            width: '800px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalConfirmacion(): void {
        this.dialogRefActual?.close();
    }

    isBusquedaValida(): boolean {
        const f = this.devolucionForm.value;
        return !!f.tercero && typeof f.tercero !== 'string' && !!f.fechaDevolucion;
    }

    buscarHerramientas(): void {
        const tercero = this.devolucionForm.get('tercero')?.value;

        if (!tercero || typeof tercero === 'string') {
            this.showMessage('Seleccione un tercero válido de la lista', 'warning');
            return;
        }

        this.isSearching = true;
        const razonSocialSafe = (tercero.razonSocial || '').replace(/'/g, "''");
        const filtroLoans = `loa.status = 'ACTIVO' AND loa.loan_type = 'EXTERNO' AND loa.borrower_name ILIKE '%${razonSocialSafe}%'`;

        forkJoin({
            loans: this.movementService.getActiveLoans({ filtro_adicional: filtroLoans }),
            items: this.movementService.getActiveLoanItems()
        }).pipe(
            takeUntil(this.destroy$), finalize(() => this.isSearching = false)
        ).subscribe({
            next: ({ loans, items }) => {
                if (!loans || loans.length === 0) {
                    this.dataSource = [];
                    this.showMessage(`No hay préstamos activos para ${tercero.razonSocial}`, 'warning');
                    this.cerrarModalBusqueda();
                    return;
                }

                const loanIds = new Set(loans.map((l: any) => String(l.id_loan)));
                const loanMap: Record<string, any> = {};
                loans.forEach((l: any) => loanMap[String(l.id_loan)] = l);

                let resultado: DevolucionTerceroItem[] = (items || [])
                    .filter((it: any) => loanIds.has(String(it.id_loan)))
                    .map((it: any) => {
                        const loan = loanMap[String(it.id_loan)];
                        return {
                            id: this.itemIdCounter++,
                            fila: 0,
                            toolId: String(it.tool_id || ''),
                            codigo: it.code || '',
                            pn: it.part_number || '',
                            sn: it.serial_number || '',
                            descripcion: it.description || '',
                            marca: it.brand || '',
                            fechaSalida: loan?.loan_date || '',
                            diasFuera: loan?.loan_date ? this.calcularDiasFuera(loan.loan_date) : 0,
                            cantidad: Number(it.quantity) || 1,
                            nroNotaSalida: loan?.loan_number || '',
                            tipoContrato: tercero.tipoEmpresa,
                            proyecto: loan?.work_order_number || '',
                            estado: 'EN_TERCERO',
                            condicionDevolucion: '',
                            observaciones: it.notes || '',
                            selected: false
                        };
                    });

                const codigoFiltro = this.devolucionForm.get('codigoHerramienta')?.value?.trim().toLowerCase();
                if (codigoFiltro) {
                    resultado = resultado.filter(i => i.codigo.toLowerCase().includes(codigoFiltro) || i.pn.toLowerCase().includes(codigoFiltro));
                }

                this.dataSource = resultado;
                this.dataSource.forEach((item, idx) => item.fila = idx + 1);

                if (this.dataSource.length === 0) {
                    this.showMessage(`No se encontraron herramientas con esos filtros`, 'warning');
                } else {
                    this.showMessage(`Se encontraron ${this.dataSource.length} herramienta(s)`, 'success');
                    this.cerrarModalBusqueda();
                }
            },
            error: (err) => {
                this.dataSource = [];
                this.showMessage('Error al buscar préstamos: ' + (err?.message || ''), 'error');
            }
        });
    }

    // --- ACCIONES TABLA ---
    toggleSelection(item: DevolucionTerceroItem): void { item.selected = !item.selected; }
    toggleAllSelection(event: any): void { const checked = event.checked; this.dataSource.forEach(item => item.selected = checked); }
    isAllSelected(): boolean { return this.dataSource.length > 0 && this.dataSource.every(item => item.selected); }
    isSomeSelected(): boolean { return this.dataSource.some(item => item.selected) && !this.isAllSelected(); }
    getSelectedCount(): number { return this.dataSource.filter(item => item.selected).length; }
    getSelectedItems(): DevolucionTerceroItem[] { return this.dataSource.filter(item => item.selected); }
    getTotalCantidad(): number { return this.getSelectedItems().reduce((sum, item) => sum + item.cantidad, 0); }
    updateCondicion(item: DevolucionTerceroItem, condicion: string): void {
        item.condicionDevolucion = condicion;
        if(condicion) item.selected = true;
    }

    getResumenPorCondicion(): any {
        const selectedItems = this.getSelectedItems();
        return {
            buenos: selectedItems.filter(i => i.condicionDevolucion === 'BUENO').length,
            reparado: selectedItems.filter(i => i.condicionDevolucion === 'REPARADO').length,
            calibrado: selectedItems.filter(i => i.condicionDevolucion === 'CALIBRADO').length,
            parcial: selectedItems.filter(i => i.condicionDevolucion === 'PARCIAL').length,
            'no_reparable': selectedItems.filter(i => i.condicionDevolucion === 'NO_REPARABLE').length
        };
    }

    // --- HELPERS VISUALES ---
    getTipoEmpresaClass(tipo: string): string { return this.tiposEmpresa.find(t => t.value === tipo)?.color || 'bg-gray-100 text-gray-800'; }
    getTipoEmpresaLabel(tipo: string): string { return this.tiposEmpresa.find(t => t.value === tipo)?.label || tipo; }
    getCondicionClass(condicion: string): string { return this.condicionesDevolucion.find(c => c.value === condicion)?.color || 'bg-gray-500 text-white'; }
    getCondicionLabel(condicion: string): string { return this.condicionesDevolucion.find(c => c.value === condicion)?.label || condicion; }

    getDiasFueraClass(dias: number): string {
        if (dias <= 7) return 'bg-green-100 text-green-800 border-green-300';
        if (dias <= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        if (dias <= 60) return 'bg-orange-100 text-orange-800 border-orange-300';
        return 'bg-red-100 text-red-800 border-red-400';
    }

    private calcularDiasFuera(fechaSalida: string): number {
        const salida = new Date(fechaSalida);
        const diffTime = Math.abs(new Date().getTime() - salida.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    finalizar(): void {
        const selectedItems = this.getSelectedItems();
        const tercero = this.devolucionForm.get('tercero')?.value;

        this.cerrarModalConfirmacion();
        this.isSaving = true;

        const itemsJson = JSON.stringify(selectedItems.map(item => ({
            tool_id: Number(item.toolId),
            quantity: item.cantidad,
            condicion: item.condicionDevolucion,
            notes: item.observaciones || ''
        })));

        this.movementService.registrarDevolucionPrestamo({
            type: 'DEVOLUCION_PRESTAMO_EXTERNO',
            date: this.devolucionForm.value.fechaDevolucion,
            time: new Date().toTimeString().slice(0, 8),
            requested_by_name: tercero.razonSocial,
            responsible_person: '',
            recipient: tercero.razonSocial,
            customer: tercero.razonSocial,
            notes: this.devolucionForm.value.observaciones || '',
            items_json: itemsJson
        }).pipe(
            finalize(() => this.isSaving = false),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.abrirImpresionDevolucionTercero(nro, selectedItems, tercero, this.devolucionForm.value);
                this.showMessage(`Devolución procesada exitosamente: ${nro}`, 'success');
                this.dataSource = this.dataSource.filter(item => !item.selected);
                this.dataSource.forEach((item, index) => item.fila = index + 1);
                if (this.dialogRef) this.dialogRef.close({ success: true });
            },
            error: (err) => this.showMessage(`Error al registrar la devolución: ${err?.message || ''}`, 'error')
        });
    }

    hasError(field: string, error: string): boolean {
        const control = this.devolucionForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }

    private abrirImpresionDevolucionTercero(nro: string, items: DevolucionTerceroItem[], tercero: any, fv: any): void {
        const w = window.open('', '_blank');
        if (!w) return;
        const now  = new Date().toLocaleString('es-BO');
        const rows = items.map(item => `
            <tr>
                <td><span style="font-family:monospace;font-weight:700;background:#0f172a;color:white;padding:1px 4px;border-radius:2px;font-size:9px">${item.codigo || '-'}</span></td>
                <td style="font-family:monospace;font-size:9px">${item.pn || '-'}</td>
                <td style="font-family:monospace;font-size:9px">${item.sn || '-'}</td>
                <td style="text-align:center;font-weight:700">${item.cantidad}</td>
                <td style="font-size:9px">${item.descripcion || '-'}</td>
                <td>${item.nroNotaSalida || '-'}</td>
                <td>${item.fechaSalida || '-'}</td>
                <td style="text-align:center">${item.diasFuera}</td>
                <td><span style="padding:2px 4px;border:1px solid #000;font-size:8.5px;font-weight:700">${item.condicionDevolucion}</span></td>
                <td>${item.observaciones || ''}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Devolución Terceros ${nro}</title>
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
  .lbl { background: #f0f0f0; font-weight: 700; font-size: 9px; width: 120px; }
  .nro-cell { background: #f0f0f0; text-align: center; font-weight: 900; font-size: 15px; vertical-align: middle; width: 120px; }
  .sec { background: #111A43; color: white; padding: 3px 8px; font-weight: 900; font-size: 10px; text-transform: uppercase; border: 1px solid #000; margin-bottom: 0; }
  table.det { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.det th { background: #111A43; color: white; padding: 4px 3px; font-size: 8px; font-weight: 900; text-transform: uppercase; border: 1px solid #000; text-align: center; }
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
      <div class="code-box">MGH-100</div><br><span style="font-size:9px">REV. 0 &nbsp; 2016-10-13</span>
    </div>
  </div>
  <h1>NOTA DE DEVOLUCIÓN A TERCEROS</h1>
  <table class="info-tbl">
    <tr>
      <td class="lbl">EMPRESA / ENTIDAD:</td>
      <td>${tercero?.razonSocial || ''}</td>
      <td class="lbl">NIT:</td>
      <td>${tercero?.nit || ''}</td>
      <td class="nro-cell" rowspan="3"><div style="font-size:8px;font-weight:400">N° NOTA</div>${nro || '___________'}</td>
    </tr>
    <tr>
      <td class="lbl">CONTACTO:</td><td>${tercero?.nombreContacto || ''}</td>
      <td class="lbl">FECHA DEVOLUCIÓN:</td><td>${fv.fechaDevolucion || ''}</td>
    </tr>
    <tr>
      <td class="lbl">OBSERVACIONES:</td><td colspan="3">${fv.observaciones || ''}</td>
    </tr>
  </table>
  <div class="sec">DETALLE DE HERRAMIENTAS RECIBIDAS</div>
  <table class="det">
    <thead><tr>
      <th>CÓDIGO</th><th>P/N</th><th>S/N</th><th style="width:30px">CANT.</th><th>DESCRIPCIÓN</th>
      <th>NOTA SALIDA</th><th>F. SALIDA</th><th>DÍAS FUERA</th><th>CONDICIÓN</th><th>OBS</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sigs">
    <div class="sig">
      <div class="sig-ttl">DEVUELTO POR</div>
      <div style="font-size:9px;margin-bottom:16px">${tercero?.razonSocial || '____________________'}</div>
      <div class="sig-line">Firma Representante Tercero</div>
    </div>
    <div class="sig">
      <div class="sig-ttl">RECIBIDO POR</div>
      <div class="sig-line">Firma Almacén Herramientas BOA</div>
    </div>
    <div class="sig">
      <div class="sig-ttl">AUTORIZADO POR</div>
      <div class="sig-line">Firma Autorizada BOA</div>
    </div>
  </div>
  <div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div>
</body></html>`;

        w.document.write(html);
        w.document.close();
    }
}
