import { Component, OnInit, inject, signal, computed, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';
import { ToolService } from 'app/core/services/tool.service';
import { CategoryService } from 'app/core/services/category.service';

interface InventoryItem {
    id: number;
    codigo: string;
    partNumber: string;
    descripcion: string;
    categoria: string;
    ubicacion: string;
    stockActual: number;
    stockMinimo: number;
    stockMaximo: number;
    estado: 'DISPONIBLE' | 'BAJO STOCK' | 'SIN STOCK' | 'EN CALIBRACION' | 'EN PRESTAMO' | 'CUARENTENA';
    ultimoMovimiento: Date;
    valorUnitario: number;
    proveedor?: string;
    serialNumber?: string;
    fechaCalibracion?: Date;
    proximaCalibracion?: Date;
    condicion: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'MALO';
    imagen?: string;
}

@Component({
    selector: 'app-consultar-inventario',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        MatDialogModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTableModule,
        MatChipsModule,
        MatBadgeModule,
        MatTooltipModule,
        MatExpansionModule,
        MatProgressSpinnerModule,
        DragDropModule
    ],
    encapsulation: ViewEncapsulation.None,
    templateUrl: './consultar-inventario.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.3);
            border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.5);
        }

        @keyframes slideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in {
            animation: slideIn 0.3s ease-out forwards;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fade-in {
            animation: fadeIn 0.2s ease-out forwards;
        }
    `]
})
export class ConsultarInventarioComponent implements OnInit {
    private fb = inject(FormBuilder);
    private dialog = inject(MatDialog);
    private router = inject(Router);
    private toolService = inject(ToolService);
    private categoryService = inject(CategoryService);
    public dialogRef = inject(MatDialogRef<ConsultarInventarioComponent>, { optional: true });

    // Signals
    searchTerm = signal('');
    selectedCategoria = signal<string>('todas');
    selectedEstado = signal<string>('todos');
    selectedUbicacion = signal<string>('todas');
    viewMode = signal<'grid' | 'list' | 'table'>('grid');
    selectedItem = signal<InventoryItem | null>(null);
    showFilters = signal(true);
    isLoading = signal(false);

    searchForm!: FormGroup;

    // Data cargada desde el backend
    inventoryData = signal<InventoryItem[]>([]);

    categorias: string[] = [];
    ubicaciones: string[] = [];
    estados = ['DISPONIBLE', 'BAJO STOCK', 'SIN STOCK', 'EN CALIBRACION', 'EN PRESTAMO', 'CUARENTENA'];

    // Computed
    filteredData = computed(() => {
        let data = this.inventoryData();
        const term = this.searchTerm().toLowerCase();
        const categoria = this.selectedCategoria();
        const estado = this.selectedEstado();
        const ubicacion = this.selectedUbicacion();

        if (term) {
            data = data.filter(item =>
                item.codigo.toLowerCase().includes(term) ||
                item.descripcion.toLowerCase().includes(term) ||
                item.partNumber.toLowerCase().includes(term)
            );
        }
        if (categoria !== 'todas') {
            data = data.filter(item => item.categoria === categoria);
        }
        if (estado !== 'todos') {
            data = data.filter(item => item.estado === estado);
        }
        if (ubicacion !== 'todas') {
            data = data.filter(item => item.ubicacion === ubicacion);
        }
        return data;
    });

    estadisticas = computed(() => {
        const data = this.filteredData();
        return {
            total: data.length,
            disponibles: data.filter(i => i.estado === 'DISPONIBLE').length,
            bajoStock: data.filter(i => i.estado === 'BAJO STOCK').length,
            sinStock: data.filter(i => i.estado === 'SIN STOCK').length,
            valorTotal: data.reduce((sum, i) => sum + (i.valorUnitario * i.stockActual), 0)
        };
    });

    ngOnInit(): void {
        this.searchForm = this.fb.group({
            searchTerm: [''],
            ubicacion: [''],
            estado: ['']
        });
        this.loadInventory();
    }

    private loadInventory(): void {
        this.isLoading.set(true);

        forkJoin({
            tools: this.toolService.getTools(),
            categories: this.categoryService.getCategories()
        }).subscribe({
            next: ({ tools, categories }) => {
                // Construir mapa category_id → nombre
                const categoryMap: Record<number, string> = {};
                for (const cat of categories as any[]) {
                    categoryMap[cat.id_category] = cat.name;
                }

                const items = (tools as any[]).map(t => this.mapToolToInventoryItem(t, categoryMap));
                this.inventoryData.set(items);

                // Poblar listas de filtros dinámicamente desde los datos reales
                this.categorias = [...new Set(items.map(i => i.categoria))].sort();
                this.ubicaciones = [...new Set(items.map(i => i.ubicacion))].sort();

                this.isLoading.set(false);
            },
            error: () => {
                this.isLoading.set(false);
            }
        });
    }

    private mapToolToInventoryItem(tool: any, categoryMap: Record<number, string>): InventoryItem {
        const categoria = categoryMap[tool.category_id]
            || (tool.category_id ? `Categoría ${tool.category_id}` : 'Sin categoría');
        const ubicacion = tool.warehouse_id ? `Almacén ${tool.warehouse_id}` : 'Sin ubicación';

        // Estado basado en el status del backend
        const statusMap: Record<string, InventoryItem['estado']> = {
            'DISPONIBLE':  'DISPONIBLE',
            'CALIBRACION': 'EN CALIBRACION',
            'PRESTADO':    'EN PRESTAMO',
            'TRANSFERIDO': 'EN PRESTAMO',
            'CUARENTENA':  'CUARENTENA',
            'BAJA':        'CUARENTENA'
        };
        let estado: InventoryItem['estado'] = statusMap[tool.status] || 'DISPONIBLE';
        if (estado === 'DISPONIBLE' && (tool.quantity_in_stock ?? 0) <= 0) {
            estado = 'SIN STOCK';
        }

        // Condición física
        const condicionMap: Record<string, InventoryItem['condicion']> = {
            'excellent': 'EXCELENTE',
            'good':      'BUENO',
            'fair':      'REGULAR',
            'poor':      'MALO'
        };
        const condicion: InventoryItem['condicion'] = condicionMap[tool.condition] || 'BUENO';

        return {
            id: tool.id_tool,
            codigo: tool.code || '',
            partNumber: tool.part_number || tool.model || '',
            descripcion: tool.name || '',
            categoria,
            ubicacion,
            stockActual: tool.quantity_in_stock ?? 0,
            stockMinimo: 0,
            stockMaximo: 10,
            estado,
            ultimoMovimiento: tool.fecha_mod
                ? new Date(tool.fecha_mod)
                : new Date(tool.fecha_reg),
            valorUnitario: tool.purchase_price ?? 0,
            proveedor:  tool.supplier || tool.brand || undefined,
            serialNumber: tool.serial_number || undefined,
            fechaCalibracion: tool.last_calibration_date
                ? new Date(tool.last_calibration_date)
                : undefined,
            proximaCalibracion: tool.next_calibration_date
                ? new Date(tool.next_calibration_date)
                : undefined,
            condicion
        };
    }

    changeView(mode: 'grid' | 'list' | 'table'): void {
        this.viewMode.set(mode);
    }

    verDetalle(item: InventoryItem): void {
        this.selectedItem.set(item);
    }

    cerrarDetalle(): void {
        this.selectedItem.set(null);
    }

    getStatusClass(estado: string): string {
        const classes: Record<string, string> = {
            'DISPONIBLE':     'bg-emerald-100 text-emerald-800 border-emerald-800',
            'BAJO STOCK':     'bg-yellow-100 text-yellow-800 border-yellow-800',
            'SIN STOCK':      'bg-red-100 text-red-800 border-red-800',
            'EN CALIBRACION': 'bg-purple-100 text-purple-800 border-purple-800',
            'EN PRESTAMO':    'bg-blue-100 text-blue-800 border-blue-800',
            'CUARENTENA':     'bg-orange-100 text-orange-800 border-orange-800'
        };
        return classes[estado] || 'bg-gray-200 text-black border-black';
    }

    getCondicionClass(condicion: string): string {
        const classes: Record<string, string> = {
            'EXCELENTE': 'bg-green-100 text-green-800 border-green-800',
            'BUENO':     'bg-blue-100 text-blue-800 border-blue-800',
            'REGULAR':   'bg-yellow-100 text-yellow-800 border-yellow-800',
            'MALO':      'bg-red-100 text-red-800 border-red-800'
        };
        return classes[condicion] || 'bg-gray-200 text-black border-black';
    }

    getStockPorcentaje(item: InventoryItem): number {
        if (!item.stockMaximo) return 0;
        return Math.min(100, (item.stockActual / item.stockMaximo) * 100);
    }

    getStockBarColor(porcentaje: number): string {
        if (porcentaje >= 70) return 'bg-green-500';
        if (porcentaje >= 30) return 'bg-yellow-500';
        return 'bg-red-500';
    }

    cerrar(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/dashboard']);
        }
    }

    exportarExcel(): void {
        alert('Exportando a Excel...');
    }

    generarQR(item: InventoryItem): void {
        alert(`QR generado para: ${item.codigo}`);
    }

    imprimirEtiqueta(item: InventoryItem): void {
        alert(`Imprimiendo etiqueta para: ${item.codigo}`);
    }

    ajustarStock(item: InventoryItem): void {
        alert(`Ajustar stock de: ${item.codigo}`);
    }

    verHistorial(item: InventoryItem): void {
        alert(`Mostrando historial de: ${item.codigo}`);
    }

    toggleFilters(): void {
        this.showFilters.set(!this.showFilters());
    }

    limpiarFiltros(): void {
        this.searchTerm.set('');
        this.selectedCategoria.set('todas');
        this.selectedEstado.set('todos');
        this.selectedUbicacion.set('todas');
    }
}
