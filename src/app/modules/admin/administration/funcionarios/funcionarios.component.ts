import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, combineLatest, startWith, Subscription } from 'rxjs';
import { switchMap, of } from 'rxjs';
import { EmployeeService } from '../../../../core/services/employee.service';

const MIN_SEARCH_CHARS = 2;

@Component({
    selector: 'app-funcionarios',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MatSnackBarModule,
        ReactiveFormsModule
    ],
    templateUrl: './funcionarios.component.html',
    styles: [`
        :host { display: block; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
    `]
})
export class FuncionariosComponent implements OnInit, OnDestroy {
    private router      = inject(Router);
    private dialog      = inject(MatDialog);
    private snackBar    = inject(MatSnackBar);
    private empService  = inject(EmployeeService);
    private sub         = new Subscription();

    searchControl   = new FormControl('');
    filterArea      = new FormControl('');

    empleados: any[]         = [];
    filteredEmpleados: any[] = [];
    isLoading  = false;
    hasSearched = false;

    areas = [
        { value: '', label: 'Todas las áreas' },
        { value: 'LINEA',          label: 'Línea' },
        { value: 'MANTENIMIENTO',  label: 'Mantenimiento' },
        { value: 'CENTRO CONTROL', label: 'Centro Control' },
        { value: 'AVIONICOS',      label: 'Aviónicos' },
        { value: 'ESTRUCTURAS',    label: 'Estructuras' },
        { value: 'MOTORES',        label: 'Motores' }
    ];

    ngOnInit(): void {
        this.sub.add(
            combineLatest([
                this.searchControl.valueChanges.pipe(startWith(''), debounceTime(400), distinctUntilChanged()),
                this.filterArea.valueChanges.pipe(startWith(''), distinctUntilChanged())
            ]).pipe(
                switchMap(([search, area]) => {
                    const term = (search || '').trim();
                    // Solo buscar si hay al menos MIN_SEARCH_CHARS chars en el nombre o se filtra por área
                    if (term.length < MIN_SEARCH_CHARS && !area) {
                        this.hasSearched = false;
                        this.empleados = [];
                        this.filteredEmpleados = [];
                        return of([]);
                    }
                    this.isLoading = true;
                    this.hasSearched = true;
                    return this.empService.getEmployees({
                        search: term.length >= MIN_SEARCH_CHARS ? term : undefined,
                        area: area || undefined
                    });
                })
            ).subscribe({
                next: (data) => {
                    this.empleados = data;
                    this.filteredEmpleados = data;
                    this.isLoading = false;
                },
                error: () => {
                    this.isLoading = false;
                    this.showError('Error al buscar funcionarios');
                }
            })
        );
    }

    ngOnDestroy(): void { this.sub.unsubscribe(); }

    // Recarga tras crear/editar aplicando los filtros actuales
    recargar(): void {
        const term = (this.searchControl.value || '').trim();
        const area = this.filterArea.value || '';
        if (term.length < MIN_SEARCH_CHARS && !area) return;
        this.isLoading = true;
        this.empService.getEmployees({
            search: term.length >= MIN_SEARCH_CHARS ? term : undefined,
            area: area || undefined
        }).subscribe({
            next: (data) => { this.empleados = data; this.filteredEmpleados = data; this.isLoading = false; },
            error: () => { this.isLoading = false; }
        });
    }

    getActivos(): number { return this.filteredEmpleados.filter(e => e.active).length; }
    getInactivos(): number { return this.filteredEmpleados.filter(e => !e.active).length; }

    async nuevoFuncionario(): Promise<void> {
        const { FormFuncionarioComponent } = await import('./dialogs/form-funcionario/form-funcionario.component');
        this.dialog.open(FormFuncionarioComponent, {
            width: '900px', maxWidth: '95vw', maxHeight: '90vh', panelClass: 'neo-dialog'
        }).afterClosed().subscribe(result => {
            if (result) {
                this.empService.createEmployee(result).subscribe({
                    next: () => { this.showSuccess('Funcionario creado exitosamente'); this.recargar(); },
                    error: () => this.showError('Error al crear funcionario')
                });
            }
        });
    }

    async editarFuncionario(emp: any): Promise<void> {
        const { FormFuncionarioComponent } = await import('./dialogs/form-funcionario/form-funcionario.component');
        this.dialog.open(FormFuncionarioComponent, {
            width: '900px', maxWidth: '95vw', maxHeight: '90vh',
            data: { empleado: emp, mode: 'edit' }, panelClass: 'neo-dialog'
        }).afterClosed().subscribe(result => {
            if (result) {
                this.empService.updateEmployee(emp.id_employee, result).subscribe({
                    next: () => { this.showSuccess('Funcionario actualizado'); this.recargar(); },
                    error: () => this.showError('Error al actualizar funcionario')
                });
            }
        });
    }

    async toggleEstado(emp: any): Promise<void> {
        const accion = emp.active ? 'desactivar' : 'activar';
        if (!confirm(`¿Está seguro de ${accion} a ${emp.full_name}?`)) return;
        this.empService.updateEmployee(emp.id_employee, { active: !emp.active } as any).subscribe({
            next: () => { this.showSuccess(`Funcionario ${emp.active ? 'desactivado' : 'activado'}`); this.recargar(); },
            error: () => this.showError('Error al cambiar estado')
        });
    }

    volver(): void { this.router.navigate(['/administration']); }

    private showSuccess(msg: string): void {
        this.snackBar.open(msg, 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-success'] });
    }
    private showError(msg: string): void {
        this.snackBar.open(msg, 'Cerrar', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-error'] });
    }
}
