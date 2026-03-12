import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, startWith } from 'rxjs/operators';
import { combineLatest } from 'rxjs';
import { EmployeeService } from '../../../../core/services/employee.service';

@Component({
    selector: 'app-funcionarios',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatSnackBarModule,
        ReactiveFormsModule
    ],
    templateUrl: './funcionarios.component.html',
    styles: [`:host { display: block; height: 100%; }`]
})
export class FuncionariosComponent implements OnInit {
    private router      = inject(Router);
    private dialog      = inject(MatDialog);
    private snackBar    = inject(MatSnackBar);
    private empService  = inject(EmployeeService);

    searchControl   = new FormControl('');
    filterArea      = new FormControl('');

    empleados: any[]         = [];
    filteredEmpleados: any[] = [];
    isLoading = false;

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
        this.loadEmpleados();
        this.setupFilters();
    }

    loadEmpleados(): void {
        this.isLoading = true;
        this.empService.getEmployees().subscribe({
            next: (data) => {
                this.empleados = data;
                this.applyFilters();
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
                this.showError('Error al cargar funcionarios');
            }
        });
    }

    setupFilters(): void {
        combineLatest([
            this.searchControl.valueChanges.pipe(startWith('')),
            this.filterArea.valueChanges.pipe(startWith(''))
        ]).pipe(debounceTime(300)).subscribe(() => this.applyFilters());
    }

    applyFilters(): void {
        let list = [...this.empleados];
        const q = this.searchControl.value?.toLowerCase() || '';
        if (q) {
            list = list.filter(e =>
                (e.full_name || '').toLowerCase().includes(q) ||
                (e.license_number || '').toLowerCase().includes(q) ||
                (e.cargo || '').toLowerCase().includes(q)
            );
        }
        const area = this.filterArea.value;
        if (area) list = list.filter(e => e.area === area);
        this.filteredEmpleados = list;
    }

    getActivos(): number { return this.empleados.filter(e => e.active).length; }
    getInactivos(): number { return this.empleados.filter(e => !e.active).length; }

    async nuevoFuncionario(): Promise<void> {
        const { FormFuncionarioComponent } = await import('./dialogs/form-funcionario/form-funcionario.component');
        this.dialog.open(FormFuncionarioComponent, {
            width: '900px', maxWidth: '95vw', maxHeight: '90vh', panelClass: 'neo-dialog'
        }).afterClosed().subscribe(result => {
            if (result) {
                this.empService.createEmployee(result).subscribe({
                    next: () => { this.showSuccess('Funcionario creado exitosamente'); this.loadEmpleados(); },
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
                    next: () => { this.showSuccess('Funcionario actualizado'); this.loadEmpleados(); },
                    error: () => this.showError('Error al actualizar funcionario')
                });
            }
        });
    }

    async toggleEstado(emp: any): Promise<void> {
        const accion = emp.active ? 'desactivar' : 'activar';
        if (!confirm(`¿Está seguro de ${accion} a ${emp.full_name}?`)) return;
        this.empService.updateEmployee(emp.id_employee, { active: !emp.active } as any).subscribe({
            next: () => { this.showSuccess(`Funcionario ${emp.active ? 'desactivado' : 'activado'}`); this.loadEmpleados(); },
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
