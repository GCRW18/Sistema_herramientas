import { Injectable, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

export interface MinimizedDialog {
    id: string;
    title: string;
    icon: string;
    status: 'draft' | 'in-progress' | 'completed';
    dialogRef: MatDialogRef<any>;
    data?: any;
}

@Injectable({
    providedIn: 'root'
})
export class MinimizedDialogsService {
    private minimizedDialogs = signal<MinimizedDialog[]>([]);

    getMinimizedDialogs() {
        return this.minimizedDialogs.asReadonly();
    }

    minimizeDialog(dialog: MinimizedDialog): void {
        const current = this.minimizedDialogs();

        // Check if dialog already exists
        const exists = current.find(d => d.id === dialog.id);
        if (!exists) {
            this.minimizedDialogs.set([...current, dialog]);

            // Hide the dialog but don't close it
            const dialogElement = dialog.dialogRef.componentInstance;
            if (dialogElement) {
                const overlayRef = (dialog.dialogRef as any)._overlayRef;
                if (overlayRef) {
                    overlayRef.hostElement.style.display = 'none';
                }
            }
        }
    }

    restoreDialog(dialogId: string): void {
        const current = this.minimizedDialogs();
        const dialog = current.find(d => d.id === dialogId);

        if (dialog) {
            // Show the dialog again
            const overlayRef = (dialog.dialogRef as any)._overlayRef;
            if (overlayRef) {
                overlayRef.hostElement.style.display = 'block';
            }

            // Remove from minimized list
            this.minimizedDialogs.set(current.filter(d => d.id !== dialogId));
        }
    }

    removeDialog(dialogId: string): void {
        const current = this.minimizedDialogs();
        const dialog = current.find(d => d.id === dialogId);

        if (dialog) {
            dialog.dialogRef.close();
            this.minimizedDialogs.set(current.filter(d => d.id !== dialogId));
        }
    }

    updateDialogStatus(dialogId: string, status: 'draft' | 'in-progress' | 'completed'): void {
        const current = this.minimizedDialogs();
        const updatedDialogs = current.map(d =>
            d.id === dialogId ? { ...d, status } : d
        );
        this.minimizedDialogs.set(updatedDialogs);
    }

    closeAll(): void {
        const current = this.minimizedDialogs();
        current.forEach(dialog => dialog.dialogRef.close());
        this.minimizedDialogs.set([]);
    }
}
