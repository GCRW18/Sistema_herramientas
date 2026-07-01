import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, combineLatest, startWith, Subscription } from 'rxjs';
import { EmployeeService } from '../../../../core/services/employee.service';

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
    private dialog     = inject(MatDialog);
    private snackBar   = inject(MatSnackBar);
    private empService = inject(EmployeeService);
    private sub        = new Subscription();

    searchControl = new FormControl('');
    filterArea    = new FormControl('');

    empleados: any[]         = [];
    filteredEmpleados: any[] = [];
    pagedEmpleados: any[]    = [];
    isLoading = false;

    currentPage = 1;
    readonly pageSize = 25;

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
        // Carga inicial
        this.loadAll();

        // Filtro reactivo client-side
        this.sub.add(
            combineLatest([
                this.searchControl.valueChanges.pipe(startWith(''), debounceTime(250), distinctUntilChanged()),
                this.filterArea.valueChanges.pipe(startWith(''), distinctUntilChanged())
            ]).subscribe(([search, area]) => {
                this.applyFilters(search || '', area || '');
            })
        );
    }

    ngOnDestroy(): void { this.sub.unsubscribe(); }

    loadAll(): void {
        this.isLoading = true;
        this.empService.getFuncionarios().subscribe({
            next: (data) => {
                this.empleados = data;
                this.applyFilters(this.searchControl.value || '', this.filterArea.value || '');
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
                this.showError('Error al cargar funcionarios');
            }
        });
    }

    private applyFilters(search: string, area: string): void {
        let result = [...this.empleados];
        const term = search.trim().toLowerCase();
        if (term) {
            result = result.filter(e =>
                (e.full_name      || '').toLowerCase().includes(term) ||
                (e.cuenta         || '').toLowerCase().includes(term) ||
                (e.license_number || '').toLowerCase().includes(term) ||
                (e.cargo          || '').toLowerCase().includes(term)
            );
        }
        if (area) {
            result = result.filter(e => e.area === area);
        }
        this.filteredEmpleados = result;
        this.currentPage = 1;
        this.updatePage();
    }

    private updatePage(): void {
        const start = (this.currentPage - 1) * this.pageSize;
        this.pagedEmpleados = this.filteredEmpleados.slice(start, start + this.pageSize);
    }

    get totalPages(): number {
        return Math.ceil(this.filteredEmpleados.length / this.pageSize);
    }

    get pages(): number[] {
        const total = this.totalPages;
        const current = this.currentPage;
        const delta = 2;
        const range: number[] = [];
        for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
            range.push(i);
        }
        return range;
    }

    goToPage(page: number): void {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.updatePage();
    }

    get pageEnd(): number {
        return Math.min(this.currentPage * this.pageSize, this.filteredEmpleados.length);
    }

    recargar(): void { this.loadAll(); }

    getActivos(): number   { return this.filteredEmpleados.filter(e => e.active).length; }
    getInactivos(): number { return this.filteredEmpleados.filter(e => !e.active).length; }

    async verFuncionario(emp: any): Promise<void> {
        const { VerFuncionarioComponent } = await import('./dialogs/ver-funcionario/ver-funcionario.component');
        this.dialog.open(VerFuncionarioComponent, {
            width: '480px', maxWidth: '95vw', maxHeight: '90vh',
            data: emp, panelClass: 'neo-dialog'
        });
    }

    trackByEmp(_: number, emp: any): number { return emp.id_usuario ?? emp.id_employee; }

    private showSuccess(msg: string): void {
        this.snackBar.open(msg, 'Cerrar', { duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-success'] });
    }
    private showError(msg: string): void {
        this.snackBar.open(msg, 'Cerrar', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-error'] });
    }
}
