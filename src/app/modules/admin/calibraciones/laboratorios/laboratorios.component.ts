import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, combineLatest } from 'rxjs';
import { debounceTime, startWith, takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

export interface Laboratory {
    id_laboratory: string | null;
    code: string;
    name: string;
    rut_nit: string;
    tipo_servicio: string;
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
    observaciones: string;
}

@Component({
    selector: 'app-laboratorios',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        ReactiveFormsModule,
    ],
    templateUrl: './laboratorios.component.html',
})
export class LaboratoriosComponent implements OnInit, OnDestroy {

    private router = inject(Router);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private calibrationService = inject(CalibrationService);
    private _destroy$ = new Subject<void>();

    // Form Controls para búsqueda y filtros
    searchControl = new FormControl('');
    filterTipoServicio = new FormControl('');
    filterEstado = new FormControl('');

    isLoading = signal(false);
    laboratorios: Laboratory[] = [];
    filteredLaboratorios: Laboratory[] = [];

    tiposServicio = [
        { value: '', label: 'Todos' },
        { value: 'calibracion', label: 'Calibración' },
        { value: 'mantenimiento', label: 'Mantenimiento' },
        { value: 'ambos', label: 'Ambos' },
    ];

    estadosFiltro = [
        { value: '', label: 'Todos' },
        { value: 'true', label: 'Activos' },
        { value: 'false', label: 'Inactivos' },
    ];

