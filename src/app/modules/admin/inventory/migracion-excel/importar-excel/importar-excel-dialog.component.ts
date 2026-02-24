import { Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { MigrationService } from '../../../../../core/services/migration.service';

interface ExcelRow {
    cod_he: string;
    nombre: string;
    part_numbert: string;
    serial_numbert: string;
    marca: string;
    tipo: string;
    subtipo: string;
    ubicacion: string;
    requiere_calibracion: string;
    [key: string]: any;
}

@Component({
    selector: 'app-importar-excel-dialog',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatIconModule, MatButtonModule,
        MatDialogModule, MatSnackBarModule, MatProgressSpinnerModule,
        MatProgressBarModule, MatTableModule, MatTooltipModule
    ],
    template: `
        <div class="flex flex-col h-full bg-white dark:bg-[#0F172AFF] font-sans">

            <!-- Header -->
            <div class="flex items-center justify-between p-5 border-b-3 border-black">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-green-600 border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_#000] flex items-center justify-center">
                        <mat-icon class="text-white !text-xl">upload_file</mat-icon>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-black dark:text-white uppercase tracking-tight">
                            Importar Archivo Excel
                        </h2>
                        <p class="text-xs font-bold text-gray-500">Cargar datos desde .xlsx al staging de migracion</p>
                    </div>
                </div>
                <button mat-dialog-close
                        class="w-9 h-9 bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:bg-gray-100 flex items-center justify-center transition-all active:shadow-none active:translate-x-[1px] active:translate-y-[1px]">
                    <mat-icon class="!text-lg">close</mat-icon>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto p-5">

                <!-- Step 1: File Drop Zone -->
                @if (!parsedRows.length) {
                    <div class="flex flex-col items-center justify-center py-16 border-3 border-dashed border-gray-400 rounded-xl bg-gray-50 dark:bg-gray-800 cursor-pointer hover:border-[#FF6A00FF] hover:bg-orange-50 dark:hover:bg-gray-700 transition-all"
                         (click)="fileInput.click()"
                         (dragover)="onDragOver($event)"
                         (drop)="onDrop($event)">
                        <mat-icon class="!text-7xl text-gray-400 mb-4">cloud_upload</mat-icon>
                        <p class="text-lg font-black text-gray-500 uppercase">Arrastre un archivo Excel aqui</p>
                        <p class="text-sm text-gray-400 mt-1">o haga click para seleccionar</p>
                        <p class="text-xs text-gray-400 mt-3">Formatos aceptados: .xlsx, .xls</p>
                        <input #fileInput type="file" accept=".xlsx,.xls" class="hidden" (change)="onFileSelected($event)">
                    </div>

                    <!-- Expected Format -->
                    <div class="mt-4 bg-blue-50 border-2 border-black rounded-xl p-4 shadow-[2px_2px_0px_0px_#000]">
                        <p class="text-xs font-black uppercase text-blue-800 mb-2">Formato esperado del Excel</p>
                        <div class="overflow-x-auto">
                            <table class="text-[10px] border border-black w-full">
                                <thead>
                                    <tr class="bg-blue-100">
                                        @for (col of expectedColumns; track col) {
                                            <th class="border border-black px-2 py-1 font-black uppercase">{{ col }}</th>
                                        }
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        @for (col of expectedColumns; track col) {
                                            <td class="border border-black px-2 py-1 text-gray-500 italic">dato...</td>
                                        }
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                }

                <!-- Step 2: Preview parsed data -->
                @if (parsedRows.length > 0 && !isUploading()) {
                    <div class="flex flex-col gap-4">
                        <!-- File info -->
                        <div class="flex items-center justify-between bg-green-50 border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#000]">
                            <div class="flex items-center gap-2">
                                <mat-icon class="text-green-600">check_circle</mat-icon>
                                <div>
                                    <p class="text-sm font-black text-green-800">{{ fileName }}</p>
                                    <p class="text-xs text-green-600">{{ parsedRows.length }} registros encontrados</p>
                                </div>
                            </div>
                            <button (click)="clearFile()"
                                    class="px-3 py-1 bg-white text-black font-bold text-xs border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#000] transition-all uppercase">
                                Cambiar archivo
                            </button>
                        </div>

                        <!-- Preview table (first 10 rows) -->
                        <p class="text-xs font-black uppercase text-gray-600">Vista previa (primeros {{ previewRows.length }} registros)</p>
                        <div class="overflow-x-auto border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] bg-white dark:bg-gray-900">
                            <table mat-table [dataSource]="previewRows" class="w-full">
                                @for (col of previewColumns; track col) {
                                    <ng-container [matColumnDef]="col">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-[10px] !uppercase !bg-gray-100 dark:!bg-gray-800">{{ col }}</th>
                                        <td mat-cell *matCellDef="let row" class="!text-xs max-w-[150px] truncate" [matTooltip]="row[col]">{{ row[col] || '-' }}</td>
                                    </ng-container>
                                }
                                <tr mat-header-row *matHeaderRowDef="previewColumns"></tr>
                                <tr mat-row *matRowDef="let row; columns: previewColumns;" class="hover:bg-gray-50 transition-colors"></tr>
                            </table>
                        </div>
                        @if (parsedRows.length > 10) {
                            <p class="text-xs text-gray-400 text-center">... y {{ parsedRows.length - 10 }} registros mas</p>
                        }
                    </div>
                }

                <!-- Uploading progress -->
                @if (isUploading()) {
                    <div class="flex flex-col items-center justify-center py-16 gap-4">
                        <mat-spinner [diameter]="48"></mat-spinner>
                        <p class="text-sm font-black uppercase text-gray-600">Insertando registros en staging...</p>
                        <mat-progress-bar mode="determinate" [value]="uploadProgress()" class="w-full max-w-md rounded-full"></mat-progress-bar>
                        <p class="text-xs text-gray-500">{{ uploadedCount() }} de {{ parsedRows.length }} registros</p>
                    </div>
                }
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end gap-3 p-5 border-t-3 border-black">
                <button mat-dialog-close
                        class="px-4 py-2 bg-gray-200 text-black font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase">
                    Cancelar
                </button>
                @if (parsedRows.length > 0 && !isUploading()) {
                    <button (click)="uploadToStaging()"
                            class="px-5 py-2 bg-green-600 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2">
                        <mat-icon class="text-white !h-5 !text-lg">cloud_upload</mat-icon>
                        Cargar {{ parsedRows.length }} Registros
                    </button>
                }
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; height: 100%; }
        .border-3 { border-width: 3px; }
    `]
})
export class ImportarExcelDialogComponent implements OnDestroy {
    private migrationService = inject(MigrationService);
    private dialogRef = inject(MatDialogRef<ImportarExcelDialogComponent>);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    // Signals
    isUploading = signal(false);
    uploadProgress = signal(0);
    uploadedCount = signal(0);

