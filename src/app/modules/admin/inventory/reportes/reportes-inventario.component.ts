import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

interface ReportCard {
    title: string;
    value: string | number;
    subtitle: string;
    icon: string;
    color: string;
    bgColor: string;
}

@Component({
    selector: 'app-reportes-inventario',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule
    ],
    templateUrl: './reportes-inventario.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        /* Scrollbar Personalizado - Light Mode */
        .overflow-y-auto::-webkit-scrollbar { width: 10px; }
        .overflow-y-auto::-webkit-scrollbar-track {
            background: linear-gradient(to bottom, #f1f5f9, #e2e8f0);
            border-radius: 5px;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb {
            background: linear-gradient(to bottom, #94a3b8, #64748b);
            border: 2px solid #f1f5f9;
            border-radius: 5px;
            transition: all 0.3s ease;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(to bottom, #64748b, #475569);
        }

        /* Scrollbar Personalizado - Dark Mode */
        :host-context(.dark) .overflow-y-auto::-webkit-scrollbar-track {
            background: linear-gradient(to bottom, #1e293b, #0f172a);
        }
        :host-context(.dark) .overflow-y-auto::-webkit-scrollbar-thumb {
            background: linear-gradient(to bottom, #6366f1, #4f46e5);
            border-color: #1e293b;
            box-shadow: 0 0 8px rgba(99, 102, 241, 0.3);
        }
        :host-context(.dark) .overflow-y-auto::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(to bottom, #818cf8, #6366f1);
            box-shadow: 0 0 12px rgba(99, 102, 241, 0.5);
        }

        .stat-card {
            border: 3px solid black;
            box-shadow: 6px 6px 0px 0px rgba(0,0,0,1);
            border-radius: 24px;
            padding: 24px;
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .stat-card:hover {
            transform: translate(-4px, -4px);
            box-shadow: 10px 10px 0px 0px rgba(0,0,0,1);
        }

        /* Glow effects para dark mode */
        :host-context(.dark) .group:hover {
            filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.15));
        }
    `]
})
export class ReportesInventarioComponent implements OnInit {
    private router = inject(Router);

    stats: ReportCard[] = [
        {
            title: 'Total Herramientas',
            value: 1247,
            subtitle: 'En el sistema',
            icon: 'inventory_2',
            color: 'text-blue-600 dark:text-blue-400',
            bgColor: 'bg-blue-50 dark:bg-blue-500/20'
        },
        {
            title: 'Stock Disponible',
            value: 987,
            subtitle: 'Listas para uso',
            icon: 'check_circle',
            color: 'text-emerald-600 dark:text-emerald-400',
            bgColor: 'bg-emerald-50 dark:bg-emerald-500/20'
        },
        {
            title: 'Bajo Stock',
            value: 45,
            subtitle: 'Requieren atención',
            icon: 'warning',
            color: 'text-amber-600 dark:text-amber-400',
            bgColor: 'bg-amber-50 dark:bg-amber-500/20'
        },
        {
            title: 'Sin Stock',
            value: 12,
            subtitle: 'Necesitan reposición',
            icon: 'error',
            color: 'text-rose-600 dark:text-rose-400',
            bgColor: 'bg-rose-50 dark:bg-rose-500/20'
        },
        {
            title: 'Ubicaciones',
            value: 25,
            subtitle: 'Almacenes activos',
            icon: 'place',
            color: 'text-violet-600 dark:text-violet-400',
            bgColor: 'bg-violet-50 dark:bg-violet-500/20'
        },
        {
            title: 'Movimientos Hoy',
            value: 38,
            subtitle: 'Ajustes realizados',
            icon: 'sync_alt',
            color: 'text-orange-600 dark:text-orange-400',
            bgColor: 'bg-orange-50 dark:bg-orange-500/20'
        }
    ];

    ngOnInit(): void {
    }

    volver(): void {
        this.router.navigate(['/inventario']);
    }

    exportarReporte(tipo: string): void {
        console.log('Exportar reporte:', tipo);
    }
}