    ngOnInit(): void {
        this.loadLaboratorios();
        this.setupFilters();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    loadLaboratorios(): void {
        this.isLoading.set(true);
        this.calibrationService.getLaboratories().pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading.set(false)),
        ).subscribe({
            next: (res: any) => {
                const labs = Array.isArray(res) ? res : (res?.datos || []);
                console.log('[loadLaboratorios] registros recibidos:', labs.length, labs);
                this.laboratorios = labs.map((lab: any) => ({
                    id_laboratory: lab.id_laboratory ?? lab.id ?? null,
                    code: lab.code ?? '—',
                    name: lab.name ?? '—',
                    rut_nit: lab.rut_nit ?? '',
                    tipo_servicio: lab.tipo_servicio ?? '',
                    address: lab.address ?? '',
                    city: lab.city ?? '',
                    country: lab.country ?? 'Bolivia',
                    contact_person: lab.contact_person ?? '',
                    phone: lab.phone ?? '',
                    email: lab.email ?? '',
                    website: lab.website ?? '',
                    is_certified: !!lab.is_certified,
                    certification_number: lab.certification_number ?? '',
                    rating: lab.rating ?? 0,
                    average_delivery_days: lab.average_delivery_days ?? 30,
                    active: lab.active === true || lab.active === 't' || lab.active === 'true' || lab.active === 1,
                    observaciones: lab.observaciones ?? '',
                }));
                this.applyFilters();
            },
            error: (err) => {
                console.error('Error loading laboratories:', err);
                this.showMsg('Error al cargar las empresas', 'error');
                this.isLoading.set(false);
            },
        });
    }

    setupFilters(): void {
        combineLatest([
            this.searchControl.valueChanges.pipe(startWith('')),
            this.filterTipoServicio.valueChanges.pipe(startWith('')),
            this.filterEstado.valueChanges.pipe(startWith('')),
        ]).pipe(
            debounceTime(300),
            takeUntil(this._destroy$),
        ).subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        let list = [...this.laboratorios];

        const q = this.searchControl.value?.toLowerCase().trim() ?? '';
        if (q) {
            list = list.filter(lab =>
                lab.code.toLowerCase().includes(q) ||
                lab.name.toLowerCase().includes(q) ||
                (lab.rut_nit && lab.rut_nit.toLowerCase().includes(q)) ||
                (lab.contact_person && lab.contact_person.toLowerCase().includes(q))
            );
        }

        const tipo = this.filterTipoServicio.value;
        if (tipo) {
            list = list.filter(lab => lab.tipo_servicio === tipo);
        }

        const estado = this.filterEstado.value;
        if (estado === 'true') {
            list = list.filter(lab => lab.active === true);
        } else if (estado === 'false') {
            list = list.filter(lab => lab.active === false);
        }

        this.filteredLaboratorios = list;
    }

    limpiarFiltros(): void {
        this.searchControl.setValue('');
        this.filterTipoServicio.setValue('');
        this.filterEstado.setValue('');
    }

    getActivosCount(): number {
        return this.laboratorios.filter(lab => lab.active).length;
    }

    getInactivosCount(): number {
        return this.laboratorios.filter(lab => !lab.active).length;
    }

    getCalibracionCount(): number {
        return this.laboratorios.filter(lab => lab.tipo_servicio === 'calibracion' || lab.tipo_servicio === 'ambos').length;
    }

    getMantenimientoCount(): number {
        return this.laboratorios.filter(lab => lab.tipo_servicio === 'mantenimiento' || lab.tipo_servicio === 'ambos').length;
    }

    getTipoServicioLabel(tipo: string): string {
        const labels: Record<string, string> = {
            'calibracion': 'CAL',
            'mantenimiento': 'MNT',
            'ambos': 'AMB'
        };
        return labels[tipo] ?? '—';
    }

    getTipoServicioChipClass(tipo: string): string {
        const classes: Record<string, string> = {
            'calibracion': 'bg-blue-100 text-blue-800 border-blue-200',
            'mantenimiento': 'bg-orange-100 text-orange-800 border-orange-200',
            'ambos': 'bg-purple-100 text-purple-800 border-purple-200'
        };
        return classes[tipo] ?? 'bg-gray-100 text-gray-700 border-gray-200';
    }

    async nuevoLaboratorio(): Promise<void> {
        try {
            const { FormLaboratorioComponent } = await import('./form-laboratorio/form-laboratorio.component');
            const ref = this.dialog.open(FormLaboratorioComponent, {
                width: '900px',
                maxWidth: '95vw',
                height: 'auto',
                maxHeight: '90vh',
                panelClass: 'neo-dialog',
                disableClose: false,
                data: { mode: 'new' }
            });
            ref.afterClosed().subscribe(ok => {
                if (ok) {
                    this.loadLaboratorios();
                    this.showMsg('Empresa registrada exitosamente', 'success');
                }
            });
        } catch (error) {
            console.error('Error loading form component:', error);
            this.showMsg('Error al abrir el formulario', 'error');
        }
    }

    async editarLaboratorio(lab: Laboratory): Promise<void> {
        try {
            const { FormLaboratorioComponent } = await import('./form-laboratorio/form-laboratorio.component');
            const ref = this.dialog.open(FormLaboratorioComponent, {
                width: '900px',
                maxWidth: '95vw',
                height: 'auto',
                maxHeight: '90vh',
                panelClass: 'neo-dialog',
                disableClose: false,
                data: { mode: 'edit', laboratory: lab }
            });
            ref.afterClosed().subscribe(ok => {
                if (ok) {
                    this.loadLaboratorios();
                    this.showMsg('Empresa actualizada exitosamente', 'success');
                }
            });
        } catch (error) {
            console.error('Error loading form component:', error);
            this.showMsg('Error al abrir el formulario', 'error');
        }
    }

    async verLaboratorio(lab: Laboratory): Promise<void> {
        try {
            const { FormLaboratorioComponent } = await import('./form-laboratorio/form-laboratorio.component');
            const ref = this.dialog.open(FormLaboratorioComponent, {
                width: '900px',
                maxWidth: '95vw',
                height: 'auto',
                maxHeight: '90vh',
                panelClass: 'neo-dialog',
                disableClose: false,
                data: { mode: 'view', laboratory: lab }
            });
            ref.afterClosed().subscribe(() => {});
        } catch (error) {
            console.error('Error loading form component:', error);
            this.showMsg('Error al abrir el formulario', 'error');
        }
    }

    async eliminarLaboratorio(lab: Laboratory, event: Event): Promise<void> {
        event.stopPropagation();

        const confirmMsg = `¿Desea eliminar la empresa "${lab.name}"?\n\nSi tiene calibraciones registradas será desactivada; de lo contrario se eliminará permanentemente.`;

        if (!confirm(confirmMsg)) return;

        // El backend (HE_CAL_ELI) decide automáticamente si desactivar o eliminar
        this.calibrationService.deleteLaboratory(lab.id_laboratory!).pipe(
            takeUntil(this._destroy$)
        ).subscribe({
            next: () => {
                this.showMsg(`Operación completada para "${lab.name}"`, 'success');
                this.loadLaboratorios();
            },
            error: (err) => {
                console.error('Error:', err);
                this.showMsg(err?.message || 'Error al procesar la empresa', 'error');
            }
        });
    }

    private showMsg(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Cerrar', {
            duration: type === 'error' ? 5000 : 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`],
        });
    }
}
