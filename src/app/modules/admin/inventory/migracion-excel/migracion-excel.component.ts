import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { MigrationService } from '../../../../core/services/migration.service';
import { ProductoExcel, HerramientaObservado, MigrationSummary } from '../../../../core/models';

@Component({
    selector: 'app-migracion-excel',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatIconModule, MatButtonModule,
        MatTableModule, MatPaginatorModule, MatProgressSpinnerModule,
        MatProgressBarModule, MatTooltipModule, MatSnackBarModule,
        MatDialogModule, MatSelectModule, MatFormFieldModule,
        MatInputModule, MatChipsModule, MatTabsModule
    ],
    template: `
        <div class="flex flex-col gap-4 p-2">

            <!-- Header -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl md:text-3xl font-black text-black dark:text-white uppercase tracking-tight">
                        Migracion de Datos Excel
                    </h2>
                    <p class="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1">
                        Staging de productos desde Excel hacia tabla definitiva de herramientas
                    </p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button (click)="loadData()"
                            class="px-4 py-2 bg-gray-700 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2">
                        <mat-icon class="text-white !h-5 !text-lg">refresh</mat-icon>
                        Actualizar
                    </button>
                    <button (click)="openImportDialog()"
                            class="px-4 py-2 bg-green-600 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2">
                        <mat-icon class="text-white !h-5 !text-lg">upload_file</mat-icon>
                        Importar Excel
                    </button>
                    <button (click)="runValidation()"
                            [disabled]="migrationService.isLoading()"
                            class="px-4 py-2 bg-blue-600 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <mat-icon class="text-white !h-5 !text-lg">fact_check</mat-icon>
                        Validar Datos
                    </button>
                    <button (click)="runMigration()"
                            [disabled]="migrationService.isMigrating() || migrationService.pendingCount() === 0"
                            class="px-4 py-2 bg-[#FF6A00FF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] transition-all uppercase flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <mat-icon class="text-white !h-5 !text-lg">rocket_launch</mat-icon>
                        Ejecutar Migracion
                    </button>
                </div>
            </div>

            <!-- Progress Bar (during migration) -->
            @if (migrationService.isMigrating()) {
                <div class="border-3 border-black rounded-xl p-4 bg-amber-50 shadow-[3px_3px_0px_0px_#000]">
                    <div class="flex items-center gap-3 mb-2">
                        <mat-spinner [diameter]="24"></mat-spinner>
                        <span class="font-black text-amber-800 uppercase text-sm">Migracion en proceso...</span>
                    </div>
                    <mat-progress-bar mode="indeterminate" class="rounded-full"></mat-progress-bar>
                </div>
            }

            <!-- Summary Cards -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div class="bg-gray-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-gray-800">{{ summary()?.total_registros || 0 }}</p>
                    <p class="text-xs font-bold text-gray-600 uppercase">Total Registros</p>
                </div>
                <div class="bg-green-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-green-800">{{ summary()?.total_migrados || 0 }}</p>
                    <p class="text-xs font-bold text-green-600 uppercase">Migrados</p>
                </div>
                <div class="bg-blue-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-blue-800">{{ summary()?.total_pendientes || 0 }}</p>
                    <p class="text-xs font-bold text-blue-600 uppercase">Pendientes</p>
                </div>
                <div class="bg-red-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-red-800">{{ summary()?.total_observados || 0 }}</p>
                    <p class="text-xs font-bold text-red-600 uppercase">Observados</p>
                </div>
                <div class="bg-amber-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-amber-800">{{ summary()?.total_con_calibracion || 0 }}</p>
                    <p class="text-xs font-bold text-amber-600 uppercase">Con Calibracion</p>
                </div>
                <div class="bg-purple-100 border-3 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#000]">
                    <p class="text-2xl font-black text-purple-800">{{ summary()?.porcentaje_avance || 0 }}%</p>
                    <p class="text-xs font-bold text-purple-600 uppercase">Avance</p>
                </div>
            </div>

            <!-- Progress bar visual -->
            @if (summary()?.total_registros) {
                <div class="border-3 border-black rounded-xl p-3 bg-white dark:bg-gray-900 shadow-[3px_3px_0px_0px_#000]">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm font-black uppercase">Progreso de Migracion</span>
                        <span class="text-sm font-bold text-gray-600">{{ summary()?.porcentaje_avance || 0 }}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-4 border-2 border-black overflow-hidden">
                        <div class="bg-green-500 h-full rounded-full transition-all duration-500"
                             [style.width.%]="summary()?.porcentaje_avance || 0"></div>
                    </div>
                </div>
            }

            <!-- Tabs: Staging / Observados -->
            <mat-tab-group class="border-3 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] overflow-hidden"
                           (selectedTabChange)="onTabChange($event.index)">

                <!-- Tab 1: Productos Excel (Staging) -->
                <mat-tab>
                    <ng-template mat-tab-label>
                        <div class="flex items-center gap-2">
                            <mat-icon>table_chart</mat-icon>
                            <span class="font-bold uppercase text-sm">Datos Staging</span>
                            <span class="bg-blue-200 text-blue-800 text-xs font-black px-2 py-0.5 rounded-full border border-black">
                                {{ productosList().length }}
                            </span>
                        </div>
                    </ng-template>

                    <div class="p-3 flex flex-col gap-3">
                        <!-- Filters -->
                        <div class="flex flex-wrap gap-3">
                            <mat-form-field appearance="outline" class="flex-1 min-w-48" subscriptSizing="dynamic">
                                <mat-label>Buscar por codigo o nombre</mat-label>
                                <input matInput [(ngModel)]="searchTerm" (keyup.enter)="loadProductos()" placeholder="Codigo, nombre...">
                                <mat-icon matPrefix>search</mat-icon>
                            </mat-form-field>
                            <mat-form-field appearance="outline" class="w-48" subscriptSizing="dynamic">
                                <mat-label>Estado migracion</mat-label>
                                <mat-select [(value)]="filterMigrado" (selectionChange)="loadProductos()">
                                    <mat-option value="">Todos</mat-option>
                                    <mat-option value="no">Pendiente</mat-option>
                                    <mat-option value="si">Migrado</mat-option>
                                    <mat-option value="err">Con Error</mat-option>
                                    <mat-option value="obs">Observado</mat-option>
                                </mat-select>
                            </mat-form-field>
                        </div>

                        <!-- Loading -->
                        @if (isLoadingProductos()) {
                            <div class="flex justify-center py-8">
                                <mat-spinner [diameter]="40"></mat-spinner>
                            </div>
                        }

                        <!-- Table -->
                        @if (!isLoadingProductos() && productosList().length > 0) {
                            <div class="overflow-x-auto border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] bg-white dark:bg-gray-900">
                                <table mat-table [dataSource]="productosList()" class="w-full">

                                    <ng-container matColumnDef="cod_he">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Codigo</th>
                                        <td mat-cell *matCellDef="let row" class="!font-bold !text-sm">{{ row.cod_he || '-' }}</td>
                                    </ng-container>

                                    <ng-container matColumnDef="nombre">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Nombre</th>
                                        <td mat-cell *matCellDef="let row" class="!text-sm max-w-xs truncate" [matTooltip]="row.nombre">
                                            {{ row.nombre }}
                                        </td>
                                    </ng-container>

                                    <ng-container matColumnDef="tipo">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Tipo</th>
                                        <td mat-cell *matCellDef="let row" class="!text-sm">{{ row.tipo }}</td>
                                    </ng-container>

                                    <ng-container matColumnDef="marca">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Marca</th>
                                        <td mat-cell *matCellDef="let row" class="!text-sm">{{ row.marca || '-' }}</td>
                                    </ng-container>

                                    <ng-container matColumnDef="ubicacion">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Ubicacion</th>
                                        <td mat-cell *matCellDef="let row" class="!text-sm">{{ row.ubicacion || '-' }}</td>
                                    </ng-container>

                                    <ng-container matColumnDef="migrado">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Estado</th>
                                        <td mat-cell *matCellDef="let row">
                                            <span class="px-2 py-0.5 text-xs font-black rounded-full border border-black"
                                                  [ngClass]="{
                                                      'bg-gray-200 text-gray-700': row.migrado === 'no',
                                                      'bg-green-200 text-green-800': row.migrado === 'si',
                                                      'bg-red-200 text-red-800': row.migrado === 'err',
                                                      'bg-amber-200 text-amber-800': row.migrado === 'obs'
                                                  }">
                                                {{ getMigrationLabel(row.migrado) }}
                                            </span>
                                        </td>
                                    </ng-container>

                                    <ng-container matColumnDef="validation_status">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Validacion</th>
                                        <td mat-cell *matCellDef="let row">
                                            @if (row.validation_status === 'valido') {
                                                <mat-icon class="!text-lg text-green-500" matTooltip="Datos validos">check_circle</mat-icon>
                                            } @else if (row.validation_status === 'error') {
                                                <mat-icon class="!text-lg text-red-500" [matTooltip]="row.validation_errors || 'Error de validacion'">error</mat-icon>
                                            } @else if (row.validation_status === 'duplicado') {
                                                <mat-icon class="!text-lg text-amber-500" matTooltip="Codigo duplicado en tabla definitiva">content_copy</mat-icon>
                                            } @else {
                                                <mat-icon class="!text-lg text-gray-400" matTooltip="Sin validar">help_outline</mat-icon>
                                            }
                                        </td>
                                    </ng-container>

                                    <ng-container matColumnDef="acciones">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800 !text-center">Acciones</th>
                                        <td mat-cell *matCellDef="let row" class="!text-center">
                                            <div class="flex gap-1 justify-center">
                                                @if (row.migrado === 'no' || row.migrado === 'err') {
                                                    <button mat-icon-button matTooltip="Migrar individualmente"
                                                            (click)="migrateIndividual(row)"
                                                            class="!text-blue-600">
                                                        <mat-icon class="!text-lg">play_arrow</mat-icon>
                                                    </button>
                                                }
                                                @if (row.migrado !== 'si') {
                                                    <button mat-icon-button matTooltip="Eliminar registro"
                                                            (click)="deleteProducto(row)"
                                                            class="!text-red-600">
                                                        <mat-icon class="!text-lg">delete</mat-icon>
                                                    </button>
                                                }
                                            </div>
                                        </td>
                                    </ng-container>

                                    <tr mat-header-row *matHeaderRowDef="productosColumns"></tr>
                                    <tr mat-row *matRowDef="let row; columns: productosColumns;"
                                        class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                        [class.bg-green-50]="row.migrado === 'si'"
                                        [class.bg-red-50]="row.migrado === 'err'"></tr>
                                </table>
                            </div>

                            <mat-paginator [length]="totalProductos"
                                           [pageSize]="pageSize"
                                           [pageSizeOptions]="[25, 50, 100, 500]"
                                           (page)="onProductosPageChange($event)"
                                           showFirstLastButtons>
                            </mat-paginator>
                        }

                        <!-- Empty State -->
                        @if (!isLoadingProductos() && productosList().length === 0) {
                            <div class="flex flex-col items-center justify-center py-12 border-3 border-dashed border-gray-300 rounded-xl">
                                <mat-icon class="!text-6xl text-gray-300 mb-3">cloud_upload</mat-icon>
                                <p class="text-lg font-bold text-gray-400">No hay datos en staging</p>
                                <p class="text-sm text-gray-400 mt-1">Los datos se cargan desde el proceso de importacion Excel</p>
                            </div>
                        }
                    </div>
                </mat-tab>

                <!-- Tab 2: Herramientas Observadas -->
                <mat-tab>
                    <ng-template mat-tab-label>
                        <div class="flex items-center gap-2">
                            <mat-icon>warning</mat-icon>
                            <span class="font-bold uppercase text-sm">Observados</span>
                            <span class="bg-red-200 text-red-800 text-xs font-black px-2 py-0.5 rounded-full border border-black">
                                {{ observadosList().length }}
                            </span>
                        </div>
                    </ng-template>

                    <div class="p-3 flex flex-col gap-3">
                        <!-- Loading -->
                        @if (isLoadingObservados()) {
                            <div class="flex justify-center py-8">
                                <mat-spinner [diameter]="40"></mat-spinner>
                            </div>
                        }

                        <!-- Table -->
                        @if (!isLoadingObservados() && observadosList().length > 0) {
                            <div class="overflow-x-auto border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] bg-white dark:bg-gray-900">
                                <table mat-table [dataSource]="observadosList()" class="w-full">

                                    <ng-container matColumnDef="codigo_he">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Codigo HE</th>
                                        <td mat-cell *matCellDef="let row" class="!font-bold !text-sm">{{ row.codigo_he }}</td>
                                    </ng-container>

                                    <ng-container matColumnDef="nombre">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Nombre</th>
                                        <td mat-cell *matCellDef="let row" class="!text-sm">{{ row.nombre }}</td>
                                    </ng-container>

                                    <ng-container matColumnDef="part_numbert">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Part Number</th>
                                        <td mat-cell *matCellDef="let row" class="!text-sm">{{ row.part_numbert || '-' }}</td>
                                    </ng-container>

                                    <ng-container matColumnDef="serial_numbert">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800">Serial Number</th>
                                        <td mat-cell *matCellDef="let row" class="!text-sm">{{ row.serial_numbert || '-' }}</td>
                                    </ng-container>

                                    <ng-container matColumnDef="acciones">
                                        <th mat-header-cell *matHeaderCellDef class="!font-black !text-xs !uppercase !bg-gray-100 dark:!bg-gray-800 !text-center">Acciones</th>
                                        <td mat-cell *matCellDef="let row" class="!text-center">
                                            <button mat-icon-button matTooltip="Eliminar observado"
                                                    (click)="deleteObservado(row)"
                                                    class="!text-red-600">
                                                <mat-icon class="!text-lg">delete</mat-icon>
                                            </button>
                                        </td>
                                    </ng-container>

                                    <tr mat-header-row *matHeaderRowDef="observadosColumns"></tr>
                                    <tr mat-row *matRowDef="let row; columns: observadosColumns;"
                                        class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"></tr>
                                </table>
                            </div>

                            <mat-paginator [length]="totalObservados"
                                           [pageSize]="pageSizeObs"
                                           [pageSizeOptions]="[25, 50, 100]"
                                           (page)="onObservadosPageChange($event)"
                                           showFirstLastButtons>
                            </mat-paginator>
                        }

                        <!-- Empty State -->
                        @if (!isLoadingObservados() && observadosList().length === 0) {
                            <div class="flex flex-col items-center justify-center py-12 border-3 border-dashed border-gray-300 rounded-xl">
                                <mat-icon class="!text-6xl text-gray-300 mb-3">verified</mat-icon>
                                <p class="text-lg font-bold text-gray-400">No hay herramientas observadas</p>
                                <p class="text-sm text-gray-400 mt-1">Las herramientas con errores de migracion aparecen aqui</p>
                            </div>
                        }
                    </div>
                </mat-tab>

            </mat-tab-group>

        </div>
    `,
    styles: [`
        :host { display: block; }
        .border-3 { border-width: 3px; }
    `]
})
export class MigracionExcelComponent implements OnInit, OnDestroy {
    public migrationService = inject(MigrationService);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    // Signals
    productosList = signal<ProductoExcel[]>([]);
    observadosList = signal<HerramientaObservado[]>([]);
    summary = signal<MigrationSummary | null>(null);
    isLoadingProductos = signal(false);
    isLoadingObservados = signal(false);

