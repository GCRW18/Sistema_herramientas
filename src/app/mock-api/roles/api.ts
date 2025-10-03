import { Injectable } from '@angular/core';
import { ErpMockApiService } from '@erp/lib/mock-api';
import { Role } from 'app/core/models';
import { cloneDeep } from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class RolesMockApi {
    private _roles: Role[] = [
        {
            id: '1',
            name: 'Administrador',
            description: 'Acceso completo al sistema',
            permissions: ['admin.full'],
            userCount: 2,
            active: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01')
        },
        {
            id: '2',
            name: 'Técnico de Calibración',
            description: 'Gestión de herramientas y calibraciones',
            permissions: [
                'tools.view',
                'tools.edit',
                'calibration.view',
                'calibration.manage',
                'inventory.view'
            ],
            userCount: 5,
            active: true,
            createdAt: new Date('2024-01-15'),
            updatedAt: new Date('2024-01-15')
        },
        {
            id: '3',
            name: 'Almacenero',
            description: 'Gestión de inventario y movimientos',
            permissions: [
                'inventory.view',
                'inventory.create',
                'inventory.edit',
                'movements.view',
                'movements.create',
                'tools.view'
            ],
            userCount: 3,
            active: true,
            createdAt: new Date('2024-02-01'),
            updatedAt: new Date('2024-02-01')
        },
        {
            id: '4',
            name: 'Supervisor',
            description: 'Aprobación de movimientos y calibraciones',
            permissions: [
                'inventory.view',
                'tools.view',
                'movements.view',
                'movements.approve',
                'calibration.view',
                'calibration.approve',
                'reports.view',
                'reports.generate'
            ],
            userCount: 2,
            active: true,
            createdAt: new Date('2024-02-10'),
            updatedAt: new Date('2024-02-10')
        },
        {
            id: '5',
            name: 'Operador',
            description: 'Visualización de inventario y kits',
            permissions: [
                'inventory.view',
                'tools.view',
                'kits.view',
                'movements.view'
            ],
            userCount: 8,
            active: true,
            createdAt: new Date('2024-03-01'),
            updatedAt: new Date('2024-03-01')
        }
    ];

    constructor(private _erpMockApiService: ErpMockApiService) {
        this.registerHandlers();
    }

    registerHandlers(): void {
        // GET /api/roles
        this._erpMockApiService
            .onGet('api/roles')
            .reply(() => [200, cloneDeep(this._roles)]);

        // GET /api/roles/:id
        this._erpMockApiService
            .onGet('api/roles/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const role = this._roles.find(r => r.id === id);

                if (!role) {
                    return [404, { message: 'Role not found' }];
                }

                return [200, cloneDeep(role)];
            });

        // POST /api/roles
        this._erpMockApiService
            .onPost('api/roles')
            .reply(({ request }) => {
                const newRole = request.body as any;
                const role: Role = {
                    id: this._generateId(),
                    name: newRole.name,
                    description: newRole.description,
                    permissions: newRole.permissions || [],
                    userCount: 0,
                    active: newRole.active ?? true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                this._roles.push(role);

                return [201, cloneDeep(role)];
            });

        // PUT /api/roles/:id
        this._erpMockApiService
            .onPut('api/roles/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const updates = request.body as any;
                const roleIndex = this._roles.findIndex(r => r.id === id);

                if (roleIndex === -1) {
                    return [404, { message: 'Role not found' }];
                }

                this._roles[roleIndex] = {
                    ...this._roles[roleIndex],
                    ...updates,
                    updatedAt: new Date()
                };

                return [200, cloneDeep(this._roles[roleIndex])];
            });

        // PATCH /api/roles/:id/status
        this._erpMockApiService
            .onPatch('api/roles/:id/status')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const { active } = request.body as any;
                const roleIndex = this._roles.findIndex(r => r.id === id);

                if (roleIndex === -1) {
                    return [404, { message: 'Role not found' }];
                }

                this._roles[roleIndex].active = active;
                this._roles[roleIndex].updatedAt = new Date();

                return [200, cloneDeep(this._roles[roleIndex])];
            });

        // DELETE /api/roles/:id
        this._erpMockApiService
            .onDelete('api/roles/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const roleIndex = this._roles.findIndex(r => r.id === id);

                if (roleIndex === -1) {
                    return [404, { message: 'Role not found' }];
                }

                // Check if role has users
                if (this._roles[roleIndex].userCount && this._roles[roleIndex].userCount! > 0) {
                    return [400, { message: 'Cannot delete role with assigned users' }];
                }

                this._roles.splice(roleIndex, 1);

                return [204, null];
            });
    }

    private _generateId(): string {
        return (Math.max(...this._roles.map(r => parseInt(r.id))) + 1).toString();
    }
}
