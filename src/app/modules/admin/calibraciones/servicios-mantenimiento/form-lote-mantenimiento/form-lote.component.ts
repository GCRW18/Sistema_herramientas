import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { Subject, lastValueFrom, of } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CalibrationService } from '../../../../../core/services/calibration.service';
import { MaintenanceService } from '../../../../../core/services/maintenance.service';

interface Proveedor {
    id_laboratory: number;
    name: string;
    contact_person?: string;
}

interface MaintToolItem {
    toolId:               number;
    toolCode:             string;
    toolName:             string;
    toolSerial:           string;
    maintenanceType:      'preventive' | 'corrective';
    preventiveSubtype:    'semiannual' | 'annual';
    expectedReturnDate:   string;
    notes:                string;
    discrepancyReportNum: string;
    status:               'pending' | 'sending' | 'done' | 'error';
    error?:               string;
    recordNumber?:        string;
}

@Component({
    selector: 'app-form-lote-mantenimiento',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatIconModule,
        MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
        CdkDrag, CdkDragHandle,
    ],
    templateUrl: './form-lote.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class FormLoteMantenimientoComponent implements OnInit, OnDestroy {

    private calibrationService = inject(CalibrationService);
    private maintenanceService = inject(MaintenanceService);
    public  dialogRef  = inject(MatDialogRef<FormLoteMantenimientoComponent>);
    private snackBar   = inject(MatSnackBar);
    private cdr        = inject(ChangeDetectorRef);
    private _destroy$  = new Subject<void>();
    private _toolSearch$ = new Subject<string>();

    @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

    isProcessing = signal(false);
    isScanning   = signal(false);
    processedCount = 0;

    providers: Proveedor[] = [];

    // Campos compartidos
    selectedProviderId:   number | null = null;
    selectedProviderName  = '';
    sendDateStr           = this._today();

    // Buscador
    barcodeValue      = 'BOA-H-';
    toolSuggestions:  any[] = [];
    showToolDropdown  = false;
    toolSearchLoading = false;

    // Lista de herramientas con config individual
    items: MaintToolItem[] = [];

    readonly serviceTypeOptions = [
        { value: 'preventive', label: 'PREVENTIVO' },
        { value: 'corrective', label: 'CORRECTIVO' },
    ];

    readonly subtypeOptions = [
        { value: 'semiannual', label: '6 MESES' },
        { value: 'annual',     label: '12 MESES' },
    ];

    ngOnInit(): void {
        this.loadProviders();
        this._setupToolSearch();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    loadProviders(): void {
        this.calibrationService.getActiveLaboratoriesPxp().pipe(
            takeUntil(this._destroy$)
        ).subscribe({
            next: (labs) => this.providers = labs,
            error: () => this.showMsg('Error al cargar empresas', 'error')
        });
    }

    onProviderChange(id: number): void {
        const p = this.providers.find(p => +p.id_laboratory === +id);
        this.selectedProviderName = p?.name ?? '';
    }

    // ── Búsqueda de herramienta ────────────────────────────
    private _setupToolSearch(): void {
        this._toolSearch$.pipe(
            debounceTime(350), distinctUntilChanged(),
            switchMap(term => {
                if (term.length < 2) { this.showToolDropdown = false; return of([]); }
                this.toolSearchLoading = true;
                return this.calibrationService.searchToolsAutocomplete(term).pipe(
                    finalize(() => this.toolSearchLoading = false)
                );
            }),
            takeUntil(this._destroy$)
        ).subscribe(r => {
            this.toolSuggestions = r || [];
            this.showToolDropdown = this.toolSuggestions.length > 0;
        });
    }

    onToolInput(v: string): void { this._toolSearch$.next(v.trim()); }
    hideToolDropdown(): void { setTimeout(() => this.showToolDropdown = false, 180); }

    selectToolSuggestion(tool: any): void {
        this.barcodeValue = tool.code ?? tool.tool_code;
        this.showToolDropdown = false;
        this.toolSuggestions = [];
        this.scanAndAdd();
    }

    scanAndAdd(): void {
        const barcode = this.barcodeValue.trim();
        if (!barcode) return;
        if (this.items.some(i => i.toolCode === barcode)) {
            this.showMsg('La herramienta ya está en el lote', 'warning');
            return;
        }
        this.isScanning.set(true);
        this.calibrationService.scanToolForCalibration(barcode).pipe(
            finalize(() => this.isScanning.set(false))
        ).subscribe({
            next: (result) => {
                if (!result) { this.showMsg('Herramienta no encontrada', 'error'); return; }
                if (this.items.some(i => i.toolId === result.id_tool)) {
                    this.showMsg('La herramienta ya está en el lote', 'warning');
                    return;
                }
                const last = this.items[this.items.length - 1];
                const newItem: MaintToolItem = {
                    toolId:               result.id_tool,
                    toolCode:             result.code,
                    toolName:             result.name,
                    toolSerial:           result.serial_number ?? '',
                    maintenanceType:      last?.maintenanceType   ?? 'preventive',
                    preventiveSubtype:    last?.preventiveSubtype ?? 'semiannual',
                    expectedReturnDate:   last?.expectedReturnDate ?? this._calcReturn('preventive', 'semiannual'),
                    notes:                '',
                    discrepancyReportNum: '',
                    status:               'pending',
                };
                this.items = [...this.items, newItem];
                this.barcodeValue = 'BOA-H-';
                this.showToolDropdown = false;
                this.cdr.detectChanges();
                this.scanInputRef?.nativeElement.focus();
            },
            error: () => this.showMsg('Error al buscar la herramienta', 'error')
        });
    }

    removeTool(index: number): void {
        if (!this.isProcessing()) this.items = this.items.filter((_, i) => i !== index);
    }

    onItemTypeChange(item: MaintToolItem): void {
        if (item.maintenanceType !== 'corrective') item.discrepancyReportNum = '';
        item.expectedReturnDate = this._calcReturn(item.maintenanceType, item.preventiveSubtype);
    }

    onItemSubtypeChange(item: MaintToolItem): void {
        item.expectedReturnDate = this._calcReturn(item.maintenanceType, item.preventiveSubtype);
    }

    canSubmit(): boolean {
        if (!this.selectedProviderId || !this.sendDateStr) return false;
        return this.items.some(i => i.status !== 'done');
    }

    getDoneCount():  number { return this.items.filter(i => i.status === 'done').length; }
    getErrorCount(): number { return this.items.filter(i => i.status === 'error').length; }

    async submitLote(): Promise<void> {
        if (!this.canSubmit() || this.isProcessing()) return;
        this.isProcessing.set(true);
        this.processedCount = 0;

        for (const item of this.items) {
            if (item.status === 'done') continue;
            item.status = 'sending';
            this.cdr.detectChanges();

            const params = {
                tool_id:              item.toolId,
                type:                 item.maintenanceType,
                preventive_subtype:   item.maintenanceType === 'preventive' ? item.preventiveSubtype : undefined,
                send_date:            this.sendDateStr,
                expected_return_date: item.expectedReturnDate,
                provider:             this.selectedProviderName,
                problem:              item.maintenanceType === 'corrective' ? item.discrepancyReportNum : '',
                notes:                item.notes,
                requested_by_name:    this._currentUser(),
            };

            try {
                const result = await lastValueFrom(
                    this.maintenanceService.sendMaintenancePxp(params)
                );
                item.status       = 'done';
                item.recordNumber = result?.record_number ?? '—';
            } catch (e: any) {
                item.status = 'error';
                item.error  = e?.message || 'Error de conexión';
            }
            this.processedCount++;
            this.cdr.detectChanges();
        }

        this.isProcessing.set(false);
        this.cdr.detectChanges();

        if (this.items.every(i => i.status === 'done')) {
            this._abrirNotaLote();
            this.showMsg(`${this.items.length} herramienta(s) enviada(s) a mantenimiento`, 'success');
            setTimeout(() => this.dialogRef.close(true), 1800);
        } else if (this.getErrorCount() > 0) {
            this.showMsg(`${this.getErrorCount()} error(es) — revise y reintente`, 'error');
        }
    }

    abrirNotaLoteManual(): void { this._abrirNotaLote(); }

    private _abrirNotaLote(): void {
        const w = window.open('', '_blank');
        if (!w) { this.showMsg('Permita las ventanas emergentes para ver la nota', 'warning'); return; }
        w.document.write(this._buildNotaHtml());
        w.document.close();
    }

    private _buildNotaHtml(): string {
        const fecha   = this.fmtDate(this.sendDateStr);
        const empresa = this.selectedProviderName || '—';
        const usuario = this._currentUser();
        const hoy     = this.fmtDate(new Date().toISOString().split('T')[0]);
        const doneItems = this.items.filter(i => i.status === 'done');

        const filas = doneItems.map((item, idx) => `
            <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td><strong>${item.toolCode}</strong></td>
                <td>${item.toolName}</td>
                <td style="text-align:center">${item.toolSerial || '—'}</td>
                <td style="text-align:center">${item.maintenanceType === 'preventive' ? 'PREVENTIVO' : 'CORRECTIVO'}</td>
                <td style="text-align:center">${item.maintenanceType === 'preventive'
                    ? (item.preventiveSubtype === 'annual' ? '12 meses' : '6 meses')
                    : '—'}</td>
                <td style="text-align:center;font-weight:bold">${item.recordNumber || '—'}</td>
                <td style="text-align:center">${this.fmtDate(item.expectedReturnDate)}</td>
                <td>${item.notes || ''}</td>
            </tr>`).join('');

        return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8">
<title>Nota de Envío a Mantenimiento — Lote</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:18px 24px}
  .hdr{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #0f172a;padding-bottom:10px;margin-bottom:12px}
  .hdr-left h1{font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
  .hdr-left p{font-size:9px;color:#555;margin-top:2px}
  .badge{background:#f59e0b;color:#000;font-weight:900;font-size:11px;padding:4px 12px;border:2px solid #000;border-radius:4px;white-space:nowrap}
  .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
  .info-box{border:1px solid #cbd5e1;border-radius:4px;padding:6px 10px}
  .info-box .lbl{font-size:7px;text-transform:uppercase;letter-spacing:.1em;color:#64748b;font-weight:700;margin-bottom:2px}
  .info-box .val{font-size:11px;font-weight:700;color:#0f172a}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  thead tr{background:#0f172a;color:#fff}
  thead th{padding:6px 8px;font-size:8px;text-transform:uppercase;letter-spacing:.08em;text-align:left;font-weight:700}
  tbody tr:nth-child(even){background:#f8fafc}
  tbody td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:9px;vertical-align:middle}
  .footer{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:20px;border-top:2px solid #0f172a;padding-top:12px}
  .sign-box{text-align:center}
  .sign-box .line{border-bottom:1px solid #0f172a;height:36px;margin-bottom:4px}
  .sign-box .cap{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#555;font-weight:700}
  .note{font-size:8px;color:#64748b;margin-top:8px}
  @media print{body{padding:10px 16px}}
</style></head>
<body>
<div class="hdr">
  <div class="hdr-left">
    <h1>Nota de Envío a Mantenimiento</h1>
    <p>BOA — Gestión Técnica de Herramientas &nbsp;|&nbsp; MGH-109 &nbsp;|&nbsp; LOTE</p>
  </div>
  <div class="badge">MGH-109</div>
</div>

<div class="info-grid">
  <div class="info-box"><div class="lbl">Fecha de Envío</div><div class="val">${fecha}</div></div>
  <div class="info-box"><div class="lbl">Empresa / Taller</div><div class="val">${empresa}</div></div>
  <div class="info-box"><div class="lbl">Solicitado por</div><div class="val">${usuario}</div></div>
  <div class="info-box"><div class="lbl">Total de Herramientas</div><div class="val">${doneItems.length}</div></div>
  <div class="info-box"><div class="lbl">Generado</div><div class="val">${hoy}</div></div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:28px">#</th>
      <th>Código BOA</th>
      <th>Herramienta</th>
      <th style="width:72px">N° Serie</th>
      <th style="width:80px">Tipo</th>
      <th style="width:64px">Período</th>
      <th style="width:90px">N° Nota</th>
      <th style="width:76px">Ret. Estimado</th>
      <th>Observaciones</th>
    </tr>
  </thead>
  <tbody>${filas}</tbody>
</table>

<div class="footer">
  <div class="sign-box"><div class="line"></div><div class="cap">Entregado por</div></div>
  <div class="sign-box"><div class="line"></div><div class="cap">Recibido por (Taller)</div></div>
  <div class="sign-box"><div class="line"></div><div class="cap">Jefe de Sección</div></div>
</div>
<p class="note">Documento generado automáticamente por el Sistema de Gestión Técnica BOA. Conserve este documento como respaldo del envío.</p>

<script>window.onload=function(){window.print()}</script>
</body></html>`;
    }

    fmtDate(d: string | null | undefined): string {
        if (!d) return '—';
        const p = d.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
    }

    private _calcReturn(type: 'preventive' | 'corrective', subtype: 'semiannual' | 'annual'): string {
        const base = new Date(this.sendDateStr ? this.sendDateStr + 'T00:00:00' : Date.now());
        if (type === 'preventive') {
            subtype === 'annual'
                ? base.setFullYear(base.getFullYear() + 1)
                : base.setMonth(base.getMonth() + 6);
        } else {
            base.setDate(base.getDate() + 7);
        }
        return base.toISOString().split('T')[0];
    }

    private _today(): string { return new Date().toISOString().split('T')[0]; }

    private _currentUser(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || 'BOA';
        } catch { return 'BOA'; }
    }

    private showMsg(msg: string, type: 'success' | 'error' | 'warning'): void {
        this.snackBar.open(msg, 'Cerrar', {
            duration: 4000, horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
