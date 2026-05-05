import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule }                                  from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule }                                  from '@angular/material/icon';
import { MatProgressSpinnerModule }                       from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule }                 from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl }                  from '@angular/platform-browser';
import { CalibrationService }                             from '../../../../../core/services/calibration.service';

export interface PdfViewerData {
    tipo:           'envio' | 'retorno';
    id_calibration: number;
    record_number?: string;
}

@Component({
    selector: 'app-pdf-viewer-dialog',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule],
    template: `
<div class="flex flex-col bg-gray-100 dark:bg-slate-900 border-[3px] border-black rounded-2xl
            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden" style="width:860px;max-width:95vw;height:88vh">

    <!-- Header -->
    <div class="bg-[#0F172AFF] text-white px-4 py-2.5 border-b-[3px] border-black flex justify-between items-center shrink-0">
        <h2 class="text-sm font-black uppercase flex items-center gap-2">
            <mat-icon class="text-amber-400 !text-lg">picture_as_pdf</mat-icon>
            {{ data.tipo === 'envio' ? 'NOTA DE ENVÍO A CALIBRACIÓN' : 'CERTIFICADO DE RETORNO' }}
            <span *ngIf="data.record_number" class="font-mono text-amber-300 text-xs normal-case">— {{ data.record_number }}</span>
        </h2>
        <div class="flex items-center gap-2">
            <button (click)="descargar()" [disabled]="isLoading() || !!errorMsg()"
                    class="px-3 py-1 bg-green-600 text-white font-black text-[10px] border-2 border-black rounded
                           shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px]
                           hover:shadow-none transition-all uppercase flex items-center gap-1 disabled:opacity-40">
                <mat-icon class="!text-xs">download</mat-icon>
                <span class="hidden sm:inline">Descargar</span>
            </button>
            <button (click)="dialogRef.close()"
                    class="px-3 py-1 bg-[#FF1414FF] text-white font-black text-[10px] border-2 border-black rounded
                           shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px]
                           hover:shadow-none transition-all uppercase">
                Cerrar
            </button>
        </div>
    </div>

    <!-- Loading -->
    <div *ngIf="isLoading()" class="flex-1 flex items-center justify-center bg-white dark:bg-slate-800">
        <div class="flex flex-col items-center gap-3">
            <mat-spinner diameter="40"></mat-spinner>
            <p class="text-xs font-black uppercase text-gray-500 dark:text-gray-400 animate-pulse">Generando documento...</p>
        </div>
    </div>

    <!-- Error -->
    <div *ngIf="!isLoading() && errorMsg()" class="flex-1 flex items-center justify-center bg-white dark:bg-slate-800 p-8">
        <div class="flex flex-col items-center gap-3 text-center">
            <mat-icon class="!text-5xl text-red-400">error_outline</mat-icon>
            <p class="text-sm font-black text-red-600 uppercase">Error al generar PDF</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 max-w-xs">{{ errorMsg() }}</p>
            <button (click)="loadPdf()"
                    class="mt-2 px-4 py-2 bg-black text-white font-black text-xs border-2 border-black rounded
                           shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px]
                           hover:shadow-none transition-all uppercase flex items-center gap-1">
                <mat-icon class="!text-sm">refresh</mat-icon> Reintentar
            </button>
        </div>
    </div>

    <!-- PDF iframe -->
    <div *ngIf="!isLoading() && !errorMsg() && pdfUrl()" class="flex-1 overflow-hidden bg-gray-300 dark:bg-slate-700 p-2">
        <iframe [src]="pdfUrl()!"
                class="w-full h-full rounded border-2 border-black"
                title="Visor PDF"
                frameborder="0">
        </iframe>
    </div>
</div>
    `,
    styles: [`
        :host { display: block; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    `]
})
export class PdfViewerDialogComponent implements OnInit, OnDestroy {

    dialogRef  = inject(MatDialogRef<PdfViewerDialogComponent>);
    data       = inject<PdfViewerData>(MAT_DIALOG_DATA);

    private calibrationService = inject(CalibrationService);
    private sanitizer          = inject(DomSanitizer);
    private snackBar           = inject(MatSnackBar);

    isLoading = signal(true);
    errorMsg  = signal<string | null>(null);
    pdfUrl    = signal<SafeResourceUrl | null>(null);

    private _blobUrl:   string | null = null;
    private _pdfBase64: string | null = null;
    private _fileName:  string | null = null;

    ngOnInit(): void { this.loadPdf(); }

    ngOnDestroy(): void {
        if (this._blobUrl) window.URL.revokeObjectURL(this._blobUrl);
    }

    loadPdf(): void {
        this.isLoading.set(true);
        this.errorMsg.set(null);
        this.pdfUrl.set(null);
        if (this._blobUrl) { window.URL.revokeObjectURL(this._blobUrl); this._blobUrl = null; }

        const obs = this.data.tipo === 'envio'
            ? this.calibrationService.generarPdfEnvioCalibracion(this.data.id_calibration)
            : this.calibrationService.generarPdfRetornoCalibracion(this.data.id_calibration);

        obs.subscribe({
            next: (result) => {
                this._pdfBase64 = result.pdf_base64;
                this._fileName  = result.nombre_archivo;
                this._blobUrl   = this._toBlobUrl(result.pdf_base64);
                this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this._blobUrl));
                this.isLoading.set(false);
            },
            error: (err) => {
                this.errorMsg.set(err?.message || 'Error al generar el PDF');
                this.isLoading.set(false);
            }
        });
    }

    descargar(): void {
        if (!this._pdfBase64 || !this._fileName) return;
        const url = this._toBlobUrl(this._pdfBase64);
        const a   = document.createElement('a');
        a.href = url; a.download = (this._fileName ?? '').replace(/[/\\]/g, '-'); a.click();
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
        this.snackBar.open('PDF descargado', 'Ok', {
            duration: 2500, horizontalPosition: 'end', verticalPosition: 'top'
        });
    }

    private _toBlobUrl(base64: string, fileName?: string): string {
        const bytes = atob(base64);
        const arr   = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const name  = (fileName ?? this._fileName ?? '').toLowerCase();
        const mime  = name.endsWith('.html') ? 'text/html' : 'application/pdf';
        return window.URL.createObjectURL(new Blob([arr], { type: mime }));
    }
}
