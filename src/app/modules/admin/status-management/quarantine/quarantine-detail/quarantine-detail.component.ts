import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

interface QuarantineDetail {
    id: string;
    toolId: string;
    toolCode: string;
    toolName: string;
    reason: string;
    entryDate: Date;
    releaseDate?: Date;
    status: 'active' | 'released' | 'decommissioned';
    notes?: string;
    enteredBy: string;
    releasedBy?: string;
}

@Component({
    selector: 'app-quarantine-detail',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatChipsModule,
        MatDividerModule,
    ],
    templateUrl: './quarantine-detail.component.html',
    styleUrl: './quarantine-detail.component.scss'
})
export default class QuarantineDetailComponent implements OnInit {
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);

    quarantine: QuarantineDetail | null = null;
    loading = false;

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('id');
        if (id) {
            this.loadQuarantine(id);
        }
    }

    loadQuarantine(id: string): void {
        this.loading = true;
        // TODO: Replace with actual service call
        const mockData: QuarantineDetail = {
            id,
            toolId: 'T001',
            toolCode: 'MIC-001',
            toolName: 'Micrómetro Digital 0-25mm',
            reason: 'Lectura fuera de tolerancia',
            entryDate: new Date('2024-02-01'),
            status: 'active',
            notes: 'Requiere verificación adicional antes de liberar',
            enteredBy: 'Juan Pérez',
        };

        this.quarantine = mockData;
        this.loading = false;
    }

    goBack(): void {
        this._router.navigate(['/status-management/quarantine']);
    }

    releaseFromQuarantine(): void {
        // TODO: Implement release logic
        console.log('Release from quarantine');
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            active: 'En Cuarentena',
            released: 'Liberada',
            decommissioned: 'Dado de Baja',
        };
        return labels[status] || status;
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            active: 'warn',
            released: 'primary',
            decommissioned: '',
        };
        return colors[status] || '';
    }
}
