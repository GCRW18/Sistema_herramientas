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
import { DragDropModule } from '@angular/cdk/drag-drop';

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
    public dialogRef = inject(MatDialogRef<ConsultarInventarioComponent>, { optional: true });

    // Signals
    searchTerm = signal('');
    selectedCategoria = signal<string>('todas');
    selectedEstado = signal<string>('todos');
    selectedUbicacion = signal<string>('todas');
    viewMode = signal<'grid' | 'list' | 'table'>('grid');
    selectedItem = signal<InventoryItem | null>(null);
    showFilters = signal(true);

    searchForm!: FormGroup;

    // Data simulada
    inventoryData: InventoryItem[] = [
        {
            id: 1,
            codigo: 'BOA-H-12345',
            partNumber: 'TQ-200',
            descripcion: 'TORQUÍMETRO DIGITAL 20-200 NM',
            categoria: 'CALIBRACIÓN',
            ubicacion: '13-SUELO',
            stockActual: 5,
            stockMinimo: 2,
            stockMaximo: 10,
            estado: 'DISPONIBLE',
            ultimoMovimiento: new Date('2024-12-28'),
            valorUnitario: 2500,
            proveedor: 'SNAP-ON',
            serialNumber: 'SN-TQ-001',
            fechaCalibracion: new Date('2024-06-01'),
            proximaCalibracion: new Date('2025-06-01'),
            condicion: 'EXCELENTE'
        },
        {
            id: 2,
            codigo: 'BOA-H-12346',
            partNumber: 'TLD-45',
            descripcion: 'TALADRO INDUSTRIAL 1/2" 850W',
            categoria: 'ELÉCTRICAS',
            ubicacion: '14-RACK-A2',
            stockActual: 3,
            stockMinimo: 2,
            stockMaximo: 8,
            estado: 'DISPONIBLE',
            ultimoMovimiento: new Date('2024-12-27'),
            valorUnitario: 1200,
            proveedor: 'DEWALT',
            condicion: 'BUENO'
        },
        {
            id: 3,
            codigo: 'BOA-H-12347',
            partNumber: 'DST-SET-12',
            descripcion: 'SET DESTORNILLADORES 12 PZAS',
            categoria: 'MANUALES',
            ubicacion: '15-ESTANTE-B1',
            stockActual: 1,
            stockMinimo: 5,
            stockMaximo: 15,
            estado: 'BAJO STOCK',
            ultimoMovimiento: new Date('2024-12-26'),
            valorUnitario: 450,
            proveedor: 'STANLEY',
            condicion: 'BUENO'
        },
        {
            id: 4,
            codigo: 'BOA-H-99881',
            partNumber: 'CTA-3M-50',
            descripcion: 'CINTA AISLANTE 3M 50MM',
            categoria: 'CONSUMIBLES',
            ubicacion: '02-PASILLO',
            stockActual: 0,
            stockMinimo: 10,
            stockMaximo: 50,
            estado: 'SIN STOCK',
            ultimoMovimiento: new Date('2024-12-25'),
            valorUnitario: 25,
            proveedor: '3M',
            condicion: 'BUENO'
        },
        {
            id: 5,
            codigo: 'BOA-H-55421',
            partNumber: 'FLUKE-87V',
            descripcion: 'MULTÍMETRO DIGITAL FLUKE 87V',
            categoria: 'MEDICIÓN',
            ubicacion: '05-SEGURIDAD',
            stockActual: 8,
            stockMinimo: 3,
            stockMaximo: 12,
            estado: 'DISPONIBLE',
            ultimoMovimiento: new Date('2024-12-29'),
            valorUnitario: 3500,
            proveedor: 'FLUKE',
            serialNumber: 'FL-87V-003',
            fechaCalibracion: new Date('2024-08-01'),
            proximaCalibracion: new Date('2025-08-01'),
            condicion: 'EXCELENTE'
        },
        {
            id: 6,
            codigo: 'BOA-H-78965',
            partNumber: 'KIT-B737',
            descripcion: 'KIT HERRAMIENTAS BOEING 737',
            categoria: 'KITS',
            ubicacion: '10-RACK-C3',
            stockActual: 2,
            stockMinimo: 1,
            stockMaximo: 4,
            estado: 'EN PRESTAMO',
            ultimoMovimiento: new Date('2024-12-20'),
            valorUnitario: 15000,
            proveedor: 'BOEING',
            condicion: 'EXCELENTE'
        },
        {
            id: 7,
            codigo: 'BOA-H-34567',
            partNumber: 'MIC-DIG-25',
            descripcion: 'MICRÓMETRO DIGITAL 0-25MM',
            categoria: 'CALIBRACIÓN',
            ubicacion: '13-SUELO',
            stockActual: 3,
            stockMinimo: 2,
            stockMaximo: 6,
            estado: 'EN CALIBRACION',
            ultimoMovimiento: new Date('2024-12-15'),
            valorUnitario: 1800,
            proveedor: 'MITUTOYO',
            serialNumber: 'MIT-25-089',
            fechaCalibracion: new Date('2024-01-01'),
            proximaCalibracion: new Date('2025-01-01'),
            condicion: 'BUENO'
        },
        {
            id: 8,
            codigo: 'BOA-H-98123',
            partNumber: 'ESM-ANG-7',
            descripcion: 'ESMERIL ANGULAR 7" 2200W',
            categoria: 'ELÉCTRICAS',
            ubicacion: '14-RACK-A2',
            stockActual: 1,
            stockMinimo: 2,
            stockMaximo: 5,
            estado: 'CUARENTENA',
            ultimoMovimiento: new Date('2024-12-10'),
            valorUnitario: 980,
            proveedor: 'MAKITA',
            condicion: 'MALO'
        }
    ];

    categorias = ['CALIBRACIÓN', 'ELÉCTRICAS', 'MANUALES', 'MEDICIÓN', 'KITS', 'CONSUMIBLES'];
    ubicaciones = ['13-SUELO', '14-RACK-A2', '15-ESTANTE-B1', '02-PASILLO', '05-SEGURIDAD', '10-RACK-C3'];
    estados = ['DISPONIBLE', 'BAJO STOCK', 'SIN STOCK', 'EN CALIBRACION', 'EN PRESTAMO', 'CUARENTENA'];

    // Computed
    filteredData = computed(() => {
        let data = this.inventoryData;
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
            'DISPONIBLE': 'bg-emerald-100 text-emerald-800 border-emerald-800',
            'BAJO STOCK': 'bg-yellow-100 text-yellow-800 border-yellow-800',
            'SIN STOCK': 'bg-red-100 text-red-800 border-red-800',
            'EN CALIBRACION': 'bg-purple-100 text-purple-800 border-purple-800',
            'EN PRESTAMO': 'bg-blue-100 text-blue-800 border-blue-800',
            'CUARENTENA': 'bg-orange-100 text-orange-800 border-orange-800'
        };
        return classes[estado] || 'bg-gray-200 text-black border-black';
    }

    getCondicionClass(condicion: string): string {
        const classes: Record<string, string> = {
            'EXCELENTE': 'bg-green-100 text-green-800 border-green-800',
            'BUENO': 'bg-blue-100 text-blue-800 border-blue-800',
            'REGULAR': 'bg-yellow-100 text-yellow-800 border-yellow-800',
            'MALO': 'bg-red-100 text-red-800 border-red-800'
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
