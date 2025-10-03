import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

interface DecommissionDetail {
    id: string;
    toolId: string;
    toolCode: string;
    toolName: string;
    reason: string;
    date: Date;
    approvedBy?: string;
    approvalDate?: Date;
    status: 'pending' | 'approved' | 'completed';
    notes?: string;
    requestedBy: string;
}

@Component({
    selector: 'app-decommission-detail',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatChipsModule,
        MatDividerModule,
    ],
    templateUrl: './decommission-detail.component.html',
    styleUrl: './decommission-detail.component.scss'
})
export default class DecommissionDetailComponent implements OnInit {
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);

    decommission: DecommissionDetail | null = null;
    loading = false;

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('id');
        if (id) {
            this.loadDecommission(id);
        }
    }

    loadDecommission(id: string): void {
        this.loading = true;
        // TODO: Replace with actual service call
        const mockData: DecommissionDetail = {
            id,
            toolId: 'T001',
            toolCode: 'MIC-001',
            toolName: 'Micrómetro Digital 0-25mm',
            reason: 'Desgaste irreparable',
            date: new Date('2024-02-01'),
            status: 'pending',
            notes: 'Herramienta con más de 10 años de uso',
            requestedBy: 'Juan Pérez',
        };

        this.decommission = mockData;
        this.loading = false;
    }

    goBack(): void {
        this._router.navigate(['/status-management/decommission']);
    }

    approveDecommission(): void {
        // TODO: Implement approval logic
        console.log('Approve decommission');
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            pending: 'Pendiente',
            approved: 'Aprobado',
            completed: 'Completado',
        };
        return labels[status] || status;
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            pending: 'accent',
            approved: 'primary',
            completed: 'primary',
        };
        return colors[status] || '';
    }
}
