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
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MovementService, NotificationService } from 'app/core/services';

@Component({
  selector: 'app-comprobante-list',
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
    MatDialogModule,
    FormsModule
  ],
  templateUrl: './comprobante-list.component.html',
  styleUrl: './comprobante-list.component.scss'
})
export class ComprobanteListComponent implements OnInit {
  private _router = inject(Router);
  private _changeDetectorRef = inject(ChangeDetectorRef);
  private _movementService = inject(MovementService);
  private _notificationService = inject(NotificationService);
  private _dialog = inject(MatDialog);
  private _sanitizer = inject(DomSanitizer);

  displayedColumns: string[] = ['numero', 'tipo', 'fecha', 'responsable', 'descripcion', 'estado', 'acciones'];
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
          numero: 'COMP-2025-001', 
          tipo: 'Salida', 
          fecha: '2025-10-20',
          responsable: 'Juan Pérez',
          descripcion: 'Préstamo de herramientas para mantenimiento',
          estado: 'activo'
        },
        { 
          id: 2, 
          numero: 'COMP-2025-002', 
          tipo: 'Entrada', 
          fecha: '2025-10-18',
          responsable: 'María González',
          descripcion: 'Devolución de equipos de calibración',
          estado: 'cerrado'
        },
        { 
          id: 3, 
          numero: 'COMP-2025-003', 
          tipo: 'Salida', 
          fecha: '2025-10-15',
          responsable: 'Carlos Rodríguez',
          descripcion: 'Salida para proyecto externo',
          estado: 'pendiente'
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

  createComprobante(): void {
    this._router.navigate(['/movements/comprobante/new']);
  }

  editComprobante(comprobante: any): void {
    this._router.navigate(['/movements/comprobante', comprobante.id, 'edit']);
  }

  deleteComprobante(comprobante: any): void {
    if (confirm('¿Eliminar el comprobante "' + comprobante.numero + '"?')) {
      console.log('Eliminar:', comprobante);
    }
  }

  viewPdf(comprobante: any): void {
    this._movementService.exportMovements({ movementIds: [comprobante.id] }, 'PDF').subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const safeUrl = this._sanitizer.bypassSecurityTrustResourceUrl(url);

        // Open PDF in dialog
        this._dialog.open(PdfViewerDialog, {
          width: '90vw',
          height: '90vh',
          data: { url: safeUrl, title: comprobante.numero }
        });
      },
      error: () => {
        this._notificationService.error('Error al cargar PDF');
      }
    });
  }

  getEstadoClass(estado: string): string {
    const classes: Record<string, string> = {
      'activo': 'bg-blue-100 text-blue-800',
      'cerrado': 'bg-green-100 text-green-800',
      'pendiente': 'bg-yellow-100 text-yellow-800',
      'anulado': 'bg-red-100 text-red-800'
    };
    return classes[estado] || 'bg-gray-100 text-gray-800';
  }

  getTipoClass(tipo: string): string {
    return tipo === 'Entrada' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800';
  }
}

// PDF Viewer Dialog Component
@Component({
  selector: 'pdf-viewer-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between p-4 border-b">
        <h2 class="text-xl font-semibold">{{ data.title }}</h2>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="flex-1 overflow-hidden">
        <iframe [src]="data.url" class="w-full h-full border-0"></iframe>
      </div>
    </div>
  `
})
export class PdfViewerDialog {
  data = inject<any>(MatDialog as any);

  close(): void {
    this._dialog.closeAll();
  }

  private _dialog = inject(MatDialog);
}
