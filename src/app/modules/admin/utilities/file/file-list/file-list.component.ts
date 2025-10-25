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
  selector: 'app-file-list',
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
  templateUrl: './file-list.component.html',
  styleUrl: './file-list.component.scss'
})
export class FileListComponent implements OnInit {
  private _router = inject(Router);
  private _changeDetectorRef = inject(ChangeDetectorRef);

  displayedColumns: string[] = ['nombre', 'tipo', 'tamano', 'entidad', 'fecha_subida', 'usuario', 'acciones'];
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
          nombre: 'Certificado_Calibracion_HER001.pdf', 
          tipo: 'PDF',
          tamano: '2.3 MB',
          entidad: 'Herramienta HER-001',
          fecha_subida: '2025-10-20',
          usuario: 'Juan Pérez'
        },
        { 
          id: 2, 
          nombre: 'Manual_Instrucciones_INS012.pdf', 
          tipo: 'PDF',
          tamano: '5.1 MB',
          entidad: 'Instrumento INS-012',
          fecha_subida: '2025-10-18',
          usuario: 'María González'
        },
        { 
          id: 3, 
          nombre: 'Fotografia_Equipo.jpg', 
          tipo: 'Imagen',
          tamano: '1.8 MB',
          entidad: 'Equipo EQU-045',
          fecha_subida: '2025-10-15',
          usuario: 'Carlos Rodríguez'
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

  uploadFile(): void {
    this._router.navigate(['/utilities/file/new']);
  }

  editFile(file: any): void {
    this._router.navigate(['/utilities/file', file.id, 'edit']);
  }

  deleteFile(file: any): void {
    if (confirm('¿Eliminar el archivo "' + file.nombre + '"?')) {
      console.log('Eliminar:', file);
    }
  }

  downloadFile(file: any): void {
    console.log('Descargar archivo:', file.nombre);
    // TODO: Implement file download
  }

  previewFile(file: any): void {
    console.log('Vista previa del archivo:', file.nombre);
    // TODO: Implement file preview
  }

  getTipoClass(tipo: string): string {
    const classes: Record<string, string> = {
      'PDF': 'bg-red-100 text-red-800',
      'Imagen': 'bg-blue-100 text-blue-800',
      'Excel': 'bg-green-100 text-green-800',
      'Word': 'bg-indigo-100 text-indigo-800'
    };
    return classes[tipo] || 'bg-gray-100 text-gray-800';
  }
}
