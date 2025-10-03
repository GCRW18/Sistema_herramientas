import { Injectable } from '@angular/core';
import { ErpMockApiService, ErpMockApiUtils } from '@erp/lib/mock-api';
import { movements as movementsData, entries as entriesData, exits as exitsData } from './data';
import { assign, cloneDeep } from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class MovementsMockApi {
    private _movements: any[] = movementsData;

    constructor(private _erpMockApiService: ErpMockApiService) {
        this.registerHandlers();
    }

    registerHandlers(): void {
        // Get all movements
        this._erpMockApiService
            .onGet('api/movements')
            .reply(() => [200, cloneDeep(this._movements)]);

        // Get entries
        this._erpMockApiService
            .onGet('api/movements/entries')
            .reply(() => {
                const entries = this._movements.filter(m => m.type.startsWith('entry'));
                return [200, cloneDeep(entries)];
            });

        // Get exits
        this._erpMockApiService
            .onGet('api/movements/exits')
            .reply(() => {
                const exits = this._movements.filter(m => m.type.startsWith('exit'));
                return [200, cloneDeep(exits)];
            });

        // Get movement by ID
        this._erpMockApiService
            .onGet('api/movements/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const movement = cloneDeep(this._movements.find(item => item.id === id));
                return [200, movement];
            });

        // Create movement
        this._erpMockApiService
            .onPost('api/movements')
            .reply(({ request }) => {
                const newMovement = cloneDeep(request.body);
                newMovement.id = ErpMockApiUtils.guid();
                newMovement.createdAt = new Date().toISOString();
                newMovement.updatedAt = new Date().toISOString();
                newMovement.status = 'completed';
                this._movements.unshift(newMovement);
                return [200, newMovement];
            });

        // Update movement
        this._erpMockApiService
            .onPut('api/movements/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const movement = this._movements.find(item => item.id === id);
                if (movement) {
                    assign(movement, request.body);
                    movement.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(movement)];
            });

        // Delete movement
        this._erpMockApiService
            .onDelete('api/movements/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const index = this._movements.findIndex(item => item.id === id);
                if (index > -1) {
                    this._movements.splice(index, 1);
                }
                return [200, true];
            });

        // Approve movement
        this._erpMockApiService
            .onPost('api/movements/:id/approve')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const movement = this._movements.find(item => item.id === id);
                if (movement) {
                    movement.status = 'approved';
                    movement.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(movement)];
            });

        // Complete movement
        this._erpMockApiService
            .onPost('api/movements/:id/complete')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const movement = this._movements.find(item => item.id === id);
                if (movement) {
                    movement.status = 'completed';
                    movement.effectiveDate = new Date().toISOString();
                    movement.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(movement)];
            });

        // Cancel movement
        this._erpMockApiService
            .onPost('api/movements/:id/cancel')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const data = request.body;
                const movement = this._movements.find(item => item.id === id);
                if (movement) {
                    movement.status = 'cancelled';
                    movement.cancelReason = data.reason;
                    movement.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(movement)];
            });

        // Get movement voucher
        this._erpMockApiService
            .onGet('api/movements/:id/voucher')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const movement = this._movements.find(item => item.id === id);
                const voucher = {
                    movement: cloneDeep(movement),
                    generatedAt: new Date().toISOString(),
                    generatedBy: {
                        id: 'user1',
                        name: 'Admin User',
                        email: 'admin@example.com'
                    }
                };
                return [200, voucher];
            });

        // Get movements by tool
        this._erpMockApiService
            .onGet('api/movements/tool/:toolId')
            .reply(({ request }) => {
                const toolId = request.params.get('toolId');
                const toolMovements = this._movements.filter(m =>
                    m.items?.some((item: any) => item.toolId === toolId)
                );
                return [200, cloneDeep(toolMovements)];
            });

        // Get tool movements history
        this._erpMockApiService
            .onGet('api/tools/:toolId/movements')
            .reply(({ request }) => {
                const toolId = request.params.get('toolId');
                const toolMovements = this._movements.filter(m =>
                    m.items?.some((item: any) => item.toolId === toolId)
                );
                return [200, cloneDeep(toolMovements)];
            });

        // Create entry
        this._erpMockApiService
            .onPost('api/movements/entries')
            .reply(({ request }) => {
                const newMovement = cloneDeep(request.body);
                newMovement.id = ErpMockApiUtils.guid();
                newMovement.movementNumber = `MOV-${new Date().getFullYear()}-${String(this._movements.length + 1).padStart(3, '0')}`;
                newMovement.type = 'entry';
                newMovement.status = newMovement.status || 'completed';
                newMovement.createdAt = new Date().toISOString();
                newMovement.updatedAt = new Date().toISOString();
                this._movements.unshift(newMovement);
                return [200, newMovement];
            });

        // Create exit
        this._erpMockApiService
            .onPost('api/movements/exits')
            .reply(({ request }) => {
                const newMovement = cloneDeep(request.body);
                newMovement.id = ErpMockApiUtils.guid();
                newMovement.movementNumber = `MOV-${new Date().getFullYear()}-${String(this._movements.length + 1).padStart(3, '0')}`;
                newMovement.type = 'exit';
                newMovement.status = newMovement.status || 'completed';
                newMovement.createdAt = new Date().toISOString();
                newMovement.updatedAt = new Date().toISOString();
                this._movements.unshift(newMovement);
                return [200, newMovement];
            });

        // Create transfer
        this._erpMockApiService
            .onPost('api/movements/transfers')
            .reply(({ request }) => {
                const newMovement = cloneDeep(request.body);
                newMovement.id = ErpMockApiUtils.guid();
                newMovement.movementNumber = `MOV-${new Date().getFullYear()}-${String(this._movements.length + 1).padStart(3, '0')}`;
                newMovement.type = 'transfer';
                newMovement.status = newMovement.status || 'pending';
                newMovement.createdAt = new Date().toISOString();
                newMovement.updatedAt = new Date().toISOString();
                this._movements.unshift(newMovement);
                return [200, newMovement];
            });
    }
}
