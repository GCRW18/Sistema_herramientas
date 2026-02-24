import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';

interface UnifiedMovementRecord {
    fecha: string;
    tipo: string;
    item: string;
    origen: 'INVENTARIO' | 'KITS';
    estado: string;
    responsable: string;
    cantidad: number;
}

@Component({
    selector: 'app-unified-movements',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule
    ],
    templateUrl: './unified-movements.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        .neo-card-base {
            background-color: white;
            border: 3px solid black;
            border-radius: 12px;
            box-shadow: 6px 6px 0px 0px rgba(0, 0, 0, 1);
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
            position: relative;
        }

        .header-neo {
            background-color: white !important;
            color: #111A43 !important;
            font-weight: 900 !important;
            font-size: 14px !important;
            border-bottom: 3px solid black !important;
            padding: 20px !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .cell-neo {
            padding: 18px 20px !important;
            border-bottom: 1px solid #000000 !important;
            font-size: 14px !important;
            color: black;
        }

        :host-context(.dark) .header-neo {
            background-color: #111A43 !important;
            color: white !important;
        }

        :host-context(.dark) .cell-neo {
            color: #000000;
            border-bottom-color: #333;
        }
    `]
})
export class UnifiedMovementsComponent implements OnInit {

    allRecords: UnifiedMovementRecord[] = [
        { fecha: '03/01/2026', tipo: 'AJUSTE STOCK', item: 'LLAVE TORQUE 12MM', origen: 'INVENTARIO', estado: 'COMPLETADO', responsable: 'GABRIEL CR', cantidad: 5 },
        { fecha: '02/01/2026', tipo: 'ENTRADA MATERIAL', item: 'KIT INSPECCION A320', origen: 'KITS', estado: 'COMPLETADO', responsable: 'GABRIEL CR', cantidad: 1 },
        { fecha: '02/01/2026', tipo: 'REUBICACION', item: 'TALADRO INDUSTRIAL', origen: 'INVENTARIO', estado: 'COMPLETADO', responsable: 'JUAN PEREZ', cantidad: 1 },
        { fecha: '30/12/2025', tipo: 'SALIDA MATERIAL', item: 'COMPONENTES NDT', origen: 'KITS', estado: 'EN PROCESO', responsable: 'ANA LOPEZ', cantidad: 3 },
        { fecha: '29/12/2025', tipo: 'CONTEO FISICO', item: 'DESTORNILLADOR SET', origen: 'INVENTARIO', estado: 'COMPLETADO', responsable: 'ANA LOPEZ', cantidad: 3 },
        { fecha: '29/12/2025', tipo: 'RETORNO CALIBRACION', item: 'KIT TORQUIMETROS', origen: 'KITS', estado: 'REVISION', responsable: 'JUAN PEREZ', cantidad: 1 },
        { fecha: '28/12/2025', tipo: 'AJUSTE STOCK', item: 'MULTIMETRO FLUKE', origen: 'INVENTARIO', estado: 'COMPLETADO', responsable: 'CARLOS ROJAS', cantidad: 2 },
        { fecha: '27/12/2025', tipo: 'CREAR MATERIAL', item: 'HERRAMIENTA NUEVA XZ-100', origen: 'KITS', estado: 'COMPLETADO', responsable: 'MARIA GONZALEZ', cantidad: 1 }
    ];

    filterOrigin = signal<'TODOS' | 'INVENTARIO' | 'KITS'>('TODOS');
    searchTerm = signal('');

    filteredRecords = computed(() => {
        const origin = this.filterOrigin();
        const term = this.searchTerm().toUpperCase().trim();

        return this.allRecords.filter(record => {
            const matchesOrigin = origin === 'TODOS' || record.origen === origin;
            const matchesSearch = !term ||
                record.item.toUpperCase().includes(term) ||
                record.tipo.toUpperCase().includes(term) ||
                record.responsable.toUpperCase().includes(term) ||
                record.estado.toUpperCase().includes(term);
            return matchesOrigin && matchesSearch;
        });
    });

    ngOnInit(): void {
    }

    setFilter(origin: 'TODOS' | 'INVENTARIO' | 'KITS'): void {
        this.filterOrigin.set(origin);
    }

    onSearchChange(value: string): void {
        this.searchTerm.set(value);
    }

    getEstadoClasses(estado: string): string {
        const classes: Record<string, string> = {
            'COMPLETADO': 'bg-green-100 text-green-900 border-green-900',
            'EN PROCESO': 'bg-yellow-100 text-yellow-900 border-yellow-900',
            'REVISION': 'bg-orange-100 text-orange-900 border-orange-900',
            'PENDIENTE': 'bg-gray-100 text-gray-900 border-gray-900'
        };
        return classes[estado] || 'bg-gray-100 text-gray-800';
    }

    getOrigenClasses(origen: string): string {
        const classes: Record<string, string> = {
            'INVENTARIO': 'bg-[#111A43] text-white',
            'KITS': 'bg-[#06b6d4] text-black'
        };
        return classes[origen] || 'bg-gray-500 text-white';
    }
}
