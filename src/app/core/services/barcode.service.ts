import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap } from 'rxjs';
import { ErpApiService } from '../api/api.service';
import { BarcodeRequest, BarcodeResponse, BarcodeFormat, GeneratedBarcode } from '../models';

@Injectable({ providedIn: 'root' })
export class BarcodeService {
    private _api = inject(ErpApiService);

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Generate barcodes for multiple tools
     */
    generateBarcodes(request: BarcodeRequest): Observable<BarcodeResponse> {
        return from(this._api.post('herramientas/Utilidades/generarCodigosBarras', request)).pipe(
            switchMap((response: any) => {
                if (response?.success) {
                    return of({
                        success: true,
                        fileUrl: response.datos?.fileUrl,
                        fileName: response.datos?.fileName,
                        barcodes: response.datos?.barcodes || [],
                    } as BarcodeResponse);
                }
                return of({
                    success: false,
                    error: response?.message || 'Error al generar códigos de barras',
                } as BarcodeResponse);
            })
        );
    }

    /**
     * Generate barcode for a single tool
     */
    generateSingleBarcode(
        toolId: string,
        toolCode: string,
        format: BarcodeFormat = 'CODE128'
    ): Observable<GeneratedBarcode> {
        return from(this._api.post('herramientas/Utilidades/generarCodigoBarras', {
            id_herramienta: toolId,
            codigo: toolCode,
            formato: format,
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Download barcodes as PDF
     */
    downloadBarcodes(request: BarcodeRequest): Observable<BarcodeResponse> {
        return from(this._api.post('herramientas/Utilidades/descargarCodigosBarras', request)).pipe(
            switchMap((response: any) => {
                if (response?.success) {
                    return of({
                        success: true,
                        fileUrl: response.datos?.fileUrl,
                        fileName: response.datos?.fileName,
                    } as BarcodeResponse);
                }
                return of({
                    success: false,
                    error: response?.message || 'Error al descargar códigos de barras',
                } as BarcodeResponse);
            })
        );
    }

    /**
     * Print barcodes
     */
    printBarcodes(request: BarcodeRequest): Observable<BarcodeResponse> {
        return from(this._api.post('herramientas/Utilidades/imprimirCodigosBarras', request)).pipe(
            switchMap((response: any) => {
                if (response?.success) {
                    return of({
                        success: true,
                        fileUrl: response.datos?.printUrl,
                    } as BarcodeResponse);
                }
                return of({
                    success: false,
                    error: response?.message || 'Error al imprimir códigos de barras',
                } as BarcodeResponse);
            })
        );
    }

    /**
     * Validate barcode format
     */
    validateBarcodeFormat(code: string, format: BarcodeFormat): boolean {
        const formatRegex: Record<BarcodeFormat, RegExp> = {
            CODE128: /^[\x00-\x7F]+$/,
            CODE39: /^[0-9A-Z\-\.\ \$\/\+\%]+$/,
            EAN13: /^[0-9]{13}$/,
            QR: /^.+$/,
            DATAMATRIX: /^.+$/,
            PDF417: /^.+$/,
        };

        return formatRegex[format]?.test(code) ?? false;
    }

    /**
     * Get available barcode formats
     */
    getAvailableFormats(): BarcodeFormat[] {
        return ['CODE128', 'CODE39', 'EAN13', 'QR', 'DATAMATRIX', 'PDF417'];
    }

    /**
     * Get recommended format for a code
     */
    getRecommendedFormat(code: string): BarcodeFormat {
        if (/^[0-9]{13}$/.test(code)) {
            return 'EAN13';
        }
        if (/^[0-9A-Z\-\.\ \$\/\+\%]+$/.test(code)) {
            return 'CODE39';
        }
        if (code.length > 100) {
            return 'QR';
        }
        return 'CODE128';
    }
}
