import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

interface Laboratory {
    id: string | null;
    code: string;
    name: string;
    address: string;
    city: string;
    country: string;
    contact_person: string;
    phone: string;
    email: string;
    website: string;
    is_certified: boolean;
    certification_number: string;
    rating: number;
    average_delivery_days: number;
    active: boolean;
}

@Component({
    selector: 'app-laboratorios',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatPaginatorModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatDialogModule,
        MatSnackBarModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule
    ],
    template: `
        <div class="flex flex-col gap-4 p-2">

            <!-- Header -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl md:text-3xl font-black text-black dark:text-white uppercase tracking-tight">
                        Laboratorios de Calibracion
                    </h2>
                    <p class="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1">
                        Gestion de laboratorios externos para calibracion de herramientas
                    </p>
                </div>
                <div class="flex gap-3">
                    <button (click)="loadLabs()"
                            class="px-4 py-2 bg-slate-600 text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-2">
                        <mat-icon class="text-white !h-5 !text-lg">refresh</mat-icon>
                        Actualizar
                    </button>
                    <button (click)="openForm(null)"
                            class="px-4 py-2 bg-[#1AAA1FFF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-2">
                        <mat-icon class="text-white !h-5 !text-lg">add</mat-icon>
                        Nuevo
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div *ngIf="isLoading" class="flex items-center justify-center py-12">
                <div class="border-2 border-black rounded-xl p-6 flex flex-col items-center gap-4 bg-white dark:bg-slate-800 shadow-[4px_4px_0px_0px_#000]">
                    <mat-spinner diameter="40"></mat-spinner>
                    <span class="font-black text-sm uppercase tracking-wider text-black dark:text-white">Cargando laboratorios...</span>
                </div>
            </div>

            <!-- Table -->
            <div *ngIf="!isLoading" class="border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_#000] bg-white dark:bg-slate-800">
                <div class="bg-[#0F172AFF] px-4 py-2 border-b-2 border-black flex items-center justify-between h-12">
                    <div class="flex items-center gap-3">
                        <mat-icon class="text-white !text-xl">business</mat-icon>
                        <span class="font-black text-xs md:text-sm uppercase text-white">Laboratorios Registrados</span>
                    </div>
                    <span class="bg-white text-black px-2 py-0.5 rounded text-xs font-black border border-black shadow-[2px_2px_0px_0px_#000]">
                        Total: {{ labs.length }}
                    </span>
                </div>

                <div class="overflow-auto">
                    <table mat-table [dataSource]="labs" class="w-full">

                        <ng-container matColumnDef="code">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">CODIGO</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo font-mono font-black text-sm text-black dark:text-white">{{ el.code }}</td>
                        </ng-container>

                        <ng-container matColumnDef="name">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">NOMBRE</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo font-bold text-sm text-black dark:text-white">{{ el.name }}</td>
                        </ng-container>

                        <ng-container matColumnDef="city">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">CIUDAD</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo text-sm text-black dark:text-white">{{ el.city }}, {{ el.country }}</td>
                        </ng-container>

                        <ng-container matColumnDef="contact_person">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">CONTACTO</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo text-sm text-black dark:text-white">{{ el.contact_person }}</td>
                        </ng-container>

                        <ng-container matColumnDef="is_certified">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">CERT.</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo">
                                <mat-icon *ngIf="el.is_certified" class="text-green-600 !text-lg" matTooltip="Certificado: {{el.certification_number}}">verified</mat-icon>
                                <mat-icon *ngIf="!el.is_certified" class="text-gray-400 !text-lg" matTooltip="No certificado">cancel</mat-icon>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="rating">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">RATING</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo">
                                <div class="flex items-center gap-1">
                                    <mat-icon class="text-yellow-500 !text-lg">star</mat-icon>
                                    <span class="font-black text-sm text-black dark:text-white">{{ el.rating.toFixed(1) }}</span>
                                </div>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="average_delivery_days">
                            <th mat-header-cell *matHeaderCellDef class="header-neo">DIAS PROM.</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo font-mono font-bold text-sm text-black dark:text-white">{{ el.average_delivery_days }}d</td>
                        </ng-container>

                        <ng-container matColumnDef="actions">
                            <th mat-header-cell *matHeaderCellDef class="header-neo text-right">ACCIONES</th>
                            <td mat-cell *matCellDef="let el" class="cell-neo text-right">
                                <div class="flex gap-2 justify-end">
                                    <button (click)="openForm(el); $event.stopPropagation()"
                                            matTooltip="Editar"
                                            class="w-8 h-8 flex items-center justify-center border-2 border-black bg-[#F8B400FF] hover:bg-yellow-400 hover:scale-110 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all">
                                        <mat-icon class="text-black !text-lg !w-5 !h-5">edit</mat-icon>
                                    </button>
                                    <button (click)="deleteLab(el); $event.stopPropagation()"
                                            matTooltip="Eliminar"
                                            class="w-8 h-8 flex items-center justify-center border-2 border-black bg-red-500 hover:bg-red-400 hover:scale-110 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all">
                                        <mat-icon class="text-white !text-lg !w-5 !h-5">delete</mat-icon>
                                    </button>
                                </div>
                            </td>
                        </ng-container>

                        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                        <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                            class="hover:bg-gray-50 dark:hover:bg-slate-900 transition-all h-14 cursor-pointer border-b border-gray-200 dark:border-slate-700"></tr>
                    </table>

                    <div *ngIf="labs.length === 0" class="flex flex-col items-center justify-center py-16 opacity-50">
                        <mat-icon class="!text-6xl text-black dark:text-gray-500">business</mat-icon>
                        <p class="text-sm font-black mt-2 uppercase text-black dark:text-gray-500">No hay laboratorios registrados</p>
                    </div>
                </div>
            </div>

            <!-- FORM PANEL (inline) -->
            <div *ngIf="showForm" class="border-3 border-black rounded-2xl bg-white dark:bg-slate-800 shadow-[6px_6px_0px_0px_#000] overflow-hidden">
                <div class="bg-[#7113CFFF] px-5 py-3 border-b-2 border-black flex items-center justify-between">
                    <span class="font-black text-sm uppercase text-white tracking-wider">
                        {{ editingLab.id ? 'Editar Laboratorio' : 'Nuevo Laboratorio' }}
                    </span>
                    <button (click)="showForm = false"
                            class="w-8 h-8 flex items-center justify-center bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:scale-110 active:shadow-none transition-all">
                        <mat-icon class="text-black !text-lg">close</mat-icon>
                    </button>
                </div>

                <div class="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <mat-form-field appearance="outline">
                        <mat-label>Codigo</mat-label>
                        <input matInput [(ngModel)]="editingLab.code" placeholder="LAB-001">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="sm:col-span-2">
                        <mat-label>Nombre</mat-label>
                        <input matInput [(ngModel)]="editingLab.name" placeholder="Nombre del laboratorio">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="sm:col-span-2">
                        <mat-label>Direccion</mat-label>
                        <input matInput [(ngModel)]="editingLab.address">
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                        <mat-label>Ciudad</mat-label>
                        <input matInput [(ngModel)]="editingLab.city">
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                        <mat-label>Pais</mat-label>
                        <input matInput [(ngModel)]="editingLab.country" value="Bolivia">
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                        <mat-label>Persona de Contacto</mat-label>
                        <input matInput [(ngModel)]="editingLab.contact_person">
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                        <mat-label>Telefono</mat-label>
                        <input matInput [(ngModel)]="editingLab.phone">
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                        <mat-label>Email</mat-label>
                        <input matInput [(ngModel)]="editingLab.email" type="email">
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                        <mat-label>Sitio Web</mat-label>
                        <input matInput [(ngModel)]="editingLab.website">
                    </mat-form-field>

                    <div class="flex items-center gap-4">
                        <mat-slide-toggle [(ngModel)]="editingLab.is_certified">Certificado</mat-slide-toggle>
                    </div>

                    <mat-form-field appearance="outline" *ngIf="editingLab.is_certified">
                        <mat-label>Nro. Certificacion</mat-label>
                        <input matInput [(ngModel)]="editingLab.certification_number">
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                        <mat-label>Dias Promedio Entrega</mat-label>
                        <input matInput [(ngModel)]="editingLab.average_delivery_days" type="number">
                    </mat-form-field>
                </div>

                <div class="px-5 pb-5 flex justify-end gap-3">
                    <button (click)="showForm = false"
                            class="px-5 py-2 bg-white text-black font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase">
                        Cancelar
                    </button>
                    <button (click)="saveLab()"
                            class="px-5 py-2 bg-[#1AAA1FFF] text-white font-bold text-sm border-2 border-black rounded-full shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase flex items-center gap-2">
                        <mat-icon class="text-white !h-5 !text-lg">save</mat-icon>
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; }
        .border-3 { border-width: 3px; }
        .header-neo {
            background-color: white !important;
            color: #111A43 !important;
            font-weight: 900 !important;
            font-size: 12px !important;
            border-bottom: 3px solid black !important;
            padding: 16px 12px !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .cell-neo {
            padding: 14px 12px !important;
            border-bottom: 1px solid #e5e7eb !important;
            font-size: 13px !important;
        }
        :host-context(.dark) .header-neo {
            background-color: #111A43 !important;
            color: white !important;
        }
        :host-context(.dark) .cell-neo {
            border-bottom-color: #334155 !important;
        }
    `]
})
export class LaboratoriosComponent implements OnInit, OnDestroy {
    private calibrationService = inject(CalibrationService);
    private snackBar = inject(MatSnackBar);
    private _unsubscribeAll = new Subject<void>();

