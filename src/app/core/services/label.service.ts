import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap } from 'rxjs';
import { ErpApiService } from '../api/api.service';
import { LabelRequest, LabelResponse, LabelGenerationOptions, GeneratedLabel } from '../models';

@Injectable({ providedIn: 'root' })
export class LabelService {
    private _api = inject(ErpApiService);

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Generate labels for multiple tools
     */
    generateLabels(request: LabelRequest): Observable<LabelResponse> {
        return from(this._api.post('herramientas/Utilidades/generarEtiquetas', request)).pipe(
            switchMap((response: any) => {
                if (response?.success) {
                    return of({
                        success: true,
                        fileUrl: response.datos?.fileUrl,
                        fileName: response.datos?.fileName,
                        labels: response.datos?.labels || [],
                    } as LabelResponse);
                }
                return of({
                    success: false,
                    error: response?.message || 'Error al generar etiquetas',
                } as LabelResponse);
            })
        );
    }

    /**
     * Generate label for a single tool
     */
    generateSingleLabel(
        toolId: string,
        options: LabelGenerationOptions
    ): Observable<GeneratedLabel> {
        return from(this._api.post('herramientas/Utilidades/generarEtiqueta', {
            tool_id: toolId,
            opciones: options,
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Download labels as PDF
     */
    downloadLabels(request: LabelRequest): Observable<LabelResponse> {
        return from(this._api.post('herramientas/Utilidades/descargarEtiquetas', request)).pipe(
            switchMap((response: any) => {
                if (response?.success) {
                    return of({
                        success: true,
                        fileUrl: response.datos?.fileUrl,
                        fileName: response.datos?.fileName,
                    } as LabelResponse);
                }
                return of({
                    success: false,
                    error: response?.message || 'Error al descargar etiquetas',
                } as LabelResponse);
            })
        );
    }

    /**
     * Print labels
     */
    printLabels(request: LabelRequest): Observable<LabelResponse> {
        return from(this._api.post('herramientas/Utilidades/imprimirEtiquetas', request)).pipe(
            switchMap((response: any) => {
                if (response?.success) {
                    return of({
                        success: true,
                        fileUrl: response.datos?.printUrl,
                    } as LabelResponse);
                }
                return of({
                    success: false,
                    error: response?.message || 'Error al imprimir etiquetas',
                } as LabelResponse);
            })
        );
    }

    /**
     * Get available label templates
     */
    getAvailableTemplates() {
        return [
            {
                value: 'standard',
                label: 'Estándar',
                description: 'Código + Nombre + Categoría',
                previewImage: '/assets/templates/standard.png',
            },
            {
                value: 'detailed',
                label: 'Detallada',
                description: 'Incluye ubicación y estado',
                previewImage: '/assets/templates/detailed.png',
            },
            {
                value: 'compact',
                label: 'Compacta',
                description: 'Solo código y nombre',
                previewImage: '/assets/templates/compact.png',
            },
            {
                value: 'qr',
                label: 'QR Code',
                description: 'Con código QR grande',
                previewImage: '/assets/templates/qr.png',
            },
        ];
    }

    /**
     * Get available label sizes
     */
    getAvailableSizes() {
        return [
            { value: 'small', label: 'Pequeña (40x20mm)', width: 40, height: 20 },
            { value: 'medium', label: 'Mediana (60x30mm)', width: 60, height: 30 },
            { value: 'large', label: 'Grande (80x40mm)', width: 80, height: 40 },
        ];
    }

    /**
     * Preview label with options
     */
    previewLabel(options: LabelGenerationOptions): Observable<string> {
        return from(this._api.post('herramientas/Utilidades/previsualizarEtiqueta', {
            opciones: options,
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.previewUrl || '');
            })
        );
    }

    /**
     * Validate label options
     */
    validateLabelOptions(options: LabelGenerationOptions): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!options.template) {
            errors.push('La plantilla es requerida');
        }

        if (!options.size) {
            errors.push('El tamaño es requerido');
        }

        if (options.template === 'qr' && !options.includeQR) {
            errors.push('La plantilla QR requiere incluir código QR');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}
