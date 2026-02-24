import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

/**
 * BarcodeScannerService
 *
 * Detecta escaneos de código de barras desde dispositivos Motorola Symbol
 * que actúan como keyboard wedge (envían caracteres como teclado).
 *
 * Diferencia escaneo vs escritura humana por velocidad:
 * - Escáner: <50ms entre teclas
 * - Humano: >50ms entre teclas
 *
 * Al detectar Enter con buffer de >=3 caracteres rápidos, emite el código.
 */
@Injectable({ providedIn: 'root' })
export class BarcodeScannerService {
    private ngZone = inject(NgZone);

    private _scanned$ = new Subject<string>();
    private _isActive$ = new BehaviorSubject<boolean>(false);

    private buffer: string[] = [];
    private lastKeyTime = 0;
    private readonly THRESHOLD_MS = 50;
    private readonly MIN_LENGTH = 3;
    private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

    /** Observable que emite el código escaneado */
    get scanned$(): Observable<string> {
        return this._scanned$.asObservable();
    }

    /** Observable que indica si el scanner está activo */
    get isActive$(): Observable<boolean> {
        return this._isActive$.asObservable();
    }

    /** Activa la escucha de escaneos */
    enable(): void {
        if (this.keydownHandler) return;

        this.ngZone.runOutsideAngular(() => {
            this.keydownHandler = (event: KeyboardEvent) => this.handleKeydown(event);
            document.addEventListener('keydown', this.keydownHandler, true);
        });

        this._isActive$.next(true);
    }

    /** Desactiva la escucha de escaneos */
    disable(): void {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler, true);
            this.keydownHandler = null;
        }
        this.buffer = [];
        this.lastKeyTime = 0;
        this._isActive$.next(false);
    }

    private handleKeydown(event: KeyboardEvent): void {
        const now = Date.now();
        const timeDiff = now - this.lastKeyTime;

        if (event.key === 'Enter') {
            if (this.buffer.length >= this.MIN_LENGTH) {
                const code = this.buffer.join('');
                event.preventDefault();
                event.stopPropagation();

                this.ngZone.run(() => {
                    this._scanned$.next(code);
                });
            }
            this.buffer = [];
            this.lastKeyTime = 0;
            return;
        }

        // Ignorar teclas de control
        if (event.key.length !== 1) {
            return;
        }

        if (timeDiff < this.THRESHOLD_MS || this.buffer.length === 0) {
            this.buffer.push(event.key);
        } else {
            // Demasiado lento → reiniciar buffer con esta tecla
            this.buffer = [event.key];
        }

        this.lastKeyTime = now;
    }
}