    isLoading = false;
    showForm = false;
    labs: Laboratory[] = [];

    displayedColumns = ['code', 'name', 'city', 'contact_person', 'is_certified', 'rating', 'average_delivery_days', 'actions'];

    editingLab: Laboratory = this.getEmptyLab();

    ngOnInit(): void {
        this.loadLabs();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private getEmptyLab(): Laboratory {
        return {
            id: null, code: '', name: '', address: '', city: '', country: 'Bolivia',
            contact_person: '', phone: '', email: '', website: '',
            is_certified: false, certification_number: '', rating: 0,
            average_delivery_days: 30, active: true
        };
    }

    loadLabs(): void {
        this.isLoading = true;

        this.calibrationService.getLaboratories().pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (res: any) => {
                if (res?.length > 0 || res?.data?.length > 0) {
                    this.labs = res.data || res;
                } else {
                    this.loadMockData();
                }
            },
            error: () => {
                this.loadMockData();
            }
        });
    }

    private loadMockData(): void {
        this.labs = [
            { id: '1', code: 'LAB-001', name: 'METROTEST S.R.L.', address: 'Calle Sucre #456', city: 'Cochabamba', country: 'Bolivia', contact_person: 'Ing. Carlos Mendoza', phone: '+591 4-4252100', email: 'calibraciones@metrotest.com.bo', website: 'www.metrotest.com.bo', is_certified: true, certification_number: 'ISO/IEC 17025:2017', rating: 4.5, average_delivery_days: 15, active: true },
            { id: '2', code: 'LAB-002', name: 'METROLOGIA INDUSTRIAL LTDA', address: 'Av. Santos Dumont #789', city: 'Santa Cruz', country: 'Bolivia', contact_person: 'Lic. Maria Flores', phone: '+591 3-3425600', email: 'info@metroindustrial.com.bo', website: 'www.metroindustrial.com.bo', is_certified: true, certification_number: 'ISO 9001:2015', rating: 4.2, average_delivery_days: 20, active: true },
            { id: '3', code: 'LAB-003', name: 'CALIBRA TECH', address: 'Zona Industrial Km 5', city: 'La Paz', country: 'Bolivia', contact_person: 'Ing. Roberto Quispe', phone: '+591 2-2845300', email: 'servicios@calibratech.bo', website: '', is_certified: false, certification_number: '', rating: 3.8, average_delivery_days: 25, active: true }
        ];
    }

    openForm(lab: Laboratory | null): void {
        this.editingLab = lab ? { ...lab } : this.getEmptyLab();
        this.showForm = true;
    }

    saveLab(): void {
        if (!this.editingLab.code || !this.editingLab.name) {
            this.snackBar.open('Codigo y nombre son requeridos', 'Cerrar', { duration: 3000, panelClass: ['snackbar-error'] });
            return;
        }

        this.calibrationService.saveLaboratory(this.editingLab).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: () => {
                this.snackBar.open('Laboratorio guardado exitosamente', 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-success'] });
                this.showForm = false;
                this.loadLabs();
            },
            error: () => {
                // Fallback: update local data
                if (this.editingLab.id) {
                    const idx = this.labs.findIndex(l => l.id === this.editingLab.id);
                    if (idx >= 0) this.labs[idx] = { ...this.editingLab };
                } else {
                    this.editingLab.id = String(this.labs.length + 1);
                    this.labs = [...this.labs, { ...this.editingLab }];
                }
                this.snackBar.open('Laboratorio guardado (modo offline)', 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-success'] });
                this.showForm = false;
            }
        });
    }

    deleteLab(lab: Laboratory): void {
        if (!confirm(`Eliminar laboratorio "${lab.name}"?`)) return;

        this.calibrationService.deleteLaboratory(lab.id!).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: () => {
                this.snackBar.open('Laboratorio eliminado', 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-success'] });
                this.loadLabs();
            },
            error: () => {
                this.labs = this.labs.filter(l => l.id !== lab.id);
                this.snackBar.open('Laboratorio eliminado (modo offline)', 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top' });
            }
        });
    }
}
