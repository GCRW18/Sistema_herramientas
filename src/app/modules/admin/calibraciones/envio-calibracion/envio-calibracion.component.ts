import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule }                                  from '@angular/common';
import { Router }                                        from '@angular/router';
import { MatIconModule }                                 from '@angular/material/icon';
import { MatDialog, MatDialogModule }                    from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule }                from '@angular/material/snack-bar';
import { MatProgressSpinnerModule }                      from '@angular/material/progress-spinner';
import { MatTooltipModule }                              from '@angular/material/tooltip';
import { MatMenuModule }                                 from '@angular/material/menu';
import { FormControl, ReactiveFormsModule }              from '@angular/forms';
import { Subject, from, of }                             from 'rxjs';
import { debounceTime, takeUntil, finalize, catchError } from 'rxjs/operators';
import { CalibrationService }                            from '../../../../core/services/calibration.service';
import { ErpApiService }                                 from 'app/core/api/api.service';

interface CalibrationDisplay {
    id_calibration:       number;
    tool_code:            string;
    tool_name:            string;
    part_number:          string;
    ubicacion:            string;
    supplier_name:        string;
    record_number:        string;
    send_date:            string;
    expected_return_date: string | null;
    work_type:            string;
    base:                 string;
    almacen:              string;
    status:               string;
    is_jack:              boolean;
    has_certificate_file: boolean;
    certificate_number:   string | null;
    observations:         string | null;
}

@Component({
    selector: 'app-envio-calibracion',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatMenuModule,
        ReactiveFormsModule,
    ],
    templateUrl: './envio-calibracion.component.html',
    styles: [`
        :host { display: block; height: 100%; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .transition-all {
            transition-property: all;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            transition-duration: 150ms;
        }
    `]
})
export class EnvioCalibracionComponent implements OnInit, OnDestroy {

    private router             = inject(Router);
    private dialog             = inject(MatDialog);
    private snackBar           = inject(MatSnackBar);
    private calibrationService = inject(CalibrationService);
    private _api               = inject(ErpApiService);
    private _destroy$          = new Subject<void>();

    searchControl = new FormControl('');
    filterEstado  = new FormControl('');

    isLoading             = signal(false);
    calibraciones:         CalibrationDisplay[] = [];
    filteredCalibraciones: CalibrationDisplay[] = [];

    // Cache de ubicaciones cargado una vez al inicio
    private locationMap = new Map<string, { pn: string; ubicacion: string }>();

    estadosFiltro = [
        { value: '',           label: 'Todos los estados' },
        { value: 'sent',       label: 'Enviados'         },
        { value: 'returned',   label: 'Completados'      },
        { value: 'cancelled',  label: 'Anulados'         },
    ];

    // ── Paginación ────────────────────────────────
    pageSize  = 10;
    pageIndex = 0;

    get totalRecords(): number { return this.filteredCalibraciones.length; }
    get totalPages():   number { return Math.ceil(this.totalRecords / this.pageSize) || 1; }
    get startIndex():   number { return this.totalRecords === 0 ? 0 : this.pageIndex * this.pageSize + 1; }
    get endIndex():     number { return Math.min((this.pageIndex + 1) * this.pageSize, this.totalRecords); }

    get paginatedCalibraciones(): CalibrationDisplay[] {
        const s = this.pageIndex * this.pageSize;
        return this.filteredCalibraciones.slice(s, s + this.pageSize);
    }

    nextPage(): void { if (this.pageIndex < this.totalPages - 1) this.pageIndex++; }
    prevPage(): void { if (this.pageIndex > 0) this.pageIndex--; }

