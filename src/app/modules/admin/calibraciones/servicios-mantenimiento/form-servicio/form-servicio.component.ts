import { Component, OnInit, OnDestroy, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MaintenanceService } from '../../../../../core/services/maintenance.service';

interface MaintenanceData {
    id_maintenance: number;
    tool_id: number;
    record_number: string;
    tool_code: string;
    tool_name: string;
    tool_serial?: string;
    provider: string;
    type: string;
    status: string;
    send_date: string;
    expected_return_date: string | null;
    base: string;
    cost: number;
    notes: string;
}

interface Proveedor {
    id_laboratory: number;
    name: string;
    contact_person?: string;
}

type Mode = 'envio' | 'retorno';

@Component({
    selector: 'app-form-servicio',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
        CdkDrag, CdkDragHandle,
    ],
    templateUrl: './form-servicio.component.html',
})
export class FormServicioComponent implements OnInit, OnDestroy {

    private calibrationService = inject(CalibrationService);
    private maintenanceService = inject(MaintenanceService);
    public dialogRef = inject(MatDialogRef<FormServicioComponent>);
    private snackBar = inject(MatSnackBar);
    private _destroy$ = new Subject<void>();
    private _toolSearch$ = new Subject<string>();

    constructor(@Inject(MAT_DIALOG_DATA) public data: { mode: Mode; maintenance?: MaintenanceData }) {
        const today = this.getTodayStr();
        this.requestDateStr = today;
        this.sendDateStr = today;
        this.expectedReturnDateStr = this.calcExpectedReturn(today, 'preventive', 'semiannual');
        this.actualReturnDateStr = today;

        if (data) {
            this.mode = data.mode;
            if (data.maintenance) {
                this.maintenance = data.maintenance;
                if (data.mode === 'retorno' && data.maintenance.type) {
                    this.tipoMantenimientoRealizado = data.maintenance.type;
                }
            }
        }
    }

    mode: Mode = 'envio';
    maintenance: MaintenanceData | null = null;

    isSaving = signal(false);
    isScanning = signal(false);
    scannedTool: any = null;
    generatedNota = signal<string | null>(null);
    providers: Proveedor[] = [];

    // Búsqueda de herramienta
    barcodeValue     = 'BOA-H-';
    toolSuggestions: any[]  = [];
    showToolDropdown         = false;
    toolSearchLoading        = false;

    // Tipos: solo preventivo y correctivo
    tiposMantenimiento = [
        { value: 'preventive', label: 'Preventivo' },
        { value: 'corrective', label: 'Correctivo' },
    ];

    // ============================================
    // ENVÍO FIELDS
    // ============================================
    selectedProviderId: number | null = null;
    selectedProviderName = '';
    maintenanceType: 'preventive' | 'corrective' = 'preventive';
    preventiveSubtype: 'semiannual' | 'annual' = 'semiannual';
    discrepancyReportNum = '';
    problem = '';
    requestDateStr: string;
    sendDateStr: string;
    expectedReturnDateStr: string;
    sendNotes = '';

    // ============================================
    // RETORNO FIELDS
    // ============================================
    actualReturnDateStr: string;
    tipoMantenimientoRealizado: string = 'preventive';
    descripcionTrabajo = '';       // campo unificado: descripción + observaciones
    pruebaFuncionamiento = false;
    nextMaintenanceDateStr = '';
    proximoMantenimientoPeriodo: 'semiannual' | 'annual' = 'semiannual';
    showDescError = false;

