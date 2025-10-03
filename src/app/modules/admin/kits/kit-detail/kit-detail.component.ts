import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { KitService } from 'app/core/services';
import { Kit } from 'app/core/models';

@Component({
    selector: 'app-kit-detail',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatTabsModule,
        MatChipsModule,
    ],
    templateUrl: './kit-detail.component.html',
    styleUrl: './kit-detail.component.scss'
})
export default class KitDetailComponent implements OnInit {
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _kitService = inject(KitService);

    kit: Kit | null = null;
    loading = false;

    itemsColumns: string[] = ['toolCode', 'toolName', 'quantity', 'required', 'status'];

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('id');
        if (id) {
            this.loadKit(id);
        }
    }

    loadKit(id: string): void {
        this.loading = true;
        this._kitService.getKitById(id).subscribe({
            next: (kit) => {
                this.kit = kit;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    edit(): void {
        if (this.kit) {
            this._router.navigate(['/kits', this.kit.id, 'edit']);
        }
    }

    back(): void {
        this._router.navigate(['/kits/list']);
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            available: 'Disponible',
            in_use: 'En Uso',
            incomplete: 'Incompleto',
            in_calibration: 'En Calibración',
            in_maintenance: 'En Mantenimiento',
            inactive: 'Inactivo'
        };
        return labels[status] || status;
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            available: 'primary',
            in_use: 'accent',
            incomplete: 'warn',
            in_calibration: 'accent',
            in_maintenance: 'warn',
            inactive: ''
        };
        return colors[status] || '';
    }
}
