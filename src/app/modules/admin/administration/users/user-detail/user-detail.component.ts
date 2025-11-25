import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { UserService } from 'app/core/services';
import { User } from 'app/core/models';

@Component({
    selector: 'app-user-detail',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatChipsModule,
        MatDividerModule,
        MatTabsModule,
    ],
    templateUrl: './user-detail.component.html',
    styleUrl: './user-detail.component.scss'
})
export default class UserDetailComponent implements OnInit {
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _userService = inject(UserService);

    user: User | null = null;
    loading = false;

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('id');
        if (id) {
            this.loadUser(id);
        }
    }

    loadUser(id: string): void {
        this.loading = true;
        this._userService.getUserById(id).subscribe({
            next: (user) => {
                this.user = user;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this._router.navigate(['/administration/users']);
            },
        });
    }

    goBack(): void {
        this._router.navigate(['/administration/users']);
    }

    editUser(): void {
        if (this.user?.id) {
            this._router.navigate(['/administration/users/edit', this.user.id]);
        }
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            active: 'Activo',
            inactive: 'Inactivo',
            suspended: 'Suspendido',
        };
        return labels[status] || status;
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            active: 'primary',
            inactive: '',
            suspended: 'warn',
        };
        return colors[status] || '';
    }

    getRoleLabel(role: string): string {
        const labels: Record<string, string> = {
            admin: 'Administrador',
            warehouse_manager: 'Jefe de Almacén',
            technician: 'Técnico',
            viewer: 'Visualizador',
        };
        return labels[role] || role;
    }
}
