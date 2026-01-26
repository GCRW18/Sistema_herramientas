import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';

interface KPICard {
    title: string;
    value: number | string;
    subtitle?: string;
    icon: string;
    variant?: string;
}

interface KitMovement {
    kitCode: string;
    kitName: string;
    action: string;
    user: string;
    date: string;
    status: 'borrowed' | 'returned' | 'verified' | 'maintenance';
}

@Component({
    selector: 'app-kits-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatDividerModule,
        MatChipsModule
    ],
    templateUrl: './kits-dashboard.component.html',
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

        .neo-card-base:hover {
            transform: translate(-2px, -2px);
            box-shadow: 8px 8px 0px 0px rgba(0, 0, 0, 1);
        }

        :host-context(.dark) .neo-card-base:hover {
            box-shadow: 8px 8px 0px 0px rgb(9, 16, 55);
        }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; border: 1px solid white; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
    `]
})
export class KitsDashboardComponent implements OnInit {
    Math = Math;
    isLoading = signal(false);

    kpiCards = signal<KPICard[]>([
        { title: 'Total de Kits', value: 45, subtitle: 'Registrados', icon: 'heroicons_outline:cube', variant: 'cyan' },
        { title: 'Kits Completos', value: 32, subtitle: '100% Items', icon: 'heroicons_outline:check-circle', variant: 'green' },
        { title: 'Kits Incompletos', value: 8, subtitle: 'Atención Req.', icon: 'heroicons_outline:exclamation-triangle', variant: 'yellow' },
        { title: 'Kits en Uso', value: 5, subtitle: 'Prestados', icon: 'heroicons_outline:arrow-right-circle', variant: 'purple' },
        { title: 'Componentes', value: 380, subtitle: 'Total Items', icon: 'heroicons_outline:squares-plus', variant: 'navy' },
        { title: 'Faltantes', value: 12, subtitle: 'Reponer', icon: 'heroicons_outline:x-circle', variant: 'red' },
        { title: 'Calibración', value: 6, subtitle: 'Vencidos/Prox', icon: 'heroicons_outline:wrench-screwdriver', variant: 'orange' },
        { title: 'Fuera Servicio', value: 0, subtitle: 'Bajas', icon: 'heroicons_outline:no-symbol', variant: 'black' }
    ]);

    kitsByStatusData = signal({
        labels: ['Completos', 'Incompletos', 'En Uso', 'Fuera Servicio'],
        data: [32, 8, 5, 0],
        colors: ['#04f428', '#FBBF24', '#8b5cf6', '#6b7280']
    });

    usageTrendData = signal({
        labels: ['JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
        data: [12, 18, 15, 22, 19, 25]
    });

    topKitsData = signal({
        labels: ['Kit Insp. A320', 'Kit Herr. Básico', 'Kit NDT Ultra', 'Kit Torquímetros', 'Kit Medición'],
        data: [45, 38, 32, 28, 24],
        colors: ['#06b6d4', '#8b5cf6', '#ec4899', '#FBBF24', '#04f428']
    });

    recentMovements = signal<KitMovement[]>([
        { kitCode: 'KIT-001', kitName: 'Kit Inspección A320', action: 'Préstamo', user: 'Juan Pérez', date: '2024-12-15T10:30:00', status: 'borrowed' },
        { kitCode: 'KIT-012', kitName: 'Kit NDT Ultrasonido', action: 'Devolución', user: 'María González', date: '2024-12-15T09:15:00', status: 'returned' },
        { kitCode: 'KIT-005', kitName: 'Kit Torquímetros', action: 'Verificación', user: 'Carlos Mamani', date: '2024-12-14T16:45:00', status: 'verified' },
        { kitCode: 'KIT-008', kitName: 'Kit Herr. Básico', action: 'Préstamo', user: 'Ana Flores', date: '2024-12-14T14:20:00', status: 'borrowed' },
        { kitCode: 'KIT-003', kitName: 'Kit Medición', action: 'Mantenimiento', user: 'Luis Quispe', date: '2024-12-14T11:00:00', status: 'maintenance' },
        { kitCode: 'KIT-015', kitName: 'Kit Eléctrico', action: 'Devolución', user: 'Roberto Choque', date: '2024-12-13T17:30:00', status: 'returned' },
    ]);

    ngOnInit(): void {
        this.isLoading.set(true);
        setTimeout(() => this.isLoading.set(false), 500);
    }

    getChartMax(data: number[]): number {
        const max = Math.max(...data);
        return Math.ceil(max * 1.2) || 10;
    }

    getBarHeight(value: number, max: number): number {
        return (value / max) * 100;
    }

    formatDate(date: string): string {
        const d = new Date(date);
        return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    }

    getVariantStyles(variant: string | undefined): string {
        const styles: { [key: string]: string } = {
            'cyan': 'bg-[#06b6d4] text-black',
            'green': 'bg-[#04f428] text-black',
            'yellow': 'bg-[#FBBF24] text-black',
            'purple': 'bg-[#8b5cf6] text-white',
            'navy': 'bg-[#111A43] text-white',
            'red': 'bg-[#f61104] text-white',
            'orange': 'bg-[#f97316] text-white',
            'black': 'bg-[#000000] text-white',
        };
        return styles[variant || 'cyan'];
    }

    getMovementStatusClass(status: string): string {
        const classes: { [key: string]: string } = {
            'borrowed': 'bg-purple-100 text-purple-900 border-purple-900 dark:bg-purple-900 dark:text-purple-100',
            'returned': 'bg-green-100 text-green-900 border-green-900 dark:bg-green-900 dark:text-green-100',
            'verified': 'bg-blue-100 text-blue-900 border-blue-900 dark:bg-blue-900 dark:text-blue-100',
            'maintenance': 'bg-orange-100 text-orange-900 border-orange-900 dark:bg-orange-900 dark:text-orange-100'
        };
        return classes[status] || 'bg-gray-100 text-black';
    }

    getMovementStatusLabel(status: string): string {
        const labels: { [key: string]: string } = {
            'borrowed': 'PRESTADO',
            'returned': 'DEVUELTO',
            'verified': 'VERIFICADO',
            'maintenance': 'TALLER'
        };
        return labels[status] || status;
    }
}
