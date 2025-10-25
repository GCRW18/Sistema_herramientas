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
  selector: 'app-utilidades-list',
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
  templateUrl: './utilidades-list.component.html',
  styleUrl: './utilidades-list.component.scss'
})
export class UtilidadesListComponent implements OnInit {
  private _router = inject(Router);
  private _changeDetectorRef = inject(ChangeDetectorRef);

  displayedColumns: string[] = ['nombre', 'tipo', 'descripcion', 'estado', 'ultima_actualizacion', 'acciones'];
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
          nombre: 'Calculadora de Tolerancias', 
          tipo: 'Herramienta de Cálculo',
          descripcion: 'Calcula tolerancias según normas ISO',
          estado: 'activo',
          ultima_actualizacion: '2025-10-15'
        },
        { 
          id: 2, 
          nombre: 'Conversor de Unidades', 
          tipo: 'Herramienta de Conversión',
          descripcion: 'Convierte unidades de medida',
          estado: 'activo',
          ultima_actualizacion: '2025-10-10'
        },
        { 
          id: 3, 
          nombre: 'Plantilla de Informes', 
          tipo: 'Plantilla',
          descripcion: 'Plantilla para informes técnicos',
          estado: 'inactivo',
          ultima_actualizacion: '2025-09-28'
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

  createUtilidad(): void {
    this._router.navigate(['/utilities/utilidades/new']);
  }

  editUtilidad(utilidad: any): void {
    this._router.navigate(['/utilities/utilidades', utilidad.id, 'edit']);
  }

  deleteUtilidad(utilidad: any): void {
    if (confirm('¿Eliminar la utilidad "' + utilidad.nombre + '"?')) {
      console.log('Eliminar:', utilidad);
    }
  }

  useUtilidad(utilidad: any): void {
    console.log('Usar utilidad:', utilidad.nombre);
    // TODO: Implement utility usage logic
  }

  getEstadoClass(estado: string): string {
    const classes: Record<string, string> = {
      'activo': 'bg-green-100 text-green-800',
      'inactivo': 'bg-gray-100 text-gray-800',
      'mantenimiento': 'bg-yellow-100 text-yellow-800'
    };
    return classes[estado] || 'bg-gray-100 text-gray-800';
  }

  getTipoClass(tipo: string): string {
    const classes: Record<string, string> = {
      'Herramienta de Cálculo': 'bg-blue-100 text-blue-800',
      'Herramienta de Conversión': 'bg-purple-100 text-purple-800',
      'Plantilla': 'bg-indigo-100 text-indigo-800',
      'Generador': 'bg-green-100 text-green-800'
    };
    return classes[tipo] || 'bg-gray-100 text-gray-800';
  }
}