    // State
    searchTerm = '';
    filterMigrado = '';
    activeTab = 0;

    productosColumns = ['cod_he', 'nombre', 'tipo', 'marca', 'ubicacion', 'migrado', 'validation_status', 'acciones'];
    observadosColumns = ['codigo_he', 'nombre', 'part_numbert', 'serial_numbert', 'acciones'];

    // Pagination - Productos
    totalProductos = 0;
    pageSize = 50;
    pageIndex = 0;

    // Pagination - Observados
    totalObservados = 0;
    pageSizeObs = 25;
    pageIndexObs = 0;

    ngOnInit(): void {
        this.loadData();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadData(): void {
        this.loadSummary();
        this.loadProductos();
        this.loadObservados();
    }

    loadSummary(): void {
        this.migrationService.getResumenMigracion().pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (data) => this.summary.set(data),
            error: () => this.showMessage('Error al cargar resumen', 'error')
        });
    }

    loadProductos(): void {
        this.isLoadingProductos.set(true);
        const filters: any = {
            start: this.pageIndex * this.pageSize,
            limit: this.pageSize
        };
        if (this.searchTerm) {
            filters.search = this.searchTerm;
        }
        if (this.filterMigrado) {
            filters.migrado = this.filterMigrado;
        }

        this.migrationService.getProductosExcel(filters).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoadingProductos.set(false))
        ).subscribe({
            next: (data) => {
                this.productosList.set(data);
                this.totalProductos = data.length;
            },
            error: () => this.showMessage('Error al cargar datos de staging', 'error')
        });
    }

    loadObservados(): void {
        this.isLoadingObservados.set(true);
        const filters: any = {
            start: this.pageIndexObs * this.pageSizeObs,
            limit: this.pageSizeObs
        };

        this.migrationService.getHerramientasObservadas(filters).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoadingObservados.set(false))
        ).subscribe({
            next: (data) => {
                this.observadosList.set(data);
                this.totalObservados = data.length;
            },
            error: () => this.showMessage('Error al cargar observados', 'error')
        });
    }

    runValidation(): void {
        this.migrationService.validarDatos().pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (result) => {
                const msg = result.mensaje ||
                    `Validacion completada: ${result.total_validados} validos, ${result.total_errores} con errores`;
                this.showMessage(msg, result.total_errores > 0 ? 'warning' : 'success');
                this.loadProductos();
                this.loadSummary();
            },
            error: () => this.showMessage('Error al ejecutar validacion', 'error')
        });
    }

    runMigration(): void {
        this.migrationService.procesarMigracion(500).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (result) => {
                const msg = result.mensaje ||
                    `Migracion completada: ${result.total_migrados} migrados, ${result.total_errores} errores`;
                this.showMessage(msg, result.total_errores > 0 ? 'warning' : 'success');
                this.loadData();
            },
            error: () => this.showMessage('Error al ejecutar migracion', 'error')
        });
    }

    migrateIndividual(producto: ProductoExcel): void {
        this.migrationService.migrarRegistroIndividual(producto.id_data).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: () => {
                this.showMessage(`Registro ${producto.cod_he} migrado exitosamente`, 'success');
                this.loadProductos();
                this.loadSummary();
            },
            error: () => this.showMessage(`Error al migrar registro ${producto.cod_he}`, 'error')
        });
    }

    deleteProducto(producto: ProductoExcel): void {
        this.migrationService.deleteProductoExcel(producto.id_data).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: () => {
                this.showMessage('Registro eliminado', 'success');
                this.loadProductos();
                this.loadSummary();
            },
            error: () => this.showMessage('Error al eliminar registro', 'error')
        });
    }

    deleteObservado(item: HerramientaObservado): void {
        this.migrationService.deleteHerramientaObservado(item.codigo_he).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: () => {
                this.showMessage('Observado eliminado', 'success');
                this.loadObservados();
                this.loadSummary();
            },
            error: () => this.showMessage('Error al eliminar observado', 'error')
        });
    }

    onTabChange(index: number): void {
        this.activeTab = index;
    }

    onProductosPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadProductos();
    }

    onObservadosPageChange(event: PageEvent): void {
        this.pageIndexObs = event.pageIndex;
        this.pageSizeObs = event.pageSize;
        this.loadObservados();
    }

    async openImportDialog(): Promise<void> {
        const { ImportarExcelDialogComponent } = await import('./importar-excel/importar-excel-dialog.component');
        const dialogRef = this.dialog.open(ImportarExcelDialogComponent, {
            width: '900px',
            maxWidth: '95vw',
            height: '85vh',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.success) {
                this.loadData();
            }
        });
    }

    getMigrationLabel(status: string): string {
        const labels: Record<string, string> = {
            'no': 'Pendiente',
            'si': 'Migrado',
            'err': 'Error',
            'obs': 'Observado'
        };
        return labels[status] || status;
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