    // State
    fileName = '';
    parsedRows: ExcelRow[] = [];
    previewRows: ExcelRow[] = [];
    previewColumns = ['cod_he', 'nombre', 'tipo', 'marca', 'ubicacion', 'requiere_calibracion'];

    expectedColumns = [
        'cod_he', 'nombre', 'part_numbert', 'serial_numbert', 'cod_boa_af',
        'marca', 'tipo', 'subtipo', 'lista_contenido', 'requiere_calibracion',
        'intervalo_calibracion', 'fecha_vencimiento', 'precio_unitario',
        'precio_venta', 'usuario', 'ubicacion', 'nivel', 'fabricacion', 'observaciones'
    ];

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            this.processFile(files[0]);
        }
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.processFile(input.files[0]);
        }
    }

    async processFile(file: File): Promise<void> {
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            this.showMessage('Solo se aceptan archivos .xlsx o .xls', 'error');
            return;
        }

        this.fileName = file.name;

        try {
            // Dynamic import of xlsx library
            const XLSX = await import('xlsx' as any);
            const data = await file.arrayBuffer();
            const workbook = (XLSX as any).read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: any[] = (XLSX as any).utils.sheet_to_json(worksheet, { defval: '' });

            if (jsonData.length === 0) {
                this.showMessage('El archivo no contiene datos', 'warning');
                return;
            }

            // Map column names (handle variations)
            this.parsedRows = jsonData.map((row: any) => this.mapRow(row));
            this.previewRows = this.parsedRows.slice(0, 10);
            this.showMessage(`${this.parsedRows.length} registros leidos del archivo`, 'success');

        } catch (error) {
            this.showMessage('Error al leer el archivo Excel. Verifique el formato.', 'error');
            console.error('Excel parse error:', error);
        }
    }

    private mapRow(row: any): ExcelRow {
        // Try to match columns by common name variations
        const getValue = (keys: string[]): string => {
            for (const key of keys) {
                const found = Object.keys(row).find(k =>
                    k.toLowerCase().replace(/[_\s.-]/g, '') === key.toLowerCase().replace(/[_\s.-]/g, '')
                );
                if (found && row[found] !== undefined) return String(row[found]);
            }
            return '';
        };

        return {
            cod_he: getValue(['cod_he', 'codigo', 'codigo_he', 'code']),
            nombre: getValue(['nombre', 'name', 'descripcion', 'description']),
            part_numbert: getValue(['part_numbert', 'part_number', 'partnumber', 'pn']),
            serial_numbert: getValue(['serial_numbert', 'serial_number', 'serialnumber', 'sn']),
            cod_boa_af: getValue(['cod_boa_af', 'codboaaf', 'boa']),
            marca: getValue(['marca', 'brand', 'fabricante']),
            tipo: getValue(['tipo', 'type', 'categoria']),
            subtipo: getValue(['subtipo', 'subtype', 'subcategoria']),
            lista_contenido: getValue(['lista_contenido', 'contenido', 'content']),
            requiere_calibracion: getValue(['requiere_calibracion', 'calibracion', 'calibration']),
            intervalo_calibracion: getValue(['intervalo_calibracion', 'intervalo', 'interval']),
            fecha_vencimiento: getValue(['fecha_vencimiento', 'vencimiento', 'expiry']),
            precio_unitario: getValue(['precio_unitario', 'precio', 'price']),
            precio_venta: getValue(['precio_venta', 'venta', 'sale_price']),
            usuario: getValue(['usuario', 'user', 'responsable']),
            ubicacion: getValue(['ubicacion', 'location', 'almacen']),
            nivel: getValue(['nivel', 'level']),
            fabricacion: getValue(['fabricacion', 'manufacturing', 'origin']),
            observaciones: getValue(['observaciones', 'observations', 'notas', 'notes'])
        };
    }

    clearFile(): void {
        this.parsedRows = [];
        this.previewRows = [];
        this.fileName = '';
    }

    async uploadToStaging(): Promise<void> {
        this.isUploading.set(true);
        this.uploadedCount.set(0);
        this.uploadProgress.set(0);

        const batchSize = 20;
        const total = this.parsedRows.length;
        let uploaded = 0;
        let errors = 0;

        for (let i = 0; i < total; i += batchSize) {
            const batch = this.parsedRows.slice(i, i + batchSize);

            for (const row of batch) {
                try {
                    await new Promise<void>((resolve, reject) => {
                        this.migrationService.insertProductoExcel(row as any).pipe(
                            takeUntil(this._unsubscribeAll)
                        ).subscribe({
                            next: () => resolve(),
                            error: () => { errors++; resolve(); }
                        });
                    });
                } catch {
                    errors++;
                }
                uploaded++;
                this.uploadedCount.set(uploaded);
                this.uploadProgress.set(Math.round((uploaded / total) * 100));
            }
        }

        this.isUploading.set(false);

        if (errors > 0) {
            this.showMessage(`Carga completada: ${uploaded - errors} exitosos, ${errors} con error`, 'warning');
        } else {
            this.showMessage(`${uploaded} registros cargados exitosamente al staging`, 'success');
        }

        this.dialogRef.close({ success: true, total: uploaded, errors });
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        });
    }
}
