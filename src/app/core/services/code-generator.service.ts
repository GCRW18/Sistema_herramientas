import { Injectable, inject } from '@angular/core';
import { Observable, of, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';

/**
 * Servicio para generación automática de códigos
 * Basado en la lógica del sistema Excel
 */
@Injectable({
    providedIn: 'root'
})
export class CodeGeneratorService {
    private _httpClient = inject(HttpClient);

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Genera el próximo código de herramienta
     * Formato: BOA-H-XXXXX
     *
     * Ejemplo: Si el último código es BOA-H-83422, retorna BOA-H-83423
     */
    generateToolCode(): Observable<string> {
        return this._httpClient.get<{ lastCode: string }>('api/tools/last-code').pipe(
            map(response => {
                if (!response.lastCode) {
                    // Si no hay códigos previos, empezar en BOA-H-00001
                    return 'BOA-H-00001';
                }

                // Extraer el número del código: BOA-H-83422 → 83422
                const match = response.lastCode.match(/BOA-H-(\d+)/);
                if (!match) {
                    return 'BOA-H-00001';
                }

                const lastNumber = parseInt(match[1], 10);
                const nextNumber = lastNumber + 1;

                // Formatear con padding de 5 dígitos
                const paddedNumber = nextNumber.toString().padStart(5, '0');

                return `BOA-H-${paddedNumber}`;
            })
        );
    }

    /**
     * Genera el próximo código de movimiento (comprobante)
     * Formatos:
     * - PR-X/YYYY (Préstamos/Salidas)
     * - DEV-X/YYYY (Devoluciones)
     * - ENT-X/YYYY (Entradas)
     *
     * El número se resetea cada año
     */
    generateMovementCode(type: 'PR' | 'DEV' | 'ENT'): Observable<string> {
        const currentYear = new Date().getFullYear();

        return this._httpClient.get<{ lastNumber: number }>(
            `api/movements/last-number`,
            { params: { type, year: currentYear.toString() } }
        ).pipe(
            map(response => {
                const nextNumber = (response.lastNumber || 0) + 1;
                return `${type}-${nextNumber}/${currentYear}`;
            })
        );
    }

    /**
     * Valida si un código de herramienta ya existe
     */
    validateToolCodeUnique(code: string, excludeId?: string): Observable<boolean> {
        return this._httpClient.get<{ exists: boolean }>(
            'api/tools/check-code',
            { params: { code, excludeId: excludeId || '' } }
        ).pipe(
            map(response => !response.exists) // Retorna true si NO existe (es único)
        );
    }

    /**
     * Valida si un número de licencia de empleado ya existe
     */
    validateLicenseNumberUnique(licenseNumber: string, excludeId?: string): Observable<boolean> {
        return this._httpClient.get<{ exists: boolean }>(
            'api/employees/check-license',
            { params: { licenseNumber, excludeId: excludeId || '' } }
        ).pipe(
            map(response => !response.exists)
        );
    }

    /**
     * Genera un código de activo fijo
     * Formato: AF-XXXX (Asset Fixed)
     */
    generateAssetCode(): Observable<string> {
        return this._httpClient.get<{ lastCode: string }>('api/assets/last-code').pipe(
            map(response => {
                if (!response.lastCode) {
                    return 'AF-0001';
                }

                const match = response.lastCode.match(/AF-(\d+)/);
                if (!match) {
                    return 'AF-0001';
                }

                const lastNumber = parseInt(match[1], 10);
                const nextNumber = lastNumber + 1;
                const paddedNumber = nextNumber.toString().padStart(4, '0');

                return `AF-${paddedNumber}`;
            })
        );
    }

    /**
     * Formatea un código existente para asegurar el formato correcto
     */
    formatToolCode(code: string): string {
        // Eliminar espacios y convertir a mayúsculas
        code = code.trim().toUpperCase();

        // Si ya tiene el formato correcto, retornar
        if (/^BOA-H-\d{5}$/.test(code)) {
            return code;
        }

        // Intentar extraer solo el número
        const match = code.match(/(\d+)/);
        if (match) {
            const number = parseInt(match[1], 10);
            const paddedNumber = number.toString().padStart(5, '0');
            return `BOA-H-${paddedNumber}`;
        }

        return code;
    }

    /**
     * Parsea un código de movimiento para extraer tipo, número y año
     */
    parseMovementCode(code: string): { type: string; number: number; year: number } | null {
        const match = code.match(/^(PR|DEV|ENT)-(\d+)\/(\d{4})$/);
        if (!match) {
            return null;
        }

        return {
            type: match[1],
            number: parseInt(match[2], 10),
            year: parseInt(match[3], 10)
        };
    }

    /**
     * Valida el formato de un código de herramienta
     */
    isValidToolCode(code: string): boolean {
        return /^BOA-H-\d{5}$/.test(code);
    }

    /**
     * Valida el formato de un código de movimiento
     */
    isValidMovementCode(code: string): boolean {
        return /^(PR|DEV|ENT)-\d+\/\d{4}$/.test(code);
    }
}
