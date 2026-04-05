import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
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
import { Subject, takeUntil, finalize, timeout } from 'rxjs';
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

@Component({
    selector: 'app-traspaso-otra-area',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatCheckboxModule,
        MatTooltipModule,
        MatDialogModule,
        MatSnackBarModule,
        DragDropModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './traspaso-otra-area.component.html',
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

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }

        .row-selected {
            background-color: #fffbeb !important;
            border-left: 4px solid #fbbf24 !important;
        }

        :host-context(.dark) .row-selected {
            background-color: rgba(251, 191, 36, 0.1) !important;
            border-left: 4px solid #fbbf24 !important;
        }

        .spinner-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 100;
        }

        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }

        ::ng-deep .white-checkbox .mdc-checkbox__background { border-color: white !important; }
        ::ng-deep .white-checkbox.mat-mdc-checkbox-checked .mdc-checkbox__background {
            background-color: white !important;
            border-color: white !important;
        }
        ::ng-deep .white-checkbox .mdc-checkbox__checkmark { color: #0f172a !important; }
    `]
})
export class TraspasoOtraAreaComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<TraspasoOtraAreaComponent>, { optional: true });
    private dialog    = inject(MatDialog);
    private fb        = inject(FormBuilder);
    private router    = inject(Router);
    private snackBar  = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private destroy$  = new Subject<void>();

    transferForm!: FormGroup;
    isSaving      = false;
    showConfirmModal = false;

    // Personal cargado desde la API (para búsqueda dinámica)
    private personalCache: any[] = [];
    filteredPersonal: any[] = [];
    showSuggestions = false;

    displayedColumns: string[] = [
        'select', 'fila', 'codigo', 'descripcion', 'partNumber', 'serialNumber',
        'unidadItem', 'cantidad', 'contenido', 'acciones'
    ];

    systemMsg = '';
    systemMsgType: 'success' | 'error' | 'info' | 'warning' = 'info';
    showSystemMsg = false;

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
            buscar:          [''],
            nombreCompleto:  ['', Validators.required],
            nroLicencia:     ['', Validators.required],
            cargo:           ['', Validators.required],
            fecha:           [today, Validators.required],
            hora:            [`${hh}:${mm}`, Validators.required],
            gerencia:        ['', Validators.required],
            unidad:          ['', Validators.required],
            base:            ['VVI', Validators.required],
            departamento:    [''],
            tipoTraspaso:    ['TEMPORAL', Validators.required],
            observaciones:   ['']
        });
    }

    private cargarPersonal(): void {
        this.movementService.getPersonal().pipe(takeUntil(this.destroy$)).subscribe({
            next: (personal) => { this.personalCache = personal; }
        });
    }

    // ── Búsqueda dinámica de personal ────────────────────────────────────────

    onBuscarInput(event: Event): void {
        const query = (event.target as HTMLInputElement).value.trim().toLowerCase();
        if (query.length < 3) {
            this.filteredPersonal = [];
            this.showSuggestions  = false;
            return;
        }
        this.filteredPersonal = this.personalCache.filter(p =>
            (p.nombreCompleto ?? '').toLowerCase().includes(query) ||
            (p.licencia ?? '').toLowerCase().includes(query)
        ).slice(0, 8);
        this.showSuggestions = this.filteredPersonal.length > 0;
    }

    seleccionarPersona(p: any): void {
        this.transferForm.patchValue({
            buscar:         p.nombreCompleto,
            nombreCompleto: p.nombreCompleto,
            nroLicencia:    p.licencia ?? p.nro_licencia ?? '',
            cargo:          p.cargo ?? ''
        });
        this.filteredPersonal = [];
        this.showSuggestions  = false;
    }

    hideSuggestions(): void {
        // Delay para permitir que el click en el item se registre primero
        setTimeout(() => { this.showSuggestions = false; }, 200);
    }

    /** Mantener botón BUSCAR para búsqueda exacta por si necesitan */
    buscarPersona(): void {
        const query = (this.transferForm.get('buscar')?.value ?? '').trim().toLowerCase();
        if (!query) return;
        const found = this.personalCache.find(p =>
            (p.nombreCompleto ?? '').toLowerCase().includes(query) ||
            (p.licencia ?? '').toLowerCase().includes(query)
        );
        if (found) { this.seleccionarPersona(found); }
        else { this.showMessage('No se encontró la persona', 'error'); }
    }

    // ── Selección de items ────────────────────────────────────────────────────

    toggleSelection(item: TransferItem): void {
        item.selected = !item.selected;
        this.dataSource.set([...this.dataSource()]);
    }

    toggleAllSelection(event: any): void {
        const items = this.dataSource();
        items.forEach(item => item.selected = event.checked);
        this.dataSource.set([...items]);
    }

    isAllSelected(): boolean {
        const items = this.dataSource();
        return items.length > 0 && items.every(item => item.selected);
    }

    isSomeSelected(): boolean {
        const items = this.dataSource();
        return items.some(item => item.selected) && !this.isAllSelected();
    }

    getSelectedCount(): number {
        return this.dataSource().filter(item => item.selected).length;
    }

    getTotalSelectedCantidad(): number {
        return this.dataSource().filter(item => item.selected).reduce((t, i) => t + (i.cantidad || 0), 0);
    }

    imprimir(): void {
        if (this.dataSource().length === 0) {
            this.showMessage('Agregue herramientas antes de imprimir', 'warning');
            return;
        }
        if (!this.transferForm.valid) {
            this.transferForm.markAllAsTouched();
            this.showMessage('Complete los datos requeridos', 'error');
            return;
        }
        const fv = this.transferForm.getRawValue();
        this.abrirVentanaImpresionTraspaso('', fv, this.dataSource());
    }

    openConfirmModal(): void {
        if (this.dataSource().length === 0) {
            this.showMessage('Agregue al menos una herramienta', 'warning');
            return;
        }
        if (!this.transferForm.valid) {
            this.transferForm.markAllAsTouched();
            const errors = this.getFormErrors();
            this.showMessage(`Complete los campos requeridos: ${errors.join(', ')}`, 'error');
            return;
        }
        this.showConfirmModal = true;
    }

    closeConfirmModal(): void {
        this.showConfirmModal = false;
    }

    // ── Envío al backend ──────────────────────────────────────────────────────

    finalizar(): void {
        this.showConfirmModal = false;
        this.isSaving = true;

        const fv    = this.transferForm.getRawValue();
        const items = this.dataSource();

        const conditionMap: Record<string, string> = {
            'SERVICEABLE':    'good',
            'NUEVO':          'new',
            'EN_CALIBRACION': 'fair',
            'UNSERVICEABLE':  'poor',
            'EN_REPARACION':  'poor'
        };

        const itemsJson = JSON.stringify(items.map(i => ({
            tool_id:               i.toolId,
            quantity:              i.cantidad,
            condition_on_movement: conditionMap[i.estadoFisico] || 'good',
            serial_number:         i.serialNumber || '',
            part_number:           i.partNumber   || '',
            notes:                 i.contenido    || ''
        })));

        const responsibleName = fv.nombreCompleto ?? '';
        const department      = `${fv.gerencia} | ${fv.unidad}`.trim();

        const payload: any = {
            date:                 fv.fecha,
            time:                 fv.hora,
            responsible_person:   responsibleName,
            department:           department,
            exit_reason:          'area_transfer',
            authorized_by:        fv.nroLicencia,
            notes:                fv.observaciones ?? '',
            general_observations: `Tipo: ${fv.tipoTraspaso} | Base: ${fv.base} | Cargo: ${fv.cargo} | Licencia: ${fv.nroLicencia}`,
            items_json:           itemsJson
        };

        console.log('[TRASPASO] Payload:', payload);

        this.movementService.registrarTraspasoOtraArea(payload).pipe(
            timeout(30000),
            finalize(() => { this.isSaving = false; }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number ?? '';
                this.abrirVentanaImpresionTraspaso(nro, fv, items);
                this.showMessage(`Traspaso ${nro} registrado exitosamente`, 'success');
                this.dataSource.set([]);
                this.transferForm.reset();
                this.initForm();

                if (this.dialogRef) {
                    this.dialogRef.close({ success: true, movement_number: nro });
                } else {
                    setTimeout(() => this.router.navigate(['/salidas']), 2000);
                }
            },
            error: (err: any) => {
                console.error('[TRASPASO] Error:', err);
                const msg = err?.name === 'TimeoutError'
                    ? 'El servidor tardó demasiado. Intente de nuevo.'
                    : err?.message || 'Error al registrar el traspaso';
                this.showMessage(msg, 'error');
            }
        });
    }

    goBack(): void {
        if (this.dataSource().length > 0) {
            if (!confirm('¿Está seguro de salir? Hay items agregados no guardados.')) return;
        }
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/salidas']);
        }
    }

    async openTraspasoHerramienta(): Promise<void> {
        const { TraspasoHerramientaComponent } = await import('./traspaso-herramienta/traspaso-herramienta.component');

        const dialogRef = this.dialog.open(TraspasoHerramientaComponent, {
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
                this.agregarHerramienta(result.data);
            }
        });
    }

    agregarHerramienta(data: any): void {
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
        this.showMessage('Herramienta agregada al traspaso', 'success');
    }

    removerItem(index: number): void {
        const items = [...this.dataSource()];
        const removed = items.splice(index, 1)[0];
        this.dataSource.set(items);
        this.showMessage(`Se removió: ${removed.descripcion}`, 'info');
    }

    getTotalCantidad(): number {
        return this.dataSource().reduce((t, i) => t + (i.cantidad || 0), 0);
    }

    getFormErrors(): string[] {
        const errors: string[] = [];
        const f = this.transferForm;
        if (!f.get('nombreCompleto')?.value) errors.push('Nombre Completo');
        if (!f.get('nroLicencia')?.value)    errors.push('Nro. Licencia');
        if (!f.get('cargo')?.value)       errors.push('Cargo');
        if (!f.get('gerencia')?.value)    errors.push('Gerencia');
        if (!f.get('unidad')?.value)      errors.push('Unidad');
        if (!f.get('tipoTraspaso')?.value) errors.push('Tipo Traspaso');
        return errors;
    }

    hasError(field: string, error: string): boolean {
        const control = this.transferForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    private showMessage(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
        this.systemMsg     = message;
        this.systemMsgType = type;
        this.showSystemMsg = true;
        setTimeout(() => this.showSystemMsg = false, 4000);
    }

    // ── PDF / Impresión MGH-109 ───────────────────────────────────────────────

    private abrirVentanaImpresionTraspaso(nro: string, fv: any, items: TransferItem[]): void {
        const w = window.open('', '_blank');
        if (!w) { this.showMessage('Permita ventanas emergentes para imprimir', 'warning'); return; }
        w.document.write(this.buildMGH109Html(nro, fv, items));
        w.document.close();
    }

    private buildMGH109Html(nro: string, fv: any, items: TransferItem[]): string {
        const now  = new Date().toLocaleString('es-BO');
        const rows = items.map(item => `
            <tr>
                <td>${item.codigo      || '-'}</td>
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

        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>MGH-109 Nota de Traspaso ${nro}</title>
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
  .lbl { background: #f0f0f0; font-weight: 700; font-size: 9px; width: 130px; }
  .nro-cell { background: #f0f0f0; text-align: center; font-weight: 900; font-size: 15px; vertical-align: middle; width: 120px; }
  .sec { background: #111A43; color: white; padding: 3px 8px; font-weight: 900; font-size: 10px;
         text-transform: uppercase; border: 1px solid #000; margin: 0 0 0; }
  table.det { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.det th { background: #111A43; color: white; padding: 5px 4px; font-size: 8.5px; font-weight: 900;
                 text-transform: uppercase; border: 1px solid #000; text-align: center; }
  table.det td { padding: 4px; border: 1px solid #ddd; font-size: 9px; }
  table.det tr:nth-child(even) td { background: #f9f9f9; }
  .nota { border: 1px solid #ccc; padding: 5px 8px; margin-top: 8px; font-size: 8.5px; background: #fffde7; line-height: 1.5; }
  .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 18px; }
  .sig { border: 1px solid #000; padding: 6px 8px; text-align: center; }
  .sig-ttl { font-weight: 900; font-size: 9px; text-transform: uppercase; margin-bottom: 28px; }
  .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 8.5px; }
  .footer { text-align: center; margin-top: 10px; font-size: 7.5px; color: #888; border-top: 1px dotted #ccc; padding-top: 4px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
<script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); };</script>
</head><body>
  <div class="top">
    <div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145# N-014</div>
    <div style="font-size:13px;font-weight:900;text-align:center">
      NOTA DE TRASPASO<br><span style="font-size:10px;font-weight:400">HERRAMIENTAS, BANCOS DE PRUEBA Y EQUIPOS DE APOYO</span>
    </div>
    <div style="text-align:right">
      <div class="code-box">MGH-109</div><br><span style="font-size:9px">REV. 0 &nbsp; 2017-10-03</span>
    </div>
  </div>
  <table class="info-tbl">
    <tr>
      <td class="lbl">NOMBRE SOLICITANTE:</td><td>${fv.nombreCompleto || ''}</td>
      <td class="lbl">GERENCIA DESTINO:</td><td>${fv.gerencia || ''}</td>
      <td class="nro-cell" rowspan="4"><div style="font-size:8px;font-weight:400">N° NOTA</div>${nro || '___________'}</td>
    </tr>
    <tr>
      <td class="lbl">LICENCIA:</td><td>${fv.nroLicencia || ''}</td>
      <td class="lbl">DEPARTAMENTO:</td><td>${fv.departamento || ''}</td>
    </tr>
    <tr>
      <td class="lbl">CARGO:</td><td>${fv.cargo || ''}</td>
      <td class="lbl">UNIDAD:</td><td>${fv.unidad || ''}</td>
    </tr>
    <tr>
      <td class="lbl">FECHA Y HORA:</td><td>${fv.fecha || ''} ${fv.hora || ''}</td>
      <td class="lbl">TIPO TRASPASO:</td><td>${fv.tipoTraspaso || ''}</td>
    </tr>
    <tr>
      <td class="lbl">OBSERVACIONES:</td><td colspan="4">${fv.observaciones || ''}</td>
    </tr>
  </table>
  <div class="sec">DETALLE</div>
  <table class="det">
    <thead><tr>
      <th>CÓDIGO</th><th>P/N ó MODELO</th><th>S/N</th><th>UNIDAD</th><th>CANT.</th>
      <th>NOMBRE</th><th>LISTA DE CONTENIDO</th><th>MARCA</th><th>FECHA CALIBRACIÓN</th><th>OBS</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="nota">
    <strong>NOTA IMPORTANTE:</strong><br>
    - Las herramientas descritas en la presente nota se encuentran en condición SERVICIABLE, a menos que se indique lo contrario en la casilla de OBSERVACIONES.<br>
    - La firma de la presente nota implica que se esta en conformidad con toda la informacion detallada.
  </div>
  <div class="sigs">
    <div class="sig"><div class="sig-ttl">ENTREGADO POR</div><div class="sig-line">Firma Almacén Herramientas</div></div>
    <div class="sig"><div class="sig-ttl">RECIBIDO POR</div><div class="sig-line">Firma Recepción</div></div>
    <div class="sig">
      <div class="sig-ttl">AUTORIZADO POR</div>
      <div style="margin-top:6px;font-size:9px;text-align:left">Nombre: ___________________<br>Cargo: ____________________</div>
      <div class="sig-line">Firma Autorizada BOA</div>
    </div>
  </div>
  <div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div>
</body></html>`;
    }
}