    get currentUser(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || 'BOA';
        } catch { return 'BOA'; }
    }

    // ============================================
    // COMPUTED
    // ============================================
    canSubmit(): boolean {
        if (this.mode === 'envio') {
            return !!(
                this.scannedTool &&
                this.sendDateStr &&
                this.selectedProviderId
            );
        } else {
            return !!(
                this.maintenance &&
                this.actualReturnDateStr &&
                this.tipoMantenimientoRealizado &&
                this.descripcionTrabajo.trim()
            );
        }
    }

    getTypeLabel(type: string): string {
        const labels: Record<string, string> = {
            'preventive': 'PREVENTIVO',
            'corrective': 'CORRECTIVO',
        };
        return labels[type] ?? type?.toUpperCase() ?? '—';
    }

    fmtDate(d: string | null | undefined): string {
        if (!d || d === '—') return '—';
        const p = d.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
    }

    // ============================================
    // LIFECYCLE
    // ============================================
    ngOnInit(): void {
        this.loadProviders();
        this._setupToolSearch();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    // ============================================
    // DATA LOADING
    // ============================================
    loadProviders(): void {
        this.calibrationService.getActiveLaboratoriesPxp('mantenimiento').pipe(
            takeUntil(this._destroy$)
        ).subscribe({
            next: (labs) => this.providers = labs,
            error: () => this.showMessage('Error al cargar empresas', 'error')
        });
    }

    // ============================================
    // BÚSQUEDA DE HERRAMIENTA
    // ============================================
    private _setupToolSearch(): void {
        this._toolSearch$.pipe(
            debounceTime(350), distinctUntilChanged(),
            switchMap(term => {
                if (term.length < 2) { this.toolSuggestions = []; this.showToolDropdown = false; return of([]); }
                this.toolSearchLoading = true;
                return this.calibrationService.searchToolsAutocomplete(term).pipe(
                    finalize(() => this.toolSearchLoading = false)
                );
            }),
            takeUntil(this._destroy$)
        ).subscribe(results => {
            this.toolSuggestions = results || [];
            this.showToolDropdown = this.toolSuggestions.length > 0;
        });
    }

    onToolInput(value: string): void { this._toolSearch$.next(value.trim()); }

    selectToolSuggestion(tool: any): void {
        this.barcodeValue = tool.code ?? tool.tool_code;
        this.showToolDropdown = false;
        this.toolSuggestions = [];
        setTimeout(() => this.scanTool(), 50);
    }

    hideToolDropdown(): void { setTimeout(() => this.showToolDropdown = false, 180); }

    scanTool(): void {
        const barcode = this.barcodeValue.trim();
        if (!barcode) {
            this.showMessage('Ingrese un código de barras o código BOA', 'warning');
            return;
        }
        this.isScanning.set(true);
        this.scannedTool = null;
        this.generatedNota.set(null);
        this.calibrationService.scanToolForCalibration(barcode).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isScanning.set(false))
        ).subscribe({
            next: (result) => {
                if (!result) { this.showMessage('Herramienta no encontrada', 'error'); return; }
                this.scannedTool = result;
            },
            error: () => this.showMessage('Error al buscar la herramienta', 'error')
        });
    }

    clearScan(): void {
        this.scannedTool = null;
        this.barcodeValue = 'BOA-H-';
        this.generatedNota.set(null);
    }

    // ============================================
    // ENVÍO — cálculo de fechas
    // ============================================
    onMaintenanceTypeChange(): void {
        this.recalcExpectedReturn();
        if (this.maintenanceType !== 'corrective') {
            this.discrepancyReportNum = '';
        }
    }

    onPreventiveSubtypeChange(): void {
        this.recalcExpectedReturn();
    }

    onSendDateChange(): void {
        this.recalcExpectedReturn();
    }

    private recalcExpectedReturn(): void {
        if (!this.sendDateStr) return;
        this.expectedReturnDateStr = this.calcExpectedReturn(
            this.sendDateStr, this.maintenanceType, this.preventiveSubtype
        );
    }

    private calcExpectedReturn(
        fromDate: string,
        type: string,
        subtype: string
    ): string {
        const base = new Date(fromDate + 'T00:00:00');
        if (type === 'preventive') {
            subtype === 'annual'
                ? base.setFullYear(base.getFullYear() + 1)
                : base.setMonth(base.getMonth() + 6);
        } else {
            base.setDate(base.getDate() + 7);
        }
        return this.formatDate(base);
    }

    // ============================================
    // ENVÍO METHODS
    // ============================================
    onProviderChange(id: number): void {
        const p = this.providers.find(p => +p.id_laboratory === +id);
        this.selectedProviderName = p?.name || '';
    }

    submitEnvio(): void {
        if (!this.canSubmit()) {
            this.showMessage('Complete todos los campos requeridos', 'error');
            return;
        }
        this.isSaving.set(true);

        const params: any = {
            tool_id:              this.scannedTool.id_tool,
            type:                 this.maintenanceType,
            preventive_subtype:   this.maintenanceType === 'preventive' ? this.preventiveSubtype : null,
            discrepancy_report_num: this.maintenanceType === 'corrective' ? (this.discrepancyReportNum || '') : '',
            request_date:         this.requestDateStr,
            send_date:            this.sendDateStr,
            expected_return_date: this.expectedReturnDateStr,
            description:          this.problem || '',
            notes:                this.sendNotes || '',
            requested_by_name:    this.currentUser,
        };
        if (this.selectedProviderId) {
            params.provider         = this.selectedProviderName || '';
            const p = this.providers.find(p => +p.id_laboratory === +this.selectedProviderId!);
            params.provider_contact = p?.contact_person  || '';
        }

        // Pre-abrir ventana SINCRÓNICAMENTE y escribir pantalla de carga de inmediato
        const pdfWin = window.open('about:blank', '_blank') ?? null;
        if (pdfWin) {
            pdfWin.document.write('<html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;text-align:center;padding:60px;color:#475569"><h2 style="color:#0f172a">Generando nota de envio...</h2><p>Por favor espere</p></body></html>');
            pdfWin.document.close();
        }

        this.maintenanceService.sendMaintenancePxp(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: (result) => {
                const recordNum = result?.record_number ?? result?.[0]?.record_number;
                this.generatedNota.set(recordNum || null);
                this.showMessage(`Envío registrado — ${recordNum || 'OK'}`, 'success');
                if (pdfWin && recordNum) {
                    const tool = this.scannedTool as any;
                    const html = this._buildNotaHtml({
                        rn:       recordNum,
                        code:     tool?.code      ?? tool?.tool_code  ?? '',
                        name:     tool?.name      ?? tool?.tool_name  ?? '',
                        serial:   tool?.serial    ?? tool?.tool_serial ?? '',
                        model:    tool?.model     ?? tool?.tool_model ?? '',
                        brand:    tool?.brand     ?? tool?.tool_brand ?? '',
                        provider: this.selectedProviderName,
                        contact:  '',
                        type:     this.maintenanceType,
                        cost:     0,
                        sendDate: this.sendDateStr,
                        retDate:  this.expectedReturnDateStr,
                        notes:    this.sendNotes,
                        problem:  this.problem,
                    });
                    try {
                        pdfWin.document.open();
                        pdfWin.document.write(html);
                        pdfWin.document.close();
                    } catch { pdfWin.close(); }
                } else {
                    pdfWin?.close();
                }
                setTimeout(() => this.dialogRef.close(true), 1800);
            },
            error: (err) => { pdfWin?.close(); this.showMessage(err?.message || 'Error al registrar el envío', 'error'); }
        });
    }

    // ============================================
    // RETORNO METHODS
    // ============================================
    onTipoMantChange(): void {
        if (!this.actualReturnDateStr) return;
        const base = new Date(this.actualReturnDateStr + 'T00:00:00');

        if (this.tipoMantenimientoRealizado === 'preventive') {
            base.setMonth(base.getMonth() + 6);
            this.nextMaintenanceDateStr = base.toISOString().split('T')[0];
            this.proximoMantenimientoPeriodo = 'semiannual';
        } else if (this.tipoMantenimientoRealizado === 'corrective') {
            this.nextMaintenanceDateStr = '';
        } else {
            this.nextMaintenanceDateStr = '';
        }
    }

    onRetornoFechaChange(): void {
        if (this.tipoMantenimientoRealizado) this.onTipoMantChange();
    }

    onProximoPeriodoChange(): void {
        if (!this.actualReturnDateStr) return;
        const base = new Date(this.actualReturnDateStr + 'T00:00:00');
        const months = this.proximoMantenimientoPeriodo === 'annual' ? 12 : 6;
        base.setMonth(base.getMonth() + months);
        this.nextMaintenanceDateStr = base.toISOString().split('T')[0];
    }

    submitRetorno(): void {
        if (!this.canSubmit()) {
            if (!this.descripcionTrabajo.trim()) {
                this.showDescError = true;
                this.showMessage('La descripción del trabajo es obligatoria', 'error');
            }
            return;
        }
        this.isSaving.set(true);

        const params: any = {
            id_maintenance:      this.maintenance!.id_maintenance,
            tool_id:             this.maintenance!.tool_id,
            type:                this.tipoMantenimientoRealizado,
            actual_return_date:  this.actualReturnDateStr,
            completion_date:     this.actualReturnDateStr,
            solution:            this.descripcionTrabajo.trim(),
            recommendations:     this.pruebaFuncionamiento
                ? 'Prueba de funcionamiento: REALIZADA - OK'
                : 'Prueba de funcionamiento: NO REALIZADA',
            received_by_name:    this.currentUser,
            next_maintenance_period: this.tipoMantenimientoRealizado === 'preventive'
                ? this.proximoMantenimientoPeriodo
                : null,
        };
        if (this.nextMaintenanceDateStr) params.next_maintenance_date = this.nextMaintenanceDateStr;

        this.maintenanceService.returnMaintenancePxp(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: () => {
                this.showMessage('Retorno de mantenimiento procesado exitosamente', 'success');
                setTimeout(() => this.dialogRef.close(true), 500);
            },
            error: (err) => this.showMessage(err?.message || 'Error al procesar el retorno', 'error')
        });
    }

    // ============================================
    // HELPERS
    // ============================================
    getTodayStr(): string {
        return new Date().toISOString().split('T')[0];
    }

    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 4000, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }

    // ===================================================================
    // MÉTODOS DE PDF — generación 100% en frontend (sin llamada al servidor)
    // ===================================================================

    printNota(maintenanceData?: MaintenanceData): void {
        const mnt = maintenanceData || this.maintenance;
        if (!mnt) { this.showMessage('No hay datos de mantenimiento para imprimir', 'error'); return; }
        const html = this._buildNotaHtml({
            rn:      mnt.record_number,
            code:    mnt.tool_code,
            name:    mnt.tool_name,
            serial:  mnt.tool_serial ?? '',
            model:   (mnt as any).tool_model ?? '',
            brand:   (mnt as any).tool_brand ?? '',
            provider: mnt.provider,
            contact:  (mnt as any).provider_contact ?? '',
            type:     mnt.type,
            cost:     mnt.cost,
            sendDate: mnt.send_date,
            retDate:  mnt.expected_return_date ?? '',
            notes:    mnt.notes,
            problem:  (mnt as any).description ?? '',
        });
        this._abrirHtmlSync(html);
    }

    printCertificado(maintenanceData?: MaintenanceData): void {
        const mnt = maintenanceData || this.maintenance;
        if (!mnt) { this.showMessage('No hay datos de mantenimiento para imprimir', 'error'); return; }
        const html = this._buildCertHtml({
            rn:          mnt.record_number,
            code:        mnt.tool_code,
            name:        mnt.tool_name,
            serial:      mnt.tool_serial ?? '',
            provider:    mnt.provider,
            type:        this.mode === 'retorno' ? this.tipoMantenimientoRealizado : mnt.type,
            sendDate:    mnt.send_date,
            returnDate:  this.mode === 'retorno' ? this.actualReturnDateStr : ((mnt as any).actual_return_date ?? ''),
            solution:    this.mode === 'retorno' ? this.descripcionTrabajo : ((mnt as any).solution ?? ''),
            receivedBy:  this.mode === 'retorno' ? this.currentUser : ((mnt as any).received_by_name ?? ''),
        });
        this._abrirHtmlSync(html);
    }

    // Abre HTML en nueva pestaña de forma SINCRÓNICA.
    // window.open + document.write en el mismo tick del click de usuario:
    // no hay popup-blocker, no hay blob URL, funciona en todos los navegadores.
    private _abrirHtmlSync(html: string): void {
        const win = window.open('about:blank', '_blank');
        if (!win) { this.showMessage('Permita ventanas emergentes para imprimir', 'warning'); return; }
        win.document.open();
        win.document.write(html);
        win.document.close();
    }

    // Helpers de formato para los documentos PDF
    private _pdfDate(d: string | null | undefined): string {
        if (!d) return '—';
        const p = d.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
    }
    private _pdfType(t: string | null | undefined): string {
        const map: Record<string, string> = {
            preventive: 'PREVENTIVO', corrective: 'CORRECTIVO',
            predictive: 'PREDICTIVO', emergency:  'EMERGENCIA',
        };
        return map[(t ?? '').toLowerCase()] ?? ((t ?? '').toUpperCase() || '—');
    }
    private _pdfToday(): string {
        const d = new Date();
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }
    private _esc(s: any): string {
        return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    private _buildNotaHtml(p: {
        rn: string; code: string; name: string; serial: string; model: string; brand: string;
        provider: string; contact: string; type: string; cost: number | string;
        sendDate: string; retDate: string; notes: string; problem: string;
    }): string {
        const today   = this._pdfToday();
        const rn      = this._esc(p.rn      || 'N/A');
        const code    = this._esc(p.code    || 'N/A');
        const name    = this._esc(p.name    || 'N/A');
        const serial  = this._esc(p.serial  || '—');
        const brand   = this._esc(p.brand   || '');
        const model   = this._esc(p.model   || '');
        const prov    = this._esc(p.provider|| 'N/A');
        const contact = this._esc(p.contact || '');
        const type    = this._esc(this._pdfType(p.type));
        const send    = this._esc(this._pdfDate(p.sendDate));
        const retEst  = this._esc(this._pdfDate(p.retDate));
        const cost    = Number(p.cost || 0).toFixed(2);
        const notes   = this._esc(p.notes   || '').replace(/\n/g, '<br>');
        const problem = this._esc(p.problem || '').replace(/\n/g, '<br>');
        const CSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#1e293b}.header{background:#0f172a;color:#fff;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start}.title{font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.5px}.nota{font-size:24px;font-weight:900;color:#f97316;font-family:monospace;margin:5px 0}.sub{font-size:9px;opacity:.7}.date-block{text-align:right;font-size:11px}.section{border:1.5px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:12px}.section-title{font-size:9px;font-weight:900;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px;letter-spacing:.5px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px}.field .label{font-size:8px;font-weight:700;text-transform:uppercase;color:#94a3b8}.field .value{font-size:12px;font-weight:700}.dates{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;background:#f8fafc;padding:10px;border-radius:6px;margin-top:8px;text-align:center}.date-card .dlabel{font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase}.date-card .dval{font-size:12px;font-weight:900}.sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:18px;padding-top:12px;border-top:1.5px solid #e2e8f0}.sig-line{border-top:1px solid #94a3b8;margin-top:32px;padding-top:4px;text-align:center;font-size:9px;color:#64748b}.meta{margin-top:10px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px;display:flex;justify-content:space-between}@media print{body{padding:0}}`;
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Nota Envio Mantenimiento ${rn}</title><style>${CSS}</style></head><body>
<div class="header"><div><div class="title">NOTA DE ENVIO A MANTENIMIENTO</div><div class="nota">${rn}</div><div class="sub">Sistema de Gestion Tecnica &middot; BOA</div></div><div class="date-block"><div>Fecha: ${today}</div><div style="font-size:13px;font-weight:900;margin-top:4px">${code}</div></div></div>
<div class="section"><div class="section-title">Datos de la Herramienta</div><div class="grid">
  <div class="field"><div class="label">Codigo BOA</div><div class="value">${code}</div></div>
  <div class="field"><div class="label">N&deg; Serie</div><div class="value">${serial}</div></div>
  <div class="field" style="grid-column:1/-1"><div class="label">Nombre</div><div class="value">${name}</div></div>
  ${brand ? `<div class="field"><div class="label">Marca</div><div class="value">${brand}</div></div>` : ''}
  ${model ? `<div class="field"><div class="label">Modelo</div><div class="value">${model}</div></div>` : ''}
</div></div>
<div class="section"><div class="section-title">Datos del Envio</div><div class="grid">
  <div class="field"><div class="label">Empresa / Taller</div><div class="value">${prov}</div></div>
  <div class="field"><div class="label">Contacto</div><div class="value">${contact || '&mdash;'}</div></div>
  <div class="field"><div class="label">Tipo de Servicio</div><div class="value">${type}</div></div>
  <div class="field"><div class="label">Costo Estimado</div><div class="value">Bs. ${cost}</div></div>
</div>
<div class="dates">
  <div class="date-card"><div class="dlabel">Fecha Envio</div><div class="dval">${send}</div></div>
  <div class="date-card"><div class="dlabel">Retorno Estimado</div><div class="dval">${retEst}</div></div>
  <div class="date-card"><div class="dlabel">Estado</div><div class="dval">EN TALLER</div></div>
</div>
${problem ? `<div style="margin-top:8px"><div class="label" style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase">Descripcion del Problema</div><div style="margin-top:3px;font-size:11px">${problem}</div></div>` : ''}
${notes   ? `<div style="margin-top:8px"><div class="label" style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase">Notas</div><div style="margin-top:3px;font-size:11px">${notes}</div></div>` : ''}
</div>
<div class="sigs"><div><div class="sig-line">Tecnico emisor</div></div><div><div class="sig-line">Jefe de almacen</div></div><div><div class="sig-line">Recibido por taller</div></div></div>
<div class="meta"><span>BOA &mdash; MGH-109 &middot; ${rn}</span><span>${today}</span></div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    }

    private _buildCertHtml(p: {
        rn: string; code: string; name: string; serial: string;
        provider: string; type: string; sendDate: string; returnDate: string;
        solution: string; receivedBy: string;
    }): string {
        const today      = this._pdfToday();
        const rn         = this._esc(p.rn         || 'N/A');
        const code       = this._esc(p.code       || 'N/A');
        const name       = this._esc(p.name       || 'N/A');
        const serial     = this._esc(p.serial     || '—');
        const prov       = this._esc(p.provider   || 'N/A');
        const type       = this._esc(this._pdfType(p.type));
        const send       = this._esc(this._pdfDate(p.sendDate));
        const returnDate = this._esc(this._pdfDate(p.returnDate) || today);
        const solution   = this._esc(p.solution   || '').replace(/\n/g, '<br>');
        const CSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#1e293b}.header{background:#0f172a;color:#fff;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start}.title{font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.5px}.nota{font-size:24px;font-weight:900;color:#f97316;font-family:monospace;margin:5px 0}.sub{font-size:9px;opacity:.7}.result-box{text-align:center;padding:14px;background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;margin-bottom:14px}.result-ok{font-size:18px;font-weight:900;color:#16a34a}.section{border:1.5px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:12px}.section-title{font-size:9px;font-weight:900;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px;letter-spacing:.5px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px}.field .label{font-size:8px;font-weight:700;text-transform:uppercase;color:#94a3b8}.field .value{font-size:12px;font-weight:700}.sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:18px;padding-top:12px;border-top:1.5px solid #e2e8f0}.sig-line{border-top:1px solid #94a3b8;margin-top:32px;padding-top:4px;text-align:center;font-size:9px;color:#64748b}.meta{margin-top:10px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px;display:flex;justify-content:space-between}@media print{body{padding:0}}`;
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Certificado Retorno Mantenimiento ${rn}</title><style>${CSS}</style></head><body>
<div class="header"><div><div class="title">CERTIFICADO DE RETORNO - MANTENIMIENTO</div><div class="nota">${rn}</div><div class="sub">Sistema de Gestion Tecnica &middot; BOA</div></div><div style="text-align:right;font-size:11px"><div>Fecha: ${today}</div><div style="font-size:13px;font-weight:900;margin-top:4px">${code}</div></div></div>
<div class="result-box"><div class="result-ok">&#10003; TRABAJO COMPLETADO</div><div style="margin-top:5px;font-size:11px">Tipo de servicio: <strong>${type}</strong></div></div>
<div class="section"><div class="section-title">Datos de la Herramienta</div><div class="grid">
  <div class="field"><div class="label">Codigo BOA</div><div class="value">${code}</div></div>
  <div class="field"><div class="label">N&deg; Serie</div><div class="value">${serial}</div></div>
  <div class="field" style="grid-column:1/-1"><div class="label">Nombre</div><div class="value">${name}</div></div>
</div></div>
<div class="section"><div class="section-title">Datos del Servicio</div><div class="grid">
  <div class="field"><div class="label">Taller / Empresa</div><div class="value">${prov}</div></div>
  <div class="field"><div class="label">Tipo de Mantenimiento</div><div class="value">${type}</div></div>
  <div class="field"><div class="label">Fecha Envio</div><div class="value">${send}</div></div>
  <div class="field"><div class="label">Fecha Retorno</div><div class="value">${returnDate}</div></div>
</div>
${solution ? `<div style="margin-top:8px"><div class="label" style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase">Trabajo Realizado</div><div style="margin-top:3px;font-size:11px">${solution}</div></div>` : ''}
</div>
<div class="sigs"><div><div class="sig-line">Tecnico receptor</div></div><div><div class="sig-line">Jefe de mantenimiento</div></div><div><div class="sig-line">Sello del taller</div></div></div>
<div class="meta"><span>BOA &mdash; MGH-109 &middot; ${rn}</span><span>${today}</span></div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    }

    private _escribirEnVentana(win: Window, base64OrHtml: string): void {
        if (!base64OrHtml) { win.close(); return; }
        const trimmed = base64OrHtml.trimStart();
        const html = trimmed.startsWith('<') ? base64OrHtml : atob(base64OrHtml);
        this._abrirHtmlSync(html);
        win.close();
    }

    private _abrirPdf(base64OrHtml: string, _filename?: string): void {
        const trimmed = (base64OrHtml ?? '').trimStart();
        const html = trimmed.startsWith('<') ? base64OrHtml : atob(base64OrHtml);
        this._abrirHtmlSync(html);
    }
}
