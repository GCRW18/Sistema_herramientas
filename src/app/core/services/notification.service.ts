import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private _snackBar = inject(MatSnackBar);

    private readonly defaultConfig: MatSnackBarConfig = {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top',
    };

    /**
     * Show success message
     */
    success(message: string, duration: number = 3000): void {
        this._snackBar.open(message, '✓', {
            ...this.defaultConfig,
            duration,
            panelClass: ['success-snackbar'],
        });
    }

    /**
     * Show error message
     */
    error(message: string, duration: number = 5000): void {
        this._snackBar.open(message, '✕', {
            ...this.defaultConfig,
            duration,
            panelClass: ['error-snackbar'],
        });
    }

    /**
     * Show warning message
     */
    warning(message: string, duration: number = 4000): void {
        this._snackBar.open(message, '⚠', {
            ...this.defaultConfig,
            duration,
            panelClass: ['warning-snackbar'],
        });
    }

    /**
     * Show info message
     */
    info(message: string, duration: number = 3000): void {
        this._snackBar.open(message, 'ℹ', {
            ...this.defaultConfig,
            duration,
            panelClass: ['info-snackbar'],
        });
    }
}