    // ── Lifecycle ────────────────────────────────
    ngOnInit(): void {
        this.loadLocationMap();
        this.setupFilters();
        this.loadCalibraciones();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    @HostListener('window:focus')
    onWindowFocus(): void {
        if (!this.isLoading()) this.loadCalibraciones();
    }

    // ── Carga mapa de ubicaciones (una vez) ──────
    loadLocationMap(): void {
        from(this._api.post('herramientas/leveltools/listarLevelTools', { start: 0, limit: 5000 })).pipe(
            takeUntil(this._destroy$),
            catchError(() => of({ datos: [] }))
        ).subscribe((res: any) => {
            const raw: any[] = res?.datos || res?.data || [];
            this.locationMap.clear();
            for (const t of raw) {
                const key = (t.code || '').trim().toUpperCase();
                if (!key) continue;
                const rack  = t.rack_code  || '';
                const level = t.level_code || '';
                this.locationMap.set(key, {
                    pn:       t.part_number || '—',
                    ubicacion: rack && level ? `${rack} - ${level}` : rack || level || '—',
                });
            }
            // Re-enriquecer si ya se cargaron calibraciones
            if (this.calibraciones.length) this._enrichAndApply();
        });
    }

    // ── Carga calibraciones ──────────────────────
    loadCalibraciones(): void {
        this.isLoading.set(true);
        this.pageIndex = 0;

        const estado = this.filterEstado.value;
        const params: any = {
            limit: 200,
            filtro: "(cls.internal_notes IS NULL OR cls.internal_notes != '[TRANSCRIPCIÓN HISTÓRICA]')",
        };
        if (estado) params.status = estado;

        this.calibrationService.getCalibrations(params).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading.set(false)),
        ).subscribe({
            next: (records: any[]) => {
                this.calibraciones = records.map(r => {
                    const code = (r.tool_code ?? r.code ?? '').trim().toUpperCase();
                    const loc  = this.locationMap.get(code);
                    return {
                        id_calibration:       r.id_calibration       ?? r.id ?? 0,
                        tool_code:            r.tool_code             ?? r.code          ?? '—',
                        tool_name:            r.tool_name             ?? r.name          ?? '—',
                        part_number:          loc?.pn                 ?? '—',
                        ubicacion:            loc?.ubicacion          ?? '—',
                        supplier_name:        r.supplier_name         ?? r.laboratory_name ?? '—',
                        record_number:        r.record_number         ?? '—',
                        send_date:            r.send_date             ?? '—',
                        expected_return_date: r.expected_return_date  ?? null,
                        work_type:            r.work_type             ?? 'CALIBRACIÓN',
                        base:                 r.base                  ?? '—',
                        almacen:              r.almacen ?? r.warehouse_name ?? r.warehouse ?? '—',
                        status:               r.status                ?? 'sent',
                        is_jack:              r.is_jack               ?? false,
                        has_certificate_file: !!(r.has_certificate_file || r.certificate_file),
                        certificate_number:   r.certificate_number    ?? null,
                        observations:         r.observations ?? r.notes ?? r.observaciones ?? null,
                    };
                });
                this.applyFilters();
            },
            error: (err) => {
                console.error('Error loading calibrations:', err);
                this.showMsg('Error al cargar las calibraciones', 'error');
            },
        });
    }

    private _enrichAndApply(): void {
        this.calibraciones = this.calibraciones.map(c => {
            const loc = this.locationMap.get(c.tool_code.trim().toUpperCase());
            return { ...c, part_number: loc?.pn ?? '—', ubicacion: loc?.ubicacion ?? '—' };
        });
        this.applyFilters();
    }

    setupFilters(): void {
        this.searchControl.valueChanges.pipe(
            debounceTime(300),
            takeUntil(this._destroy$),
        ).subscribe(() => this.applyFilters());

        this.filterEstado.valueChanges.pipe(
            debounceTime(400),
            takeUntil(this._destroy$),
        ).subscribe(() => this.loadCalibraciones());
    }

    applyFilters(): void {
        this.pageIndex = 0;
        let list = [...this.calibraciones];

        const q = this.searchControl.value?.toLowerCase().trim() ?? '';
        if (q) {
            list = list.filter(c =>
                c.tool_code.toLowerCase().includes(q)     ||
                c.tool_name.toLowerCase().includes(q)     ||
                c.record_number.toLowerCase().includes(q) ||
                c.supplier_name.toLowerCase().includes(q) ||
                c.base.toLowerCase().includes(q)          ||
                c.part_number.toLowerCase().includes(q)   ||
                c.ubicacion.toLowerCase().includes(q),
            );
        }

        const estado = this.filterEstado.value;
        if (estado === 'returned') {
            list = list.filter(c => this.isCompleted(c.status));
        }

        this.filteredCalibraciones = list;
    }

    private isCompleted(s: string): boolean { return s === 'returned' || s === 'completed'; }

    // ── KPI Getters ───────────────────────────────
    getEnLabCount(): number      { return this.calibraciones.filter(c => c.status === 'sent' || c.status === 'in_process').length; }
    getRetrasadasCount(): number { return this.calibraciones.filter(c => this.isRetrasado(c)).length; }
    getATiempoCount(): number    { return Math.max(0, this.getEnLabCount() - this.getRetrasadasCount()); }

    // ── Row Helpers ───────────────────────────────
    isRetrasado(cal: CalibrationDisplay): boolean {
        if (!cal.expected_return_date || this.isCompleted(cal.status) || cal.status === 'cancelled') return false;
        try {
            const expected = new Date(cal.expected_return_date);
            const today    = new Date();
            today.setHours(0, 0, 0, 0);
            return expected < today;
        } catch { return false; }
    }

    getDiasRetrasado(cal: CalibrationDisplay): number {
        if (!cal.expected_return_date) return 0;
        try {
            const expected = new Date(cal.expected_return_date);
            const today    = new Date();
            today.setHours(0, 0, 0, 0);
            return Math.floor((today.getTime() - expected.getTime()) / 86_400_000);
        } catch { return 0; }
    }

    getWorkTypeLabel(w: string): string {
        if (w === 'CALIBRACIÓN Y REPARACIÓN') return 'CAL + REP.';
        if (w === 'CALIBRACIÓN')              return 'CALIB.';
        if (w === 'REPARACIÓN')               return 'REPAR.';
        return w || '—';
    }

    getStatusLabel(s: string): string {
        const labels: Record<string, string> = {
            sent: 'ENVIADO', in_process: 'EN PROCESO',
            returned: 'COMPLETADO', completed: 'COMPLETADO', cancelled: 'ANULADO'
        };
        return labels[s] ?? s.toUpperCase();
    }

    getStatusChipClass(s: string): string {
        const classes: Record<string, string> = {
            sent:       'bg-blue-700 text-gray-100 border-black',
            returned:   'bg-green-600 text-black border-black',
            completed:  'bg-green-600 text-black border-black',
            cancelled:  'bg-red-600 text-gray-100 border-black'
        };
        return classes[s] ?? 'bg-gray-100 text-gray-700 border-gray-500';
    }

    // ── Imprimir herramientas no retornadas ───────
    printNoRetornadas(): void {
        const pendientes = this.calibraciones.filter(c => c.status === 'sent' || c.status === 'in_process');
        if (!pendientes.length) {
            this.showMsg('No hay herramientas pendientes de retorno', 'info');
            return;
        }
        const now = new Date().toLocaleDateString('es-BO', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const rows = pendientes.map((c, i) => `
            <tr class="${this.isRetrasado(c) ? 'row-delayed' : ''}">
                <td class="text-center">${i + 1}</td>
                <td class="mono">${c.tool_code}</td>
                <td class="mono small">${c.part_number !== '—' ? c.part_number : ''}</td>
                <td>${c.tool_name}</td>
                <td class="small">${c.ubicacion !== '—' ? c.ubicacion : ''}</td>
                <td>${c.supplier_name}</td>
                <td class="mono">${c.record_number}</td>
                <td class="mono">${c.send_date}</td>
                <td class="mono ${this.isRetrasado(c) ? 'text-delayed' : ''}">
                    ${c.expected_return_date || '—'}${this.isRetrasado(c) ? ` <strong>(+${this.getDiasRetrasado(c)}d)</strong>` : ''}
                </td>
                <td>${c.base}</td>
            </tr>
        `).join('');

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Herramientas Pendientes de Retorno</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 9px; color: #000; padding: 16px; }
  .header { border: 3px solid #000; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header h1 { font-size: 15px; font-weight: 900; text-transform: uppercase; }
  .header p  { font-size: 8px; color: #555; margin-top: 2px; }
  .header-right { text-align: right; }
  .header-right .label { font-size: 7px; font-weight: 700; text-transform: uppercase; color: #888; }
  .header-right .value { font-size: 10px; font-weight: 900; }
  .filter-bar { background: #000; color: #fff; padding: 5px 10px; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; display: flex; justify-content: space-between; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #000; color: #fff; }
  thead th { padding: 5px 6px; font-size: 8px; font-weight: 900; text-transform: uppercase; text-align: left; }
  tbody tr { border-bottom: 1px solid #ddd; }
  tbody tr:nth-child(even) { background: #f9f9f9; }
  tbody tr.row-delayed { background: #fff0f0 !important; }
  td { padding: 4px 6px; font-size: 8.5px; vertical-align: middle; }
  td.text-center { text-align: center; }
  td.mono { font-family: monospace; }
  td.small { font-size: 7.5px; }
  .text-delayed { color: #dc2626; font-weight: 900; }
  .footer { margin-top: 12px; font-size: 7px; color: #888; text-align: right; border-top: 1px solid #ddd; padding-top: 5px; }
  @media print { body { padding: 8px; } @page { margin: 12mm; size: landscape; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Herramientas Pendientes de Retorno</h1>
    <p>Sistema de Gestión de Herramientas · MGH-109 · Envío a Calibración</p>
  </div>
  <div class="header-right">
    <div class="label">Total pendientes</div>
    <div class="value">${pendientes.length}</div>
    <div class="label" style="margin-top:4px">Generado</div>
    <div class="value" style="font-size:8px">${now}</div>
  </div>
</div>
<div class="filter-bar">
  <span>Herramientas enviadas y NO retornadas al ${now}</span>
  <span>Retrasadas: ${pendientes.filter(c => this.isRetrasado(c)).length}</span>
</div>
<table>
  <thead>
    <tr>
      <th style="width:24px">#</th>
      <th style="width:80px">Código</th>
      <th style="width:85px">P/N</th>
      <th>Herramienta</th>
      <th style="width:80px">Ubicación</th>
      <th style="width:100px">Empresa</th>
      <th style="width:80px">N° Nota</th>
      <th style="width:70px">Envío</th>
      <th style="width:90px">Ret. Estimado</th>
      <th style="width:50px">Base</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Documento generado el ${now} · Sistema Herramientas</div>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=1100,height=750');
        if (win) {
            win.document.write(html);
            win.document.close();
            setTimeout(() => win.print(), 500);
        }
    }

    // ── Actions ──────────────────────────────────
    async nuevoEnvio(): Promise<void> {
        try {
            const { FormEnvioComponent } = await import('./form-envio/form-envio.component');
            const ref = this.dialog.open(FormEnvioComponent, {
                width: '900px', maxWidth: '98vw', height: '88vh',
                panelClass: 'no-padding-dialog',
                disableClose: false
            });
            ref.afterClosed().subscribe(ok => {
                if (ok) { this.loadCalibraciones(); this.showMsg('Envío registrado exitosamente', 'success'); }
            });
        } catch (error) {
            console.error('Error loading form component:', error);
            this.showMsg('Error al abrir el formulario de envío', 'error');
        }
    }

    async verDetalles(cal: CalibrationDisplay): Promise<void> {
        try {
            const { DetalleEnvioComponent } = await import('./detalle-envio/detalle-envio.component');
            this.dialog.open(DetalleEnvioComponent, {
                width: '600px', maxWidth: '95vw',
                panelClass: 'no-padding-dialog',
                data: { calibracion: cal }
            });
        } catch (error) {
            console.error('Error al cargar modal de detalles:', error);
            this.showMsg('Error al abrir detalles', 'error');
        }
    }

    async anularEnvio(cal: CalibrationDisplay): Promise<void> {
        try {
            const { AnularEnvioComponent } = await import('./anular-envio/anular-envio.component');
            const ref = this.dialog.open(AnularEnvioComponent, {
                width: '500px', panelClass: 'no-padding-dialog',
                disableClose: true, data: { calibracion: cal }
            });
            ref.afterClosed().subscribe(reason => {
                if (!reason) return;
                this.isLoading.set(true);
                this.calibrationService.cancelCalibration(cal.id_calibration.toString(), reason).subscribe({
                    next: () => { this.showMsg(`Envío ${cal.record_number} anulado`, 'success'); this.loadCalibraciones(); },
                    error: (err) => {
                        console.error('Error anulando:', err);
                        this.showMsg(err.message || 'Error al anular el envío', 'error');
                        this.isLoading.set(false);
                    }
                });
            });
        } catch (error) {
            console.error('Error al cargar modal de anulación:', error);
            this.showMsg('Error al abrir modal de anulación', 'error');
        }
    }

    printNota(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) { this.showMsg('ID de calibración no válido', 'error'); return; }
        this.isLoading.set(true);
        this.calibrationService.generarYVerPdfEnvio(cal.id_calibration);
        setTimeout(() => this.isLoading.set(false), 1500);
    }

    verEnvio(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) { this.showMsg('ID de calibración no válido', 'error'); return; }
        this.isLoading.set(true);
        this.calibrationService.generarYVerPdfEnvio(cal.id_calibration);
        setTimeout(() => this.isLoading.set(false), 1500);
    }

    verRetorno(cal: CalibrationDisplay): void {
        if (!cal.has_certificate_file) { this.showMsg('No se adjuntó un certificado en este retorno', 'warning'); return; }
        this.isLoading.set(true);
        this.calibrationService.getCertificateFile(cal.id_calibration).subscribe({
            next: (dataUrl) => {
                this.isLoading.set(false);
                if (!dataUrl) { this.showMsg('No se encontró el certificado adjunto', 'warning'); return; }
                try {
                    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                    const bytes  = atob(base64);
                    const arr    = new Uint8Array(bytes.length);
                    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                    const blob = new Blob([arr], { type: 'application/pdf' });
                    const url  = window.URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => window.URL.revokeObjectURL(url), 300);
                } catch (e) {
                    console.error('Error abriendo certificado:', e);
                    this.showMsg('No se pudo abrir el certificado adjunto', 'error');
                }
            },
            error: () => { this.isLoading.set(false); this.showMsg('Error al obtener el certificado', 'error'); }
        });
    }

    descargarNotaPdf(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) { this.showMsg('ID de calibración no válido', 'error'); return; }
        this.isLoading.set(true);
        this.calibrationService.generarPdfEnvioCalibracion(cal.id_calibration).subscribe({
            next: (result) => {
                this._downloadBlob(result.pdf_base64, result.nombre_archivo);
                this.isLoading.set(false);
                this.showMsg('Documento descargado correctamente', 'success');
            },
            error: (error) => {
                console.error('Error al descargar documento:', error);
                this.isLoading.set(false);
                this.showMsg('Error al generar el documento', 'error');
            }
        });
    }

    descargarCertificadoPdf(cal: CalibrationDisplay): void {
        if (!cal.id_calibration) { this.showMsg('ID de calibración no válido', 'error'); return; }
        this.isLoading.set(true);
        this.calibrationService.generarPdfRetornoCalibracion(cal.id_calibration).subscribe({
            next: (result) => {
                this._downloadBlob(result.pdf_base64, result.nombre_archivo);
                this.isLoading.set(false);
                this.showMsg('Documento descargado correctamente', 'success');
            },
            error: (error) => {
                console.error('Error al descargar documento:', error);
                this.isLoading.set(false);
                this.showMsg('Error al generar el documento', 'error');
            }
        });
    }

    private _downloadBlob(base64: string, filename: string): void {
        const bytes  = atob(base64);
        const arr    = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const isHtml = filename.toLowerCase().endsWith('.html');
        const blob   = new Blob([arr], { type: isHtml ? 'text/html' : 'application/pdf' });
        const url    = window.URL.createObjectURL(blob);
        const a      = document.createElement('a');
        a.href = url; a.download = filename.replace(/[/\\]/g, '-'); a.click();
        window.URL.revokeObjectURL(url);
    }

    volver(): void { this.router.navigate(['/administration']); }

    private showMsg(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: type === 'error' ? 5000 : 3000,
            horizontalPosition: 'end', verticalPosition: 'top',
            panelClass: [`snackbar-${type}`],
        });
    }
}
