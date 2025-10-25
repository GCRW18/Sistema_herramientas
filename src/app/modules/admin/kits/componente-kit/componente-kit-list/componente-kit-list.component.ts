import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';

@Component({
  selector: 'app-componente-kit-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatTooltipModule,
    MatMenuModule,
    FormsModule
  ],
  templateUrl: './componente-kit-list.component.html',
  styleUrl: './componente-kit-list.component.scss'
})
export class ComponenteKitListComponent implements OnInit {
  private _router = inject(Router);
  private _changeDetectorRef = inject(ChangeDetectorRef);

  displayedColumns: string[] = ['codigo', 'nombre', 'kit', 'cantidad', 'estado', 'ubicacion', 'acciones'];
  dataSource: any[] = [];
  loading: boolean = false;
  totalRecords: number = 0;
  pageSize: number = 10;
  pageIndex: number = 0;
  searchTerm: string = '';
  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.searchSubject.pipe(debounceTime(300)).subscribe(searchTerm => {
      this.searchTerm = searchTerm;
      this.pageIndex = 0;
      this.loadData();
    });
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    setTimeout(() => {
      this.dataSource = [
        { 
          id: 1, 
          codigo: 'HER-001', 
          nombre: 'Destornillador Phillips #2', 
          kit: 'Kit Eléctrico Básico',
          cantidad: 2,
          estado: 'disponible',
          ubicacion: 'Almacén A-01'
        },
        { 
          id: 2, 
          codigo: 'HER-023', 
          nombre: 'Alicate Universal 8"', 
          kit: 'Kit Mecánico Avanzado',
          cantidad: 1,
          estado: 'en_uso',
          ubicacion: 'Almacén A-01'
        },
        { 
          id: 3, 
          codigo: 'INS-012', 
          nombre: 'Multímetro Digital', 
          kit: 'Kit Eléctrico Básico',
          cantidad: 1,
          estado: 'mantenimiento',
          ubicacion: 'Taller'
        }
      ];
      this.totalRecords = this.dataSource.length;
      this.loading = false;
      this._changeDetectorRef.markForCheck();
    }, 500);
  }

  onSearch(event: Event): void {
    this.searchSubject.next((event.target as HTMLInputElement).value);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadData();
  }

  createComponente(): void {
    this._router.navigate(['/kits/componente-kit/new']);
  }

  editComponente(componente: any): void {
    this._router.navigate(['/kits/componente-kit', componente.id, 'edit']);
  }

  deleteComponente(componente: any): void {
    if (confirm('¿Eliminar el componente "' + componente.nombre + '" del kit?')) {
      console.log('Eliminar:', componente);
    }
  }

  getEstadoClass(estado: string): string {
    const classes: Record<string, string> = {
      'disponible': 'bg-green-100 text-green-800',
      'en_uso': 'bg-blue-100 text-blue-800',
      'mantenimiento': 'bg-yellow-100 text-yellow-800',
      'baja': 'bg-red-100 text-red-800'
    };
    return classes[estado] || 'bg-gray-100 text-gray-800';
  }
}
