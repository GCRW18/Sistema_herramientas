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
  selector: 'app-baja-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatTableModule, MatPaginatorModule, MatSortModule, MatFormFieldModule, MatInputModule, MatChipsModule, MatTooltipModule, MatMenuModule, FormsModule],
  templateUrl: './baja-list.component.html',
  styleUrl: './baja-list.component.scss'
})
export class BajaListComponent implements OnInit {
  private _router = inject(Router);
  private _changeDetectorRef = inject(ChangeDetectorRef);

  displayedColumns: string[] = ['codigo', 'nombre', 'categoria', 'motivo', 'fecha_baja', 'estado', 'acciones'];
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
        { id: 1, codigo: 'BOA-001', nombre: 'Multímetro Digital', categoria: 'Instrumentos', motivo: 'Daño irreparable', fecha_baja: '2025-10-15', estado: 'aprobado' },
        { id: 2, codigo: 'BOA-045', nombre: 'Torquímetro', categoria: 'Herramientas', motivo: 'Obsoleto', fecha_baja: '2025-10-10', estado: 'pendiente' }
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

  createBaja(): void {
    this._router.navigate(['/status-management/baja/new']);
  }

  editBaja(baja: any): void {
    this._router.navigate(['/status-management/baja', baja.id, 'edit']);
  }

  deleteBaja(baja: any): void {
    if (confirm('¿Eliminar la baja "' + baja.nombre + '"?')) {
      console.log('Eliminar:', baja);
    }
  }

  getEstadoClass(estado: string): string {
    const classes: Record<string, string> = {
      'pendiente': 'bg-yellow-100 text-yellow-800',
      'aprobado': 'bg-green-100 text-green-800',
      'rechazado': 'bg-red-100 text-red-800'
    };
    return classes[estado] || 'bg-gray-100 text-gray-800';
  }
}
