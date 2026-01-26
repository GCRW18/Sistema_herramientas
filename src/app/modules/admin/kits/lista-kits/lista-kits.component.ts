import { Component, OnInit, inject, signal, computed, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { FormsModule } from '@angular/forms';

// Interfaces
interface Kit {
    id: number;
    nombre: string;
    descripcion: string;
    cantidadItems: number;
    ubicacion?: string;
    ultimaActualizacion: Date;
    items?: KitItem[];
    categoria: 'MANTENIMIENTO' | 'LUBRICACION' | 'FRENOS' | 'CALIBRACION' | 'GENERAL';
    modelo?: string;
    estado: 'COMPLETO' | 'INCOMPLETO' | 'EN USO' | 'MANTENIMIENTO';
    responsable?: string;
    cantidadUsos?: number;
}

interface KitItem {
    nroArt: string;
    descripcion: string;
    codigoBoamm: string;
    ubicacion: string;
    estado?: 'DISPONIBLE' | 'EN USO' | 'CALIBRACION';
}

@Component({
    selector: 'app-lista-kits',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MatInputModule,
        MatFormFieldModule,
        MatTooltipModule,
        MatChipsModule,
        MatBadgeModule,
        FormsModule
    ],
    // Usamos None para estilos globales en este componente si fuera necesario,
    // pero con Tailwind y las clases inline suele bastar.
    // Lo dejo por si acaso los scrollbars necesitan penetrar.
    encapsulation: ViewEncapsulation.None,
    templateUrl: './lista-kits.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        /* Custom Scrollbar para el Sidebar y Contenido */
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

        /* Animación de entrada */
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in {
            animation: slideIn 0.3s ease-out forwards;
        }
    `]
})
export class ListaKitsComponent implements OnInit {
    private dialog = inject(MatDialog);
    private router = inject(Router);

    // Signals
    searchTerm = signal('');
    selectedCategoria = signal<string>('todas');
    selectedModelo = signal<string>('todos');
    selectedEstado = signal<string>('todos');
    viewMode = signal<'grid' | 'list'>('grid');
    showFilters = signal(true);

    kits: Kit[] = [];
    categorias = ['MANTENIMIENTO', 'LUBRICACION', 'FRENOS', 'CALIBRACION', 'GENERAL'];
    modelos = ['737-300', 'NG', '767', 'TODOS'];
    estados = ['COMPLETO', 'INCOMPLETO', 'EN USO', 'MANTENIMIENTO'];

    // Computed
    kitsFiltrados = computed(() => {
        let data = this.kits;
        const term = this.searchTerm().toLowerCase();
        const categoria = this.selectedCategoria();
        const modelo = this.selectedModelo();
        const estado = this.selectedEstado();

        if (term) {
            data = data.filter(kit =>
                kit.nombre.toLowerCase().includes(term) ||
                kit.descripcion.toLowerCase().includes(term) ||
                kit.ubicacion?.toLowerCase().includes(term)
            );
        }
        if (categoria !== 'todas') {
            data = data.filter(kit => kit.categoria === categoria);
        }
        if (modelo !== 'todos') {
            data = data.filter(kit => kit.modelo?.includes(modelo));
        }
        if (estado !== 'todos') {
            data = data.filter(kit => kit.estado === estado);
        }
        return data;
    });

    stats = computed(() => {
        const data = this.kitsFiltrados();
        const totalItems = data.reduce((sum, kit) => sum + kit.cantidadItems, 0);

        return {
            totalKits: data.length,
            kitsCompletos: data.filter(k => k.estado === 'COMPLETO').length,
            kitsEnUso: data.filter(k => k.estado === 'EN USO').length,
            totalItems: totalItems
        };
    });

    ngOnInit(): void {
        this.cargarKits();
    }

    private cargarKits(): void {
        // DATOS MOCKADOS (Mismos que tu código)
        this.kits = [
            {
                id: 1,
                nombre: 'KIT PARA FREE PLAY (MLG) 737-300',
                descripcion: 'Kit completo para mantenimiento Free Play MLG',
                cantidadItems: 12,
                ubicacion: '13-SUELO',
                ultimaActualizacion: new Date('2024-01-15'),
                categoria: 'MANTENIMIENTO',
                modelo: '737-300 CLASICO',
                estado: 'COMPLETO',
                responsable: 'Juan Pérez',
                cantidadUsos: 45,
                items: [
                    { nroArt: '1', descripcion: 'TRIPODE', codigoBoamm: 'BOA-H-83463', ubicacion: '13-SUELO', estado: 'DISPONIBLE' },
                    // ... resto de items
                ]
            },
            {
                id: 2,
                nombre: 'AJUSTE JHIMMY DAMPER (LINEA)',
                descripcion: 'Herramientas para ajuste de Jhimmy Damper en línea',
                cantidadItems: 5,
                ubicacion: 'S-4',
                ultimaActualizacion: new Date('2024-01-10'),
                categoria: 'MANTENIMIENTO',
                modelo: 'GENERAL',
                estado: 'EN USO',
                responsable: 'María López',
                cantidadUsos: 32
            },
            {
                id: 3,
                nombre: 'KIT PARA FREE PLAY (NG)',
                descripcion: 'Kit para Free Play de nueva generación',
                cantidadItems: 18,
                ubicacion: 'S-3',
                ultimaActualizacion: new Date('2024-01-20'),
                categoria: 'MANTENIMIENTO',
                modelo: 'NG',
                estado: 'COMPLETO',
                responsable: 'Carlos Rojas',
                cantidadUsos: 67
            },
            {
                id: 4,
                nombre: 'KIT PARA CAMBIO DE FRENOS CLASICO-300',
                descripcion: 'Kit completo para cambio de frenos en aeronaves clásicas',
                cantidadItems: 8,
                ubicacion: 'S-3',
                ultimaActualizacion: new Date('2024-01-12'),
                categoria: 'FRENOS',
                modelo: '737-300 CLASICO',
                estado: 'COMPLETO',
                responsable: 'Ana Méndez',
                cantidadUsos: 54
            },
            {
                id: 5,
                nombre: 'LUBRICACION BLADES 737-300 CLASICO',
                descripcion: 'Kit de lubricación para aspas de turbina',
                cantidadItems: 5,
                ubicacion: '16-2',
                ultimaActualizacion: new Date('2024-01-08'),
                categoria: 'LUBRICACION',
                modelo: '737-300 CLASICO',
                estado: 'INCOMPLETO',
                responsable: 'Luis Torres',
                cantidadUsos: 28
            },
            {
                id: 6,
                nombre: 'LUBRICACION BLADES NG',
                descripcion: 'Kit de lubricación para aspas NG',
                cantidadItems: 5,
                ubicacion: '16-3',
                ultimaActualizacion: new Date('2024-01-09'),
                categoria: 'LUBRICACION',
                modelo: 'NG',
                estado: 'COMPLETO',
                responsable: 'Roberto Vargas',
                cantidadUsos: 38
            },
            {
                id: 7,
                nombre: 'LUBRICACION BLADES 767',
                descripcion: 'Kit de lubricación para aspas 767',
                cantidadItems: 5,
                ubicacion: '16-3',
                ultimaActualizacion: new Date('2024-01-07'),
                categoria: 'LUBRICACION',
                modelo: '767',
                estado: 'MANTENIMIENTO',
                responsable: 'Pedro Sánchez',
                cantidadUsos: 19
            }
        ];
    }

    changeView(mode: 'grid' | 'list'): void {
        this.viewMode.set(mode);
    }

    async verDetalle(kit: Kit): Promise<void> {
        const { DetalleKitDialogComponent } = await import('./detalle-kit-dialog/detalle-kit-dialog.component');
        this.dialog.open(DetalleKitDialogComponent, {
            width: '1400px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog',
            data: kit
        });
    }

    toggleFilters(): void {
        this.showFilters.set(!this.showFilters());
    }

    limpiarFiltros(): void {
        this.searchTerm.set('');
        this.selectedCategoria.set('todas');
        this.selectedModelo.set('todos');
        this.selectedEstado.set('todos');
    }

    getEstadoClass(estado: string): string {
        const classes: Record<string, string> = {
            'COMPLETO': 'bg-green-100 text-green-800 border-green-800',
            'INCOMPLETO': 'bg-yellow-100 text-yellow-800 border-yellow-800',
            'EN USO': 'bg-blue-100 text-blue-800 border-blue-800',
            'MANTENIMIENTO': 'bg-purple-100 text-purple-800 border-purple-800'
        };
        return classes[estado] || 'bg-gray-200 text-black border-black';
    }

    getCategoriaClass(categoria: string): string {
        const classes: Record<string, string> = {
            'MANTENIMIENTO': 'bg-[#111A43] text-white',
            'LUBRICACION': 'bg-green-600 text-white',
            'FRENOS': 'bg-red-600 text-white',
            'CALIBRACION': 'bg-purple-600 text-white',
            'GENERAL': 'bg-gray-600 text-white'
        };
        return classes[categoria] || 'bg-gray-600 text-white';
    }

    async crearNuevoKit(): Promise<void> {
        const { GestionarKitComponent } = await import('../gestionar-kit/gestionar-kit.component');
        const dialogRef = this.dialog.open(GestionarKitComponent, {
            width: '1200px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '90vh',
            panelClass: 'neo-dialog'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                const nuevoKit: Kit = {
                    id: this.kits.length + 1,
                    nombre: result.nombreKit,
                    descripcion: result.descripcionKit,
                    cantidadItems: result.items.length,
                    ultimaActualizacion: new Date(),
                    items: result.items,
                    categoria: 'GENERAL',
                    estado: 'COMPLETO',
                    cantidadUsos: 0
                };
                this.kits.unshift(nuevoKit);
            }
        });
    }

    exportarExcel(): void {
        alert('Exportando kits a Excel...');
    }

    goBack(): void {
        this.router.navigate(['/dashboard']); // O la ruta que corresponda
    }
}
